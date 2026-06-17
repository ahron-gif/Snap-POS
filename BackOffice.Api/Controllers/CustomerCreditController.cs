using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    /// <summary>
    /// OpenAPI prepaid-credit endpoints. Tenant endpoints scope by JWT CustomerId;
    /// admin endpoints take a customerId in the URL and require SuperAdmin.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CustomerCreditController : ControllerBase
    {
        private readonly ICustomerCreditService _creditService;
        private readonly IStripeCheckoutService _stripeCheckout;

        public CustomerCreditController(
            ICustomerCreditService creditService,
            IStripeCheckoutService stripeCheckout)
        {
            _creditService = creditService;
            _stripeCheckout = stripeCheckout;
        }

        // ─── Tenant endpoints (scoped to the JWT's CustomerId) ─────────────

        /// <summary>Wallet balance + per-ApiDefinition free-tier snapshot for the caller.</summary>
        [HttpGet("MyBalance")]
        public async Task<IActionResult> GetMyBalance()
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest(ApiResponseFactory.BadRequest<CreditBalanceDto>(
                    "Customer not resolved. Sign in as a tenant user, or include a 'CustomerId' header if acting on behalf of a tenant."));

            var result = await _creditService.GetBalanceAsync(customerId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>Paged ledger for the caller (newest first).</summary>
        [HttpGet("MyTransactions")]
        public async Task<IActionResult> GetMyTransactions([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest(ApiResponseFactory.BadRequest<PagedCreditTransactionsDto>(
                    "Customer not resolved. Sign in as a tenant user, or include a 'CustomerId' header if acting on behalf of a tenant."));

            var result = await _creditService.GetTransactionsAsync(customerId, page, pageSize);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Start a Stripe Checkout session for a one-off credit top-up. Returns the
        /// hosted-checkout URL; the frontend redirects the browser there. On payment
        /// success Stripe's checkout.session.completed webhook credits the wallet.
        /// </summary>
        [HttpPost("TopUp")]
        public async Task<IActionResult> TopUp([FromBody] TopUpRequestDto dto)
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest(ApiResponseFactory.BadRequest<CheckoutSessionResultDto>(
                    "Customer not resolved. Sign in as a tenant user, or include a 'CustomerId' header if acting on behalf of a tenant."));

            if (dto == null || dto.Amount < 5m || dto.Amount > 5000m)
                return BadRequest(ApiResponseFactory.BadRequest<CheckoutSessionResultDto>(
                    "Amount must be between 5 and 5000."));

            var userId = GetUserIdFromClaims();
            var result = await _stripeCheckout.CreateCreditTopUpSessionAsync(customerId, userId, dto.Amount);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Polling-mode backstop: after returning from Stripe Checkout the frontend
        /// calls this to apply the top-up inline (needed in environments without a
        /// webhook tunnel). Idempotent — a late webhook will see the row and exit early.
        /// </summary>
        [HttpPost("TopUp/Reconcile/{sessionId}")]
        public async Task<IActionResult> ReconcileTopUp(string sessionId)
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest(ApiResponseFactory.BadRequest<bool>(
                    "Customer not resolved. Sign in as a tenant user, or include a 'CustomerId' header if acting on behalf of a tenant."));

            var result = await _stripeCheckout.ReconcileCreditTopUpAsync(customerId, sessionId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Broader recovery scan: looks at the tenant's recent Stripe Checkout sessions
        /// and applies any paid credit top-ups that haven't been credited yet. Used
        /// when the redirect param was lost (back-button etc.) and the webhook never
        /// delivered. Idempotent.
        /// </summary>
        [HttpPost("TopUp/Recover")]
        public async Task<IActionResult> RecoverPendingTopUps()
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest(ApiResponseFactory.BadRequest<CreditTopUpRecoveryResultDto>(
                    "Customer not resolved. Sign in as a tenant user, or include a 'CustomerId' header if acting on behalf of a tenant."));

            var result = await _stripeCheckout.RecoverPendingCreditTopUpsAsync(customerId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Manual escape hatch: tenant pastes a Stripe Checkout Session ID for a
        /// payment that the auto-scan couldn't find (usually because the BackOffice
        /// Customer.StripeCustomerId linkage doesn't match the Stripe Customer the
        /// payment was made under). Applies the session's amount to the CALLING
        /// tenant's wallet. Idempotent.
        /// </summary>
        [HttpPost("TopUp/ApplyBySessionId")]
        public async Task<IActionResult> ApplyTopUpBySessionId([FromBody] ApplyBySessionIdDto dto)
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest(ApiResponseFactory.BadRequest<bool>(
                    "Customer not resolved. Sign in as a tenant user, or include a 'CustomerId' header if acting on behalf of a tenant."));

            if (dto == null || string.IsNullOrWhiteSpace(dto.SessionId))
                return BadRequest(ApiResponseFactory.BadRequest<bool>("sessionId is required."));

            var result = await _stripeCheckout.ApplyCreditTopUpBySessionIdAsync(customerId, dto.SessionId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>
        /// Read-only diagnostic: given a Stripe Checkout Session ID, return the full
        /// trace (Stripe-side fields, BackOffice-side fields, match analysis,
        /// idempotency state, and a "would Apply succeed?" verdict). Used to debug
        /// "I paid $50 in Stripe but my wallet is still $0" scenarios end-to-end.
        /// </summary>
        [HttpPost("TopUp/Trace")]
        public async Task<IActionResult> TraceTopUp([FromBody] ApplyBySessionIdDto dto)
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest(ApiResponseFactory.BadRequest<CreditTopUpTraceDto>(
                    "Customer not resolved. Sign in as a tenant user, or include a 'CustomerId' header if acting on behalf of a tenant."));

            if (dto == null || string.IsNullOrWhiteSpace(dto.SessionId))
                return BadRequest(ApiResponseFactory.BadRequest<CreditTopUpTraceDto>("sessionId is required."));

            var result = await _stripeCheckout.TraceCreditTopUpAsync(customerId, dto.SessionId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        public class ApplyBySessionIdDto
        {
            public string SessionId { get; set; } = "";
        }

        /// <summary>
        /// Guarantee a Stripe Customer exists for the calling tenant. Idempotent —
        /// returns the existing cus_… if already linked, otherwise finds an orphan
        /// or creates a fresh one. Surfaces the linkage status on the credit panel.
        /// </summary>
        [HttpPost("EnsureStripeCustomer")]
        public async Task<IActionResult> EnsureStripeCustomer()
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest(ApiResponseFactory.BadRequest<EnsureStripeCustomerResultDto>(
                    "Customer not resolved. Sign in as a tenant user, or include a 'CustomerId' header if acting on behalf of a tenant."));

            var result = await _stripeCheckout.EnsureStripeCustomerAsync(customerId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        // ─── Super-admin endpoints (act on behalf of any tenant) ───────────

        /// <summary>Wallet snapshot for any tenant (super-admin).</summary>
        [HttpGet("Customer/{customerId}")]
        public async Task<IActionResult> GetCustomerBalance(int customerId)
        {
            if (!IsSuperAdminFromToken())
                return Forbid();

            var result = await _creditService.GetBalanceAsync(customerId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>Ledger for any tenant (super-admin).</summary>
        [HttpGet("Customer/{customerId}/Transactions")]
        public async Task<IActionResult> GetCustomerTransactions(
            int customerId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            if (!IsSuperAdminFromToken())
                return Forbid();

            var result = await _creditService.GetTransactionsAsync(customerId, page, pageSize);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        /// <summary>Manual ± adjustment for a tenant (super-admin). Audited via CreatedByUserId.</summary>
        [HttpPost("Admin/Adjust/{customerId}")]
        public async Task<IActionResult> AdminAdjust(int customerId, [FromBody] AdminAdjustCreditDto dto)
        {
            if (!IsSuperAdminFromToken())
                return Forbid();

            if (dto == null)
                return BadRequest(ApiResponseFactory.BadRequest<CreditBalanceDto>("Body required."));

            var adminUserId = GetUserIdFromClaims();
            var result = await _creditService.AdminAdjustAsync(customerId, dto.Amount, dto.Description ?? "", adminUserId);
            return result.IsSuccess ? Ok(result) : BadRequest(result);
        }

        // ─── Claim helpers (match the patterns used by sibling controllers) ─

        // Resolve the active tenant context: prefer the JWT claim (tenant admins),
        // fall back to the CustomerId header (master admins acting on behalf of a
        // tenant). Matches UsageController.GetCustomerIdFromClaims().
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

        private int GetUserIdFromClaims()
        {
            var claim = User.FindFirst("UserId")?.Value;
            return int.TryParse(claim, out var userId) ? userId : 0;
        }

        private bool IsSuperAdminFromToken()
        {
            var roleClaim = User.FindFirst("RoleType")?.Value;
            if (string.Equals(roleClaim, "SuperAdmin", StringComparison.OrdinalIgnoreCase))
                return true;
            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            return string.IsNullOrEmpty(customerIdClaim) || customerIdClaim == "0";
        }
    }
}
