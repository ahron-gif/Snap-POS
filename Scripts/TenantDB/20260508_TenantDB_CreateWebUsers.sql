-- =============================================================================
-- 20260508_TenantDB_CreateWebUsers.sql
-- Target DB: Tenant database (run on each tenant DB)
--
-- Creates WebUsers and WebUsersStore as exact clones of Users and UsersStore,
-- copies all current data, recreates internal FK and the audit trigger.
--
-- The original Users / UsersStore tables are NOT modified. Cloud_BackOffice
-- (desktop POS) keeps reading/writing the originals; BackOffice-Web is
-- repointed at the Web* tables via EF mapping.
--
-- Re-runnable: each section guards with IF NOT EXISTS / OBJECT_ID checks.
-- =============================================================================
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

-- -----------------------------------------------------------------------------
-- 1. WebUsers (clone of Users)
-- -----------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[WebUsers]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[WebUsers]
    (
        [UserId]          [uniqueidentifier] NOT NULL,
        [UserName]        [nvarchar](50)     NULL,
        [Password]        [nvarchar](50)     NULL,
        [UserFName]       [nvarchar](50)     NULL,
        [UserLName]       [nvarchar](50)     NULL,
        [Address]         [nvarchar](4000)   NULL,
        [HomePhoneNumber] [nvarchar](50)     NULL,
        [WorkPhoneNumber] [nvarchar](50)     NULL,
        [Fax]             [nvarchar](50)     NULL,
        [Email]           [nvarchar](50)     NULL,
        [ZipCode]         [nvarchar](50)     NULL,
        [IsSuperAdmin]    [bit]              NULL,
        [Status]          [smallint]         NULL,
        [DateCreated]     [datetime]         NULL,
        [UserCreated]     [uniqueidentifier] NULL,
        [DateModified]    [datetime]         NULL,
        [UserModified]    [uniqueidentifier] NULL,
        [ScanID]          [nvarchar](20)     NULL,
        [IsLogIn]         [bit]              NULL,
        [PasswordHash]    [nvarchar](255)    NULL,
        CONSTRAINT [PK_WebUsers] PRIMARY KEY CLUSTERED ([UserId] ASC)
            WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
            ON [PRIMARY]
    ) ON [PRIMARY];

    -- IsLogIn default (mirrors DF_Users_IsLogIn on Users)
    ALTER TABLE [dbo].[WebUsers]
        ADD CONSTRAINT [DF_WebUsers_IsLogIn] DEFAULT ((0)) FOR [IsLogIn];

    -- Unique-username filtered index (mirrors idx_UserName on Users from EF mapping)
    CREATE UNIQUE NONCLUSTERED INDEX [idx_WebUserName]
        ON [dbo].[WebUsers] ([UserName] ASC)
        WHERE ([Status] > (-1))
        WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, FILLFACTOR = 100);

    PRINT 'Created WebUsers.';
END
ELSE
BEGIN
    PRINT 'WebUsers already exists - skipped.';
END
GO

-- -----------------------------------------------------------------------------
-- 2. WebUsersStore (clone of UsersStore)
-- -----------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[WebUsersStore]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[WebUsersStore]
    (
        [UserStoreID]   [uniqueidentifier] NOT NULL,
        [UserID]        [uniqueidentifier] NULL,
        [OnLine]        [bit]              NULL,
        [StoreID]       [uniqueidentifier] NULL,
        [IsDefault]     [bit]              NULL,
        [GroupID]       [uniqueidentifier] NULL,
        [Manager]       [bit]              NULL,
        [LogonDate]     [datetime]         NULL,
        [Status]        [smallint]         NULL,
        [DateCreated]   [datetime]         NULL,
        [UserCreated]   [uniqueidentifier] NULL,
        [DateModified]  [datetime]         NULL,
        [UserModified]  [uniqueidentifier] NULL,
        CONSTRAINT [PK_WebUsersStore] PRIMARY KEY CLUSTERED ([UserStoreID] ASC)
            WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
            ON [PRIMARY]
    ) ON [PRIMARY];

    PRINT 'Created WebUsersStore.';
END
ELSE
BEGIN
    PRINT 'WebUsersStore already exists - skipped.';
END
GO

