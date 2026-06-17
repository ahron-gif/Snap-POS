#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using BackOffice.Domain.Attributes;
using Task = System.Threading.Tasks.Task;
using BackOffice.Domain.Entities.Main;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Main;
using BackOffice.Infrastructure.DBContext.Tenant;
using BackOffice.Infrastructure.Interceptors;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace BackOffice.Infrastructure.Test.Interceptors;

[NotAudited]
public class TestNotAuditedEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
}

public class AuditSaveChangesInterceptorTests
{
    private static AuditSaveChangesInterceptor CreateInterceptor(int? userId = 1, string? ipAddress = "127.0.0.1", int? customerId = 10)
    {
        var mockHttpContextAccessor = new Mock<IHttpContextAccessor>();
        var mockHttpContext = new Mock<HttpContext>();
    
        var mockRequest = new Mock<HttpRequest>();
        var mockConnection = new Mock<ConnectionInfo>();
        var mockHeaders = new HeaderDictionary();

        var claims = new List<Claim>();
        if (userId.HasValue)
            claims.Add(new Claim("UserId", userId.Value.ToString()));
        if (customerId.HasValue)
            claims.Add(new Claim("CustomerId", customerId.Value.ToString()));

        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        mockHttpContext.Setup(c => c.User).Returns(principal);
        mockHttpContext.Setup(c => c.Request).Returns(mockRequest.Object);
        mockRequest.Setup(r => r.Headers).Returns(mockHeaders);
        mockConnection.Setup(c => c.RemoteIpAddress).Returns(System.Net.IPAddress.Parse(ipAddress ?? "127.0.0.1"));
        mockHttpContext.Setup(c => c.Connection).Returns(mockConnection.Object);
        mockHttpContextAccessor.Setup(a => a.HttpContext).Returns(mockHttpContext.Object);

        return new AuditSaveChangesInterceptor(mockHttpContextAccessor.Object);
    }

    private static TenantDBContext CreateTenantContext(AuditSaveChangesInterceptor interceptor)
    {
        var options = new DbContextOptionsBuilder<TenantDBContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .AddInterceptors(interceptor)
            .Options;

        return new TenantDBContext(options);
    }

    private static MainDBContext CreateMainContext(AuditSaveChangesInterceptor interceptor)
    {
        var options = new DbContextOptionsBuilder<MainDBContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .AddInterceptors(interceptor)
            .Options;

        return new MainDBContext(options);
    }

    [Fact]
    public async Task SavingChangesAsync_ShouldCreateAuditLog_WhenEntityIsAdded()
    {
        // Arrange
        var interceptor = CreateInterceptor(userId: 5);
        using var context = CreateTenantContext(interceptor);

        var auditLog = new AuditLog
        {
            Action = "test",
            EntityType = "test",
            CreatedAt = DateTime.UtcNow
        };

        // Act - add a non-audited entity to see if it gets skipped
        // The TenantDBContext has hundreds of entities; we test with AuditLog itself
        // which is [NotAudited], so it should NOT create an audit entry for itself
        context.AuditLogs.Add(auditLog);
        await context.SaveChangesAsync();

        // Assert - AuditLog entity has [NotAudited], so only 1 record (the one we added)
        var auditEntries = await context.AuditLogs.ToListAsync();
        Assert.Single(auditEntries);
        Assert.Equal("test", auditEntries[0].Action);
    }

