/*
================================================================================
FIX SCRIPT: Tenant 92 — Missing Ceiling Permissions + Empty RBAC Tables
================================================================================
Problem:
  1. TenantAllowedPermissions has NO rows for TenantId = 92
  2. TenantAllowedModules has NO rows for TenantId = 92
  3. Tenant DB RBAC tables are empty (no roles, no user-roles, no role-permissions)

AZURE SQL COMPATIBLE — no cross-database queries.
Run the 3 parts in order. Copy-paste the output of Part A into Part B.

================================================================================
*/


-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  PART A: RUN AGAINST MASTER DATABASE (RDTCloud / MainDB)       ║
-- ║  This seeds the ceiling AND outputs permission keys for Part B  ║
-- ╚══════════════════════════════════════════════════════════════════╝

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @TenantId INT = 92;

PRINT '================================================================';
PRINT '  PART A — Seed Tenant Ceiling for TenantId = ' + CAST(@TenantId AS VARCHAR(10));
PRINT '  Database: ' + DB_NAME();
PRINT '  Time: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 121);
PRINT '================================================================';

-- Verify tenant exists
IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerId = @TenantId)
BEGIN
    RAISERROR('Tenant %d does not exist in dbo.Customers.', 16, 1, @TenantId);
    RETURN;
END

DECLARE @TenantName NVARCHAR(200);
SELECT @TenantName = CompanyName FROM dbo.Customers WHERE CustomerId = @TenantId;
PRINT '  Tenant: ' + ISNULL(@TenantName, '(unknown)');
PRINT '';

BEGIN TRY
BEGIN TRANSACTION;

-- A1. Enable all active modules
INSERT INTO dbo.TenantAllowedModules (TenantId, ModuleId, IsEnabled, EnabledAt)
SELECT @TenantId, m.ModuleId, 1, SYSUTCDATETIME()
FROM dbo.Modules m
WHERE m.IsActive = 1
  AND NOT EXISTS (
      SELECT 1 FROM dbo.TenantAllowedModules tam
      WHERE tam.TenantId = @TenantId AND tam.ModuleId = m.ModuleId
  );
DECLARE @ModsInserted INT = @@ROWCOUNT;
PRINT '  [OK] TenantAllowedModules inserted: ' + CAST(@ModsInserted AS VARCHAR(10));

-- A2. Grant all active permissions in ceiling
INSERT INTO dbo.TenantAllowedPermissions (TenantId, PermissionId, IsAllowed, GrantedAt)
SELECT @TenantId, p.Id, 1, SYSUTCDATETIME()
FROM dbo.Permissions p
WHERE p.IsActive = 1
  AND NOT EXISTS (
      SELECT 1 FROM dbo.TenantAllowedPermissions tap
      WHERE tap.TenantId = @TenantId AND tap.PermissionId = p.Id
  );
DECLARE @PermsInserted INT = @@ROWCOUNT;
PRINT '  [OK] TenantAllowedPermissions inserted: ' + CAST(@PermsInserted AS VARCHAR(10));

COMMIT TRANSACTION;

-- Verification
DECLARE @TotalModules INT, @TotalPerms INT;
SELECT @TotalModules = COUNT(*) FROM dbo.TenantAllowedModules WHERE TenantId = @TenantId;
SELECT @TotalPerms   = COUNT(*) FROM dbo.TenantAllowedPermissions WHERE TenantId = @TenantId;

PRINT '';
PRINT '  VERIFICATION:';
PRINT '    Modules enabled: ' + CAST(@TotalModules AS VARCHAR(10));
PRINT '    Permissions in ceiling: ' + CAST(@TotalPerms AS VARCHAR(10));

-- A3. Output ALL ceiling permission keys as INSERT statements for Part B.
--     Copy the result grid from this query and paste into Part B.
PRINT '';
PRINT '================================================================';
PRINT '  PART A COMPLETE.';
PRINT '  Now run the query below, copy ALL rows from the result,';
PRINT '  and paste them into PART B where indicated.';
PRINT '================================================================';

