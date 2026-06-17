namespace BackOffice.Application.DTOs.SmartKartReg.TokenStoreAccess
{
    public class BulkTokenStoreAccessDto
    {
        public List<Guid> StoreIds { get; set; } = new List<Guid>();
    }
}
