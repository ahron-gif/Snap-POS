using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.DTOs
{
    public class PaginationDTO
    {
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
        public string? OrderBy { get; set; }
        public string? OrderByDirection { get; set; }
        public string? SearchValue { get; set; }
    }
}
