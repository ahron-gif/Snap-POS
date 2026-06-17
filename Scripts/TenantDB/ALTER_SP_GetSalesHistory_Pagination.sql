-- ============================================================
-- SP_GetSalesHistory - Added pagination support
-- Backward compatible: @PageNumber/@PageSize are optional.
-- When NULL (old system), returns all data as before.
-- When provided (new web app), returns COUNT as 1st result set
-- then paginated data as 2nd result set for quick response.
-- Also fixed: IsPOS=0 branch column names (Status/Total/UOMPrice)
-- ============================================================


IF OBJECT_ID('[dbo].[SP_GetSalesHistory]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[SP_GetSalesHistory];
GO

CREATE PROCEDURE [dbo].[SP_GetSalesHistory]
(@Filter nvarchar(4000),
 @IsPOS bit = 1,
 @ItemStoreID uniqueidentifier = null,
 @MainStore bit = 0,
 @Stores Guid_list_tbltype READONLY,
 @PageNumber int = NULL,
 @PageSize int = NULL)
AS
DECLARE @MySelect nvarchar(4000)
DECLARE @CountSQL nvarchar(max)
DECLARE @Offset int

IF @MainStore = 1
BEGIN
    SET @MySelect=
       'SELECT TransactionNo, TransactionType, TransactionID, StartSaleTime, StartSaleTime As SaleTime, TotalAfterDiscount,
              QtyCase, Qty, Price, ExtPrice AS Total, StoreName, CustomerNo, Type, [Customer Name]
        FROM HistoryView '
    SET @ItemStoreID = (SELECT ItemNo FROM ItemStore WHERE ItemStoreID = @ItemStoreID AND Status > 0)
    SET @Filter = @Filter + ' AND ItemStoreID IN (SELECT ItemStoreID FROM ItemStore WHERE 1=1 AND ItemNo =''' + CAST(@ItemStoreID AS varchar(50)) + ''')'
END
ELSE
BEGIN
    IF @IsPOS = 1
    BEGIN
        SET @MySelect=
           'SELECT TransactionNo, TransactionType, TransactionID, StartSaleTime, StartSaleTime As SaleTime, TotalAfterDiscount,
                   QtyCase, Qty, Price, ExtPrice AS Total, StoreName, CustomerNo, Type, [Customer Name]
            FROM HistoryView '
    END
    ELSE
    BEGIN
        SET @MySelect=
           'SELECT TransactionNo, TransactionType, TransactionID, StartSaleTime,
                   ItemStoreID, UOMQty, ExtPrice AS Total,
                   Price, StartSaleTime As SaleTime, QtyCase, StoreName, CustomerNo, Type, [Customer Name], TotalAfterDiscount
            FROM HistoryView '
    END

    IF NOT EXISTS (SELECT 1 FROM @Stores) OR (SELECT COUNT(*) FROM @Stores) <= 1
    BEGIN
        SET @Filter = @Filter + ' AND ItemStoreID =''' + CAST(@ItemStoreID AS varchar(50)) + ''''
    END
    ELSE
    BEGIN
        DECLARE @ItemId uniqueidentifier
        SELECT @ItemId = ItemStore.ItemNo
        FROM ItemStore
        WHERE ItemStore.ItemStoreID = @ItemStoreID
        SET @Filter = @Filter + ' AND ItemID =''' + CAST(@ItemId AS varchar(50)) + ''''
        SET @Filter = @Filter + ' AND StoreID IN (SELECT n FROM @Stores)'
    END
END

SET @MySelect = @MySelect + @Filter

-- Pagination: when @PageNumber/@PageSize provided, return count first then paginated data
-- When NULL, return all data (backward compatible with old system)
IF @PageNumber IS NOT NULL AND @PageSize IS NOT NULL AND @PageSize > 0
BEGIN
    SET @CountSQL = N'SELECT COUNT(*) AS TotalRecords FROM (' + @MySelect + N') AS CountQ'
    EXEC sp_executesql @query=@CountSQL, @params=N'@Stores Guid_list_tbltype READONLY', @Stores=@Stores

    SET @Offset = (@PageNumber - 1) * @PageSize
    SET @MySelect = @MySelect + N' ORDER BY StartSaleTime DESC OFFSET ' + CAST(@Offset AS nvarchar(10)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS nvarchar(10)) + N' ROWS ONLY'
    EXEC sp_executesql @query=@MySelect, @params=N'@Stores Guid_list_tbltype READONLY', @Stores=@Stores
END
ELSE
BEGIN
    EXEC sp_executesql @query=@MySelect, @params=N'@Stores Guid_list_tbltype READONLY', @Stores=@Stores
END
