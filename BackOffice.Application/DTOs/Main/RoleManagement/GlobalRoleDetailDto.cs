namespace BackOffice.Application.DTOs.Main.RoleManagement
{
    public class GlobalRoleDetailDto
    {
        public int GlobalRoleId { get; set; }
        public string? RoleName { get; set; }
        public string? RoleLevel { get; set; }
        public string? Description { get; set; }
        public bool IsActive { get; set; }
        public DateTime DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public int? CreatedBy { get; set; }
    }
}
