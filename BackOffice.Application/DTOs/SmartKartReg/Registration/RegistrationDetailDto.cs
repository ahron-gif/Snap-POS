namespace BackOffice.Application.DTOs.SmartKartReg.Registration
{
    public class RegistrationDetailDto
    {
        public Guid RegistrationId { get; set; }
        public string StoreName { get; set; } = null!;
        public string UserName { get; set; } = null!;
        public string Password { get; set; } = null!;
        public string DataBaseName { get; set; } = null!;
        public int StoreType { get; set; }
        public DateOnly LicenseExpires { get; set; }
        public string? Address { get; set; }
        public string? CityStateZip { get; set; }
        public string? Phone { get; set; }
        public string? Fax { get; set; }
        public string? Email { get; set; }
        public bool? MultipleLocation { get; set; }
        public bool? PhoneOrder { get; set; }
        public bool? Loyalty { get; set; }
        public bool? EmailService { get; set; }
        public bool? TextService { get; set; }
        public bool? GiftCards { get; set; }
        public bool? TimeAttendance { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public int Status { get; set; }
        public string? SalesPerson { get; set; }
        public string? RegUser { get; set; }
        public string? ServerName { get; set; }
        public string? VersionName { get; set; }
        public int? PosLic { get; set; }
        public int? BoLic { get; set; }
        public bool? IsSmartKart { get; set; }
        public int? VersionId { get; set; }
        public string? Apiurl { get; set; }
    }
}
