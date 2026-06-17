import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAppSelector } from '../hooks/useAppSelector';
import { useSidebar } from '../context/SidebarContext';
import { useDashboardTabs } from '../context/DashboardTabContext';
import { ChevronDownIcon, HorizontaLDots, LockIcon } from '../icons';
import type { MenuModule, MenuScreen } from '../types/permission';
import InfoHint from '../components/common/InfoHint';
import { getHelpContent } from '../constants/helpContent';
import { isSidebarHelpRequired } from '../constants/sidebarHelpPolicy';

// ─── Icon resolver ───
// Maps icon strings returned from the API to simple SVG icons.
// Extend this map as new module icons are added to the backend.
const iconMap: Record<string, React.ReactNode> = {
  inventory: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  vendor: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  ),
  customer: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  register: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  sales: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  store: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  dashboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  admin: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  reports: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
  ),
};

function resolveIcon(iconKey: string): React.ReactNode {
  // Strip non-alpha, lowercase, then remove trailing "icon" suffix
  // e.g. "InventoryIcon" → "inventoryicon" → "inventory"
  const key = iconKey?.toLowerCase().replace(/[^a-z]/g, '').replace(/icon$/, '') ?? '';
  return iconMap[key] ?? iconMap.dashboard;
}

// Map route paths to tab component names (same as AppSidebar)
const pathToComponentMap: Record<string, { component: string; title: string; props?: Record<string, any>; editMode?: boolean }> = {
  '/items-list': { component: 'ItemListPage', title: 'Item List' },
  '/item/new': { component: 'ItemFormPage', title: 'New Item', editMode: true, props: { isNew: true } },
  '/items-with-inventory': { component: 'ItemsWithInventoryPage', title: 'Items With Inventory' },
  '/items-quick-list': { component: 'ItemQuickListPage', title: 'Item Quick List' },
  '/item-groups': { component: 'ItemGroupListPage', title: 'Item Groups' },
  '/item-group/new': { component: 'ItemGroupFormPage', title: 'New Item Group', props: { isNew: true } },
  '/departments': { component: 'DepartmentListPage', title: 'Departments' },
  '/department/new': { component: 'DepartmentFormPage', title: 'New Department', props: { isNew: true } },
  '/manufacturers': { component: 'ManufacturerListPage', title: 'Manufacturers' },
  '/manufacturer/new': { component: 'ManufacturerFormPage', title: 'New Manufacturer', props: { isNew: true } },
  '/vendors-list': { component: 'VendorListPage', title: 'Vendors' },
  '/customers-list': { component: 'CustomerListPage', title: 'Customers' },
  '/stores-list': { component: 'StoreListPage', title: 'Stores' },
  '/users-list': { component: 'UsersListPage', title: 'Users' },
  '/phone-orders-list': { component: 'PhoneOrderListPage', title: 'Phone Orders' },
  '/report-manager': { component: 'ReportManagerPage', title: 'Report Manager' },
  '/reports/setup/custom-date-scope': { component: 'CustomDateScopeListPage', title: 'Custom Date Scope' },
  '/label-designer': { component: 'LabelDesignerPage', title: 'Label Designer' },
  '/request-response-logs': { component: 'RequestResponseLogPage', title: 'Request/Response Logs' },
  '/adjust-inventory': { component: 'AdjustInventoryPage', title: 'Adjust Inventory' },
  '/purchase-orders-list': { component: 'PurchaseOrderListPage', title: 'Purchase Orders' },
  '/receive-orders-list': { component: 'ReceiveOrderListPage', title: 'Receive Orders' },
  '/payments-list': { component: 'PaymentListPage', title: 'Payments' },
  '/return-to-vendor-list': { component: 'ReturnToVendorListPage', title: 'Return To Vendor' },
  '/general-order-list': { component: 'GeneralOrderListPage', title: 'General Order' },
  '/items-on-phone-order-list': { component: 'ItemOnPhoneOrderListPage', title: 'Items On Phone Order' },
  '/item-details-on-phone-order-list': { component: 'ItemDetailsOnPhoneOrderListPage', title: 'Items Details on Phone Order' },
  '/replaced-items-list': { component: 'ReplacedItemListPage', title: 'Replaced Items' },
  '/receive-payments-list': { component: 'ReceivePaymentListPage', title: 'Receive Payment' },
  '/transactions-list': { component: 'TransactionListPage', title: 'Transactions' },
  '/registers-list': { component: 'RegisterListPage', title: 'Registers' },
  '/discounts-list': { component: 'DiscountListPage', title: 'Discounts' },
  '/discount/new': { component: 'DiscountFormPage', title: 'New Discount', props: { isNew: true } },
  '/request-transfer-list': { component: 'RequestTransferListPage', title: 'Request Transfer' },
  '/transfers-list': { component: 'TransferListPage', title: 'Transfers' },
  '/receive-transfer-list': { component: 'ReceiveTransferListPage', title: 'Transfers Received' },
  '/computers-list': { component: 'ComputerListPage', title: 'Computers' },
  '/tenant-admin/user-roles': { component: 'TenantUserRolePage', title: 'User Roles' },
  '/licenses-billing': { component: 'LicensesAndBillingPage', title: 'Licenses & Billing' },
  // Super Admin pages
  '/super-admin/tenant-customers': { component: 'TenantCustomersPage', title: 'Tenant Customers' },
  '/super-admin/label-import': { component: 'LabelImportPage', title: 'Label Import' },
  '/super-admin/plans': { component: 'PlanManagementPage', title: 'Plan Management' },
  '/super-admin/permission-ceiling': { component: 'TenantPermissionCeilingPage', title: 'Permission Ceiling' },
  '/super-admin/permission-registry': { component: 'PermissionRegistryPage', title: 'Permission Registry' },
  '/super-admin/user-tenants': { component: 'UserTenantAssignmentPage', title: 'User Tenants' },
  '/super-admin/global-pricing': { component: 'GlobalPricingPage', title: 'Global Pricing' },
  '/super-admin/billing-overview': { component: 'BillingOverviewPage', title: 'Billing Overview' },
  '/super-admin/licenses-billing': { component: 'SuperAdminBillingPage', title: 'Licenses & Billing' },
  '/smartkart-registration': { component: 'SmartKartRegistrationPage', title: 'OpenAPI' },
  '/settings/printer-settings': { component: 'PrinterSettingsPage', title: 'Printer Settings' },
};

