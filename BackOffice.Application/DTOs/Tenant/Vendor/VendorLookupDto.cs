using System;

namespace BackOffice.Application.DTOs.Tenant.Vendor
{
    public class VendorLookupDto
    {
        public Guid VendorID { get; set; }
        public string? VendorNo { get; set; }
        public string Name { get; set; } = string.Empty;
    }
}
