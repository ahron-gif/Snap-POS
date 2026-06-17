using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Store;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Infrastructure.DBContext.Tenant;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class StoreListService : IStoreListService
    {
        private readonly TenantDBContext _dbContext;

        public StoreListService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Gets all stores from StoreView with pagination, filtering, and sorting support
        /// </summary>
        public ApiResponse<PaginationResponseDTO<StoreGridDto>> GetAllStoresGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                // Base query from StoreView
                var query = (from s in _dbContext.StoreViews
                             select new StoreGridDto
                             {
                                 StoreID = s.StoreID,
                                 StoreName = s.StoreName,
                                 StoreDescription = s.StoreDescription,
                                 ParentStore = s.ParentStore,
                                 DefaultMarkup = s.DefaultMarkup,
                                 DefaultMarkupA = s.DefaultMarkupA,
                                 DefaultMarkupB = s.DefaultMarkupB,
                                 DefaultMarkupC = s.DefaultMarkupC,
                                 DefaultMarkupD = s.DefaultMarkupD,
                                 RoundUp = s.RoundUp,
                                 RoundValue = s.RoundValue,
                                 DefaultCogsAccount = s.DefaultCogsAccount,
                                 DefaultIncomeAccount = s.DefaultIncomeAccount,
                                 DefaultTaxNo = s.DefaultTaxNo,
                                 IsDefaultTaxInclude = s.IsDefaultTaxInclude,
                                 DefaultProfitCalculation = s.DefaultProfitCalculation,
                                 StoreEmail = s.StoreEmail,
                                 IsMainStore = s.IsMainStore,
                                 Status = s.Status,
                                 DateCreated = s.DateCreated,
                                 UserCreated = s.UserCreated,
                                 DateModified = s.DateModified,
                                 UserModified = s.UserModified,
                                 Address = s.Address,
                                 CityStateZip = s.CityStateZip,
                                 Country = s.Country,
                                 DateClosed = s.DateClosed,
                                 DateOpened = s.DateOpened,
                                 DistrictID = s.DistrictID,
                                 Fax = s.Fax,
                                 Phone1 = s.Phone1,
                                 Phone2 = s.Phone2,
                                 RegionID = s.RegionID,
                                 StoreNumber = s.StoreNumber,
                                 StoreInt = s.StoreInt,
                             })
                             .AsQueryable();

                // Apply QueryHelper filters (handles grid column filters and custom search text)
                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;

                // Calculate total records
                int totalRecords = _dbContext.StoreViews.Count();

                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "StoreName", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<StoreGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Stores fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<StoreGridDto>>(
                    "Error fetching stores.",
                    new List<string> { ex.Message });
            }
        }
    }
}
