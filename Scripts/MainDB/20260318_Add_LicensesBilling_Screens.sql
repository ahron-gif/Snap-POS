/*
================================================================================
Script Name:    20260318_Add_LicensesBilling_Screens.sql
Date:           2026-03-18
Author:         RDT Dev Team
Depends On:     RBAC_MasterDB_Schema_And_Seed.sql

Description:    Adds "Licenses & Billing" screen to both Administrator and
                Super Admin modules. Consolidates Plan Management, Global Pricing,
                and Billing Overview into one Super Admin screen.

                This script is IDEMPOTENT - safe to run multiple times.

Database:       Master Database (rdt2 / RDTCloud)

Change Log:
    2026-03-18  Initial creation - Licenses & Billing RBAC screens and permissions
================================================================================
*/

SET NOCOUNT ON;

PRINT '========================================================================';
PRINT 'Add Licenses & Billing Screens - Starting';
PRINT 'Database: ' + DB_NAME();
PRINT '========================================================================';

-- ============================================================================
-- STEP 1: Administrator > Licenses & Billing (for tenant/customer users)
-- ============================================================================

PRINT '';
PRINT '--- Step 1: Administrator > Licenses & Billing ---';

DECLARE @AdminModuleId INT;
SELECT @AdminModuleId = ModuleId FROM dbo.Modules WHERE Code = 'admin';

IF @AdminModuleId IS NOT NULL
BEGIN
    -- Add screen
    IF NOT EXISTS (SELECT 1 FROM dbo.Screens WHERE Code = 'admin.licenses_billing')
    BEGIN
        INSERT INTO dbo.Screens (ModuleId, Code, Name, Route, Icon, SortOrder, IsActive)
        VALUES (@AdminModuleId, 'admin.licenses_billing', N'Licenses & Billing', '/licenses-billing', 'PieChartIcon', 9, 1);
        PRINT '  [OK] Screen admin.licenses_billing added.';
    END
    ELSE
        PRINT '  [SKIP] Screen admin.licenses_billing already exists.';

    -- Add permissions
    DECLARE @AdminScreenId INT;
    SELECT @AdminScreenId = Id FROM dbo.Screens WHERE Code = 'admin.licenses_billing';

    IF @AdminScreenId IS NOT NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'admin.licenses_billing.view')
            INSERT INTO dbo.Permissions (ScreenId, PermissionKey, Name, Category, SortOrder, IsActive)
            VALUES (@AdminScreenId, 'admin.licenses_billing.view', N'View', 'action', 1, 1);
        IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'admin.licenses_billing.edit')
            INSERT INTO dbo.Permissions (ScreenId, PermissionKey, Name, Category, SortOrder, IsActive)
            VALUES (@AdminScreenId, 'admin.licenses_billing.edit', N'Edit', 'action', 2, 1);
        PRINT '  [OK] Permissions for admin.licenses_billing added.';
    END
END
ELSE
    PRINT '  [WARN] admin module not found.';

-- ============================================================================
-- STEP 2: Super Admin > Licenses & Billing (consolidated)
-- ============================================================================

PRINT '';
PRINT '--- Step 2: Super Admin > Licenses & Billing ---';

DECLARE @SAModuleId INT;
SELECT @SAModuleId = ModuleId FROM dbo.Modules WHERE Code = 'superadmin';

IF @SAModuleId IS NOT NULL
BEGIN
    -- Add consolidated screen
    IF NOT EXISTS (SELECT 1 FROM dbo.Screens WHERE Code = 'superadmin.licenses_billing')
    BEGIN
        INSERT INTO dbo.Screens (ModuleId, Code, Name, Route, Icon, SortOrder, IsActive)
        VALUES (@SAModuleId, 'superadmin.licenses_billing', N'Licenses & Billing', '/super-admin/licenses-billing', 'PieChartIcon', 2, 1);
        PRINT '  [OK] Screen superadmin.licenses_billing added.';
    END
    ELSE
        PRINT '  [SKIP] Screen superadmin.licenses_billing already exists.';

    -- Add permissions
    DECLARE @SAScreenId INT;
    SELECT @SAScreenId = Id FROM dbo.Screens WHERE Code = 'superadmin.licenses_billing';

    IF @SAScreenId IS NOT NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'superadmin.licenses_billing.view')
            INSERT INTO dbo.Permissions (ScreenId, PermissionKey, Name, Category, SortOrder, IsActive)
            VALUES (@SAScreenId, 'superadmin.licenses_billing.view', N'View', 'action', 1, 1);
        IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'superadmin.licenses_billing.edit')
            INSERT INTO dbo.Permissions (ScreenId, PermissionKey, Name, Category, SortOrder, IsActive)
            VALUES (@SAScreenId, 'superadmin.licenses_billing.edit', N'Edit', 'action', 2, 1);
        PRINT '  [OK] Permissions for superadmin.licenses_billing added.';
    END
