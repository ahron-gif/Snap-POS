using AutoMapper;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Persistence.Repositories
{
    public class ItemAliasRepository : TenantBaseRepository<ItemAlias>, IItemAliasRepository
    {
        private readonly TenantDBContext _dbContext;

        public ItemAliasRepository(TenantDBContext dbContext, IMapper mapper) : base(dbContext, mapper)
        {
            _dbContext = dbContext;
        }

        public async Task<List<ItemAlias>> GetByItemIdAsync(Guid itemId)
        {
            return await _dbContext.ItemAliases
                .Where(i => i.ItemNo == itemId && i.Status > 0)
                .ToListAsync();
        }

        public async Task<bool> BarcodeExistsAsync(string barcodeNumber, Guid? excludeAliasId = null, Guid? excludeItemId = null)
        {
            var query = _dbContext.ItemAliases
                .Where(a => a.BarcodeNumber == barcodeNumber && a.Status > 0);

            if (excludeAliasId.HasValue)
            {
                query = query.Where(a => a.AliasId != excludeAliasId.Value);
            }

            // Exclude aliases belonging to the current item (prevents false positive during update)
            if (excludeItemId.HasValue)
            {
                query = query.Where(a => a.ItemNo != excludeItemId.Value);
            }

            // Also check in ItemMain table, but exclude the current item's own barcode
            var mainQuery = _dbContext.ItemMains
                .Where(i => i.BarcodeNumber == barcodeNumber && i.Status > 0);

            if (excludeItemId.HasValue)
            {
                mainQuery = mainQuery.Where(i => i.ItemID != excludeItemId.Value);
            }

            return await query.AnyAsync() || await mainQuery.AnyAsync();
        }
    }
}
