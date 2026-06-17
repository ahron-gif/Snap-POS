// =============================================================================
// LEGACY FILE - kept for reference. Disabled via #if false; active replacement
// is IWebUserRepository in the same folder.
// =============================================================================
#if false
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Domain.Entities.Tenant;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Repositories
{
    public interface IUserRepository : IBaseRepository<User>
    {

    }
}
#endif
