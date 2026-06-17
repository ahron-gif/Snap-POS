// =============================================================================
// LEGACY FILE - kept in the codebase for reference. All code below is disabled
// via #if false so it does NOT compile or participate in DI / runtime. The
// active replacement is IWebAppUserRepository in the same folder. To revive
// this interface in the future, remove the #if false / #endif wrappers and
// re-add the corresponding property on IUnitOfWorkMain.
// =============================================================================
#if false
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Domain.Entities.Main;
using BackOffice.Domain.Entities.Tenant;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Repositories
{
    public interface IAppUserRepository : IBaseRepository<AppUser>
    {

    }
}
#endif
