using BackOffice.Application.DTOs.Main.Billing;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class BillingController : ControllerBase
    {
        private readonly IBillingService _billingService;

        public BillingController(IBillingService billingService)
        {
            _billingService = billingService;
        }

        [HttpGet("EstimatedBill/{customerId}")]
        public async Task<IActionResult> GetEstimatedBill(int customerId)
        {
            var result = await _billingService.CalculateEstimatedBillAsync(customerId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("GenerateInvoice")]
        public async Task<IActionResult> GenerateInvoice([FromBody] GenerateInvoiceRequestDto dto)
        {
            var result = await _billingService.GenerateInvoiceAsync(dto.CustomerId, dto.BillingPeriodStart, dto.BillingPeriodEnd);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("Invoices/Customer/{customerId}")]
        public async Task<IActionResult> GetInvoicesForCustomer(int customerId)
        {
            var result = await _billingService.GetInvoicesForCustomerAsync(customerId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("Invoices/{invoiceId}")]
        public async Task<IActionResult> GetInvoice(int invoiceId)
        {
            var result = await _billingService.GetInvoiceByIdAsync(invoiceId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// "View Invoice" entrypoint. Returns either a Stripe-hosted URL the frontend
        /// can open in a new tab, or the full invoice detail for a local fallback modal
        /// (used for legacy DB-only invoices that pre-date Stripe).
        /// Tenants can only view their own invoices; super-admin not enforced here
        /// (frontend gates).
        /// </summary>
        [HttpGet("Invoices/{invoiceId}/ViewLink")]
        public async Task<IActionResult> GetInvoiceViewLink(int invoiceId)
        {
            var callerCustomerId = GetCustomerIdFromClaims();
            // If no tenant context (master admin), treat as admin so the tenant-ownership
            // guard is skipped. Frontend route guards via isSuperAdmin() for the admin UI.
            var isAdmin = callerCustomerId == 0;
            var result = await _billingService.GetInvoiceViewLinkAsync(invoiceId, callerCustomerId, isAdmin);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("Invoices/{invoiceId}/MarkPaid")]
        public async Task<IActionResult> MarkInvoicePaid(int invoiceId, [FromBody] MarkInvoicePaidDto dto)
        {
            var result = await _billingService.MarkInvoicePaidAsync(invoiceId, dto.PaymentReference);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPost("Invoices/{invoiceId}/PaymentAttempt")]
        public async Task<IActionResult> RecordPaymentAttempt(int invoiceId, [FromBody] RecordPaymentAttemptRequestDto dto)
        {
            var result = await _billingService.RecordPaymentAttemptAsync(invoiceId, dto.Status, dto.FailureReason);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpGet("Status/{customerId}")]
        public async Task<IActionResult> GetBillingStatus(int customerId)
        {
            var result = await _billingService.GetBillingStatusAsync(customerId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Get billing status for the currently logged-in customer.
        /// </summary>
        [HttpGet("MyStatus")]
        public async Task<IActionResult> GetMyBillingStatus()
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest("Customer not found in claims.");

            var result = await _billingService.GetBillingStatusAsync(customerId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Get estimated bill for the currently logged-in customer.
        /// </summary>
        [HttpGet("MyEstimate")]
        public async Task<IActionResult> GetMyEstimate()
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest("Customer not found in claims.");

            var result = await _billingService.CalculateEstimatedBillAsync(customerId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Get invoices for the currently logged-in customer.
        /// </summary>
        [HttpGet("MyInvoices")]
        public async Task<IActionResult> GetMyInvoices()
        {
            var customerId = GetCustomerIdFromClaims();
            if (customerId == 0)
                return BadRequest("Customer not found in claims.");

            var result = await _billingService.GetInvoicesForCustomerAsync(customerId);
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

    // Small DTOs for controller request bodies
    public class GenerateInvoiceRequestDto
    {
        public int CustomerId { get; set; }
        public DateTime BillingPeriodStart { get; set; }

        public DateTime BillingPeriodEnd { get; set; }
    }

    public class MarkInvoicePaidDto
    {
        public string? PaymentReference { get; set; }
    }

    public class RecordPaymentAttemptRequestDto
    {
        public PaymentStatus Status { get; set; }
        public string? FailureReason { get; set; }
    }
}
