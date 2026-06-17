// =============================================================================
// LEGACY FILE - kept for reference. Disabled via #if false; active replacement
// is WebUserService in the same folder.
// =============================================================================
#if false
using AutoMapper;
using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Repositories;
using BackOffice.Application.Interfaces.Services;
using BackOffice.Common;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Persistence.Repositories;
using FluentValidation;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using BackOffice.Domain.Entities.Tenant;

namespace BackOffice.Persistence.Services
{
    public class UserService : IUserService
    {
        private readonly IUnitOfWorkTenant _unitOfWork;
        private readonly IMapper _mapper;

        public UserService(IUnitOfWorkTenant unitOfWork, IMapper mapper)
        {
            _unitOfWork = unitOfWork;
            _mapper = mapper;
        }

        public Task<User?> AuthenticateAsync(string userName, string password)
        {
            throw new NotImplementedException();
        }

        public Task<User> CreateAsync(User user)
        {
            throw new NotImplementedException();
        }

        public Task<bool> DeleteAsync(Guid userId)
        {
            throw new NotImplementedException();
        }

        public Task<User?> GetByIdAsync(Guid userId)
        {
            throw new NotImplementedException();
        }

        public Task<User?> GetByUserNameAsync(string userName)
        {
            throw new NotImplementedException();
        }

        public Task<User?> UpdateAsync(User user)
        {
            throw new NotImplementedException();
        }

        public ApiResponse<PaginationResponseDTO<UserDto>> GetAllAsync(PaginationDTO pagination)
        {
            try
            {
                var query = _unitOfWork.Users
                    .GetAll()
                    .AsQueryable();

                var totalRecords = query.Count();
                List<User> users;
                if (pagination.PageSize == null || pagination.PageSize == 0)
                {
                    users = query.OrderByDescending(x => x.DateCreated).ToList();
                }
                else
                {
                    users = query
                        .OrderByDescending(x => x.DateCreated)
                        .Skip((pagination.PageNumber - 1) * pagination.PageSize)
                        .Take(pagination.PageSize)
                        .ToList();
                }
                var data = _mapper.Map<List<UserDto>>(users);
                var response = new PaginationResponseDTO<UserDto>
                {
                    TotalRecords = totalRecords,
                    RecordsFiltered = totalRecords,
                    Data = data
                };
                return ApiResponseFactory.Success(response, "Company list fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<UserDto>>(
                    "Error fetching companies.",
                    new List<string> { ex.Message });
            }
        }
    }
}
#endif
