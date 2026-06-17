using BackOffice.Api.Authorization;
using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class SubscriptionController : ControllerBase
    {
        private readonly ISubscriptionService _subscriptionService;

        public SubscriptionController(ISubscriptionService subscriptionService)
        {
            _subscriptionService = subscriptionService;
        }

        [HttpGet("Customer/{customerId}")]
        public async Task<IActionResult> GetCurrentSubscription(int customerId)
        {
            var result = await _subscriptionService.GetCurrentSubscriptionAsync(customerId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("MySubscription")]
        public async Task<IActionResult> GetMySubscription()
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest("Customer not found in claims.");

            var result = await _subscriptionService.GetCurrentSubscriptionAsync(customerId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("Change")]
        [RequirePermission(Perms.Admin.LicensesBilling.Edit)]
        public async Task<IActionResult> ChangeSubscription([FromBody] ChangeSubscriptionDto dto)
        {
            var changedBy = GetUserIdFromClaims();
            var result = await _subscriptionService.ChangeSubscriptionAsync(dto, changedBy);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("AppOverride")]
        public async Task<IActionResult> ApplyAppOverride([FromBody] CustomerAppOverrideDto dto)
        {
            var result = await _subscriptionService.ApplyAppOverrideAsync(dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("ApiOverride")]
        public async Task<IActionResult> ApplyApiOverride([FromBody] CustomerApiOverrideDto dto)
        {
            var result = await _subscriptionService.ApplyApiOverrideAsync(dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("Suspend/{customerId}")]
        public async Task<IActionResult> SuspendCustomer(int customerId, [FromBody] SuspendRequestDto dto)
        {
            var result = await _subscriptionService.SuspendCustomerAsync(customerId, dto.Reason);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("Reactivate/{customerId}")]
        public async Task<IActionResult> ReactivateCustomer(int customerId)
        {
            var result = await _subscriptionService.ReactivateCustomerAsync(customerId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("History/{customerId}")]
        public async Task<IActionResult> GetSubscriptionHistory(int customerId)
        {
            var result = await _subscriptionService.GetSubscriptionHistoryAsync(customerId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        private int GetUserIdFromClaims()
        {
            var userIdClaim = User.FindFirst("UserId")?.Value;
            return int.TryParse(userIdClaim, out var userId) ? userId : 0;
        }

        // Resolve the active tenant context: prefer the JWT claim (tenant admins),
        // fall back to the CustomerId header (master admins acting on behalf of a tenant).
        private int GetCustomerIdFromClaims()
        {
            var claim = User.FindFirst("CustomerId")?.Value;
            if (int.TryParse(claim, out var fromClaim) && fromClaim > 0)
                return fromClaim;

            if (Request.Headers.TryGetValue("CustomerId", out var headerVal)
                && int.TryParse(headerVal.ToString(), out var fromHeader) && fromHeader > 0)
                return fromHeader;

            return 0;
        }
    }

    public class SuspendRequestDto
    {
        public string Reason { get; set; } = null!;
    }
}
