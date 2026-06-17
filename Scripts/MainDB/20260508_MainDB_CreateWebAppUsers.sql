-- =============================================================================
-- 20260508_MainDB_CreateWebAppUsers.sql
-- Target DB: Main database
--
-- Creates WebAppUsers as exact clone of AppUsers (preserving int IDENTITY,
-- defaults, NOT NULL constraints) and copies all rows preserving UserId.
--
-- The original AppUsers table is NOT modified.
-- After this script, run 20260508_MainDB_RepointFKsToWebAppUsers.sql to move
-- web-only FK constraints (UserSessions, MFA, password reset, etc.) over.
--
-- Re-runnable.
-- =============================================================================
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

-- -----------------------------------------------------------------------------
-- 1. WebAppUsers (clone of AppUsers, IDENTITY preserved)
-- -----------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[WebAppUsers]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[WebAppUsers]
    (
        [UserId]            [int]              IDENTITY(1,1) NOT NULL,
        [UserName]          [nvarchar](max)    NOT NULL,
        [Password]          [nvarchar](max)    NOT NULL,
        [APIToken]          [nvarchar](max)    NULL,
        [Email]             [nvarchar](max)    NULL,
        [LastLoginDate]     [datetime2](7)     NULL,
        [LocalUserId]       [uniqueidentifier] NOT NULL,
        [DateCreated]       [datetime2](7)     NOT NULL,
        [DateModified]      [datetime2](7)     NULL,
        [SystemUserCreated] [int]              NULL,
        [CustomerId]        [int]              NULL,
        [Phone]             [nvarchar](max)    NULL,
        [InviteStatus]      [int]              NOT NULL,
        [LoginType]         [nvarchar](50)     NULL,
        [UserLName]         [nvarchar](50)     NULL,
        [Address]           [nvarchar](4000)   NULL,
        [WorkPhoneNumber]   [nvarchar](50)     NULL,
        [Fax]               [nvarchar](50)     NULL,
        [ZipCode]           [nvarchar](50)     NULL,
        [IsSuperAdmin]      [bit]              NULL,
        [Status]            [smallint]         NULL,
        [UserCreated]       [uniqueidentifier] NULL,
        [UserModified]      [uniqueidentifier] NULL,
        [ScanID]            [nvarchar](20)     NULL,
        [IsLogIn]           [bit]              NULL,
        [UserFName]         [nvarchar](50)     NULL,
        [PasswordHash]      [nvarchar](max)    NULL,
        [HasWebAccess]      [bit]              NOT NULL,
        CONSTRAINT [PK_WebAppUsers] PRIMARY KEY CLUSTERED ([UserId] ASC)
            WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF)
            ON [PRIMARY]
    ) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY];

    -- Defaults (mirror those on AppUsers)
    ALTER TABLE [dbo].[WebAppUsers]
        ADD CONSTRAINT [DF_WebAppUsers_InviteStatus] DEFAULT ((0)) FOR [InviteStatus];

    ALTER TABLE [dbo].[WebAppUsers]
        ADD CONSTRAINT [DF_WebAppUsers_HasWebAccess] DEFAULT ((1)) FOR [HasWebAccess];

    PRINT 'Created WebAppUsers.';
END
ELSE
BEGIN
    PRINT 'WebAppUsers already exists - skipped.';
END
GO

-- -----------------------------------------------------------------------------
-- 2. Copy data from AppUsers, preserving UserId values (IDENTITY_INSERT)
--    Re-runnable: only copies rows whose UserId is not already in WebAppUsers.
-- -----------------------------------------------------------------------------
SET IDENTITY_INSERT [dbo].[WebAppUsers] ON;

INSERT INTO [dbo].[WebAppUsers]
    ( [UserId], [UserName], [Password], [APIToken], [Email], [LastLoginDate]
    , [LocalUserId], [DateCreated], [DateModified], [SystemUserCreated]
    , [CustomerId], [Phone], [InviteStatus], [LoginType], [UserLName]
    , [Address], [WorkPhoneNumber], [Fax], [ZipCode], [IsSuperAdmin], [Status]
    , [UserCreated], [UserModified], [ScanID], [IsLogIn], [UserFName]
    , [PasswordHash], [HasWebAccess])
SELECT
      a.[UserId], a.[UserName], a.[Password], a.[APIToken], a.[Email], a.[LastLoginDate]
    , a.[LocalUserId], a.[DateCreated], a.[DateModified], a.[SystemUserCreated]
    , a.[CustomerId], a.[Phone], a.[InviteStatus], a.[LoginType], a.[UserLName]
    , a.[Address], a.[WorkPhoneNumber], a.[Fax], a.[ZipCode], a.[IsSuperAdmin], a.[Status]
    , a.[UserCreated], a.[UserModified], a.[ScanID], a.[IsLogIn], a.[UserFName]
    , a.[PasswordHash], a.[HasWebAccess]
FROM   [dbo].[AppUsers] AS a
WHERE  NOT EXISTS (SELECT 1 FROM [dbo].[WebAppUsers] w WHERE w.[UserId] = a.[UserId]);

DECLARE @rows INT = @@ROWCOUNT;

SET IDENTITY_INSERT [dbo].[WebAppUsers] OFF;

-- Re-seed identity so new inserts continue from MAX(UserId)
DECLARE @maxId INT = ISNULL((SELECT MAX([UserId]) FROM [dbo].[WebAppUsers]), 0);
DBCC CHECKIDENT (N'[dbo].[WebAppUsers]', RESEED, @maxId) WITH NO_INFOMSGS;

PRINT CONCAT('Copied ', @rows, ' row(s) into WebAppUsers. Identity reseeded to ', @maxId, '.');
GO
