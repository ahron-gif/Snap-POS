using AutoMapper;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Mian.Customer;
using BackOffice.Application.DTOs.Tenant.Customer;
using BackOffice.Application.DTOs.Tenant.Vendor;
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
    public class VendorService : IVendorService
    {
        private readonly IUnitOfWorkTenant _unitOfWorkTenant;
        private readonly IUnitOfWorkMain _unitOfWorkMain;
        private readonly IMapper _mapper;

        public VendorService(IUnitOfWorkTenant unitOfWorkTenant, IMapper mapper, IUnitOfWorkMain unitOfWorkMain)
        {
            _unitOfWorkTenant = unitOfWorkTenant;
            _mapper = mapper;
            _unitOfWorkMain = unitOfWorkMain;
        }

        public ApiResponse<PaginationResponseDTO<CustomerViewDto>> GetAllVendorsGridAsync(PaginationGridDto paginationGridDto)
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

        /// <summary>
        /// Gets all vendors for lookup dropdown (ID and Name only)
        /// Filters by CustomerType == 2 (vendors are type 2)
        /// </summary>
        public ApiResponse<List<VendorLookupDto>> GetAllVendorsLookupAsync()
        {
            try
            {
                var vendors = _unitOfWorkTenant.CustomerViews
                    .GetAll()
                    .Where(c => c.CustomerType == 2) // Vendors are type 2
                    .OrderBy(c => c.Name)
                    .Select(c => new VendorLookupDto
                    {
                        VendorID = c.CustomerID,
                        VendorNo = c.CustomerNo,
                        Name = c.Name
                    })
                    .ToList();

                return ApiResponseFactory.Success(vendors, "Vendor lookup data fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<VendorLookupDto>>(
                    "Error fetching vendor lookup data.",
                    new List<string> { ex.Message });
            }
        }

    }
}