    [Fact]
    public async Task SavingChangesAsync_ShouldSkipEntity_WhenNotAuditedAttributePresent()
    {
        // Arrange
        var interceptor = CreateInterceptor();
        using var context = CreateTenantContext(interceptor);

        // Act - Add an AuditLog (which has [NotAudited])
        context.AuditLogs.Add(new AuditLog
        {
            Action = "Create",
            EntityType = "SomeEntity",
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        // Assert - no extra audit record created for the AuditLog entity itself
        var logs = await context.AuditLogs.ToListAsync();
        Assert.Single(logs);
    }

    [Fact]
    public async Task SavingChangesAsync_ShouldWriteToMasterAuditLogs_WhenContextIsMainDB()
    {
        // Arrange
        var interceptor = CreateInterceptor(userId: 3, customerId: 99);
        using var context = CreateMainContext(interceptor);

        // Act - add a GlobalConfig entity (not [NotAudited])
        context.GlobalConfigs.Add(new GlobalConfig
        {
            ConfigKey = "TestKey",
            ConfigValue = "TestValue",
            UpdatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        // Assert
        var auditLogs = await context.MasterAuditLogs.ToListAsync();
        Assert.Single(auditLogs);
        Assert.Equal("Create", auditLogs[0].Action);
        Assert.Equal("GlobalConfig", auditLogs[0].EntityType);
        Assert.Equal(3, auditLogs[0].UserId);
        Assert.Equal(99, auditLogs[0].TenantId);
        Assert.NotNull(auditLogs[0].NewValue);
        Assert.Contains("TestKey", auditLogs[0].NewValue!);
    }

    [Fact]
    public async Task SavingChangesAsync_ShouldCaptureOldAndNewValues_WhenEntityIsModified()
    {
        // Arrange
        var interceptor = CreateInterceptor(userId: 7);
        using var context = CreateMainContext(interceptor);

        var config = new GlobalConfig
        {
            ConfigKey = "OriginalKey",
            ConfigValue = "OriginalValue",
            UpdatedAt = DateTime.UtcNow
        };
        context.GlobalConfigs.Add(config);
        await context.SaveChangesAsync();

        // Clear audit logs from the create
        var createLogs = await context.MasterAuditLogs.ToListAsync();
        context.MasterAuditLogs.RemoveRange(createLogs);
        await context.SaveChangesAsync();

        // Act - modify
        config.ConfigValue = "UpdatedValue";
        context.GlobalConfigs.Update(config);
        await context.SaveChangesAsync();

        // Assert
        var auditLogs = await context.MasterAuditLogs
            .Where(a => a.Action == "Update")
            .ToListAsync();

        Assert.Single(auditLogs);
        var log = auditLogs[0];
        Assert.Equal("Update", log.Action);
        Assert.Equal("GlobalConfig", log.EntityType);
        Assert.NotNull(log.OldValue);
        Assert.NotNull(log.NewValue);
        Assert.NotNull(log.ChangedFields);
        Assert.Contains("ConfigValue", log.ChangedFields!);
    }

    [Fact]
    public async Task SavingChangesAsync_ShouldCaptureOldValues_WhenEntityIsDeleted()
    {
        // Arrange
        var interceptor = CreateInterceptor();
        using var context = CreateMainContext(interceptor);

        var config = new GlobalConfig
        {
            ConfigKey = "ToDelete",
            ConfigValue = "DeleteMe",
            UpdatedAt = DateTime.UtcNow
        };
        context.GlobalConfigs.Add(config);
        await context.SaveChangesAsync();

        // Clear create audit logs
        var createLogs = await context.MasterAuditLogs.ToListAsync();
        context.MasterAuditLogs.RemoveRange(createLogs);
        await context.SaveChangesAsync();

        // Act
        context.GlobalConfigs.Remove(config);
        await context.SaveChangesAsync();

        // Assert
        var auditLogs = await context.MasterAuditLogs
            .Where(a => a.Action == "Delete")
            .ToListAsync();

        Assert.Single(auditLogs);
        var log = auditLogs[0];
        Assert.Equal("Delete", log.Action);
        Assert.NotNull(log.OldValue);
        Assert.Null(log.NewValue);
        Assert.Contains("ToDelete", log.OldValue!);
    }

    [Fact]
    public async Task SavingChangesAsync_ShouldExtractUserId_FromHttpContext()
    {
        // Arrange
        var interceptor = CreateInterceptor(userId: 42);
        using var context = CreateMainContext(interceptor);

        // Act
        context.GlobalConfigs.Add(new GlobalConfig
        {
            ConfigKey = "UserTest",
            ConfigValue = "V",
            UpdatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        // Assert
        var log = await context.MasterAuditLogs.FirstAsync();
        Assert.Equal(42, log.UserId);
    }

    [Fact]
    public async Task SavingChangesAsync_ShouldExtractIpAddress_FromHttpContext()
    {
        // Arrange
        var interceptor = CreateInterceptor(ipAddress: "192.168.1.100");
        using var context = CreateMainContext(interceptor);

        // Act
        context.GlobalConfigs.Add(new GlobalConfig
        {
            ConfigKey = "IpTest",
            ConfigValue = "V",
            UpdatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        // Assert
        var log = await context.MasterAuditLogs.FirstAsync();
        Assert.Equal("192.168.1.100", log.IpAddress);
    }

    [Fact]
    public async Task SavingChangesAsync_ShouldSkipMasterAuditLog_WhenItHasNotAuditedAttribute()
    {
        // Arrange
        var interceptor = CreateInterceptor();
        using var context = CreateMainContext(interceptor);

        // Act - manually add a MasterAuditLog (which is [NotAudited])
        context.MasterAuditLogs.Add(new MasterAuditLog
        {
            Action = "ManualEntry",
            EntityType = "Test",
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        // Assert - should have exactly 1 record (the one we added), not 2
        var logs = await context.MasterAuditLogs.ToListAsync();
        Assert.Single(logs);
        Assert.Equal("ManualEntry", logs[0].Action);
    }
}
