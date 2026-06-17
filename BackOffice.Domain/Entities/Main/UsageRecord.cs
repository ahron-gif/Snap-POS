#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class UsageRecord
{
    public long Id { get; set; }

    public int CustomerId { get; set; }

    public int? AppId { get; set; }

    public string MetricType { get; set; } = null!;

    public int Count { get; set; }

    public DateTime RecordedDate { get; set; }

    public DateTime RecordedAt { get; set; }

    public virtual Customer Customer { get; set; } = null!;
}
