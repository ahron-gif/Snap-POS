/*
================================================================================
Script Name:    RBAC_MasterDB_Schema_And_Seed.sql
Description:    Creates the RBAC schema and seeds all reference data in the
                Master/Main database (RDTCloud).

                This script is IDEMPOTENT - safe to run multiple times.
                It uses IF NOT EXISTS checks for all DDL and MERGE/NOT EXISTS
                patterns for all seed data.

Database:       Master Database (RDTCloud)

Sections:
    A) Add new columns to existing tables (Customers, Modules, SystemUsers)
    B) Create new tables (Plans, Screens, Permissions, PlanModules,
       TenantAllowedModules, TenantAllowedPermissions, GlobalConfigs,
       MasterAuditLogs)
    C) Seed reference data (Plans, Modules, Screens, Permissions, PlanModules,
       default SuperAdmin)
    D) Add FK constraint: Customers.PlanId -> Plans.Id

Related Entity Files:
    - BackOffice.Domain/Entities/Main/Plan.cs
    - BackOffice.Domain/Entities/Main/Screen.cs
    - BackOffice.Domain/Entities/Main/Permission.cs
    - BackOffice.Domain/Entities/Main/PlanModule.cs
    - BackOffice.Domain/Entities/Main/TenantAllowedModule.cs
    - BackOffice.Domain/Entities/Main/TenantAllowedPermission.cs
    - BackOffice.Domain/Entities/Main/GlobalConfig.cs
    - BackOffice.Domain/Entities/Main/MasterAuditLog.cs
    - BackOffice.Common/Permissions/Perms.cs
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '========================================================================';
PRINT 'RBAC Master DB Schema & Seed Script - Starting';
PRINT 'Database: ' + DB_NAME();
PRINT 'Time: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 121);
PRINT '========================================================================';

-- ============================================================================
-- SECTION A: ADD NEW COLUMNS TO EXISTING TABLES
-- (Run in a separate batch so new columns are visible to subsequent batches)
-- ============================================================================

PRINT '';
PRINT '--- Section A: Adding new columns to existing tables ---';

-- --------------------------------------------------------------------------
-- A1. Customers table: add PlanId, ExpiresAt, ContactEmail, ContactPhone
-- --------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Customers') AND name = 'PlanId')
BEGIN
    ALTER TABLE dbo.Customers ADD PlanId INT NULL;
    PRINT '  [OK] Customers.PlanId column added.';
END
ELSE
    PRINT '  [SKIP] Customers.PlanId column already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Customers') AND name = 'ExpiresAt')
BEGIN
    ALTER TABLE dbo.Customers ADD ExpiresAt DATETIME2 NULL;
    PRINT '  [OK] Customers.ExpiresAt column added.';
END
ELSE
    PRINT '  [SKIP] Customers.ExpiresAt column already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Customers') AND name = 'ContactEmail')
BEGIN
    ALTER TABLE dbo.Customers ADD ContactEmail NVARCHAR(200) NULL;
    PRINT '  [OK] Customers.ContactEmail column added.';
END
ELSE
    PRINT '  [SKIP] Customers.ContactEmail column already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Customers') AND name = 'ContactPhone')
BEGIN
    ALTER TABLE dbo.Customers ADD ContactPhone NVARCHAR(50) NULL;
    PRINT '  [OK] Customers.ContactPhone column added.';
END
ELSE
    PRINT '  [SKIP] Customers.ContactPhone column already exists.';

-- --------------------------------------------------------------------------
-- A2. Modules table: add Code, ParentModuleId, Icon, SortOrder, IsActive
-- --------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Modules') AND name = 'Code')
BEGIN
    ALTER TABLE dbo.Modules ADD Code VARCHAR(50) NULL;
    PRINT '  [OK] Modules.Code column added.';
END
ELSE
    PRINT '  [SKIP] Modules.Code column already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Modules') AND name = 'ParentModuleId')
BEGIN
    ALTER TABLE dbo.Modules ADD ParentModuleId INT NULL;
    PRINT '  [OK] Modules.ParentModuleId column added.';
END
ELSE
    PRINT '  [SKIP] Modules.ParentModuleId column already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Modules') AND name = 'Icon')
BEGIN
    ALTER TABLE dbo.Modules ADD Icon VARCHAR(50) NULL;
    PRINT '  [OK] Modules.Icon column added.';
END
ELSE
    PRINT '  [SKIP] Modules.Icon column already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Modules') AND name = 'SortOrder')
BEGIN
    ALTER TABLE dbo.Modules ADD SortOrder INT NOT NULL CONSTRAINT DF_Modules_SortOrder DEFAULT 0;
    PRINT '  [OK] Modules.SortOrder column added.';
END
ELSE
    PRINT '  [SKIP] Modules.SortOrder column already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Modules') AND name = 'IsActive')
BEGIN
    ALTER TABLE dbo.Modules ADD IsActive BIT NOT NULL CONSTRAINT DF_Modules_IsActive DEFAULT 1;
    PRINT '  [OK] Modules.IsActive column added.';
END
ELSE
    PRINT '  [SKIP] Modules.IsActive column already exists.';

-- --------------------------------------------------------------------------
-- A3. SystemUsers table: add IsMasterAdmin, FullName, LastLoginAt
-- --------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SystemUsers') AND name = 'IsMasterAdmin')
BEGIN
    ALTER TABLE dbo.SystemUsers ADD IsMasterAdmin BIT NOT NULL CONSTRAINT DF_SystemUsers_IsMasterAdmin DEFAULT 0;
    PRINT '  [OK] SystemUsers.IsMasterAdmin column added.';
END
ELSE
    PRINT '  [SKIP] SystemUsers.IsMasterAdmin column already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SystemUsers') AND name = 'FullName')
BEGIN
    ALTER TABLE dbo.SystemUsers ADD FullName NVARCHAR(200) NULL;
    PRINT '  [OK] SystemUsers.FullName column added.';
END
ELSE
    PRINT '  [SKIP] SystemUsers.FullName column already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SystemUsers') AND name = 'LastLoginAt')
BEGIN
    ALTER TABLE dbo.SystemUsers ADD LastLoginAt DATETIME2 NULL;
    PRINT '  [OK] SystemUsers.LastLoginAt column added.';
END
ELSE
    PRINT '  [SKIP] SystemUsers.LastLoginAt column already exists.';


GO
-- ============================================================================
-- BATCH 2: Everything that references the new columns
-- ============================================================================
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
BEGIN TRANSACTION;

-- ============================================================================
-- SECTION B: CREATE NEW TABLES
-- ============================================================================

PRINT '';
PRINT '--- Section B: Creating new tables ---';

-- --------------------------------------------------------------------------
-- B1. Plans
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.Plans', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Plans (
        Id              INT IDENTITY(1,1) NOT NULL,
        Name            NVARCHAR(100)     NOT NULL,
        Code            VARCHAR(50)       NOT NULL,
        MaxUsers        INT               NOT NULL CONSTRAINT DF_Plans_MaxUsers DEFAULT 10,
        MonthlyPrice    DECIMAL(10,2)     NOT NULL CONSTRAINT DF_Plans_MonthlyPrice DEFAULT 0,
        IsActive        BIT               NOT NULL CONSTRAINT DF_Plans_IsActive DEFAULT 1,
        CreatedAt       DATETIME2         NOT NULL CONSTRAINT DF_Plans_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt       DATETIME2         NULL,

        CONSTRAINT PK_Plans PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_Plans_Code UNIQUE (Code)
    );
    PRINT '  [OK] Table dbo.Plans created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.Plans already exists.';

-- Index: IX_Plan_Code (covered by UNIQUE constraint above)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Plans') AND name = 'IX_Plan_Code')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_Plan_Code ON dbo.Plans (Code);
    PRINT '  [OK] Index IX_Plan_Code created.';
END
ELSE
    PRINT '  [SKIP] Index IX_Plan_Code already exists.';

-- --------------------------------------------------------------------------
-- B2. Screens
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.Screens', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Screens (
        Id          INT IDENTITY(1,1) NOT NULL,
        ModuleId    INT               NOT NULL,
        Code        VARCHAR(100)      NOT NULL,
        Name        NVARCHAR(100)     NOT NULL,
        Route       VARCHAR(200)      NULL,
        Icon        VARCHAR(50)       NULL,
        SortOrder   INT               NOT NULL CONSTRAINT DF_Screens_SortOrder DEFAULT 0,
        IsActive    BIT               NOT NULL CONSTRAINT DF_Screens_IsActive DEFAULT 1,
        CreatedAt   DATETIME2         NOT NULL CONSTRAINT DF_Screens_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt   DATETIME2         NULL,

        CONSTRAINT PK_Screens PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_Screens_Code UNIQUE (Code),
        CONSTRAINT FK_Screens_Modules FOREIGN KEY (ModuleId) REFERENCES dbo.Modules (ModuleId) ON DELETE NO ACTION
    );
    PRINT '  [OK] Table dbo.Screens created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.Screens already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Screens') AND name = 'IX_Screen_Code')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_Screen_Code ON dbo.Screens (Code);
    PRINT '  [OK] Index IX_Screen_Code created.';
END
ELSE
    PRINT '  [SKIP] Index IX_Screen_Code already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Screens') AND name = 'IX_Screen_ModuleId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Screen_ModuleId ON dbo.Screens (ModuleId);
    PRINT '  [OK] Index IX_Screen_ModuleId created.';
END
ELSE
    PRINT '  [SKIP] Index IX_Screen_ModuleId already exists.';

-- --------------------------------------------------------------------------
-- B3. Permissions
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.Permissions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Permissions (
        Id              INT IDENTITY(1,1) NOT NULL,
        ModuleId        INT               NOT NULL,
        ScreenId        INT               NULL,
        PermissionKey   VARCHAR(150)      NOT NULL,
        Name            NVARCHAR(150)     NOT NULL,
        Category        VARCHAR(20)       NOT NULL CONSTRAINT DF_Permissions_Category DEFAULT 'action',
        SortOrder       INT               NOT NULL CONSTRAINT DF_Permissions_SortOrder DEFAULT 0,
        IsActive        BIT               NOT NULL CONSTRAINT DF_Permissions_IsActive DEFAULT 1,
        CreatedAt       DATETIME2         NOT NULL CONSTRAINT DF_Permissions_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt       DATETIME2         NULL,

        CONSTRAINT PK_Permissions PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_Permissions_Key UNIQUE (PermissionKey),
        CONSTRAINT FK_Permissions_Modules FOREIGN KEY (ModuleId) REFERENCES dbo.Modules (ModuleId) ON DELETE NO ACTION,
        CONSTRAINT FK_Permissions_Screens FOREIGN KEY (ScreenId) REFERENCES dbo.Screens (Id) ON DELETE NO ACTION
    );
    PRINT '  [OK] Table dbo.Permissions created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.Permissions already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Permissions') AND name = 'IX_Permission_Key')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_Permission_Key ON dbo.Permissions (PermissionKey);
    PRINT '  [OK] Index IX_Permission_Key created.';
END
ELSE
    PRINT '  [SKIP] Index IX_Permission_Key already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Permissions') AND name = 'IX_Permission_ModuleId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Permission_ModuleId ON dbo.Permissions (ModuleId);
    PRINT '  [OK] Index IX_Permission_ModuleId created.';
END
ELSE
    PRINT '  [SKIP] Index IX_Permission_ModuleId already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Permissions') AND name = 'IX_Permission_ScreenId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Permission_ScreenId ON dbo.Permissions (ScreenId);
    PRINT '  [OK] Index IX_Permission_ScreenId created.';
END
ELSE
    PRINT '  [SKIP] Index IX_Permission_ScreenId already exists.';

-- --------------------------------------------------------------------------
-- B4. PlanModules
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.PlanModules', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PlanModules (
        Id          INT IDENTITY(1,1) NOT NULL,
        PlanId      INT               NOT NULL,
        ModuleId    INT               NOT NULL,
        IsEnabled   BIT               NOT NULL CONSTRAINT DF_PlanModules_IsEnabled DEFAULT 1,

        CONSTRAINT PK_PlanModules PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_PlanModules_Plans FOREIGN KEY (PlanId) REFERENCES dbo.Plans (Id) ON DELETE CASCADE,
        CONSTRAINT FK_PlanModules_Modules FOREIGN KEY (ModuleId) REFERENCES dbo.Modules (ModuleId) ON DELETE CASCADE,
        CONSTRAINT UQ_PlanModules_Plan_Module UNIQUE (PlanId, ModuleId)
    );
    PRINT '  [OK] Table dbo.PlanModules created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.PlanModules already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.PlanModules') AND name = 'IX_PlanModule_Plan_Module')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_PlanModule_Plan_Module ON dbo.PlanModules (PlanId, ModuleId);
    PRINT '  [OK] Index IX_PlanModule_Plan_Module created.';
END
ELSE
    PRINT '  [SKIP] Index IX_PlanModule_Plan_Module already exists.';

-- --------------------------------------------------------------------------
-- B5. TenantAllowedModules
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.TenantAllowedModules', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TenantAllowedModules (
        Id          INT IDENTITY(1,1) NOT NULL,
        TenantId    INT               NOT NULL,
        ModuleId    INT               NOT NULL,
        IsEnabled   BIT               NOT NULL CONSTRAINT DF_TAM_IsEnabled DEFAULT 1,
        EnabledAt   DATETIME2         NOT NULL CONSTRAINT DF_TAM_EnabledAt DEFAULT SYSUTCDATETIME(),
        DisabledAt  DATETIME2         NULL,

        CONSTRAINT PK_TenantAllowedModules PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_TAM_Customers FOREIGN KEY (TenantId) REFERENCES dbo.Customers (CustomerId) ON DELETE CASCADE,
        CONSTRAINT FK_TAM_Modules FOREIGN KEY (ModuleId) REFERENCES dbo.Modules (ModuleId) ON DELETE CASCADE,
        CONSTRAINT UQ_TAM_Tenant_Module UNIQUE (TenantId, ModuleId)
    );
    PRINT '  [OK] Table dbo.TenantAllowedModules created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.TenantAllowedModules already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.TenantAllowedModules') AND name = 'IX_TenantModule_Tenant_Module')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_TenantModule_Tenant_Module ON dbo.TenantAllowedModules (TenantId, ModuleId);
    PRINT '  [OK] Index IX_TenantModule_Tenant_Module created.';
END
ELSE
    PRINT '  [SKIP] Index IX_TenantModule_Tenant_Module already exists.';

-- --------------------------------------------------------------------------
-- B6. TenantAllowedPermissions
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.TenantAllowedPermissions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TenantAllowedPermissions (
        Id                  INT IDENTITY(1,1) NOT NULL,
        TenantId            INT               NOT NULL,
        PermissionId        INT               NOT NULL,
        IsAllowed           BIT               NOT NULL CONSTRAINT DF_TAP_IsAllowed DEFAULT 1,
        GrantedByUserId     INT               NULL,
        GrantedAt           DATETIME2         NOT NULL CONSTRAINT DF_TAP_GrantedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_TenantAllowedPermissions PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_TAP_Customers FOREIGN KEY (TenantId) REFERENCES dbo.Customers (CustomerId) ON DELETE CASCADE,
        CONSTRAINT FK_TAP_Permissions FOREIGN KEY (PermissionId) REFERENCES dbo.Permissions (Id) ON DELETE CASCADE,
        CONSTRAINT UQ_TAP_Tenant_Permission UNIQUE (TenantId, PermissionId)
    );
    PRINT '  [OK] Table dbo.TenantAllowedPermissions created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.TenantAllowedPermissions already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.TenantAllowedPermissions') AND name = 'IX_TenantPerm_Tenant_Permission')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_TenantPerm_Tenant_Permission ON dbo.TenantAllowedPermissions (TenantId, PermissionId);
    PRINT '  [OK] Index IX_TenantPerm_Tenant_Permission created.';
END
ELSE
    PRINT '  [SKIP] Index IX_TenantPerm_Tenant_Permission already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.TenantAllowedPermissions') AND name = 'IX_TenantPerm_TenantId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_TenantPerm_TenantId ON dbo.TenantAllowedPermissions (TenantId);
    PRINT '  [OK] Index IX_TenantPerm_TenantId created.';
END
ELSE
    PRINT '  [SKIP] Index IX_TenantPerm_TenantId already exists.';

-- --------------------------------------------------------------------------
-- B7. GlobalConfigs
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.GlobalConfigs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GlobalConfigs (
        Id              INT IDENTITY(1,1) NOT NULL,
        ConfigKey       VARCHAR(100)      NOT NULL,
        ConfigValue     NVARCHAR(MAX)     NULL,
        Description     NVARCHAR(500)     NULL,
        UpdatedAt       DATETIME2         NOT NULL CONSTRAINT DF_GlobalConfigs_UpdatedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_GlobalConfigs PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_GlobalConfigs_Key UNIQUE (ConfigKey)
    );
    PRINT '  [OK] Table dbo.GlobalConfigs created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.GlobalConfigs already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.GlobalConfigs') AND name = 'IX_GlobalConfig_Key')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_GlobalConfig_Key ON dbo.GlobalConfigs (ConfigKey);
    PRINT '  [OK] Index IX_GlobalConfig_Key created.';
END
ELSE
    PRINT '  [SKIP] Index IX_GlobalConfig_Key already exists.';

-- --------------------------------------------------------------------------
-- B8. MasterAuditLogs
-- --------------------------------------------------------------------------
IF OBJECT_ID('dbo.MasterAuditLogs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.MasterAuditLogs (
        Id          BIGINT IDENTITY(1,1) NOT NULL,
        UserId      INT                  NULL,
        TenantId    INT                  NULL,
        Action      VARCHAR(50)          NOT NULL,
        EntityType  VARCHAR(100)         NOT NULL,
        EntityId    VARCHAR(50)          NULL,
        OldValue    NVARCHAR(MAX)        NULL,
        NewValue    NVARCHAR(MAX)        NULL,
        IpAddress   VARCHAR(50)          NULL,
        CreatedAt   DATETIME2            NOT NULL CONSTRAINT DF_MasterAuditLogs_CreatedAt DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_MasterAuditLogs PRIMARY KEY CLUSTERED (Id)
    );
    PRINT '  [OK] Table dbo.MasterAuditLogs created.';
END
ELSE
    PRINT '  [SKIP] Table dbo.MasterAuditLogs already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.MasterAuditLogs') AND name = 'IX_MasterAudit_TenantId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_MasterAudit_TenantId ON dbo.MasterAuditLogs (TenantId, CreatedAt);
    PRINT '  [OK] Index IX_MasterAudit_TenantId created.';
END
ELSE
    PRINT '  [SKIP] Index IX_MasterAudit_TenantId already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.MasterAuditLogs') AND name = 'IX_MasterAudit_CreatedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_MasterAudit_CreatedAt ON dbo.MasterAuditLogs (CreatedAt);
    PRINT '  [OK] Index IX_MasterAudit_CreatedAt created.';
END
ELSE
    PRINT '  [SKIP] Index IX_MasterAudit_CreatedAt already exists.';

-- --------------------------------------------------------------------------
-- Add Modules self-referencing FK and unique filtered index on Code
-- --------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Modules_ParentModule')
BEGIN
    ALTER TABLE dbo.Modules
        ADD CONSTRAINT FK_Modules_ParentModule
        FOREIGN KEY (ParentModuleId) REFERENCES dbo.Modules (ModuleId) ON DELETE NO ACTION;
    PRINT '  [OK] FK_Modules_ParentModule constraint added.';
END
ELSE
    PRINT '  [SKIP] FK_Modules_ParentModule constraint already exists.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Modules') AND name = 'IX_Module_Code')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_Module_Code ON dbo.Modules (Code)
        WHERE [Code] IS NOT NULL;
    PRINT '  [OK] Index IX_Module_Code created.';
END
ELSE
    PRINT '  [SKIP] Index IX_Module_Code already exists.';


-- ============================================================================
-- SECTION C: SEED DATA
-- ============================================================================

PRINT '';
PRINT '--- Section C: Seeding reference data ---';

-- --------------------------------------------------------------------------
-- C1. Seed Plans
-- --------------------------------------------------------------------------
PRINT '';
PRINT '  Seeding Plans...';

IF NOT EXISTS (SELECT 1 FROM dbo.Plans WHERE Code = 'basic')
    INSERT INTO dbo.Plans (Name, Code, MaxUsers, MonthlyPrice, IsActive)
    VALUES (N'Basic', 'basic', 5, 0.00, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Plans WHERE Code = 'standard')
    INSERT INTO dbo.Plans (Name, Code, MaxUsers, MonthlyPrice, IsActive)
    VALUES (N'Standard', 'standard', 25, 99.00, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Plans WHERE Code = 'enterprise')
    INSERT INTO dbo.Plans (Name, Code, MaxUsers, MonthlyPrice, IsActive)
    VALUES (N'Enterprise', 'enterprise', 100, 299.00, 1);

PRINT '  [OK] Plans seeded.';

-- --------------------------------------------------------------------------
-- C2. Seed Modules  (matches sidebar groups exactly)
-- --------------------------------------------------------------------------
PRINT '';
PRINT '  Seeding Modules...';

DECLARE @ModuleSeed TABLE (
    Code        VARCHAR(50),
    ModuleName  NVARCHAR(100),
    PageURL     VARCHAR(200),
    Icon        VARCHAR(50),
    SortOrder   INT
);

INSERT INTO @ModuleSeed (Code, ModuleName, PageURL, Icon, SortOrder) VALUES
    ('inventory',   N'Inventory',           '/inventory',   'InventoryIcon',        1),
    ('purchasing',  N'Vendors',             '/purchasing',  'VendorIcon',           2),
    ('customers',   N'Customers',           '/customers',   'CustomerIcon',         3),
    ('registers',   N'Registers',           '/registers',   'RegisterIcon',         4),
    ('sales',       N'Sales & Discounts',   '/sales',       'SalesAndDiscountIcon', 5),
    ('stores',      N'Stores',              '/stores',      'StoreIcon',            6),
    ('admin',       N'Administrator',       '/admin',       'PieChartIcon',         7),
    ('reports',     N'Reports',             '/reports',     'BoxCubeIcon',          8);

MERGE dbo.Modules AS target
USING @ModuleSeed AS source
ON (target.Code = source.Code)
WHEN MATCHED THEN
    UPDATE SET
        target.PageURL   = source.PageURL,
        target.Icon      = source.Icon,
        target.SortOrder = source.SortOrder,
        target.IsActive  = 1
WHEN NOT MATCHED BY SOURCE AND target.Code IS NOT NULL THEN
    UPDATE SET target.IsActive = target.IsActive
WHEN NOT MATCHED BY TARGET THEN
    INSERT (ModuleName, Code, IsDefault, PageURL, Icon, SortOrder, IsActive)
    VALUES (source.ModuleName, source.Code, 0, source.PageURL, source.Icon, source.SortOrder, 1);

-- Try to set Code on existing modules that match by name but don't have a Code yet
UPDATE m SET m.Code = 'inventory',  m.SortOrder = 1, m.Icon = 'InventoryIcon'
FROM dbo.Modules m WHERE m.Code IS NULL AND m.ModuleName LIKE '%Inventory%' AND NOT EXISTS (SELECT 1 FROM dbo.Modules WHERE Code = 'inventory');

UPDATE m SET m.Code = 'purchasing', m.SortOrder = 2, m.Icon = 'VendorIcon'
FROM dbo.Modules m WHERE m.Code IS NULL AND (m.ModuleName LIKE '%Vendor%' OR m.ModuleName LIKE '%Purchas%') AND NOT EXISTS (SELECT 1 FROM dbo.Modules WHERE Code = 'purchasing');

UPDATE m SET m.Code = 'customers',  m.SortOrder = 3, m.Icon = 'CustomerIcon'
FROM dbo.Modules m WHERE m.Code IS NULL AND m.ModuleName LIKE '%Customer%' AND NOT EXISTS (SELECT 1 FROM dbo.Modules WHERE Code = 'customers');

UPDATE m SET m.Code = 'registers',  m.SortOrder = 4, m.Icon = 'RegisterIcon'
FROM dbo.Modules m WHERE m.Code IS NULL AND m.ModuleName LIKE '%Register%' AND NOT EXISTS (SELECT 1 FROM dbo.Modules WHERE Code = 'registers');

UPDATE m SET m.Code = 'sales',      m.SortOrder = 5, m.Icon = 'SalesAndDiscountIcon'
FROM dbo.Modules m WHERE m.Code IS NULL AND m.ModuleName LIKE '%Sales%' AND NOT EXISTS (SELECT 1 FROM dbo.Modules WHERE Code = 'sales');

UPDATE m SET m.Code = 'stores',     m.SortOrder = 6, m.Icon = 'StoreIcon'
FROM dbo.Modules m WHERE m.Code IS NULL AND m.ModuleName LIKE '%Store%' AND NOT EXISTS (SELECT 1 FROM dbo.Modules WHERE Code = 'stores');

UPDATE m SET m.Code = 'admin',      m.SortOrder = 7, m.Icon = 'PieChartIcon'
FROM dbo.Modules m WHERE m.Code IS NULL AND m.ModuleName LIKE '%Admin%' AND NOT EXISTS (SELECT 1 FROM dbo.Modules WHERE Code = 'admin');

UPDATE m SET m.Code = 'reports',    m.SortOrder = 8, m.Icon = 'BoxCubeIcon'
FROM dbo.Modules m WHERE m.Code IS NULL AND m.ModuleName LIKE '%Report%' AND NOT EXISTS (SELECT 1 FROM dbo.Modules WHERE Code = 'reports');

PRINT '  [OK] Modules seeded.';

-- --------------------------------------------------------------------------
-- C3. Seed Screens  (every sidebar menu item = 1 screen)
-- --------------------------------------------------------------------------
PRINT '';
PRINT '  Seeding Screens...';

DECLARE @ScreenSeed TABLE (
    ModuleCode  VARCHAR(50),
    ScreenCode  VARCHAR(100),
    ScreenName  NVARCHAR(100),
    Route       VARCHAR(200),
    Icon        VARCHAR(50),
    SortOrder   INT
);

-- ======== INVENTORY SCREENS (8) ========
INSERT INTO @ScreenSeed VALUES ('inventory', 'inventory.item_list',             N'Item List',               '/items-list',                  'InventoryIcon',  1);
INSERT INTO @ScreenSeed VALUES ('inventory', 'inventory.item_quick_list',       N'Item Quick List',         '/items-quick-list',            'InventoryIcon',  2);
INSERT INTO @ScreenSeed VALUES ('inventory', 'inventory.item_group',            N'Item Groups',             '/item-groups',                 'InventoryIcon',  3);
INSERT INTO @ScreenSeed VALUES ('inventory', 'inventory.department',            N'Departments',             '/departments',                 'InventoryIcon',  4);
INSERT INTO @ScreenSeed VALUES ('inventory', 'inventory.manufacturer',          N'Manufacturers',           '/manufacturers',               'InventoryIcon',  5);
INSERT INTO @ScreenSeed VALUES ('inventory', 'inventory.items_with_inventory',  N'Items With Inventory',    '/items-with-inventory',        'InventoryIcon',  6);
INSERT INTO @ScreenSeed VALUES ('inventory', 'inventory.label_designer',        N'Label Designer',          '/label-designer',              'InventoryIcon',  7);
INSERT INTO @ScreenSeed VALUES ('inventory', 'inventory.adjust_inventory',      N'Adjust Inventory',        '/adjust-inventory',            'InventoryIcon',  8);

-- ======== PURCHASING/VENDORS SCREENS (6) ========
INSERT INTO @ScreenSeed VALUES ('purchasing', 'purchasing.vendor_list',         N'Vendor List',             '/vendors-list',                'VendorIcon',  1);
INSERT INTO @ScreenSeed VALUES ('purchasing', 'purchasing.purchase_order',      N'Purchase Orders',         '/purchase-orders-list',        'VendorIcon',  2);
INSERT INTO @ScreenSeed VALUES ('purchasing', 'purchasing.receive_order',       N'Receive Orders',          '/receive-orders-list',         'VendorIcon',  3);
INSERT INTO @ScreenSeed VALUES ('purchasing', 'purchasing.general_order',       N'General Order',           '/general-order-list',          'VendorIcon',  4);
INSERT INTO @ScreenSeed VALUES ('purchasing', 'purchasing.pay_bills',           N'Pay Bills',               '/payments-list',               'VendorIcon',  5);
INSERT INTO @ScreenSeed VALUES ('purchasing', 'purchasing.return_to_vendor',    N'Return To Vendor',        '/return-to-vendor-list',       'VendorIcon',  6);

-- ======== CUSTOMERS SCREENS (9) ========
INSERT INTO @ScreenSeed VALUES ('customers', 'customers.customer_list',                 N'Customer List',                   '/customers-list',                      'CustomerIcon',  1);
INSERT INTO @ScreenSeed VALUES ('customers', 'customers.phone_order_list',              N'Phone Order List',                '/phone-orders-list',                   'CustomerIcon',  2);
INSERT INTO @ScreenSeed VALUES ('customers', 'customers.items_on_phone_order',          N'Items On Phone Order',            '/items-on-phone-order-list',           'CustomerIcon',  3);
INSERT INTO @ScreenSeed VALUES ('customers', 'customers.item_details_on_phone_order',   N'Items Details on Phone Order',    '/item-details-on-phone-order-list',    'CustomerIcon',  4);
INSERT INTO @ScreenSeed VALUES ('customers', 'customers.replaced_items',                N'Replaced Items',                  '/replaced-items-list',                 'CustomerIcon',  5);
INSERT INTO @ScreenSeed VALUES ('customers', 'customers.receive_payment',               N'Receive Payment',                 '/receive-payments-list',               'CustomerIcon',  6);
INSERT INTO @ScreenSeed VALUES ('customers', 'customers.crm',                           N'CRM',                             '/crm',                                 'CustomerIcon',  7);
INSERT INTO @ScreenSeed VALUES ('customers', 'customers.task_list',                     N'Task List',                       '/crm/tasks',                           'CustomerIcon',  8);
INSERT INTO @ScreenSeed VALUES ('customers', 'customers.call_list',                     N'Call List',                       '/crm/calls',                           'CustomerIcon',  9);

-- ======== REGISTERS SCREENS (8) ========
INSERT INTO @ScreenSeed VALUES ('registers', 'registers.transactions',          N'Transactions',            '/transactions-list',           'RegisterIcon',  1);
INSERT INTO @ScreenSeed VALUES ('registers', 'registers.register_list',         N'Registers',               '/registers-list',              'RegisterIcon',  2);
INSERT INTO @ScreenSeed VALUES ('registers', 'registers.register_settings',     N'Register Settings',       '/register-settings',           'RegisterIcon',  3);
INSERT INTO @ScreenSeed VALUES ('registers', 'registers.user_security',         N'User Security',           '/register-user-security',      'RegisterIcon',  4);
INSERT INTO @ScreenSeed VALUES ('registers', 'registers.layaway_list',          N'Layaway List',            '/layaway-list',                'RegisterIcon',  5);
INSERT INTO @ScreenSeed VALUES ('registers', 'registers.layaway_items',         N'Layaway Items',           '/layaway-items',               'RegisterIcon',  6);
INSERT INTO @ScreenSeed VALUES ('registers', 'registers.pos',                   N'POS',                     '/pos',                         'RegisterIcon',  7);
INSERT INTO @ScreenSeed VALUES ('registers', 'registers.time_attendance',       N'Time Attendance',         '/time-attendance',             'RegisterIcon',  8);

-- ======== SALES & DISCOUNTS SCREENS (5) ========
INSERT INTO @ScreenSeed VALUES ('sales', 'sales.discount_list',        N'Discount List',           '/discounts-list',              'SalesAndDiscountIcon',  1);
INSERT INTO @ScreenSeed VALUES ('sales', 'sales.new_discount',         N'New Discount',            '/discount/new',                'SalesAndDiscountIcon',  2);
INSERT INTO @ScreenSeed VALUES ('sales', 'sales.bogo_discount',        N'New Bogo Discount',       '/bogo-discount/new',           'SalesAndDiscountIcon',  3);
INSERT INTO @ScreenSeed VALUES ('sales', 'sales.loyalty_management',   N'Loyalty Management',      '/loyalty-management',          'SalesAndDiscountIcon',  4);
INSERT INTO @ScreenSeed VALUES ('sales', 'sales.bonus_points',         N'Bonus Points',            '/bonus-points',                'SalesAndDiscountIcon',  5);

-- ======== STORES SCREENS (4) ========
INSERT INTO @ScreenSeed VALUES ('stores', 'stores.request_transfer',   N'Request Transfer',        '/request-transfer-list',       'StoreIcon',  1);
INSERT INTO @ScreenSeed VALUES ('stores', 'stores.transfers',          N'Transfers',               '/transfers-list',              'StoreIcon',  2);
INSERT INTO @ScreenSeed VALUES ('stores', 'stores.transfer_received',  N'Transfer Received',       '/receive-transfer-list',       'StoreIcon',  3);
INSERT INTO @ScreenSeed VALUES ('stores', 'stores.store_list',         N'Store List',              '/stores-list',                 'StoreIcon',  4);

-- ======== ADMINISTRATOR SCREENS (9) ========
INSERT INTO @ScreenSeed VALUES ('admin', 'admin.computers',            N'Computers',               '/computers-list',              'PieChartIcon',  1);
INSERT INTO @ScreenSeed VALUES ('admin', 'admin.users',                N'Users',                   '/users-list',                  'PieChartIcon',  2);
INSERT INTO @ScreenSeed VALUES ('admin', 'admin.api_logs',             N'API Logs',                '/request-response-logs',       'PieChartIcon',  3);
INSERT INTO @ScreenSeed VALUES ('admin', 'admin.role_management',      N'Role Management',         '/role-management',             'PieChartIcon',  4);
INSERT INTO @ScreenSeed VALUES ('admin', 'admin.tenant_roles',         N'Tenant Roles',            '/tenant-role-management',      'PieChartIcon',  5);
INSERT INTO @ScreenSeed VALUES ('admin', 'admin.admin_registers',      N'Registers',               '/admin/registers',             'PieChartIcon',  6);
INSERT INTO @ScreenSeed VALUES ('admin', 'admin.setup',                N'Setup',                   '/admin/setup',                 'PieChartIcon',  7);
INSERT INTO @ScreenSeed VALUES ('admin', 'admin.admin_user_security',  N'User Security',           '/admin/user-security',         'PieChartIcon',  8);
INSERT INTO @ScreenSeed VALUES ('admin', 'admin.licenses_billing',     N'Licenses & Billing',      '/licenses-billing',            'PieChartIcon',  9);

-- ======== REPORTS SCREENS (14) ========
INSERT INTO @ScreenSeed VALUES ('reports', 'reports.report_manager',           N'Report Manager',              '/report-manager',                      'BoxCubeIcon',  1);
INSERT INTO @ScreenSeed VALUES ('reports', 'reports.ar_aging',                 N'AR Aging',                    '/reports/ar-aging',                    'BoxCubeIcon',  2);
INSERT INTO @ScreenSeed VALUES ('reports', 'reports.customer_list_report',     N'Customer List Report',        '/reports/customer-list',               'BoxCubeIcon',  3);
INSERT INTO @ScreenSeed VALUES ('reports', 'reports.department_inventory',     N'Department Inventory',        '/reports/department-inventory',        'BoxCubeIcon',  4);
INSERT INTO @ScreenSeed VALUES ('reports', 'reports.item_inventory',           N'Item Inventory',              '/reports/item-inventory',              'BoxCubeIcon',  5);
INSERT INTO @ScreenSeed VALUES ('reports', 'reports.items_in_partial_receive', N'Items In Partial Receive',    '/reports/items-in-partial-receive',    'BoxCubeIcon',  6);
INSERT INTO @ScreenSeed VALUES ('reports', 'reports.items_on_purchase_order',  N'Items On Purchase Order',     '/reports/items-on-purchase-order',     'BoxCubeIcon',  7);
INSERT INTO @ScreenSeed VALUES ('reports', 'reports.items_on_receive_order',   N'Items On Receive Order',      '/reports/items-on-receive-order',      'BoxCubeIcon',  8);
INSERT INTO @ScreenSeed VALUES ('reports', 'reports.items_report',             N'Items Report',                '/reports/items',                       'BoxCubeIcon',  9);
INSERT INTO @ScreenSeed VALUES ('reports', 'reports.price_change_history',     N'Price Change History',        '/reports/price-change-history',        'BoxCubeIcon', 10);
INSERT INTO @ScreenSeed VALUES ('reports', 'reports.receive_inventory_value',  N'Receive Inventory Value',     '/reports/receive-inventory-value',     'BoxCubeIcon', 11);
INSERT INTO @ScreenSeed VALUES ('reports', 'reports.returned_items',           N'Returned Items',              '/reports/returned-items',              'BoxCubeIcon', 12);
INSERT INTO @ScreenSeed VALUES ('reports', 'reports.tax_by_store',             N'Tax By Store',                '/reports/tax-by-store',                'BoxCubeIcon', 13);
INSERT INTO @ScreenSeed VALUES ('reports', 'reports.tax_collected',            N'Tax Collected',               '/reports/tax-collected',               'BoxCubeIcon', 14);

-- Insert screens (NOT EXISTS = idempotent)
INSERT INTO dbo.Screens (ModuleId, Code, Name, Route, Icon, SortOrder, IsActive, CreatedAt)
SELECT m.ModuleId, s.ScreenCode, s.ScreenName, s.Route, s.Icon, s.SortOrder, 1, SYSUTCDATETIME()
FROM @ScreenSeed s
INNER JOIN dbo.Modules m ON m.Code = s.ModuleCode
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Screens sc WHERE sc.Code = s.ScreenCode
);

DECLARE @ScreenCount INT;
SELECT @ScreenCount = COUNT(*) FROM @ScreenSeed;
PRINT '  [OK] Screens seeded (' + CAST(@ScreenCount AS VARCHAR(5)) + ' defined).';

-- --------------------------------------------------------------------------
-- C4. Seed Permissions  (1:1 match with Perms.cs constants)
-- --------------------------------------------------------------------------
PRINT '';
PRINT '  Seeding Permissions...';

DECLARE @PermSeed TABLE (
    PermissionKey   VARCHAR(150),
    PermName        NVARCHAR(150),
    Category        VARCHAR(20),
    SortOrder       INT
);

-- ====================================================================
-- INVENTORY PERMISSIONS  (8 screens, actions match actual page buttons)
-- ====================================================================

-- inventory.item_list  (Add New, Edit, Delete, Export CSV/PDF/Excel, Import, Print)
INSERT INTO @PermSeed VALUES ('inventory.item_list.view',         N'View',              'action', 1);
INSERT INTO @PermSeed VALUES ('inventory.item_list.create',       N'Create',            'action', 2);
INSERT INTO @PermSeed VALUES ('inventory.item_list.edit',         N'Edit',              'action', 3);
INSERT INTO @PermSeed VALUES ('inventory.item_list.delete',       N'Delete',            'action', 4);
INSERT INTO @PermSeed VALUES ('inventory.item_list.export',       N'Export',            'action', 5);
INSERT INTO @PermSeed VALUES ('inventory.item_list.import',       N'Import',            'action', 6);
INSERT INTO @PermSeed VALUES ('inventory.item_list.print',        N'Print',             'action', 7);
INSERT INTO @PermSeed VALUES ('inventory.item_list.view_summary', N'View Summary Cards','action', 8);

-- inventory.item_quick_list  (View, Export, Print)
INSERT INTO @PermSeed VALUES ('inventory.item_quick_list.view',     N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('inventory.item_quick_list.export',   N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('inventory.item_quick_list.print',    N'Print',   'action', 3);

-- inventory.item_group  (Add New, Edit, Delete)
INSERT INTO @PermSeed VALUES ('inventory.item_group.view',      N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('inventory.item_group.create',    N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('inventory.item_group.edit',      N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('inventory.item_group.delete',    N'Delete',  'action', 4);

-- inventory.department  (Add New, Edit, Delete)
INSERT INTO @PermSeed VALUES ('inventory.department.view',      N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('inventory.department.create',    N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('inventory.department.edit',      N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('inventory.department.delete',    N'Delete',  'action', 4);

-- inventory.manufacturer  (Add New, Edit, Delete)
INSERT INTO @PermSeed VALUES ('inventory.manufacturer.view',    N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('inventory.manufacturer.create',  N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('inventory.manufacturer.edit',    N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('inventory.manufacturer.delete',  N'Delete',  'action', 4);

-- inventory.items_with_inventory  (View only, Export, Print)
INSERT INTO @PermSeed VALUES ('inventory.items_with_inventory.view',    N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('inventory.items_with_inventory.export',  N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('inventory.items_with_inventory.print',   N'Print',   'action', 3);

-- inventory.label_designer  (New, Edit, Delete, Print labels)
INSERT INTO @PermSeed VALUES ('inventory.label_designer.view',      N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('inventory.label_designer.create',    N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('inventory.label_designer.edit',      N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('inventory.label_designer.delete',    N'Delete',  'action', 4);
INSERT INTO @PermSeed VALUES ('inventory.label_designer.print',     N'Print',   'action', 5);

-- inventory.adjust_inventory  (Save, Export CSV/Excel, Print Report)
INSERT INTO @PermSeed VALUES ('inventory.adjust_inventory.view',    N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('inventory.adjust_inventory.create',  N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('inventory.adjust_inventory.export',  N'Export',  'action', 3);
INSERT INTO @PermSeed VALUES ('inventory.adjust_inventory.print',   N'Print',   'action', 4);

-- ====================================================================
-- PURCHASING / VENDORS PERMISSIONS  (6 screens)
-- ====================================================================

-- purchasing.vendor_list  (Add New, Edit, Delete, Export, Print)
INSERT INTO @PermSeed VALUES ('purchasing.vendor_list.view',    N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('purchasing.vendor_list.create',  N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('purchasing.vendor_list.edit',    N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('purchasing.vendor_list.delete',  N'Delete',  'action', 4);
INSERT INTO @PermSeed VALUES ('purchasing.vendor_list.export',  N'Export',  'action', 5);
INSERT INTO @PermSeed VALUES ('purchasing.vendor_list.print',   N'Print',   'action', 6);

-- purchasing.purchase_order  (Add New, Edit, Delete, Export, Print)
INSERT INTO @PermSeed VALUES ('purchasing.purchase_order.view',     N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('purchasing.purchase_order.create',   N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('purchasing.purchase_order.edit',     N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('purchasing.purchase_order.delete',   N'Delete',  'action', 4);
INSERT INTO @PermSeed VALUES ('purchasing.purchase_order.export',   N'Export',  'action', 5);
INSERT INTO @PermSeed VALUES ('purchasing.purchase_order.print',    N'Print',   'action', 6);

-- purchasing.receive_order  (Add New, Edit, Delete, Void, Export, Print)
INSERT INTO @PermSeed VALUES ('purchasing.receive_order.view',      N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('purchasing.receive_order.create',    N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('purchasing.receive_order.edit',      N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('purchasing.receive_order.delete',    N'Delete',  'action', 4);
INSERT INTO @PermSeed VALUES ('purchasing.receive_order.void',      N'Void',    'action', 5);
INSERT INTO @PermSeed VALUES ('purchasing.receive_order.export',    N'Export',  'action', 6);
INSERT INTO @PermSeed VALUES ('purchasing.receive_order.print',     N'Print',   'action', 7);

-- purchasing.general_order  (View, Delete/Remove, Export, Print)
INSERT INTO @PermSeed VALUES ('purchasing.general_order.view',      N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('purchasing.general_order.delete',    N'Delete',  'action', 2);
INSERT INTO @PermSeed VALUES ('purchasing.general_order.export',    N'Export',  'action', 3);
INSERT INTO @PermSeed VALUES ('purchasing.general_order.print',     N'Print',   'action', 4);

-- purchasing.pay_bills  (Add New, Edit, Delete, Void, Export, Print)
INSERT INTO @PermSeed VALUES ('purchasing.pay_bills.view',      N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('purchasing.pay_bills.create',    N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('purchasing.pay_bills.edit',      N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('purchasing.pay_bills.delete',    N'Delete',  'action', 4);
INSERT INTO @PermSeed VALUES ('purchasing.pay_bills.void',      N'Void',    'action', 5);
INSERT INTO @PermSeed VALUES ('purchasing.pay_bills.export',    N'Export',  'action', 6);
INSERT INTO @PermSeed VALUES ('purchasing.pay_bills.print',     N'Print',   'action', 7);

-- purchasing.return_to_vendor  (Add New, Edit, Delete, Void, Export, Print)
INSERT INTO @PermSeed VALUES ('purchasing.return_to_vendor.view',       N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('purchasing.return_to_vendor.create',     N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('purchasing.return_to_vendor.edit',       N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('purchasing.return_to_vendor.delete',     N'Delete',  'action', 4);
INSERT INTO @PermSeed VALUES ('purchasing.return_to_vendor.void',       N'Void',    'action', 5);
INSERT INTO @PermSeed VALUES ('purchasing.return_to_vendor.export',     N'Export',  'action', 6);
INSERT INTO @PermSeed VALUES ('purchasing.return_to_vendor.print',      N'Print',   'action', 7);

-- ====================================================================
-- CUSTOMERS PERMISSIONS  (9 screens)
-- ====================================================================

-- customers.customer_list  (Add New, Edit, Delete, Bulk Edit, Export, Print)
INSERT INTO @PermSeed VALUES ('customers.customer_list.view',       N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('customers.customer_list.create',     N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('customers.customer_list.edit',       N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('customers.customer_list.delete',     N'Delete',  'action', 4);
INSERT INTO @PermSeed VALUES ('customers.customer_list.export',     N'Export',  'action', 5);
INSERT INTO @PermSeed VALUES ('customers.customer_list.print',      N'Print',   'action', 6);

-- customers.phone_order_list  (Add New, Edit, Delete, Void, Print, Export, Change Status, Change Priority)
INSERT INTO @PermSeed VALUES ('customers.phone_order_list.view',            N'View',            'action', 1);
INSERT INTO @PermSeed VALUES ('customers.phone_order_list.create',          N'Create',          'action', 2);
INSERT INTO @PermSeed VALUES ('customers.phone_order_list.edit',            N'Edit',            'action', 3);
INSERT INTO @PermSeed VALUES ('customers.phone_order_list.delete',          N'Delete',          'action', 4);
INSERT INTO @PermSeed VALUES ('customers.phone_order_list.void',            N'Void',            'action', 5);
INSERT INTO @PermSeed VALUES ('customers.phone_order_list.export',          N'Export',          'action', 6);
INSERT INTO @PermSeed VALUES ('customers.phone_order_list.print',           N'Print',           'action', 7);
INSERT INTO @PermSeed VALUES ('customers.phone_order_list.change_status',   N'Change Status',   'action', 8);
INSERT INTO @PermSeed VALUES ('customers.phone_order_list.change_priority', N'Change Priority',  'action', 9);

-- customers.items_on_phone_order  (View, Export, Print)
INSERT INTO @PermSeed VALUES ('customers.items_on_phone_order.view',    N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('customers.items_on_phone_order.export',  N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('customers.items_on_phone_order.print',   N'Print',   'action', 3);

-- customers.item_details_on_phone_order  (View, Export, Print)
INSERT INTO @PermSeed VALUES ('customers.item_details_on_phone_order.view',     N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('customers.item_details_on_phone_order.export',   N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('customers.item_details_on_phone_order.print',    N'Print',   'action', 3);

-- customers.replaced_items  (View, Delete, Export, Print)
INSERT INTO @PermSeed VALUES ('customers.replaced_items.view',      N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('customers.replaced_items.delete',    N'Delete',  'action', 2);
INSERT INTO @PermSeed VALUES ('customers.replaced_items.export',    N'Export',  'action', 3);
INSERT INTO @PermSeed VALUES ('customers.replaced_items.print',     N'Print',   'action', 4);

-- customers.receive_payment  (View, Export, Print)
INSERT INTO @PermSeed VALUES ('customers.receive_payment.view',     N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('customers.receive_payment.export',   N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('customers.receive_payment.print',    N'Print',   'action', 3);

-- customers.crm  (View - placeholder)
INSERT INTO @PermSeed VALUES ('customers.crm.view',    N'View',    'action', 1);

-- customers.task_list  (Add, Edit, Delete, Assign)
INSERT INTO @PermSeed VALUES ('customers.task_list.view',       N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('customers.task_list.create',     N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('customers.task_list.edit',       N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('customers.task_list.delete',     N'Delete',  'action', 4);
INSERT INTO @PermSeed VALUES ('customers.task_list.assign',     N'Assign',  'action', 5);

-- customers.call_list  (Add, Edit)
INSERT INTO @PermSeed VALUES ('customers.call_list.view',       N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('customers.call_list.create',     N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('customers.call_list.edit',       N'Edit',    'action', 3);

-- ====================================================================
-- REGISTERS PERMISSIONS  (8 screens)
-- ====================================================================

-- registers.transactions  (View, Export, Print)
INSERT INTO @PermSeed VALUES ('registers.transactions.view',    N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('registers.transactions.export',  N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('registers.transactions.print',   N'Print',   'action', 3);

-- registers.register_list  (Add, Edit, Delete)
INSERT INTO @PermSeed VALUES ('registers.register_list.view',       N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('registers.register_list.create',     N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('registers.register_list.edit',       N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('registers.register_list.delete',     N'Delete',  'action', 4);

-- registers.register_settings  (View, Edit)
INSERT INTO @PermSeed VALUES ('registers.register_settings.view',   N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('registers.register_settings.edit',   N'Edit',    'action', 2);

-- registers.user_security  (View, Edit)
INSERT INTO @PermSeed VALUES ('registers.user_security.view',   N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('registers.user_security.edit',   N'Edit',    'action', 2);

-- registers.layaway_list  (Add, Edit, Delete)
INSERT INTO @PermSeed VALUES ('registers.layaway_list.view',    N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('registers.layaway_list.create',  N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('registers.layaway_list.edit',    N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('registers.layaway_list.delete',  N'Delete',  'action', 4);

-- registers.layaway_items  (View)
INSERT INTO @PermSeed VALUES ('registers.layaway_items.view',   N'View',    'action', 1);

-- registers.pos  (View)
INSERT INTO @PermSeed VALUES ('registers.pos.view',     N'View',    'action', 1);

-- registers.time_attendance  (View, Export, Print)
INSERT INTO @PermSeed VALUES ('registers.time_attendance.view',     N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('registers.time_attendance.export',   N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('registers.time_attendance.print',    N'Print',   'action', 3);

-- ====================================================================
-- SALES & DISCOUNTS PERMISSIONS  (5 screens)
-- ====================================================================

-- sales.discount_list  (Add, Edit, Delete, Export, Print)
INSERT INTO @PermSeed VALUES ('sales.discount_list.view',       N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('sales.discount_list.create',     N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('sales.discount_list.edit',       N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('sales.discount_list.delete',     N'Delete',  'action', 4);
INSERT INTO @PermSeed VALUES ('sales.discount_list.export',     N'Export',  'action', 5);
INSERT INTO @PermSeed VALUES ('sales.discount_list.print',      N'Print',   'action', 6);

-- sales.new_discount  (Create, Edit)
INSERT INTO @PermSeed VALUES ('sales.new_discount.view',    N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('sales.new_discount.create',  N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('sales.new_discount.edit',    N'Edit',    'action', 3);

-- sales.bogo_discount  (Create, Edit)
INSERT INTO @PermSeed VALUES ('sales.bogo_discount.view',   N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('sales.bogo_discount.create', N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('sales.bogo_discount.edit',   N'Edit',    'action', 3);

-- sales.loyalty_management  (CRUD)
INSERT INTO @PermSeed VALUES ('sales.loyalty_management.view',      N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('sales.loyalty_management.create',    N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('sales.loyalty_management.edit',      N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('sales.loyalty_management.delete',    N'Delete',  'action', 4);

-- sales.bonus_points  (CRUD)
INSERT INTO @PermSeed VALUES ('sales.bonus_points.view',    N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('sales.bonus_points.create',  N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('sales.bonus_points.edit',    N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('sales.bonus_points.delete',  N'Delete',  'action', 4);

-- ====================================================================
-- STORES PERMISSIONS  (4 screens)
-- ====================================================================

-- stores.request_transfer  (Add, Edit, Delete, Export, Print)
INSERT INTO @PermSeed VALUES ('stores.request_transfer.view',       N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('stores.request_transfer.create',     N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('stores.request_transfer.edit',       N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('stores.request_transfer.delete',     N'Delete',  'action', 4);
INSERT INTO @PermSeed VALUES ('stores.request_transfer.export',     N'Export',  'action', 5);
INSERT INTO @PermSeed VALUES ('stores.request_transfer.print',      N'Print',   'action', 6);

-- stores.transfers  (View, Export, Print)
INSERT INTO @PermSeed VALUES ('stores.transfers.view',      N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('stores.transfers.export',    N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('stores.transfers.print',     N'Print',   'action', 3);

-- stores.transfer_received  (View, Export, Print)
INSERT INTO @PermSeed VALUES ('stores.transfer_received.view',      N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('stores.transfer_received.export',    N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('stores.transfer_received.print',     N'Print',   'action', 3);

-- stores.store_list  (Add, Edit, Delete)
INSERT INTO @PermSeed VALUES ('stores.store_list.view',     N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('stores.store_list.create',   N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('stores.store_list.edit',     N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('stores.store_list.delete',   N'Delete',  'action', 4);

-- ====================================================================
-- ADMINISTRATOR PERMISSIONS  (8 screens)
-- ====================================================================

-- admin.computers  (Add, Edit, Delete)
INSERT INTO @PermSeed VALUES ('admin.computers.view',       N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('admin.computers.create',     N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('admin.computers.edit',       N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('admin.computers.delete',     N'Delete',  'action', 4);

-- admin.users  (Add, Edit, Delete, Export, Print)
INSERT INTO @PermSeed VALUES ('admin.users.view',       N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('admin.users.create',     N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('admin.users.edit',       N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('admin.users.delete',     N'Delete',  'action', 4);
INSERT INTO @PermSeed VALUES ('admin.users.export',     N'Export',  'action', 5);
INSERT INTO @PermSeed VALUES ('admin.users.print',      N'Print',   'action', 6);

-- admin.api_logs  (View, Export)
INSERT INTO @PermSeed VALUES ('admin.api_logs.view',    N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('admin.api_logs.export',  N'Export',  'action', 2);

-- admin.role_management  (CRUD)
INSERT INTO @PermSeed VALUES ('admin.role_management.view',     N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('admin.role_management.create',   N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('admin.role_management.edit',     N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('admin.role_management.delete',   N'Delete',  'action', 4);

-- admin.tenant_roles  (CRUD)
INSERT INTO @PermSeed VALUES ('admin.tenant_roles.view',    N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('admin.tenant_roles.create',  N'Create',  'action', 2);
INSERT INTO @PermSeed VALUES ('admin.tenant_roles.edit',    N'Edit',    'action', 3);
INSERT INTO @PermSeed VALUES ('admin.tenant_roles.delete',  N'Delete',  'action', 4);

-- admin.admin_registers  (View, Edit)
INSERT INTO @PermSeed VALUES ('admin.admin_registers.view',     N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('admin.admin_registers.edit',     N'Edit',    'action', 2);

-- admin.setup  (View, Edit)
INSERT INTO @PermSeed VALUES ('admin.setup.view',   N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('admin.setup.edit',   N'Edit',    'action', 2);

-- admin.admin_user_security  (View, Edit)
INSERT INTO @PermSeed VALUES ('admin.admin_user_security.view',     N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('admin.admin_user_security.edit',     N'Edit',    'action', 2);

-- admin.licenses_billing  (View, Edit)
INSERT INTO @PermSeed VALUES ('admin.licenses_billing.view',    N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('admin.licenses_billing.edit',    N'Edit',    'action', 2);

-- ====================================================================
-- REPORTS PERMISSIONS  (14 screens - all view/export/print)
-- ====================================================================

INSERT INTO @PermSeed VALUES ('reports.report_manager.view',    N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('reports.report_manager.export',  N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('reports.report_manager.print',   N'Print',   'action', 3);

INSERT INTO @PermSeed VALUES ('reports.ar_aging.view',      N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('reports.ar_aging.export',    N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('reports.ar_aging.print',     N'Print',   'action', 3);

INSERT INTO @PermSeed VALUES ('reports.customer_list_report.view',      N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('reports.customer_list_report.export',    N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('reports.customer_list_report.print',     N'Print',   'action', 3);

INSERT INTO @PermSeed VALUES ('reports.department_inventory.view',      N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('reports.department_inventory.export',    N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('reports.department_inventory.print',     N'Print',   'action', 3);

INSERT INTO @PermSeed VALUES ('reports.item_inventory.view',    N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('reports.item_inventory.export',  N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('reports.item_inventory.print',   N'Print',   'action', 3);

INSERT INTO @PermSeed VALUES ('reports.items_in_partial_receive.view',      N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('reports.items_in_partial_receive.export',    N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('reports.items_in_partial_receive.print',     N'Print',   'action', 3);

INSERT INTO @PermSeed VALUES ('reports.items_on_purchase_order.view',       N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('reports.items_on_purchase_order.export',     N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('reports.items_on_purchase_order.print',      N'Print',   'action', 3);

INSERT INTO @PermSeed VALUES ('reports.items_on_receive_order.view',    N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('reports.items_on_receive_order.export',  N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('reports.items_on_receive_order.print',   N'Print',   'action', 3);

INSERT INTO @PermSeed VALUES ('reports.items_report.view',      N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('reports.items_report.export',    N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('reports.items_report.print',     N'Print',   'action', 3);

INSERT INTO @PermSeed VALUES ('reports.price_change_history.view',      N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('reports.price_change_history.export',    N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('reports.price_change_history.print',     N'Print',   'action', 3);

INSERT INTO @PermSeed VALUES ('reports.receive_inventory_value.view',       N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('reports.receive_inventory_value.export',     N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('reports.receive_inventory_value.print',      N'Print',   'action', 3);

INSERT INTO @PermSeed VALUES ('reports.returned_items.view',    N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('reports.returned_items.export',  N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('reports.returned_items.print',   N'Print',   'action', 3);

INSERT INTO @PermSeed VALUES ('reports.tax_by_store.view',      N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('reports.tax_by_store.export',    N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('reports.tax_by_store.print',     N'Print',   'action', 3);

INSERT INTO @PermSeed VALUES ('reports.tax_collected.view',     N'View',    'action', 1);
INSERT INTO @PermSeed VALUES ('reports.tax_collected.export',   N'Export',  'action', 2);
INSERT INTO @PermSeed VALUES ('reports.tax_collected.print',    N'Print',   'action', 3);

-- ==========================================================
-- INSERT PERMISSIONS (idempotent - NOT EXISTS check)
-- ==========================================================
INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt)
SELECT
    m.ModuleId,
    sc.Id,
    ps.PermissionKey,
    ps.PermName,
    ps.Category,
    ps.SortOrder,
    1,
    SYSUTCDATETIME()
FROM @PermSeed ps
CROSS APPLY (SELECT LEFT(ps.PermissionKey, CHARINDEX('.', ps.PermissionKey) - 1) AS ModuleCode) mc
CROSS APPLY (
    SELECT LEFT(ps.PermissionKey,
        CHARINDEX('.', ps.PermissionKey, CHARINDEX('.', ps.PermissionKey) + 1) - 1
    ) AS ScreenCode
) scc
INNER JOIN dbo.Modules m ON m.Code = mc.ModuleCode
INNER JOIN dbo.Screens sc ON sc.Code = scc.ScreenCode
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Permissions p WHERE p.PermissionKey = ps.PermissionKey
);

DECLARE @PermCount INT;
SELECT @PermCount = COUNT(*) FROM @PermSeed;
PRINT '  [OK] Permissions seeded (' + CAST(@PermCount AS VARCHAR(5)) + ' defined).';

-- --------------------------------------------------------------------------
-- C5. Seed PlanModules
-- --------------------------------------------------------------------------
PRINT '';
PRINT '  Seeding PlanModules...';

-- Basic plan: inventory + sales + customers
INSERT INTO dbo.PlanModules (PlanId, ModuleId, IsEnabled)
SELECT p.Id, m.ModuleId, 1
FROM dbo.Plans p
CROSS JOIN dbo.Modules m
WHERE p.Code = 'basic'
  AND m.Code IN ('inventory', 'sales', 'customers')
  AND NOT EXISTS (
      SELECT 1 FROM dbo.PlanModules pm
      WHERE pm.PlanId = p.Id AND pm.ModuleId = m.ModuleId
  );

-- Standard plan: all except admin
INSERT INTO dbo.PlanModules (PlanId, ModuleId, IsEnabled)
SELECT p.Id, m.ModuleId, 1
FROM dbo.Plans p
CROSS JOIN dbo.Modules m
WHERE p.Code = 'standard'
  AND m.Code IN ('inventory', 'purchasing', 'customers', 'registers', 'sales', 'stores', 'reports')
  AND NOT EXISTS (
      SELECT 1 FROM dbo.PlanModules pm
      WHERE pm.PlanId = p.Id AND pm.ModuleId = m.ModuleId
  );

-- Enterprise plan: all modules
INSERT INTO dbo.PlanModules (PlanId, ModuleId, IsEnabled)
SELECT p.Id, m.ModuleId, 1
FROM dbo.Plans p
CROSS JOIN dbo.Modules m
WHERE p.Code = 'enterprise'
  AND m.Code IN ('inventory', 'purchasing', 'customers', 'registers', 'sales', 'stores', 'admin', 'reports')
  AND NOT EXISTS (
      SELECT 1 FROM dbo.PlanModules pm
      WHERE pm.PlanId = p.Id AND pm.ModuleId = m.ModuleId
  );

PRINT '  [OK] PlanModules seeded.';

-- --------------------------------------------------------------------------
-- C6. Seed default SuperAdmin (only if SystemUsers table is empty)
-- --------------------------------------------------------------------------
PRINT '';
PRINT '  Checking SuperAdmin seed...';

IF NOT EXISTS (SELECT 1 FROM dbo.SystemUsers)
BEGIN
    INSERT INTO dbo.SystemUsers (
        UserName,
        Password,
        IsAdmin,
        DateCreated,
        IsMasterAdmin,
        FullName
    )
    VALUES (
        N'superadmin',
        -- Placeholder BCrypt hash for 'Admin@123' - MUST be changed after first login
        N'$2a$12$LJ3m4ys4Yp.placeholder.hash.replace.after.first.login.000',
        1,
        SYSUTCDATETIME(),
        1,
        N'Super Administrator'
    );
    PRINT '  [OK] Default SuperAdmin user created (username: superadmin).';
    PRINT '  [WARNING] Change the default password immediately after first login!';
END
ELSE
    PRINT '  [SKIP] SystemUsers table is not empty; skipping SuperAdmin seed.';


-- ============================================================================
-- SECTION D: ADD FK CONSTRAINT Customers.PlanId -> Plans.Id
-- ============================================================================

PRINT '';
PRINT '--- Section D: Adding FK constraints ---';

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Customers_Plans')
BEGIN
    ALTER TABLE dbo.Customers
        ADD CONSTRAINT FK_Customers_Plans
        FOREIGN KEY (PlanId) REFERENCES dbo.Plans (Id) ON DELETE SET NULL;
    PRINT '  [OK] FK_Customers_Plans constraint added.';
END
ELSE
    PRINT '  [SKIP] FK_Customers_Plans constraint already exists.';

-- Index on Customers.PlanId for FK performance
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.Customers') AND name = 'IX_Customer_PlanId')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Customer_PlanId ON dbo.Customers (PlanId);
    PRINT '  [OK] Index IX_Customer_PlanId created.';
END
ELSE
    PRINT '  [SKIP] Index IX_Customer_PlanId already exists.';


-- ============================================================================
-- DONE
-- ============================================================================

COMMIT TRANSACTION;

PRINT '';
PRINT '========================================================================';
PRINT 'RBAC Master DB Schema & Seed Script - COMPLETED SUCCESSFULLY';
PRINT 'Time: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 121);
PRINT '========================================================================';

-- Print summary counts
PRINT '';
PRINT '--- Summary ---';
DECLARE @cnt INT;
SELECT @cnt = COUNT(*) FROM dbo.Plans;           PRINT '  Plans:       ' + CAST(@cnt AS VARCHAR(10));
SELECT @cnt = COUNT(*) FROM dbo.Modules WHERE Code IS NOT NULL; PRINT '  Modules:     ' + CAST(@cnt AS VARCHAR(10));
SELECT @cnt = COUNT(*) FROM dbo.Screens;          PRINT '  Screens:     ' + CAST(@cnt AS VARCHAR(10));
SELECT @cnt = COUNT(*) FROM dbo.Permissions;      PRINT '  Permissions: ' + CAST(@cnt AS VARCHAR(10));
SELECT @cnt = COUNT(*) FROM dbo.PlanModules;      PRINT '  PlanModules: ' + CAST(@cnt AS VARCHAR(10));

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT '';
    PRINT '========================================================================';
    PRINT 'ERROR: RBAC Master DB Schema & Seed Script FAILED';
    PRINT 'Error Number:  ' + CAST(ERROR_NUMBER() AS VARCHAR(10));
    PRINT 'Error Message: ' + ERROR_MESSAGE();
    PRINT 'Error Line:    ' + CAST(ERROR_LINE() AS VARCHAR(10));
    PRINT '========================================================================';

    THROW;
END CATCH;

GO
