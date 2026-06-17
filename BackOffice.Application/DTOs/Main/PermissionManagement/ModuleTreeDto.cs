namespace BackOffice.Application.DTOs.Main.PermissionManagement
{
    public class ModuleDto
    {
        public int ModuleId { get; set; }
        public string Code { get; set; } = null!;
        public string ModuleName { get; set; } = null!;
        public string? Icon { get; set; }
        public int SortOrder { get; set; }
        public bool IsActive { get; set; }
        public int? ParentModuleId { get; set; }
    }

    public class ModuleTreeDto : ModuleDto
    {
        public List<ModuleTreeDto> Children { get; set; } = new();
        public List<ScreenDto> Screens { get; set; } = new();
    }
}
