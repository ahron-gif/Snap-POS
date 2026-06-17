/*
================================================================================
Script Name:    sp_CustomerCredit_CheckAndRecordApiCall.sql
Date:           2026-05-21
Author:         RDT Dev Team
Depends On:     20260521_CustomerCredits_AndLedger.sql

Description:    Atomically:
                  1. Resolves an ApiDefinition by code.
                  2. Computes the customer's effective free tier (override or default)
                     and per-call rate (override > plan > default).
                  3. Counts lifetime calls already made for this (Customer, Api).
                  4. If the new call would stay within the free tier → writes the
                     ApiUsageLog row, returns Allowed=1, Cost=0.
                  5. Otherwise computes cost. If the wallet balance covers it →
                     debits the wallet, writes the ApiUsageLog, writes a
                     CustomerCreditTransaction ledger row, returns Allowed=1.
                  6. Otherwise returns Allowed=0 with no writes.

                The whole proc runs in a single SERIALIZABLE transaction with
                UPDLOCK/HOLDLOCK so two concurrent calls cannot oversell the
                free tier or the balance.

                Output is a single one-row result set (caller maps it via Dapper /
                FromSqlInterpolated). No OUTPUT params — keeps the EF Core call site
                simple (FromSqlInterpolated reads one row).

================================================================================
*/

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.sp_CustomerCredit_CheckAndRecordApiCall', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_CustomerCredit_CheckAndRecordApiCall;
GO

