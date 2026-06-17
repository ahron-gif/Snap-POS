/*
================================================================================
Script Name:    20260607_CreateDefaultGridColumnAccessTable.sql
Description:    Creates the DefaultGridColumnAccess table in the MAIN (master)
                database. Stores the global, cross-tenant default column
                configuration for grid-based screens. This is the baseline
                applied to every tenant that has not saved its own configuration.

                Read-time precedence (GridColumnAccessService.GetEffectiveForUserAsync):
                    user override (tenant DB) -> tenant default (tenant DB) ->
                    THIS global default (main DB) -> page's natural column defaults.

Table:          dbo.DefaultGridColumnAccess
Database:       Main (Master) Database

Created:        2026-06-07
Version:        1.0

Usage:
    Run this script ONCE on the MAIN database. There is no UserId or CustomerId
    here -- a row is keyed by (GridId, Field) and is shared by all tenants.

Columns:
    - Id:             Primary key (auto-increment)
    - GridId:         Grid identifier (must match gridId in frontend GRID_REGISTRY)
    - Field:          Column field name (matches ServerGrid Column.field)
    - AllowedToView:  1 = column visible by default; 0 = stripped for inheritors
    - DisplayName:    Optional default header override (NULL = built-in header)
    - SortOrder:      Optional default column position (NULL = natural position)
    - Width:          Optional default pixel width (NULL = natural width)
    - AggregateType:  Optional default footer aggregate (sum/avg/count/min/max)
    - DateCreated:    When the default row was first created
    - DateModified:   When the default row was last updated
    - ModifiedBy:     Super Admin user who last saved the default

Related Files:
    - Backend Entity:     BackOffice.Domain/Entities/Main/DefaultGridColumnAccess.cs
    - DbContext Mapping:  BackOffice.Infrastructure/DbContexts/Main/MainDBContext.GridColumnAccess.cs
    - Backend Service:    BackOffice.Persistence/Services/Tenant/GridColumnAccessService.cs
    - Backend Controller: BackOffice.Api/Controllers/GridColumnAccessController.cs
    - Frontend Service:   BackOffice.Presentation/src/services/gridColumnAccessService.ts
================================================================================
*/

-- Check if table exists before creating
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DefaultGridColumnAccess]') AND type in (N'U'))
BEGIN
    PRINT 'Creating table [dbo].[DefaultGridColumnAccess]...';

    CREATE TABLE [dbo].[DefaultGridColumnAccess] (
        [Id]             INT IDENTITY(1,1) NOT NULL,
        [GridId]         NVARCHAR(100) NOT NULL,
        [Field]          NVARCHAR(100) NOT NULL,
        [AllowedToView]  BIT NOT NULL CONSTRAINT [DF_DefaultGridColumnAccess_AllowedToView] DEFAULT (1),
        [DisplayName]    NVARCHAR(100) NULL,
        [SortOrder]      INT NULL,
        [Width]          INT NULL,
        [AggregateType]  NVARCHAR(50) NULL,
        [DateCreated]    DATETIME2(7) NOT NULL CONSTRAINT [DF_DefaultGridColumnAccess_DateCreated]  DEFAULT (GETDATE()),
        [DateModified]   DATETIME2(7) NOT NULL CONSTRAINT [DF_DefaultGridColumnAccess_DateModified] DEFAULT (GETDATE()),
        [ModifiedBy]     UNIQUEIDENTIFIER NULL,

        CONSTRAINT [PK_DefaultGridColumnAccess] PRIMARY KEY CLUSTERED ([Id] ASC)
    );

    PRINT 'Table [dbo].[DefaultGridColumnAccess] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[DefaultGridColumnAccess] already exists. Skipping creation.';
END
GO

-- Create unique composite index on (GridId, Field)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DefaultGridColumnAccess_GridId_Field' AND object_id = OBJECT_ID('dbo.DefaultGridColumnAccess'))
BEGIN
    PRINT 'Creating index [IX_DefaultGridColumnAccess_GridId_Field]...';

    CREATE UNIQUE NONCLUSTERED INDEX [IX_DefaultGridColumnAccess_GridId_Field]
    ON [dbo].[DefaultGridColumnAccess] ([GridId] ASC, [Field] ASC);

    PRINT 'Index [IX_DefaultGridColumnAccess_GridId_Field] created successfully.';
END
ELSE
BEGIN
    PRINT 'Index [IX_DefaultGridColumnAccess_GridId_Field] already exists. Skipping creation.';
END
GO

PRINT '';
PRINT '================================================================================';
PRINT 'DefaultGridColumnAccess table setup completed.';
PRINT '================================================================================';
GO
