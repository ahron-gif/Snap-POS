-- ============================================================================
-- Fix UsersStore unique index to allow multiple stores per user
-- The old index was on UserID alone, preventing multi-store assignments.
-- New index is on (UserID, StoreID) — same user + same store is blocked,
-- but same user + different stores is allowed.
-- NULL values in UserID or StoreID are allowed (filtered out of the index).
-- ============================================================================
-- Date: 2026-03-24
-- ============================================================================

-- Step 1: Drop the old index
--IF EXISTS (
--    SELECT 1 FROM sys.indexes
--    WHERE name = 'UserID_ItemStore'
--    AND object_id = OBJECT_ID('dbo.UsersStore')
--)
--BEGIN
--    DROP INDEX [UserID_ItemStore] ON [dbo].[UsersStore];
--    PRINT 'Dropped old index [UserID_ItemStore]';
--END
--GO

---- Step 2: Remove duplicate (UserID, StoreID) rows — keep only the newest one
--;WITH Duplicates AS (
--    SELECT UserStoreID,
--           ROW_NUMBER() OVER (
--               PARTITION BY UserID, StoreID
--               ORDER BY DateCreated DESC
--           ) AS RowNum
--    FROM dbo.UsersStore
--    WHERE UserID IS NOT NULL AND StoreID IS NOT NULL
--)
--DELETE FROM Duplicates WHERE RowNum > 1;
--PRINT 'Deleted duplicate UserID+StoreID rows: ' + CAST(@@ROWCOUNT AS VARCHAR);
--GO

---- Step 3: Create filtered unique index — only enforces uniqueness where both values are NOT NULL
--IF NOT EXISTS (
--    SELECT 1 FROM sys.indexes
--    WHERE name = 'UserID_ItemStore'
--    AND object_id = OBJECT_ID('dbo.UsersStore')
--)
--BEGIN
--    CREATE UNIQUE INDEX [UserID_ItemStore]
--    ON [dbo].[UsersStore] ([UserID], [StoreID])
--    WHERE [UserID] IS NOT NULL AND [StoreID] IS NOT NULL;
--    PRINT 'Created filtered unique index [UserID_ItemStore] on (UserID, StoreID) WHERE both NOT NULL';
--END
--GO



