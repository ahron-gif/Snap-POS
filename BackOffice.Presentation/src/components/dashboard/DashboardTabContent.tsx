import React, { lazy, Suspense } from 'react';
import { useDashboardTabs } from '../../context/DashboardTabContext';
import Loader from '../ui/loader/Loader';
import TenantCustomersPage from '../../pages/SuperAdmin/TenantCustomersPage';
import LabelImportPage from '../../pages/SuperAdmin/LabelImportPage';
import GroupImportPage from '../../pages/SuperAdmin/GroupImportPage';
import PlanManagementPage from '../../pages/SuperAdmin/PlanManagementPage';
import TenantPermissionCeilingPage from '../../pages/SuperAdmin/TenantPermissionCeilingPage';
import PermissionRegistryPage from '../../pages/SuperAdmin/PermissionRegistryPage';
import UserTenantAssignmentPage from '../../pages/SuperAdmin/UserTenantAssignmentPage';
import GlobalPricingPage from '../../pages/SuperAdmin/GlobalPricingPage';
import BillingOverviewPage from '../../pages/SuperAdmin/BillingOverviewPage';
import CustomerBillingPage from '../../pages/SuperAdmin/CustomerBillingPage';
import SuperAdminBillingPage from '../../pages/SuperAdmin/SuperAdminBillingPage';
import SecuritySettingsPage from '../../pages/SuperAdmin/SecuritySettingsPage';
import SmtpSettingsPage from '../../pages/SuperAdmin/SmtpSettingsPage';

// Super Admin: lazy imports as fallback when static import is undefined (e.g. chunk loading)
const superAdminLazy: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  TenantCustomersPage: lazy(() => import('../../pages/SuperAdmin/TenantCustomersPage')),
  LabelImportPage: lazy(() => import('../../pages/SuperAdmin/LabelImportPage')),
  GroupImportPage: lazy(() => import('../../pages/SuperAdmin/GroupImportPage')),
  PlanManagementPage: lazy(() => import('../../pages/SuperAdmin/PlanManagementPage')),
  TenantPermissionCeilingPage: lazy(() => import('../../pages/SuperAdmin/TenantPermissionCeilingPage')),
  PermissionRegistryPage: lazy(() => import('../../pages/SuperAdmin/PermissionRegistryPage')),
  UserTenantAssignmentPage: lazy(() => import('../../pages/SuperAdmin/UserTenantAssignmentPage')),
  GlobalPricingPage: lazy(() => import('../../pages/SuperAdmin/GlobalPricingPage')),
  BillingOverviewPage: lazy(() => import('../../pages/SuperAdmin/BillingOverviewPage')),
  CustomerBillingPage: lazy(() => import('../../pages/SuperAdmin/CustomerBillingPage')),
  SuperAdminBillingPage: lazy(() => import('../../pages/SuperAdmin/SuperAdminBillingPage')),
  SecuritySettingsPage: lazy(() => import('../../pages/SuperAdmin/SecuritySettingsPage')),
  SmtpSettingsPage: lazy(() => import('../../pages/SuperAdmin/SmtpSettingsPage')),
};

// Prefer direct imports so tabs render without suspense when possible
const superAdminComponents: Record<string, React.ComponentType<any>> = {
  TenantCustomersPage,
  LabelImportPage,
  GroupImportPage,
  PlanManagementPage,
  TenantPermissionCeilingPage,
  PermissionRegistryPage,
  UserTenantAssignmentPage,
  GlobalPricingPage,
  BillingOverviewPage,
  CustomerBillingPage,
  SuperAdminBillingPage,
  SecuritySettingsPage,
  SmtpSettingsPage,
};

// Components that need outer padding (admin/billing screens)
const paddedComponents = new Set([
  'Home',
  'LicensesAndBillingPage',
  'PermissionSettingsPage',
  'TenantCustomersPage',
  'LabelImportPage',
  'GroupImportPage',
  'PlanManagementPage',
  'TenantPermissionCeilingPage',
  'PermissionRegistryPage',
  'UserTenantAssignmentPage',
  'GlobalPricingPage',
  'BillingOverviewPage',
  'CustomerBillingPage',
  'SuperAdminBillingPage',
  'SecuritySettingsPage',
  'SmtpSettingsPage',
  'CustomDateScopeListPage',
]);

