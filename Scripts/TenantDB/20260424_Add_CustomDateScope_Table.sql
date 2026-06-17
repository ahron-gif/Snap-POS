/*
================================================================================
Script Name:    20260424_Add_CustomDateScope_Table.sql
Description:    Tenant-DB table for named date-range presets used by Tax Collected
                (and any future report) "More" date scope dropdown.
                Run against: Tenant Database.
                Idempotent.
================================================================================
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CustomDateScope' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CustomDateScope (
        CustomDateScopeID UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_CustomDateScope_Id DEFAULT (NEWID())
            CONSTRAINT PK_CustomDateScope PRIMARY KEY,
        Name             NVARCHAR(100) NOT NULL,
        Description      NVARCHAR(500) NULL,
        FromDate         DATE NOT NULL,
        ToDate           DATE NOT NULL,
        SortColumn       NVARCHAR(100) NULL,
        SortDirection    NVARCHAR(4)   NULL,
        IsActive         BIT NOT NULL CONSTRAINT DF_CustomDateScope_IsActive DEFAULT (1),
        CreatedBy        UNIQUEIDENTIFIER NULL,
        CreatedAt        DATETIME2 NOT NULL CONSTRAINT DF_CustomDateScope_CreatedAt DEFAULT (SYSUTCDATETIME()),
        ModifiedBy       UNIQUEIDENTIFIER NULL,
        ModifiedAt       DATETIME2 NULL,
        CONSTRAINT CK_CustomDateScope_DateOrder CHECK (FromDate <= ToDate),
        CONSTRAINT CK_CustomDateScope_SortDir CHECK (SortDirection IN ('asc','desc') OR SortDirection IS NULL)
    );

    CREATE UNIQUE INDEX UX_CustomDateScope_Name
        ON dbo.CustomDateScope(Name)
        WHERE IsActive = 1;

    CREATE INDEX IX_CustomDateScope_IsActive
        ON dbo.CustomDateScope(IsActive);

    PRINT '  [OK] CustomDateScope table created.';
END
ELSE
BEGIN
    PRINT '  [SKIP] CustomDateScope already exists.';
END
GO
