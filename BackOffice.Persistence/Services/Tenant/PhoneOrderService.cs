using AutoMapper;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.PhoneOrder;
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
    public class PhoneOrderService : IPhoneOrderService
    {
        private readonly IUnitOfWorkTenant _unitOfWork;
        private readonly IMapper _mapper;

        public PhoneOrderService(IUnitOfWorkTenant unitOfWork, IMapper mapper)
        {
            _unitOfWork = unitOfWork;
            _mapper = mapper;
        }

   
        public ApiResponse<PaginationResponseDTO<PhoneOrderViewDto>> GetAllPhoneOrdersGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _unitOfWork.PhoneOrderViews.GetAll().AsQueryable();

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;  // Save the filtered query for counting
                var totalRecords = _unitOfWork.PhoneOrderViews.GetAll().Count();  // This gives total records without filters
                var filteredRecords = filteredQuery.Count();  // Get filtered record count

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn, paginationGridDto.SortDirection);

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var data = _mapper.Map<List<PhoneOrderViewDto>>(paginatedData);

                var response = new PaginationResponseDTO<PhoneOrderViewDto>
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
                return ApiResponseFactory.InternalError<PaginationResponseDTO<PhoneOrderViewDto>>(
                    "Error fetching users.",
                    new List<string> { ex.Message });
            }
        }

    }
}
