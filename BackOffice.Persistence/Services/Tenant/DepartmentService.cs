using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Department;
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
    public class DepartmentService : IDepartmentService
    {
        private readonly TenantDBContext _dbContext;

        public DepartmentService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        public ApiResponse<PaginationResponseDTO<DepartmentGridDto>> GetAllDepartmentsGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _dbContext.DepartmentStoreViews
                    .Where(x => x.Status != 2) // Exclude deleted
                    .Select(x => new DepartmentGridDto
                    {
                        DepartmentStoreID = x.DepartmentStoreID,
                        Name = x.Name ?? string.Empty,
                        Description = x.Description,
                        ParentDepartmentID = x.ParentDepartmentID,
                        DefaultMarkup = x.DefaultMarkup,
                        RoundUp = x.RoundUp,
                        IsDefaultTaxInclude = x.IsDefaultTaxInclude,
                        IsDefaultFoodStampable = x.IsDefaultFoodStampable,
                        IsDefaultDiscountable = x.IsDefaultDiscountable,
                        Status = x.Status,
                        DateCreated = x.DateCreated,
                        DateModified = x.DateModified
                    })
                    .AsQueryable();

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;
                var totalRecords = _dbContext.DepartmentStoreViews.Where(x => x.Status != 2).Count();
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "Name", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<DepartmentGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Departments retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<DepartmentGridDto>>(
                    "Error fetching departments.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<List<DepartmentGridDto>>> GetAllDepartmentsAsync()
        {
            try
            {
                var departments = await _dbContext.DepartmentStoreViews
                    .Where(x => x.Status != 2) // Exclude deleted
                    .OrderBy(x => x.Name)
                    .Select(x => new DepartmentGridDto
                    {
                        DepartmentStoreID = x.DepartmentStoreID,
                        Name = x.Name ?? string.Empty,
                        Description = x.Description,
                        ParentDepartmentID = x.ParentDepartmentID,
                        DefaultMarkup = x.DefaultMarkup,
                        RoundUp = x.RoundUp,
                        IsDefaultTaxInclude = x.IsDefaultTaxInclude,
                        IsDefaultFoodStampable = x.IsDefaultFoodStampable,
                        IsDefaultDiscountable = x.IsDefaultDiscountable,
                        Status = x.Status
                    })
                    .ToListAsync();

                return new ApiResponse<List<DepartmentGridDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Departments retrieved successfully",
                    Response = departments
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<DepartmentGridDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching departments: {ex.Message}",
                    Response = new List<DepartmentGridDto>()
                };
            }
        }

        public async Task<ApiResponse<DepartmentDetailDto>> GetDepartmentByIdAsync(Guid departmentStoreId)
        {
            try
            {
                var department = await _dbContext.DepartmentStoreViews
                    .Where(x => x.DepartmentStoreID == departmentStoreId)
                    .Select(x => new DepartmentDetailDto
                    {
                        DepartmentStoreID = x.DepartmentStoreID,
                        Name = x.Name ?? string.Empty,
                        Description = x.Description,
                        ParentDepartmentID = x.ParentDepartmentID,
                        StoreID = x.StoreID,
                        DefaultMarkup = x.DefaultMarkup,
                        DefaultMarkupA = x.DefaultMarkupA,
                        DefaultMarkupB = x.DefaultMarkupB,
                        DefaultMarkupC = x.DefaultMarkupC,
                        DefaultMarkupD = x.DefaultMarkupD,
                        RoundUp = x.RoundUp,
                        RoundUpA = x.RoundUpA,
                        RoundUpB = x.RoundUpB,
                        RoundUpC = x.RoundUpC,
                        RoundUpD = x.RoundUpD,
                        RoundValue = x.RoundValue,
                        RoundValueA = x.RoundValueA,
                        RoundValueB = x.RoundValueB,
                        RoundValueC = x.RoundValueC,
                        RoundValueD = x.RoundValueD,
                        DefaultCogsAccount = x.DefaultCogsAccount,
                        DefaultIncomeAccount = x.DefaultIncomeAccount,
                        DefaultTaxNo = x.DefaultTaxNo,
                        IsDefaultTaxInclude = x.IsDefaultTaxInclude,
                        IsDefaultFoodStampable = x.IsDefaultFoodStampable,
                        IsDefaultDiscountable = x.IsDefaultDiscountable,
                        DefaultProfitCalculation = x.DefaultProfitCalculation,
                        Status = x.Status,
                        DateCreated = x.DateCreated,
                        DateModified = x.DateModified,
                        KeyNumber = x.KeyNumber,
                        DepartmentNo = x.DepartmentNo,
                        DiscountID = x.DiscountID
                    })
                    .FirstOrDefaultAsync();

                if (department == null)
                {
                    return new ApiResponse<DepartmentDetailDto>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Department not found",
                        Response = null
                    };
                }

                return new ApiResponse<DepartmentDetailDto>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Department retrieved successfully",
                    Response = department
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<DepartmentDetailDto>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching department: {ex.Message}",
                    Response = null
                };
            }
        }

        public async Task<ApiResponse<Guid>> CreateDepartmentAsync(CreateDepartmentDto dto, Guid modifierId)
        {
            try
            {
                // Mirrors SP_DepartmentStoreInsert's uniqueness guard.
                var nameTaken = await _dbContext.DepartmentStores
                    .AnyAsync(d => d.Name == dto.Name && (d.Status ?? 0) > -1);
                if (nameTaken)
                {
                    return new ApiResponse<Guid>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.ConflictError,
                        Message = "Department already exists.",
                        Response = Guid.Empty
                    };
                }

                var now = DateTime.Now;
                var entity = new DepartmentStore
                {
                    DepartmentStoreID = Guid.NewGuid(),
                    Name = dto.Name,
                    Description = dto.Description,
                    ParentDepartmentID = dto.ParentDepartmentID,
                    StoreID = null,
                    KeyNumber = null,
                    DefaultMarkup = dto.DefaultMarkup,
                    DefaultMarkupA = dto.DefaultMarkupA,
                    DefaultMarkupB = dto.DefaultMarkupB,
                    DefaultMarkupC = dto.DefaultMarkupC,
                    DefaultMarkupD = dto.DefaultMarkupD,
                    RoundUp = dto.RoundUp ?? 0,
                    RoundUpA = dto.RoundUpA,
                    RoundUpB = dto.RoundUpB,
                    RoundUpC = dto.RoundUpC,
                    RoundUpD = dto.RoundUpD,
                    RoundValue = dto.RoundValue,
                    RoundValueA = dto.RoundValueA,
                    RoundValueB = dto.RoundValueB,
                    RoundValueC = dto.RoundValueC,
                    RoundValueD = dto.RoundValueD,
                    DefaultCogsAccount = dto.DefaultCogsAccount,
                    DefaultIncomeAccount = dto.DefaultIncomeAccount,
                    DefaultTaxNo = dto.DefaultTaxNo,
                    IsDefaultTaxInclude = dto.IsDefaultTaxInclude,
                    IsDefaultFoodStampable = dto.IsDefaultFoodStampable,
                    IsDefaultDiscountable = dto.IsDefaultDiscountable,
                    DefaultProfitCalculation = dto.DefaultProfitCalculation,
                    DepartmentNo = dto.DepartmentNo,
                    Status = 1, // Active — matches SP_DepartmentStoreInsert literal
                    DateCreated = now,
                    UserCreated = modifierId,
                    DateModified = now,
                    UserModified = modifierId,
                    DiscountID = dto.DiscountID,
                    UseImageCard = false
                };

                _dbContext.DepartmentStores.Add(entity);
                await _dbContext.SaveChangesAsync();

                return new ApiResponse<Guid>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Department created successfully",
                    Response = entity.DepartmentStoreID
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<Guid>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error creating department: {ex.Message}",
                    Response = Guid.Empty
                };
            }
        }

        public async Task<ApiResponse<bool>> UpdateDepartmentAsync(UpdateDepartmentDto dto, Guid modifierId)
        {
            try
            {
                var entity = await _dbContext.DepartmentStores
                    .FirstOrDefaultAsync(d => d.DepartmentStoreID == dto.DepartmentStoreID);

                if (entity == null)
                {
                    return new ApiResponse<bool>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Department not found",
                        Response = false
                    };
                }

                // Optimistic concurrency: if the client sent the DateModified it loaded,
                // make sure no one else has touched the row since.
                if (dto.DateModified.HasValue
                    && entity.DateModified.HasValue
                    && Math.Abs((entity.DateModified.Value - dto.DateModified.Value).TotalSeconds) > 1)
                {
                    return new ApiResponse<bool>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.ConflictError,
                        Message = "Department was modified by another user — please reload and try again.",
                        Response = false
                    };
                }

                entity.Name = dto.Name;
                entity.Description = dto.Description;
                entity.ParentDepartmentID = dto.ParentDepartmentID;
                entity.DefaultMarkup = dto.DefaultMarkup;
                entity.DefaultMarkupA = dto.DefaultMarkupA;
                entity.DefaultMarkupB = dto.DefaultMarkupB;
                entity.DefaultMarkupC = dto.DefaultMarkupC;
                entity.DefaultMarkupD = dto.DefaultMarkupD;
                entity.RoundUp = dto.RoundUp ?? 0;
                entity.RoundUpA = dto.RoundUpA;
                entity.RoundUpB = dto.RoundUpB;
                entity.RoundUpC = dto.RoundUpC;
                entity.RoundUpD = dto.RoundUpD;
                entity.RoundValue = dto.RoundValue;
                entity.RoundValueA = dto.RoundValueA;
                entity.RoundValueB = dto.RoundValueB;
                entity.RoundValueC = dto.RoundValueC;
                entity.RoundValueD = dto.RoundValueD;
                entity.DefaultCogsAccount = dto.DefaultCogsAccount;
                entity.DefaultIncomeAccount = dto.DefaultIncomeAccount;
                entity.DefaultTaxNo = dto.DefaultTaxNo;
                entity.IsDefaultTaxInclude = dto.IsDefaultTaxInclude;
                entity.IsDefaultFoodStampable = dto.IsDefaultFoodStampable;
                entity.IsDefaultDiscountable = dto.IsDefaultDiscountable;
                entity.DefaultProfitCalculation = dto.DefaultProfitCalculation;
                entity.DepartmentNo = dto.DepartmentNo;
                entity.DiscountID = dto.DiscountID;
                entity.DateModified = DateTime.Now;
                entity.UserModified = modifierId;

                await _dbContext.SaveChangesAsync();

                return new ApiResponse<bool>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Department updated successfully",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error updating department: {ex.Message}",
                    Response = false
                };
            }
        }

        public async Task<ApiResponse<bool>> DeleteDepartmentAsync(Guid departmentStoreId, Guid modifierId)
        {
            try
            {
                var entity = await _dbContext.DepartmentStores
                    .FirstOrDefaultAsync(d => d.DepartmentStoreID == departmentStoreId);

                if (entity == null)
                {
                    return new ApiResponse<bool>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Department not found",
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
                    Message = "Department deleted successfully",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error deleting department: {ex.Message}",
                    Response = false
                };
            }
        }

        public async Task<ApiResponse<bool>> CanDeleteDepartmentAsync(Guid departmentStoreId)
        {
            try
            {
                // Check if department has any child departments
                var hasChildren = await _dbContext.DepartmentStoreViews
                    .AnyAsync(x => x.ParentDepartmentID == departmentStoreId && x.Status != 2);

                if (hasChildren)
                {
                    return new ApiResponse<bool>
                    {
                        IsSuccess = true,
                        StatusCode = ResponseCode.Success,
                        Message = "Department has child departments and cannot be deleted",
                        Response = false
                    };
                }

                // Check if department has any items attached directly
                var hasItems = await _dbContext.ItemStores
                    .AnyAsync(x => x.DepartmentID == departmentStoreId && x.Status != 2);

                var canDelete = !hasItems;

                return new ApiResponse<bool>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = canDelete ? "Department can be deleted" : "Department has items and cannot be deleted",
                    Response = canDelete
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error checking if department can be deleted: {ex.Message}",
                    Response = false
                };
            }
        }

        public async Task<ApiResponse<bool>> DepartmentNameExistsAsync(string name, Guid? excludeDepartmentId = null)
        {
            try
            {
                var query = _dbContext.DepartmentStoreViews
                    .Where(x => x.Name == name && x.Status != 2);

                if (excludeDepartmentId.HasValue)
                {
                    query = query.Where(x => x.DepartmentStoreID != excludeDepartmentId.Value);
                }

                var exists = await query.AnyAsync();

                return new ApiResponse<bool>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = exists ? "Department name already exists" : "Department name is available",
                    Response = exists
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error checking department name: {ex.Message}",
                    Response = false
                };
            }
        }
    }
}
