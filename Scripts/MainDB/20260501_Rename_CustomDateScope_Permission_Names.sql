/*
================================================================================
Script Name:    20260501_Rename_CustomDateScope_Permission_Names.sql
Description:    The four Custom Date Scope permissions were originally seeded
                with verbose Names — "View Custom Date Scope", "Create Custom
                Date Scope", etc. The Role Permissions modal renders each
                permission's Name underneath the screen header (which already
                says "Custom Date Scope"), so the words repeat:

                    Custom Date Scope
                       View Custom Date Scope
                       Create Custom Date Scope
                       Edit Custom Date Scope
                       Delete Custom Date Scope

                This script shortens them to just the action verb so the
                rendered list reads cleanly:

                    Custom Date Scope
                       View
                       Create
                       Edit
                       Delete

                Run against:    Master Database.
                Idempotent:     UPDATE is naturally re-runnable.
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '========================================================================';
PRINT 'Rename Custom Date Scope permission display names';
PRINT 'Database: ' + DB_NAME();
PRINT 'Time: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 121);
PRINT '========================================================================';

IF OBJECT_ID('dbo.Permissions', 'U') IS NULL
BEGIN
    DECLARE @errMsg NVARCHAR(500) =
        N'This script must be run against the Master DB. Current DB ''' + DB_NAME() + N''' does not have dbo.Permissions.';
    RAISERROR(@errMsg, 16, 1);
    RETURN;
END

BEGIN TRY
BEGIN TRANSACTION;

UPDATE dbo.Permissions SET Name = N'View'
WHERE PermissionKey = 'reports.setup.custom_date_scope.view'
  AND Name <> N'View';

UPDATE dbo.Permissions SET Name = N'Create'
WHERE PermissionKey = 'reports.setup.custom_date_scope.create'
  AND Name <> N'Create';

UPDATE dbo.Permissions SET Name = N'Edit'
WHERE PermissionKey = 'reports.setup.custom_date_scope.edit'
  AND Name <> N'Edit';

UPDATE dbo.Permissions SET Name = N'Delete'
WHERE PermissionKey = 'reports.setup.custom_date_scope.delete'
  AND Name <> N'Delete';

COMMIT TRANSACTION;

-- Verification output
SELECT PermissionKey, Name
FROM dbo.Permissions
WHERE PermissionKey LIKE 'reports.setup.custom_date_scope.%'
ORDER BY PermissionKey;

PRINT '';
PRINT '========================================================================';
PRINT 'Rename Custom Date Scope permission names - COMPLETED';
PRINT '========================================================================';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO
