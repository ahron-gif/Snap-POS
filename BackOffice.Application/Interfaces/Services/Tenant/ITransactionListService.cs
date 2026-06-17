using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Transaction;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface ITransactionListService
    {
        ApiResponse<PaginationResponseDTO<TransactionGridDto>> GetAllTransactionsGridAsync(PaginationGridDto paginationGridDto);
    }
}
