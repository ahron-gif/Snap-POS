-- ============================================================
-- SP_GetPriceChange - Added pagination support
-- Backward compatible: @PageNumber/@PageSize are optional.
-- When NULL (old system), returns all data as before.
-- When provided (new web app), returns COUNT as 1st result set
-- then paginated data as 2nd result set for quick response.
-- ============================================================

IF OBJECT_ID('[dbo].[SP_GetPriceChange]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[SP_GetPriceChange];
GO

CREATE PROCEDURE [dbo].[SP_GetPriceChange]
(@Filter nvarchar(4000),
 @ItemFilter nvarchar(4000),
 @PageNumber int = NULL,
 @PageSize int = NULL)
AS
DECLARE @MySelect nvarchar(4000)
DECLARE @ItemSelect nvarchar(4000)
DECLARE @PaginatedSQL nvarchar(max)
DECLARE @Offset int

Set @ItemSelect='Select DISTINCT ItemStoreID
                  Into #ItemSelect
                  From ItemsRepFilter
                  Where (1=1) '

set @MySelect='SELECT PriceChangeHistory.ItemStoreID, ItemMainAndStoreView.ItemID, PriceChangeHistory.PriceLevel, PriceChangeHistory.OldPrice, PriceChangeHistory.NewPrice,
                      PriceChangeHistory.Date AS ChangeDate, PriceChangeHistory.SaleDate, PriceChangeHistory.SaleType, PriceChangeHistory.SP_Price,
                      ItemMainAndStoreView.Department, ItemMainAndStoreView.Name, ItemMainAndStoreView.ModalNumber, ItemMainAndStoreView.BarcodeNumber,
                      ItemMainAndStoreView.Brand, tmpUsers.UserName
FROM PriceChangeHistory INNER JOIN
     ItemMainAndStoreView ON PriceChangeHistory.ItemStoreID = ItemMainAndStoreView.ItemStoreID INNER JOIN
     (SELECT UserId AS MyUserID, UserName FROM Users) AS tmpUsers ON PriceChangeHistory.UserID = tmpUsers.MyUserID'

-- Create temp table
Execute (@ItemSelect + @ItemFilter)

-- Pagination: when @PageNumber/@PageSize provided, return count first then paginated data
-- When NULL, return all data (backward compatible with old system)
IF @PageNumber IS NOT NULL AND @PageSize IS NOT NULL AND @PageSize > 0
BEGIN
    SET @PaginatedSQL = 'SELECT COUNT(*) AS TotalRecords FROM (' + @MySelect + @Filter + ') AS CountQ'
    Execute (@PaginatedSQL)

    SET @Offset = (@PageNumber - 1) * @PageSize
    SET @PaginatedSQL = @MySelect + @Filter + ' ORDER BY PriceChangeHistory.Date DESC OFFSET ' + CAST(@Offset AS varchar(10)) + ' ROWS FETCH NEXT ' + CAST(@PageSize AS varchar(10)) + ' ROWS ONLY'
    Execute (@PaginatedSQL)
END
ELSE
BEGIN
    Execute (@MySelect + @Filter)
END

IF OBJECT_ID(N'tempdb.dbo.#ItemSelect', N'U') IS NOT NULL
    DROP TABLE #ItemSelect
