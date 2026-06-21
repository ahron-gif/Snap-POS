import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

// Assume these icons are imported from an icon library
import {
    BoxCubeIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  PieChartIcon,
  InventoryIcon,
  VendorIcon,
  CustomerIcon,
  RegisterIcon,
  SalesAndDiscountIcon,
  StoreIcon,
    LockIcon

} from "../icons";
import { useSidebar } from "../context/SidebarContext";
import { useDashboardTabs } from "../context/DashboardTabContext";
import UserDropdown from "../components/header/UserDropdown";
import DynamicSidebar from "./DynamicSidebar";
import { useAppSelector } from "../hooks/useAppSelector";
import { useAuth } from "../context/AuthContext";
import InfoHint from "../components/common/InfoHint";
import { getHelpContent } from "../constants/helpContent";
import { pathToComponentMap } from "../constants/tabRoutes";

// Tooltip component for collapsed menu items
const Tooltip: React.FC<{ text: string; visible: boolean; itemCount?: number }> = ({ text, visible, itemCount }) => {
  if (!visible) return null;
  return (
    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-xl whitespace-nowrap z-[100]
                    opacity-0 animate-[fadeSlideIn_0.2s_ease-out_forwards]">
      <div className="font-medium">{text}</div>
      {itemCount && itemCount > 0 && (
        <div className="text-xs text-gray-400 mt-0.5">{itemCount} items</div>
      )}
      <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
    </div>
  );
};

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean; isLabel?: boolean }[];
  disabled?: boolean;
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    subItems: [{ name: "Ecommerce", path: "/", pro: false }],
  },
  {
    icon: <InventoryIcon />,
    name: "Inventory",
    subItems: [
      // { name: "New Item", path: "/item/new", pro: false },
      { name: "Item List", path: "/items-list", pro: false },
      { name: "Item Quick List", path: "/items-quick-list", pro: false },
      { name: "Item Groups", path: "/item-groups", pro: false },
      { name: "Departments", path: "/departments", pro: false },
      { name: "Manufacturers", path: "/manufacturers", pro: false },
      { name: "Items With Inventory", path: "/items-with-inventory", pro: false },
      { name: "Label Designer", path: "/label-designer", pro: false },
      { name: "Adjust Inventory", path: "/adjust-inventory", pro: false },
      // { name: "Inventory Reports", path: "/", pro: false },
      // { name: "Sales Reports", path: "/", pro: false }

    ],
  },
  {
    icon: <VendorIcon />,
    name: "Vendors",
    disabled: true,
    subItems: [
      // { name: "New Vendor", path: "/", pro: false },
      { name: "Vendor List", path: "/vendors-list", pro: false },
      { name: "Purchase Orders", path: "/purchase-orders-list", pro: false },
      { name: "Receive Orders", path: "/receive-orders-list", pro: false },
      { name: "General Order", path: "/general-order-list", pro: false },
      { name: "Pay Bills", path: "/payments-list", pro: false },
      { name: "Return To Vendor", path: "/return-to-vendor-list", pro: false },
      // { name: "Payable Reports", path: "/", pro: false },
    ],
  },
  {
    icon: <CustomerIcon />,
    name: "Customers",
    disabled: true,
    subItems: [
      // { name: "New Customer", path: "/", pro: false },
      { name: "Customer List", path: "/customers-list", pro: false },
      { name: "Phone Order List", path: "/phone-orders-list", pro: false },
      { name: "Items On Phone Order", path: "/items-on-phone-order-list", pro: false },
      { name: "Items Details on Phone Order", path: "/item-details-on-phone-order-list", pro: false },
      { name: "Replaced Items", path: "/replaced-items-list", pro: false },
      { name: "CRM", path: "/", pro: false },
      { name: "Task List", path: "/", pro: false },
      { name: "Call List", path: "/", pro: false },
      { name: "Receive Payment", path: "/receive-payments-list", pro: false },
      // { name: "Customer Reports", path: "/", pro: false },

    ],
  },

  {
    icon: <RegisterIcon />,
    name: "Registers",
    disabled: true,
    subItems: [
      { name: "Transactions", path: "/transactions-list", pro: false },
      { name: "Register Settings", path: "/", pro: false },
      { name: "User Security", path: "/", pro: false },
      { name: "Registers", path: "/registers-list", pro: false },
      { name: "Layaway List", path: "/", pro: false },
      { name: "layaway Items", path: "/", pro: false },
      { name: "POS", path: "/", pro: false },
      { name: "Time Attendance", path: "/", pro: false },

    ],
  },
  {
    icon: <SalesAndDiscountIcon />,
    name: "Discounts",
    subItems: [
      { name: "Discount List", path: "/discounts-list", pro: false },
      { name: "New Discount", path: "/discount/new", pro: false }
    ],
  },
  {
    icon: <StoreIcon />,
    name: "Stores",
    disabled: true,
    subItems: [
      { name: "Request Transfer", path: "/request-transfer-list", pro: false },
      { name: "Transfers", path: "/transfers-list", pro: false },
      { name: "Transfer Received", path: "/receive-transfer-list", pro: false },
      // { name: "Switch Store", path: "/", pro: false },
      // { name: "Add Store", path: "/", pro: false },
      { name: "Store List", path: "/stores-list", pro: false },
      // { name: "Store Reports", path: "/", pro: false }
    ],
  }

  // {
  //   icon: <CalenderIcon />,
  //   name: "Calendar",
  //   path: "/calendar",
  // },
  // {
  //   icon: <UserCircleIcon />,
  //   name: "User Profile",
  //   path: "/profile",
  // },
  // {
  //   name: "Forms",
  //   icon: <ListIcon />,
  //   subItems: [{ name: "Form Elements", path: "/form-elements", pro: false }],
  // },
  // {
  //   name: "Tables",
  //   icon: <TableIcon />,
  //   subItems: [{ name: "Basic Tables", path: "/basic-tables", pro: false }],
  // },
  // {
  //   name: "Pages",
  //   icon: <PageIcon />,
  //   subItems: [
  //     { name: "Blank Page", path: "/blank", pro: false },
  //     { name: "404 Error", path: "/error-404", pro: false },
  //   ],
  // },
];

