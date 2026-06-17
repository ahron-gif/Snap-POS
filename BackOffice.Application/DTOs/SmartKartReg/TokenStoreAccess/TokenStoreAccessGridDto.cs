namespace BackOffice.Application.DTOs.SmartKartReg.TokenStoreAccess
{
    public class TokenStoreAccessGridDto
    {
        public int Id { get; set; }
        public int TokenId { get; set; }
        public string? StoreApp { get; set; }
        public Guid StoreId { get; set; }
        public string? StoreName { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
    }
}
