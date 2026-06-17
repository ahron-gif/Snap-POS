namespace BackOffice.Application.DTOs.SmartKartReg.Registration
{
    public class RegistrationGridDto
    {
        public Guid RegistrationId { get; set; }
        public string StoreName { get; set; } = null!;
        public string DataBaseName { get; set; } = null!;
        public int StoreType { get; set; }
        public DateOnly LicenseExpires { get; set; }
        public string? Address { get; set; }
        public string? CityStateZip { get; set; }
        public string? Phone { get; set; }
        public string? Email { get; set; }
        public int Status { get; set; }
        public string? SalesPerson { get; set; }
        public string? ServerName { get; set; }
        public string? VersionName { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
    }
}
