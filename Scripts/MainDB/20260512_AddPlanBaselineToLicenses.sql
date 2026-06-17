SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.CustomerAppLicenses', N'U') IS NULL
BEGIN
    PRINT 'dbo.CustomerAppLicenses not found. Aborting.';
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.CustomerAppLicenses') AND name = N'IsPlanBaseline')
BEGIN
    ALTER TABLE dbo.CustomerAppLicenses
        ADD IsPlanBaseline BIT NOT NULL CONSTRAINT DF_CustomerAppLicenses_IsPlanBaseline DEFAULT (0);
    PRINT 'Added dbo.CustomerAppLicenses.IsPlanBaseline column.';
END
ELSE
BEGIN
    PRINT 'dbo.CustomerAppLicenses.IsPlanBaseline already exists - skipped.';
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_CustomerAppLicense_BaselineLookup'
      AND object_id = OBJECT_ID(N'dbo.CustomerAppLicenses')
)
BEGIN
    CREATE INDEX IX_CustomerAppLicense_BaselineLookup
        ON dbo.CustomerAppLicenses (CustomerId, AppId, IsPlanBaseline, BillingEndsAt);
    PRINT 'Added IX_CustomerAppLicense_BaselineLookup index.';
END
ELSE
BEGIN
    PRINT 'IX_CustomerAppLicense_BaselineLookup already exists - skipped.';
END;

PRINT 'Plan-baseline migration complete.';
