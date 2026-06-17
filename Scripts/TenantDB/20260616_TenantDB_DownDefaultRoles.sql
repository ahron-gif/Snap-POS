/*
================================================================================
Script:       20260616_TenantDB_DownDefaultRoles.sql
Run against:  EACH TENANT (customer) database — NOT the master / RDTCloud DB.
================================================================================
Purpose:
  ROLLBACK / DOWN for 20260611_TenantDB_SeedDefaultRoles.sql.

  Removes the standard operational roles that the seed script inserted into
  dbo.RbacTenantRoles:
      PACKER, Cashier, PICKER, Store, Drivers, SALEASSOCIATE, SALES, BUYERS

  Use this before switching to the new Group Import feature, which re-creates a
  tenant's roles from its legacy dbo.Groups table instead of a hard-coded set.

Matching key:
  Code (the same idempotency key the seed used). Only NON-system roles
  (IsSystemRole = 0) with a matching Code are removed — system roles are never
  touched. Dependent rows (role↔permission grants and user↔role assignments)
  are deleted first so the roles can be removed without FK violations.

Safe to re-run: deleting an already-absent role is a no-op.

Options (edit the DECLARE below before running):
  @DryRun  1 = preview only (prints what WOULD be deleted, writes nothing)
           0 = apply (default)
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @DryRun BIT = 0;   -- <<< set to 1 to preview without writing

------------------------------------------------------------------------------
-- SAFETY CHECK: only run against a tenant DB that has the RBAC schema.
------------------------------------------------------------------------------
IF OBJECT_ID('dbo.RbacTenantRoles', 'U') IS NULL
BEGIN
    RAISERROR('ABORT: dbo.RbacTenantRoles not found in database [%s]. Run this against a TENANT database that has the RBAC schema, not the master DB.', 16, 1, 1);
    RETURN;
END

------------------------------------------------------------------------------
-- The standard role set that the seed inserted (idempotency key = Code).
------------------------------------------------------------------------------
DECLARE @DefaultRoles TABLE (Code VARCHAR(50) NOT NULL PRIMARY KEY);
INSERT INTO @DefaultRoles (Code) VALUES
    ('PACKER'), ('CASHIER'), ('PICKER'), ('STORE'),
    ('DRIVERS'), ('SALEASSOCIATE'), ('SALES'), ('BUYERS');

-- The role ids we are allowed to remove: matching Code AND non-system only.
DECLARE @Targets TABLE (Id INT NOT NULL PRIMARY KEY, Code VARCHAR(50), Name NVARCHAR(100));
INSERT INTO @Targets (Id, Code, Name)
SELECT r.Id, r.Code, r.Name
FROM dbo.RbacTenantRoles r
JOIN @DefaultRoles d ON d.Code = r.Code
WHERE r.IsSystemRole = 0;

PRINT '================================================================';
PRINT '  DownDefaultRoles on database: [' + DB_NAME() + ']';
PRINT '  Mode: ' + CASE WHEN @DryRun = 1 THEN 'DRY RUN (no changes)' ELSE 'APPLY' END;
PRINT '================================================================';

------------------------------------------------------------------------------
-- PRE-FLIGHT REPORT: the roles that will be deleted + dependent-row counts.
------------------------------------------------------------------------------
SELECT
    t.Id, t.Code, t.Name,
    PermissionGrants = (SELECT COUNT(*) FROM dbo.RbacTenantRolePermissions p WHERE p.RoleId = t.Id),
    UserAssignments  = (SELECT COUNT(*) FROM dbo.RbacTenantUserRoles u WHERE u.RoleId = t.Id)
FROM @Targets t
ORDER BY t.Code;

DECLARE @ToDelete INT = (SELECT COUNT(*) FROM @Targets);

IF @DryRun = 1
BEGIN
    PRINT '  DRY RUN: ' + CAST(@ToDelete AS VARCHAR(10)) + ' role(s) would be deleted. No changes made.';
    RETURN;
END

------------------------------------------------------------------------------
-- APPLY: remove dependent rows first, then the roles themselves.
------------------------------------------------------------------------------
BEGIN TRY
    BEGIN TRANSACTION;

    DELETE p FROM dbo.RbacTenantRolePermissions p JOIN @Targets t ON t.Id = p.RoleId;
    DECLARE @Perms INT = @@ROWCOUNT;

    DELETE u FROM dbo.RbacTenantUserRoles u JOIN @Targets t ON t.Id = u.RoleId;
    DECLARE @UserRoles INT = @@ROWCOUNT;

    DELETE r FROM dbo.RbacTenantRoles r JOIN @Targets t ON t.Id = r.Id;
    DECLARE @Roles INT = @@ROWCOUNT;

    COMMIT TRANSACTION;

    PRINT '  Deleted ' + CAST(@Roles AS VARCHAR(10)) + ' role(s), '
        + CAST(@Perms AS VARCHAR(10)) + ' permission grant(s), '
        + CAST(@UserRoles AS VARCHAR(10)) + ' user assignment(s).';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT '  ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;

------------------------------------------------------------------------------
-- VERIFICATION: the standard codes should no longer be present as non-system roles.
------------------------------------------------------------------------------
SELECT Id, Name, Code, IsSystemRole, IsActive
FROM dbo.RbacTenantRoles
WHERE Code IN ('PACKER','CASHIER','PICKER','STORE','DRIVERS','SALEASSOCIATE','SALES','BUYERS')
ORDER BY Code;
GO