SELECT p.PermissionKey
FROM dbo.TenantAllowedPermissions tap
INNER JOIN dbo.Permissions p ON p.Id = tap.PermissionId
WHERE tap.TenantId = @TenantId
  AND tap.IsAllowed = 1
  AND p.IsActive = 1
ORDER BY p.PermissionKey;

-- Also output the UserIds for this tenant
PRINT '';
PRINT '  Users belonging to TenantId ' + CAST(@TenantId AS VARCHAR(10)) + ':';

SELECT UserId, Email, FirstName, LastName, IsActive
FROM dbo.AppUsers
WHERE CustomerId = @TenantId
ORDER BY Email;

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    PRINT 'ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO


-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  PART B: RUN AGAINST TENANT DATABASE (Goodease_Copy)           ║
-- ║                                                                 ║
-- ║  AZURE SQL COMPATIBLE — no cross-database references.           ║
-- ║  Uses a temp table populated from Part A's output.              ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- *** Switch to the tenant database first! ***
-- USE [Goodease_Copy];
-- GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '================================================================';
PRINT '  PART B — Seed RBAC Tables in Tenant Database';
PRINT '  Database: ' + DB_NAME();
PRINT '  Time: ' + CONVERT(VARCHAR(30), SYSUTCDATETIME(), 121);
PRINT '================================================================';

BEGIN TRY
BEGIN TRANSACTION;

-- B0. Verify RBAC tables exist
IF OBJECT_ID('dbo.RbacTenantRoles', 'U') IS NULL
BEGIN
    RAISERROR('RbacTenantRoles table does not exist. Run RBAC_TenantDB_Schema.sql first.', 16, 1);
    RETURN;
END

-- B1. Load ceiling permission keys into a temp table.
--     This avoids cross-database queries (Azure SQL compatible).
CREATE TABLE #CeilingKeys (PermissionKey VARCHAR(150) NOT NULL PRIMARY KEY);

-- ┌──────────────────────────────────────────────────────────────────┐
-- │  INSERT ALL permission keys from Part A's query result below.   │
-- │  Each key is a row from the PermissionKey column.               │
-- │                                                                  │
-- │  FORMAT: INSERT INTO #CeilingKeys VALUES ('key');                │
-- │                                                                  │
-- │  TIP: In SSMS, run Part A's SELECT, then in the result grid     │
-- │  right-click → Select All → Copy. Use a text editor to wrap     │
-- │  each line as an INSERT. Or just use the block below which      │
-- │  loads ALL known permission keys from the master seed.          │
-- └──────────────────────────────────────────────────────────────────┘

-- AUTO-GENERATED: All permission keys from RBAC_MasterDB seed + Report seed.
-- This covers every permission that would be in a full ceiling.
-- If your ceiling is customized (not all permissions), replace this
-- block with only the keys from Part A's SELECT output.

