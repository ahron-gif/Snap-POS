using BackOffice.Application.Interfaces.Repositories;
using BackOffice.Domain.Entities.Tenant;

namespace BackOffice.Application.Interfaces.Repositories.Tenant
{
    public interface IItemToGroupRepository : IBaseRepository<ItemToGroup>
    {
        Task<List<ItemToGroup>> GetByItemStoreIdAsync(Guid itemStoreId);
    }
}
