#nullable enable
using BackOffice.Domain.Entities.Tenant;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Infrastructure.DBContext.Tenant;

/// <summary>
/// RBAC Phase 2: Partial class extension for TenantDBContext.
/// Adds DbSets for the new RBAC entities.
///
/// IMPORTANT: Table names use "Rbac" prefix to avoid collision with legacy
/// TenantRole / TenantRolePermission entities already in TenantDBContext.cs.
/// </summary>
public partial class TenantDBContext
{
    public virtual DbSet<RbacTenantRole> RbacTenantRoles { get; set; }
    public virtual DbSet<RbacTenantUserRole> RbacTenantUserRoles { get; set; }
    public virtual DbSet<RbacTenantRolePermission> RbacTenantRolePermissions { get; set; }
    public virtual DbSet<RbacTenantUserPermOverride> RbacTenantUserPermOverrides { get; set; }
    public virtual DbSet<RbacTenantConfigEntry> RbacTenantConfigEntries { get; set; }
    public virtual DbSet<RbacTenantAuditLogEntry> RbacTenantAuditLogEntries { get; set; }

    /// <summary>
    /// Configures EF Core model for all RBAC entities.
    /// Called from OnModelCreatingPartial in TenantDBContext.Custom.cs.
    /// </summary>
    internal void ConfigureRbacEntities(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RbacTenantRole>(entity =>
        {
            entity.ToTable("RbacTenantRoles");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).UseIdentityColumn();

            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Code).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.IsSystemRole).HasDefaultValue(false);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(e => e.Code)
                .IsUnique()
                .HasDatabaseName("IX_RbacTenantRoles_Code");

            entity.HasIndex(e => e.IsActive)
                .HasDatabaseName("IX_RbacTenantRoles_IsActive");
        });

        modelBuilder.Entity<RbacTenantUserRole>(entity =>
        {
            entity.ToTable("RbacTenantUserRoles");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).UseIdentityColumn();

            entity.Property(e => e.UserId).IsRequired();
            entity.Property(e => e.RoleId).IsRequired();
            entity.Property(e => e.AssignedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(e => new { e.UserId, e.RoleId })
                .IsUnique()
                .HasDatabaseName("UQ_RbacTUR_User_Role");

            entity.HasOne(e => e.Role)
                .WithMany(r => r.UserRoles)
                .HasForeignKey(e => e.RoleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RbacTenantRolePermission>(entity =>
        {
            entity.ToTable("RbacTenantRolePermissions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).UseIdentityColumn();

            entity.Property(e => e.RoleId).IsRequired();
            entity.Property(e => e.PermissionKey).IsRequired().HasMaxLength(150);
            entity.Property(e => e.IsGranted).HasDefaultValue(true);

            entity.HasIndex(e => new { e.RoleId, e.PermissionKey })
                .IsUnique()
                .HasDatabaseName("UQ_RbacTRP_Role_Permission");

            entity.HasOne(e => e.Role)
                .WithMany(r => r.RolePermissions)
                .HasForeignKey(e => e.RoleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RbacTenantUserPermOverride>(entity =>
        {
            entity.ToTable("RbacTenantUserPermOverrides");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).UseIdentityColumn();

            entity.Property(e => e.UserId).IsRequired();
            entity.Property(e => e.PermissionKey).IsRequired().HasMaxLength(150);
            entity.Property(e => e.IsGranted).IsRequired();
            entity.Property(e => e.Reason).HasMaxLength(500);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(e => new { e.UserId, e.PermissionKey })
                .IsUnique()
                .HasDatabaseName("UQ_RbacTUPO_User_Permission");

            entity.HasIndex(e => e.ExpiresAt)
                .HasDatabaseName("IX_RbacTUPO_ExpiresAt");
        });

        modelBuilder.Entity<RbacTenantConfigEntry>(entity =>
        {
            entity.ToTable("RbacTenantConfigs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).UseIdentityColumn();

            entity.Property(e => e.ConfigKey).IsRequired().HasMaxLength(100);
            entity.Property(e => e.ConfigValue).HasColumnType("nvarchar(max)");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(e => e.ConfigKey)
                .IsUnique()
                .HasDatabaseName("IX_RbacTenantConfigs_Key");
        });

        modelBuilder.Entity<RbacTenantAuditLogEntry>(entity =>
        {
            entity.ToTable("RbacTenantAuditLogs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).UseIdentityColumn();

            entity.Property(e => e.Action).IsRequired().HasMaxLength(50);
            entity.Property(e => e.EntityType).HasMaxLength(100);
            entity.Property(e => e.EntityId).HasMaxLength(50);
            entity.Property(e => e.OldValue).HasColumnType("nvarchar(max)");
            entity.Property(e => e.NewValue).HasColumnType("nvarchar(max)");
            entity.Property(e => e.IpAddress).HasMaxLength(50);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(e => e.UserId)
                .HasDatabaseName("IX_RbacTenantAudit_UserId");

            entity.HasIndex(e => e.CreatedAt)
                .HasDatabaseName("IX_RbacTenantAudit_CreatedAt");

            entity.HasIndex(e => new { e.EntityType, e.EntityId })
                .HasDatabaseName("IX_RbacTenantAudit_EntityType");
        });
    }
}
