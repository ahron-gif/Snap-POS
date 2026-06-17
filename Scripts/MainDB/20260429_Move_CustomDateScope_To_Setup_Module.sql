/*
================================================================================
Script Name:    20260429_Move_CustomDateScope_To_Setup_Module.sql
Description:    Promotes Custom Date Scope to its own collapsible dropdown in
                the Role Permissions modal.

                Background: when seeded, the four
                  reports.setup.custom_date_scope.{view,create,edit,delete}
                permissions and the matching dbo.Screens row were attached to
                the existing "Reports" module. That meant in the Role
                Permissions matrix they appeared NESTED inside Reports.

                Per requirement, Custom Date Scope is a Setup feature and
                should be its own dropdown — a new top-level module group.

                This script:
                  1. Inserts a new module `setup` (Name = "Setup") if missing.
                  2. Reassigns the dbo.Screens row and the four dbo.Permissions
                     rows to that module.

                Permission keys and screen code are NOT changed — keeps
                backend [RequirePermission(...)] attributes valid and
                preserves any existing tenant ceiling / role grants.

                Run against:    Master Database.
                Idempotent:     safe to run multiple times.
                Reversible:     re-run with the original ModuleId by hand if
                                you want to revert.
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '========================================================================';
PRINT 'Move Custom Date Scope permissions to a new "Setup" module';
PRINT 'Database: ' + DB_NAME();
PRINT 'Time: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 121);
PRINT '========================================================================';

-- Sanity guard — must run on the master DB.
IF OBJECT_ID('dbo.Modules', 'U') IS NULL
   OR OBJECT_ID('dbo.Permissions', 'U') IS NULL
   OR OBJECT_ID('dbo.Screens', 'U') IS NULL
BEGIN
    DECLARE @errMsg NVARCHAR(500) =
        N'This script must be run against the Master DB (which holds dbo.Modules, dbo.Permissions, dbo.Screens). Current DB ''' + DB_NAME() + N''' does not have those tables.';
    RAISERROR(@errMsg, 16, 1);
    RETURN;
END

BEGIN TRY
BEGIN TRANSACTION;

-- ==========================================================
-- 1. Ensure the "Setup" module exists.
-- ==========================================================
IF NOT EXISTS (SELECT 1 FROM dbo.Modules WHERE Code = 'setup')
BEGIN
    -- Place after the last existing module (or at sortOrder 9 — Reports is 8).
    DECLARE @nextSort INT = (
        SELECT ISNULL(MAX(SortOrder), 0) + 1 FROM dbo.Modules
    );

    INSERT INTO dbo.Modules (Code, ModuleName, PageURL, Icon, SortOrder, IsActive)
    VALUES ('setup', N'Setup', '/setup', 'BoxCubeIcon', @nextSort, 1);

    PRINT '  [OK] Module "setup" inserted (SortOrder = ' + CONVERT(VARCHAR(10), @nextSort) + ').';
END
ELSE
BEGIN
    -- Make sure it's active in case someone soft-deleted it.
    UPDATE dbo.Modules
    SET IsActive = 1
    WHERE Code = 'setup' AND IsActive <> 1;
    PRINT '  [SKIP] Module "setup" already exists.';
END

DECLARE @SetupModuleId INT = (SELECT ModuleId FROM dbo.Modules WHERE Code = 'setup');

IF @SetupModuleId IS NULL
BEGIN
    RAISERROR('Failed to resolve Setup module id after insert.', 16, 1);
END

-- ==========================================================
-- 2. Reassign the screen.
-- ==========================================================
UPDATE dbo.Screens
SET ModuleId = @SetupModuleId
WHERE Code = 'reports.setup.custom_date_scope'
  AND ModuleId <> @SetupModuleId;

IF @@ROWCOUNT > 0
    PRINT '  [OK] Screen reports.setup.custom_date_scope reassigned to Setup module.';
ELSE
    PRINT '  [SKIP] Screen already in Setup module (or screen missing).';

-- ==========================================================
-- 3. Reassign the four permissions.
-- ==========================================================
UPDATE dbo.Permissions
SET ModuleId = @SetupModuleId
WHERE PermissionKey LIKE 'reports.setup.custom_date_scope.%'
  AND ModuleId <> @SetupModuleId;

DECLARE @permsMoved INT = @@ROWCOUNT;
PRINT '  [OK] ' + CONVERT(VARCHAR(10), @permsMoved) + ' permission(s) reassigned to Setup module.';

COMMIT TRANSACTION;

PRINT '';
PRINT '  After this script runs, the Role Permissions modal will show:';
PRINT '    [▼ Setup]  ← new collapsible dropdown';
PRINT '       Custom Date Scope';
PRINT '          ☐ View / Create / Edit / Delete';
PRINT '';
PRINT '  Existing tenant ceiling rows and role grants are preserved (we only';
PRINT '  changed the ModuleId, not the PermissionId or PermissionKey).';
PRINT '';
PRINT '========================================================================';
PRINT 'Move Custom Date Scope to Setup module - COMPLETED';
PRINT '========================================================================';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO
