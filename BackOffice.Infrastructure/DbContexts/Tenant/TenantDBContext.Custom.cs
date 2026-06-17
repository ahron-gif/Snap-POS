#nullable enable
using BackOffice.Domain.Entities.Tenant;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Infrastructure.DBContext.Tenant;

/// <summary>
/// Custom partial class for TenantDBContext to add custom entities that are not auto-generated
/// </summary>
public partial class TenantDBContext
{
    /// <summary>
    /// User-specific grid column settings (visibility, width, order)
    /// </summary>
    public virtual DbSet<UserGridSettings> UserGridSettings { get; set; }

    /// <summary>
    /// User-specific preferences (session state, workspace, etc.)
    /// </summary>
    public virtual DbSet<UserPreference> UserPreferences { get; set; }

    /// <summary>
    /// Super-Admin-managed per-user column access rules for grids.
    /// </summary>
    public virtual DbSet<UserGridColumnAccess> UserGridColumnAccess { get; set; }

    /// <summary>
    /// Label templates for printing item labels, shelf tags, etc.
    /// </summary>
    public virtual DbSet<LabelTemplate> LabelTemplates { get; set; }

    public virtual DbSet<AuditLog> AuditLogs { get; set; }

    /// <summary>
    /// Tenant-defined named date-range presets (Reports → Setup → Custom Date Scope).
    /// </summary>
    public virtual DbSet<CustomDateScope> CustomDateScopes { get; set; }

