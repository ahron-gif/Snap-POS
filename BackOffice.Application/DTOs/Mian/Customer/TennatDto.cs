using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.DTOs.Mian.Customer
{
    public class TennatDto
    {
        public int CustomerId { get; set; }

        public string CustomerName { get; set; } = null!;

        public string ServerName { get; set; } = null!;

        public string DBName { get; set; } = null!;

        public string DBUser { get; set; } = null!;

        public string DBPass { get; set; } = null!;

        public DateTime DateCreated { get; set; }

        public DateTime? DateModified { get; set; }

        public int? SystemUserCreated { get; set; }

        public Guid LicenseKey { get; set; }

        public string? Email { get; set; }

        public int Environment { get; set; }
    }
}
