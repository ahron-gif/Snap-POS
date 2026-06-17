// Partial class extension — configures Environment Access entities.
// Keeps environment-related EF config out of the auto-generated main file.
#nullable enable
using BackOffice.Domain.Entities.Main;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Infrastructure.DBContext.Main;

public partial class MainDBContext
{
    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        // ── AppEnvironment ────────────────────────────────────────────────────
        modelBuilder.Entity<AppEnvironment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.ToTable("Environments");

            entity.Property(e => e.Id)
                  .HasDefaultValueSql("NEWSEQUENTIALID()");

            entity.Property(e => e.Name)
                  .HasMaxLength(100)
                  .IsRequired();

            entity.Property(e => e.Code)
                  .HasMaxLength(20)
                  .IsRequired();

            entity.Property(e => e.IsActive)
                  .HasDefaultValue(true);

            entity.Property(e => e.CreatedAt)
                  .HasDefaultValueSql("SYSUTCDATETIME()");

            entity.Property(e => e.UpdatedAt)
                  .HasDefaultValueSql("SYSUTCDATETIME()");

            entity.HasIndex(e => e.Code)
                  .IsUnique()
                  .HasDatabaseName("UQ_Environments_Code");
        });

        // ── UserEnvironment ───────────────────────────────────────────────────
        modelBuilder.Entity<UserEnvironment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.ToTable("UserEnvironments");

            entity.Property(e => e.Id)
                  .HasDefaultValueSql("NEWSEQUENTIALID()");

            entity.Property(e => e.CreatedAt)
                  .HasDefaultValueSql("SYSUTCDATETIME()");

            // Unique constraint: one row per (user, environment, customer)
            entity.HasIndex(e => new { e.UserId, e.EnvironmentId, e.CustomerId })
                  .IsUnique()
                  .HasDatabaseName("UQ_UserEnvironments_User_Env_Customer");

            entity.HasIndex(e => e.UserId)
                  .HasDatabaseName("IX_UserEnvironments_UserId");

            // FK → AppUser
            entity.HasOne(e => e.User)
                  .WithMany()
                  .HasForeignKey(e => e.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            // FK → AppEnvironment
            entity.HasOne(e => e.Environment)
                  .WithMany(env => env.UserEnvironments)
                  .HasForeignKey(e => e.EnvironmentId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ── AppUser – HasWebAccess ────────────────────────────────────────────
        // The AppUser entity maps to the [AppUsers] table (EF plural convention).
        // We extend the existing entity config here to register the new column default.
        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.Property(e => e.HasWebAccess)
                  .HasDefaultValue(true)
                  .HasColumnName("HasWebAccess");
        });

        // ── Chatbot Settings (defined in MainDBContext.Chat.cs) ──────────────
        ConfigureChatbotSettings(modelBuilder);

        // ── Default Grid Column Access (defined in MainDBContext.GridColumnAccess.cs) ──
        ConfigureDefaultGridColumnAccess(modelBuilder);
    }
}
