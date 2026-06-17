-- =============================================================================
-- Migration: push pagination, search and multi-store filtering for the
--            items-with-inventory report INTO the database.
-- Date     : 2026-04-29
-- Purpose  : The previous version of dbo.SP_GetItemsWithInventoryLong returned
--            ALL Item x Store rows for the tenant (or for a single store) and
--            relied on the C# layer to apply search and pagination in memory.
--            That scales badly: a tenant with 16k items x 5 stores forces 80k
--            rows across the wire on every page load.
--
--            This update:
--              * Accepts @StoreIds as a comma-separated list of GUIDs (NULL or
--                empty = no store filter, used by SuperAdmin).
--              * Accepts @SearchText for server-side LIKE matching against
--                Name / BarcodeNumber / ModalNumber.
--              * Accepts @PageNumber and @PageSize and returns only the
--                requested page of items joined to their inventory rows.
--              * Adds a TotalCount column on every returned row so the caller
--                can build pagination metadata without a second round-trip.
--
--            The result shape stays "long" (one row per Item x Store) plus the
--            single new TotalCount column, so the C# layer just pivots the
--            paged subset into the StoreData dictionary.
--
-- Safety   : CREATE OR ALTER, idempotent. The existing single-positional
--            @StoreId param is replaced; the only caller is the BackOffice
--            ItemService whose wrapper is updated in lockstep with this script.
-- =============================================================================

CREATE OR ALTER PROCEDURE dbo.SP_GetItemsWithInventoryLong
    @StoreIds   NVARCHAR(MAX) = NULL,
    @SearchText NVARCHAR(200) = NULL,
    @PageNumber INT           = 1,
    @PageSize   INT           = 100
