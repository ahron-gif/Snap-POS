using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.ReplacedItem;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Infrastructure.DBContext.Tenant;

namespace BackOffice.Persistence.Services.Tenant
{
    public class ReplacedItemService : IReplacedItemService
    {
        private readonly TenantDBContext _dbContext;

        public ReplacedItemService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<ApiResponse<PaginationResponseDTO<ReplacedItemGridDto>>> GetReplacedItemsAsync(
            PaginationGridDto pagination, DateTime? fromDate, DateTime? toDate)
        {
            try
            {
                // Default date range: 10 years back to tomorrow (matching VB.NET defaults)
                var effectiveFromDate = fromDate ?? DateTime.Now.AddYears(-10);
                var effectiveToDate = toDate ?? DateTime.Now.AddDays(1);

                var returnValue = new OutputParameter<int>();
                var spResults = await _dbContext.Procedures.RPT_ReplacedItemsAsync(
                    effectiveFromDate, effectiveToDate, returnValue);

                // Map SP results to DTOs
                var allItems = spResults.Select(r => new ReplacedItemGridDto
                {
                    PhoneOrderNo = r.PhoneOrderNo,
                    CustomerNo = r.CustomerNo,
                    Phone = r.Phone,
                    Cell = r.Cell,
                    LastName = r.LastName,
                    FirstName = r.FirstName,
                    PhoneOrderDate = r.PhoneOrderDate,
                    DeliveryDate = r.DeliveryDate,
                    PhoneOrderStatus = r.PhoneOrderStatus,
                    OldQty = r.OldQty,
                    NewQty = r.NewQty,
                    UserCollected = r.UserCollected,
                    RemovedItem = r.RemovedItem,
                    RemovedModelNo = r.RemovedModelNo,
                    RemovedUPC = r.RemovedUPC,
                    AddedItem = r.AddedItem,
                    AddedModelNo = r.AddedModelNo,
                    AddedUPC = r.AddedUPC,
                    Action = r.Action
                }).ToList();

                // Apply in-memory text search
                if (!string.IsNullOrWhiteSpace(pagination.CustomGridSearchText))
                {
                    var search = pagination.CustomGridSearchText.Trim().ToLower();
                    allItems = allItems.Where(i =>
                        (i.PhoneOrderNo != null && i.PhoneOrderNo.ToLower().Contains(search)) ||
                        (i.CustomerNo != null && i.CustomerNo.ToLower().Contains(search)) ||
                        (i.Phone != null && i.Phone.ToLower().Contains(search)) ||
                        (i.Cell != null && i.Cell.ToLower().Contains(search)) ||
                        (i.LastName != null && i.LastName.ToLower().Contains(search)) ||
                        (i.FirstName != null && i.FirstName.ToLower().Contains(search)) ||
                        (i.UserCollected != null && i.UserCollected.ToLower().Contains(search)) ||
                        (i.RemovedItem != null && i.RemovedItem.ToLower().Contains(search)) ||
                        (i.RemovedModelNo != null && i.RemovedModelNo.ToLower().Contains(search)) ||
                        (i.AddedItem != null && i.AddedItem.ToLower().Contains(search)) ||
                        (i.AddedModelNo != null && i.AddedModelNo.ToLower().Contains(search)) ||
                        (i.Action != null && i.Action.ToLower().Contains(search))
                    ).ToList();
                }

                var totalRecords = allItems.Count;

                // Apply in-memory sorting
                allItems = ApplySorting(allItems, pagination.SortColumn ?? "PhoneOrderDate", pagination.SortDirection ?? "desc");

                // Apply pagination
                var pageSize = pagination.EndRow - pagination.StartRow;
                var paginatedData = allItems
                    .Skip(pagination.StartRow)
                    .Take(pageSize)
                    .ToList();

                var response = new PaginationResponseDTO<ReplacedItemGridDto>
                {
                    TotalRecords = totalRecords,
                    RecordsFiltered = totalRecords,
                    CurrentPage = pagination.StartRow > 0 ? (int)Math.Ceiling((double)pagination.EndRow / pageSize) : 1,
                    PageSize = pageSize,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Replaced items fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<ReplacedItemGridDto>>(
                    "Error fetching replaced items.",
                    new List<string> { ex.Message });
            }
        }

        private static List<ReplacedItemGridDto> ApplySorting(
            List<ReplacedItemGridDto> items, string sortColumn, string sortDirection)
        {
            var isDesc = sortDirection?.ToLower() == "desc";

            return sortColumn?.ToLower() switch
            {
                "phoneorderno" => isDesc ? items.OrderByDescending(x => x.PhoneOrderNo).ToList() : items.OrderBy(x => x.PhoneOrderNo).ToList(),
                "customerno" => isDesc ? items.OrderByDescending(x => x.CustomerNo).ToList() : items.OrderBy(x => x.CustomerNo).ToList(),
                "phone" => isDesc ? items.OrderByDescending(x => x.Phone).ToList() : items.OrderBy(x => x.Phone).ToList(),
                "cell" => isDesc ? items.OrderByDescending(x => x.Cell).ToList() : items.OrderBy(x => x.Cell).ToList(),
                "lastname" => isDesc ? items.OrderByDescending(x => x.LastName).ToList() : items.OrderBy(x => x.LastName).ToList(),
                "firstname" => isDesc ? items.OrderByDescending(x => x.FirstName).ToList() : items.OrderBy(x => x.FirstName).ToList(),
                "phoneorderdate" => isDesc ? items.OrderByDescending(x => x.PhoneOrderDate).ToList() : items.OrderBy(x => x.PhoneOrderDate).ToList(),
                "deliverydate" => isDesc ? items.OrderByDescending(x => x.DeliveryDate).ToList() : items.OrderBy(x => x.DeliveryDate).ToList(),
                "phoneorderstatus" => isDesc ? items.OrderByDescending(x => x.PhoneOrderStatus).ToList() : items.OrderBy(x => x.PhoneOrderStatus).ToList(),
                "oldqty" => isDesc ? items.OrderByDescending(x => x.OldQty).ToList() : items.OrderBy(x => x.OldQty).ToList(),
                "newqty" => isDesc ? items.OrderByDescending(x => x.NewQty).ToList() : items.OrderBy(x => x.NewQty).ToList(),
                "usercollected" => isDesc ? items.OrderByDescending(x => x.UserCollected).ToList() : items.OrderBy(x => x.UserCollected).ToList(),
                "removeditem" => isDesc ? items.OrderByDescending(x => x.RemovedItem).ToList() : items.OrderBy(x => x.RemovedItem).ToList(),
                "removedmodelno" => isDesc ? items.OrderByDescending(x => x.RemovedModelNo).ToList() : items.OrderBy(x => x.RemovedModelNo).ToList(),
                "removedupc" => isDesc ? items.OrderByDescending(x => x.RemovedUPC).ToList() : items.OrderBy(x => x.RemovedUPC).ToList(),
                "addeditem" => isDesc ? items.OrderByDescending(x => x.AddedItem).ToList() : items.OrderBy(x => x.AddedItem).ToList(),
                "addedmodelno" => isDesc ? items.OrderByDescending(x => x.AddedModelNo).ToList() : items.OrderBy(x => x.AddedModelNo).ToList(),
                "addedupc" => isDesc ? items.OrderByDescending(x => x.AddedUPC).ToList() : items.OrderBy(x => x.AddedUPC).ToList(),
                "action" => isDesc ? items.OrderByDescending(x => x.Action).ToList() : items.OrderBy(x => x.Action).ToList(),
                _ => isDesc ? items.OrderByDescending(x => x.PhoneOrderDate).ToList() : items.OrderBy(x => x.PhoneOrderDate).ToList(),
            };
        }
    }
}
