using AutoMapper;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Persistence.Repositories
{
    public class ItemStoreRepository : TenantBaseRepository<ItemStore>, IItemStoreRepository
    {
        private readonly TenantDBContext _dbContext;

        public ItemStoreRepository(TenantDBContext dbContext, IMapper mapper) : base(dbContext, mapper)
        {
            _dbContext = dbContext;
        }

        public async Task<ItemStore?> GetByItemAndStoreAsync(Guid itemNo, Guid storeNo)
        {
            return await _dbContext.ItemStores
                .FirstOrDefaultAsync(i => i.ItemNo == itemNo && i.StoreNo == storeNo && i.Status > 0);
        }
    }
}
