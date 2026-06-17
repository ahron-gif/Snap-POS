using AutoMapper;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Persistence.Repositories
{
    public class ItemMainRepository : TenantBaseRepository<ItemMain>, IItemMainRepository
    {
        private readonly TenantDBContext _dbContext;

        public ItemMainRepository(TenantDBContext dbContext, IMapper mapper) : base(dbContext, mapper)
        {
            _dbContext = dbContext;
        }

        public async Task<bool> BarcodeExistsAsync(string barcodeNumber, Guid? excludeItemId = null)
        {
            var query = _dbContext.ItemMains
                .Where(i => i.BarcodeNumber == barcodeNumber && i.Status > 0);

            if (excludeItemId.HasValue)
            {
                query = query.Where(i => i.ItemID != excludeItemId.Value);
            }

            // Also check in ItemAlias table, but exclude aliases belonging to the current item
            var aliasQuery = _dbContext.ItemAliases
                .Where(a => a.BarcodeNumber == barcodeNumber && a.Status > 0);

            if (excludeItemId.HasValue)
            {
                aliasQuery = aliasQuery.Where(a => a.ItemNo != excludeItemId.Value);
            }

            return await query.AnyAsync() || await aliasQuery.AnyAsync();
        }

        public async Task<bool> ModelNumberExistsAsync(string modalNumber, Guid? excludeItemId = null)
        {
            if (string.IsNullOrEmpty(modalNumber))
                return false;

            var query = _dbContext.ItemMains
                .Where(i => i.ModalNumber == modalNumber && i.Status > 0);

            if (excludeItemId.HasValue)
            {
                query = query.Where(i => i.ItemID != excludeItemId.Value);
            }

            return await query.AnyAsync();
        }
    }
}
