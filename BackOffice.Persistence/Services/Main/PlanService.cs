using AutoMapper;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Main.PermissionManagement;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Domain.Entities.Main;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Main
{
    public class PlanService : IPlanService
    {
        private readonly MainDBContext _dbContext;
        private readonly IMapper _mapper;
        private readonly ILogger<PlanService> _logger;

        public PlanService(
            MainDBContext dbContext,
            IMapper mapper,
            ILogger<PlanService> logger)
        {
            _dbContext = dbContext;
            _mapper = mapper;
            _logger = logger;
        }

        public ApiResponse<PaginationResponseDTO<PlanDto>> GetPlansGrid(PaginationGridDto paginationGridDto)
        {
            try
            {
                var filters = new List<PaginationGridFilterDto>();
                if (!string.IsNullOrEmpty(paginationGridDto.Filters) &&
                    CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = from p in _dbContext.Plans
                            where p.IsActive
                            select new PlanDto
                            {
                                Id = p.Id,
                                Name = p.Name,
                                Code = p.Code,
                                MaxUsers = p.MaxUsers,
                                BillingCycle = p.BillingCycle,
                                Price = p.Price,
                                IsActive = p.IsActive,
                                CreatedAt = p.CreatedAt,
                                ModuleIds = p.PlanModules
                                    .Where(pm => pm.IsEnabled)
                                    .Select(pm => pm.ModuleId)
                                    .ToList()
                            };

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var totalRecords = _dbContext.Plans.Count(x => x.IsActive);
                var filteredRecords = query.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "Name", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                return ApiResponseFactory.Success(new PaginationResponseDTO<PlanDto>
                {
                    Data = paginatedData,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow / Math.Max(paginationGridDto.EndRow - paginationGridDto.StartRow, 1),
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching plans grid");
                return ApiResponseFactory.InternalError<PaginationResponseDTO<PlanDto>>(
                    "Error fetching plans.", new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<PlanDto>> GetPlanByIdAsync(int id)
        {
            try
            {
                var entity = await _dbContext.Plans
                    .Where(x => x.Id == id)
                    .Select(x => new PlanDto
                    {
                        Id = x.Id,
                        Name = x.Name,
                        Code = x.Code,
                        MaxUsers = x.MaxUsers,
                        BillingCycle = x.BillingCycle,
                        Price = x.Price,
                        IsActive = x.IsActive,
                        CreatedAt = x.CreatedAt
                    }).FirstOrDefaultAsync();

                if (entity == null)
                    return ApiResponseFactory.NotFound<PlanDto>("Plan not found.");

                return ApiResponseFactory.Success(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching plan {Id}", id);
                return ApiResponseFactory.InternalError<PlanDto>(ex.Message);
            }
        }

        public async Task<ApiResponse<List<PlanDto>>> GetAllPlansLookupAsync()
        {
            try
            {
                var plans = await _dbContext.Plans
                    .Where(x => x.IsActive)
                    .OrderBy(x => x.Name)
                    .Select(x => new PlanDto
                    {
                        Id = x.Id,
                        Name = x.Name,
                        Code = x.Code,
                        MaxUsers = x.MaxUsers,
                        BillingCycle = x.BillingCycle,
                        Price = x.Price,
                        IsActive = x.IsActive,
                        CreatedAt = x.CreatedAt
                    }).ToListAsync();

                return ApiResponseFactory.Success(plans);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching plans lookup");
                return ApiResponseFactory.InternalError<List<PlanDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<int>> CreatePlanAsync(CreatePlanDto dto)
        {
            try
            {
                var exists = await _dbContext.Plans
                    .AnyAsync(x => x.Code == dto.Code);
                if (exists)
                    return ApiResponseFactory.BadRequest<int>($"Plan with code '{dto.Code}' already exists.");

                var entity = new Plan
                {
                    Name = dto.Name,
                    Code = dto.Code,
                    MaxUsers = dto.MaxUsers,
                    BillingCycle = dto.BillingCycle,
                    Price = dto.Price,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.Plans.Add(entity);
                await _dbContext.SaveChangesAsync();

                if (dto.ModuleIds != null && dto.ModuleIds.Count > 0)
                {
                    var planModules = dto.ModuleIds
                        .Distinct()
                        .Select(moduleId => new PlanModule
                        {
                            PlanId = entity.Id,
                            ModuleId = moduleId,
                            IsEnabled = true
                        }).ToList();

                    await _dbContext.PlanModules.AddRangeAsync(planModules);
                    await _dbContext.SaveChangesAsync();
                }

                return ApiResponseFactory.Success(entity.Id, "Plan created successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating plan");
                return ApiResponseFactory.InternalError<int>($"Error creating plan: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> UpdatePlanAsync(UpdatePlanDto dto)
        {
            try
            {
                var entity = await _dbContext.Plans.FindAsync(dto.Id);
                if (entity == null)
                    return ApiResponseFactory.NotFound<bool>("Plan not found.");

                var duplicate = await _dbContext.Plans
                    .AnyAsync(x => x.Code == dto.Code && x.Id != dto.Id);
                if (duplicate)
                    return ApiResponseFactory.BadRequest<bool>($"Plan with code '{dto.Code}' already exists.");

                entity.Name = dto.Name;
                entity.Code = dto.Code;
                entity.MaxUsers = dto.MaxUsers;
                entity.BillingCycle = dto.BillingCycle;
                entity.Price = dto.Price;
                entity.IsActive = dto.IsActive;
                entity.UpdatedAt = DateTime.UtcNow;

                // Replace the plan's module assignments to match the submitted set.
                var existingModules = await _dbContext.PlanModules
                    .Where(x => x.PlanId == dto.Id)
                    .ToListAsync();
                _dbContext.PlanModules.RemoveRange(existingModules);

                if (dto.ModuleIds != null && dto.ModuleIds.Count > 0)
                {
                    var planModules = dto.ModuleIds
                        .Distinct()
                        .Select(moduleId => new PlanModule
                        {
                            PlanId = dto.Id,
                            ModuleId = moduleId,
                            IsEnabled = true
                        }).ToList();

                    await _dbContext.PlanModules.AddRangeAsync(planModules);
                }

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Plan updated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating plan {Id}", dto.Id);
                return ApiResponseFactory.InternalError<bool>($"Error updating plan: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> DeletePlanAsync(int id)
        {
            try
            {
                var entity = await _dbContext.Plans.FindAsync(id);
                if (entity == null)
                    return ApiResponseFactory.NotFound<bool>("Plan not found.");

                entity.IsActive = false;
                entity.UpdatedAt = DateTime.UtcNow;
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Plan deleted successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting plan {Id}", id);
                return ApiResponseFactory.InternalError<bool>($"Error deleting plan: {ex.Message}");
            }
        }

        public async Task<ApiResponse<List<ModuleDto>>> GetPlanModulesAsync(int planId)
        {
            try
            {
                var plan = await _dbContext.Plans.FindAsync(planId);
                if (plan == null)
                    return ApiResponseFactory.NotFound<List<ModuleDto>>("Plan not found.");

                var modules = await (from pm in _dbContext.PlanModules
                                    join m in _dbContext.Modules on pm.ModuleId equals m.ModuleId
                                    where pm.PlanId == planId && pm.IsEnabled && m.IsActive
                                    orderby m.SortOrder
                                    select new ModuleDto
                                    {
                                        ModuleId = m.ModuleId,
                                        Code = m.Code ?? "",
                                        ModuleName = m.ModuleName,
                                        Icon = m.Icon,
                                        SortOrder = m.SortOrder,
                                        IsActive = m.IsActive,
                                        ParentModuleId = m.ParentModuleId
                                    }).ToListAsync();

                return ApiResponseFactory.Success(modules);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching modules for plan {PlanId}", planId);
                return ApiResponseFactory.InternalError<List<ModuleDto>>(ex.Message);
            }
        }

        public async Task<ApiResponse<bool>> UpdatePlanModulesAsync(int planId, List<int> moduleIds)
        {
            try
            {
                var plan = await _dbContext.Plans.FindAsync(planId);
                if (plan == null)
                    return ApiResponseFactory.NotFound<bool>("Plan not found.");

                var existing = await _dbContext.PlanModules
                    .Where(x => x.PlanId == planId)
                    .ToListAsync();

                _dbContext.PlanModules.RemoveRange(existing);

                var newPlanModules = moduleIds.Select(moduleId => new PlanModule
                {
                    PlanId = planId,
                    ModuleId = moduleId,
                    IsEnabled = true
                }).ToList();

                await _dbContext.PlanModules.AddRangeAsync(newPlanModules);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Plan modules updated successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating modules for plan {PlanId}", planId);
                return ApiResponseFactory.InternalError<bool>($"Error updating plan modules: {ex.Message}");
            }
        }
    }
}
