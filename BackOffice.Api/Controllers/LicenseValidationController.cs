using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Common;
using BackOffice.Domain.Enums;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LicenseValidationController : ControllerBase
    {
        private readonly MainDBContext _dbContext;

        public LicenseValidationController(MainDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Public endpoint for external apps to validate a license key (Customer.LicenseKey Guid).
        /// </summary>
        [HttpPost("Validate")]
        [AllowAnonymous]
        public async Task<IActionResult> ValidateLicenseKey([FromBody] LicenseValidationRequestDto dto)
        {
            var customer = await _dbContext.Customers
                .Include(c => c.Subscription)
                    .ThenInclude(s => s.Plan)
                .FirstOrDefaultAsync(c => c.LicenseKey == dto.Key);

            if (customer == null)
            {
                return Ok(ApiResponseFactory.Success(new LicenseValidationResponseDto
                {
                    IsValid = false,
                    Reason = "License key not found."
                }));
            }

            // Check subscription status
            if (customer.Subscription?.Status == SubscriptionStatus.Suspended)
            {
                return Ok(ApiResponseFactory.Success(new LicenseValidationResponseDto
                {
                    IsValid = false,
                    Reason = "Customer subscription is suspended.",
                    CustomerName = customer.CustomerName
                }));
            }

            // Get allowed app IDs from plan
            var allowedAppIds = new List<int>();
            if (customer.Subscription?.PlanId != null)
            {
                allowedAppIds = await _dbContext.PlanAppPricings
                    .Where(p => p.PlanId == customer.Subscription.PlanId && p.IsIncluded)
                    .Select(p => p.AppId)
                    .ToListAsync();
            }

            return Ok(ApiResponseFactory.Success(new LicenseValidationResponseDto
            {
                IsValid = true,
                CustomerName = customer.CustomerName,
                PlanName = customer.Subscription?.Plan?.Name,
                AllowedAppIds = allowedAppIds
            }));
        }
    }
}
