using AutoMapper;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Persistence.Repositories
{
    public class ItemToGroupRepository : TenantBaseRepository<ItemToGroup>, IItemToGroupRepository
    {
        private readonly TenantDBContext _dbContext;

        public ItemToGroupRepository(TenantDBContext dbContext, IMapper mapper) : base(dbContext, mapper)
        {
            _dbContext = dbContext;
        }

        public async Task<List<ItemToGroup>> GetByItemStoreIdAsync(Guid itemStoreId)
        {
            return await _dbContext.ItemToGroups
                .Where(i => i.ItemStoreID == itemStoreId && i.Status > 0)
                .ToListAsync();
        }
    }
}
