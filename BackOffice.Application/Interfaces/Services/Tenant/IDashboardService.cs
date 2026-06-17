using BackOffice.Application.DTOs.Tenant.Dashboard;
using BackOffice.Common;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IDashboardService
    {
        Task<ApiResult<KpiCardsDto>> GetKpiCardsAsync(Guid? storeId = null, DateTime? dateFrom = null, DateTime? dateTo = null);
        Task<ApiResult<List<SalesTrendPointDto>>> GetSalesTrendAsync(Guid? storeId = null, DateTime? dateFrom = null, DateTime? dateTo = null, string period = "monthly");
        Task<ApiResult<List<RevenueExpenseDto>>> GetRevenueVsExpensesAsync(Guid? storeId = null, DateTime? dateFrom = null, DateTime? dateTo = null);
        Task<ApiResult<List<TopSellingItemDto>>> GetTopSellingItemsAsync(Guid? storeId = null, DateTime? dateFrom = null, DateTime? dateTo = null, int count = 10);
        Task<ApiResult<List<SalesByDepartmentDto>>> GetSalesByDepartmentAsync(Guid? storeId = null, DateTime? dateFrom = null, DateTime? dateTo = null);
        Task<ApiResult<InvoiceStatusBreakdownDto>> GetInvoiceStatusBreakdownAsync(Guid? storeId = null, DateTime? dateFrom = null, DateTime? dateTo = null);
        Task<ApiResult<PagedResultDto<RecentInvoiceDto>>> GetRecentInvoicesAsync(Guid? storeId = null, DateTime? dateFrom = null, DateTime? dateTo = null, int page = 1, int pageSize = 10);
        Task<ApiResult<PurchaseOverviewDto>> GetPurchaseOverviewAsync(Guid? storeId = null, DateTime? dateFrom = null, DateTime? dateTo = null);
        Task<ApiResult<List<LowStockItemDto>>> GetLowStockItemsAsync(Guid? storeId = null, int count = 20);
        Task<ApiResult<CustomerAgingDto>> GetCustomerAgingAsync(Guid? storeId = null);
        Task<ApiResult<SupplierAgingDto>> GetSupplierAgingAsync(Guid? storeId = null);
        Task<ApiResult<List<DashboardNotificationDto>>> GetNotificationsAsync(Guid? storeId = null);
    }
}
