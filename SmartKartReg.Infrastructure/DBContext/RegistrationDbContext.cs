using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using SmartKartReg.Infrastructure.Entities;

namespace SmartKartReg.Infrastructure.DBContext;

public partial class RegistrationDbContext : DbContext
{
    public RegistrationDbContext(DbContextOptions<RegistrationDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Application> Applications { get; set; }

    public virtual DbSet<ApplicationRegistration> ApplicationRegistrations { get; set; }

    public virtual DbSet<ApplicationsMenu> ApplicationsMenus { get; set; }

    public virtual DbSet<DevicesAppSetting> DevicesAppSettings { get; set; }

    public virtual DbSet<FreshDeskModel> FreshDeskModels { get; set; }

    public virtual DbSet<FreshDeskTicket> FreshDeskTickets { get; set; }

    public virtual DbSet<License> Licenses { get; set; }

    public virtual DbSet<Permission> Permissions { get; set; }

    public virtual DbSet<Entities.Registration> Registrations { get; set; }

    public virtual DbSet<SkVersion> SkVersions { get; set; }

    public virtual DbSet<StoreAppsView> StoreAppsViews { get; set; }

    public virtual DbSet<StoreToken> StoreTokens { get; set; }

    public virtual DbSet<StoreTokensView> StoreTokensViews { get; set; }

    public virtual DbSet<TokenPermission> TokenPermissions { get; set; }

    public virtual DbSet<TokenStoreAccess> TokenStoreAccesses { get; set; }

    public virtual DbSet<VwCustomerStatus> VwCustomerStatuses { get; set; }

    public virtual DbSet<VwStoreType> VwStoreTypes { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Application>(entity =>
        {
            entity.HasKey(e => e.AppId).HasName("PK_APPRegistrations");

            entity.Property(e => e.AppId)
                .ValueGeneratedNever()
                .HasColumnName("AppID");
            entity.Property(e => e.AppName)
                .HasMaxLength(100)
                .IsUnicode(false);
        });

        modelBuilder.Entity<ApplicationRegistration>(entity =>
        {
            entity.ToTable("ApplicationRegistration");

            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("ID");
            entity.Property(e => e.Apiurl)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("APIURL");
            entity.Property(e => e.AppId).HasColumnName("AppID");
            entity.Property(e => e.RegistrationId).HasColumnName("RegistrationID");
        });

        modelBuilder.Entity<ApplicationsMenu>(entity =>
        {
            entity.Property(e => e.Id)
                .ValueGeneratedNever()
                .HasColumnName("ID");
            entity.Property(e => e.AppId).HasColumnName("AppID");
            entity.Property(e => e.Description)
                .HasMaxLength(500)
                .IsUnicode(false);
            entity.Property(e => e.MenuIcon)
                .HasMaxLength(200)
                .IsUnicode(false);
            entity.Property(e => e.MenuName)
                .HasMaxLength(200)
                .IsUnicode(false);
            entity.Property(e => e.MenuTitle)
                .HasMaxLength(200)
                .IsUnicode(false);
            entity.Property(e => e.RegistrationId).HasColumnName("RegistrationID");
        });

        modelBuilder.Entity<DevicesAppSetting>(entity =>
        {
            entity.HasNoKey();

            entity.Property(e => e.ApplicationName)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.DateCreated).HasColumnType("datetime");
            entity.Property(e => e.DateModified).HasColumnType("datetime");
            entity.Property(e => e.DeviceId)
                .HasMaxLength(200)
                .IsUnicode(false)
                .HasColumnName("DeviceID");
            entity.Property(e => e.RegisterationId)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("RegisterationID");
            entity.Property(e => e.SettingId)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("SettingID");
            entity.Property(e => e.StoreId)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("StoreID");
        });

        modelBuilder.Entity<FreshDeskModel>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__FreshDes__3214EC07A72E5899");

            entity.ToTable("FreshDeskModel");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.AssociationType)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.CreatedAt).HasColumnType("datetime");
            entity.Property(e => e.Description).HasColumnType("text");
            entity.Property(e => e.DescriptionText).HasColumnType("text");
            entity.Property(e => e.DueBy).HasColumnType("datetime");
            entity.Property(e => e.FrDueBy).HasColumnType("datetime");
            entity.Property(e => e.NrDueBy).HasColumnType("datetime");
            entity.Property(e => e.Subject)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.SupportEmail)
                .HasMaxLength(255)
                .IsUnicode(false);
            entity.Property(e => e.Type)
                .HasMaxLength(50)
                .IsUnicode(false);
            entity.Property(e => e.UpdatedAt).HasColumnType("datetime");
        });

        modelBuilder.Entity<FreshDeskTicket>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__FreshDes__3214EC07709926E6");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.CreatedAt).HasColumnType("datetime");
            entity.Property(e => e.Subject).HasMaxLength(255);
            entity.Property(e => e.UpdatedAt).HasColumnType("datetime");
        });

        modelBuilder.Entity<License>(entity =>
        {
            entity.ToTable("license");

            entity.Property(e => e.LicenseId)
                .ValueGeneratedNever()
                .HasColumnName("licenseID");
            entity.Property(e => e.ComputerId).HasColumnName("ComputerID");
            entity.Property(e => e.ComputerName).HasMaxLength(50);
            entity.Property(e => e.Description).HasMaxLength(100);
            entity.Property(e => e.LastTimeLogin).HasColumnType("datetime");
            entity.Property(e => e.LicNo).ValueGeneratedOnAdd();
            entity.Property(e => e.MacId)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("MAC_ID");
            entity.Property(e => e.RegistrationId).HasColumnName("RegistrationID");
            entity.Property(e => e.Type).HasMaxLength(50);
        });

        modelBuilder.Entity<Permission>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Permissi__3214EC273652D382");

            entity.HasIndex(e => e.PermissionKey, "UQ_Permissions_PermissionKey").IsUnique();

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.Category)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.DateCreated)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.DateModified).HasColumnType("datetime");
            entity.Property(e => e.Description)
                .HasMaxLength(500)
                .IsUnicode(false);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.ModifiedBy)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.PermissionKey)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.PermissionName)
                .HasMaxLength(250)
                .IsUnicode(false);
        });

        modelBuilder.Entity<Entities.Registration>(entity =>
        {
            entity.ToTable("Registration");

            entity.Property(e => e.RegistrationId)
                .ValueGeneratedNever()
                .HasColumnName("RegistrationID");
            entity.Property(e => e.Address).HasMaxLength(100);
            entity.Property(e => e.Apiurl)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("APIUrl");
            entity.Property(e => e.BoLic).HasColumnName("BO_Lic");
            entity.Property(e => e.CityStateZip).HasMaxLength(100);
            entity.Property(e => e.DataBaseName).HasMaxLength(100);
            entity.Property(e => e.DateCreated).HasColumnType("datetime");
            entity.Property(e => e.DateModified).HasColumnType("datetime");
            entity.Property(e => e.Email).HasMaxLength(100);
            entity.Property(e => e.Fax).HasMaxLength(50);
            entity.Property(e => e.Password).HasMaxLength(50);
            entity.Property(e => e.Phone).HasMaxLength(50);
            entity.Property(e => e.PosLic).HasColumnName("POS_lic");
            entity.Property(e => e.RegUser).HasMaxLength(100);
            entity.Property(e => e.SalesPerson).HasMaxLength(100);
            entity.Property(e => e.ServerName).HasMaxLength(200);
            entity.Property(e => e.Status).HasDefaultValue(1);
            entity.Property(e => e.StoreName).HasMaxLength(100);
            entity.Property(e => e.UserName).HasMaxLength(50);
            entity.Property(e => e.VersionId).HasColumnName("VersionID");
            entity.Property(e => e.VersionName).HasMaxLength(50);
        });

        modelBuilder.Entity<SkVersion>(entity =>
        {
            entity.HasKey(e => e.VersionId);

            entity.ToTable("Sk_Version");

            entity.Property(e => e.VersionId).HasColumnName("VersionID");
            entity.Property(e => e.DateCreated).HasColumnType("datetime");
            entity.Property(e => e.Foldername)
                .HasMaxLength(20)
                .IsUnicode(false);
            entity.Property(e => e.VersionLink)
                .HasMaxLength(400)
                .HasColumnName("versionLink");
            entity.Property(e => e.VersionName).HasMaxLength(50);
        });

        modelBuilder.Entity<StoreAppsView>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("StoreAppsView");

            entity.Property(e => e.ApplicationName)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.DataBaseName).HasMaxLength(100);
            entity.Property(e => e.IdfromAppReg).HasColumnName("IDFromAppReg");
            entity.Property(e => e.IdfromDevAppReg)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("IDFromDevAppReg");
            entity.Property(e => e.RegistrationId).HasColumnName("RegistrationID");
            entity.Property(e => e.StoreName).HasMaxLength(100);
        });

        modelBuilder.Entity<StoreToken>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__StoreTok__3214EC2739B97371");

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.DateCreated)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.DateModified).HasColumnType("datetime");
            entity.Property(e => e.ModifiedBy)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.RegistrationId).HasColumnName("RegistrationID");
            entity.Property(e => e.StoreApp)
                .HasMaxLength(100)
                .IsUnicode(false);
        });

        modelBuilder.Entity<StoreTokensView>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("StoreTokensView");

            entity.Property(e => e.DataBaseName).HasMaxLength(100);
            entity.Property(e => e.DateCreated).HasColumnType("datetime");
            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.RegistrationId).HasColumnName("RegistrationID");
            entity.Property(e => e.StoreApp)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.StoreName).HasMaxLength(100);
        });

        modelBuilder.Entity<TokenPermission>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__TokenPer__3214EC27960FB688");

            entity.HasIndex(e => new { e.TokenId, e.PermissionId }, "UQ_TokenPermissions_TokenID_PermissionID").IsUnique();

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.DateCreated)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.DateModified).HasColumnType("datetime");
            entity.Property(e => e.IsAllowed).HasDefaultValue(true);
            entity.Property(e => e.ModifiedBy)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.PermissionId).HasColumnName("PermissionID");
            entity.Property(e => e.TokenId).HasColumnName("TokenID");

            entity.HasOne(d => d.Permission).WithMany(p => p.TokenPermissions)
                .HasForeignKey(d => d.PermissionId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_TokenPermissions_Permissions");

            entity.HasOne(d => d.Token).WithMany(p => p.TokenPermissions)
                .HasForeignKey(d => d.TokenId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_TokenPermissions_StoreTokens");
        });

        modelBuilder.Entity<TokenStoreAccess>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__TokenSto__3214EC27C8EF4184");

            entity.ToTable("TokenStoreAccess");

            entity.HasIndex(e => new { e.TokenId, e.StoreId }, "UQ_TokenStoreAccess_TokenID_StoreID").IsUnique();

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.DateCreated)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.DateModified).HasColumnType("datetime");
            entity.Property(e => e.ModifiedBy)
                .HasMaxLength(100)
                .IsUnicode(false);
            entity.Property(e => e.StoreId).HasColumnName("StoreID");
            entity.Property(e => e.TokenId).HasColumnName("TokenID");

            entity.HasOne(d => d.Token).WithMany(p => p.TokenStoreAccesses)
                .HasForeignKey(d => d.TokenId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_TokenStoreAccess_StoreTokens");
        });

        modelBuilder.Entity<VwCustomerStatus>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("VW_CustomerStatus");

            entity.Property(e => e.Description)
                .HasMaxLength(8)
                .IsUnicode(false);
        });

        modelBuilder.Entity<VwStoreType>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("VW_StoreTypes");

            entity.Property(e => e.Description)
                .HasMaxLength(13)
                .IsUnicode(false);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
