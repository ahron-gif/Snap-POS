/**
 * Sidebar ? tooltip text shown next to menu items (when Help Hints are enabled).
 *
 * REQUIRED when adding a new sidebar screen:
 * 1. Add the route to tabRoutes.ts (or SIDEBAR_HELP_EXTRA_ROUTES in sidebarHelpPolicy.ts).
 * 2. Add a non-empty hint string below for that route.
 * 3. Run: npm run test:run -- helpContent.test.ts
 *
 * Missing hints fail CI. Exempt routes (create forms, hidden screens) live in sidebarHelpPolicy.ts.
 */
export const helpContentByRoute: Record<string, string> = {
  // Inventory
  "/items-list":
    "Browse and manage all items with filters, status actions, and quick edits.",
  "/items-quick-list":
    "Use a lighter, faster item listing view for quick lookups and simple actions.",
  "/item-groups":
    "Use Item Groups to organize related items (for example, by hechsher or category).",
  "/departments":
    "Manage department structure and defaults used for item setup and reporting.",
  "/manufacturers":
    "Manage manufacturer records used when classifying and filtering inventory items.",
  "/items-with-inventory":
    "View item inventory across stores to compare stock levels in one place.",
  "/label-designer":
    "Design and manage item label layouts used for printing.",
  "/adjust-inventory":
    "Apply inventory quantity adjustments and review adjustment-related inventory data.",

  // Discounts
  "/discounts-list":
    "Manage discount rules, activation status, and discount behavior used at checkout.",
  "/discount/new":
    "Create a new discount definition and configure how and when it applies.",

  // Vendors
  "/vendors-list":
    "Manage vendor records and related purchasing workflows.",
  "/purchase-orders-list":
    "Review and manage purchase orders sent to vendors.",
  "/receive-orders-list":
    "Track incoming vendor shipments and receiving activity.",
  "/general-order-list":
    "Manage general vendor order workflows and related records.",
  "/payments-list":
    "Review and manage payment transactions to vendors.",
  "/return-to-vendor-list":
    "Create and track return-to-vendor records for outbound returns.",

  // Customers
  "/customers-list":
    "Manage customer records, profile details, and account-level operations.",
  "/phone-orders-list":
    "Manage phone order intake, updates, and fulfillment flow.",
  "/items-on-phone-order-list":
    "Review items currently associated with phone orders.",
  "/item-details-on-phone-order-list":
    "See detailed item-level information for phone order entries.",
  "/replaced-items-list":
    "Track replaced/substituted items related to customer orders.",
  "/receive-payments-list":
    "Record and review payments received from customers.",

  // Registers / Store operations
  "/transactions-list":
    "Browse register transactions for auditing, lookup, and operational review.",
  "/registers-list":
    "Manage register definitions and register-level operational settings.",
  "/request-transfer-list":
    "Create and track inventory transfer requests between stores.",
  "/transfers-list":
    "Review transfer documents and in-transit inventory movements.",
  "/receive-transfer-list":
    "Receive and reconcile transferred inventory at destination stores.",
  "/stores-list":
    "Manage store records and store-level operational settings.",

  // Administrator / platform
  "/computers-list":
    "Manage workstation/computer records used in store and office operations.",
  "/users-list":
    "Manage users, access, and operational user assignments.",
  "/request-response-logs":
    "Inspect API request/response logs for troubleshooting and audit purposes.",
  "/tenant-admin/user-roles":
    "Assign and manage tenant user roles and permission grouping.",
  "/licenses-billing":
    "Review current licenses and billing details for this tenant.",

  // Reports / setup
  "/report-manager":
    "Run business reports and export operational and financial data.",
  "/reports/setup/custom-date-scope":
    "Configure reusable custom date ranges for report filtering.",

  // Settings
  "/settings/printer-settings":
    "Pair the Print Helper, map receipt and label printers, and run test prints for this store.",

  // Super Admin
  "/super-admin/tenant-customers":
    "Manage tenant customer accounts across the platform.",
  "/super-admin/label-import":
    "Import a tenant's legacy desktop Back Office label layouts into the web Label Designer, with previews and per-layout warnings.",
  "/super-admin/group-import":
    "Import a tenant's legacy desktop user groups into the web platform as RBAC roles, with previews and duplicate protection.",
  "/super-admin/licenses-billing":
    "Review and manage cross-tenant license and billing operations.",
  "/super-admin/permission-ceiling":
    "Set permission ceilings to control maximum assignable access by tenant.",
  "/super-admin/permission-registry":
    "Manage the global permission catalog used by platform roles.",
  "/super-admin/user-tenants":
    "Control user-to-tenant assignments across the platform.",
  "/super-admin/grid-column-access":
    "Manage grid column visibility and access policy at scale.",
  "/super-admin/security-settings":
    "Configure platform-wide security settings and controls.",
  "/super-admin/smtp-settings":
    "Configure platform email/SMTP settings for system messaging.",
  "/smartkart-registration":
    "Open API registration and integration management workspace.",
};

export const getHelpContent = (route?: string): string | undefined => {
  if (!route) return undefined;
  return helpContentByRoute[route];
};
