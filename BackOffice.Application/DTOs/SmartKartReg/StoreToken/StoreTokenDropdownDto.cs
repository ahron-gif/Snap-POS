namespace BackOffice.Application.DTOs.SmartKartReg.StoreToken
{
    public class StoreTokenDropdownDto
    {
        public int Id { get; set; }
        public Guid RegistrationId { get; set; }
        public string? StoreApp { get; set; }
        public string? StoreName { get; set; }
        public bool Active { get; set; }
    }
}
