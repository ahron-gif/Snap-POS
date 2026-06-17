using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.ItemOnPhoneOrder;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Infrastructure.DBContext.Tenant;

namespace BackOffice.Persistence.Services.Tenant
{
    public class ItemOnPhoneOrderService : IItemOnPhoneOrderService
    {
        private readonly TenantDBContext _dbContext;

        public ItemOnPhoneOrderService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<ApiResponse<PaginationResponseDTO<ItemOnPhoneOrderGridDto>>> GetItemsOnPhoneOrderAsync(
            PaginationGridDto pagination, string? phoneStatus, bool aggregated)
        {
            try
            {
                var filterString = BuildFilterString(pagination, phoneStatus);

                if (aggregated)
                {
                    return await GetAggregatedDataAsync(filterString, pagination);
                }
                else
                {
                    return await GetNormalDataAsync(filterString, pagination);
                }
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<ItemOnPhoneOrderGridDto>>(
                    "Error fetching items on phone order.",
                    new List<string> { ex.Message });
            }
        }

        private async Task<ApiResponse<PaginationResponseDTO<ItemOnPhoneOrderGridDto>>> GetNormalDataAsync(
            string filterString, PaginationGridDto pagination)
        {
            var returnValue = new OutputParameter<int>();
            var spResults = await _dbContext.Procedures.Rpt_ItemOnPhoneOrderAsync(filterString, returnValue);

            var allItems = spResults.Select(r => new ItemOnPhoneOrderGridDto
            {
                Qty = r.Qty,
                Name = r.Name,
                ModalNumber = r.ModalNumber,
                BarcodeNumber = r.BarcodeNumber,
                Cost = r.Cost,
                Price = r.Price,
                OnHand = r.OnHand,
                ItemStoreID = r.ItemStoreID,
                PhoneOrderType = r.PhoneOrderType,
                StoreNo = r.StoreNo,
                StoreName = r.StoreName
            }).ToList();

            // Apply in-memory text search
            if (!string.IsNullOrWhiteSpace(pagination.CustomGridSearchText))
            {
                var search = pagination.CustomGridSearchText.Trim().ToLower();
                allItems = allItems.Where(i =>
                    (i.Name != null && i.Name.ToLower().Contains(search)) ||
                    (i.BarcodeNumber != null && i.BarcodeNumber.ToLower().Contains(search)) ||
                    (i.ModalNumber != null && i.ModalNumber.ToLower().Contains(search)) ||
                    (i.PhoneOrderType != null && i.PhoneOrderType.ToLower().Contains(search)) ||
                    (i.StoreName != null && i.StoreName.ToLower().Contains(search))
                ).ToList();
            }

            var totalRecords = allItems.Count;

            // Apply in-memory sorting
            allItems = ApplySorting(allItems, pagination.SortColumn ?? "Name", pagination.SortDirection ?? "asc");

            // Apply pagination
            var pageSize = pagination.EndRow - pagination.StartRow;
            var paginatedData = allItems
                .Skip(pagination.StartRow)
                .Take(pageSize)
                .ToList();

            var response = new PaginationResponseDTO<ItemOnPhoneOrderGridDto>
            {
                TotalRecords = totalRecords,
                RecordsFiltered = totalRecords,
                CurrentPage = pagination.StartRow > 0 ? (int)Math.Ceiling((double)pagination.EndRow / pageSize) : 1,
                PageSize = pageSize,
                Data = paginatedData
            };

            return ApiResponseFactory.Success(response, "Items on phone order fetched successfully.");
        }

        private async Task<ApiResponse<PaginationResponseDTO<ItemOnPhoneOrderGridDto>>> GetAggregatedDataAsync(
            string filterString, PaginationGridDto pagination)
        {
            var returnValue = new OutputParameter<int>();
            var spResults = await _dbContext.Procedures.Rpt_ItemOnPhoneOrder_AggregatedAsync(filterString, returnValue);

            // Map aggregated results to the normal DTO (store fields will be empty)
            var allItems = spResults.Select(r => new ItemOnPhoneOrderGridDto
            {
                Qty = r.Qty,
                Name = r.Name,
                ModalNumber = r.ModalNumber,
                BarcodeNumber = r.BarcodeNumber,
                Cost = r.Cost,
                Price = r.Price,
                OnHand = r.OnHand,
                PhoneOrderType = r.PhoneOrderType,
                // Store fields remain default for aggregated view
            }).ToList();

            // Apply in-memory text search
            if (!string.IsNullOrWhiteSpace(pagination.CustomGridSearchText))
            {
                var search = pagination.CustomGridSearchText.Trim().ToLower();
                allItems = allItems.Where(i =>
                    (i.Name != null && i.Name.ToLower().Contains(search)) ||
                    (i.BarcodeNumber != null && i.BarcodeNumber.ToLower().Contains(search)) ||
                    (i.ModalNumber != null && i.ModalNumber.ToLower().Contains(search)) ||
                    (i.PhoneOrderType != null && i.PhoneOrderType.ToLower().Contains(search))
                ).ToList();
            }

            var totalRecords = allItems.Count;

            // Apply in-memory sorting
            allItems = ApplySorting(allItems, pagination.SortColumn ?? "Name", pagination.SortDirection ?? "asc");

            // Apply pagination
            var pageSize = pagination.EndRow - pagination.StartRow;
            var paginatedData = allItems
                .Skip(pagination.StartRow)
                .Take(pageSize)
                .ToList();

            var response = new PaginationResponseDTO<ItemOnPhoneOrderGridDto>
            {
                TotalRecords = totalRecords,
                RecordsFiltered = totalRecords,
                CurrentPage = pagination.StartRow > 0 ? (int)Math.Ceiling((double)pagination.EndRow / pageSize) : 1,
                PageSize = pageSize,
                Data = paginatedData
            };

            return ApiResponseFactory.Success(response, "Aggregated items on phone order fetched successfully.");
        }

