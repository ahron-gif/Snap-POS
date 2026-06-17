namespace BackOffice.Application.DTOs.Main.PermissionManagement
{
    public class TenantAllowedModuleDto
    {
        public int Id { get; set; }
        public int TenantId { get; set; }
        public int ModuleId { get; set; }
        public string? ModuleName { get; set; }
        public string? ModuleCode { get; set; }
        public bool IsEnabled { get; set; }
        public DateTime? EnabledAt { get; set; }
        public DateTime? DisabledAt { get; set; }
    }

    public class TenantModuleItem
    {
        public int ModuleId { get; set; }
        public bool IsEnabled { get; set; }
    }

    public class UpdateTenantAllowedModulesDto
    {
        public int TenantId { get; set; }
        public List<TenantModuleItem> Modules { get; set; } = new();
    }
}
