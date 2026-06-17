namespace BackOffice.Application.DTOs.SmartKartReg.TokenPermission
{
    public class TokenPermissionGridDto
    {
        public int Id { get; set; }
        public int TokenId { get; set; }
        public int PermissionId { get; set; }
        public string? PermissionKey { get; set; }
        public string? PermissionName { get; set; }
        public bool IsAllowed { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
    }
}
