using BackOffice.Application.DTOs.Tenant.Dashboard;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;

namespace BackOffice.Persistence.Services.Tenant
{
    public class DashboardService : IDashboardService
    {
        private readonly TenantDBContext _context;

        public DashboardService(TenantDBContext context)
        {
            _context = context;
        }

        public async Task<ApiResult<KpiCardsDto>> GetKpiCardsAsync(Guid? storeId = null, DateTime? dateFrom = null, DateTime? dateTo = null)
        {
            try
            {
                var now = DateTime.UtcNow;
                // When date filters are provided use them; otherwise default to "today" vs "yesterday"
                var periodStart = dateFrom ?? now.Date;
                var periodEnd = dateTo?.Date.AddDays(1) ?? now.Date.AddDays(1);
                // For change % we compare against a prior period of equal length
                var periodDays = (periodEnd - periodStart).TotalDays;
                var priorStart = periodStart.AddDays(-periodDays);
                var priorEnd = periodStart;
                var monthStart = new DateTime(now.Year, now.Month, 1);
                var lastMonthStart = monthStart.AddMonths(-1);
                var lastMonthEnd = monthStart;

                var kpi = new KpiCardsDto();

                // ── Sales (Transactions with Status=Completed) ──
                var txQuery = _context.Transactions.AsNoTracking().Where(t => t.Status == 1);
                if (storeId.HasValue) txQuery = txQuery.Where(t => t.StoreID == storeId.Value);

                var periodSales = await txQuery
                    .Where(t => t.StartSaleTime >= periodStart && t.StartSaleTime < periodEnd)
                    .GroupBy(t => 1)
                    .Select(g => new { Amount = g.Sum(t => t.Debit ?? 0), Count = g.Count() })
                    .FirstOrDefaultAsync();

                kpi.TodaySalesAmount = periodSales?.Amount ?? 0;
                kpi.TodaySalesCount = periodSales?.Count ?? 0;

                var priorSales = await txQuery
                    .Where(t => t.StartSaleTime >= priorStart && t.StartSaleTime < priorEnd)
                    .SumAsync(t => t.Debit ?? 0);

                kpi.TodaySalesChange = priorSales > 0
                    ? Math.Round(((kpi.TodaySalesAmount - priorSales) / priorSales) * 100, 1)
                    : 0;

                // ── Purchases (ReceiveOrders) ──
                var roQuery = _context.ReceiveOrders.AsNoTracking();
                if (storeId.HasValue) roQuery = roQuery.Where(r => r.StoreID == storeId.Value);

                var periodPurchases = await roQuery
                    .Where(r => r.ReceiveOrderDate >= periodStart && r.ReceiveOrderDate < periodEnd)
                    .GroupBy(r => 1)
                    .Select(g => new { Amount = g.Sum(r => r.Total ?? 0), Count = g.Count() })
                    .FirstOrDefaultAsync();

                kpi.TodayPurchasesAmount = periodPurchases?.Amount ?? 0;
                kpi.TodayPurchasesCount = periodPurchases?.Count ?? 0;

                var priorPurchases = await roQuery
                    .Where(r => r.ReceiveOrderDate >= priorStart && r.ReceiveOrderDate < priorEnd)
                    .SumAsync(r => r.Total ?? 0);

                kpi.TodayPurchasesChange = priorPurchases > 0
                    ? Math.Round(((kpi.TodayPurchasesAmount - priorPurchases) / priorPurchases) * 100, 1)
                    : 0;

                // ── Profit (TransactionEntries + Transactions) ──
                var profitQuery = from te in _context.TransactionEntries.AsNoTracking()
                                  join t in _context.Transactions.AsNoTracking() on te.TransactionID equals t.TransactionID
                                  where t.Status == 1
                                  select new { te, t };
                if (storeId.HasValue) profitQuery = profitQuery.Where(x => x.t.StoreID == storeId.Value);

                kpi.TodayProfit = await profitQuery
                    .Where(x => x.t.StartSaleTime >= periodStart && x.t.StartSaleTime < periodEnd)
                    .SumAsync(x => (x.te.Total ?? 0) - (x.te.Cost ?? 0) * (x.te.Qty ?? 0));

                var priorProfit = await profitQuery
                    .Where(x => x.t.StartSaleTime >= priorStart && x.t.StartSaleTime < priorEnd)
                    .SumAsync(x => (x.te.Total ?? 0) - (x.te.Cost ?? 0) * (x.te.Qty ?? 0));

                kpi.TodayProfitChange = priorProfit != 0
                    ? Math.Round(((kpi.TodayProfit - priorProfit) / Math.Abs(priorProfit)) * 100, 1)
                    : 0;

                // ── Monthly Revenue ──
                kpi.MonthlyRevenue = await txQuery
                    .Where(t => t.StartSaleTime >= monthStart && t.StartSaleTime < now.Date.AddDays(1))
                    .SumAsync(t => t.Debit ?? 0);

                var lastMonthRevenue = await txQuery
                    .Where(t => t.StartSaleTime >= lastMonthStart && t.StartSaleTime < lastMonthEnd)
                    .SumAsync(t => t.Debit ?? 0);

                kpi.MonthlyRevenueChange = lastMonthRevenue > 0
                    ? Math.Round(((kpi.MonthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100, 1)
                    : 0;

                // ── Customers ──
                kpi.TotalCustomers = await _context.Customers.AsNoTracking().CountAsync();
                var newCustThisMonth = await _context.Customers.AsNoTracking()
                    .Where(c => c.DateCreated >= monthStart).CountAsync();
                var newCustLastMonth = await _context.Customers.AsNoTracking()
                    .Where(c => c.DateCreated >= lastMonthStart && c.DateCreated < lastMonthEnd).CountAsync();
                kpi.CustomersChange = newCustLastMonth > 0
                    ? Math.Round(((decimal)(newCustThisMonth - newCustLastMonth) / newCustLastMonth) * 100, 1)
                    : (newCustThisMonth > 0 ? 100 : 0);

                kpi.TotalSuppliers = await _context.Suppliers.AsNoTracking().CountAsync();

                // ── Active Items (store-filtered) ──
                var itemStoreQuery = _context.ItemStores.AsNoTracking()
                    .Where(i => i.Status == 0 || i.Status == null);
                if (storeId.HasValue) itemStoreQuery = itemStoreQuery.Where(i => i.StoreNo == storeId.Value);

                kpi.TotalActiveItems = await itemStoreQuery
                    .Select(i => i.ItemNo)
                    .Distinct()
                    .CountAsync();

                // ── Pending Orders (store-filtered) ──
                var poQuery = _context.PurchaseOrders.AsNoTracking()
                    .Where(p => p.POStatus == 0 || p.POStatus == 1);
                if (storeId.HasValue) poQuery = poQuery.Where(p => p.StoreNo == storeId.Value);
                var pendingPOs = await poQuery.CountAsync();

                var pendingSalesQuery = _context.Transactions.AsNoTracking().Where(t => t.Status == 0);
                if (storeId.HasValue) pendingSalesQuery = pendingSalesQuery.Where(t => t.StoreID == storeId.Value);
                var pendingSales = await pendingSalesQuery.CountAsync();
                kpi.PendingOrders = pendingPOs + pendingSales;

                // ── Low Stock (store-filtered) ──
                var lowStockQuery = _context.ItemStores.AsNoTracking()
                    .Where(i => i.OnHand < i.ReorderPoint && i.ReorderPoint > 0 && (i.Status == 0 || i.Status == null));
                if (storeId.HasValue) lowStockQuery = lowStockQuery.Where(i => i.StoreNo == storeId.Value);
                kpi.LowStockAlerts = await lowStockQuery.CountAsync();

                // ── Receivables & Payables ──
                //
                // Customer/PaymentToVentor rows don't carry a direct StoreID column,
                // so when storeId is supplied we filter via:
                //   * Customers → who have at least one Transaction at that store
                //   * PaymentToVentors → whose vendor (PID) has at least one
                //     PurchaseOrder at that store
                // Without storeId we keep the tenant-wide sum (unchanged behavior).
                var receivablesQuery = _context.Customers.AsNoTracking()
                    .Where(c => c.BalanceDoe > 0);
                if (storeId.HasValue)
                {
                    receivablesQuery = receivablesQuery.Where(c =>
                        _context.Transactions.Any(t =>
                            t.CustomerID == c.CustomerID && t.StoreID == storeId.Value));
                }
                kpi.TotalReceivables = await receivablesQuery.SumAsync(c => c.BalanceDoe ?? 0);

                var payablesQuery = _context.PaymentToVentors.AsNoTracking()
                    .Where(p => p.OpenBalance > 0);
                if (storeId.HasValue)
                {
                    payablesQuery = payablesQuery.Where(p =>
                        p.PID.HasValue &&
                        _context.PurchaseOrders.Any(po =>
                            po.SupplierNo == p.PID.Value && po.StoreNo == storeId.Value));
                }
                kpi.TotalPayables = await payablesQuery.SumAsync(p => p.OpenBalance ?? 0);

                return new ApiResult<KpiCardsDto> { IsSuccess = true, Message = "KPI data retrieved successfully.", Response = kpi };
            }
            catch (Exception ex)
            {
                return new ApiResult<KpiCardsDto> { IsSuccess = false, Message = $"Error retrieving KPI data: {ex.Message}", Response = null };
            }
        }

        public async Task<ApiResult<List<SalesTrendPointDto>>> GetSalesTrendAsync(Guid? storeId = null, DateTime? dateFrom = null, DateTime? dateTo = null, string period = "monthly")
        {
            try
            {
                var now = DateTime.UtcNow;
                var from = dateFrom ?? now.AddMonths(-12);
                var to = dateTo ?? now;

                var query = _context.Transactions.AsNoTracking().Where(t => t.Status == 1);
                if (storeId.HasValue) query = query.Where(t => t.StoreID == storeId.Value);

                var raw = await query
                    .Where(t => t.StartSaleTime >= from && t.StartSaleTime <= to)
                    .Select(t => new { t.StartSaleTime, t.Debit })
                    .ToListAsync();

                List<SalesTrendPointDto> result;

                switch (period.ToLower())
                {
                    case "daily":
                        result = raw.Where(t => t.StartSaleTime.HasValue)
                            .GroupBy(t => t.StartSaleTime!.Value.Date)
                            .OrderBy(g => g.Key)
                            .Select(g => new SalesTrendPointDto { Label = g.Key.ToString("MMM dd"), Amount = g.Sum(x => x.Debit ?? 0), Count = g.Count() })
                            .ToList();
                        break;
                    case "weekly":
                        result = raw.Where(t => t.StartSaleTime.HasValue)
                            .GroupBy(t => CultureInfo.CurrentCulture.Calendar.GetWeekOfYear(t.StartSaleTime!.Value, CalendarWeekRule.FirstDay, DayOfWeek.Monday).ToString() + "-" + t.StartSaleTime.Value.Year)
                            .Select(g => new SalesTrendPointDto { Label = "W" + g.Key, Amount = g.Sum(x => x.Debit ?? 0), Count = g.Count() })
                            .ToList();
                        break;
                    case "yearly":
                        result = raw.Where(t => t.StartSaleTime.HasValue)
                            .GroupBy(t => t.StartSaleTime!.Value.Year)
                            .OrderBy(g => g.Key)
                            .Select(g => new SalesTrendPointDto { Label = g.Key.ToString(), Amount = g.Sum(x => x.Debit ?? 0), Count = g.Count() })
                            .ToList();
                        break;
                    default:
                        result = raw.Where(t => t.StartSaleTime.HasValue)
                            .GroupBy(t => new { t.StartSaleTime!.Value.Year, t.StartSaleTime.Value.Month })
                            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
                            .Select(g => new SalesTrendPointDto
                            {
                                Label = CultureInfo.CurrentCulture.DateTimeFormat.GetAbbreviatedMonthName(g.Key.Month) + " " + g.Key.Year,
                                Amount = g.Sum(x => x.Debit ?? 0),
                                Count = g.Count()
                            }).ToList();
                        break;
                }

                return new ApiResult<List<SalesTrendPointDto>> { IsSuccess = true, Message = "Sales trend data retrieved successfully.", Response = result };
            }
            catch (Exception ex)
            {
                return new ApiResult<List<SalesTrendPointDto>> { IsSuccess = false, Message = $"Error retrieving sales trend: {ex.Message}", Response = null };
            }
        }

        public async Task<ApiResult<List<RevenueExpenseDto>>> GetRevenueVsExpensesAsync(Guid? storeId = null, DateTime? dateFrom = null, DateTime? dateTo = null)
        {
            try
            {
                var now = DateTime.UtcNow;
                var from = dateFrom ?? new DateTime(now.Year, now.Month, 1).AddMonths(-11);
                var to = dateTo ?? now;

                var txQuery = _context.Transactions.AsNoTracking().Where(t => t.Status == 1);
                if (storeId.HasValue) txQuery = txQuery.Where(t => t.StoreID == storeId.Value);

                var revenue = await txQuery
                    .Where(t => t.StartSaleTime >= from && t.StartSaleTime <= to)
                    .Select(t => new { t.StartSaleTime, t.Debit })
                    .ToListAsync();

                var revenueByMonth = revenue.Where(t => t.StartSaleTime.HasValue)
                    .GroupBy(t => $"{t.StartSaleTime!.Value.Year}-{t.StartSaleTime.Value.Month}")
                    .ToDictionary(g => g.Key, g => g.Sum(x => x.Debit ?? 0));

                var roQuery = _context.ReceiveOrders.AsNoTracking();
                if (storeId.HasValue) roQuery = roQuery.Where(r => r.StoreID == storeId.Value);

                var expenses = await roQuery
                    .Where(r => r.ReceiveOrderDate >= from && r.ReceiveOrderDate <= to)
                    .Select(r => new { r.ReceiveOrderDate, r.Total })
                    .ToListAsync();

                var expensesByMonth = expenses.Where(r => r.ReceiveOrderDate.HasValue)
                    .GroupBy(r => $"{r.ReceiveOrderDate!.Value.Year}-{r.ReceiveOrderDate.Value.Month}")
                    .ToDictionary(g => g.Key, g => g.Sum(x => x.Total ?? 0));

                var result = new List<RevenueExpenseDto>();
                for (var m = new DateTime(from.Year, from.Month, 1); m <= new DateTime(to.Year, to.Month, 1); m = m.AddMonths(1))
                {
                    var key = $"{m.Year}-{m.Month}";
                    result.Add(new RevenueExpenseDto
                    {
                        Month = CultureInfo.CurrentCulture.DateTimeFormat.GetAbbreviatedMonthName(m.Month) + " " + m.Year,
                        Revenue = revenueByMonth.GetValueOrDefault(key, 0),
                        Expenses = expensesByMonth.GetValueOrDefault(key, 0)
                    });
                }

                return new ApiResult<List<RevenueExpenseDto>> { IsSuccess = true, Message = "Revenue vs Expenses data retrieved.", Response = result };
            }
            catch (Exception ex)
            {
                return new ApiResult<List<RevenueExpenseDto>> { IsSuccess = false, Message = $"Error: {ex.Message}", Response = null };
            }
        }

        public async Task<ApiResult<List<TopSellingItemDto>>> GetTopSellingItemsAsync(Guid? storeId = null, DateTime? dateFrom = null, DateTime? dateTo = null, int count = 10)
        {
            try
            {
                var now = DateTime.UtcNow;
                var from = dateFrom ?? now.AddMonths(-12);
                var to = dateTo ?? now;

                // Use TransactionEntries joined with Transactions (primary operational tables)
                var query = from te in _context.TransactionEntries.AsNoTracking()
                            join t in _context.Transactions.AsNoTracking() on te.TransactionID equals t.TransactionID
                            where t.Status == 1
                            select new { te, t };

                if (storeId.HasValue) query = query.Where(x => x.t.StoreID == storeId.Value);
                query = query.Where(x => x.t.StartSaleTime >= from && x.t.StartSaleTime <= to);

                var topItems = await query
                    .GroupBy(x => x.te.ItemStoreID)
                    .Select(g => new { ItemStoreId = g.Key, TotalQty = g.Sum(x => x.te.Qty ?? 0), TotalRevenue = g.Sum(x => x.te.Total ?? 0) })
                    .OrderByDescending(x => x.TotalRevenue)
                    .Take(count)
                    .ToListAsync();

                // Lookup item names via ItemStores → ItemMains
                var itemStoreIds = topItems.Where(x => x.ItemStoreId.HasValue).Select(x => x.ItemStoreId!.Value).ToList();
                var itemNameMap = await (from iStore in _context.ItemStores.AsNoTracking()
                                        join item in _context.ItemMains.AsNoTracking() on iStore.ItemNo equals item.ItemID
                                        where itemStoreIds.Contains(iStore.ItemStoreID)
                                        select new { iStore.ItemStoreID, item.Name })
                                       .ToDictionaryAsync(x => x.ItemStoreID, x => x.Name ?? "Unknown");

                var result = topItems.Select(t => new TopSellingItemDto
                {
                    Name = t.ItemStoreId.HasValue && itemNameMap.ContainsKey(t.ItemStoreId.Value) ? itemNameMap[t.ItemStoreId.Value] : "Unknown",
                    TotalQty = t.TotalQty,
                    TotalRevenue = t.TotalRevenue
                }).ToList();

                return new ApiResult<List<TopSellingItemDto>> { IsSuccess = true, Message = "Top selling items retrieved.", Response = result };
            }
            catch (Exception ex)
            {
                return new ApiResult<List<TopSellingItemDto>> { IsSuccess = false, Message = $"Error: {ex.Message}", Response = null };
            }
        }

        public async Task<ApiResult<List<SalesByDepartmentDto>>> GetSalesByDepartmentAsync(Guid? storeId = null, DateTime? dateFrom = null, DateTime? dateTo = null)
        {
            try
            {
                var now = DateTime.UtcNow;
                var from = dateFrom ?? now.AddMonths(-12);
                var to = dateTo ?? now;

                // Use TransactionEntries joined with Transactions (primary operational tables)
                var query = from te in _context.TransactionEntries.AsNoTracking()
                            join t in _context.Transactions.AsNoTracking() on te.TransactionID equals t.TransactionID
                            where t.Status == 1 && te.DepartmentID != null
                            select new { te, t };

                if (storeId.HasValue) query = query.Where(x => x.t.StoreID == storeId.Value);
                query = query.Where(x => x.t.StartSaleTime >= from && x.t.StartSaleTime <= to);

                var byDept = await query
                    .GroupBy(x => x.te.DepartmentID)
                    .Select(g => new { DeptId = g.Key, TotalSales = g.Sum(x => x.te.Total ?? 0) })
                    .OrderByDescending(x => x.TotalSales)
                    .Take(10)
                    .ToListAsync();

                // Lookup department names from DepartmentStores
                var deptIds = byDept.Where(x => x.DeptId.HasValue).Select(x => x.DeptId!.Value).ToList();
                var deptNames = await _context.DepartmentStores.AsNoTracking()
                    .Where(d => deptIds.Contains(d.DepartmentStoreID))
                    .Select(d => new { d.DepartmentStoreID, d.Name })
                    .ToDictionaryAsync(d => d.DepartmentStoreID, d => d.Name ?? "Unknown");

                var result = byDept.Select(d => new SalesByDepartmentDto
                {
                    DepartmentName = d.DeptId.HasValue && deptNames.ContainsKey(d.DeptId.Value) ? deptNames[d.DeptId.Value] : "Other",
                    TotalSales = d.TotalSales
                }).ToList();

                return new ApiResult<List<SalesByDepartmentDto>> { IsSuccess = true, Message = "Sales by department retrieved.", Response = result };
            }
            catch (Exception ex)
            {
                return new ApiResult<List<SalesByDepartmentDto>> { IsSuccess = false, Message = $"Error: {ex.Message}", Response = null };
            }
        }

        public async Task<ApiResult<InvoiceStatusBreakdownDto>> GetInvoiceStatusBreakdownAsync(Guid? storeId = null, DateTime? dateFrom = null, DateTime? dateTo = null)
        {
            try
            {
                var now = DateTime.UtcNow;
                var from = dateFrom ?? now.AddMonths(-12);
                var to = dateTo ?? now;

                var query = _context.Transactions.AsNoTracking();
                if (storeId.HasValue) query = query.Where(t => t.StoreID == storeId.Value);

                var grouped = await query
                    .Where(t => t.StartSaleTime >= from && t.StartSaleTime <= to)
                    .GroupBy(t => t.Status)
                    .Select(g => new { Status = g.Key, Count = g.Count(), Amount = g.Sum(t => t.Debit ?? 0) })
                    .ToListAsync();

                var statuses = grouped.Select(g => new InvoiceStatusItemDto
                {
                    Status = GetTransactionStatus(g.Status),
                    Count = g.Count,
                    Amount = g.Amount
                }).ToList();

                return new ApiResult<InvoiceStatusBreakdownDto>
                {
                    IsSuccess = true,
                    Message = "Invoice status retrieved.",
                    Response = new InvoiceStatusBreakdownDto
                    {
                        Statuses = statuses,
                        TotalCount = statuses.Sum(s => s.Count),
                        TotalAmount = statuses.Sum(s => s.Amount)
                    }
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<InvoiceStatusBreakdownDto> { IsSuccess = false, Message = $"Error: {ex.Message}", Response = null };
            }
        }

        public async Task<ApiResult<PagedResultDto<RecentInvoiceDto>>> GetRecentInvoicesAsync(Guid? storeId = null, DateTime? dateFrom = null, DateTime? dateTo = null, int page = 1, int pageSize = 10)
        {
            try
            {
                var baseQuery = from t in _context.Transactions.AsNoTracking()
                                join c in _context.Customers.AsNoTracking() on t.CustomerID equals c.CustomerID into cj
                                from customer in cj.DefaultIfEmpty()
                                join s in _context.Stores.AsNoTracking() on t.StoreID equals s.StoreID into sj
                                from store in sj.DefaultIfEmpty()
                                select new { Transaction = t, CustomerName = customer != null ? (customer.FirstName + " " + customer.LastName) : null, StoreName = store != null ? store.StoreName : null };

                if (storeId.HasValue) baseQuery = baseQuery.Where(x => x.Transaction.StoreID == storeId.Value);
                if (dateFrom.HasValue) baseQuery = baseQuery.Where(x => x.Transaction.StartSaleTime >= dateFrom.Value);
                // Normalize the end boundary to "start of the next day" so a
                // dateTo of "2026-05-26" includes the full 2026-05-26 day's
                // transactions (matches the convention used by GetKpiCardsAsync
                // and avoids an off-by-one vs the Sales / Revenue widgets).
                if (dateTo.HasValue) baseQuery = baseQuery.Where(x => x.Transaction.StartSaleTime < dateTo.Value.Date.AddDays(1));

                var totalCount = await baseQuery.CountAsync();

                var items = await baseQuery
                    .OrderByDescending(x => x.Transaction.StartSaleTime)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(x => new RecentInvoiceDto
                    {
                        Id = x.Transaction.TransactionID.ToString(),
                        TransactionNo = x.Transaction.TransactionNo ?? "",
                        Customer = x.CustomerName ?? "Walk-in Customer",
                        Amount = x.Transaction.Debit ?? 0,
                        Status = GetTransactionStatus(x.Transaction.Status),
                        Date = x.Transaction.StartSaleTime.HasValue ? x.Transaction.StartSaleTime.Value.ToString("MMM dd, yyyy HH:mm") : "",
                        ItemCount = 0,
                        StoreName = x.StoreName ?? ""
                    })
                    .ToListAsync();

                if (items.Any())
                {
                    var txIds = items.Select(i => Guid.Parse(i.Id)).ToList();
                    var itemCounts = await _context.TransactionEntries.AsNoTracking()
                        .Where(e => e.TransactionID.HasValue && txIds.Contains(e.TransactionID.Value))
                        .GroupBy(e => e.TransactionID)
                        .Select(g => new { TxId = g.Key, Count = g.Count() })
                        .ToDictionaryAsync(x => x.TxId!.Value, x => x.Count);

                    foreach (var item in items)
                        if (Guid.TryParse(item.Id, out var txId) && itemCounts.TryGetValue(txId, out var cnt))
                            item.ItemCount = cnt;
                }

                return new ApiResult<PagedResultDto<RecentInvoiceDto>>
                {
                    IsSuccess = true,
                    Message = "Recent invoices retrieved.",
                    Response = new PagedResultDto<RecentInvoiceDto>
                    {
                        Items = items,
                        TotalCount = totalCount,
                        Page = page,
                        PageSize = pageSize,
                        TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                    }
                };
            }
            catch (Exception ex)
            {
                return new ApiResult<PagedResultDto<RecentInvoiceDto>> { IsSuccess = false, Message = $"Error: {ex.Message}", Response = null };
            }
        }

        public async Task<ApiResult<PurchaseOverviewDto>> GetPurchaseOverviewAsync(Guid? storeId = null, DateTime? dateFrom = null, DateTime? dateTo = null)
        {
            try
            {
                var query = _context.PurchaseOrders.AsNoTracking();
                if (storeId.HasValue) query = query.Where(p => p.StoreNo == storeId.Value);
                if (dateFrom.HasValue) query = query.Where(p => p.PurchaseOrderDate >= dateFrom.Value);
                // Same end-boundary normalization as GetKpiCards / RecentInvoices —
                // include the full dateTo day rather than only midnight of it.
                if (dateTo.HasValue) query = query.Where(p => p.PurchaseOrderDate < dateTo.Value.Date.AddDays(1));

                var grouped = await query
                    .GroupBy(p => p.POStatus)
                    .Select(g => new { Status = g.Key, Count = g.Count(), Amount = g.Sum(p => p.GrandTotal ?? 0) })
                    .ToListAsync();

                var overview = new PurchaseOverviewDto();
                foreach (var g in grouped)
                {
                    switch (g.Status)
                    {
                        case 0: overview.PendingCount = g.Count; overview.PendingAmount = g.Amount; break;
                        case 1: overview.PartialCount = g.Count; overview.PartialAmount = g.Amount; break;
                        case 2: overview.CompletedCount = g.Count; overview.CompletedAmount = g.Amount; break;
                        case 3: overview.CancelledCount = g.Count; overview.CancelledAmount = g.Amount; break;
                    }
                }
                overview.TotalCount = grouped.Sum(g => g.Count);
                overview.TotalAmount = grouped.Sum(g => g.Amount);

                return new ApiResult<PurchaseOverviewDto> { IsSuccess = true, Message = "Purchase overview retrieved.", Response = overview };
            }
            catch (Exception ex)
            {
                return new ApiResult<PurchaseOverviewDto> { IsSuccess = false, Message = $"Error: {ex.Message}", Response = null };
            }
        }

        public async Task<ApiResult<List<LowStockItemDto>>> GetLowStockItemsAsync(Guid? storeId = null, int count = 20)
        {
            try
            {
                var query = from iStore in _context.ItemStores.AsNoTracking()
                            join item in _context.ItemMains.AsNoTracking() on iStore.ItemNo equals item.ItemID
                            join store in _context.Stores.AsNoTracking() on iStore.StoreNo equals store.StoreID into sj
                            from store in sj.DefaultIfEmpty()
                            where iStore.ReorderPoint > 0 && iStore.OnHand < iStore.ReorderPoint && (iStore.Status == 0 || iStore.Status == null)
                            select new { iStore, item, store };

                if (storeId.HasValue) query = query.Where(x => x.iStore.StoreNo == storeId.Value);

                var result = await query
                    .OrderBy(x => x.iStore.OnHand - x.iStore.ReorderPoint)
                    .Take(count)
                    .Select(x => new LowStockItemDto
                    {
                        ItemName = x.item.Name ?? "Unknown",
                        CurrentQty = x.iStore.OnHand ?? 0,
                        ReorderLevel = x.iStore.ReorderPoint ?? 0,
                        StoreName = x.store != null ? x.store.StoreName ?? "" : "",
                        Cost = x.iStore.Cost ?? 0,
                        Price = x.iStore.Price ?? 0
                    })
                    .ToListAsync();

                return new ApiResult<List<LowStockItemDto>> { IsSuccess = true, Message = "Low stock items retrieved.", Response = result };
            }
            catch (Exception ex)
            {
                return new ApiResult<List<LowStockItemDto>> { IsSuccess = false, Message = $"Error: {ex.Message}", Response = null };
            }
        }

        public async Task<ApiResult<CustomerAgingDto>> GetCustomerAgingAsync(Guid? storeId = null)
        {
            try
            {
                // Customer entity has no StoreID column. Scope by store via an EXISTS
                // check against Transactions — i.e. customers that have at least one
                // transaction recorded at this store. Without storeId we fall back
                // to tenant-wide aging (existing behavior).
                var customers = _context.Customers.AsNoTracking()
                    .Where(c => c.BalanceDoe > 0);
                if (storeId.HasValue)
                {
                    customers = customers.Where(c =>
                        _context.Transactions.Any(t =>
                            t.CustomerID == c.CustomerID && t.StoreID == storeId.Value));
                }

                var aging = await customers
                    .GroupBy(c => 1)
                    .Select(g => new CustomerAgingDto
                    {
                        Current = g.Sum(c => c.Current ?? 0),
                        Over30 = g.Sum(c => c.Over30 ?? 0),
                        Over60 = g.Sum(c => c.Over60 ?? 0),
                        Over90 = g.Sum(c => c.Over90 ?? 0),
                        Over120 = g.Sum(c => c.Over120 ?? 0),
                        Total = g.Sum(c => c.BalanceDoe ?? 0),
                        CustomerCount = g.Count()
                    })
                    .FirstOrDefaultAsync();

                return new ApiResult<CustomerAgingDto> { IsSuccess = true, Message = "Customer aging retrieved.", Response = aging ?? new CustomerAgingDto() };
            }
            catch (Exception ex)
            {
                return new ApiResult<CustomerAgingDto> { IsSuccess = false, Message = $"Error: {ex.Message}", Response = null };
            }
        }

        public async Task<ApiResult<SupplierAgingDto>> GetSupplierAgingAsync(Guid? storeId = null)
        {
            try
            {
                var now = DateTime.UtcNow;
                // PaymentToVentor has no StoreID column. Scope by store via an
                // EXISTS check against PurchaseOrders — i.e. payments to vendors
                // that have at least one PO at this store. Without storeId we
                // keep the tenant-wide payables list.
                var payablesQuery = _context.PaymentToVentors.AsNoTracking()
                    .Where(p => p.OpenBalance > 0);
                if (storeId.HasValue)
                {
                    payablesQuery = payablesQuery.Where(p =>
                        p.PID.HasValue &&
                        _context.PurchaseOrders.Any(po =>
                            po.SupplierNo == p.PID.Value && po.StoreNo == storeId.Value));
                }
                var payables = await payablesQuery
                    .Select(p => new { p.OpenBalance, p.DAteT })
                    .ToListAsync();

                var aging = new SupplierAgingDto();
                foreach (var p in payables)
                {
                    var balance = p.OpenBalance ?? 0;
                    var daysOld = p.DAteT.HasValue ? (now - p.DAteT.Value).Days : 0;

                    if (daysOld <= 30) aging.Current += balance;
                    else if (daysOld <= 60) aging.Over30 += balance;
                    else if (daysOld <= 90) aging.Over60 += balance;
                    else if (daysOld <= 120) aging.Over90 += balance;
                    else aging.Over120 += balance;
                }
                aging.Total = aging.Current + aging.Over30 + aging.Over60 + aging.Over90 + aging.Over120;
                aging.SupplierCount = payables.Count;

                return new ApiResult<SupplierAgingDto> { IsSuccess = true, Message = "Supplier aging retrieved.", Response = aging };
            }
            catch (Exception ex)
            {
                return new ApiResult<SupplierAgingDto> { IsSuccess = false, Message = $"Error: {ex.Message}", Response = null };
            }
        }

        public async Task<ApiResult<List<DashboardNotificationDto>>> GetNotificationsAsync(Guid? storeId = null)
        {
            try
            {
                var notifications = new List<DashboardNotificationDto>();
                var now = DateTime.UtcNow;
                var ts = now.ToString("yyyy-MM-ddTHH:mm:ss");

                var lowStockQuery = _context.ItemStores.AsNoTracking()
                    .Where(i => i.ReorderPoint > 0 && i.OnHand < i.ReorderPoint && (i.Status == 0 || i.Status == null));
                if (storeId.HasValue) lowStockQuery = lowStockQuery.Where(i => i.StoreNo == storeId.Value);

                var lowStockCount = await lowStockQuery.CountAsync();
                if (lowStockCount > 0)
                    notifications.Add(new DashboardNotificationDto { Type = "low_stock", Title = "Low Stock Alert", Message = $"{lowStockCount} item(s) below reorder level.", Severity = lowStockCount > 10 ? "error" : "warning", Timestamp = ts });

                var oosQuery = _context.ItemStores.AsNoTracking()
                    .Where(i => i.OnHand <= 0 && (i.Status == 0 || i.Status == null));
                if (storeId.HasValue) oosQuery = oosQuery.Where(i => i.StoreNo == storeId.Value);
                var outOfStock = await oosQuery.CountAsync();
                if (outOfStock > 0)
                    notifications.Add(new DashboardNotificationDto { Type = "out_of_stock", Title = "Out of Stock", Message = $"{outOfStock} item(s) out of stock.", Severity = "error", Timestamp = ts });

                // Overdue payments — scope by store via Transactions join so
                // the count matches the rest of the dashboard's store filter.
                // Customers have no direct StoreID, so we EXISTS-check against
                // their transactions at this store.
                var overdueQuery = _context.Customers.AsNoTracking()
                    .Where(c => c.Over90 > 0 || c.Over120 > 0);
                if (storeId.HasValue)
                {
                    overdueQuery = overdueQuery.Where(c =>
                        _context.Transactions.Any(t =>
                            t.CustomerID == c.CustomerID && t.StoreID == storeId.Value));
                }
                var overdueCount = await overdueQuery.CountAsync();
                if (overdueCount > 0)
                    notifications.Add(new DashboardNotificationDto { Type = "overdue_payment", Title = "Overdue Payments", Message = $"{overdueCount} customer(s) with 90+ day overdue payments.", Severity = "error", Timestamp = ts });

                var pendingPOQuery = _context.PurchaseOrders.AsNoTracking()
                    .Where(p => p.Approved == false && (p.POStatus == 0 || p.POStatus == 1));
                if (storeId.HasValue) pendingPOQuery = pendingPOQuery.Where(p => p.StoreNo == storeId.Value);
                var pendingApprovals = await pendingPOQuery.CountAsync();
                if (pendingApprovals > 0)
                    notifications.Add(new DashboardNotificationDto { Type = "pending_approval", Title = "Pending Approvals", Message = $"{pendingApprovals} purchase order(s) awaiting approval.", Severity = "warning", Timestamp = ts });

                // Supplier payables — same EXISTS pattern as KpiCards/SupplierAging,
                // scoped via PurchaseOrders.SupplierNo == PaymentToVentor.PID at storeId.
                var supplierPayQuery = _context.PaymentToVentors.AsNoTracking()
                    .Where(p => p.OpenBalance > 0);
                if (storeId.HasValue)
                {
                    supplierPayQuery = supplierPayQuery.Where(p =>
                        p.PID.HasValue &&
                        _context.PurchaseOrders.Any(po =>
                            po.SupplierNo == p.PID.Value && po.StoreNo == storeId.Value));
                }
                var payablesDue = await supplierPayQuery.CountAsync();
                if (payablesDue > 0)
                {
                    var totalPayables = await supplierPayQuery.SumAsync(p => p.OpenBalance ?? 0);
                    notifications.Add(new DashboardNotificationDto { Type = "supplier_payable", Title = "Supplier Payables", Message = $"{payablesDue} pending payment(s) totaling {totalPayables:C}.", Severity = "info", Timestamp = ts });
                }

                return new ApiResult<List<DashboardNotificationDto>> { IsSuccess = true, Message = "Notifications retrieved.", Response = notifications };
            }
            catch (Exception ex)
            {
                return new ApiResult<List<DashboardNotificationDto>> { IsSuccess = false, Message = $"Error: {ex.Message}", Response = null };
            }
        }

        private static string GetTransactionStatus(short? status)
        {
            return status switch
            {
                0 => "Pending",
                1 => "Completed",
                2 => "Cancelled",
                3 => "Voided",
                _ => "Unknown"
            };
        }
    }
}
