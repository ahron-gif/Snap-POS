// ---------------------------------------------------------------------------
// Hand-written extensions to the auto-generated TenantDBContextProcedures.
//
// This file is a `partial class` on the same type as
// TenantDBContextProcedures.cs so that additions here survive regeneration of
// the auto-generated file by EF Core Power Tools.
//
// Never edit the auto-generated file directly - add new methods here instead.
// ---------------------------------------------------------------------------

#nullable disable
using BackOffice.Domain.Entities.Tenant;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace BackOffice.Infrastructure.DBContext.Tenant
{
    public partial class TenantDBContextProcedures
    {
        /// <summary>
        /// Calls dbo.SP_GetItemsWithInventoryLong (paged variant). The SP filters
        /// items server-side by <paramref name="storeIds"/> (comma-separated GUIDs;
        /// null/empty = no store filter, used by SuperAdmin) and
        /// <paramref name="searchText"/>, then applies OFFSET/FETCH using
        /// <paramref name="pageNumber"/>/<paramref name="pageSize"/>. Every returned
        /// row carries the un-paged <c>TotalCount</c> so the caller can assemble
        /// pagination metadata in a single round-trip.
        /// </summary>
        public virtual async Task<List<SP_GetItemsWithInventoryPagedResult>> SP_GetItemsWithInventoryLongAsync(
            string storeIds,
            string searchText,
            int pageNumber,
            int pageSize,
            CancellationToken cancellationToken = default)
        {
            var sqlParameters = new[]
            {
                new SqlParameter
                {
                    ParameterName = "StoreIds",
                    Size = -1,
                    Value = (object)storeIds ?? Convert.DBNull,
                    SqlDbType = System.Data.SqlDbType.NVarChar,
                },
                new SqlParameter
                {
                    ParameterName = "SearchText",
                    Size = 200,
                    Value = (object)searchText ?? Convert.DBNull,
                    SqlDbType = System.Data.SqlDbType.NVarChar,
                },
                new SqlParameter
                {
                    ParameterName = "PageNumber",
                    Value = pageNumber,
                    SqlDbType = System.Data.SqlDbType.Int,
                },
                new SqlParameter
                {
                    ParameterName = "PageSize",
                    Value = pageSize,
                    SqlDbType = System.Data.SqlDbType.Int,
                },
            };

            return await _context.SqlQueryAsync<SP_GetItemsWithInventoryPagedResult>(
                "EXEC [dbo].[SP_GetItemsWithInventoryLong] @StoreIds = @StoreIds, @SearchText = @SearchText, @PageNumber = @PageNumber, @PageSize = @PageSize",
                sqlParameters,
                cancellationToken);
        }
    }
}
