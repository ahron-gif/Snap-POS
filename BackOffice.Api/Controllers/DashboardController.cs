using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DashboardController : ControllerBase
    {
        private readonly IDashboardService _dashboardService;

        public DashboardController(IDashboardService dashboardService)
        {
            _dashboardService = dashboardService;
        }

        [HttpGet("kpi")]
        public async Task<IActionResult> GetKpiCards([FromQuery] Guid? storeId = null, [FromQuery] DateTime? dateFrom = null, [FromQuery] DateTime? dateTo = null)
        {
            var result = await _dashboardService.GetKpiCardsAsync(storeId, dateFrom, dateTo);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet("sales-trend")]
        public async Task<IActionResult> GetSalesTrend([FromQuery] Guid? storeId = null, [FromQuery] DateTime? dateFrom = null, [FromQuery] DateTime? dateTo = null, [FromQuery] string period = "monthly")
        {
            var result = await _dashboardService.GetSalesTrendAsync(storeId, dateFrom, dateTo, period);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet("revenue-expenses")]
        public async Task<IActionResult> GetRevenueVsExpenses([FromQuery] Guid? storeId = null, [FromQuery] DateTime? dateFrom = null, [FromQuery] DateTime? dateTo = null)
        {
            var result = await _dashboardService.GetRevenueVsExpensesAsync(storeId, dateFrom, dateTo);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet("top-selling-items")]
        public async Task<IActionResult> GetTopSellingItems([FromQuery] Guid? storeId = null, [FromQuery] DateTime? dateFrom = null, [FromQuery] DateTime? dateTo = null, [FromQuery] int count = 10)
        {
            var result = await _dashboardService.GetTopSellingItemsAsync(storeId, dateFrom, dateTo, count);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet("sales-by-department")]
        public async Task<IActionResult> GetSalesByDepartment([FromQuery] Guid? storeId = null, [FromQuery] DateTime? dateFrom = null, [FromQuery] DateTime? dateTo = null)
        {
            var result = await _dashboardService.GetSalesByDepartmentAsync(storeId, dateFrom, dateTo);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet("invoice-status")]
        public async Task<IActionResult> GetInvoiceStatusBreakdown([FromQuery] Guid? storeId = null, [FromQuery] DateTime? dateFrom = null, [FromQuery] DateTime? dateTo = null)
        {
            var result = await _dashboardService.GetInvoiceStatusBreakdownAsync(storeId, dateFrom, dateTo);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet("recent-invoices")]
        public async Task<IActionResult> GetRecentInvoices([FromQuery] Guid? storeId = null, [FromQuery] DateTime? dateFrom = null, [FromQuery] DateTime? dateTo = null, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            var result = await _dashboardService.GetRecentInvoicesAsync(storeId, dateFrom, dateTo, page, pageSize);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet("purchase-overview")]
        public async Task<IActionResult> GetPurchaseOverview([FromQuery] Guid? storeId = null, [FromQuery] DateTime? dateFrom = null, [FromQuery] DateTime? dateTo = null)
        {
            var result = await _dashboardService.GetPurchaseOverviewAsync(storeId, dateFrom, dateTo);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet("low-stock")]
        public async Task<IActionResult> GetLowStockItems([FromQuery] Guid? storeId = null, [FromQuery] int count = 20)
        {
            var result = await _dashboardService.GetLowStockItemsAsync(storeId, count);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet("customer-aging")]
        public async Task<IActionResult> GetCustomerAging([FromQuery] Guid? storeId = null)
        {
            var result = await _dashboardService.GetCustomerAgingAsync(storeId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet("supplier-aging")]
        public async Task<IActionResult> GetSupplierAging([FromQuery] Guid? storeId = null)
        {
            var result = await _dashboardService.GetSupplierAgingAsync(storeId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        [HttpGet("notifications")]
        public async Task<IActionResult> GetNotifications([FromQuery] Guid? storeId = null)
        {
            var result = await _dashboardService.GetNotificationsAsync(storeId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }
    }
}
