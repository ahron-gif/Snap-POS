#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class PlanFeature
{
    public int Id { get; set; }

    public int PlanId { get; set; }

    public int? AppId { get; set; }

    /// <summary>
    /// "general" | "web_app" | "pos" | "picking" | "price_change" | "open_api" | "smartkart_pay"
    /// </summary>
    public string Category { get; set; } = null!;

    public string FeatureName { get; set; } = null!;

    public string? Description { get; set; }

    public bool IsEnabled { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Plan Plan { get; set; } = null!;

    public virtual App? App { get; set; }
}
