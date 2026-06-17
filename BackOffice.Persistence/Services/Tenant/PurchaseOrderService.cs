using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.PurchaseOrder;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Infrastructure.DBContext.Tenant;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class PurchaseOrderService : IPurchaseOrderService
    {
        private readonly TenantDBContext _dbContext;

        public PurchaseOrderService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Gets purchase orders from the PurchaseOrdersView with pagination, filtering, and sorting
        /// </summary>
        public ApiResponse<PaginationResponseDTO<PurchaseOrderGridDto>> GetAllPurchaseOrdersGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _dbContext.PurchaseOrdersViews
                    .Select(x => new PurchaseOrderGridDto
                    {
                        PurchaseOrderId = x.PurchaseOrderId,
                        PoNo = x.PoNo,
                        GrandTotal = x.GrandTotal,
                        PurchaseOrderDate = x.PurchaseOrderDate,
                        ReqDate = x.ReqDate,
                        ExpirationDate = x.ExpirationDate,
                        Reorder = x.Reorder,
                        Note = x.Note,
                        VendorPONo = x.VendorPONo,
                        OpenItemsCount = x.OpenItemsCount,
                        StoreName = x.StoreName,
                        User = x.User,
                        Supplier = x.Supplier,
                        Supplier_No = x.Supplier_No,
                        POStatus = x.POStatus,
                        EmailAddress = x.EmailAddress,
                        Sent = x.Sent,
                        ClassID = x.ClassID,
                        MinMarkup = x.MinMarkup,
                        ListPrice = x.ListPrice,
                        Import = x.Import,
                        Approved = x.Approved,
                        StoreNo = x.StoreNo,
                        Status = x.Status
                    })
                    .AsQueryable();

                // Filter by StoreId if provided
                if (paginationGridDto.StoreId.HasValue)
                {
                    query = query.Where(x => x.StoreNo == paginationGridDto.StoreId.Value);
                }

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;

                // Calculate total records
                int totalRecords;
                if (paginationGridDto.StoreId.HasValue)
                {
                    totalRecords = _dbContext.PurchaseOrdersViews
                        .Count(x => x.StoreNo == paginationGridDto.StoreId.Value);
                }
                else
                {
                    totalRecords = _dbContext.PurchaseOrdersViews.Count();
                }
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "PurchaseOrderDate", paginationGridDto.SortDirection ?? "desc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<PurchaseOrderGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Purchase orders fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<PurchaseOrderGridDto>>(
                    "Error fetching purchase orders.",
                    new List<string> { ex.Message });
            }
        }
    }
}
