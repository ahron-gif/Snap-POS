/*
================================================================================
Script Name:    20260506_Alter_SP_GetUsersView.sql
Description:    Updates dbo.SP_GetUsersView to deduplicate users across stores
                using ROW_NUMBER, preferring the row that matches @StoreID.

                Run against: each TENANT Database
                Idempotent:  safe to run multiple times (uses ALTER PROCEDURE)
================================================================================
*/

--ALTER PROCEDURE [dbo].[SP_GetUsersView]
--(
--    @StoreID        uniqueidentifier = NULL,
--    @DeletedOnly    bit              = 0,
--    @DateModified   datetime         = NULL,
--    @refreshTime    datetime         OUTPUT
--)
--AS
--BEGIN
--    SET NOCOUNT ON;

--    IF @DateModified IS NULL
--    BEGIN
--        ;WITH Ranked AS (
--            SELECT uv.*,
--                   ROW_NUMBER() OVER (
--                        PARTITION BY uv.UserID
--                        ORDER BY CASE WHEN uv.StoreID = @StoreID THEN 0 ELSE 1 END,
--                                 uv.StoreID
--                   ) AS _rn
--            FROM dbo.UsersView uv
--            WHERE uv.Status > -1
--              AND (uv.StoreID = @StoreID OR uv.IsSuperAdmin = 1 OR uv.IsDefault = 0)
--        )
--        SELECT * FROM Ranked WHERE _rn = 1;

--        SET @refreshTime = dbo.GetLocalDATE();
--        RETURN;
--    END

--    IF @DeletedOnly = 0
--    BEGIN
--        ;WITH Ranked AS (
--            SELECT uv.*,
--                   ROW_NUMBER() OVER (
--                        PARTITION BY uv.UserID
--                        ORDER BY CASE WHEN uv.StoreID = @StoreID THEN 0 ELSE 1 END,
--                                 uv.StoreID
--                   ) AS _rn
--            FROM dbo.UsersView uv
--            WHERE (uv.DateModified > @DateModified OR uv.UserStoreDateM >= @DateModified)
--              AND uv.Status > -1
--              AND (uv.StoreID = @StoreID OR uv.IsSuperAdmin = 1 OR uv.IsDefault = 0)
--        )
--        SELECT * FROM Ranked WHERE _rn = 1;
--    END
--    ELSE
--    BEGIN
--        ;WITH Ranked AS (
--            SELECT uv.*,
--                   ROW_NUMBER() OVER (
--                        PARTITION BY uv.UserID
--                        ORDER BY CASE WHEN uv.StoreID = @StoreID THEN 0 ELSE 1 END,
--                                 uv.StoreID
--                   ) AS _rn
--            FROM dbo.UsersView uv
--            WHERE (uv.DateModified > @DateModified OR uv.UserStoreDateM >= @DateModified)
--              AND uv.Status = -1
--              AND (uv.StoreID = @StoreID OR uv.IsSuperAdmin = 1 OR uv.IsDefault = 0)
--        )
--        SELECT * FROM Ranked WHERE _rn = 1;
--    END

--    SET @refreshTime = dbo.GetLocalDATE();
--END
--GO
