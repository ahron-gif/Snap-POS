using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.SmartKartReg.Registration;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.SmartKartReg;
using BackOffice.Common;
using BackOffice.Common.Functions;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using SmartKartReg.Infrastructure.DBContext;

namespace BackOffice.Persistence.Services.SmartKartReg
{
    public class RegistrationService : IRegistrationService
    {
        private readonly RegistrationDbContext _dbContext;

        public RegistrationService(RegistrationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public ApiResponse<PaginationResponseDTO<RegistrationGridDto>> GetAllRegistrationsGrid(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _dbContext.Registrations
                    .Where(x => x.Status != 2) // Exclude soft-deleted records
                    .Select(x => new RegistrationGridDto
                    {
                        RegistrationId = x.RegistrationId,
                        StoreName = x.StoreName,
                        DataBaseName = x.DataBaseName,
                        StoreType = x.StoreType,
                        LicenseExpires = x.LicenseExpires,
                        Address = x.Address,
                        CityStateZip = x.CityStateZip,
                        Phone = x.Phone,
                        Email = x.Email,
                        Status = x.Status,
                        SalesPerson = x.SalesPerson,
                        ServerName = x.ServerName,
                        VersionName = x.VersionName,
                        DateCreated = x.DateCreated,
                        DateModified = x.DateModified
                    })
                    .AsQueryable();

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;
                var totalRecords = _dbContext.Registrations.Count(x => x.Status != 2);
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "StoreName", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<RegistrationGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Customers retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<RegistrationGridDto>>(
                    "Error fetching customers.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<RegistrationDetailDto>> GetRegistrationByIdAsync(Guid id)
        {
            try
            {
                var registration = await _dbContext.Registrations
                    .Where(x => x.RegistrationId == id && x.Status != 2)
                    .Select(x => new RegistrationDetailDto
                    {
                        RegistrationId = x.RegistrationId,
                        StoreName = x.StoreName,
                        UserName = x.UserName,
                        Password = x.Password,
                        DataBaseName = x.DataBaseName,
                        StoreType = x.StoreType,
                        LicenseExpires = x.LicenseExpires,
                        Address = x.Address,
                        CityStateZip = x.CityStateZip,
                        Phone = x.Phone,
                        Fax = x.Fax,
                        Email = x.Email,
                        MultipleLocation = x.MultipleLocation,
                        PhoneOrder = x.PhoneOrder,
                        Loyalty = x.Loyalty,
                        EmailService = x.EmailService,
                        TextService = x.TextService,
                        GiftCards = x.GiftCards,
                        TimeAttendance = x.TimeAttendance,
                        DateCreated = x.DateCreated,
                        DateModified = x.DateModified,
                        Status = x.Status,
                        SalesPerson = x.SalesPerson,
                        RegUser = x.RegUser,
                        ServerName = x.ServerName,
                        VersionName = x.VersionName,
                        PosLic = x.PosLic,
                        BoLic = x.BoLic,
                        IsSmartKart = x.IsSmartKart,
                        VersionId = x.VersionId,
                        Apiurl = x.Apiurl
                    })
                    .FirstOrDefaultAsync();

                if (registration == null)
                {
                    return ApiResponseFactory.NotFound<RegistrationDetailDto>("Customer not found.");
                }

                return ApiResponseFactory.Success(registration, "Customer retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<RegistrationDetailDto>(
                    $"Error fetching customer: {ex.Message}");
            }
        }

        public async Task<ApiResponse<Guid>> CreateRegistrationAsync(CreateRegistrationDto dto)
        {
            try
            {
                var entity = new global::SmartKartReg.Infrastructure.Entities.Registration
                {
                    RegistrationId = Guid.NewGuid(),
                    StoreName = dto.StoreName,
                    UserName = dto.UserName,
                    Password = dto.Password,
                    DataBaseName = dto.DataBaseName,
                    StoreType = dto.StoreType,
                    LicenseExpires = dto.LicenseExpires,
                    Address = dto.Address,
                    CityStateZip = dto.CityStateZip,
                    Phone = dto.Phone,
                    Fax = dto.Fax,
                    Email = dto.Email,
                    MultipleLocation = dto.MultipleLocation,
                    PhoneOrder = dto.PhoneOrder,
                    Loyalty = dto.Loyalty,
                    EmailService = dto.EmailService,
                    TextService = dto.TextService,
                    GiftCards = dto.GiftCards,
                    TimeAttendance = dto.TimeAttendance,
                    Status = dto.Status,
                    SalesPerson = dto.SalesPerson,
                    RegUser = dto.RegUser,
                    ServerName = dto.ServerName,
                    VersionName = dto.VersionName,
                    PosLic = dto.PosLic,
                    BoLic = dto.BoLic,
                    IsSmartKart = dto.IsSmartKart,
                    VersionId = dto.VersionId,
                    Apiurl = dto.Apiurl,
                    DateCreated = DateTime.UtcNow
                };

                _dbContext.Registrations.Add(entity);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(entity.RegistrationId, "Customer created successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<Guid>(
                    $"Error creating customer: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> UpdateRegistrationAsync(UpdateRegistrationDto dto)
        {
            try
            {
                var entity = await _dbContext.Registrations
                    .FirstOrDefaultAsync(x => x.RegistrationId == dto.RegistrationId && x.Status != 2);

                if (entity == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Customer not found.");
                }

                entity.StoreName = dto.StoreName;
                entity.UserName = dto.UserName;
                entity.Password = dto.Password;
                entity.DataBaseName = dto.DataBaseName;
                entity.StoreType = dto.StoreType;
                entity.LicenseExpires = dto.LicenseExpires;
                entity.Address = dto.Address;
                entity.CityStateZip = dto.CityStateZip;
                entity.Phone = dto.Phone;
                entity.Fax = dto.Fax;
                entity.Email = dto.Email;
                entity.MultipleLocation = dto.MultipleLocation;
                entity.PhoneOrder = dto.PhoneOrder;
                entity.Loyalty = dto.Loyalty;
                entity.EmailService = dto.EmailService;
                entity.TextService = dto.TextService;
                entity.GiftCards = dto.GiftCards;
                entity.TimeAttendance = dto.TimeAttendance;
                entity.Status = dto.Status;
                entity.SalesPerson = dto.SalesPerson;
                entity.RegUser = dto.RegUser;
                entity.ServerName = dto.ServerName;
                entity.VersionName = dto.VersionName;
                entity.PosLic = dto.PosLic;
                entity.BoLic = dto.BoLic;
                entity.IsSmartKart = dto.IsSmartKart;
                entity.VersionId = dto.VersionId;
                entity.Apiurl = dto.Apiurl;
                entity.DateModified = DateTime.UtcNow;

                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Customer updated successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error updating customer: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> DeleteRegistrationAsync(Guid id)
        {
            try
            {
                var entity = await _dbContext.Registrations
                    .FirstOrDefaultAsync(x => x.RegistrationId == id && x.Status != 2);

                if (entity == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Customer not found.");
                }

                // Soft delete: set Status to 2
                entity.Status = 2;
                entity.DateModified = DateTime.UtcNow;

                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Customer deleted successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error deleting customer: {ex.Message}");
            }
        }
    }
}
