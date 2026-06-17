-- ================================================================================================
-- 20260602_WebReports_TaxByStore_Summary_CustomerFilter
-- ------------------------------------------------------------------------------------------------
-- Adds the universal "Filters" dialog (Customer tab) customer-filtering to two POS reports that
-- previously had no customer-filter hook:
--   * Web_SP_GetTaxReprtByStore  (Tax By Store)
--   * Web_Get_SummaryReport      (Summary report)
--
-- Mechanism mirrors Web_SP_GetTaxCollected: a new @CustomerFilter NVARCHAR param carries
-- ` AND <col> IN (...)` conditions against CustomerRepFilter (built server-side from the multi-
-- select Customer tab). The SP materializes the matching CustomerID set into #CustomerSelect, then
-- constrains every customer/transaction-grounded query by Transaction/Entry CustomerID. When
-- @CustomerFilter is '' the report behaves exactly as before (no scoping).
--
-- NOTE (Summary): Payout (PayOutView) has no customer dimension, so it is intentionally NOT scoped
-- by the customer filter. Over/Short is a literal placeholder row. Everything else (sales, tax,
-- gift, tag-along, shipping, tenders, AR, AR payments, profit/cost, no. of sales) is scoped.
--
-- @CustomerFilter is appended into dynamic SQL — callers MUST build it from typed values
-- (Guids/ints formatted directly; strings single-quote-escaped) as ReportService does. Do not
-- pass raw user input.
--
-- !!! Apply to each tenant database. Verify against a real DB before release: run each report with
-- !!! and without customer selections and confirm totals scope correctly.
-- ================================================================================================

-- ================================================================================================
-- 1) Web_SP_GetTaxReprtByStore  (+ @CustomerFilter)
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_SP_GetTaxReprtByStore]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_SP_GetTaxReprtByStore];
GO
CREATE PROCEDURE [dbo].[Web_SP_GetTaxReprtByStore]
(
    @StartDate      DATETIME,
    @EndDate        DATETIME,
    @StoreID        UNIQUEIDENTIFIER = NULL,
    @CustomerFilter NVARCHAR(4000)   = '',
    @PageNumber     INT = 1,
    @PageSize       INT = 50
)
AS
BEGIN
    SET NOCOUNT ON;
    IF @PageNumber IS NULL OR @PageNumber < 1 SET @PageNumber = 1;
    IF @PageSize   IS NULL OR @PageSize   < 1 SET @PageSize   = 50;
    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;
    DECLARE @EndDatePlusOne DATETIME = DATEADD(DAY, 1, @EndDate);

    -- Customer-tab filter: build the matching CustomerID set once; @HasCust=0 => no scoping.
    DECLARE @HasCust BIT = CASE WHEN ISNULL(@CustomerFilter, '') <> '' THEN 1 ELSE 0 END;
    CREATE TABLE #CustomerSelect (CustomerID UNIQUEIDENTIFIER);
    IF @HasCust = 1
        INSERT INTO #CustomerSelect (CustomerID)
        EXEC ('SELECT CustomerID FROM CustomerRepFilter WHERE (1=1) ' + @CustomerFilter);

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
          AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = T.CustomerID))
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
          AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = T.CustomerID))
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
          AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = Sales.CustomerID))
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

    DROP TABLE #CustomerSelect;
END
GO

