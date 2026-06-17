using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/Billing/Checkout")]
    [ApiController]
    [Authorize]
    public class CheckoutController : ControllerBase
    {
        private readonly IStripeCheckoutService _checkoutService;
        private readonly IAddOnService _addOnService;

        public CheckoutController(IStripeCheckoutService checkoutService, IAddOnService addOnService)
        {
            _checkoutService = checkoutService;
            _addOnService = addOnService;
        }

        /// <summary>
        /// Creates a Stripe-hosted Checkout Session for a tenant plan upgrade.
        /// Frontend redirects window.location to the returned URL.
        /// </summary>
        [HttpPost("CreateUpgradeSession")]
        public async Task<IActionResult> CreateUpgradeSession([FromBody] CreateUpgradeSessionDto dto)
        {
            var customerId = GetCustomerIdFromContext();
            if (customerId == 0)
                return BadRequest("Customer not found in claims or header.");

            var userId = GetUserIdFromClaims();

            var result = await _checkoutService.CreateUpgradeSessionAsync(customerId, userId, dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Polled by the success page until the webhook flips the subscription
        /// to paid. Scoped to the calling tenant — a tenant cannot read another's session.
        /// </summary>
        [HttpGet("Session/{sessionId}/Status")]
        public async Task<IActionResult> GetSessionStatus(string sessionId)
        {
            var customerId = GetCustomerIdFromContext();
            if (customerId == 0)
                return BadRequest("Customer not found in claims or header.");

            var result = await _checkoutService.GetSessionStatusAsync(customerId, sessionId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Backstop reconciliation: applies any incomplete PendingUpgrade for this tenant
        /// whose Stripe session is paid. Frontend calls this on every billing-page load
        /// so plan changes apply even if Stripe's success-redirect was lost.
        /// </summary>
        [HttpPost("ReconcilePending")]
        public async Task<IActionResult> ReconcilePending()
        {
            var customerId = GetCustomerIdFromContext();
            if (customerId == 0)
                return BadRequest("Customer not found in claims or header.");

            var result = await _checkoutService.ReconcilePendingAsync(customerId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Phase 2: First-time subscribe. Creates a Stripe Checkout Session in
        /// mode=subscription using the Plan's pre-synced StripeMonthlyPriceId.
        /// After payment, Stripe creates a real recurring Subscription that auto-renews monthly.
        /// </summary>
        [HttpPost("CreateSubscribeSession")]
        public async Task<IActionResult> CreateSubscribeSession([FromBody] CreateSubscribeSessionDto dto)
        {
            var customerId = GetCustomerIdFromContext();
            if (customerId == 0)
                return BadRequest("Customer not found in claims or header.");

            var userId = GetUserIdFromClaims();

            var result = await _checkoutService.CreateSubscribeSessionAsync(customerId, userId, dto);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        // ─── Phase 3: Direct subscription management (no Checkout redirect) ───

        /// <summary>
        /// Switch the current subscription to a different plan. Stripe handles
        /// proration immediately against the saved card. No redirect.
        /// </summary>
        [HttpPost("ChangePlan")]
        public async Task<IActionResult> ChangePlan([FromBody] ChangeSubscriptionPlanDto dto)
        {
            var customerId = GetCustomerIdFromContext();
            if (customerId == 0) return BadRequest("Customer not found in claims or header.");

            var result = await _checkoutService.ChangeSubscriptionPlanAsync(customerId, dto);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Preview the proration ("you'll be charged $X today") for a plan change.
        /// </summary>
        [HttpGet("PreviewPlanChange/{newPlanId}")]
        public async Task<IActionResult> PreviewPlanChange(int newPlanId)
        {
            var customerId = GetCustomerIdFromContext();
            if (customerId == 0) return BadRequest("Customer not found in claims or header.");

            var result = await _checkoutService.PreviewPlanChangeAsync(customerId, newPlanId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>Cancel subscription at end of current period.</summary>
        [HttpPost("Cancel")]
        public async Task<IActionResult> Cancel()
        {
            var customerId = GetCustomerIdFromContext();
            if (customerId == 0) return BadRequest("Customer not found in claims or header.");

            var result = await _checkoutService.CancelSubscriptionAsync(customerId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>Undo cancel-at-period-end. Subscription resumes auto-renewing.</summary>
        [HttpPost("Reactivate")]
        public async Task<IActionResult> Reactivate()
        {
            var customerId = GetCustomerIdFromContext();
            if (customerId == 0) return BadRequest("Customer not found in claims or header.");

            var result = await _checkoutService.ReactivateSubscriptionAsync(customerId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Returns a Stripe Customer Portal URL — Stripe-hosted self-service for
        /// updating cards, viewing invoices, downloading receipts. Frontend opens it.
        /// </summary>
        [HttpPost("CustomerPortalSession")]
        public async Task<IActionResult> CustomerPortalSession()
        {
            var customerId = GetCustomerIdFromContext();
            if (customerId == 0) return BadRequest("Customer not found in claims or header.");

            var result = await _checkoutService.CreateCustomerPortalSessionAsync(customerId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        // ─── Add-ons (extra devices/users beyond plan's FreeUnits) ───

        /// <summary>
        /// Dry-run preview of the prorated total for the proposed quantity changes.
        /// Drives the "Estimated Bill" panel as the user adjusts +/- buttons.
        /// </summary>
        [HttpPost("PreviewAddOn")]
        public async Task<IActionResult> PreviewAddOn([FromBody] AddOnRequestDto dto)
        {
            var customerId = GetCustomerIdFromContext();
            if (customerId == 0) return BadRequest("Customer not found in claims or header.");

            var result = await _addOnService.PreviewAsync(customerId, dto);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Creates a Stripe Checkout Session (mode=payment) for the prorated total
        /// of the add-on changes and stores a PendingAddOn row. Frontend redirects
        /// window.location to the returned Url. After payment, Stripe sends the
        /// user back to /licenses-billing?addon=success&amp;session_id=... and the
        /// matching webhook applies the change to the recurring subscription.
        /// </summary>
        [HttpPost("CreateAddOnSession")]
        public async Task<IActionResult> CreateAddOnSession([FromBody] AddOnRequestDto dto)
        {
            var customerId = GetCustomerIdFromContext();
            if (customerId == 0) return BadRequest("Customer not found in claims or header.");

            var userId = GetUserIdFromClaims();

            var result = await _addOnService.CreateCheckoutSessionAsync(customerId, userId, dto);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Polled by the success page until <c>PlanApplied=true</c>. Idempotent —
        /// also runs the apply step inline if Stripe shows the session as paid and
        /// we haven't reflected it yet (covers missed/late webhooks for local dev).
        /// </summary>
        [HttpGet("AddOnSession/{sessionId}/Status")]
        public async Task<IActionResult> GetAddOnSessionStatus(string sessionId)
        {
            var customerId = GetCustomerIdFromContext();
            if (customerId == 0) return BadRequest("Customer not found in claims or header.");

            var result = await _addOnService.GetSessionStatusAsync(customerId, sessionId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Backstop reconciliation — applies any incomplete PendingAddOn for this
        /// tenant whose Stripe session is paid. Frontend calls this on every
        /// billing-page load so changes apply even if Stripe's success-redirect
        /// or webhook was lost.
        /// </summary>
        [HttpPost("ReconcilePendingAddOns")]
        public async Task<IActionResult> ReconcilePendingAddOns()
        {
            var customerId = GetCustomerIdFromContext();
            if (customerId == 0) return BadRequest("Customer not found in claims or header.");

            var result = await _addOnService.ReconcilePendingAsync(customerId);
            if (!result.IsSuccess) return BadRequest(result);
            return Ok(result);
        }

        // Tenant context: prefer the JWT claim. Fall back to the CustomerId header
        // (set by the frontend axios interceptor) so a master admin who has selected
        // a tenant in the UI can also drive this flow.
        private int GetCustomerIdFromContext()
        {
            var claim = User.FindFirst("CustomerId")?.Value;
            if (int.TryParse(claim, out var fromClaim) && fromClaim > 0)
                return fromClaim;

            if (Request.Headers.TryGetValue("CustomerId", out var headerVal)
                && int.TryParse(headerVal.ToString(), out var fromHeader) && fromHeader > 0)
                return fromHeader;

            return 0;
        }

        private int GetUserIdFromClaims()
        {
            var userIdClaim = User.FindFirst("UserId")?.Value;
            return int.TryParse(userIdClaim, out var userId) ? userId : 0;
        }
    }
}
