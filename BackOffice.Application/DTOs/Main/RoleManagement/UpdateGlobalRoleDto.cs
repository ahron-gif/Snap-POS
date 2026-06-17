namespace BackOffice.Application.DTOs.Main.RoleManagement
{
    public class UpdateGlobalRoleDto : CreateGlobalRoleDto
    {
        public int GlobalRoleId { get; set; }
        public bool IsActive { get; set; }
    }
}
