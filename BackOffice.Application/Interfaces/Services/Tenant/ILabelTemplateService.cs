using BackOffice.Application.DTOs.Tenant.LabelTemplate;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    /// <summary>
    /// Service interface for managing label templates
    /// </summary>
    public interface ILabelTemplateService
    {
        /// <summary>
        /// Get all label templates for a store (or global templates if storeId is null)
        /// </summary>
        /// <param name="storeId">Store ID to filter templates, or null for global templates</param>
        /// <param name="labelType">Optional label type filter</param>
        Task<ApiResponse<List<LabelTemplateListDto>>> GetAllTemplatesAsync(Guid? storeId, short? labelType = null);

        /// <summary>
        /// Get a specific label template by ID
        /// </summary>
        /// <param name="id">Template ID</param>
        Task<ApiResponse<LabelTemplateDto>> GetTemplateByIdAsync(int id);

        /// <summary>
        /// Create a new label template
        /// </summary>
        /// <param name="dto">Template creation data</param>
        /// <param name="userId">User creating the template</param>
        Task<ApiResponse<LabelTemplateDto>> CreateTemplateAsync(LabelTemplateCreateDto dto, Guid userId);

        /// <summary>
        /// Update an existing label template
        /// </summary>
        /// <param name="id">Template ID</param>
        /// <param name="dto">Template update data</param>
        /// <param name="userId">User updating the template</param>
        Task<ApiResponse<LabelTemplateDto>> UpdateTemplateAsync(int id, LabelTemplateUpdateDto dto, Guid userId);

        /// <summary>
        /// Delete a label template (soft delete)
        /// </summary>
        /// <param name="id">Template ID</param>
        Task<ApiResponse<bool>> DeleteTemplateAsync(int id);

        /// <summary>
        /// Set a template as the default for its label type
        /// </summary>
        /// <param name="id">Template ID to set as default</param>
        /// <param name="storeId">Store ID for the default</param>
        Task<ApiResponse<bool>> SetDefaultTemplateAsync(int id, Guid? storeId);

        /// <summary>
        /// Duplicate an existing template
        /// </summary>
        /// <param name="id">Template ID to duplicate</param>
        /// <param name="newName">Name for the new template</param>
        /// <param name="userId">User creating the duplicate</param>
        Task<ApiResponse<LabelTemplateDto>> DuplicateTemplateAsync(int id, string newName, Guid userId);

        /// <summary>
        /// Get item data for label printing
        /// </summary>
        /// <param name="itemStoreIds">List of ItemStoreIDs to get data for</param>
        Task<ApiResponse<List<LabelDataDto>>> GetItemDataForLabelsAsync(List<Guid> itemStoreIds);

        /// <summary>
        /// Get preview data for printing (template + item data)
        /// </summary>
        /// <param name="request">Print request with template ID and item IDs</param>
        Task<ApiResponse<LabelPrintPreviewDto>> GetPrintPreviewAsync(LabelPrintRequestDto request);
    }
}
