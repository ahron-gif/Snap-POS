/*
================================================================================
Script Name:    20260424_ChatMessageLinks.sql
Description:    Adds LinksJson nullable column to dbo.ChatMessages so entity
                drill-down links persist across conversation reloads.

                Run against: each TENANT Database
                Idempotent:  safe to run multiple times
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    IF OBJECT_ID('dbo.ChatMessages', 'U') IS NULL
    BEGIN
        THROW 50000, N'dbo.ChatMessages does not exist in this database.', 1;
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ChatMessages') AND name = 'LinksJson')
    BEGIN
        ALTER TABLE dbo.ChatMessages ADD LinksJson NVARCHAR(MAX) NULL;
        PRINT '  [OK] Added column LinksJson';
    END
    ELSE
    BEGIN
        PRINT '  [SKIP] Column LinksJson already exists';
    END
END TRY
BEGIN CATCH
    PRINT 'ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO
