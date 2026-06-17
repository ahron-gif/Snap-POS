/*
================================================================================
Script Name:    20260423_ChatbotMessageVisualizations.sql
Description:    Adds VisualizationsJson and SuggestedFollowUpsJson nullable
                columns to dbo.ChatMessages so chart data and follow-up
                suggestions persist across conversation reloads.

                Run against: each TENANT Database
                Idempotent:  safe to run multiple times
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '========================================================================';
PRINT 'Add VisualizationsJson + SuggestedFollowUpsJson to ChatMessages';
PRINT 'Database: ' + DB_NAME();
PRINT '========================================================================';

BEGIN TRY
    IF OBJECT_ID('dbo.ChatMessages', 'U') IS NULL
    BEGIN
        THROW 50000, N'dbo.ChatMessages does not exist in this database.', 1;
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ChatMessages') AND name = 'VisualizationsJson')
    BEGIN
        ALTER TABLE dbo.ChatMessages ADD VisualizationsJson NVARCHAR(MAX) NULL;
        PRINT '  [OK] Added column VisualizationsJson';
    END
    ELSE
    BEGIN
        PRINT '  [SKIP] Column VisualizationsJson already exists';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ChatMessages') AND name = 'SuggestedFollowUpsJson')
    BEGIN
        ALTER TABLE dbo.ChatMessages ADD SuggestedFollowUpsJson NVARCHAR(MAX) NULL;
        PRINT '  [OK] Added column SuggestedFollowUpsJson';
    END
    ELSE
    BEGIN
        PRINT '  [SKIP] Column SuggestedFollowUpsJson already exists';
    END

    PRINT '';
    PRINT '========================================================================';
    PRINT 'ChatMessages columns added - COMPLETED';
    PRINT '========================================================================';
END TRY
BEGIN CATCH
    PRINT 'ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO
