namespace BackOffice.Application.DTOs.Main.Billing
{
    public class ApiDefinitionDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public string Code { get; set; } = null!;
        public string? Description { get; set; }
        public decimal DefaultRatePerCall { get; set; }
        public int DefaultFreeTier { get; set; }
        public bool IsActive { get; set; }
        public int SortOrder { get; set; }
    }

    public class CreateApiDefinitionDto
    {
        public string Name { get; set; } = null!;
        public string Code { get; set; } = null!;
        public string? Description { get; set; }
        public decimal DefaultRatePerCall { get; set; }
        public int DefaultFreeTier { get; set; }
    }

    public class UpdateApiDefinitionDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public string Code { get; set; } = null!;
        public string? Description { get; set; }
        public decimal DefaultRatePerCall { get; set; }
        public int DefaultFreeTier { get; set; }
        public bool IsActive { get; set; }
    }
}
