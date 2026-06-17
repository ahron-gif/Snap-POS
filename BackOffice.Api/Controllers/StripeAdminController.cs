using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    /// <summary>
    /// Phase 6: Super-admin Stripe subscription management.
    /// All endpoints accept customerId in the URL (not from JWT), so a super-admin
    /// can act on behalf of any tenant. Frontend route guards via isSuperAdmin().
    /// </summary>
    [Route("api/Stripe/Admin/Subscription")]
    [ApiController]
    [Authorize]
    public class StripeAdminController : ControllerBase
    {
        private readonly IStripeAdminService _adminService;

        public StripeAdminController(IStripeAdminService adminService)
        {
            _adminService = adminService;
        }

        /// <summary>Detailed subscription state for the admin UI (Stripe-enriched).</summary>
        [HttpGet("{customerId}")]
        public async Task<IActionResult> Get(int customerId)
        {
            var result = await _adminService.GetSubscriptionDetailAsync(customerId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Change plan for the tenant with explicit proration control.
        /// Body: { newPlanId, prorationBehavior: "create_prorations" | "none" | "always_invoice", notes }
        /// </summary>
        [HttpPost("{customerId}/ChangePlan")]
        public async Task<IActionResult> ChangePlan(int customerId, [FromBody] AdminChangePlanDto dto)
        {
            var adminUserId = GetUserIdFromClaims();
            var result = await _adminService.ChangePlanAsync(customerId, adminUserId, dto);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>Preview what the customer will be charged today if their plan changed now.</summary>
        [HttpGet("{customerId}/PreviewPlanChange/{newPlanId}")]
        public async Task<IActionResult> PreviewPlanChange(int customerId, int newPlanId)
        {
            var result = await _adminService.PreviewPlanChangeAsync(customerId, newPlanId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>Cancel the tenant's subscription. Body: { immediately, notes }</summary>
        [HttpPost("{customerId}/Cancel")]
        public async Task<IActionResult> Cancel(int customerId, [FromBody] AdminCancelDto? dto)
        {
            var adminUserId = GetUserIdFromClaims();
            var result = await _adminService.CancelAsync(customerId, adminUserId, dto ?? new AdminCancelDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>Undo cancel_at_period_end. Subscription resumes auto-renewing.</summary>
        [HttpPost("{customerId}/Reactivate")]
        public async Task<IActionResult> Reactivate(int customerId)
        {
            var adminUserId = GetUserIdFromClaims();
            var result = await _adminService.ReactivateAsync(customerId, adminUserId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>Pause Stripe billing without canceling the subscription.</summary>
        [HttpPost("{customerId}/Pause")]
        public async Task<IActionResult> Pause(int customerId, [FromBody] AdminPauseDto? dto)
        {
            var adminUserId = GetUserIdFromClaims();
            var result = await _adminService.PauseAsync(customerId, adminUserId, dto ?? new AdminPauseDto());
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>Resume Stripe billing after a pause.</summary>
        [HttpPost("{customerId}/Resume")]
        public async Task<IActionResult> Resume(int customerId)
        {
            var adminUserId = GetUserIdFromClaims();
            var result = await _adminService.ResumeAsync(customerId, adminUserId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>Debugging tool: force-mirror Stripe state to our DB.</summary>
        [HttpPost("{customerId}/SyncFromStripe")]
        public async Task<IActionResult> SyncFromStripe(int customerId)
        {
            var result = await _adminService.SyncFromStripeAsync(customerId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Backfill: fetch all Stripe invoices for the tenant and upsert into our DB.
        /// Captures HostedInvoiceUrl + InvoicePdfUrl so historical Stripe invoices show "View".
        /// </summary>
        [HttpPost("{customerId}/SyncInvoices")]
        public async Task<IActionResult> SyncInvoices(int customerId)
        {
            var result = await _adminService.SyncInvoicesFromStripeAsync(customerId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// QA helper (test mode only): creates a real Stripe invoice with a $1 line item,
        /// finalizes it, marks it paid out-of-band (no card charged), and mirrors it into
        /// the local DB so it appears in the invoices list with a working "View" button.
        /// Blocked unless the configured Stripe SecretKey starts with sk_test_.
        /// </summary>
        [HttpPost("{customerId}/CreateTestInvoice")]
        public async Task<IActionResult> CreateTestInvoice(int customerId)
        {
            var result = await _adminService.CreateTestInvoiceAsync(customerId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        private int GetUserIdFromClaims()
        {
            var userIdClaim = User.FindFirst("UserId")?.Value;
            return int.TryParse(userIdClaim, out var userId) ? userId : 0;
        }
    }
}
