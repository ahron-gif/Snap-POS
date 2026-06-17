-- =============================================
-- Migration: Add PasswordHash column and PasswordResetTokens table
-- Date: 2026-03-30
-- Description: Adds BCrypt password hash support and forgot password token storage
-- =============================================

-- 1. Add PasswordHash column to AppUsers (Main DB)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AppUsers') AND name = 'PasswordHash')
BEGIN
    ALTER TABLE [dbo].[AppUsers]
    ADD [PasswordHash] NVARCHAR(MAX) NULL;
    PRINT 'Added PasswordHash column to AppUsers';
END
GO

-- 2. Add PasswordHash column to Users (Tenant DB) - Run this against each tenant database
-- IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PasswordHash')
-- BEGIN
--     ALTER TABLE [dbo].[Users]
--     ADD [PasswordHash] NVARCHAR(MAX) NULL;
--     PRINT 'Added PasswordHash column to Users (Tenant)';
-- END
-- GO

-- 3. Create PasswordResetTokens table (Main DB)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('PasswordResetTokens') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[PasswordResetTokens] (
        [Id]         INT            IDENTITY(1,1) NOT NULL,
        [UserId]     INT            NOT NULL,
        [TokenHash]  NVARCHAR(128)  NOT NULL,
        [CreatedAt]  DATETIME2(7)   NOT NULL DEFAULT SYSUTCDATETIME(),
        [ExpiresAt]  DATETIME2(7)   NOT NULL,
        [IsUsed]     BIT            NOT NULL DEFAULT 0,
        CONSTRAINT [PK_PasswordResetTokens] PRIMARY KEY CLUSTERED ([Id] ASC)
    );

    CREATE NONCLUSTERED INDEX [IX_PasswordResetTokens_Hash]
        ON [dbo].[PasswordResetTokens] ([TokenHash], [IsUsed], [ExpiresAt]);

    PRINT 'Created PasswordResetTokens table';
END
GO

-- NOTE: Existing users' PasswordHash will be populated lazily on next login.
-- BCrypt hashing cannot be done in SQL; the application handles migration automatically.
