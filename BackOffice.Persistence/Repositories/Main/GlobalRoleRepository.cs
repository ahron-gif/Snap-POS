using AutoMapper;
using BackOffice.Application.Interfaces.Repositories.Main;
using BackOffice.Domain.Entities.Main;
using BackOffice.Infrastructure.DBContext.Main;

namespace BackOffice.Persistence.Repositories.Main
{
    public class GlobalRoleRepository : MainBaseRepository<GlobalRole>, IGlobalRoleRepository
    {
        private readonly MainDBContext _dbContext;
        private readonly IMapper _mapper;
        public GlobalRoleRepository(MainDBContext dbContext, IMapper mapper) : base(dbContext, mapper)
        {
            _dbContext = dbContext;
            _mapper = mapper;
        }
    }
}
