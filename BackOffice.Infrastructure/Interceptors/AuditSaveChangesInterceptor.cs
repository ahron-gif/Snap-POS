#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using BackOffice.Domain.Attributes;
using BackOffice.Domain.Entities.Main;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Main;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace BackOffice.Infrastructure.Interceptors;

public class AuditSaveChangesInterceptor : SaveChangesInterceptor
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        WriteIndented = false,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public AuditSaveChangesInterceptor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        if (eventData.Context is not null)
            ProcessAuditEntries(eventData.Context);

        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context is not null)
            ProcessAuditEntries(eventData.Context);

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void ProcessAuditEntries(DbContext context)
    {
        context.ChangeTracker.DetectChanges();

        var entries = context.ChangeTracker.Entries()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .Where(e => !IsNotAudited(e))
            .ToList();

        if (entries.Count == 0)
            return;

        var userId = GetCurrentUserId();
        var ipAddress = GetCurrentIpAddress();
        var tenantId = GetCurrentTenantId();
        var utcNow = DateTime.UtcNow;

        foreach (var entry in entries)
        {
            var auditAction = entry.State switch
            {
                EntityState.Added => "Create",
                EntityState.Modified => "Update",
                EntityState.Deleted => "Delete",
                _ => null
            };

            if (auditAction is null)
                continue;

            var entityType = entry.Entity.GetType().Name;
            var entityId = GetPrimaryKeyValue(entry);
            string? oldValue = null;
            string? newValue = null;
            string? changedFields = null;

            switch (entry.State)
            {
                case EntityState.Added:
                    newValue = SerializeProperties(entry, useOriginal: false);
                    changedFields = string.Join(",", entry.Properties.Select(p => p.Metadata.Name));
                    break;

                case EntityState.Modified:
                    var modifiedProps = entry.Properties
                        .Where(p => p.IsModified)
                        .ToList();

                    if (modifiedProps.Count == 0)
                        continue;

                    oldValue = SerializeModifiedProperties(modifiedProps, useOriginal: true);
                    newValue = SerializeModifiedProperties(modifiedProps, useOriginal: false);
                    changedFields = string.Join(",", modifiedProps.Select(p => p.Metadata.Name));
                    break;

                case EntityState.Deleted:
                    oldValue = SerializeProperties(entry, useOriginal: true);
                    break;
            }

            if (context is MainDBContext)
            {
                context.Set<MasterAuditLog>().Add(new MasterAuditLog
                {
                    UserId = userId,
                    TenantId = tenantId,
                    Action = auditAction,
                    EntityType = entityType,
                    EntityId = entityId,
                    OldValue = oldValue,
                    NewValue = newValue,
                    ChangedFields = changedFields,
                    IpAddress = ipAddress,
                    CreatedAt = utcNow
                });
            }
            else if (context is TenantDBContext)
            {
                context.Set<AuditLog>().Add(new AuditLog
                {
                    UserId = userId,
                    Action = auditAction,
                    EntityType = entityType,
                    EntityId = entityId,
                    OldValue = oldValue,
                    NewValue = newValue,
                    ChangedFields = changedFields,
                    IpAddress = ipAddress,
                    CreatedAt = utcNow
                });
            }
        }
    }

    private static bool IsNotAudited(EntityEntry entry)
    {
        return entry.Entity.GetType().GetCustomAttribute<NotAuditedAttribute>() is not null;
    }

    private static string? GetPrimaryKeyValue(EntityEntry entry)
    {
        var keyProperties = entry.Properties
            .Where(p => p.Metadata.IsPrimaryKey())
            .ToList();

        if (keyProperties.Count == 0)
            return null;

        if (keyProperties.Count == 1)
            return keyProperties[0].CurrentValue?.ToString();

        return string.Join(",", keyProperties.Select(p => p.CurrentValue?.ToString() ?? "null"));
    }

    private static string? SerializeProperties(EntityEntry entry, bool useOriginal)
    {
        try
        {
            var dict = new Dictionary<string, object?>();
            foreach (var prop in entry.Properties)
            {
                var value = useOriginal ? prop.OriginalValue : prop.CurrentValue;
                dict[prop.Metadata.Name] = ConvertValue(value);
            }
            return JsonSerializer.Serialize(dict, SerializerOptions);
        }
        catch
        {
            return "[Serialization Error]";
        }
    }

    private static string? SerializeModifiedProperties(List<PropertyEntry> properties, bool useOriginal)
    {
        try
        {
            var dict = new Dictionary<string, object?>();
            foreach (var prop in properties)
            {
                var value = useOriginal ? prop.OriginalValue : prop.CurrentValue;
                dict[prop.Metadata.Name] = ConvertValue(value);
            }
            return JsonSerializer.Serialize(dict, SerializerOptions);
        }
        catch
        {
            return "[Serialization Error]";
        }
    }

    private static object? ConvertValue(object? value)
    {
        if (value is null)
            return null;

        if (value is DateTime dt)
            return dt.ToString("O");

        if (value is DateTimeOffset dto)
            return dto.ToString("O");

        if (value is byte[] bytes)
            return Convert.ToBase64String(bytes);

        if (value is Guid guid)
            return guid.ToString();

        return value;
    }

    private int? GetCurrentUserId()
    {
        var claim = _httpContextAccessor.HttpContext?.User?.FindFirst("UserId")?.Value;
        return int.TryParse(claim, out var userId) ? userId : null;
    }

    private int? GetCurrentTenantId()
    {
        var claim = _httpContextAccessor.HttpContext?.User?.FindFirst("CustomerId")?.Value;
        return int.TryParse(claim, out var tenantId) ? tenantId : null;
    }

    private string? GetCurrentIpAddress()
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext is null)
            return null;

        var forwardedFor = httpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
            return forwardedFor.Split(',')[0].Trim();

        return httpContext.Connection.RemoteIpAddress?.ToString();
    }
}
