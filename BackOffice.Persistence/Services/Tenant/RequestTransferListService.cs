using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.RequestTransfer;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Infrastructure.DBContext.Tenant;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class RequestTransferListService : IRequestTransferListService
    {
        private readonly TenantDBContext _dbContext;

        public RequestTransferListService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Gets all request transfers from RequestTransferView with pagination, filtering, and sorting support
        /// </summary>
        public ApiResponse<PaginationResponseDTO<RequestTransferGridDto>> GetAllRequestTransfersGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                // Base query from RequestTransferView
                var query = (from rt in _dbContext.RequestTransferViews
                             select new RequestTransferGridDto
                             {
                                 RequestTransferID = rt.RequestTransferID,
                                 RequestNo = rt.RequestNo,
                                 FromStore = rt.FromStore,
                                 ToStore = rt.ToStore,
                                 RequestTransferStatusDec = rt.RequestTransferStatusDec,
                                 Status = rt.Status,
                                 RequestStatus = rt.RequestStatus,
                                 Note = rt.Note,
                                 UserName = rt.UserName,
                                 RequestDate = rt.RequestDate,
                                 DateCreated = rt.DateCreated,
                                 FromStoreID = rt.FromStoreID,
                                 ToStoreID = rt.ToStoreID,
                                 OpenItems = rt.openItems,
                             })
                             .AsQueryable();

                // Apply QueryHelper filters (handles grid column filters and custom search text)
                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;

                // Calculate total records
                int totalRecords = _dbContext.RequestTransferViews.Count();

                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "RequestDate", paginationGridDto.SortDirection ?? "desc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<RequestTransferGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Request transfers fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<RequestTransferGridDto>>(
                    "Error fetching request transfers.",
                    new List<string> { ex.Message });
            }
        }
    }
}