        private string BuildFilterString(PaginationGridDto pagination, string? phoneStatus)
        {
            var filterParts = new List<string>();

            // Date filters - match VB.NET: PhoneOrder.DeliveryDate >= FromDate / < ToDate+1
            if (!string.IsNullOrEmpty(pagination.Filters))
            {
                // Try to extract fromDate/toDate from the pagination filters JSON
                try
                {
                    var filters = Newtonsoft.Json.JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(pagination.Filters);
                    if (filters != null)
                    {
                        foreach (var filter in filters)
                        {
                            if (filter.Col?.Equals("fromDate", StringComparison.OrdinalIgnoreCase) == true
                                && DateTime.TryParse(filter.Value, out var fromDate))
                            {
                                filterParts.Add($" and (PhoneOrder.DeliveryDate>='{fromDate:yyyy-MM-dd}')");
                            }
                            else if (filter.Col?.Equals("toDate", StringComparison.OrdinalIgnoreCase) == true
                                && DateTime.TryParse(filter.Value, out var toDate))
                            {
                                var toDateExclusive = toDate.Date.AddDays(1);
                                filterParts.Add($" and (PhoneOrder.DeliveryDate<'{toDateExclusive:yyyy-MM-dd}')");
                            }
                        }
                    }
                }
                catch
                {
                    // Ignore filter parsing errors
                }
            }

            // Phone status filter - map to integer values matching VB.NET
            if (!string.IsNullOrEmpty(phoneStatus))
            {
                var statusValue = MapPhoneStatus(phoneStatus);
                if (statusValue >= 0)
                {
                    filterParts.Add($" AND (PhoneOrderStatus = {statusValue})");
                }
            }

            // Store filter from storeId
            if (pagination.StoreId.HasValue && pagination.StoreId.Value != Guid.Empty)
            {
                filterParts.Add($" AND (dbo.ItemMainAndStoreView.StoreNo IN ('{pagination.StoreId.Value}'))");
            }

            return string.Join("", filterParts);
        }

        private static int MapPhoneStatus(string status)
        {
            return status.ToLower() switch
            {
                "open" => 0,
                "process" => 1,
                "pick" => 2,
                "hold" => 3,
                "holdbycollector" => 4,
                "collecting" => 5,
                _ => -1
            };
        }

        private static List<ItemOnPhoneOrderGridDto> ApplySorting(
            List<ItemOnPhoneOrderGridDto> items, string sortColumn, string sortDirection)
        {
            var isDesc = sortDirection?.ToLower() == "desc";

            return sortColumn?.ToLower() switch
            {
                "qty" => isDesc ? items.OrderByDescending(x => x.Qty).ToList() : items.OrderBy(x => x.Qty).ToList(),
                "name" => isDesc ? items.OrderByDescending(x => x.Name).ToList() : items.OrderBy(x => x.Name).ToList(),
                "modalnumber" => isDesc ? items.OrderByDescending(x => x.ModalNumber).ToList() : items.OrderBy(x => x.ModalNumber).ToList(),
                "barcodenumber" => isDesc ? items.OrderByDescending(x => x.BarcodeNumber).ToList() : items.OrderBy(x => x.BarcodeNumber).ToList(),
                "cost" => isDesc ? items.OrderByDescending(x => x.Cost).ToList() : items.OrderBy(x => x.Cost).ToList(),
                "price" => isDesc ? items.OrderByDescending(x => x.Price).ToList() : items.OrderBy(x => x.Price).ToList(),
                "onhand" => isDesc ? items.OrderByDescending(x => x.OnHand).ToList() : items.OrderBy(x => x.OnHand).ToList(),
                "phoneordertype" => isDesc ? items.OrderByDescending(x => x.PhoneOrderType).ToList() : items.OrderBy(x => x.PhoneOrderType).ToList(),
                "storename" => isDesc ? items.OrderByDescending(x => x.StoreName).ToList() : items.OrderBy(x => x.StoreName).ToList(),
                _ => isDesc ? items.OrderByDescending(x => x.Name).ToList() : items.OrderBy(x => x.Name).ToList(),
            };
        }
    }
}
