import React, { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import Flatpickr from "react-flatpickr"
import "flatpickr/dist/themes/light.css"
import { useDashboardTabs } from "../../context/DashboardTabContext"
import { useAppSelector } from "../../hooks/useAppSelector"
import { API_ENDPOINTS } from "../../constants/api"
import { useReportFavorites } from "../../hooks/useReportFavorites"
import { useReportFilterState } from "../../hooks/useReportFilterState"
import { customDateScopeService, type CustomDateScope } from "../../services/customDateScopeService"
import { reportComponentMap, SUBREPORT_ID_TO_KEY } from "../../constants/reportTabRoutes"

// Report category types
type ReportCategory =
    | "inventory"
    | "customer"
    | "payable"
    | "store"
    | "pos"
    | "sales"
    | "schedule"

interface ReportDefinition {
    id: string
    name: string
    category: ReportCategory
    description: string
    icon: string
    /** Optional screen code used for role-based visibility */
    screenCode?: string
    hasDateFilter?: boolean
    /** Single "As of date" (no date range) - used e.g. by Department Inventory */
    hasAsOfDateFilter?: boolean
    hasStoreFilter?: boolean
    /** Station (register) filter – used only for Tender Totals By Station */
    hasStationFilter?: boolean
    hasCustomerFilter?: boolean
    hasVendorFilter?: boolean
    hasItemFilter?: boolean
    hasDepartmentFilter?: boolean
    hasBrandFilter?: boolean
    /** Partial/Closed PO status (e.g. Items on Purchase Order) */
    hasPartialClosedFilter?: boolean
    /**
     * True when this report doesn't yet have a fully-implemented page.
     * Derived from `enabledReportIds` at module load (see below) and kept on
     * the definition so the drawer / filter predicate can read it directly
     * without re-deriving from a separate Set.
     */
    comingSoon?: boolean
    /**
     * Controls whether the FilterModal renders the "More ▾" custom-date-scope picker.
     *
     * Default: every date-filtered report shows it. Set to `false` here only
     * when a specific report shouldn't expose saved scopes (none today). The
     * modal's render check is `report.hasDateFilter && report.usesCustomDateScopes !== false`.
     */
    usesCustomDateScopes?: boolean
}

// All available reports
const allReports: ReportDefinition[] = [
    // Inventory Reports
    { id: "tax-collected", name: "Tax Collected", category: "inventory", description: "View tax collected across transactions", icon: "receipt", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.tax_collected" },
    { id: "tax-by-store", name: "Tax By Store", category: "inventory", description: "Tax breakdown by store location", icon: "store", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.tax_by_store" },
    { id: "returned-items", name: "Returned Items", category: "inventory", description: "List of all returned items", icon: "undo", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.returned_items" },
    // screenCode is reports.item_inventory (singular) to match Perms.cs
    // (BackOffice.Common/Permissions/Perms.cs → Reports.ItemInventory.View).
    // Was reports.items_inventory previously — typo, no matching permission,
    // so the report was silently filtered out of the Manager for every user.
    { id: "items-inventory", name: "Items Inventory", category: "inventory", description: "Current inventory levels for all items", icon: "inventory", hasStoreFilter: true, hasDepartmentFilter: true, screenCode: "reports.item_inventory" },
    { id: "department-inventory", name: "Department Inventory", category: "inventory", description: "Inventory grouped by department", icon: "category", hasAsOfDateFilter: true, hasStoreFilter: true, screenCode: "reports.department_inventory" },
    { id: "price-change-history", name: "Price Change History", category: "inventory", description: "History of price changes", icon: "history", hasDateFilter: true, hasItemFilter: true, screenCode: "reports.price_change_history" },
    { id: "items-on-purchase-order", name: "Items on Purchase Order", category: "inventory", description: "Items currently on purchase orders", icon: "shopping_cart", hasDateFilter: true, hasStoreFilter: true, hasVendorFilter: true, hasDepartmentFilter: true, hasBrandFilter: true, hasPartialClosedFilter: true, screenCode: "reports.items_on_purchase_order" },
    { id: "items-on-receive-order", name: "Items on Receive Order", category: "inventory", description: "Items pending receipt", icon: "local_shipping", hasDateFilter: true, hasStoreFilter: true, hasVendorFilter: true, screenCode: "reports.items_on_receive_order" },
    { id: "items-partial-receive", name: "Items in Partial Receive", category: "inventory", description: "Partially received items", icon: "pending", hasDateFilter: true, hasStoreFilter: true, hasVendorFilter: true, hasDepartmentFilter: true, hasBrandFilter: true, screenCode: "reports.items_partial_receive" },
    { id: "receive-inventory-value", name: "Receive Inventory Value", category: "inventory", description: "Value of received inventory", icon: "attach_money", hasDateFilter: true, hasStoreFilter: true, hasVendorFilter: true, hasDepartmentFilter: true, hasBrandFilter: true, screenCode: "reports.receive_inventory_value" },
    { id: "inventory-refill", name: "Inventory ReFill", category: "inventory", description: "Items needing restock", icon: "add_shopping_cart", hasStoreFilter: true, hasDepartmentFilter: true, screenCode: "reports.inventory_refill" },

    // Customer Reports
    { id: "customer-list-report", name: "Customer List", category: "customer", description: "Complete list of customers", icon: "people", hasCustomerFilter: true, screenCode: "reports.customer_list_report" },
    { id: "ar-aging-reports", name: "A/R Aging Reports", category: "customer", description: "Accounts receivable aging summary", icon: "schedule", hasDateFilter: true, hasCustomerFilter: true, screenCode: "reports.ar_aging_reports" },
    { id: "ar-aging-details", name: "A/R Aging Details", category: "customer", description: "Detailed A/R aging information", icon: "list_alt", hasDateFilter: true, hasCustomerFilter: true, screenCode: "reports.ar_aging_details" },
    { id: "balance-by-date", name: "Customer Balance By Date", category: "customer", description: "Customer balances at specific dates", icon: "calendar_today", hasDateFilter: true, hasCustomerFilter: true, screenCode: "reports.balance_by_date" },
    { id: "type-summary", name: "Customer Type Summary", category: "customer", description: "Summary by customer type", icon: "pie_chart", hasCustomerFilter: true, screenCode: "reports.type_summary" },
    { id: "balance-details", name: "Customer Balance Details", category: "customer", description: "Detailed balance breakdown", icon: "account_balance", hasCustomerFilter: true, screenCode: "reports.balance_details" },
    { id: "zip-summary", name: "Customer Zip Summary", category: "customer", description: "Customers grouped by zip code", icon: "location_on", hasCustomerFilter: true, screenCode: "reports.zip_summary" },
    { id: "open-invoice", name: "Open Invoice", category: "customer", description: "All open invoices", icon: "receipt_long", hasDateFilter: true, hasCustomerFilter: true, screenCode: "reports.open_invoice" },
    { id: "transaction-by-shipping", name: "Transaction By Shipping", category: "customer", description: "Transactions grouped by shipping", icon: "local_shipping", hasDateFilter: true, screenCode: "reports.transaction_by_shipping" },
    { id: "customer-sales", name: "Customer Sales", category: "customer", description: "Sales by customer", icon: "trending_up", hasDateFilter: true, hasCustomerFilter: true, screenCode: "reports.customer_sales" },
    { id: "customer-comparison", name: "Customer Comparison", category: "customer", description: "Compare customer metrics", icon: "compare", hasDateFilter: true, hasCustomerFilter: true, screenCode: "reports.customer_comparison" },
    { id: "item-sales", name: "Customers Item Sales", category: "customer", description: "Items sold to customers", icon: "shopping_bag", hasDateFilter: true, hasCustomerFilter: true, hasItemFilter: true, screenCode: "reports.item_sales" },
    { id: "item-sales-invoice", name: "Customer ItemSales With Invoice", category: "customer", description: "Item sales with invoice details", icon: "description", hasDateFilter: true, hasCustomerFilter: true, screenCode: "reports.item_sales_invoice" },
    { id: "monthly-sale", name: "Customer Monthly Sale", category: "customer", description: "Monthly sales by customer", icon: "date_range", hasDateFilter: true, hasCustomerFilter: true, screenCode: "reports.monthly_sale" },
    { id: "weekly-sale", name: "Customer Weekly Sale", category: "customer", description: "Weekly sales by customer", icon: "view_week", hasDateFilter: true, hasCustomerFilter: true, screenCode: "reports.weekly_sale" },
    { id: "department-sale", name: "Customer Department Sale", category: "customer", description: "Sales by department per customer", icon: "category", hasDateFilter: true, hasCustomerFilter: true, hasDepartmentFilter: true, screenCode: "reports.department_sale" },
    { id: "phone-order-history", name: "Customer Phone Order History", category: "customer", description: "Phone order history", icon: "phone", hasDateFilter: true, hasCustomerFilter: true, screenCode: "reports.phone_order_history" },
    { id: "credit-line-changes", name: "Credit Line Changes", category: "customer", description: "Credit limit changes history", icon: "credit_card", hasDateFilter: true, hasCustomerFilter: true, screenCode: "reports.credit_line_changes" },
    { id: "loyalty-summary", name: "Loyalty Summary", category: "customer", description: "Loyalty program summary", icon: "stars", hasCustomerFilter: true, screenCode: "reports.loyalty_summary" },
    { id: "customer-loyalty", name: "Customer Loyalty", category: "customer", description: "Customer loyalty details", icon: "loyalty", hasCustomerFilter: true, screenCode: "reports.customer_loyalty" },
    { id: "balance-divided-by-day", name: "Balance Divided By Day", category: "customer", description: "Daily balance breakdown", icon: "today", hasDateFilter: true, hasCustomerFilter: true, screenCode: "reports.balance_divided_by_day" },
    { id: "balances-on-season", name: "Balances On Season", category: "customer", description: "Seasonal balance analysis", icon: "wb_sunny", hasDateFilter: true, hasCustomerFilter: true, screenCode: "reports.balances_on_season" },

    // Payable Reports
    { id: "ap-aging-reports", name: "A/P Aging Reports", category: "payable", description: "Accounts payable aging summary", icon: "schedule", hasDateFilter: true, hasVendorFilter: true, screenCode: "reports.ap_aging_reports" },
    { id: "ap-aging-details", name: "A/P Aging Details", category: "payable", description: "Detailed A/P aging information", icon: "list_alt", hasDateFilter: true, hasVendorFilter: true, screenCode: "reports.ap_aging_details" },
    { id: "vendor-balance-summary", name: "Vendor Balance Summary", category: "payable", description: "Summary of vendor balances", icon: "account_balance_wallet", hasVendorFilter: true, screenCode: "reports.vendor_balance_summary" },
    { id: "vendor-balance-details", name: "Vendor Balance Details", category: "payable", description: "Detailed vendor balance info", icon: "receipt", hasVendorFilter: true, screenCode: "reports.vendor_balance_details" },
    { id: "unpaid-bills-details", name: "Unpaid Bills Details", category: "payable", description: "All unpaid bills", icon: "money_off", hasDateFilter: true, hasVendorFilter: true, screenCode: "reports.unpaid_bills_details" },
    { id: "vendor-phone-list", name: "Vendor Phone List", category: "payable", description: "Vendor contact numbers", icon: "phone", hasVendorFilter: true, screenCode: "reports.vendor_phone_list" },
    { id: "vendor-contact-list", name: "Vendor Contact List", category: "payable", description: "Full vendor contact info", icon: "contacts", hasVendorFilter: true, screenCode: "reports.vendor_contact_list" },
    { id: "receive-item-summary", name: "Receive Item Summary", category: "payable", description: "Summary of received items", icon: "inventory_2", hasDateFilter: true, hasVendorFilter: true, screenCode: "reports.receive_item_summary" },
    { id: "receive-item-chart", name: "Receive Item Chart", category: "payable", description: "Visual chart of receipts", icon: "bar_chart", hasDateFilter: true, hasVendorFilter: true, screenCode: "reports.receive_item_chart" },
    { id: "item-sales-received", name: "Item Sales And Received Report", category: "payable", description: "Sales vs received comparison", icon: "compare_arrows", hasDateFilter: true, hasVendorFilter: true, screenCode: "reports.item_sales_received" },

    // Store Reports
    { id: "track-inventory", name: "Track Inventory", category: "store", description: "Track inventory movements", icon: "track_changes", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.track_inventory" },
    { id: "track-sales", name: "Track Sales", category: "store", description: "Track sales across stores", icon: "point_of_sale", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.track_sales" },
    { id: "transfer-list", name: "Transfer List", category: "store", description: "List of all transfers", icon: "swap_horiz", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.transfer_list" },
    { id: "transfer-detail", name: "Transfer Detail", category: "store", description: "Detailed transfer information", icon: "info", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.transfer_detail" },
    { id: "transfer-detail-department", name: "Transfer Detail Department", category: "store", description: "Transfers by department", icon: "category", hasDateFilter: true, hasStoreFilter: true, hasDepartmentFilter: true, screenCode: "reports.transfer_detail_department" },
    { id: "store-transfer", name: "Store Transfer", category: "store", description: "Store to store transfers", icon: "store", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.store_transfer" },
    { id: "sales-by-associate", name: "Sales By Associate", category: "store", description: "Sales grouped by employee", icon: "badge", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.sales_by_associate" },
    { id: "sales-by-store", name: "Sales By Store", category: "store", description: "Sales per store location", icon: "storefront", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.sales_by_store" },
    { id: "transfer-value", name: "Transfer Value", category: "store", description: "Value of transfers", icon: "attach_money", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.transfer_value" },
    { id: "requested-items", name: "Requested Items", category: "store", description: "Items requested for transfer", icon: "request_quote", hasStoreFilter: true, screenCode: "reports.requested_items" },

    // POS Reports
    { id: "shift-report", name: "Shift Report", category: "pos", description: "End of shift summary", icon: "access_time", hasDateFilter: true, hasStoreFilter: false, screenCode: "reports.shift_report" },
    { id: "batch-report", name: "Batch Report", category: "pos", description: "Batch processing report", icon: "batch_prediction", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.batch_report" },
    { id: "tender-totals", name: "Tender Totals", category: "pos", description: "Totals by tender type", icon: "payments", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.tender_totals" },
    { id: "tender-totals-by-station", name: "Tender Totals By Station", category: "pos", description: "Tender totals per station", icon: "computer", hasDateFilter: true, hasStoreFilter: true, hasStationFilter: true, screenCode: "reports.tender_totals_by_station" },
    { id: "action-summary", name: "Action Summary", category: "pos", description: "Summary of POS actions", icon: "summarize", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.action_summary" },
    { id: "action-details", name: "Action Details", category: "pos", description: "Detailed POS actions", icon: "list", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.action_details" },
    { id: "summary-reports", name: "Summary Report", category: "pos", description: "Sales summary by store and date", icon: "summarize", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.summary_reports" },
    { id: "on-account-sales", name: "On Account Sales", category: "pos", description: "Sales on customer accounts", icon: "account_balance", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.on_account_sales" },
    { id: "on-account-payments", name: "On Account Payments", category: "pos", description: "Payments on accounts", icon: "payment", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.on_account_payments" },
    { id: "on-account-aut-report", name: "On Account Aut. Report", category: "pos", description: "Account authorization report", icon: "verified_user", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.on_account_aut_report" },
    { id: "daily-hour-sales", name: "Daily Hour Sales", category: "pos", description: "Sales by hour of day", icon: "schedule", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.daily_hour_sales" },
    { id: "register-log-report", name: "Register Log Report", category: "pos", description: "Register activity log", icon: "article", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.register_log_report" },
    { id: "payout-report", name: "Payout Report", category: "pos", description: "Cash payouts from register", icon: "money", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.payout_report" },
    { id: "checks-cashed", name: "Checks Cashed", category: "pos", description: "Check cashing transactions", icon: "fact_check", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.checks_cashed" },
    { id: "sales-by-tender", name: "Sales By Tender", category: "pos", description: "Sales grouped by payment type", icon: "credit_card", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.sales_by_tender" },

    // Sales Reports
    { id: "best-worst-sellers", name: "Best & Worst Sellers", category: "sales", description: "Top and bottom selling items", icon: "trending_up", hasDateFilter: true, hasStoreFilter: true, hasDepartmentFilter: true, screenCode: "reports.best_worst_sellers" },
    { id: "item-daily-sales", name: "Item Daily Sales", category: "sales", description: "Daily sales by item", icon: "today", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.item_daily_sales" },
    { id: "item-weekly-sales", name: "Item Weekly Sales", category: "sales", description: "Weekly sales by item", icon: "view_week", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.item_weekly_sales" },
    { id: "item-monthly-sales", name: "Item Monthly Sales", category: "sales", description: "Monthly sales by item", icon: "date_range", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.item_monthly_sales" },
    { id: "department-daily-sales", name: "Department Daily Sales", category: "sales", description: "Daily sales by department", icon: "today", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.department_daily_sales" },
    { id: "department-weekly-sales", name: "Department Weekly Sales", category: "sales", description: "Weekly sales by department", icon: "view_week", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.department_weekly_sales" },
    { id: "department-monthly-sales", name: "Department Monthly Sales", category: "sales", description: "Monthly sales by department", icon: "date_range", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.department_monthly_sales" },
    { id: "total-daily-sales", name: "Total Daily Sales", category: "sales", description: "Total sales by day", icon: "today", hasDateFilter: true, hasStoreFilter: true, hasDepartmentFilter: true, screenCode: "reports.total_daily_sales" },
    { id: "total-weekly-sales", name: "Total Weekly Sales", category: "sales", description: "Total sales by week", icon: "view_week", hasDateFilter: true, hasStoreFilter: true, hasDepartmentFilter: true, screenCode: "reports.total_weekly_sales" },
    { id: "total-monthly-sales", name: "Total Monthly Sale", category: "sales", description: "Total sales by month", icon: "date_range", hasDateFilter: true, hasStoreFilter: true, hasDepartmentFilter: true, screenCode: "reports.total_monthly_sales" },
    // (Summary Reports lives in the POS Reports section above — duplicate entry removed here.)
    { id: "sales-summary-by-transaction", name: "Sales Summary By Transaction", category: "sales", description: "Sales summary by transaction", icon: "receipt_long", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.sales_summary_by_transaction" },
    { id: "sales-summary-by-item", name: "Sales Summary By Item", category: "sales", description: "Sales summary by item", icon: "inventory_2", hasDateFilter: true, hasStoreFilter: true, hasCustomerFilter: true, hasItemFilter: true, screenCode: "reports.sales_summary_by_item" },
    { id: "sales-summary-by-department", name: "Sales Summary By Department", category: "sales", description: "Sales summary by department", icon: "category", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.sales_summary_by_department" },
    { id: "sales-summary-by-discount", name: "Sales Summary By Discount", category: "sales", description: "Sales summary by discount", icon: "local_offer", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.sales_summary_by_discount" },
    { id: "sales-summary-by-specials", name: "Sales Summary By Specials", category: "sales", description: "Sales summary by specials", icon: "sell", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.sales_summary_by_specials" },
    { id: "gross-profit", name: "Gross Profit", category: "sales", description: "Gross profit analysis", icon: "trending_up", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.gross_profit" },
    { id: "sales-average-by-item", name: "Sales Average By Item", category: "sales", description: "Average sales per item", icon: "analytics", hasDateFilter: true, hasItemFilter: true, screenCode: "reports.sales_average_by_item" },
    { id: "date-comparison", name: "Date Comparison", category: "sales", description: "Compare sales between dates", icon: "compare", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.date_comparison" },
    { id: "sales-average-by-day", name: "Sales Average By Day", category: "sales", description: "Daily sales averages", icon: "today", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.sales_average_by_day" },
    { id: "inventory-with-sale", name: "Inventory With Sale", category: "sales", description: "Inventory items with sales data", icon: "inventory", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.inventory_with_sale" },
    { id: "gift-card", name: "Gift Card", category: "sales", description: "Gift card transactions", icon: "card_giftcard", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.gift_card" },
    { id: "inventory-sales", name: "Inventory Sales", category: "sales", description: "Sales from inventory", icon: "sell", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.inventory_sales" },
    { id: "inventory-summary", name: "Inventory Summary", category: "sales", description: "Inventory sales summary", icon: "assessment", hasDateFilter: true, hasStoreFilter: true, screenCode: "reports.inventory_summary" },
    { id: "vendor-profit-report", name: "Vendor Profit Report", category: "sales", description: "Profit by vendor", icon: "business", hasDateFilter: true, hasVendorFilter: true, screenCode: "reports.vendor_profit_report" },

    // Schedule Reports
    { id: "scheduled-reports", name: "Scheduled Reports", category: "schedule", description: "View scheduled report jobs", icon: "schedule_send", screenCode: "reports.scheduled_reports" },
    { id: "report-history", name: "Report History", category: "schedule", description: "History of generated reports", icon: "history", hasDateFilter: true, screenCode: "reports.report_history" },
]

// Reports that are fully implemented — all others show as "Coming Soon"
const enabledReportIds = new Set([
  // Inventory
  "tax-collected",
  "tax-by-store",
  // POS
  "shift-report",
  "tender-totals",
  "on-account-sales",
  "on-account-payments",
  "daily-hour-sales",
  "action-summary",
  "action-details",
  "summary-reports",
  // Sales
  "sales-summary-by-transaction",
  "sales-summary-by-item",
  "sales-summary-by-department",
  "sales-summary-by-discount",
  "sales-summary-by-specials",
  "date-comparison",
  "monthly-weekly-daily",
  // Monthly/Weekly/Daily sub-reports (all enabled)
  "item-daily-sales",
  "item-weekly-sales",
  "item-monthly-sales",
  "department-daily-sales",
  "department-weekly-sales",
  "department-monthly-sales",
  "total-daily-sales",
  "total-weekly-sales",
  "total-monthly-sales",
])

// Hoist the coming-soon flag onto the ReportDefinition objects themselves so
// the drawer / filter predicate can read `report.comingSoon` directly.
// `enabledReportIds` remains the single source of truth; this just mirrors it.
for (const r of allReports) {
    if (!enabledReportIds.has(r.id)) {
        r.comingSoon = true
    }
}

const categoryInfo: Record<ReportCategory, { name: string; color: string; bgColor: string; icon: string }> = {
    inventory: { name: "Inventory Reports", color: "text-brand-500", bgColor: "bg-brand-50 dark:bg-brand-900/30", icon: "inventory_2" },
    customer: { name: "Customer Reports", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30", icon: "people" },
    payable: { name: "Payable Reports", color: "text-orange-600", bgColor: "bg-orange-100 dark:bg-orange-900/30", icon: "account_balance_wallet" },
    store: { name: "Store Reports", color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30", icon: "store" },
    pos: { name: "POS Reports", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30", icon: "point_of_sale" },
    sales: { name: "Sales Reports", color: "text-teal-600", bgColor: "bg-teal-100 dark:bg-teal-900/30", icon: "trending_up" },
    schedule: { name: "Schedule Reports", color: "text-gray-600", bgColor: "bg-gray-100 dark:bg-gray-700", icon: "schedule" },
}

interface ReportFilters {
    dateFrom?: string
    dateTo?: string
    /** Single as-of date (for reports that use hasAsOfDateFilter) */
    asOfDate?: string
    storeId?: string
    storeName?: string
    stationId?: string
    customerId?: string
    vendorId?: string
    itemId?: string
    departmentId?: string
    brandId?: string
    brandName?: string
    filterPartial?: boolean
    filterClosed?: boolean
    /** Optional sort metadata applied by Custom Date Scope presets. */
    sortColumn?: string
    sortDirection?: string
}

interface LookupItem {
    id: string
    name: string
    code?: string
}

// Searchable Select Component
interface SearchableSelectProps {
    label: string
    value: string
    onChange: (value: string) => void
    options: LookupItem[]
    loading?: boolean
    placeholder?: string
    allLabel?: string
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    label,
    value,
    onChange,
    options,
    loading,
    placeholder = "Type to search...",
    allLabel = "All"
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [searchText, setSearchText] = useState("")
    // The dropdown is rendered with position:fixed and absolute pixel
    // coordinates so it escapes the modal's `overflow-hidden` stacking
    // context. Direction + dimensions are recomputed on every open.
    // Start hidden so the popover can never paint at its natural document
    // position before the layout effect computes the real coordinates.
    // The effect sets visibility to "visible" alongside the position values.
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({
        position: "fixed",
        visibility: "hidden",
    })
    const containerRef = useRef<HTMLDivElement>(null)
    // Anchor for the popover positioning. Points to the trigger button/input
    // (NOT the outer wrapper that includes the label) so the dropdown opens
    // flush with the input rather than offset by the label height.
    const triggerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const filteredOptions = useMemo(() => {
        if (!searchText) return options
        const lower = searchText.toLowerCase()
        return options.filter(opt =>
            opt.name.toLowerCase().includes(lower) ||
            (opt.code && opt.code.toLowerCase().includes(lower))
        )
    }, [options, searchText])

    const selectedOption = options.find(opt => opt.id === value)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
                setSearchText("")
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // useLayoutEffect runs synchronously AFTER DOM mutations but BEFORE the
    // browser paints, so the dropdown's computed position is applied before
    // the user ever sees the popover. Using a regular useEffect here would
    // cause the dropdown to flash at its natural DOM position on first open
    // (overlapping the trigger) before the position-fixed style kicks in.
    //
    // ORDER MATTERS: we MUST measure the trigger BEFORE calling focus().
    // Focusing the search input causes the browser to scrollIntoView the
    // input on first open, which shifts the trigger's position — measuring
    // after focus would capture the post-scroll rect, leading the dropdown
    // to render against where the trigger USED to be. We also pass
    // `preventScroll: true` to focus() so it doesn't shift layout at all.
    React.useLayoutEffect(() => {
        if (!isOpen) {
            // Reset to hidden so a future open paints invisible until the
            // next layout calc completes — same protection as the initial mount.
            setPopoverStyle({ position: "fixed", visibility: "hidden" })
            return
        }
        // Compute viewport-relative coordinates for the dropdown. Using
        // position:fixed lets the popover escape the modal's overflow:hidden
        // clipping AND stay above the modal header regardless of z-index
        // stacking. Recomputed each time the dropdown opens.
        // We anchor on the trigger element (the input/button), NOT the outer
        // wrapper, so the dropdown sits flush with the input.
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect()

            // Walk up the ancestor chain looking for the nearest scroll
            // container — its bounds (e.g. the modal body) are the true
            // vertical limits the dropdown should respect.
            let topBound = 8 // 8px viewport breathing room
            let bottomBound = window.innerHeight - 8
            let node: HTMLElement | null = triggerRef.current.parentElement
            while (node) {
                const style = window.getComputedStyle(node)
                const overflowY = style.overflowY
                if (overflowY === "auto" || overflowY === "scroll" || overflowY === "hidden") {
                    const r = node.getBoundingClientRect()
                    topBound = Math.max(topBound, r.top + 8)
                    bottomBound = Math.min(bottomBound, r.bottom - 8)
                    break
                }
                node = node.parentElement
            }

            const spaceBelow = bottomBound - rect.bottom - 4 // 4px gap from trigger
            const spaceAbove = rect.top - topBound - 4
            const preferredHeight = 320
            const willDropUp = spaceBelow < preferredHeight && spaceAbove > spaceBelow
            const maxListHeight = Math.max(160, Math.min(preferredHeight, willDropUp ? spaceAbove : spaceBelow))

            // Build the position style. The dropdown is fixed-positioned so
            // these are viewport coordinates, not parent-relative.
            setPopoverStyle({
                position: "fixed",
                visibility: "visible",
                left: rect.left,
                width: rect.width,
                maxHeight: maxListHeight,
                ...(willDropUp
                    ? { bottom: window.innerHeight - rect.top + 4 }
                    : { top: rect.bottom + 4 }),
                zIndex: 9999,
            })
        }
        // Focus the search input AFTER position is computed and with
        // preventScroll so it can't shift the modal body layout under us.
        if (inputRef.current) {
            inputRef.current.focus({ preventScroll: true })
        }
    }, [isOpen])

    const handleSelect = (id: string) => {
        onChange(id)
        setIsOpen(false)
        setSearchText("")
    }

    return (
        <div ref={containerRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {label}
            </label>

            {/* Main Select Button / Search Input */}
            <div
                ref={triggerRef}
                className={`relative w-full border rounded-lg transition-all duration-200 ${isOpen
                        ? "border-brand-500 ring-2 ring-brand-500/20 bg-white dark:bg-gray-700"
                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                    }`}
            >
                {isOpen ? (
                    <div className="flex items-center">
                        <svg className="w-4 h-4 text-gray-400 ml-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder={placeholder}
                            className="w-full px-3 py-2.5 text-sm bg-transparent text-gray-900 dark:text-white focus:outline-none"
                        />
                        {searchText && (
                            <button
                                type="button"
                                onClick={() => setSearchText("")}
                                className="p-1 mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        className="w-full px-3 py-2.5 text-sm text-left flex items-center justify-between"
                    >
                        <span className={`truncate ${selectedOption ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}>
                            {selectedOption ? (
                                <span className="flex items-center gap-2">
                                    {selectedOption.code && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                                            {selectedOption.code}
                                        </span>
                                    )}
                                    {selectedOption.name}
                                </span>
                            ) : allLabel}
                        </span>
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Dropdown — rendered with position:fixed so it escapes the
                modal's overflow:hidden boundary and ALWAYS sits above the
                modal header. Coordinates computed in the open-effect above. */}
            {isOpen && (
                <div
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden flex flex-col"
                    style={popoverStyle}
                >
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-500 border-t-transparent"></div>
                            <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">Loading...</span>
                        </div>
                    ) : (
                        <div className="overflow-y-auto flex-1 min-h-0">
                            {/* All Option */}
                            <button
                                type="button"
                                onClick={() => handleSelect("")}
                                className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${!value
                                        ? "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300"
                                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                    }`}
                            >
                                <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${!value ? 'border-brand-500 bg-brand-500' : 'border-gray-300 dark:border-gray-600'}">
                                    {!value && (
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </span>
                                <span className="font-medium">{allLabel}</span>
                            </button>

                            {/* Divider */}
                            <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>

                            {/* Options */}
                            {filteredOptions.length === 0 ? (
                                <div className="px-4 py-8 text-center">
                                    <svg className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">No results found</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try a different search term</p>
                                </div>
                            ) : (
                                filteredOptions.map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => handleSelect(opt.id)}
                                        className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${value === opt.id
                                                ? "bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300"
                                                : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                            }`}
                                    >
                                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${value === opt.id ? 'border-brand-500 bg-brand-500' : 'border-gray-300 dark:border-gray-600'}`}>
                                            {value === opt.id && (
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                {opt.code && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 flex-shrink-0">
                                                        {opt.code}
                                                    </span>
                                                )}
                                                <span className="truncate">{opt.name}</span>
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}

                    {/* Footer with count */}
                    {!loading && filteredOptions.length > 0 && (
                        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {searchText ? `${filteredOptions.length} of ${options.length} results` : `${options.length} items`}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

interface FilterModalProps {
    report: ReportDefinition | null
    isOpen: boolean
    onClose: () => void
    onRunReport: (filters: ReportFilters) => void
}

const FilterModal: React.FC<FilterModalProps> = ({ report, isOpen, onClose, onRunReport }) => {
    const { openTab } = useDashboardTabs()
    const { permissions: filterModalPerms } = useAppSelector((state) => state.effectivePermission)
    const filterModalPermSet = useMemo(() => new Set(filterModalPerms || []), [filterModalPerms])
    const canViewCustomScopes = filterModalPermSet.has("reports.setup.custom_date_scope.view")

    // Custom Date Scope dropdown state — populated lazily on first open.
    const [scopesOpen, setScopesOpen] = useState(false)
    const [scopes, setScopes] = useState<CustomDateScope[] | null>(null)
    const [scopesLoading, setScopesLoading] = useState(false)
    const moreChipRef = useRef<HTMLDivElement | null>(null)
    const moreMenuRef = useRef<HTMLDivElement | null>(null)
    // Viewport-fixed position for the More dropdown. We render it via a
    // portal into document.body and pick `openUp` based on which side has
    // more room — that way the panel never collides with the FilterModal
    // header (the original `bottom-full` Tailwind only flipped the panel
    // upward unconditionally and clipped under the modal title bar).
    const [scopesMenuPos, setScopesMenuPos] = useState<{
        top: number
        left: number
        width: number
        maxHeight: number
        openUp: boolean
    } | null>(null)

    // Recompute the dropdown's anchor relative to the chip every time it
    // opens. Re-run on window resize while open so the panel doesn't drift
    // out of place when the user resizes the browser.
    useEffect(() => {
        if (!scopesOpen) {
            setScopesMenuPos(null)
            return
        }
        const compute = () => {
            const el = moreChipRef.current
            if (!el) return
            const rect = el.getBoundingClientRect()
            const PAD = 12 // gap from viewport edge / chip
            const MENU_W = 256 // matches w-64 below
            // Fixed panel height — body scrolls internally when the list of
            // saved scopes exceeds it. The only time we shrink below 300px
            // is when the viewport itself can't fit it (small windows).
            const FIXED_H = 300
            const spaceBelow = window.innerHeight - rect.bottom - PAD
            const spaceAbove = rect.top - PAD
            const openUp = spaceBelow < FIXED_H && spaceAbove > spaceBelow
            const available = openUp ? spaceAbove : spaceBelow
            const maxHeight = Math.min(FIXED_H, Math.max(180, available))
            // Right-align with the chip so the dropdown sits under / above
            // the chip's right edge — same visual as the previous
            // `right-0` Tailwind anchor.
            const left = Math.max(PAD, Math.min(window.innerWidth - MENU_W - PAD, rect.right - MENU_W))
            const top = openUp ? rect.top - 4 : rect.bottom + 4
            setScopesMenuPos({ top, left, width: MENU_W, maxHeight, openUp })
        }
        compute()
        window.addEventListener("resize", compute)
        window.addEventListener("scroll", compute, true)
        return () => {
            window.removeEventListener("resize", compute)
            window.removeEventListener("scroll", compute, true)
        }
    }, [scopesOpen])

    // Click-outside to close. Both the chip and the portal-rendered menu
    // count as "inside" so clicking either keeps it open.
    useEffect(() => {
        if (!scopesOpen) return
        const onDocMouseDown = (e: MouseEvent) => {
            const target = e.target as Node
            if (moreChipRef.current?.contains(target)) return
            if (moreMenuRef.current?.contains(target)) return
            setScopesOpen(false)
        }
        document.addEventListener("mousedown", onDocMouseDown)
        return () => document.removeEventListener("mousedown", onDocMouseDown)
    }, [scopesOpen])

    const [filters, setFilters] = useState<ReportFilters>({
        dateFrom: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
    })

    const [stores, setStores] = useState<LookupItem[]>([])
    const [customers, setCustomers] = useState<LookupItem[]>([])
    const [vendors, setVendors] = useState<LookupItem[]>([])
    const [departments, setDepartments] = useState<LookupItem[]>([])
    const [brands, setBrands] = useState<LookupItem[]>([])
    const [loadingStores, setLoadingStores] = useState(false)
    const [stations, setStations] = useState<LookupItem[]>([])
    const [loadingStations, setLoadingStations] = useState(false)
    const [loadingCustomers, setLoadingCustomers] = useState(false)
    const [loadingVendors, setLoadingVendors] = useState(false)
    const [loadingDepartments, setLoadingDepartments] = useState(false)
    const [loadingBrands, setLoadingBrands] = useState(false)

    // Helper to get auth headers
    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem("accessToken")
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
        }

        // Add CustomerId header from localStorage
        const userData = localStorage.getItem("userData")
        if (userData) {
            try {
                const parsedUserData = JSON.parse(userData)
                if (parsedUserData.customerId) {
                    headers["CustomerId"] = parsedUserData.customerId.toString()
                }
            } catch (error) {
                console.error("Error parsing user data:", error)
            }
        }

        return headers
    }, [])

    // Helper to get localUserId from userData
    const getLocalUserId = useCallback(() => {
        const userData = localStorage.getItem("userData")
        if (userData) {
            try {
                const parsed = JSON.parse(userData)
                return parsed.localUserId || ""
            } catch {
                return ""
            }
        }
        return ""
    }, [])

    // Fetch lookup data when modal opens
    useEffect(() => {
        if (!isOpen || !report) return

        const headers = getAuthHeaders()

        // Fetch stores if needed
        if (report.hasStoreFilter && stores.length === 0) {
            setLoadingStores(true)
            const userId = getLocalUserId()
            if (!userId) {
                setLoadingStores(false)
                console.warn("No localUserId found for stores fetch")
            } else {
                fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${userId}`, { headers })
                    .then(res => res.json())
                    .then(data => {
                        if (data.isSuccess && data.response) {
                            setStores(data.response.map((s: any) => ({
                                id: s.storeID,
                                name: s.storeName,
                                code: s.storeNo?.toString()
                            })))
                        }
                    })
                    .catch(console.error)
                    .finally(() => setLoadingStores(false))
            }
        }

        // Fetch customers if needed
        if (report.hasCustomerFilter && customers.length === 0) {
            setLoadingCustomers(true)
            fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_CUSTOMERS_LOOKUP, { headers })
                .then(res => res.json())
                .then(data => {
                    if (data.isSuccess && data.response) {
                        setCustomers(data.response.map((c: any) => ({
                            id: c.customerID,
                            name: c.name,
                            code: c.customerNo
                        })))
                    }
                })
                .catch(console.error)
                .finally(() => setLoadingCustomers(false))
        }

        if (report.hasVendorFilter && vendors.length === 0) {
            setLoadingVendors(true)
            fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_SUPPLIERS_LOOKUP, { headers })
                .then(res => res.json())
                .then((data: any) => {
                    const ok = data?.isSuccess === true || data?.IsSuccess === true
                    const list = data?.response ?? data?.Response
                    if (ok && Array.isArray(list)) {
                        const mapped = list.map((s: any) => {
                            const rawId = s.SupplierID ?? s.supplierID ?? s.supplierId ?? s.id
                            const id = rawId != null ? String(rawId).trim() : ""
                            const name = (s.Name ?? s.name ?? "").trim()
                            const code = (s.SupplierNo ?? s.supplierNo ?? s.code ?? "").trim()
                            return { id, name, code }
                        }).filter((x: LookupItem) => x.id !== "" && x.name !== "")
                        mapped.sort((a: LookupItem, b: LookupItem) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }))
                        setVendors(mapped)
                    }
                })
                .catch(console.error)
                .finally(() => setLoadingVendors(false))
        }

        // Fetch departments if needed
        if (report.hasDepartmentFilter && departments.length === 0) {
            setLoadingDepartments(true)
            fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_DEPARTMENTS, { headers })
                .then(res => res.json())
                .then(data => {
                    if (data.isSuccess && data.response) {
                        setDepartments(data.response.map((d: any) => ({
                            id: d.departmentStoreID,
                            name: d.name
                        })))
                    }
                })
                .catch(console.error)
                .finally(() => setLoadingDepartments(false))
        }

        if (report.hasBrandFilter && brands.length === 0) {
            setLoadingBrands(true)
            fetch(API_ENDPOINTS.MANUFACTURERS.GET_ALL, { headers })
                .then(res => res.json())
                .then((data: any) => {
                    const ok = data?.isSuccess === true || data?.IsSuccess === true
                    const list = data?.response ?? data?.Response ?? data?.data
                    if (ok && Array.isArray(list)) {
                        const mapped = list.map((b: any) => {
                            const rawId = b.ManufacturerID ?? b.manufacturerID ?? b.manufacturerId ?? b.id
                            const id = rawId != null ? String(rawId).trim() : ""
                            const name = (b.ManufacturerName ?? b.manufacturerName ?? b.name ?? "").trim()
                            return { id, name }
                        }).filter((x: LookupItem) => x.id !== "" && x.name !== "")
                        mapped.sort((a: LookupItem, b: LookupItem) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }))
                        setBrands(mapped)
                    }
                })
                .catch(console.error)
                .finally(() => setLoadingBrands(false))
        }

        // Fetch stations (registers) for Tender Totals By Station report, and refresh when store changes
        if (report.hasStationFilter) {
            setLoadingStations(true)
            const params = new URLSearchParams({
                startRow: "0",
                endRow: "1000",
                sortColumn: "registerNo",
                sortDirection: "asc",
            })
            if (filters.storeId) {
                params.append("storeId", filters.storeId)
            }

            fetch(`${API_ENDPOINTS.REGISTERS.GET_ALL}?${params.toString()}`, { headers })
                .then(res => res.json())
                .then((data: any) => {
                    const ok = data?.isSuccess ?? data?.IsSuccess
                    const payload = data?.response ?? data?.Response
                    const rows: any[] = ok && payload?.data ? payload.data : []
                    const seen = new Set<string>()
                    const items: LookupItem[] = []
                    rows.forEach((r: any) => {
                        const raw = r?.registerNo ?? r?.RegisterNo ?? ""
                        const id = String(raw ?? "").trim()
                        if (!id || seen.has(id)) return
                        seen.add(id)
                        items.push({ id, name: id })
                    })
                    setStations(items)
                })
                .catch((err) => {
                    console.error("Failed to load stations for Report Manager", err)
                    setStations([])
                })
                .finally(() => setLoadingStations(false))
        }
    }, [isOpen, report, stores.length, customers.length, vendors.length, departments.length, brands.length, stations.length, filters.storeId, getAuthHeaders, getLocalUserId])

    useEffect(() => {
        if (isOpen && report?.hasPartialClosedFilter) {
            setFilters(prev => (prev.filterPartial === undefined && prev.filterClosed === undefined
                ? { ...prev, filterPartial: true, filterClosed: false }
                : prev))
        }
    }, [isOpen, report?.id, report?.hasPartialClosedFilter])

    // Default as-of date to today when opening a report that uses it
    useEffect(() => {
        if (isOpen && report?.hasAsOfDateFilter) {
            setFilters(prev => ({ ...prev, asOfDate: prev.asOfDate || new Date().toISOString().split("T")[0] }))
        }
    }, [isOpen, report?.id, report?.hasAsOfDateFilter])

    if (!isOpen || !report) return null

    const handleRunReport = () => {
        // Normalize filters before running the report:
        // - When "All Stores" is selected, storeId should be treated as null/undefined.
        const cleaned: ReportFilters = { ...filters }
        if (!cleaned.storeId || cleaned.storeId.trim() === "") {
            delete cleaned.storeId
            delete cleaned.storeName
        }

        onRunReport(cleaned)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden
            />

            {/* Modal - wider, scrollable when many filters */}
            <div className="relative flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-brand-500 to-brand-600">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-white truncate">{report.name}</h3>
                            <p className="text-sm text-white/90 mt-0.5 line-clamp-2">{report.description}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-shrink-0 p-2 rounded-lg hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                            aria-label="Close"
                        >
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Body - scrollable */}
                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
                    {/* Date Range Filter */}
                    {report.hasDateFilter && (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Date Range
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
                                    <div className="flatpickr-wrapper relative">
                                        <Flatpickr
                                            value={filters.dateFrom ?? ""}
                                            onChange={([d]) => {
                                                const fromStr = d ? d.toISOString().split("T")[0] : filters.dateFrom
                                                const toStr = filters.dateTo
                                                const to = toStr && fromStr && toStr < fromStr ? fromStr : toStr
                                                setFilters({ ...filters, dateFrom: fromStr, dateTo: to ?? fromStr })
                                            }}
                                            options={{ dateFormat: "Y-m-d", allowInput: true }}
                                            placeholder="Select from date"
                                            className="w-full px-3 py-2 pl-9 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                                        />
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
                                    <div className="flatpickr-wrapper relative">
                                        <Flatpickr
                                            value={filters.dateTo ?? ""}
                                            onChange={([d]) => {
                                                const toStr = d ? d.toISOString().split("T")[0] : filters.dateTo
                                                const fromStr = filters.dateFrom
                                                const to = fromStr && toStr && toStr < fromStr ? fromStr : toStr
                                                setFilters({ ...filters, dateTo: to ?? fromStr })
                                            }}
                                            options={{ dateFormat: "Y-m-d", allowInput: true }}
                                            placeholder="Select to date (must be ≥ From)"
                                            className="w-full px-3 py-2 pl-9 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                                        />
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {/* Quick date selections — each option computes its own
                                (from, to) pair so we can mix rolling-window presets
                                (Today, Last 7/30/90) with calendar-aware presets
                                (Yesterday, Last Week). */}
                            <div className="flex flex-wrap gap-2">
                                {([
                                    {
                                        label: "Today",
                                        compute: () => {
                                            const now = new Date()
                                            return { from: now, to: now }
                                        },
                                    },
                                    {
                                        label: "Yesterday",
                                        compute: () => {
                                            const y = new Date()
                                            y.setDate(y.getDate() - 1)
                                            return { from: y, to: y }
                                        },
                                    },
                                    {
                                        label: "Last 7 Days",
                                        compute: () => {
                                            const to = new Date()
                                            const from = new Date()
                                            from.setDate(from.getDate() - 7)
                                            return { from, to }
                                        },
                                    },
                                    {
                                        label: "Last Week",
                                        // Previous Monday → previous Sunday (ISO week).
                                        compute: () => {
                                            const now = new Date()
                                            const day = now.getDay() // 0 = Sun, 1 = Mon, …
                                            const daysSinceMonday = (day + 6) % 7 // Mon → 0, Sun → 6
                                            const lastSunday = new Date(now)
                                            lastSunday.setDate(now.getDate() - daysSinceMonday - 1)
                                            const lastMonday = new Date(lastSunday)
                                            lastMonday.setDate(lastSunday.getDate() - 6)
                                            return { from: lastMonday, to: lastSunday }
                                        },
                                    },
                                    {
                                        label: "Last 30 Days",
                                        compute: () => {
                                            const to = new Date()
                                            const from = new Date()
                                            from.setDate(from.getDate() - 30)
                                            return { from, to }
                                        },
                                    },
                                    {
                                        label: "Last 90 Days",
                                        compute: () => {
                                            const to = new Date()
                                            const from = new Date()
                                            from.setDate(from.getDate() - 90)
                                            return { from, to }
                                        },
                                    },
                                    {
                                        label: "This Year",
                                        compute: () => {
                                            const to = new Date()
                                            const from = new Date()
                                            from.setDate(from.getDate() - 365)
                                            return { from, to }
                                        },
                                    },
                                ] as { label: string; compute: () => { from: Date; to: Date } }[]).map((option) => (
                                    <button
                                        key={option.label}
                                        onClick={() => {
                                            const { from, to } = option.compute()
                                            setFilters({
                                                ...filters,
                                                dateFrom: from.toISOString().split('T')[0],
                                                dateTo: to.toISOString().split('T')[0],
                                            })
                                        }}
                                        className="px-3 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-brand-100 hover:text-brand-600 dark:hover:bg-brand-900/30 transition-colors"
                                    >
                                        {option.label}
                                    </button>
                                ))}

                                {/* "More ▾" — opens the saved Custom Date Scope picker.
                                    Default: rendered for every date-filtered report. Set
                                    `usesCustomDateScopes: false` on a ReportDefinition to
                                    opt OUT (none today). */}
                                {report.usesCustomDateScopes !== false && (
                                    <div ref={moreChipRef} className="relative inline-block">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!scopesOpen && scopes === null) {
                                                    setScopesLoading(true)
                                                    customDateScopeService.getActive()
                                                        .then((res) => {
                                                            if (res.data.isSuccess) setScopes(res.data.response)
                                                            else setScopes([])
                                                        })
                                                        .catch(() => setScopes([]))
                                                        .finally(() => setScopesLoading(false))
                                                }
                                                setScopesOpen((p) => !p)
                                            }}
                                            className="px-3 py-1 text-xs rounded-full border border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors inline-flex items-center gap-1"
                                        >
                                            More
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <polyline points="6 9 12 15 18 9" />
                                            </svg>
                                        </button>

                                        {scopesOpen && scopesMenuPos && createPortal(
                                            // Portal-rendered, viewport-fixed panel. Positioned by
                                            // the effect above based on the chip's bounding rect:
                                            //   - opens DOWN by default
                                            //   - opens UP only when there's not enough room below
                                            //     and there's more room above
                                            //   - max-height clamped to available space so the panel
                                            //     never overlaps the modal header or bleeds past the
                                            //     viewport edge
                                            // Rendering into document.body sidesteps the
                                            // FilterModal's `overflow` clipping that was hiding
                                            // the previous absolute-positioned dropdown under the
                                            // modal title bar.
                                            <div
                                                ref={moreMenuRef}
                                                style={{
                                                    position: "fixed",
                                                    top: scopesMenuPos.openUp ? undefined : scopesMenuPos.top,
                                                    bottom: scopesMenuPos.openUp
                                                        ? window.innerHeight - scopesMenuPos.top
                                                        : undefined,
                                                    left: scopesMenuPos.left,
                                                    width: scopesMenuPos.width,
                                                    maxHeight: scopesMenuPos.maxHeight,
                                                    zIndex: 1000,
                                                }}
                                                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl flex flex-col overflow-hidden"
                                            >
                                                <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                                                    Saved date scopes
                                                </div>
                                                <div className="flex-1 overflow-y-auto">
                                                    {scopesLoading && (
                                                        <div className="px-3 py-3 text-xs text-gray-500">Loading…</div>
                                                    )}
                                                    {!scopesLoading && scopes && scopes.length === 0 && (
                                                        <div className="px-3 py-3 text-xs text-gray-500">
                                                            No custom scopes yet
                                                            {canViewCustomScopes && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setScopesOpen(false)
                                                                        openTab({
                                                                            component: "CustomDateScopeListPage",
                                                                            title: "Custom Date Scope",
                                                                            closable: true,
                                                                        })
                                                                        onClose()
                                                                    }}
                                                                    className="ml-1 text-brand-600 hover:underline"
                                                                >
                                                                    Create one
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                    {!scopesLoading && scopes && scopes.map((s) => (
                                                        <button
                                                            key={s.customDateScopeID}
                                                            type="button"
                                                            onClick={() => {
                                                                setFilters({
                                                                    ...filters,
                                                                    dateFrom: (s.fromDate || "").split("T")[0],
                                                                    dateTo: (s.toDate || "").split("T")[0],
                                                                    sortColumn: s.sortColumn ?? undefined,
                                                                    sortDirection: s.sortDirection ?? undefined,
                                                                })
                                                                setScopesOpen(false)
                                                            }}
                                                            className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-50 dark:border-gray-700/50 last:border-b-0"
                                                        >
                                                            <div className="text-sm text-gray-800 dark:text-gray-100">{s.name}</div>
                                                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                                                {(s.fromDate || "").split("T")[0]} → {(s.toDate || "").split("T")[0]}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                                {canViewCustomScopes && (
                                                    <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2 flex-shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setScopesOpen(false)
                                                                openTab({
                                                                    component: "CustomDateScopeListPage",
                                                                    title: "Custom Date Scope",
                                                                    closable: true,
                                                                })
                                                                onClose()
                                                            }}
                                                            className="text-xs text-brand-600 hover:underline"
                                                        >
                                                            Manage scopes…
                                                        </button>
                                                    </div>
                                                )}
                                            </div>,
                                            document.body,
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* As of date (single date) - e.g. Department Inventory */}
                    {report.hasAsOfDateFilter && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                As of date
                            </label>
                            <div className="flatpickr-wrapper relative">
                                <Flatpickr
                                    value={filters.asOfDate ?? new Date().toISOString().split("T")[0]}
                                    onChange={([d]) => setFilters({ ...filters, asOfDate: d ? d.toISOString().split("T")[0] : filters.asOfDate })}
                                    options={{ dateFormat: "Y-m-d", allowInput: true }}
                                    placeholder="Select date"
                                    className="w-full px-3 py-2 pl-9 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                                />
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Store Filter */}
                    {report.hasStoreFilter && (
                        <SearchableSelect
                            label="Store"
                            value={filters.storeId || ""}
                            onChange={(value) => {
                                const store = value ? stores.find(s => s.id === value) : null
                                setFilters({ ...filters, storeId: value, storeName: store?.name ?? "", stationId: "" })
                            }}
                            options={stores}
                            loading={loadingStores}
                            placeholder="Search stores..."
                            allLabel="All Stores"
                        />
                    )}

                    {/* Station Filter – only for reports that support it (Tender Totals By Station) */}
                    {report.hasStationFilter && (
                        <SearchableSelect
                            label="Station"
                            value={filters.stationId || ""}
                            onChange={(value) => setFilters({ ...filters, stationId: value })}
                            options={stations}
                            loading={loadingStations}
                            placeholder="Search stations..."
                            allLabel="All Stations"
                        />
                    )}

                    {/* Customer Filter */}
                    {report.hasCustomerFilter && (
                        <SearchableSelect
                            label="Customer"
                            value={filters.customerId || ""}
                            onChange={(value) => setFilters({ ...filters, customerId: value })}
                            options={customers}
                            loading={loadingCustomers}
                            placeholder="Search customers..."
                            allLabel="All Customers"
                        />
                    )}

                    {/* Supplier (Vendor) Filter – vendors are suppliers in the API */}
                    {report.hasVendorFilter && (
                        <SearchableSelect
                            label="Supplier"
                            value={filters.vendorId || ""}
                            onChange={(value) => setFilters({ ...filters, vendorId: value })}
                            options={vendors}
                            loading={loadingVendors}
                            placeholder="Search suppliers..."
                            allLabel="All Suppliers"
                        />
                    )}

                    {/* Department Filter */}
                    {report.hasDepartmentFilter && (
                        <SearchableSelect
                            label="Department"
                            value={filters.departmentId || ""}
                            onChange={(value) => setFilters({ ...filters, departmentId: value })}
                            options={departments}
                            loading={loadingDepartments}
                            placeholder="Search departments..."
                            allLabel="All Departments"
                        />
                    )}

                    {/* Brand Filter */}
                    {report.hasBrandFilter && (
                        <SearchableSelect
                            label="Brand"
                            value={filters.brandId || ""}
                            onChange={(value) => {
                                const brand = brands.find((b) => b.id === value)
                                setFilters({ ...filters, brandId: value, brandName: brand?.name ?? "" })
                            }}
                            options={brands}
                            loading={loadingBrands}
                            placeholder="Search brands..."
                            allLabel="All Brands"
                        />
                    )}

                    {/* Partial / Closed (e.g. Items on Purchase Order) */}
                    {report.hasPartialClosedFilter && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">PO Status</label>
                            <div className="flex flex-wrap gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!!filters.filterPartial}
                                        onChange={(e) => {
                                            const checked = e.target.checked
                                            setFilters({ ...filters, filterPartial: checked, filterClosed: checked ? false : filters.filterClosed })
                                        }}
                                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500 bg-white dark:bg-gray-700"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Partial / Open</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={!!filters.filterClosed}
                                        onChange={(e) => {
                                            const checked = e.target.checked
                                            setFilters({ ...filters, filterClosed: checked, filterPartial: checked ? false : filters.filterPartial })
                                        }}
                                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500 bg-white dark:bg-gray-700"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Closed</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Item Filter */}
                    {report.hasItemFilter && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Item
                            </label>
                            <input
                                type="text"
                                placeholder="Search items..."
                                value={filters.itemId || ""}
                                onChange={(e) => setFilters({ ...filters, itemId: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                            />
                        </div>
                    )}

                    {/* No filters message */}
                    {!report.hasDateFilter && !report.hasAsOfDateFilter && !report.hasStoreFilter && !report.hasCustomerFilter &&
                        !report.hasVendorFilter && !report.hasDepartmentFilter && !report.hasBrandFilter && !report.hasItemFilter && !report.hasPartialClosedFilter && (
                            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                                <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <p>This report has no filter options.</p>
                                <p className="text-sm">Click "Run Report" to generate.</p>
                            </div>
                        )}
                </div>

                {/* Footer - fixed at bottom of modal */}
                <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleRunReport}
                        className="px-6 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Run Report
                    </button>
                </div>
            </div>
        </div>
    )
}

/**
 * Pure predicate used by the page memo AND the drawer's live match-count.
 * Kept module-scoped so the drawer can preview the count for pending state
 * without duplicating the logic.
 */
interface ApplyFilterArgs {
    searchText: string
    selectedCategory: string
    selectedFacets: Record<string, string[]>
    showComingSoon: boolean
    showOnlyFavorites: boolean
    favorites: Set<string>
}
function applyReportFilter(reports: ReportDefinition[], args: ApplyFilterArgs): ReportDefinition[] {
    const q = args.searchText.trim().toLowerCase()
    return reports
        .filter((report) => {
            // Search (name + description)
            if (q) {
                const name = report.name.toLowerCase()
                const desc = report.description.toLowerCase()
                if (!name.includes(q) && !desc.includes(q)) return false
            }
            // Category
            if (args.selectedCategory && args.selectedCategory !== "all" && report.category !== args.selectedCategory) {
                return false
            }
            // Coming-soon gate
            if (!args.showComingSoon && report.comingSoon === true) return false
            // Favorites-only
            if (args.showOnlyFavorites && !args.favorites.has(report.id)) return false
            // Generic facets. Only `category` is mapped today; extra keys are
            // reserved for future facets (store/vendor/etc.) — adding a mapping
            // here is a one-liner.
            for (const [facetKey, values] of Object.entries(args.selectedFacets)) {
                if (!values || values.length === 0) continue
                if (facetKey === "category") {
                    if (!values.includes(report.category)) return false
                }
                // TODO(reports-filter): extend facet map when store/date-range
                // facets move into the drawer.
            }
            return true
        })
        .sort((a, b) => {
            // Enabled reports first, coming soon at bottom.
            const aEnabled = a.comingSoon ? 1 : 0
            const bEnabled = b.comingSoon ? 1 : 0
            return aEnabled - bEnabled
        })
}

/** Per-report permission flags derived from the flat permission keys */
interface ReportPermissions {
    canView: boolean
    canPrint: boolean
    canExport: boolean
}

// ---------------------------------------------------------------------------
// Filter drawer
// ---------------------------------------------------------------------------

interface ReportFilterDrawerProps {
    isOpen: boolean
    onClose: () => void
    committedState: {
        searchText: string
        selectedCategory: string
        selectedFacets: Record<string, string[]>
        showComingSoon: boolean
        showOnlyFavorites: boolean
    }
    reports: ReportDefinition[]
    favorites: Set<string>
    onApply: (next: ReportFilterDrawerProps["committedState"]) => void
    onClear: () => void
}

const DRAWER_CATEGORIES: ReportCategory[] = ["inventory", "customer", "payable", "store", "pos", "sales", "schedule"]

const ReportFilterDrawer: React.FC<ReportFilterDrawerProps> = ({
    isOpen,
    onClose,
    committedState,
    reports,
    favorites,
    onApply,
    onClear,
}) => {
    // Pending local copy — starts from committed state each time drawer opens.
    // With live-apply, this mirrors committedState; kept so local UI reflects
    // the most recent interaction synchronously even before parent re-renders.
    const [pending, setPending] = useState(committedState)
    const drawerRef = useRef<HTMLDivElement>(null)
    const firstFocusRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (isOpen) setPending(committedState)
        // Intentionally only when opening — avoid clobbering pending edits.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    // Esc key closes (Cancel behaviour — discards pending).
    useEffect(() => {
        if (!isOpen) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation()
                onClose()
            }
        }
        document.addEventListener("keydown", handler)
        return () => document.removeEventListener("keydown", handler)
    }, [isOpen, onClose])

    // Focus trap: focus first control on open, trap Tab cycles.
    useEffect(() => {
        if (!isOpen) return
        firstFocusRef.current?.focus()
        const trap = (e: KeyboardEvent) => {
            if (e.key !== "Tab" || !drawerRef.current) return
            const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
            )
            if (focusable.length === 0) return
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            const active = document.activeElement as HTMLElement | null
            if (e.shiftKey && active === first) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && active === last) {
                e.preventDefault()
                first.focus()
            }
        }
        document.addEventListener("keydown", trap)
        return () => document.removeEventListener("keydown", trap)
    }, [isOpen])

    if (!isOpen) return null

    // Drawer is now live-apply — every change commits immediately via onApply,
    // so the user doesn't have to click Apply at the bottom.
    const setCategory = (cat: string) => {
        const next = { ...pending, selectedCategory: cat }
        setPending(next)
        onApply(next)
    }

    const clearPending = () => {
        const next = {
            searchText: "",
            selectedCategory: "all",
            selectedFacets: {},
            showComingSoon: false,
            showOnlyFavorites: false,
        }
        setPending(next)
        onClear()
    }

    return (
        <div
            className="fixed inset-0 z-[1000] flex justify-end"
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

            {/* Drawer panel */}
            <div
                ref={drawerRef}
                className="relative h-full w-full sm:w-[420px] bg-white dark:bg-gray-800 shadow-2xl flex flex-col animate-slide-in-right"
                style={{ maxWidth: "100vw" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
                        <button
                            ref={firstFocusRef}
                            type="button"
                            onClick={clearPending}
                            className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                        >
                            Clear all
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close filters"
                        className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    {/* Note: "Coming soon" + "Only favorites" toggles moved to the
                        main toolbar so they're reachable without opening this drawer.
                        They're omitted here to avoid duplicate controls. */}

                    {/* Category section — always open (no dropdown toggle) */}
                    <section className="pt-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Category</h3>
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                <input
                                    type="radio"
                                    name="drawer-category"
                                    checked={pending.selectedCategory === "all"}
                                    onChange={() => setCategory("all")}
                                    className="text-brand-500 focus:ring-brand-500"
                                />
                                All categories
                            </label>
                            {DRAWER_CATEGORIES.map((cat) => (
                                <label key={cat} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="drawer-category"
                                        checked={pending.selectedCategory === cat}
                                        onChange={() => setCategory(cat)}
                                        className="text-brand-500 focus:ring-brand-500"
                                    />
                                    {categoryInfo[cat].name}
                                </label>
                            ))}
                        </div>
                    </section>

                    {/* TODO(reports-filter): move store/date-range/vendor facets
                        here in a follow-up once per-report filter UX is unified. */}
                </div>

                {/* Footer removed — drawer is live-apply now. The match count lives
                    implicitly in the report list behind the drawer backdrop. */}
            </div>
        </div>
    )
}

const ReportManagerPage: React.FC = () => {
    const { openTab } = useDashboardTabs()
    const { permissions } = useAppSelector((state) => state.effectivePermission)
    // Persistent filter state (search, category, facets, toggles) — UserPreference-backed.
    const { state: filterState, patch: patchFilter, setState: setFilterState, reset: resetFilters } = useReportFilterState()
    const { searchText, selectedCategory, selectedFacets, showComingSoon, showOnlyFavorites } = filterState

    // Debounced search: the input is uncontrolled-ish — we hold a local draft and flush
    // to the persisted state on a 250ms timer so typing stays snappy.
    const [searchDraft, setSearchDraft] = useState(searchText)
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    useEffect(() => {
        // Sync draft when persisted value changes from outside (hydration, reset, chip remove).
        setSearchDraft(searchText)
    }, [searchText])
    const onSearchChange = useCallback((val: string) => {
        setSearchDraft(val)
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = setTimeout(() => {
            patchFilter({ searchText: val })
        }, 250)
    }, [patchFilter])

    const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
    const [selectedReport, setSelectedReport] = useState<ReportDefinition | null>(null)
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
    const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false)

    // Per-user favorite reports (persisted via UserPreference key "reports.favorites")
    const { favorites, isFavorite, toggleFavorite } = useReportFavorites()

    // Build a fast permission lookup set once (avoids repeated Array.includes scans)
    const permissionSet = useMemo(() => new Set(permissions), [permissions])

    // Derive per-report permission flags from the flat permission keys.
    // This avoids the N+1 API call problem of calling usePermission() per card.
    const reportPermissionMap = useMemo(() => {
        const map: Record<string, ReportPermissions> = {}
        for (const report of allReports) {
            if (!report.screenCode) {
                map[report.id] = { canView: true, canPrint: true, canExport: true }
                continue
            }
            map[report.id] = {
                canView: permissionSet.has(`${report.screenCode}.view`),
                canPrint: permissionSet.has(`${report.screenCode}.print`),
                canExport: permissionSet.has(`${report.screenCode}.export`),
            }
        }
        return map
    }, [permissionSet])

    // Permitted reports — only reports the user can view
    const permittedReports = useMemo(() => {
        return allReports.filter((report) => reportPermissionMap[report.id]?.canView !== false)
    }, [reportPermissionMap])

    // Filter permitted reports by search text, category, facets, and toggles.
    const filteredReports = useMemo(() => {
        return applyReportFilter(permittedReports, {
            searchText,
            selectedCategory,
            selectedFacets,
            showComingSoon,
            showOnlyFavorites,
            favorites,
        })
    }, [searchText, selectedCategory, selectedFacets, showComingSoon, showOnlyFavorites, favorites, permittedReports])

    // Group reports by category
    const groupedReports = useMemo(() => {
        const groups: Record<ReportCategory, ReportDefinition[]> = {
            inventory: [],
            customer: [],
            payable: [],
            store: [],
            pos: [],
            sales: [],
            schedule: [],
        }
        filteredReports.forEach((report) => {
            groups[report.category].push(report)
        })
        return groups
    }, [filteredReports])

    const handleReportClick = useCallback((report: ReportDefinition) => {
        setSelectedReport(report)
        setIsFilterModalOpen(true)
    }, [])

    const handleRunReport = useCallback((filters: ReportFilters) => {
        if (!selectedReport) return

        // reportComponentMap & SUBREPORT_ID_TO_KEY now live in constants/reportTabRoutes
        // (shared single source so /dashboard/reports/<id> deep links resolve the same way).
        const component = reportComponentMap[selectedReport.id] || "ReportViewerPage"
        const subReportKey = SUBREPORT_ID_TO_KEY[selectedReport.id]

        openTab({
            id: `report-${selectedReport.id}`,
            component,
            title: selectedReport.name,
            closable: true,
            props: {
                reportId: selectedReport.id,
                reportName: selectedReport.name,
                category: selectedReport.category,
                filters,
                ...(subReportKey && component === "MonthlyWeeklyDailyReportPage" ? { subReportKey } : {}),
            },
        })
    }, [selectedReport, openTab])

    // Build chip descriptors for the left zone of the toolbar.
    const activeChips = useMemo(() => {
        const chips: Array<{ key: string; label: string; onRemove: () => void }> = []
        if (selectedCategory && selectedCategory !== "all") {
            chips.push({
                key: `cat:${selectedCategory}`,
                label: categoryInfo[selectedCategory as ReportCategory]?.name.replace(" Reports", "") ?? selectedCategory,
                onRemove: () => patchFilter({ selectedCategory: "all" }),
            })
        }
        for (const [facetKey, values] of Object.entries(selectedFacets)) {
            for (const v of values) {
                chips.push({
                    key: `facet:${facetKey}:${v}`,
                    label: `${facetKey}: ${v}`,
                    onRemove: () => {
                        const next = { ...selectedFacets }
                        const remaining = (next[facetKey] ?? []).filter((x) => x !== v)
                        if (remaining.length === 0) delete next[facetKey]
                        else next[facetKey] = remaining
                        patchFilter({ selectedFacets: next })
                    },
                })
            }
        }
        if (showComingSoon) {
            chips.push({
                key: "comingSoon",
                label: "Upcoming reports",
                onRemove: () => patchFilter({ showComingSoon: false }),
            })
        }
        if (showOnlyFavorites) {
            chips.push({
                key: "favorites",
                label: "Favorites only",
                onRemove: () => patchFilter({ showOnlyFavorites: false }),
            })
        }
        if (searchText) {
            chips.push({
                key: "search",
                label: `Search: "${searchText}"`,
                onRemove: () => patchFilter({ searchText: "" }),
            })
        }
        return chips
    }, [selectedCategory, selectedFacets, showComingSoon, showOnlyFavorites, searchText, patchFilter])

    const activeFilterCount = activeChips.length

    return (
        <div className="p-6 h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Report Manager</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Select a report to generate. Use filters to customize your results.
                </p>
            </div>

            {/* Three-zone toolbar: chips | search | actions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
                {/* Single-row toolbar: chips | search | toggles & actions.
                    Kept on one line (flex-nowrap) so the search, coming-soon toggle,
                    favorites, filters, summary, and view-mode controls stay aligned.
                    The chip row itself scrolls horizontally when the left zone
                    overflows (rare — most screens have ≤3 chips active). */}
                <div className="flex items-center gap-3 min-w-0">
                    {/* LEFT ZONE — All reports pill + active filter chips */}
                    <div className="flex items-center gap-2 min-w-0 overflow-x-auto scrollbar-thin flex-shrink">
                        <button
                            type="button"
                            onClick={() => resetFilters()}
                            className="px-3 py-1.5 text-sm font-medium rounded-full bg-brand-500 text-white shadow-sm hover:bg-brand-600 transition-colors"
                            title="Reset all filters"
                        >
                            All reports
                        </button>
                        {activeChips.map((chip) => (
                            <span
                                key={chip.key}
                                className="inline-flex items-center gap-1 pl-3 pr-1 py-1 text-xs font-medium rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800"
                            >
                                {chip.label}
                                <button
                                    type="button"
                                    onClick={chip.onRemove}
                                    aria-label={`Remove filter: ${chip.label}`}
                                    className="ml-0.5 w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-brand-100 dark:hover:bg-brand-800 text-brand-600 dark:text-brand-300"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </span>
                        ))}
                    </div>

                    {/* CENTER ZONE — debounced search */}
                    <div className="relative flex-1 min-w-[160px] max-w-xl mx-auto">
                        <input
                            type="text"
                            placeholder="Search reports…"
                            value={searchDraft}
                            onChange={(e) => onSearchChange(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault() }}
                            aria-label="Search reports"
                            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        />
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {searchDraft && (
                            <button
                                type="button"
                                onClick={() => onSearchChange("")}
                                aria-label="Clear search"
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* RIGHT ZONE — coming-soon toggle, favorites (icon only), filters, summary, view mode.
                        flex-nowrap so everything stays on a single line with the search. */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-nowrap">
                        {/* Inline "Coming soon" toggle — moved out of the drawer so it's
                            a single-click switch right in the toolbar. Styled as a compact
                            pill toggle matching the app's switch component idiom. */}
                        <label
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 cursor-pointer select-none whitespace-nowrap"
                            title="Include reports that are coming soon / not yet implemented"
                        >
                            <span
                                role="switch"
                                aria-checked={showComingSoon}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === " " || e.key === "Enter") {
                                        e.preventDefault()
                                        patchFilter({ showComingSoon: !showComingSoon })
                                    }
                                }}
                                onClick={() => patchFilter({ showComingSoon: !showComingSoon })}
                                className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
                                    showComingSoon ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"
                                }`}
                            >
                                <span
                                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                        showComingSoon ? "translate-x-4" : "translate-x-0"
                                    }`}
                                />
                            </span>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Coming soon</span>
                        </label>

                        {/* Favorites — star icon only, brand-blue styling (matches Filters button) */}
                        <button
                            type="button"
                            onClick={() => patchFilter({ showOnlyFavorites: !showOnlyFavorites })}
                            className={`relative p-2 rounded-lg transition-all flex items-center justify-center ${
                                showOnlyFavorites
                                    ? "bg-brand-500 text-white shadow-md hover:bg-brand-600"
                                    : "bg-gray-100 dark:bg-gray-700 text-brand-500 dark:text-brand-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                            }`}
                            title={showOnlyFavorites ? "Showing favorites only — click to show all" : "Show only favorite reports"}
                            aria-pressed={showOnlyFavorites}
                            aria-label={showOnlyFavorites ? "Showing favorites only" : "Show only favorites"}
                        >
                            <svg
                                className="w-5 h-5"
                                fill={showOnlyFavorites ? "currentColor" : "none"}
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.32.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.32-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                            </svg>
                            {favorites.size > 0 && !showOnlyFavorites && (
                                <span
                                    className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 text-[10px] font-semibold rounded-full bg-brand-500 text-white border-2 border-white dark:border-gray-800"
                                    aria-hidden="true"
                                >
                                    {favorites.size}
                                </span>
                            )}
                        </button>

                        {/* Filters button */}
                        <button
                            type="button"
                            onClick={() => setIsFilterDrawerOpen(true)}
                            aria-label={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
                            className={`px-3 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${activeFilterCount > 0
                                    ? "bg-brand-500 text-white shadow-md hover:bg-brand-600"
                                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L15 12.414V19a1 1 0 01-.553.894l-4 2A1 1 0 019 21v-8.586L3.293 6.707A1 1 0 013 6V4z" />
                            </svg>
                            Filters
                            {activeFilterCount > 0 && (
                                <span aria-live="polite" className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-semibold rounded-full bg-white/20 text-white">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {/* Summary Report quick-action (preserved from old toolbar) */}
                        <button
                            onClick={() => {
                                const summaryReport = allReports.find((r) => r.id === "summary-reports")
                                if (summaryReport) {
                                    setSelectedReport(summaryReport)
                                    setIsFilterModalOpen(true)
                                }
                            }}
                            className="px-3 py-2 text-sm font-medium rounded-lg transition-all bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2 border border-transparent hover:border-brand-300 dark:hover:border-brand-600"
                            title="Open Summary Report with filters"
                        >
                            <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                            </svg>
                            Summary
                        </button>

                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-2 rounded-md transition-colors ${viewMode === "grid"
                                    ? "bg-white dark:bg-gray-600 shadow-sm text-brand-500"
                                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`p-2 rounded-md transition-colors ${viewMode === "list"
                                    ? "bg-white dark:bg-gray-600 shadow-sm text-brand-500"
                                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                        </button>
                    </div>
                    </div>
                </div>

            </div>

            {/* Reports Count */}
            <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                Showing {filteredReports.length} of {permittedReports.length} reports
            </div>

            {/* Reports Grid/List */}
            <div className="flex-1 overflow-auto">
                {selectedCategory === "all" ? (
                    // Show grouped by category
                    <div className="space-y-8">
                        {(Object.keys(groupedReports) as ReportCategory[]).map((category) => {
                            const reports = groupedReports[category]
                            if (reports.length === 0) return null
                            const info = categoryInfo[category]

                            return (
                                <div key={category}>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={`p-2 rounded-lg ${info.bgColor}`}>
                                            <svg className={`w-5 h-5 ${info.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                        </div>
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{info.name}</h2>
                                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                            {reports.length}
                                        </span>
                                    </div>

                                    {viewMode === "grid" ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                            {reports.map((report) => (
                                                <ReportCard key={report.id} report={report} onClick={handleReportClick} reportPerms={reportPermissionMap[report.id]} isFavorite={isFavorite(report.id)} onToggleFavorite={toggleFavorite} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {reports.map((report) => (
                                                <ReportListItem key={report.id} report={report} onClick={handleReportClick} reportPerms={reportPermissionMap[report.id]} isFavorite={isFavorite(report.id)} onToggleFavorite={toggleFavorite} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    // Show filtered results (single category)
                    viewMode === "grid" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredReports.map((report) => (
                                <ReportCard key={report.id} report={report} onClick={handleReportClick} reportPerms={reportPermissionMap[report.id]} isFavorite={isFavorite(report.id)} onToggleFavorite={toggleFavorite} />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredReports.map((report) => (
                                <ReportListItem key={report.id} report={report} onClick={handleReportClick} reportPerms={reportPermissionMap[report.id]} isFavorite={isFavorite(report.id)} onToggleFavorite={toggleFavorite} />
                            ))}
                        </div>
                    )
                )}

                {filteredReports.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
                        {showOnlyFavorites && favorites.size === 0 ? (
                            <>
                                <svg className="w-16 h-16 mb-4 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
                                </svg>
                                <p className="text-lg font-medium">No favorite reports yet</p>
                                <p className="text-sm">Click the star icon on any report to add it to your favorites.</p>
                            </>
                        ) : (
                            <>
                                <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-lg font-medium">No reports found</p>
                                <p className="text-sm">Try adjusting your search or filter</p>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Filter Modal */}
            <FilterModal
                report={selectedReport}
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                onRunReport={handleRunReport}
            />

            {/* Filter Drawer */}
            <ReportFilterDrawer
                isOpen={isFilterDrawerOpen}
                onClose={() => setIsFilterDrawerOpen(false)}
                committedState={filterState}
                reports={permittedReports}
                favorites={favorites}
                onApply={(next) => {
                    setFilterState(next)
                    setIsFilterDrawerOpen(false)
                }}
                onClear={resetFilters}
            />
        </div>
    )
}

// Report Card Component
const ReportCard: React.FC<{
  report: ReportDefinition
  onClick: (report: ReportDefinition) => void
  reportPerms: ReportPermissions
  isFavorite: boolean
  onToggleFavorite: (reportId: string) => void
}> = ({ report, onClick, reportPerms, isFavorite, onToggleFavorite }) => {
  const info = categoryInfo[report.category]
  const isEnabled = enabledReportIds.has(report.id)

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleFavorite(report.id)
  }

  // Disabled/coming-soon report card
  if (!isEnabled) {
    return (
      <div
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-left opacity-45 cursor-not-allowed"
      >
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700/50">
            <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-400 dark:text-gray-500 truncate">
              {report.name}
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1 line-clamp-2">
              {report.description}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-3">
          <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500">Coming Soon</span>
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(report)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick(report)
        }
      }}
      className="relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-left hover:shadow-lg hover:border-brand-300 dark:hover:border-brand-600 transition-all group cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      {/* Favorite toggle — absolutely positioned so it doesn't disturb card layout */}
      <button
        type="button"
        onClick={handleFavoriteClick}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? `Remove ${report.name} from favorites` : `Add ${report.name} to favorites`}
        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors ${isFavorite
            ? "text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            : "text-gray-300 dark:text-gray-600 hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
      >
        <svg
          className="w-5 h-5"
          fill={isFavorite ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.32.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.32-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      </button>

      <div className="flex items-start gap-3 pr-7">
        <div className={`p-2.5 rounded-lg ${info.bgColor} group-hover:scale-110 transition-transform`}>
          <svg className={`w-5 h-5 ${info.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            {report.name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
            {report.description}
          </p>
        </div>
      </div>

            {/* Filter indicators + permission badges */}
            <div className="flex flex-wrap gap-1 mt-3">
                {report.hasDateFilter && (
                    <span className="px-2 py-0.5 text-xs rounded bg-brand-50 dark:bg-brand-900/30 text-brand-500 dark:text-brand-400">Date</span>
                )}
                {report.hasStoreFilter && (
                    <span className="px-2 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">Store</span>
                )}
                {report.hasCustomerFilter && (
                    <span className="px-2 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">Customer</span>
                )}
                {report.hasVendorFilter && (
                    <span className="px-2 py-0.5 text-xs rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">Supplier</span>
                )}
                {report.hasDepartmentFilter && (
                    <span className="px-2 py-0.5 text-xs rounded bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">Department</span>
                )}
                {report.hasBrandFilter && (
                    <span className="px-2 py-0.5 text-xs rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">Brand</span>
                )}

                {/* Permission badges */}
                {reportPerms.canPrint && (
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400" title="You can print this report">Print</span>
                )}
                {reportPerms.canExport && (
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" title="You can export this report">Export</span>
                )}
            </div>
        </div>
    )
}

// Report List Item Component
const ReportListItem: React.FC<{
  report: ReportDefinition
  onClick: (report: ReportDefinition) => void
  reportPerms: ReportPermissions
  isFavorite: boolean
  onToggleFavorite: (reportId: string) => void
}> = ({ report, onClick, reportPerms, isFavorite, onToggleFavorite }) => {
  const info = categoryInfo[report.category]
  const isEnabled = enabledReportIds.has(report.id)

  // Disabled/coming-soon report list item
  if (!isEnabled) {
    return (
      <div
        className="w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-left opacity-45 cursor-not-allowed flex items-center gap-4"
      >
        <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700/50 flex-shrink-0">
          <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-400 dark:text-gray-500">
            {report.name}
          </h3>
          <p className="text-sm text-gray-400 dark:text-gray-600 truncate">
            {report.description}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500">Coming Soon</span>
        </div>
      </div>
    )
  }

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleFavorite(report.id)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(report)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick(report)
        }
      }}
      className="w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-left hover:shadow-md hover:border-brand-300 dark:hover:border-brand-600 transition-all group flex items-center gap-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      <div className={`p-2.5 rounded-lg ${info.bgColor} group-hover:scale-110 transition-transform flex-shrink-0`}>
        <svg className={`w-5 h-5 ${info.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>

            <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {report.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {report.description}
                </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
                {/* Filter indicators */}
                {report.hasDateFilter && (
                    <span className="px-2 py-0.5 text-xs rounded bg-brand-50 dark:bg-brand-900/30 text-brand-500 dark:text-brand-400">Date</span>
                )}
                {report.hasStoreFilter && (
                    <span className="px-2 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">Store</span>
                )}
                {report.hasVendorFilter && (
                    <span className="px-2 py-0.5 text-xs rounded bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">Supplier</span>
                )}
                {report.hasDepartmentFilter && (
                    <span className="px-2 py-0.5 text-xs rounded bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">Department</span>
                )}
                {report.hasBrandFilter && (
                    <span className="px-2 py-0.5 text-xs rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">Brand</span>
                )}

                {/* Permission badges */}
                {reportPerms.canPrint && (
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400" title="You can print this report">Print</span>
                )}
                {reportPerms.canExport && (
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" title="You can export this report">Export</span>
                )}

                {/* Favorite toggle */}
                <button
                    type="button"
                    onClick={handleFavoriteClick}
                    aria-pressed={isFavorite}
                    aria-label={isFavorite ? `Remove ${report.name} from favorites` : `Add ${report.name} to favorites`}
                    title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                    className={`p-1.5 rounded-full transition-colors ${isFavorite
                            ? "text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                            : "text-gray-300 dark:text-gray-600 hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                >
                    <svg
                        className="w-5 h-5"
                        fill={isFavorite ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.32.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.32-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                </button>

                <svg className="w-5 h-5 text-gray-400 group-hover:text-brand-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
            </div>
        </div>
    )
}

export default ReportManagerPage
