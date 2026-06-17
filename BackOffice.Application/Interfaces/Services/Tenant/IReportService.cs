using BackOffice.Application.DTOs.Tenant.Reports;
using BackOffice.Common;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    /// <summary>
    /// Service interface for report generation
    /// </summary>
    public interface IReportService
    {
        /// <summary>
        /// Gets Tax Collected report data with pagination and filters
        /// Based on VB.NET RepTaxCollected - ItemQ.GetTaxCollected(FilterInstances)
        /// </summary>
        /// <param name="request">Request with pagination and date filters</param>
        /// <returns>Tax collected report data with summary totals</returns>
        ApiResponse<TaxCollectedResponseDto> GetTaxCollectedReport(TaxCollectedRequestDto request);

        /// <summary>
        /// Gets Returned Items report data with pagination and filters
        /// </summary>
        ApiResponse<ReturnedItemsResponseDto> GetReturnedItemsReport(ReturnedItemsRequestDto request);
        /// Gets Tax By Store report - tax and sales aggregated per store
        /// Based on SP_GetTaxReprtByStore
        /// </summary>
        /// <param name="request">FromDate, ToDate, optional StoreId</param>
        /// <returns>One row per store with TaxRate, TotalSales, Tax, etc.</returns>
        Task<ApiResponse<TaxByStoreResponseDto>> GetTaxByStoreReportAsync(TaxByStoreRequestDto request);

        /// <summary>
        /// Gets Items (inventory) report with pagination and filters (store, department, search).
        /// </summary>
        ApiResponse<ItemsReportResponseDto> GetItemsReport(ItemsReportRequestDto request);

        /// <summary>
        /// Gets Department Inventory report: one row per department with aggregated item count and values.
        /// </summary>
        ApiResponse<DepartmentInventoryResponseDto> GetDepartmentInventoryReport(DepartmentInventoryRequestDto request);

        /// <summary>
        /// Gets Item Inventory Summary report: one row per item with aggregated totals across stores (excludes null/empty department).
        /// </summary>
        ApiResponse<ItemInventorySummaryResponseDto> GetItemInventorySummaryReport(ItemInventorySummaryRequestDto request);

        /// <summary>
        /// Gets Departments Valuation report (same as desktop): SP_GetDepartments, columns Main/Sub/SubSub Department, Name, On Hand, On Order, On Sale Order, Cost, AVG Cost, Price, Store Name.
        /// </summary>
        Task<ApiResponse<DepartmentsValuationResponseDto>> GetDepartmentsValuationReportAsync(DepartmentsValuationRequestDto request);

        /// <summary>
        /// Gets Price Change History report: SP_GetPriceChange with date and optional item filter.
        /// </summary>
        Task<ApiResponse<PriceChangeHistoryResponseDto>> GetPriceChangeHistoryReportAsync(PriceChangeHistoryRequestDto request);

        /// <summary>
        /// Gets Receive Inventory Value report: Sp_rptRecicveValue with store, date range, supplier, department, brand.
        /// </summary>
        Task<ApiResponse<ReceiveInventoryValueResponseDto>> GetReceiveInventoryValueReportAsync(ReceiveInventoryValueRequestDto request);
        /// Gets Items in Partial Receive report: Sp_rptOpenPartialPO with store, date range, supplier, department, brand.
        /// </summary>
        Task<ApiResponse<ItemsInPartialReceiveResponseDto>> GetItemsInPartialReceiveReportAsync(ItemsInPartialReceiveRequestDto request);
        /// Gets Items on Receive Order report: Sp_PO_Receive_Report with store, date range, supplier, optional department.
        /// </summary>
        Task<ApiResponse<ItemsOnReceiveOrderResponseDto>> GetItemsOnReceiveOrderReportAsync(ItemsOnReceiveOrderRequestDto request);

        /// <summary>
        /// Gets Tender Totals report (desktop Tender Totals): totals by tender type/credit type for a date range and optional store.
        /// </summary>
        Task<ApiResponse<TenderTotalsResponseDto>> GetTenderTotalsReportAsync(TenderTotalsRequestDto request);

        /// <summary>
        /// Gets Tender Totals By Station report: totals by tender type/credit type per register (station) for a date range and optional store.
        /// </summary>
        Task<ApiResponse<TenderTotalsResponseDto>> GetTenderTotalsByStationReportAsync(TenderTotalsRequestDto request);

        /// <summary>
        /// Drill-down for Tender Totals: returns the transaction-level rows behind a
        /// single Register+Cashier cell from the parent pivot. Calls SP_GetTendersCashier
        /// with the same store/date filters and filters the result by Cashier
        /// (and Register when supplied). Desktop equivalent: double-click a cell in
        /// RepTenders to open RepTendersCashier.
        /// </summary>
        Task<ApiResponse<TenderTotalsDetailsResponseDto>> GetTenderTotalsDetailsAsync(TenderTotalsDetailsRequestDto request);

        /// <summary>
        /// Gets On Account Sales report: one row per on-account transaction between dates, optional store and customer.
        /// </summary>
        Task<ApiResponse<OnAccountSalesResponseDto>> GetOnAccountSalesReportAsync(OnAccountSalesRequestDto request);

        /// <summary>
        /// Drill-down for On Account Sales / Payments: returns transaction-level rows for a single
        /// customer in the same date/store window. Desktop equivalent: RepAcountReceivableSales ->
        /// ClickOnRow -> FrmLiveReport ("Account Receivable Sales For NAME").
        /// </summary>
        Task<ApiResponse<OnAccountSalesDetailsResponseDto>> GetOnAccountSalesDetailsAsync(OnAccountSalesDetailsRequestDto request);

        /// <summary>
        /// Gets Action Summary report: aggregated POS actions by date, cashier, and action within a date range and optional store.
        /// </summary>
        Task<ApiResponse<ActionSummaryResponseDto>> GetActionSummaryReportAsync(ActionSummaryRequestDto request);

        /// <summary>
        /// Gets Action Details report: detailed POS actions (SP_GetActionDetailsByDate) within a date range and optional store.
        /// </summary>
        Task<ApiResponse<ActionDetailsResponseDto>> GetActionDetailsReportAsync(ActionDetailsRequestDto request);

        /// <summary>
        /// Gets Summary report: store/day totals (Get_SummaryReport SP) within a date range and optional store.
        /// Do not change — used by other APIs. For transaction-level report use GetSalesSummaryByTransactionReportAsync.
        /// </summary>
        Task<ApiResponse<SummaryReportResponseDto>> GetSummaryReportAsync(SummaryReportRequestDto request);

        /// <summary>
        /// Gets Sales Summary By Transaction report (desktop clone): same SP as Summary, dedicated endpoint and DTOs.
        /// </summary>
        Task<ApiResponse<SalesSummaryByTransactionResponseDto>> GetSalesSummaryByTransactionReportAsync(SalesSummaryByTransactionRequestDto request);

        /// <summary>
        /// Drill-down for Sales Summary By Transaction — returns per-line profit details for
        /// a single transaction. Mirrors the desktop's RepSalesProfit -&gt; RepEntryProfit flow.
        /// </summary>
        Task<ApiResponse<SalesSummaryByTransactionDetailsResponseDto>> GetSalesSummaryByTransactionDetailsAsync(SalesSummaryByTransactionDetailsRequestDto request);

        /// <summary>
        /// Gets Sales Summary By Item report (desktop clone): SP_GetItemSummary with date range and store filter only.
        /// </summary>
        Task<ApiResponse<SalesSummaryByItemResponseDto>> GetSalesSummaryByItemReportAsync(SalesSummaryByItemRequestDto request);

        /// <summary>
        /// Drill-down for Sales Summary By Item — returns per-transaction sales lines for one item.
        /// Mirrors the desktop's RepItemSalesSummary -&gt; RepSalesDetails flow.
        /// </summary>
        Task<ApiResponse<SalesSummaryByItemDetailsResponseDto>> GetSalesSummaryByItemDetailsAsync(SalesSummaryByItemDetailsRequestDto request);

        /// <summary>
        /// Gets Sales Summary By Department report: SP_GetDepartmentSummary with date range and store filter only.
        /// </summary>
        Task<ApiResponse<SalesSummaryByDepartmentResponseDto>> GetSalesSummaryByDepartmentReportAsync(SalesSummaryByDepartmentRequestDto request);

        /// <summary>
        /// Gets Sales Summary By Discount report: SP_GetDiscountSummary with date range and store filter only.
        /// </summary>
        Task<ApiResponse<SalesSummaryByDiscountResponseDto>> GetSalesSummaryByDiscountReportAsync(SalesSummaryByDiscountRequestDto request);

        /// <summary>
        /// Drill-down for Sales Summary By Discount — returns per-transaction details for one
        /// discount via SP_GetTransactionDiscount. Mirrors desktop RepDiscountSummary -&gt; RepDiscountDetails.
        /// </summary>
        Task<ApiResponse<SalesSummaryByDiscountDetailsResponseDto>> GetSalesSummaryByDiscountDetailsAsync(SalesSummaryByDiscountDetailsRequestDto request);

        /// <summary>
        /// Gets Sales Summary By Specials report: Rpt_ItemsInSpecials with date range and store filter.
        /// </summary>
        Task<ApiResponse<SalesSummaryBySpecialsResponseDto>> GetSalesSummaryBySpecialsReportAsync(SalesSummaryBySpecialsRequestDto request);

        /// <summary>
        /// Gets Date Comparison report: compares customer sales between two date ranges for an optional store.
        /// </summary>
        Task<ApiResponse<DateComparisonResponseDto>> GetDateComparisonReportAsync(DateComparisonRequestDto request);

        /// <summary>
        /// Gets Daily Hour Sales report: sales metrics aggregated by store and hour within a date range and optional store.
        /// </summary>
        Task<ApiResponse<DailyHourSalesResponseDto>> GetDailyHourSalesReportAsync(DailyHourSalesRequestDto request);

        /// <summary>
        /// Drill-down for Daily Hour Sales: returns transactions in [hourStart, hourStart + 1h)
        /// for the supplied store, mirroring the desktop's row double-click.
        /// </summary>
        Task<ApiResponse<DailyHourSalesDetailsResponseDto>> GetDailyHourSalesDetailsAsync(DailyHourSalesDetailsRequestDto request);

        /// <summary>
        /// Gets Item Daily Sales report: aggregated sales per item and day within a date range.
        /// </summary>
        Task<ApiResponse<ItemDailySalesResponseDto>> GetItemDailySalesReportAsync(ItemDailySalesRequestDto request);

        /// <summary>
        /// Pivoted Item Daily Sales view. Mirrors desktop RepItemsDailySales (rows: Department >
        /// Item > Barcode, columns: per-date Amount+Qty). Calls the same underlying SP but
        /// returns the data already pivoted so the frontend can render a sticky-left grid with
        /// scrolling date columns instead of re-pivoting on the client.
        /// </summary>
        Task<ApiResponse<ItemDailySalesPivotResponseDto>> GetItemDailySalesPivotAsync(ItemDailySalesPivotRequestDto request);

        /// <summary>
        /// Gets Item Weekly Sales report: aggregated sales per item and week within a date range.
        /// </summary>
        Task<ApiResponse<ItemWeeklySalesResponseDto>> GetItemWeeklySalesReportAsync(ItemWeeklySalesRequestDto request);

        /// <summary>
        /// Pivoted Item Weekly Sales view — mirrors desktop RepItemsWeeklySales (rows:
        /// Department > Item > Barcode, columns: per-week Amount + Qty keyed by week-start date).
        /// </summary>
        Task<ApiResponse<ItemWeeklySalesPivotResponseDto>> GetItemWeeklySalesPivotAsync(ItemWeeklySalesPivotRequestDto request);

        /// <summary>
        /// Gets Item Monthly Sales report: aggregated sales per item and month within a date range.
        /// </summary>
        Task<ApiResponse<ItemMonthlySalesResponseDto>> GetItemMonthlySalesReportAsync(ItemMonthlySalesRequestDto request);

        /// <summary>
        /// Pivoted Item Monthly Sales view — mirrors desktop RepItemsMonthlySales (rows:
        /// Department > Item > Barcode, columns: Year > Month, cells: Amount + Qty).
        /// </summary>
        Task<ApiResponse<ItemMonthlySalesPivotResponseDto>> GetItemMonthlySalesPivotAsync(ItemMonthlySalesPivotRequestDto request);

        /// <summary>
        /// Pivot drill-down: returns every TransactionEntryItem row for a given (item × date
        /// window). Mirrors desktop RepMothlySalesDetails / RepWeeklySalesDetails — opened
        /// when the user double-clicks a cell in the monthly / weekly / daily pivots.
        /// </summary>
        Task<ApiResponse<ItemSalesTransactionsResponseDto>> GetItemSalesTransactionsAsync(ItemSalesTransactionsRequestDto request);

        /// <summary>
        /// Returns the printable receipt text for a single Transaction. Used by the
        /// "Open Receipt" modal on every detail report row that has a Transaction No.
        /// Calls [dbo].[SP_GetReciept] (note the desktop's historical typo).
        /// </summary>
        Task<ApiResponse<TransactionReceiptResponseDto>> GetTransactionReceiptAsync(TransactionReceiptRequestDto request);

        /// <summary>
        /// Gets Department Daily Sales report: aggregated sales per department and day within a date range.
        /// </summary>
        Task<ApiResponse<DepartmentDailySalesResponseDto>> GetDepartmentDailySalesReportAsync(DepartmentDailySalesRequestDto request);

        /// <summary>
        /// Pivoted Department Daily Sales — mirrors desktop RepDepartmentDailySales (sticky
        /// Date+Store on the left, scrolling Department columns on the right with Amount + Qty
        /// under each).
        /// </summary>
        Task<ApiResponse<DepartmentDailySalesPivotResponseDto>> GetDepartmentDailySalesPivotAsync(DepartmentDailySalesPivotRequestDto request);

        /// <summary>
        /// Pivoted Department Weekly Sales — mirrors desktop RepDepartmentWeeklySales (rows:
        /// Department + Store, columns: per-week Amount + Qty keyed by week-start date).
        /// </summary>
        Task<ApiResponse<DepartmentWeeklySalesPivotResponseDto>> GetDepartmentWeeklySalesPivotAsync(DepartmentWeeklySalesPivotRequestDto request);

        /// <summary>
        /// Pivoted Department Monthly Sales — mirrors desktop RepDepartmentMonthlySales (rows:
        /// Year + Month, columns: Department + Store with Amount + Qty under each store).
        /// </summary>
        Task<ApiResponse<DepartmentMonthlySalesPivotResponseDto>> GetDepartmentMonthlySalesPivotAsync(DepartmentMonthlySalesPivotRequestDto request);

        /// <summary>
        /// Gets Department Weekly Sales report: aggregated sales per department and week within a date range.
        /// </summary>
        Task<ApiResponse<DepartmentWeeklySalesResponseDto>> GetDepartmentWeeklySalesReportAsync(DepartmentWeeklySalesRequestDto request);

        /// <summary>
        /// Gets Department Monthly Sales report: aggregated sales per department and month within a date range.
        /// </summary>
        Task<ApiResponse<DepartmentMonthlySalesResponseDto>> GetDepartmentMonthlySalesReportAsync(DepartmentMonthlySalesRequestDto request);

        /// <summary>
        /// Gets Total Daily Sales report: total sales per day within a date range.
        /// </summary>
        Task<ApiResponse<TotalDailySalesResponseDto>> GetTotalDailySalesReportAsync(TotalDailySalesRequestDto request);

        /// <summary>
        /// Gets Total Weekly Sales report: total sales per week within a date range.
        /// </summary>
        Task<ApiResponse<TotalWeeklySalesResponseDto>> GetTotalWeeklySalesReportAsync(TotalWeeklySalesRequestDto request);

        /// <summary>
        /// Gets Total Monthly Sales report: total sales per month within a date range.
        /// </summary>
        Task<ApiResponse<TotalMonthlySalesResponseDto>> GetTotalMonthlySalesReportAsync(TotalMonthlySalesRequestDto request);

        /// <summary>
        /// Gets On Account Payments report: payments made on customer accounts, aggregated per customer for the date range and optional store/customer.
        /// </summary>
        Task<ApiResponse<OnAccountPaymentsResponseDto>> GetOnAccountPaymentsReportAsync(OnAccountPaymentsRequestDto request);

        /// <summary>
        /// Gets Register Shifts report (desktop Register Shifts): one row per register shift with expected/pick/discrepancy.
        /// </summary>
        Task<ApiResponse<RegisterShiftReportResponseDto>> GetRegisterShiftReportAsync(RegisterShiftReportRequestDto request);

        /// <summary>
        /// Reconcile Batch — Init: calls SP_AddBatchToRec to seed BatchRec rows for the shift,
        /// then returns the tender breakdown for editing (desktop BatchReconciles.Start + LoadGrid).
        /// </summary>
        Task<ApiResponse<ReconcileBatchInitResponseDto>> InitReconcileBatchAsync(ReconcileBatchInitRequestDto request);

        /// <summary>
        /// Reconcile Batch — Save: persists PickUpAmount/PickUpCount/Note per BatchRec row and
        /// marks the shift as RECONCILE (RegShift.Status = 3). Mirrors BatchReconciles.BtnSave_Click.
        /// </summary>
        Task<ApiResponse<ReconcileBatchSaveResponseDto>> SaveReconcileBatchAsync(ReconcileBatchSaveRequestDto request);

        /// <summary>
        /// Total Tenders for a single shift (desktop RepTendersShift). One row per tender with
        /// total amount and transaction count for the shift.
        /// </summary>
        Task<ApiResponse<TotalTendersForShiftResponseDto>> GetTotalTendersForShiftAsync(TotalTendersForShiftRequestDto request);

        /// <summary>
        /// Gets Sales History for a specific item: SP_GetSalesHistory with date range and itemStoreID filter.
        /// </summary>
        Task<ApiResponse<ItemSalesHistoryResponseDto>> GetItemSalesHistoryAsync(ItemSalesHistoryRequestDto request);

        /// <summary>
        /// Gets date scope presets from the DateScope table.
        /// </summary>
        Task<ApiResponse<List<DateScopeDto>>> GetDateScopesAsync();
    }
}
