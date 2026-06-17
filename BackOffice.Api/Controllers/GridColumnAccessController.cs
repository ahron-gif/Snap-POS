using BackOffice.Application.DTOs.Tenant.GridColumnAccess;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;

namespace BackOffice.Api.Controllers
{
    /// <summary>
    /// Manages Super-Admin-defined per-user column visibility rules on grids.
    ///
    /// The tenant context (which DB we write to / read from) is resolved via the
    /// standard auth infrastructure from the caller's CustomerId header/claim.
    /// Super Admin callers must set their CustomerId to the target tenant's id
    /// before invoking the admin-scoped endpoints (the existing Switch Tenant
    /// flow on the frontend handles this automatically).
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class GridColumnAccessController : ControllerBase
    {
        private readonly IGridColumnAccessService _service;

        public GridColumnAccessController(IGridColumnAccessService service)
        {
            _service = service;
        }

        // ----- Regular-user endpoints ------------------------------------------------

        /// <summary>
        /// Returns the EFFECTIVE column-access rules for the currently-logged-in
        /// user on the specified grid — tenant defaults overlaid with any
        /// user-specific overrides. Every grid-based page calls this on mount
        /// to strip restricted columns before rendering.
        ///
        /// If no rules exist, returns an empty list — callers should interpret
        /// that as "all columns visible".
        /// </summary>
        [HttpGet("me/{gridId}")]
        public async Task<IActionResult> GetMyAccess(string gridId)
        {
            if (!TryGetCurrentUserId(out var userId, out var unauthorized))
                return unauthorized!;

            var result = await _service.GetEffectiveForUserAsync(userId, gridId);
            return Ok(result);
        }

        /// <summary>
        /// Saves the current user's own column-override set for a grid.
        /// Any UserId on the incoming DTO is IGNORED — the caller's LocalUserId
        /// from claims is forced in. Smart-save in the service skips fields
        /// that match the tenant default, so the user keeps inheriting future
        /// tenant changes for unchanged fields.
        ///
        /// Used by the in-grid column chooser when the user toggles visibility,
        /// resizes a column, or changes an aggregate.
        /// </summary>
        [HttpPost("me")]
        public async Task<IActionResult> SaveMine([FromBody] SaveGridColumnAccessDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (!TryGetCurrentUserId(out var userId, out var unauthorized))
                return unauthorized!;

            // Force the target user to the caller — this endpoint is self-scoped.
            dto.UserId = userId;

            var result = await _service.SaveAsync(dto, userId);
            if (!result.IsSuccess)
                return BadRequest(result);

            return Ok(result);
        }

        /// <summary>
        /// Returns a lightweight version token (max DateModified across rows
        /// that affect this user for this grid). The frontend calls this on
        /// document visibility return to decide whether to refetch the full
        /// effective column-access payload — cheap call, fires once per
        /// visibility flip.
        ///
        /// Response shape: ApiResult&lt;DateTime?&gt; where Response is the
        /// timestamp (or null when no rules exist for this grid).
        /// </summary>
        [HttpGet("me/{gridId}/version")]
        public async Task<IActionResult> GetMyVersion(string gridId)
        {
            if (!TryGetCurrentUserId(out var userId, out var unauthorized))
                return unauthorized!;

            var result = await _service.GetVersionForUserAsync(userId, gridId);
            return Ok(result);
        }

        /// <summary>
        /// Resets the current user's column-override set for a grid (deletes
        /// only their own rows, leaving tenant defaults untouched). After this
        /// call, GetEffectiveForUserAsync returns the pure tenant defaults
        /// for this user — the "Reset to Default" action from the in-grid
        /// chooser.
        /// </summary>
        [HttpDelete("me/{gridId}")]
        public async Task<IActionResult> ResetMine(string gridId)
        {
            if (!TryGetCurrentUserId(out var userId, out var unauthorized))
                return unauthorized!;

            var result = await _service.ResetForUserAndGridAsync(userId, gridId);
            if (!result.IsSuccess)
                return BadRequest(result);

            return Ok(result);
        }

        // ----- Super Admin endpoints -------------------------------------------------

        /// <summary>
        /// Super-Admin-only: get the EFFECTIVE column-access rules for a user
        /// on a grid (tenant defaults overlaid with any user-specific overrides).
        /// This is what the user currently sees — the admin edits from this
        /// starting point, so unchanged fields stay inherited from the tenant
        /// default. Target tenant is inferred from CustomerId claim/header.
        ///
        /// When <paramref name="userId"/> is Guid.Empty, this returns the
        /// tenant-wide defaults (same as saving/editing the tenant default).
        /// </summary>
        [HttpGet("admin/{userId:guid}/{gridId}")]
        public async Task<IActionResult> GetForUser(Guid userId, string gridId)
        {
            if (!EnsureSuperAdmin(out var forbid))
                return forbid!;

            var result = await _service.GetEffectiveForUserAsync(userId, gridId);
            return Ok(result);
        }

        /// <summary>
        /// Super-Admin-only: upsert the full column-access set for a user + grid.
        /// Replaces all existing rules for that pair in a single transaction.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> Save([FromBody] SaveGridColumnAccessDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (!EnsureSuperAdmin(out var forbid))
                return forbid!;

            if (!TryGetCurrentUserId(out var modifiedBy, out var unauthorized))
                return unauthorized!;

            var result = await _service.SaveAsync(dto, modifiedBy);
            if (!result.IsSuccess)
                return BadRequest(result);

            return Ok(result);
        }

