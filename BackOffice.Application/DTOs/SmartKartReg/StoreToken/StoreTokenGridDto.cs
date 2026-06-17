namespace BackOffice.Application.DTOs.SmartKartReg.StoreToken
{
    public class StoreTokenGridDto
    {
        public int Id { get; set; }
        public Guid Token { get; set; }
        public Guid RegistrationId { get; set; }
        public string? StoreApp { get; set; }
        public string? StoreName { get; set; }
        public bool Active { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
    }
}
