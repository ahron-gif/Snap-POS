using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.ReceiveTransfer;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Infrastructure.DBContext.Tenant;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class ReceiveTransferListService : IReceiveTransferListService
    {
        private readonly TenantDBContext _dbContext;

        public ReceiveTransferListService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Gets all receive transfers from ReceiveTransferView with pagination, filtering, and sorting support
        /// </summary>
        public ApiResponse<PaginationResponseDTO<ReceiveTransferGridDto>> GetAllReceiveTransfersGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                // Base query from ReceiveTransferView
                var query = (from rt in _dbContext.ReceiveTransferViews
                             select new ReceiveTransferGridDto
                             {
                                 ReceiveTransferID = rt.ReceiveTransferID,
                                 ReceiveDate = rt.ReceiveDate,
                                 TransferID = rt.TransferID,
                                 TransferNo = rt.TransferNo,
                                 ReciveNo = rt.ReciveNo,
                                 TransferStatus = rt.TransferStatus,
                                 TransferDate = rt.TransferDate,
                                 Note = rt.Note,
                                 TransferUser = rt.TransferUser,
                                 ReceiveUser = rt.ReceiveUser,
                                 StoreReceived = rt.StoreReceived,
                                 FromStore = rt.FromStore,
                                 ToStore = rt.ToStore,
                                 Status = rt.Status,
                                 FromStoreid = rt.FromStoreid,
                                 ToStoreID = rt.ToStoreID,
                                 StoreID = rt.StoreID,
                             })
                             .AsQueryable();

                // Apply QueryHelper filters (handles grid column filters and custom search text)
                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;

                // Calculate total records
                int totalRecords = _dbContext.ReceiveTransferViews.Count();

                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "ReceiveDate", paginationGridDto.SortDirection ?? "desc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<ReceiveTransferGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Receive transfers fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<ReceiveTransferGridDto>>(
                    "Error fetching receive transfers.",
                    new List<string> { ex.Message });
            }
        }
    }
}
