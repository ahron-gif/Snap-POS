using AutoMapper;
using BackOffice.Application.Interfaces.Repositories.Main;
using BackOffice.Domain.Entities.Main;
using BackOffice.Infrastructure.DBContext.Main;

namespace BackOffice.Persistence.Repositories.Main
{
    public class CustomerGlobalRoleRepository : MainBaseRepository<CustomerGlobalRole>, ICustomerGlobalRoleRepository
    {
        private readonly MainDBContext _dbContext;
        private readonly IMapper _mapper;
        public CustomerGlobalRoleRepository(MainDBContext dbContext, IMapper mapper) : base(dbContext, mapper)
        {
            _dbContext = dbContext;
            _mapper = mapper;
        }
    }
}
