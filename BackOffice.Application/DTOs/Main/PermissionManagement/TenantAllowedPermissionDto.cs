namespace BackOffice.Application.DTOs.Main.PermissionManagement
{
    public class TenantAllowedPermissionDto
    {
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int PermissionId { get; set; }
        public string? PermissionKey { get; set; }
        public string? PermissionName { get; set; }
        public string? ModuleName { get; set; }
        public string? ScreenName { get; set; }
        public bool IsAllowed { get; set; }
        public DateTime? GrantedAt { get; set; }
    }

    public class TenantPermissionItem
    {
        public int PermissionId { get; set; }
        public bool IsAllowed { get; set; }
    }

    public class UpdateTenantAllowedPermissionsDto
    {
        public int TenantId { get; set; }
        public List<TenantPermissionItem> Permissions { get; set; } = new();
    }
}
