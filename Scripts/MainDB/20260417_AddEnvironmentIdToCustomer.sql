-- Add EnvironmentId column to Customers table
-- Links each tenant/customer to a specific deployment environment (DEV/QA/UAT/PROD)

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Customers]')
      AND name = N'EnvironmentId'
)
BEGIN
    ALTER TABLE [dbo].[Customers]
        ADD [EnvironmentId] UNIQUEIDENTIFIER NULL;

    ALTER TABLE [dbo].[Customers]
        ADD CONSTRAINT [FK_Customers_Environments_EnvironmentId]
            FOREIGN KEY ([EnvironmentId])
            REFERENCES [dbo].[Environments] ([Id])
            ON DELETE SET NULL;

    CREATE NONCLUSTERED INDEX [IX_Customers_EnvironmentId]
        ON [dbo].[Customers] ([EnvironmentId]);

    -- Assign all existing customers to DEV environment by default
    -- Looks up the actual DEV GUID from the Environments table
    EXEC(N'
        DECLARE @devId UNIQUEIDENTIFIER;
        SELECT @devId = [Id] FROM [dbo].[Environments] WHERE [Code] = N''DEV'';
        IF @devId IS NOT NULL
            UPDATE [dbo].[Customers] SET [EnvironmentId] = @devId WHERE [EnvironmentId] IS NULL;
    ');

    PRINT 'Added EnvironmentId column to Customers table and assigned existing customers to DEV.';
END
ELSE
BEGIN
    PRINT 'EnvironmentId column already exists on Customers table — skipped.';
END
GO

UPDATE Customers SET EnvironmentID = 'A1B2C3D4-0001-4000-8000-000000000D01' WHERE CustomerId IN (25,62,70,85,86,88,89,90,91,92,93,94,95,101,102,103,105,106,107,108,109,110,111,112,113,114,115,116,118,119,121,126,131,132,133,134,138,169,141,142,144,147,149,150,153,154,155)
GO

-- Add IsActive column to Customers table (default true so all existing customers remain active)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Customers]')
      AND name = N'IsActive'
)
BEGIN
    ALTER TABLE [dbo].[Customers]
        ADD [IsActive] BIT NOT NULL
            CONSTRAINT [DF_Customers_IsActive] DEFAULT (1);

    PRINT 'Added IsActive column to Customers table (all existing customers set to active).';
END
ELSE
BEGIN
    PRINT 'IsActive column already exists on Customers table — skipped.';
END
GO
-- Use this only for Dev-QA
UPDATE Customers SET IsActive = 1
WHERE CustomerId IN (25,62,70,85,86,88,89,90,91,92,93,94,95,101,102,103,105,106,107,108,109,110,111,112,113,114,115,116,118,119,121,126,131,132,133,134,138,169,141,142,144,147,149,150,153,154,155)
GO

-- Use this only for PROD
UPDATE Customers SET IsActive = 1
GO