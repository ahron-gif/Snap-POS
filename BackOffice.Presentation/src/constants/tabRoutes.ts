/**
 * Map URL paths → dashboard tab configuration.
 *
 * Many "pages" in BackOffice are not real routes — they open as tabs inside the
 * <DashboardWithTabs /> shell at /dashboard. The sidebar uses this map to know
 * which component to mount when a menu item is clicked; the Help system uses it
 * to power "Go to this screen" navigation that targets the correct tab.
 *
 * If you add a new tab-based page, add its mapping here. Routes that have a
 * dedicated <Route> in App.tsx (e.g., /profile, /settings/printer-settings,
 * /help) do NOT need to be listed — they navigate directly.
 *
 * Sidebar ? help hint: also add tooltip text in constants/helpContent.ts
 * (or SIDEBAR_HELP_EXTRA_ROUTES in sidebarHelpPolicy.ts for direct routes).
 * Run helpContent.test.ts to verify.
 */

import { getReportDeepLinkTab, isReportDeepLinkable } from "./reportTabRoutes";

export interface TabRoute {
  component: string;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props?: Record<string, any>;
  /** Mirrors DashboardTab.editMode — when true the tab gets the yellow-asterisk indicator. */
  editMode?: boolean;
}

/** A resolved deep link: enough to call openTab(). `id` is set for report tabs
 *  (which need the stable `report-<reportId>` id); plain routes omit it. */
export interface DeepLinkTab {
  id?: string;
  component: string;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props?: Record<string, any>;
  editMode?: boolean;
  path: string;
}

export const pathToComponentMap: Record<string, TabRoute> = {
  "/items-list": { component: "ItemListPage", title: "Item List" },
  "/item/new": { component: "ItemFormPage", title: "New Item", editMode: true, props: { isNew: true } },
  "/items-with-inventory": { component: "ItemsWithInventoryPage", title: "Items With Inventory" },
  "/items-quick-list": { component: "ItemQuickListPage", title: "Item Quick List" },
  "/item-groups": { component: "ItemGroupListPage", title: "Item Groups" },
  "/item-group/new": { component: "ItemGroupFormPage", title: "New Item Group" },
  "/departments": { component: "DepartmentListPage", title: "Departments" },
  "/department/new": { component: "DepartmentFormPage", title: "New Department" },
  "/manufacturers": { component: "ManufacturerListPage", title: "Manufacturers" },
  "/manufacturer/new": { component: "ManufacturerFormPage", title: "New Manufacturer" },
  "/vendors-list": { component: "VendorListPage", title: "Vendors" },
  "/customers-list": { component: "CustomerListPage", title: "Customers" },
  "/stores-list": { component: "StoreListPage", title: "Stores" },
  "/users-list": { component: "UsersListPage", title: "Users" },
  "/phone-orders-list": { component: "PhoneOrderListPage", title: "Phone Orders" },
  "/report-manager": { component: "ReportManagerPage", title: "Report Manager" },
  "/label-designer": { component: "LabelDesignerPage", title: "Label Designer" },
  "/request-response-logs": { component: "RequestResponseLogPage", title: "Request/Response Logs" },
  "/adjust-inventory": { component: "AdjustInventoryPage", title: "Adjust Inventory" },
  "/purchase-orders-list": { component: "PurchaseOrderListPage", title: "Purchase Orders" },
  "/receive-orders-list": { component: "ReceiveOrderListPage", title: "Receive Orders" },
  "/payments-list": { component: "PaymentListPage", title: "Payments" },
  "/return-to-vendor-list": { component: "ReturnToVendorListPage", title: "Return To Vendor" },
  "/general-order-list": { component: "GeneralOrderListPage", title: "General Order" },
  "/items-on-phone-order-list": { component: "ItemOnPhoneOrderListPage", title: "Items On Phone Order" },
  "/item-details-on-phone-order-list": { component: "ItemDetailsOnPhoneOrderListPage", title: "Items Details on Phone Order" },
  "/replaced-items-list": { component: "ReplacedItemListPage", title: "Replaced Items" },
  "/receive-payments-list": { component: "ReceivePaymentListPage", title: "Receive Payment" },
  "/transactions-list": { component: "TransactionListPage", title: "Transactions" },
  "/registers-list": { component: "RegisterListPage", title: "Registers" },
  "/discounts-list": { component: "DiscountListPage", title: "Discounts" },
  "/discount/new": { component: "DiscountFormPage", title: "New Discount", props: { isNew: true } },
  "/request-transfer-list": { component: "RequestTransferListPage", title: "Request Transfer" },
  "/transfers-list": { component: "TransferListPage", title: "Transfers" },
  "/receive-transfer-list": { component: "ReceiveTransferListPage", title: "Transfers Received" },
  "/computers-list": { component: "ComputerListPage", title: "Computers" },
  "/tenant-admin/user-roles": { component: "TenantUserRolePage", title: "User Roles" },
  "/super-admin/tenant-customers": { component: "TenantCustomersPage", title: "Tenant Customers" },
  "/super-admin/label-import": { component: "LabelImportPage", title: "Label Import" },
  "/super-admin/group-import": { component: "GroupImportPage", title: "Group Import" },
  "/super-admin/plans": { component: "PlanManagementPage", title: "Plan Management" },
  "/super-admin/permission-ceiling": { component: "TenantPermissionCeilingPage", title: "Permission Ceiling" },
  "/super-admin/permission-registry": { component: "PermissionRegistryPage", title: "Permission Registry" },
  "/super-admin/user-tenants": { component: "UserTenantAssignmentPage", title: "User Tenants" },
  "/super-admin/grid-column-access": { component: "GridColumnAccessPage", title: "Grid Settings" },
  "/super-admin/security-settings": { component: "SecuritySettingsPage", title: "Security Settings" },
  "/super-admin/smtp-settings": { component: "SmtpSettingsPage", title: "SMTP Settings" },
  "/super-admin/global-pricing": { component: "GlobalPricingPage", title: "Global Pricing" },
  "/super-admin/billing-overview": { component: "BillingOverviewPage", title: "Billing Overview" },
  "/super-admin/licenses-billing": { component: "SuperAdminBillingPage", title: "Licenses & Billing" },
  "/reports/setup/custom-date-scope": { component: "CustomDateScopeListPage", title: "Custom Date Scope" },
  "/licenses-billing": { component: "LicensesAndBillingPage", title: "Licenses & Billing" },
  // Opened as a dashboard tab by DynamicSidebar even though App.tsx also has a
  // standalone /settings/printer-settings route — listed here so the tab mirrors
  // to /dashboard/settings/printer-settings and is deep-linkable.
  "/settings/printer-settings": { component: "PrinterSettingsPage", title: "Printer Settings" },
};

