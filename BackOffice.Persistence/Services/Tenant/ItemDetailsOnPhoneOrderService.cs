using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.ItemDetailsOnPhoneOrder;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Infrastructure.DBContext.Tenant;

namespace BackOffice.Persistence.Services.Tenant
{
    public class ItemDetailsOnPhoneOrderService : IItemDetailsOnPhoneOrderService
    {
        private readonly TenantDBContext _dbContext;

        public ItemDetailsOnPhoneOrderService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<ApiResponse<PaginationResponseDTO<ItemDetailsOnPhoneOrderGridDto>>> GetItemDetailsOnPhoneOrderAsync(
            PaginationGridDto pagination, string? phoneStatus, string? itemStoreId)
        {
            try
            {
                var filterString = BuildFilterString(pagination, phoneStatus, itemStoreId);

                var returnValue = new OutputParameter<int>();
                var spResults = await _dbContext.Procedures.Rpt_ItemDetailsOnPhoneOrderAsync(filterString, returnValue);

                // Map SP results to DTOs
                var allItems = spResults.Select(r => new ItemDetailsOnPhoneOrderGridDto
                {
                    Qty = r.Qty,
                    Name = r.Name,
                    ModalNumber = r.ModalNumber,
                    BarcodeNumber = r.BarcodeNumber,
                    Cost = r.Cost,
                    Price = r.Price,
                    OnHand = r.OnHand,
                    ItemStoreID = r.ItemStoreID,
                    Note = r.Note,
                    PhoneOrderNo = r.PhoneOrderNo,
                    CustomerNo = r.CustomerNo,
                    FirstName = r.FirstName,
                    LastName = r.LastName,
                    PickedBy = r.PickedBy,
                    PickQty = r.PickQty,
                    Groups = r.Groups,
                    PickNote = r.PickNote,
                    PhoneOrderType = r.PhoneOrderType,
                    DeliveryDate = r.DeliveryDate,
                    DateCreated = r.DateCreated
                }).ToList();

                // Apply in-memory text search
                if (!string.IsNullOrWhiteSpace(pagination.CustomGridSearchText))
                {
                    var search = pagination.CustomGridSearchText.Trim().ToLower();
                    allItems = allItems.Where(i =>
                        (i.Name != null && i.Name.ToLower().Contains(search)) ||
                        (i.BarcodeNumber != null && i.BarcodeNumber.ToLower().Contains(search)) ||
                        (i.ModalNumber != null && i.ModalNumber.ToLower().Contains(search)) ||
                        (i.PhoneOrderNo != null && i.PhoneOrderNo.ToLower().Contains(search)) ||
                        (i.CustomerNo != null && i.CustomerNo.ToLower().Contains(search)) ||
                        (i.FirstName != null && i.FirstName.ToLower().Contains(search)) ||
                        (i.LastName != null && i.LastName.ToLower().Contains(search)) ||
                        (i.Note != null && i.Note.ToLower().Contains(search)) ||
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

                var response = new PaginationResponseDTO<ItemDetailsOnPhoneOrderGridDto>
                {
                    TotalRecords = totalRecords,
                    RecordsFiltered = totalRecords,
                    CurrentPage = pagination.StartRow > 0 ? (int)Math.Ceiling((double)pagination.EndRow / pageSize) : 1,
                    PageSize = pageSize,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Item details on phone order fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<ItemDetailsOnPhoneOrderGridDto>>(
                    "Error fetching item details on phone order.",
                    new List<string> { ex.Message });
            }
        }

        private string BuildFilterString(PaginationGridDto pagination, string? phoneStatus, string? itemStoreId)
        {
            var filterParts = new List<string>();

            // Date filters - match VB.NET: PhoneOrder.DeliveryDate >= FromDate / <= ToDate
            if (!string.IsNullOrEmpty(pagination.Filters))
            {
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
                                filterParts.Add($" and (PhoneOrder.DeliveryDate<='{toDate:yyyy-MM-dd}')");
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

            // ItemStoreID filter - for drill-down from Items On Phone Order screen
            if (!string.IsNullOrEmpty(itemStoreId) && Guid.TryParse(itemStoreId, out var parsedItemStoreId))
            {
                filterParts.Add($" and ItemStore.ItemStoreID='{parsedItemStoreId}'");
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

        private static List<ItemDetailsOnPhoneOrderGridDto> ApplySorting(
            List<ItemDetailsOnPhoneOrderGridDto> items, string sortColumn, string sortDirection)
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
                "note" => isDesc ? items.OrderByDescending(x => x.Note).ToList() : items.OrderBy(x => x.Note).ToList(),
                "phoneorderno" => isDesc ? items.OrderByDescending(x => x.PhoneOrderNo).ToList() : items.OrderBy(x => x.PhoneOrderNo).ToList(),
                "customerno" => isDesc ? items.OrderByDescending(x => x.CustomerNo).ToList() : items.OrderBy(x => x.CustomerNo).ToList(),
                "firstname" => isDesc ? items.OrderByDescending(x => x.FirstName).ToList() : items.OrderBy(x => x.FirstName).ToList(),
                "lastname" => isDesc ? items.OrderByDescending(x => x.LastName).ToList() : items.OrderBy(x => x.LastName).ToList(),
                "pickedby" => isDesc ? items.OrderByDescending(x => x.PickedBy).ToList() : items.OrderBy(x => x.PickedBy).ToList(),
                "pickqty" => isDesc ? items.OrderByDescending(x => x.PickQty).ToList() : items.OrderBy(x => x.PickQty).ToList(),
                "phoneordertype" => isDesc ? items.OrderByDescending(x => x.PhoneOrderType).ToList() : items.OrderBy(x => x.PhoneOrderType).ToList(),
                "deliverydate" => isDesc ? items.OrderByDescending(x => x.DeliveryDate).ToList() : items.OrderBy(x => x.DeliveryDate).ToList(),
                "datecreated" => isDesc ? items.OrderByDescending(x => x.DateCreated).ToList() : items.OrderBy(x => x.DateCreated).ToList(),
                _ => isDesc ? items.OrderByDescending(x => x.Name).ToList() : items.OrderBy(x => x.Name).ToList(),
            };
        }
    }
}
