using System;

namespace BackOffice.Application.DTOs.Tenant.Customer
{
    public class CustomerLookupDto
    {
        public Guid CustomerID { get; set; }
        public string? CustomerNo { get; set; }
        public string Name { get; set; } = string.Empty;
    }
}
