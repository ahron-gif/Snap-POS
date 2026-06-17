/*
================================================================================
Script Name:    CreateUserPreferencesTable.sql
Description:    Creates the UserPreferences table in Tenant database.
                This table stores user-specific preferences as key-value pairs
                with JSON values (e.g., last session, workspace state).

Table:          dbo.UserPreferences
Database:       Tenant Database (Customer DB)

Author:         System
Created:        2026-04-13
Version:        1.0

Usage:
    Run this script on each tenant (customer) database to create the table.
    The table will be used by the User Preference API to persist user settings.

Columns:
    - Id:               Primary key (auto-increment)
    - UserId:           User ID (GUID) from Users table (LocalUserId)
    - PreferenceKey:    Unique key for the preference (e.g., "lastSession", "workspaceState")
    - PreferenceValue:  JSON string containing the preference value
    - DateCreated:      When the preference was first created
    - DateModified:     When the preference was last updated

JSON Format Examples for PreferenceValue:

    lastSession:
    {
        "storeId": "abc-123-...",
        "storeName": "Main Store",
        "localUserId": "def-456-...",
        "customerId": 1
    }

    workspaceState:
    {
        "tabs": [
            {"id": "Home", "title": "Dashboard", "component": "Home", "closable": false},
            {"id": "ItemListPage", "title": "Items", "component": "ItemListPage", "closable": true}
        ],
        "activeTabId": "ItemListPage"
    }

Related Files:
    - Backend Entity: BackOffice.Domain/Entities/Tenant/UserPreference.cs
    - Backend Service: BackOffice.Persistence/Services/Tenant/UserPreferenceService.cs
    - Backend Controller: BackOffice.Api/Controllers/UserPreferenceController.cs
    - Frontend Service: BackOffice.Presentation/src/services/userPreferenceService.ts

================================================================================
*/

-- Check if table exists before creating
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserPreferences]') AND type in (N'U'))
BEGIN
    PRINT 'Creating table [dbo].[UserPreferences]...';

    CREATE TABLE [dbo].[UserPreferences] (
        [Id] INT IDENTITY(1,1) NOT NULL,
        [UserId] UNIQUEIDENTIFIER NOT NULL,
        [PreferenceKey] NVARCHAR(100) NOT NULL,
        [PreferenceValue] NVARCHAR(MAX) NOT NULL,
        [DateCreated] DATETIME2(7) NOT NULL CONSTRAINT [DF_UserPreferences_DateCreated] DEFAULT (GETDATE()),
        [DateModified] DATETIME2(7) NOT NULL CONSTRAINT [DF_UserPreferences_DateModified] DEFAULT (GETDATE()),

        CONSTRAINT [PK_UserPreferences] PRIMARY KEY CLUSTERED ([Id] ASC)
    );

    PRINT 'Table [dbo].[UserPreferences] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [dbo].[UserPreferences] already exists. Skipping creation.';
END
GO

-- Create unique index on UserId + PreferenceKey (if not exists)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserPreferences_UserId_PreferenceKey' AND object_id = OBJECT_ID('dbo.UserPreferences'))
BEGIN
    PRINT 'Creating index [IX_UserPreferences_UserId_PreferenceKey]...';

    CREATE UNIQUE NONCLUSTERED INDEX [IX_UserPreferences_UserId_PreferenceKey]
    ON [dbo].[UserPreferences] ([UserId] ASC, [PreferenceKey] ASC);

    PRINT 'Index [IX_UserPreferences_UserId_PreferenceKey] created successfully.';
END
ELSE
BEGIN
    PRINT 'Index [IX_UserPreferences_UserId_PreferenceKey] already exists. Skipping creation.';
END
GO

-- Create index on PreferenceKey for faster lookups (if not exists)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserPreferences_PreferenceKey' AND object_id = OBJECT_ID('dbo.UserPreferences'))
BEGIN
    PRINT 'Creating index [IX_UserPreferences_PreferenceKey]...';

    CREATE NONCLUSTERED INDEX [IX_UserPreferences_PreferenceKey]
    ON [dbo].[UserPreferences] ([PreferenceKey] ASC);

    PRINT 'Index [IX_UserPreferences_PreferenceKey] created successfully.';
END
ELSE
BEGIN
    PRINT 'Index [IX_UserPreferences_PreferenceKey] already exists. Skipping creation.';
END
GO

PRINT '';
PRINT '================================================================================';
PRINT 'UserPreferences table setup completed.';
PRINT '================================================================================';
GO
