using BackOffice.Application.Interfaces.Repositories;
using BackOffice.Domain.Entities.Tenant;

namespace BackOffice.Application.Interfaces.Repositories.Tenant
{
    public interface IItemMainRepository : IBaseRepository<ItemMain>
    {
        Task<bool> BarcodeExistsAsync(string barcodeNumber, Guid? excludeItemId = null);
        Task<bool> ModelNumberExistsAsync(string modalNumber, Guid? excludeItemId = null);
    }
}
