using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Transfer;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Infrastructure.DBContext.Tenant;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class TransferItemsListService : ITransferItemsListService
    {
        private readonly TenantDBContext _dbContext;

        public TransferItemsListService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Gets all transfers from TransferItemsView with pagination, filtering, and sorting support
        /// </summary>
        public ApiResponse<PaginationResponseDTO<TransferGridDto>> GetAllTransfersGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                // Base query from TransferItemsView
                var query = (from t in _dbContext.TransferItemsViews
                             select new TransferGridDto
                             {
                                 TransferID = t.TransferID,
                                 TransferNo = t.TransferNo,
                                 TransferDate = t.TransferDate,
                                 TransferStatusDec = t.TransferStatusDec,
                                 Note = t.Note,
                                 To_Store = t.To_Store,
                                 From_Store = t.From_Store,
                                 UserName = t.UserName,
                                 Status = t.Status,
                                 TransferStatus = t.TransferStatus,
                                 FromStoreID = t.FromStoreID,
                                 ToStoreID = t.ToStoreID,
                                 DateCreated = t.DateCreated,
                                 DateModified = t.DateModified,
                             })
                             .AsQueryable();

                // Apply QueryHelper filters (handles grid column filters and custom search text)
                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;

                // Calculate total records
                int totalRecords = _dbContext.TransferItemsViews.Count();

                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "TransferDate", paginationGridDto.SortDirection ?? "desc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<TransferGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Transfers fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<TransferGridDto>>(
                    "Error fetching transfers.",
                    new List<string> { ex.Message });
            }
        }
    }
}
