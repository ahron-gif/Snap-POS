// ---------------------------------------------------------------------------
// Hand-written extensions to the auto-generated ITenantDBContextProcedures.
//
// Additions go here so they survive regeneration of the auto-generated
// interface file by EF Core Power Tools.
// ---------------------------------------------------------------------------

#nullable disable
using BackOffice.Domain.Entities.Tenant;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace BackOffice.Infrastructure.DBContext.Tenant
{
    public partial interface ITenantDBContextProcedures
    {
        /// <summary>
        /// Paged variant of the items-with-inventory SP. Server-side filters by
        /// store set + search text and returns only the requested page of items
        /// joined to their inventory rows. Every row includes <c>TotalCount</c>
        /// for pagination metadata in a single round-trip.
        /// See <see cref="TenantDBContextProcedures.SP_GetItemsWithInventoryLongAsync"/>.
        /// </summary>
        Task<List<SP_GetItemsWithInventoryPagedResult>> SP_GetItemsWithInventoryLongAsync(
            string storeIds,
            string searchText,
            int pageNumber,
            int pageSize,
            CancellationToken cancellationToken = default);
    }
}