END
ELSE
    PRINT '  [WARN] superadmin module not found.';

-- ============================================================================
-- STEP 3: Deactivate old separate screens (Plan Management, Global Pricing, Billing Overview)
-- ============================================================================

PRINT '';
PRINT '--- Step 3: Deactivate old separate screens ---';

-- Deactivate if they exist (safe even if they don't)
UPDATE dbo.Screens SET IsActive = 0
WHERE Code IN (
    'superadmin.plan_management',
    'superadmin.global_pricing',
    'superadmin.billing_overview'
) AND IsActive = 1;

PRINT '  [OK] Old separate screens deactivated (if they existed). Rows affected: ' + CAST(@@ROWCOUNT AS VARCHAR(10));

-- ============================================================================
-- STEP 4: Grant Licenses & Billing permission to ALL existing tenants
-- ============================================================================

PRINT '';
PRINT '--- Step 4: Grant admin.licenses_billing to all tenants ---';

-- Get the permission IDs for admin.licenses_billing
DECLARE @ViewPermId INT, @EditPermId INT;
SELECT @ViewPermId = Id FROM dbo.Permissions WHERE PermissionKey = 'admin.licenses_billing.view';
SELECT @EditPermId = Id FROM dbo.Permissions WHERE PermissionKey = 'admin.licenses_billing.edit';

-- Insert for every tenant (customer) that doesn't already have it
IF @ViewPermId IS NOT NULL
BEGIN
    INSERT INTO dbo.TenantAllowedPermissions (TenantId, PermissionId, IsAllowed)
    SELECT c.CustomerId, @ViewPermId, 1
    FROM dbo.Customers c
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.TenantAllowedPermissions tap
        WHERE tap.TenantId = c.CustomerId AND tap.PermissionId = @ViewPermId
    );
    PRINT '  [OK] admin.licenses_billing.view granted to all tenants. Rows: ' + CAST(@@ROWCOUNT AS VARCHAR(10));
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
    PRINT '  [OK] admin.licenses_billing.edit granted to all tenants. Rows: ' + CAST(@@ROWCOUNT AS VARCHAR(10));
END

-- Also grant superadmin.licenses_billing to all tenants (so SA screens show for all)
DECLARE @SAViewPermId INT, @SAEditPermId INT;
SELECT @SAViewPermId = Id FROM dbo.Permissions WHERE PermissionKey = 'superadmin.licenses_billing.view';
SELECT @SAEditPermId = Id FROM dbo.Permissions WHERE PermissionKey = 'superadmin.licenses_billing.edit';

IF @SAViewPermId IS NOT NULL
BEGIN
    INSERT INTO dbo.TenantAllowedPermissions (TenantId, PermissionId, IsAllowed)
    SELECT c.CustomerId, @SAViewPermId, 1
    FROM dbo.Customers c
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.TenantAllowedPermissions tap
        WHERE tap.TenantId = c.CustomerId AND tap.PermissionId = @SAViewPermId
    );
    PRINT '  [OK] superadmin.licenses_billing.view granted to all tenants. Rows: ' + CAST(@@ROWCOUNT AS VARCHAR(10));
END

-- ============================================================================
-- DONE
-- ============================================================================

PRINT '';
PRINT '========================================================================';
PRINT 'COMPLETED. Summary of Licenses & Billing screens:';
PRINT '========================================================================';

SELECT s.Id, m.Code AS Module, s.Code, s.Name, s.Route, s.SortOrder, s.IsActive
FROM dbo.Screens s
INNER JOIN dbo.Modules m ON s.ModuleId = m.ModuleId
WHERE s.Code LIKE '%licenses_billing%'
   OR s.Code IN ('superadmin.plan_management', 'superadmin.global_pricing', 'superadmin.billing_overview')
ORDER BY m.Code, s.SortOrder;
