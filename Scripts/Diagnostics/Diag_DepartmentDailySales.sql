-- ============================================================================================
-- Diag_DepartmentDailySales.sql
--
-- Run this on the SAME tenant database the web API connects to (TenantConnection in
-- appsettings.*.json). It runs FOUR things side-by-side and tells us exactly where
-- desktop and web diverge.
--
-- Sections returned:
--   1. Identity     — confirm SSMS is on the same DB the API uses.
--   2. SP run #1    — Web_SP_DepartmentsDailySales (what the web pivot now calls).
--   3. SP run #2    — SP_DepartmentsDailySales (what the desktop calls).
--   4. ItemsRepFilter sanity — how many ItemStoreIDs that permission-scoped view returns.
--   5. Targeted probes for the two cells you flagged (8/23/2022 TOYS 4 YOU TEST 2 = $350,
--                                                     12/30/2021 RDT HEADQ STROLLER w = $6).
--
-- If section 2 ≠ section 3 → the two SPs themselves are out of sync. We'll fix the Web SP.
-- If section 2 == section 3 but desktop still shows different data → desktop is pointed at
--                                                                    a different DB.
-- If both SPs return 0 / few rows but section 5 finds the raw cells in TransactionEntryItem,
-- the problem is ItemsRepFilter dropping the rows under the API's SQL session.
-- ============================================================================================

SET NOCOUNT ON;

DECLARE @FromDate    DATETIME = '2020-01-01';
DECLARE @ToDate      DATETIME = '2026-05-21';
DECLARE @ToExclusive DATETIME = DATEADD(day, 1, @ToDate);

-- Build the filter string EXACTLY like the .NET code does.
DECLARE @Filter NVARCHAR(4000) =
    N' And EndSaleTime>=''' + CONVERT(varchar(10), @FromDate, 120)
  + N''' And EndSaleTime<''' + CONVERT(varchar(10), @ToExclusive, 120) + N'''';

-- 1) Identity check ---------------------------------------------------------------------------
SELECT
    DB_NAME()           AS CurrentDatabase,
    SUSER_SNAME()       AS LoginName,
    USER_NAME()         AS DbUserName,
    @@SERVERNAME        AS ServerName,
    SYSDATETIME()       AS NowOnServer;

PRINT '--- Filter string used below:';
PRINT @Filter;

-- 2) Web SP — what the API now calls -----------------------------------------------------------
PRINT '--- Section 2: Web_SP_DepartmentsDailySales';
BEGIN TRY
    EXEC dbo.Web_SP_DepartmentsDailySales
        @Filter         = @Filter,
        @ItemFilter     = N'',
        @CustomerFilter = N'',
        @TableName      = N' TransactionEntryItem ',
        @PageNumber     = 1,
        @PageSize       = 100000;
END TRY
BEGIN CATCH
    PRINT '!!! Web_SP_DepartmentsDailySales failed: ' + ERROR_MESSAGE();
END CATCH

-- 3) Desktop SP — what RepDepartmentDailySales calls -------------------------------------------
PRINT '--- Section 3: SP_DepartmentsDailySales';
BEGIN TRY
    EXEC dbo.SP_DepartmentsDailySales
        @Filter         = @Filter,
        @ItemFilter     = N'',
        @CustomerFilter = N'',
        @TableName      = N' TransactionEntryItem ';
END TRY
BEGIN CATCH
    PRINT '!!! SP_DepartmentsDailySales failed: ' + ERROR_MESSAGE();
END CATCH

-- 4) ItemsRepFilter sanity ---------------------------------------------------------------------
-- Both Web_SP_DepartmentsDailySales and SP_DepartmentsDailySales inner-join against this view.
-- If it returns 0 rows on this session, both SPs above will return 0 rows — even if the raw
-- transaction data is in the DB.
PRINT '--- Section 4: ItemsRepFilter row count (on this SQL session)';
SELECT COUNT(*) AS ItemsRepFilter_DistinctItemStoreIDs
FROM (SELECT DISTINCT ItemStoreID FROM dbo.ItemsRepFilter WHERE (1=1)) x;

-- 5) Raw probes against TransactionEntryItem for the two specific cells the customer flagged. -
PRINT '--- Section 5a: 8/23/2022 TOYS 4 YOU TEST 2 (raw rows in TransactionEntryItem)';
SELECT CAST(StartSaleTime AS DATE) AS SaleDate, StoreName, Department, DepartmentID,
       QTY, TotalAfterDiscount, TransactionNo, ItemStoreID, ItemID, Name AS ItemName
FROM dbo.TransactionEntryItem WITH (NOLOCK)
WHERE CAST(StartSaleTime AS DATE) = '2022-08-23'
  AND StoreName LIKE '%TOYS 4 YOU%'
  AND Department = 'TEST 2'
ORDER BY StartSaleTime;

PRINT '--- Section 5b: 12/30/2021 RDT HEADQUARTERS STROLLER w (raw rows in TransactionEntryItem)';
SELECT CAST(StartSaleTime AS DATE) AS SaleDate, StoreName, Department, DepartmentID,
       QTY, TotalAfterDiscount, TransactionNo, ItemStoreID, ItemID, Name AS ItemName
FROM dbo.TransactionEntryItem WITH (NOLOCK)
WHERE CAST(StartSaleTime AS DATE) = '2021-12-30'
  AND StoreName LIKE '%RDT HEADQ%'
  AND Department = 'STROLLER w'
ORDER BY StartSaleTime;

-- 6) If Section 5a/b returned rows but Section 2 didn't include those cells, try the same
--    Web_SP call but with the ItemSelect-INTO step bypassed by leaving #ItemSelect as a
--    full snapshot of the universe. (Read-only — runs SP with already-prepared temp table.)
PRINT '--- Section 6: Web_SP with #ItemSelect pre-populated from ALL distinct ItemStoreIDs';
IF OBJECT_ID('tempdb..#ItemSelect') IS NOT NULL DROP TABLE #ItemSelect;
SELECT DISTINCT ItemStoreID INTO #ItemSelect FROM dbo.TransactionEntryItem WITH (NOLOCK);
SELECT COUNT(*) AS PrePopulated_ItemSelect_RowCount FROM #ItemSelect;
-- (we can't directly tell the SP to skip its own SELECT INTO step without editing it; the
-- existence of this temp table demonstrates how many ItemStoreIDs the SP *would* see if
-- ItemsRepFilter were not the constraint.)
IF OBJECT_ID('tempdb..#ItemSelect') IS NOT NULL DROP TABLE #ItemSelect;
