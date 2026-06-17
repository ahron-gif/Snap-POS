-- Required so the procedure is created with the SET options the indexed view CustomerView needs.
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
-- ================================================================================================
-- Web_Rpt_AcountReceivableTotals — On Account Sales/Payments totals aggregated by TRANSACTION store
-- ------------------------------------------------------------------------------------------------
-- Fixes: the parent On Account Payments / On Account Sales grids previously took each row's store
-- from the customer's HOME store (CustomerView.StoreCreated / StoreOpen) via the desktop SP
-- [dbo].[Rpt_AcountReceivableTotals]. The desktop SP's AMOUNTS are already store-scoped (its
-- correlated subqueries filter [transaction].StoreID by @StoreID), but each row is LABELLED with
-- the customer's home store — so a Store filter still showed rows grouped under other stores
-- (e.g. filter = RDT HEADQUARTERS still showed a DYLAN STORES group for a home-DYLAN customer).
--
-- This SP reproduces the desktop SP's EXACT amount math but aggregates per customer PER TRANSACTION
-- STORE ([Transaction].StoreID) and returns that store's id/name, so a Store filter scopes to that
-- store only. Same parameters the web read method already binds (@FromDate, @ToDate, @StoreID).
--
-- Desktop parity (from [dbo].[Rpt_AcountReceivableTotals]):
--   AmountSales    = SUM(Debit  - Credit) WHERE Debit  > Credit AND Debit >= 0
--   AmountPayments = SUM(Credit - Debit)  WHERE Credit > Debit
--   over [Transaction] WHERE TransactionType NOT IN (2,4) AND Status > 0
--   AND EndSaleTime BETWEEN @FromDate AND @ToDate, scoped by transaction StoreID.
-- Consumed by ReportService.ReadAccountReceivableTotalsAsync (On Account Payments + On Account Sales).
-- ================================================================================================
IF OBJECT_ID('[dbo].[Web_Rpt_AcountReceivableTotals]', 'P') IS NOT NULL
    DROP PROCEDURE [dbo].[Web_Rpt_AcountReceivableTotals];
GO
CREATE PROCEDURE [dbo].[Web_Rpt_AcountReceivableTotals]
(
    @FromDate DATETIME,
    @ToDate   DATETIME,
    @StoreID  UNIQUEIDENTIFIER = NULL
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        t.StoreID                              AS StoreID,        -- transaction store (the fix)
        s.StoreName                            AS StoreName,
        cv.CustomerID                          AS CustomerID,
        cv.CustomerNo                          AS CustomerNo,
        cv.LastName                            AS LastName,
        cv.FirstName                           AS FirstName,
        cv.Address                             AS Address,
        cv.Phone                               AS Phone,
        cv.BalanceDoe                          AS BalanceDoe,
        SUM(CASE WHEN t.Debit > t.Credit AND t.Debit >= 0
                 THEN ISNULL(t.Debit, 0)  - ISNULL(t.Credit, 0) ELSE 0 END)  AS AmountSales,
        SUM(CASE WHEN t.Credit > t.Debit
                 THEN ISNULL(t.Credit, 0) - ISNULL(t.Debit, 0)  ELSE 0 END)  AS AmountPayments
    FROM [Transaction] t
    INNER JOIN Store        s  ON s.StoreID    = t.StoreID
    INNER JOIN CustomerView cv ON cv.CustomerID = t.CustomerID
    WHERE t.TransactionType <> 2
      AND t.TransactionType <> 4
      AND t.Status > 0
      AND cv.Status > 0
      AND t.EndSaleTime >= @FromDate
      AND t.EndSaleTime <= @ToDate
      AND (@StoreID IS NULL OR t.StoreID = @StoreID)
    GROUP BY
        t.StoreID, s.StoreName,
        cv.CustomerID, cv.CustomerNo, cv.LastName, cv.FirstName,
        cv.Address, cv.Phone, cv.BalanceDoe;
END
GO
