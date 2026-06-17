using System;
using System.Collections.Generic;

namespace SmartKartReg.Infrastructure.Entities;

public partial class FreshDeskTicket
{
    public int Id { get; set; }

    public string? Subject { get; set; }

    public string? DescriptionText { get; set; }

    public int? Status { get; set; }

    public int? Priority { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
