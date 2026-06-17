using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.ReturnToVendor;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Infrastructure.DBContext.Tenant;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class ReturnToVendorService : IReturnToVendorService
    {
        private readonly TenantDBContext _dbContext;

        public ReturnToVendorService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Gets return to vendor records from the ReturnToVenderView with pagination, filtering, and sorting
        /// </summary>
        public ApiResponse<PaginationResponseDTO<ReturnToVendorGridDto>> GetAllReturnToVendorsGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = (from r in _dbContext.ReturnToVenderViews
                             join s in _dbContext.Suppliers on r.SupplierID equals s.SupplierID into supplierJoin
                             from s in supplierJoin.DefaultIfEmpty()
                             select new ReturnToVendorGridDto
                             {
                                 ReturnToVenderID = r.ReturnToVenderID,
                                 ReturnToVenderNo = r.ReturnToVenderNo,
                                 StoreNo = r.StoreNo,
                                 SupplierID = r.SupplierID,
                                 SupplierName = s != null ? s.Name : null,
                                 PersonReturnID = r.PersonReturnID,
                                 Total = r.Total,
                                 Note = r.Note,
                                 ReturnToVenderDate = r.ReturnToVenderDate,
                                 Taxable = r.Taxable,
                                 TaxRate = r.TaxRate,
                                 TaxAmount = r.TaxAmount,
                                 Status = r.Status,
                                 DateCreated = r.DateCreated,
                                 UserCreated = r.UserCreated,
                                 DateModified = r.DateModified,
                                 UserModified = r.UserModified,
                                 Discount = r.Discount,
                                 IsDiscountInAmount = r.IsDiscountInAmount
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
                    totalRecords = _dbContext.ReturnToVenderViews
                        .Count(x => x.StoreNo == paginationGridDto.StoreId.Value);
                }
                else
                {
                    totalRecords = _dbContext.ReturnToVenderViews.Count();
                }
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "ReturnToVenderDate", paginationGridDto.SortDirection ?? "desc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<ReturnToVendorGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Return to vendor records fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<ReturnToVendorGridDto>>(
                    "Error fetching return to vendor records.",
                    new List<string> { ex.Message });
            }
        }
    }
}
