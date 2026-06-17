namespace BackOffice.Application.DTOs.Tenant.Manufacturer
{
    /// <summary>
    /// DTO for Manufacturer grid display
    /// </summary>
    public class ManufacturerGridDto
    {
        public Guid ManufacturerID { get; set; }
        public string ManufacturerName { get; set; } = string.Empty;
        public string? ManufacturerNo { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
    }

    /// <summary>
    /// DTO for creating a new Manufacturer
    /// </summary>
    public class CreateManufacturerDto
    {
        public string ManufacturerName { get; set; } = string.Empty;
        public string? ManufacturerNo { get; set; }
        public short Status { get; set; } = 1; // Default to Active
    }

    /// <summary>
    /// DTO for updating a Manufacturer
    /// </summary>
    public class UpdateManufacturerDto
    {
        public Guid ManufacturerID { get; set; }
        public string ManufacturerName { get; set; } = string.Empty;
        public string? ManufacturerNo { get; set; }
        public short Status { get; set; }

        // Optimistic-concurrency token: the DateModified the client read from GET.
        public DateTime? DateModified { get; set; }
    }

    /// <summary>
    /// DTO for full Manufacturer details (view/edit form)
    /// </summary>
    public class ManufacturerDetailDto
    {
        public Guid ManufacturerID { get; set; }
        public string ManufacturerName { get; set; } = string.Empty;
        public string? ManufacturerNo { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public Guid? UserCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public Guid? UserModified { get; set; }
    }
}
