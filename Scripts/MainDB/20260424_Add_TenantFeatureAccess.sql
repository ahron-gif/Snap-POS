/*
================================================================================
Script Name:    20260424_Add_TenantFeatureAccess.sql
Description:    Adds Tenant Feature Access (Super-Admin grantable features) to
                the master DB plus the four Custom Date Scope permission codes.

                - Adds Permissions.IsSuperAdminGrantable column.
                - Creates dbo.TenantUserFeatureGrants (per-user grants).
                - Creates dbo.TenantFeatureAutoGrants (auto-grant to future users).
                - Seeds the four reports.setup.custom_date_scope.* permissions.

                Run against: Master Database (RDTCloud / MainDB)
                Idempotent: safe to run multiple times.
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '========================================================================';
PRINT 'Add Tenant Feature Access schema + Custom Date Scope permission seeds';
PRINT 'Database: ' + DB_NAME();
PRINT 'Time: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 121);
PRINT '========================================================================';

BEGIN TRY
BEGIN TRANSACTION;

-- ==========================================================
-- 1. Add Permissions.IsSuperAdminGrantable column if missing
-- ==========================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Permissions') AND name = 'IsSuperAdminGrantable'
)
BEGIN
    ALTER TABLE dbo.Permissions
        ADD IsSuperAdminGrantable BIT NOT NULL CONSTRAINT DF_Permissions_IsSuperAdminGrantable DEFAULT (0);
    PRINT '  [OK] Permissions.IsSuperAdminGrantable column added.';
END
ELSE
BEGIN
    PRINT '  [SKIP] Permissions.IsSuperAdminGrantable already exists.';
END

-- ==========================================================
-- 2. Create dbo.TenantUserFeatureGrants
-- ==========================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TenantUserFeatureGrants' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.TenantUserFeatureGrants (
        Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TenantUserFeatureGrants PRIMARY KEY,
        TenantId        INT NOT NULL,
        UserId          INT NOT NULL,
        PermissionId    INT NOT NULL,
        GrantedBy       INT NOT NULL,
        GrantedAt       DATETIME2 NOT NULL CONSTRAINT DF_TenantUserFeatureGrants_GrantedAt DEFAULT (SYSUTCDATETIME()),
        RevokedBy       INT NULL,
        RevokedAt       DATETIME2 NULL,
        IsActive        BIT NOT NULL CONSTRAINT DF_TenantUserFeatureGrants_IsActive DEFAULT (1),
        CONSTRAINT FK_TenantUserFeatureGrants_Permission FOREIGN KEY (PermissionId)
            REFERENCES dbo.Permissions(Id)
    );

    CREATE UNIQUE INDEX UX_TenantUserFeatureGrants_Active
        ON dbo.TenantUserFeatureGrants(TenantId, UserId, PermissionId)
        WHERE IsActive = 1;

    CREATE INDEX IX_TenantUserFeatureGrants_TenantUser
        ON dbo.TenantUserFeatureGrants(TenantId, UserId);

    CREATE INDEX IX_TenantUserFeatureGrants_TenantPermission
        ON dbo.TenantUserFeatureGrants(TenantId, PermissionId);

    PRINT '  [OK] TenantUserFeatureGrants table created.';
END
ELSE
BEGIN
    PRINT '  [SKIP] TenantUserFeatureGrants already exists.';
END

-- ==========================================================
-- 3. Create dbo.TenantFeatureAutoGrants
-- ==========================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TenantFeatureAutoGrants' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.TenantFeatureAutoGrants (
        Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TenantFeatureAutoGrants PRIMARY KEY,
        TenantId        INT NOT NULL,
        PermissionId    INT NOT NULL,
        CreatedBy       INT NOT NULL,
        CreatedAt       DATETIME2 NOT NULL CONSTRAINT DF_TenantFeatureAutoGrants_CreatedAt DEFAULT (SYSUTCDATETIME()),
        IsActive        BIT NOT NULL CONSTRAINT DF_TenantFeatureAutoGrants_IsActive DEFAULT (1),
        CONSTRAINT FK_TenantFeatureAutoGrants_Permission FOREIGN KEY (PermissionId)
            REFERENCES dbo.Permissions(Id)
    );

    CREATE UNIQUE INDEX UX_TenantFeatureAutoGrants_Active
        ON dbo.TenantFeatureAutoGrants(TenantId, PermissionId)
        WHERE IsActive = 1;

    PRINT '  [OK] TenantFeatureAutoGrants table created.';
END
ELSE
BEGIN
    PRINT '  [SKIP] TenantFeatureAutoGrants already exists.';
END

-- ==========================================================
-- 4. Seed Custom Date Scope permissions (Reports module)
-- ==========================================================
DECLARE @ReportsModuleId INT;
SELECT @ReportsModuleId = ModuleId FROM dbo.Modules WHERE Code = 'reports';

IF @ReportsModuleId IS NULL
BEGIN
    RAISERROR('Reports module not found. Run RBAC_MasterDB_Schema_And_Seed.sql first.', 16, 1);
END

-- Ensure the screen "reports.setup.custom_date_scope" exists, attached to the Reports module.
IF NOT EXISTS (SELECT 1 FROM dbo.Screens WHERE Code = 'reports.setup.custom_date_scope')
BEGIN
    INSERT INTO dbo.Screens (ModuleId, Code, Name, Route, Icon, SortOrder, IsActive, CreatedAt)
    VALUES (@ReportsModuleId, 'reports.setup.custom_date_scope', N'Custom Date Scope', '/reports/setup/custom-date-scope', 'BoxCubeIcon', 200, 1, SYSUTCDATETIME());
    PRINT '  [OK] Screen reports.setup.custom_date_scope inserted.';
END

DECLARE @ScreenId INT;
SELECT @ScreenId = Id FROM dbo.Screens WHERE Code = 'reports.setup.custom_date_scope';

-- Permission seed table for the four CDS permissions
DECLARE @CdsPerms TABLE (
    PermissionKey NVARCHAR(150),
    PermName      NVARCHAR(150),
    Category      VARCHAR(20),
    SortOrder     INT
);
INSERT INTO @CdsPerms VALUES
    ('reports.setup.custom_date_scope.view',   N'View Custom Date Scope',   'action', 1),
    ('reports.setup.custom_date_scope.create', N'Create Custom Date Scope', 'action', 2),
    ('reports.setup.custom_date_scope.edit',   N'Edit Custom Date Scope',   'action', 3),
    ('reports.setup.custom_date_scope.delete', N'Delete Custom Date Scope', 'action', 4);

INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt, IsSuperAdminGrantable)
SELECT @ReportsModuleId, @ScreenId, p.PermissionKey, p.PermName, p.Category, p.SortOrder, 1, SYSUTCDATETIME(), 1
FROM @CdsPerms p
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions x WHERE x.PermissionKey = p.PermissionKey);

-- Mark the four perms as Super-Admin grantable (idempotent — also true if rows already existed)
UPDATE p
SET IsSuperAdminGrantable = 1
FROM dbo.Permissions p
INNER JOIN @CdsPerms s ON s.PermissionKey = p.PermissionKey;

PRINT '  [OK] Custom Date Scope permissions seeded / flagged Super-Admin grantable.';

COMMIT TRANSACTION;

PRINT '';
PRINT '========================================================================';
PRINT 'Add Tenant Feature Access - COMPLETED';
PRINT '========================================================================';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO
