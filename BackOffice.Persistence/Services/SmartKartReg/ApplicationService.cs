using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.Application;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.SmartKartReg;
using BackOffice.Common;
using BackOffice.Common.Functions;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using SmartKartReg.Infrastructure.DBContext;

namespace BackOffice.Persistence.Services.SmartKartReg
{
    public class ApplicationService : IApplicationService
    {
        private readonly RegistrationDbContext _dbContext;

        public ApplicationService(RegistrationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public ApiResponse<PaginationResponseDTO<ApplicationGridDto>> GetAllApplicationsGrid(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _dbContext.Applications
                    .Select(x => new ApplicationGridDto
                    {
                        AppId = x.AppId,
                        AppName = x.AppName
                    })
                    .AsQueryable();

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;
                var totalRecords = _dbContext.Applications.Count();
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "AppName", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<ApplicationGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Applications retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<ApplicationGridDto>>(
                    "Error fetching applications.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<ApplicationDetailDto>> GetApplicationByIdAsync(Guid id)
        {
            try
            {
                var application = await _dbContext.Applications
                    .Where(x => x.AppId == id)
                    .Select(x => new ApplicationDetailDto
                    {
                        AppId = x.AppId,
                        AppName = x.AppName
                    })
                    .FirstOrDefaultAsync();

                if (application == null)
                {
                    return ApiResponseFactory.NotFound<ApplicationDetailDto>("Application not found.");
                }

                return ApiResponseFactory.Success(application, "Application retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ApplicationDetailDto>(
                    $"Error fetching application: {ex.Message}");
            }
        }

        public async Task<ApiResponse<Guid>> CreateApplicationAsync(CreateApplicationDto dto)
        {
            try
            {
                var entity = new global::SmartKartReg.Infrastructure.Entities.Application
                {
                    AppId = Guid.NewGuid(),
                    AppName = dto.AppName
                };

                _dbContext.Applications.Add(entity);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(entity.AppId, "Application created successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<Guid>(
                    $"Error creating application: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> UpdateApplicationAsync(UpdateApplicationDto dto)
        {
            try
            {
                var entity = await _dbContext.Applications
                    .FirstOrDefaultAsync(x => x.AppId == dto.AppId);

                if (entity == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Application not found.");
                }

                entity.AppName = dto.AppName;

                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Application updated successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error updating application: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> DeleteApplicationAsync(Guid id)
        {
            try
            {
                var entity = await _dbContext.Applications
                    .FirstOrDefaultAsync(x => x.AppId == id);

                if (entity == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Application not found.");
                }

                _dbContext.Applications.Remove(entity);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Application deleted successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error deleting application: {ex.Message}");
            }
        }

        public async Task<ApiResponse<List<ApplicationDropdownDto>>> GetApplicationsDropdownAsync()
        {
            try
            {
                var applications = await _dbContext.Applications
                    .OrderBy(x => x.AppName)
                    .Select(x => new ApplicationDropdownDto
                    {
                        AppId = x.AppId,
                        AppName = x.AppName
                    })
                    .ToListAsync();

                return ApiResponseFactory.Success(applications, "Applications dropdown retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<ApplicationDropdownDto>>(
                    $"Error fetching applications dropdown: {ex.Message}");
            }
        }
    }
}
