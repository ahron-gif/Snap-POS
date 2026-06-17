namespace BackOffice.Application.DTOs.SmartKartReg.Permission
{
    public class PermissionDetailDto
    {
        public int Id { get; set; }
        public string? PermissionKey { get; set; }
        public string? PermissionName { get; set; }
        public string? Description { get; set; }
        public string? Category { get; set; }
        public bool IsActive { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public string? CreatedBy { get; set; }
        public string? ModifiedBy { get; set; }
    }
}
