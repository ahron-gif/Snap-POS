-- =============================================================================
-- 20260501_AddBackOfficeApp.sql
--
-- Adds the Back Office (Desktop) app to dbo.Apps as AppId 5.
-- Idempotent — safe to re-run. Detects which column is identity.
--
-- After this runs, the catalog will be:
--   1 = Web App
--   2 = POS Terminals
--   3 = Picking Devices
--   4 = Price Checkers
--   5 = Back Office (Desktop)   <-- new
--
-- Run against MainDB.
-- =============================================================================

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.Apps', N'U') IS NULL
BEGIN
    PRINT 'dbo.Apps not found. Aborting.';
    RETURN;
END;

IF EXISTS (SELECT 1 FROM dbo.Apps WHERE AppId = 5)
BEGIN
    PRINT 'AppId 5 already exists - skipping insert.';
END
ELSE
BEGIN
    DECLARE @AppIdIsIdentity INT = COLUMNPROPERTY(OBJECT_ID(N'dbo.Apps'), N'AppId', N'IsIdentity');

    IF @AppIdIsIdentity = 1
    BEGIN
        SET IDENTITY_INSERT dbo.Apps ON;
        INSERT INTO dbo.Apps (AppId, AppName) VALUES (5, N'Back Office (Desktop App)');
        SET IDENTITY_INSERT dbo.Apps OFF;
    END
    ELSE
    BEGIN
        INSERT INTO dbo.Apps (AppId, AppName) VALUES (5, N'Back Office (Desktop App)');
    END

    PRINT 'Inserted AppId 5 -> Back Office.';
END;

-- Show current catalog
PRINT '';
PRINT 'Current dbo.Apps catalog:';
SELECT AppId, AppName, Comment FROM dbo.Apps ORDER BY AppId;

PRINT 'Back Office app seed complete.';