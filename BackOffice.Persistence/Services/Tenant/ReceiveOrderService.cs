using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.ReceiveOrder;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Infrastructure.DBContext.Tenant;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class ReceiveOrderService : IReceiveOrderService
    {
        private readonly TenantDBContext _dbContext;

        public ReceiveOrderService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Gets receive orders from the ReceiveOrderView with pagination, filtering, and sorting
        /// </summary>
        public ApiResponse<PaginationResponseDTO<ReceiveOrderGridDto>> GetAllReceiveOrdersGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _dbContext.ReceiveOrderViews
                    .Select(x => new ReceiveOrderGridDto
                    {
                        ReceiveID = x.ReceiveID,
                        PackingSlipNo = x.PackingSlipNo,
                        StoreID = x.StoreID,
                        SupplierNo = x.SupplierNo,
                        BillID = x.BillID,
                        Freight = x.Freight,
                        Discount = x.Discount,
                        Note = x.Note,
                        Total = x.Total,
                        CurrBalance = x.CurrBalance,
                        IsDiscAmount = x.IsDiscAmount,
                        DiscountSum = x.DiscountSum,
                        EntriesSum = x.EntriesSum,
                        ReceiveOrderDate = x.ReceiveOrderDate,
                        Status = x.Status,
                        DateCreated = x.DateCreated,
                        UserCreated = x.UserCreated,
                        DateModified = x.DateModified,
                        UserModified = x.UserModified,
                        BillNo = x.BillNo,
                        Amount = x.Amount,
                        AmountPay = x.AmountPay,
                        BillDate = x.BillDate,
                        ReceiveStatus = x.ReceiveStatus,
                        Balance = x.Balance,
                        TermsID = x.TermsID,
                        StartSaleTime = x.StartSaleTime,
                        SupplierName = x.SupplierName,
                        SupplierCode = x.SupplierCode,
                        SupplierAddress = x.SupplierAddress,
                        SupplierCSZ = x.SupplierCSZ,
                        PhoneNumber1 = x.PhoneNumber1,
                        ContactName = x.ContactName,
                        BillDue = x.BillDue,
                        StoreName = x.StoreName,
                        AccountNo = x.AccountNo,
                        CustomsDuties = x.CustomsDuties,
                        OtherCharges = x.OtherCharges,
                        UserName = x.UserName,
                        PoNo = x.PoNo
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
                    totalRecords = _dbContext.ReceiveOrderViews
                        .Count(x => x.StoreID == paginationGridDto.StoreId.Value);
                }
                else
                {
                    totalRecords = _dbContext.ReceiveOrderViews.Count();
                }
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "ReceiveOrderDate", paginationGridDto.SortDirection ?? "desc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<ReceiveOrderGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Receive orders fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<ReceiveOrderGridDto>>(
                    "Error fetching receive orders.",
                    new List<string> { ex.Message });
            }
        }
    }
}