INSERT INTO #CeilingKeys (PermissionKey) VALUES
-- ── Inventory Module ──
('inventory.item_list.view'),
('inventory.item_list.create'),
('inventory.item_list.edit'),
('inventory.item_list.delete'),
('inventory.item_list.export'),
('inventory.item_list.import'),
('inventory.item_list.print'),
('inventory.purchase_orders.view'),
('inventory.purchase_orders.create'),
('inventory.purchase_orders.edit'),
('inventory.purchase_orders.delete'),
('inventory.purchase_orders.export'),
('inventory.purchase_orders.print'),
('inventory.purchase_orders.approve'),
('inventory.purchase_orders.void'),
('inventory.receive_orders.view'),
('inventory.receive_orders.create'),
('inventory.receive_orders.edit'),
('inventory.receive_orders.delete'),
('inventory.receive_orders.export'),
('inventory.receive_orders.print'),
('inventory.departments.view'),
('inventory.departments.create'),
('inventory.departments.edit'),
('inventory.departments.delete'),
('inventory.departments.export'),
('inventory.brands.view'),
('inventory.brands.create'),
('inventory.brands.edit'),
('inventory.brands.delete'),
('inventory.brands.export'),
('inventory.specials.view'),
('inventory.specials.create'),
('inventory.specials.edit'),
('inventory.specials.delete'),
('inventory.specials.export'),
-- ── Purchasing Module ──
('purchasing.purchase_orders.view'),
('purchasing.purchase_orders.create'),
('purchasing.purchase_orders.edit'),
('purchasing.purchase_orders.delete'),
('purchasing.purchase_orders.export'),
('purchasing.purchase_orders.print'),
('purchasing.purchase_orders.approve'),
('purchasing.purchase_orders.void'),
('purchasing.receive_orders.view'),
('purchasing.receive_orders.create'),
('purchasing.receive_orders.edit'),
('purchasing.receive_orders.delete'),
('purchasing.receive_orders.export'),
('purchasing.receive_orders.print'),
-- ── Admin Module ──
('admin.roles.view'),
('admin.roles.create'),
('admin.roles.edit'),
('admin.roles.delete'),
('admin.user_roles.view'),
('admin.user_roles.edit'),
-- ── Reports Module (all report screens) ──
('reports.tax_collected.view'), ('reports.tax_collected.print'), ('reports.tax_collected.export'),
('reports.tax_by_store.view'), ('reports.tax_by_store.print'), ('reports.tax_by_store.export'),
('reports.returned_items.view'), ('reports.returned_items.print'), ('reports.returned_items.export'),
('reports.items_inventory.view'), ('reports.items_inventory.print'), ('reports.items_inventory.export'),
('reports.department_inventory.view'), ('reports.department_inventory.print'), ('reports.department_inventory.export'),
('reports.price_change_history.view'), ('reports.price_change_history.print'), ('reports.price_change_history.export'),
('reports.items_on_purchase_order.view'), ('reports.items_on_purchase_order.print'), ('reports.items_on_purchase_order.export'),
('reports.items_on_receive_order.view'), ('reports.items_on_receive_order.print'), ('reports.items_on_receive_order.export'),
('reports.items_partial_receive.view'), ('reports.items_partial_receive.print'), ('reports.items_partial_receive.export'),
('reports.receive_inventory_value.view'), ('reports.receive_inventory_value.print'), ('reports.receive_inventory_value.export'),
('reports.inventory_refill.view'), ('reports.inventory_refill.print'), ('reports.inventory_refill.export'),
('reports.customer_list_report.view'), ('reports.customer_list_report.print'), ('reports.customer_list_report.export'),
('reports.ar_aging_reports.view'), ('reports.ar_aging_reports.print'), ('reports.ar_aging_reports.export'),
('reports.ar_aging_details.view'), ('reports.ar_aging_details.print'), ('reports.ar_aging_details.export'),
('reports.balance_by_date.view'), ('reports.balance_by_date.print'), ('reports.balance_by_date.export'),
('reports.type_summary.view'), ('reports.type_summary.print'), ('reports.type_summary.export'),
('reports.balance_details.view'), ('reports.balance_details.print'), ('reports.balance_details.export'),
('reports.zip_summary.view'), ('reports.zip_summary.print'), ('reports.zip_summary.export'),
('reports.open_invoice.view'), ('reports.open_invoice.print'), ('reports.open_invoice.export'),
('reports.transaction_by_shipping.view'), ('reports.transaction_by_shipping.print'), ('reports.transaction_by_shipping.export'),
('reports.customer_sales.view'), ('reports.customer_sales.print'), ('reports.customer_sales.export'),
('reports.customer_comparison.view'), ('reports.customer_comparison.print'), ('reports.customer_comparison.export'),
('reports.item_sales.view'), ('reports.item_sales.print'), ('reports.item_sales.export'),
('reports.item_sales_invoice.view'), ('reports.item_sales_invoice.print'), ('reports.item_sales_invoice.export'),
('reports.monthly_sale.view'), ('reports.monthly_sale.print'), ('reports.monthly_sale.export'),
('reports.weekly_sale.view'), ('reports.weekly_sale.print'), ('reports.weekly_sale.export'),
('reports.department_sale.view'), ('reports.department_sale.print'), ('reports.department_sale.export'),
('reports.phone_order_history.view'), ('reports.phone_order_history.print'), ('reports.phone_order_history.export'),
('reports.credit_line_changes.view'), ('reports.credit_line_changes.print'), ('reports.credit_line_changes.export'),
('reports.loyalty_summary.view'), ('reports.loyalty_summary.print'), ('reports.loyalty_summary.export'),
('reports.customer_loyalty.view'), ('reports.customer_loyalty.print'), ('reports.customer_loyalty.export'),
('reports.balance_divided_by_day.view'), ('reports.balance_divided_by_day.print'), ('reports.balance_divided_by_day.export'),
('reports.balances_on_season.view'), ('reports.balances_on_season.print'), ('reports.balances_on_season.export'),
('reports.ap_aging_reports.view'), ('reports.ap_aging_reports.print'), ('reports.ap_aging_reports.export'),
('reports.ap_aging_details.view'), ('reports.ap_aging_details.print'), ('reports.ap_aging_details.export'),
('reports.vendor_balance_summary.view'), ('reports.vendor_balance_summary.print'), ('reports.vendor_balance_summary.export'),
('reports.vendor_balance_details.view'), ('reports.vendor_balance_details.print'), ('reports.vendor_balance_details.export'),
('reports.unpaid_bills_details.view'), ('reports.unpaid_bills_details.print'), ('reports.unpaid_bills_details.export'),
('reports.vendor_phone_list.view'), ('reports.vendor_phone_list.print'), ('reports.vendor_phone_list.export'),
('reports.vendor_contact_list.view'), ('reports.vendor_contact_list.print'), ('reports.vendor_contact_list.export'),
('reports.receive_item_summary.view'), ('reports.receive_item_summary.print'), ('reports.receive_item_summary.export'),
('reports.receive_item_chart.view'), ('reports.receive_item_chart.print'), ('reports.receive_item_chart.export'),
('reports.item_sales_received.view'), ('reports.item_sales_received.print'), ('reports.item_sales_received.export'),
('reports.track_inventory.view'), ('reports.track_inventory.print'), ('reports.track_inventory.export'),
('reports.track_sales.view'), ('reports.track_sales.print'), ('reports.track_sales.export'),
('reports.transfer_list.view'), ('reports.transfer_list.print'), ('reports.transfer_list.export'),
('reports.transfer_detail.view'), ('reports.transfer_detail.print'), ('reports.transfer_detail.export'),
('reports.transfer_detail_department.view'), ('reports.transfer_detail_department.print'), ('reports.transfer_detail_department.export'),
('reports.store_transfer.view'), ('reports.store_transfer.print'), ('reports.store_transfer.export'),
('reports.sales_by_associate.view'), ('reports.sales_by_associate.print'), ('reports.sales_by_associate.export'),
('reports.sales_by_store.view'), ('reports.sales_by_store.print'), ('reports.sales_by_store.export'),
('reports.transfer_value.view'), ('reports.transfer_value.print'), ('reports.transfer_value.export'),
('reports.requested_items.view'), ('reports.requested_items.print'), ('reports.requested_items.export'),
('reports.shift_report.view'), ('reports.shift_report.print'), ('reports.shift_report.export'),
('reports.batch_report.view'), ('reports.batch_report.print'), ('reports.batch_report.export'),
('reports.tender_totals.view'), ('reports.tender_totals.print'), ('reports.tender_totals.export'),
('reports.tender_totals_by_station.view'), ('reports.tender_totals_by_station.print'), ('reports.tender_totals_by_station.export'),
('reports.action_summary.view'), ('reports.action_summary.print'), ('reports.action_summary.export'),
('reports.action_details.view'), ('reports.action_details.print'), ('reports.action_details.export'),
('reports.summary_reports.view'), ('reports.summary_reports.print'), ('reports.summary_reports.export'),
('reports.on_account_sales.view'), ('reports.on_account_sales.print'), ('reports.on_account_sales.export'),
('reports.on_account_payments.view'), ('reports.on_account_payments.print'), ('reports.on_account_payments.export'),
('reports.on_account_aut_report.view'), ('reports.on_account_aut_report.print'), ('reports.on_account_aut_report.export'),
('reports.daily_hour_sales.view'), ('reports.daily_hour_sales.print'), ('reports.daily_hour_sales.export'),
('reports.register_log_report.view'), ('reports.register_log_report.print'), ('reports.register_log_report.export'),
('reports.payout_report.view'), ('reports.payout_report.print'), ('reports.payout_report.export'),
('reports.checks_cashed.view'), ('reports.checks_cashed.print'), ('reports.checks_cashed.export'),
('reports.sales_by_tender.view'), ('reports.sales_by_tender.print'), ('reports.sales_by_tender.export'),
('reports.best_worst_sellers.view'), ('reports.best_worst_sellers.print'), ('reports.best_worst_sellers.export'),
('reports.item_daily_sales.view'), ('reports.item_daily_sales.print'), ('reports.item_daily_sales.export'),
('reports.item_weekly_sales.view'), ('reports.item_weekly_sales.print'), ('reports.item_weekly_sales.export'),
('reports.item_monthly_sales.view'), ('reports.item_monthly_sales.print'), ('reports.item_monthly_sales.export'),
('reports.department_daily_sales.view'), ('reports.department_daily_sales.print'), ('reports.department_daily_sales.export'),
('reports.department_weekly_sales.view'), ('reports.department_weekly_sales.print'), ('reports.department_weekly_sales.export'),
('reports.department_monthly_sales.view'), ('reports.department_monthly_sales.print'), ('reports.department_monthly_sales.export'),
('reports.total_daily_sales.view'), ('reports.total_daily_sales.print'), ('reports.total_daily_sales.export'),
('reports.total_weekly_sales.view'), ('reports.total_weekly_sales.print'), ('reports.total_weekly_sales.export'),
('reports.total_monthly_sales.view'), ('reports.total_monthly_sales.print'), ('reports.total_monthly_sales.export'),
('reports.sales_summary_by_transaction.view'), ('reports.sales_summary_by_transaction.print'), ('reports.sales_summary_by_transaction.export'),
('reports.sales_summary_by_item.view'), ('reports.sales_summary_by_item.print'), ('reports.sales_summary_by_item.export'),
('reports.sales_summary_by_department.view'), ('reports.sales_summary_by_department.print'), ('reports.sales_summary_by_department.export'),
('reports.sales_summary_by_discount.view'), ('reports.sales_summary_by_discount.print'), ('reports.sales_summary_by_discount.export'),
('reports.sales_summary_by_specials.view'), ('reports.sales_summary_by_specials.print'), ('reports.sales_summary_by_specials.export'),
('reports.gross_profit.view'), ('reports.gross_profit.print'), ('reports.gross_profit.export'),
('reports.sales_average_by_item.view'), ('reports.sales_average_by_item.print'), ('reports.sales_average_by_item.export'),
('reports.date_comparison.view'), ('reports.date_comparison.print'), ('reports.date_comparison.export'),
('reports.sales_average_by_day.view'), ('reports.sales_average_by_day.print'), ('reports.sales_average_by_day.export'),
('reports.inventory_with_sale.view'), ('reports.inventory_with_sale.print'), ('reports.inventory_with_sale.export'),
('reports.gift_card.view'), ('reports.gift_card.print'), ('reports.gift_card.export'),
('reports.inventory_sales.view'), ('reports.inventory_sales.print'), ('reports.inventory_sales.export'),
('reports.inventory_summary.view'), ('reports.inventory_summary.print'), ('reports.inventory_summary.export'),
('reports.vendor_profit_report.view'), ('reports.vendor_profit_report.print'), ('reports.vendor_profit_report.export'),
('reports.scheduled_reports.view'), ('reports.scheduled_reports.print'), ('reports.scheduled_reports.export'),
('reports.report_history.view'), ('reports.report_history.print'), ('reports.report_history.export');

