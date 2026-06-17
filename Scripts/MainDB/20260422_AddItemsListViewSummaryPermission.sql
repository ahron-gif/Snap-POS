-- ================================================================
-- File: 20260422_AddItemsListViewSummaryPermission.sql
-- Purpose: Register the permission 'inventory.item_list.view_summary'
--          used to gate the Item List summary bar (Total Items,
--          Price Sum, Cost Sum, Avg PC Cost, On Hand Value).
--
-- Target DB: TENANT DB(s) — the ones that own the Rbac-prefixed
--            tables (dbo.RbacTenantRoles, dbo.RbacTenantRolePermissions,
--            dbo.RbacTenantUserPermOverrides, etc.).
--
--            This project does NOT use a central dbo.Permissions /
--            dbo.Modules / dbo.Screens registry. Permissions are
--            stored as free-form keys directly on the Rbac tables
--            per tenant DB. Run this script on EACH tenant DB where
--            you want the new permission enabled.
--
-- Idempotent: safe to run multiple times.
-- ================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

PRINT '================================================================';
PRINT '  DB: ' + DB_NAME();
PRINT '  Adding permission: inventory.item_list.view_summary';
PRINT '================================================================';

DECLARE @PermKey VARCHAR(150) = 'inventory.item_list.view_summary';

IF OBJECT_ID('dbo.RbacTenantRolePermissions', 'U') IS NULL
BEGIN
    RAISERROR('This DB is missing dbo.RbacTenantRolePermissions. Run this on a tenant DB, not the main DB.', 16, 1);
    ROLLBACK TRANSACTION;
    RETURN;
END

IF OBJECT_ID('dbo.RbacTenantRoles', 'U') IS NULL
BEGIN
    RAISERROR('This DB is missing dbo.RbacTenantRoles. Run this on a tenant DB.', 16, 1);
    ROLLBACK TRANSACTION;
    RETURN;
END

-- ----------------------------------------------------------------
-- Grant to admin / administrator / system roles so existing admins
-- keep seeing the summary bar after the client-side gate is enforced.
-- Non-admin roles must have it granted explicitly via the Role
-- Permission UI — the tenant admin picks which roles get it.
-- ----------------------------------------------------------------
INSERT INTO dbo.RbacTenantRolePermissions (RoleId, PermissionKey, IsGranted)
SELECT r.Id, @PermKey, 1
FROM dbo.RbacTenantRoles r
WHERE (r.Code IN ('administrator', 'admin') OR r.IsSystemRole = 1)
  AND r.IsActive = 1
  AND NOT EXISTS (
      SELECT 1 FROM dbo.RbacTenantRolePermissions rp
      WHERE rp.RoleId = r.Id AND rp.PermissionKey = @PermKey
  );

DECLARE @RolesGranted INT = @@ROWCOUNT;
PRINT '  [OK] Admin / system roles auto-granted: ' + CAST(@RolesGranted AS VARCHAR(10));

-- ----------------------------------------------------------------
-- Audit trail
-- ----------------------------------------------------------------
IF OBJECT_ID('dbo.RbacTenantAuditLogs', 'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.RbacTenantAuditLogs (UserId, Action, EntityType, EntityId, NewValue, CreatedAt)
    VALUES (NULL, 'Migration', 'RbacTenantRolePermissions', NULL,
            'Registered permission ' + @PermKey + '. Admin roles auto-granted: ' + CAST(@RolesGranted AS VARCHAR(10)) + '.',
            SYSUTCDATETIME());
    PRINT '  [OK] Audit log written.';
END

COMMIT TRANSACTION;

-- ----------------------------------------------------------------
-- Verification
-- ----------------------------------------------------------------
PRINT '';
PRINT '  VERIFICATION — roles that currently have this permission:';

SELECT
    r.Id            AS RoleId,
    r.Code          AS RoleCode,
    r.Name          AS RoleName,
    r.IsSystemRole,
    rp.PermissionKey,
    rp.IsGranted
FROM dbo.RbacTenantRolePermissions rp
INNER JOIN dbo.RbacTenantRoles r ON r.Id = rp.RoleId
WHERE rp.PermissionKey = @PermKey
ORDER BY r.IsSystemRole DESC, r.Code;

PRINT '================================================================';
PRINT '  DONE. Tenant admins can now toggle "inventory.item_list.view_summary"';
PRINT '  for other roles via the Role Permission page.';
PRINT '================================================================';
