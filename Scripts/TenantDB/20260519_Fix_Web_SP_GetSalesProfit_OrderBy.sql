-- ================================================================================================
-- Fix: Web_SP_GetSalesProfit ORDER BY referenced 'StartSaleTime', which does not exist on
-- dbo.SalesProfitView (the view exposes a 'Date' column instead). The bad ORDER BY caused:
--     500 — "Failed to generate Sales Summary By Transaction report:
--            Invalid column name 'StartSaleTime'."
-- whenever the Sales Summary By Transaction report endpoint was hit.
--
-- Only the OUTER ORDER BY clause inside the paged subquery is changed — every other line is
-- preserved verbatim from 20260514_WebReports_PaginationSPs.sql so this migration can be
-- re-run safely.
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetSalesProfit]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetSalesProfit];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetSalesProfit]
(
    @Filter         NVARCHAR(MAX),
    @CustomerFilter NVARCHAR(MAX),
    @OldTransaction BIT = 0,
    @PageNumber     INT = 1,
    @PageSize       INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    DECLARE @MyWhere        NVARCHAR(MAX) = N'';
    DECLARE @CustomerSelect NVARCHAR(MAX) = N'';

    IF @CustomerFilter <> ''
    BEGIN
        SET @CustomerSelect = N' Select CustomerID Into #CustomerSelect From CustomerRepFilter Where (1=1) ';
        SET @MyWhere = N' and exists (Select 1 From #CustomerSelect where CustomerID = SalesProfitView.CustomerID) ';
    END

    DECLARE @MySelect NVARCHAR(MAX) = N'SELECT * FROM dbo.SalesProfitView WHERE 1=1 ';

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @Filter + @MyWhere;

    -- Fixed: order by [Date] (the view's transaction date column) instead of the non-existent
    -- StartSaleTime. The C# caller filters using `Date >= ...` / `Date <= ...` and reads back
    -- a `Date` ordinal from the result, so this column is always present.
    DECLARE @Paged NVARCHAR(MAX) =
        N'; SELECT *, COUNT(*) OVER() AS TotalRecords FROM (' + @Inner + N') AS PagedQ
           ORDER BY [Date] DESC
           OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    DECLARE @Cleanup NVARCHAR(200) =
        CASE WHEN @CustomerFilter <> '' THEN N' IF OBJECT_ID(N''tempdb.dbo.#CustomerSelect'', N''U'') IS NOT NULL DROP TABLE #CustomerSelect;' ELSE N'' END;

    EXEC (@CustomerSelect + @CustomerFilter + @Paged + @Cleanup);
END
GO
