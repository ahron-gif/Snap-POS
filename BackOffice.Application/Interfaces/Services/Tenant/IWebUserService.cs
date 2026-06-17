using BackOffice.Application.DTOs;
using BackOffice.Common;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using BackOffice.Domain.Entities.Tenant;

namespace BackOffice.Application.Interfaces.Services
{
    public interface IWebUserService
    {
        ApiResponse<PaginationResponseDTO<UserDto>> GetAllAsync(PaginationDTO pagination);

        Task<WebUser?> GetByIdAsync(Guid userId);

        Task<WebUser?> GetByUserNameAsync(string userName);

        Task<WebUser> CreateAsync(WebUser user);

        Task<WebUser?> UpdateAsync(WebUser user);

        Task<bool> DeleteAsync(Guid userId);

        Task<WebUser?> AuthenticateAsync(string userName, string password);
    }
}