CREATE PROCEDURE dbo.sp_CustomerCredit_CheckAndRecordApiCall
    @CustomerId  INT,
    @ApiCode     NVARCHAR(50),
    @CallCount   INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @CallCount IS NULL OR @CallCount <= 0
        SET @CallCount = 1;

    DECLARE
        @ApiDefinitionId      INT,
        @DefaultFreeTier      INT,
        @DefaultRate          DECIMAL(10,4),
        @EffectiveFreeTier    INT,
        @EffectiveRate        DECIMAL(10,4),
        @PlanId               INT,
        @LifetimeUsed         INT,
        @FreeRemainingBefore  INT,
        @BillableCalls        INT,
        @Cost                 DECIMAL(12,4),
        @Balance              DECIMAL(12,4),
        @BalanceAfter         DECIMAL(12,4),
        @ApiUsageLogId        BIGINT,
        @Today                DATE = CAST(SYSUTCDATETIME() AS DATE),
        @BillingPeriodStart   DATE,
        @BillingPeriodEnd     DATE;

    -- Default monthly billing period (1st of month through last day of month).
    -- ApiUsageLogs is unique on (CustomerId, ApiDefinitionId, RecordedDate),
    -- so picking any consistent month window per row is fine.
    SET @BillingPeriodStart = DATEFROMPARTS(YEAR(@Today), MONTH(@Today), 1);
    SET @BillingPeriodEnd   = EOMONTH(@Today);

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1) Resolve ApiDefinition. Take a row lock to prevent a concurrent
        --    update to DefaultFreeTier / DefaultRate from racing with the
        --    decision we make below.
        SELECT
            @ApiDefinitionId  = ad.Id,
            @DefaultFreeTier  = ad.DefaultFreeTier,
            @DefaultRate      = ad.DefaultRatePerCall
        FROM dbo.ApiDefinitions ad WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE ad.Code = @ApiCode AND ad.IsActive = 1;

        IF @ApiDefinitionId IS NULL
        BEGIN
            -- Unknown / inactive API code. Surface as a denial so the
            -- caller (Connector API) returns 402 — and so we never silently
            -- accept billable traffic against a code we don't know.
            COMMIT TRANSACTION;
            SELECT
                CAST(0 AS BIT)             AS Allowed,
                'unknown_api_code'         AS Reason,
                CAST(0 AS DECIMAL(12,4))   AS BalanceAfter,
                CAST(0 AS INT)             AS FreeRemaining,
                @CallCount                 AS BillableCalls,
                CAST(0 AS DECIMAL(12,4))   AS Cost;
            RETURN 0;
        END

        -- 2) Resolve customer's active plan (may be null).
        SELECT @PlanId = s.PlanId
        FROM dbo.Subscriptions s
        WHERE s.CustomerId = @CustomerId;

        -- 3) Effective free tier: customer override (if enabled) overrides default.
        SELECT @EffectiveFreeTier = COALESCE(
            (SELECT cao.FreeTierOverride
             FROM dbo.CustomerApiOverrides cao
             WHERE cao.CustomerId = @CustomerId
               AND cao.ApiDefinitionId = @ApiDefinitionId
               AND cao.IsEnabled = 1
               AND cao.FreeTierOverride IS NOT NULL),
            @DefaultFreeTier
        );

        -- 4) Effective rate: customer override > plan rate > default.
        SELECT @EffectiveRate = COALESCE(
            (SELECT cao.RateOverride
             FROM dbo.CustomerApiOverrides cao
             WHERE cao.CustomerId = @CustomerId
               AND cao.ApiDefinitionId = @ApiDefinitionId
               AND cao.IsEnabled = 1
               AND cao.RateOverride IS NOT NULL),
            (SELECT pap.RatePerCall
             FROM dbo.PlanApiPricings pap
             WHERE pap.PlanId = @PlanId
               AND pap.ApiDefinitionId = @ApiDefinitionId),
            @DefaultRate
        );

        -- 5) Lifetime usage so far (LIFETIME, one-time grant semantics).
        --    UPDLOCK,HOLDLOCK on ApiUsageLogs prevents a concurrent call from
        --    reading the same `lifetimeUsed` and both deciding "still within free".
        SELECT @LifetimeUsed = ISNULL(SUM(CallCount), 0)
        FROM dbo.ApiUsageLogs WITH (UPDLOCK, HOLDLOCK)
        WHERE CustomerId = @CustomerId
          AND ApiDefinitionId = @ApiDefinitionId;

        SET @FreeRemainingBefore = CASE
            WHEN @EffectiveFreeTier > @LifetimeUsed
                THEN @EffectiveFreeTier - @LifetimeUsed
            ELSE 0
        END;

        SET @BillableCalls = CASE
            WHEN @CallCount > @FreeRemainingBefore
                THEN @CallCount - @FreeRemainingBefore
            ELSE 0
        END;

        SET @Cost = CAST(@BillableCalls AS DECIMAL(12,4)) * @EffectiveRate;

        -- 6) Lock and read the wallet (will create on first deduction if missing).
        SELECT @Balance = cc.Balance
        FROM dbo.CustomerCredits cc WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE cc.CustomerId = @CustomerId;

        IF @Balance IS NULL
        BEGIN
            -- Migration backfills active customers, but a brand-new customer
            -- created after the migration might not have a wallet yet — create one.
            INSERT INTO dbo.CustomerCredits (CustomerId, Balance, Currency, CreatedAt)
            VALUES (@CustomerId, 0, N'USD', SYSUTCDATETIME());
            SET @Balance = 0;
        END

        -- 7) Insufficient-credit denial. Nothing is written; the customer sees 402.
        IF @Cost > 0 AND @Balance < @Cost
        BEGIN
            COMMIT TRANSACTION;
            SELECT
                CAST(0 AS BIT)            AS Allowed,
                'insufficient_credit'     AS Reason,
                @Balance                  AS BalanceAfter,
                @FreeRemainingBefore      AS FreeRemaining,
                @BillableCalls            AS BillableCalls,
                @Cost                     AS Cost;
            RETURN 0;
        END

        -- 8) Approved. Record usage and (if cost > 0) debit the wallet.
        --    ApiUsageLogs has a UNIQUE (CustomerId, ApiDefinitionId, RecordedDate)
        --    constraint, so an existing row for today is updated in place; this is
        --    how the rest of the system aggregates usage per day.
        IF EXISTS (
            SELECT 1 FROM dbo.ApiUsageLogs
            WHERE CustomerId = @CustomerId
              AND ApiDefinitionId = @ApiDefinitionId
              AND RecordedDate = @Today
        )
        BEGIN
            UPDATE dbo.ApiUsageLogs
            SET CallCount = CallCount + @CallCount,
                UpdatedAt = SYSUTCDATETIME()
            WHERE CustomerId = @CustomerId
              AND ApiDefinitionId = @ApiDefinitionId
              AND RecordedDate = @Today;

            SELECT @ApiUsageLogId = Id FROM dbo.ApiUsageLogs
            WHERE CustomerId = @CustomerId
              AND ApiDefinitionId = @ApiDefinitionId
              AND RecordedDate = @Today;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.ApiUsageLogs
                (CustomerId, ApiDefinitionId, CallCount, RecordedDate,
                 BillingPeriodStart, BillingPeriodEnd, CreatedAt)
            VALUES
                (@CustomerId, @ApiDefinitionId, @CallCount, @Today,
                 @BillingPeriodStart, @BillingPeriodEnd, SYSUTCDATETIME());

            SET @ApiUsageLogId = SCOPE_IDENTITY();
        END

        SET @BalanceAfter = @Balance - @Cost;

        IF @Cost > 0
        BEGIN
            UPDATE dbo.CustomerCredits
            SET Balance   = @BalanceAfter,
                UpdatedAt = SYSUTCDATETIME()
            WHERE CustomerId = @CustomerId;

            INSERT INTO dbo.CustomerCreditTransactions
                (CustomerId, Type, Amount, BalanceAfter, ApiDefinitionId,
                 ApiUsageLogId, CallCount, Description, CreatedAt, CreatedByUserId)
            VALUES
                (@CustomerId,
                 2,                 -- CreditTransactionType.ApiDeduction
                 -@Cost,
                 @BalanceAfter,
                 @ApiDefinitionId,
                 @ApiUsageLogId,
                 @BillableCalls,
                 CONCAT(N'API call ', @ApiCode, N' x', @BillableCalls, N' @ ', @EffectiveRate),
                 SYSUTCDATETIME(),
                 NULL);
        END

        COMMIT TRANSACTION;

        SELECT
            CAST(1 AS BIT)                                             AS Allowed,
            CAST(NULL AS NVARCHAR(50))                                 AS Reason,
            @BalanceAfter                                              AS BalanceAfter,
            CASE
                WHEN @EffectiveFreeTier > (@LifetimeUsed + @CallCount)
                    THEN @EffectiveFreeTier - (@LifetimeUsed + @CallCount)
                ELSE 0
            END                                                        AS FreeRemaining,
            @BillableCalls                                             AS BillableCalls,
            @Cost                                                      AS Cost;

        RETURN 0;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
