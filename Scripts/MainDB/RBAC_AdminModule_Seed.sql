/*
================================================================================
Script Name:    RBAC_AdminModule_Seed.sql
Description:    Seeds the "Administration" module, screens, and permissions
                into the MASTER database so that tenant admins can see
                "Roles" and "User Roles" in their dynamic sidebar.

                This script is IDEMPOTENT - safe to run multiple times.

Database:       Master Database (MainDB)

Records Created:
    Module:      "Administration" (code: admin)
    Screens:     admin.roles, admin.user_roles
    Permissions: admin.roles.view, admin.roles.create, admin.roles.edit,
                 admin.roles.delete, admin.user_roles.view, admin.user_roles.edit
================================================================================
*/

SET NOCOUNT ON;

PRINT '========================================================================'
PRINT 'RBAC Admin Module Seed Script'
PRINT 'Database: ' + DB_NAME()
PRINT 'Time: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 121)
PRINT '========================================================================'

-- ============================================================================
-- 1. Module: Administration
-- ============================================================================

DECLARE @AdminModuleId INT;

IF NOT EXISTS (SELECT 1 FROM dbo.Modules WHERE Code = 'admin')
BEGIN
    INSERT INTO dbo.Modules (ModuleName, IsDefault, PageURL, Code, ParentModuleId, Icon, SortOrder, IsActive)
    VALUES (N'Administration', 0, '/tenant-admin', 'admin', NULL, 'AdminIcon', 900, 1);

    SET @AdminModuleId = SCOPE_IDENTITY();
    PRINT '  [OK] Module "Administration" created (ModuleId=' + CAST(@AdminModuleId AS VARCHAR(10)) + ')';
END
ELSE
BEGIN
    SELECT @AdminModuleId = ModuleId FROM dbo.Modules WHERE Code = 'admin';
    PRINT '  [SKIP] Module "Administration" already exists (ModuleId=' + CAST(@AdminModuleId AS VARCHAR(10)) + ')';
END

-- ============================================================================
-- 2. Screen: Roles
-- ============================================================================

DECLARE @RolesScreenId INT;

IF NOT EXISTS (SELECT 1 FROM dbo.Screens WHERE Code = 'admin.roles')
BEGIN
    INSERT INTO dbo.Screens (ModuleId, Code, Name, Route, Icon, SortOrder, IsActive, CreatedAt)
    VALUES (@AdminModuleId, 'admin.roles', N'Roles', '/tenant-admin/roles', NULL, 1, 1, SYSUTCDATETIME());

    SET @RolesScreenId = SCOPE_IDENTITY();
    PRINT '  [OK] Screen "Roles" created (Id=' + CAST(@RolesScreenId AS VARCHAR(10)) + ')';
END
ELSE
BEGIN
    SELECT @RolesScreenId = Id FROM dbo.Screens WHERE Code = 'admin.roles';
    PRINT '  [SKIP] Screen "Roles" already exists (Id=' + CAST(@RolesScreenId AS VARCHAR(10)) + ')';
END

-- ============================================================================
-- 3. Screen: User Roles
-- ============================================================================

DECLARE @UserRolesScreenId INT;

IF NOT EXISTS (SELECT 1 FROM dbo.Screens WHERE Code = 'admin.user_roles')
BEGIN
    INSERT INTO dbo.Screens (ModuleId, Code, Name, Route, Icon, SortOrder, IsActive, CreatedAt)
    VALUES (@AdminModuleId, 'admin.user_roles', N'User Roles', '/tenant-admin/user-roles', NULL, 2, 1, SYSUTCDATETIME());

    SET @UserRolesScreenId = SCOPE_IDENTITY();
    PRINT '  [OK] Screen "User Roles" created (Id=' + CAST(@UserRolesScreenId AS VARCHAR(10)) + ')';
END
ELSE
BEGIN
    SELECT @UserRolesScreenId = Id FROM dbo.Screens WHERE Code = 'admin.user_roles';
    PRINT '  [SKIP] Screen "User Roles" already exists (Id=' + CAST(@UserRolesScreenId AS VARCHAR(10)) + ')';
END

-- ============================================================================
-- 4. Permissions for Roles screen
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'admin.roles.view')
    INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt)
    VALUES (@AdminModuleId, @RolesScreenId, 'admin.roles.view', N'View Roles', 'action', 1, 1, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'admin.roles.create')
    INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt)
    VALUES (@AdminModuleId, @RolesScreenId, 'admin.roles.create', N'Create Role', 'action', 2, 1, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'admin.roles.edit')
    INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt)
    VALUES (@AdminModuleId, @RolesScreenId, 'admin.roles.edit', N'Edit Role', 'action', 3, 1, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'admin.roles.delete')
    INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt)
    VALUES (@AdminModuleId, @RolesScreenId, 'admin.roles.delete', N'Delete Role', 'action', 4, 1, SYSUTCDATETIME());

PRINT '  [OK] Roles screen permissions seeded';

-- ============================================================================
-- 5. Permissions for User Roles screen
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'admin.user_roles.view')
    INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt)
    VALUES (@AdminModuleId, @UserRolesScreenId, 'admin.user_roles.view', N'View User Roles', 'action', 1, 1, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'admin.user_roles.edit')
    INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt)
    VALUES (@AdminModuleId, @UserRolesScreenId, 'admin.user_roles.edit', N'Edit User Roles', 'action', 2, 1, SYSUTCDATETIME());

PRINT '  [OK] User Roles screen permissions seeded';

-- ============================================================================
PRINT ''
PRINT '========================================================================'
PRINT 'RBAC Admin Module Seed - COMPLETED'
PRINT 'Module: Administration (code=admin, id=' + CAST(@AdminModuleId AS VARCHAR(10)) + ')'
PRINT 'Screens: admin.roles, admin.user_roles'
PRINT 'Permissions: 6 total (view/create/edit/delete for roles, view/edit for user_roles)'
PRINT ''
PRINT 'NEXT STEPS:'
PRINT '  1. Go to Permission Ceiling page in Super Admin'
PRINT '  2. Select a tenant and enable the Administration module + permissions'
PRINT '  3. Click "Initialize Customer Admin" to sync ceiling to admin role'
PRINT '  4. The tenant admin will now see Roles and User Roles in their sidebar'
PRINT '========================================================================'
GO
