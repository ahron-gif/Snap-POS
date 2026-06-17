using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Transaction;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Infrastructure.DBContext.Tenant;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class TransactionListService : ITransactionListService
    {
        private readonly TenantDBContext _dbContext;

        public TransactionListService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Gets transaction type display name from type ID (used after materialization)
        /// </summary>
        private static string GetTransactionTypeName(int transactionType)
        {
            return transactionType switch
            {
                0 => "Sale",
                1 => "Phone Order",
                2 => "Return",
                3 => "Return Item",
                4 => "Payment",
                5 => "Opening Balance",
                _ => $"Type {transactionType}"
            };
        }

        /// <summary>
        /// Gets all transactions from TransactionWithPaidView with pagination, filtering, and sorting support
        /// </summary>
        public ApiResponse<PaginationResponseDTO<TransactionGridDto>> GetAllTransactionsGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                // Base query from TransactionWithPaidView (no TransactionType filter - show ALL types)
                var baseQuery = _dbContext.TransactionWithPaidViews.AsQueryable();

                // Filter by StoreId if provided
                if (paginationGridDto.StoreId.HasValue)
                {
                    var storeId = paginationGridDto.StoreId.Value;
                    baseQuery = baseQuery.Where(x => x.StoreID == storeId);
                }

                // Project to DTO
                var query = (from t in baseQuery
                             select new TransactionGridDto
                             {
                                 TransactionID = t.TransactionID,
                                 TransactionNo = t.TransactionNo,
                                 TransactionType = t.TransactionType,
                                 TransactionTypeName =
                                     t.TransactionType == 0 ? "Sale" :
                                     t.TransactionType == 1 ? "Phone Order" :
                                     t.TransactionType == 2 ? "Return" :
                                     t.TransactionType == 3 ? "Return Item" :
                                     t.TransactionType == 4 ? "Payment" :
                                     t.TransactionType == 5 ? "Opening Balance" : "Other",
                                 CustomerName = t.CustomerName,
                                 CustomerNo = t.CustomerNo,
                                 Debit = t.Debit,
                                 Credit = t.Credit,
                                 Amount = (t.Debit ?? 0) - (t.Credit ?? 0),
                                 AppliedAmount = t.AppliedAmount,
                                 Balance = t.Balance,
                                 SubTotal = t.SubTotal,
                                 Tax = t.Tax,
                                 Freight = t.Freight,
                                 StartSaleTime = t.StartSaleTime,
                                 StartTime = t.StartTime,
                                 EndSaleTime = t.EndSaleTime,
                                 DueDate = t.DueDate,
                                 DeliveryDate = t.DeliveryDate,
                                 TrackNo = t.TrackNo,
                                 Status = t.Status,
                                 VoidReason = t.VoidReason,
                                 StoreName = t.StoreName,
                                 User = t.User,
                                 SaleAssociate = t.SaleAssociate,
                                 Note = t.Note,
                                 ResellerName = t.ResellerName,
                                 PONo = t.PONo,
                                 RegisterTransaction = t.RegisterTransaction,
                                 PhoneOrder = t.PhoneOrder,
                                 BatchID = t.BatchID,
                                 StoreID = t.StoreID,
                                 CustomerID = t.CustomerID
                             })
                             .AsQueryable();

                // Apply QueryHelper filters (handles grid column filters and custom search text)
                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;

                // Calculate total records
                int totalRecords = _dbContext.TransactionWithPaidViews.Count();

                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "StartSaleTime", paginationGridDto.SortDirection ?? "desc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<TransactionGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Transactions fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<TransactionGridDto>>(
                    "Error fetching transactions.",
                    new List<string> { ex.Message });
            }
        }
    }
}
