/**
 * Report deep-link routing.
 *
 * Reports are launched from <ReportManagerPage /> via openTab() with a stable
 * tab id of `report-<reportId>` and props carrying the report id + filters.
 * This module lets the URL layer round-trip those report tabs:
 *   - active report tab            → /dashboard/reports/<reportId>
 *   - /dashboard/reports/<reportId> on load → reopen the report tab
 *
 * `reportComponentMap` and `SUBREPORT_ID_TO_KEY` are the SINGLE SOURCE for
 * report → component routing — they live here and are imported by
 * ReportManagerPage (which used to declare them inline).
 *
 * `REPORT_TITLES` carries the tab-strip display name for the deep-linkable
 * reports (those with a dedicated page in `reportComponentMap`). It mirrors the
 * `name` field of the matching entries in ReportManagerPage's `allReports`;
 * keep it in sync when adding a new dedicated report page.
 *
 * Only the report itself is encoded in the URL, not its filters — a deep-linked
 * report opens with default (last-30-days) filters. Serializing the user's
 * actual filters into the URL is a separate (Tier 2) enhancement.
 */

// reportId → dedicated page component. Shared with ReportManagerPage.handleRunReport.
export const reportComponentMap: Record<string, string> = {
  "shift-report": "ShiftReportPage",
  "tax-collected": "TaxCollectedReportPage",
  "returned-items": "ReturnedItemsReportPage",
  "tax-by-store": "TaxByStoreReportPage",
  "tender-totals": "TenderTotalsReportPage",
  "tender-totals-by-station": "TenderTotalsByStationReportPage",
  "action-summary": "ActionSummaryReportPage",
  "action-details": "ActionDetailsReportPage",
  "on-account-sales": "OnAccountSalesReportPage",
  "on-account-payments": "OnAccountPaymentsReportPage",
  "daily-hour-sales": "DailyHourSalesReportPage",
  "items-inventory": "ItemInventoryReportPage",
  "department-inventory": "DepartmentInventoryReportPage",
  "items-on-purchase-order": "ItemsOnPurchaseOrderReportPage",
  "items-on-receive-order": "ItemsOnReceiveOrderReportPage",
  "price-change-history": "PriceChangeHistoryReportPage",
  "ar-aging-reports": "ArAgingReportsPage",
  "customer-list-report": "CustomerListReportPage",
  "receive-inventory-value": "ReceiveInventoryValueReportPage",
  "items-partial-receive": "ItemsInPartialReceiveReportPage",
  "summary-reports": "SummaryReportPage",
  "item-daily-sales": "ItemDailySalesPivotPage",
  "item-weekly-sales": "ItemWeeklySalesPivotPage",
  "item-monthly-sales": "ItemMonthlySalesPivotPage",
  "department-daily-sales": "DepartmentDailySalesPivotPage",
  "department-weekly-sales": "DepartmentWeeklySalesPivotPage",
  "department-monthly-sales": "DepartmentMonthlySalesPivotPage",
  "total-daily-sales": "MonthlyWeeklyDailyReportPage",
  "total-weekly-sales": "MonthlyWeeklyDailyReportPage",
  "total-monthly-sales": "MonthlyWeeklyDailyReportPage",
  "sales-summary-by-transaction": "SalesSummaryByTransactionReportPage",
  "sales-summary-by-item": "SalesSummaryByItemReportPage",
  "sales-summary-by-department": "SalesSummaryByDepartmentReportPage",
  "sales-summary-by-discount": "SalesSummaryByDiscountReportPage",
  "sales-summary-by-specials": "SalesSummaryBySpecialsReportPage",
  "date-comparison": "DateComparisonReportPage",
};

// Sub-report id → key consumed by MonthlyWeeklyDailyReportPage. Shared with ReportManagerPage.
export const SUBREPORT_ID_TO_KEY: Record<string, string> = {
  "item-daily-sales": "item-daily",
  "item-weekly-sales": "item-weekly",
  "item-monthly-sales": "item-monthly",
  "department-daily-sales": "department-daily",
  "department-weekly-sales": "department-weekly",
  "department-monthly-sales": "department-monthly",
  "total-daily-sales": "total-daily",
  "total-weekly-sales": "total-weekly",
  "total-monthly-sales": "total-monthly",
};

