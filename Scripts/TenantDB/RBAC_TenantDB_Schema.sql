/*
================================================================================
Script Name:    RBAC_TenantDB_Schema.sql
Description:    Creates the RBAC Phase 2 tables in EACH tenant (customer) database.

                IMPORTANT: Table names use "Rbac" prefix to avoid collision with
                the legacy TenantRoles / TenantRolePermissions tables that already
                exist in tenant databases.

                This script is IDEMPOTENT - safe to run multiple times.

Database:       Tenant Database (Customer DB) - run on EACH tenant

Tables Created:
    - RbacTenantRoles              (role definitions)
    - RbacTenantUserRoles          (user-to-role assignments)
    - RbacTenantRolePermissions    (role-to-permission mappings via key)
    - RbacTenantUserPermOverrides  (per-user permission overrides)
    - RbacTenantConfigs            (tenant-level configuration)
    - RbacTenantAuditLogs          (tenant-level audit trail)
    - __TenantMigrations           (migration tracking)

EF Core Config:
    - BackOffice.Infrastructure/DbContexts/Tenant/TenantDBContext.Rbac.cs
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @MigrationName VARCHAR(200) = 'RBAC_TenantDB_Schema_v2';

PRINT '========================================================================';
PRINT 'RBAC Tenant DB Schema Script v2 (Rbac-prefixed tables)';
PRINT 'Database: ' + DB_NAME();
PRINT 'Migration: ' + @MigrationName;
PRINT 'Time: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 121);
PRINT '========================================================================';

BEGIN TRY
BEGIN TRANSACTION;

-- ============================================================================
-- SECTION A: CREATE TABLES
-- ============================================================================

PRINT '';
PRINT '--- Section A: Creating RBAC tables ---';

-- A0. __TenantMigrations
IF OBJECT_ID('dbo.__TenantMigrations', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.__TenantMigrations (
        Id              INT IDENTITY(1,1) NOT NULL,
        MigrationName   VARCHAR(200)      NOT NULL,
        AppliedAt       DATETIME2         NOT NULL CONSTRAINT DF_TenantMigrations_AppliedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_TenantMigrations PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_TenantMigrations_Name UNIQUE (MigrationName)
    );
    PRINT '  [OK] __TenantMigrations created.';
END
ELSE
    PRINT '  [SKIP] __TenantMigrations exists.';

IF EXISTS (SELECT 1 FROM dbo.__TenantMigrations WHERE MigrationName = @MigrationName)
BEGIN
    PRINT '  [SKIP] Migration already applied. Verifying objects...';
END

-- A1. RbacTenantRoles
IF OBJECT_ID('dbo.RbacTenantRoles', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RbacTenantRoles (
        Id              INT IDENTITY(1,1) NOT NULL,
        Name            NVARCHAR(100)     NOT NULL,
        Code            VARCHAR(50)       NOT NULL,
        Description     NVARCHAR(500)     NULL,
        IsSystemRole    BIT               NOT NULL CONSTRAINT DF_RbacTR_IsSystemRole DEFAULT 0,
        IsActive        BIT               NOT NULL CONSTRAINT DF_RbacTR_IsActive DEFAULT 1,
        CreatedAt       DATETIME2         NOT NULL CONSTRAINT DF_RbacTR_CreatedAt DEFAULT SYSUTCDATETIME(),
        CreatedByUserId INT               NULL,

        CONSTRAINT PK_RbacTenantRoles PRIMARY KEY CLUSTERED (Id)
    );
    PRINT '  [OK] RbacTenantRoles created.';
END
ELSE
    PRINT '  [SKIP] RbacTenantRoles exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.RbacTenantRoles') AND name = 'IX_RbacTenantRoles_Code')
    CREATE UNIQUE NONCLUSTERED INDEX IX_RbacTenantRoles_Code ON dbo.RbacTenantRoles (Code);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.RbacTenantRoles') AND name = 'IX_RbacTenantRoles_IsActive')
    CREATE NONCLUSTERED INDEX IX_RbacTenantRoles_IsActive ON dbo.RbacTenantRoles (IsActive) INCLUDE (Name, Code);

-- A2. RbacTenantUserRoles
IF OBJECT_ID('dbo.RbacTenantUserRoles', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RbacTenantUserRoles (
        Id                  INT IDENTITY(1,1) NOT NULL,
        UserId              INT               NOT NULL,
        RoleId              INT               NOT NULL,
        AssignedAt          DATETIME2         NOT NULL CONSTRAINT DF_RbacTUR_AssignedAt DEFAULT SYSUTCDATETIME(),
        AssignedByUserId    INT               NULL,

        CONSTRAINT PK_RbacTenantUserRoles PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_RbacTUR_Roles FOREIGN KEY (RoleId) REFERENCES dbo.RbacTenantRoles (Id) ON DELETE CASCADE,
        CONSTRAINT UQ_RbacTUR_User_Role UNIQUE (UserId, RoleId)
    );
    PRINT '  [OK] RbacTenantUserRoles created.';
END
ELSE
    PRINT '  [SKIP] RbacTenantUserRoles exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.RbacTenantUserRoles') AND name = 'IX_RbacTUR_UserId')
    CREATE NONCLUSTERED INDEX IX_RbacTUR_UserId ON dbo.RbacTenantUserRoles (UserId) INCLUDE (RoleId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.RbacTenantUserRoles') AND name = 'IX_RbacTUR_RoleId')
    CREATE NONCLUSTERED INDEX IX_RbacTUR_RoleId ON dbo.RbacTenantUserRoles (RoleId) INCLUDE (UserId);

-- A3. RbacTenantRolePermissions
IF OBJECT_ID('dbo.RbacTenantRolePermissions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RbacTenantRolePermissions (
        Id              INT IDENTITY(1,1) NOT NULL,
        RoleId          INT               NOT NULL,
        PermissionKey   VARCHAR(150)      NOT NULL,
        IsGranted       BIT               NOT NULL CONSTRAINT DF_RbacTRP_IsGranted DEFAULT 1,

        CONSTRAINT PK_RbacTenantRolePermissions PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_RbacTRP_Roles FOREIGN KEY (RoleId) REFERENCES dbo.RbacTenantRoles (Id) ON DELETE CASCADE,
        CONSTRAINT UQ_RbacTRP_Role_Permission UNIQUE (RoleId, PermissionKey)
    );
    PRINT '  [OK] RbacTenantRolePermissions created.';
END
ELSE
    PRINT '  [SKIP] RbacTenantRolePermissions exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.RbacTenantRolePermissions') AND name = 'IX_RbacTRP_RoleId')
    CREATE NONCLUSTERED INDEX IX_RbacTRP_RoleId ON dbo.RbacTenantRolePermissions (RoleId) INCLUDE (PermissionKey, IsGranted);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.RbacTenantRolePermissions') AND name = 'IX_RbacTRP_PermissionKey')
    CREATE NONCLUSTERED INDEX IX_RbacTRP_PermissionKey ON dbo.RbacTenantRolePermissions (PermissionKey) INCLUDE (RoleId, IsGranted);

-- A4. RbacTenantUserPermOverrides
IF OBJECT_ID('dbo.RbacTenantUserPermOverrides', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RbacTenantUserPermOverrides (
        Id                  INT IDENTITY(1,1) NOT NULL,
        UserId              INT               NOT NULL,
        PermissionKey       VARCHAR(150)      NOT NULL,
        IsGranted           BIT               NOT NULL CONSTRAINT DF_RbacTUPO_IsGranted DEFAULT 1,
        Reason              NVARCHAR(500)     NULL,
        GrantedByUserId     INT               NULL,
        ExpiresAt           DATETIME2         NULL,
        CreatedAt           DATETIME2         NOT NULL CONSTRAINT DF_RbacTUPO_CreatedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_RbacTenantUserPermOverrides PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_RbacTUPO_User_Permission UNIQUE (UserId, PermissionKey)
    );
    PRINT '  [OK] RbacTenantUserPermOverrides created.';
END
ELSE
    PRINT '  [SKIP] RbacTenantUserPermOverrides exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.RbacTenantUserPermOverrides') AND name = 'IX_RbacTUPO_UserId')
    CREATE NONCLUSTERED INDEX IX_RbacTUPO_UserId ON dbo.RbacTenantUserPermOverrides (UserId) INCLUDE (PermissionKey, IsGranted, ExpiresAt);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.RbacTenantUserPermOverrides') AND name = 'IX_RbacTUPO_ExpiresAt')
    CREATE NONCLUSTERED INDEX IX_RbacTUPO_ExpiresAt ON dbo.RbacTenantUserPermOverrides (ExpiresAt) WHERE ExpiresAt IS NOT NULL;

-- A5. RbacTenantConfigs
IF OBJECT_ID('dbo.RbacTenantConfigs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RbacTenantConfigs (
        Id          INT IDENTITY(1,1) NOT NULL,
        ConfigKey   VARCHAR(100)      NOT NULL,
        ConfigValue NVARCHAR(MAX)     NULL,
        UpdatedAt   DATETIME2         NOT NULL CONSTRAINT DF_RbacTC_UpdatedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_RbacTenantConfigs PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_RbacTenantConfigs_Key UNIQUE (ConfigKey)
    );
    PRINT '  [OK] RbacTenantConfigs created.';
END
ELSE
    PRINT '  [SKIP] RbacTenantConfigs exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.RbacTenantConfigs') AND name = 'IX_RbacTenantConfigs_Key')
    CREATE UNIQUE NONCLUSTERED INDEX IX_RbacTenantConfigs_Key ON dbo.RbacTenantConfigs (ConfigKey);

-- A6. RbacTenantAuditLogs
IF OBJECT_ID('dbo.RbacTenantAuditLogs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RbacTenantAuditLogs (
        Id          BIGINT IDENTITY(1,1) NOT NULL,
        UserId      INT                  NULL,
        Action      VARCHAR(50)          NOT NULL,
        EntityType  VARCHAR(100)         NULL,
        EntityId    VARCHAR(50)          NULL,
        OldValue    NVARCHAR(MAX)        NULL,
        NewValue    NVARCHAR(MAX)        NULL,
        IpAddress   VARCHAR(50)          NULL,
        CreatedAt   DATETIME2            NOT NULL CONSTRAINT DF_RbacTAL_CreatedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_RbacTenantAuditLogs PRIMARY KEY CLUSTERED (Id)
    );
    PRINT '  [OK] RbacTenantAuditLogs created.';
END
ELSE
    PRINT '  [SKIP] RbacTenantAuditLogs exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.RbacTenantAuditLogs') AND name = 'IX_RbacTenantAudit_UserId')
    CREATE NONCLUSTERED INDEX IX_RbacTenantAudit_UserId ON dbo.RbacTenantAuditLogs (UserId, CreatedAt);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.RbacTenantAuditLogs') AND name = 'IX_RbacTenantAudit_CreatedAt')
    CREATE NONCLUSTERED INDEX IX_RbacTenantAudit_CreatedAt ON dbo.RbacTenantAuditLogs (CreatedAt);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.RbacTenantAuditLogs') AND name = 'IX_RbacTenantAudit_EntityType')
    CREATE NONCLUSTERED INDEX IX_RbacTenantAudit_EntityType ON dbo.RbacTenantAuditLogs (EntityType, EntityId);


-- ============================================================================
-- SECTION B: SEED DATA
-- ============================================================================

PRINT '';
PRINT '--- Section B: Seeding default data ---';

-- B1. Default Administrator role
IF NOT EXISTS (SELECT 1 FROM dbo.RbacTenantRoles WHERE Code = 'administrator')
BEGIN
    INSERT INTO dbo.RbacTenantRoles (Name, Code, Description, IsSystemRole, IsActive)
    VALUES (N'Administrator', 'administrator',
            N'System administrator role with full access. Cannot be deleted.', 1, 1);
    PRINT '  [OK] Default "Administrator" role created.';
END
ELSE
    PRINT '  [SKIP] "Administrator" role exists.';

-- B2. Default config values
IF NOT EXISTS (SELECT 1 FROM dbo.RbacTenantConfigs WHERE ConfigKey = 'rbac.enabled')
    INSERT INTO dbo.RbacTenantConfigs (ConfigKey, ConfigValue) VALUES ('rbac.enabled', 'true');

IF NOT EXISTS (SELECT 1 FROM dbo.RbacTenantConfigs WHERE ConfigKey = 'rbac.default_role')
    INSERT INTO dbo.RbacTenantConfigs (ConfigKey, ConfigValue) VALUES ('rbac.default_role', 'administrator');

-- B3. Track migration
IF NOT EXISTS (SELECT 1 FROM dbo.__TenantMigrations WHERE MigrationName = @MigrationName)
BEGIN
    INSERT INTO dbo.__TenantMigrations (MigrationName) VALUES (@MigrationName);
    PRINT '  [OK] Migration recorded.';
END

-- ============================================================================
COMMIT TRANSACTION;

PRINT '';
PRINT '========================================================================';
PRINT 'RBAC Tenant DB Schema v2 - COMPLETED SUCCESSFULLY';
PRINT 'Database: ' + DB_NAME();
PRINT '========================================================================';
PRINT '';
PRINT 'Tables:';
PRINT '  - RbacTenantRoles';
PRINT '  - RbacTenantUserRoles';
PRINT '  - RbacTenantRolePermissions';
PRINT '  - RbacTenantUserPermOverrides';
PRINT '  - RbacTenantConfigs';
PRINT '  - RbacTenantAuditLogs';

DECLARE @rc INT;
SELECT @rc = COUNT(*) FROM dbo.RbacTenantRoles;
PRINT '  Roles: ' + CAST(@rc AS VARCHAR(10));

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO
