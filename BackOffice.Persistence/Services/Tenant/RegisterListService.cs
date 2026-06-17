using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Register;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Infrastructure.DBContext.Tenant;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class RegisterListService : IRegisterListService
    {
        private readonly TenantDBContext _dbContext;

        public RegisterListService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Gets all registers from Registers table with pagination, filtering, and sorting support
        /// </summary>
        public ApiResponse<PaginationResponseDTO<RegisterGridDto>> GetAllRegistersGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                // Base query from Registers table
                var query = (from r in _dbContext.Registers
                             select new RegisterGridDto
                             {
                                 RegisterID = r.RegisterID,
                                 RegisterNo = r.RegisterNo,
                                 CompName = r.CompName,
                                 StoreID = r.StoreID,
                                 Status = r.Status,
                                 DateCreated = r.DateCreated,
                                 DateModified = r.DateModified
                             })
                             .AsQueryable();

                // Filter by StoreId if provided
                if (paginationGridDto.StoreId.HasValue)
                {
                    var storeId = paginationGridDto.StoreId.Value;
                    query = query.Where(x => x.StoreID == storeId);
                }

                // Apply QueryHelper filters (handles grid column filters and custom search text)
                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;

                // Calculate total records
                int totalRecords = _dbContext.Registers.Count();

                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "RegisterNo", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<RegisterGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Registers fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<RegisterGridDto>>(
                    "Error fetching registers.",
                    new List<string> { ex.Message });
            }
        }
    }
}
