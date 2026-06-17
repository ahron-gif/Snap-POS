namespace BackOffice.Application.DTOs.SmartKartReg.TokenPermission
{
    public class CreateTokenPermissionDto
    {
        public int TokenId { get; set; }
        public int PermissionId { get; set; }
        public bool IsAllowed { get; set; } = true;
    }
}
