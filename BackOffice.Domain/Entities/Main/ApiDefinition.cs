#nullable enable
using System;
using System.Collections.Generic;

namespace BackOffice.Domain.Entities.Main;

public partial class ApiDefinition
{
    public int Id { get; set; }

    public string Name { get; set; } = null!;

    public string Code { get; set; } = null!;

    public string? Description { get; set; }

    public decimal DefaultRatePerCall { get; set; }

    public int DefaultFreeTier { get; set; }

    public bool IsActive { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual ICollection<PlanApiPricing> PlanApiPricings { get; set; } = new List<PlanApiPricing>();

    public virtual ICollection<CustomerApiOverride> CustomerApiOverrides { get; set; } = new List<CustomerApiOverride>();

    public virtual ICollection<ApiUsageLog> ApiUsageLogs { get; set; } = new List<ApiUsageLog>();
}
