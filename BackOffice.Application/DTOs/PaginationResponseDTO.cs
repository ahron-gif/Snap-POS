using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.DTOs
{
    public class PaginationResponseDTO<T>
    {
        public string? Filters { get; set; }
        public int TotalRecords { get; set; }
        public int RecordsFiltered { get; set; }
        public int CurrentPage { get; set; }
        public int PageSize { get; set; }
        public List<T>? Data { get; set; }
    }
}
