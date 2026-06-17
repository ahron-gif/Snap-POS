#nullable enable
using BackOffice.Domain.Entities.Main;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Infrastructure.DBContext.Main
{
    public partial class MainDBContext
    {
        public virtual DbSet<TenantChatbotSettings> TenantChatbotSettings { get; set; }

        internal void ConfigureChatbotSettings(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<TenantChatbotSettings>(entity =>
            {
                entity.ToTable("TenantChatbotSettings");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).UseIdentityColumn();

                entity.Property(e => e.CustomerId).IsRequired();
                entity.Property(e => e.IsEnabled).HasDefaultValue(true);
                entity.Property(e => e.DailyMessageCap).HasDefaultValue(500);
                entity.Property(e => e.ModelTier).IsRequired().HasMaxLength(20).HasDefaultValue("haiku");
                entity.Property(e => e.MonthlyTokenBudgetCents).HasDefaultValue(0L);
                entity.Property(e => e.CreatedAt).HasDefaultValueSql("SYSUTCDATETIME()");
                entity.Property(e => e.UpdatedAt).HasDefaultValueSql("SYSUTCDATETIME()");

                entity.HasIndex(e => e.CustomerId)
                    .IsUnique()
                    .HasDatabaseName("UQ_TenantChatbotSettings_CustomerId");
            });
        }
    }
}
