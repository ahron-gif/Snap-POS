namespace BackOffice.Application.DTOs.Main.RoleManagement
{
    public class CustomerRoleAssignmentDto
    {
        public int CustomerId { get; set; }
        public List<int> GlobalRoleIds { get; set; } = new();
    }
}
