namespace BackOffice.Application.DTOs.Tenant.Supplier
{
    public class SupplierNoteDto
    {
        public Guid NoteID { get; set; }
        public Guid SupplierID { get; set; }
        public int TypeOfNote { get; set; }
        public string? NoteValue { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public Guid? UserCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public Guid? UserModified { get; set; }
    }

    public class CreateSupplierNoteDto
    {
        public string NoteValue { get; set; } = string.Empty;
        public int TypeOfNote { get; set; } = 1;
    }
}
