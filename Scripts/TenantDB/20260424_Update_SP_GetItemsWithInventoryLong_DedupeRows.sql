-- =============================================================================
-- Migration: ensure dbo.SP_GetItemsWithInventoryLong returns at most ONE row
--            per (ItemNo, StoreID).
-- Date     : 2026-04-24
-- Purpose  : Callers build a dictionary keyed by StoreName. If any tenant DB
--            has two Store rows sharing the same StoreName (e.g. parent/child
--            stores) or duplicate ItemStore rows for the same (ItemNo, StoreNo),
--            the SP can produce duplicate keys — which makes C# ToDictionary
--            throw "An item with the same key has already been added."
--
--            This update adds a ROW_NUMBER()-based dedupe so that each
--            (ItemNo, StoreID) combination produces exactly one result row.
--            When duplicate ItemStore rows exist for the same pair, we keep
--            the row with the largest OnHand (falling back to ItemStoreID)
--            so the displayed numbers match the primary inventory record.
--
-- Safety   : CREATE OR ALTER — idempotent, re-runnable. Only touches the
--            `_Long` variant introduced earlier; the original pivoted SP is
--            never modified.
-- =============================================================================

CREATE OR ALTER PROCEDURE dbo.SP_GetItemsWithInventoryLong
    @StoreId NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;

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

    ;WITH ranked AS (
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
            ist.ItemStoreID               AS ItemStoreID,
            -- Dedupe: keep the single "best" ItemStore row per (ItemNo, StoreID).
            -- Preference order: highest OnHand first, then the lexicographically
            -- smallest ItemStoreID as a stable tiebreaker.
            ROW_NUMBER() OVER (
                PARTITION BY ist.ItemNo, s.StoreID
                ORDER BY ISNULL(ist.OnHand, 0) DESC, ist.ItemStoreID
            ) AS rn
        FROM dbo.ItemStore AS ist
        INNER JOIN dbo.ItemMain AS im ON im.ItemID  = ist.ItemNo
        INNER JOIN dbo.Store    AS s  ON s.StoreID  = ist.StoreNo
        WHERE (@StoreGuid IS NULL OR s.StoreID = @StoreGuid)
    )
    SELECT
        StoreID, StoreInt, StoreName,
        Cost, Price, OnHand, OnOrder, OnTransferOrder,
        StoreNo, ItemNo, Name, BarcodeNumber, ModalNumber, ItemStoreID
    FROM ranked
    WHERE rn = 1
    ORDER BY StoreInt, Name;
END
GO
