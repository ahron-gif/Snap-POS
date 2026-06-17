/*
================================================================================
Script:       20260611_TenantDB_SeedDefaultRoles.sql
Run against:  EACH TENANT (customer) database — NOT the master / RDTCloud DB.
================================================================================
Purpose:
  Idempotently seed the standard operational roles into dbo.RbacTenantRoles:
      PACKER, Cashier, PICKER, Store, Drivers, SALEASSOCIATE, SALES, BUYERS

  Roles are created EMPTY (no permission grants) and as normal, tenant-editable
  roles (IsSystemRole = 0). A tenant admin assigns permissions afterward.

Matching key:
  Code (UNIQUE index IX_RbacTenantRoles_Code). A role is inserted only when no
  role with the same Code already exists — so this is safe to re-run, and safe
  to run on tenants that already have some/all of these roles.

How to run for every tenant:
  Execute this script once per tenant database — in SSMS (one DB at a time) or
  via sqlcmd looped over your tenant connection list, e.g.:
      sqlcmd -S <server> -d <tenantDb> -U <user> -P <pass> ^
             -i 20260611_TenantDB_SeedDefaultRoles.sql

Options (edit the two DECLAREs below before running):
  @DryRun           1 = preview only (prints what WOULD change, writes nothing)
                    0 = apply (default)
  @CreatedByUserId  optional user id to stamp on CreatedByUserId (NULL = none)
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @DryRun          BIT = 0;     -- <<< set to 1 to preview without writing
DECLARE @CreatedByUserId INT = NULL;  -- <<< optional: who is running the backfill

------------------------------------------------------------------------------
-- SAFETY CHECK: make sure we are in a TENANT database that has the RBAC table.
-- Guards against accidentally running against the master DB or a DB that has
-- not had RBAC_TenantDB_Schema.sql applied yet. RETURN stops the batch before
-- any statement that touches the table is executed.
------------------------------------------------------------------------------
IF OBJECT_ID('dbo.RbacTenantRoles', 'U') IS NULL
BEGIN
    RAISERROR('ABORT: dbo.RbacTenantRoles not found in database [%s]. Run this against a TENANT database that has the RBAC schema, not the master DB.', 16, 1, 1);
    RETURN;
END

------------------------------------------------------------------------------
-- The standard role set. Code is the idempotency key (case-insensitive via the
-- DB's default collation). Edit this list to change the standard set.
------------------------------------------------------------------------------
DECLARE @DefaultRoles TABLE (
    Code        VARCHAR(50)   NOT NULL,
    Name        NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NULL
);

INSERT INTO @DefaultRoles (Code, Name, Description) VALUES
    ('PACKER',        'PACKER',        'Standard role: Packer.'),
    ('CASHIER',       'Cashier',       'Standard role: Cashier.'),
    ('PICKER',        'PICKER',        'Standard role: Picker.'),
    ('STORE',         'Store',         'Standard role: Store.'),
    ('DRIVERS',       'Drivers',       'Standard role: Drivers.'),
    ('SALEASSOCIATE', 'SALEASSOCIATE', 'Standard role: Sale Associate.'),
    ('SALES',         'SALES',         'Standard role: Sales.'),
    ('BUYERS',        'BUYERS',        'Standard role: Buyers.');

DECLARE @Total INT = (SELECT COUNT(*) FROM @DefaultRoles);

PRINT '================================================================';
PRINT '  SeedDefaultRoles on database: [' + DB_NAME() + ']';
PRINT '  Mode: ' + CASE WHEN @DryRun = 1 THEN 'DRY RUN (no changes)' ELSE 'APPLY' END;
PRINT '================================================================';

------------------------------------------------------------------------------
-- PRE-FLIGHT REPORT: per role, whether it will be inserted or already exists.
------------------------------------------------------------------------------
SELECT
    d.Code,
    d.Name,
    [Status] = CASE WHEN r.Id IS NULL THEN 'WILL INSERT' ELSE 'already exists' END
FROM @DefaultRoles d
LEFT JOIN dbo.RbacTenantRoles r ON r.Code = d.Code
ORDER BY CASE WHEN r.Id IS NULL THEN 0 ELSE 1 END, d.Code;

DECLARE @ToInsert INT =
    (SELECT COUNT(*) FROM @DefaultRoles d
     WHERE NOT EXISTS (SELECT 1 FROM dbo.RbacTenantRoles r WHERE r.Code = d.Code));

IF @DryRun = 1
BEGIN
    PRINT '  DRY RUN: ' + CAST(@ToInsert AS VARCHAR(10)) + ' of '
        + CAST(@Total AS VARCHAR(10)) + ' role(s) would be inserted. No changes made.';
    RETURN;
END

------------------------------------------------------------------------------
-- APPLY: insert only the roles whose Code is not already present.
------------------------------------------------------------------------------
BEGIN TRY
    BEGIN TRANSACTION;

    INSERT INTO dbo.RbacTenantRoles (Name, Code, Description, IsSystemRole, IsActive, CreatedAt, CreatedByUserId)
    SELECT d.Name, d.Code, d.Description, 0, 1, SYSUTCDATETIME(), @CreatedByUserId
    FROM @DefaultRoles d
    WHERE NOT EXISTS (SELECT 1 FROM dbo.RbacTenantRoles r WHERE r.Code = d.Code);

    DECLARE @Inserted INT = @@ROWCOUNT;

    COMMIT TRANSACTION;

    PRINT '  Inserted ' + CAST(@Inserted AS VARCHAR(10))
        + ' new role(s); the remaining ' + CAST(@Total - @Inserted AS VARCHAR(10))
        + ' already existed.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT '  ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;

------------------------------------------------------------------------------
-- VERIFICATION: the standard roles as they now exist in this tenant DB.
------------------------------------------------------------------------------
SELECT Id, Name, Code, IsSystemRole, IsActive, CreatedAt, CreatedByUserId
FROM dbo.RbacTenantRoles
WHERE Code IN ('PACKER','CASHIER','PICKER','STORE','DRIVERS','SALEASSOCIATE','SALES','BUYERS')
ORDER BY Code;
GO