DECLARE @KeyCount INT;
SELECT @KeyCount = COUNT(*) FROM #CeilingKeys;
PRINT '  [OK] Loaded ' + CAST(@KeyCount AS VARCHAR(10)) + ' ceiling permission keys into temp table.';

-- B2. Create "Administrator" system role if missing
DECLARE @AdminRoleId INT;

IF NOT EXISTS (SELECT 1 FROM dbo.RbacTenantRoles WHERE Code = 'administrator')
BEGIN
    INSERT INTO dbo.RbacTenantRoles (Name, Code, Description, IsSystemRole, IsActive, CreatedAt)
    VALUES (N'Administrator', 'administrator',
            N'System administrator role with full access. Cannot be deleted.', 1, 1, SYSUTCDATETIME());
    SET @AdminRoleId = SCOPE_IDENTITY();
    PRINT '  [OK] Administrator role created (Id=' + CAST(@AdminRoleId AS VARCHAR(10)) + ')';
END
ELSE
BEGIN
    SELECT @AdminRoleId = Id FROM dbo.RbacTenantRoles WHERE Code = 'administrator';
    PRINT '  [SKIP] Administrator role exists (Id=' + CAST(@AdminRoleId AS VARCHAR(10)) + ')';
END

-- B3. Sync ALL ceiling permissions to admin role
INSERT INTO dbo.RbacTenantRolePermissions (RoleId, PermissionKey, IsGranted)
SELECT @AdminRoleId, ck.PermissionKey, 1
FROM #CeilingKeys ck
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.RbacTenantRolePermissions rp
    WHERE rp.RoleId = @AdminRoleId AND rp.PermissionKey = ck.PermissionKey
);

