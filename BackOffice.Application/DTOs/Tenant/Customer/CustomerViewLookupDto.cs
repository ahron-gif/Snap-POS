using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.DTOs.Tenant.Customer
{
    public class CustomerViewLookupDto
    {
        public Guid CustomerId { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? CustomerNo { get; set; }
        public int? CustomerType { get; set; }
    }
}
