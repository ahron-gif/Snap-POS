using BackOffice.Application.Interfaces.Repositories;
using BackOffice.Domain.Entities.Tenant;

namespace BackOffice.Application.Interfaces.Repositories.Tenant
{
    public interface IItemStoreRepository : IBaseRepository<ItemStore>
    {
        Task<ItemStore?> GetByItemAndStoreAsync(Guid itemNo, Guid storeNo);
    }
}
