SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.CustomerDevices', N'U') IS NULL
BEGIN
    PRINT 'dbo.CustomerDevices not found. Aborting.';
    RETURN;
END;

IF OBJECT_ID(N'dbo.CustomerAppLicenses', N'U') IS NULL
BEGIN
    PRINT 'dbo.CustomerAppLicenses not found - run 20260501_CreateCustomerAppLicenses.sql first. Aborting.';
    RETURN;
END;

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_CustomerDevices_License')
BEGIN
    ALTER TABLE dbo.CustomerDevices DROP CONSTRAINT FK_CustomerDevices_License;
    PRINT 'Dropped existing FK_CustomerDevices_License (will be re-added).';
END;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CustomerDevices') AND name = N'LicenseKey')
BEGIN
    ALTER TABLE dbo.CustomerDevices DROP COLUMN LicenseKey;
    PRINT 'Dropped legacy LicenseKey column.';
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CustomerDevices') AND name = N'LicenseId')
BEGIN
    ALTER TABLE dbo.CustomerDevices ADD LicenseId INT NULL;
    PRINT 'Added dbo.CustomerDevices.LicenseId column.';
END
ELSE
BEGIN
    PRINT 'dbo.CustomerDevices.LicenseId already exists - skipped.';
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_CustomerDevices_License')
BEGIN
    ALTER TABLE dbo.CustomerDevices
        ADD CONSTRAINT FK_CustomerDevices_License
        FOREIGN KEY (LicenseId) REFERENCES dbo.CustomerAppLicenses(Id)
        ON DELETE SET NULL;
    PRINT 'Added FK_CustomerDevices_License.';
END
ELSE
BEGIN
    PRINT 'FK_CustomerDevices_License already exists - skipped.';
END;

DECLARE @AdvancedUIdMaxLen INT = (
    SELECT max_length FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.CustomerDevices') AND name = N'AdvancedUId'
);

IF @AdvancedUIdMaxLen = -1 OR @AdvancedUIdMaxLen > 900
BEGIN
    IF EXISTS (SELECT 1 FROM dbo.CustomerDevices WHERE LEN(AdvancedUId) > 255)
    BEGIN
        PRINT 'AdvancedUId has values longer than 255 chars - cannot resize for indexing. Index creation skipped.';
    END
    ELSE
    BEGIN
        ALTER TABLE dbo.CustomerDevices ALTER COLUMN AdvancedUId NVARCHAR(255) NOT NULL;
        PRINT 'Resized AdvancedUId to NVARCHAR(255) for indexing.';
    END;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CustomerDevices_CustAppUId' AND object_id = OBJECT_ID(N'dbo.CustomerDevices'))
BEGIN
    DECLARE @ResizedLen INT = (
        SELECT max_length FROM sys.columns
        WHERE object_id = OBJECT_ID(N'dbo.CustomerDevices') AND name = N'AdvancedUId'
    );

    IF @ResizedLen <> -1 AND @ResizedLen <= 900
    BEGIN
        CREATE INDEX IX_CustomerDevices_CustAppUId
            ON dbo.CustomerDevices (CustomerId, AppId, AdvancedUId);
        PRINT 'Added IX_CustomerDevices_CustAppUId index.';
    END
    ELSE
    BEGIN
        PRINT 'AdvancedUId still too large - falling back to (CustomerId, AppId) index with AdvancedUId as INCLUDE.';
        CREATE INDEX IX_CustomerDevices_CustAppUId
            ON dbo.CustomerDevices (CustomerId, AppId)
            INCLUDE (AdvancedUId);
    END;
END
ELSE
BEGIN
    PRINT 'IX_CustomerDevices_CustAppUId already exists - skipped.';
END;

IF OBJECT_ID(N'dbo.BillingConfigs', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.BillingConfigs WHERE ConfigKey = N'device_inactive_days')
BEGIN
    INSERT INTO dbo.BillingConfigs (ConfigKey, ConfigValue, Description, UpdatedAt)
    VALUES (N'device_inactive_days', N'30',
            N'Days since CustomerDevices.LastLoginDate after which a device frees its license slot for new registrations.',
            SYSUTCDATETIME());
    PRINT 'Seeded device_inactive_days = 30.';
END
ELSE
BEGIN
    PRINT 'device_inactive_days config already exists or BillingConfigs missing - skipped.';
END;

PRINT 'Device registration link migration complete.';
