#nullable enable
using BackOffice.Domain.Entities.Main;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Infrastructure.DBContext.Main
{
    public partial class MainDBContext
    {
        public virtual DbSet<DefaultGridColumnAccess> DefaultGridColumnAccess { get; set; }

        internal void ConfigureDefaultGridColumnAccess(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<DefaultGridColumnAccess>(entity =>
            {
                entity.ToTable("DefaultGridColumnAccess");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).ValueGeneratedOnAdd();

                entity.Property(e => e.GridId).IsRequired().HasMaxLength(100);
                entity.Property(e => e.Field).IsRequired().HasMaxLength(100);
                entity.Property(e => e.AllowedToView).HasDefaultValue(true);
                entity.Property(e => e.DisplayName).HasMaxLength(100);
                entity.Property(e => e.AggregateType).HasMaxLength(50);
                entity.Property(e => e.DateCreated).HasDefaultValueSql("GETDATE()");
                entity.Property(e => e.DateModified).HasDefaultValueSql("GETDATE()");

                entity.HasIndex(e => new { e.GridId, e.Field })
                    .IsUnique()
                    .HasDatabaseName("IX_DefaultGridColumnAccess_GridId_Field");
            });
        }
    }
}
