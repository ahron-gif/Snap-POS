using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PaymentController : ControllerBase
    {
        private readonly IPaymentService _paymentService;

        public PaymentController(IPaymentService paymentService)
        {
            _paymentService = paymentService;
        }

        /// <summary>
        /// Gets all payments with pagination, filtering, and sorting support
        /// </summary>
        /// <param name="paginationGridDto">Pagination parameters</param>
        /// <returns>Paginated list of payments</returns>
        [HttpGet("GetAllPayments")]
        public IActionResult GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var result = _paymentService.GetAllPaymentsGridAsync(paginationGridDto);
            return Ok(result);
        }
    }
}
