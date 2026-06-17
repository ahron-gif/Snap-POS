namespace BackOffice.Application.DTOs.Main.PermissionManagement
{
    public class ScreenDto
    {
        public int Id { get; set; }
        public int ModuleId { get; set; }
        public string Code { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string? Route { get; set; }
        public string? Icon { get; set; }
        public int SortOrder { get; set; }
        public bool IsActive { get; set; }
        public string? ModuleName { get; set; }

        /// <summary>
        /// Populated only by the ModuleTree endpoint for the Permission Registry page.
        /// </summary>
        public List<PermissionDto>? Permissions { get; set; }
    }

    public class CreateScreenDto
    {
        public int ModuleId { get; set; }
        public string Code { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string? Route { get; set; }
        public string? Icon { get; set; }
        public int SortOrder { get; set; }
    }

    public class UpdateScreenDto : CreateScreenDto
    {
        public int Id { get; set; }
        public bool IsActive { get; set; }
    }
}
