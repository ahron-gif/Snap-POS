using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class TransactionListController : ControllerBase
    {
        private readonly ITransactionListService _transactionListService;

        public TransactionListController(ITransactionListService transactionListService)
        {
            _transactionListService = transactionListService;
        }
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of transactions</returns>
        [HttpGet("GetAllTransactions")]
        public IActionResult GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _transactionListService.GetAllTransactionsGridAsync(paginationGridDto);
            return Ok(result);
        }
    }
}
