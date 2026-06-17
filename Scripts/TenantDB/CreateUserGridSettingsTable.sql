/*
================================================================================
Script Name:    CreateUserGridSettingsTable.sql
Description:    Creates the UserGridSettings table in Tenant database.
                This table stores user-specific grid column settings
                (visibility, width, order) for all grids in the application.

Table:          dbo.UserGridSettings
Database:       Tenant Database (Customer DB)

Author:         System
Created:        2026-01-01
Version:        1.0

Usage:
    Run this script on each tenant (customer) database to create the table.
    The table will be used by the Grid Settings API to persist user preferences.z

Columns:
    - Id:           Primary key (auto-increment)
    - UserId:       User ID (GUID) from Users table
    - GridId:       Unique identifier for the grid (e.g., "items-list-grid")
    - SettingsJson: JSON string containing column settings array
    - DateCreated:  When the settings were first created
    - DateModified: When the settings were last updated

JSON Format Example for SettingsJson:
    [
        {"field": "itemID", "visible": true, "width": 120},
        {"field": "name", "visible": true, "width": 250},
        {"field": "barcodeNumber", "visible": false, "width": 180}
    ]

Related Files:
    - Backend Entity: BackOffice.Domain/Entities/Tenant/UserGridSettings.cs
    - Backend Service: BackOffice.Persistence/Services/Tenant/GridSettingsService.cs
    - Backend Controller: BackOffice.Api/Controllers/GridSettingsController.cs
    - Frontend Hook: BackOffice.Presentation/src/hooks/useGridSettings.ts
    - Frontend Service: BackOffice.Presentation/src/services/gridSettingsService.ts

================================================================================
*/

-- Check if table exists before creating
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserGridSettings]') AND type in (N'U'))
BEGIN
    PRINT 'Creating table [dbo].[UserGridSettings]...';

    CREATE TABLE [dbo].[UserGridSettings] (
        [Id] INT IDENTITY(1,1) NOT NULL,
        [UserId] UNIQUEIDENTIFIER NOT NULL,
        [GridId] NVARCHAR(100) NOT NULL,
        [SettingsJson] NVARCHAR(MAX) NOT NULL,
        [DateCreated] DATETIME2(7) NOT NULL CONSTRAINT [DF_UserGridSettings_DateCreated] DEFAULT (GETDATE()),
        [DateModified] DATETIME2(7) NOT NULL CONSTRAINT [DF_UserGridSettings_DateModified] DEFAULT (GETDATE()),

        CONSTRAINT [PK_UserGridSettings] PRIMARY KEY CLUSTERED ([Id] ASC)
    );

    PRINT 'Table [dbo].[UserGridSettings] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[UserGridSettings] already exists. Skipping creation.';
END
GO

-- Create unique index on UserId + GridId (if not exists)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserGridSettings_UserId_GridId' AND object_id = OBJECT_ID('dbo.UserGridSettings'))
BEGIN
    PRINT 'Creating index [IX_UserGridSettings_UserId_GridId]...';

    CREATE UNIQUE NONCLUSTERED INDEX [IX_UserGridSettings_UserId_GridId]
    ON [dbo].[UserGridSettings] ([UserId] ASC, [GridId] ASC);

    PRINT 'Index [IX_UserGridSettings_UserId_GridId] created successfully.';
END
ELSE
BEGIN
    PRINT 'Index [IX_UserGridSettings_UserId_GridId] already exists. Skipping creation.';
END
GO

-- Create index on GridId for faster lookups by grid (if not exists)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserGridSettings_GridId' AND object_id = OBJECT_ID('dbo.UserGridSettings'))
BEGIN
    PRINT 'Creating index [IX_UserGridSettings_GridId]...';

    CREATE NONCLUSTERED INDEX [IX_UserGridSettings_GridId]
    ON [dbo].[UserGridSettings] ([GridId] ASC);

    PRINT 'Index [IX_UserGridSettings_GridId] created successfully.';
END
ELSE
BEGIN
    PRINT 'Index [IX_UserGridSettings_GridId] already exists. Skipping creation.';
END
GO

PRINT '';
PRINT '================================================================================';
PRINT 'UserGridSettings table setup completed.';
PRINT '================================================================================';
GO
