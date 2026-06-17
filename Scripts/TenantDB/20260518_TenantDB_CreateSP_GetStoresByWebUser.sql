-- =============================================================================
-- 20260518_TenantDB_CreateSP_GetStoresByWebUser.sql
-- Target DB: Tenant database (run on each tenant DB)
--
-- Web-prefixed clone of dbo.SP_GetStoresByUser that reads from [WebUsersView]
-- (which joins [WebUsers] + [WebUsersStore] + [Store] + [Groups]) instead of
-- the legacy [UsersView].
--
-- Same parameters, same result shape (StoreID, StoreName), same semantics:
--   • If the user's "IsDefault" flag in WebUsersView is 1, return only the
--     stores that user is explicitly assigned to.
--   • Otherwise, return every active store.
--
-- The C# caller (SystemLookupService.GetStoresByUserAsync) is updated to
-- execute this SP instead of SP_GetStoresByUser via Database.SqlQueryRaw,
-- so the existing SP_GetStoresByUserResult type can be reused unchanged.
--
-- The legacy SP_GetStoresByUser is left intact so the desktop POS keeps
-- working against the legacy [UsersView].
--
-- Re-runnable: uses CREATE OR ALTER.
-- =============================================================================
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('[dbo].[SP_GetStoresByWebUser]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[SP_GetStoresByWebUser];
GO

CREATE PROCEDURE [dbo].[SP_GetStoresByWebUser]
(
    @UserID  uniqueidentifier,
    @StoreID uniqueidentifier = NULL
)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ThisStoreOnly bit;

    SELECT @ThisStoreOnly = ISNULL(IsDefault, 1)
    FROM   WebUsersView
    WHERE  UserID = @UserID;

    IF @ThisStoreOnly = 1
        SELECT DISTINCT Store.StoreID,
                        Store.StoreName
        FROM   WebUsersView
               INNER JOIN Store ON Store.StoreID = WebUsersView.StoreID
        WHERE  WebUsersView.Status > -1
          AND  WebUsersView.UserId = @UserID
          AND  Store.Status > 0;
    ELSE
        SELECT DISTINCT StoreID,
                        StoreName
        FROM   Store
        WHERE  Status > 0;
END
GO

PRINT 'Created/updated SP_GetStoresByWebUser.';
GO


-- =============================================================================
-- ROLLBACK (run separately if you ever need to drop the new SP)
-- =============================================================================
/*
IF OBJECT_ID(N'[dbo].[SP_GetStoresByWebUser]', N'P') IS NOT NULL
BEGIN
    DROP PROCEDURE [dbo].[SP_GetStoresByWebUser];
    PRINT 'Dropped SP_GetStoresByWebUser.';
END
GO
*/
