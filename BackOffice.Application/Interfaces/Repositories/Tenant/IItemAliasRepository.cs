using BackOffice.Application.Interfaces.Repositories;
using BackOffice.Domain.Entities.Tenant;

namespace BackOffice.Application.Interfaces.Repositories.Tenant
{
    public interface IItemAliasRepository : IBaseRepository<ItemAlias>
    {
        Task<List<ItemAlias>> GetByItemIdAsync(Guid itemId);
        Task<bool> BarcodeExistsAsync(string barcodeNumber, Guid? excludeAliasId = null, Guid? excludeItemId = null);
    }
}
