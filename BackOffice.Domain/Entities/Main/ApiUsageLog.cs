#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class ApiUsageLog
{
    public long Id { get; set; }

    public int CustomerId { get; set; }

    public int ApiDefinitionId { get; set; }

    public int CallCount { get; set; }

    public DateTime RecordedDate { get; set; }

    public DateTime BillingPeriodStart { get; set; }

    public DateTime BillingPeriodEnd { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual Customer Customer { get; set; } = null!;

    public virtual ApiDefinition ApiDefinition { get; set; } = null!;
}
