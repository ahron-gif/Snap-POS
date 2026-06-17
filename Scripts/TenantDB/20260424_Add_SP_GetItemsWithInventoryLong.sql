-- =============================================================================
-- Migration: add dbo.SP_GetItemsWithInventoryLong
-- Date     : 2026-04-24
-- Purpose  : The existing dbo.SP_GetItemsWithInventory was rewritten at some
--            point to emit a pivoted (wide) result set with _N-suffixed
--            columns (Cost_1, Price_1, OnHand_1, ... Cost_2, ...). That shape
--            is incompatible with the EF scaffold SP_GetItemsWithInventoryResult
--            which expects ONE row per (Item × Store) with a single set of
--            columns: StoreID, StoreInt, StoreName, Cost, Price, OnHand,
--            OnOrder, OnTransferOrder, StoreNo, ItemNo, Name, BarcodeNumber,
--            ModalNumber, ItemStoreID.
--
--            This script introduces a NEW stored procedure that returns the
--            long (unpivoted) format the ItemService expects. The original
--            pivoted SP is left entirely untouched — no other DB object
--            currently references it (verified via sys.dm_sql_referencing_entities
--            and sys.sql_modules full-text scan), but external consumers
--            (reports, BI tools) may still depend on the wide format.
--
-- Safety   : CREATE OR ALTER means this script is idempotent — safe to run
--            against any tenant DB, repeatedly. It does not drop, rename, or
--            modify SP_GetItemsWithInventory.
-- =============================================================================

CREATE OR ALTER PROCEDURE dbo.SP_GetItemsWithInventoryLong
    @StoreId NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Convert @StoreId to a uniqueidentifier once. NULL / empty / malformed
    -- all collapse to NULL which the final WHERE treats as "all stores".
    DECLARE @StoreGuid UNIQUEIDENTIFIER = NULL;
    IF @StoreId IS NOT NULL AND LEN(LTRIM(RTRIM(@StoreId))) = 36
    BEGIN
        BEGIN TRY
            SET @StoreGuid = CONVERT(UNIQUEIDENTIFIER, @StoreId);
        END TRY
        BEGIN CATCH
            SET @StoreGuid = NULL;
        END CATCH
    END

    SELECT
        s.StoreID                     AS StoreID,
        s.StoreInt                    AS StoreInt,
        s.StoreName                   AS StoreName,
        ist.Cost                      AS Cost,
        ist.Price                     AS Price,
        ist.OnHand                    AS OnHand,
        ist.OnOrder                   AS OnOrder,
        ist.OnTransferOrder           AS OnTransferOrder,
        ist.StoreNo                   AS StoreNo,
        ist.ItemNo                    AS ItemNo,
        ISNULL(im.Name, '')           AS Name,
        ISNULL(im.BarcodeNumber, '')  AS BarcodeNumber,
        ISNULL(im.ModalNumber, '')    AS ModalNumber,
        ist.ItemStoreID               AS ItemStoreID
    FROM dbo.ItemStore AS ist
    INNER JOIN dbo.ItemMain AS im ON im.ItemID  = ist.ItemNo
    INNER JOIN dbo.Store    AS s  ON s.StoreID  = ist.StoreNo
    WHERE (@StoreGuid IS NULL OR s.StoreID = @StoreGuid)
    ORDER BY s.StoreInt, im.Name;
END
GO
