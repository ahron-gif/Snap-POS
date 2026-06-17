namespace BackOffice.Application.DTOs.Main.RoleManagement
{
    public class ScreenActionDto
    {
        public int ScreenActionId { get; set; }
        public int ModuleId { get; set; }
        public string? ModuleName { get; set; }
        public string? ActionKey { get; set; }
        public string? ActionName { get; set; }
        public string? Description { get; set; }
        public int SortOrder { get; set; }
        public bool IsActive { get; set; }
    }
}