// Component map: lazy for most, Super Admin from direct imports + lazy fallback
const componentMap: Record<string, React.LazyExoticComponent<React.ComponentType<any>> | React.ComponentType<any>> = {
  Home: lazy(() => import('../../pages/Dashboard/Home')),
  ItemListPage: lazy(() => import('../../pages/Items/ItemListPage')),
  ItemFormPage: lazy(() => import('../../pages/Items/ItemFormPage')),
  DepartmentListPage: lazy(() => import('../../pages/Departments/DepartmentListPage')),
  DepartmentFormPage: lazy(() => import('../../pages/Departments/DepartmentFormPage')),
  ItemGroupListPage: lazy(() => import('../../pages/ItemGroups/ItemGroupListPage')),
  ItemGroupFormPage: lazy(() => import('../../pages/ItemGroups/ItemGroupFormPage')),
  ManufacturerListPage: lazy(() => import('../../pages/Manufacturers/ManufacturerListPage')),
  ManufacturerFormPage: lazy(() => import('../../pages/Manufacturers/ManufacturerFormPage')),
  UsersListPage: lazy(() => import('../../pages/users/UsersListPage')),
  CustomerListPage: lazy(() => import('../../pages/customers/CustomerListPage')),
  VendorListPage: lazy(() => import('../../pages/vendors/VendorListPage')),
  VendorFormPage: lazy(() => import('../../pages/vendors/VendorFormPage')),
  StoreListPage: lazy(() => import('../../pages/stores/StoreListPage')),
  PhoneOrderListPage: lazy(() => import('../../pages/PhoneOrder/PhoneOrderListPage')),
  PhoneOrderFormPage: lazy(() => import('../../pages/PhoneOrder/PhoneOrderFormPage')),
  PermissionSettingsPage: lazy(() => import('../../pages/PermissionSettings/PermissionSettingsPage')),
  LicensesAndBillingPage: lazy(() => import('../../pages/LicensesAndBillingPage')),
  CustomDateScopeListPage: lazy(() => import('../../pages/Reports/Setup/CustomDateScopeListPage')),
  ...superAdminComponents,
};

// Loading spinner component
const LoadingSpinner: React.FC = () => (
  <Loader />
);

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; componentName: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; componentName: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error loading ${this.props.componentName}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-red-500">
          <p>Error loading "{this.props.componentName}"</p>
          <p className="text-sm text-gray-500 mt-2">{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Welcome message when no tabs are open
const WelcomeMessage: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-gray-500 dark:text-gray-400">
    <svg className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
    <h3 className="text-lg font-medium mb-2">Welcome to Dashboard</h3>
    <p className="text-sm text-center max-w-md">
      Select an item from the sidebar menu to open it in a new tab.
      <br />
      You can open multiple tabs and switch between them.
    </p>
  </div>
);

const DashboardTabContent: React.FC = () => {
  const { tabs, activeTabId } = useDashboardTabs();

  // Log available components on mount.
  // TEMPORARY DIAGNOSTIC: also expose the maps on `window.__dashboardDebug`
  // so we can verify at runtime which components actually registered.
  // Remove this block once the "Component not found" issue is resolved.
  React.useEffect(() => {
    console.log('DashboardTabContent mounted. Available components:', Object.keys(componentMap));
    const dbg = {
      componentMap: Object.keys(componentMap).sort(),
      superAdminLazy: Object.keys(superAdminLazy).sort(),
      superAdminComponents: Object.keys(superAdminComponents).sort(),
      paddedComponents: Array.from(paddedComponents).sort(),
      hasCustomDateScopeListPage: {
        inComponentMap: 'CustomDateScopeListPage' in componentMap,
        inPaddedComponents: paddedComponents.has('CustomDateScopeListPage'),
      },
      currentTabs: tabs.map((t) => ({ id: t.id, component: t.component, title: t.title })),
    };
    (window as unknown as { __dashboardDebug?: unknown }).__dashboardDebug = dbg;
    console.log('[DEBUG] window.__dashboardDebug attached:', dbg);
    // Intentionally not depending on `tabs` — we want one snapshot at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (tabs.length === 0) {
    return <WelcomeMessage />;
  }

  return (
    <div className="dashboard-tab-content h-full">
      {tabs.map((tab) => {
        const componentName = tab.component;
        // Resolve Super Admin from lazy map first (always defined); others from componentMap
        const Component =
          superAdminLazy[componentName] ??
          componentMap[componentName] ??
          superAdminComponents[componentName];

        if (!Component) {
          return (
            <div
              key={tab.id}
              className={activeTabId === tab.id ? 'block' : 'hidden'}
            >
              <div className="flex flex-col items-center justify-center h-64 text-red-500">
                <p>Component "{componentName}" not found</p>
                <p className="text-sm text-gray-500 mt-2">Available: {Object.keys(componentMap).join(', ')}</p>
              </div>
            </div>
          );
        }

        const needsPadding = paddedComponents.has(componentName);

        return (
          <div
            key={tab.id}
            className={activeTabId === tab.id ? 'block h-full' : 'hidden'}
          >
            <div className={needsPadding ? 'px-4 pb-4 pt-4 md:px-6 md:pb-6 h-full flex flex-col min-h-0 overflow-auto' : 'h-full flex flex-col min-h-0'}>
              <ErrorBoundary componentName={componentName}>
                <Suspense fallback={<LoadingSpinner />}>
                  {/* __tabId is injected so pages can wire `useUnsavedChanges`
                      to their specific tab. Forms opt-in by declaring it in
                      their props interface. */}
                  <Component {...(tab.props || {})} __tabId={tab.id} />
                </Suspense>
              </ErrorBoundary>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DashboardTabContent;
