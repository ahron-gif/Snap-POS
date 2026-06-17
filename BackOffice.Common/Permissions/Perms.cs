namespace BackOffice.Common.Permissions
{
    /// <summary>
    /// Single source of truth for all permission keys.
    /// Format: module.screen.action
    /// Usage: [RequirePermission(Perms.Inventory.ItemList.Create)]
    ///
    /// Modules match sidebar groups exactly:
    ///   Inventory, Purchasing (Vendors), Customers, Registers,
    ///   Sales (Sales & Discounts), Stores, Admin (Administrator), Reports
    /// </summary>
    public static class Perms
    {
        // ================================================================
        // INVENTORY MODULE  (Sidebar: "Inventory")
        // ================================================================
        public static class Inventory
        {
            /// <summary>Item List page - /items-list</summary>
            public static class ItemList
            {
                public const string View = "inventory.item_list.view";
                public const string Create = "inventory.item_list.create";
                public const string Edit = "inventory.item_list.edit";
                public const string Delete = "inventory.item_list.delete";
                public const string Export = "inventory.item_list.export";
                public const string Import = "inventory.item_list.import";
                public const string Print = "inventory.item_list.print";
            }

            /// <summary>Item Quick List page - /items-quick-list</summary>
            public static class ItemQuickList
            {
                public const string View = "inventory.item_quick_list.view";
                public const string Export = "inventory.item_quick_list.export";
                public const string Print = "inventory.item_quick_list.print";
            }

            /// <summary>Item Groups page - /item-groups</summary>
            public static class ItemGroup
            {
                public const string View = "inventory.item_group.view";
                public const string Create = "inventory.item_group.create";
                public const string Edit = "inventory.item_group.edit";
                public const string Delete = "inventory.item_group.delete";
            }

            /// <summary>Departments page - /departments</summary>
            public static class Department
            {
                public const string View = "inventory.department.view";
                public const string Create = "inventory.department.create";
                public const string Edit = "inventory.department.edit";
                public const string Delete = "inventory.department.delete";
            }

            /// <summary>Manufacturers page - /manufacturers</summary>
            public static class Manufacturer
            {
                public const string View = "inventory.manufacturer.view";
                public const string Create = "inventory.manufacturer.create";
                public const string Edit = "inventory.manufacturer.edit";
                public const string Delete = "inventory.manufacturer.delete";
            }

            /// <summary>Items With Inventory page - /items-with-inventory</summary>
            public static class ItemsWithInventory
            {
                public const string View = "inventory.items_with_inventory.view";
                public const string Export = "inventory.items_with_inventory.export";
                public const string Print = "inventory.items_with_inventory.print";
            }

            /// <summary>Label Designer page - /label-designer</summary>
            public static class LabelDesigner
            {
                public const string View = "inventory.label_designer.view";
                public const string Create = "inventory.label_designer.create";
                public const string Edit = "inventory.label_designer.edit";
                public const string Delete = "inventory.label_designer.delete";
                public const string Print = "inventory.label_designer.print";
            }

            /// <summary>Adjust Inventory page - /adjust-inventory</summary>
            public static class AdjustInventory
            {
                public const string View = "inventory.adjust_inventory.view";
                public const string Create = "inventory.adjust_inventory.create";
                public const string Export = "inventory.adjust_inventory.export";
                public const string Print = "inventory.adjust_inventory.print";
            }
        }

        // ================================================================
        // PURCHASING MODULE  (Sidebar: "Vendors")
        // ================================================================
        public static class Purchasing
        {
            /// <summary>Vendor List page - /vendors-list</summary>
            public static class VendorList
            {
                public const string View = "purchasing.vendor_list.view";
                public const string Create = "purchasing.vendor_list.create";
                public const string Edit = "purchasing.vendor_list.edit";
                public const string Delete = "purchasing.vendor_list.delete";
                public const string Export = "purchasing.vendor_list.export";
                public const string Print = "purchasing.vendor_list.print";
            }

            /// <summary>Purchase Orders page - /purchase-orders-list</summary>
            public static class PurchaseOrder
            {
                public const string View = "purchasing.purchase_order.view";
                public const string Create = "purchasing.purchase_order.create";
                public const string Edit = "purchasing.purchase_order.edit";
                public const string Delete = "purchasing.purchase_order.delete";
                public const string Export = "purchasing.purchase_order.export";
                public const string Print = "purchasing.purchase_order.print";
            }

            /// <summary>Receive Orders page - /receive-orders-list</summary>
            public static class ReceiveOrder
            {
                public const string View = "purchasing.receive_order.view";
                public const string Create = "purchasing.receive_order.create";
                public const string Edit = "purchasing.receive_order.edit";
                public const string Delete = "purchasing.receive_order.delete";
                public const string Void = "purchasing.receive_order.void";
                public const string Export = "purchasing.receive_order.export";
                public const string Print = "purchasing.receive_order.print";
            }

            /// <summary>General Order page - /general-order-list</summary>
            public static class GeneralOrder
            {
                public const string View = "purchasing.general_order.view";
                public const string Delete = "purchasing.general_order.delete";
                public const string Export = "purchasing.general_order.export";
                public const string Print = "purchasing.general_order.print";
            }

            /// <summary>Pay Bills page - /payments-list</summary>
            public static class PayBills
            {
                public const string View = "purchasing.pay_bills.view";
                public const string Create = "purchasing.pay_bills.create";
                public const string Edit = "purchasing.pay_bills.edit";
                public const string Delete = "purchasing.pay_bills.delete";
                public const string Void = "purchasing.pay_bills.void";
                public const string Export = "purchasing.pay_bills.export";
                public const string Print = "purchasing.pay_bills.print";
            }

            /// <summary>Return To Vendor page - /return-to-vendor-list</summary>
            public static class ReturnToVendor
            {
                public const string View = "purchasing.return_to_vendor.view";
                public const string Create = "purchasing.return_to_vendor.create";
                public const string Edit = "purchasing.return_to_vendor.edit";
                public const string Delete = "purchasing.return_to_vendor.delete";
                public const string Void = "purchasing.return_to_vendor.void";
                public const string Export = "purchasing.return_to_vendor.export";
                public const string Print = "purchasing.return_to_vendor.print";
            }
        }

        // ================================================================
        // CUSTOMERS MODULE  (Sidebar: "Customers")
        // ================================================================
        public static class Customers
        {
            /// <summary>Customer List page - /customers-list</summary>
            public static class CustomerList
            {
                public const string View = "customers.customer_list.view";
                public const string Create = "customers.customer_list.create";
                public const string Edit = "customers.customer_list.edit";
                public const string Delete = "customers.customer_list.delete";
                public const string Export = "customers.customer_list.export";
                public const string Print = "customers.customer_list.print";
            }

            /// <summary>Phone Order List page - /phone-orders-list</summary>
            public static class PhoneOrderList
            {
                public const string View = "customers.phone_order_list.view";
                public const string Create = "customers.phone_order_list.create";
                public const string Edit = "customers.phone_order_list.edit";
                public const string Delete = "customers.phone_order_list.delete";
                public const string Void = "customers.phone_order_list.void";
                public const string Export = "customers.phone_order_list.export";
                public const string Print = "customers.phone_order_list.print";
                public const string ChangeStatus = "customers.phone_order_list.change_status";
                public const string ChangePriority = "customers.phone_order_list.change_priority";
            }

            /// <summary>Items On Phone Order page - /items-on-phone-order-list</summary>
            public static class ItemsOnPhoneOrder
            {
                public const string View = "customers.items_on_phone_order.view";
                public const string Export = "customers.items_on_phone_order.export";
                public const string Print = "customers.items_on_phone_order.print";
            }

            /// <summary>Items Details on Phone Order page - /item-details-on-phone-order-list</summary>
            public static class ItemDetailsOnPhoneOrder
            {
                public const string View = "customers.item_details_on_phone_order.view";
                public const string Export = "customers.item_details_on_phone_order.export";
                public const string Print = "customers.item_details_on_phone_order.print";
            }

            /// <summary>Replaced Items page - /replaced-items-list</summary>
            public static class ReplacedItems
            {
                public const string View = "customers.replaced_items.view";
                public const string Delete = "customers.replaced_items.delete";
                public const string Export = "customers.replaced_items.export";
                public const string Print = "customers.replaced_items.print";
            }

            /// <summary>Receive Payment page - /receive-payments-list</summary>
            public static class ReceivePayment
            {
                public const string View = "customers.receive_payment.view";
                public const string Export = "customers.receive_payment.export";
                public const string Print = "customers.receive_payment.print";
            }

            /// <summary>CRM - placeholder</summary>
            public static class Crm
            {
                public const string View = "customers.crm.view";
            }

            /// <summary>Task List - placeholder</summary>
            public static class TaskList
            {
                public const string View = "customers.task_list.view";
                public const string Create = "customers.task_list.create";
                public const string Edit = "customers.task_list.edit";
                public const string Delete = "customers.task_list.delete";
                public const string Assign = "customers.task_list.assign";
            }

            /// <summary>Call List - placeholder</summary>
            public static class CallList
            {
                public const string View = "customers.call_list.view";
                public const string Create = "customers.call_list.create";
                public const string Edit = "customers.call_list.edit";
            }
        }

        // ================================================================
        // REGISTERS MODULE  (Sidebar: "Registers")
        // ================================================================
        public static class Registers
        {
            /// <summary>Transactions page - /transactions-list</summary>
            public static class Transactions
            {
                public const string View = "registers.transactions.view";
                public const string Export = "registers.transactions.export";
                public const string Print = "registers.transactions.print";
            }

            /// <summary>Registers page - /registers-list</summary>
            public static class RegisterList
            {
                public const string View = "registers.register_list.view";
                public const string Create = "registers.register_list.create";
                public const string Edit = "registers.register_list.edit";
                public const string Delete = "registers.register_list.delete";
            }

            /// <summary>Register Settings - placeholder</summary>
            public static class RegisterSettings
            {
                public const string View = "registers.register_settings.view";
                public const string Edit = "registers.register_settings.edit";
            }

            /// <summary>User Security - placeholder</summary>
            public static class UserSecurity
            {
                public const string View = "registers.user_security.view";
                public const string Edit = "registers.user_security.edit";
            }

            /// <summary>Layaway List - placeholder</summary>
            public static class LayawayList
            {
                public const string View = "registers.layaway_list.view";
                public const string Create = "registers.layaway_list.create";
                public const string Edit = "registers.layaway_list.edit";
                public const string Delete = "registers.layaway_list.delete";
            }

            /// <summary>Layaway Items - placeholder</summary>
            public static class LayawayItems
            {
                public const string View = "registers.layaway_items.view";
            }

            /// <summary>POS - placeholder</summary>
            public static class Pos
            {
                public const string View = "registers.pos.view";
            }

            /// <summary>Time Attendance - placeholder</summary>
            public static class TimeAttendance
            {
                public const string View = "registers.time_attendance.view";
                public const string Export = "registers.time_attendance.export";
                public const string Print = "registers.time_attendance.print";
            }
        }

        // ================================================================
        // SALES MODULE  (Sidebar: "Sales & Discounts")
        // ================================================================
        public static class Sales
        {
            /// <summary>Discount List page - /discounts-list</summary>
            public static class DiscountList
            {
                public const string View = "sales.discount_list.view";
                public const string Create = "sales.discount_list.create";
                public const string Edit = "sales.discount_list.edit";
                public const string Delete = "sales.discount_list.delete";
                public const string Export = "sales.discount_list.export";
                public const string Print = "sales.discount_list.print";
            }

            /// <summary>New Discount - placeholder</summary>
            public static class NewDiscount
            {
                public const string View = "sales.new_discount.view";
                public const string Create = "sales.new_discount.create";
                public const string Edit = "sales.new_discount.edit";
            }

            /// <summary>New Bogo Discount - placeholder</summary>
            public static class BogoDiscount
            {
                public const string View = "sales.bogo_discount.view";
                public const string Create = "sales.bogo_discount.create";
                public const string Edit = "sales.bogo_discount.edit";
            }

            /// <summary>Loyalty Management - placeholder</summary>
            public static class LoyaltyManagement
            {
                public const string View = "sales.loyalty_management.view";
                public const string Create = "sales.loyalty_management.create";
                public const string Edit = "sales.loyalty_management.edit";
                public const string Delete = "sales.loyalty_management.delete";
            }

            /// <summary>Bonus Points - placeholder</summary>
            public static class BonusPoints
            {
                public const string View = "sales.bonus_points.view";
                public const string Create = "sales.bonus_points.create";
                public const string Edit = "sales.bonus_points.edit";
                public const string Delete = "sales.bonus_points.delete";
            }
        }

        // ================================================================
        // STORES MODULE  (Sidebar: "Stores")
        // ================================================================
        public static class Stores
        {
            /// <summary>Request Transfer page - /request-transfer-list</summary>
            public static class RequestTransfer
            {
                public const string View = "stores.request_transfer.view";
                public const string Create = "stores.request_transfer.create";
                public const string Edit = "stores.request_transfer.edit";
                public const string Delete = "stores.request_transfer.delete";
                public const string Export = "stores.request_transfer.export";
                public const string Print = "stores.request_transfer.print";
            }

            /// <summary>Transfers page - /transfers-list</summary>
            public static class Transfers
            {
                public const string View = "stores.transfers.view";
                public const string Export = "stores.transfers.export";
                public const string Print = "stores.transfers.print";
            }

            /// <summary>Transfer Received page - /receive-transfer-list</summary>
            public static class TransferReceived
            {
                public const string View = "stores.transfer_received.view";
                public const string Export = "stores.transfer_received.export";
                public const string Print = "stores.transfer_received.print";
            }

            /// <summary>Store List page - /stores-list</summary>
            public static class StoreList
            {
                public const string View = "stores.store_list.view";
                public const string Create = "stores.store_list.create";
                public const string Edit = "stores.store_list.edit";
                public const string Delete = "stores.store_list.delete";
            }
        }

        // ================================================================
        // ADMIN MODULE  (Sidebar: "Administrator")
        // ================================================================
        public static class Admin
        {
            /// <summary>Computers page - /computers-list</summary>
            public static class Computers
            {
                public const string View = "admin.computers.view";
                public const string Create = "admin.computers.create";
                public const string Edit = "admin.computers.edit";
                public const string Delete = "admin.computers.delete";
            }

            /// <summary>Users page - /users-list</summary>
            public static class Users
            {
                public const string View = "admin.users.view";
                public const string Create = "admin.users.create";
                public const string Edit = "admin.users.edit";
                public const string Delete = "admin.users.delete";
                public const string Export = "admin.users.export";
                public const string Print = "admin.users.print";
            }

            /// <summary>API Logs page - /request-response-logs</summary>
            public static class ApiLogs
            {
                public const string View = "admin.api_logs.view";
                public const string Export = "admin.api_logs.export";
            }

            /// <summary>Role Management page - /role-management</summary>
            public static class RoleManagement
            {
                public const string View = "admin.role_management.view";
                public const string Create = "admin.role_management.create";
                public const string Edit = "admin.role_management.edit";
                public const string Delete = "admin.role_management.delete";
            }

            /// <summary>Tenant Roles page - /tenant-role-management</summary>
            public static class TenantRoles
            {
                public const string View = "admin.tenant_roles.view";
                public const string Create = "admin.tenant_roles.create";
                public const string Edit = "admin.tenant_roles.edit";
                public const string Delete = "admin.tenant_roles.delete";
            }

            /// <summary>Registers - admin placeholder</summary>
            public static class AdminRegisters
            {
                public const string View = "admin.admin_registers.view";
                public const string Edit = "admin.admin_registers.edit";
            }

            /// <summary>Setup - placeholder</summary>
            public static class Setup
            {
                public const string View = "admin.setup.view";
                public const string Edit = "admin.setup.edit";
            }

            /// <summary>User Security - admin placeholder</summary>
            public static class AdminUserSecurity
            {
                public const string View = "admin.admin_user_security.view";
                public const string Edit = "admin.admin_user_security.edit";
            }

            /// <summary>Licenses & Billing page - /licenses-billing
            /// (seeded since 2026-03-18 via 20260318_Add_LicensesBilling_Screens.sql)</summary>
            public static class LicensesBilling
            {
                public const string View = "admin.licenses_billing.view";
                public const string Edit = "admin.licenses_billing.edit";
            }

            /// <summary>OpenAPI prepaid-credit panel on the Licenses &amp; Billing page.
            /// Tenants view their wallet balance + per-API free-tier usage and can
            /// initiate a Stripe Checkout top-up. Seeded by 20260521_CustomerCredits_AndLedger.sql.</summary>
            public static class ApiCredits
            {
                public const string View = "admin.api_credits.view";
                public const string TopUp = "admin.api_credits.topup";
            }

            /// <summary>SuperAdmin-only API Pricing screen - /super-admin/api-pricing.
            /// Edits ApiDefinition.DefaultFreeTier / DefaultRatePerCall.
            /// Seeded by 20260521_CustomerCredits_AndLedger.sql.</summary>
            public static class ApiPricing
            {
                public const string View = "admin.api_pricing.view";
                public const string Edit = "admin.api_pricing.edit";
            }
        }

        // ================================================================
        // REPORTS MODULE  (Sidebar: "Reports")
        // ================================================================
        public static class Reports
        {
            /// <summary>Report Manager page - /report-manager</summary>
            public static class ReportManager
            {
                public const string View = "reports.report_manager.view";
                public const string Export = "reports.report_manager.export";
                public const string Print = "reports.report_manager.print";
            }

            /// <summary>AR Aging Report - /reports/ar-aging</summary>
            public static class ArAging
            {
                public const string View = "reports.ar_aging.view";
                public const string Export = "reports.ar_aging.export";
                public const string Print = "reports.ar_aging.print";
            }

            /// <summary>Customer List Report - /reports/customer-list</summary>
            public static class CustomerListReport
            {
                public const string View = "reports.customer_list_report.view";
                public const string Export = "reports.customer_list_report.export";
                public const string Print = "reports.customer_list_report.print";
            }

            /// <summary>Department Inventory Report - /reports/department-inventory</summary>
            public static class DepartmentInventory
            {
                public const string View = "reports.department_inventory.view";
                public const string Export = "reports.department_inventory.export";
                public const string Print = "reports.department_inventory.print";
            }

            /// <summary>Item Inventory Report - /reports/item-inventory</summary>
            public static class ItemInventory
            {
                public const string View = "reports.item_inventory.view";
                public const string Export = "reports.item_inventory.export";
                public const string Print = "reports.item_inventory.print";
            }

            /// <summary>Items In Partial Receive Report - /reports/items-in-partial-receive</summary>
            public static class ItemsInPartialReceive
            {
                public const string View = "reports.items_in_partial_receive.view";
                public const string Export = "reports.items_in_partial_receive.export";
                public const string Print = "reports.items_in_partial_receive.print";
            }

            /// <summary>Items On Purchase Order Report - /reports/items-on-purchase-order</summary>
            public static class ItemsOnPurchaseOrder
            {
                public const string View = "reports.items_on_purchase_order.view";
                public const string Export = "reports.items_on_purchase_order.export";
                public const string Print = "reports.items_on_purchase_order.print";
            }

            /// <summary>Items On Receive Order Report - /reports/items-on-receive-order</summary>
            public static class ItemsOnReceiveOrder
            {
                public const string View = "reports.items_on_receive_order.view";
                public const string Export = "reports.items_on_receive_order.export";
                public const string Print = "reports.items_on_receive_order.print";
            }

            /// <summary>Items Report - /reports/items</summary>
            public static class ItemsReport
            {
                public const string View = "reports.items_report.view";
                public const string Export = "reports.items_report.export";
                public const string Print = "reports.items_report.print";
            }

            /// <summary>Price Change History Report - /reports/price-change-history</summary>
            public static class PriceChangeHistory
            {
                public const string View = "reports.price_change_history.view";
                public const string Export = "reports.price_change_history.export";
                public const string Print = "reports.price_change_history.print";
            }

            /// <summary>Receive Inventory Value Report - /reports/receive-inventory-value</summary>
            public static class ReceiveInventoryValue
            {
                public const string View = "reports.receive_inventory_value.view";
                public const string Export = "reports.receive_inventory_value.export";
                public const string Print = "reports.receive_inventory_value.print";
            }

            /// <summary>Returned Items Report - /reports/returned-items</summary>
            public static class ReturnedItems
            {
                public const string View = "reports.returned_items.view";
                public const string Export = "reports.returned_items.export";
                public const string Print = "reports.returned_items.print";
            }

            /// <summary>Tax By Store Report - /reports/tax-by-store</summary>
            public static class TaxByStore
            {
                public const string View = "reports.tax_by_store.view";
                public const string Export = "reports.tax_by_store.export";
                public const string Print = "reports.tax_by_store.print";
            }

            /// <summary>Tax Collected Report - /reports/tax-collected</summary>
            public static class TaxCollected
            {
                public const string View = "reports.tax_collected.view";
                public const string Export = "reports.tax_collected.export";
                public const string Print = "reports.tax_collected.print";
            }
        }
    }
}
