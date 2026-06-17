namespace BackOffice.Application.DTOs.Main.RoleManagement
{
    public class ScreenActionGroupDto
    {
        public int ModuleId { get; set; }
        public string? ModuleName { get; set; }
        public string? PageURL { get; set; }
        public List<ScreenActionDto> Actions { get; set; } = new();
    }
}
