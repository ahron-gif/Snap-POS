namespace BackOffice.Application.DTOs.SmartKartReg.ApplicationRegistration
{
    public class CreateAppRegistrationDto
    {
        public Guid AppId { get; set; }
        public Guid? RegistrationId { get; set; }
        public string? Apiurl { get; set; }
    }
}