        /// <summary>
        /// Super-Admin-only: delete all column-access rules for a user + grid
        /// (resets the user back to "all columns visible").
        /// </summary>
        [HttpDelete("{userId:guid}/{gridId}")]
        public async Task<IActionResult> Reset(Guid userId, string gridId)
        {
            if (!EnsureSuperAdmin(out var forbid))
                return forbid!;

            var result = await _service.ResetForUserAndGridAsync(userId, gridId);
            if (!result.IsSuccess)
                return BadRequest(result);

            return Ok(result);
        }

        // ----- Super Admin: GLOBAL default endpoints (Main DB) -----------------------

        /// <summary>
        /// Super-Admin-only: get the GLOBAL, cross-tenant default column config
        /// for a grid. Stored in the MAIN (master) database, NOT any tenant DB.
        /// This is the baseline applied to every tenant that has not saved its
        /// own configuration. Does not depend on the CustomerId header.
        /// </summary>
        [HttpGet("admin/default/{gridId}")]
        public async Task<IActionResult> GetDefault(string gridId)
        {
            if (!EnsureSuperAdmin(out var forbid))
                return forbid!;

            var result = await _service.GetDefaultAsync(gridId);
            return Ok(result);
        }

        /// <summary>
        /// Super-Admin-only: upsert the GLOBAL, cross-tenant default column config
        /// for a grid in the MAIN database (wipe-and-insert). The UserId on the
        /// DTO is ignored — the global default has no user or tenant key.
        /// </summary>
        [HttpPost("default")]
        public async Task<IActionResult> SaveDefault([FromBody] SaveGridColumnAccessDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (!EnsureSuperAdmin(out var forbid))
                return forbid!;

            if (!TryGetCurrentUserId(out var modifiedBy, out var unauthorized))
                return unauthorized!;

            var result = await _service.SaveDefaultAsync(dto, modifiedBy);
            if (!result.IsSuccess)
                return BadRequest(result);

            return Ok(result);
        }

        /// <summary>
        /// Super-Admin-only: delete the GLOBAL, cross-tenant default column config
        /// for a grid from the MAIN database (tenants that inherit it revert to
        /// the page's natural column defaults).
        /// </summary>
        [HttpDelete("admin/default/{gridId}")]
        public async Task<IActionResult> ResetDefault(string gridId)
        {
            if (!EnsureSuperAdmin(out var forbid))
                return forbid!;

            var result = await _service.ResetDefaultAsync(gridId);
            if (!result.IsSuccess)
                return BadRequest(result);

            return Ok(result);
        }

        // ----- Helpers ---------------------------------------------------------------

        /// <summary>
        /// Extracts the current caller's tenant-scoped user id (LocalUserId) from claims.
        /// </summary>
        private bool TryGetCurrentUserId(out Guid userId, out IActionResult? unauthorizedResult)
        {
            var claim = User.FindFirst("LocalUserId");
            if (claim == null || !Guid.TryParse(claim.Value, out userId))
            {
                userId = Guid.Empty;
                unauthorizedResult = Unauthorized(new
                {
                    IsSuccess = false,
                    Message = "User ID not found in token."
                });
                return false;
            }

            unauthorizedResult = null;
            return true;
        }

        /// <summary>
        /// Enforces the Super-Admin-only guard. Follows the same pattern as
        /// SuperAdminController: CustomerId claim must be "0" (or absent).
        /// </summary>
        private bool EnsureSuperAdmin(out IActionResult? forbidResult)
        {
            var customerIdClaim = User.FindFirst("CustomerId")?.Value;
            if (!string.IsNullOrEmpty(customerIdClaim) && customerIdClaim != "0")
            {
                forbidResult = Forbid();
                return false;
            }

            forbidResult = null;
            return true;
        }
    }
}