DECLARE @PermsSynced INT = @@ROWCOUNT;
PRINT '  [OK] Admin role permissions synced: ' + CAST(@PermsSynced AS VARCHAR(10)) + ' new';

-- B4. Assign users to the Administrator role.
--     *** PASTE the UserIds from Part A's user query here ***
--     Replace these example UserIds with the actual ones from Part A output.

-- ┌──────────────────────────────────────────────────────────────────┐
-- │  IMPORTANT: Replace the VALUES below with the actual UserIds    │
-- │  from Part A's user list output for TenantId 92.                │
-- │                                                                  │
-- │  Example: If Part A showed UserId 15 (jacob@rdtsystems.com)     │
-- │  and UserId 22 (alice@rdtsystems.com), add both.                │
-- └──────────────────────────────────────────────────────────────────┘

CREATE TABLE #TenantUsers (UserId INT NOT NULL PRIMARY KEY);

-- *** PASTE USER IDS HERE — one INSERT per user ***
-- INSERT INTO #TenantUsers VALUES (15);   -- jacob@rdtsystems.com
-- INSERT INTO #TenantUsers VALUES (22);   -- another-user@example.com

-- Alternatively, if you know jacob's UserId, just add it:
-- INSERT INTO #TenantUsers VALUES (???);  -- <-- jacob's UserId from Part A

