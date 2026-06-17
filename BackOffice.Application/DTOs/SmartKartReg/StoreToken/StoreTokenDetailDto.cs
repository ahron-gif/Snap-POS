using BackOffice.Application.DTOs.SmartKartReg.TokenPermission;

namespace BackOffice.Application.DTOs.SmartKartReg.StoreToken
{
    public class StoreTokenDetailDto
    {
        public int Id { get; set; }
        public Guid Token { get; set; }
        public Guid RegistrationId { get; set; }
        public string? StoreApp { get; set; }
        public string? StoreName { get; set; }
        public bool Active { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public string? CreatedBy { get; set; }
        public string? ModifiedBy { get; set; }
    }
}