const othersItems: NavItem[] = [
  {
    icon: <PieChartIcon />,
    name: "Administrator",
    subItems: [
      { name: "Registers", path: "/", pro: false },
      { name: "Setup", path: "/", pro: false },
      { name: "User Security", path: "/", pro: false },
      { name: "Users", path: "/users-list", pro: false },
      { name: "API Logs", path: "/request-response-logs", pro: false },
      { name: "User Roles", path: "/tenant-admin/user-roles", pro: false },
      { name: "Licenses & Billing", path: "/licenses-billing", pro: false },
    ],
    },
    {
        icon: <BoxCubeIcon />,
        name: "Reports",
        subItems: [
            { name: "Report Manager", path: "/report-manager", pro: false },
        ],
    },
];

const superAdminItems: NavItem[] = [
  {
    icon: <LockIcon />,
    name: "Super Admin",
    subItems: [
      { name: "Tenant Customers", path: "/super-admin/tenant-customers", pro: false },
      { name: "Licenses & Billing", path: "/super-admin/licenses-billing", pro: false },
      { name: "Permission Ceiling", path: "/super-admin/permission-ceiling", pro: false },
      { name: "Permission Registry", path: "/super-admin/permission-registry", pro: false },
      { name: "Grid Settings", path: "/super-admin/grid-column-access", pro: false },
      { name: "Security Settings", path: "/super-admin/security-settings", pro: false },
      { name: "SMTP Settings", path: "/super-admin/smtp-settings", pro: false },
      { name: "OpenAPI", path: "/smartkart-registration", pro: false },
    ],
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v10m0 0l-3.5-3.5M12 13l3.5-3.5" />
        <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
      </svg>
    ),
    name: "Importing",
    subItems: [
      { name: "Label Import", path: "/super-admin/label-import", pro: false },
      { name: "Group Import", path: "/super-admin/group-import", pro: false },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { openTab } = useDashboardTabs();
  const { menuLoaded, menuLoading } = useAppSelector((state) => state.effectivePermission);
  const useDynamicMenu = menuLoaded || menuLoading;
  const { isSuperAdmin } = useAuth();

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others" | "superadmin";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [showHelpHints, setShowHelpHints] = useState<boolean>(() => {
    const saved = localStorage.getItem("showSidebarHelpHints");
    return saved !== "false";
  });

  const handleToggleHelpHints = useCallback(() => {
    setShowHelpHints((prev) => {
      const next = !prev;
      localStorage.setItem("showSidebarHelpHints", String(next));
      return next;
    });
  }, []);
  const sidebarItemInfo: Record<string, string> = {
    "/item-groups":
      "Use Item Groups to organize related items (for example, by hechsher or category).",
  };

  // const isActive = (path: string) => location.pathname === path;
  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname]
  );

  useEffect(() => {
    let submenuMatched = false;
    const menuSections: Array<{ type: string; items: NavItem[] }> = [
      { type: "main", items: navItems },
      { type: "others", items: othersItems },
      { type: "superadmin", items: superAdminItems },
    ];
    menuSections.forEach(({ type, items }) => {
      items.forEach((nav, index) => {
        if (nav.disabled) return;
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({
                type: type as "main" | "others" | "superadmin",
                index,
              });
              submenuMatched = true;
            }
          });
        }
      });
    });

    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [location, isActive]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others" | "superadmin") => {
    // If sidebar is collapsed, expand it first
    if (!isExpanded && !isMobileOpen) {
      toggleSidebar();
    }

    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  const renderMenuItems = (items: NavItem[], menuType: "main" | "others" | "superadmin") => (
    <ul className="flex flex-col gap-1">
      {items.map((nav, index) => {
        const itemKey = `${menuType}-${index}`;
        const isOpen = openSubmenu?.type === menuType && openSubmenu?.index === index;
        const hasActiveChild = nav.subItems?.some(sub => isActive(sub.path));

        // Disabled/greyed-out menu items (coming soon)
        if (nav.disabled) {
          return (
            <li key={nav.name} className="relative">
              <div
                onMouseEnter={() => !isExpanded && !isMobileOpen && setHoveredItem(itemKey)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`menu-item opacity-40 cursor-not-allowed ${
                  !isExpanded && !isMobileOpen ? "lg:justify-center" : "lg:justify-start"
                }`}
              >
                <span className="menu-item-icon-size text-gray-400 dark:text-gray-600">
                  {nav.icon}
                </span>
                {(isExpanded || isMobileOpen) && (
                  <span className="menu-item-text text-gray-400 dark:text-gray-600 flex-1 text-left">{nav.name}</span>
                )}
                {(isExpanded || isMobileOpen) && (
                  <span className="ml-auto text-[10px] font-medium text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-700/50 px-1.5 py-0.5 rounded">
                    Soon
                  </span>
                )}

                {/* Tooltip for collapsed sidebar */}
                {!isExpanded && !isMobileOpen && (
                  <Tooltip
                    text={`${nav.name} (Coming Soon)`}
                    visible={hoveredItem === itemKey}
                  />
                )}
              </div>
            </li>
          );
        }

        return (
          <li key={nav.name} className="relative">
            {nav.subItems ? (
              <button
                onClick={() => handleSubmenuToggle(index, menuType)}
                onMouseEnter={() => !isExpanded && !isMobileOpen && setHoveredItem(itemKey)}
                onMouseLeave={() => setHoveredItem(null)}
                className={`menu-item group ${
                  isOpen || hasActiveChild
                    ? "menu-item-active"
                    : "menu-item-inactive"
                } cursor-pointer ${
                  !isExpanded && !isMobileOpen ? "lg:justify-center" : "lg:justify-start"
                }`}
              >
                {/* Active indicator dot */}
                {hasActiveChild && !isOpen && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-brand-400" />
                )}

                <span
                  className={`menu-item-icon-size ${
                    isOpen || hasActiveChild
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isMobileOpen) && (
                  <span className="menu-item-text flex-1 text-left">{nav.name}</span>
                )}
                {(isExpanded || isMobileOpen) && (
                  <ChevronDownIcon
                    className={`ml-auto w-5 h-5 transition-transform duration-300 ease-out ${
                      isOpen
                        ? "rotate-180 text-brand-400"
                        : "text-sidebar-text-muted group-hover:text-brand-400"
                    }`}
                  />
                )}

                {/* Tooltip for collapsed sidebar */}
                {!isExpanded && !isMobileOpen && (
                  <Tooltip
                    text={nav.name}
                    visible={hoveredItem === itemKey}
                    itemCount={nav.subItems?.length}
                  />
                )}
              </button>
            ) : (
              nav.path && (
                <Link
                  to={nav.path}
                  onMouseEnter={() => !isExpanded && !isMobileOpen && setHoveredItem(itemKey)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`menu-item group ${
                    isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                  } ${!isExpanded && !isMobileOpen ? "lg:justify-center" : ""}`}
                >
                  <span
                    className={`menu-item-icon-size ${
                      isActive(nav.path)
                        ? "menu-item-icon-active"
                        : "menu-item-icon-inactive"
                    }`}
                  >
                    {nav.icon}
                  </span>
                  {(isExpanded || isMobileOpen) && (
                    <span className="menu-item-text">{nav.name}</span>
                  )}

                  {/* Tooltip for collapsed sidebar */}
                  {!isExpanded && !isMobileOpen && (
                    <Tooltip text={nav.name} visible={hoveredItem === itemKey} />
                  )}
                </Link>
              )
            )}
            {nav.subItems && (isExpanded || isMobileOpen) && (
              <div
                ref={(el) => {
                  subMenuRefs.current[itemKey] = el;
                }}
                className="overflow-hidden transition-all duration-300 ease-out"
                style={{
                  height: isOpen ? `${subMenuHeight[itemKey]}px` : "0px",
                  opacity: isOpen ? 1 : 0,
                }}
              >
                <ul className="mt-2 space-y-0.5 ml-9 border-l border-white/10 pl-3 list-none">
                  {nav.subItems.map((subItem, subIndex) => {
                    if (subItem.isLabel) {
                      return (
                        <li
                          key={`label-${subItem.name}-${subIndex}`}
                          className="mt-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-text-muted/70 select-none"
                          style={{
                            transitionDelay: isOpen ? `${subIndex * 30}ms` : '0ms',
                            opacity: isOpen ? 1 : 0,
                          }}
                        >
                          {subItem.name}
                        </li>
                      );
                    }
                    const tabConfig = pathToComponentMap[subItem.path];
                    const isTabEnabled = !!tabConfig;

                    const handleClick = (e: React.MouseEvent) => {
                      if (isTabEnabled && tabConfig) {
                        e.preventDefault();
                        // Open tab and navigate to dashboard
                        openTab({
                          component: tabConfig.component,
                          title: tabConfig.title,
                          closable: true,
                          ...(tabConfig.editMode ? { editMode: true } : {}),
                          ...(tabConfig.props ? { props: tabConfig.props } : {}),
                        });
                        // Ensure we're on the dashboard shell; the active tab
                        // then mirrors itself into the address bar. Already on a
                        // /dashboard/* path means the shell is mounted.
                        if (!location.pathname.startsWith('/dashboard')) {
                          navigate('/dashboard');
                        }
                      }
                    };

                    return (
                      <li
                        key={subItem.name}
                        className="transform transition-all duration-200"
                        style={{
                          transitionDelay: isOpen ? `${subIndex * 30}ms` : '0ms',
                          opacity: isOpen ? 1 : 0,
                          transform: isOpen ? 'translateX(0)' : 'translateX(-10px)',
                        }}
                      >
                        {isTabEnabled ? (
                          <button
                            onClick={handleClick}
                            className={`menu-dropdown-item group w-full text-left menu-dropdown-item-inactive`}
                          >
                            <span className="flex-1 flex items-center gap-2">
                              <span>{subItem.name}</span>
                              {subItem.path &&
                                sidebarItemInfo[subItem.path] &&
                                !(showHelpHints && getHelpContent(subItem.path)) && (
                                <span
                                  className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-sidebar-text-muted/50 text-[10px] text-sidebar-text-muted"
                                  title={sidebarItemInfo[subItem.path]}
                                  aria-label={`${subItem.name} info`}
                                >
                                  ?
                                </span>
                              )}
                            </span>
                            <span className="flex items-center gap-1 ml-auto">
                              {showHelpHints && subItem.path && getHelpContent(subItem.path) && (
                                <InfoHint
                                  text={getHelpContent(subItem.path)!}
                                  label={`${subItem.name} info`}
                                  className="mr-1"
                                />
                              )}
                              {subItem.new && (
                                <span className="menu-dropdown-badge-inactive menu-dropdown-badge">
                                  new
                                </span>
                              )}
                              {subItem.pro && (
                                <span className="menu-dropdown-badge-inactive menu-dropdown-badge">
                                  pro
                                </span>
                              )}
                            </span>
                          </button>
                        ) : (
                          <Link
                            to={subItem.path}
                            className={`menu-dropdown-item group ${
                              isActive(subItem.path)
                                ? "menu-dropdown-item-active"
                                : "menu-dropdown-item-inactive"
                            }`}
                          >
                            <span className="flex-1 flex items-center gap-2">
                              <span>{subItem.name}</span>
                              {subItem.path &&
                                sidebarItemInfo[subItem.path] &&
                                !(showHelpHints && getHelpContent(subItem.path)) && (
                                <span
                                  className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-sidebar-text-muted/50 text-[10px] text-sidebar-text-muted"
                                  title={sidebarItemInfo[subItem.path]}
                                  aria-label={`${subItem.name} info`}
                                >
                                  ?
                                </span>
                              )}
                            </span>

                            <span className="flex items-center gap-1 ml-auto">
                              {showHelpHints && subItem.path && getHelpContent(subItem.path) && (
                                <InfoHint
                                  text={getHelpContent(subItem.path)!}
                                  label={`${subItem.name} info`}
                                  className="mr-1"
                                />
                              )}
                              {subItem.new && (
                                <span
                                  className={`${
                                    isActive(subItem.path)
                                      ? "menu-dropdown-badge-active"
                                      : "menu-dropdown-badge-inactive"
                                  } menu-dropdown-badge`}
                                >
                                  new
                                </span>
                              )}
                              {subItem.pro && (
                                <span
                                  className={`${
                                    isActive(subItem.path)
                                      ? "menu-dropdown-badge-active"
                                      : "menu-dropdown-badge-inactive"
                                  } menu-dropdown-badge`}
                                >
                                  pro
                                </span>
                              )}
                            </span>
                          </Link>
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
  );

  return (
    <aside
      className={`fixed top-0 flex flex-col px-4 left-0 bg-sidebar-bg text-sidebar-text h-screen transition-all duration-300 ease-in-out z-50 border-r border-sidebar-border
        ${
          isExpanded || isMobileOpen
            ? "w-[260px]"
            : "w-[72px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
    >
      <div
        className={`py-6 flex items-center ${
          !isExpanded ? "lg:justify-center" : "justify-between"
        }`}
      >
        <button onClick={() => toggleSidebar()} className="flex items-center cursor-pointer">
          {isExpanded || isMobileOpen ? (
            <img
              src="./images/logo/snap-logo.png"
              alt="Snap POS"
              className="h-10 w-auto object-contain"
            />
          ) : (
            <img
              src="./favicon.png"
              alt="Snap POS"
              className="h-8 w-8 object-contain"
            />
          )}
        </button>
        {/* Close button for mobile sidebar */}
        {isMobileOpen && (
          <button
            onClick={toggleMobileSidebar}
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg text-sidebar-text-muted hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close sidebar"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar flex-1">
        {(isExpanded || isMobileOpen) && (
          <div className="px-2 pb-2">
            <button
              type="button"
              onClick={handleToggleHelpHints}
              className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded-md border border-sidebar-border text-sidebar-text-muted hover:text-sidebar-text hover:bg-gray-100 transition-colors"
            >
              <span>Show Info</span>
              <span className={`inline-flex h-4 w-8 items-center rounded-full transition-colors ${showHelpHints ? "bg-brand-500" : "bg-gray-600"}`}>
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${showHelpHints ? "translate-x-4" : "translate-x-1"}`}
                />
              </span>
            </button>
          </div>
        )}
        {useDynamicMenu ? (
          <DynamicSidebar showHelpHints={showHelpHints} />
        ) : (
          <nav className="mb-6">
            <div className="flex flex-col gap-4">
              <div>
                <h2
                  className={`mb-3 text-[11px] uppercase flex leading-[16px] font-semibold tracking-wider text-sidebar-text-muted ${
                    !isExpanded ? "lg:justify-center" : "justify-start"
                  }`}
                >
                  {isExpanded || isMobileOpen ? (
                    "Menu"
                  ) : (
                    <HorizontaLDots className="size-6" />
                  )}
                </h2>
                {renderMenuItems(navItems, "main")}
              </div>
              <div className="">
                <h2
                  className={`mb-3 text-[11px] uppercase flex leading-[16px] font-semibold tracking-wider text-sidebar-text-muted ${
                    !isExpanded ? "lg:justify-center" : "justify-start"
                  }`}
                >
                  {isExpanded || isMobileOpen ? (
                    "Others"
                  ) : (
                    <HorizontaLDots />
                  )}
                </h2>
                {renderMenuItems(othersItems, "others")}
              </div>
            </div>
          </nav>
        )}
        {/* Super Admin section only shown when dynamic menu is NOT active (dynamic menu already includes Super Admin from API) */}
        {isSuperAdmin() && !useDynamicMenu && (
          <nav className="mb-6">
            <div className="">
              <h2
                className={`mb-3 text-[11px] uppercase flex leading-[16px] font-semibold tracking-wider text-sidebar-text-muted ${
                  !isExpanded ? "lg:justify-center" : "justify-start"
                }`}
              >
                {isExpanded || isMobileOpen ? (
                  "Platform"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(superAdminItems, "superadmin")}
            </div>
          </nav>
        )}
      </div>
      {/* User Info - Sticky Bottom */}
      <div className="sticky bottom-0 border-t border-sidebar-border bg-sidebar-bg py-3">
        <UserDropdown sidebarMode={true} isExpanded={isExpanded || isMobileOpen} />
      </div>
    </aside>
  );
};

export default AppSidebar;