-- =============================================================================
-- 20260512_TenantDB_UsersStore_DedupActive.sql
-- Target DB: Tenant database (run on each tenant DB)
--
-- Resolves users that have multiple active rows in the legacy [UsersStore]
-- table so the unique filtered index from
-- 20260512_TenantDB_UsersStore_UniqueUserIndex.sql can be created cleanly.
--
-- Strategy: for each UserID with more than one row where Status > 0,
-- keep exactly ONE row and HARD-DELETE the rest.
--
-- ⚠️ HARD DELETE — duplicates are PERMANENTLY removed. Take a backup first:
--
--     SELECT * INTO [dbo].[UsersStore_Backup_20260512] FROM [dbo].[UsersStore];
--
-- Survivor selection (which row stays):
--   1. Prefer the row marked IsDefault = 1.
--   2. Otherwise, prefer the most recently modified row (DateModified DESC).
--   3. Otherwise, prefer the most recently created row (DateCreated DESC).
--   4. Stable tiebreaker on UserStoreID.
--
-- Wrapped in a single transaction so either all duplicates are removed or
-- nothing changes. Re-runnable: a clean run is a no-op.
-- =============================================================================
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO

-- -----------------------------------------------------------------------------
-- 0. (Recommended) snapshot backup of the whole table — uncomment to enable.
-- -----------------------------------------------------------------------------
/*
IF OBJECT_ID(N'[dbo].[UsersStore_Backup_20260512]', N'U') IS NULL
BEGIN
    SELECT * INTO [dbo].[UsersStore_Backup_20260512] FROM [dbo].[UsersStore];
    PRINT CONCAT('Backed up ', @@ROWCOUNT, ' row(s) into [UsersStore_Backup_20260512].');
END
ELSE
BEGIN
    PRINT '[UsersStore_Backup_20260512] already exists - skipped.';
END
GO
*/

-- -----------------------------------------------------------------------------
-- 1. BEFORE: report duplicates
-- -----------------------------------------------------------------------------
PRINT '--- BEFORE dedup: users with more than one active UsersStore row ---';

SELECT  us.UserID,
        COUNT(*) AS ActiveRowCount
FROM    [dbo].[UsersStore] us
WHERE   us.Status > 0
GROUP BY us.UserID
HAVING  COUNT(*) > 1
ORDER BY ActiveRowCount DESC, us.UserID;

DECLARE @beforeDupUsers INT = (
    SELECT COUNT(*) FROM (
        SELECT UserID FROM [dbo].[UsersStore]
        WHERE Status > 0
        GROUP BY UserID HAVING COUNT(*) > 1
    ) x
);

PRINT CONCAT('BEFORE: ', @beforeDupUsers, ' user(s) have duplicate active rows.');
GO

-- -----------------------------------------------------------------------------
-- 2. Hard-delete duplicates inside a transaction
-- -----------------------------------------------------------------------------
BEGIN TRANSACTION DedupUsersStore;

BEGIN TRY
    ;WITH RankedRows AS (
        SELECT  us.UserStoreID,
                ROW_NUMBER() OVER (
                    PARTITION BY us.UserID
                    ORDER BY
                        CASE WHEN us.IsDefault = 1 THEN 0 ELSE 1 END,
                        us.DateModified DESC,
                        us.DateCreated DESC,
                        us.UserStoreID
                ) AS rn
        FROM    [dbo].[UsersStore] us
        WHERE   us.Status > 0
    )
    DELETE us
    FROM   [dbo].[UsersStore] us
    INNER JOIN RankedRows r ON r.UserStoreID = us.UserStoreID
    WHERE  r.rn > 1;

    DECLARE @deleted INT = @@ROWCOUNT;
    PRINT CONCAT('Hard-deleted ', @deleted, ' duplicate row(s) from [UsersStore].');

    COMMIT TRANSACTION DedupUsersStore;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION DedupUsersStore;

    DECLARE @errMsg nvarchar(4000) = ERROR_MESSAGE(),
            @errSev int           = ERROR_SEVERITY(),
            @errSt  int           = ERROR_STATE();
    RAISERROR (@errMsg, @errSev, @errSt);
END CATCH
GO

-- -----------------------------------------------------------------------------
-- 3. AFTER: confirm clean (should return 0 rows)
-- -----------------------------------------------------------------------------
PRINT '--- AFTER dedup: any remaining duplicate active rows (expected empty) ---';

SELECT  us.UserID,
        COUNT(*) AS ActiveRowCount
FROM    [dbo].[UsersStore] us
WHERE   us.Status > 0
GROUP BY us.UserID
HAVING  COUNT(*) > 1
ORDER BY ActiveRowCount DESC, us.UserID;

DECLARE @afterDupUsers INT = (
    SELECT COUNT(*) FROM (
        SELECT UserID FROM [dbo].[UsersStore]
        WHERE Status > 0
        GROUP BY UserID HAVING COUNT(*) > 1
    ) x
);

PRINT CONCAT('AFTER: ', @afterDupUsers, ' user(s) still have duplicates. (Expected 0.)');
GO


-- =============================================================================
-- RESTORE (optional) — if you took the backup in section 0 and need to undo
-- the hard delete, restore the rows whose UserStoreID is in the backup but
-- not in the live table.
-- =============================================================================
/*
IF OBJECT_ID(N'[dbo].[UsersStore_Backup_20260512]', N'U') IS NOT NULL
BEGIN
    INSERT INTO [dbo].[UsersStore]
    SELECT b.*
    FROM   [dbo].[UsersStore_Backup_20260512] b
    WHERE  NOT EXISTS (
        SELECT 1 FROM [dbo].[UsersStore] us
        WHERE  us.UserStoreID = b.UserStoreID
    );

    PRINT CONCAT('Restored ', @@ROWCOUNT, ' row(s) from backup.');
END
GO
*/
