using AutoMapper;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Reports;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;

namespace BackOffice.Persistence.Services.Tenant
{
    /// <summary>
    /// Service for report generation
    /// Based on VB.NET report logic from RepTaxCollected, etc.
    /// </summary>
    public class ReportService : IReportService
    {
        private readonly IUnitOfWorkTenant _unitOfWork;
        private readonly IMapper _mapper;
        private readonly TenantDBContext _dbContext;

        public ReportService(IUnitOfWorkTenant unitOfWork, IMapper mapper, TenantDBContext dbContext)
        {
            _unitOfWork = unitOfWork;
            _mapper = mapper;
            _dbContext = dbContext;
        }

        /// <summary>
        /// Gets Tax Collected report data with pagination and filters
        /// Based on VB.NET RepTaxCollected - calls SP_GetTaxCollected stored procedure
        /// </summary>
        public ApiResponse<TaxCollectedResponseDto> GetTaxCollectedReport(TaxCollectedRequestDto request)
        {
            try
            {
                // Parse filters from the request
                var filters = new List<FilterCondition>();
                if (!string.IsNullOrEmpty(request.Filters))
                {
                    try
                    {
                        filters = JsonConvert.DeserializeObject<List<FilterCondition>>(request.Filters) ?? new List<FilterCondition>();
                    }
                    catch
                    {
                        // Ignore filter parsing errors
                    }
                }

                // Build the filter string for the stored procedure (similar to VB.NET FilterInstances)
                var filterParts = new List<string>();

                // Apply date filters
                if (request.FromDate.HasValue)
                {
                    var fromDate = request.FromDate.Value.ToString("yyyy-MM-dd");
                    filterParts.Add($"AND EndSaleTime >= '{fromDate}'");
                }

                if (request.ToDate.HasValue)
                {
                    var toDate = request.ToDate.Value.Date.AddDays(1).ToString("yyyy-MM-dd");
                    filterParts.Add($"AND EndSaleTime < '{toDate}'");
                }

                // Apply store filter if provided
                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                {
                    filterParts.Add($"AND StoreID = '{request.StoreId.Value}'");
                }

                var filterString = string.Join(" ", filterParts);
                var customerFilter = ""; // Not using customer filter for now

                // Call the stored procedure
                var spResults = _dbContext.Procedures.SP_GetTaxCollectedAsync(filterString, customerFilter).GetAwaiter().GetResult();

                // Get store names lookup
                var storeIds = spResults.Where(r => r.StoreID.HasValue).Select(r => r.StoreID!.Value).Distinct().ToList();
                var storeNames = _dbContext.StoreViews
                    .Where(s => storeIds.Contains(s.StoreID))
                    .ToDictionary(s => s.StoreID, s => s.StoreName ?? string.Empty);

                // Map SP results to DTOs
                var allData = spResults.Select(r => new TaxCollectedDto
                {
                    TransactionNo = r.TransactionNo ?? string.Empty,
                    TransactionID = r.TransactionID,
                    StoreName = r.StoreID.HasValue && storeNames.ContainsKey(r.StoreID.Value)
                        ? storeNames[r.StoreID.Value]
                        : string.Empty,
                    StoreID = r.StoreID ?? Guid.Empty,
                    Date = r.Date ?? DateTime.MinValue,
                    TaxRate = (r.TaxRate ?? 0) * 100, // SP returns as decimal (0.032), convert to percentage (3.2)
                    TaxSum = r.TaxSum ?? 0,
                    CustomerNo = r.CustomerNo ?? string.Empty,
                    CustomerName = r.CustomerName ?? string.Empty,
                    TotalSale = r.TotalSale ?? 0,
                    Payment = r.Payment ?? string.Empty,
                    TaxName = r.TaxName ?? string.Empty
                }).ToList();

                // Apply dynamic filters from grid (in-memory filtering)
                IEnumerable<TaxCollectedDto> filteredData = allData;
                foreach (var filter in filters)
                {
                    filteredData = ApplyInMemoryFilter(filteredData, filter);
                }
                var filteredList = filteredData.ToList();

                // Apply sorting
                if (!string.IsNullOrEmpty(request.SortColumn))
                {
                    var isDescending = request.SortDirection?.ToLower() == "desc";
                    filteredList = ApplyInMemorySorting(filteredList, request.SortColumn, isDescending);
                }
                else
                {
                    // Default sort by date descending
                    filteredList = filteredList.OrderByDescending(x => x.Date).ToList();
                }

                // Get total count before pagination
                var totalRecords = filteredList.Count;

                // Calculate summary totals (on full dataset before pagination)
                var totalTaxSum = filteredList.Sum(x => x.TaxSum);
                var totalSale = filteredList.Sum(x => x.TotalSale);

                // Apply pagination
                var pageSize = request.EndRow - request.StartRow;
                if (pageSize <= 0) pageSize = 100;

                var data = filteredList
                    .Skip(request.StartRow)
                    .Take(pageSize)
                    .ToList();

                var response = new TaxCollectedResponseDto
                {
                    Data = data,
                    TotalRecords = totalRecords,
                    TotalTaxSum = totalTaxSum,
                    TotalSale = totalSale
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<TaxCollectedResponseDto>($"Failed to generate Tax Collected report: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Tax By Store report - same pattern as Tax Collected: pagination, sort, in-memory filter, then return Data/TotalRecords/TotalTaxSum/TotalSale
        /// </summary>
        public async Task<ApiResponse<TaxByStoreResponseDto>> GetTaxByStoreReportAsync(TaxByStoreRequestDto request)
        {
            try
            {
                request ??= new TaxByStoreRequestDto();
                var filters = new List<FilterCondition>();
                if (!string.IsNullOrEmpty(request.Filters))
                {
                    try
                    {
                        filters = JsonConvert.DeserializeObject<List<FilterCondition>>(request.Filters) ?? new List<FilterCondition>();
                    }
                    catch { /* ignore */ }
                }

                var startDate = request.FromDate ?? DateTime.Today.AddYears(-1);
                var endDate = request.ToDate ?? DateTime.Today.AddDays(1);
                if (endDate.Date == endDate && endDate.TimeOfDay == TimeSpan.Zero)
                    endDate = endDate.AddDays(1);
                var storeId = request.StoreId == Guid.Empty ? (Guid?)null : request.StoreId;

                var spResults = await _dbContext.Procedures.SP_GetTaxReprtByStoreAsync(startDate, endDate, storeId);

                var allData = spResults.Select(r => new TaxByStoreDto
                {
                    StoreName = r.StoreName ?? string.Empty,
                    TaxRate = (r.TaxRate ?? 0) * 100,
                    TotalSales = r.TotalSales ?? 0,
                    TaxableSales = r.TaxbleSales ?? 0,
                    TotalExempt = r.TotalExempt ?? 0,
                    NonTaxableSales = r.NoonTaxbleSales ?? 0,
                    Tax = r.Tax ?? 0
                }).ToList();

                IEnumerable<TaxByStoreDto> filteredData = allData;
                foreach (var filter in filters)
                    filteredData = ApplyTaxByStoreFilter(filteredData, filter);
                var filteredList = filteredData.ToList();

                if (!string.IsNullOrEmpty(request.SortColumn))
                {
                    var isDesc = request.SortDirection?.ToLower() == "desc";
                    filteredList = ApplyTaxByStoreSort(filteredList, request.SortColumn, isDesc);
                }
                else
                    filteredList = filteredList.OrderBy(x => x.StoreName).ToList();

                var totalRecords = filteredList.Count;
                var totalTaxSum = filteredList.Sum(x => x.Tax);
                var totalSale = filteredList.Sum(x => x.TotalSales);
                var totalTaxableSales = filteredList.Sum(x => x.TaxableSales);
                var totalExempt = filteredList.Sum(x => x.TotalExempt);
                var totalNonTaxableSales = filteredList.Sum(x => x.NonTaxableSales);

                var pageSize = request.EndRow - request.StartRow;
                if (pageSize <= 0) pageSize = 100;
                var data = filteredList.Skip(request.StartRow).Take(pageSize).ToList();

                var response = new TaxByStoreResponseDto
                {
                    Data = data,
                    TotalRecords = totalRecords,
                    TotalTaxSum = totalTaxSum,
                    TotalSale = totalSale,
                    TotalTaxableSales = totalTaxableSales,
                    TotalExempt = totalExempt,
                    TotalNonTaxableSales = totalNonTaxableSales
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<TaxByStoreResponseDto>($"Failed to generate Tax By Store report: {ex.Message}");
            }
        }

        private static IEnumerable<TaxByStoreDto> ApplyTaxByStoreFilter(IEnumerable<TaxByStoreDto> data, FilterCondition filter)
        {
            if (string.IsNullOrEmpty(filter.Col) || string.IsNullOrEmpty(filter.Value)) return data;
            var value = filter.Value.ToLower();
            var col = filter.Col.ToLower();
            var typ = filter.Type?.ToLower() ?? "contains";

            return col switch
            {
                "storename" => typ == "equals"
                    ? data.Where(x => (x.StoreName ?? "").ToLower() == value)
                    : data.Where(x => (x.StoreName ?? "").ToLower().Contains(value)),
                "taxrate" => data.Where(x => x.TaxRate.ToString("F2", System.Globalization.CultureInfo.InvariantCulture).Contains(value)),
                "totalsales" => data.Where(x => x.TotalSales.ToString("F2", System.Globalization.CultureInfo.InvariantCulture).Contains(value)),
                "taxablesales" => data.Where(x => x.TaxableSales.ToString("F2", System.Globalization.CultureInfo.InvariantCulture).Contains(value)),
                "totalexempt" => data.Where(x => x.TotalExempt.ToString("F2", System.Globalization.CultureInfo.InvariantCulture).Contains(value)),
                "nontaxablesales" => data.Where(x => x.NonTaxableSales.ToString("F2", System.Globalization.CultureInfo.InvariantCulture).Contains(value)),
                "tax" => data.Where(x => x.Tax.ToString("F2", System.Globalization.CultureInfo.InvariantCulture).Contains(value)),
                _ => data
            };
        }

        private static List<TaxByStoreDto> ApplyTaxByStoreSort(List<TaxByStoreDto> data, string column, bool descending)
        {
            return column.ToLower() switch
            {
                "storename" => descending ? data.OrderByDescending(x => x.StoreName).ToList() : data.OrderBy(x => x.StoreName).ToList(),
                "taxrate" => descending ? data.OrderByDescending(x => x.TaxRate).ToList() : data.OrderBy(x => x.TaxRate).ToList(),
                "totalsales" => descending ? data.OrderByDescending(x => x.TotalSales).ToList() : data.OrderBy(x => x.TotalSales).ToList(),
                "taxablesales" => descending ? data.OrderByDescending(x => x.TaxableSales).ToList() : data.OrderBy(x => x.TaxableSales).ToList(),
                "totalexempt" => descending ? data.OrderByDescending(x => x.TotalExempt).ToList() : data.OrderBy(x => x.TotalExempt).ToList(),
                "nontaxablesales" => descending ? data.OrderByDescending(x => x.NonTaxableSales).ToList() : data.OrderBy(x => x.NonTaxableSales).ToList(),
                "tax" => descending ? data.OrderByDescending(x => x.Tax).ToList() : data.OrderBy(x => x.Tax).ToList(),
                _ => descending ? data.OrderByDescending(x => x.StoreName).ToList() : data.OrderBy(x => x.StoreName).ToList()
            };
        }

        private IEnumerable<TaxCollectedDto> ApplyInMemoryFilter(IEnumerable<TaxCollectedDto> data, FilterCondition filter)
        {
            if (string.IsNullOrEmpty(filter.Col) || string.IsNullOrEmpty(filter.Value))
                return data;

            var value = filter.Value.ToLower();

            return filter.Col.ToLower() switch
            {
                "transactionno" => filter.Type?.ToLower() switch
                {
                    "contains" => data.Where(x => x.TransactionNo.ToLower().Contains(value)),
                    "equals" => data.Where(x => x.TransactionNo.ToLower() == value),
                    "startswith" => data.Where(x => x.TransactionNo.ToLower().StartsWith(value)),
                    "endswith" => data.Where(x => x.TransactionNo.ToLower().EndsWith(value)),
                    _ => data.Where(x => x.TransactionNo.ToLower().Contains(value))
                },
                "storename" => filter.Type?.ToLower() switch
                {
                    "contains" => data.Where(x => x.StoreName.ToLower().Contains(value)),
                    "equals" => data.Where(x => x.StoreName.ToLower() == value),
                    _ => data.Where(x => x.StoreName.ToLower().Contains(value))
                },
                "customerno" => filter.Type?.ToLower() switch
                {
                    "contains" => data.Where(x => x.CustomerNo.ToLower().Contains(value)),
                    "equals" => data.Where(x => x.CustomerNo.ToLower() == value),
                    _ => data.Where(x => x.CustomerNo.ToLower().Contains(value))
                },
                "customername" => filter.Type?.ToLower() switch
                {
                    "contains" => data.Where(x => x.CustomerName.ToLower().Contains(value)),
                    "equals" => data.Where(x => x.CustomerName.ToLower() == value),
                    _ => data.Where(x => x.CustomerName.ToLower().Contains(value))
                },
                "taxname" => filter.Type?.ToLower() switch
                {
                    "contains" => data.Where(x => x.TaxName.ToLower().Contains(value)),
                    "equals" => data.Where(x => x.TaxName.ToLower() == value),
                    _ => data.Where(x => x.TaxName.ToLower().Contains(value))
                },
                "payment" => filter.Type?.ToLower() switch
                {
                    "contains" => data.Where(x => x.Payment.ToLower().Contains(value)),
                    "equals" => data.Where(x => x.Payment.ToLower() == value),
                    _ => data.Where(x => x.Payment.ToLower().Contains(value))
                },
                _ => data
            };
        }

        private List<TaxCollectedDto> ApplyInMemorySorting(List<TaxCollectedDto> data, string column, bool descending)
        {
            return column.ToLower() switch
            {
                "transactionno" => descending ? data.OrderByDescending(x => x.TransactionNo).ToList() : data.OrderBy(x => x.TransactionNo).ToList(),
                "storename" => descending ? data.OrderByDescending(x => x.StoreName).ToList() : data.OrderBy(x => x.StoreName).ToList(),
                "date" => descending ? data.OrderByDescending(x => x.Date).ToList() : data.OrderBy(x => x.Date).ToList(),
                "taxrate" => descending ? data.OrderByDescending(x => x.TaxRate).ToList() : data.OrderBy(x => x.TaxRate).ToList(),
                "taxsum" => descending ? data.OrderByDescending(x => x.TaxSum).ToList() : data.OrderBy(x => x.TaxSum).ToList(),
                "customerno" => descending ? data.OrderByDescending(x => x.CustomerNo).ToList() : data.OrderBy(x => x.CustomerNo).ToList(),
                "customername" => descending ? data.OrderByDescending(x => x.CustomerName).ToList() : data.OrderBy(x => x.CustomerName).ToList(),
                "totalsale" => descending ? data.OrderByDescending(x => x.TotalSale).ToList() : data.OrderBy(x => x.TotalSale).ToList(),
                "payment" => descending ? data.OrderByDescending(x => x.Payment).ToList() : data.OrderBy(x => x.Payment).ToList(),
                "taxname" => descending ? data.OrderByDescending(x => x.TaxName).ToList() : data.OrderBy(x => x.TaxName).ToList(),
                _ => descending ? data.OrderByDescending(x => x.Date).ToList() : data.OrderBy(x => x.Date).ToList()
            };
        }

        /// <summary>
        /// Gets Returned Items report data with pagination and filters.
        /// Mirrors legacy VB logic: uses SP_GetReturnItemsByItem and the same Filter string format.
        /// </summary>
        public ApiResponse<ReturnedItemsResponseDto> GetReturnedItemsReport(ReturnedItemsRequestDto request)
        {
            var allData = new List<ReturnedItemsDto>();
            try
            {
                // Build filter the same way as legacy GetReturnItemFilter:
                //   And dbo.[Transaction].StartSaleTime >= FromDate
                //   And dbo.[Transaction].StartSaleTime < ToDate+1
                //   And StoreID = '<storeId>'
                var filter = string.Empty;
                if (request.FromDate.HasValue)
                {
                    filter += $" And dbo.[Transaction].StartSaleTime>='{request.FromDate.Value:yyyy-MM-dd}'";
                }
                if (request.ToDate.HasValue)
                {
                    var toDateExclusive = request.ToDate.Value.Date.AddDays(1);
                    filter += $" And dbo.[Transaction].StartSaleTime<'{toDateExclusive:yyyy-MM-dd}'";
                }
                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                {
                    filter += $" And StoreID = '{request.StoreId.Value}'";
                }
                // Desktop FillReturnByItem always appends this; without it we return more rows than desktop.
                // When no reason filter: only rows where Note is empty OR SystemValues.SystemValueName is null.
                const string reason = "";
                filter += " and  (TransactionEntryView.Note = '" + reason + "' Or ('" + reason + "' ='' and dbo.SystemValues.SystemValueName is null))";
                if (string.IsNullOrWhiteSpace(filter))
                {
                    // Legacy code sends an empty string when no filters are applied
                    filter = string.Empty;
                }

                var conn = _dbContext.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open)
                    conn.Open();

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "[dbo].[SP_GetReturnItemsByItem]";
                    cmd.CommandType = CommandType.StoredProcedure;

                    var pFilter = cmd.CreateParameter();
                    pFilter.ParameterName = "@Filter";
                    pFilter.Value = (object?)filter ?? DBNull.Value;
                    pFilter.DbType = DbType.String;
                    cmd.Parameters.Add(pFilter);

                    var pItem = cmd.CreateParameter();
                    pItem.ParameterName = "@ItemFilter";
                    pItem.Value = "";
                    pItem.DbType = DbType.String;
                    cmd.Parameters.Add(pItem);

                    var pCust = cmd.CreateParameter();
                    pCust.ParameterName = "@CustomerFilter";
                    pCust.Value = "";
                    pCust.DbType = DbType.String;
                    cmd.Parameters.Add(pCust);

                    var storeIds = new List<Guid>();
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            var dto = ReadReturnItemRow(reader);
                            if (dto != null)
                            {
                                allData.Add(dto);
                                if (dto.StoreId.HasValue)
                                    storeIds.Add(dto.StoreId.Value);
                            }
                        }
                    }

                    // Deduplicate: SP can return duplicate rows (e.g. from JOINs); keep one per logical row
                    var seen = new HashSet<string>(StringComparer.Ordinal);
                    var deduped = new List<ReturnedItemsDto>();
                    foreach (var d in allData)
                    {
                        var key = $"{d.TransactionId}|{d.StoreId}|{d.ItemCode}|{d.Date?.ToString("O")}|{d.QuantityReturned}|{d.Amount}";
                        if (seen.Add(key))
                        {
                            d.Id = Guid.NewGuid();
                            deduped.Add(d);
                        }
                    }
                    allData = deduped;

                    // Club (aggregate) values by Item (Name) and UPC: one row per Store + Name + UPC with summed Qty and Amount
                    var grouped = allData
                        .GroupBy(d => new { d.StoreId, Name = d.Name ?? "", Upc = d.Upc ?? d.ItemCode ?? "" })
                        .Select(g =>
                        {
                            var first = g.First();
                            return new ReturnedItemsDto
                            {
                                Id = Guid.NewGuid(),
                                StoreId = first.StoreId,
                                StoreName = first.StoreName,
                                Name = first.Name,
                                Upc = first.Upc,
                                ItemCode = first.ItemCode,
                                ModelNumber = first.ModelNumber,
                                ReturnReason = first.ReturnReason,
                                SupplierName = first.SupplierName,
                                Department = first.Department,
                                StyleNo = first.StyleNo,
                                QuantityReturned = g.Sum(x => x.QuantityReturned ?? 0),
                                Amount = g.Sum(x => x.Amount ?? 0),
                                Date = first.Date,
                                TransactionNo = first.TransactionNo,
                                TransactionId = first.TransactionId,
                                Description = first.Description,
                                CustomerName = first.CustomerName,
                            };
                        })
                        .ToList();
                    allData = grouped;

                    // Reader must be closed before using the same connection (e.g. StoreViews)
                    if (storeIds.Count > 0)
                    {
                        var distinctIds = storeIds.Distinct().ToList();
                        var storeNames = _dbContext.StoreViews
                            .Where(s => distinctIds.Contains(s.StoreID))
                            .ToDictionary(s => s.StoreID, s => s.StoreName ?? "");

                        foreach (var d in allData)
                        {
                            if (d.StoreId.HasValue && storeNames.TryGetValue(d.StoreId.Value, out var name))
                                d.StoreName = name;
                        }
                    }
                }

                var totalRecords = allData.Count;
                var pageSize = request.EndRow - request.StartRow;
                if (pageSize <= 0) pageSize = 100;
                var data = allData.Skip(request.StartRow).Take(pageSize).ToList();
                return ApiResponseFactory.Success(new ReturnedItemsResponseDto { Data = data, TotalRecords = totalRecords });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ReturnedItemsResponseDto>($"Returned Items report: {ex.Message}");
            }
        }

        private static ReturnedItemsDto? ReadReturnItemRow(System.Data.Common.DbDataReader reader)
        {
            try
            {
                var getStrByName = (string name) =>
                {
                    for (var i = 0; i < reader.FieldCount; i++)
                        if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                            return reader.IsDBNull(i) ? "" : reader.GetValue(i)?.ToString() ?? "";
                    return "";
                };
                var getDateByName = (string name) =>
                {
                    for (var i = 0; i < reader.FieldCount; i++)
                        if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                            return reader.IsDBNull(i) ? (DateTime?)null : reader.GetDateTime(i);
                    return (DateTime?)null;
                };
                var getDecByName = (string name) =>
                {
                    for (var i = 0; i < reader.FieldCount; i++)
                        if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                        {
                            if (reader.IsDBNull(i)) return (decimal?)null;
                            var v = reader.GetValue(i);
                            if (v is decimal d) return d;
                            if (v != null && decimal.TryParse(v.ToString(), out var d2)) return d2;
                            return (decimal?)null;
                        }
                    return (decimal?)null;
                };
                var getGuidByName = (string name) =>
                {
                    for (var i = 0; i < reader.FieldCount; i++)
                        if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                            return reader.IsDBNull(i) ? (Guid?)null : reader.GetGuid(i);
                    return (Guid?)null;
                };

                return new ReturnedItemsDto
                {
                    // Desktop‑visible columns (desktop grid binds UPC to ItemCode from SP_GetReturnItemsByItem)
                    Name = getStrByName("Name"),
                    Upc = getStrByName("ItemCode") ?? getStrByName("UPC"),
                    ModelNumber = getStrByName("ModalNumber") ?? getStrByName("ModelNumber"),
                    ReturnReason = getStrByName("ReturnReason"),
                    SupplierName = getStrByName("SuppName") ?? getStrByName("SupplierName"),
                    QuantityReturned = getDecByName("QuantityReturned") ?? getDecByName("Qty"),
                    Amount = getDecByName("Amount") ?? getDecByName("Total"),
                    Department = getStrByName("Department") ?? getStrByName("DepName"),
                    StyleNo = getStrByName("StyleNo") ?? getStrByName("Style"),

                    // Supporting fields
                    TransactionId = getGuidByName("TransactionID"),
                    TransactionNo = getStrByName("TransactionNo"),
                    StoreName = getStrByName("StoreName"),
                    StoreId = getGuidByName("StoreID"),
                    Date = getDateByName("ReturnDate") ?? getDateByName("Date"),
                    ItemCode = getStrByName("ItemCode"),
                    Description = getStrByName("Description"),
                    CustomerName = getStrByName("CustomerName")
                };
            }
            catch { return null; }
        }

        /// <summary>
        /// Builds an IN filter fragment matching VB BuildINFilter (Queries.vb): " And ColumnName In('v1','v2' ) "
        /// (space before closing paren to match desktop).
        /// </summary>
        private static string BuildPriceChangeInFilter(string columnName, IList<string> values)
        {
            if (values == null || values.Count == 0) return "";
            var quoted = values.Where(v => !string.IsNullOrEmpty(v)).Select(v => "'" + v.Replace("'", "''") + "'").ToList();
            if (quoted.Count == 0) return "";
            return " And " + columnName + " In(" + string.Join(",", quoted) + " ) ";
        }

        /// <summary>
        /// Reads one row from the second result set of SP_GetPriceChange into PriceChangeHistoryDto.
        /// Uses column names from the SP (e.g. BarcodeNumber or Barcode).
        /// </summary>
        private static PriceChangeHistoryDto? ReadPriceChangeHistoryRow(System.Data.Common.DbDataReader reader)
        {
            try
            {
                string getStr(string name)
                {
                    for (var i = 0; i < reader.FieldCount; i++)
                        if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                            return reader.IsDBNull(i) ? "" : reader.GetValue(i)?.ToString() ?? "";
                    return "";
                }
                DateTime? getDate(string name)
                {
                    for (var i = 0; i < reader.FieldCount; i++)
                        if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                            return reader.IsDBNull(i) ? (DateTime?)null : reader.GetDateTime(i);
                    return null;
                }
                decimal? getDec(string name)
                {
                    for (var i = 0; i < reader.FieldCount; i++)
                        if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                        {
                            if (reader.IsDBNull(i)) return null;
                            var v = reader.GetValue(i);
                            if (v is decimal d) return d;
                            if (v != null && decimal.TryParse(v.ToString(), out var d2)) return d2;
                            return null;
                        }
                    return null;
                }
                Guid? getGuid(string name)
                {
                    for (var i = 0; i < reader.FieldCount; i++)
                        if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                            return reader.IsDBNull(i) ? (Guid?)null : reader.GetGuid(i);
                    return null;
                }

                var itemId = getGuid("ItemID");
                if (!itemId.HasValue) return null;

                return new PriceChangeHistoryDto
                {
                    ItemStoreID = getGuid("ItemStoreID"),
                    ItemID = itemId.Value,
                    PriceLevel = getStr("PriceLevel"),
                    OldPrice = getDec("OldPrice"),
                    NewPrice = getDec("NewPrice"),
                    ChangeDate = getDate("ChangeDate"),
                    SaleDate = getStr("SaleDate"),
                    SaleType = getStr("SaleType"),
                    SP_Price = getStr("SP_Price"),
                    Department = getStr("Department"),
                    Name = getStr("Name"),
                    ModalNumber = getStr("ModalNumber"),
                    BarcodeNumber = getStr("BarcodeNumber").Length > 0 ? getStr("BarcodeNumber") : getStr("Barcode"),
                    Brand = getStr("Brand"),
                    UserName = getStr("UserName")
                };
            }
            catch { return null; }
        }

        /// <summary>
        /// Gets Items (inventory) report with pagination and store/department/search filters.
        /// Uses ItemsMainAndStoreGrid view and maps to ItemsReportDto.
        /// </summary>
        public ApiResponse<ItemsReportResponseDto> GetItemsReport(ItemsReportRequestDto request)
        {
            try
            {
                var query = _unitOfWork.ItemsMainAndStoreGrids.GetAll().AsQueryable();

                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    query = query.Where(x => x.StoreNo == request.StoreId.Value);

                if (request.DepartmentId.HasValue && request.DepartmentId.Value != Guid.Empty)
                    query = query.Where(x => x.DepartmentID == request.DepartmentId.Value);

                // Exclude items with null or empty department
                query = query.Where(x => x.Department != null && x.Department.Trim() != "");

                if (!string.IsNullOrWhiteSpace(request.SearchText))
                {
                    var term = request.SearchText.Trim().ToLower();
                    query = query.Where(x =>
                        (x.ModalNumber != null && x.ModalNumber.ToLower().Contains(term)) ||
                        (x.BarcodeNumber != null && x.BarcodeNumber.ToLower().Contains(term)) ||
                        (x.Name != null && x.Name.ToLower().Contains(term)) ||
                        (x.Description != null && x.Description.ToLower().Contains(term)));
                }

                var filteredCount = query.Count();

                var sortColumn = request.SortColumn ?? "ModalNumber";
                var sortDirection = (request.SortDirection ?? "asc").ToLowerInvariant() == "desc" ? "desc" : "asc";
                var sortColumnMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    { "itemNo", "ModalNumber" },
                    { "barcode", "BarcodeNumber" },
                    { "description", "Description" },
                    { "departmentName", "Department" },
                    { "itemGroupName", "Groups" },
                    { "cost", "Cost" },
                    { "retailPrice", "Price" },
                    { "qtyOnHand", "OnHand" },
                    { "reorderPoint", "ReorderPoint" },
                    { "isActive", "Status" },
                    { "itemTypeName", "ItemTypeName" },
                    { "storeName", "StoreName" },
                    { "dateCreated", "DateCreated" }
                };
                if (sortColumnMap.TryGetValue(sortColumn, out var entityCol))
                    sortColumn = entityCol;

                query = SortHelper.ApplySorting(query, sortColumn, sortDirection);

                var start = request.StartRow;
                var take = Math.Max(0, request.EndRow - request.StartRow);
                var page = query.Skip(start).Take(take).ToList();

                var data = page.Select(x => new ItemsReportDto
                {
                    ItemStoreId = x.ItemStoreID,
                    ItemId = x.ItemID,
                    ItemNo = x.ModalNumber ?? x.CustomerCode ?? x.ItemStoreID.ToString(),
                    Barcode = x.BarcodeNumber ?? "",
                    Description = x.Description ?? x.Name ?? "",
                    DepartmentName = x.Department ?? "",
                    DepartmentId = x.DepartmentID,
                    ItemGroupName = x.Groups ?? "",
                    ItemGroupId = null,
                    ManufacturerName = x.Brand ?? "",
                    ManufacturerId = null,
                    VendorName = x.SupplierName ?? "",
                    VendorId = null,
                    Cost = x.Cost ?? 0,
                    RetailPrice = x.Price,
                    QtyOnHand = x.OnHand,
                    ReorderPoint = x.ReorderPoint,
                    IsActive = (x.Status ?? x.MainStatus ?? 0) != 0,
                    ItemTypeName = x.ItemTypeName ?? "",
                    UomName = "",
                    StoreName = x.StoreName ?? "",
                    StoreId = x.StoreNo,
                    DateCreated = x.DateCreated
                }).ToList();

                var response = new ItemsReportResponseDto
                {
                    Data = data,
                    TotalRecords = filteredCount,
                    TotalQtyOnHand = data.Sum(x => x.QtyOnHand),
                    TotalRetailValue = data.Sum(x => x.RetailPrice * x.QtyOnHand),
                    TotalCostValue = data.Sum(x => x.Cost * x.QtyOnHand),
                    ActiveItemCount = data.Count(x => x.IsActive),
                    InactiveItemCount = data.Count(x => !x.IsActive)
                };

                return ApiResponseFactory.Success(response, "Items report fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemsReportResponseDto>("Error fetching items report.", new List<string> { ex.Message });
            }
        }

        /// <summary>
        /// Gets Department Inventory report: one row per store+department with aggregated item count and values.
        /// </summary>
        public ApiResponse<DepartmentInventoryResponseDto> GetDepartmentInventoryReport(DepartmentInventoryRequestDto request)
        {
            try
            {
                var query = _unitOfWork.ItemsMainAndStoreGrids.GetAll().AsQueryable();

                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    query = query.Where(x => x.StoreNo == request.StoreId.Value);

                if (request.DepartmentId.HasValue && request.DepartmentId.Value != Guid.Empty)
                    query = query.Where(x => x.DepartmentID == request.DepartmentId.Value);

                var grouped = query
                    .GroupBy(x => new { x.StoreNo, x.StoreName, x.DepartmentID, DepartmentName = x.Department ?? "" })
                    .Select(g => new DepartmentInventoryDto
                    {
                        StoreId = g.Key.StoreNo,
                        StoreName = g.Key.StoreName ?? "",
                        DepartmentId = g.Key.DepartmentID,
                        DepartmentName = g.Key.DepartmentName,
                        ItemCount = g.Count(),
                        TotalQtyOnHand = g.Sum(x => x.OnHand),
                        TotalRetailValue = g.Sum(x => x.Price * x.OnHand),
                        TotalCostValue = g.Sum(x => (x.Cost ?? 0) * x.OnHand)
                    })
                    .OrderBy(x => x.StoreName)
                    .ThenBy(x => x.DepartmentName)
                    .ToList();

                var totalRecords = grouped.Count;
                var start = request.StartRow;
                var take = Math.Max(0, request.EndRow - request.StartRow);
                var page = grouped.Skip(start).Take(take).ToList();

                var response = new DepartmentInventoryResponseDto
                {
                    Data = page,
                    TotalRecords = totalRecords,
                    GrandTotalQtyOnHand = grouped.Sum(x => x.TotalQtyOnHand),
                    GrandTotalRetailValue = grouped.Sum(x => x.TotalRetailValue),
                    GrandTotalCostValue = grouped.Sum(x => x.TotalCostValue)
                };

                return ApiResponseFactory.Success(response, "Department inventory report fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<DepartmentInventoryResponseDto>("Error fetching department inventory report.", new List<string> { ex.Message });
            }
        }

        /// <summary>
        /// Gets Item Inventory Summary report: one row per item with aggregated totals (excludes null/empty department).
        /// </summary>
        public ApiResponse<ItemInventorySummaryResponseDto> GetItemInventorySummaryReport(ItemInventorySummaryRequestDto request)
        {
            try
            {
                var query = _unitOfWork.ItemsMainAndStoreGrids.GetAll().AsQueryable();

                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    query = query.Where(x => x.StoreNo == request.StoreId.Value);

                if (request.DepartmentId.HasValue && request.DepartmentId.Value != Guid.Empty)
                    query = query.Where(x => x.DepartmentID == request.DepartmentId.Value);

                query = query.Where(x => x.Department != null && x.Department.Trim() != "");

                // Materialize filtered data first to avoid EF translation issues with GroupBy + First()
                var list = query.ToList();

                var grouped = list
                    .GroupBy(x => x.ItemID)
                    .Select(g =>
                    {
                        var first = g.First();
                        return new ItemInventorySummaryDto
                        {
                            ItemId = g.Key,
                            ItemNo = first.ModalNumber ?? first.CustomerCode ?? g.Key.ToString(),
                            ItemName = first.Description ?? first.Name ?? "",
                            DepartmentName = first.Department ?? "",
                            ItemCount = g.Count(),
                            TotalQtyOnHand = g.Sum(x => x.OnHand),
                            TotalRetailValue = g.Sum(x => x.Price * x.OnHand),
                            TotalCostValue = g.Sum(x => (x.Cost ?? 0) * x.OnHand)
                        };
                    })
                    .OrderBy(x => x.ItemName)
                    .ThenBy(x => x.ItemNo)
                    .ToList();

                var totalRecords = grouped.Count;
                var start = request.StartRow;
                var take = Math.Max(0, request.EndRow - request.StartRow);
                var page = grouped.Skip(start).Take(take).ToList();

                var response = new ItemInventorySummaryResponseDto
                {
                    Data = page,
                    TotalRecords = totalRecords,
                    GrandTotalQtyOnHand = grouped.Sum(x => x.TotalQtyOnHand),
                    GrandTotalRetailValue = grouped.Sum(x => x.TotalRetailValue),
                    GrandTotalCostValue = grouped.Sum(x => x.TotalCostValue)
                };

                return ApiResponseFactory.Success(response, "Item inventory summary report fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemInventorySummaryResponseDto>("Error fetching item inventory summary report.", new List<string> { ex.Message });
            }
        }

        /// <summary>
        /// Gets Departments Valuation report (same logic as desktop): calls SP_GetDepartments when available;
        /// falls back to LINQ on ItemMainAndStoreGrid view when the SP is missing or fails.
        /// </summary>
        public async Task<ApiResponse<DepartmentsValuationResponseDto>> GetDepartmentsValuationReportAsync(DepartmentsValuationRequestDto request)
        {
            try
            {
                List<DepartmentsValuationRowDto> data;
                try
                {
                    var list = await _dbContext.Procedures.Sp_GetDepartmentsAsync(
                        request.StoreId,
                        request.AsOfDate);

                    data = list.Select(r => new DepartmentsValuationRowDto
                    {
                        MainDepartment = r.MainDepartment ?? "",
                        SubDepartment = r.SubDepartment ?? "",
                        SubSubDepartment = r.SubSubDepartment ?? "",
                        DepartmentStoreID = r.DepartmentStoreID,
                        Name = r.Name ?? "",
                        OnHand = r.OnHand ?? 0,
                        OnOrder = r.OnOrder ?? 0,
                        OnSaleOrder = 0,
                        Cost = r.Cost ?? 0,
                        AVGCost = r.AVGCost ?? 0,
                        Price = r.Price ?? 0,
                        StoreName = r.StoreName ?? "",
                        StoreID = r.StoreID
                    }).ToList();
                }
                catch
                {
                    // Fallback: build from ItemMainAndStoreGrid view when SP is missing or fails (e.g. SP_GetDepartments not in tenant DB)
                    data = GetDepartmentsValuationFromView(request);
                }

                var response = new DepartmentsValuationResponseDto
                {
                    Data = data,
                    TotalRecords = data.Count,
                    GrandTotalOnHand = data.Sum(x => x.OnHand),
                    GrandTotalOnOrder = data.Sum(x => x.OnOrder),
                    GrandTotalOnSaleOrder = data.Sum(x => x.OnSaleOrder),
                    GrandTotalCost = data.Sum(x => x.Cost),
                    GrandTotalAVGCost = data.Sum(x => x.AVGCost),
                    GrandTotalPrice = data.Sum(x => x.Price)
                };

                return ApiResponseFactory.Success(response, "Departments valuation report fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<DepartmentsValuationResponseDto>("Error fetching departments valuation report.", new List<string> { ex.Message });
            }
        }

        /// <summary>
        /// Gets Price Change History report using SP_GetPriceChange (Filter + ItemFilter).
        /// Filter and ItemFilter logic match the desktop app (VB Queries.vb GetChangePrice, GetFilterString, GetFilterDate,
        /// GetFilterArray, BuildINFilter, BuildDepartmentFilter). SP is expected to use "WHERE 1=1 " + @Filter and
        /// "Where (1=1) " + @ItemFilter. ItemFilter " And 1=1 " ensures #ItemSelect is created so DROP succeeds. Date range bounded.
        /// </summary>
        public async Task<ApiResponse<PriceChangeHistoryResponseDto>> GetPriceChangeHistoryReportAsync(PriceChangeHistoryRequestDto request)
        {
            try
            {
                request ??= new PriceChangeHistoryRequestDto();

                // Bound date range to avoid SP timeout: require a range, default last 31 days, max 366 days
                const int maxDays = 366;
                var toDate = request.ToDate ?? DateTime.Today;
                var fromDate = request.FromDate ?? toDate.AddDays(-31);
                if (fromDate > toDate)
                    fromDate = toDate.AddDays(-31);
                var rangeDays = (toDate.Date - fromDate.Date).Days;
                if (rangeDays > maxDays)
                    fromDate = toDate.AddDays(-maxDays);

                // Filter is concatenated as "WHERE " + @Filter in the SP, so the first predicate must NOT start with " And "
                // (otherwise "WHERE And [Date]=..." is invalid). First clause: " [Date]>="; rest match VB BuildINFilter: " And Col In(... ) "
                var filter = " AND [Date]>='" + fromDate.ToString("yyyy-MM-dd") + "'";
                filter += " And [Date]<'" + toDate.Date.AddDays(1).ToString("yyyy-MM-dd") + "'";
                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    filter += BuildPriceChangeInFilter("StoreNo", new[] { request.StoreId.Value.ToString() });
                if (request.UserIds != null && request.UserIds.Count > 0)
                    filter += BuildPriceChangeInFilter("UserID", request.UserIds.Select(id => id.ToString()).ToList());
                // BuildDepartmentFilter: " And DepartmentID In(...) "; optionally expand with SP_GetSubDepartments when IncludeSubDepartments
                var departmentIdsForFilter = request.DepartmentIds != null && request.DepartmentIds.Count > 0
                    ? new List<Guid>(request.DepartmentIds)
                    : new List<Guid>();
                if (request.IncludeSubDepartments && departmentIdsForFilter.Count > 0)
                {
                    var expanded = new List<Guid>();
                    foreach (var deptId in departmentIdsForFilter)
                    {
                        expanded.Add(deptId);
                        var subs = await _dbContext.Procedures.SP_GetSubDepartmentsAsync(deptId);
                        if (subs != null)
                            foreach (var row in subs)
                                if (row.MAINID.HasValue) expanded.Add(row.MAINID.Value);
                    }
                    departmentIdsForFilter = expanded.Distinct().ToList();
                }
                if (departmentIdsForFilter.Count > 0)
                    filter += BuildPriceChangeInFilter("DepartmentID", departmentIdsForFilter.Select(id => id.ToString()).ToList());

                // ItemFilter: VB passes "" when no items; we pass " And 1=1 " so SP creates #ItemSelect and DROP succeeds.
                const string itemFilter = " And 1=1 ";

                // SP_GetPriceChange can return one or two result sets. Try first result set; if empty, read second (desktop may use either order).
                List<PriceChangeHistoryDto> allData;
                var previousTimeout = _dbContext.Database.GetCommandTimeout();
                _dbContext.Database.SetCommandTimeout(120);
                try
                {
                    var conn = _dbContext.Database.GetDbConnection();
                    if (conn.State != ConnectionState.Open)
                        await conn.OpenAsync();

                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.CommandText = "[dbo].[SP_GetPriceChange]";
                        cmd.CommandType = CommandType.StoredProcedure;
                        cmd.CommandTimeout = 120;

                        var pFilter = cmd.CreateParameter();
                        pFilter.ParameterName = "Filter";
                        pFilter.Value = (object?)filter ?? DBNull.Value;
                        pFilter.DbType = DbType.String;
                        cmd.Parameters.Add(pFilter);

                        var pItemFilter = cmd.CreateParameter();
                        pItemFilter.ParameterName = "ItemFilter";
                        pItemFilter.Value = itemFilter;
                        pItemFilter.DbType = DbType.String;
                        cmd.Parameters.Add(pItemFilter);

                        allData = new List<PriceChangeHistoryDto>();
                        using (var reader = await ((System.Data.Common.DbCommand)cmd).ExecuteReaderAsync())
                        {
                            // Read first result set
                            while (await reader.ReadAsync())
                            {
                                var dto = ReadPriceChangeHistoryRow(reader);
                                if (dto != null)
                                    allData.Add(dto);
                            }
                            // If first set had no report rows, try second result set (some SP versions put report data in second set)
                            if (allData.Count == 0 && await reader.NextResultAsync())
                            {
                                while (await reader.ReadAsync())
                                {
                                    var dto = ReadPriceChangeHistoryRow(reader);
                                    if (dto != null)
                                        allData.Add(dto);
                                }
                            }
                        }
                    }
                }
                finally
                {
                    _dbContext.Database.SetCommandTimeout(previousTimeout);
                }

                var filters = new List<FilterCondition>();
                if (!string.IsNullOrEmpty(request.Filters))
                {
                    try
                    {
                        filters = JsonConvert.DeserializeObject<List<FilterCondition>>(request.Filters) ?? new List<FilterCondition>();
                    }
                    catch { /* ignore */ }
                }

                IEnumerable<PriceChangeHistoryDto> filteredData = allData;
                foreach (var f in filters)
                    filteredData = ApplyPriceChangeHistoryFilter(filteredData, f);
                var filteredList = filteredData.ToList();

                if (!string.IsNullOrEmpty(request.SortColumn))
                {
                    var isDesc = request.SortDirection?.ToLower() == "desc";
                    filteredList = ApplyPriceChangeHistorySort(filteredList, request.SortColumn, isDesc);
                }
                else
                    filteredList = filteredList.OrderByDescending(x => x.ChangeDate).ToList();

                var totalRecords = filteredList.Count;
                var pageSize = request.EndRow - request.StartRow;
                if (pageSize <= 0) pageSize = 100;
                var data = filteredList.Skip(request.StartRow).Take(pageSize).ToList();

                var response = new PriceChangeHistoryResponseDto
                {
                    Data = data,
                    TotalRecords = totalRecords
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PriceChangeHistoryResponseDto>($"Failed to generate Price Change History report: {ex.Message}");
            }
        }

        private static IEnumerable<PriceChangeHistoryDto> ApplyPriceChangeHistoryFilter(IEnumerable<PriceChangeHistoryDto> data, FilterCondition f)
        {
            if (string.IsNullOrEmpty(f.Col) || string.IsNullOrEmpty(f.Value)) return data;
            var value = f.Value.ToLower();
            var col = f.Col.ToLower();
            var typ = f.Type?.ToLower() ?? "contains";

            return col switch
            {
                "name" => typ == "equals" ? data.Where(x => (x.Name ?? "").ToLower() == value) : data.Where(x => (x.Name ?? "").ToLower().Contains(value)),
                "modalnumber" => typ == "equals" ? data.Where(x => (x.ModalNumber ?? "").ToLower() == value) : data.Where(x => (x.ModalNumber ?? "").ToLower().Contains(value)),
                "barcodenumber" => typ == "equals" ? data.Where(x => (x.BarcodeNumber ?? "").ToLower() == value) : data.Where(x => (x.BarcodeNumber ?? "").ToLower().Contains(value)),
                "pricelevel" => typ == "equals" ? data.Where(x => (x.PriceLevel ?? "").ToLower() == value) : data.Where(x => (x.PriceLevel ?? "").ToLower().Contains(value)),
                "department" => typ == "equals" ? data.Where(x => (x.Department ?? "").ToLower() == value) : data.Where(x => (x.Department ?? "").ToLower().Contains(value)),
                "brand" => typ == "equals" ? data.Where(x => (x.Brand ?? "").ToLower() == value) : data.Where(x => (x.Brand ?? "").ToLower().Contains(value)),
                "username" => typ == "equals" ? data.Where(x => (x.UserName ?? "").ToLower() == value) : data.Where(x => (x.UserName ?? "").ToLower().Contains(value)),
                _ => data
            };
        }

        private static List<PriceChangeHistoryDto> ApplyPriceChangeHistorySort(List<PriceChangeHistoryDto> data, string column, bool descending)
        {
            return column.ToLower() switch
            {
                "changedate" => descending ? data.OrderByDescending(x => x.ChangeDate).ToList() : data.OrderBy(x => x.ChangeDate).ToList(),
                "name" => descending ? data.OrderByDescending(x => x.Name).ToList() : data.OrderBy(x => x.Name).ToList(),
                "modalnumber" => descending ? data.OrderByDescending(x => x.ModalNumber).ToList() : data.OrderBy(x => x.ModalNumber).ToList(),
                "pricelevel" => descending ? data.OrderByDescending(x => x.PriceLevel).ToList() : data.OrderBy(x => x.PriceLevel).ToList(),
                "oldprice" => descending ? data.OrderByDescending(x => x.OldPrice).ToList() : data.OrderBy(x => x.OldPrice).ToList(),
                "newprice" => descending ? data.OrderByDescending(x => x.NewPrice).ToList() : data.OrderBy(x => x.NewPrice).ToList(),
                "department" => descending ? data.OrderByDescending(x => x.Department).ToList() : data.OrderBy(x => x.Department).ToList(),
                "username" => descending ? data.OrderByDescending(x => x.UserName).ToList() : data.OrderBy(x => x.UserName).ToList(),
                _ => data.OrderByDescending(x => x.ChangeDate).ToList()
            };
        }

        /// <summary>
        /// Builds Departments Valuation data from ItemMainAndStoreGrid view (fallback when SP_GetDepartments is not available).
        /// Optimized: grouping and aggregation run in the database; only aggregated rows are materialized.
        /// </summary>
        private List<DepartmentsValuationRowDto> GetDepartmentsValuationFromView(DepartmentsValuationRequestDto request)
        {
            var query = _dbContext.ItemMainAndStoreGrids.AsNoTracking().AsQueryable();

            if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                query = query.Where(x => x.StoreNo == request.StoreId.Value);

            query = query.Where(x => x.Department != null && x.Department.Trim() != "");

            // Run GroupBy + aggregates in DB; project to anonymous type to avoid complex expressions in SQL
            var aggregated = query
                .GroupBy(x => new
                {
                    x.StoreNo,
                    StoreName = x.StoreName ?? "",
                    DepartmentID = x.DepartmentID,
                    DepartmentName = x.Department ?? "",
                    MainDepartment = x.MainDepartment ?? "",
                    SubDepartment = x.SubDepartment ?? "",
                    SubSubDepartment = x.SubSubDepartment ?? ""
                })
                .Select(g => new
                {
                    g.Key,
                    OnHand = g.Sum(x => x.OnHand),
                    OnOrder = g.Sum(x => x.OnOrder),
                    CostSum = g.Sum(x => (x.Cost ?? 0) * x.OnHand),
                    AvgCostWeighted = g.Sum(x => (x.AVGCost ?? 0) * x.OnHand),
                    PriceSum = g.Sum(x => x.Price * x.OnHand)
                })
                .OrderBy(x => x.Key.MainDepartment).ThenBy(x => x.Key.SubDepartment).ThenBy(x => x.Key.SubSubDepartment).ThenBy(x => x.Key.DepartmentName).ThenBy(x => x.Key.StoreName)
                .ToList();

            // Lightweight in-memory projection (weighted avg for AVGCost)
            return aggregated.Select(a => new DepartmentsValuationRowDto
            {
                MainDepartment = a.Key.MainDepartment,
                SubDepartment = a.Key.SubDepartment,
                SubSubDepartment = a.Key.SubSubDepartment,
                DepartmentStoreID = a.Key.DepartmentID,
                Name = a.Key.DepartmentName,
                OnHand = a.OnHand,
                OnOrder = a.OnOrder,
                OnSaleOrder = 0,
                Cost = a.CostSum,
                AVGCost = a.OnHand > 0 ? a.AvgCostWeighted / a.OnHand : 0,
                Price = a.PriceSum,
                StoreName = a.Key.StoreName,
                StoreID = a.Key.StoreNo
            }).ToList();
        }

        /// <summary>
        /// Items in Partial Receive report - Sp_rptOpenPartialPO. Filter format matches desktop RepPartialPO GetFilter.
        /// </summary>
        public async Task<ApiResponse<ItemsInPartialReceiveResponseDto>> GetItemsInPartialReceiveReportAsync(ItemsInPartialReceiveRequestDto request)
        {
            try
            {
                var parts = new List<string>();

                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    parts.Add($"PurchaseOrdersView.StoreNo ='{request.StoreId.Value}'");

                if (request.FromDate.HasValue)
                    parts.Add($"dbo.GetDay(PurchaseOrderDate)>='{request.FromDate.Value:yyyy-MM-dd}'");
                if (request.ToDate.HasValue)
                    parts.Add($"dbo.GetDay(PurchaseOrderDate)<='{request.ToDate.Value:yyyy-MM-dd}'");

                if (!string.IsNullOrWhiteSpace(request.DepartmentIds))
                {
                    var ids = request.DepartmentIds.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                        .Select(x => x.Trim())
                        .Where(x => Guid.TryParse(x, out _))
                        .Select(x => $"'{x}'")
                        .ToList();
                    if (ids.Count > 0)
                        parts.Add($"DepartmentID IN({string.Join(",", ids)})");
                }

                if (!string.IsNullOrWhiteSpace(request.SupplierIds))
                {
                    var ids = request.SupplierIds.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                        .Select(x => x.Trim())
                        .Where(x => Guid.TryParse(x, out _))
                        .Select(x => $"'{x}'")
                        .ToList();
                    if (ids.Count > 0)
                        parts.Add($"ItemStoreID in(SELECT ItemStoreNo FROM ItemSupply where SupplierNo in({string.Join(",", ids)}))");
                }

                if (!string.IsNullOrWhiteSpace(request.BrandNames))
                {
                    var names = request.BrandNames.Split(new[] { '|' }, StringSplitOptions.RemoveEmptyEntries)
                        .Select(x => x.Trim().Replace("'", "''"))
                        .Where(x => x.Length > 0)
                        .Select(x => $"'{x}'")
                        .ToList();
                    if (names.Count > 0)
                        parts.Add($"Brand IN({string.Join(",", names)})");
                }

                var filter = parts.Count > 0 ? " AND " + string.Join(" AND ", parts) : "";

                List<ItemsInPartialReceiveRowDto> data;
                try
                {
                    var conn = _dbContext.Database.GetDbConnection();
                    if (conn.State != ConnectionState.Open)
                        await conn.OpenAsync();

                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.CommandText = "[dbo].[Sp_rptOpenPartialPO]";
                        cmd.CommandType = CommandType.StoredProcedure;
                        cmd.CommandTimeout = 120;

                        var pFilter = cmd.CreateParameter();
                        pFilter.ParameterName = "@Filter";
                        pFilter.Value = filter ?? "";
                        pFilter.DbType = DbType.String;
                        pFilter.Size = -1;
                        cmd.Parameters.Add(pFilter);

                        data = new List<ItemsInPartialReceiveRowDto>();
                        using (var reader = await ((System.Data.Common.DbCommand)cmd).ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                var dto = ReadItemsInPartialReceiveRow(reader);
                                if (dto != null)
                                    data.Add(dto);
                            }
                            if (data.Count == 0 && await reader.NextResultAsync())
                            {
                                while (await reader.ReadAsync())
                                {
                                    var dto = ReadItemsInPartialReceiveRow(reader);
                                    if (dto != null)
                                        data.Add(dto);
                                }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException($"Sp_rptOpenPartialPO failed: {ex.Message}", ex);
                }

                var response = new ItemsInPartialReceiveResponseDto
                {
                    Data = data,
                    TotalRecords = data.Count
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemsInPartialReceiveResponseDto>($"Failed to generate Items in Partial Receive report: {ex.Message}");
            }
        }

        /// <summary>
        /// Get column index by name (case-insensitive), or try alternate names. Returns -1 if not found.
        /// </summary>
        private static int GetColumnIndex(System.Data.Common.DbDataReader reader, params string[] names)
        {
            for (var i = 0; i < reader.FieldCount; i++)
            {
                var name = reader.GetName(i);
                foreach (var n in names)
                {
                    if (string.Equals(name, n, StringComparison.OrdinalIgnoreCase))
                        return i;
                }
            }
            return -1;
        }

        private static ItemsInPartialReceiveRowDto? ReadItemsInPartialReceiveRow(System.Data.Common.DbDataReader reader)
        {
            try
            {
                static string S(System.Data.Common.DbDataReader r, params string[] cols)
                {
                    var i = GetColumnIndex(r, cols);
                    if (i < 0) return "";
                    return r.IsDBNull(i) ? "" : r.GetString(i);
                }
                static decimal? N(System.Data.Common.DbDataReader r, params string[] cols)
                {
                    var i = GetColumnIndex(r, cols);
                    if (i < 0) return null;
                    if (r.IsDBNull(i)) return null;
                    var v = r.GetValue(i);
                    if (v == null) return null;
                    if (v is decimal d) return d;
                    if (v is double dbl) return (decimal)dbl;
                    if (v is int n) return n;
                    if (v is long l) return l;
                    if (v is float f) return (decimal)f;
                    return decimal.TryParse(v.ToString(), out var parsed) ? parsed : null;
                }
                static Guid? G(System.Data.Common.DbDataReader r, params string[] cols)
                {
                    var i = GetColumnIndex(r, cols);
                    if (i < 0) return null;
                    if (r.IsDBNull(i)) return null;
                    var val = r.GetValue(i);
                    if (val is Guid g) return g;
                    if (val is string s && Guid.TryParse(s, out var parsed)) return parsed;
                    return null;
                }
                static DateTime? D(System.Data.Common.DbDataReader r, params string[] cols)
                {
                    var i = GetColumnIndex(r, cols);
                    if (i < 0) return null;
                    if (r.IsDBNull(i)) return null;
                    var v = r.GetValue(i);
                    if (v == null) return null;
                    if (v is DateTime dt) return dt;
                    return DateTime.TryParse(v.ToString(), out var parsed) ? parsed : (DateTime?)null;
                }

                return new ItemsInPartialReceiveRowDto
                {
                    StoreName = S(reader, "StoreName"),
                    StoreID = G(reader, "StoreID", "StoreNo"),
                    PurchaseOrderDate = D(reader, "PurchaseOrderDate"),
                    PoNo = S(reader, "PoNo"),
                    SupplierNo = S(reader, "SupplierNo"),
                    SupplierName = S(reader, "SupplierName"),
                    UPC = S(reader, "UPC"),
                    QtyOrdered = N(reader, "QtyOrdered"),
                    ReceivedQty = N(reader, "ReceivedQty"),
                    ModalNumber = S(reader, "ModalNumber"),
                    ItemName = S(reader, "ItemName", "Name"),
                    Department = S(reader, "Department"),
                    ItemStoreID = G(reader, "ItemStoreID", "ItemStoreNo"),
                    ItemID = G(reader, "ItemID"),
                    Brand = S(reader, "Brand"),
                    TotalCost = N(reader, "TotalCost"),
                    TotalPrice = N(reader, "TotalPrice"),
                    Groups = S(reader, "Groups")
                };
            }
            catch
            {
                return null;
            }
        }

        private class FilterCondition
        {
            public string Col { get; set; } = string.Empty;
            public string Type { get; set; } = string.Empty;
            public string Value { get; set; } = string.Empty;
            public string OperatorType { get; set; } = "and";
        }
    }
}
