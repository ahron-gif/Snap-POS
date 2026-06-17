using System;
using System.Collections.Generic;

namespace SmartKartReg.Infrastructure.Entities;

public partial class FreshDeskModel
{
    public int Id { get; set; }

    public bool? FrEscalated { get; set; }

    public bool? Spam { get; set; }

    public long? EmailConfigId { get; set; }

    public int? GroupId { get; set; }

    public int? Priority { get; set; }

    public long? RequesterId { get; set; }

    public long? ResponderId { get; set; }

    public int? Source { get; set; }

    public int? CompanyId { get; set; }

    public int? Status { get; set; }

    public string? Subject { get; set; }

    public string? AssociationType { get; set; }

    public string? SupportEmail { get; set; }

    public long? ProductId { get; set; }

    public string? Type { get; set; }

    public DateTime? DueBy { get; set; }

    public DateTime? FrDueBy { get; set; }

    public bool? IsEscalated { get; set; }

    public string? Description { get; set; }

    public string? DescriptionText { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public int? AssociatedTicketsCount { get; set; }

    public DateTime? NrDueBy { get; set; }

    public bool? NrEscalated { get; set; }
}
