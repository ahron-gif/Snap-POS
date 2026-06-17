namespace BackOffice.Application.DTOs.Tenant.Register
{
    public class RegisterGridDto
    {
        public Guid RegisterID { get; set; }
        public string? RegisterNo { get; set; }
        public string? CompName { get; set; }
        public Guid? StoreID { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
    }
}
