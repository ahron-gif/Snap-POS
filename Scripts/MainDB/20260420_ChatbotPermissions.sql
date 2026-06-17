/*
================================================================================
Script Name:    20260420_ChatbotPermissions.sql
Description:    Seeds Chatbot module, screen, and per-tool permissions in the
                MAIN database. Each tool becomes a permission key that can be
                assigned to RbacTenantRoles via the existing admin UI.

                Run against: MAIN Database (e.g. RDTCloud_Dev / RDTCloud)
                Idempotent:  safe to run multiple times

                Prerequisites:
                - dbo.Modules, dbo.Screens, dbo.Permissions must already exist
                - If they do not, run RBAC_MasterDB_Schema_And_Seed.sql first.
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '========================================================================';
PRINT 'Seed Chatbot Module, Screen, and Permissions';
PRINT 'Database: ' + DB_NAME();
PRINT '========================================================================';

BEGIN TRY
    -- Pre-flight inside TRY so a missing prerequisite fails cleanly without
    -- parsing errors on the Modules reference later.
    IF OBJECT_ID('dbo.Modules',     'U') IS NULL OR
       OBJECT_ID('dbo.Screens',     'U') IS NULL OR
       OBJECT_ID('dbo.Permissions', 'U') IS NULL
    BEGIN
        DECLARE @msg NVARCHAR(500) =
            N'Required RBAC tables (Modules / Screens / Permissions) not found in database [' + DB_NAME()
            + N']. Run against the MAIN DB, or run RBAC_MasterDB_Schema_And_Seed.sql first.';
        THROW 50000, @msg, 1;
    END

    BEGIN TRANSACTION;

    -- ----------------------------------------------------------------------
    -- Module
    -- ----------------------------------------------------------------------
    DECLARE @ModuleId INT;
    SELECT @ModuleId = ModuleId FROM dbo.Modules WHERE Code = 'chatbot';

    IF @ModuleId IS NULL
    BEGIN
        INSERT INTO dbo.Modules (ModuleName, IsDefault, PageURL, Code, SortOrder, IsActive)
        VALUES (N'AI Assistant', 0, '/chat', 'chatbot', 900, 1);

        SET @ModuleId = SCOPE_IDENTITY();
        PRINT '  [OK] Chatbot module created. ModuleId=' + CAST(@ModuleId AS VARCHAR(10));
    END
    ELSE
    BEGIN
        PRINT '  [SKIP] Chatbot module already exists. ModuleId=' + CAST(@ModuleId AS VARCHAR(10));
    END

    -- ----------------------------------------------------------------------
    -- Screen
    -- ----------------------------------------------------------------------
    DECLARE @ScreenId INT;
    SELECT @ScreenId = Id FROM dbo.Screens WHERE Code = 'chatbot.assistant';

    IF @ScreenId IS NULL
    BEGIN
        INSERT INTO dbo.Screens (ModuleId, Code, Name, Route, Icon, SortOrder, IsActive, CreatedAt)
        VALUES (@ModuleId, 'chatbot.assistant', N'AI Assistant', '/chat', 'ChatBubbleIcon', 1, 1, SYSUTCDATETIME());

        SET @ScreenId = SCOPE_IDENTITY();
        PRINT '  [OK] Chatbot screen created. ScreenId=' + CAST(@ScreenId AS VARCHAR(10));
    END
    ELSE
    BEGIN
        PRINT '  [SKIP] Chatbot screen already exists. ScreenId=' + CAST(@ScreenId AS VARCHAR(10));
    END

    -- ----------------------------------------------------------------------
    -- Permissions
    -- ----------------------------------------------------------------------
    DECLARE @PermSeed TABLE (PermissionKey VARCHAR(150), DisplayName NVARCHAR(150), Category VARCHAR(20), SortOrder INT);

    INSERT INTO @PermSeed (PermissionKey, DisplayName, Category, SortOrder) VALUES
    ('chatbot.use',                           N'Use AI Assistant (open chat)',         'action', 1),
    ('chatbot.admin.manage_settings',         N'Manage tenant AI settings',            'action', 2),
    ('chatbot.tool.get_item_by_sku',          N'Tool: Look up item by SKU',            'action', 10),
    ('chatbot.tool.search_customers',         N'Tool: Search customers (SENSITIVE)',   'action', 11),
    ('chatbot.tool.get_sales_summary',        N'Tool: Get sales summary',              'action', 12),
    ('chatbot.tool.get_inventory',            N'Tool: Get inventory by store',         'action', 13),
    ('chatbot.tool.get_audit_log',            N'Tool: Query audit log (SENSITIVE)',    'action', 14),
    ('chatbot.tool.draft_purchase_order',     N'Tool: Draft purchase order',           'action', 20),
    ('chatbot.tool.draft_inventory_adjust',   N'Tool: Draft inventory adjustment',     'action', 21);

    INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt)
    SELECT @ModuleId, @ScreenId, p.PermissionKey, p.DisplayName, p.Category, p.SortOrder, 1, SYSUTCDATETIME()
    FROM @PermSeed p
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions x WHERE x.PermissionKey = p.PermissionKey);

    DECLARE @PermsInserted INT = @@ROWCOUNT;
    PRINT '  [OK] Chatbot permissions inserted (new): ' + CAST(@PermsInserted AS VARCHAR(5));

    COMMIT TRANSACTION;

    PRINT '';
    PRINT '========================================================================';
    PRINT 'Chatbot Permissions Seed - COMPLETED';
    PRINT '';
    PRINT 'NEXT STEPS:';
    PRINT '  1. Super Admin > Permission Ceiling: enable Chatbot module for tenants';
    PRINT '     that should have access.';
    PRINT '  2. Tenant RBAC UI: assign chatbot.use + individual chatbot.tool.* keys';
    PRINT '     to each role.';
    PRINT '     Sensitive tools (search_customers, get_audit_log) should be given';
    PRINT '     only to trusted roles such as Manager or Admin.';
    PRINT '========================================================================';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO
