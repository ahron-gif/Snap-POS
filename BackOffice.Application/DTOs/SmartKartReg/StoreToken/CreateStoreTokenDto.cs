namespace BackOffice.Application.DTOs.SmartKartReg.StoreToken
{
    public class CreateStoreTokenDto
    {
        public Guid RegistrationId { get; set; }
        public string StoreApp { get; set; } = null!;
        public bool Active { get; set; } = true;
    }
}
