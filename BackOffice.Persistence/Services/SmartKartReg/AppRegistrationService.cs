using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.ApplicationRegistration;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.SmartKartReg;
using BackOffice.Common;
using BackOffice.Common.Functions;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using SmartKartReg.Infrastructure.DBContext;

namespace BackOffice.Persistence.Services.SmartKartReg
{
    public class AppRegistrationService : IAppRegistrationService
    {
        private readonly RegistrationDbContext _dbContext;

        public AppRegistrationService(RegistrationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public ApiResponse<PaginationResponseDTO<AppRegistrationGridDto>> GetAllAppRegistrationsGrid(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = (from ar in _dbContext.ApplicationRegistrations
                             join app in _dbContext.Applications on ar.AppId equals app.AppId
                             join reg in _dbContext.Registrations on ar.RegistrationId equals reg.RegistrationId into regJoin
                             from reg in regJoin.DefaultIfEmpty()
                             select new AppRegistrationGridDto
                             {
                                 Id = ar.Id,
                                 AppId = ar.AppId,
                                 AppName = app.AppName,
                                 RegistrationId = ar.RegistrationId,
                                 StoreName = reg != null ? reg.StoreName : null,
                                 Apiurl = ar.Apiurl
                             })
                    .AsQueryable();

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;
                var totalRecords = _dbContext.ApplicationRegistrations.Count();
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "AppName", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<AppRegistrationGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Application registrations retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<AppRegistrationGridDto>>(
                    "Error fetching application registrations.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<AppRegistrationDetailDto>> GetAppRegistrationByIdAsync(Guid id)
        {
            try
            {
                var appReg = await (from ar in _dbContext.ApplicationRegistrations
                                    join app in _dbContext.Applications on ar.AppId equals app.AppId
                                    join reg in _dbContext.Registrations on ar.RegistrationId equals reg.RegistrationId into regJoin
                                    from reg in regJoin.DefaultIfEmpty()
                                    where ar.Id == id
                                    select new AppRegistrationDetailDto
                                    {
                                        Id = ar.Id,
                                        AppId = ar.AppId,
                                        AppName = app.AppName,
                                        RegistrationId = ar.RegistrationId,
                                        StoreName = reg != null ? reg.StoreName : null,
                                        Apiurl = ar.Apiurl
                                    })
                    .FirstOrDefaultAsync();

                if (appReg == null)
                {
                    return ApiResponseFactory.NotFound<AppRegistrationDetailDto>("Application registration not found.");
                }

                return ApiResponseFactory.Success(appReg, "Application registration retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<AppRegistrationDetailDto>(
                    $"Error fetching application registration: {ex.Message}");
            }
        }

        public async Task<ApiResponse<Guid>> CreateAppRegistrationAsync(CreateAppRegistrationDto dto)
        {
            try
            {
                // Validate AppId exists
                var appExists = await _dbContext.Applications.AnyAsync(x => x.AppId == dto.AppId);
                if (!appExists)
                {
                    return ApiResponseFactory.BadRequest<Guid>("Invalid Application ID.");
                }

                // Validate RegistrationId exists if provided
                if (dto.RegistrationId.HasValue)
                {
                    var regExists = await _dbContext.Registrations.AnyAsync(x => x.RegistrationId == dto.RegistrationId.Value);
                    if (!regExists)
                    {
                        return ApiResponseFactory.BadRequest<Guid>("Invalid Registration ID.");
                    }
                }

                var entity = new global::SmartKartReg.Infrastructure.Entities.ApplicationRegistration
                {
                    Id = Guid.NewGuid(),
                    AppId = dto.AppId,
                    RegistrationId = dto.RegistrationId,
                    Apiurl = dto.Apiurl
                };

                _dbContext.ApplicationRegistrations.Add(entity);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(entity.Id, "Application registration created successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<Guid>(
                    $"Error creating application registration: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> UpdateAppRegistrationAsync(UpdateAppRegistrationDto dto)
        {
            try
            {
                var entity = await _dbContext.ApplicationRegistrations
                    .FirstOrDefaultAsync(x => x.Id == dto.Id);

                if (entity == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Application registration not found.");
                }

                // Validate AppId exists
                var appExists = await _dbContext.Applications.AnyAsync(x => x.AppId == dto.AppId);
                if (!appExists)
                {
                    return ApiResponseFactory.BadRequest<bool>("Invalid Application ID.");
                }

                // Validate RegistrationId exists if provided
                if (dto.RegistrationId.HasValue)
                {
                    var regExists = await _dbContext.Registrations.AnyAsync(x => x.RegistrationId == dto.RegistrationId.Value);
                    if (!regExists)
                    {
                        return ApiResponseFactory.BadRequest<bool>("Invalid Registration ID.");
                    }
                }

                entity.AppId = dto.AppId;
                entity.RegistrationId = dto.RegistrationId;
                entity.Apiurl = dto.Apiurl;

                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Application registration updated successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error updating application registration: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> DeleteAppRegistrationAsync(Guid id)
        {
            try
            {
                var entity = await _dbContext.ApplicationRegistrations
                    .FirstOrDefaultAsync(x => x.Id == id);

                if (entity == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Application registration not found.");
                }

                _dbContext.ApplicationRegistrations.Remove(entity);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Application registration deleted successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error deleting application registration: {ex.Message}");
            }
        }
    }
}
