#nullable enable
using System;

namespace BackOffice.Application.DTOs.AuditLog;

public class AuditLogFilterDto : PaginationGridDto
{
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public string? Action { get; set; }
    public int? UserId { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
}
