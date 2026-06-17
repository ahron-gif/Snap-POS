namespace BackOffice.Application.DTOs.Main.RoleManagement
{
    public class RolePermissionItemDto
    {
        public int ScreenActionId { get; set; }
        public bool IsAllowed { get; set; }
    }

    public class BulkPermissionUpdateDto
    {
        public List<RolePermissionItemDto> Permissions { get; set; } = new();
    }

    public class GlobalRolePermissionMatrixDto
    {
        public int GlobalRoleId { get; set; }
        public string? RoleName { get; set; }
        public List<ScreenActionGroupDto> ScreenActionGroups { get; set; } = new();
        public List<RolePermissionItemDto> Permissions { get; set; } = new();
    }
}
