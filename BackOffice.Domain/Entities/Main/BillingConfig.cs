#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class BillingConfig
{
    public int Id { get; set; }

    public string ConfigKey { get; set; } = null!;

    public string ConfigValue { get; set; } = null!;

    public string? Description { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int? UpdatedBy { get; set; }
}
