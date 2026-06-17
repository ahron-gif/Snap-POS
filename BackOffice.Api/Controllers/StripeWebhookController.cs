using BackOffice.Application.Interfaces.Services.Main;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    [Route("api/Stripe")]
    [ApiController]
    public class StripeWebhookController : ControllerBase
    {
        private readonly IStripeCheckoutService _checkoutService;

        public StripeWebhookController(IStripeCheckoutService checkoutService)
        {
            _checkoutService = checkoutService;
        }

        /// <summary>
        /// Stripe webhook receiver. Authenticated by signature header, not bearer token.
        /// </summary>
        [HttpPost("Webhook")]
        [AllowAnonymous]
        public async Task<IActionResult> Webhook()
        {
            string payload;
            using (var reader = new StreamReader(Request.Body))
            {
                payload = await reader.ReadToEndAsync();
            }

            var signature = Request.Headers["Stripe-Signature"].ToString();

            var result = await _checkoutService.HandleWebhookAsync(payload, signature);
            if (!result.IsSuccess)
                return BadRequest(result.Message);

            return Ok();
        }
    }
}
