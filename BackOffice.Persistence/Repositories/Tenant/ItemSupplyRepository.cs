using AutoMapper;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Persistence.Repositories
{
    public class ItemSupplyRepository : TenantBaseRepository<ItemSupply>, IItemSupplyRepository
    {
        private readonly TenantDBContext _dbContext;

        public ItemSupplyRepository(TenantDBContext dbContext, IMapper mapper) : base(dbContext, mapper)
        {
            _dbContext = dbContext;
        }

        public async Task<List<ItemSupply>> GetByItemStoreIdAsync(Guid itemStoreId)
        {
            return await _dbContext.ItemSupplies
                .Where(i => i.ItemStoreNo == itemStoreId && i.Status > 0)
                .ToListAsync();
        }
    }
}
