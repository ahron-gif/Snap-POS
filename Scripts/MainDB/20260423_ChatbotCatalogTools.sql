/*
================================================================================
Script Name:    20260423_ChatbotCatalogTools.sql
Description:    Seeds permissions for catalog / reporting chatbot tools
                (items, item groups, departments, manufacturers, discounts,
                MTD sales by store).

                Run against: MAIN Database (e.g. RDTCloud_Dev / RDTCloud)
                Idempotent:  safe to run multiple times

                Prerequisites:
                - 20260420_ChatbotPermissions.sql must have been run first
                  (requires the 'chatbot' module and 'chatbot.assistant' screen).
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '========================================================================';
PRINT 'Seed Chatbot Catalog Tool Permissions';
PRINT 'Database: ' + DB_NAME();
PRINT '========================================================================';

BEGIN TRY
    IF OBJECT_ID('dbo.Modules',     'U') IS NULL OR
       OBJECT_ID('dbo.Screens',     'U') IS NULL OR
       OBJECT_ID('dbo.Permissions', 'U') IS NULL
    BEGIN
        DECLARE @msg NVARCHAR(500) =
            N'Required RBAC tables not found in database [' + DB_NAME()
            + N']. Run 20260420_ChatbotPermissions.sql first.';
        THROW 50000, @msg, 1;
    END

    BEGIN TRANSACTION;

    DECLARE @ModuleId INT;
    DECLARE @ScreenId INT;

    SELECT @ModuleId = ModuleId FROM dbo.Modules WHERE Code = 'chatbot';
    SELECT @ScreenId = Id       FROM dbo.Screens WHERE Code = 'chatbot.assistant';

    IF @ModuleId IS NULL OR @ScreenId IS NULL
    BEGIN
        THROW 50000, N'Chatbot module/screen not found. Run 20260420_ChatbotPermissions.sql first.', 1;
    END

    DECLARE @PermSeed TABLE (PermissionKey VARCHAR(150), DisplayName NVARCHAR(150), Category VARCHAR(20), SortOrder INT);

    INSERT INTO @PermSeed (PermissionKey, DisplayName, Category, SortOrder) VALUES
    ('chatbot.tool.list_items',             N'Tool: List items (detailed)',        'action', 40),
    ('chatbot.tool.list_items_quick',       N'Tool: List items (quick lookup)',    'action', 41),
    ('chatbot.tool.list_item_groups',       N'Tool: List item groups',             'action', 42),
    ('chatbot.tool.list_departments',       N'Tool: List departments',             'action', 43),
    ('chatbot.tool.list_manufacturers',     N'Tool: List manufacturers',           'action', 44),
    ('chatbot.tool.list_discounts',         N'Tool: List discounts / promotions',  'action', 45),
    ('chatbot.tool.get_sales_mtd_by_store', N'Tool: MTD sales by store (chart)',   'action', 46);

    INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt)
    SELECT @ModuleId, @ScreenId, p.PermissionKey, p.DisplayName, p.Category, p.SortOrder, 1, SYSUTCDATETIME()
    FROM @PermSeed p
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions x WHERE x.PermissionKey = p.PermissionKey);

    DECLARE @PermsInserted INT = @@ROWCOUNT;
    PRINT '  [OK] Catalog tool permissions inserted (new): ' + CAST(@PermsInserted AS VARCHAR(5));

    COMMIT TRANSACTION;

    PRINT '';
    PRINT '========================================================================';
    PRINT 'Chatbot Catalog Tool Permissions Seed - COMPLETED';
    PRINT '';
    PRINT 'NEXT STEPS:';
    PRINT '  1. Assign the 7 new chatbot.tool.* keys to appropriate roles via the';
    PRINT '     Tenant RBAC UI.';
    PRINT '========================================================================';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO
