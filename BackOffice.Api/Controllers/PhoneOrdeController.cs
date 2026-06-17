using AutoMapper;
using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Services;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Persistence.Services.Tenant;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PhoneOrderController : ControllerBase
    {
        private readonly IPhoneOrderService _PhoneOrderService;
        private readonly IMapper _mapper;

        public PhoneOrderController(IPhoneOrderService PhoneOrderService, IMapper mapper)
        {
            _PhoneOrderService = PhoneOrderService;
            _mapper = mapper;
        }

        // GET: api/User
        [HttpGet("GetAllPhoneOrders")]
        public async Task<IActionResult> GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var users = _PhoneOrderService.GetAllPhoneOrdersGridAsync(paginationGridDto);
            return Ok(users);
        }
    }
}
