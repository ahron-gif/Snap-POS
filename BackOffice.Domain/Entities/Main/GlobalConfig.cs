#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class GlobalConfig
{
    public int Id { get; set; }

    public string ConfigKey { get; set; } = null!;

    public string? ConfigValue { get; set; }

    public string? Description { get; set; }

    public DateTime UpdatedAt { get; set; }
}
