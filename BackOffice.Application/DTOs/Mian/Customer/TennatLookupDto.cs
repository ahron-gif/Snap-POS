using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.DTOs.Mian.Customer
{
    public class TennatLookupDto
    {
        public int CustomerId { get; set; }

        public string CustomerName { get; set; } = null!;

        public string? Email { get; set; }
    }
}
