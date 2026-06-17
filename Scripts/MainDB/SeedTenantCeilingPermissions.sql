-- ============================================================================
-- Seed Tenant Ceiling Permissions
-- ============================================================================
-- Run this against the MASTER DATABASE to bootstrap permission ceilings
-- for all existing tenants.
--
-- This grants ALL active permissions to every tenant that currently has
-- no ceiling data. After running, Super Admins can refine per-tenant
-- ceilings via the Permission Ceiling UI.
--
-- Safe to run multiple times (idempotent via NOT EXISTS check).
-- ============================================================================

PRINT '=== Seeding Tenant Ceiling Permissions ==='
PRINT ''

-- Show current state
DECLARE @tenantCount INT;
SELECT @tenantCount = COUNT(*) FROM dbo.Customers;
PRINT 'Total tenants: ' + CAST(@tenantCount AS VARCHAR(10));

DECLARE @permCount INT;
SELECT @permCount = COUNT(*) FROM dbo.Permissions WHERE IsActive = 1;
PRINT 'Total active permissions: ' + CAST(@permCount AS VARCHAR(10));

DECLARE @existingCeiling INT;
SELECT @existingCeiling = COUNT(*) FROM dbo.TenantAllowedPermissions;
PRINT 'Existing ceiling records: ' + CAST(@existingCeiling AS VARCHAR(10));

PRINT ''
PRINT 'Inserting missing ceiling records...'

-- Insert all active permissions for all tenants where they don't already exist
INSERT INTO dbo.TenantAllowedPermissions (TenantId, PermissionId, IsAllowed, GrantedAt)
SELECT c.CustomerId, p.Id, 1, GETUTCDATE()
FROM dbo.Customers c
CROSS JOIN dbo.Permissions p
WHERE p.IsActive = 1
  AND NOT EXISTS (
    SELECT 1 FROM dbo.TenantAllowedPermissions tap
    WHERE tap.TenantId = c.CustomerId AND tap.PermissionId = p.Id
  );

DECLARE @inserted INT = @@ROWCOUNT;
PRINT 'Inserted: ' + CAST(@inserted AS VARCHAR(10)) + ' new ceiling records';

-- Also ensure TenantAllowedModules are populated
INSERT INTO dbo.TenantAllowedModules (TenantId, ModuleId, IsEnabled, EnabledAt)
SELECT c.CustomerId, m.ModuleId, 1, GETUTCDATE()
FROM dbo.Customers c
CROSS JOIN dbo.Modules m
WHERE m.IsActive = 1
  AND NOT EXISTS (
    SELECT 1 FROM dbo.TenantAllowedModules tam
    WHERE tam.TenantId = c.CustomerId AND tam.ModuleId = m.ModuleId
  );

DECLARE @insertedMods INT = @@ROWCOUNT;
PRINT 'Inserted: ' + CAST(@insertedMods AS VARCHAR(10)) + ' new module ceiling records';

-- Final state
DECLARE @finalCeiling INT;
SELECT @finalCeiling = COUNT(*) FROM dbo.TenantAllowedPermissions;
PRINT ''
PRINT 'Final ceiling records: ' + CAST(@finalCeiling AS VARCHAR(10));
PRINT '=== Done ==='