// ─── Tooltip (same as AppSidebar) ───
const Tooltip: React.FC<{ text: string; visible: boolean; itemCount?: number }> = ({ text, visible, itemCount }) => {
  if (!visible) return null;
  return (
    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-xl whitespace-nowrap z-[100]
                    opacity-0 animate-[fadeSlideIn_0.2s_ease-out_forwards]">
      <div className="font-medium">{text}</div>
      {itemCount && itemCount > 0 && (
        <div className="text-xs text-gray-400 mt-0.5">{itemCount} items</div>
      )}
      <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45" />
    </div>
  );
};

// Modules that are not yet completed — greyed out with "Coming Soon"
const disabledModuleNames = new Set(['Stores']);

// Modules that navigate directly to a page (no submenu expansion)
const directNavModuleNames = new Set(['Reports']);

const warnedMissingSidebarHelp = new Set<string>();

function warnMissingSidebarHelp(route?: string) {
  if (!import.meta.env.DEV || !route) return;
  if (!isSidebarHelpRequired(route)) return;
  if (getHelpContent(route)) return;
  if (warnedMissingSidebarHelp.has(route)) return;
  warnedMissingSidebarHelp.add(route);
  console.warn(
    `[SidebarHelp] Missing ? hint for "${route}". Add text in constants/helpContent.ts (see sidebarHelpPolicy.ts).`
  );
}

// ─── Component ───

interface DynamicSidebarProps {
  showHelpHints?: boolean;
}

