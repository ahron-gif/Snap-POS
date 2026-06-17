-- =============================================================================
-- 20260501_CreateCustomerAppLicenses.sql
--
-- Creates dbo.CustomerAppLicenses to back the per-device add-on billing model.
-- One row per device-slot. Lifecycle:
--   * Add: insert row, ActivatedAt = today, BillingEndsAt = NULL
--   * Remove: set BillingEndsAt = endOfCurrentCycle (exclusive), set
--             RemovalRequestedAt = today. Row is NOT deleted (audit trail).
--
-- Billing predicate (cycle [Pstart, Pend) ):
--   ActivatedAt < Pend AND (BillingEndsAt IS NULL OR BillingEndsAt > Pstart)
--
-- Run against MainDB. Idempotent — safe to re-run.
-- =============================================================================

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.CustomerAppLicenses', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CustomerAppLicenses
    (
        Id                  INT             IDENTITY(1,1) NOT NULL,
        CustomerId          INT             NOT NULL,
        AppId               INT             NOT NULL,
        DeviceLabel         NVARCHAR(200)   NULL,
        ActivatedAt         DATE            NOT NULL,
        BillingEndsAt       DATE            NULL,
        RemovalRequestedAt  DATE            NULL,
        CreatedBy           INT             NULL,
        RemovedBy           INT             NULL,
        CreatedAt           DATETIME2(7)    NOT NULL CONSTRAINT DF_CustomerAppLicenses_CreatedAt DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT PK_CustomerAppLicenses PRIMARY KEY CLUSTERED (Id),

        CONSTRAINT FK_CustomerAppLicenses_Customers
            FOREIGN KEY (CustomerId) REFERENCES dbo.Customers (CustomerId)
            ON DELETE CASCADE
    );

    CREATE INDEX IX_CustAppLicense_CustAppEnd
        ON dbo.CustomerAppLicenses (CustomerId, AppId, BillingEndsAt);

    CREATE INDEX IX_CustAppLicense_CustActivated
        ON dbo.CustomerAppLicenses (CustomerId, ActivatedAt);

    PRINT 'Created dbo.CustomerAppLicenses.';
END
ELSE
BEGIN
    PRINT 'dbo.CustomerAppLicenses already exists — skipping create.';
END;

-- ----------------------------------------------------------------------------
-- Backfill: seed one license row per existing device-seat so currently-active
-- customers don't lose seats when this feature ships. ActivatedAt is set to
-- today (feature launch date) — billing tracking begins now, no retroactive
-- charges. CustomerApp.DeviceLimitOverride takes precedence over DevicesLimit.
-- ----------------------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM dbo.CustomerAppLicenses)
   AND OBJECT_ID(N'dbo.CustomerApps', N'U') IS NOT NULL
BEGIN
    DECLARE @Today DATE = CAST(SYSUTCDATETIME() AS DATE);

    -- Surface orphans before we filter them out — these are CustomerApps rows
    -- whose CustomerId no longer points to a real customer. Worth investigating
    -- separately, but they must be excluded from the backfill or the FK fails.
    DECLARE @OrphanCount INT = (
        SELECT COUNT(*)
        FROM dbo.CustomerApps ca
        WHERE ca.IsEnabled = 1
          AND COALESCE(ca.DeviceLimitOverride, ca.DevicesLimit) > 0
          AND NOT EXISTS (SELECT 1 FROM dbo.Customers c WHERE c.CustomerId = ca.CustomerId)
    );
    IF @OrphanCount > 0
        PRINT CONCAT('Note: ', @OrphanCount, ' CustomerApps row(s) reference missing Customers — skipped.');

    ;WITH SeatCounts AS (
        SELECT
            ca.CustomerId,
            ca.AppId,
            COALESCE(ca.DeviceLimitOverride, ca.DevicesLimit) AS Seats
        FROM dbo.CustomerApps ca
        INNER JOIN dbo.Customers c ON c.CustomerId = ca.CustomerId
        WHERE ca.IsEnabled = 1
          AND COALESCE(ca.DeviceLimitOverride, ca.DevicesLimit) > 0
    ),
    Numbers AS (
        SELECT TOP (10000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS N
        FROM sys.all_objects a CROSS JOIN sys.all_objects b
    )
    INSERT INTO dbo.CustomerAppLicenses
        (CustomerId, AppId, ActivatedAt, BillingEndsAt, RemovalRequestedAt, CreatedBy, RemovedBy, CreatedAt)
    SELECT
        sc.CustomerId,
        sc.AppId,
        @Today,
        NULL,
        NULL,
        NULL,
        NULL,
        SYSUTCDATETIME()
    FROM SeatCounts sc
    INNER JOIN Numbers n ON n.N <= sc.Seats;

    PRINT CONCAT('Backfilled ', @@ROWCOUNT, ' license rows from existing CustomerApps.');
END
ELSE
BEGIN
    PRINT 'Backfill skipped — table already populated or CustomerApps missing.';
END;

-- ----------------------------------------------------------------------------
-- Widen InvoiceLineItems.BillableUnits to DECIMAL(18,4). Device-days proration
-- produces fractional device-equivalents (e.g. "0.567 paid devices for 17 days
-- of a 30-day cycle"). Existing INT data is loss-free under decimal conversion.
-- ----------------------------------------------------------------------------

IF EXISTS (
    SELECT 1
    FROM sys.columns c
    INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID(N'dbo.InvoiceLineItems')
      AND c.name = N'BillableUnits'
      AND t.name = N'int'
)
BEGIN
    DECLARE @DefaultName SYSNAME = (
        SELECT dc.name
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'dbo.InvoiceLineItems')
          AND c.name = N'BillableUnits'
    );

    IF @DefaultName IS NOT NULL
        EXEC('ALTER TABLE dbo.InvoiceLineItems DROP CONSTRAINT [' + @DefaultName + ']');

    ALTER TABLE dbo.InvoiceLineItems ALTER COLUMN BillableUnits DECIMAL(18,4) NOT NULL;
    ALTER TABLE dbo.InvoiceLineItems ADD CONSTRAINT DF_InvoiceLineItems_BillableUnits DEFAULT (0) FOR BillableUnits;

    PRINT 'Widened InvoiceLineItems.BillableUnits to DECIMAL(18,4).';
END
ELSE
BEGIN
    PRINT 'InvoiceLineItems.BillableUnits already widened or table missing.';
END;

PRINT 'CustomerAppLicenses migration complete.';
