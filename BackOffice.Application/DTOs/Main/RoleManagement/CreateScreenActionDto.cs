namespace BackOffice.Application.DTOs.Main.RoleManagement
{
    public class CreateScreenActionDto
    {
        public int ModuleId { get; set; }
        public string ActionKey { get; set; } = null!;
        public string ActionName { get; set; } = null!;
        public string? Description { get; set; }
        public int SortOrder { get; set; }
    }
}
