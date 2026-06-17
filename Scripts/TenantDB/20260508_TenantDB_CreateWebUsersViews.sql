-- =============================================================================
-- 20260508_TenantDB_CreateWebUsersViews.sql
-- Target DB: Tenant database
--
-- Clones UsersView and UsersStoreView as WebUsersView / WebUsersStoreView
-- pointing at WebUsers and WebUsersStore. Store and Groups remain shared
-- with the original views (those tables are not duplicated).
--
-- Run AFTER 20260508_TenantDB_CreateWebUsers.sql.
-- =============================================================================
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- -----------------------------------------------------------------------------
-- WebUsersView - mirrors UsersView, swaps Users/UsersStore for WebUsers/WebUsersStore
-- -----------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[WebUsersView]', N'V') IS NOT NULL
    DROP VIEW [dbo].[WebUsersView];
GO

CREATE VIEW [dbo].[WebUsersView]
AS
SELECT DISTINCT
       WebUsers.UserId,
       WebUsers.UserName,
       WebUsers.Password,
       WebUsers.UserFName,
       WebUsers.UserLName,
       WebUsers.Address,
       WebUsers.HomePhoneNumber,
       WebUsers.WorkPhoneNumber,
       WebUsers.Fax,
       WebUsers.Email,
       WebUsers.ZipCode,
       WebUsers.IsSuperAdmin,
       WebUsers.Status,
       WebUsers.DateCreated,
       WebUsers.UserCreated,
       WebUsers.DateModified,
       WebUsers.UserModified,
       WebUsersStore.GroupID,
       (CASE WHEN dbo.WebUsers.IsSuperAdmin = 1 THEN '1' ELSE dbo.WebUsersStore.Manager   END) AS Manager,
       (CASE WHEN dbo.WebUsers.IsSuperAdmin = 1 THEN '0' ELSE dbo.WebUsersStore.IsDefault END) AS IsDefault,
       WebUsersStore.StoreID,
       WebUsersStore.DateModified AS UserStoreDateM,
       WebUsers.ScanID,
       Groups.GroupName,
       Store.StoreName,
       WebUsers.IsLogIn
FROM   Store
       INNER JOIN WebUsersStore
           ON Store.StoreID = WebUsersStore.StoreID
       RIGHT OUTER JOIN WebUsers
           ON WebUsersStore.UserID = WebUsers.UserId
          AND WebUsersStore.Status > 0
       LEFT OUTER JOIN Groups
           ON WebUsersStore.GroupID = Groups.GroupID
WHERE  (WebUsersStore.Status > 0)
   OR  (WebUsersStore.Status IS NULL) AND (WebUsers.IsSuperAdmin > 0)
   OR  (WebUsersStore.Status < 0);
GO

PRINT 'Created WebUsersView.';
GO

-- -----------------------------------------------------------------------------
-- WebUsersStoreView - mirrors UsersStoreView
-- -----------------------------------------------------------------------------
IF OBJECT_ID(N'[dbo].[WebUsersStoreView]', N'V') IS NOT NULL
    DROP VIEW [dbo].[WebUsersStoreView];
GO

CREATE VIEW [dbo].[WebUsersStoreView]
AS
SELECT dbo.WebUsersStore.UserStoreID,
       dbo.WebUsersStore.UserID,
       dbo.WebUsersStore.OnLine,
       dbo.WebUsersStore.StoreID,
       dbo.WebUsersStore.IsDefault,
       dbo.WebUsersStore.GroupID,
       dbo.WebUsersStore.Manager,
       dbo.WebUsersStore.LogonDate,
       dbo.WebUsersStore.DateCreated,
       dbo.WebUsersStore.UserCreated,
       dbo.WebUsersStore.DateModified,
       dbo.WebUsersStore.UserModified,
       dbo.WebUsers.UserName,
       ISNULL(dbo.WebUsers.UserLName, '') + ISNULL(',' + dbo.WebUsers.UserFName, '') AS NAME,
       dbo.WebUsersStore.Status
FROM   dbo.WebUsersStore
       INNER JOIN dbo.WebUsers
           ON dbo.WebUsersStore.UserID = dbo.WebUsers.UserId
WHERE  (dbo.WebUsers.Status > 0);
GO

PRINT 'Created WebUsersStoreView.';
GO
