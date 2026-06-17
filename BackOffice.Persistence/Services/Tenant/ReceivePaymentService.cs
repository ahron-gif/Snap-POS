using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.ReceivePayment;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Infrastructure.DBContext.Tenant;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class ReceivePaymentService : IReceivePaymentService
    {
        private readonly TenantDBContext _dbContext;

        public ReceivePaymentService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Gets customer receive payment records from TransactionWithPaidView (TransactionType=4)
        /// joined with TenderEntry and Tender for payment method details
        /// </summary>
        public ApiResponse<PaginationResponseDTO<ReceivePaymentGridDto>> GetAllReceivePaymentsGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = (from t in _dbContext.TransactionWithPaidViews
                             where t.TransactionType == 4
                             join te in _dbContext.TenderEntries on t.TransactionID equals te.TransactionID into tenderEntryJoin
                             from te in tenderEntryJoin.DefaultIfEmpty()
                             join tn in _dbContext.Tenders on (te != null ? te.TenderID : 0) equals tn.TenderID into tenderJoin
                             from tn in tenderJoin.DefaultIfEmpty()
                             select new ReceivePaymentGridDto
                             {
                                 TransactionID = t.TransactionID,
                                 TransactionNo = t.TransactionNo,
                                 CustomerName = t.CustomerName,
                                 CustomerNo = t.CustomerNo,
                                 Credit = t.Credit,
                                 AppliedAmount = t.AppliedAmount,
                                 Balance = t.Balance,
                                 TenderName = tn != null ? tn.TenderName : null,
                                 TenderDate = te != null ? te.TenderDate : null,
                                 Common1 = te != null ? te.Common1 : null,
                                 StartSaleTime = t.StartSaleTime,
                                 Status = t.Status,
                                 VoidReason = t.VoidReason,
                                 StoreName = t.StoreName,
                                 User = t.User,
                                 Note = t.Note
                             })
                             .AsQueryable();

                // Filter by StoreId if provided
                if (paginationGridDto.StoreId.HasValue)
                {
                    query = query.Where(x => x.StoreName != null);
                }

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;

                // Calculate total records
                int totalRecords = _dbContext.TransactionWithPaidViews
                    .Count(x => x.TransactionType == 4);

                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "StartSaleTime", paginationGridDto.SortDirection ?? "desc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<ReceivePaymentGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Receive payments fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<ReceivePaymentGridDto>>(
                    "Error fetching receive payments.",
                    new List<string> { ex.Message });
            }
        }
    }
}
