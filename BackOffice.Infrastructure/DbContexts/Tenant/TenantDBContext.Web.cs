#nullable enable
using BackOffice.Domain.Entities.Tenant;
using Microsoft.EntityFrameworkCore;

namespace BackOffice.Infrastructure.DBContext.Tenant;

/// <summary>
/// Partial-class extension that registers the new Web* tenant entities
/// (WebUser, WebUsersStore, WebUsersView, WebUsersStoreView).
///
/// These are exact duplicates of the legacy User / UsersStore / UsersView /
/// UsersStoreView entities, mapped to the parallel Web* tables. The legacy
/// entities remain registered in the auto-generated TenantDBContext.cs and
/// continue to map to the original tables, so the desktop POS is unaffected.
///
/// Entry point <see cref="ConfigureWebEntities"/> is called from
/// TenantDBContext.Custom.cs's <c>OnModelCreatingPartial</c>.
/// </summary>
public partial class TenantDBContext
{
    public virtual DbSet<WebUser> WebUsers { get; set; }

    public virtual DbSet<WebUsersStore> WebUsersStores { get; set; }

    public virtual DbSet<WebUsersView> WebUsersViews { get; set; }

    public virtual DbSet<WebUsersStoreView> WebUsersStoreViews { get; set; }

    internal void ConfigureWebEntities(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<WebUser>(entity =>
        {
            entity.ToTable("WebUsers", tb =>
            {
                tb.HasTrigger("Tr_DeletetWebUser");
            });

            entity.HasKey(e => e.UserId);

            entity.HasIndex(e => e.UserName, "idx_WebUserName")
                .IsUnique()
                .HasFilter("([Status]>(-1))")
                .HasFillFactor(100);

            entity.Property(e => e.UserId).ValueGeneratedNever();

            entity.Property(e => e.Address)
                .HasMaxLength(4000)
                .UseCollation("Latin1_General_CI_AS");
            entity.Property(e => e.DateCreated).HasColumnType("datetime");
            entity.Property(e => e.DateModified).HasColumnType("datetime");
            entity.Property(e => e.Email)
                .HasMaxLength(50)
                .UseCollation("Latin1_General_CI_AS");
            entity.Property(e => e.Fax)
                .HasMaxLength(50)
                .UseCollation("Latin1_General_CI_AS");
            entity.Property(e => e.HomePhoneNumber)
                .HasMaxLength(50)
                .UseCollation("Latin1_General_CI_AS");
            entity.Property(e => e.IsLogIn).HasDefaultValue(false);
            entity.Property(e => e.Password)
                .HasMaxLength(50)
                .UseCollation("Latin1_General_CI_AS");
            entity.Property(e => e.PasswordHash).HasMaxLength(255);
            entity.Property(e => e.ScanID)
                .HasMaxLength(20)
                .UseCollation("Latin1_General_CI_AS");
            entity.Property(e => e.UserFName)
                .HasMaxLength(50)
                .UseCollation("Latin1_General_CI_AS");
            entity.Property(e => e.UserLName)
                .HasMaxLength(50)
                .UseCollation("Latin1_General_CI_AS");
            entity.Property(e => e.UserName).HasMaxLength(50);
            entity.Property(e => e.WorkPhoneNumber)
                .HasMaxLength(50)
                .UseCollation("Latin1_General_CI_AS");
            entity.Property(e => e.ZipCode)
                .HasMaxLength(50)
                .UseCollation("Latin1_General_CI_AS");
        });

        modelBuilder.Entity<WebUsersStore>(entity =>
        {
            entity.ToTable("WebUsersStore");
            entity.HasKey(e => e.UserStoreID);

            entity.Property(e => e.UserStoreID).ValueGeneratedNever();
            entity.Property(e => e.DateCreated).HasColumnType("datetime");
            entity.Property(e => e.DateModified).HasColumnType("datetime");
            entity.Property(e => e.LogonDate).HasColumnType("datetime");

            entity.HasOne(d => d.WebUser)
                .WithMany(p => p.WebUsersStores)
                .HasForeignKey(d => d.UserID)
                .HasConstraintName("FK_WebUsersStore_WebUsers");
        });

        modelBuilder.Entity<WebUsersView>(entity =>
        {
            entity.HasNoKey().ToView("WebUsersView");

            entity.Property(e => e.Address).HasMaxLength(4000);
            entity.Property(e => e.DateCreated).HasColumnType("datetime");
            entity.Property(e => e.DateModified).HasColumnType("datetime");
            entity.Property(e => e.Email).HasMaxLength(50);
            entity.Property(e => e.Fax).HasMaxLength(50);
            entity.Property(e => e.GroupName).HasMaxLength(50);
            entity.Property(e => e.HomePhoneNumber).HasMaxLength(50);
            entity.Property(e => e.Password).HasMaxLength(50);
            entity.Property(e => e.ScanID).HasMaxLength(20);
            entity.Property(e => e.StoreName).HasMaxLength(50);
            entity.Property(e => e.UserFName).HasMaxLength(50);
            entity.Property(e => e.UserLName).HasMaxLength(50);
            entity.Property(e => e.UserName).HasMaxLength(50);
            entity.Property(e => e.UserStoreDateM).HasColumnType("datetime");
            entity.Property(e => e.WorkPhoneNumber).HasMaxLength(50);
            entity.Property(e => e.ZipCode).HasMaxLength(50);
        });

        modelBuilder.Entity<WebUsersStoreView>(entity =>
        {
            entity.HasNoKey().ToView("WebUsersStoreView");

            entity.Property(e => e.DateCreated).HasColumnType("datetime");
            entity.Property(e => e.DateModified).HasColumnType("datetime");
            entity.Property(e => e.LogonDate).HasColumnType("datetime");
            entity.Property(e => e.NAME).HasMaxLength(101);
            entity.Property(e => e.UserName).HasMaxLength(50);
        });
    }
}
