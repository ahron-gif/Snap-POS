#nullable enable
using System;

namespace BackOffice.Application.DTOs.AuditLog;

public class AuditLogDetailDto
{
    public long Id { get; set; }
    public int? UserId { get; set; }
    public string Action { get; set; } = null!;
    public string EntityType { get; set; } = null!;
    public string? EntityId { get; set; }
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string? ChangedFields { get; set; }
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; }
}
