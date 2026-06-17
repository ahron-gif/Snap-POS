-- =============================================================================
-- 20260512_TenantDB_UsersStore_UniqueUserIndex.sql
-- Target DB: Tenant database (run on each tenant DB)
--
-- Enforces "one row per user" in the LEGACY [UsersStore] table by adding a
-- unique filtered index on UserID for active rows (Status > 0).
--
-- Matches the web-app contract that WebUserManagementService now writes a
-- single legacy UsersStore row per user (the default store), while
-- [WebUsersStore] keeps the full multi-store assignment list.
--
-- ⚠️ READ BEFORE RUNNING:
--
--   1. The desktop POS (Cloud_BackOffice) uses the legacy [UsersStore] table.
--      If the desktop app ever creates more than one active UsersStore row
--      per user, this index will reject those inserts (error 2601 duplicate key).
--      Verify with the desktop team that one-row-per-user is acceptable, OR
--      switch this to a composite unique index on (UserID, StoreID) instead
--      (uncomment the alternative block below).
--
--   2. Existing data may already have multiple active rows per user. The
--      pre-flight section below reports duplicates. The index creation will
--      FAIL if duplicates exist on active rows; resolve them first (the
--      commented dedup block keeps the IsDefault=1 row per user and
--      soft-deletes the rest by setting Status = -1).
--
-- Re-runnable: index creation is guarded with IF NOT EXISTS.
-- =============================================================================
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

-- -----------------------------------------------------------------------------
-- 1. Pre-flight: report any users that currently have multiple active
--    UsersStore rows. Review the output before proceeding to step 3.
-- -----------------------------------------------------------------------------
PRINT '--- Duplicate UserID check on [dbo].[UsersStore] (Status > 0) ---';

SELECT  us.UserID,
        COUNT(*) AS ActiveRowCount
FROM    [dbo].[UsersStore] us
WHERE   us.Status > 0
GROUP BY us.UserID
HAVING  COUNT(*) > 1
ORDER BY ActiveRowCount DESC, us.UserID;

DECLARE @duplicateUserCount INT = (
    SELECT COUNT(*) FROM (
        SELECT UserID FROM [dbo].[UsersStore]
        WHERE Status > 0
        GROUP BY UserID HAVING COUNT(*) > 1
    ) x
);

PRINT CONCAT(@duplicateUserCount, ' user(s) currently have more than one active UsersStore row.');
GO

-- -----------------------------------------------------------------------------
-- 2. (OPTIONAL) Dedup before creating the index. Keeps the IsDefault=1 row
--    per user (or the most-recent DateCreated row if no row is marked default)
--    and soft-deletes the rest by setting Status = -1.
--
--    Uncomment the block below ONLY if you've decided the legacy table should
--    collapse to one row per user. Leaving rows as Status>0 will cause the
--    CREATE INDEX in section 3 to fail with duplicate-key error 1505.
-- -----------------------------------------------------------------------------
/*
;WITH RankedRows AS (
    SELECT  us.UserStoreID,
            us.UserID,
            us.IsDefault,
            us.DateCreated,
            ROW_NUMBER() OVER (
                PARTITION BY us.UserID
                ORDER BY
                    CASE WHEN us.IsDefault = 1 THEN 0 ELSE 1 END,
                    us.DateCreated DESC
            ) AS rn
    FROM    [dbo].[UsersStore] us
    WHERE   us.Status > 0
)
UPDATE us
SET    us.Status        = -1,
       us.DateModified  = SYSUTCDATETIME()
FROM   [dbo].[UsersStore] us
INNER JOIN RankedRows r ON r.UserStoreID = us.UserStoreID
WHERE  r.rn > 1;

PRINT CONCAT('Soft-deleted ', @@ROWCOUNT, ' duplicate UsersStore row(s) (set Status = -1).');
GO
*/

-- -----------------------------------------------------------------------------
-- 3. Create the unique filtered index.
--    Filter on Status > 0 so soft-deleted rows do not count toward uniqueness.
-- -----------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM   sys.indexes
    WHERE  name = N'UX_UsersStore_UserID_Active'
      AND  object_id = OBJECT_ID(N'[dbo].[UsersStore]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_UsersStore_UserID_Active]
        ON [dbo].[UsersStore] ([UserID] ASC)
        WHERE ([Status] > 0)
        WITH (
            STATISTICS_NORECOMPUTE = OFF,
            IGNORE_DUP_KEY = OFF,
            ONLINE = OFF,
            FILLFACTOR = 90
        )
        ON [PRIMARY];

    PRINT 'Created UX_UsersStore_UserID_Active.';
END
ELSE
BEGIN
    PRINT 'UX_UsersStore_UserID_Active already exists - skipped.';
END
GO

-- =============================================================================
-- ALTERNATIVE (composite uniqueness)
--
-- If the desktop POS still needs to assign a user to multiple stores in the
-- legacy table, swap section 3 above for the composite index below, which
-- only blocks duplicate (UserID, StoreID) pairs:
--
-- IF NOT EXISTS (SELECT 1 FROM sys.indexes
--                WHERE name = N'UX_UsersStore_UserID_StoreID_Active'
--                  AND object_id = OBJECT_ID(N'[dbo].[UsersStore]'))
-- BEGIN
--     CREATE UNIQUE NONCLUSTERED INDEX [UX_UsersStore_UserID_StoreID_Active]
--         ON [dbo].[UsersStore] ([UserID] ASC, [StoreID] ASC)
--         WHERE ([Status] > 0)
--         WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, FILLFACTOR = 90)
--         ON [PRIMARY];
-- END
-- GO
-- =============================================================================


-- -----------------------------------------------------------------------------
-- ROLLBACK (run separately if you ever need to drop the index)
-- -----------------------------------------------------------------------------
/*
IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_UsersStore_UserID_Active'
      AND object_id = OBJECT_ID(N'[dbo].[UsersStore]')
)
BEGIN
    DROP INDEX [UX_UsersStore_UserID_Active] ON [dbo].[UsersStore];
    PRINT 'Dropped UX_UsersStore_UserID_Active.';
END
GO
*/
