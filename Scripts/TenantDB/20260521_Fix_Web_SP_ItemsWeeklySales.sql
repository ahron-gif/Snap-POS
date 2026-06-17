-- ============================================================================================
-- 20260521_Fix_Web_SP_ItemsWeeklySales.sql
--
-- Fixes a long-standing concatenation bug in [dbo].[Web_SP_ItemsWeeklySales].
--
-- The previous EXEC line was:
--     EXEC (@ItemSelect + @ItemFilter + @CustomerSelect + @CustomerFilter
--         + @FirstDayOfWeek + @StoreIdStr + @MySelect + @MyWhere + @Filter + @MyGroupBy
--         + @Paged + @Cleanup);
--
-- But @Paged already contains @MySelect + @MyWhere + @Filter + @MyGroupBy (via @Inner).
-- So those four pieces were being emitted TWICE — the first time inline (right after
-- @StoreIdStr), and again inside @Paged's FROM (...) AS PagedQ.
--
-- @MySelect begins with a leading single quote ('), designed to close the open string
-- started by @FirstDayOfWeek ('... StoreID = ''). Inside @Paged's nested usage, that
-- leading quote has no companion opening — SQL Server reports:
--   "Unclosed quotation mark after the character string ') IS NOT NULL DROP TABLE #ItemSelect;'"
--   "Incorrect syntax near ' and OptionID = '"
--
-- This script rewrites the SP cleanly:
--   • @MySelect no longer starts with the awkward "' and OptionID = ''131'')" prefix —
--     the StoreID-closing fragment moves into its own @FirstDayOfWeekClose variable.
--   • EXEC concatenates @ItemSelect + ... + @FirstDayOfWeek + @StoreIdStr +
--     @FirstDayOfWeekClose + @Paged + @Cleanup. No duplication.
--   • @Paged still emits @Inner = @MySelect + @MyWhere + @Filter + @MyGroupBy inside its
--     PagedQ subquery, exactly once, with balanced quotes.
--
-- Output columns are unchanged so the existing ItemWeeklySalesRowDto / pivot reshaper
-- continue to work without any C# changes.
-- ============================================================================================

IF OBJECT_ID('[dbo].[Web_SP_ItemsWeeklySales]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_ItemsWeeklySales];
GO

CREATE PROCEDURE [dbo].[Web_SP_ItemsWeeklySales]
(
    @Filter         NVARCHAR(4000),
    @StoreID        UNIQUEIDENTIFIER,
    @ItemFilter     NVARCHAR(4000),
    @CustomerFilter NVARCHAR(4000),
    @TableName      NVARCHAR(4000),
    @PageNumber     INT = 1,
    @PageSize       INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    -- Temp-table scaffolding (built up + appended into the dynamic SQL below)
    DECLARE @ItemSelect     NVARCHAR(4000) = N' Select Distinct ItemStoreID Into #ItemSelect From ItemsRepFilter Where (1=1) ';
    DECLARE @CustomerSelect NVARCHAR(4000) = N'';
    DECLARE @MyWhere        NVARCHAR(4000);

    IF @CustomerFilter <> ''
    BEGIN
        SET @CustomerSelect = N' Select CustomerID Into #CustomerSelect From CustomerRepFilter Where (1=1) ';
        SET @MyWhere = N' where (1=1) And exists (Select 1 From #CustomerSelect where CustomerID = transactionentryitem.CustomerID) ';
    END
    ELSE
        SET @MyWhere = N' where (1=1) ';

    -- @FirstDayOfWeek opens a string literal that ends in the StoreID; @FirstDayOfWeekClose
    -- closes it and finishes the DECLARE...SET statement. Concatenating them around the
    -- StoreID string gives us a complete preamble that initialises @FirstDayOfWeek for
    -- the SELECT to use via dbo.GetFirstDayOfWeek(StartSaleTime, @FirstDayOfWeek).
    DECLARE @FirstDayOfWeek      NVARCHAR(4000) =
        N' declare @FirstDayOfWeek Smallint set @FirstDayOfWeek = (Select Top 1 OptionValue From SetupValues Where StoreID = ''';
    DECLARE @FirstDayOfWeekClose NVARCHAR(100) =
        N''' and OptionID = ''131'') ';

    -- Standalone select fragment — no longer carries the StoreID-closing leading quote.
    DECLARE @MySelect NVARCHAR(MAX) =
        N'
        Select Sum(Qty) as Qty,
               Sum(TotalAfterDiscount) as ExtPrice,
               [Name] as ItemName,
               ItemID as ItemNo,
               BarcodeNumber,
               dbo.GetFirstDayOfWeek(StartSaleTime, @FirstDayOfWeek) as WeekNumber,
               isnull(Department, ''[NO DEPARTMENT]'') as Department,
               DepartmentID
        From dbo.' + @TableName + N' INNER JOIN #ItemSelect ON ' + @TableName + N'.ItemStoreID = #ItemSelect.ItemStoreID ';

    DECLARE @MyGroupBy NVARCHAR(4000) =
        N' Group By [Name], dbo.GetFirstDayOfWeek(StartSaleTime, @FirstDayOfWeek), Department, ItemID, DepartmentID, BarcodeNumber ';

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @MyWhere + @Filter + @MyGroupBy;

    DECLARE @Paged NVARCHAR(MAX) =
        N'; SELECT *, COUNT(*) OVER() AS TotalRecords,
                     SUM(CAST(Qty      AS DECIMAL(19,4))) OVER() AS GrandTotalQty,
                     SUM(CAST(ExtPrice AS DECIMAL(19,4))) OVER() AS GrandTotalAmount
           FROM (' + @Inner + N') AS PagedQ
           ORDER BY WeekNumber DESC, Department, ItemName
           OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    DECLARE @Cleanup NVARCHAR(400) =
        N' IF OBJECT_ID(N''tempdb.dbo.#ItemSelect'', N''U'') IS NOT NULL DROP TABLE #ItemSelect;' +
        CASE WHEN @CustomerFilter <> '' THEN N' IF OBJECT_ID(N''tempdb.dbo.#CustomerSelect'', N''U'') IS NOT NULL DROP TABLE #CustomerSelect;' ELSE N'' END;

    DECLARE @StoreIdStr NVARCHAR(50) = CAST(@StoreID AS NVARCHAR(50));

    -- Single, clean concatenation — no duplicated fragments.
    EXEC (
        @ItemSelect + @ItemFilter
      + @CustomerSelect + @CustomerFilter
      + @FirstDayOfWeek + @StoreIdStr + @FirstDayOfWeekClose
      + @Paged
      + @Cleanup
    );
END
GO