const DynamicSidebar: React.FC<DynamicSidebarProps> = ({ showHelpHints = true }) => {
  const { isExpanded, isMobileOpen, toggleSidebar } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { openTab } = useDashboardTabs();

  const { menuTree, menuLoaded, menuLoading } = useAppSelector((state) => state.effectivePermission);

  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const sidebarItemInfo: Record<string, string> = {
    "/item-groups":
      "Use Item Groups to organize related items (for example, by hechsher or category).",
  };

  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname]
  );

  // Auto-expand the submenu that contains the current route
  useEffect(() => {
    if (!menuLoaded || menuTree.length === 0) return;
    let matchedIndex: number | null = null;

    menuTree.forEach((mod, index) => {
      // Skip disabled and direct-navigation modules from auto-expanding
      if (disabledModuleNames.has(mod.name)) return;
      if (directNavModuleNames.has(mod.name)) return;
      mod.screens?.forEach((screen) => {
        if (screen.route && isActive(screen.route)) {
          matchedIndex = index;
        }
      });
    });

    setOpenSubmenu(matchedIndex);
  }, [location, isActive, menuTree, menuLoaded]);

  // Measure submenu heights for animation
  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `mod-${openSubmenu}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prev) => ({
          ...prev,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number) => {
    if (!isExpanded && !isMobileOpen) {
      toggleSidebar();
    }
    setOpenSubmenu((prev) => (prev === index ? null : index));
  };

  const handleScreenClick = (screen: MenuScreen, e: React.MouseEvent) => {
    const tabConfig = pathToComponentMap[screen.route];
    if (tabConfig) {
      e.preventDefault();
      openTab({
        component: tabConfig.component,
        title: tabConfig.title,
        closable: true,
        ...(tabConfig.editMode ? { editMode: true } : {}),
        ...(tabConfig.props ? { props: tabConfig.props } : {}),
      });
      if (!location.pathname.startsWith('/dashboard')) {
        navigate('/dashboard');
      }
    }
  };

  if (menuLoading) {
    return (
      <nav className="mb-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2
              className={`mb-3 text-[11px] uppercase flex leading-[16px] font-semibold tracking-wider text-sidebar-text-muted ${
                !isExpanded ? 'lg:justify-center' : 'justify-start'
              }`}
            >
              {isExpanded || isMobileOpen ? 'Menu' : <HorizontaLDots className="size-6" />}
            </h2>
            <div className="flex flex-col gap-2 px-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-9 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </nav>
    );
  }

  if (menuLoaded && menuTree.length === 0) {
    return (
      <nav className="mb-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2
              className={`mb-3 text-[11px] uppercase flex leading-[16px] font-semibold tracking-wider text-sidebar-text-muted ${
                !isExpanded ? 'lg:justify-center' : 'justify-start'
              }`}
            >
              {isExpanded || isMobileOpen ? 'Menu' : <HorizontaLDots className="size-6" />}
            </h2>
            {(isExpanded || isMobileOpen) ? (
              <div className="px-3 py-4 text-center">
                <div className="flex justify-center mb-3">
                  <span className="text-sidebar-text-muted opacity-50">
                    <LockIcon />
                  </span>
                </div>
                <p className="text-sm text-sidebar-text-muted mb-1">No Access</p>
                <p className="text-xs text-sidebar-text-muted/60 leading-relaxed">
                  You have not been assigned any roles or permissions. Please contact your administrator.
                </p>
              </div>
            ) : (
              <div className="flex justify-center px-2 py-3">
                <span className="text-sidebar-text-muted opacity-50">
                  <LockIcon />
                </span>
              </div>
            )}
          </div>
        </div>
      </nav>
    );
  }

  // ─── Frontend overrides for dynamic menu ───
  // Hide screens that are not yet implemented or temporarily disabled.
  // Rename modules where the backend label differs from the desired UI label.
  const hiddenRoutePrefixes = ['/bogo-discount', '/loyalty-management', '/bonus-points', '/coupon-code', '/computers-list'];
  const isRouteHidden = (route: string) =>
    hiddenRoutePrefixes.some((prefix) => route.startsWith(prefix)) ||
    !pathToComponentMap[route]; // Hide screens that have no implemented page
  const moduleNameOverrides: Record<string, string> = {
    'Sales & Discounts': 'Discounts',
  };

  // Modules that should navigate directly to a page instead of expanding a submenu.
  // Clicking "Reports" opens the Report Manager page directly (no submenu) —
  // the legacy behaviour, preserved on purpose. Custom Date Scope is surfaced
  // as its own top-level "Setup" group below, NOT nested under Reports.
  const directNavigationModules: Record<string, { route: string; component: string; title: string }> = {
    'Reports': { route: '/report-manager', component: 'ReportManagerPage', title: 'Report Manager' },
  };

  const collapsedModuleScreens: Record<string, string[]> = {
    'Reports': ['/report-manager'],
  };

  // Routes that the server seeds under another module but we surface under the
  // synthesized "Settings" module instead. Custom Date Scope ships under
  // Reports server-side; in the UI Reports stays direct-nav, so this screen
  // is lifted into Settings.
  const settingsHoistedRoutes = ['/reports/setup/custom-date-scope'];

  const hoistedSettingsScreens: MenuScreen[] = [];
  menuTree.forEach((mod) => {
    mod.screens?.forEach((s) => {
      if (s.route && settingsHoistedRoutes.includes(s.route)) {
        hoistedSettingsScreens.push(s);
      }
    });
  });

  const filteredMenuTree = menuTree
    .map((mod) => {
      const overriddenName = moduleNameOverrides[mod.name] ?? mod.name;
      const isDisabledMod = disabledModuleNames.has(mod.name) || disabledModuleNames.has(overriddenName);

      const allowedRoutes = collapsedModuleScreens[overriddenName] ?? collapsedModuleScreens[mod.name];

      let filteredScreens: MenuScreen[];
      if (isDisabledMod) {
        filteredScreens = mod.screens ?? [];
      } else if (allowedRoutes) {
        filteredScreens = (mod.screens ?? []).filter((s) => allowedRoutes.includes(s.route));
      } else {
        filteredScreens = (mod.screens?.filter((s) => !isRouteHidden(s.route)) ?? []);
      }

      filteredScreens = filteredScreens.filter((s) => !settingsHoistedRoutes.includes(s.route));

      return { ...mod, name: overriddenName, screens: filteredScreens };
    })
    .filter((mod) => {
      const isDisabledMod = disabledModuleNames.has(mod.name);
      return isDisabledMod || (mod.screens?.length ?? 0) > 0;
    });

  const settingsScreens: MenuScreen[] = [
    {
      screenId: -1001,
      code: 'PRINTER_SETTINGS',
      name: 'Printer Settings',
      route: '/settings/printer-settings', // requires ? hint in helpContent.ts
      icon: 'admin',
      sortOrder: 1,
    },
    ...hoistedSettingsScreens.map((s, i) => ({ ...s, sortOrder: 100 + i })),
  ];
  const lastSortOrderForSettings = filteredMenuTree.length > 0
    ? Math.max(...filteredMenuTree.map((m) => m.sortOrder ?? 0))
    : 0;
  filteredMenuTree.push({
    moduleId: -2,
    name: 'Settings',
    icon: 'admin',
    sortOrder: lastSortOrderForSettings + 1,
    screens: settingsScreens,
  } as MenuModule);

  return (
    <nav className="mb-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2
            className={`mb-3 text-[11px] uppercase flex leading-[16px] font-semibold tracking-wider text-sidebar-text-muted ${
              !isExpanded ? 'lg:justify-center' : 'justify-start'
            }`}
          >
            {isExpanded || isMobileOpen ? 'Menu' : <HorizontaLDots className="size-6" />}
          </h2>

          <ul className="flex flex-col gap-1">
            {filteredMenuTree
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((mod, index) => {
                const itemKey = `mod-${index}`;
                const isOpen = openSubmenu === index;
                const hasActiveChild = mod.screens?.some((s) => s.route && isActive(s.route));
                const isDisabled = disabledModuleNames.has(mod.name);

                // Disabled/greyed-out module (coming soon)
                if (isDisabled) {
                  return (
                    <li key={mod.moduleId} className="relative">
                      <div
                        onMouseEnter={() => !isExpanded && !isMobileOpen && setHoveredItem(itemKey)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className={`menu-item opacity-40 cursor-not-allowed ${
                          !isExpanded && !isMobileOpen ? 'lg:justify-center' : 'lg:justify-start'
                        }`}
                      >
                        <span className="menu-item-icon-size text-gray-400 dark:text-gray-600">
                          {resolveIcon(mod.icon)}
                        </span>
                        {(isExpanded || isMobileOpen) && (
                          <span className="menu-item-text text-gray-400 dark:text-gray-600 flex-1 text-left">{mod.name}</span>
                        )}
                        {(isExpanded || isMobileOpen) && (
                          <span className="ml-auto text-[10px] font-medium text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-700/50 px-1.5 py-0.5 rounded">
                            Soon
                          </span>
                        )}
                        {!isExpanded && !isMobileOpen && (
                          <Tooltip
                            text={`${mod.name} (Coming Soon)`}
                            visible={hoveredItem === itemKey}
                          />
                        )}
                      </div>
                    </li>
                  );
                }

                // Direct-navigation module (e.g. Reports → opens Report Manager directly)
                const directNav = directNavigationModules[mod.name];
                if (directNav) {
                  const isDirectActive = isActive(directNav.route) || hasActiveChild;
                  return (
                    <li key={mod.moduleId} className="relative">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          openTab({
                            component: directNav.component,
                            title: directNav.title,
                            closable: true,
                          });
                          if (!location.pathname.startsWith('/dashboard')) {
                            navigate('/dashboard');
                          }
                        }}
                        onMouseEnter={() => !isExpanded && !isMobileOpen && setHoveredItem(itemKey)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className={`menu-item group ${
                          isDirectActive ? 'menu-item-active' : 'menu-item-inactive'
                        } cursor-pointer ${
                          !isExpanded && !isMobileOpen ? 'lg:justify-center' : 'lg:justify-start'
                        }`}
                      >
                        {isDirectActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-brand-400" />
                        )}

                        <span
                          className={`menu-item-icon-size ${
                            isDirectActive ? 'menu-item-icon-active' : 'menu-item-icon-inactive'
                          }`}
                        >
                          {resolveIcon(mod.icon)}
                        </span>

                        {(isExpanded || isMobileOpen) && (
                          <span className="menu-item-text flex-1 text-left">{mod.name}</span>
                        )}

                        {!isExpanded && !isMobileOpen && (
                          <Tooltip
                            text={mod.name}
                            visible={hoveredItem === itemKey}
                          />
                        )}
                      </button>
                    </li>
                  );
                }

                return (
                  <li key={mod.moduleId} className="relative">
                    <button
                      onClick={() => handleSubmenuToggle(index)}
                      onMouseEnter={() => !isExpanded && !isMobileOpen && setHoveredItem(itemKey)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`menu-item group ${
                        isOpen || hasActiveChild ? 'menu-item-active' : 'menu-item-inactive'
                      } cursor-pointer ${
                        !isExpanded && !isMobileOpen ? 'lg:justify-center' : 'lg:justify-start'
                      }`}
                    >
                      {hasActiveChild && !isOpen && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-brand-400" />
                      )}

                      <span
                        className={`menu-item-icon-size ${
                          isOpen || hasActiveChild ? 'menu-item-icon-active' : 'menu-item-icon-inactive'
                        }`}
                      >
                        {resolveIcon(mod.icon)}
                      </span>

                      {(isExpanded || isMobileOpen) && (
                        <span className="menu-item-text flex-1 text-left">{mod.name}</span>
                      )}

                      {(isExpanded || isMobileOpen) && (
                        <ChevronDownIcon
                          className={`ml-auto w-5 h-5 transition-transform duration-300 ease-out ${
                            isOpen ? 'rotate-180 text-brand-400' : 'text-sidebar-text-muted group-hover:text-brand-400'
                          }`}
                        />
                      )}

                      {!isExpanded && !isMobileOpen && (
                        <Tooltip
                          text={mod.name}
                          visible={hoveredItem === itemKey}
                          itemCount={mod.screens?.length}
                        />
                      )}
                    </button>

                    {mod.screens && (isExpanded || isMobileOpen) && (
                      <div
                        ref={(el) => { subMenuRefs.current[itemKey] = el; }}
                        className="overflow-hidden transition-all duration-300 ease-out"
                        style={{
                          height: isOpen ? `${subMenuHeight[itemKey]}px` : '0px',
                          opacity: isOpen ? 1 : 0,
                        }}
                      >
                        <ul className="mt-2 space-y-0.5 ml-9 border-l border-white/10 pl-3 list-none">
                          {mod.screens
                            .slice()
                            .sort((a, b) => a.sortOrder - b.sortOrder)
                            .map((screen, subIndex) => {
                              warnMissingSidebarHelp(screen.route);
                              const tabConfig = pathToComponentMap[screen.route];
                              const isTabEnabled = !!tabConfig;

                              return (
                                <li
                                  key={screen.screenId}
                                  className="transform transition-all duration-200"
                                  style={{
                                    transitionDelay: isOpen ? `${subIndex * 30}ms` : '0ms',
                                    opacity: isOpen ? 1 : 0,
                                    transform: isOpen ? 'translateX(0)' : 'translateX(-10px)',
                                  }}
                                >
                                  {isTabEnabled ? (
                                    <button
                                      onClick={(e) => handleScreenClick(screen, e)}
                                      className="menu-dropdown-item group w-full text-left menu-dropdown-item-inactive"
                                    >
                                      <span className="flex-1 flex items-center gap-2">
                                        <span>{screen.name}</span>
                                        {screen.route &&
                                          sidebarItemInfo[screen.route] &&
                                          !(showHelpHints && getHelpContent(screen.route)) && (
                                          <span
                                            className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-sidebar-text-muted/50 text-[10px] text-sidebar-text-muted"
                                            title={sidebarItemInfo[screen.route]}
                                            aria-label={`${screen.name} info`}
                                          >
                                            ?
                                          </span>
                                        )}
                                      </span>
                                      {showHelpHints && screen.route && getHelpContent(screen.route) && (
                                        <InfoHint
                                          text={getHelpContent(screen.route)!}
                                          label={`${screen.name} info`}
                                          className="ml-auto mr-1"
                                        />
                                      )}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => handleScreenClick(screen, e)}
                                      className={`menu-dropdown-item group w-full text-left ${
                                        screen.route && isActive(screen.route)
                                          ? 'menu-dropdown-item-active'
                                          : 'menu-dropdown-item-inactive'
                                      }`}
                                    >
                                      <span className="flex-1 flex items-center gap-2">
                                        <span>{screen.name}</span>
                                        {screen.route &&
                                          sidebarItemInfo[screen.route] &&
                                          !(showHelpHints && getHelpContent(screen.route)) && (
                                          <span
                                            className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-sidebar-text-muted/50 text-[10px] text-sidebar-text-muted"
                                            title={sidebarItemInfo[screen.route]}
                                            aria-label={`${screen.name} info`}
                                          >
                                            ?
                                          </span>
                                        )}
                                      </span>
                                      {showHelpHints && screen.route && getHelpContent(screen.route) && (
                                        <InfoHint
                                          text={getHelpContent(screen.route)!}
                                          label={`${screen.name} info`}
                                          className="ml-auto mr-1"
                                        />
                                      )}
                                    </button>
                                  )}
                                </li>
                              );
                            })}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default DynamicSidebar;