-- Assign all users in the temp table to the admin role
INSERT INTO dbo.RbacTenantUserRoles (UserId, RoleId, AssignedAt)
SELECT tu.UserId, @AdminRoleId, SYSUTCDATETIME()
FROM #TenantUsers tu
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.RbacTenantUserRoles ur
    WHERE ur.UserId = tu.UserId AND ur.RoleId = @AdminRoleId
);

DECLARE @UsersAssigned INT = @@ROWCOUNT;
PRINT '  [OK] Users assigned to admin role: ' + CAST(@UsersAssigned AS VARCHAR(10));

-- B5. Seed default RBAC config
IF NOT EXISTS (SELECT 1 FROM dbo.RbacTenantConfigs WHERE ConfigKey = 'rbac.enabled')
    INSERT INTO dbo.RbacTenantConfigs (ConfigKey, ConfigValue) VALUES ('rbac.enabled', 'true');
IF NOT EXISTS (SELECT 1 FROM dbo.RbacTenantConfigs WHERE ConfigKey = 'rbac.default_role')
    INSERT INTO dbo.RbacTenantConfigs (ConfigKey, ConfigValue) VALUES ('rbac.default_role', 'administrator');
PRINT '  [OK] RBAC config seeded.';

-- B6. Audit log
INSERT INTO dbo.RbacTenantAuditLogs (UserId, Action, EntityType, EntityId, NewValue, CreatedAt)
VALUES (NULL, 'FixScript', 'RbacTenantRole', CAST(@AdminRoleId AS VARCHAR(10)),
        'Fix script: seeded ' + CAST(@PermsSynced AS VARCHAR(10)) + ' permissions, assigned '
        + CAST(@UsersAssigned AS VARCHAR(10)) + ' users to Administrator role.',
        SYSUTCDATETIME());

