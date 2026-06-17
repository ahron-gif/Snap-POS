namespace BackOffice.Application.DTOs.Main.PermissionManagement
{
    public class ScreenPermissionsDto
    {
        public string ScreenCode { get; set; } = null!;
        public bool CanView { get; set; }
        public bool CanCreate { get; set; }
        public bool CanEdit { get; set; }
        public bool CanDelete { get; set; }
        public bool CanApprove { get; set; }
        public bool CanExport { get; set; }
        public bool CanImport { get; set; }
        public bool CanPrint { get; set; }
        public bool CanVoid { get; set; }
        public bool CanAssign { get; set; }
        public bool CanConfig { get; set; }
        public Dictionary<string, bool> CustomActions { get; set; } = new();
    }
}
