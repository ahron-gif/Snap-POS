-- AuditLog_MainDB_AddChangedFields.sql
-- Adds ChangedFields column to existing MasterAuditLogs table in Main DB
-- Run this against the Main (BackOffice) database

IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'MasterAuditLogs'
      AND COLUMN_NAME = 'ChangedFields'
)
BEGIN
    ALTER TABLE [dbo].[MasterAuditLogs]
    ADD [ChangedFields] NVARCHAR(4000) NULL;

    PRINT 'Added ChangedFields column to MasterAuditLogs';
END
ELSE
BEGIN
    PRINT 'ChangedFields column already exists on MasterAuditLogs';
END
GO
