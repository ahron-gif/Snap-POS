namespace BackOffice.Application.DTOs.Main.RoleManagement
{
    public class CreateGlobalRoleDto
    {
        public string RoleName { get; set; } = null!;
        public string RoleLevel { get; set; } = null!;
        public string? Description { get; set; }
    }
}
