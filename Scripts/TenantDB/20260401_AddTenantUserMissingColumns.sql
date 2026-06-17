-- =============================================================================
-- Migration: 20260401_AddTenantUserMissingColumns
-- Target:    TENANT database (run against each tenant DB, e.g. the SmartKart DB)
-- Description: Add PasswordHash and IsSuperAdmin columns to the Users table.
--              These properties exist on the C# User entity but were neverxggr
--              present in the actual DB, causing EF Core to fail on SELECT.
-- =============================================================================

-- ─── PasswordHash ─────────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'PasswordHash'
)
BEGIN
    ALTER TABLE [dbo].[Users]
        ADD [PasswordHash] NVARCHAR(255) NULL;

    PRINT 'Added PasswordHash column to Users.';
END
ELSE
BEGIN
    PRINT 'PasswordHash column already exists on Users — skipped.';
END

-- ─── IsSuperAdmin ─────────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'IsSuperAdmin'
)
BEGIN
    ALTER TABLE [dbo].[Users]
        ADD [IsSuperAdmin] BIT NULL;

    PRINT 'Added IsSuperAdmin column to Users.';
END
ELSE
BEGIN
    PRINT 'IsSuperAdmin column already exists on Users — skipped.';
END
