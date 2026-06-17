-- =============================================================================
-- 20260501_GrantBillingPermissionsToAdminRoles.sql
--
-- Grants the 3 new billing.licenses_and_billing.* permission keys to all
-- administrator/system roles in the current tenant DB.
--
-- Run against the TENANT DB (e.g. DYLAN STORES tenant DB), not MainDB.
-- Idempotent: safe to re-run; only inserts grants that don't exist yet.
--
-- Guards:
--   * dbo.RbacTenantRoles must exist
--   * dbo.RbacTenantRolePermissions must exist
--   * Skips if either is missing (PRINT + RETURN, no error)
-- =============================================================================

SET NOCOUNT ON;

-- Guard 1: required tables exist
IF OBJECT_ID(N'dbo.RbacTenantRoles', N'U') IS NULL
BEGIN
    PRINT 'dbo.RbacTenantRoles not found — wrong DB? Aborting.';
    RETURN;
END;

IF OBJECT_ID(N'dbo.RbacTenantRolePermissions', N'U') IS NULL
BEGIN
    PRINT 'dbo.RbacTenantRolePermissions not found — wrong DB? Aborting.';
    RETURN;
END;

-- Guard 2: required columns exist (defensive — schema drift)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.RbacTenantRoles') AND name = N'Code')
   OR NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.RbacTenantRoles') AND name = N'IsSystemRole')
   OR NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.RbacTenantRoles') AND name = N'IsActive')
BEGIN
    PRINT 'dbo.RbacTenantRoles is missing expected columns (Code/IsSystemRole/IsActive). Aborting.';
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.RbacTenantRolePermissions') AND name = N'RoleId')
   OR NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.RbacTenantRolePermissions') AND name = N'PermissionKey')
   OR NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.RbacTenantRolePermissions') AND name = N'IsGranted')
BEGIN
    PRINT 'dbo.RbacTenantRolePermissions is missing expected columns (RoleId/PermissionKey/IsGranted). Aborting.';
    RETURN;
END;

-- Permission keys to grant
DECLARE @Keys TABLE (k NVARCHAR(150) PRIMARY KEY);
INSERT INTO @Keys (k) VALUES
    (N'billing.licenses_and_billing.view'),
    (N'billing.licenses_and_billing.change_plan'),
    (N'billing.licenses_and_billing.manage_licenses');

-- Idempotent insert: only rows that don't already exist
INSERT INTO dbo.RbacTenantRolePermissions (RoleId, PermissionKey, IsGranted)
SELECT r.Id, k.k, 1
FROM dbo.RbacTenantRoles r
CROSS JOIN @Keys k
WHERE (r.Code IN (N'administrator', N'admin') OR r.IsSystemRole = 1)
  AND r.IsActive = 1
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.RbacTenantRolePermissions existing
      WHERE existing.RoleId = r.Id
        AND existing.PermissionKey = k.k
  );

DECLARE @Inserted INT = @@ROWCOUNT;
PRINT CONCAT('Inserted ', @Inserted, ' new grant(s).');

-- Show the resulting state for visibility
SELECT r.Id AS RoleId, r.Code AS RoleCode, r.IsSystemRole, p.PermissionKey, p.IsGranted
FROM dbo.RbacTenantRoles r
INNER JOIN dbo.RbacTenantRolePermissions p ON p.RoleId = r.Id
WHERE p.PermissionKey LIKE N'billing.licenses_and_billing.%'
ORDER BY r.Id, p.PermissionKey;

PRINT 'Billing permission grant script complete.';
