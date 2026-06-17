using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.GenOrder;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Infrastructure.DBContext.Tenant;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class GenOrderService : IGenOrderService
    {
        private readonly TenantDBContext _dbContext;

        public GenOrderService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Gets general order items from the GenOrderView with pagination, filtering, and sorting
        /// </summary>
        public ApiResponse<PaginationResponseDTO<GenOrderGridDto>> GetAllGenOrdersGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _dbContext.GenOrderViews
                    .Select(x => new GenOrderGridDto
                    {
                        GenPurchaseOrderID = x.GenPurchaseOrderID,
                        ToOrder = x.ToOrder,
                        Reorder = x.Reorder,
                        UOMType = x.UOMType,
                        Status = x.Status,
                        SortOrder = x.SortOrder,
                        ItemID = x.ItemID,
                        ItemStoreID = x.ItemStoreID,
                        StoreID = x.StoreID,
                        ItemName = x.ItemName,
                        ModalNumber = x.ModalNumber,
                        BarcodeNumber = x.BarcodeNumber,
                        StyleNo = x.StyleNo,
                        VenderCode = x.VenderCode,
                        Size = x.Size,
                        Department = x.Department,
                        StoreName = x.StoreName,
                        SupplierName = x.SupplierName,
                        SupplierItemCode = x.SupplierItemCode,
                        CustomerCode = x.CustomerCode,
                        Groups = x.Groups,
                        SupplierNo = x.SupplierNo,
                        MainSupplierID = x.MainSupplierID,
                        ManufacturerID = x.ManufacturerID,
                        DepartmentID = x.DepartmentID,
                        UserModified = x.UserModified,
                        CaseQty = x.CaseQty,
                        ItemType = x.ItemType,
                        CsCost = x.CsCost,
                        PcCost = x.PcCost,
                        OnHand = x.OnHand,
                        OnOrder = x.OnOrder,
                        ReorderPoint = x.ReorderPoint,
                        RestockLevel = x.RestockLevel,
                        Qty3 = x.Qty3,
                        Qty7 = x.Qty7,
                        Qty14 = x.Qty14,
                        Qty30 = x.Qty30,
                        Qty60 = x.Qty60,
                        Qty90 = x.Qty90,
                        Qty180 = x.Qty180,
                        Qty420 = x.Qty420,
                        Qty540 = x.Qty540,
                        OnSaleOrder = x.OnSaleOrder,
                        TransferQty = x.TransferQty,
                        MTD = x.MTD,
                        YTD = x.YTD,
                        PTD = x.PTD,
                        LastReceived = x.LastReceived,
                        DateModified = x.DateModified
                    })
                    .AsQueryable();

                // Filter by StoreId if provided
                if (paginationGridDto.StoreId.HasValue)
                {
                    query = query.Where(x => x.StoreID == paginationGridDto.StoreId.Value);
                }

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;

                // Calculate total records
                int totalRecords;
                if (paginationGridDto.StoreId.HasValue)
                {
                    totalRecords = _dbContext.GenOrderViews
                        .Count(x => x.StoreID == paginationGridDto.StoreId.Value);
                }
                else
                {
                    totalRecords = _dbContext.GenOrderViews.Count();
                }
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "ItemName", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<GenOrderGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "General order items fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<GenOrderGridDto>>(
                    "Error fetching general order items.",
                    new List<string> { ex.Message });
            }
        }
    }
}
