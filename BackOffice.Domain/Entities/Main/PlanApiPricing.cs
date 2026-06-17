#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class PlanApiPricing
{
    public int Id { get; set; }

    public int PlanId { get; set; }

    public int ApiDefinitionId { get; set; }

    public decimal RatePerCall { get; set; }

    public int FreeTierCalls { get; set; }

    public int? MaxCallsPerMonth { get; set; }

    public bool IsIncluded { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual Plan Plan { get; set; } = null!;

    public virtual ApiDefinition ApiDefinition { get; set; } = null!;
}
