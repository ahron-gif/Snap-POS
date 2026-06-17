using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace BackOffice.Application.DTOs.Tenant.Dashboard
{
    // ─── Filter ───────────────────────────────────────────────

    public class DashboardFilterDto
    {
        [JsonPropertyName("storeId")]
        public Guid? StoreId { get; set; }

        [JsonPropertyName("dateFrom")]
        public DateTime? DateFrom { get; set; }

        [JsonPropertyName("dateTo")]
        public DateTime? DateTo { get; set; }
    }

    // ─── Paged Result ─────────────────────────────────────────

    public class PagedResultDto<T>
    {
        [JsonPropertyName("items")]
        public List<T> Items { get; set; } = new();

        [JsonPropertyName("totalCount")]
        public int TotalCount { get; set; }

        [JsonPropertyName("page")]
        public int Page { get; set; }

        [JsonPropertyName("pageSize")]
        public int PageSize { get; set; }

        [JsonPropertyName("totalPages")]
        public int TotalPages { get; set; }
    }

    // ─── KPI Cards ────────────────────────────────────────────

    public class KpiCardsDto
    {
        [JsonPropertyName("todaySalesAmount")]
        public decimal TodaySalesAmount { get; set; }

        [JsonPropertyName("todaySalesCount")]
        public int TodaySalesCount { get; set; }

        [JsonPropertyName("todaySalesChange")]
        public decimal TodaySalesChange { get; set; }

        [JsonPropertyName("todayPurchasesAmount")]
        public decimal TodayPurchasesAmount { get; set; }

        [JsonPropertyName("todayPurchasesCount")]
        public int TodayPurchasesCount { get; set; }

        [JsonPropertyName("todayPurchasesChange")]
        public decimal TodayPurchasesChange { get; set; }

        [JsonPropertyName("todayProfit")]
        public decimal TodayProfit { get; set; }

        [JsonPropertyName("todayProfitChange")]
        public decimal TodayProfitChange { get; set; }

        [JsonPropertyName("totalCustomers")]
        public int TotalCustomers { get; set; }

        [JsonPropertyName("customersChange")]
        public decimal CustomersChange { get; set; }

        [JsonPropertyName("totalSuppliers")]
        public int TotalSuppliers { get; set; }

        [JsonPropertyName("suppliersChange")]
        public decimal SuppliersChange { get; set; }

        [JsonPropertyName("totalActiveItems")]
        public int TotalActiveItems { get; set; }

        [JsonPropertyName("activeItemsChange")]
        public decimal ActiveItemsChange { get; set; }

        [JsonPropertyName("pendingOrders")]
        public int PendingOrders { get; set; }

        [JsonPropertyName("pendingOrdersChange")]
        public decimal PendingOrdersChange { get; set; }

        [JsonPropertyName("lowStockAlerts")]
        public int LowStockAlerts { get; set; }

        [JsonPropertyName("totalReceivables")]
        public decimal TotalReceivables { get; set; }

        [JsonPropertyName("receivablesChange")]
        public decimal ReceivablesChange { get; set; }

        [JsonPropertyName("totalPayables")]
        public decimal TotalPayables { get; set; }

        [JsonPropertyName("payablesChange")]
        public decimal PayablesChange { get; set; }

        [JsonPropertyName("monthlyRevenue")]
        public decimal MonthlyRevenue { get; set; }

        [JsonPropertyName("monthlyRevenueChange")]
        public decimal MonthlyRevenueChange { get; set; }
    }

    // ─── Sales Trend ──────────────────────────────────────────

    public class SalesTrendPointDto
    {
        [JsonPropertyName("label")]
        public string Label { get; set; } = string.Empty;

        [JsonPropertyName("amount")]
        public decimal Amount { get; set; }

        [JsonPropertyName("count")]
        public int Count { get; set; }
    }

    // ─── Revenue vs Expenses ──────────────────────────────────

    public class RevenueExpenseDto
    {
        [JsonPropertyName("month")]
        public string Month { get; set; } = string.Empty;

        [JsonPropertyName("revenue")]
        public decimal Revenue { get; set; }

        [JsonPropertyName("expenses")]
        public decimal Expenses { get; set; }
    }

    // ─── Top Selling Items ────────────────────────────────────

    public class TopSellingItemDto
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("totalQty")]
        public decimal TotalQty { get; set; }

        [JsonPropertyName("totalRevenue")]
        public decimal TotalRevenue { get; set; }
    }

    // ─── Sales by Department ──────────────────────────────────

    public class SalesByDepartmentDto
    {
        [JsonPropertyName("departmentName")]
        public string DepartmentName { get; set; } = string.Empty;

        [JsonPropertyName("totalSales")]
        public decimal TotalSales { get; set; }
    }

    // ─── Invoice Status Breakdown ─────────────────────────────

    public class InvoiceStatusBreakdownDto
    {
        [JsonPropertyName("statuses")]
        public List<InvoiceStatusItemDto> Statuses { get; set; } = new();

        [JsonPropertyName("totalCount")]
        public int TotalCount { get; set; }

        [JsonPropertyName("totalAmount")]
        public decimal TotalAmount { get; set; }
    }

    public class InvoiceStatusItemDto
    {
        [JsonPropertyName("status")]
        public string Status { get; set; } = string.Empty;

        [JsonPropertyName("count")]
        public int Count { get; set; }

        [JsonPropertyName("amount")]
        public decimal Amount { get; set; }
    }

    // ─── Recent Invoices ──────────────────────────────────────

    public class RecentInvoiceDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("transactionNo")]
        public string TransactionNo { get; set; } = string.Empty;

        [JsonPropertyName("customer")]
        public string Customer { get; set; } = string.Empty;

        [JsonPropertyName("amount")]
        public decimal Amount { get; set; }

        [JsonPropertyName("status")]
        public string Status { get; set; } = string.Empty;

        [JsonPropertyName("date")]
        public string Date { get; set; } = string.Empty;

        [JsonPropertyName("itemCount")]
        public int ItemCount { get; set; }

        [JsonPropertyName("storeName")]
        public string StoreName { get; set; } = string.Empty;
    }

    // ─── Purchase Overview ────────────────────────────────────

    public class PurchaseOverviewDto
    {
        [JsonPropertyName("pendingCount")]
        public int PendingCount { get; set; }

        [JsonPropertyName("pendingAmount")]
        public decimal PendingAmount { get; set; }

        [JsonPropertyName("partialCount")]
        public int PartialCount { get; set; }

        [JsonPropertyName("partialAmount")]
        public decimal PartialAmount { get; set; }

        [JsonPropertyName("completedCount")]
        public int CompletedCount { get; set; }

        [JsonPropertyName("completedAmount")]
        public decimal CompletedAmount { get; set; }

        [JsonPropertyName("cancelledCount")]
        public int CancelledCount { get; set; }

        [JsonPropertyName("cancelledAmount")]
        public decimal CancelledAmount { get; set; }

        [JsonPropertyName("totalCount")]
        public int TotalCount { get; set; }

        [JsonPropertyName("totalAmount")]
        public decimal TotalAmount { get; set; }
    }

    // ─── Low Stock Items ──────────────────────────────────────

    public class LowStockItemDto
    {
        [JsonPropertyName("itemName")]
        public string ItemName { get; set; } = string.Empty;

        [JsonPropertyName("currentQty")]
        public decimal CurrentQty { get; set; }

        [JsonPropertyName("reorderLevel")]
        public decimal ReorderLevel { get; set; }

        [JsonPropertyName("storeName")]
        public string StoreName { get; set; } = string.Empty;

        [JsonPropertyName("cost")]
        public decimal Cost { get; set; }

        [JsonPropertyName("price")]
        public decimal Price { get; set; }
    }

    // ─── Customer Aging ───────────────────────────────────────

    public class CustomerAgingDto
    {
        [JsonPropertyName("current")]
        public decimal Current { get; set; }

        [JsonPropertyName("over30")]
        public decimal Over30 { get; set; }

        [JsonPropertyName("over60")]
        public decimal Over60 { get; set; }

        [JsonPropertyName("over90")]
        public decimal Over90 { get; set; }

        [JsonPropertyName("over120")]
        public decimal Over120 { get; set; }

        [JsonPropertyName("total")]
        public decimal Total { get; set; }

        [JsonPropertyName("customerCount")]
        public int CustomerCount { get; set; }
    }

    // ─── Supplier Aging ───────────────────────────────────────

    public class SupplierAgingDto
    {
        [JsonPropertyName("current")]
        public decimal Current { get; set; }

        [JsonPropertyName("over30")]
        public decimal Over30 { get; set; }

        [JsonPropertyName("over60")]
        public decimal Over60 { get; set; }

        [JsonPropertyName("over90")]
        public decimal Over90 { get; set; }

        [JsonPropertyName("over120")]
        public decimal Over120 { get; set; }

        [JsonPropertyName("total")]
        public decimal Total { get; set; }

        [JsonPropertyName("supplierCount")]
        public int SupplierCount { get; set; }
    }

    // ─── Notifications ────────────────────────────────────────

    public class DashboardNotificationDto
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = string.Empty;

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("message")]
        public string Message { get; set; } = string.Empty;

        [JsonPropertyName("severity")]
        public string Severity { get; set; } = "info";

        [JsonPropertyName("timestamp")]
        public string Timestamp { get; set; } = string.Empty;
    }
}
