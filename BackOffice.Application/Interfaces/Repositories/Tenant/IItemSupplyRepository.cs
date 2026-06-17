using BackOffice.Application.Interfaces.Repositories;
using BackOffice.Domain.Entities.Tenant;

namespace BackOffice.Application.Interfaces.Repositories.Tenant
{
    public interface IItemSupplyRepository : IBaseRepository<ItemSupply>
    {
        Task<List<ItemSupply>> GetByItemStoreIdAsync(Guid itemStoreId);
    }
}
