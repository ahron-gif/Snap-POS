using AutoMapper;
using BackOffice.Application.Interfaces.Repositories;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Persistence.Repositories.Tenant
{
    internal class PhoneOrderViewRepository : TenantBaseRepository<PhoneOrderView>, IPhoneOrderViewRepository
    {
        private readonly TenantDBContext _dbContext;
        private readonly IMapper _mapper;
        public PhoneOrderViewRepository(TenantDBContext dbContext, IMapper mapper) : base(dbContext, mapper)
        {
            _dbContext = dbContext;
            _mapper = mapper;
        }
    }
}
