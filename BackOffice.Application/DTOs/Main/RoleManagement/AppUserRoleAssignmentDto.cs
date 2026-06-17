namespace BackOffice.Application.DTOs.Main.RoleManagement
{
    public class AppUserRoleAssignmentDto
    {
        public int UserId { get; set; }
        public List<int> GlobalRoleIds { get; set; } = new();
    }
}
