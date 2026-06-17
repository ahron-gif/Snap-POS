using BackOffice.Application.DTOs.Print;
using BackOffice.Application.Interfaces.Services.Print;
using BackOffice.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PrintAgentController : ControllerBase
    {
        private readonly IPrintAgentService _printAgentService;
        private readonly IPrintAgentInstallerService _installerService;

        public PrintAgentController(
            IPrintAgentService printAgentService,
            IPrintAgentInstallerService installerService)
        {
            _printAgentService = printAgentService;
            _installerService = installerService;
        }

        [HttpGet("installer-info")]
        [AllowAnonymous]
        public IActionResult GetInstallerInfo()
        {
            var info = _installerService.GetInfo();
            return Ok(ApiResponseFactory.Success(info));
        }

        [HttpGet("installer")]
        [AllowAnonymous]
        public IActionResult DownloadInstaller()
        {
            var external = _installerService.GetExternalRedirectUrl();
            if (_installerService.TryGetFileStream(out var stream, out var fileName, out var sizeBytes) && stream != null)
            {
                Response.Headers.ContentDisposition = $"attachment; filename=\"{fileName}\"";
                Response.Headers.ContentLength = sizeBytes;
                return File(stream, "application/octet-stream", fileName);
            }
            if (!string.IsNullOrEmpty(external))
            {
                return Redirect(external);
            }
            return NotFound(ApiResponseFactory.NotFound<object>("Installer is not available on this server."));
        }

        [HttpGet("status")]
        public async Task<IActionResult> GetStatus()
        {
            if (!TryGetUserId(out var userId))
            {
                return Unauthorized(ApiResponseFactory.Unauthorized<PrintAgentStatusDto>("LocalUserId not found in token."));
            }

            var status = await _printAgentService.GetStatusAsync(userId);
            return Ok(ApiResponseFactory.Success(status));
        }

        [HttpPost("pair")]
        public async Task<IActionResult> Pair([FromBody] PairAgentRequestDto request)
        {
            if (!TryGetUserId(out var userId))
            {
                return Unauthorized(ApiResponseFactory.Unauthorized<PairAgentResponseDto>("LocalUserId not found in token."));
            }

            try
            {
                var response = await _printAgentService.PairAsync(userId, request);
                return Ok(ApiResponseFactory.Success(response));
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponseFactory.BadRequest<PairAgentResponseDto>(ex.Message));
            }
        }

        [HttpPost("unpair")]
        public async Task<IActionResult> Unpair()
        {
            if (!TryGetUserId(out var userId))
            {
                return Unauthorized(ApiResponseFactory.Unauthorized<bool>("LocalUserId not found in token."));
            }

            await _printAgentService.UnpairAsync(userId);
            return Ok(ApiResponseFactory.Success(true));
        }

        [HttpPost("sign-job")]
        public async Task<IActionResult> SignJob([FromBody] SignPrintJobRequestDto request)
        {
            if (!TryGetUserId(out var userId))
            {
                return Unauthorized(ApiResponseFactory.Unauthorized<SignPrintJobResponseDto>("LocalUserId not found in token."));
            }

            if (string.IsNullOrWhiteSpace(request.PrinterName))
            {
                return BadRequest(ApiResponseFactory.BadRequest<SignPrintJobResponseDto>("Printer name is required."));
            }

            var origin = Request.Headers["Origin"].ToString();
            try
            {
                var response = await _printAgentService.SignPrintJobAsync(userId, origin, request);
                return Ok(ApiResponseFactory.Success(response));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponseFactory.BadRequest<SignPrintJobResponseDto>(ex.Message));
            }
        }

        private bool TryGetUserId(out Guid userId)
        {
            userId = Guid.Empty;
            var claim = User.FindFirst("LocalUserId")?.Value;
            return !string.IsNullOrEmpty(claim) && Guid.TryParse(claim, out userId);
        }
    }
}
