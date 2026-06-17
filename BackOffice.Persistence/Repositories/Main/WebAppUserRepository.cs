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
    public class WebAppUserRepository : MainBaseRepository<WebAppUser>, IWebAppUserRepository
    {
        private readonly MainDBContext _dbContext;
        private readonly IMapper _mapper;
        public WebAppUserRepository(MainDBContext dbContext, IMapper mapper) : base(dbContext, mapper)
        {
            _dbContext = dbContext;
            _mapper = mapper;
        }
    }
}
