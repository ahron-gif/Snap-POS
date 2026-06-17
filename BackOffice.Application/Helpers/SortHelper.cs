using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Linq.Dynamic.Core;

namespace BackOffice.Application.Helpers
{
    public static class SortHelper
    {
        public static IQueryable<T> ApplySorting<T>(IQueryable<T> query, string sortColumn, string sortDirection)
        {
            if (!string.IsNullOrEmpty(sortColumn) && !string.IsNullOrEmpty(sortDirection))
            {
                // Use System.Linq.Dynamic.Core to dynamically construct the OrderBy clause
                query = query.OrderBy($"{sortColumn} {sortDirection}");
            }
            return query;
        }
    }
    
}
