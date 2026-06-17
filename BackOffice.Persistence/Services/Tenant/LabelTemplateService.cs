using BackOffice.Application.DTOs.Tenant.LabelTemplate;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Persistence.Services.Tenant
{
    /// <summary>
    /// Service for managing label templates
    /// </summary>
    public class LabelTemplateService : ILabelTemplateService
    {
        private readonly TenantDBContext _context;

        public LabelTemplateService(TenantDBContext context)
        {
            _context = context;
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<List<LabelTemplateListDto>>> GetAllTemplatesAsync(Guid? storeId, short? labelType = null)
        {
            try
            {
                var query = _context.LabelTemplates
                    .AsNoTracking()
                    .Where(x => x.Status >= 0); // Exclude deleted

                // Filter by store (include global templates where StoreId is null)
                if (storeId.HasValue)
                {
                    query = query.Where(x => x.StoreId == null || x.StoreId == storeId.Value);
                }
                else
                {
                    query = query.Where(x => x.StoreId == null);
                }

                // Filter by label type if provided
                if (labelType.HasValue)
                {
                    query = query.Where(x => x.LabelType == labelType.Value);
                }

                var templates = await query
                    .OrderBy(x => x.Name)
                    .Select(x => new LabelTemplateListDto
                    {
                        Id = x.Id,
                        Name = x.Name,
                        Description = x.Description,
                        LabelType = x.LabelType,
                        LabelWidth = x.LabelWidth,
                        LabelHeight = x.LabelHeight,
                        ColumnsPerPage = x.ColumnsPerPage,
                        RowsPerPage = x.RowsPerPage,
                        IsDefault = x.IsDefault,
                        DateModified = x.DateModified
                    })
                    .ToListAsync();

                return new ApiResponse<List<LabelTemplateListDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Templates retrieved successfully",
                    Response = templates
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<LabelTemplateListDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error retrieving templates: {ex.Message}",
                    Response = new List<LabelTemplateListDto>()
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<LabelTemplateDto>> GetTemplateByIdAsync(int id)
        {
            try
            {
                var template = await _context.LabelTemplates
                    .AsNoTracking()
                    .Where(x => x.Id == id && x.Status >= 0)
                    .Select(x => new LabelTemplateDto
                    {
                        Id = x.Id,
                        StoreId = x.StoreId,
                        Name = x.Name,
                        Description = x.Description,
                        LabelType = x.LabelType,
                        PaperSize = x.PaperSize,
                        LabelWidth = x.LabelWidth,
                        LabelHeight = x.LabelHeight,
                        ColumnsPerPage = x.ColumnsPerPage,
                        RowsPerPage = x.RowsPerPage,
                        MarginLeft = x.MarginLeft,
                        MarginTop = x.MarginTop,
                        HorizontalGap = x.HorizontalGap,
                        VerticalGap = x.VerticalGap,
                        DesignJson = x.DesignJson,
                        IsDefault = x.IsDefault,
                        DateCreated = x.DateCreated,
                        DateModified = x.DateModified
                    })
                    .FirstOrDefaultAsync();

                if (template == null)
                {
                    return new ApiResponse<LabelTemplateDto>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Template not found",
                        Response = null
                    };
                }

                return new ApiResponse<LabelTemplateDto>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Template retrieved successfully",
                    Response = template
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<LabelTemplateDto>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error retrieving template: {ex.Message}",
                    Response = null
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<LabelTemplateDto>> CreateTemplateAsync(LabelTemplateCreateDto dto, Guid userId)
        {
            try
            {
                var template = new LabelTemplate
                {
                    StoreId = dto.StoreId,
                    Name = dto.Name,
                    Description = dto.Description,
                    LabelType = dto.LabelType,
                    PaperSize = dto.PaperSize,
                    LabelWidth = dto.LabelWidth,
                    LabelHeight = dto.LabelHeight,
                    ColumnsPerPage = dto.ColumnsPerPage,
                    RowsPerPage = dto.RowsPerPage,
                    MarginLeft = dto.MarginLeft,
                    MarginTop = dto.MarginTop,
                    HorizontalGap = dto.HorizontalGap,
                    VerticalGap = dto.VerticalGap,
                    DesignJson = dto.DesignJson,
                    IsDefault = dto.IsDefault,
                    Status = 0,
                    UserCreated = userId,
                    DateCreated = DateTime.UtcNow,
                    UserModified = userId,
                    DateModified = DateTime.UtcNow
                };

                // If setting as default, clear other defaults
                if (dto.IsDefault)
                {
                    await ClearDefaultTemplatesAsync(dto.StoreId, dto.LabelType);
                }

                await _context.LabelTemplates.AddAsync(template);
                await _context.SaveChangesAsync();

                return await GetTemplateByIdAsync(template.Id);
            }
            catch (Exception ex)
            {
                return new ApiResponse<LabelTemplateDto>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error creating template: {ex.Message}",
                    Response = null
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<LabelTemplateDto>> UpdateTemplateAsync(int id, LabelTemplateUpdateDto dto, Guid userId)
        {
            try
            {
                var template = await _context.LabelTemplates
                    .FirstOrDefaultAsync(x => x.Id == id && x.Status >= 0);

                if (template == null)
                {
                    return new ApiResponse<LabelTemplateDto>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Template not found",
                        Response = null
                    };
                }

                // If setting as default, clear other defaults
                if (dto.IsDefault && !template.IsDefault)
                {
                    await ClearDefaultTemplatesAsync(template.StoreId, dto.LabelType);
                }

                template.Name = dto.Name;
                template.Description = dto.Description;
                template.LabelType = dto.LabelType;
                template.PaperSize = dto.PaperSize;
                template.LabelWidth = dto.LabelWidth;
                template.LabelHeight = dto.LabelHeight;
                template.ColumnsPerPage = dto.ColumnsPerPage;
                template.RowsPerPage = dto.RowsPerPage;
                template.MarginLeft = dto.MarginLeft;
                template.MarginTop = dto.MarginTop;
                template.HorizontalGap = dto.HorizontalGap;
                template.VerticalGap = dto.VerticalGap;
                template.DesignJson = dto.DesignJson;
                template.IsDefault = dto.IsDefault;
                template.UserModified = userId;
                template.DateModified = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return await GetTemplateByIdAsync(id);
            }
            catch (Exception ex)
            {
                return new ApiResponse<LabelTemplateDto>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error updating template: {ex.Message}",
                    Response = null
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<bool>> DeleteTemplateAsync(int id)
        {
            try
            {
                var template = await _context.LabelTemplates
                    .FirstOrDefaultAsync(x => x.Id == id && x.Status >= 0);

                if (template == null)
                {
                    return new ApiResponse<bool>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Template not found",
                        Response = false
                    };
                }

                // Soft delete
                template.Status = -1;
                template.DateModified = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return new ApiResponse<bool>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Template deleted successfully",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error deleting template: {ex.Message}",
                    Response = false
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<bool>> SetDefaultTemplateAsync(int id, Guid? storeId)
        {
            try
            {
                var template = await _context.LabelTemplates
                    .FirstOrDefaultAsync(x => x.Id == id && x.Status >= 0);

                if (template == null)
                {
                    return new ApiResponse<bool>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Template not found",
                        Response = false
                    };
                }

                // Clear other defaults for this label type and store
                await ClearDefaultTemplatesAsync(storeId, template.LabelType);

                // Set this template as default
                template.IsDefault = true;
                template.DateModified = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return new ApiResponse<bool>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Default template set successfully",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error setting default template: {ex.Message}",
                    Response = false
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<LabelTemplateDto>> DuplicateTemplateAsync(int id, string newName, Guid userId)
        {
            try
            {
                var source = await _context.LabelTemplates
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == id && x.Status >= 0);

                if (source == null)
                {
                    return new ApiResponse<LabelTemplateDto>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Source template not found",
                        Response = null
                    };
                }

                var duplicate = new LabelTemplate
                {
                    StoreId = source.StoreId,
                    Name = newName,
                    Description = source.Description,
                    LabelType = source.LabelType,
                    PaperSize = source.PaperSize,
                    LabelWidth = source.LabelWidth,
                    LabelHeight = source.LabelHeight,
                    ColumnsPerPage = source.ColumnsPerPage,
                    RowsPerPage = source.RowsPerPage,
                    MarginLeft = source.MarginLeft,
                    MarginTop = source.MarginTop,
                    HorizontalGap = source.HorizontalGap,
                    VerticalGap = source.VerticalGap,
                    DesignJson = source.DesignJson,
                    IsDefault = false, // Duplicate is never default
                    Status = 0,
                    UserCreated = userId,
                    DateCreated = DateTime.UtcNow,
                    UserModified = userId,
                    DateModified = DateTime.UtcNow
                };

                await _context.LabelTemplates.AddAsync(duplicate);
                await _context.SaveChangesAsync();

                return await GetTemplateByIdAsync(duplicate.Id);
            }
            catch (Exception ex)
            {
                return new ApiResponse<LabelTemplateDto>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error duplicating template: {ex.Message}",
                    Response = null
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<List<LabelDataDto>>> GetItemDataForLabelsAsync(List<Guid> itemStoreIds)
        {
            try
            {
                // Get item data from ItemMainAndStoreView
                var itemsData = await _context.ItemMainAndStoreViews
                    .AsNoTracking()
                    .Where(x => itemStoreIds.Contains(x.ItemStoreID))
                    .Select(x => new LabelDataDto
                    {
                        ItemStoreId = x.ItemStoreID,
                        BarcodeNumber = x.BarcodeNumber ?? string.Empty,
                        Description = x.Description ?? x.Name ?? string.Empty,
                        Measure = x.Size,
                        Price = x.Price,
                        PriceA = null, // ItemMainAndStoreView doesn't have PriceA directly
                        PriceB = null,
                        Cost = x.Cost,
                        Size = x.Size,
                        ModelNo = x.ModalNumber,
                        StyleNo = x.StyleNo,
                        ExtraInfo = x.extName,
                        DepartmentName = x.Department,
                        ManufacturerName = x.Brand,
                        ImageUrl = null
                    })
                    .ToListAsync();

                return new ApiResponse<List<LabelDataDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Item data retrieved successfully",
                    Response = itemsData
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<LabelDataDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error retrieving item data: {ex.Message}",
                    Response = new List<LabelDataDto>()
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<LabelPrintPreviewDto>> GetPrintPreviewAsync(LabelPrintRequestDto request)
        {
            try
            {
                var templateResult = await GetTemplateByIdAsync(request.TemplateId);
                if (!templateResult.IsSuccess || templateResult.Response == null)
                {
                    return new ApiResponse<LabelPrintPreviewDto>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Template not found",
                        Response = null
                    };
                }

                var itemsResult = await GetItemDataForLabelsAsync(request.ItemStoreIds);

                return new ApiResponse<LabelPrintPreviewDto>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Print preview generated successfully",
                    Response = new LabelPrintPreviewDto
                    {
                        Template = templateResult.Response,
                        Items = itemsResult.Response ?? new List<LabelDataDto>()
                    }
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<LabelPrintPreviewDto>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error generating print preview: {ex.Message}",
                    Response = null
                };
            }
        }

        /// <summary>
        /// Clear default flag on all templates of a specific type and store
        /// </summary>
        private async System.Threading.Tasks.Task ClearDefaultTemplatesAsync(Guid? storeId, short labelType)
        {
            var defaults = await _context.LabelTemplates
                .Where(x => x.Status >= 0 && x.IsDefault && x.LabelType == labelType &&
                           (storeId == null ? x.StoreId == null : x.StoreId == storeId))
                .ToListAsync();

            foreach (var template in defaults)
            {
                template.IsDefault = false;
                template.DateModified = DateTime.UtcNow;
            }
        }
    }
}
