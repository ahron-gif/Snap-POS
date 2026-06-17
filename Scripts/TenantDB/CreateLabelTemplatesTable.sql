-- Create LabelTemplates table for storing label designer templates
-- Run this script on your Tenant database

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[LabelTemplates]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[LabelTemplates] (
        [Id] INT IDENTITY(1,1) NOT NULL,
        [StoreId] UNIQUEIDENTIFIER NULL,
        [Name] NVARCHAR(100) NOT NULL,
        [Description] NVARCHAR(500) NULL,
        [LabelType] SMALLINT NOT NULL,
        [PaperSize] SMALLINT NOT NULL,
        [LabelWidth] DECIMAL(10,4) NOT NULL,
        [LabelHeight] DECIMAL(10,4) NOT NULL,
        [ColumnsPerPage] INT NOT NULL DEFAULT 1,
        [RowsPerPage] INT NOT NULL DEFAULT 1,
        [MarginLeft] DECIMAL(10,4) NOT NULL DEFAULT 0,
        [MarginTop] DECIMAL(10,4) NOT NULL DEFAULT 0,
        [HorizontalGap] DECIMAL(10,4) NOT NULL DEFAULT 0,
        [VerticalGap] DECIMAL(10,4) NOT NULL DEFAULT 0,
        [DesignJson] NVARCHAR(MAX) NOT NULL,
        [IsDefault] BIT NOT NULL DEFAULT 0,
        [Status] SMALLINT NOT NULL DEFAULT 0,
        [UserCreated] UNIQUEIDENTIFIER NULL,
        [DateCreated] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [UserModified] UNIQUEIDENTIFIER NULL,
        [DateModified] DATETIME2 NOT NULL DEFAULT GETDATE(),

        CONSTRAINT [PK_LabelTemplates] PRIMARY KEY CLUSTERED ([Id] ASC)
    );

    -- Index for faster lookups by store and type
    CREATE NONCLUSTERED INDEX [IX_LabelTemplates_StoreId_LabelType_Status]
    ON [dbo].[LabelTemplates] ([StoreId], [LabelType], [Status]);

    -- Index for name searches
    CREATE NONCLUSTERED INDEX [IX_LabelTemplates_Name]
    ON [dbo].[LabelTemplates] ([Name]);

    PRINT 'LabelTemplates table created successfully.';
END
ELSE
BEGIN
    PRINT 'LabelTemplates table already exists.';
END
GO

-- Insert a sample default template
IF NOT EXISTS (SELECT 1 FROM [dbo].[LabelTemplates] WHERE [Name] = 'Default Item Label')
BEGIN
    INSERT INTO [dbo].[LabelTemplates]
    ([Name], [Description], [LabelType], [PaperSize], [LabelWidth], [LabelHeight],
     [ColumnsPerPage], [RowsPerPage], [MarginLeft], [MarginTop], [HorizontalGap], [VerticalGap],
     [DesignJson], [IsDefault], [Status])
    VALUES
    ('Default Item Label', 'Standard Avery 5160 label with barcode and price',
     1, 1, 2.625, 1.0,
     3, 10, 0.1875, 0.5, 0.125, 0,
     '{"elements":[{"id":"el_1","type":"text","x":5,"y":5,"width":140,"height":18,"rotation":0,"properties":{"text":"[Description]","fontFamily":"Arial","fontSize":11,"color":"#000000","textAlign":"left","dataField":"[Description]"}},{"id":"el_2","type":"barcode","x":5,"y":28,"width":130,"height":45,"rotation":0,"properties":{"barcodeType":"CODE128","barcodeValue":"1234567890","showText":true,"barcodeHeight":35,"dataField":"[BarcodeNumber]"}},{"id":"el_3","type":"text","x":140,"y":50,"width":60,"height":20,"rotation":0,"properties":{"text":"$9.99","fontFamily":"Arial","fontSize":14,"bold":true,"color":"#000000","textAlign":"right","dataField":"[Price]"}}]}',
     1, 0);

    PRINT 'Default template inserted.';
END
GO
