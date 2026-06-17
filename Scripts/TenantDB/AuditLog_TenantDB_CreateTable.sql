-- AuditLog_TenantDB_CreateTable.sql
-- Creates the AuditLogs table in every Tenant database
-- Run this against each Tenant database

IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'AuditLogs'
      AND TABLE_SCHEMA = 'dbo'
)
BEGIN
    CREATE TABLE [dbo].[AuditLogs] (
        [Id]            BIGINT          IDENTITY(1,1) NOT NULL,
        [UserId]        INT             NULL,
        [Action]        NVARCHAR(50)    NOT NULL,
        [EntityType]    NVARCHAR(200)   NOT NULL,
        [EntityId]      NVARCHAR(100)   NULL,
        [OldValue]      NVARCHAR(MAX)   NULL,
        [NewValue]      NVARCHAR(MAX)   NULL,
        [ChangedFields] NVARCHAR(4000)  NULL,
        [IpAddress]     NVARCHAR(50)    NULL,
        [CreatedAt]     DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_AuditLogs] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE NONCLUSTERED INDEX [IX_AuditLogs_CreatedAt]
        ON [dbo].[AuditLogs] ([CreatedAt]);

    CREATE NONCLUSTERED INDEX [IX_AuditLogs_EntityType_EntityId]
        ON [dbo].[AuditLogs] ([EntityType], [EntityId]);

    CREATE NONCLUSTERED INDEX [IX_AuditLogs_UserId]
        ON [dbo].[AuditLogs] ([UserId]);

    PRINT 'Created AuditLogs table with indexes';
END
ELSE
BEGIN
    PRINT 'AuditLogs table already exists';
END
GO
