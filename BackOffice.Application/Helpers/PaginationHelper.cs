using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.Helpers
{
    public static class PaginationHelper
    {
        public static (int totalRecords, List<T> paginatedData) ApplyPagination<T>(IQueryable<T> query, int startRow, int endRow)
        {
            var totalRecords = query.Count();
            var paginatedData = query
                .Skip(startRow)
                .Take(endRow - startRow)
                .ToList();
            return (totalRecords, paginatedData);
        }
    }

}