COMMIT TRANSACTION;

-- Cleanup
DROP TABLE #CeilingKeys;
DROP TABLE #TenantUsers;

-- Verification
PRINT '';
PRINT '  VERIFICATION:';

DECLARE @rc_roles INT, @rc_perms INT, @rc_users INT;
SELECT @rc_roles = COUNT(*) FROM dbo.RbacTenantRoles;
SELECT @rc_perms = COUNT(*) FROM dbo.RbacTenantRolePermissions WHERE RoleId = @AdminRoleId;
SELECT @rc_users = COUNT(*) FROM dbo.RbacTenantUserRoles WHERE RoleId = @AdminRoleId;

PRINT '    Roles: ' + CAST(@rc_roles AS VARCHAR(10));
PRINT '    Admin role permissions: ' + CAST(@rc_perms AS VARCHAR(10));
PRINT '    Users with admin role: ' + CAST(@rc_users AS VARCHAR(10));

-- Show assigned users
SELECT ur.UserId, ur.RoleId, r.Name AS RoleName, ur.AssignedAt
FROM dbo.RbacTenantUserRoles ur
INNER JOIN dbo.RbacTenantRoles r ON r.Id = ur.RoleId
WHERE ur.RoleId = @AdminRoleId;

-- Quick permission check for the item_list.edit we're debugging
SELECT
    CASE WHEN EXISTS (
        SELECT 1 FROM dbo.RbacTenantRolePermissions
        WHERE RoleId = @AdminRoleId AND PermissionKey = 'inventory.item_list.edit' AND IsGranted = 1
    ) THEN 'YES — inventory.item_list.edit IS GRANTED to admin role'
      ELSE 'NO — inventory.item_list.edit IS MISSING from admin role'
    END AS EditPermissionStatus;

PRINT '';
PRINT '================================================================';
PRINT '  PART B COMPLETE.';
PRINT '  Jacob should now be able to edit items.';
PRINT '  Note: Permission cache has a 5-minute TTL.';
PRINT '  Have jacob log out and log back in to force a refresh.';
PRINT '================================================================';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    IF OBJECT_ID('tempdb..#CeilingKeys') IS NOT NULL DROP TABLE #CeilingKeys;
    IF OBJECT_ID('tempdb..#TenantUsers') IS NOT NULL DROP TABLE #TenantUsers;
    PRINT 'ERROR: ' + ERROR_MESSAGE();
    THROW;
END CATCH;
GO
