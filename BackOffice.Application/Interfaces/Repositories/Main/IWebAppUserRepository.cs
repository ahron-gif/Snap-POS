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
    public interface IWebAppUserRepository : IBaseRepository<WebAppUser>
    {

    }
}