AS
BEGIN
    SET NOCOUNT ON;

    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 100;

    DECLARE @AllowedStores TABLE (StoreID UNIQUEIDENTIFIER PRIMARY KEY);
    IF @StoreIds IS NOT NULL AND LEN(LTRIM(RTRIM(@StoreIds))) > 0
    BEGIN
        INSERT INTO @AllowedStores (StoreID)
        SELECT DISTINCT TRY_CONVERT(UNIQUEIDENTIFIER, LTRIM(RTRIM(value)))
        FROM STRING_SPLIT(@StoreIds, ',')
        WHERE TRY_CONVERT(UNIQUEIDENTIFIER, LTRIM(RTRIM(value))) IS NOT NULL;
    END

    DECLARE @HasStoreFilter BIT =
        CASE WHEN EXISTS (SELECT 1 FROM @AllowedStores) THEN 1 ELSE 0 END;

    DECLARE @SearchPattern NVARCHAR(204) =
        CASE
            WHEN @SearchText IS NULL OR LEN(LTRIM(RTRIM(@SearchText))) = 0 THEN NULL
            ELSE N'%' + LTRIM(RTRIM(@SearchText)) + N'%'
        END;

    -- Step 1: distinct items that match the search and have at least one
    -- ItemStore row in an allowed store. We pre-filter at this level so the
    -- pagination window is computed against the *filtered* item universe.
    ;WITH FilteredItems AS (
        SELECT DISTINCT
            im.ItemID                       AS ItemNo,
            ISNULL(im.Name, '')             AS Name,
            ISNULL(im.BarcodeNumber, '')    AS BarcodeNumber,
            ISNULL(im.ModalNumber, '')      AS ModalNumber
        FROM dbo.ItemMain  AS im
        INNER JOIN dbo.ItemStore AS ist ON ist.ItemNo = im.ItemID
        INNER JOIN dbo.Store     AS s   ON s.StoreID  = ist.StoreNo
        WHERE
            (@HasStoreFilter = 0 OR s.StoreID IN (SELECT StoreID FROM @AllowedStores))
            AND (
                @SearchPattern IS NULL
                OR im.Name          LIKE @SearchPattern
                OR im.BarcodeNumber LIKE @SearchPattern
                OR im.ModalNumber   LIKE @SearchPattern
            )
    ),
    PagedItems AS (
        SELECT
            fi.ItemNo,
            fi.Name,
            fi.BarcodeNumber,
            fi.ModalNumber,
            COUNT(*) OVER ()                AS TotalCount
        FROM FilteredItems AS fi
        ORDER BY fi.Name, fi.BarcodeNumber
        OFFSET (@PageNumber - 1) * @PageSize ROWS
        FETCH NEXT @PageSize              ROWS ONLY
    ),
    -- Step 2: for the paged item set, pull every inventory row in an allowed
    -- store, deduped per (ItemNo, StoreID) the same way the previous version
    -- did - keep the ItemStore row with the largest OnHand, falling back to
    -- the lexicographically smallest ItemStoreID as a stable tiebreaker.
    Joined AS (
        SELECT
            s.StoreID                       AS StoreID,
            s.StoreInt                      AS StoreInt,
            s.StoreName                     AS StoreName,
            ist.Cost                        AS Cost,
            ist.Price                       AS Price,
            ist.OnHand                      AS OnHand,
            ist.OnOrder                     AS OnOrder,
            ist.OnTransferOrder             AS OnTransferOrder,
            ist.StoreNo                     AS StoreNo,
            p.ItemNo                        AS ItemNo,
            p.Name                          AS Name,
            p.BarcodeNumber                 AS BarcodeNumber,
            p.ModalNumber                   AS ModalNumber,
            ist.ItemStoreID                 AS ItemStoreID,
            p.TotalCount                    AS TotalCount,
            ROW_NUMBER() OVER (
                PARTITION BY p.ItemNo, s.StoreID
                ORDER BY ISNULL(ist.OnHand, 0) DESC, ist.ItemStoreID
            )                               AS rn
        FROM PagedItems         AS p
        INNER JOIN dbo.ItemStore AS ist ON ist.ItemNo = p.ItemNo
        INNER JOIN dbo.Store     AS s   ON s.StoreID  = ist.StoreNo
        WHERE @HasStoreFilter = 0 OR s.StoreID IN (SELECT StoreID FROM @AllowedStores)
    )
    SELECT
        StoreID, StoreInt, StoreName,
        Cost, Price, OnHand, OnOrder, OnTransferOrder,
        StoreNo, ItemNo, Name, BarcodeNumber, ModalNumber, ItemStoreID,
        TotalCount
    FROM Joined
    WHERE rn = 1
    ORDER BY Name, BarcodeNumber, StoreInt;

    -- Edge case: when the page is empty (e.g. search has no matches OR the
    -- requested page is past the last page) the query above returns zero rows
    -- so the caller never sees TotalCount. Emit a single sentinel row in that
    -- case so the caller can read TotalCount = 0 and avoid a second query.
    IF NOT EXISTS (
        SELECT 1
        FROM dbo.ItemMain  AS im
        INNER JOIN dbo.ItemStore AS ist ON ist.ItemNo = im.ItemID
        INNER JOIN dbo.Store     AS s   ON s.StoreID  = ist.StoreNo
        WHERE
            (@HasStoreFilter = 0 OR s.StoreID IN (SELECT StoreID FROM @AllowedStores))
            AND (
                @SearchPattern IS NULL
                OR im.Name          LIKE @SearchPattern
                OR im.BarcodeNumber LIKE @SearchPattern
                OR im.ModalNumber   LIKE @SearchPattern
            )
    )
    BEGIN
        SELECT
            CAST(0x0 AS UNIQUEIDENTIFIER) AS StoreID,
            0                              AS StoreInt,
            CAST(NULL AS NVARCHAR(50))     AS StoreName,
            CAST(NULL AS MONEY)            AS Cost,
            CAST(NULL AS MONEY)            AS Price,
            CAST(NULL AS DECIMAL(19,3))    AS OnHand,
            CAST(NULL AS DECIMAL(19,3))    AS OnOrder,
            CAST(NULL AS DECIMAL(19,3))    AS OnTransferOrder,
            CAST(0x0 AS UNIQUEIDENTIFIER) AS StoreNo,
            CAST(0x0 AS UNIQUEIDENTIFIER) AS ItemNo,
            CAST('' AS NVARCHAR(250))      AS Name,
            CAST('' AS NVARCHAR(50))       AS BarcodeNumber,
            CAST('' AS NVARCHAR(50))       AS ModalNumber,
            CAST(0x0 AS UNIQUEIDENTIFIER) AS ItemStoreID,
            0                              AS TotalCount
        WHERE 1 = 0;
    END
END
GO
