/* =============================================================================
   20260529_Index_ItemStore_ForSaleItemsFilter.sql

   Companion to 20260528_Index_ItemSpecial_ForSaleItemsFilter.sql.

   Why this script
   ---------------
   The view dbo.ItemMainAndStoreGrid projects two columns the BackOffice
   Item List uses to detect "on sale" items:

       [SP Price]        -- CASE expression over ItemStoreView columns
                            (SaleType / SalePrice / SpecialBuy / SpecialPrice /
                            SaleStartDate / SaleEndDate / AssignDate / MixAndMatchID)
       [Future SP Price] -- CASE expression over ItemSpecialView columns

   The yesterday script (20260528_*) covered [Future SP Price] by indexing
   dbo.ItemSpecial. But all currently on-sale rows in this database derive
   their on-sale status from [SP Price], which is computed from dbo.ItemStore
   columns. So we also need a filtered index on dbo.ItemStore.

   When the predicate
       [SP Price] IS NOT NULL AND [SP Price] <> ''
   is evaluated, it's effectively equivalent to
       ItemStore.SaleType IN (1, 2, 3, 4, 5, 6, 11, 12, 13, 18)
   plus various date / AssignDate checks. SaleType is overwhelmingly 0 for
   the catalog (no sale), so filtering on SaleType > 0 produces a tiny
   index covering only the on-sale rows.

   Diagnostic step (read-only) is included at the top so you can confirm
   coverage before creating the index.
   ============================================================================= */


/* -----------------------------------------------------------------------------
   STEP 1 -- Diagnostic. READ-ONLY. Run this first.
   ----------------------------------------------------------------------------- */

PRINT '--- Distribution of ItemStore.SaleType (expect: vast majority = 0) ---';
SELECT  SaleType
FROM    dbo.ItemStore
GROUP   BY SaleType
ORDER   BY SaleType;

PRINT '--- Coverage check: rows the new predicate would index vs. rows the view treats as on-sale ---';
SELECT
    rows_matching_predicate =
        (SELECT COUNT_BIG(*) FROM dbo.ItemStore WHERE SaleType > 0),
    on_sale_view_rows =
        (SELECT COUNT_BIG(*) FROM dbo.ItemMainAndStoreGrid v
         WHERE  (v.[SP Price]        IS NOT NULL AND v.[SP Price]        <> '')
            OR  (v.[Future SP Price] IS NOT NULL AND v.[Future SP Price] <> ''));

GO


/* -----------------------------------------------------------------------------
   STEP 2 -- DDL. Run after confirming Step 1 looks sane.
   ----------------------------------------------------------------------------- */

SET ANSI_NULLS, QUOTED_IDENTIFIER, ANSI_PADDING, ANSI_WARNINGS, ARITHABORT, CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

IF EXISTS (SELECT 1 FROM sys.indexes
           WHERE  object_id = OBJECT_ID('dbo.ItemStore')
             AND  name      = 'IX_ItemStore_OnSale')
    DROP INDEX IX_ItemStore_OnSale ON dbo.ItemStore;
GO

/* Keyed on ItemStoreID so the optimizer can use this index as a lookup
   driver from the upstream EF pre-filter (WHERE x.ItemStoreID IN (...)),
   and as a seek when the view's join brings in ItemStoreID.
   INCLUDE covers every column the [SP Price] CASE expression touches so
   the index can satisfy the projection without a key lookup back to the
   base table. */
CREATE NONCLUSTERED INDEX IX_ItemStore_OnSale
ON dbo.ItemStore (ItemStoreID)
INCLUDE (SaleType, SalePrice, SpecialBuy, SpecialPrice,
         SaleStartDate, SaleEndDate, AssignDate, MixAndMatchID)
WHERE  SaleType > 0;
GO

PRINT 'IX_ItemStore_OnSale created.';
GO

UPDATE STATISTICS dbo.ItemStore WITH FULLSCAN;
GO


/* -----------------------------------------------------------------------------
   ROLLBACK
   -----------------------------------------------------------------------------
   IF EXISTS (SELECT 1 FROM sys.indexes
              WHERE object_id = OBJECT_ID('dbo.ItemStore')
                AND name      = 'IX_ItemStore_OnSale')
       DROP INDEX IX_ItemStore_OnSale ON dbo.ItemStore;
   ----------------------------------------------------------------------------- */
