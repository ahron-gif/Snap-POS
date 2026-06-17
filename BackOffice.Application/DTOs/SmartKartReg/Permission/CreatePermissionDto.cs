namespace BackOffice.Application.DTOs.SmartKartReg.Permission
{
    public class CreatePermissionDto
    {
        public string PermissionKey { get; set; } = null!;
        public string PermissionName { get; set; } = null!;
        public string? Description { get; set; }
        public string? Category { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
