using AutoMapper;
using BackOffice.Application.Configuration;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Mian.Customer;
using BackOffice.Application.DTOs.Tenant.Customer;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Application.Interfaces.Services;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Persistence.Services.Tenant
{
    public class CustomerService : ICustomerService
    {
        private readonly IUnitOfWorkTenant _unitOfWorkTenant;
        private readonly IUnitOfWorkMain _unitOfWorkMain;
        private readonly IMapper _mapper;
        private readonly Guid _currentEnvironmentId;

        public CustomerService(IUnitOfWorkTenant unitOfWorkTenant, IMapper mapper, IUnitOfWorkMain unitOfWorkMain, EnvironmentSettings environmentSettings)
        {
            _unitOfWorkTenant = unitOfWorkTenant;
            _mapper = mapper;
            _unitOfWorkMain = unitOfWorkMain;
            _currentEnvironmentId = environmentSettings.CurrentEnvironmentId;
        }

   
        public ApiResponse<PaginationResponseDTO<CustomerViewDto>> GetAllCustomersGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _unitOfWorkTenant.CustomerViews.GetAll().AsQueryable();

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;  // Save the filtered query for counting
                var totalRecords = _unitOfWorkTenant.CustomerViews.GetAll().Count();  // This gives total records without filters
                var filteredRecords = filteredQuery.Count();  // Get filtered record count

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn, paginationGridDto.SortDirection);

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var data = _mapper.Map<List<CustomerViewDto>>(paginatedData);

                var response = new PaginationResponseDTO<CustomerViewDto>
                {
                    TotalRecords = totalRecords,              // Total records (without filters)
                    RecordsFiltered = filteredRecords,        // Total records after applying filters
                    CurrentPage = (int)Math.Ceiling((double)paginationGridDto.EndRow / paginationGridDto.StartRow), // Calculate current page
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,    // Page size for pagination
                    Data = data
                };

                return ApiResponseFactory.Success(response, "User list fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<CustomerViewDto>>(
                    "Error fetching users.",
                    new List<string> { ex.Message });
            }
        }

        public ApiResponse<List<TennatLookupDto>> GetAllTenantsAsync()
        {
            try
            {
                var dtoList = _unitOfWorkMain.Customers
                 .GetAll()
                 .Where(c => c.IsActive && (_currentEnvironmentId == Guid.Empty || c.EnvironmentId == _currentEnvironmentId))
                 .OrderBy(c => c.CustomerName)
                 .Select(c => new TennatLookupDto
                 {
                     CustomerId = c.CustomerId,
                     CustomerName = c.CustomerName,
                     Email = c.Email
                 })
                 .ToList();


                var data = _mapper.Map<List<TennatLookupDto>>(dtoList);

                return ApiResponseFactory.Success(data, "Tenant lookup data fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<TennatLookupDto>>(
                    "Error fetching tenant lookup data.",
                    new List<string> { ex.Message });
            }
        }

        /// <summary>
        /// Gets all customers for lookup dropdown (ID and Name only)
        /// Filters by CustomerType != 2 (vendors are type 2)
        /// </summary>
        public ApiResponse<List<CustomerLookupDto>> GetAllCustomersLookupAsync()
        {
            try
            {
                var customers = _unitOfWorkTenant.CustomerViews
                    .GetAll()
                    .Where(c => c.CustomerType != 2) // Exclude vendors (type 2)
                    .OrderBy(c => c.Name)
                    .Select(c => new CustomerLookupDto
                    {
                        CustomerID = c.CustomerID,
                        CustomerNo = c.CustomerNo,
                        Name = c.Name
                    })
                    .ToList();

                return ApiResponseFactory.Success(customers, "Customer lookup data fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<CustomerLookupDto>>(
                    "Error fetching customer lookup data.",
                    new List<string> { ex.Message });
            }
        }

    }
}
