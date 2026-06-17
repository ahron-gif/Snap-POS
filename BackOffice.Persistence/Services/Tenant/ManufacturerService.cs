using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Manufacturer;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class ManufacturerService : IManufacturerService
    {
        private readonly TenantDBContext _dbContext;

        public ManufacturerService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        public ApiResponse<PaginationResponseDTO<ManufacturerGridDto>> GetAllManufacturersGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _dbContext.Manufacturers
                    .Where(x => x.Status != 2) // Exclude deleted
                    .Select(x => new ManufacturerGridDto
                    {
                        ManufacturerID = x.ManufacturerID,
                        ManufacturerName = x.ManufacturerName ?? string.Empty,
                        ManufacturerNo = x.ManufacturerNo,
                        Status = x.Status,
                        DateCreated = x.DateCreated,
                        DateModified = x.DateModified
                    })
                    .AsQueryable();

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;
                var totalRecords = _dbContext.Manufacturers.Where(x => x.Status != 2).Count();
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "ManufacturerName", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<ManufacturerGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Manufacturers retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<ManufacturerGridDto>>(
                    "Error fetching manufacturers.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<List<ManufacturerGridDto>>> GetAllManufacturersAsync()
        {
            try
            {
                var manufacturers = await _dbContext.Manufacturers
                    .Where(x => x.Status != 2) // Exclude deleted
                    .OrderBy(x => x.ManufacturerName)
                    .Select(x => new ManufacturerGridDto
                    {
                        ManufacturerID = x.ManufacturerID,
                        ManufacturerName = x.ManufacturerName ?? string.Empty,
                        ManufacturerNo = x.ManufacturerNo,
                        Status = x.Status,
                        DateCreated = x.DateCreated,
                        DateModified = x.DateModified
                    })
                    .ToListAsync();

                return new ApiResponse<List<ManufacturerGridDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Manufacturers retrieved successfully",
                    Response = manufacturers
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<ManufacturerGridDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching manufacturers: {ex.Message}",
                    Response = new List<ManufacturerGridDto>()
                };
            }
        }

        public async Task<ApiResponse<ManufacturerDetailDto>> GetManufacturerByIdAsync(Guid manufacturerId)
        {
            try
            {
                var manufacturer = await _dbContext.Manufacturers
                    .Where(x => x.ManufacturerID == manufacturerId)
                    .Select(x => new ManufacturerDetailDto
                    {
                        ManufacturerID = x.ManufacturerID,
                        ManufacturerName = x.ManufacturerName ?? string.Empty,
                        ManufacturerNo = x.ManufacturerNo,
                        Status = x.Status,
                        DateCreated = x.DateCreated,
                        UserCreated = x.UserCreated,
                        DateModified = x.DateModified,
                        UserModified = x.UserModified
                    })
                    .FirstOrDefaultAsync();

                if (manufacturer == null)
                {
                    return new ApiResponse<ManufacturerDetailDto>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Manufacturer not found",
                        Response = null
                    };
                }

                return new ApiResponse<ManufacturerDetailDto>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Manufacturer retrieved successfully",
                    Response = manufacturer
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<ManufacturerDetailDto>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching manufacturer: {ex.Message}",
                    Response = null
                };
            }
        }

        public async Task<ApiResponse<Guid>> CreateManufacturerAsync(CreateManufacturerDto dto, Guid modifierId)
        {
            try
            {
                var nameTaken = await _dbContext.Manufacturers
                    .AnyAsync(m => m.ManufacturerName == dto.ManufacturerName && m.Status != 2);
                if (nameTaken)
                {
                    return new ApiResponse<Guid>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.ConflictError,
                        Message = "Manufacturer name already exists.",
                        Response = Guid.Empty
                    };
                }

                var now = DateTime.Now;
                var entity = new Manufacturer
                {
                    ManufacturerID = Guid.NewGuid(),
                    ManufacturerName = dto.ManufacturerName,
                    ManufacturerNo = string.IsNullOrWhiteSpace(dto.ManufacturerNo) ? null : dto.ManufacturerNo,
                    Status = dto.Status,
                    DateCreated = now,
                    UserCreated = modifierId,
                    DateModified = now,
                    UserModified = modifierId
                };

                _dbContext.Manufacturers.Add(entity);
                await _dbContext.SaveChangesAsync();

                return new ApiResponse<Guid>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Manufacturer created successfully",
                    Response = entity.ManufacturerID
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<Guid>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error creating manufacturer: {ex.Message}",
                    Response = Guid.Empty
                };
            }
        }

        public async Task<ApiResponse<bool>> UpdateManufacturerAsync(UpdateManufacturerDto dto, Guid modifierId)
        {
            try
            {
                var entity = await _dbContext.Manufacturers
                    .FirstOrDefaultAsync(m => m.ManufacturerID == dto.ManufacturerID);

                if (entity == null)
                {
                    return new ApiResponse<bool>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Manufacturer not found",
                        Response = false
                    };
                }

                if (dto.DateModified.HasValue
                    && entity.DateModified.HasValue
                    && Math.Abs((entity.DateModified.Value - dto.DateModified.Value).TotalSeconds) > 1)
                {
                    return new ApiResponse<bool>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.ConflictError,
                        Message = "Manufacturer was modified by another user — please reload and try again.",
                        Response = false
                    };
                }

                entity.ManufacturerName = dto.ManufacturerName;
                entity.ManufacturerNo = dto.ManufacturerNo;
                entity.Status = dto.Status;
                entity.DateModified = DateTime.Now;
                entity.UserModified = modifierId;

                await _dbContext.SaveChangesAsync();

                return new ApiResponse<bool>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Manufacturer updated successfully",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error updating manufacturer: {ex.Message}",
                    Response = false
                };
            }
        }

        public async Task<ApiResponse<bool>> DeleteManufacturerAsync(Guid manufacturerId, Guid modifierId)
        {
            try
            {
                var entity = await _dbContext.Manufacturers
                    .FirstOrDefaultAsync(m => m.ManufacturerID == manufacturerId);

                if (entity == null)
                {
                    return new ApiResponse<bool>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Manufacturer not found",
                        Response = false
                    };
                }

                // Soft delete: Status = 2 matches the filter used in queries (Status != 2).
                entity.Status = 2;
                entity.DateModified = DateTime.Now;
                entity.UserModified = modifierId;

                await _dbContext.SaveChangesAsync();

                return new ApiResponse<bool>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Manufacturer deleted successfully",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error deleting manufacturer: {ex.Message}",
                    Response = false
                };
            }
        }

        public async Task<ApiResponse<bool>> CanDeleteManufacturerAsync(Guid manufacturerId)
        {
            try
            {
                // Check if manufacturer has any items attached
                // Using ItemMain's ManufacturerID if it exists
                var hasItems = await _dbContext.ItemMains
                    .AnyAsync(x => x.ManufacturerID == manufacturerId);

                var canDelete = !hasItems;

                return new ApiResponse<bool>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = canDelete ? "Manufacturer can be deleted" : "Manufacturer has items and cannot be deleted",
                    Response = canDelete
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error checking if manufacturer can be deleted: {ex.Message}",
                    Response = false
                };
            }
        }

        public async Task<ApiResponse<bool>> ManufacturerNameExistsAsync(string name, Guid? excludeManufacturerId = null)
        {
            try
            {
                var query = _dbContext.Manufacturers
                    .Where(x => x.ManufacturerName == name && x.Status != 2);

                if (excludeManufacturerId.HasValue)
                {
                    query = query.Where(x => x.ManufacturerID != excludeManufacturerId.Value);
                }

                var exists = await query.AnyAsync();

                return new ApiResponse<bool>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = exists ? "Manufacturer name already exists" : "Manufacturer name is available",
                    Response = exists
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error checking manufacturer name: {ex.Message}",
                    Response = false
                };
            }
        }
    }
}
