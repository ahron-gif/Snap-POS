/*
================================================================================
Script Name:    20260521_CustomerCredits_AndLedger.sql
Date:           2026-05-21
Author:         RDT Dev Team
Depends On:     20260318_Billing_Schema_And_Seed.sql
                20260318_Add_LicensesBilling_Screens.sql

Description:    Adds the OpenAPI prepaid-credit wallet and append-only ledger,
                seeds the API-credits permissions, and creates a Super Admin
                "API Pricing" screen so the SuperAdmin can configure default
                free-tier + per-call rates on each ApiDefinition.

                This script is IDEMPOTENT - safe to run multiple times.

Database:       Master Database (rdt2 / RDTCloud)

Sections:
    A) Create CustomerCredits wallet table
    B) Create CustomerCreditTransactions ledger table
    C) Indexes
    D) Backfill: one CustomerCredits row per active Customer (Balance = 0)
    E) Seed Administrator > "API Credits" screen + permissions
       Seed Super Admin > "API Pricing" screen + permissions
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '========================================================================';
PRINT 'CustomerCredits & Ledger Schema - Starting';
PRINT 'Database: ' + DB_NAME();
PRINT 'Time: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 121);
PRINT '========================================================================';

BEGIN TRY
BEGIN TRANSACTION;

-- ============================================================================
-- SECTION A: CustomerCredits wallet table
-- ============================================================================

PRINT '';
PRINT '--- Section A: CustomerCredits ---';

IF OBJECT_ID('dbo.CustomerCredits', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CustomerCredits (
        Id                  INT IDENTITY(1,1)   NOT NULL,
        CustomerId          INT                 NOT NULL,
        Balance             DECIMAL(12,4)       NOT NULL CONSTRAINT DF_CustomerCredits_Balance DEFAULT 0,
        Currency            NVARCHAR(8)         NOT NULL CONSTRAINT DF_CustomerCredits_Currency DEFAULT N'USD',
        LastTopUpAt         DATETIME2           NULL,
        LastTopUpAmount     DECIMAL(12,4)       NULL,
        CreatedAt           DATETIME2           NOT NULL CONSTRAINT DF_CustomerCredits_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt           DATETIME2           NULL,
        RowVersion          ROWVERSION          NOT NULL,

        CONSTRAINT PK_CustomerCredits PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_CustomerCredits_Customers
            FOREIGN KEY (CustomerId) REFERENCES dbo.Customers (CustomerId) ON DELETE CASCADE
    );
    PRINT '  [OK] Table dbo.CustomerCredits created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.CustomerCredits already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_CustomerCredits_CustomerId'
                 AND object_id = OBJECT_ID('dbo.CustomerCredits'))
BEGIN
    CREATE UNIQUE INDEX IX_CustomerCredits_CustomerId
        ON dbo.CustomerCredits (CustomerId);
    PRINT '  [OK] Unique index IX_CustomerCredits_CustomerId created.';
END
ELSE
    PRINT '  [SKIP] Unique index IX_CustomerCredits_CustomerId already exists.';

-- ============================================================================
-- SECTION B: CustomerCreditTransactions ledger table
-- ============================================================================

PRINT '';
PRINT '--- Section B: CustomerCreditTransactions ---';

IF OBJECT_ID('dbo.CustomerCreditTransactions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CustomerCreditTransactions (
        Id                       BIGINT IDENTITY(1,1) NOT NULL,
        CustomerId               INT                  NOT NULL,
        -- CreditTransactionType enum: 1=TopUp, 2=ApiDeduction, 3=Refund, 4=AdminAdjustment
        Type                     INT                  NOT NULL,
        Amount                   DECIMAL(12,4)        NOT NULL,
        BalanceAfter             DECIMAL(12,4)        NOT NULL,
        ApiDefinitionId          INT                  NULL,
        ApiUsageLogId            BIGINT               NULL,
        CallCount                INT                  NULL,
        StripePaymentIntentId    NVARCHAR(200)        NULL,
        Description              NVARCHAR(500)        NULL,
        CreatedAt                DATETIME2            NOT NULL CONSTRAINT DF_CreditTxn_CreatedAt DEFAULT SYSUTCDATETIME(),
        CreatedByUserId          INT                  NULL,

        CONSTRAINT PK_CustomerCreditTransactions PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_CreditTxn_Customers
            FOREIGN KEY (CustomerId) REFERENCES dbo.Customers (CustomerId) ON DELETE CASCADE,
        CONSTRAINT FK_CreditTxn_ApiDefinitions
            FOREIGN KEY (ApiDefinitionId) REFERENCES dbo.ApiDefinitions (Id),
        CONSTRAINT FK_CreditTxn_ApiUsageLogs
            FOREIGN KEY (ApiUsageLogId) REFERENCES dbo.ApiUsageLogs (Id)
    );
    PRINT '  [OK] Table dbo.CustomerCreditTransactions created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.CustomerCreditTransactions already exists.';

-- ============================================================================
-- SECTION C: Indexes
-- ============================================================================

PRINT '';
PRINT '--- Section C: Indexes ---';

-- Hot path: ledger page for one customer, newest first.
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_CreditTxn_CustCreated'
                 AND object_id = OBJECT_ID('dbo.CustomerCreditTransactions'))
BEGIN
    CREATE INDEX IX_CreditTxn_CustCreated
        ON dbo.CustomerCreditTransactions (CustomerId, CreatedAt DESC);
    PRINT '  [OK] IX_CreditTxn_CustCreated created.';
END
ELSE
    PRINT '  [SKIP] IX_CreditTxn_CustCreated already exists.';

-- Webhook idempotency: a replayed Stripe webhook with the same PaymentIntentId
-- must not double-credit the customer. Filtered unique index permits multiple
-- nulls (ApiDeduction / AdminAdjustment / Refund without a PI).
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'IX_CreditTxn_StripePI'
                 AND object_id = OBJECT_ID('dbo.CustomerCreditTransactions'))
BEGIN
    CREATE UNIQUE INDEX IX_CreditTxn_StripePI
        ON dbo.CustomerCreditTransactions (StripePaymentIntentId)
        WHERE StripePaymentIntentId IS NOT NULL;
    PRINT '  [OK] IX_CreditTxn_StripePI (filtered unique) created.';
END
ELSE
    PRINT '  [SKIP] IX_CreditTxn_StripePI already exists.';

-- ============================================================================
-- SECTION D: Backfill — one CustomerCredits row per active Customer
-- ============================================================================

PRINT '';
PRINT '--- Section D: Backfill CustomerCredits rows ---';

INSERT INTO dbo.CustomerCredits (CustomerId, Balance, Currency, CreatedAt)
SELECT c.CustomerId, 0, N'USD', SYSUTCDATETIME()
FROM dbo.Customers c
WHERE c.IsActive = 1
  AND NOT EXISTS (
      SELECT 1 FROM dbo.CustomerCredits cc WHERE cc.CustomerId = c.CustomerId
  );

PRINT '  [OK] Backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' active customers with Balance = 0.';

-- ============================================================================
-- SECTION E: RBAC — screens & permissions
-- ============================================================================

PRINT '';
PRINT '--- Section E: RBAC ---';

-- E1. Administrator: NO separate "API Credits" sidebar entry.
--     The credit panel is rendered inline on the existing "Licenses & Billing"
--     page (/licenses-billing), so a second sidebar row pointing at the same
--     route only clutters the nav. We still seed the admin.api_credits.*
--     permission keys (anchored to the existing licenses_billing screen) so
--     finer-grained gating is available in the future without another migration.
DECLARE @AdminModuleId INT;
SELECT @AdminModuleId = ModuleId FROM dbo.Modules WHERE Code = 'admin';

-- Idempotent cleanup of the redundant screen if a previous run inserted it.
IF EXISTS (SELECT 1 FROM dbo.Screens WHERE Code = 'admin.api_credits')
BEGIN
    DECLARE @StaleCreditsScreenId INT;
    SELECT @StaleCreditsScreenId = Id FROM dbo.Screens WHERE Code = 'admin.api_credits';

    UPDATE dbo.Permissions
        SET ScreenId = (SELECT Id FROM dbo.Screens WHERE Code = 'admin.licenses_billing')
        WHERE ScreenId = @StaleCreditsScreenId;

    UPDATE dbo.Screens SET IsActive = 0 WHERE Id = @StaleCreditsScreenId;
    PRINT '  [OK] Redundant screen admin.api_credits deactivated; permissions re-anchored to admin.licenses_billing.';
END

IF @AdminModuleId IS NOT NULL
BEGIN
    DECLARE @LbScreenId INT;
    SELECT @LbScreenId = Id FROM dbo.Screens WHERE Code = 'admin.licenses_billing';

    IF @LbScreenId IS NOT NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'admin.api_credits.view')
            INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt)
            VALUES (@AdminModuleId, @LbScreenId, 'admin.api_credits.view', N'View API Credits', 'action', 10, 1, SYSUTCDATETIME());

        IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'admin.api_credits.topup')
            INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt)
            VALUES (@AdminModuleId, @LbScreenId, 'admin.api_credits.topup', N'Top Up API Credits', 'action', 11, 1, SYSUTCDATETIME());

        PRINT '  [OK] Permissions admin.api_credits.* anchored to admin.licenses_billing screen.';
    END
    ELSE
        PRINT '  [WARN] admin.licenses_billing screen not found — credit permissions skipped.';
END
ELSE
    PRINT '  [WARN] admin module not found.';

-- E2. Super Admin > "API Pricing"  (configure default free-tier + rate-per-call)
DECLARE @SAModuleId INT;
SELECT @SAModuleId = ModuleId FROM dbo.Modules WHERE Code = 'superadmin';

IF @SAModuleId IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.Screens WHERE Code = 'superadmin.api_pricing')
    BEGIN
        INSERT INTO dbo.Screens (ModuleId, Code, Name, Route, Icon, SortOrder, IsActive)
        VALUES (@SAModuleId, 'superadmin.api_pricing', N'API Pricing', '/super-admin/api-pricing', 'DollarSignIcon', 3, 1);
        PRINT '  [OK] Screen superadmin.api_pricing added.';
    END
    ELSE
        PRINT '  [SKIP] Screen superadmin.api_pricing already exists.';

    DECLARE @SAPricingScreenId INT;
    SELECT @SAPricingScreenId = Id FROM dbo.Screens WHERE Code = 'superadmin.api_pricing';

    IF @SAPricingScreenId IS NOT NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'admin.api_pricing.view')
            INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt)
            VALUES (@SAModuleId, @SAPricingScreenId, 'admin.api_pricing.view', N'View', 'action', 1, 1, SYSUTCDATETIME());

        IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'admin.api_pricing.edit')
            INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt)
            VALUES (@SAModuleId, @SAPricingScreenId, 'admin.api_pricing.edit', N'Edit', 'action', 2, 1, SYSUTCDATETIME());

        PRINT '  [OK] Permissions for superadmin.api_pricing added.';
    END
END
ELSE
    PRINT '  [WARN] superadmin module not found.';

COMMIT TRANSACTION;

PRINT '';
PRINT '========================================================================';
PRINT 'CustomerCredits & Ledger Schema - Completed Successfully';
PRINT '========================================================================';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT '!! ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
