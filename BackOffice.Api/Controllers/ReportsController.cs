using System;
using BackOffice.Application.DTOs.Tenant.Reports;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;


namespace BackOffice.Api.Controllers
{
    /// <summary>
    /// Controller for report generation endpoints
    /// Based on VB.NET report forms (RepTaxCollected, etc.)
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ReportsController : ControllerBase
    {
        private readonly IReportService _reportService;

        public ReportsController(IReportService reportService)
        {
            _reportService = reportService;
        }

        /// <summary>
        /// Gets Tax Collected report data with pagination and filters
        /// Based on VB.NET RepTaxCollected form
        /// </summary>
        /// <param name="request">Request with pagination, date filters, and store filter</param>
        /// <returns>Tax collected report data with summary totals</returns>
        [HttpPost("TaxCollected")]
        public IActionResult GetTaxCollectedReport([FromBody] TaxCollectedRequestDto request)
        {
            var result = _reportService.GetTaxCollectedReport(request);

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Returned Items report data with pagination and filters
        /// </summary>
        [HttpPost("ReturnedItems")]
        public IActionResult GetReturnedItemsReport([FromBody] ReturnedItemsRequestDto request)
        {
            var result = _reportService.GetReturnedItemsReport(request);
            
            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        
        /// Gets Tax By Store report - tax and sales aggregated per store (SP_GetTaxReprtByStore)
        /// </summary>
        /// <param name="request">FromDate, ToDate, optional StoreId</param>
        [HttpPost("TaxByStore")]
        public async Task<IActionResult> GetTaxByStoreReport([FromBody] TaxByStoreRequestDto request)
        {
            var result = await _reportService.GetTaxByStoreReportAsync(request ?? new TaxByStoreRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Items (inventory) report with pagination and store/department/search filters.
        /// </summary>
        [HttpPost("Items")]
        public IActionResult GetItemsReport([FromBody] ItemsReportRequestDto request)
        {
            var result = _reportService.GetItemsReport(request ?? new ItemsReportRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Department Inventory report: one row per store+department with aggregated item count and values.
        /// </summary>
        [HttpPost("DepartmentInventory")]
        public IActionResult GetDepartmentInventoryReport([FromBody] DepartmentInventoryRequestDto request)
        {
            var result = _reportService.GetDepartmentInventoryReport(request ?? new DepartmentInventoryRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Item Inventory Summary report: one row per item with aggregated totals (excludes null/empty department).
        /// </summary>
        [HttpPost("ItemInventorySummary")]
        public IActionResult GetItemInventorySummaryReport([FromBody] ItemInventorySummaryRequestDto request)
        {
            var result = _reportService.GetItemInventorySummaryReport(request ?? new ItemInventorySummaryRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Departments Valuation report (same as desktop): SP_GetDepartments. Columns: Main/Sub/SubSub Department, Name, On Hand, On Order, On Sale Order, Cost, AVG Cost, Price, Store Name.
        /// Accepts string StoreId/AsOfDate so grid payload and empty strings do not break binding.
        /// </summary>
        [HttpPost("DepartmentsValuation")]
        public async Task<IActionResult> GetDepartmentsValuationReport([FromBody] DepartmentsValuationApiRequestDto request)
        {
            Guid? storeId = null;
            if (!string.IsNullOrWhiteSpace(request?.StoreId) && Guid.TryParse(request.StoreId.Trim(), out var parsedStoreId))
                storeId = parsedStoreId;

            DateTime? asOfDate = null;
            if (!string.IsNullOrWhiteSpace(request?.AsOfDate) && DateTime.TryParse(request.AsOfDate.Trim(), out var parsedDate))
                asOfDate = parsedDate;

            var dto = new DepartmentsValuationRequestDto { StoreId = storeId, AsOfDate = asOfDate };
            var result = await _reportService.GetDepartmentsValuationReportAsync(dto);

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Price Change History report with pagination and filters (date range, item search).
        /// </summary>
        [HttpPost("PriceChangeHistory")]
        public async Task<IActionResult> GetPriceChangeHistoryReport([FromBody] PriceChangeHistoryRequestDto request)
        {
            var result = await _reportService.GetPriceChangeHistoryReportAsync(request ?? new PriceChangeHistoryRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Tender Totals report (desktop Tender Totals): totals by tender type/credit type for a date range and optional store.
        /// </summary>
        [HttpPost("TenderTotals")]
        public async Task<IActionResult> GetTenderTotalsReport([FromBody] TenderTotalsRequestDto request)
        {
            var result = await _reportService.GetTenderTotalsReportAsync(request ?? new TenderTotalsRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }
          
            return Ok(result);
        }
        
        /// <summary>
        /// Gets Tender Totals By Station report: totals by tender type/credit type per register (station) for a date range and optional store.
        /// </summary>
        [HttpPost("TenderTotalsByStation")]
        public async Task<IActionResult> GetTenderTotalsByStationReport([FromBody] TenderTotalsRequestDto request)
        {
            var result = await _reportService.GetTenderTotalsByStationReportAsync(request ?? new TenderTotalsRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Tender Totals drill-down: returns the transaction-level rows behind a single
        /// Register+Cashier cell from the parent pivot. Desktop equivalent: double-click
        /// a cell in RepTenders to open RepTendersCashier.
        /// </summary>
        [HttpPost("TenderTotalsDetails")]
        public async Task<IActionResult> GetTenderTotalsDetails([FromBody] TenderTotalsDetailsRequestDto request)
        {
            var result = await _reportService.GetTenderTotalsDetailsAsync(request ?? new TenderTotalsDetailsRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
       
        /// <summary>
        /// Gets On Account Sales report: one row per on-account transaction between dates, optional store and customer.
        /// </summary>
        [HttpPost("OnAccountSales")]
        public async Task<IActionResult> GetOnAccountSalesReport([FromBody] OnAccountSalesRequestDto request)
        {
            var result = await _reportService.GetOnAccountSalesReportAsync(request ?? new OnAccountSalesRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// On Account Sales / Payments drill-down: transaction-level rows for a single customer.
        /// Desktop equivalent: RepAcountReceivableSales -> ClickOnRow -> FrmLiveReport.
        /// </summary>
        [HttpPost("OnAccountSalesDetails")]
        public async Task<IActionResult> GetOnAccountSalesDetails([FromBody] OnAccountSalesDetailsRequestDto request)
        {
            var result = await _reportService.GetOnAccountSalesDetailsAsync(request ?? new OnAccountSalesDetailsRequestDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }
        
        /// <summary>
        /// Gets Daily Hour Sales report: sales metrics aggregated by store and hour within a date range and optional store.
        /// </summary>
        [HttpPost("DailyHourSales")]
        public async Task<IActionResult> GetDailyHourSalesReport([FromBody] DailyHourSalesRequestDto request)
        {
            var result = await _reportService.GetDailyHourSalesReportAsync(request ?? new DailyHourSalesRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Drill-down for the Daily Hour Sales report — triggered by row double-click on the
        /// frontend. Returns transactions in [hourStart, hourStart + 1h) for the supplied store.
        /// </summary>
        [HttpPost("DailyHourSalesDetails")]
        public async Task<IActionResult> GetDailyHourSalesDetails([FromBody] DailyHourSalesDetailsRequestDto request)
        {
            var result = await _reportService.GetDailyHourSalesDetailsAsync(request ?? new DailyHourSalesDetailsRequestDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Gets Item Daily Sales report: aggregated sales per item and day within a date range.
        /// </summary>
        [HttpPost("ItemDailySales")]
        public async Task<IActionResult> GetItemDailySalesReport([FromBody] ItemDailySalesRequestDto request)
        {
            var result = await _reportService.GetItemDailySalesReportAsync(request ?? new ItemDailySalesRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Pivoted Item Daily Sales view — rows = (Department, Item, Barcode), columns = dates,
        /// cells = Amount + Qty. Drives the desktop-style RepItemsDailySales screen.
        /// </summary>
        [HttpPost("ItemDailySalesPivot")]
        public async Task<IActionResult> GetItemDailySalesPivot([FromBody] ItemDailySalesPivotRequestDto request)
        {
            var result = await _reportService.GetItemDailySalesPivotAsync(request ?? new ItemDailySalesPivotRequestDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Gets Item Weekly Sales report: aggregated sales per item and week within a date range.
        /// </summary>
        [HttpPost("ItemWeeklySales")]
        public async Task<IActionResult> GetItemWeeklySalesReport([FromBody] ItemWeeklySalesRequestDto request)
        {
            var result = await _reportService.GetItemWeeklySalesReportAsync(request ?? new ItemWeeklySalesRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Pivoted Item Weekly Sales view — rows = (Department, Item, Barcode), columns = week-start
        /// dates, cells = Amount + Qty. Mirrors desktop RepItemsWeeklySales.
        /// </summary>
        [HttpPost("ItemWeeklySalesPivot")]
        public async Task<IActionResult> GetItemWeeklySalesPivot([FromBody] ItemWeeklySalesPivotRequestDto request)
        {
            var result = await _reportService.GetItemWeeklySalesPivotAsync(request ?? new ItemWeeklySalesPivotRequestDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Gets Item Monthly Sales report: aggregated sales per item and month within a date range.
        /// </summary>
        [HttpPost("ItemMonthlySales")]
        public async Task<IActionResult> GetItemMonthlySalesReport([FromBody] ItemMonthlySalesRequestDto request)
        {
            var result = await _reportService.GetItemMonthlySalesReportAsync(request ?? new ItemMonthlySalesRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Pivoted Item Monthly Sales view — rows = (Department, Item, Barcode), columns =
        /// Year > Month, cells = Amount + Qty. Mirrors desktop RepItemsMonthlySales.
        /// </summary>
        [HttpPost("ItemMonthlySalesPivot")]
        public async Task<IActionResult> GetItemMonthlySalesPivot([FromBody] ItemMonthlySalesPivotRequestDto request)
        {
            var result = await _reportService.GetItemMonthlySalesPivotAsync(request ?? new ItemMonthlySalesPivotRequestDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Drill-down for pivot cells: returns transactions for an item (or manual item by name)
        /// within a date window. Used by the daily / weekly / monthly pivot double-click.
        /// </summary>
        [HttpPost("ItemSalesTransactions")]
        public async Task<IActionResult> GetItemSalesTransactions([FromBody] ItemSalesTransactionsRequestDto request)
        {
            var result = await _reportService.GetItemSalesTransactionsAsync(request ?? new ItemSalesTransactionsRequestDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Returns the printable receipt text for a single Transaction. Drives the "Open Receipt"
        /// modal on every detail report row that surfaces a Transaction No.
        /// </summary>
        [HttpPost("TransactionReceipt")]
        public async Task<IActionResult> GetTransactionReceipt([FromBody] TransactionReceiptRequestDto request)
        {
            var result = await _reportService.GetTransactionReceiptAsync(request ?? new TransactionReceiptRequestDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Gets Department Daily Sales report: aggregated sales per department and day within a date range.
        /// </summary>
        [HttpPost("DepartmentDailySales")]
        public async Task<IActionResult> GetDepartmentDailySalesReport([FromBody] DepartmentDailySalesRequestDto request)
        {
            var result = await _reportService.GetDepartmentDailySalesReportAsync(request ?? new DepartmentDailySalesRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Pivoted Department Daily Sales view — rows = (Date, Store), columns = Departments,
        /// cells = Amount + Qty. Mirrors desktop RepDepartmentDailySales.
        /// </summary>
        [HttpPost("DepartmentDailySalesPivot")]
        public async Task<IActionResult> GetDepartmentDailySalesPivot([FromBody] DepartmentDailySalesPivotRequestDto request)
        {
            var result = await _reportService.GetDepartmentDailySalesPivotAsync(request ?? new DepartmentDailySalesPivotRequestDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Pivoted Department Weekly Sales — rows = (Department, Store), columns = weeks,
        /// cells = Amount + Qty. Mirrors desktop RepDepartmentWeeklySales.
        /// </summary>
        [HttpPost("DepartmentWeeklySalesPivot")]
        public async Task<IActionResult> GetDepartmentWeeklySalesPivot([FromBody] DepartmentWeeklySalesPivotRequestDto request)
        {
            var result = await _reportService.GetDepartmentWeeklySalesPivotAsync(request ?? new DepartmentWeeklySalesPivotRequestDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Pivoted Department Monthly Sales — rows = (Year, Month), columns = (Department, Store),
        /// cells = Amount + Qty. Mirrors desktop RepDepartmentMonthlySales.
        /// </summary>
        [HttpPost("DepartmentMonthlySalesPivot")]
        public async Task<IActionResult> GetDepartmentMonthlySalesPivot([FromBody] DepartmentMonthlySalesPivotRequestDto request)
        {
            var result = await _reportService.GetDepartmentMonthlySalesPivotAsync(request ?? new DepartmentMonthlySalesPivotRequestDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Gets Department Weekly Sales report: aggregated sales per department and week within a date range.
        /// </summary>
        [HttpPost("DepartmentWeeklySales")]
        public async Task<IActionResult> GetDepartmentWeeklySalesReport([FromBody] DepartmentWeeklySalesRequestDto request)
        {
            var result = await _reportService.GetDepartmentWeeklySalesReportAsync(request ?? new DepartmentWeeklySalesRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Department Monthly Sales report: aggregated sales per department and month within a date range.
        /// </summary>
        [HttpPost("DepartmentMonthlySales")]
        public async Task<IActionResult> GetDepartmentMonthlySalesReport([FromBody] DepartmentMonthlySalesRequestDto request)
        {
            var result = await _reportService.GetDepartmentMonthlySalesReportAsync(request ?? new DepartmentMonthlySalesRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Total Daily Sales report: total sales per day within a date range.
        /// </summary>
        [HttpPost("TotalDailySales")]
        public async Task<IActionResult> GetTotalDailySalesReport([FromBody] TotalDailySalesRequestDto request)
        {
            var result = await _reportService.GetTotalDailySalesReportAsync(request ?? new TotalDailySalesRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Total Weekly Sales report: total sales per week within a date range.
        /// </summary>
        [HttpPost("TotalWeeklySales")]
        public async Task<IActionResult> GetTotalWeeklySalesReport([FromBody] TotalWeeklySalesRequestDto request)
        {
            var result = await _reportService.GetTotalWeeklySalesReportAsync(request ?? new TotalWeeklySalesRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Total Monthly Sales report: total sales per month within a date range.
        /// </summary>
        [HttpPost("TotalMonthlySales")]
        public async Task<IActionResult> GetTotalMonthlySalesReport([FromBody] TotalMonthlySalesRequestDto request)
        {
            var result = await _reportService.GetTotalMonthlySalesReportAsync(request ?? new TotalMonthlySalesRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Action Summary report: aggregated POS actions by date, cashier, and action within a date range and optional store.
        /// </summary>
        [HttpPost("ActionSummary")]
        public async Task<IActionResult> GetActionSummaryReport([FromBody] ActionSummaryRequestDto request)
        {
            var result = await _reportService.GetActionSummaryReportAsync(request ?? new ActionSummaryRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Action Details report: detailed POS actions within a date range and optional store.
        /// </summary>
        [HttpPost("ActionDetails")]
        public async Task<IActionResult> GetActionDetailsReport([FromBody] ActionDetailsRequestDto request)
        {
            var result = await _reportService.GetActionDetailsReportAsync(request ?? new ActionDetailsRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Summary report: store/day totals within a date range and optional store.
        /// </summary>
        [HttpPost("Summary")]
        public async Task<IActionResult> GetSummaryReport([FromBody] SummaryReportRequestDto request)
        {
            var result = await _reportService.GetSummaryReportAsync(request ?? new SummaryReportRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Sales Summary By Transaction report (desktop clone): same filters as Summary, dedicated endpoint.
        /// </summary>
        [HttpPost("SalesSummaryByTransaction")]
        public async Task<IActionResult> GetSalesSummaryByTransactionReport([FromBody] SalesSummaryByTransactionRequestDto request)
        {
            var result = await _reportService.GetSalesSummaryByTransactionReportAsync(request ?? new SalesSummaryByTransactionRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Drill-down for the Sales Summary By Transaction report — triggered by row double-click.
        /// Returns the per-line profit details for one transaction (SP_GetEntryProfit).
        /// </summary>
        [HttpPost("SalesSummaryByTransactionDetails")]
        public async Task<IActionResult> GetSalesSummaryByTransactionDetails([FromBody] SalesSummaryByTransactionDetailsRequestDto request)
        {
            var result = await _reportService.GetSalesSummaryByTransactionDetailsAsync(request ?? new SalesSummaryByTransactionDetailsRequestDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Gets Sales Summary By Item report (desktop clone): SP_GetItemSummary with date range and store filter only.
        /// </summary>
        [HttpPost("SalesSummaryByItem")]
        public async Task<IActionResult> GetSalesSummaryByItemReport([FromBody] SalesSummaryByItemRequestDto request)
        {
            var result = await _reportService.GetSalesSummaryByItemReportAsync(request ?? new SalesSummaryByItemRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Drill-down for the Sales Summary By Item report — triggered by row double-click.
        /// Returns per-transaction sales lines for one item via SP_GetTransactionEntryItem.
        /// </summary>
        [HttpPost("SalesSummaryByItemDetails")]
        public async Task<IActionResult> GetSalesSummaryByItemDetails([FromBody] SalesSummaryByItemDetailsRequestDto request)
        {
            var result = await _reportService.GetSalesSummaryByItemDetailsAsync(request ?? new SalesSummaryByItemDetailsRequestDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Gets Sales Summary By Department report: SP_GetDepartmentSummary with date range and store filter only.
        /// </summary>
        [HttpPost("SalesSummaryByDepartment")]
        public async Task<IActionResult> GetSalesSummaryByDepartmentReport([FromBody] SalesSummaryByDepartmentRequestDto request)
        {
            var result = await _reportService.GetSalesSummaryByDepartmentReportAsync(request ?? new SalesSummaryByDepartmentRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Sales Summary By Discount report: SP_GetDiscountSummary with date range and store filter only.
        /// </summary>
        [HttpPost("SalesSummaryByDiscount")]
        public async Task<IActionResult> GetSalesSummaryByDiscountReport([FromBody] SalesSummaryByDiscountRequestDto request)
        {
            var result = await _reportService.GetSalesSummaryByDiscountReportAsync(request ?? new SalesSummaryByDiscountRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Drill-down for Sales Summary By Discount — triggered by row double-click.
        /// Returns per-transaction details for one discount via SP_GetTransactionDiscount.
        /// </summary>
        [HttpPost("SalesSummaryByDiscountDetails")]
        public async Task<IActionResult> GetSalesSummaryByDiscountDetails([FromBody] SalesSummaryByDiscountDetailsRequestDto request)
        {
            var result = await _reportService.GetSalesSummaryByDiscountDetailsAsync(request ?? new SalesSummaryByDiscountDetailsRequestDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Gets Sales Summary By Specials report: Rpt_ItemsInSpecials with date range and store filter.
        /// </summary>
        [HttpPost("SalesSummaryBySpecials")]
        public async Task<IActionResult> GetSalesSummaryBySpecialsReport([FromBody] SalesSummaryBySpecialsRequestDto request)
        {
            var result = await _reportService.GetSalesSummaryBySpecialsReportAsync(request ?? new SalesSummaryBySpecialsRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Date Comparison report: compares customer sales between two date ranges for an optional store.
        /// </summary>
        [HttpPost("DateComparison")]
        public async Task<IActionResult> GetDateComparisonReport([FromBody] DateComparisonRequestDto request)
        {
            var result = await _reportService.GetDateComparisonReportAsync(request ?? new DateComparisonRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets On Account Payments report: payments made on customer accounts, aggregated per customer for the date range and optional store/customer.
        /// </summary>
        [HttpPost("OnAccountPayments")]
        public async Task<IActionResult> GetOnAccountPaymentsReport([FromBody] OnAccountPaymentsRequestDto request)
        {
            var result = await _reportService.GetOnAccountPaymentsReportAsync(request ?? new OnAccountPaymentsRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Receive Inventory Value report (Sp_rptRecicveValue) with store, date range, supplier, department, brand filters.
        /// </summary>
        [HttpPost("ReceiveInventoryValue")]
        public async Task<IActionResult> GetReceiveInventoryValueReport([FromBody] ReceiveInventoryValueRequestDto request)
        {
            var result = await _reportService.GetReceiveInventoryValueReportAsync(request ?? new ReceiveInventoryValueRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Items in Partial Receive report (Sp_rptOpenPartialPO) with store, date range, supplier, department, brand filters.
        /// </summary>
        [HttpPost("ItemsInPartialReceive")]
        public async Task<IActionResult> GetItemsInPartialReceiveReport([FromBody] ItemsInPartialReceiveRequestDto request)
        {
            var result = await _reportService.GetItemsInPartialReceiveReportAsync(request ?? new ItemsInPartialReceiveRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Items on Receive Order report (Sp_PO_Receive_Report) with store, date range, supplier, optional department.
        /// </summary>
        [HttpPost("ItemsOnReceiveOrder")]
        public async Task<IActionResult> GetItemsOnReceiveOrderReport([FromBody] ItemsOnReceiveOrderRequestDto request)
        {
            var result = await _reportService.GetItemsOnReceiveOrderReportAsync(request ?? new ItemsOnReceiveOrderRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Sales History for a specific item (SP_GetSalesHistory) with date range filter.
        /// </summary>
        [HttpPost("ItemSalesHistory")]
        public async Task<IActionResult> GetItemSalesHistory([FromBody] ItemSalesHistoryRequestDto request)
        {
            var result = await _reportService.GetItemSalesHistoryAsync(request ?? new ItemSalesHistoryRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets date scope presets from the DateScope table.
        /// </summary>
        [HttpGet("DateScopes")]
        public async Task<IActionResult> GetDateScopes()
        {
            var result = await _reportService.GetDateScopesAsync();

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Gets Register Shifts report (desktop Register Shifts): one row per register shift with expected/pick/discrepancy.
        /// </summary>
        [HttpPost("RegisterShifts")]
        public async Task<IActionResult> GetRegisterShiftReport([FromBody] RegisterShiftReportRequestDto request)
        {
            var result = await _reportService.GetRegisterShiftReportAsync(request ?? new RegisterShiftReportRequestDto());

            if (!result.IsSuccess)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Reconcile Batch — Init: seeds BatchRec rows for the shift and returns the tender list.
        /// Desktop equivalent: BatchReconciles.Start (SP_AddBatchToRec + LoadGrid).
        /// </summary>
        [HttpPost("RegShift/ReconcileInit")]
        public async Task<IActionResult> InitReconcileBatch([FromBody] ReconcileBatchInitRequestDto request)
        {
            var result = await _reportService.InitReconcileBatchAsync(request ?? new ReconcileBatchInitRequestDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Reconcile Batch — Save: persists per-tender PickUpAmount/PickUpCount/Note and sets the
        /// shift status to RECONCILE (3). Desktop equivalent: BatchReconciles.BtnSave_Click.
        /// </summary>
        [HttpPost("RegShift/ReconcileSave")]
        public async Task<IActionResult> SaveReconcileBatch([FromBody] ReconcileBatchSaveRequestDto request)
        {
            var result = await _reportService.SaveReconcileBatchAsync(request ?? new ReconcileBatchSaveRequestDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Total Tenders for a single shift (desktop RepTendersShift).
        /// </summary>
        [HttpPost("RegShift/TotalTenders")]
        public async Task<IActionResult> GetTotalTendersForShift([FromBody] TotalTendersForShiftRequestDto request)
        {
            var result = await _reportService.GetTotalTendersForShiftAsync(request ?? new TotalTendersForShiftRequestDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }
    }
}
