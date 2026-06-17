/*
================================================================================
Script Name:    20260319_Billing_SeedDemoData.sql
Date:           2026-03-19
Author:         RDT Dev Team
Depends On:     20260318_Billing_Schema_And_Seed.sql

Description:    Seeds ALL demo/setup data for the Billing & Licensing module.
                Run this AFTER 20260318_Billing_Schema_And_Seed.sql on the MASTER database.

                This script is IDEMPOTENT - safe to run multiple times.
                Uses TRANSACTIONS with TRY/CATCH for safe rollback on error.

Database:       Master Database (rdt2 / RDTCloud)

Change Log:
    2026-03-19  Wrapped all DML in transactions with TRY/CATCH
    2026-03-19  Initial creation - Demo data for billing module

Sections:
    Batch 1: DDL - Convert Tier column to INT (cannot be in transaction)
    Batch 2: DML in transaction - All seed data
        1) Update Plan prices, descriptions, tiers
        2) Add "Licenses & Billing" screen + permissions (RBAC)
        3) Grant permissions to all tenants
        4) Create subscription for test customer
        5) Add missing CustomerApps
        6) Enable PlanApiPricings
        7) Seed API usage logs (demo data)
        8) Seed transaction usage (demo data)
        9) Create sample invoice
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '========================================================================';
PRINT 'Billing Demo Data Script - Starting';
PRINT 'Database: ' + DB_NAME();
PRINT 'Time: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 121);
PRINT '========================================================================';

-- ============================================================================
-- BATCH 1: DDL (ALTER TABLE cannot be in a transaction on Azure SQL)
-- ============================================================================
IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Plans' AND COLUMN_NAME = 'Tier' AND DATA_TYPE = 'nvarchar'
)
BEGIN
    UPDATE dbo.Plans SET Tier = NULL;
    ALTER TABLE dbo.Plans ALTER COLUMN Tier INT NULL;
    PRINT '  [OK] Plans.Tier converted from NVARCHAR to INT.';
END
ELSE
    PRINT '  [SKIP] Plans.Tier is already INT.';

GO

-- ============================================================================
-- BATCH 2: ALL DML IN A TRANSACTION
-- ============================================================================
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
BEGIN TRANSACTION;

-- ════════════════════════════════════════════════════════════════════════════
-- 1) UPDATE PLAN PRICES, DESCRIPTIONS, TIERS
-- ════════════════════════════════════════════════════════════════════════════
PRINT '';
PRINT '--- 1. Updating Plans ---';

UPDATE dbo.Plans SET Price = 49.00,  BillingCycle = 0, Description = N'Small stores',    Tier = 0, SortOrder = 1 WHERE Name = 'Basic'      AND (Price = 0 OR Price IS NULL OR Price = 49.00);
UPDATE dbo.Plans SET Price = 168.00, BillingCycle = 0, Description = N'Growing stores',   Tier = 1, SortOrder = 2 WHERE Name = 'Standard'   AND (Price = 0 OR Price IS NULL OR Price = 168.00);
UPDATE dbo.Plans SET Price = 349.00, BillingCycle = 0, Description = N'Multi-location',   Tier = 2, SortOrder = 3 WHERE Name = 'Enterprise' AND (Price = 0 OR Price IS NULL OR Price = 349.00);
UPDATE dbo.Plans SET Price = 999.00, BillingCycle = 0, Description = N'Unlimited scale',  Tier = 3, SortOrder = 4 WHERE Name = 'VIP'        AND (Price = 0 OR Price IS NULL OR Price = 999.00);
PRINT '  [OK] Plan prices and tiers updated.';


-- ════════════════════════════════════════════════════════════════════════════
-- 2) ADD "LICENSES & BILLING" SCREEN + PERMISSIONS
-- ════════════════════════════════════════════════════════════════════════════
PRINT '';
PRINT '--- 2. Adding Licenses & Billing screen + permissions ---';

DECLARE @AdminModuleId INT;
SELECT @AdminModuleId = ModuleId FROM dbo.Modules WHERE Code = 'admin';

IF @AdminModuleId IS NOT NULL
BEGIN
    -- Add screen
    IF NOT EXISTS (SELECT 1 FROM dbo.Screens WHERE Code = 'admin.licenses_billing')
    BEGIN
        INSERT INTO dbo.Screens (ModuleId, Code, Name, Route, Icon, SortOrder, IsActive)
        VALUES (@AdminModuleId, 'admin.licenses_billing', N'Licenses & Billing', '/licenses-billing', 'PieChartIcon', 9, 1);
        PRINT '  [OK] Screen "Licenses & Billing" added.';
    END
    ELSE
        PRINT '  [SKIP] Screen already exists.';

    -- Add permissions
    DECLARE @LBScreenId INT;
    SELECT @LBScreenId = Id FROM dbo.Screens WHERE Code = 'admin.licenses_billing';

    IF @LBScreenId IS NOT NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'admin.licenses_billing.view')
            INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive)
            VALUES (@AdminModuleId, @LBScreenId, 'admin.licenses_billing.view', N'View', 'action', 1, 1);

        IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'admin.licenses_billing.edit')
            INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive)
            VALUES (@AdminModuleId, @LBScreenId, 'admin.licenses_billing.edit', N'Edit', 'action', 2, 1);

        PRINT '  [OK] Permissions ensured.';
    END
END
ELSE
    PRINT '  [WARN] Admin module not found.';


-- ════════════════════════════════════════════════════════════════════════════
-- 3) GRANT PERMISSIONS TO ALL TENANTS
-- ════════════════════════════════════════════════════════════════════════════
PRINT '';
PRINT '--- 3. Granting permissions to all tenants ---';

IF OBJECT_ID('dbo.TenantAllowedPermissions', 'U') IS NOT NULL
BEGIN
    DECLARE @ViewPermId INT, @EditPermId INT;
    SELECT @ViewPermId = Id FROM dbo.Permissions WHERE PermissionKey = 'admin.licenses_billing.view';
    SELECT @EditPermId = Id FROM dbo.Permissions WHERE PermissionKey = 'admin.licenses_billing.edit';

    IF @ViewPermId IS NOT NULL
    BEGIN
        INSERT INTO dbo.TenantAllowedPermissions (TenantId, PermissionId, IsAllowed)
        SELECT c.CustomerId, @ViewPermId, 1
        FROM dbo.Customers c
        WHERE NOT EXISTS (
            SELECT 1 FROM dbo.TenantAllowedPermissions tap
            WHERE tap.TenantId = c.CustomerId AND tap.PermissionId = @ViewPermId
        );
        PRINT '  [OK] View granted to ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' tenants.';
    END

    IF @EditPermId IS NOT NULL
    BEGIN
        INSERT INTO dbo.TenantAllowedPermissions (TenantId, PermissionId, IsAllowed)
        SELECT c.CustomerId, @EditPermId, 1
        FROM dbo.Customers c
        WHERE NOT EXISTS (
            SELECT 1 FROM dbo.TenantAllowedPermissions tap
            WHERE tap.TenantId = c.CustomerId AND tap.PermissionId = @EditPermId
        );
        PRINT '  [OK] Edit granted to ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' tenants.';
    END
END
ELSE
    PRINT '  [SKIP] TenantAllowedPermissions table not found.';


-- ════════════════════════════════════════════════════════════════════════════
-- 4) CREATE SUBSCRIPTION FOR TEST CUSTOMER
-- ════════════════════════════════════════════════════════════════════════════
PRINT '';
PRINT '--- 4. Creating subscription for test customer ---';

DECLARE @TestCustomerId INT = 25;
DECLARE @TestPlanId INT;
SELECT @TestPlanId = Id FROM dbo.Plans WHERE Name = 'VIP';
IF @TestPlanId IS NULL
    SELECT TOP 1 @TestPlanId = Id FROM dbo.Plans ORDER BY SortOrder DESC;

IF @TestPlanId IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerId = @TestCustomerId)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.Subscriptions WHERE CustomerId = @TestCustomerId)
    BEGIN
        INSERT INTO dbo.Subscriptions (CustomerId, PlanId, Status, StartDate, EndDate, BillingEmail, BillingCycleMonths)
        VALUES (@TestCustomerId, @TestPlanId, 0, GETUTCDATE(), DATEADD(MONTH, 1, GETUTCDATE()), 'admin@test.com', 1);
        PRINT '  [OK] Subscription created.';
    END
    ELSE
        PRINT '  [SKIP] Subscription already exists.';

    -- Subscription history
    IF NOT EXISTS (SELECT 1 FROM dbo.SubscriptionHistories WHERE CustomerId = @TestCustomerId)
    BEGIN
        DECLARE @PlanPrice DECIMAL(10,2);
        SELECT @PlanPrice = Price FROM dbo.Plans WHERE Id = @TestPlanId;
        INSERT INTO dbo.SubscriptionHistories (CustomerId, PlanId, Action, MonthlyAmount, EffectiveDate, Notes)
        VALUES (@TestCustomerId, @TestPlanId, 0, @PlanPrice, GETUTCDATE(), 'Initial subscription via seed script');
        PRINT '  [OK] Subscription history created.';
    END
    ELSE
        PRINT '  [SKIP] Subscription history already exists.';
END
ELSE
    PRINT '  [SKIP] Test customer or plan not found.';


-- ════════════════════════════════════════════════════════════════════════════
-- 5) ADD MISSING CUSTOMER APPS
-- ════════════════════════════════════════════════════════════════════════════
PRINT '';
PRINT '--- 5. Adding CustomerApps ---';

DECLARE @AppLoop INT = 1;
WHILE @AppLoop <= 5
BEGIN
    IF EXISTS (SELECT 1 FROM dbo.Apps WHERE AppId = @AppLoop)
       AND NOT EXISTS (SELECT 1 FROM dbo.CustomerApps WHERE CustomerId = @TestCustomerId AND AppId = @AppLoop)
    BEGIN
        DECLARE @DevLimit INT = CASE @AppLoop
            WHEN 1 THEN 10  WHEN 2 THEN 10  WHEN 3 THEN 8  WHEN 4 THEN 7  WHEN 5 THEN 4  ELSE 5
        END;
        INSERT INTO dbo.CustomerApps (AppId, CustomerId, DevicesLimit, DateCreated, IsEnabled)
        VALUES (@AppLoop, @TestCustomerId, @DevLimit, GETUTCDATE(), 1);
        PRINT '  [OK] AppId=' + CAST(@AppLoop AS VARCHAR(5)) + ' Limit=' + CAST(@DevLimit AS VARCHAR(5));
    END
    SET @AppLoop = @AppLoop + 1;
END


-- ════════════════════════════════════════════════════════════════════════════
-- 6) ADD & ENABLE PLAN API PRICINGS
-- ════════════════════════════════════════════════════════════════════════════
PRINT '';
PRINT '--- 6. Adding PlanApiPricings ---';

-- Insert missing PlanApiPricings for all plan+API combinations
INSERT INTO dbo.PlanApiPricings (PlanId, ApiDefinitionId, RatePerCall, FreeTierCalls, IsIncluded)
SELECT p.Id, ad.Id, 0.15, 250, 1
FROM dbo.Plans p
CROSS JOIN dbo.ApiDefinitions ad
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.PlanApiPricings pap
    WHERE pap.PlanId = p.Id AND pap.ApiDefinitionId = ad.Id
);
PRINT '  [OK] PlanApiPricings inserted: ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows.';

-- Enable any that are disabled
UPDATE dbo.PlanApiPricings SET IsIncluded = 1 WHERE IsIncluded = 0;
PRINT '  [OK] Disabled pricings enabled: ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows.';

-- Add PlanAppPricings for test plan if missing
IF @TestPlanId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.PlanAppPricings WHERE PlanId = @TestPlanId AND AppId = 1)
BEGIN
    INSERT INTO dbo.PlanAppPricings (PlanId, AppId, PricingModel, PricePerUnit, FreeUnits, MaxUnits, IsIncluded)
    VALUES
        (@TestPlanId, 1, 'per_user',   100.00, 0, 10, 1),
        (@TestPlanId, 2, 'per_device',  10.00, 0, 10, 1),
        (@TestPlanId, 3, 'per_device',  10.00, 0, 80, 1),
        (@TestPlanId, 4, 'per_device',  10.00, 0, 98, 1),
        (@TestPlanId, 5, 'per_device',  15.00, 0, 45, 1);
    PRINT '  [OK] PlanAppPricings added for test plan.';
END
ELSE
    PRINT '  [SKIP] PlanAppPricings already exist.';


-- ════════════════════════════════════════════════════════════════════════════
-- 7) SEED API USAGE LOGS
-- ════════════════════════════════════════════════════════════════════════════
PRINT '';
PRINT '--- 7. Seeding API usage logs ---';

DECLARE @BillingStart DATE = DATEFROMPARTS(YEAR(GETUTCDATE()), MONTH(GETUTCDATE()), 1);
DECLARE @BillingEnd DATE = EOMONTH(GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM dbo.ApiUsageLogs WHERE CustomerId = @TestCustomerId AND ApiDefinitionId = 1 AND BillingPeriodStart = @BillingStart)
    INSERT INTO dbo.ApiUsageLogs (CustomerId, ApiDefinitionId, CallCount, RecordedDate, BillingPeriodStart, BillingPeriodEnd)
    VALUES (@TestCustomerId, 1, 425, CAST(GETUTCDATE() AS DATE), @BillingStart, @BillingEnd);

IF NOT EXISTS (SELECT 1 FROM dbo.ApiUsageLogs WHERE CustomerId = @TestCustomerId AND ApiDefinitionId = 2 AND BillingPeriodStart = @BillingStart)
    INSERT INTO dbo.ApiUsageLogs (CustomerId, ApiDefinitionId, CallCount, RecordedDate, BillingPeriodStart, BillingPeriodEnd)
    VALUES (@TestCustomerId, 2, 188, CAST(GETUTCDATE() AS DATE), @BillingStart, @BillingEnd);

IF NOT EXISTS (SELECT 1 FROM dbo.ApiUsageLogs WHERE CustomerId = @TestCustomerId AND ApiDefinitionId = 3 AND BillingPeriodStart = @BillingStart)
    INSERT INTO dbo.ApiUsageLogs (CustomerId, ApiDefinitionId, CallCount, RecordedDate, BillingPeriodStart, BillingPeriodEnd)
    VALUES (@TestCustomerId, 3, 312, CAST(GETUTCDATE() AS DATE), @BillingStart, @BillingEnd);

PRINT '  [OK] API usage logs seeded (425 + 188 + 312 calls).';


-- ════════════════════════════════════════════════════════════════════════════
-- 8) SEED TRANSACTION USAGE
-- ════════════════════════════════════════════════════════════════════════════
PRINT '';
PRINT '--- 8. Seeding transaction usage ---';

IF NOT EXISTS (SELECT 1 FROM dbo.UsageRecords WHERE CustomerId = @TestCustomerId AND MetricType = 'transaction' AND RecordedDate = CAST(GETUTCDATE() AS DATE))
BEGIN
    INSERT INTO dbo.UsageRecords (CustomerId, MetricType, Count, RecordedDate)
    VALUES (@TestCustomerId, 'transaction', 836, CAST(GETUTCDATE() AS DATE));
    PRINT '  [OK] 836 transactions seeded.';
END
ELSE
    PRINT '  [SKIP] Transaction usage already exists.';


-- ════════════════════════════════════════════════════════════════════════════
-- 9) CREATE SAMPLE INVOICE
-- ════════════════════════════════════════════════════════════════════════════
PRINT '';
PRINT '--- 9. Creating sample invoice ---';

IF NOT EXISTS (SELECT 1 FROM dbo.Invoices WHERE CustomerId = @TestCustomerId AND InvoiceNumber = 'INV-0001')
BEGIN
    DECLARE @InvPlanPrice DECIMAL(10,2);
    SELECT @InvPlanPrice = Price FROM dbo.Plans WHERE Id = @TestPlanId;

    INSERT INTO dbo.Invoices (InvoiceNumber, CustomerId, BillingPeriodStart, BillingPeriodEnd, IssuedAt, DueDate, SubTotal, TaxAmount, TotalAmount, Status, PaidAt)
    VALUES ('INV-0001', @TestCustomerId, DATEADD(MONTH, -1, @BillingStart), DATEADD(DAY, -1, @BillingStart),
            DATEADD(DAY, 1, DATEADD(MONTH, -1, @BillingStart)), DATEADD(DAY, 15, DATEADD(MONTH, -1, @BillingStart)),
            ISNULL(@InvPlanPrice, 168.00), 0, ISNULL(@InvPlanPrice, 168.00), 2, GETUTCDATE());
    PRINT '  [OK] Invoice INV-0001 created.';
END
ELSE
    PRINT '  [SKIP] Invoice already exists.';


-- ════════════════════════════════════════════════════════════════════════════
-- COMMIT
-- ════════════════════════════════════════════════════════════════════════════
COMMIT TRANSACTION;

PRINT '';
PRINT '========================================================================';
PRINT 'Billing Demo Data Script - COMPLETED SUCCESSFULLY';
PRINT 'Time: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 121);
PRINT '========================================================================';

-- Summary
PRINT '';
PRINT '--- Summary ---';
DECLARE @cnt INT;
SELECT @cnt = COUNT(*) FROM dbo.Subscriptions;         PRINT '  Subscriptions:         ' + CAST(@cnt AS VARCHAR(10));
SELECT @cnt = COUNT(*) FROM dbo.SubscriptionHistories;  PRINT '  SubscriptionHistories: ' + CAST(@cnt AS VARCHAR(10));
SELECT @cnt = COUNT(*) FROM dbo.PlanAppPricings;        PRINT '  PlanAppPricings:       ' + CAST(@cnt AS VARCHAR(10));
SELECT @cnt = COUNT(*) FROM dbo.PlanApiPricings;        PRINT '  PlanApiPricings:       ' + CAST(@cnt AS VARCHAR(10));
SELECT @cnt = COUNT(*) FROM dbo.ApiUsageLogs;           PRINT '  ApiUsageLogs:          ' + CAST(@cnt AS VARCHAR(10));
SELECT @cnt = COUNT(*) FROM dbo.UsageRecords;           PRINT '  UsageRecords:          ' + CAST(@cnt AS VARCHAR(10));
SELECT @cnt = COUNT(*) FROM dbo.Invoices;               PRINT '  Invoices:              ' + CAST(@cnt AS VARCHAR(10));

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT '';
    PRINT '========================================================================';
    PRINT 'ERROR: Billing Demo Data Script FAILED - ALL CHANGES ROLLED BACK';
    PRINT 'Error Number:  ' + CAST(ERROR_NUMBER() AS VARCHAR(10));
    PRINT 'Error Message: ' + ERROR_MESSAGE();
    PRINT 'Error Line:    ' + CAST(ERROR_LINE() AS VARCHAR(10));
    PRINT '========================================================================';

    THROW;
END CATCH;

GO
