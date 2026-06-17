#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class CustomerApiOverride
{
    public int Id { get; set; }

    public int CustomerId { get; set; }

    public int ApiDefinitionId { get; set; }

    public decimal? RateOverride { get; set; }

    public int? FreeTierOverride { get; set; }

    public int? MaxCallsOverride { get; set; }

    public bool IsEnabled { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual Customer Customer { get; set; } = null!;

    public virtual ApiDefinition ApiDefinition { get; set; } = null!;
}
