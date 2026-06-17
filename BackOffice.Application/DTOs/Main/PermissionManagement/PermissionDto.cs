namespace BackOffice.Application.DTOs.Main.PermissionManagement
{
    public class PermissionDto
    {
        public int Id { get; set; }
        public int ModuleId { get; set; }
        public int ScreenId { get; set; }
        public string PermissionKey { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string? Category { get; set; }
        public int SortOrder { get; set; }
        public bool IsActive { get; set; }
        public string? ModuleName { get; set; }
        public string? ScreenName { get; set; }
    }

    public class CreatePermissionDto
    {
        public int ModuleId { get; set; }
        public int ScreenId { get; set; }
        public string PermissionKey { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string? Category { get; set; }
        public int SortOrder { get; set; }
    }

    public class UpdatePermissionDto : CreatePermissionDto
    {
        public int Id { get; set; }
        public bool IsActive { get; set; }
    }
}
