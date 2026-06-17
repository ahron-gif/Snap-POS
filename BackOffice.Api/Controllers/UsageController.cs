using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsageController : ControllerBase
    {
        private const string ConfigKey = "Billing:DevBypassLicenseKey";

        private readonly IUsageTrackingService _usageTrackingService;
        private readonly ICustomerCreditService _creditService;
        private readonly MainDBContext _dbContext;
        private readonly IConfiguration _config;
        private readonly ILogger<UsageController> _logger;

        public UsageController(
            IUsageTrackingService usageTrackingService,
            ICustomerCreditService creditService,
            MainDBContext dbContext,
            IConfiguration config,
            ILogger<UsageController> logger)
        {
            _usageTrackingService = usageTrackingService;
            _creditService = creditService;
            _dbContext = dbContext;
            _config = config;
            _logger = logger;
        }

        [HttpGet("Customer/{customerId}")]
        [Authorize]
        public async Task<IActionResult> GetCustomerUsage(int customerId)
        {
            var result = await _usageTrackingService.GetCustomerUsageAsync(customerId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("MyUsage")]
        [Authorize]
        public async Task<IActionResult> GetMyUsage()
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest("Customer not found in claims.");

            var result = await _usageTrackingService.GetCustomerUsageAsync(customerId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Per-day transaction list for the current billing cycle. Used by the
        /// Licenses &amp; Billing page Transactions panel to render a row-per-day
        /// breakdown under the existing Total/Free/Billable summary cards.
        /// </summary>
        [HttpGet("MyTransactions")]
        [Authorize]
        public async Task<IActionResult> GetMyTransactions()
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest("Customer not found in claims.");

            var result = await _usageTrackingService.GetTransactionDetailsAsync(customerId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        /// <summary>Super-admin variant of /MyTransactions — caller supplies customerId.</summary>
        [HttpGet("Customer/{customerId}/Transactions")]
        [Authorize]
        public async Task<IActionResult> GetCustomerTransactions(int customerId)
        {
            var result = await _usageTrackingService.GetTransactionDetailsAsync(customerId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("Record")]
        public async Task<IActionResult> RecordUsage([FromBody] RecordUsageDto dto)
        {
            var (mode, customerId, error) = await ResolveLicenseKeyAsync();
            if (error != null)
                return Unauthorized(ApiResponseFactory.Forbidden<bool>(error));
            if (mode == LicenseKeyMode.DevBypass)
            {
                _logger.LogInformation("RecordUsage dev-bypass: non-test key, no DB write.");
                return Ok(ApiResponseFactory.Success(true, "Dev bypass — non-test key, recording skipped."));
            }

            dto.CustomerId = customerId;
            var result = await _usageTrackingService.RecordUsageAsync(dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("RecordApiCall")]
        public async Task<IActionResult> RecordApiCall([FromBody] RecordApiCallDto dto)
        {
            var (mode, customerId, error) = await ResolveLicenseKeyAsync();
            if (error != null)
                return Unauthorized(ApiResponseFactory.Forbidden<bool>(error));
            if (mode == LicenseKeyMode.DevBypass)
            {
                _logger.LogInformation("RecordApiCall dev-bypass: non-test key, no DB write.");
                return Ok(ApiResponseFactory.Success(true, "Dev bypass — non-test key, recording skipped."));
            }

            dto.CustomerId = customerId;
            var result = await _usageTrackingService.RecordApiCallAsync(dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Pre-call atomic check-and-record. Called once per metered request from the
        /// Connector API (see RDT.Connectors.API/Filters/MeterApiCallFilter). Identifies
        /// the customer from the X-Api-Key header, validates the free quota + wallet,
        /// records the ApiUsageLog row, and debits the wallet — all in one SQL
        /// transaction. Returns 402 Payment Required when credit is insufficient so
        /// the Connector API can short-circuit the action.
        /// </summary>
        [HttpPost("CheckAndRecord")]
        public async Task<IActionResult> CheckAndRecord([FromBody] CheckAndRecordApiCallDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.ApiCode))
                return BadRequest(ApiResponseFactory.BadRequest<CheckAndRecordResultDto>("apiCode is required."));

            var (mode, customerId, error) = await ResolveLicenseKeyAsync();
            if (error != null)
                return Unauthorized(ApiResponseFactory.Forbidden<CheckAndRecordResultDto>(error));

            if (mode == LicenseKeyMode.DevBypass)
            {
                // Dev/test keys bypass billing — return Allowed=true with stub values
                // so the connector pipeline continues uninterrupted in local development.
                return Ok(ApiResponseFactory.Success(new CheckAndRecordResultDto
                {
                    Allowed = true,
                    BalanceAfter = 0m,
                    FreeRemaining = int.MaxValue,
                    BillableCalls = 0,
                    Cost = 0m
                }, "Dev bypass — call allowed without billing."));
            }

            var callCount = dto.CallCount > 0 ? dto.CallCount : 1;
            var result = await _creditService.CheckAndRecordApiCallAsync(customerId, dto.ApiCode, callCount);

            if (!result.IsSuccess)
                return BadRequest(result);

            // Translate "denied" into 402 so the connector filter can recognize and
            // short-circuit the action. Body still carries the standard ApiResponse.
            if (result.Response is { Allowed: false })
                return StatusCode(StatusCodes.Status402PaymentRequired, result);

            return Ok(result);
        }

        private enum LicenseKeyMode { Normal, DevBypass }

        private async Task<(LicenseKeyMode mode, int customerId, string? error)> ResolveLicenseKeyAsync()
        {
            var headerKey = Request.Headers["X-Api-Key"].FirstOrDefault();
            if (string.IsNullOrWhiteSpace(headerKey))
                return (LicenseKeyMode.Normal, 0, "X-Api-Key header is required.");

            var bypassKey = _config[ConfigKey];
            var bypassConfigured = !string.IsNullOrWhiteSpace(bypassKey);

            if (bypassConfigured && !string.Equals(headerKey, bypassKey, StringComparison.OrdinalIgnoreCase))
                return (LicenseKeyMode.DevBypass, 0, null);

            if (!Guid.TryParse(headerKey, out var keyGuid) || keyGuid == Guid.Empty)
                return (LicenseKeyMode.Normal, 0, "API key is not a valid Guid.");

            var customerId = await _dbContext.Customers
                .Where(c => c.LicenseKey == keyGuid && c.IsActive)
                .Select(c => c.CustomerId)
                .FirstOrDefaultAsync();

            if (customerId == 0)
                return (LicenseKeyMode.Normal, 0, "API key did not resolve to an active customer.");

            return (LicenseKeyMode.Normal, customerId, null);
        }

        [HttpGet("CheckLimit/{customerId}/{metricType}")]
        [Authorize]
        public async Task<IActionResult> CheckLimit(int customerId, string metricType)
        {
            var result = await _usageTrackingService.CheckLimitAsync(customerId, metricType);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("RegisterDevice")]
        [Authorize]
        public async Task<IActionResult> RegisterDevice([FromBody] RegisterDeviceDto dto)
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest("Customer not found in claims.");

            var result = await _usageTrackingService.RegisterDeviceAsync(customerId, dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("MyDeviceLimit/{appId:int}")]
        [Authorize]
        public async Task<IActionResult> GetMyDeviceLimit(int appId)
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest("Customer not found in claims.");

            var result = await _usageTrackingService.CheckDeviceLimitAsync(customerId, appId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("MyDeviceLimits")]
        [Authorize]
        public async Task<IActionResult> GetMyDeviceLimits()
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest("Customer not found in claims.");

            var result = await _usageTrackingService.GetAllDeviceLimitsAsync(customerId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
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
}
