/*
================================================================================
Script Name:    20260318_Billing_Schema_And_Seed.sql
Date:           2026-03-18
Author:         RDT Dev Team

Description:    Creates the Billing schema and seeds all reference data in the
                Master/Main database (RDTCloud).

                This script is IDEMPOTENT - safe to run multiple times.

Database:       Master Database (rdt2 / RDTCloud)

Change Log:
    2026-03-18  Initial creation - Billing tables, indexes, seed data
                Tables: Subscriptions, SubscriptionHistories, PlanFeatures,
                ApiDefinitions, PlanAppPricings, PlanApiPricings,
                CustomerApiOverrides, ApiUsageLogs, UsageRecords,
                Invoices, InvoiceLineItems, PaymentAttempts, BillingConfigs
                Columns: Plans (BillingCycle, Price, Tier, SortOrder, Description)
                         CustomerApps (IsEnabled, PriceOverride, DeviceLimitOverride, FreeTierOverride)

Sections:
    A) Add new columns to existing tables (Plans, CustomerApps)
    B) Create new tables
    C) Create indexes
    D) Seed reference data (ApiDefinitions, BillingConfigs)
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '========================================================================';
PRINT 'Billing Schema & Seed Script - Starting';
PRINT 'Database: ' + DB_NAME();
PRINT 'Time: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 121);
PRINT '========================================================================';

-- ============================================================================
-- SECTION A: ADD NEW COLUMNS TO EXISTING TABLES
-- ============================================================================

PRINT '';
PRINT '--- Section A: Adding new columns to existing tables ---';

-- --------------------------------------------------------------------------
-- A1. Plans table: add Description, BillingCycle, Price, Tier, SortOrder
-- --------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Plans') AND name = 'Description')
BEGIN
    ALTER TABLE dbo.Plans ADD Description NVARCHAR(500) NULL;
    PRINT '  [OK] Plans.Description column added.';
END
ELSE
    PRINT '  [SKIP] Plans.Description column already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Plans') AND name = 'BillingCycle')
BEGIN
    ALTER TABLE dbo.Plans ADD BillingCycle INT NOT NULL CONSTRAINT DF_Plans_BillingCycle DEFAULT 0;  -- 0 = Monthly, 1 = Yearly
    PRINT '  [OK] Plans.BillingCycle column added.';
END
ELSE
    PRINT '  [SKIP] Plans.BillingCycle column already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Plans') AND name = 'Price')
BEGIN
    ALTER TABLE dbo.Plans ADD Price DECIMAL(10,2) NOT NULL CONSTRAINT DF_Plans_Price DEFAULT 0;
    PRINT '  [OK] Plans.Price column added.';
END
ELSE
    PRINT '  [SKIP] Plans.Price column already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Plans') AND name = 'Tier')
BEGIN
    ALTER TABLE dbo.Plans ADD Tier NVARCHAR(50) NULL;
    PRINT '  [OK] Plans.Tier column added.';
END
ELSE
    PRINT '  [SKIP] Plans.Tier column already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Plans') AND name = 'SortOrder')
BEGIN
    ALTER TABLE dbo.Plans ADD SortOrder INT NOT NULL CONSTRAINT DF_Plans_SortOrder DEFAULT 0;
    PRINT '  [OK] Plans.SortOrder column added.';
END
ELSE
    PRINT '  [SKIP] Plans.SortOrder column already exists.';

-- --------------------------------------------------------------------------
-- A2. CustomerApps table: add IsEnabled, PriceOverride, DeviceLimitOverride,
--     FreeTierOverride
-- --------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.CustomerApps') AND name = 'IsEnabled')
BEGIN
    ALTER TABLE dbo.CustomerApps ADD IsEnabled BIT NOT NULL CONSTRAINT DF_CustomerApps_IsEnabled DEFAULT 1;
    PRINT '  [OK] CustomerApps.IsEnabled column added.';
END
ELSE
    PRINT '  [SKIP] CustomerApps.IsEnabled column already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.CustomerApps') AND name = 'PriceOverride')
BEGIN
    ALTER TABLE dbo.CustomerApps ADD PriceOverride DECIMAL(10,2) NULL;
    PRINT '  [OK] CustomerApps.PriceOverride column added.';
END
ELSE
    PRINT '  [SKIP] CustomerApps.PriceOverride column already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.CustomerApps') AND name = 'DeviceLimitOverride')
BEGIN
    ALTER TABLE dbo.CustomerApps ADD DeviceLimitOverride INT NULL;
    PRINT '  [OK] CustomerApps.DeviceLimitOverride column added.';
END
ELSE
    PRINT '  [SKIP] CustomerApps.DeviceLimitOverride column already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.CustomerApps') AND name = 'FreeTierOverride')
BEGIN
    ALTER TABLE dbo.CustomerApps ADD FreeTierOverride INT NULL;
    PRINT '  [OK] CustomerApps.FreeTierOverride column added.';
END
ELSE
    PRINT '  [SKIP] CustomerApps.FreeTierOverride column already exists.';


GO
-- ============================================================================
-- BATCH 2: Everything that references the new columns
-- ============================================================================
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
BEGIN TRANSACTION;

-- ============================================================================
-- SECTION B: CREATE NEW TABLES
-- ============================================================================

PRINT '';
PRINT '--- Section B: Creating new tables ---';

-- --------------------------------------------------------------------------
-- B1. Subscriptions (one-to-one with Customer)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.Subscriptions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Subscriptions (
        Id                  INT IDENTITY(1,1) NOT NULL,
        CustomerId          INT               NOT NULL,
        PlanId              INT               NOT NULL,
        Status              INT               NOT NULL CONSTRAINT DF_Subscription_Status DEFAULT 0,  -- SubscriptionStatus enum (0 = Active)
        StartDate           DATETIME2         NULL,
        EndDate             DATETIME2         NULL,
        GracePeriodEndsAt   DATETIME2         NULL,
        SuspendedAt         DATETIME2         NULL,
        BillingEmail        NVARCHAR(200)     NULL,
        BillingCycleMonths  INT               NOT NULL CONSTRAINT DF_Subscription_BillingCycleMonths DEFAULT 1,

        CONSTRAINT PK_Subscriptions PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Subscription_Customer FOREIGN KEY (CustomerId) REFERENCES dbo.Customers (CustomerId) ON DELETE CASCADE,
        CONSTRAINT FK_Subscription_Plan FOREIGN KEY (PlanId) REFERENCES dbo.Plans (Id) ON DELETE NO ACTION
    );
    PRINT '  [OK] Table dbo.Subscriptions created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.Subscriptions already exists.';

-- --------------------------------------------------------------------------
-- B2. PlanFeatures
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.PlanFeatures', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PlanFeatures (
        Id              INT IDENTITY(1,1) NOT NULL,
        PlanId          INT               NOT NULL,
        AppId           INT               NULL,
        Category        NVARCHAR(50)      NOT NULL,
        FeatureName     NVARCHAR(200)     NOT NULL,
        Description     NVARCHAR(500)     NULL,
        IsEnabled       BIT               NOT NULL CONSTRAINT DF_PlanFeatures_IsEnabled DEFAULT 1,
        SortOrder       INT               NOT NULL CONSTRAINT DF_PlanFeatures_SortOrder DEFAULT 0,
        CreatedAt       DATETIME2         NOT NULL CONSTRAINT DF_PlanFeatures_CreatedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_PlanFeatures PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_PlanFeatures_Plans FOREIGN KEY (PlanId) REFERENCES dbo.Plans (Id) ON DELETE CASCADE
    );
    PRINT '  [OK] Table dbo.PlanFeatures created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.PlanFeatures already exists.';

-- --------------------------------------------------------------------------
-- B3. ApiDefinitions
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.ApiDefinitions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ApiDefinitions (
        Id                  INT IDENTITY(1,1) NOT NULL,
        Name                NVARCHAR(200)     NOT NULL,
        Code                NVARCHAR(50)      NOT NULL,
        Description         NVARCHAR(500)     NULL,
        DefaultRatePerCall  DECIMAL(10,4)     NOT NULL CONSTRAINT DF_ApiDef_DefaultRate DEFAULT 0.15,
        DefaultFreeTier     INT               NOT NULL CONSTRAINT DF_ApiDef_DefaultFree DEFAULT 250,
        IsActive            BIT               NOT NULL CONSTRAINT DF_ApiDef_IsActive DEFAULT 1,
        SortOrder           INT               NOT NULL CONSTRAINT DF_ApiDef_SortOrder DEFAULT 0,
        CreatedAt           DATETIME2         NOT NULL CONSTRAINT DF_ApiDef_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt           DATETIME2         NULL,

        CONSTRAINT PK_ApiDefinitions PRIMARY KEY CLUSTERED (Id)
    );
    PRINT '  [OK] Table dbo.ApiDefinitions created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.ApiDefinitions already exists.';

-- --------------------------------------------------------------------------
-- B4. PlanAppPricings
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.PlanAppPricings', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PlanAppPricings (
        Id              INT IDENTITY(1,1) NOT NULL,
        PlanId          INT               NOT NULL,
        AppId           INT               NOT NULL,
        PricingModel    NVARCHAR(20)      NOT NULL,
        PricePerUnit    DECIMAL(10,2)     NOT NULL,
        FreeUnits       INT               NOT NULL CONSTRAINT DF_PlanAppPricing_FreeUnits DEFAULT 0,
        MaxUnits        INT               NULL,
        IsIncluded      BIT               NOT NULL CONSTRAINT DF_PlanAppPricing_IsIncluded DEFAULT 1,
        CreatedAt       DATETIME2         NOT NULL CONSTRAINT DF_PlanAppPricing_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt       DATETIME2         NULL,

        CONSTRAINT PK_PlanAppPricings PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_PlanAppPricing_Plans FOREIGN KEY (PlanId) REFERENCES dbo.Plans (Id) ON DELETE CASCADE
    );
    PRINT '  [OK] Table dbo.PlanAppPricings created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.PlanAppPricings already exists.';

-- --------------------------------------------------------------------------
-- B5. PlanApiPricings
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.PlanApiPricings', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PlanApiPricings (
        Id                  INT IDENTITY(1,1) NOT NULL,
        PlanId              INT               NOT NULL,
        ApiDefinitionId     INT               NOT NULL,
        RatePerCall         DECIMAL(10,4)     NOT NULL,
        FreeTierCalls       INT               NOT NULL CONSTRAINT DF_PlanApiPricing_FreeTier DEFAULT 250,
        MaxCallsPerMonth    INT               NULL,
        IsIncluded          BIT               NOT NULL CONSTRAINT DF_PlanApiPricing_IsIncluded DEFAULT 1,
        CreatedAt           DATETIME2         NOT NULL CONSTRAINT DF_PlanApiPricing_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt           DATETIME2         NULL,

        CONSTRAINT PK_PlanApiPricings PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_PlanApiPricing_Plans FOREIGN KEY (PlanId) REFERENCES dbo.Plans (Id) ON DELETE CASCADE,
        CONSTRAINT FK_PlanApiPricing_ApiDef FOREIGN KEY (ApiDefinitionId) REFERENCES dbo.ApiDefinitions (Id) ON DELETE CASCADE
    );
    PRINT '  [OK] Table dbo.PlanApiPricings created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.PlanApiPricings already exists.';

-- --------------------------------------------------------------------------
-- B6. CustomerApiOverrides
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.CustomerApiOverrides', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CustomerApiOverrides (
        Id                  INT IDENTITY(1,1) NOT NULL,
        CustomerId          INT               NOT NULL,
        ApiDefinitionId     INT               NOT NULL,
        RateOverride        DECIMAL(10,4)     NULL,
        FreeTierOverride    INT               NULL,
        MaxCallsOverride    INT               NULL,
        IsEnabled           BIT               NOT NULL CONSTRAINT DF_CustApiOverride_IsEnabled DEFAULT 1,
        CreatedAt           DATETIME2         NOT NULL CONSTRAINT DF_CustApiOverride_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt           DATETIME2         NULL,

        CONSTRAINT PK_CustomerApiOverrides PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_CustApiOverride_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers (CustomerId) ON DELETE CASCADE,
        CONSTRAINT FK_CustApiOverride_ApiDef FOREIGN KEY (ApiDefinitionId) REFERENCES dbo.ApiDefinitions (Id) ON DELETE CASCADE
    );
    PRINT '  [OK] Table dbo.CustomerApiOverrides created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.CustomerApiOverrides already exists.';

-- --------------------------------------------------------------------------
-- B7. ApiUsageLogs
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.ApiUsageLogs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ApiUsageLogs (
        Id                  BIGINT IDENTITY(1,1) NOT NULL,
        CustomerId          INT                  NOT NULL,
        ApiDefinitionId     INT                  NOT NULL,
        CallCount           INT                  NOT NULL CONSTRAINT DF_ApiUsage_CallCount DEFAULT 0,
        RecordedDate        DATE                 NOT NULL,
        BillingPeriodStart  DATE                 NOT NULL,
        BillingPeriodEnd    DATE                 NOT NULL,
        CreatedAt           DATETIME2            NOT NULL CONSTRAINT DF_ApiUsage_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt           DATETIME2            NULL,

        CONSTRAINT PK_ApiUsageLogs PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_ApiUsage_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers (CustomerId) ON DELETE CASCADE,
        CONSTRAINT FK_ApiUsage_ApiDef FOREIGN KEY (ApiDefinitionId) REFERENCES dbo.ApiDefinitions (Id) ON DELETE CASCADE
    );
    PRINT '  [OK] Table dbo.ApiUsageLogs created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.ApiUsageLogs already exists.';

-- --------------------------------------------------------------------------
-- B8. UsageRecords
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.UsageRecords', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UsageRecords (
        Id              BIGINT IDENTITY(1,1) NOT NULL,
        CustomerId      INT                  NOT NULL,
        AppId           INT                  NULL,
        MetricType      NVARCHAR(50)         NOT NULL,
        Count           INT                  NOT NULL CONSTRAINT DF_UsageRecord_Count DEFAULT 0,
        RecordedDate    DATE                 NOT NULL,
        RecordedAt      DATETIME2            NOT NULL CONSTRAINT DF_UsageRecord_RecordedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_UsageRecords PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_UsageRecord_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers (CustomerId) ON DELETE CASCADE
    );
    PRINT '  [OK] Table dbo.UsageRecords created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.UsageRecords already exists.';

-- --------------------------------------------------------------------------
-- B9. SubscriptionHistories (audit trail)
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.SubscriptionHistories', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SubscriptionHistories (
        Id              INT IDENTITY(1,1) NOT NULL,
        CustomerId      INT               NOT NULL,
        PlanId          INT               NOT NULL,
        Action          INT               NOT NULL,  -- SubscriptionAction enum
        PreviousPlanId  INT               NULL,
        MonthlyAmount   DECIMAL(10,2)     NOT NULL,
        EffectiveDate   DATETIME2         NOT NULL,
        EndDate         DATETIME2         NULL,
        Notes           NVARCHAR(500)     NULL,
        ChangedBy       INT               NULL,
        CreatedAt       DATETIME2         NOT NULL CONSTRAINT DF_SubHistory_CreatedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_SubscriptionHistories PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_SubHistory_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers (CustomerId) ON DELETE CASCADE,
        CONSTRAINT FK_SubHistory_Plans FOREIGN KEY (PlanId) REFERENCES dbo.Plans (Id) ON DELETE NO ACTION,
        CONSTRAINT FK_SubHistory_PrevPlans FOREIGN KEY (PreviousPlanId) REFERENCES dbo.Plans (Id) ON DELETE NO ACTION
    );
    PRINT '  [OK] Table dbo.SubscriptionHistories created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.SubscriptionHistories already exists.';

-- --------------------------------------------------------------------------
-- B10. Invoices
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.Invoices', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Invoices (
        Id                  INT IDENTITY(1,1) NOT NULL,
        InvoiceNumber       NVARCHAR(20)      NOT NULL,
        CustomerId          INT               NOT NULL,
        BillingPeriodStart  DATE              NOT NULL,
        BillingPeriodEnd    DATE              NOT NULL,
        IssuedAt            DATETIME2         NOT NULL,
        DueDate             DATE              NOT NULL,
        SubTotal            DECIMAL(10,2)     NOT NULL,
        TaxAmount           DECIMAL(10,2)     NOT NULL CONSTRAINT DF_Invoice_TaxAmount DEFAULT 0,
        TotalAmount         DECIMAL(10,2)     NOT NULL,
        Status              INT               NOT NULL CONSTRAINT DF_Invoice_Status DEFAULT 0,  -- InvoiceStatus enum (0 = Draft)
        PaidAt              DATETIME2         NULL,
        PaymentReference    NVARCHAR(200)     NULL,
        Notes               NVARCHAR(500)     NULL,
        CreatedAt           DATETIME2         NOT NULL CONSTRAINT DF_Invoice_CreatedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_Invoices PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Invoice_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers (CustomerId) ON DELETE CASCADE
    );
    PRINT '  [OK] Table dbo.Invoices created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.Invoices already exists.';

-- --------------------------------------------------------------------------
-- B11. InvoiceLineItems
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.InvoiceLineItems', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.InvoiceLineItems (
        Id              INT IDENTITY(1,1) NOT NULL,
        InvoiceId       INT               NOT NULL,
        Description     NVARCHAR(300)     NOT NULL,
        AppId           INT               NULL,
        ApiDefinitionId INT               NULL,
        Category        NVARCHAR(50)      NOT NULL,
        PricingModel    NVARCHAR(20)      NULL,
        Quantity        INT               NOT NULL CONSTRAINT DF_InvLine_Quantity DEFAULT 1,
        FreeUnits       INT               NOT NULL CONSTRAINT DF_InvLine_FreeUnits DEFAULT 0,
        BillableUnits   INT               NOT NULL CONSTRAINT DF_InvLine_BillableUnits DEFAULT 0,
        UnitPrice       DECIMAL(10,4)     NOT NULL,
        LineTotal       DECIMAL(10,2)     NOT NULL,

        CONSTRAINT PK_InvoiceLineItems PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_InvLine_Invoices FOREIGN KEY (InvoiceId) REFERENCES dbo.Invoices (Id) ON DELETE CASCADE
    );
    PRINT '  [OK] Table dbo.InvoiceLineItems created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.InvoiceLineItems already exists.';

-- --------------------------------------------------------------------------
-- B12. PaymentAttempts
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.PaymentAttempts', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PaymentAttempts (
        Id                      INT IDENTITY(1,1) NOT NULL,
        InvoiceId               INT               NOT NULL,
        CustomerId              INT               NOT NULL,
        AttemptedAt             DATETIME2         NOT NULL,
        Status                  INT               NOT NULL CONSTRAINT DF_PayAttempt_Status DEFAULT 0,  -- PaymentStatus enum (0 = Pending)
        FailureReason           NVARCHAR(500)     NULL,
        PaymentProvider         NVARCHAR(50)      NULL,
        ProviderTransactionId   NVARCHAR(200)     NULL,
        Amount                  DECIMAL(10,2)     NOT NULL,
        AttemptNumber           INT               NOT NULL CONSTRAINT DF_PayAttempt_AttemptNum DEFAULT 1,

        CONSTRAINT PK_PaymentAttempts PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_PayAttempt_Invoices FOREIGN KEY (InvoiceId) REFERENCES dbo.Invoices (Id) ON DELETE CASCADE,
        CONSTRAINT FK_PayAttempt_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers (CustomerId) ON DELETE NO ACTION
    );
    PRINT '  [OK] Table dbo.PaymentAttempts created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.PaymentAttempts already exists.';

-- --------------------------------------------------------------------------
-- B13. BillingConfigs
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.BillingConfigs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BillingConfigs (
        Id              INT IDENTITY(1,1) NOT NULL,
        ConfigKey       NVARCHAR(100)     NOT NULL,
        ConfigValue     NVARCHAR(500)     NOT NULL,
        Description     NVARCHAR(500)     NULL,
        UpdatedAt       DATETIME2         NOT NULL CONSTRAINT DF_BillingConfig_UpdatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedBy       INT               NULL,

        CONSTRAINT PK_BillingConfigs PRIMARY KEY CLUSTERED (Id)
    );
    PRINT '  [OK] Table dbo.BillingConfigs created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.BillingConfigs already exists.';


-- ============================================================================
-- SECTION C: CREATE INDEXES
-- ============================================================================

PRINT '';
PRINT '--- Section C: Creating indexes ---';

-- Subscriptions
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Subscriptions') AND name = 'IX_Subscription_CustomerId')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_Subscription_CustomerId ON dbo.Subscriptions (CustomerId);
    PRINT '  [OK] Index IX_Subscription_CustomerId created.';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Subscriptions') AND name = 'IX_Subscription_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Subscription_Status ON dbo.Subscriptions (Status);
    PRINT '  [OK] Index IX_Subscription_Status created.';
END

-- PlanFeatures
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.PlanFeatures') AND name = 'IX_PlanFeature_Plan')
BEGIN
    CREATE NONCLUSTERED INDEX IX_PlanFeature_Plan ON dbo.PlanFeatures (PlanId);
    PRINT '  [OK] Index IX_PlanFeature_Plan created.';
END

-- ApiDefinitions
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.ApiDefinitions') AND name = 'IX_ApiDefinition_Code')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_ApiDefinition_Code ON dbo.ApiDefinitions (Code);
    PRINT '  [OK] Index IX_ApiDefinition_Code created.';
END

-- PlanAppPricings
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.PlanAppPricings') AND name = 'IX_PlanAppPricing_PlanApp')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_PlanAppPricing_PlanApp ON dbo.PlanAppPricings (PlanId, AppId);
    PRINT '  [OK] Index IX_PlanAppPricing_PlanApp created.';
END

-- PlanApiPricings
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.PlanApiPricings') AND name = 'IX_PlanApiPricing_PlanApi')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_PlanApiPricing_PlanApi ON dbo.PlanApiPricings (PlanId, ApiDefinitionId);
    PRINT '  [OK] Index IX_PlanApiPricing_PlanApi created.';
END

-- CustomerApiOverrides
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.CustomerApiOverrides') AND name = 'IX_CustApiOverride_CustApi')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_CustApiOverride_CustApi ON dbo.CustomerApiOverrides (CustomerId, ApiDefinitionId);
    PRINT '  [OK] Index IX_CustApiOverride_CustApi created.';
END

-- ApiUsageLogs
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.ApiUsageLogs') AND name = 'IX_ApiUsage_CustApiDate')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_ApiUsage_CustApiDate ON dbo.ApiUsageLogs (CustomerId, ApiDefinitionId, RecordedDate);
    PRINT '  [OK] Index IX_ApiUsage_CustApiDate created.';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.ApiUsageLogs') AND name = 'IX_ApiUsage_BillingPeriod')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ApiUsage_BillingPeriod ON dbo.ApiUsageLogs (CustomerId, BillingPeriodStart, BillingPeriodEnd);
    PRINT '  [OK] Index IX_ApiUsage_BillingPeriod created.';
END

-- UsageRecords
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.UsageRecords') AND name = 'IX_Usage_CustDateType')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Usage_CustDateType ON dbo.UsageRecords (CustomerId, RecordedDate, MetricType);
    PRINT '  [OK] Index IX_Usage_CustDateType created.';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.UsageRecords') AND name = 'IX_Usage_CustApp')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Usage_CustApp ON dbo.UsageRecords (CustomerId, AppId, RecordedDate);
    PRINT '  [OK] Index IX_Usage_CustApp created.';
END

-- SubscriptionHistories
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.SubscriptionHistories') AND name = 'IX_SubHistory_Customer')
BEGIN
    CREATE NONCLUSTERED INDEX IX_SubHistory_Customer ON dbo.SubscriptionHistories (CustomerId);
    PRINT '  [OK] Index IX_SubHistory_Customer created.';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.SubscriptionHistories') AND name = 'IX_SubHistory_Date')
BEGIN
    CREATE NONCLUSTERED INDEX IX_SubHistory_Date ON dbo.SubscriptionHistories (EffectiveDate);
    PRINT '  [OK] Index IX_SubHistory_Date created.';
END

-- Invoices
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Invoices') AND name = 'IX_Invoice_Number')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_Invoice_Number ON dbo.Invoices (InvoiceNumber);
    PRINT '  [OK] Index IX_Invoice_Number created.';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Invoices') AND name = 'IX_Invoice_Customer')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Invoice_Customer ON dbo.Invoices (CustomerId);
    PRINT '  [OK] Index IX_Invoice_Customer created.';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Invoices') AND name = 'IX_Invoice_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Invoice_Status ON dbo.Invoices (Status);
    PRINT '  [OK] Index IX_Invoice_Status created.';
END

-- InvoiceLineItems
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.InvoiceLineItems') AND name = 'IX_InvoiceLine_Invoice')
BEGIN
    CREATE NONCLUSTERED INDEX IX_InvoiceLine_Invoice ON dbo.InvoiceLineItems (InvoiceId);
    PRINT '  [OK] Index IX_InvoiceLine_Invoice created.';
END

-- PaymentAttempts
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.PaymentAttempts') AND name = 'IX_PayAttempt_Invoice')
BEGIN
    CREATE NONCLUSTERED INDEX IX_PayAttempt_Invoice ON dbo.PaymentAttempts (InvoiceId);
    PRINT '  [OK] Index IX_PayAttempt_Invoice created.';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.PaymentAttempts') AND name = 'IX_PayAttempt_Customer')
BEGIN
    CREATE NONCLUSTERED INDEX IX_PayAttempt_Customer ON dbo.PaymentAttempts (CustomerId);
    PRINT '  [OK] Index IX_PayAttempt_Customer created.';
END

-- BillingConfigs
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.BillingConfigs') AND name = 'IX_BillingConfig_Key')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_BillingConfig_Key ON dbo.BillingConfigs (ConfigKey);
    PRINT '  [OK] Index IX_BillingConfig_Key created.';
END


-- ============================================================================
-- SECTION D: SEED DATA
-- ============================================================================

PRINT '';
PRINT '--- Section D: Seeding reference data ---';

-- --------------------------------------------------------------------------
-- D1. Seed ApiDefinitions
-- --------------------------------------------------------------------------
PRINT '';
PRINT '  Seeding ApiDefinitions...';

IF NOT EXISTS (SELECT 1 FROM dbo.ApiDefinitions WHERE Code = N'ITEM_SYNC')
    INSERT INTO dbo.ApiDefinitions (Name, Code, Description, DefaultRatePerCall, DefaultFreeTier, IsActive, SortOrder)
    VALUES (N'Item Sync API', N'ITEM_SYNC', N'Synchronize inventory items between systems', 0.15, 250, 1, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.ApiDefinitions WHERE Code = N'CUSTOMER_SYNC')
    INSERT INTO dbo.ApiDefinitions (Name, Code, Description, DefaultRatePerCall, DefaultFreeTier, IsActive, SortOrder)
    VALUES (N'Customer Sync API', N'CUSTOMER_SYNC', N'Synchronize customer records between systems', 0.15, 250, 1, 2);

IF NOT EXISTS (SELECT 1 FROM dbo.ApiDefinitions WHERE Code = N'PHONE_ORDER')
    INSERT INTO dbo.ApiDefinitions (Name, Code, Description, DefaultRatePerCall, DefaultFreeTier, IsActive, SortOrder)
    VALUES (N'Phone Order API', N'PHONE_ORDER', N'Process phone orders from external systems', 0.15, 250, 1, 3);

PRINT '  [OK] ApiDefinitions seeded.';

-- --------------------------------------------------------------------------
-- D2. Seed BillingConfigs
-- --------------------------------------------------------------------------
PRINT '';
PRINT '  Seeding BillingConfigs...';

IF NOT EXISTS (SELECT 1 FROM dbo.BillingConfigs WHERE ConfigKey = N'grace_period_days')
    INSERT INTO dbo.BillingConfigs (ConfigKey, ConfigValue, Description)
    VALUES (N'grace_period_days', N'7', N'Number of days after invoice due date before suspension');

IF NOT EXISTS (SELECT 1 FROM dbo.BillingConfigs WHERE ConfigKey = N'invoice_prefix')
    INSERT INTO dbo.BillingConfigs (ConfigKey, ConfigValue, Description)
    VALUES (N'invoice_prefix', N'INV', N'Prefix used when generating invoice numbers');

IF NOT EXISTS (SELECT 1 FROM dbo.BillingConfigs WHERE ConfigKey = N'default_tax_rate')
    INSERT INTO dbo.BillingConfigs (ConfigKey, ConfigValue, Description)
    VALUES (N'default_tax_rate', N'0', N'Default tax rate applied to invoices (percentage)');

IF NOT EXISTS (SELECT 1 FROM dbo.BillingConfigs WHERE ConfigKey = N'transaction_rate')
    INSERT INTO dbo.BillingConfigs (ConfigKey, ConfigValue, Description)
    VALUES (N'transaction_rate', N'0.50', N'Rate charged per transaction beyond free tier');

IF NOT EXISTS (SELECT 1 FROM dbo.BillingConfigs WHERE ConfigKey = N'transaction_free_tier')
    INSERT INTO dbo.BillingConfigs (ConfigKey, ConfigValue, Description)
    VALUES (N'transaction_free_tier', N'250', N'Number of free transactions included per billing period');

IF NOT EXISTS (SELECT 1 FROM dbo.BillingConfigs WHERE ConfigKey = N'smartkart_pay_rate')
    INSERT INTO dbo.BillingConfigs (ConfigKey, ConfigValue, Description)
    VALUES (N'smartkart_pay_rate', N'15.00', N'Monthly rate for SmartKart Pay service');

PRINT '  [OK] BillingConfigs seeded.';


-- ============================================================================
-- DONE
-- ============================================================================

COMMIT TRANSACTION;

PRINT '';
PRINT '========================================================================';
PRINT 'Billing Schema & Seed Script - COMPLETED SUCCESSFULLY';
PRINT 'Time: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 121);
PRINT '========================================================================';

-- Print summary counts
PRINT '';
PRINT '--- Summary ---';
DECLARE @cnt INT;
SELECT @cnt = COUNT(*) FROM dbo.Subscriptions;      PRINT '  Subscriptions:         ' + CAST(@cnt AS VARCHAR(10));
SELECT @cnt = COUNT(*) FROM dbo.SubscriptionHistories; PRINT '  SubscriptionHistories: ' + CAST(@cnt AS VARCHAR(10));
SELECT @cnt = COUNT(*) FROM dbo.ApiDefinitions;      PRINT '  ApiDefinitions:        ' + CAST(@cnt AS VARCHAR(10));
SELECT @cnt = COUNT(*) FROM dbo.BillingConfigs;      PRINT '  BillingConfigs:        ' + CAST(@cnt AS VARCHAR(10));
SELECT @cnt = COUNT(*) FROM dbo.PlanFeatures;        PRINT '  PlanFeatures:          ' + CAST(@cnt AS VARCHAR(10));
SELECT @cnt = COUNT(*) FROM dbo.PlanAppPricings;     PRINT '  PlanAppPricings:       ' + CAST(@cnt AS VARCHAR(10));
SELECT @cnt = COUNT(*) FROM dbo.PlanApiPricings;     PRINT '  PlanApiPricings:       ' + CAST(@cnt AS VARCHAR(10));
SELECT @cnt = COUNT(*) FROM dbo.Invoices;            PRINT '  Invoices:              ' + CAST(@cnt AS VARCHAR(10));

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT '';
    PRINT '========================================================================';
    PRINT 'ERROR: Billing Schema & Seed Script FAILED - ALL CHANGES ROLLED BACK';
    PRINT 'Error Number:  ' + CAST(ERROR_NUMBER() AS VARCHAR(10));
    PRINT 'Error Message: ' + ERROR_MESSAGE();
    PRINT 'Error Line:    ' + CAST(ERROR_LINE() AS VARCHAR(10));
    PRINT '========================================================================';

    THROW;
END CATCH;

GO
