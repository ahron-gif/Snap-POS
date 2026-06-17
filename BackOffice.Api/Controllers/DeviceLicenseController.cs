using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DeviceLicenseController : ControllerBase
    {
        private const string ConfigKey = "Billing:DevBypassLicenseKey";

        private readonly IUsageTrackingService _usageTrackingService;
        private readonly MainDBContext _dbContext;
        private readonly IConfiguration _config;
        private readonly ILogger<DeviceLicenseController> _logger;

        public DeviceLicenseController(
            IUsageTrackingService usageTrackingService,
            MainDBContext dbContext,
            IConfiguration config,
            ILogger<DeviceLicenseController> logger)
        {
            _usageTrackingService = usageTrackingService;
            _dbContext = dbContext;
            _config = config;
            _logger = logger;
        }

        [HttpPost("Register")]
        public async Task<IActionResult> Register([FromBody] RegisterDeviceDto dto)
        {
            var (mode, customerId, error) = await ResolveLicenseKeyAsync();
            if (error != null)
                return Unauthorized(ApiResponseFactory.Forbidden<RegisterDeviceResultDto>(error));
            if (mode == LicenseKeyMode.DevBypass)
            {
                _logger.LogInformation("DeviceLicense.Register dev-bypass: non-test key, app {AppId} treated as allowed.", dto.AppId);
                return Ok(ApiResponseFactory.Success(new RegisterDeviceResultDto
                {
                    Allowed = true,
                    Reason = "Dev bypass — non-test key, no DB write.",
                    SlotsTotal = 0,
                    SlotsUsed = 0,
                    DeviceId = null,
                    LicenseId = null,
                    IsNewDevice = false,
                }, "Dev bypass — non-test key, registration skipped."));
            }

            var result = await _usageTrackingService.RegisterDeviceAsync(customerId, dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("Limit/{appId:int}")]
        public async Task<IActionResult> GetLimit(int appId)
        {
            var (mode, customerId, error) = await ResolveLicenseKeyAsync();
            if (error != null)
                return Unauthorized(ApiResponseFactory.Forbidden<DeviceLimitDto>(error));
            if (mode == LicenseKeyMode.DevBypass)
            {
                _logger.LogInformation("DeviceLicense.GetLimit dev-bypass: non-test key, app {AppId}.", appId);
                return Ok(ApiResponseFactory.Success(new DeviceLimitDto
                {
                    AppId = appId,
                    SlotsTotal = 0,
                    SlotsUsed = 0,
                    CanRegisterNew = true,
                    InactiveDays = 30,
                }, "Dev bypass — non-test key."));
            }

            var result = await _usageTrackingService.CheckDeviceLimitAsync(customerId, appId);
            if (!result.IsSuccess)
                return BadRequest(result);
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
    }
}