-- -----------------------------------------------------------------------------
-- 3. FK: WebUsersStore.UserID -> WebUsers.UserId
--    (Internal to the new tables. Note: NOT pointing at the old Users table.)
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_WebUsersStore_WebUsers')
BEGIN
    ALTER TABLE [dbo].[WebUsersStore]
        WITH CHECK ADD CONSTRAINT [FK_WebUsersStore_WebUsers]
        FOREIGN KEY ([UserID]) REFERENCES [dbo].[WebUsers] ([UserId]);

    ALTER TABLE [dbo].[WebUsersStore]
        CHECK CONSTRAINT [FK_WebUsersStore_WebUsers];

    PRINT 'Created FK_WebUsersStore_WebUsers.';
END
ELSE
BEGIN
    PRINT 'FK_WebUsersStore_WebUsers already exists - skipped.';
END
GO

-- -----------------------------------------------------------------------------
-- 4. Copy existing data (one-time bootstrap)
--    Re-runnable: only inserts rows not already in the target.
-- -----------------------------------------------------------------------------
INSERT INTO [dbo].[WebUsers]
    ( [UserId], [UserName], [Password], [UserFName], [UserLName], [Address]
    , [HomePhoneNumber], [WorkPhoneNumber], [Fax], [Email], [ZipCode]
    , [IsSuperAdmin], [Status], [DateCreated], [UserCreated], [DateModified]
    , [UserModified], [ScanID], [IsLogIn], [PasswordHash])
SELECT DISTINCT
      u.[UserId], u.[UserName], u.[Password], u.[UserFName], u.[UserLName], u.[Address]
    , u.[HomePhoneNumber], u.[WorkPhoneNumber], u.[Fax], u.[Email], u.[ZipCode]
    , u.[IsSuperAdmin], u.[Status], u.[DateCreated], u.[UserCreated], u.[DateModified]
    , u.[UserModified], u.[ScanID], u.[IsLogIn], u.[PasswordHash]
FROM   [dbo].[Users] AS u
WHERE  NOT EXISTS (SELECT 1 FROM [dbo].[WebUsers] w WHERE w.[UserId] = u.[UserId]);

PRINT CONCAT('Copied ', @@ROWCOUNT, ' row(s) into WebUsers.');
GO

INSERT INTO [dbo].[WebUsersStore]
    ( [UserStoreID], [UserID], [OnLine], [StoreID], [IsDefault], [GroupID]
    , [Manager], [LogonDate], [Status], [DateCreated], [UserCreated]
    , [DateModified], [UserModified])
SELECT
      us.[UserStoreID], us.[UserID], us.[OnLine], us.[StoreID], us.[IsDefault], us.[GroupID]
    , us.[Manager], us.[LogonDate], us.[Status], us.[DateCreated], us.[UserCreated]
    , us.[DateModified], us.[UserModified]
FROM   [dbo].[UsersStore] AS us
WHERE  NOT EXISTS (SELECT 1 FROM [dbo].[WebUsersStore] w WHERE w.[UserStoreID] = us.[UserStoreID]);

PRINT CONCAT('Copied ', @@ROWCOUNT, ' row(s) into WebUsersStore.');
GO

-- -----------------------------------------------------------------------------
-- 5. Trigger Tr_DeletetWebUser (mirror of Tr_DeletetUser on Users)
--    Logs to DeleteRecordes when Status drops below 1 (soft-delete audit).
--    Tr_ChangeUsers is intentionally NOT replicated (it's a no-op on Users).
-- -----------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[Tr_DeletetWebUser]', N'TR') IS NOT NULL
    DROP TRIGGER [dbo].[Tr_DeletetWebUser];
GO

CREATE TRIGGER [dbo].[Tr_DeletetWebUser]
    ON [dbo].[WebUsers]
    FOR UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF UPDATE(Status) AND ((SELECT COUNT(0) FROM inserted WHERE Status < 1) > 0)
    BEGIN
        INSERT INTO [dbo].[DeleteRecordes] (TableID, TableName, Status, DateModified, IsGuid, FieldName)
        SELECT [UserId], 'UserQuery', [Status], dbo.GetLocalDATE(), 1, 'UserID'
        FROM   inserted;
    END
END
GO

PRINT 'Created Tr_DeletetWebUser.';
GO
