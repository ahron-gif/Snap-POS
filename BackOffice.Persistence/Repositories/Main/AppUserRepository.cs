// =============================================================================
// LEGACY FILE - kept for reference. Disabled via #if false; active replacement
// is WebAppUserRepository in the same folder.
// =============================================================================
#if false
using AutoMapper;
using BackOffice.Application.Interfaces.Repositories;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Domain.Entities.Main;
using BackOffice.Infrastructure.DBContext.Main;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Persistence.Repositories.Main
{
    public class AppUserRepository : MainBaseRepository<AppUser>, IAppUserRepository
    {
        private readonly MainDBContext _dbContext;
        private readonly IMapper _mapper;
        public AppUserRepository(MainDBContext dbContext, IMapper mapper) : base(dbContext, mapper)
        {
            _dbContext = dbContext;
            _mapper = mapper;
        }
    }
}
#endif
