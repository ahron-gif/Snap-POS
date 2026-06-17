namespace BackOffice.Application.DTOs.Main.PermissionManagement
{
    public class TenantPermissionCeilingDto
    {
        public int TenantId { get; set; }
        public string? TenantName { get; set; }
        public List<ModuleCeilingDto> Modules { get; set; } = new();
    }

    public class ModuleCeilingDto
    {
        public int ModuleId { get; set; }
        public string? ModuleCode { get; set; }
        public string? ModuleName { get; set; }
        public bool IsEnabled { get; set; }
        public List<ScreenCeilingDto> Screens { get; set; } = new();
    }

    public class ScreenCeilingDto
    {
        public int ScreenId { get; set; }
        public string? ScreenCode { get; set; }
        public string? ScreenName { get; set; }
        public List<PermissionCeilingItemDto> Permissions { get; set; } = new();
    }

    public class PermissionCeilingItemDto
    {
        public int PermissionId { get; set; }
        public string? PermissionKey { get; set; }
        public string? PermissionName { get; set; }
        public string? Category { get; set; }
        public bool IsAllowed { get; set; }
    }
}
