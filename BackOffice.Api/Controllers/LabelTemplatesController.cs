using BackOffice.Application.DTOs.Tenant.LabelTemplate;
using BackOffice.Application.Interfaces.Services.Tenant;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Controllers
{
    /// <summary>
    /// Controller for managing label templates (item labels, shelf tags, etc.)
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class LabelTemplatesController : ControllerBase
    {
        private readonly ILabelTemplateService _labelTemplateService;

        public LabelTemplatesController(ILabelTemplateService labelTemplateService)
        {
            _labelTemplateService = labelTemplateService;
        }

        /// <summary>
        /// Get the current user's ID from token claims
        /// </summary>
        private Guid? GetUserId()
        {
            var localUserIdClaim = User.FindFirst("LocalUserId");
            if (localUserIdClaim != null && Guid.TryParse(localUserIdClaim.Value, out var userId))
            {
                return userId;
            }
            return null;
        }

        /// <summary>
        /// Get all label templates
        /// </summary>
        /// <param name="storeId">Optional store ID filter</param>
        /// <param name="labelType">Optional label type filter</param>
        [HttpGet]
        public async Task<IActionResult> GetAllTemplates([FromQuery] Guid? storeId, [FromQuery] short? labelType)
        {
            var result = await _labelTemplateService.GetAllTemplatesAsync(storeId, labelType);
            return Ok(result);
        }

        /// <summary>
        /// Get a specific label template by ID
        /// </summary>
        /// <param name="id">Template ID</param>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetTemplateById(int id)
        {
            var result = await _labelTemplateService.GetTemplateByIdAsync(id);
            return Ok(result);
        }

        /// <summary>
        /// Create a new label template
        /// </summary>
        /// <param name="dto">Template creation data</param>
        [HttpPost]
        public async Task<IActionResult> CreateTemplate([FromBody] LabelTemplateCreateDto dto)
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { IsSuccess = false, Message = "User ID not found in token." });
            }

            var result = await _labelTemplateService.CreateTemplateAsync(dto, userId.Value);
            return Ok(result);
        }

        /// <summary>
        /// Update an existing label template
        /// </summary>
        /// <param name="id">Template ID</param>
        /// <param name="dto">Template update data</param>
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTemplate(int id, [FromBody] LabelTemplateUpdateDto dto)
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { IsSuccess = false, Message = "User ID not found in token." });
            }

            var result = await _labelTemplateService.UpdateTemplateAsync(id, dto, userId.Value);
            return Ok(result);
        }

        /// <summary>
        /// Delete a label template (soft delete)
        /// </summary>
        /// <param name="id">Template ID</param>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTemplate(int id)
        {
            var result = await _labelTemplateService.DeleteTemplateAsync(id);
            return Ok(result);
        }

        /// <summary>
        /// Set a template as the default for its label type
        /// </summary>
        /// <param name="id">Template ID</param>
        /// <param name="storeId">Optional store ID for store-specific default</param>
        [HttpPost("{id}/set-default")]
        public async Task<IActionResult> SetDefaultTemplate(int id, [FromQuery] Guid? storeId)
        {
            var result = await _labelTemplateService.SetDefaultTemplateAsync(id, storeId);
            return Ok(result);
        }

        /// <summary>
        /// Duplicate an existing template
        /// </summary>
        /// <param name="id">Template ID to duplicate</param>
        /// <param name="newName">Name for the new template</param>
        [HttpPost("{id}/duplicate")]
        public async Task<IActionResult> DuplicateTemplate(int id, [FromQuery] string newName)
        {
            var userId = GetUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new { IsSuccess = false, Message = "User ID not found in token." });
            }

            if (string.IsNullOrWhiteSpace(newName))
            {
                return BadRequest(new { IsSuccess = false, Message = "New name is required." });
            }

            var result = await _labelTemplateService.DuplicateTemplateAsync(id, newName, userId.Value);
            return Ok(result);
        }

        /// <summary>
        /// Get item data for label printing
        /// </summary>
        /// <param name="itemStoreIds">List of ItemStoreIDs</param>
        [HttpPost("items")]
        public async Task<IActionResult> GetItemDataForLabels([FromBody] List<Guid> itemStoreIds)
        {
            if (itemStoreIds == null || !itemStoreIds.Any())
            {
                return BadRequest(new { IsSuccess = false, Message = "At least one ItemStoreID is required." });
            }

            var result = await _labelTemplateService.GetItemDataForLabelsAsync(itemStoreIds);
            return Ok(result);
        }

        /// <summary>
        /// Get print preview data (template + item data combined)
        /// </summary>
        /// <param name="request">Print request with template ID and item IDs</param>
        [HttpPost("preview")]
        public async Task<IActionResult> GetPrintPreview([FromBody] LabelPrintRequestDto request)
        {
            if (request.TemplateId <= 0)
            {
                return BadRequest(new { IsSuccess = false, Message = "Template ID is required." });
            }

            if (request.ItemStoreIds == null || !request.ItemStoreIds.Any())
            {
                return BadRequest(new { IsSuccess = false, Message = "At least one ItemStoreID is required." });
            }

            var result = await _labelTemplateService.GetPrintPreviewAsync(request);
            return Ok(result);
        }
    }
}