// Display name for each deep-linkable report (mirrors allReports[].name).
const REPORT_TITLES: Record<string, string> = {
  "shift-report": "Shift Report",
  "tax-collected": "Tax Collected",
  "returned-items": "Returned Items",
  "tax-by-store": "Tax By Store",
  "tender-totals": "Tender Totals",
  "tender-totals-by-station": "Tender Totals By Station",
  "action-summary": "Action Summary",
  "action-details": "Action Details",
  "on-account-sales": "On Account Sales",
  "on-account-payments": "On Account Payments",
  "daily-hour-sales": "Daily Hour Sales",
  "items-inventory": "Items Inventory",
  "department-inventory": "Department Inventory",
  "items-on-purchase-order": "Items on Purchase Order",
  "items-on-receive-order": "Items on Receive Order",
  "price-change-history": "Price Change History",
  "ar-aging-reports": "A/R Aging Reports",
  "customer-list-report": "Customer List",
  "receive-inventory-value": "Receive Inventory Value",
  "items-partial-receive": "Items in Partial Receive",
  "summary-reports": "Summary Report",
  "item-daily-sales": "Item Daily Sales",
  "item-weekly-sales": "Item Weekly Sales",
  "item-monthly-sales": "Item Monthly Sales",
  "department-daily-sales": "Department Daily Sales",
  "department-weekly-sales": "Department Weekly Sales",
  "department-monthly-sales": "Department Monthly Sales",
  "total-daily-sales": "Total Daily Sales",
  "total-weekly-sales": "Total Weekly Sales",
  "total-monthly-sales": "Total Monthly Sale",
  "sales-summary-by-transaction": "Sales Summary By Transaction",
  "sales-summary-by-item": "Sales Summary By Item",
  "sales-summary-by-department": "Sales Summary By Department",
  "sales-summary-by-discount": "Sales Summary By Discount",
  "sales-summary-by-specials": "Sales Summary By Specials",
  "date-comparison": "Date Comparison",
};

/** Whether a report id can be deep-linked (i.e. it has a dedicated page). */
export function isReportDeepLinkable(reportId: string): boolean {
  return Object.prototype.hasOwnProperty.call(reportComponentMap, reportId);
}

/** Default filter window for a deep-linked report — matches the Report Manager
 *  filter modal's initial state (last 30 days → today). */
function defaultReportFilters(): { dateFrom: string; dateTo: string } {
  const iso = (d: Date) => d.toISOString().split("T")[0];
  const today = new Date();
  const from = new Date();
  from.setDate(today.getDate() - 30);
  return { dateFrom: iso(from), dateTo: iso(today) };
}

export interface ReportDeepLinkTab {
  id: string;
  component: string;
  title: string;
  props: {
    reportId: string;
    reportName: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filters: Record<string, any>;
    subReportKey?: string;
  };
}

/**
 * Build the openTab payload for a report opened from a /dashboard/reports/<id>
 * deep link. Returns null for unknown reports (no dedicated page). Mirrors how
 * ReportManagerPage.handleRunReport constructs the tab, minus the user's chosen
 * filters (defaults applied instead).
 */
export function getReportDeepLinkTab(reportId: string): ReportDeepLinkTab | null {
  const component = reportComponentMap[reportId];
  if (!component) return null;
  const title = REPORT_TITLES[reportId] ?? "Report";
  const subReportKey = SUBREPORT_ID_TO_KEY[reportId];
  return {
    id: `report-${reportId}`,
    component,
    title,
    props: {
      reportId,
      reportName: title,
      filters: defaultReportFilters(),
      ...(subReportKey && component === "MonthlyWeeklyDailyReportPage" ? { subReportKey } : {}),
    },
  };
}
