using BackOffice.Application.Interfaces.Services.Main;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    /// <summary>
    /// Super-admin tooling for keeping our Plans in sync with Stripe's product catalog.
    /// Run after creating or editing Plans so subscription billing has the right Price IDs.
    /// </summary>
    [Route("api/Stripe/Catalog")]
    [ApiController]
    [Authorize]
    public class StripeCatalogController : ControllerBase
    {
        private readonly IStripeCatalogService _catalogService;

        public StripeCatalogController(IStripeCatalogService catalogService)
        {
            _catalogService = catalogService;
        }

        /// <summary>
        /// One-shot sync: creates Stripe Products and monthly Prices for every active
        /// Plan that doesn't already have them. Idempotent. Returns count synced.
        /// </summary>
        [HttpPost("SyncAll")]
        public async Task<IActionResult> SyncAll()
        {
            var result = await _catalogService.SyncAllPlansAsync();
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Sync a single plan (use after creating/editing a Plan in the admin UI).
        /// </summary>
        [HttpPost("Sync/{planId}")]
        public async Task<IActionResult> Sync(int planId)
        {
            var result = await _catalogService.SyncPlanAsync(planId);
            if (!result.IsSuccess)
                return BadRequest(result);
            return Ok(result);
        }
    }
}
