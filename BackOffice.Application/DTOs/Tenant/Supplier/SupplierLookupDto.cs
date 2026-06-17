using System;

namespace BackOffice.Application.DTOs.Tenant.Supplier
{
    public class SupplierLookupDto
    {
        public Guid SupplierID { get; set; }
        public string? SupplierNo { get; set; }
        public string Name { get; set; } = string.Empty;
    }
}