-- ================================================================================================
-- 2) Web_Get_SummaryReport  (+ @CustomerFilter)
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
    @CustomerFilter             NVARCHAR(4000) = '',
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

    -- Customer-tab filter: matching CustomerID set; @HasCust=0 => no scoping.
    DECLARE @HasCust BIT = CASE WHEN ISNULL(@CustomerFilter, '') <> '' THEN 1 ELSE 0 END;
    CREATE TABLE #CustomerSelect (CustomerID UNIQUEIDENTIFIER);
    IF @HasCust = 1
        INSERT INTO #CustomerSelect (CustomerID)
        EXEC ('SELECT CustomerID FROM CustomerRepFilter WHERE (1=1) ' + @CustomerFilter);

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
      AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = T.CustomerID))
    GROUP BY R.TenderName, R.SortOrder, S.SystemValueName
    ORDER BY R.TenderName;

    SET @Sale = (SELECT ISNULL(SUM(TotalAfterDiscount), 0) FROM TransactionEntryItem
                 WHERE EndSaleTime >= @From AND EndSaleTime < @To
                   AND (ISNULL(ModalNumber, '') <> 'SHIPPING' AND ISNULL(BarcodeNumber, '') <> 'TAX')
                   AND (StoreID = @Store OR @Store IS NULL)
                   AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = TransactionEntryItem.CustomerID)));

    SET @Tax = (SELECT SUM(ROUND(ISNULL(Tax, 0), 2)) FROM [Transaction] T
                WHERE TransactionType <> 4 AND Status > 0
                  AND EndSaleTime >= @From AND EndSaleTime < @To
                  AND (StoreID = @Store OR @Store IS NULL)
                  AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = T.CustomerID)))
             + (SELECT ISNULL(SUM(TotalAfterDiscount), 0) FROM TransactionEntryItem
                WHERE EndSaleTime >= @From AND EndSaleTime < @To
                  AND BarcodeNumber = 'TAX'
                  AND (StoreID = @Store OR @Store IS NULL)
                  AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = TransactionEntryItem.CustomerID)));

    SET @Gift = (SELECT ISNULL(SUM(ISNULL(Total, 0)), 0)
                 FROM dbo.TransactionEntry AS E WITH (NOLOCK)
                 INNER JOIN dbo.[Transaction] AS T WITH (NOLOCK) ON E.TransactionID = T.TransactionID
                 INNER JOIN dbo.Store S ON T.StoreID = S.StoreID
                 WHERE E.Status > 0 AND T.Status > 0 AND TransactionEntryType = 5 AND TransactionType <> 4
                   AND EndSaleTime >= @From AND EndSaleTime < @To
                   AND (T.StoreID = @Store OR @Store IS NULL)
                   AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = T.CustomerID)));

    SET @TagAlong = (SELECT ISNULL(SUM(ISNULL(TotalAfterDiscount, 0)), 0) FROM TransactionEntryItem
                     WHERE ItemType = 5 AND EndSaleTime >= @From AND EndSaleTime < @To
                       AND (StoreID = @Store OR @Store IS NULL)
                       AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = TransactionEntryItem.CustomerID)));

    SET @Tender = (SELECT ISNULL(SUM(Amount), 0) FROM TenderEntry E
                   INNER JOIN [Transaction] T ON E.TransactionID = T.TransactionID
                   INNER JOIN Tender R        ON E.TenderID = R.TenderID
                   WHERE E.Status > 0 AND T.Status > 0 AND R.TenderType <> 1 AND T.TransactionType <> 4
                     AND EndSaleTime >= @From AND EndSaleTime < @To
                     AND (StoreID = @Store OR @Store IS NULL)
                     AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = T.CustomerID)));

    -- Payout (PayOutView) has no customer dimension — intentionally NOT customer-scoped.
    SET @Payout = (SELECT ISNULL(SUM(P.Amount), 0) FROM PayOutView P
                   WHERE P.Status > 0 AND P.PayOutDate >= @From AND P.PayOutDate < @To
                     AND (StoreID = @Store OR @Store IS NULL));

    SET @AR = (SELECT (CASE WHEN ISNULL(SUM(ISNULL(T.Debit, 0)) - SUM(ISNULL(T.Credit, 0)), 0) > 0
                            THEN ISNULL(SUM(ISNULL(T.Debit, 0)) - SUM(ISNULL(T.Credit, 0)), 0) ELSE 0 END)
               FROM [Transaction] T
               WHERE Status > 0 AND TransactionType <> 4 AND TransactionType <> 2
                 AND ISNULL(Debit, 0) - ISNULL(Credit, 0) > 0
                 AND EndSaleTime >= @From AND EndSaleTime < @To
                 AND (StoreID = @Store OR @Store IS NULL)
                 AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = T.CustomerID)));

    SET @Payments = (SELECT SUM(ISNULL(Credit, 0) - ISNULL(Debit, 0)) FROM [Transaction] T
                     WHERE Status > 0 AND TransactionType <> 4 AND TransactionType <> 2
                       AND ISNULL(Credit, 0) - ISNULL(Debit, 0) > 0
                       AND EndSaleTime >= @From AND EndSaleTime < @To
                       AND (StoreID = @Store OR @Store IS NULL)
                       AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = T.CustomerID)));

    SET @Shipping = (SELECT ISNULL(SUM(TotalAfterDiscount), 0) FROM TransactionEntryItem
                     WHERE (ItemType = 3 OR ModalNumber = 'SHIPPING')
                       AND EndSaleTime >= @From AND EndSaleTime < @To
                       AND (StoreID = @Store OR @Store IS NULL)
                       AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = TransactionEntryItem.CustomerID)));

    ;WITH FinalQ AS
    (
        SELECT D.Description, D.Total, D.Sort
        FROM (
            SELECT 'No. of Sales' AS Description,
                   FORMAT(ISNULL(COUNT(DISTINCT TransactionID), 0), N'N0') AS Total, 0 AS Sort
            FROM [Transaction] T
            WHERE EndSaleTime >= @From AND EndSaleTime < @To
              AND (StoreID = @Store OR @Store IS NULL) AND T.Status > 0
              AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = T.CustomerID))
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
                       AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = T.CustomerID))
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
                       AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = T.CustomerID))
            UNION ALL SELECT 'Check', FORMAT(ISNULL(SUM(Amount), 0), N'c'), 12.5
                     FROM TenderEntry E
                     INNER JOIN [Transaction] T ON E.TransactionID = T.TransactionID
                     INNER JOIN Tender R        ON E.TenderID = R.TenderID
                     WHERE LOWER(R.TenderName) = 'check' AND E.Status > 0 AND T.Status > 0
                       AND @DisplayChecksIndividually = 0
                       AND EndSaleTime >= @From AND EndSaleTime < @To
                       AND (StoreID = @Store OR @Store IS NULL)
                       AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = T.CustomerID))
            UNION ALL SELECT 'Total Tender', FORMAT(ISNULL(SUM(Amount), 0), N'c'), 13
                     FROM TenderEntry E
                     INNER JOIN [Transaction] T ON E.TransactionID = T.TransactionID
                     INNER JOIN Tender R        ON E.TenderID = R.TenderID
                     WHERE E.Status > 0 AND T.Status > 0 AND R.TenderGroup <> 6 AND R.TenderGroup <> 7
                       AND EndSaleTime >= @From AND EndSaleTime < @To
                       AND (StoreID = @Store OR @Store IS NULL)
                       AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = T.CustomerID))
            UNION ALL SELECT '', '', 14
            UNION ALL SELECT 'Over/Short', '', 15
            UNION ALL SELECT '', '', 16
            UNION ALL SELECT 'Sales', FORMAT(ISNULL(SUM(TotalAfterDiscount), 0), N'c'), 17
                     FROM TransactionEntryProfit
                     WHERE EndSaleTime >= @From AND EndSaleTime < @To
                       AND (StoreID = @Store OR @Store IS NULL)
                       AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = TransactionEntryProfit.CustomerID))
            UNION ALL SELECT 'Cost',  FORMAT(ISNULL(SUM(ISNULL(ExtCost, 0)), 0), N'c'), 18
                     FROM TransactionEntryProfit
                     WHERE EndSaleTime >= @From AND EndSaleTime < @To
                       AND (StoreID = @Store OR @Store IS NULL)
                       AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = TransactionEntryProfit.CustomerID))
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
                       AND (@HasCust = 0 OR EXISTS (SELECT 1 FROM #CustomerSelect cs WHERE cs.CustomerID = TransactionEntryProfit.CustomerID))
        ) AS D
    )
    SELECT Description, Total, Sort, COUNT(*) OVER() AS TotalRecords
    FROM FinalQ
    ORDER BY Sort;

    DROP TABLE #Tender;
    DROP TABLE #CustomerSelect;
END
GO