/** Whether a given path opens as a dashboard tab (vs. a regular React Router route). */
export function isTabRoute(path: string): boolean {
  return !!pathToComponentMap[path];
}

/** Lookup. Returns undefined for non-tab paths. */
export function getTabRoute(path: string): TabRoute | undefined {
  return pathToComponentMap[path];
}

/**
 * Reverse map: component name → its canonical dashboard path.
 *
 * Built only from "plain" landing/list entries — those with no editMode and no
 * preset props. Edit/new forms (e.g. ItemFormPage at /item/new) and report
 * pages opened with filter props are intentionally excluded: their URL would
 * need an id or serialized filters to round-trip, which is out of scope for the
 * active-tab → URL mirroring. For those tabs the address bar falls back to
 * /dashboard. First path wins when several map to one component.
 */
const componentToPath: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [path, cfg] of Object.entries(pathToComponentMap)) {
    if (cfg.editMode || cfg.props) continue;
    if (map[cfg.component] == null) map[cfg.component] = path;
  }
  return map;
})();

/**
 * The canonical sidebar path for a tab's component, or undefined when the tab
 * isn't safely deep-linkable (edit/new form, detail drill-down, report carrying
 * filters, or a component with no sidebar entry). `_refreshKey` is ignored — it
 * is an internal re-fetch trigger, not real navigational state.
 */
export function getPathForComponent(
  component: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props?: Record<string, any>,
): string | undefined {
  if (props && (props.id != null || props.isNew || props.mode === "new")) {
    return undefined;
  }
  return componentToPath[component];
}

/** The address-bar path that should reflect a given tab (always under /dashboard). */
export function dashboardUrlForTab(tab: {
  id?: string;
  component: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props?: Record<string, any>;
}): string {
  // Report tabs (opened from Report Manager) have a stable id `report-<reportId>`
  // and carry props.reportId — link them under /dashboard/reports/<reportId> when
  // the report is deep-linkable (has a dedicated page). Others fall back to /dashboard.
  if (tab.id && tab.id.startsWith("report-")) {
    const reportId =
      typeof tab.props?.reportId === "string" && tab.props.reportId
        ? tab.props.reportId
        : tab.id.slice("report-".length);
    return reportId && isReportDeepLinkable(reportId)
      ? `/dashboard/reports/${reportId}`
      : "/dashboard";
  }
  const key = getPathForComponent(tab.component, tab.props);
  return key ? `/dashboard${key}` : "/dashboard";
}

/**
 * Parse a /dashboard/<key> URL into the tab it should open, or null when the
 * URL is the bare shell or an unknown key. Used on first load so a shared or
 * bookmarked link opens the right tab on top of the restored workspace.
 */
export function parseDashboardDeepLink(pathname: string): DeepLinkTab | null {
  const prefix = "/dashboard";
  if (!pathname.startsWith(prefix)) return null;
  // '' for bare /dashboard, else a key like '/items-list'. Strip any trailing slash.
  const key = pathname.slice(prefix.length).replace(/\/$/, "");
  if (!key) return null;

  // Mapped sidebar/landing screens win first — this also covers the few keys
  // that live under /reports/ (e.g. /reports/setup/custom-date-scope).
  const route = pathToComponentMap[key];
  if (route) return { ...route, path: key };

  // Reports opened from Report Manager: /dashboard/reports/<reportId>.
  if (key.startsWith("/reports/")) {
    const reportId = key.slice("/reports/".length);
    const reportTab = getReportDeepLinkTab(reportId);
    if (reportTab) return { ...reportTab, path: key };
  }

  return null;
}
