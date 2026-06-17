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
    public class CustomerController : ControllerBase
    {
        private readonly ICustomerService _customerService;
        private readonly IMapper _mapper;

        public CustomerController(ICustomerService customerService, IMapper mapper)
        {
            _customerService = customerService;
            _mapper = mapper;
        }
        
        // GET: api/User
        [HttpGet("GetAllCustomers")]
        public async Task<IActionResult> GetAll([FromQuery] PaginationGridDto paginationGridDto)
        {
            var users = _customerService.GetAllCustomersGridAsync(paginationGridDto);
            return Ok(users);
        }

        [HttpGet("GetAllTenantsLookup")]
        public async Task<IActionResult> GetAllTenants()
        {
            var users = _customerService.GetAllTenantsAsync();
            return Ok(users);
        }
    }
}
