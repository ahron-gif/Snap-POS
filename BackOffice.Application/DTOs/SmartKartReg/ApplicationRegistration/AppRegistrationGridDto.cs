namespace BackOffice.Application.DTOs.SmartKartReg.ApplicationRegistration
{
    public class AppRegistrationGridDto
    {
        public Guid Id { get; set; }
        public Guid AppId { get; set; }
        public string AppName { get; set; } = null!;
        public Guid? RegistrationId { get; set; }
        public string? StoreName { get; set; }
        public string? Apiurl { get; set; }
    }
}