    /// <summary>
    /// Configure custom entities in OnModelCreating
    /// </summary>
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        // Configure UserGridSettings entity
        modelBuilder.Entity<UserGridSettings>(entity =>
        {
            entity.ToTable("UserGridSettings");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.UserId)
                .IsRequired();

            entity.Property(e => e.GridId)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(e => e.SettingsJson)
                .IsRequired();

            entity.Property(e => e.DateCreated)
                .HasDefaultValueSql("GETDATE()");

            entity.Property(e => e.DateModified)
                .HasDefaultValueSql("GETDATE()");

            // Create unique index on UserId + GridId
            entity.HasIndex(e => new { e.UserId, e.GridId })
                .IsUnique()
                .HasDatabaseName("IX_UserGridSettings_UserId_GridId");
        });

        // Configure UserGridColumnAccess entity
        modelBuilder.Entity<UserGridColumnAccess>(entity =>
        {
            entity.ToTable("UserGridColumnAccess");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.UserId)
                .IsRequired();

            entity.Property(e => e.GridId)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(e => e.Field)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(e => e.AllowedToView)
                .IsRequired()
                .HasDefaultValue(true);

            entity.Property(e => e.DisplayName)
                .HasMaxLength(100);

            // Width and AggregateType were added by migration
            // 20260526_AlterUserGridColumnAccess_AddWidthAndAggregate when grid
            // visibility/width/aggregate storage was unified onto this table.
            entity.Property(e => e.AggregateType)
                .HasMaxLength(50);

            entity.Property(e => e.DateCreated)
                .HasDefaultValueSql("GETDATE()");

            entity.Property(e => e.DateModified)
                .HasDefaultValueSql("GETDATE()");

            // Create unique index on (UserId, GridId, Field) to ensure one rule per column per user per grid
            entity.HasIndex(e => new { e.UserId, e.GridId, e.Field })
                .IsUnique()
                .HasDatabaseName("IX_UserGridColumnAccess_UserId_GridId_Field");
        });

        // Configure LabelTemplate entity
        modelBuilder.Entity<LabelTemplate>(entity =>
        {
            entity.ToTable("LabelTemplates");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.Name)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(e => e.Description)
                .HasMaxLength(500);

            entity.Property(e => e.LabelType)
                .IsRequired();

            entity.Property(e => e.PaperSize)
                .IsRequired();

            entity.Property(e => e.LabelWidth)
                .HasColumnType("decimal(10,4)")
                .IsRequired();

            entity.Property(e => e.LabelHeight)
                .HasColumnType("decimal(10,4)")
                .IsRequired();

            entity.Property(e => e.ColumnsPerPage)
                .IsRequired()
                .HasDefaultValue(1);

            entity.Property(e => e.RowsPerPage)
                .IsRequired()
                .HasDefaultValue(1);

            entity.Property(e => e.MarginLeft)
                .HasColumnType("decimal(10,4)")
                .HasDefaultValue(0m);

            entity.Property(e => e.MarginTop)
                .HasColumnType("decimal(10,4)")
                .HasDefaultValue(0m);

            entity.Property(e => e.HorizontalGap)
                .HasColumnType("decimal(10,4)")
                .HasDefaultValue(0m);

            entity.Property(e => e.VerticalGap)
                .HasColumnType("decimal(10,4)")
                .HasDefaultValue(0m);

            entity.Property(e => e.DesignJson)
                .IsRequired();

            entity.Property(e => e.IsDefault)
                .HasDefaultValue(false);

            entity.Property(e => e.Status)
                .HasDefaultValue((short)0);

            entity.Property(e => e.DateCreated)
                .HasDefaultValueSql("GETDATE()");

            entity.Property(e => e.DateModified)
                .HasDefaultValueSql("GETDATE()");

            // Index for faster lookups
            entity.HasIndex(e => new { e.StoreId, e.LabelType, e.Status })
                .HasDatabaseName("IX_LabelTemplates_StoreId_LabelType_Status");

            entity.HasIndex(e => e.Name)
                .HasDatabaseName("IX_LabelTemplates_Name");
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("AuditLogs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).UseIdentityColumn();

            entity.Property(e => e.Action).IsRequired().HasMaxLength(50);
            entity.Property(e => e.EntityType).IsRequired().HasMaxLength(200);
            entity.Property(e => e.EntityId).HasMaxLength(100);
            entity.Property(e => e.OldValue).HasColumnType("nvarchar(max)");
            entity.Property(e => e.NewValue).HasColumnType("nvarchar(max)");
            entity.Property(e => e.ChangedFields).HasMaxLength(4000);
            entity.Property(e => e.IpAddress).HasMaxLength(50);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(e => e.CreatedAt)
                .HasDatabaseName("IX_AuditLogs_CreatedAt");

            entity.HasIndex(e => new { e.EntityType, e.EntityId })
                .HasDatabaseName("IX_AuditLogs_EntityType_EntityId");

            entity.HasIndex(e => e.UserId)
                .HasDatabaseName("IX_AuditLogs_UserId");
        });

        // Configure UserPreference entity
        modelBuilder.Entity<UserPreference>(entity =>
        {
            entity.ToTable("UserPreferences");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();

            entity.Property(e => e.UserId)
                .IsRequired();

            entity.Property(e => e.PreferenceKey)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(e => e.PreferenceValue)
                .IsRequired();

            entity.Property(e => e.DateCreated)
                .HasDefaultValueSql("GETDATE()");

            entity.Property(e => e.DateModified)
                .HasDefaultValueSql("GETDATE()");

            // Create unique index on UserId + PreferenceKey
            entity.HasIndex(e => new { e.UserId, e.PreferenceKey })
                .IsUnique()
                .HasDatabaseName("IX_UserPreferences_UserId_PreferenceKey");
        });

        // Configure CustomDateScope entity
        modelBuilder.Entity<CustomDateScope>(entity =>
        {
            entity.ToTable("CustomDateScope");
            entity.HasKey(e => e.CustomDateScopeID);

            entity.Property(e => e.CustomDateScopeID)
                .HasDefaultValueSql("(newid())");

            entity.Property(e => e.Name)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(e => e.Description)
                .HasMaxLength(500);

            entity.Property(e => e.FromDate)
                .HasColumnType("date");

            entity.Property(e => e.ToDate)
                .HasColumnType("date");

            entity.Property(e => e.SortColumn)
                .HasMaxLength(100);

            entity.Property(e => e.SortDirection)
                .HasMaxLength(4);

            entity.Property(e => e.IsActive)
                .HasDefaultValue(true);

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("SYSUTCDATETIME()");

            entity.HasIndex(e => e.IsActive)
                .HasDatabaseName("IX_CustomDateScope_IsActive");
        });

        // Configure RBAC Phase 2 entities (defined in TenantDBContext.Rbac.cs)
        ConfigureRbacEntities(modelBuilder);

        // Configure Chatbot entities (defined in TenantDBContext.Chat.cs)
        ConfigureChatEntities(modelBuilder);

        // Configure Web* duplicate entities (defined in TenantDBContext.Web.cs)
        ConfigureWebEntities(modelBuilder);
    }
}
