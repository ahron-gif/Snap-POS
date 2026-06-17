// =============================================================================
// LEGACY FILE - kept for reference. Disabled via #if false; active replacement
// is IWebUserService in the same folder.
// =============================================================================
#if false
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
    public interface IUserService
    {
        ApiResponse<PaginationResponseDTO<UserDto>> GetAllAsync(PaginationDTO pagination);

        Task<User?> GetByIdAsync(Guid userId);

        Task<User?> GetByUserNameAsync(string userName);

        Task<User> CreateAsync(User user);

        Task<User?> UpdateAsync(User user);

        Task<bool> DeleteAsync(Guid userId);

        Task<User?> AuthenticateAsync(string userName, string password);
    }
}
#endif
