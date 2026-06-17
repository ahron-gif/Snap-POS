/*
================================================================================
Script Name:    SeedReportManagerScreensAndPermissions.sql
Description:    Seeds Screens and Permissions in the MASTER database for every
                report card shown in Report Manager. Each report has a screen
                (Code = reports.<screen_code>) and a View permission used for
                show/hide by usePermission().

                Run against: Master Database (RDTCloud / MainDB)
                Idempotent: safe to run multiple times (IF NOT EXISTS).

Usage:          Execute against Master DB after RBAC_MasterDB_Schema_And_Seed.sql
================================================================================
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '========================================================================';
PRINT 'Seed Report Manager Screens & Permissions';
PRINT 'Database: ' + DB_NAME();
PRINT 'Time: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 121);
PRINT '========================================================================';

BEGIN TRY
BEGIN TRANSACTION;

-- Get Reports module (must exist from RBAC seed)
DECLARE @ReportsModuleId INT;
SELECT @ReportsModuleId = ModuleId FROM dbo.Modules WHERE Code = 'reports';

IF @ReportsModuleId IS NULL
BEGIN
    RAISERROR('Reports module not found. Run RBAC_MasterDB_Schema_And_Seed.sql first.', 16, 1);
    RETURN;
END

-- Screen seed: (Code, Name, SortOrder). Route = /report-manager for all (opened from Report Manager).
DECLARE @ScreenSeed TABLE (ScreenCode VARCHAR(100), ScreenName NVARCHAR(150), SortOrder INT);

INSERT INTO @ScreenSeed (ScreenCode, ScreenName, SortOrder) VALUES
('reports.tax_collected', N'Tax Collected', 1),
('reports.tax_by_store', N'Tax By Store', 2),
('reports.returned_items', N'Returned Items', 3),
('reports.items_inventory', N'Items Inventory', 4),
('reports.department_inventory', N'Department Inventory', 5),
('reports.price_change_history', N'Price Change History', 6),
('reports.items_on_purchase_order', N'Items on Purchase Order', 7),
('reports.items_on_receive_order', N'Items on Receive Order', 8),
('reports.items_partial_receive', N'Items in Partial Receive', 9),
('reports.receive_inventory_value', N'Receive Inventory Value', 10),
('reports.inventory_refill', N'Inventory ReFill', 11),
('reports.customer_list_report', N'Customer List', 12),
('reports.ar_aging_reports', N'A/R Aging Reports', 13),
('reports.ar_aging_details', N'A/R Aging Details', 14),
('reports.balance_by_date', N'Customer Balance By Date', 15),
('reports.type_summary', N'Customer Type Summary', 16),
('reports.balance_details', N'Customer Balance Details', 17),
('reports.zip_summary', N'Customer Zip Summary', 18),
('reports.open_invoice', N'Open Invoice', 19),
('reports.transaction_by_shipping', N'Transaction By Shipping', 20),
('reports.customer_sales', N'Customer Sales', 21),
('reports.customer_comparison', N'Customer Comparison', 22),
('reports.item_sales', N'Customers Item Sales', 23),
('reports.item_sales_invoice', N'Customer ItemSales With Invoice', 24),
('reports.monthly_sale', N'Customer Monthly Sale', 25),
('reports.weekly_sale', N'Customer Weekly Sale', 26),
('reports.department_sale', N'Customer Department Sale', 27),
('reports.phone_order_history', N'Customer Phone Order History', 28),
('reports.credit_line_changes', N'Credit Line Changes', 29),
('reports.loyalty_summary', N'Loyalty Summary', 30),
('reports.customer_loyalty', N'Customer Loyalty', 31),
('reports.balance_divided_by_day', N'Balance Divided By Day', 32),
('reports.balances_on_season', N'Balances On Season', 33),
('reports.ap_aging_reports', N'A/P Aging Reports', 34),
('reports.ap_aging_details', N'A/P Aging Details', 35),
('reports.vendor_balance_summary', N'Vendor Balance Summary', 36),
('reports.vendor_balance_details', N'Vendor Balance Details', 37),
('reports.unpaid_bills_details', N'Unpaid Bills Details', 38),
('reports.vendor_phone_list', N'Vendor Phone List', 39),
('reports.vendor_contact_list', N'Vendor Contact List', 40),
('reports.receive_item_summary', N'Receive Item Summary', 41),
('reports.receive_item_chart', N'Receive Item Chart', 42),
('reports.item_sales_received', N'Item Sales And Received Report', 43),
('reports.track_inventory', N'Track Inventory', 44),
('reports.track_sales', N'Track Sales', 45),
('reports.transfer_list', N'Transfer List', 46),
('reports.transfer_detail', N'Transfer Detail', 47),
('reports.transfer_detail_department', N'Transfer Detail Department', 48),
('reports.store_transfer', N'Store Transfer', 49),
('reports.sales_by_associate', N'Sales By Associate', 50),
('reports.sales_by_store', N'Sales By Store', 51),
('reports.transfer_value', N'Transfer Value', 52),
('reports.requested_items', N'Requested Items', 53),
('reports.shift_report', N'Shift Report', 54),
('reports.batch_report', N'Batch Report', 55),
('reports.tender_totals', N'Tender Totals', 56),
('reports.tender_totals_by_station', N'Tender Totals By Station', 57),
('reports.action_summary', N'Action Summary', 58),
('reports.action_details', N'Action Details', 59),
('reports.summary_reports', N'Summary Report', 60),
('reports.on_account_sales', N'On Account Sales', 61),
('reports.on_account_payments', N'On Account Payments', 62),
('reports.on_account_aut_report', N'On Account Aut. Report', 63),
('reports.daily_hour_sales', N'Daily Hour Sales', 64),
('reports.register_log_report', N'Register Log Report', 65),
('reports.payout_report', N'Payout Report', 66),
('reports.checks_cashed', N'Checks Cashed', 67),
('reports.sales_by_tender', N'Sales By Tender', 68),
('reports.best_worst_sellers', N'Best & Worst Sellers', 69),
('reports.item_daily_sales', N'Item Daily Sales', 70),
('reports.item_weekly_sales', N'Item Weekly Sales', 71),
('reports.item_monthly_sales', N'Item Monthly Sales', 72),
('reports.department_daily_sales', N'Department Daily Sales', 73),
('reports.department_weekly_sales', N'Department Weekly Sales', 74),
('reports.department_monthly_sales', N'Department Monthly Sales', 75),
('reports.total_daily_sales', N'Total Daily Sales', 76),
('reports.total_weekly_sales', N'Total Weekly Sales', 77),
('reports.total_monthly_sales', N'Total Monthly Sale', 78),
('reports.sales_summary_by_transaction', N'Sales Summary By Transaction', 79),
('reports.sales_summary_by_item', N'Sales Summary By Item', 80),
('reports.sales_summary_by_department', N'Sales Summary By Department', 81),
('reports.sales_summary_by_discount', N'Sales Summary By Discount', 82),
('reports.sales_summary_by_specials', N'Sales Summary By Specials', 83),
('reports.gross_profit', N'Gross Profit', 84),
('reports.sales_average_by_item', N'Sales Average By Item', 85),
('reports.date_comparison', N'Date Comparison', 86),
('reports.sales_average_by_day', N'Sales Average By Day', 87),
('reports.inventory_with_sale', N'Inventory With Sale', 88),
('reports.gift_card', N'Gift Card', 89),
('reports.inventory_sales', N'Inventory Sales', 90),
('reports.inventory_summary', N'Inventory Summary', 91),
('reports.vendor_profit_report', N'Vendor Profit Report', 92),
('reports.scheduled_reports', N'Scheduled Reports', 93),
('reports.report_history', N'Report History', 94);

-- Insert Screens (skip if Code already exists)
INSERT INTO dbo.Screens (ModuleId, Code, Name, Route, Icon, SortOrder, IsActive, CreatedAt)
SELECT @ReportsModuleId, s.ScreenCode, s.ScreenName, '/report-manager', 'BoxCubeIcon', s.SortOrder, 1, SYSUTCDATETIME()
FROM @ScreenSeed s
WHERE NOT EXISTS (SELECT 1 FROM dbo.Screens sc WHERE sc.Code = s.ScreenCode);

DECLARE @ScreensInserted INT = @@ROWCOUNT;
PRINT '  [OK] Screens: ' + CAST(@ScreensInserted AS VARCHAR(5)) + ' new; ' + CAST((SELECT COUNT(*) FROM @ScreenSeed) AS VARCHAR(5)) + ' total defined.';

-- Insert Permissions: View, Print, Export per screen (PermissionKey = screenCode + '.view' | '.print' | '.export')
INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt)
SELECT @ReportsModuleId, sc.Id, s.ScreenCode + '.view', N'View', 'action', 1, 1, SYSUTCDATETIME()
FROM @ScreenSeed s
INNER JOIN dbo.Screens sc ON sc.Code = s.ScreenCode
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions p WHERE p.PermissionKey = s.ScreenCode + '.view');

INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt)
SELECT @ReportsModuleId, sc.Id, s.ScreenCode + '.print', N'Print', 'action', 2, 1, SYSUTCDATETIME()
FROM @ScreenSeed s
INNER JOIN dbo.Screens sc ON sc.Code = s.ScreenCode
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions p WHERE p.PermissionKey = s.ScreenCode + '.print');

INSERT INTO dbo.Permissions (ModuleId, ScreenId, PermissionKey, Name, Category, SortOrder, IsActive, CreatedAt)
SELECT @ReportsModuleId, sc.Id, s.ScreenCode + '.export', N'Export', 'action', 3, 1, SYSUTCDATETIME()
FROM @ScreenSeed s
INNER JOIN dbo.Screens sc ON sc.Code = s.ScreenCode
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions p WHERE p.PermissionKey = s.ScreenCode + '.export');

PRINT '  [OK] Permissions: View, Print, Export per screen (3 per report).';

COMMIT TRANSACTION;

PRINT '';
PRINT '========================================================================';
PRINT 'Seed Report Manager Screens & Permissions - COMPLETED';
PRINT 'Screens added (if any): ' + CAST(@ScreensInserted AS VARCHAR(5));
PRINT 'Permissions: View, Print, Export per screen (idempotent).';
PRINT '';
PRINT 'NEXT STEPS:';
PRINT '  1. In Super Admin > Permission Ceiling, ensure Reports module is enabled for tenants.';
PRINT '  2. Add these new permissions to tenant ceilings (or run SeedTenantCeilingPermissions.sql).';
PRINT '  3. Assign roles reports.xxx.view / .print / .export as needed for each report.';
PRINT '========================================================================';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO
