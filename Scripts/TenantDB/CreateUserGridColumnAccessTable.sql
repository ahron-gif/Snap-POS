/*
================================================================================
Script Name:    CreateUserGridColumnAccessTable.sql
Description:    Creates the UserGridColumnAccess table in Tenant database.
                Stores Super-Admin-defined per-user column visibility rules for
                grid-based screens. Absence of a row for a given
                (UserId, GridId, Field) combination is treated as "allowed".

Table:          dbo.UserGridColumnAccess
Database:       Tenant Database (Customer DB)

Created:        2026-04-17
Version:        1.0

Usage:
    Run this script on each tenant (customer) database to create the table.
    Used by the GridColumnAccess API to persist per-user column access rules.

Columns:
    - Id:             Primary key (auto-increment)
    - UserId:         User (GUID) whose column access is governed
    - GridId:         Grid identifier (must match gridId in frontend GRID_REGISTRY)
    - Field:          Column field name (matches ServerGrid Column.field)
    - AllowedToView:  true = user sees the column; false = column stripped
    - DateCreated:    When the rule was first created
    - DateModified:   When the rule was last updated
    - ModifiedBy:     Super Admin user who last saved the rule

Related Files:
    - Backend Entity:     BackOffice.Domain/Entities/Tenant/UserGridColumnAccess.cs
    - Backend Controller: BackOffice.Api/Controllers/GridColumnAccessController.cs
    - Frontend Service:   BackOffice.Presentation/src/services/gridColumnAccessService.ts
    - Frontend Hook:      BackOffice.Presentation/src/hooks/useColumnAccessFilter.ts
================================================================================
*/

-- Check if table exists before creating
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserGridColumnAccess]') AND type in (N'U'))
BEGIN
    PRINT 'Creating table [dbo].[UserGridColumnAccess]...';

    CREATE TABLE [dbo].[UserGridColumnAccess] (
        [Id]             INT IDENTITY(1,1) NOT NULL,
        [UserId]         UNIQUEIDENTIFIER NOT NULL,
        [GridId]         NVARCHAR(100) NOT NULL,
        [Field]          NVARCHAR(100) NOT NULL,
        [AllowedToView]  BIT NOT NULL CONSTRAINT [DF_UserGridColumnAccess_AllowedToView] DEFAULT (1),
        [DateCreated]    DATETIME2(7) NOT NULL CONSTRAINT [DF_UserGridColumnAccess_DateCreated]  DEFAULT (GETDATE()),
        [DateModified]   DATETIME2(7) NOT NULL CONSTRAINT [DF_UserGridColumnAccess_DateModified] DEFAULT (GETDATE()),
        [ModifiedBy]     UNIQUEIDENTIFIER NULL,

        CONSTRAINT [PK_UserGridColumnAccess] PRIMARY KEY CLUSTERED ([Id] ASC)
    );

    PRINT 'Table [dbo].[UserGridColumnAccess] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[UserGridColumnAccess] already exists. Skipping creation.';
END
GO

-- Create unique composite index on (UserId, GridId, Field)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserGridColumnAccess_UserId_GridId_Field' AND object_id = OBJECT_ID('dbo.UserGridColumnAccess'))
BEGIN
    PRINT 'Creating index [IX_UserGridColumnAccess_UserId_GridId_Field]...';

    CREATE UNIQUE NONCLUSTERED INDEX [IX_UserGridColumnAccess_UserId_GridId_Field]
    ON [dbo].[UserGridColumnAccess] ([UserId] ASC, [GridId] ASC, [Field] ASC);

    PRINT 'Index [IX_UserGridColumnAccess_UserId_GridId_Field] created successfully.';
END
ELSE
BEGIN
    PRINT 'Index [IX_UserGridColumnAccess_UserId_GridId_Field] already exists. Skipping creation.';
END
GO

-- Create non-unique secondary index on (GridId, Field) for faster "who can see this column" lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserGridColumnAccess_GridId_Field' AND object_id = OBJECT_ID('dbo.UserGridColumnAccess'))
BEGIN
    PRINT 'Creating index [IX_UserGridColumnAccess_GridId_Field]...';

    CREATE NONCLUSTERED INDEX [IX_UserGridColumnAccess_GridId_Field]
    ON [dbo].[UserGridColumnAccess] ([GridId] ASC, [Field] ASC);

    PRINT 'Index [IX_UserGridColumnAccess_GridId_Field] created successfully.';
END
ELSE
BEGIN
    PRINT 'Index [IX_UserGridColumnAccess_GridId_Field] already exists. Skipping creation.';
END
GO

PRINT '';
PRINT '================================================================================';
PRINT 'UserGridColumnAccess table setup completed.';
PRINT '================================================================================';
GO
