namespace BackOffice.Application.DTOs.SmartKartReg.TokenPermission
{
    public class TokenPermissionDetailDto
    {
        public int Id { get; set; }
        public int TokenId { get; set; }
        public int PermissionId { get; set; }
        public string? PermissionKey { get; set; }
        public string? PermissionName { get; set; }
        public string? Category { get; set; }
        public bool IsAllowed { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public string? CreatedBy { get; set; }
        public string? ModifiedBy { get; set; }
    }
}
