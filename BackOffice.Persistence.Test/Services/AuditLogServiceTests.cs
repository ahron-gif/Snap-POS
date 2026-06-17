#nullable enable
using System;
using BackOffice.Application.DTOs.AuditLog;
using Task = System.Threading.Tasks.Task;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using BackOffice.Persistence.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace BackOffice.Persistence.Test.Services;

public class AuditLogServiceTests
{
    private static TenantDBContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<TenantDBContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new TenantDBContext(options);
    }

    private static AuditLogService CreateService(TenantDBContext context)
    {
        var logger = new Mock<ILogger<AuditLogService>>();
        return new AuditLogService(context, logger.Object);
    }

    private static async Task SeedAuditLogs(TenantDBContext context)
    {
        context.AuditLogs.AddRange(
            new AuditLog { Action = "Create", EntityType = "Item", EntityId = "1", CreatedAt = DateTime.UtcNow.AddHours(-3) },
            new AuditLog { Action = "Update", EntityType = "Item", EntityId = "1", ChangedFields = "Name,Price", CreatedAt = DateTime.UtcNow.AddHours(-2) },
            new AuditLog { Action = "Delete", EntityType = "Item", EntityId = "1", CreatedAt = DateTime.UtcNow.AddHours(-1) },
            new AuditLog { Action = "Create", EntityType = "Customer", EntityId = "5", CreatedAt = DateTime.UtcNow }
        );
        await context.SaveChangesAsync();
    }

    [Fact]
    public async Task GetAuditLogs_ShouldReturnPaginatedResults_WhenDataExists()
    {
        // Arrange
        using var context = CreateContext();
        await SeedAuditLogs(context);
        var service = CreateService(context);

        var filter = new AuditLogFilterDto { StartRow = 0, EndRow = 10 };

        // Act
        var result = service.GetAuditLogs(filter);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Response);
        Assert.Equal(4, result.Response!.TotalRecords);
        Assert.Equal(4, result.Response.Data!.Count);
    }

    [Fact]
    public async Task GetAuditLogs_ShouldFilterByEntityType_WhenEntityTypeProvided()
    {
        // Arrange
        using var context = CreateContext();
        await SeedAuditLogs(context);
        var service = CreateService(context);

        var filter = new AuditLogFilterDto { StartRow = 0, EndRow = 10, EntityType = "Customer" };

        // Act
        var result = service.GetAuditLogs(filter);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Response!.Data!);
        Assert.Equal("Customer", result.Response.Data![0].EntityType);
    }

    [Fact]
    public async Task GetEntityHistoryAsync_ShouldReturnAllEntries_ForGivenEntity()
    {
        // Arrange
        using var context = CreateContext();
        await SeedAuditLogs(context);
        var service = CreateService(context);

        // Act
        var result = await service.GetEntityHistoryAsync("Item", "1");

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Response!.Count);
        Assert.All(result.Response, e => Assert.Equal("Item", e.EntityType));
    }

    [Fact]
    public async Task GetAuditLogByIdAsync_ShouldReturnDetail_WhenExists()
    {
        // Arrange
        using var context = CreateContext();
        context.AuditLogs.Add(new AuditLog
        {
            Action = "Create",
            EntityType = "Vendor",
            EntityId = "10",
            NewValue = "{\"Name\":\"Test\"}",
            IpAddress = "10.0.0.1",
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();
        var service = CreateService(context);

        var entry = await context.AuditLogs.FirstAsync();

        // Act
        var result = await service.GetAuditLogByIdAsync(entry.Id);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal("Vendor", result.Response!.EntityType);
        Assert.Equal("{\"Name\":\"Test\"}", result.Response.NewValue);
        Assert.Equal("10.0.0.1", result.Response.IpAddress);
    }

    [Fact]
    public async Task GetAuditLogByIdAsync_ShouldReturnNotFound_WhenDoesNotExist()
    {
        // Arrange
        using var context = CreateContext();
        var service = CreateService(context);

        // Act
        var result = await service.GetAuditLogByIdAsync(99999);

        // Assert
        Assert.False(result.IsSuccess);
    }

    [Fact]
    public async Task GetAuditLogs_ShouldFilterByAction_WhenActionProvided()
    {
        // Arrange
        using var context = CreateContext();
        await SeedAuditLogs(context);
        var service = CreateService(context);

        var filter = new AuditLogFilterDto { StartRow = 0, EndRow = 10, Action = "Update" };

        // Act
        var result = service.GetAuditLogs(filter);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Single(result.Response!.Data!);
        Assert.Equal("Update", result.Response.Data![0].Action);
    }

    [Fact]
    public async Task GetEntityHistoryAsync_ShouldReturnEmpty_WhenNoMatchingEntity()
    {
        // Arrange
        using var context = CreateContext();
        await SeedAuditLogs(context);
        var service = CreateService(context);

        // Act
        var result = await service.GetEntityHistoryAsync("NonExistent", "999");

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Empty(result.Response!);
    }
}
