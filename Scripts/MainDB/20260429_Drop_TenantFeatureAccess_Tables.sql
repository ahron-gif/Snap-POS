/*
================================================================================
Script Name:    20260429_Drop_TenantFeatureAccess_Tables.sql
Description:    Removes the parallel "Tenant Feature Access" Super-Admin grant
                mechanism. Custom Date Scope and any other previously-grantable
                features now flow through the standard role-based RBAC path:

                  Super Admin → Permission Ceiling
                          ↓ enables permission for the tenant
                  Tenant Admin → User Roles → Role Permissions modal
                          ↓ ticks View / Create / Edit / Delete on a role
                  User assigned to that role inherits the permissions

                The matching backend code (TenantFeatureAccessController,
                TenantFeatureAccessService, related DTOs/entities) and the
                Super-Admin "Tenant Feature Access" page have already been
                deleted. The EffectivePermissionBuilder no longer reads from
                these tables. This script drops the now-unused schema:
                  - dbo.TenantUserFeatureGrants  (per-user grants)
                  - dbo.TenantFeatureAutoGrants  (tenant-wide auto-grants)
                  - dbo.Permissions.IsSuperAdminGrantable column

                The four reports.setup.custom_date_scope.* permissions and
                their dbo.Screens row are KEPT — they're now standard role-
                grantable permissions.

                Run against:    Master Database (the one that holds
                                dbo.Permissions, dbo.Tenants, etc.)
                Idempotent:     safe to run multiple times.
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '========================================================================';
PRINT 'Drop Tenant Feature Access tables + IsSuperAdminGrantable column';
PRINT 'Database: ' + DB_NAME();
PRINT 'Time: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 121);
PRINT '========================================================================';

-- Sanity check — this script targets the master DB. Bail loudly if it's
-- pointed at a tenant DB that doesn't have dbo.Permissions.
IF OBJECT_ID('dbo.Permissions', 'U') IS NULL
BEGIN
    DECLARE @errMsg NVARCHAR(500) =
        N'This script must be run against the Master DB. Current DB ''' + DB_NAME() + N''' does not have dbo.Permissions.';
    RAISERROR(@errMsg, 16, 1);
    RETURN;
END

BEGIN TRY
BEGIN TRANSACTION;

-- ==========================================================
-- 1. Drop dbo.TenantUserFeatureGrants
-- ==========================================================
IF OBJECT_ID('dbo.TenantUserFeatureGrants', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.TenantUserFeatureGrants;
    PRINT '  [OK] dbo.TenantUserFeatureGrants dropped.';
END
ELSE
BEGIN
    PRINT '  [SKIP] dbo.TenantUserFeatureGrants does not exist.';
END

-- ==========================================================
-- 2. Drop dbo.TenantFeatureAutoGrants
-- ==========================================================
IF OBJECT_ID('dbo.TenantFeatureAutoGrants', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.TenantFeatureAutoGrants;
    PRINT '  [OK] dbo.TenantFeatureAutoGrants dropped.';
END
ELSE
BEGIN
    PRINT '  [SKIP] dbo.TenantFeatureAutoGrants does not exist.';
END

-- ==========================================================
-- 3. Drop dbo.Permissions.IsSuperAdminGrantable column
--    (and its DEFAULT constraint, which has to go first).
-- ==========================================================
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Permissions') AND name = 'IsSuperAdminGrantable'
)
BEGIN
    DECLARE @df sysname;
    SELECT @df = dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id
                      AND c.column_id = dc.parent_column_id
    WHERE c.object_id = OBJECT_ID('dbo.Permissions')
      AND c.name = 'IsSuperAdminGrantable';

    IF @df IS NOT NULL
    BEGIN
        DECLARE @sqlDropDF NVARCHAR(MAX) = N'ALTER TABLE dbo.Permissions DROP CONSTRAINT ' + QUOTENAME(@df);
        EXEC sp_executesql @sqlDropDF;
        PRINT '  [OK] DEFAULT constraint ' + @df + ' dropped.';
    END

    ALTER TABLE dbo.Permissions DROP COLUMN IsSuperAdminGrantable;
    PRINT '  [OK] dbo.Permissions.IsSuperAdminGrantable column dropped.';
END
ELSE
BEGIN
    PRINT '  [SKIP] dbo.Permissions.IsSuperAdminGrantable does not exist.';
END

COMMIT TRANSACTION;

PRINT '';
PRINT '  The four reports.setup.custom_date_scope.* permissions remain in';
PRINT '  dbo.Permissions and are now grantable via the standard Role';
PRINT '  Permissions modal once Super Admin enables them in each tenant''s';
PRINT '  Permission Ceiling.';
PRINT '';
PRINT '========================================================================';
PRINT 'Drop Tenant Feature Access - COMPLETED';
PRINT '========================================================================';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO
