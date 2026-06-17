using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Payment;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Infrastructure.DBContext.Tenant;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class PaymentService : IPaymentService
    {
        private readonly TenantDBContext _dbContext;

        public PaymentService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Gets payments from the PaymentsView with pagination, filtering, and sorting
        /// </summary>
        public ApiResponse<PaginationResponseDTO<PaymentGridDto>> GetAllPaymentsGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _dbContext.PaymentsViews
                    .Select(x => new PaymentGridDto
                    {
                        SuppTenderEntryID = x.SuppTenderEntryID,
                        SuppTenderNo = x.SuppTenderNo,
                        StoreID = x.StoreID,
                        SupplierID = x.SupplierID,
                        TenderID = x.TenderID,
                        Amount = x.Amount,
                        Common1 = x.Common1,
                        Common2 = x.Common2,
                        Common3 = x.Common3,
                        Common4 = x.Common4,
                        Common5 = x.Common5,
                        Common6 = x.Common6,
                        TenderDate = x.TenderDate,
                        Status = x.Status,
                        DateCreated = x.DateCreated,
                        UserCreated = x.UserCreated,
                        DateModified = x.DateModified,
                        UserModified = x.UserModified,
                        TransferedToBookkeeping = x.TransferedToBookkeeping,
                        VisaType = x.VisaType,
                        Name = x.Name,
                        TenderName = x.TenderName,
                        Type = x.Type,
                        Check_Date = x.Check_Date,
                        NumApplyBills = x.NumApplyBills
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
                    totalRecords = _dbContext.PaymentsViews
                        .Count(x => x.StoreID == paginationGridDto.StoreId.Value);
                }
                else
                {
                    totalRecords = _dbContext.PaymentsViews.Count();
                }
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "TenderDate", paginationGridDto.SortDirection ?? "desc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<PaymentGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Payments fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<PaymentGridDto>>(
                    "Error fetching payments.",
                    new List<string> { ex.Message });
            }
        }
    }
}
