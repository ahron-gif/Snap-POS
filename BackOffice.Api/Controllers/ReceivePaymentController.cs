using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ReceivePaymentController : ControllerBase
    {
        private readonly IReceivePaymentService _receivePaymentService;

        public ReceivePaymentController(IReceivePaymentService receivePaymentService)
        {
            _receivePaymentService = receivePaymentService;
        }

        /// <summary>
        /// Gets all customer receive payments with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of customer receive payments</returns>
        [HttpGet("GetAllReceivePayments")]
        public IActionResult GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _receivePaymentService.GetAllReceivePaymentsGridAsync(paginationGridDto);
            return Ok(result);
        }
    }
}
