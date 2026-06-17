-- ============================================================
-- Session Management Migration Script
-- Run against MainDB (RDTCloudDB)
-- ============================================================

-- 1. Add MaxConcurrentUsers to Customers table (0 = unlimited)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'MaxConcurrentUsers')
BEGIN
    ALTER TABLE Customers ADD MaxConcurrentUsers INT NOT NULL DEFAULT 0;
    PRINT 'Added MaxConcurrentUsers column to Customers table.';
END
GO

-- 2. Create UserSessions table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserSessions')
BEGIN
    CREATE TABLE UserSessions (
        SessionId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        UserId INT NOT NULL,
        CustomerId INT NULL,
        DeviceInfo NVARCHAR(500) NULL,
        IpAddress NVARCHAR(100) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        LastActivityAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        RevokedAt DATETIME2 NULL,
        RevokedReason NVARCHAR(50) NULL,
        RefreshTokenHash NVARCHAR(128) NULL,
        RefreshTokenExpiresAt DATETIME2 NULL,
        CONSTRAINT FK_UserSessions_AppUsers FOREIGN KEY (UserId) REFERENCES AppUsers(UserId),
        CONSTRAINT FK_UserSessions_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId)
    );
    PRINT 'Created UserSessions table.';
END
GO

-- 3. Create indexes on UserSessions
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserSessions_ActiveUserCustomer')
BEGIN
    CREATE UNIQUE INDEX IX_UserSessions_ActiveUserCustomer
        ON UserSessions (UserId, CustomerId)
        WHERE IsActive = 1;
    PRINT 'Created IX_UserSessions_ActiveUserCustomer index.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserSessions_CustomerActive')
BEGIN
    CREATE INDEX IX_UserSessions_CustomerActive
        ON UserSessions (CustomerId, IsActive)
        INCLUDE (UserId, CreatedAt, LastActivityAt, DeviceInfo, IpAddress)
        WHERE IsActive = 1;
    PRINT 'Created IX_UserSessions_CustomerActive index.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserSessions_SessionActive')
BEGIN
    CREATE INDEX IX_UserSessions_SessionActive
        ON UserSessions (SessionId, IsActive);
    PRINT 'Created IX_UserSessions_SessionActive index.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserSessions_RefreshToken')
BEGIN
    CREATE INDEX IX_UserSessions_RefreshToken
        ON UserSessions (RefreshTokenHash)
        WHERE RefreshTokenHash IS NOT NULL;
    PRINT 'Created IX_UserSessions_RefreshToken index.';
END
GO

-- 4. Create TemporaryLoginTokens table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TemporaryLoginTokens')
BEGIN
    CREATE TABLE TemporaryLoginTokens (
        TokenId UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        UserId INT NOT NULL,
        CustomerId INT NULL,
        TokenHash NVARCHAR(128) NOT NULL,
        DeviceInfo NVARCHAR(500) NULL,
        IpAddress NVARCHAR(100) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        ExpiresAt DATETIME2 NOT NULL,
        IsUsed BIT NOT NULL DEFAULT 0,
        ConflictType NVARCHAR(20) NOT NULL,
        ExistingSessionId UNIQUEIDENTIFIER NULL
    );
    PRINT 'Created TemporaryLoginTokens table.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TempTokens_Hash')
BEGIN
    CREATE INDEX IX_TempTokens_Hash
        ON TemporaryLoginTokens (TokenHash, IsUsed, ExpiresAt);
    PRINT 'Created IX_TempTokens_Hash index.';
END
GO

PRINT 'Session management migration completed successfully.';
