using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Computer;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Infrastructure.DBContext.Tenant;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class ComputerListService : IComputerListService
    {
        private readonly TenantDBContext _dbContext;

        public ComputerListService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Gets all computers from ComputersView with pagination, filtering, and sorting support
        /// </summary>
        public ApiResponse<PaginationResponseDTO<ComputerGridDto>> GetAllComputersGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                // Base query from ComputersView
                var query = (from c in _dbContext.ComputersViews
                             select new ComputerGridDto
                             {
                                 ComputerID = c.ComputerID,
                                 ComputerName = c.ComputerName,
                                 ComputerNo = c.ComputerNo,
                                 StoreID = c.StoreID,
                                 LabelPrinter = c.LabelPrinter,
                                 ShelfPrinter = c.ShelfPrinter,
                                 InvoicePrinter = c.InvoicePrinter,
                                 StatementPrinter = c.StatementPrinter,
                                 Status = c.Status,
                                 DateCreated = c.DateCreated,
                                 UserCreated = c.UserCreated,
                                 DateModified = c.DateModified,
                                 UserModified = c.UserModified,
                             })
                             .AsQueryable();

                // Apply QueryHelper filters (handles grid column filters and custom search text)
                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;

                // Calculate total records
                int totalRecords = _dbContext.ComputersViews.Count();

                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "ComputerName", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<ComputerGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Computers fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<ComputerGridDto>>(
                    "Error fetching computers.",
                    new List<string> { ex.Message });
            }
        }
    }
}
