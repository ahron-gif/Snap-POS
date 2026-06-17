-- =============================================
-- Migration: MFA Tables
-- Date: 2026-03-30
-- Description: Adds all tables required for Multi-Factor Authentication
--              (TOTP Authenticator App + Email OTP + Recovery Codes)
-- Tables: UserMfaSettings, MfaChallenges, MfaOtpCodes, MfaAttemptLogs
-- =============================================

-- 1. UserMfaSettings — one row per user, stores TOTP secret + MFA state
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserMfaSettings]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[UserMfaSettings] (
        [Id]                   INT            IDENTITY(1,1) NOT NULL,
        [UserId]               INT            NOT NULL,
        [IsMfaEnabled]         BIT            NOT NULL CONSTRAINT [DF_UserMfaSettings_IsMfaEnabled] DEFAULT (0),
        [TotpSecretEncrypted]  NVARCHAR(MAX)  NULL,        -- AES-256 encrypted Base64 (IV prepended)
        [IsTotpSetup]          BIT            NOT NULL CONSTRAINT [DF_UserMfaSettings_IsTotpSetup] DEFAULT (0),
        [IsEmailOtpEnabled]    BIT            NOT NULL CONSTRAINT [DF_UserMfaSettings_IsEmailOtpEnabled] DEFAULT (0),
        [RecoveryCodes]        NVARCHAR(MAX)  NULL,        -- JSON array of BCrypt hashes
        [CreatedAt]            DATETIME2(7)   NOT NULL CONSTRAINT [DF_UserMfaSettings_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt]            DATETIME2(7)   NOT NULL CONSTRAINT [DF_UserMfaSettings_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_UserMfaSettings] PRIMARY KEY CLUSTERED ([Id] ASC)
    );

    CREATE UNIQUE NONCLUSTERED INDEX [IX_UserMfaSettings_UserId]
        ON [dbo].[UserMfaSettings] ([UserId] ASC);

    PRINT 'Created table: UserMfaSettings';
END
ELSE
    PRINT 'Table UserMfaSettings already exists - skipped.';
GO

-- 2. MfaChallenges — short-lived challenge tokens issued after successful password auth
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MfaChallenges]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[MfaChallenges] (
        [Id]                   INT            IDENTITY(1,1) NOT NULL,
        [UserId]               INT            NOT NULL,
        [ChallengeTokenHash]   NVARCHAR(128)  NOT NULL,    -- SHA-256 of raw token sent to client
        [MfaMethod]            NVARCHAR(20)   NOT NULL,    -- 'totp' | 'email' | 'recovery'
        [CreatedAt]            DATETIME2(7)   NOT NULL CONSTRAINT [DF_MfaChallenges_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [ExpiresAt]            DATETIME2(7)   NOT NULL,
        [IsUsed]               BIT            NOT NULL CONSTRAINT [DF_MfaChallenges_IsUsed] DEFAULT (0),
        CONSTRAINT [PK_MfaChallenges] PRIMARY KEY CLUSTERED ([Id] ASC)
    );

    -- Fast lookup by token hash during MFA verification
    CREATE NONCLUSTERED INDEX [IX_MfaChallenges_Hash]
        ON [dbo].[MfaChallenges] ([ChallengeTokenHash] ASC, [IsUsed] ASC, [ExpiresAt] ASC);

    PRINT 'Created table: MfaChallenges';
END
ELSE
    PRINT 'Table MfaChallenges already exists - skipped.';
GO

-- 3. MfaOtpCodes — email OTP codes (6-digit, stored as SHA-256 hash)
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MfaOtpCodes]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[MfaOtpCodes] (
        [Id]           INT            IDENTITY(1,1) NOT NULL,
        [UserId]       INT            NOT NULL,
        [CodeHash]     NVARCHAR(128)  NOT NULL,            -- SHA-256 of the 6-digit code
        [CreatedAt]    DATETIME2(7)   NOT NULL CONSTRAINT [DF_MfaOtpCodes_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [ExpiresAt]    DATETIME2(7)   NOT NULL,
        [IsUsed]       BIT            NOT NULL CONSTRAINT [DF_MfaOtpCodes_IsUsed] DEFAULT (0),
        [AttemptCount] INT            NOT NULL CONSTRAINT [DF_MfaOtpCodes_AttemptCount] DEFAULT (0),
        CONSTRAINT [PK_MfaOtpCodes] PRIMARY KEY CLUSTERED ([Id] ASC)
    );

    -- Fast lookup for active OTP per user
    CREATE NONCLUSTERED INDEX [IX_MfaOtpCodes_UserActive]
        ON [dbo].[MfaOtpCodes] ([UserId] ASC, [IsUsed] ASC, [ExpiresAt] ASC);

    PRINT 'Created table: MfaOtpCodes';
END
ELSE
    PRINT 'Table MfaOtpCodes already exists - skipped.';
GO

-- 4. MfaAttemptLogs — audit trail and rate-limiting source
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MfaAttemptLogs]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[MfaAttemptLogs] (
        [Id]           INT            IDENTITY(1,1) NOT NULL,
        [UserId]       INT            NOT NULL,
        [AttemptType]  NVARCHAR(20)   NOT NULL,            -- 'totp' | 'email_otp' | 'recovery' | 'setup'
        [IsSuccess]    BIT            NOT NULL,
        [IpAddress]    NVARCHAR(100)  NULL,
        [CreatedAt]    DATETIME2(7)   NOT NULL CONSTRAINT [DF_MfaAttemptLogs_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_MfaAttemptLogs] PRIMARY KEY CLUSTERED ([Id] ASC)
    );

    -- Fast rate-limit query: count recent failures per user
    CREATE NONCLUSTERED INDEX [IX_MfaAttemptLog_UserCreatedAt]
        ON [dbo].[MfaAttemptLogs] ([UserId] ASC, [CreatedAt] ASC);

    PRINT 'Created table: MfaAttemptLogs';
END
ELSE
    PRINT 'Table MfaAttemptLogs already exists - skipped.';
GO

PRINT 'MFA Schema migration completed successfully.';
GO
