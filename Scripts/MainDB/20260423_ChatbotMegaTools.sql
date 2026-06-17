/*
================================================================================
Script Name:    20260423_ChatbotMegaTools.sql
Description:    Seeds permissions for the large batch of new chatbot tools
                (inventory, sales insights, customers, POs, suppliers, profit,
                and two draft write actions).

                Run against: MAIN Database (e.g. RDTCloud_Dev / RDTCloud)
                Idempotent:  safe to run multiple times

                Prerequisites:
                - 20260420_ChatbotPermissions.sql must have been run first.
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '========================================================================';
PRINT 'Seed Chatbot Mega Tool Permissions';
PRINT 'Database: ' + DB_NAME();
PRINT '========================================================================';

BEGIN TRY
    IF OBJECT_ID('dbo.Modules', 'U') IS NULL OR
       OBJECT_ID('dbo.Screens', 'U') IS NULL OR
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
    -- Inventory
    ('chatbot.tool.get_low_stock_items',         N'Tool: Low stock items (chart)',           'action', 40),
    ('chatbot.tool.get_inventory_by_department', N'Tool: Inventory by department (chart)',   'action', 41),
    ('chatbot.tool.check_item_stock',            N'Tool: Check item stock across stores',    'action', 42),
    -- Sales insights
    ('chatbot.tool.get_sales_trend',             N'Tool: Daily sales trend (chart)',         'action', 50),
    ('chatbot.tool.get_sales_in_date_range',     N'Tool: Sales between two dates (chart)',   'action', 54),
    ('chatbot.tool.get_sales_by_department',     N'Tool: Sales by department (chart)',       'action', 51),
    ('chatbot.tool.get_sales_by_cashier',        N'Tool: Sales by cashier (chart)',          'action', 52),
    ('chatbot.tool.get_sales_by_payment_method', N'Tool: Sales by payment method (chart)',   'action', 53),
    -- Customer intelligence
    ('chatbot.tool.get_top_customers',           N'Tool: Top customers (chart)',             'action', 60),
    ('chatbot.tool.get_customers_owe_money',     N'Tool: Customers with open balance',       'action', 61),
    ('chatbot.tool.get_customer_purchase_history', N'Tool: Customer purchase history',       'action', 62),
    -- PO / suppliers
    ('chatbot.tool.get_open_purchase_orders',    N'Tool: Open purchase orders',              'action', 70),
    ('chatbot.tool.list_suppliers',              N'Tool: List suppliers',                    'action', 71),
    -- Profit
    ('chatbot.tool.get_profit_summary',          N'Tool: Profit summary',                    'action', 80),
    ('chatbot.tool.get_low_margin_items',        N'Tool: Low-margin items',                  'action', 81),
    -- Draft write actions (SENSITIVE)
    ('chatbot.tool.draft_price_change',          N'Tool: Draft price change (SENSITIVE)',    'action', 90),
    ('chatbot.tool.draft_inventory_adjust',      N'Tool: Draft inventory adjust (SENSITIVE)', 'action', 91);

    INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt)
    SELECT @ModuleId, @ScreenId, p.PermissionKey, p.DisplayName, p.Category, p.SortOrder, 1, SYSUTCDATETIME()
    FROM @PermSeed p
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions x WHERE x.PermissionKey = p.PermissionKey);

    DECLARE @PermsInserted INT = @@ROWCOUNT;
    PRINT '  [OK] Chat tool permissions inserted (new): ' + CAST(@PermsInserted AS VARCHAR(5));

    COMMIT TRANSACTION;

    PRINT '';
    PRINT '========================================================================';
    PRINT 'Chatbot Mega Tool Permissions Seed - COMPLETED';
    PRINT '';
    PRINT 'NEXT STEPS (per tenant DB):';
    PRINT '  - Run 20260423_ChatbotMessageVisualizations.sql against each TENANT DB';
    PRINT '    to add VisualizationsJson and SuggestedFollowUpsJson columns to';
    PRINT '    dbo.ChatMessages.';
    PRINT '  - Assign the new chatbot.tool.* permission keys to the appropriate';
    PRINT '    RBAC roles. Draft write tools (price_change, inventory_adjust)';
    PRINT '    should be restricted to manager/admin roles.';
    PRINT '========================================================================';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO
