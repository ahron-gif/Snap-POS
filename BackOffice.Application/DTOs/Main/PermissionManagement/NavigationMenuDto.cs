namespace BackOffice.Application.DTOs.Main.PermissionManagement
{
    public class NavigationMenuDto
    {
        public List<MenuModuleDto> Modules { get; set; } = new();
    }

    public class MenuModuleDto
    {
        public int ModuleId { get; set; }
        public string Code { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string? Icon { get; set; }
        public int SortOrder { get; set; }
        public List<MenuScreenDto> Screens { get; set; } = new();
    }

    public class MenuScreenDto
    {
        public int ScreenId { get; set; }
        public string Code { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string? Route { get; set; }
        public string? Icon { get; set; }
        public int SortOrder { get; set; }
    }
}
