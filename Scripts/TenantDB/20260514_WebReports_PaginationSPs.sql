-- ================================================================================================
-- Web_* report stored procedures with server-side pagination
-- ------------------------------------------------------------------------------------------------
-- Pattern applied to every SP (except 3 summary-style SPs noted in their headers):
--   * Same input parameters as the original SP, plus:
--       @PageNumber INT = 1
--       @PageSize   INT = 50
--   * Inner query is identical to the original (logic untouched).
--   * Final result set wraps the inner query as a derived table:
--       SELECT *, COUNT(*) OVER() AS TotalRecords
--       FROM (<inner>) X
--       ORDER BY <fixed default columns>
--       OFFSET (@PageNumber - 1) * @PageSize ROWS
--       FETCH NEXT @PageSize ROWS ONLY
--   * One result set; every row carries TotalRecords so the web layer reads it from row[0].
--
-- Non-paginated SPs (return all rows, still expose TotalRecords for shape uniformity):
--   * Web_Get_SummaryReport      — fixed multi-row summary
--   * Web_SP_GetRptZOut          — single batch row
--   * Web_SP_GetSubDepartments   — recursive tree
-- ================================================================================================

-- ================================================================================================
-- 1) Web_SP_GetTaxCollected
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetTaxCollected]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetTaxCollected];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetTaxCollected]
(
    @Filter         NVARCHAR(4000),
    @CustomerFilter NVARCHAR(4000),
    @PageNumber     INT = 1,
    @PageSize       INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    DECLARE @MyFirstSelectInto NVARCHAR(4000);
    DECLARE @MyFirstGroupBy    NVARCHAR(500);
    DECLARE @MyFirstWhere      NVARCHAR(4000);

    SET @MyFirstSelectInto = N'Select E.TransactionID, SUM(ISNULL(TotalAfterDiscount,Total)) AS TotalSale
Into #TempSales from TransactionEntry E WITH (NOLOCK) INNER JOIN [Transaction] T WITH (NOLOCK) ON E.TransactionID = T.TransactionID
Where (E.Status > 0) AND (E.TransactionEntryType <> 4) AND (E.TransactionEntryType <> 5) AND (T.Status > 0) AND ISNULL(E.Taxable,0) = 1 ';
    SET @MyFirstWhere   = REPLACE(@Filter, 'EndSaleTime', 'T.EndSaleTime');
    SET @MyFirstGroupBy = N' Group By E.TransactionID ';

    DECLARE @BaseFilter NVARCHAR(4000) = 'dbo.[Transaction].Status>0 AND dbo.[Transaction].Tax<>0 AND dbo.[Transaction].Tax is not null ';
    DECLARE @MyWhere        NVARCHAR(4000) = '';
    DECLARE @CustomerSelect NVARCHAR(4000) = '';

    IF @CustomerFilter <> ''
    BEGIN
        SET @CustomerSelect = N' Select CustomerID Into #CustomerSelect From CustomerRepFilter Where (1=1) ';
        SET @MyWhere = N' AND exists (Select 1 From #CustomerSelect where CustomerID = dbo.[Transaction].CustomerID) ';
    END;

    DECLARE @MySelect NVARCHAR(MAX);
    SET @MySelect = N'
      SELECT  dbo.[Transaction].TransactionID,
              dbo.[Transaction].TransactionNo,
              Sales.TotalSale,
              dbo.[Transaction].StartSaleTime AS [Date],
              dbo.[Transaction].Tax        AS TaxSum,
              dbo.[Transaction].TaxRate/100 AS TaxRate,
              dbo.Tax.TaxName,
              dbo.Customer.CustomerNo,
              CASE WHEN ISNULL(dbo.Customer.LastName,'''') <> '''' OR ISNULL(dbo.Customer.FirstName,'''') <> ''''
                   THEN ISNULL(dbo.Customer.LastName,'''') + '', '' + ISNULL(dbo.Customer.FirstName,'''')
                   ELSE '''' END AS CustomerName,
              dbo.[Transaction].StoreID,
              STUFF((SELECT DISTINCT '','' + Tender.TenderName
                     FROM TenderEntry INNER JOIN Tender ON TenderEntry.TenderID = Tender.TenderID
                     AND TenderEntry.TransactionID = dbo.[Transaction].TransactionID
                     AND TenderEntry.Status > 0 FOR XML PATH(''''), TYPE).value(''.'', ''varchar(max)''), 1, 1, '''') AS Payment
      FROM dbo.[Transaction] WITH (NOLOCK)
      INNER JOIN (Select * From #TempSales) AS Sales ON [Transaction].TransactionID = Sales.TransactionID
      INNER JOIN dbo.Tax ON dbo.Tax.TaxID = dbo.[Transaction].TaxID
      LEFT  JOIN dbo.Customer WITH (NOLOCK) ON dbo.[Transaction].CustomerID = dbo.Customer.CustomerID AND dbo.Customer.Status > 0
      WHERE ';

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @BaseFilter + @MyWhere + @Filter;

    DECLARE @Paged NVARCHAR(MAX) =
        N'; SELECT *, COUNT(*) OVER() AS TotalRecords,
                  SUM(CAST(TaxSum    AS DECIMAL(19,4))) OVER() AS GrandTotalTaxSum,
                  SUM(CAST(TotalSale AS DECIMAL(19,4))) OVER() AS GrandTotalSale
           FROM (' + @Inner + N') AS PagedQ
           ORDER BY [Date] DESC
           OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    DECLARE @Cleanup NVARCHAR(200) = N' IF OBJECT_ID(N''tempdb.dbo.#TempSales'', N''U'') IS NOT NULL DROP TABLE #TempSales;'
        + CASE WHEN @CustomerFilter <> '' THEN N' IF OBJECT_ID(N''tempdb.dbo.#CustomerSelect'', N''U'') IS NOT NULL DROP TABLE #CustomerSelect;' ELSE N'' END;

    EXEC (@MyFirstSelectInto + @MyFirstWhere + @MyFirstGroupBy + @CustomerSelect + @CustomerFilter + @Paged + @Cleanup);
END
GO

-- ================================================================================================
-- 2) Web_SP_GetTaxReprtByStore
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetTaxReprtByStore]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetTaxReprtByStore];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetTaxReprtByStore]
(
    @StartDate  DATETIME,
    @EndDate    DATETIME,
    @StoreID    UNIQUEIDENTIFIER = NULL,
    @PageNumber INT = 1,
    @PageSize   INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;
    DECLARE @EndDatePlusOne DATETIME = DATEADD(DAY, 1, @EndDate);

    ;WITH TaxableSales AS
    (
        SELECT TEF.TaxRate, TEF.StoreID,
               SUM(TEF.TotalAfterDiscount * TEF.TaxRate / 100) AS SalesTax,
               SUM(TEF.TotalAfterDiscount) AS TotalSales
        FROM TransactionEntryForTax AS TEF
        INNER JOIN [Transaction] AS T ON TEF.TransactionID = T.TransactionID AND T.Tax <> 0
        WHERE ISNULL(TEF.Taxable, 0) = 1
          AND ISNULL(TEF.TaxCollected, 0) <> 0
          AND TEF.EndSaleTime >= @StartDate
          AND TEF.EndSaleTime <  @EndDatePlusOne
          AND T.Status > 0
          AND (@StoreID IS NULL OR TEF.StoreID = @StoreID)
        GROUP BY TEF.TaxRate, TEF.StoreID
    ),
    NonTaxableSales AS
    (
        SELECT TEF.TaxRate, TEF.StoreID,
               SUM(T.Tax) AS SalesTax,
               SUM(TEF.TotalAfterDiscount) AS TotalSales
        FROM TransactionEntryForTax AS TEF
        INNER JOIN [Transaction] AS T ON TEF.TransactionID = T.TransactionID
        WHERE ISNULL(TEF.TaxCollected, 0) = 0
          AND TEF.EndSaleTime >= @StartDate
          AND TEF.EndSaleTime <  @EndDatePlusOne
          AND T.Status > 0
          AND (@StoreID IS NULL OR TEF.StoreID = @StoreID)
        GROUP BY TEF.TaxRate, TEF.StoreID
    ),
    Inner_Q AS
    (
        SELECT Sales.StoreName,
               Sales.TaxRate,
               SUM(Sales.TotalAfterDiscount) AS TotalSales,
               ISNULL(Taxable.TotalSales, 0) AS TaxableSales,
               CASE WHEN (SUM(Sales.TotalAfterDiscount) - ISNULL(Taxable.TotalSales, 0) - ISNULL(NotTaxable.TotalSales, 0)) > 0
                    THEN SUM(Sales.TotalAfterDiscount) - ISNULL(Taxable.TotalSales, 0) - ISNULL(NotTaxable.TotalSales, 0)
                    ELSE 0 END AS TotalExempt,
               ISNULL(NotTaxable.TotalSales, 0) AS NonTaxableSales,
               ISNULL(Taxable.SalesTax, 0)      AS Tax
        FROM TransactionEntryItem AS Sales
        LEFT JOIN TaxableSales    AS Taxable    ON Sales.StoreID = Taxable.StoreID    AND Sales.TaxRate = Taxable.TaxRate
        LEFT JOIN NonTaxableSales AS NotTaxable ON Sales.StoreID = NotTaxable.StoreID AND Sales.TaxRate = NotTaxable.TaxRate
        WHERE Sales.EndSaleTime >= @StartDate
          AND Sales.EndSaleTime <  @EndDatePlusOne
          AND (@StoreID IS NULL OR Sales.StoreID = @StoreID)
        GROUP BY Sales.TaxRate, Sales.StoreID, Sales.StoreName, Taxable.TotalSales, NotTaxable.TotalSales, Taxable.SalesTax
    )
    SELECT *,
           COUNT(*) OVER() AS TotalRecords,
           SUM(CAST(TotalSales      AS DECIMAL(19,4))) OVER() AS GrandTotalSale,
           SUM(CAST(TaxableSales    AS DECIMAL(19,4))) OVER() AS GrandTotalTaxableSales,
           SUM(CAST(TotalExempt     AS DECIMAL(19,4))) OVER() AS GrandTotalExempt,
           SUM(CAST(NonTaxableSales AS DECIMAL(19,4))) OVER() AS GrandTotalNonTaxableSales,
           SUM(CAST(Tax             AS DECIMAL(19,4))) OVER() AS GrandTotalTaxSum
    FROM Inner_Q
    ORDER BY StoreName, TaxRate
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

-- ================================================================================================
-- 3) Web_SP_GetTendersCashier
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetTendersCashier]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetTendersCashier];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetTendersCashier]
(
    @StoreID       UNIQUEIDENTIFIER,
    @FromDate      DATETIME,
    @ToDate        DATETIME,
    @IncludePayOut BIT = 1,
    @TenderType    VARCHAR(250) = NULL,
    @CreditType    VARCHAR(250) = NULL,
    @PageNumber    INT = 1,
    @PageSize      INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    SET FMTONLY OFF;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    DECLARE @IsHeb BIT = 0;

    CREATE TABLE #CurrTender (TenderID INT NOT NULL, TenderType INT NULL, TenderName NVARCHAR(50) COLLATE Hebrew_CI_AS NULL, TenderGroup INT NULL);
    INSERT INTO #CurrTender (TenderID, TenderType, TenderName, TenderGroup)
    SELECT TenderID, TenderType,
           CASE WHEN @IsHeb = 0 THEN TenderName ELSE TenderNameHe END,
           TenderGroup
    FROM dbo.Tender WHERE TenderType <> 1;

    CREATE TABLE #CurrSystemValues (SystemTableNo BIGINT NOT NULL, SystemValueNo INT NOT NULL, SystemValueName NVARCHAR(50) COLLATE HEBREW_CI_AS);
    INSERT INTO #CurrSystemValues (SystemTableNo, SystemValueNo, SystemValueName)
    SELECT SystemTableNo, SystemValueNo,
           CASE WHEN @IsHeb = 0 THEN SystemValueName ELSE SystemValueNameHe END
    FROM SystemValues;

    CREATE TABLE #Tepm1
    (
        TransactionType INT, [Type] INT, Amount MONEY,
        TenderType NVARCHAR(50) COLLATE Hebrew_CI_AS,
        Cashier    NVARCHAR(50) COLLATE Hebrew_CI_AS,
        CreditType NVARCHAR(50) COLLATE Hebrew_CI_AS,
        TransactionID UNIQUEIDENTIFIER,
        CustomerID    UNIQUEIDENTIFIER NULL,
        TransactionNo NVARCHAR(50) COLLATE Hebrew_CI_AS,
        TenderDate    DATETIME,
        RegistersBackoffice INT,
        StoreID       UNIQUEIDENTIFIER,
        Common1       NVARCHAR(50)
    );

    CREATE TABLE #tentry
    (
        TenderID INT, Amount MONEY, UserCreated UNIQUEIDENTIFIER, Common3 NVARCHAR(50),
        TransactionID UNIQUEIDENTIFIER, CustomerID UNIQUEIDENTIFIER NULL,
        BatchID UNIQUEIDENTIFIER, StoreID UNIQUEIDENTIFIER, TransactionNo NVARCHAR(50),
        StartSaleTime DATETIME, RegisterTransaction BIT, Common1 NVARCHAR(50)
    );
    INSERT INTO #tentry
    SELECT TenderEntry.TenderID, TenderEntry.Amount, [Transaction].UserCreated,
           TenderEntry.Common3, [Transaction].TransactionID, [Transaction].CustomerID,
           [Transaction].BatchID, [Transaction].StoreID, [Transaction].TransactionNo,
           [Transaction].StartSaleTime, [Transaction].RegisterTransaction, TenderEntry.Common1
    FROM dbo.[Transaction] WITH (NOLOCK)
    INNER JOIN dbo.TenderEntry WITH (NOLOCK) ON TenderEntry.TransactionID = [Transaction].TransactionID
    WHERE [Transaction].EndSaleTime >= @FromDate
      AND [Transaction].EndSaleTime <= @ToDate
      AND [Transaction].Status > 0
      AND TenderEntry.TransactionType = 0
      AND TenderEntry.Status > 0;

    INSERT INTO #Tepm1
    SELECT 0, #CurrTender.TenderType, #tentry.Amount, #CurrTender.TenderName,
           ISNULL(createUser.UserName, cashierUser.UserName),
           SysVisa.SystemValueName,
           #tentry.TransactionID, #tentry.CustomerID, #tentry.TransactionNo, #tentry.StartSaleTime,
           CASE WHEN #tentry.RegisterTransaction = 1 THEN 1 ELSE 0 END,
           #tentry.StoreID, #tentry.Common1
    FROM #CurrTender
    INNER JOIN #tentry ON #tentry.TenderID = #CurrTender.TenderID
    LEFT JOIN Batch ON Batch.BatchID = #tentry.BatchID
    LEFT JOIN Users cashierUser ON cashierUser.UserId = Batch.CashierID
    LEFT JOIN Users createUser  ON createUser.UserId  = #tentry.UserCreated
    LEFT JOIN #CurrSystemValues SysVisa ON CAST(SysVisa.SystemValueNo AS NVARCHAR) = #tentry.Common3 AND SysVisa.SystemTableNo = 5 AND #tentry.TenderID = 3;

    CREATE TABLE #tentryCP (TenderID INT, Amount MONEY, TransactionID UNIQUEIDENTIFIER, TransactionType INT);
    INSERT INTO #tentryCP
    SELECT TenderID, Amount, TransactionID, TransactionType
    FROM dbo.TenderEntry WITH (NOLOCK)
    WHERE TransactionType > 0 AND Status > 0;

    IF @IncludePayOut = 1
    BEGIN
        INSERT INTO #Tepm1
        SELECT 1, 2, SUM(#tentryCP.Amount),
               (SELECT TenderName FROM #CurrTender WHERE TenderID = #tentryCP.TenderID),
               Users.UserName, NULL, #tentryCP.TransactionID, NULL,
               'Payout', PayOut.PayOutDate, 1, Registers.StoreID, ''
        FROM dbo.PayOut
        INNER JOIN dbo.Registers ON Registers.RegisterID = PayOut.RegisterID
        INNER JOIN #tentryCP ON #tentryCP.TransactionID = PayOut.PayOutID
        LEFT  JOIN dbo.Users ON Users.UserId = PayOut.ChasierID
        WHERE #tentryCP.TransactionType = 1 AND PayOut.PayOutDate > @FromDate AND PayOut.PayOutDate < @ToDate
        GROUP BY Users.UserId, Users.UserName, PayOut.PayOutDate, #tentryCP.TransactionID, Registers.StoreID, #tentryCP.TenderID;
    END

    INSERT INTO #Tepm1
    SELECT 2, 2, SUM(#tentryCP.Amount),
           (SELECT TenderName FROM #CurrTender WHERE TenderID = 1),
           Users.UserName, NULL, #tentryCP.TransactionID, NULL,
           'CashCheck', CashCheck.Date, 1, Batch.StoreID, ''
    FROM dbo.CashCheck
    INNER JOIN dbo.Batch ON Batch.BatchID = CashCheck.BatchID
    INNER JOIN #tentryCP ON #tentryCP.TransactionID = CashCheck.CashCheckID
    LEFT  JOIN dbo.Users ON Users.UserId = CashCheck.UserID
    WHERE #tentryCP.TenderID = 1 AND #tentryCP.TransactionType = 2 AND CashCheck.Date > @FromDate AND CashCheck.Date < @ToDate
    GROUP BY Users.UserId, Users.UserName, CashCheck.Date, #tentryCP.TransactionID, Batch.StoreID;

    INSERT INTO #Tepm1
    SELECT 2, 2, SUM(#tentryCP.Amount),
           (SELECT TenderName FROM #CurrTender WHERE TenderID = 2),
           Users.UserName, NULL, #tentryCP.TransactionID, NULL,
           'CashCheck', CashCheck.Date, 1, Batch.StoreID, ''
    FROM dbo.CashCheck
    INNER JOIN dbo.Batch ON Batch.BatchID = CashCheck.BatchID
    INNER JOIN #tentryCP ON #tentryCP.TransactionID = CashCheck.CashCheckID
    LEFT  JOIN dbo.Users ON Users.UserId = CashCheck.UserID
    WHERE #tentryCP.TenderID = 2 AND #tentryCP.TransactionType = 2 AND CashCheck.Date > @FromDate AND CashCheck.Date < @ToDate
    GROUP BY Users.UserId, Users.UserName, CashCheck.Date, #tentryCP.TransactionID, Batch.StoreID;

    ;WITH FinalQ AS
    (
        SELECT TransType.SystemValueName AS TransactionType,
               CASE WHEN #CurrSystemValues.SystemValueName = 'Cash' THEN 'Actual Cash' ELSE #CurrSystemValues.SystemValueName END AS [Type],
               Amount,
               #Tepm1.TenderType,
               Cashier,
               CreditType,
               TransactionID,
               CustomerNo,
               ISNULL(LastName, '') + ' ' + ISNULL(FirstName, '') AS CustomerName,
               TransactionNo,
               TenderDate,
               LocationType.SystemValueName AS RegistersBackoffice,
               Store.StoreName,
               #Tepm1.Common1
        FROM #Tepm1
        INNER JOIN dbo.Store ON Store.StoreID = #Tepm1.StoreID
        LEFT  JOIN dbo.Customer AS C ON #Tepm1.CustomerID = C.CustomerID
        LEFT  JOIN #CurrSystemValues ON #CurrSystemValues.SystemValueNo = [Type] AND #CurrSystemValues.SystemTableNo = 25
        LEFT  JOIN #CurrSystemValues TransType    ON TransType.SystemValueNo    = #Tepm1.TransactionType     AND TransType.SystemTableNo    = 41
        LEFT  JOIN #CurrSystemValues LocationType ON LocationType.SystemValueNo = #Tepm1.RegistersBackoffice AND LocationType.SystemTableNo = 40
        WHERE (@StoreID = '00000000-0000-0000-0000-000000000000' OR #Tepm1.StoreID = @StoreID)
          AND #Tepm1.TenderType = ISNULL(@TenderType, #Tepm1.TenderType)
          AND ISNULL(CreditType, '') = ISNULL(@CreditType, ISNULL(CreditType, ''))
    )
    SELECT *, COUNT(*) OVER() AS TotalRecords
    FROM FinalQ
    ORDER BY TenderDate DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

    DROP TABLE #tentry;
    DROP TABLE #tentryCP;
    DROP TABLE #Tepm1;
    DROP TABLE #CurrSystemValues;
    DROP TABLE #CurrTender;
END
GO

-- ================================================================================================
-- 4) Web_SP_GetTendersCashierTotal
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetTendersCashierTotal]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetTendersCashierTotal];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetTendersCashierTotal]
(
    @StoreID       UNIQUEIDENTIFIER,
    @FromDate      DATETIME,
    @ToDate        DATETIME,
    @IncludePayOut BIT = 1,
    @PageNumber    INT = 1,
    @PageSize      INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    SET FMTONLY OFF;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    DECLARE @IsHeb BIT = 0;

    CREATE TABLE #CurrTender (TenderID INT NOT NULL, TenderType INT NULL, TenderName NVARCHAR(50));
    INSERT INTO #CurrTender (TenderID, TenderType, TenderName)
    SELECT TenderID, TenderType,
           CASE WHEN @IsHeb = 0 THEN TenderName ELSE TenderNameHe END
    FROM Tender;

    CREATE TABLE #CurrSystemValues (SystemTableNo BIGINT NOT NULL, SystemValueNo INT NOT NULL, SystemValueName NVARCHAR(50));
    INSERT INTO #CurrSystemValues (SystemTableNo, SystemValueNo, SystemValueName)
    SELECT SystemTableNo, SystemValueNo,
           CASE WHEN @IsHeb = 0 THEN SystemValueName ELSE SystemValueNameHe END
    FROM SystemValues;

    CREATE TABLE #Tepm1
    (
        TransactionType INT, [Type] INT, Amount MONEY,
        TenderType NVARCHAR(50), Cashier NVARCHAR(50), CreditType NVARCHAR(50),
        TransactionID UNIQUEIDENTIFIER, CustomerID UNIQUEIDENTIFIER NULL,
        TransactionNo NVARCHAR(50), TenderDate DATETIME, RegistersBackoffice INT,
        StoreID UNIQUEIDENTIFIER, TenderTypeInt INT
    );

    CREATE TABLE #tentry
    (
        TenderID INT, Amount MONEY, UserCreated UNIQUEIDENTIFIER, Common3 NVARCHAR(50),
        TransactionID UNIQUEIDENTIFIER, CustomerID UNIQUEIDENTIFIER NULL,
        BatchID UNIQUEIDENTIFIER, StoreID UNIQUEIDENTIFIER, TransactionNo NVARCHAR(50),
        StartSaleTime DATETIME, RegisterTransaction BIT
    );
    INSERT INTO #tentry
    SELECT TenderEntry.TenderID, TenderEntry.Amount, TenderEntry.UserCreated, TenderEntry.Common3,
           [Transaction].TransactionID, [Transaction].CustomerID, [Transaction].BatchID,
           [Transaction].StoreID, [Transaction].TransactionNo, [Transaction].StartSaleTime,
           [Transaction].RegisterTransaction
    FROM [Transaction] WITH (NOLOCK)
    INNER JOIN TenderEntry WITH (NOLOCK) ON TenderEntry.TransactionID = [Transaction].TransactionID
    WHERE [Transaction].StartSaleTime >= @FromDate
      AND [Transaction].StartSaleTime <= @ToDate
      AND [Transaction].Status > 0
      AND TenderEntry.TransactionType = 0
      AND TenderEntry.Status > 0;

    INSERT INTO #Tepm1
    SELECT 0, #CurrTender.TenderType, #tentry.Amount, #CurrTender.TenderName,
           ISNULL(createUser.UserName, cashierUser.UserName),
           SysVisa.SystemValueName,
           #tentry.TransactionID, #tentry.CustomerID, #tentry.TransactionNo, #tentry.StartSaleTime,
           CASE WHEN #tentry.RegisterTransaction = 1 THEN 1 ELSE 0 END,
           #tentry.StoreID, #CurrTender.TenderType
    FROM #CurrTender
    INNER JOIN #tentry ON #tentry.TenderID = #CurrTender.TenderID
    LEFT  JOIN Batch ON Batch.BatchID = #tentry.BatchID
    LEFT  JOIN Users cashierUser ON cashierUser.UserId = Batch.CashierID
    LEFT  JOIN Users createUser  ON createUser.UserId  = #tentry.UserCreated
    LEFT  JOIN #CurrSystemValues SysVisa ON CAST(SysVisa.SystemValueNo AS NVARCHAR) = #tentry.Common3 AND SysVisa.SystemTableNo = 5 AND #tentry.TenderID = 3;

    CREATE TABLE #tentryCP (TenderID INT, Amount MONEY, TransactionID UNIQUEIDENTIFIER, TransactionType INT);
    INSERT INTO #tentryCP
    SELECT TenderID, Amount, TransactionID, TransactionType
    FROM TenderEntry WITH (NOLOCK)
    WHERE TransactionType > 0 AND Status > 0;

    IF @IncludePayOut = 1
    BEGIN
        INSERT INTO #Tepm1
        SELECT 1, 2, SUM(#tentryCP.Amount),
               (SELECT TenderName FROM #CurrTender WHERE TenderID = #tentryCP.TenderID),
               Users.UserName, NULL, #tentryCP.TransactionID, NULL,
               'Payout', PayOut.PayOutDate, 1, Registers.StoreID,
               (SELECT TenderType FROM #CurrTender WHERE TenderID = #tentryCP.TenderID)
        FROM PayOut
        INNER JOIN Registers ON Registers.RegisterID = PayOut.RegisterID
        INNER JOIN #tentryCP ON #tentryCP.TransactionID = PayOut.PayOutID
        LEFT  JOIN Users ON Users.UserId = PayOut.ChasierID
        WHERE #tentryCP.TransactionType = 1 AND PayOut.PayOutDate > @FromDate AND PayOut.PayOutDate < @ToDate
        GROUP BY Users.UserId, Users.UserName, PayOut.PayOutDate, #tentryCP.TransactionID, Registers.StoreID, #tentryCP.TenderID;
    END

    INSERT INTO #Tepm1
    SELECT 2, 2, SUM(#tentryCP.Amount),
           (SELECT TenderName FROM #CurrTender WHERE TenderID = 1),
           Users.UserName, NULL, #tentryCP.TransactionID, NULL,
           'CashCheck', CashCheck.Date, 1, Batch.StoreID,
           (SELECT TenderType FROM #CurrTender WHERE TenderID = 1)
    FROM CashCheck
    INNER JOIN Batch ON Batch.BatchID = CashCheck.BatchID
    INNER JOIN #tentryCP ON #tentryCP.TransactionID = CashCheck.CashCheckID
    LEFT  JOIN Users ON Users.UserId = CashCheck.UserID
    WHERE #tentryCP.TenderID = 1 AND #tentryCP.TransactionType = 2 AND CashCheck.Date > @FromDate AND CashCheck.Date < @ToDate
    GROUP BY Users.UserId, Users.UserName, CashCheck.Date, #tentryCP.TransactionID, Batch.StoreID;

    INSERT INTO #Tepm1
    SELECT 2, 2, SUM(#tentryCP.Amount),
           (SELECT TenderName FROM #CurrTender WHERE TenderID = 2),
           Users.UserName, NULL, #tentryCP.TransactionID, NULL,
           'CashCheck', CashCheck.Date, 1, Batch.StoreID,
           (SELECT TenderType FROM #CurrTender WHERE TenderID = 2)
    FROM CashCheck
    INNER JOIN Batch ON Batch.BatchID = CashCheck.BatchID
    INNER JOIN #tentryCP ON #tentryCP.TransactionID = CashCheck.CashCheckID
    LEFT  JOIN Users ON Users.UserId = CashCheck.UserID
    WHERE #tentryCP.TenderID = 2 AND #tentryCP.TransactionType = 2 AND CashCheck.Date > @FromDate AND CashCheck.Date < @ToDate
    GROUP BY Users.UserId, Users.UserName, CashCheck.Date, #tentryCP.TransactionID, Batch.StoreID;

    ;WITH FinalQ AS
    (
        SELECT CASE WHEN TransType.SystemValueName = 'Pay Out' THEN TransType.SystemValueName ELSE #Tepm1.TenderType END AS TenderType,
               ISNULL(CreditType, 'Other CC') AS CreditType,
               SUM(Amount) AS Amount,
               Store.StoreName,
               TenderTypeInt,
               COUNT(*) AS [Count],
               CASE WHEN TransType.SystemValueName = 'Pay Out' THEN 99 ELSE Tender.SortOrder END AS SortOrder
        FROM #Tepm1
        INNER JOIN Store ON Store.StoreID = #Tepm1.StoreID
        INNER JOIN Tender ON Tender.TenderName = #Tepm1.TenderType
        LEFT  JOIN Customer AS C ON #Tepm1.CustomerID = C.CustomerID
        LEFT  JOIN #CurrSystemValues ON #CurrSystemValues.SystemValueNo = [Type] AND #CurrSystemValues.SystemTableNo = 25
        LEFT  JOIN #CurrSystemValues TransType    ON TransType.SystemValueNo    = #Tepm1.TransactionType     AND TransType.SystemTableNo    = 41
        LEFT  JOIN #CurrSystemValues LocationType ON LocationType.SystemValueNo = #Tepm1.RegistersBackoffice AND LocationType.SystemTableNo = 40
        WHERE (@StoreID = '00000000-0000-0000-0000-000000000000' OR #Tepm1.StoreID = @StoreID)
        GROUP BY
            CASE WHEN TransType.SystemValueName = 'Pay Out' THEN TransType.SystemValueName ELSE #Tepm1.TenderType END,
            ISNULL(CreditType, 'Other CC'),
            Store.StoreName,
            TenderTypeInt,
            CASE WHEN TransType.SystemValueName = 'Pay Out' THEN 99 ELSE Tender.SortOrder END
    )
    SELECT *, COUNT(*) OVER() AS TotalRecords
    FROM FinalQ
    ORDER BY SortOrder
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

    DROP TABLE #tentry;
    DROP TABLE #tentryCP;
    DROP TABLE #Tepm1;
    DROP TABLE #CurrSystemValues;
    DROP TABLE #CurrTender;
END
GO

-- ================================================================================================
-- 5) Web_SP_GetTendersCashierByStation
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetTendersCashierByStation]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetTendersCashierByStation];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetTendersCashierByStation]
(
    @FromDate    DATETIME,
    @ToDate      DATETIME,
    @StoreID     UNIQUEIDENTIFIER = NULL,
    @RegisterID  UNIQUEIDENTIFIER = NULL,
    @PageNumber  INT = 1,
    @PageSize    INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    ;WITH Inner_Q AS
    (
        SELECT Tender.TenderName,
               Registers.RegisterNo,
               [Transaction].RegisterID,
               TenderEntry.Amount,
               CASE WHEN TenderType = 2 THEN 'CASH' ELSE 'GIFT' END AS TenderType,
               Credit.TenderName AS CreditName,
               [Transaction].TransactionNo,
               [Transaction].TransactionID
        FROM Tender
        INNER JOIN TenderEntry  WITH (NOLOCK) ON Tender.TenderID = TenderEntry.TenderID
        INNER JOIN [Transaction] WITH (NOLOCK) ON TenderEntry.TransactionID = [Transaction].TransactionID
        INNER JOIN Registers ON [Transaction].RegisterID = Registers.RegisterID
        LEFT  JOIN (SELECT SystemValueName AS TenderName, SystemValueNo FROM SystemValues WHERE SystemTableNo = 5) AS Credit
               ON TenderEntry.Common3 = Credit.SystemValueNo
        WHERE [Transaction].Status > 0
          AND Tender.TenderGroup <> 6
          AND Tender.TenderGroup <> 7
          AND dbo.GetDay([Transaction].StartSaleTime) >= @FromDate
          AND dbo.GetDay([Transaction].StartSaleTime) <= @ToDate
          AND (@StoreID    IS NULL OR [Transaction].StoreID    = @StoreID)
          AND (@RegisterID IS NULL OR [Transaction].RegisterID = @RegisterID)
    )
    SELECT *, COUNT(*) OVER() AS TotalRecords
    FROM Inner_Q
    ORDER BY RegisterNo, TenderName
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

-- ================================================================================================
-- 6) Web_Rpt_AcountReceivable
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_Rpt_AcountReceivable]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_Rpt_AcountReceivable];
GO
CREATE PROCEDURE [dbo].[Web_Rpt_AcountReceivable]
(
    @FromDate   DATETIME,
    @ToDate     DATETIME,
    @StoreID    UNIQUEIDENTIFIER = NULL,
    @PageNumber INT = 1,
    @PageSize   INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    ;WITH Inner_Q AS
    (
        SELECT ISNULL(CustomerView.LastName, '') + ' ' + ISNULL(CustomerView.FirstName, '') AS [Name],
               CustomerView.BalanceDoe,
               CustomerView.FirstName,
               CustomerView.CustomerID,
               CustomerView.CustomerNo,
               CustomerView.LastName,
               CustomerView.Address,
               CustomerView.Phone,
               [Transaction].TransactionNo,
               [Transaction].Debit  AS Sale,
               [Transaction].Credit AS AmountPayments,
               Actions.ActionID,
               Actions.BatchID,
               Users.UserName,
               Actions.ActionSum AS AmountSales,
               [Transaction].EndSaleTime AS SaleTime
        FROM Actions
        INNER JOIN [Transaction]  ON Actions.TransactionID = [Transaction].TransactionID
        LEFT  JOIN CustomerView   ON [Transaction].CustomerID = CustomerView.CustomerID
        LEFT  JOIN Users          ON Actions.UserID = Users.UserId
        WHERE Actions.ActionType = 17
          AND dbo.GetDay([Transaction].StartSaleTime) >= @FromDate
          AND dbo.GetDay([Transaction].StartSaleTime) <= @ToDate
          AND ([Transaction].StoreID = @StoreID OR @StoreID IS NULL)
    )
    SELECT *, COUNT(*) OVER() AS TotalRecords
    FROM Inner_Q
    ORDER BY SaleTime DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

-- ================================================================================================
-- 7) Web_Rpt_TotalSalesDaily
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_Rpt_TotalSalesDaily]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_Rpt_TotalSalesDaily];
GO
CREATE PROCEDURE [dbo].[Web_Rpt_TotalSalesDaily]
(
    @Filter          NVARCHAR(4000),
    @IncludeDiscount BIT = 1,
    @PageNumber      INT = 1,
    @PageSize        INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    DECLARE @MySelect NVARCHAR(2000);
    DECLARE @Group    NVARCHAR(400);

    SET @MySelect = N'SELECT SaleDate AS [Date], SUM(Total) AS Total, COUNT(TransactionNo) AS Trans, SUM(Total) / COUNT(TransactionNo) AS AvgSale
        FROM (SELECT SUM(TotalAfterDiscount) AS Total, CONVERT(CHAR(10), StartSaleTime, 101) AS SaleDate, TransactionNo
              FROM TransactionEntry E INNER JOIN [Transaction] T ON E.TransactionID = T.TransactionID
              WHERE (E.Status > 0) AND (E.TransactionEntryType <> 4) AND (E.TransactionEntryType <> 5) AND (T.Status > 0) AND (0 = 0) ';

    SET @Group = N' GROUP BY CONVERT(CHAR(10), StartSaleTime, 101), TransactionNo) AS TotalTranss GROUP BY SaleDate ';

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @Filter + @Group;

    DECLARE @Paged NVARCHAR(MAX) =
        N'SELECT *, COUNT(*) OVER() AS TotalRecords,
                  SUM(CAST(Total AS DECIMAL(19,4))) OVER() AS GrandTotalAmount,
                  SUM(CAST(Trans AS BIGINT))         OVER() AS GrandTotalTransactions
          FROM (' + @Inner + N') AS PagedQ
          ORDER BY [Date] DESC
          OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY';

    EXEC (@Paged);
END
GO

-- ================================================================================================
-- 8) Web_Rpt_TotalSalesWeekly
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_Rpt_TotalSalesWeekly]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_Rpt_TotalSalesWeekly];
GO
CREATE PROCEDURE [dbo].[Web_Rpt_TotalSalesWeekly]
(
    @Filter     NVARCHAR(4000),
    @PageNumber INT = 1,
    @PageSize   INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    DECLARE @MySelect NVARCHAR(2000) =
        N'SELECT SUM(TotalAfterDiscount) AS Total, COUNT(DISTINCT T.TransactionID) AS Trans,
                 SUM(Total) / COUNT(DISTINCT T.TransactionID) AS AvgSale,
                 DATEADD(DAY, 1 - DATEPART(WEEKDAY, StartSaleTime), CAST(StartSaleTime AS DATE)) AS [Date]
          FROM TransactionEntry E INNER JOIN [Transaction] T ON E.TransactionID = T.TransactionID
          WHERE (E.Status > 0) AND (E.TransactionEntryType <> 4) AND (E.TransactionEntryType <> 5) AND (T.Status > 0) AND 1=1 ';

    DECLARE @Group NVARCHAR(400) =
        N' GROUP BY DATEADD(DAY, 1 - DATEPART(WEEKDAY, StartSaleTime), CAST(StartSaleTime AS DATE)) ';

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @Filter + @Group;

    DECLARE @Paged NVARCHAR(MAX) =
        N'SELECT *, COUNT(*) OVER() AS TotalRecords,
                  SUM(CAST(Total AS DECIMAL(19,4))) OVER() AS GrandTotalAmount,
                  SUM(CAST(Trans AS BIGINT))         OVER() AS GrandTotalTransactions
          FROM (' + @Inner + N') AS PagedQ
          ORDER BY [Date] DESC
          OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY';

    EXEC (@Paged);
END
GO

-- ================================================================================================
-- 9) Web_Rpt_TotalSalesMonthly
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_Rpt_TotalSalesMonthly]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_Rpt_TotalSalesMonthly];
GO
CREATE PROCEDURE [dbo].[Web_Rpt_TotalSalesMonthly]
(
    @Filter     NVARCHAR(4000),
    @PageNumber INT = 1,
    @PageSize   INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    DECLARE @MySelect NVARCHAR(2000) =
        N'SELECT SUM(TransactionEntryItem.TotalAfterDiscount) AS Total,
                 COUNT(DISTINCT TransactionEntryItem.TransactionID) AS Trans,
                 SUM(TransactionEntryItem.TotalAfterDiscount) / COUNT(DISTINCT TransactionEntryItem.TransactionID) AS AvgSale,
                 DATEADD(mm, DATEDIFF(mm, 0, TransactionEntryItem.EndSaleTime), 0) AS [Date],
                 SUM(TransactionEntryItem.ExtCost) AS Cost,
                 DATEPART(year,  TransactionEntryItem.EndSaleTime) AS Yr,
                 DATEPART(month, TransactionEntryItem.EndSaleTime) AS Mt,
                 Tax.Tax
          FROM TransactionEntryItem
          INNER JOIN
              (SELECT SUM(Tax) AS Tax, DATEPART(year, EndSaleTime) AS Yr, DATEPART(month, EndSaleTime) AS Mt
               FROM [Transaction]
               WHERE (1 = 1) AND (Status > 0)
               GROUP BY DATEPART(year, EndSaleTime), DATEPART(month, EndSaleTime)) AS Tax
              ON DATEPART(year,  TransactionEntryItem.EndSaleTime) = Tax.Yr
             AND DATEPART(month, TransactionEntryItem.EndSaleTime) = Tax.Mt
          WHERE (1 = 1) ';

    DECLARE @MyFilter NVARCHAR(4000) = REPLACE(@Filter, 'EndSaleTime', 'TransactionEntryItem.EndSaleTime');

    DECLARE @Group NVARCHAR(400) =
        N' GROUP BY DATEADD(mm, DATEDIFF(mm, 0, TransactionEntryItem.EndSaleTime), 0),
                    DATEPART(year, TransactionEntryItem.EndSaleTime),
                    DATEPART(month, TransactionEntryItem.EndSaleTime),
                    Tax.Tax ';

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @MyFilter + @Group;

    DECLARE @Paged NVARCHAR(MAX) =
        N'SELECT *, COUNT(*) OVER() AS TotalRecords,
                  SUM(CAST(Total AS DECIMAL(19,4))) OVER() AS GrandTotalAmount,
                  SUM(CAST(Trans AS BIGINT))         OVER() AS GrandTotalTransactions
          FROM (' + @Inner + N') AS PagedQ
          ORDER BY [Date] DESC
          OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY';

    EXEC (@Paged);
END
GO

-- ================================================================================================
-- 10) Web_SP_ItemsDailySales
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_ItemsDailySales]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_ItemsDailySales];
GO
CREATE PROCEDURE [dbo].[Web_SP_ItemsDailySales]
(
    @Filter         NVARCHAR(4000),
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

    DECLARE @ItemSelect     NVARCHAR(4000) = N'Select Distinct ItemStoreID Into #ItemSelect From ItemsRepFilter Where (1=1) ';
    DECLARE @CustomerSelect NVARCHAR(4000) = N'';
    DECLARE @MyWhere        NVARCHAR(4000);

    IF @CustomerFilter <> ''
    BEGIN
        SET @CustomerSelect = N' Select CustomerID Into #CustomerSelect From CustomerRepFilter Where (1=1) ';
        SET @MyWhere = N' where (1=1) And exists (Select 1 From #CustomerSelect where CustomerID = transactionentryitem.CustomerID) ';
    END
    ELSE
        SET @MyWhere = N' where (1=1) ';

    DECLARE @MySelect NVARCHAR(MAX) = N'
        Select sum(Qty) as Qty,
               sum(TotalAfterDiscount) as ExtPrice,
               dbo.GetDay(StartSaleTime) as DayOfYear,
               ItemID as ItemNo,
               [Name] as ItemName,
               DepartmentID,
               BarcodeNumber,
               isnull(Department, ''[NO DEPARTMENT]'') as Department
        From dbo.' + @TableName + N' INNER JOIN #ItemSelect ON ' + @TableName + N'.ItemStoreID = #ItemSelect.ItemStoreID ';

    DECLARE @MyGroupBy NVARCHAR(4000) =
        N' group By dbo.GetDay(StartSaleTime), Department, ItemID, [Name], DepartmentID, BarcodeNumber ';

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @MyWhere + @Filter + @MyGroupBy;

    DECLARE @Paged NVARCHAR(MAX) =
        N'; SELECT *, COUNT(*) OVER() AS TotalRecords,
                     SUM(CAST(Qty      AS DECIMAL(19,4))) OVER() AS GrandTotalQty,
                     SUM(CAST(ExtPrice AS DECIMAL(19,4))) OVER() AS GrandTotalAmount
           FROM (' + @Inner + N') AS PagedQ
           ORDER BY DayOfYear DESC, Department, ItemName
           OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    DECLARE @Cleanup NVARCHAR(400) =
        N' IF OBJECT_ID(N''tempdb.dbo.#ItemSelect'', N''U'') IS NOT NULL DROP TABLE #ItemSelect;' +
        CASE WHEN @CustomerFilter <> '' THEN N' IF OBJECT_ID(N''tempdb.dbo.#CustomerSelect'', N''U'') IS NOT NULL DROP TABLE #CustomerSelect;' ELSE N'' END;

    EXEC (@ItemSelect + @ItemFilter + @CustomerSelect + @CustomerFilter + @Paged + @Cleanup);
END
GO

-- ================================================================================================
-- 11) Web_SP_ItemsWeeklySales
-- ================================================================================================
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

    DECLARE @FirstDayOfWeek NVARCHAR(4000) =
        N' declare @FirstDayOfWeek Smallint set @FirstDayOfWeek = (Select Top 1 OptionValue From SetupValues Where StoreID = ''';

    DECLARE @MySelect NVARCHAR(MAX) =
        N''' and OptionID = ''131'')
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
    EXEC (@ItemSelect + @ItemFilter + @CustomerSelect + @CustomerFilter + @FirstDayOfWeek + @StoreIdStr + @MySelect + @MyWhere + @Filter + @MyGroupBy + @Paged + @Cleanup);
END
GO

-- ================================================================================================
-- 12) Web_SP_ItemsMonthlySales
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_ItemsMonthlySales]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_ItemsMonthlySales];
GO
CREATE PROCEDURE [dbo].[Web_SP_ItemsMonthlySales]
(
    @Filter         NVARCHAR(4000),
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

    DECLARE @ItemSelect     NVARCHAR(4000) = N'Select Distinct ItemStoreID Into #ItemSelect From ItemsRepFilter Where (1=1) ';
    DECLARE @CustomerSelect NVARCHAR(4000) = N'';
    DECLARE @MyWhere        NVARCHAR(4000);

    IF @CustomerFilter <> ''
    BEGIN
        SET @CustomerSelect = N' Select CustomerID Into #CustomerSelect From CustomerRepFilter Where (1=1) ';
        SET @MyWhere = N' where (1=1) And exists (Select 1 From #ItemSelect where ItemStoreID = transactionEntryItem.ItemStoreID) And exists (Select 1 From #CustomerSelect where CustomerID = transactionentryitem.CustomerID) ';
    END
    ELSE
        SET @MyWhere = N' where (1=1) And exists (Select 1 From #ItemSelect where ItemStoreID = transactionEntryItem.ItemStoreID) ';

    DECLARE @MySelect NVARCHAR(MAX) = N'
        Select Sum(Qty) as Qty,
               Sum(TotalAfterDiscount) as ExtPrice,
               [Name] as ItemName,
               ItemID as ItemNo,
               BarcodeNumber As UPC,
               cast(CONVERT(CHAR(10), StartSaleTime, 23) as datetime) as MonthName,
               isnull(Department, ''[NO DEPARTMENT]'') as Department,
               DepartmentID
        From ' + @TableName + N' ';

    DECLARE @MyGroupBy NVARCHAR(4000) =
        N' Group By [Name], Department, CONVERT(CHAR(10), StartSaleTime, 23), ItemID, DepartmentID, BarcodeNumber ';

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @MyWhere + @Filter + @MyGroupBy;

    DECLARE @Paged NVARCHAR(MAX) =
        N'; SELECT *, COUNT(*) OVER() AS TotalRecords,
                     SUM(CAST(Qty      AS DECIMAL(19,4))) OVER() AS GrandTotalQty,
                     SUM(CAST(ExtPrice AS DECIMAL(19,4))) OVER() AS GrandTotalAmount
           FROM (' + @Inner + N') AS PagedQ
           ORDER BY MonthName DESC, Department, ItemName
           OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    DECLARE @Cleanup NVARCHAR(400) =
        N' IF OBJECT_ID(N''tempdb.dbo.#ItemSelect'', N''U'') IS NOT NULL DROP TABLE #ItemSelect;' +
        CASE WHEN @CustomerFilter <> '' THEN N' IF OBJECT_ID(N''tempdb.dbo.#CustomerSelect'', N''U'') IS NOT NULL DROP TABLE #CustomerSelect;' ELSE N'' END;

    EXEC (@ItemSelect + @ItemFilter + @CustomerSelect + @CustomerFilter + @Paged + @Cleanup);
END
GO

-- ================================================================================================
-- 13) Web_SP_DepartmentsDailySales
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_DepartmentsDailySales]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_DepartmentsDailySales];
GO
CREATE PROCEDURE [dbo].[Web_SP_DepartmentsDailySales]
(
    @Filter         NVARCHAR(4000),
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

    DECLARE @ItemSelect     NVARCHAR(4000) = N'Select Distinct ItemStoreID Into #ItemSelect From ItemsRepFilter Where (1=1) ';
    DECLARE @CustomerSelect NVARCHAR(4000) = N'';
    DECLARE @MyWhere        NVARCHAR(4000);

    IF @CustomerFilter <> ''
    BEGIN
        SET @CustomerSelect = N' Select CustomerID Into #CustomerSelect From CustomerRepFilter Where (1=1) ';
        SET @MyWhere = N' where (1=1) And exists (Select 1 From #CustomerSelect where CustomerID = transactionentryitem.CustomerID) ';
    END
    ELSE
        SET @MyWhere = N' where (1=1) ';

    DECLARE @MySelect NVARCHAR(MAX) = N'
        Select sum(Qty) as Qty,
               sum(TotalAfterDiscount) as ExtPrice,
               dbo.GetDay(StartSaleTime) as DayOfYear,
               isnull(Department, ''[NO DEPARTMENT]'') as Department,
               StoreName,
               DepartmentID
        From dbo.' + @TableName + N' INNER JOIN #ItemSelect ON ' + @TableName + N'.ItemStoreID = #ItemSelect.ItemStoreID ';

    DECLARE @MyGroupBy NVARCHAR(4000) =
        N' group By dbo.GetDay(StartSaleTime), StoreName, Department, DepartmentID ';

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @MyWhere + @Filter + @MyGroupBy;

    DECLARE @Paged NVARCHAR(MAX) =
        N'; SELECT *, COUNT(*) OVER() AS TotalRecords,
                     SUM(CAST(Qty      AS DECIMAL(19,4))) OVER() AS GrandTotalQty,
                     SUM(CAST(ExtPrice AS DECIMAL(19,4))) OVER() AS GrandTotalAmount
           FROM (' + @Inner + N') AS PagedQ
           ORDER BY DayOfYear DESC, Department
           OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    DECLARE @Cleanup NVARCHAR(400) =
        N' IF OBJECT_ID(N''tempdb.dbo.#ItemSelect'', N''U'') IS NOT NULL DROP TABLE #ItemSelect;' +
        CASE WHEN @CustomerFilter <> '' THEN N' IF OBJECT_ID(N''tempdb.dbo.#CustomerSelect'', N''U'') IS NOT NULL DROP TABLE #CustomerSelect;' ELSE N'' END;

    EXEC (@ItemSelect + @ItemFilter + @CustomerSelect + @CustomerFilter + @Paged + @Cleanup);
END
GO

-- ================================================================================================
-- 14) Web_SP_DepartmentWeeklySales
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_DepartmentWeeklySales]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_DepartmentWeeklySales];
GO
CREATE PROCEDURE [dbo].[Web_SP_DepartmentWeeklySales]
(
    @Filter         NVARCHAR(4000),
    @ItemFilter     NVARCHAR(4000),
    @CustomerFilter NVARCHAR(4000),
    @StoreID        UNIQUEIDENTIFIER,
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

    DECLARE @ItemSelect     NVARCHAR(4000) = N'Select Distinct ItemStoreID Into #ItemSelect From ItemsRepFilter Where (1=1) ';
    DECLARE @CustomerSelect NVARCHAR(4000) = N'';
    DECLARE @MyWhere        NVARCHAR(4000);

    IF @CustomerFilter <> ''
    BEGIN
        SET @CustomerSelect = N' Select CustomerID Into #CustomerSelect From CustomerRepFilter Where (1=1) ';
        SET @MyWhere = N' where (1=1) And exists (Select 1 From #CustomerSelect where CustomerID = transactionentryitem.CustomerID) ';
    END
    ELSE
        SET @MyWhere = N' where (1=1) ';

    DECLARE @FirstDayOfWeek NVARCHAR(4000) =
        N' declare @FirstDayOfWeek Smallint set @FirstDayOfWeek = (Select Top 1 OptionValue From SetupValues Where StoreID = ''';

    DECLARE @MySelect NVARCHAR(MAX) =
        N''' and OptionID = ''131'')
        Select Sum(Qty) As Qty,
               sum(TotalAfterDiscount) as ExtPrice,
               isnull(Department, ''[NO DEPARTMENT]'') as Department,
               dbo.GetFirstDayOfWeek(StartSaleTime, @FirstDayOfWeek) as WeekNumber,
               DepartmentID,
               StoreName
        From dbo.' + @TableName + N' INNER JOIN #ItemSelect ON ' + @TableName + N'.ItemStoreID = #ItemSelect.ItemStoreID ';

    DECLARE @MyGroupBy NVARCHAR(4000) =
        N' Group By dbo.GetFirstDayOfWeek(StartSaleTime, @FirstDayOfWeek), StoreName, Department, DepartmentID ';

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @MyWhere + @Filter + @MyGroupBy;

    DECLARE @Paged NVARCHAR(MAX) =
        N'; SELECT *, COUNT(*) OVER() AS TotalRecords,
                     SUM(CAST(Qty      AS DECIMAL(19,4))) OVER() AS GrandTotalQty,
                     SUM(CAST(ExtPrice AS DECIMAL(19,4))) OVER() AS GrandTotalAmount
           FROM (' + @Inner + N') AS PagedQ
           ORDER BY WeekNumber DESC, Department
           OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    DECLARE @Cleanup NVARCHAR(400) =
        N' IF OBJECT_ID(N''tempdb.dbo.#ItemSelect'', N''U'') IS NOT NULL DROP TABLE #ItemSelect;' +
        CASE WHEN @CustomerFilter <> '' THEN N' IF OBJECT_ID(N''tempdb.dbo.#CustomerSelect'', N''U'') IS NOT NULL DROP TABLE #CustomerSelect;' ELSE N'' END;

    DECLARE @StoreIdStr NVARCHAR(50) = CAST(@StoreID AS NVARCHAR(50));
    EXEC (@ItemSelect + @ItemFilter + @CustomerSelect + @CustomerFilter + @FirstDayOfWeek + @StoreIdStr + @MySelect + @MyWhere + @Filter + @MyGroupBy + @Paged + @Cleanup);
END
GO

-- ================================================================================================
-- 15) Web_SP_DepartmentMonthlySales
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_DepartmentMonthlySales]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_DepartmentMonthlySales];
GO
CREATE PROCEDURE [dbo].[Web_SP_DepartmentMonthlySales]
(
    @Filter         NVARCHAR(4000),
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

    DECLARE @ItemSelect     NVARCHAR(4000) = N'Select Distinct ItemStoreID Into #ItemSelect From ItemsRepFilter Where (1=1) ';
    DECLARE @CustomerSelect NVARCHAR(4000) = N'';
    DECLARE @MyWhere        NVARCHAR(4000);

    IF @CustomerFilter <> ''
    BEGIN
        SET @CustomerSelect = N' Select CustomerID Into #CustomerSelect From CustomerRepFilter Where (1=1) ';
        SET @MyWhere = N' where (1=1) And exists (Select 1 From #CustomerSelect where CustomerID = transactionentryitem.CustomerID) ';
    END
    ELSE
        SET @MyWhere = N' where (1=1) ';

    DECLARE @MySelect NVARCHAR(MAX) = N'
        Select sum(Qty) as Qty,
               sum(TotalAfterDiscount) as ExtPrice,
               cast(CONVERT(CHAR(10), StartSaleTime, 23) as datetime) as MonthName,
               isnull(Department, ''[NO DEPARTMENT]'') as Department,
               DepartmentID,
               StoreName
        From dbo.' + @TableName + N' INNER JOIN #ItemSelect ON ' + @TableName + N'.ItemStoreID = #ItemSelect.ItemStoreID ';

    DECLARE @MyGroupBy NVARCHAR(4000) =
        N' group By CONVERT(CHAR(10), StartSaleTime, 23), StoreName, Department, DepartmentID ';

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @MyWhere + @Filter + @MyGroupBy;

    DECLARE @Paged NVARCHAR(MAX) =
        N'; SELECT *, COUNT(*) OVER() AS TotalRecords,
                     SUM(CAST(Qty      AS DECIMAL(19,4))) OVER() AS GrandTotalQty,
                     SUM(CAST(ExtPrice AS DECIMAL(19,4))) OVER() AS GrandTotalAmount
           FROM (' + @Inner + N') AS PagedQ
           ORDER BY MonthName DESC, Department
           OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    DECLARE @Cleanup NVARCHAR(400) =
        N' IF OBJECT_ID(N''tempdb.dbo.#ItemSelect'', N''U'') IS NOT NULL DROP TABLE #ItemSelect;' +
        CASE WHEN @CustomerFilter <> '' THEN N' IF OBJECT_ID(N''tempdb.dbo.#CustomerSelect'', N''U'') IS NOT NULL DROP TABLE #CustomerSelect;' ELSE N'' END;

    EXEC (@ItemSelect + @ItemFilter + @CustomerSelect + @CustomerFilter + @Paged + @Cleanup);
END
GO

-- ================================================================================================
-- 16) Web_SP_GetActionByDate
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetActionByDate]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetActionByDate];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetActionByDate]
(
    @Filter     NVARCHAR(4000),
    @PageNumber INT = 1,
    @PageSize   INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    DECLARE @MySelect NVARCHAR(MAX) =
        N'SELECT Store.StoreID, Store.StoreName, Batch.BatchID,
                 CONVERT(nvarchar, Actions.ActionDate, 111) AS ActionDate,
                 COUNT(*) AS Times,
                 upper(Users.UserName) AS Cashier,
                 SystemValues.SystemValueName AS Action,
                 Batch.CashierID,
                 Actions.ActionType,
                 Batch.BatchNumber
          FROM Actions
          INNER JOIN Batch ON Batch.BatchID = Actions.BatchID
          LEFT  JOIN Store ON Store.StoreID = Batch.StoreID
          LEFT  JOIN Users ON Users.UserId = Batch.CashierID
          LEFT  JOIN SystemValues ON SystemValues.SystemValueNo = Actions.ActionType AND SystemValues.SystemTableNo = 27
          WHERE (1 = 1) ';

    DECLARE @MyGroupBy NVARCHAR(4000) =
        N' GROUP BY Store.StoreID, Store.StoreName, Batch.BatchID, Users.UserName, SystemValues.SystemValueName, CONVERT(nvarchar, Actions.ActionDate, 111), Batch.CashierID, Actions.ActionType, Batch.BatchNumber ';

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @Filter + @MyGroupBy;

    DECLARE @Paged NVARCHAR(MAX) =
        N'SELECT *, COUNT(*) OVER() AS TotalRecords,
                  SUM(CAST(Times AS BIGINT)) OVER() AS GrandTotalTimes
          FROM (' + @Inner + N') AS PagedQ
          ORDER BY ActionDate DESC
          OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY';

    EXEC (@Paged);
END
GO

-- ================================================================================================
-- 17) Web_SP_GetActionDetailsByDate
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetActionDetailsByDate]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetActionDetailsByDate];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetActionDetailsByDate]
(
    @Filter     NVARCHAR(4000),
    @PageNumber INT = 1,
    @PageSize   INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    DECLARE @MySelect NVARCHAR(MAX) =
        N'SELECT Batch.BatchNumber,
                 [Transaction].StartSaleTime AS TranDate,
                 SystemValues.SystemValueName AS Action,
                 Actions.ActionType,
                 Registers.CompName AS Register,
                 [Transaction].TransactionNo,
                 [Transaction].TransactionID,
                 Users.UserName AS Cashier,
                 Approve.UserName AS ApproveUserName,
                 Store.StoreName,
                 Actions.ActionSum AS Amount,
                 Info
          FROM Actions
          LEFT  JOIN [Transaction] ON [Transaction].TransactionID = Actions.TransactionID
          LEFT  JOIN Batch         ON Batch.BatchID = Actions.BatchID
          LEFT  JOIN Users         ON Users.UserId = Batch.CashierID
          LEFT  JOIN Users AS Approve ON Approve.UserId = Actions.UserID
          LEFT  JOIN Registers     ON Registers.RegisterID = Actions.RegisterID
          LEFT  JOIN Store         ON Store.StoreID = Batch.StoreID
          LEFT  JOIN SystemValues  ON SystemValues.SystemValueNo = Actions.ActionType AND SystemValues.SystemTableNo = 27
          WHERE (1 = 1) ';

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @Filter;

    DECLARE @Paged NVARCHAR(MAX) =
        N'SELECT *, COUNT(*) OVER() AS TotalRecords FROM (' + @Inner + N') AS PagedQ
          ORDER BY TranDate DESC
          OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY';

    EXEC (@Paged);
END
GO

-- ================================================================================================
-- 18) Web_SP_GetDepartmentSummary
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetDepartmentSummary]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetDepartmentSummary];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetDepartmentSummary]
(
    @Filter         NVARCHAR(MAX),
    @ItemFilter     NVARCHAR(MAX),
    @CustomerFilter NVARCHAR(MAX),
    @TableName      NVARCHAR(40) = 'TransactionEntryItem',
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

    SET @TableName = 'TransactionEntryItem';

    DECLARE @Sel1        NVARCHAR(4000);
    DECLARE @Sel2        NVARCHAR(4000);
    DECLARE @MyWhere     NVARCHAR(4000);
    DECLARE @ItemSelect  NVARCHAR(4000) = N'Select DISTINCT ItemStoreID Into #ItemSelect From ItemsRepFilter Where (1=1) ';
    DECLARE @CustomerSelect NVARCHAR(4000) = N'';

    IF @CustomerFilter <> ''
    BEGIN
        SET @CustomerSelect = N' Select CustomerID Into #CustomerSelect From CustomerRepFilter Where (1=1) ';
        SET @MyWhere = N' where exists (Select 1 From #ItemSelect where ItemStoreID = ' + @TableName + N'.ItemStoreID) And exists (Select 1 From #CustomerSelect where CustomerID = ' + @TableName + N'.CustomerID) ';
    END
    ELSE
        SET @MyWhere = N' where exists (Select 1 From #ItemSelect where ItemStoreID = ' + @TableName + N'.ItemStoreID) ';

    IF (SELECT COUNT(*) FROM SetUpValues WHERE OptionID = 100 AND ((OptionValue = '1') OR (OptionValue = 'True')) AND StoreID <> '00000000-0000-0000-0000-000000000000') > 0
        SET @Sel1 = N'SELECT OnHand.DepartmentID,
            ISNULL(Department, ''[NO DEPARTMENT]'') as Department,
            MainDepartment, SubDepartment, SubSubDepartment,
            SUM(Qty) AS Qty, SUM(QtyCase) AS QtyCase,
            SUM(ExtCost) as ExtCost, SUM(Total) as ExtPrice,
            (CASE WHEN SUM(TotalAfterDiscount)=0 OR SUM(Profit)<=0 then 0
                  ELSE ((SUM(Profit))/(SUM(TotalAfterDiscount)/100))/100 END) as MarginPrice,
            (CASE WHEN SUM(ExtCost) <> 0 then SUM(Profit)/SUM(ExtCost) ELSE 0 END) as MarkupPrice,
            SUM(Profit) as Profit, SUM(TotalAfterDiscount) as TotalAfterDiscount,
            (SUM(Total) - SUM(TotalAfterDiscount)) as Discount,
            OnHand.OnHand as OnHand, OnHand.OnOrder as OnOrder,
            StoreName, StoreID,
            (CASE WHEN (IsNull(SUM(Qty),0)+(Sum(OnHand.OnHand)))>0 THEN (100 / (Sum(OnHand.OnHand) + SUM(QTY)) * SUM(QTY))/100 ELSE 0 END) AS SellThru
        FROM ' + @TableName + N' LEFT OUTER JOIN
            (SELECT DepartmentID, SUM(OnHand) AS OnHand, Sum(OnOrder) As OnOrder
             FROM dbo.ItemStore AS ITS WITH (NOLOCK)
             WHERE Status > 0 AND (ItemStoreID = ItemStoreID)
             GROUP BY DepartmentID) AS OnHand ON ' + @TableName + N'.DepartmentID = OnHand.DepartmentID';
    ELSE
        SET @Sel1 = N'SELECT OnHand.Dep As DepartmentID,
            ISNULL(Department, ''[NO DEPARTMENT]'') as Department,
            MainDepartment, SubDepartment, SubSubDepartment,
            SUM(Qty) AS Qty, SUM(QtyCase) AS QtyCase,
            SUM(ExtCost) as ExtCost, SUM(Total) as ExtPrice,
            (CASE WHEN SUM(TotalAfterDiscount)=0 OR SUM(Profit)<=0 then 0
                  ELSE ((SUM(Profit))/(SUM(TotalAfterDiscount)/100))/100 END) as MarginPrice,
            (CASE WHEN SUM(ExtCost) <> 0 then SUM(Profit)/SUM(ExtCost) ELSE 0 END) as MarkupPrice,
            SUM(Profit) as Profit, SUM(TotalAfterDiscount) as TotalAfterDiscount,
            (SUM(Total) - SUM(TotalAfterDiscount)) as Discount,
            OnHand.OnHand as OnHand, OnHand.OnOrder as OnOrder,
            StoreName, StoreID,
            (CASE WHEN (IsNull(SUM(Qty),0)+(Sum(OnHand.OnHand)))>0 THEN (100 / (Sum(OnHand.OnHand) + SUM(QTY)) * SUM(QTY))/100 ELSE 0 END) AS SellThru
        FROM ' + @TableName + N' LEFT OUTER JOIN
            (SELECT DepartmentID As Dep, SUM(OnHand) AS OnHand, Sum(OnOrder) As OnOrder
             FROM ItemStore AS ITS
             WHERE (ItemStoreID = ItemStoreID)
             GROUP BY DepartmentID) AS OnHand ON ' + @TableName + N'.DepartmentID = OnHand.Dep';

    IF (SELECT COUNT(*) FROM SetUpValues WHERE OptionID = 100 AND ((OptionValue = '1') OR (OptionValue = 'True')) AND StoreID <> '00000000-0000-0000-0000-000000000000') > 0
        SET @Sel2 = N' GROUP BY OnHand.DepartmentID, Department, MainDepartment, SubDepartment, SubSubDepartment, OnHand.OnHand, OnHand.OnOrder, StoreName, StoreID ';
    ELSE
        SET @Sel2 = N' GROUP BY OnHand.Dep, Department, OnHand.OnHand, OnHand.OnOrder, StoreName, StoreID, MainDepartment, SubDepartment, SubSubDepartment ';

    DECLARE @MySelectOld NVARCHAR(MAX) = REPLACE(@Sel1, 'TransactionEntryItem', 'OldTransactionEntryItem');
    DECLARE @MyWhereOld  NVARCHAR(MAX) = REPLACE(@MyWhere, 'TransactionEntryItem', 'OldTransactionEntryItem');

    DECLARE @Inner NVARCHAR(MAX);
    IF @OldTransaction = 0
        SET @Inner = @Sel1 + @MyWhere + @Filter + @Sel2;
    ELSE
        SET @Inner = @MySelectOld + @MyWhereOld + @Filter + @Sel2;

    DECLARE @Paged NVARCHAR(MAX) =
        N'; SELECT *, COUNT(*) OVER() AS TotalRecords FROM (' + @Inner + N') AS PagedQ
           ORDER BY Department
           OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    DECLARE @Cleanup NVARCHAR(400) =
        N' IF OBJECT_ID(N''tempdb.dbo.#ItemSelect'', N''U'') IS NOT NULL DROP TABLE #ItemSelect;' +
        CASE WHEN @CustomerFilter <> '' THEN N' IF OBJECT_ID(N''tempdb.dbo.#CustomerSelect'', N''U'') IS NOT NULL DROP TABLE #CustomerSelect;' ELSE N'' END;

    EXEC (@ItemSelect + @ItemFilter + @CustomerSelect + @CustomerFilter + @Paged + @Cleanup);
END
GO

-- ================================================================================================
-- 19) Web_SP_GetDiscountSummary
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetDiscountSummary]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetDiscountSummary];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetDiscountSummary]
(
    @Filter         NVARCHAR(4000),
    @CustomerFilter NVARCHAR(4000),
    @PageNumber     INT = 1,
    @PageSize       INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    DECLARE @BaseFilter NVARCHAR(4000) =
        N'(TransactionEntry.TransactionEntryType = 4) AND (TransactionEntry.Status > 0) AND (dbo.[Transaction].Status > 0) ';

    DECLARE @MyWhere        NVARCHAR(4000) = N'';
    DECLARE @CustomerSelect NVARCHAR(4000) = N'';

    IF @CustomerFilter <> ''
    BEGIN
        SET @CustomerSelect = N' Select CustomerID Into #CustomerSelect From CustomerRepFilter Where (1=1) ';
        SET @MyWhere = N' AND exists (Select 1 From #CustomerSelect where CustomerID = dbo.[Transaction].CustomerID) ';
    END

    DECLARE @Select NVARCHAR(MAX) = N'
        SELECT isnull(dbo.Discounts.DiscountID, dbo.Credit.CreditID) as DiscountID,
               isnull(''Discount: '' + dbo.Discounts.Name, isnull(''Term : '' + dbo.Credit.Name, ''[MANUAL DISCOUNT]'')) as Name,
               isnull(dbo.Discounts.PercentsDiscount, dbo.Credit.InterestRate) as PercentsDiscount,
               dbo.Discounts.AmountDiscount,
               dbo.Discounts.StartDate,
               dbo.Discounts.EndDate,
               dbo.Discounts.UPCDiscount,
               (CASE WHEN dbo.Discounts.StartDate is null and dbo.Discounts.EndDate is null THEN ''Active''
                     WHEN Convert(nvarchar, dbo.Discounts.StartDate, 101) <= Convert(nvarchar, dbo.GetLocalDATE(), 101)
                          and Convert(nvarchar, dbo.Discounts.EndDate, 101) >= Convert(nvarchar, dbo.GetLocalDATE(), 101) THEN ''Active''
                     ELSE ''InActive'' END) as Status,
               Count(Distinct dbo.[Transaction].CustomerID) as CustomersNo,
               Count(dbo.[Transaction].TransactionID) as TransactionsCount,
               SUM(TotalQtyTransaction.TotalQty) as TotalQty,
               SUM((TotalQtyTransaction.Total) + isnull(TotalReturn, 0) + isnull(disRetern, 0)) as TotalBeforeDiscount,
               SUM(ISNULL(TransactionEntry.UOMPrice, 0) + isnull(disRetern, 0)) AS DiscountTotal,
               SUM(dbo.[Transaction].Debit + isnull(TotalReturn, 0)) - SUM(ISNULL(dbo.[Transaction].Tax, 0)) as SalesTotalWithoutTax,
               SUM(dbo.[Transaction].Debit + isnull(TotalReturn, 0) + ISNULL(TotalReturnTax, 0)) as SalesTotal,
               dbo.[Transaction].StoreID,
               MyStore.StoreName
        FROM dbo.TransactionEntry WITH (NOLOCK)
        LEFT  JOIN dbo.Discounts ON TransactionEntry.ItemStoreID = dbo.Discounts.DiscountID AND dbo.Discounts.Status > 0
        LEFT  JOIN dbo.Credit    ON TransactionEntry.ItemStoreID = dbo.Credit.CreditID AND dbo.Credit.Status > 0
        INNER JOIN dbo.[Transaction] WITH (NOLOCK) ON dbo.[Transaction].TransactionID = TransactionEntry.TransactionID
        INNER JOIN
            (select TransactionEntry.TransactionID,
                    sum(TransactionEntry.Qty) as TotalQty,
                    sum(TransactionEntry.Total) as Total,
                    sum(ter.Total) as TotalReturn,
                    min(trr.Tax) TotalReturnTax,
                    sum(((TransactionEntry.Total - TransactionEntry.TotalAfterDiscount)/TransactionEntry.Qty)*ter.Qty) as disRetern
             from dbo.TransactionEntry
             left outer join TransReturen on TransReturen.ReturenTransID = TransactionEntry.TransactionEntryID
             left outer join TransactionEntry ter on ter.TransactionEntryID = TransReturen.SaleTransEntryID and ter.Status > 0
             LEFT  JOIN [Transaction] trr on trr.TransactionID = ter.TransactionID and trr.Status > 0
             where TransactionEntry.Status > 0 And TransactionEntry.TransactionEntryType = 0
               AND ((TransactionEntry.Total - TransactionEntry.TotalAfterDiscount) <> 0)
             group by TransactionEntry.TransactionID) as TotalQtyTransaction
            ON TotalQtyTransaction.TransactionID = dbo.[Transaction].TransactionID
        INNER JOIN
            (SELECT StoreID AS MyStoreID, StoreName, StoreNumber FROM Store AS Store_1) AS myStore
            ON [Transaction].StoreID = myStore.MyStoreID
        WHERE ';

    DECLARE @GroupBy NVARCHAR(4000) =
        N' GROUP BY dbo.Discounts.DiscountID, dbo.Discounts.Name, dbo.Discounts.PercentsDiscount,
                    dbo.Discounts.AmountDiscount, dbo.Discounts.StartDate, dbo.Discounts.EndDate,
                    dbo.Discounts.UPCDiscount, dbo.Credit.CreditID, dbo.Credit.Name,
                    dbo.Credit.InterestRate, dbo.[Transaction].StoreID, MyStore.StoreName ';

    DECLARE @Inner NVARCHAR(MAX) = @Select + @BaseFilter + @MyWhere + @Filter + @GroupBy;

    DECLARE @Paged NVARCHAR(MAX) =
        N'; SELECT *, COUNT(*) OVER() AS TotalRecords FROM (' + @Inner + N') AS PagedQ
           ORDER BY Name
           OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    DECLARE @Cleanup NVARCHAR(200) =
        CASE WHEN @CustomerFilter <> '' THEN N' IF OBJECT_ID(N''tempdb.dbo.#CustomerSelect'', N''U'') IS NOT NULL DROP TABLE #CustomerSelect;' ELSE N'' END;

    EXEC (@CustomerSelect + @CustomerFilter + @Paged + @Cleanup);
END
GO

-- ================================================================================================
-- 20) Web_Rpt_ItemsInSpecials
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_Rpt_ItemsInSpecials]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_Rpt_ItemsInSpecials];
GO
CREATE PROCEDURE [dbo].[Web_Rpt_ItemsInSpecials]
(
    @Filter         NVARCHAR(4000),
    @ItemFilter     NVARCHAR(4000),
    @CustomerFilter NVARCHAR(4000),
    @PageNumber     INT = 1,
    @PageSize       INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    DECLARE @MyWhere        NVARCHAR(4000) = N' where RegUnitPrice<>UOMPrice ';
    DECLARE @ItemSelect     NVARCHAR(4000) = N'Select DISTINCT ItemStoreID Into #ItemSelect From dbo.ItemsRepFilter Where (1=1) ';
    DECLARE @MyIndex        NVARCHAR(4000) = N' CREATE NONCLUSTERED INDEX [#Tem_Index_Temp_Table] ON [dbo].[#ItemSelect] ([ItemStoreID]) ';
    DECLARE @CustomerSelect NVARCHAR(4000) = N'';

    IF @CustomerFilter <> ''
        SET @CustomerSelect = N' Select CustomerID Into #CustomerSelect From dbo.CustomerRepFilter Where (1=1) ';

    DECLARE @Sel1 NVARCHAR(MAX);
    DECLARE @Sel2 NVARCHAR(4000);

    IF (SELECT COUNT(*) FROM SetUpValues WHERE OptionID = 100 AND ((OptionValue = '1') OR (OptionValue = 'True')) AND StoreID <> '00000000-0000-0000-0000-000000000000') > 0
    BEGIN
        SET @Sel1 = N'
        SELECT MainDepartment, SubDepartment, SubSubDepartment, Department, [Name], BarcodeNumber, ModalNumber,
               TransactionEntryItem.ItemStoreID, ItemID, BarcodeNumber AS BarcodeNumber2,
               SUM(QtyCase) AS QtyCase, SUM(Qty) AS Qty,
               SUM(ExtCost) as ExtCost, SUM(Total) as ExtSpecialPrice, SUM(RegUnitPrice*Qty) as ExtRegularPrice,
               (CASE WHEN SUM(TotalAfterDiscount)= 0 then 0 ELSE SUM(Profit)/ SUM(TotalAfterDiscount) END) as MarginPrice,
               (CASE WHEN SUM(ExtCost) <> 0 then SUM(Profit)/ SUM(ExtCost) ELSE 0 END) as MarkupPrice,
               SUM(Profit) as Profit,
               SUM(RegUnitPrice*Qty) - (SUM(ExtCost)+SUM(Discount)) as RegularProfit,
               SUM(Discount) as Discount, SUM(TotalAfterDiscount) as TotalAfterDiscount,
               StoreID, StoreName,
               max(TransactionEntryItem.Price) as Price, max(TransactionEntryItem.OnHand) as OnHand,
               SUM(RegUnitPrice*Qty) - SUM(Total) as SpecialDeficit
        FROM dbo.TransactionEntryItem INNER JOIN #ItemSelect ON TransactionEntryItem.ItemStoreID = #ItemSelect.ItemStoreID ';
        SET @Sel2 = N' GROUP BY MainDepartment, SubDepartment, SubSubDepartment, Department, TransactionEntryItem.ItemStoreID, [Name], BarcodeNumber, ModalNumber, ItemID, StoreID, StoreName ';
    END
    ELSE
    BEGIN
        SET @Sel1 = N'
        SELECT '''' AS MainDepartment, '''' AS SubDepartment, '''' AS SubSubDepartment,
               Department, [Name], BarcodeNumber, ModalNumber,
               TransactionEntryItem.ItemStoreID, ItemID, BarcodeNumber AS BarcodeNumber2,
               SUM(QtyCase) AS QtyCase, SUM(Qty) AS Qty,
               SUM(ExtCost) as ExtCost, SUM(Total) as ExtSpecialPrice, SUM(RegUnitPrice*Qty) as ExtRegularPrice,
               (CASE WHEN SUM(TotalAfterDiscount)= 0 then 0 ELSE SUM(Profit)/ SUM(TotalAfterDiscount) END) as MarginPrice,
               (CASE WHEN SUM(ExtCost) <> 0 then SUM(Profit)/ SUM(ExtCost) ELSE 0 END) as MarkupPrice,
               SUM(Profit) as Profit,
               SUM(RegUnitPrice*Qty) - (SUM(ExtCost)+SUM(Discount)) as RegularProfit,
               SUM(Discount) as Discount, SUM(TotalAfterDiscount) as TotalAfterDiscount,
               StoreID, StoreName,
               max(TransactionEntryItem.Price) as Price, max(TransactionEntryItem.OnHand) as OnHand,
               SUM(RegUnitPrice*Qty) - SUM(Total) as SpecialDeficit
        FROM dbo.TransactionEntryItem INNER JOIN #ItemSelect ON TransactionEntryItem.ItemStoreID = #ItemSelect.ItemStoreID ';
        SET @Sel2 = N' GROUP BY Department, TransactionEntryItem.ItemStoreID, [Name], BarcodeNumber, ModalNumber, ItemID, StoreID, StoreName ';
    END

    DECLARE @Inner NVARCHAR(MAX) = @Sel1 + @MyWhere + @Filter + @Sel2;

    DECLARE @Paged NVARCHAR(MAX) =
        N'; SELECT *, COUNT(*) OVER() AS TotalRecords FROM (' + @Inner + N') AS PagedQ
           ORDER BY Department, [Name]
           OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    DECLARE @Cleanup NVARCHAR(400) =
        N' IF OBJECT_ID(N''tempdb.dbo.#ItemSelect'', N''U'') IS NOT NULL DROP TABLE #ItemSelect;' +
        CASE WHEN @CustomerFilter <> '' THEN N' IF OBJECT_ID(N''tempdb.dbo.#CustomerSelect'', N''U'') IS NOT NULL DROP TABLE #CustomerSelect;' ELSE N'' END;

    EXEC (@ItemSelect + @ItemFilter + @MyIndex + @CustomerSelect + @CustomerFilter + @Paged + @Cleanup);
END
GO

-- ================================================================================================
-- 21) Web_SP_GetItemSummary
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetItemSummary]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetItemSummary];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetItemSummary]
(
    @Filter         VARCHAR(MAX),
    @ItemFilter     VARCHAR(MAX),
    @CustomerFilter VARCHAR(MAX),
    @TableName      NVARCHAR(100) = 'TransactionEntryItem',
    @ModifierID     UNIQUEIDENTIFIER = NULL,
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

    SET @TableName = 'TransactionEntryItem';

    DECLARE @MySelect VARCHAR(MAX);
    DECLARE @MyGroup  VARCHAR(MAX);
    DECLARE @MyWhere  VARCHAR(MAX);
    DECLARE @MyIndex  NVARCHAR(4000);
    DECLARE @ItemSelect     VARCHAR(MAX) = 'Select DISTINCT ItemStoreID Into #ItemSelect From ItemsRepFilter Where (1=1) ';
    DECLARE @CustomerSelect VARCHAR(MAX) = '';

    IF @CustomerFilter <> ''
    BEGIN
        SET @CustomerSelect = ' Select CustomerID Into #CustomerSelect From CustomerRepFilter Where (1=1) ';
        SET @MyWhere = ' where (1=1) And exists (Select 1 From #CustomerSelect where CustomerID = ' + @TableName + '.CustomerID) ';
    END
    ELSE
        SET @MyWhere = ' where (1=1) ';

    IF (SELECT TOP 1 BO_SelectedDepartment FROM [UserQuery] WHERE [UserQuery].UserId = @ModifierID) = 1
    BEGIN
        SET @MyWhere = @MyWhere + ' and DepartmentID in (
            SELECT [DepartmentID] FROM [Develop].[dbo].[DepartmentToUserGroup]
            WHERE [Status] = 1 AND [GroupID] in (select GroupID from UserQuery where UserQuery.UserId='''
            + CONVERT(VARCHAR(100), @ModifierID) + '''))';
    END

    SET @MyIndex = N'; CREATE NONCLUSTERED INDEX [#Tem_Index_Temp_Table] ON [dbo].[#ItemSelect] ([ItemStoreID]) ';

    IF (SELECT COUNT(*) FROM SetUpValues WHERE OptionID = 100 AND ((OptionValue = '1') OR (OptionValue = 'True')) AND StoreID <> '00000000-0000-0000-0000-000000000000') > 0
        SET @MySelect = '
        SELECT ' + @TableName + '.ItemStoreID, Name, Groups, ParentName, Color, Size, MainSize,
               ModalNumber, BarcodeNumber, ItemTypeName, Department, DepartmentID,
               MainDepartment, SubDepartment, SubSubDepartment, StyleNo,
               (CASE WHEN IsNull(Supplier,'''')='''' THEN ParentSupplerName ELSE Supplier END) As Supplier,
               SupplierCode as ItemCodeSupplier, Brand, CustomerCode,
               SUM(Qty) AS Qty, SUM(QtyCase) AS QtyCase,
               SUM(ExtCost) as ExtCost, SUM(Total) as ExtPrice,
               (CASE WHEN SUM(ISNULL(ExtPrice,0)) = 0 OR SUM(ISNULL(TotalAfterDiscount,0)) = 0 THEN 0
                     WHEN SUM(ISNULL(ExtPrice,0)) <> 0 AND SUM(ISNULL(TotalAfterDiscount,0)) <> 0
                          AND CAST((SUM(ExtPrice) - SUM(TotalAfterDiscount)) As numeric) <> 0
                          THEN (((SUM(ExtPrice) - SUM(TotalAfterDiscount))) / SUM(ExtPrice))
                     ELSE NULL END) AS [Discount %],
               (CASE WHEN SUM(TotalAfterDiscount)=0 OR SUM(Profit)<=0 then 0
                     ELSE ((SUM(Profit))/(SUM(TotalAfterDiscount)/100))/100 END) as MarginPrice,
               (CASE WHEN SUM(ExtCost) <> 0 THEN SUM(Profit)/ SUM(ExtCost) ELSE 0 END) as MarkupPrice,
               SUM(Profit) as Profit,
               (SUM(Total) - SUM(TotalAfterDiscount)) as Discount,
               SUM(TotalAfterDiscount) as TotalAfterDiscount,
               StoreName, StoreID, ItemID,
               (CASE WHEN IsNull(SupplierCode,'''')='''' THEN ParentCode ELSE SupplierCode END) As ParentCode,
               max(Price) as Price, max(OnHand) as OnHand, max(OnOrder) as OnOrder,
               (CASE WHEN (IsNull(SUM(Qty),0)+(max(OnHand)))>0 THEN (100 / (max(OnHand) + SUM(QTY)) * SUM(QTY))/100 ELSE 0 END) AS SellThru,
               Groups AS Groups2, LastReceivedDate, LastReceivedQty,
               CustomField1, CustomField2, CustomField3, CustomField4, CustomField5,
               CustomField6, CustomField7, CustomField8, CustomField9, CustomField10
        FROM dbo.' + @TableName + ' INNER JOIN #ItemSelect ON ' + @TableName + '.ItemStoreID = #ItemSelect.ItemStoreID ';
    ELSE
        SET @MySelect = '
        SELECT ' + @TableName + '.ItemStoreID, Name, Groups, ParentName, Color, Size, MainSize,
               ModalNumber, BarcodeNumber, ItemTypeName, Department, DepartmentID,
               '''' AS MainDepartment, '''' AS SubDepartment, '''' AS SubSubDepartment, StyleNo,
               (CASE WHEN IsNull(Supplier,'''')='''' THEN ParentSupplerName ELSE Supplier END) As Supplier,
               SupplierCode as ItemCodeSupplier, Brand, CustomerCode,
               SUM(Qty) AS Qty, SUM(QtyCase) AS QtyCase,
               SUM(ExtCost) as ExtCost, SUM(Total) as ExtPrice,
               (CASE WHEN SUM(ISNULL(ExtPrice,0)) = 0 OR SUM(ISNULL(TotalAfterDiscount,0)) = 0 THEN 0
                     WHEN SUM(ISNULL(ExtPrice,0)) <> 0 AND SUM(ISNULL(TotalAfterDiscount,0)) <> 0
                          AND CAST((SUM(ExtPrice) - SUM(TotalAfterDiscount)) As numeric) <> 0
                          THEN (((SUM(ExtPrice) - SUM(TotalAfterDiscount))) / SUM(ExtPrice))
                     ELSE NULL END) AS [Discount %],
               (CASE WHEN SUM(TotalAfterDiscount)=0 OR SUM(Profit)<=0 then 0
                     ELSE ((SUM(Profit))/(SUM(TotalAfterDiscount)/100))/100 END) as MarginPrice,
               (CASE WHEN SUM(ExtCost) <> 0 THEN SUM(Profit)/ SUM(ExtCost) ELSE 0 END) as MarkupPrice,
               SUM(Profit) as Profit,
               (SUM(Total) - SUM(TotalAfterDiscount)) as Discount,
               SUM(TotalAfterDiscount) as TotalAfterDiscount,
               StoreName, StoreID, ItemID,
               (CASE WHEN IsNull(SupplierCode,'''')='''' THEN ParentCode ELSE SupplierCode END) As ParentCode,
               max(Price) as Price, max(OnHand) as OnHand, max(OnOrder) as OnOrder,
               (CASE WHEN (IsNull(SUM(Qty),0)+(max(OnHand)))>0 THEN (100 / (max(OnHand) + SUM(QTY)) * SUM(QTY))/100 ELSE 0 END) AS SellThru,
               Groups AS Groups2, LastReceivedDate, LastReceivedQty,
               CustomField1, CustomField2, CustomField3, CustomField4, CustomField5,
               CustomField6, CustomField7, CustomField8, CustomField9, CustomField10
        FROM dbo.' + @TableName + ' INNER JOIN #ItemSelect ON ' + @TableName + '.ItemStoreID = #ItemSelect.ItemStoreID ';

    IF (SELECT COUNT(*) FROM SetUpValues WHERE OptionID = 100 AND ((OptionValue = '1') OR (OptionValue = 'True')) AND StoreID <> '00000000-0000-0000-0000-000000000000') > 0
        SET @MyGroup = ' GROUP BY ' + @TableName + '.ItemStoreID, Name, Groups, ParentName, Color, Size, MainSize, ModalNumber, BarcodeNumber, ItemTypeName, Department, DepartmentID, MainDepartment, SubDepartment, SubSubDepartment, StyleNo, Supplier, SupplierCode, Brand, CustomerCode, StoreName, StoreID, ParentCode, ItemID, ParentSupplerName, LastReceivedDate, LastReceivedQty, CustomField1, CustomField2, CustomField3, CustomField4, CustomField5, CustomField6, CustomField7, CustomField8, CustomField9, CustomField10 ';
    ELSE
        SET @MyGroup = ' GROUP BY ' + @TableName + '.ItemStoreID, Name, Groups, ParentName, Color, Size, MainSize, ModalNumber, BarcodeNumber, ItemTypeName, Department, DepartmentID, StyleNo, Supplier, SupplierCode, Brand, CustomerCode, StoreName, StoreID, ParentCode, ItemID, ParentSupplerName, LastReceivedDate, LastReceivedQty, CustomField1, CustomField2, CustomField3, CustomField4, CustomField5, CustomField6, CustomField7, CustomField8, CustomField9, CustomField10 ';

    DECLARE @Inner NVARCHAR(MAX) = CAST(@MySelect AS NVARCHAR(MAX)) + CAST(@MyWhere AS NVARCHAR(MAX)) + CAST(@Filter AS NVARCHAR(MAX)) + CAST(@MyGroup AS NVARCHAR(MAX));

    DECLARE @Paged NVARCHAR(MAX) =
        N'; SELECT *, COUNT(*) OVER() AS TotalRecords FROM (' + @Inner + N') AS PagedQ
           ORDER BY Name
           OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    DECLARE @Cleanup NVARCHAR(400) =
        N' IF OBJECT_ID(N''tempdb.dbo.#ItemSelect'', N''U'') IS NOT NULL DROP TABLE #ItemSelect;' +
        CASE WHEN @CustomerFilter <> '' THEN N' IF OBJECT_ID(N''tempdb.dbo.#CustomerSelect'', N''U'') IS NOT NULL DROP TABLE #CustomerSelect;' ELSE N'' END;

    DECLARE @FullSql NVARCHAR(MAX) = CAST(@ItemSelect AS NVARCHAR(MAX)) + CAST(@ItemFilter AS NVARCHAR(MAX)) + @MyIndex + CAST(@CustomerSelect AS NVARCHAR(MAX)) + CAST(@CustomerFilter AS NVARCHAR(MAX)) + @Paged + @Cleanup;
    EXEC (@FullSql);
END
GO


-- ================================================================================================
-- 22) Web_SP_GetSalesProfit
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

    -- ORDER BY [Date] — the SalesProfitView exposes a Date column (not StartSaleTime),
    -- which is what the C# caller (GetSalesSummaryByTransactionDataAsync) both filters by
    -- and reads back. The previous "ORDER BY StartSaleTime DESC" raised
    -- "Invalid column name 'StartSaleTime'" at runtime. See 20260519_Fix_Web_SP_GetSalesProfit_OrderBy.sql.
    DECLARE @Paged NVARCHAR(MAX) =
        N'; SELECT *, COUNT(*) OVER() AS TotalRecords FROM (' + @Inner + N') AS PagedQ
           ORDER BY [Date] DESC
           OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    DECLARE @Cleanup NVARCHAR(200) =
        CASE WHEN @CustomerFilter <> '' THEN N' IF OBJECT_ID(N''tempdb.dbo.#CustomerSelect'', N''U'') IS NOT NULL DROP TABLE #CustomerSelect;' ELSE N'' END;

    EXEC (@CustomerSelect + @CustomerFilter + @Paged + @Cleanup);
END
GO

-- ================================================================================================
-- 23) Web_Get_SummaryReport  (FIXED multi-row summary - no real pagination)
-- ------------------------------------------------------------------------------------------------
-- Returns all rows of the original summary report unchanged. Accepts @PageNumber/@PageSize for
-- API uniformity but ignores them. Each row carries TotalRecords (= total summary row count).
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_Get_SummaryReport]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_Get_SummaryReport];
GO
CREATE PROCEDURE [dbo].[Web_Get_SummaryReport]
(
    @From                       DATETIME,
    @To                         DATETIME,
    @Store                      UNIQUEIDENTIFIER = NULL,
    @DisplayChecksIndividually  BIT = 0,
    @PageNumber                 INT = 1,
    @PageSize                   INT = 1000
)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Sale     DECIMAL(19, 3);
    DECLARE @Tax      DECIMAL(19, 3);
    DECLARE @Gift     DECIMAL(19, 3);
    DECLARE @TagAlong DECIMAL(19, 3);
    DECLARE @Tender   DECIMAL(19, 3);
    DECLARE @AR       DECIMAL(19, 3);
    DECLARE @Payout   DECIMAL(19, 3);
    DECLARE @Payments DECIMAL(19, 3);
    DECLARE @Shipping DECIMAL(19, 3);

    IF @Store = '00000000-0000-0000-0000-000000000000'
        SET @Store = NULL;

    SELECT ISNULL(S.SystemValueName, R.TenderName) AS Description,
           FORMAT(ISNULL(SUM(E.Amount), 0), N'c') AS Total,
           12.0 + ROW_NUMBER() OVER (ORDER BY R.SortOrder, ISNULL(S.SystemValueName, 0)) * 0.1 AS Sort
    INTO #Tender
    FROM TenderEntry E
    INNER JOIN [Transaction] T ON E.TransactionID = T.TransactionID
    INNER JOIN Tender R        ON E.TenderID = R.TenderID
    LEFT  JOIN SystemValues S  ON CAST(S.SystemValueNo AS NVARCHAR) = E.Common3 AND S.SystemTableNo = 5
    WHERE LOWER(R.TenderName) <> 'check'
      AND E.Status > 0 AND T.Status > 0
      AND R.TenderGroup <> 6 AND R.TenderGroup <> 7
      AND EndSaleTime >= @From AND EndSaleTime < @To
      AND (StoreID = @Store OR @Store IS NULL)
    GROUP BY R.TenderName, R.SortOrder, S.SystemValueName
    ORDER BY R.TenderName;

    SET @Sale = (SELECT ISNULL(SUM(TotalAfterDiscount), 0) FROM TransactionEntryItem
                 WHERE EndSaleTime >= @From AND EndSaleTime < @To
                   AND (ISNULL(ModalNumber, '') <> 'SHIPPING' AND ISNULL(BarcodeNumber, '') <> 'TAX')
                   AND (StoreID = @Store OR @Store IS NULL));

    SET @Tax = (SELECT SUM(ROUND(ISNULL(Tax, 0), 2)) FROM [Transaction] T
                WHERE TransactionType <> 4 AND Status > 0
                  AND EndSaleTime >= @From AND EndSaleTime < @To
                  AND (StoreID = @Store OR @Store IS NULL))
             + (SELECT ISNULL(SUM(TotalAfterDiscount), 0) FROM TransactionEntryItem
                WHERE EndSaleTime >= @From AND EndSaleTime < @To
                  AND BarcodeNumber = 'TAX'
                  AND (StoreID = @Store OR @Store IS NULL));

    SET @Gift = (SELECT ISNULL(SUM(ISNULL(Total, 0)), 0)
                 FROM dbo.TransactionEntry AS E WITH (NOLOCK)
                 INNER JOIN dbo.[Transaction] AS T WITH (NOLOCK) ON E.TransactionID = T.TransactionID
                 INNER JOIN dbo.Store S ON T.StoreID = S.StoreID
                 WHERE E.Status > 0 AND T.Status > 0 AND TransactionEntryType = 5 AND TransactionType <> 4
                   AND EndSaleTime >= @From AND EndSaleTime < @To
                   AND (T.StoreID = @Store OR @Store IS NULL));

    SET @TagAlong = (SELECT ISNULL(SUM(ISNULL(TotalAfterDiscount, 0)), 0) FROM TransactionEntryItem
                     WHERE ItemType = 5 AND EndSaleTime >= @From AND EndSaleTime < @To
                       AND (StoreID = @Store OR @Store IS NULL));

    SET @Tender = (SELECT ISNULL(SUM(Amount), 0) FROM TenderEntry E
                   INNER JOIN [Transaction] T ON E.TransactionID = T.TransactionID
                   INNER JOIN Tender R        ON E.TenderID = R.TenderID
                   WHERE E.Status > 0 AND T.Status > 0 AND R.TenderType <> 1 AND T.TransactionType <> 4
                     AND EndSaleTime >= @From AND EndSaleTime < @To
                     AND (StoreID = @Store OR @Store IS NULL));

    SET @Payout = (SELECT ISNULL(SUM(P.Amount), 0) FROM PayOutView P
                   WHERE P.Status > 0 AND P.PayOutDate >= @From AND P.PayOutDate < @To
                     AND (StoreID = @Store OR @Store IS NULL));

    SET @AR = (SELECT (CASE WHEN ISNULL(SUM(ISNULL(T.Debit, 0)) - SUM(ISNULL(T.Credit, 0)), 0) > 0
                            THEN ISNULL(SUM(ISNULL(T.Debit, 0)) - SUM(ISNULL(T.Credit, 0)), 0) ELSE 0 END)
               FROM [Transaction] T
               WHERE Status > 0 AND TransactionType <> 4 AND TransactionType <> 2
                 AND ISNULL(Debit, 0) - ISNULL(Credit, 0) > 0
                 AND EndSaleTime >= @From AND EndSaleTime < @To
                 AND (StoreID = @Store OR @Store IS NULL));

    SET @Payments = (SELECT SUM(ISNULL(Credit, 0) - ISNULL(Debit, 0)) FROM [Transaction] T
                     WHERE Status > 0 AND TransactionType <> 4 AND TransactionType <> 2
                       AND ISNULL(Credit, 0) - ISNULL(Debit, 0) > 0
                       AND EndSaleTime >= @From AND EndSaleTime < @To
                       AND (StoreID = @Store OR @Store IS NULL));

    SET @Shipping = (SELECT ISNULL(SUM(TotalAfterDiscount), 0) FROM TransactionEntryItem
                     WHERE (ItemType = 3 OR ModalNumber = 'SHIPPING')
                       AND EndSaleTime >= @From AND EndSaleTime < @To
                       AND (StoreID = @Store OR @Store IS NULL));

    ;WITH FinalQ AS
    (
        SELECT D.Description, D.Total, D.Sort
        FROM (
            SELECT 'No. of Sales' AS Description,
                   FORMAT(ISNULL(COUNT(DISTINCT TransactionID), 0), N'N0') AS Total, 0 AS Sort
            FROM [Transaction] T
            WHERE EndSaleTime >= @From AND EndSaleTime < @To
              AND (StoreID = @Store OR @Store IS NULL) AND T.Status > 0
            UNION ALL SELECT 'Sales',     FORMAT(ISNULL(@Sale,0),     N'c'), 1
            UNION ALL SELECT 'Sales Tax', FORMAT(ISNULL(@Tax,0),      N'c'), 2
            UNION ALL SELECT 'Gift Cards Sold',
                            FORMAT(ISNULL(SUM(ISNULL(Total, 0)), 0), N'c'), 3
                     FROM dbo.TransactionEntry AS E WITH (NOLOCK)
                     INNER JOIN dbo.[Transaction] AS T WITH (NOLOCK) ON E.TransactionID = T.TransactionID
                     INNER JOIN dbo.Store S ON T.StoreID = S.StoreID
                     WHERE E.Status > 0 AND T.Status > 0 AND TransactionEntryType = 5 AND TransactionType <> 4
                       AND EndSaleTime >= @From AND EndSaleTime < @To
                       AND (T.StoreID = @Store OR @Store IS NULL)
            UNION ALL SELECT 'Tag Along',                 FORMAT(ISNULL(@TagAlong,0), N'c'), 3.1
            UNION ALL SELECT 'Service & Shipping Charge', FORMAT(ISNULL(@Shipping,0), N'c'), 3.2
            UNION ALL SELECT 'Total',
                            FORMAT(@Sale + ISNULL(@Tax,0) + @Gift + @TagAlong + ISNULL(@Shipping,0), N'c'), 3.3
            UNION ALL SELECT '', '', 4
            UNION ALL SELECT 'Tender - Payout', FORMAT(ISNULL(@Tender,0) - ISNULL(@Payout,0), N'c'), 6
            UNION ALL SELECT 'AR',           FORMAT(ISNULL(@AR,0),       N'c'), 7
            UNION ALL SELECT 'AR PAYMENTS',  FORMAT(ISNULL(@Payments,0), N'c'), 8
            UNION ALL SELECT 'Payout',       FORMAT(ISNULL(@Payout,0),   N'c'), 9
            UNION ALL SELECT 'Total ',
                            FORMAT((ISNULL(@Tender,0) + ISNULL(@AR,0)) - ISNULL(@Payments,0), N'c'), 9.1
            UNION ALL SELECT '', '', 11
            UNION ALL SELECT T.Description, T.Total, T.Sort FROM #Tender T
            UNION ALL SELECT TenderName COLLATE SQL_Latin1_General_CP1_CI_AS + '    # ' + E.Common1 COLLATE SQL_Latin1_General_CP1_CI_AS,
                            FORMAT(ISNULL(Amount, 0), N'c'), 12.5
                     FROM TenderEntry E
                     INNER JOIN [Transaction] T ON E.TransactionID = T.TransactionID
                     INNER JOIN Tender R        ON E.TenderID = R.TenderID
                     WHERE LOWER(R.TenderName) = 'check' AND E.Status > 0 AND T.Status > 0
                       AND @DisplayChecksIndividually = 1
                       AND EndSaleTime >= @From AND EndSaleTime < @To
                       AND (StoreID = @Store OR @Store IS NULL)
            UNION ALL SELECT 'Check', FORMAT(ISNULL(SUM(Amount), 0), N'c'), 12.5
                     FROM TenderEntry E
                     INNER JOIN [Transaction] T ON E.TransactionID = T.TransactionID
                     INNER JOIN Tender R        ON E.TenderID = R.TenderID
                     WHERE LOWER(R.TenderName) = 'check' AND E.Status > 0 AND T.Status > 0
                       AND @DisplayChecksIndividually = 0
                       AND EndSaleTime >= @From AND EndSaleTime < @To
                       AND (StoreID = @Store OR @Store IS NULL)
            UNION ALL SELECT 'Total Tender', FORMAT(ISNULL(SUM(Amount), 0), N'c'), 13
                     FROM TenderEntry E
                     INNER JOIN [Transaction] T ON E.TransactionID = T.TransactionID
                     INNER JOIN Tender R        ON E.TenderID = R.TenderID
                     WHERE E.Status > 0 AND T.Status > 0 AND R.TenderGroup <> 6 AND R.TenderGroup <> 7
                       AND EndSaleTime >= @From AND EndSaleTime < @To
                       AND (StoreID = @Store OR @Store IS NULL)
            UNION ALL SELECT '', '', 14
            UNION ALL SELECT 'Over/Short', '', 15
            UNION ALL SELECT '', '', 16
            UNION ALL SELECT 'Sales', FORMAT(ISNULL(SUM(TotalAfterDiscount), 0), N'c'), 17
                     FROM TransactionEntryProfit
                     WHERE EndSaleTime >= @From AND EndSaleTime < @To
                       AND (StoreID = @Store OR @Store IS NULL)
            UNION ALL SELECT 'Cost',  FORMAT(ISNULL(SUM(ISNULL(ExtCost, 0)), 0), N'c'), 18
                     FROM TransactionEntryProfit
                     WHERE EndSaleTime >= @From AND EndSaleTime < @To
                       AND (StoreID = @Store OR @Store IS NULL)
            UNION ALL SELECT 'Gross Porfit',
                            CASE WHEN SUM(TotalAfterDiscount) <> 0
                                      AND SUM(TotalAfterDiscount) - SUM(ISNULL(ExtCost,0)) <> 0
                                 THEN FORMAT(ISNULL((SUM(TotalAfterDiscount) - SUM(ISNULL(ExtCost,0))) / SUM(TotalAfterDiscount), 0), 'P2')
                                      + '     '
                                      + FORMAT(ISNULL(SUM(TotalAfterDiscount) - SUM(ISNULL(ExtCost,0)), 0), N'c')
                                 ELSE FORMAT(0, 'c') END, 19
                     FROM TransactionEntryProfit
                     WHERE EndSaleTime >= @From AND EndSaleTime < @To
                       AND (StoreID = @Store OR @Store IS NULL)
        ) AS D
    )
    SELECT Description, Total, Sort, COUNT(*) OVER() AS TotalRecords
    FROM FinalQ
    ORDER BY Sort;

    DROP TABLE #Tender;
END
GO

-- ================================================================================================
-- 24) Web_SP_GetBatchBetweenDayes
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetBatchBetweenDayes]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetBatchBetweenDayes];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetBatchBetweenDayes]
(
    @FromDate   DATETIME,
    @ToDate     DATETIME,
    @PageNumber INT = 1,
    @PageSize   INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    ;WITH Inner_Q AS
    (
        SELECT * FROM Batch
        WHERE OpeningDateTime >= @FromDate AND OpeningDateTime < @ToDate
    )
    SELECT *, COUNT(*) OVER() AS TotalRecords
    FROM Inner_Q
    ORDER BY OpeningDateTime DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO

-- ================================================================================================
-- 25) Web_SP_GetRptZOut  (single-batch result - no real pagination)
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetRptZOut]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetRptZOut];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetRptZOut]
(
    @BatchID    UNIQUEIDENTIFIER,
    @PageNumber INT = 1,
    @PageSize   INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT BatchID, BatchNumber, UserName,
           ISNULL(TotalSales, 0) - ISNULL(TotalReturn, 0) AS Total,
           (SELECT COUNT(*) FROM [TRANSACTION] WHERE BatchID = RepBatchView.BatchID AND status > 0) AS TransactionCount,
           TotalSales, TotalReturn, PayBalance, Tax, PayOut,
           (SELECT COUNT(*) FROM (SELECT DISTINCT customerid FROM [TRANSACTION] WHERE Status > 0 AND BatchID = RepBatchView.BatchID) dt) AS CustomerCount,
           (SELECT COUNT(*) FROM actions WHERE status > 0 AND BatchID = RepBatchView.BatchID AND ActionType = 1) AS CancelSale,
           (SELECT COUNT(*) FROM actions WHERE status > 0 AND BatchID = RepBatchView.BatchID AND ActionType = 2) AS VoiidItem,
           (SELECT COUNT(*) FROM actions WHERE status > 0 AND BatchID = RepBatchView.BatchID AND ActionType = 3) AS OpenDrawer,
           (SELECT SUM(dbo.TransactionEntry.UOMPrice)
            FROM dbo.TransactionEntry
            INNER JOIN dbo.[TRANSACTION] ON dbo.TransactionEntry.TransactionID = dbo.[TRANSACTION].TransactionID
                                         AND transactionEntryType = 4 AND BatchID = RepBatchView.BatchID) AS TotalDiscount,
           COUNT(*) OVER() AS TotalRecords
    FROM dbo.RepBatchView
    WHERE BatchID = @BatchID;
END
GO

-- ================================================================================================
-- 26) Web_SP_GetReturnItemsByItem
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetReturnItemsByItem]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetReturnItemsByItem];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetReturnItemsByItem]
(
    @Filter         NVARCHAR(4000),
    @ItemFilter     NVARCHAR(4000),
    @CustomerFilter NVARCHAR(4000),
    @PageNumber     INT = 1,
    @PageSize       INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    DECLARE @MyWhere        NVARCHAR(4000);
    DECLARE @ItemSelect     NVARCHAR(4000) = N'Select Distinct ItemStoreID Into #ItemSelect From ItemsRepFilter Where (1=1) ';
    DECLARE @CustomerSelect NVARCHAR(4000) = N'';

    IF @CustomerFilter <> ''
    BEGIN
        SET @CustomerSelect = N' Select Distinct CustomerID Into #CustomerSelect From CustomerRepFilter Where (1=1) ';
        SET @MyWhere = N' where dbo.TransactionEntryView.Status>0 AND ((TransactionEntryView.TransactionEntryType = 2 AND TransactionEntryView.Qty <> 0) OR QTY < 0)
                            And exists (Select 1 From #ItemSelect where ItemStoreID = TransactionEntryView.ItemStoreID)
                            And exists (Select 1 From #CustomerSelect where CustomerID = TransactionEntryView.CustomerID) ';
    END
    ELSE
        SET @MyWhere = N' where dbo.TransactionEntryView.Status>0 AND ((TransactionEntryView.TransactionEntryType = 2 AND TransactionEntryView.Qty <> 0) OR QTY < 0)
                            And exists (Select 1 From #ItemSelect where ItemStoreID = TransactionEntryView.ItemStoreID) ';

    DECLARE @MySelect NVARCHAR(MAX) = N'
        SELECT ISNULL(TransactionEntryView.Name, ''[MANUAL ITEM]'') AS Name,
               TransactionEntryView.ModalNumber,
               TransactionEntryView.ItemCode,
               ISNULL(TransactionEntryView.Qty, 0) AS Qty,
               ISNULL(TransactionEntryView.Total, 0) AS Amount,
               Supplier.Name AS SuppName,
               TransactionEntryView.Note AS ReturnReason,
               [Transaction].TransactionID,
               [Transaction].StoreID,
               MAX(TransactionEntryView.Price) AS Price,
               MAX(TransactionEntryView.OnHand) AS OnHand,
               TheSale.SaleTransNo,
               TheSale.SaleTransID
        FROM TransactionEntryView
        INNER JOIN [Transaction] ON TransactionEntryView.TransactionID = [Transaction].TransactionID
        LEFT  JOIN
            (SELECT TransReturen.ReturenID, TransReturen.SaleTransEntryID, TransReturen.ReturenTransID,
                    TransReturen.DateCreated, Num.SaleTransNo, Num.SaleTransID, Num.TransactionEntryID
             FROM TransReturen
             INNER JOIN
                (SELECT T1.TransactionNo AS SaleTransNo, T1.TransactionID AS SaleTransID, TransactionEntry.TransactionEntryID
                 FROM [Transaction] AS T1
                 INNER JOIN TransactionEntry ON T1.TransactionID = TransactionEntry.TransactionID) AS Num
                ON TransReturen.ReturenTransID = Num.TransactionEntryID) AS TheSale
            ON TransactionEntryView.TransactionEntryID = TheSale.SaleTransEntryID
        LEFT  JOIN SystemValues ON TransactionEntryView.ReturnReason = SystemValues.SystemValueNo AND SystemValues.SystemTableNo = 29
        LEFT  JOIN ItemSupply   ON TransactionEntryView.ItemStoreID = ItemSupply.ItemStoreNo AND ItemSupply.Status > 0 AND ItemSupply.IsMainSupplier = 1
        LEFT  JOIN Supplier     ON ItemSupply.SupplierNo = Supplier.SupplierID AND ItemSupply.Status > 0 AND ItemSupply.IsMainSupplier = 1
    ';

    DECLARE @MyGroupBy NVARCHAR(4000) = N'
        GROUP BY TransactionEntryView.Name, TransactionEntryView.ModalNumber, TransactionEntryView.ItemCode,
                 TransactionEntryView.Qty, TransactionEntryView.Total, TransactionEntryView.Note,
                 SystemValues.SystemValueName, Supplier.Name, TransactionEntryView.ItemStoreID,
                 [Transaction].TransactionID, [Transaction].StoreID, TheSale.SaleTransNo, TheSale.SaleTransID ';

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @MyWhere + @Filter + @MyGroupBy;

    DECLARE @Paged NVARCHAR(MAX) =
        N'; SELECT *, COUNT(*) OVER() AS TotalRecords FROM (' + @Inner + N') AS PagedQ
           ORDER BY Name
           OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    DECLARE @Cleanup NVARCHAR(400) =
        N' IF OBJECT_ID(N''tempdb.dbo.#ItemSelect'', N''U'') IS NOT NULL DROP TABLE #ItemSelect;' +
        CASE WHEN @CustomerFilter <> '' THEN N' IF OBJECT_ID(N''tempdb.dbo.#CustomerSelect'', N''U'') IS NOT NULL DROP TABLE #CustomerSelect;' ELSE N'' END;

    EXEC (@ItemSelect + @ItemFilter + @CustomerSelect + @CustomerFilter + @Paged + @Cleanup);
END
GO

IF OBJECT_ID(N'[dbo].[ItemPiece]', N'V') IS NOT NULL
    DROP VIEW [dbo].[ItemPiece];
GO

CREATE VIEW [dbo].[ItemPiece]
AS
SELECT        ItemID, Name, ModalNumber, BarcodeNumber, ISNULL(OnOrder, 0) AS OnOrder, OnHand,Department, StoreName, ParentCode,
 (SELECT CASE WHEN (CostByCase = 1 AND CaseQty IS NULL) THEN AVGCost WHEN (CostByCase = 1 AND CaseQty = 0) THEN AVGCost WHEN CostByCase = 1 THEN AVGCost / CaseQty ELSE Cost END AS Expr1) AS AVGCost,
 (SELECT CASE WHEN (CaseQty IS NULL) THEN OnHand WHEN (CaseQty = 0) THEN OnHand ELSE OnHand / CaseQty END AS Expr1) AS OnHandCase,
 (SELECT CASE WHEN (CostByCase = 1 AND CaseQty IS NULL) THEN Cost WHEN (CostByCase = 1 AND CaseQty = 0) THEN Cost WHEN CostByCase = 1 THEN Cost / CaseQty ELSE Cost END AS Expr1) AS Cost,
                             (SELECT        CASE WHEN (PriceByCase = 1 AND CaseQty IS NULL) THEN Price WHEN (PriceByCase = 1 AND CaseQty = 0) THEN Price WHEN PriceByCase = 1 THEN Price / CaseQty ELSE Price END AS Expr1) 
                         AS Price, DepartmentID, StoreNo, SupplierName, ISNULL(OnTransferOrder, 0) AS OnTransfer, LinkNo, [Supplier Item Code], ItemType, Brand,CaseQty,ItemStoreID,MainDepartment, SubDepartment, SubSubDepartment
FROM            ItemMainAndStoreView
WHERE        (Status > 0)
GO




-- ================================================================================================
-- 27) Web_Sp_GetDepartments
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_Sp_GetDepartments]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_Sp_GetDepartments];
GO
CREATE PROCEDURE [dbo].[Web_Sp_GetDepartments]
(
    @StoreID    UNIQUEIDENTIFIER = NULL,
    @Date       DATETIME         = NULL,
    @PageNumber INT = 1,
    @PageSize   INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    DECLARE @SubDept BIT = CASE WHEN (SELECT COUNT(*) FROM SetUpValues WHERE OptionID = 100 AND OptionValue = '1' AND StoreID <> '00000000-0000-0000-0000-000000000000') > 0 THEN 1 ELSE 0 END;

    IF @Date IS NULL
    BEGIN
        IF @SubDept = 1
        BEGIN
            ;WITH Inner_Q AS
            (
                SELECT MainDepartment, SubDepartment, SubSubDepartment,
                       DepartmentID AS DepartmentStoreID,
                       Department AS [Name],
                       SUM(ItemPiece.OnOrder)                AS OnOrder,
                       SUM(ItemPiece.OnHand)                 AS OnHand,
                       SUM(ItemPiece.OnHand * ItemPiece.Cost)    AS Cost,
                       SUM(ItemPiece.OnHand * ItemPiece.Price)   AS Price,
                       SUM(ItemPiece.OnHand * ItemPiece.AVGCost) AS AVGCost,
                       StoreName,
                       StoreNo AS StoreID
                FROM ItemPiece
                WHERE ((ItemPiece.StoreNo = @StoreID) OR (@StoreID IS NULL))
                  AND ItemPiece.ItemType NOT IN (2, 3, 9)
                GROUP BY MainDepartment, SubDepartment, SubSubDepartment, DepartmentID, Department, StoreName, StoreNo
            )
            SELECT *, COUNT(*) OVER() AS TotalRecords
            FROM Inner_Q
            ORDER BY [Name]
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
        END
        ELSE
        BEGIN
            ;WITH Inner_Q AS
            (
                SELECT '' AS MainDepartment, '' AS SubDepartment, '' AS SubSubDepartment,
                       DepartmentID AS DepartmentStoreID,
                       Department AS [Name],
                       SUM(ItemPiece.OnOrder)                AS OnOrder,
                       SUM(ItemPiece.OnHand)                 AS OnHand,
                       SUM(ItemPiece.OnHand * ItemPiece.Cost)    AS Cost,
                       SUM(ItemPiece.OnHand * ItemPiece.Price)   AS Price,
                       SUM(ItemPiece.OnHand * ItemPiece.AVGCost) AS AVGCost,
                       StoreName,
                       StoreNo AS StoreID
                FROM ItemPiece
                WHERE ((ItemPiece.StoreNo = @StoreID) OR (@StoreID IS NULL))
                  AND ItemPiece.ItemType NOT IN (2, 3, 9)
                GROUP BY DepartmentID, Department, StoreName, StoreNo
            )
            SELECT *, COUNT(*) OVER() AS TotalRecords
            FROM Inner_Q
            ORDER BY [Name]
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
        END
    END
    ELSE
    BEGIN
        IF @SubDept = 1
        BEGIN
            ;WITH Inner_Q AS
            (
                SELECT MainDepartment, SubDepartment, SubSubDepartment,
                       al.DepartmentStoreID, al.[Name],
                       SUM(al.OnOrder) AS OnOrder,
                       SUM(al.OnHandCalc) AS OnHand,
                       SUM(al.OnHandCalc * al.Cost)    AS Cost,
                       SUM(al.OnHandCalc * al.Price)   AS Price,
                       SUM(al.OnHandCalc * al.AVGCost) AS AVGCost,
                       al.StoreName, al.StoreID
                FROM (
                    SELECT MainDepartment, SubDepartment, SubSubDepartment,
                           DepartmentID AS DepartmentStoreID,
                           Department AS [Name],
                           ItemPiece.OnOrder,
                           dbo.GetItemOnHand(ItemPiece.itemStoreId, @Date) AS OnHandCalc,
                           ItemPiece.Cost, ItemPiece.Price, ItemPiece.AVGCost,
                           StoreName, StoreNo AS StoreID
                    FROM ItemPiece
                    WHERE ((ItemPiece.StoreNo = @StoreID) OR (@StoreID IS NULL))
                      AND ItemPiece.ItemType NOT IN (2, 3, 9)
                ) AS al
                GROUP BY al.MainDepartment, al.SubDepartment, al.SubSubDepartment, al.DepartmentStoreID, al.[Name], al.StoreName, al.StoreID
            )
            SELECT *, COUNT(*) OVER() AS TotalRecords
            FROM Inner_Q
            ORDER BY [Name]
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
        END
        ELSE
        BEGIN
            ;WITH Inner_Q AS
            (
                SELECT '' AS MainDepartment, '' AS SubDepartment, '' AS SubSubDepartment,
                       al.DepartmentStoreID, al.[Name],
                       SUM(al.OnOrder) AS OnOrder,
                       SUM(ISNULL(al.OnHandCalc, 0)) AS OnHand,
                       SUM(al.OnHandCalc * al.Cost)    AS Cost,
                       SUM(al.OnHandCalc * al.Price)   AS Price,
                       SUM(al.OnHandCalc * al.AVGCost) AS AVGCost,
                       al.StoreName, al.StoreID
                FROM (
                    SELECT DepartmentID AS DepartmentStoreID,
                           Department AS [Name],
                           ItemPiece.OnOrder,
                           dbo.GetItemOnHand(ItemPiece.itemStoreId, @Date) AS OnHandCalc,
                           ItemPiece.Cost, ItemPiece.Price, ItemPiece.AVGCost,
                           StoreName, StoreNo AS StoreID
                    FROM ItemPiece
                    WHERE ((ItemPiece.StoreNo = @StoreID) OR (@StoreID IS NULL))
                      AND ItemPiece.ItemType NOT IN (2, 3, 9)
                ) AS al
                GROUP BY al.DepartmentStoreID, al.[Name], al.StoreName, al.StoreID
            )
            SELECT *, COUNT(*) OVER() AS TotalRecords
            FROM Inner_Q
            ORDER BY [Name]
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
        END
    END
END
GO

-- ================================================================================================
-- 28) Web_SP_GetSubDepartments  (recursive tree - no real pagination)
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetSubDepartments]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetSubDepartments];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetSubDepartments]
(
    @DepartmentID UNIQUEIDENTIFIER,
    @PageNumber   INT = 1,
    @PageSize     INT = 1000
)
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH TREE(MAINID, TEXT, PARENT) AS
    (
        SELECT DEPARTMENTSTOREID, NAME, PARENTDEPARTMENTID
        FROM DEPARTMENTSTORE
        WHERE PARENTDEPARTMENTID = @DepartmentID
        UNION ALL
        SELECT Z.DEPARTMENTSTOREID, Z.NAME, Z.PARENTDEPARTMENTID
        FROM DEPARTMENTSTORE Z
        INNER JOIN TREE ON TREE.MAINID = Z.PARENTDEPARTMENTID
    )
    SELECT MAINID, TEXT, PARENT, COUNT(*) OVER() AS TotalRecords
    FROM TREE
    OPTION (MAXRECURSION 100);
END
GO

-- ================================================================================================
-- 29) Web_SP_GetPriceChange
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetPriceChange]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetPriceChange];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetPriceChange]
(
    @Filter     NVARCHAR(4000),
    @ItemFilter NVARCHAR(4000),
    @PageNumber INT = 1,
    @PageSize   INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    DECLARE @ItemSelect NVARCHAR(4000) =
        N'Select DISTINCT ItemStoreID Into #ItemSelect From ItemsRepFilter Where (1=1) ';

    DECLARE @MySelect NVARCHAR(MAX) =
        N'SELECT PriceChangeHistory.ItemStoreID, ItemMainAndStoreView.ItemID,
                 PriceChangeHistory.PriceLevel, PriceChangeHistory.OldPrice, PriceChangeHistory.NewPrice,
                 PriceChangeHistory.Date AS ChangeDate, PriceChangeHistory.SaleDate,
                 PriceChangeHistory.SaleType, PriceChangeHistory.SP_Price,
                 ItemMainAndStoreView.Department, ItemMainAndStoreView.Name,
                 ItemMainAndStoreView.ModalNumber, ItemMainAndStoreView.BarcodeNumber,
                 ItemMainAndStoreView.Brand, tmpUsers.UserName
          FROM PriceChangeHistory
          INNER JOIN ItemMainAndStoreView ON PriceChangeHistory.ItemStoreID = ItemMainAndStoreView.ItemStoreID
          INNER JOIN (SELECT UserId AS MyUserID, UserName FROM Users) AS tmpUsers
                  ON PriceChangeHistory.UserID = tmpUsers.MyUserID';

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @Filter;

    DECLARE @Paged NVARCHAR(MAX) =
        N'; SELECT *, COUNT(*) OVER() AS TotalRecords FROM (' + @Inner + N') AS PagedQ
           ORDER BY ChangeDate DESC
           OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    EXEC (@ItemSelect + @ItemFilter + @Paged + N' IF OBJECT_ID(N''tempdb.dbo.#ItemSelect'', N''U'') IS NOT NULL DROP TABLE #ItemSelect;');
END
GO

-- ================================================================================================
-- 30) Web_SP_GetSalesHistory
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetSalesHistory]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetSalesHistory];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetSalesHistory]
(
    @Filter      NVARCHAR(4000),
    @IsPOS       BIT = 1,
    @ItemStoreID UNIQUEIDENTIFIER = NULL,
    @MainStore   BIT = 0,
    @Stores      Guid_list_tbltype READONLY,
    @PageNumber  INT = 1,
    @PageSize    INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    DECLARE @MySelect NVARCHAR(MAX);

    IF @MainStore = 1
    BEGIN
        SET @MySelect = N'SELECT TransactionNo, TransactionType, TransactionID, StartSaleTime,
                                 StartSaleTime AS SaleTime, TotalAfterDiscount,
                                 QtyCase, Qty, Price, ExtPrice AS Total, StoreName,
                                 CustomerNo, [Type], [Customer Name]
                          FROM HistoryView ';
        SET @ItemStoreID = (SELECT ItemNo FROM ItemStore WHERE ItemStoreID = @ItemStoreID AND Status > 0);
        SET @Filter = @Filter + N' AND ItemStoreID IN (SELECT ItemStoreID FROM ItemStore WHERE 1=1 AND ItemNo = ''' + CAST(@ItemStoreID AS NVARCHAR(50)) + ''')';
    END
    ELSE
    BEGIN
        IF @IsPOS = 1
            SET @MySelect = N'SELECT TransactionNo, TransactionType, TransactionID, StartSaleTime,
                                     StartSaleTime AS SaleTime, TotalAfterDiscount,
                                     QtyCase, Qty, Price, ExtPrice AS Total, StoreName,
                                     CustomerNo, [Type], [Customer Name]
                              FROM HistoryView ';
        ELSE
            SET @MySelect = N'SELECT TransactionNo, TransactionType, TransactionID, StartSaleTime,
                                     ItemStoreID, UOMQty, ExtPrice AS Total,
                                     Price, StartSaleTime AS SaleTime, QtyCase, StoreName,
                                     CustomerNo, [Type], [Customer Name], TotalAfterDiscount
                              FROM HistoryView ';

        IF NOT EXISTS (SELECT 1 FROM @Stores) OR (SELECT COUNT(*) FROM @Stores) <= 1
            SET @Filter = @Filter + N' AND ItemStoreID = ''' + CAST(@ItemStoreID AS NVARCHAR(50)) + '''';
        ELSE
        BEGIN
            DECLARE @ItemId UNIQUEIDENTIFIER;
            SELECT @ItemId = ItemStore.ItemNo FROM ItemStore WHERE ItemStore.ItemStoreID = @ItemStoreID;
            SET @Filter = @Filter + N' AND ItemID = ''' + CAST(@ItemId AS NVARCHAR(50)) + '''';
            SET @Filter = @Filter + N' AND StoreID IN (SELECT n FROM @Stores)';
        END
    END

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @Filter;

    DECLARE @Paged NVARCHAR(MAX) =
        N'SELECT *, COUNT(*) OVER() AS TotalRecords FROM (' + @Inner + N') AS PagedQ
          ORDER BY StartSaleTime DESC
          OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY';

    EXEC sp_executesql @query = @Paged, @params = N'@Stores Guid_list_tbltype READONLY', @Stores = @Stores;
END
GO

-- ================================================================================================
-- 31) Web_Sp_rptOpenPartialPO
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_Sp_rptOpenPartialPO]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_Sp_rptOpenPartialPO];
GO
CREATE PROCEDURE [dbo].[Web_Sp_rptOpenPartialPO]
(
    @Filter     NVARCHAR(4000),
    @PageNumber INT = 1,
    @PageSize   INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    DECLARE @MySelect NVARCHAR(MAX) =
        N'SELECT PONO, PurchaseOrderEntryView.*, PurchaseOrdersView.*
          FROM PurchaseOrderEntryView
          INNER JOIN PurchaseOrdersView ON PurchaseOrderEntryView.PurchaseOrderNo = PurchaseOrdersView.PurchaseOrderId
          WHERE (PurchaseOrderEntryView.QtyOrdered > PurchaseOrderEntryView.ReceivedQty)
            AND (PurchaseOrdersView.POStatus <> 0)
            AND (PurchaseOrderEntryView.ReceivedQty > 0) ';

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @Filter;

    DECLARE @Paged NVARCHAR(MAX) =
        N'SELECT *, COUNT(*) OVER() AS TotalRecords FROM (' + @Inner + N') AS PagedQ
          ORDER BY PONO
          OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY';

    EXEC (@Paged);
END
GO

-- ================================================================================================
-- 32) Web_Sp_rptRecicveValue
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_Sp_rptRecicveValue]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_Sp_rptRecicveValue];
GO
CREATE PROCEDURE [dbo].[Web_Sp_rptRecicveValue]
(
    @Filter     NVARCHAR(4000),
    @PageNumber INT = 1,
    @PageSize   INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    SET @Filter = REPLACE(@Filter, ' AND  AND ', ' AND ');

    DECLARE @MySelect NVARCHAR(MAX);
    DECLARE @MyGroup  NVARCHAR(MAX);

    IF (SELECT COUNT(1) FROM DepartmentStore WHERE ParentDepartmentID IN (SELECT DepartmentStoreID FROM DepartmentStore WHERE Status > 0) AND Status > 0) > 0
    BEGIN
        SET @MySelect = N'SELECT ItemMainAndStoreView.MainDepartment, ItemMainAndStoreView.SubDepartment,
                                 ItemMainAndStoreView.SubSubDepartment, ItemMainAndStoreView.Department,
                                 SUM(ReceiveEntry.Qty) AS Qty,
                                 SUM(ReceiveEntry.ExtPrice) AS Cost,
                                 SUM(ReceiveEntry.Qty * ItemsForSale.RealPrice) AS Price,
                                 ItemMainAndStoreView.StoreName
                          FROM ReceiveOrder
                          INNER JOIN ItemMainAndStoreView
                          INNER JOIN ReceiveEntry ON ItemMainAndStoreView.ItemStoreID = ReceiveEntry.ItemStoreNo
                              ON ReceiveOrder.ReceiveID = ReceiveEntry.ReceiveNo
                          INNER JOIN ItemsForSale ON ItemMainAndStoreView.ItemStoreID = ItemsForSale.ItemStoreID
                          WHERE ReceiveEntry.Status > 0 ';
        SET @MyGroup  = N' GROUP BY ItemMainAndStoreView.MainDepartment, ItemMainAndStoreView.SubDepartment,
                                    ItemMainAndStoreView.SubSubDepartment, ItemMainAndStoreView.Department,
                                    ItemMainAndStoreView.StoreName ';
    END
    ELSE
    BEGIN
        SET @MySelect = N'SELECT '''' AS MainDepartment, '''' AS SubDepartment, '''' AS SubSubDepartment,
                                 ItemMainAndStoreView.Department,
                                 SUM(ReceiveEntry.Qty) AS Qty,
                                 SUM(ReceiveEntry.ExtPrice) AS Cost,
                                 SUM(ReceiveEntry.Qty * ItemsForSale.RealPrice) AS Price,
                                 ItemMainAndStoreView.StoreName
                          FROM ReceiveOrder
                          INNER JOIN ItemMainAndStoreView
                          INNER JOIN ReceiveEntry ON ItemMainAndStoreView.ItemStoreID = ReceiveEntry.ItemStoreNo
                              ON ReceiveOrder.ReceiveID = ReceiveEntry.ReceiveNo
                          INNER JOIN ItemsForSale ON ItemMainAndStoreView.ItemStoreID = ItemsForSale.ItemStoreID
                          WHERE ReceiveEntry.Status > 0 ';
        SET @MyGroup  = N' GROUP BY ItemMainAndStoreView.Department, ItemMainAndStoreView.StoreName ';
    END

    DECLARE @Inner NVARCHAR(MAX) = @MySelect + @Filter + @MyGroup;

    DECLARE @Paged NVARCHAR(MAX) =
        N'SELECT *, COUNT(*) OVER() AS TotalRecords FROM (' + @Inner + N') AS PagedQ
          ORDER BY Department, StoreName
          OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY';

    EXEC (@Paged);
END
GO

-- ================================================================================================
-- 33) Web_Sp_PO_Receive_Report
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_Sp_PO_Receive_Report]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_Sp_PO_Receive_Report];
GO
CREATE PROCEDURE [dbo].[Web_Sp_PO_Receive_Report]
(
    @Filter     VARCHAR(MAX),
    @Filter2    VARCHAR(MAX) = '',
    @ItemFilter VARCHAR(MAX) = '',
    @PageNumber INT = 1,
    @PageSize   INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    DECLARE @ItemSelect VARCHAR(MAX) =
        'Select DISTINCT ItemStoreID Into #ItemSelect From ItemsRepFilter Where (1=1) ';

    DECLARE @MySelect VARCHAR(MAX) =
        'SELECT IMS.StoreName, IMS.ItemStoreID, IMS.BarcodeNumber, IMS.ModalNumber, IMS.Name,
                Manufacturers.ManufacturerName, DepartmentStore.Name AS Department,
                ISNULL(IMS.OnHand, 0) AS OnHand,
                ReceiveEntry.SupplierName AS Supplier, IMS.Cost, IMS.Price,
                CAST(SUM(ISNULL(ReceiveEntry.UOMQty, 0)) AS decimal(18,2)) AS QtyReceived,
                CAST(SUM(ISNULL(IMS.Cost, 0)) * SUM(ISNULL(ReceiveEntry.UOMQty, 0)) AS money)  AS ReceivedValue,
                CAST(SUM(ISNULL(IMS.Price, 0)) * SUM(ISNULL(ReceiveEntry.UOMQty, 0)) AS money) AS ReceivedSellingPrice,
                IMS.MainDepartment, IMS.SubDepartment, IMS.SubSubDepartment,
                IMS.CustomField1, IMS.CustomField2, IMS.CustomField3, IMS.CustomField4, IMS.CustomField5,
                IMS.CustomField6, IMS.CustomField7, IMS.CustomField8, IMS.CustomField9, IMS.CustomField10
         FROM ItemMainAndStoreView AS IMS
         LEFT  JOIN Manufacturers    ON Manufacturers.ManufacturerID = IMS.ManufacturerID
         LEFT  JOIN DepartmentStore  ON DepartmentStore.DepartmentStoreID = IMS.DepartmentID
         INNER JOIN
             (SELECT ReceiveEntry.ItemStoreNo, Supplier.Name AS SupplierName, SUM(ReceiveEntry.UOMQty) AS UOMQty
              FROM ReceiveEntry AS ReceiveEntry
              INNER JOIN ReceiveOrder ON ReceiveEntry.ReceiveNo = ReceiveOrder.ReceiveID
              INNER JOIN Supplier     ON Supplier.SupplierID = ReceiveOrder.SupplierNo
              INNER JOIN Bill         ON ReceiveOrder.BillID = Bill.BillID
              WHERE (ReceiveOrder.Status > 0) AND (ReceiveEntry.Status > 0) AND (1=1) ';

    DECLARE @MyGroup VARCHAR(MAX) =
        ' GROUP BY ReceiveEntry.ItemStoreNo, Supplier.Name) AS ReceiveEntry
            ON ReceiveEntry.ItemStoreNo = IMS.ItemStoreID AND IMS.MainStatus > 0 AND IMS.Status > 0
          WHERE 1=1 And exists (Select 1 From #ItemSelect where ItemStoreID = IMS.ItemStoreID) ';

    DECLARE @MyGroup2 VARCHAR(MAX) =
        ' GROUP BY IMS.StoreName, IMS.ItemStoreID, IMS.BarcodeNumber, IMS.ModalNumber, IMS.Name,
                   Manufacturers.ManufacturerName, DepartmentStore.Name, ISNULL(IMS.OnHand, 0),
                   ReceiveEntry.SupplierName, IMS.MainDepartment, IMS.SubDepartment, IMS.SubSubDepartment,
                   IMS.CustomField1, IMS.CustomField2, IMS.CustomField3, IMS.CustomField4, IMS.CustomField5,
                   IMS.CustomField6, IMS.CustomField7, IMS.CustomField8, IMS.CustomField9, IMS.CustomField10,
                   IMS.Cost, IMS.Price ';

    DECLARE @Inner NVARCHAR(MAX) = CAST(@MySelect AS NVARCHAR(MAX)) + CAST(@Filter AS NVARCHAR(MAX)) + CAST(@MyGroup AS NVARCHAR(MAX)) + CAST(@Filter2 AS NVARCHAR(MAX)) + CAST(@MyGroup2 AS NVARCHAR(MAX));

    DECLARE @Paged NVARCHAR(MAX) =
        N'; SELECT *, COUNT(*) OVER() AS TotalRecords FROM (' + @Inner + N') AS PagedQ
           ORDER BY Name
           OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    DECLARE @FullSql NVARCHAR(MAX) = CAST(@ItemSelect AS NVARCHAR(MAX)) + CAST(@ItemFilter AS NVARCHAR(MAX)) + @Paged + N' IF OBJECT_ID(N''tempdb.dbo.#ItemSelect'', N''U'') IS NOT NULL DROP TABLE #ItemSelect;';
    EXEC (@FullSql);
END
GO

-- ================================================================================================
-- 34) Web_SP_GetRegShifts  (Register Shifts report — desktop parity)
-- ------------------------------------------------------------------------------------------------
-- Source SP: SP_GetRegShifts (called from desktop FillRegShiftRep).
-- The desktop SP builds a single dynamic SELECT and EXECs it; this Web_ version wraps that exact
-- inner SELECT as a derived table, joins Store for StoreName, and applies pagination.
-- @Filter is the same string the desktop builds, e.g.
--   " and ShiftOpenDate > 'yyyy-MM-dd' and ShiftOpenDate < 'yyyy-MM-dd' and Registers.StoreID = 'guid' "
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetRegShifts]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetRegShifts];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetRegShifts]
(
    @Filter           NVARCHAR(4000),
    @IncludeReconcile BIT = 1,
    @PageNumber       INT = 1,
    @PageSize         INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

    -- Mirrors the inner SELECT from SP_GetRegShifts. We also LEFT JOIN Store so the web report can
    -- show StoreName without an extra round-trip. @IncludeReconcile is preserved for API parity but
    -- the desktop SP returns the same shape regardless of the flag (only the source query body is
    -- duplicated for the two branches in the original).
    DECLARE @InnerSql NVARCHAR(MAX) = N'
        SELECT DISTINCT
               RegShift.RegShiftID,
               RegShift.ShiftNO,
               RegShift.ShiftOpenDate,
               (CASE WHEN RegShift.Status = 1 THEN ''OPEN''
                     WHEN RegShift.Status = 3 THEN ''RECONCILE''
                     ELSE ''CLOSE'' END) AS Status,
               RegShift.ShiftCloseDate,
               Registers.RegisterNo,
               Registers.StoreID,
               Store.StoreName,
               UPPER(Users.UserName) AS CloseBy,
               ISNULL(Trans.TransCount, 0) AS TransCount,
               ISNULL(TotalExp.TotalExp, 0) - ISNULL(P.Payout, 0) AS TotalExp,
               ISNULL(TotalPick.TotalPick, 0) AS TotalPick,
               (ISNULL(TotalExp.TotalExp, 0) - ISNULL(P.Payout, 0)) - ISNULL(TotalPick.TotalPick, 0) AS Discrepancy
        FROM RegShift
        INNER JOIN Registers ON RegShift.RegID = Registers.RegisterID
        LEFT  JOIN Store     ON Registers.StoreID = Store.StoreID
        LEFT  JOIN
            (SELECT COUNT(*) AS TransCount, RegShiftID
             FROM [Transaction]
             GROUP BY RegShiftID) AS Trans ON RegShift.RegShiftID = Trans.RegShiftID
        LEFT  JOIN
            (SELECT SUM(TenderEntry.Amount) AS TotalExp, Transaction_1.RegShiftID
             FROM [Transaction] AS Transaction_1
             INNER JOIN TenderEntry ON Transaction_1.TransactionID = TenderEntry.TransactionID
             INNER JOIN Tender ON TenderEntry.TenderID = Tender.TenderID
             WHERE (Transaction_1.Status > 0) AND (TenderEntry.Status > 0)
               AND (Tender.TenderGroup <> 6) AND (Tender.TenderGroup <> 7) AND (Tender.TenderGroup <> 13)
             GROUP BY Transaction_1.RegShiftID) AS TotalExp ON RegShift.RegShiftID = TotalExp.RegShiftID
        LEFT  JOIN
            (SELECT PayOut.RegShiftID, SUM(ISNULL(PayOut.Amount, 0)) AS Payout
             FROM PayOut
             INNER JOIN TenderEntry ON PayOut.PayOutID = TenderEntry.TransactionID
             INNER JOIN Tender ON TenderEntry.TenderID = Tender.TenderID
             WHERE (PayOut.Status > 0)
             GROUP BY PayOut.RegShiftID) AS P ON RegShift.RegShiftID = P.RegShiftID
        LEFT  JOIN
            (SELECT SUM(PickUpAmount) AS TotalPick, BatchID AS RegShiftID
             FROM BatchRec
             GROUP BY BatchID) AS TotalPick ON RegShift.RegShiftID = TotalPick.RegShiftID
        LEFT  JOIN Users ON RegShift.CloseBy = Users.UserId
        WHERE (RegShift.Status > 0)';

    -- If reconcile rows should be excluded, drop Status=3 rows. Desktop currently runs the same
    -- query in both branches; this keeps behavior identical when @IncludeReconcile=1 (default).
    IF @IncludeReconcile = 0
        SET @InnerSql = @InnerSql + N' AND RegShift.Status <> 3';

    DECLARE @Paged NVARCHAR(MAX) =
        N'; SELECT *, COUNT(*) OVER() AS TotalRecords
           FROM (' + @InnerSql + N' ' + @Filter + N') AS PagedQ
           ORDER BY ShiftOpenDate ASC
           OFFSET ' + CAST(@Offset AS NVARCHAR(20)) + N' ROWS FETCH NEXT ' + CAST(@PageSize AS NVARCHAR(20)) + N' ROWS ONLY;';

    EXEC (@Paged);
END
GO

-- ================================================================================================
-- End of Web_* report stored procedures (34 total)
-- ================================================================================================
