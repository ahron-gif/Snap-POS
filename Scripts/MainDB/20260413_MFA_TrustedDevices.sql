-- =============================================
-- Migration: MFA Trusted Devices + Preferred Method
-- Date: 2026-04-13
-- Description: Adds trusted devices table for "Remember this device" feature,
--              preferred MFA method column, and admin config for forced re-verification.
-- =============================================

-- 1. MfaTrustedDevices — stores hashed device tokens for skipping MFA on trusted devices
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MfaTrustedDevices]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[MfaTrustedDevices] (
        [Id]              INT            IDENTITY(1,1) NOT NULL,
        [UserId]          INT            NOT NULL,
        [DeviceTokenHash] NVARCHAR(128)  NOT NULL,        -- SHA-256 of raw token sent as cookie
        [DeviceInfo]      NVARCHAR(500)  NULL,             -- User-Agent for auditing
        [IpAddress]       NVARCHAR(100)  NULL,
        [CreatedAt]       DATETIME2(7)   NOT NULL CONSTRAINT [DF_MfaTrustedDevices_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [ExpiresAt]       DATETIME2(7)   NULL,             -- NULL = never expires; non-null = forced 30-day expiry
        [IsRevoked]       BIT            NOT NULL CONSTRAINT [DF_MfaTrustedDevices_IsRevoked] DEFAULT (0),
        CONSTRAINT [PK_MfaTrustedDevices] PRIMARY KEY CLUSTERED ([Id] ASC)
    );

    CREATE NONCLUSTERED INDEX [IX_MfaTrustedDevices_TokenHash]
        ON [dbo].[MfaTrustedDevices] ([DeviceTokenHash] ASC, [IsRevoked] ASC);

    CREATE NONCLUSTERED INDEX [IX_MfaTrustedDevices_UserId]
        ON [dbo].[MfaTrustedDevices] ([UserId] ASC);

    PRINT 'Created table: MfaTrustedDevices';
END
ELSE
    PRINT 'Table MfaTrustedDevices already exists - skipped.';
GO

-- 2. Add PreferredMfaMethod to UserMfaSettings
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[UserMfaSettings]') AND name = 'PreferredMfaMethod')
BEGIN
    ALTER TABLE [dbo].[UserMfaSettings]
        ADD [PreferredMfaMethod] NVARCHAR(20) NULL;  -- 'totp' | 'email' | NULL (auto-detect)

    PRINT 'Added column: UserMfaSettings.PreferredMfaMethod';
END
ELSE
    PRINT 'Column UserMfaSettings.PreferredMfaMethod already exists - skipped.';
GO

-- 3. GlobalConfig: MfaForce30DayReauth
IF NOT EXISTS (SELECT 1 FROM [dbo].[GlobalConfigs] WHERE [ConfigKey] = 'MfaForce30DayReauth')
BEGIN
    INSERT INTO [dbo].[GlobalConfigs] ([ConfigKey], [ConfigValue], [Description], [UpdatedAt])
    VALUES ('MfaForce30DayReauth', 'true', 'When true, remembered MFA devices expire after 30 days. When false, they never expire.', SYSUTCDATETIME());

    PRINT 'Inserted GlobalConfig: MfaForce30DayReauth = true';
END
ELSE
    PRINT 'GlobalConfig MfaForce30DayReauth already exists - skipped.';
GO

PRINT 'MFA Trusted Devices migration completed successfully.';
GO
