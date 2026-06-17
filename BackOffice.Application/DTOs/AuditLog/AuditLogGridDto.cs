#nullable enable
using System;

namespace BackOffice.Application.DTOs.AuditLog;

public class AuditLogGridDto
{
    public long Id { get; set; }
    public int? UserId { get; set; }
    public string Action { get; set; } = null!;
    public string EntityType { get; set; } = null!;
    public string? EntityId { get; set; }
    public string? ChangedFields { get; set; }
    public DateTime CreatedAt { get; set; }
}
