import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useDashboardTabs } from '../../context/DashboardTabContext';
import { useAppSelector } from '../../hooks/useAppSelector';
import { dashboardUrlForTab, parseDashboardDeepLink } from '../../constants/tabRoutes';
import DashboardTabBar from '../../components/dashboard/DashboardTabBar';
import Loader from '../../components/ui/loader/Loader';

// Lazy load components for better performance
const ItemListPage = lazy(() => import('../Items/ItemListPage'));
const ItemFormPage = lazy(() => import('../Items/ItemFormPage'));
const ItemViewPage = lazy(() => import('../Items/ItemViewPage'));
const ItemsWithInventoryPage = lazy(() => import('../Items/ItemsWithInventoryPage'));
const ItemQuickListPage = lazy(() => import('../Items/ItemQuickListPage'));
const ItemGroupListPage = lazy(() => import('../ItemGroups/ItemGroupListPage'));
const ItemGroupFormPage = lazy(() => import('../ItemGroups/ItemGroupFormPage'));
const DepartmentListPage = lazy(() => import('../Departments/DepartmentListPage'));
const DepartmentFormPage = lazy(() => import('../Departments/DepartmentFormPage'));
const ManufacturerListPage = lazy(() => import('../Manufacturers/ManufacturerListPage'));
const ManufacturerFormPage = lazy(() => import('../Manufacturers/ManufacturerFormPage'));
const VendorListPage = lazy(() => import('../vendors/VendorListPage'));
const CustomerListPage = lazy(() => import('../customers/CustomerListPage'));
const StoreListPage = lazy(() => import('../stores/StoreListPage'));
const UsersListPage = lazy(() => import('../users/UsersListPage'));
const UserFormPage = lazy(() => import('../users/UserFormPage'));
const PhoneOrderListPage = lazy(() => import('../PhoneOrder/PhoneOrderListPage'));
const PhoneOrderFormPage = lazy(() => import('../PhoneOrder/PhoneOrderFormPage'));
const ReportManagerPage = lazy(() => import('../Reports/ReportManagerPage'));
const ReportViewerPage = lazy(() => import('../Reports/ReportViewerPage'));
const TaxCollectedReportPage = lazy(() => import('../Reports/TaxCollectedReportPage'));
const ReturnedItemsReportPage = lazy(() => import('../Reports/ReturnedItemsReportPage'));
const TaxByStoreReportPage = lazy(() => import('../Reports/TaxByStoreReportPage'));
const TenderTotalsReportPage = lazy(() => import('../Reports/TenderTotalsReportPage'));
const TenderTotalsByStationReportPage = lazy(() => import('../Reports/TenderTotalsByStationReportPage'));
const ShiftReportPage = lazy(() => import('../Reports/ShiftReportPage'));
const TotalTendersForShiftPage = lazy(() => import('../Reports/TotalTendersForShiftPage'));
const TenderTotalsDetailsPage = lazy(() => import('../Reports/TenderTotalsDetailsPage'));
const OnAccountSalesReportPage = lazy(() => import('../Reports/OnAccountSalesReportPage'));
const OnAccountSalesDetailsPage = lazy(() => import('../Reports/OnAccountSalesDetailsPage'));
const OnAccountPaymentsReportPage = lazy(() => import('../Reports/OnAccountPaymentsReportPage'));
const DailyHourSalesReportPage = lazy(() => import('../Reports/DailyHourSalesReportPage'));
const DailyHourSalesDetailsPage = lazy(() => import('../Reports/DailyHourSalesDetailsPage'));
const ActionSummaryReportPage = lazy(() => import('../Reports/ActionSummaryReportPage'));
const ActionDetailsReportPage = lazy(() => import('../Reports/ActionDetailsReportPage'));
const SummaryReportPage = lazy(() => import('../Reports/SummaryReportPage'));
const MonthlyWeeklyDailyReportPage = lazy(() => import('../Reports/MonthlyWeeklyDailyReportPage'));
const ItemDailySalesReportPage = lazy(() => import('../Reports/ItemDailySalesReportPage'));
const ItemDailySalesPivotPage = lazy(() => import('../Reports/ItemDailySalesPivotPage'));
const ItemWeeklySalesPivotPage = lazy(() => import('../Reports/ItemWeeklySalesPivotPage'));
const ItemMonthlySalesPivotPage = lazy(() => import('../Reports/ItemMonthlySalesPivotPage'));
const ItemSalesTransactionsDetailsPage = lazy(() => import('../Reports/ItemSalesTransactionsDetailsPage'));
const DepartmentDailySalesPivotPage = lazy(() => import('../Reports/DepartmentDailySalesPivotPage'));
const DepartmentWeeklySalesPivotPage = lazy(() => import('../Reports/DepartmentWeeklySalesPivotPage'));
const DepartmentMonthlySalesPivotPage = lazy(() => import('../Reports/DepartmentMonthlySalesPivotPage'));
const SalesSummaryByTransactionReportPage = lazy(() => import('../Reports/SalesSummaryByTransactionReportPage'));
const SalesSummaryByTransactionDetailsPage = lazy(() => import('../Reports/SalesSummaryByTransactionDetailsPage'));
const SalesSummaryByItemReportPage = lazy(() => import('../Reports/SalesSummaryByItemReportPage'));
const SalesSummaryByItemDetailsPage = lazy(() => import('../Reports/SalesSummaryByItemDetailsPage'));
const SalesSummaryByDepartmentReportPage = lazy(() => import('../Reports/SalesSummaryByDepartmentReportPage'));
const SalesSummaryByDiscountReportPage = lazy(() => import('../Reports/SalesSummaryByDiscountReportPage'));
const SalesSummaryByDiscountDetailsPage = lazy(() => import('../Reports/SalesSummaryByDiscountDetailsPage'));
const SalesSummaryBySpecialsReportPage = lazy(() => import('../Reports/SalesSummaryBySpecialsReportPage'));
const DateComparisonReportPage = lazy(() => import('../Reports/DateComparisonReportPage'));
const ItemInventoryReportPage = lazy(() => import('../Reports/ItemInventoryReportPage'));
const DepartmentInventoryReportPage = lazy(() => import('../Reports/DepartmentInventoryReportPage'));
const ItemsOnPurchaseOrderReportPage = lazy(() => import('../Reports/ItemsOnPurchaseOrderReportPage'));
const ReceiveInventoryValueReportPage = lazy(() => import('../Reports/ReceiveInventoryValueReportPage'));
const ItemsInPartialReceiveReportPage = lazy(() => import('../Reports/ItemsInPartialReceiveReportPage'));
const ItemsOnReceiveOrderReportPage = lazy(() => import('../Reports/ItemsOnReceiveOrderReportPage'));
const PriceChangeHistoryReportPage = lazy(() => import('../Reports/PriceChangeHistoryReportPage'));
const ArAgingReportsPage = lazy(() => import('../Reports/ArAgingReportsPage'));
const CustomerListReportPage = lazy(() => import('../Reports/CustomerListReportPage'));
const LabelDesignerPage = lazy(() => import('../LabelDesigner/LabelDesignerPage'));
const RequestResponseLogPage = lazy(() => import('../TenantLogs/RequestResponseLogPage'));
const QuickReportPage = lazy(() => import('../Items/QuickReportPage'));
const AdjustInventoryPage = lazy(() => import('../Inventory/AdjustInventoryPage'));
const PurchaseOrderListPage = lazy(() => import('../PurchaseOrder/PurchaseOrderListPage'));
const ReceiveOrderListPage = lazy(() => import('../ReceiveOrders/ReceiveOrderListPage'));
const PaymentListPage = lazy(() => import('../Payments/PaymentListPage'));
const ReturnToVendorListPage = lazy(() => import('../ReturnToVendor/ReturnToVendorListPage'));
const GeneralOrderListPage = lazy(() => import('../GeneralOrder/GeneralOrderListPage'));
const ItemOnPhoneOrderListPage = lazy(() => import('../ItemOnPhoneOrder/ItemOnPhoneOrderListPage'));
const ItemDetailsOnPhoneOrderListPage = lazy(() => import('../ItemDetailsOnPhoneOrder/ItemDetailsOnPhoneOrderListPage'));
const ReplacedItemListPage = lazy(() => import('../ReplacedItems/ReplacedItemListPage'));
const ReceivePaymentListPage = lazy(() => import('../ReceivePayments/ReceivePaymentListPage'));
const TransactionListPage = lazy(() => import('../Transactions/TransactionListPage'));
const RegisterListPage = lazy(() => import('../Registers/RegisterListPage'));
const DiscountListPage = lazy(() => import('../Discounts/DiscountListPage'));
const DiscountFormPage = lazy(() => import('../Discounts/DiscountFormPage'));
const DiscountDetailPage = lazy(() => import('../Discounts/DiscountDetailPage'));
const ComingSoonPage = lazy(() => import('../Common/ComingSoonPage'));
const RequestTransferListPage = lazy(() => import('../RequestTransfer/RequestTransferListPage'));
const TransferListPage = lazy(() => import('../Transfers/TransferListPage'));
const ReceiveTransferListPage = lazy(() => import('../ReceiveTransfer/ReceiveTransferListPage'));
const ComputerListPage = lazy(() => import('../Computers/ComputerListPage'));
const PermissionSettingsPage = lazy(() => import('../PermissionSettings/PermissionSettingsPage'));
const TenantRoleListPage = lazy(() => import('../TenantAdmin/TenantRoleListPage'));
const TenantUserRolePage = lazy(() => import('../TenantAdmin/TenantUserRolePage'));
const Home = lazy(() => import('./Home'));
// Super Admin (opened as tabs from sidebar)
const TenantCustomersPage = lazy(() => import('../SuperAdmin/TenantCustomersPage'));
const LabelImportPage = lazy(() => import('../SuperAdmin/LabelImportPage'));
const GroupImportPage = lazy(() => import('../SuperAdmin/GroupImportPage'));
const PlanManagementPage = lazy(() => import('../SuperAdmin/PlanManagementPage'));
const TenantPermissionCeilingPage = lazy(() => import('../SuperAdmin/TenantPermissionCeilingPage'));
const PermissionRegistryPage = lazy(() => import('../SuperAdmin/PermissionRegistryPage'));
const UserTenantAssignmentPage = lazy(() => import('../SuperAdmin/UserTenantAssignmentPage'));
const GlobalPricingPage = lazy(() => import('../SuperAdmin/GlobalPricingPage'));
const BillingOverviewPage = lazy(() => import('../SuperAdmin/BillingOverviewPage'));
const CustomerBillingPage = lazy(() => import('../SuperAdmin/CustomerBillingPage'));
const SuperAdminBillingPage = lazy(() => import('../SuperAdmin/SuperAdminBillingPage'));
const SecuritySettingsPage = lazy(() => import('../SuperAdmin/SecuritySettingsPage'));
const GridColumnAccessPage = lazy(() => import('../SuperAdmin/GridColumnAccessPage'));
const SmtpSettingsPage = lazy(() => import('../SuperAdmin/SmtpSettingsPage'));
// Reports → Setup → Custom Date Scope (tenant-scoped CRUD).
const CustomDateScopeListPage = lazy(() => import('../Reports/Setup/CustomDateScopeListPage'));
const LicensesAndBillingPage = lazy(() => import('../LicensesAndBillingPage'));
const PrinterSettingsPage = lazy(() => import('../Settings/PrinterSettings/PrinterSettingsPage'));

// Component registry - maps component names to actual components
const componentRegistry: Record<string, React.LazyExoticComponent<React.FC<any>>> = {
  'Home': Home,
  'ItemListPage': ItemListPage,
  'ItemFormPage': ItemFormPage,
  'ItemViewPage': ItemViewPage,
  'ItemsWithInventoryPage': ItemsWithInventoryPage,
  'ItemQuickListPage': ItemQuickListPage,
  'ItemGroupListPage': ItemGroupListPage,
  'ItemGroupFormPage': ItemGroupFormPage,
  'DepartmentListPage': DepartmentListPage,
  'DepartmentFormPage': DepartmentFormPage,
  'ManufacturerListPage': ManufacturerListPage,
  'ManufacturerFormPage': ManufacturerFormPage,
  'VendorListPage': VendorListPage,
  'CustomerListPage': CustomerListPage,
  'StoreListPage': StoreListPage,
  'UsersListPage': UsersListPage,
  'UserFormPage': UserFormPage,
  'PhoneOrderListPage': PhoneOrderListPage,
  'PhoneOrderFormPage': PhoneOrderFormPage,
  'ReportManagerPage': ReportManagerPage,
  'ReportViewerPage': ReportViewerPage,
  'TaxCollectedReportPage': TaxCollectedReportPage,
  'ReturnedItemsReportPage': ReturnedItemsReportPage,
  'TaxByStoreReportPage': TaxByStoreReportPage,
  'TenderTotalsReportPage': TenderTotalsReportPage,
  'TenderTotalsByStationReportPage': TenderTotalsByStationReportPage,
  'ShiftReportPage': ShiftReportPage,
  'TotalTendersForShiftPage': TotalTendersForShiftPage,
  'TenderTotalsDetailsPage': TenderTotalsDetailsPage,
  'OnAccountSalesReportPage': OnAccountSalesReportPage,
  'OnAccountSalesDetailsPage': OnAccountSalesDetailsPage,
  'OnAccountPaymentsReportPage': OnAccountPaymentsReportPage,
  'DailyHourSalesReportPage': DailyHourSalesReportPage,
  'DailyHourSalesDetailsPage': DailyHourSalesDetailsPage,
  'ActionSummaryReportPage': ActionSummaryReportPage,
  'ActionDetailsReportPage': ActionDetailsReportPage,
  'SummaryReportPage': SummaryReportPage,
  'MonthlyWeeklyDailyReportPage': MonthlyWeeklyDailyReportPage,
  'ItemDailySalesReportPage': ItemDailySalesReportPage,
  'ItemDailySalesPivotPage': ItemDailySalesPivotPage,
  'ItemWeeklySalesPivotPage': ItemWeeklySalesPivotPage,
  'ItemMonthlySalesPivotPage': ItemMonthlySalesPivotPage,
  'ItemSalesTransactionsDetailsPage': ItemSalesTransactionsDetailsPage,
  'DepartmentDailySalesPivotPage': DepartmentDailySalesPivotPage,
  'DepartmentWeeklySalesPivotPage': DepartmentWeeklySalesPivotPage,
  'DepartmentMonthlySalesPivotPage': DepartmentMonthlySalesPivotPage,
  'SalesSummaryByTransactionReportPage': SalesSummaryByTransactionReportPage,
  'SalesSummaryByTransactionDetailsPage': SalesSummaryByTransactionDetailsPage,
  'SalesSummaryByItemReportPage': SalesSummaryByItemReportPage,
  'SalesSummaryByItemDetailsPage': SalesSummaryByItemDetailsPage,
  'SalesSummaryByDepartmentReportPage': SalesSummaryByDepartmentReportPage,
  'SalesSummaryByDiscountReportPage': SalesSummaryByDiscountReportPage,
  'SalesSummaryByDiscountDetailsPage': SalesSummaryByDiscountDetailsPage,
  'SalesSummaryBySpecialsReportPage': SalesSummaryBySpecialsReportPage,
  'DateComparisonReportPage': DateComparisonReportPage,
  'ItemInventoryReportPage': ItemInventoryReportPage,
  'DepartmentInventoryReportPage': DepartmentInventoryReportPage,
  'ItemsOnPurchaseOrderReportPage': ItemsOnPurchaseOrderReportPage,
  'ReceiveInventoryValueReportPage': ReceiveInventoryValueReportPage,
  'ItemsInPartialReceiveReportPage': ItemsInPartialReceiveReportPage,
  'ItemsOnReceiveOrderReportPage': ItemsOnReceiveOrderReportPage,
  'PriceChangeHistoryReportPage': PriceChangeHistoryReportPage,
  'ArAgingReportsPage': ArAgingReportsPage,
  'CustomerListReportPage': CustomerListReportPage,
  'LabelDesignerPage': LabelDesignerPage,
  'RequestResponseLogPage': RequestResponseLogPage,
  'QuickReportPage': QuickReportPage,
  'AdjustInventoryPage': AdjustInventoryPage,
  'PurchaseOrderListPage': PurchaseOrderListPage,
  'ReceiveOrderListPage': ReceiveOrderListPage,
  'PaymentListPage': PaymentListPage,
  'ReturnToVendorListPage': ReturnToVendorListPage,
  'GeneralOrderListPage': GeneralOrderListPage,
  'ItemOnPhoneOrderListPage': ItemOnPhoneOrderListPage,
  'ItemDetailsOnPhoneOrderListPage': ItemDetailsOnPhoneOrderListPage,
  'ReplacedItemListPage': ReplacedItemListPage,
  'ReceivePaymentListPage': ReceivePaymentListPage,
  'TransactionListPage': TransactionListPage,
  'RegisterListPage': RegisterListPage,
  'DiscountListPage': DiscountListPage,
  'DiscountFormPage': DiscountFormPage,
  'DiscountDetailPage': DiscountDetailPage,
  'ComingSoonPage': ComingSoonPage,
  'RequestTransferListPage': RequestTransferListPage,
  'TransferListPage': TransferListPage,
  'ReceiveTransferListPage': ReceiveTransferListPage,
  'ComputerListPage': ComputerListPage,
  'PermissionSettingsPage': PermissionSettingsPage,
  'TenantRoleListPage': TenantRoleListPage,
  'TenantUserRolePage': TenantUserRolePage,
  'TenantCustomersPage': TenantCustomersPage,
  'LabelImportPage': LabelImportPage,
  'GroupImportPage': GroupImportPage,
  'PlanManagementPage': PlanManagementPage,
  'TenantPermissionCeilingPage': TenantPermissionCeilingPage,
  'PermissionRegistryPage': PermissionRegistryPage,
  'UserTenantAssignmentPage': UserTenantAssignmentPage,
  'GlobalPricingPage': GlobalPricingPage,
  'BillingOverviewPage': BillingOverviewPage,
  'CustomerBillingPage': CustomerBillingPage,
  'SuperAdminBillingPage': SuperAdminBillingPage,
  'LicensesAndBillingPage': LicensesAndBillingPage,
  'SecuritySettingsPage': SecuritySettingsPage,
  'GridColumnAccessPage': GridColumnAccessPage,
  'SmtpSettingsPage': SmtpSettingsPage,
  'CustomDateScopeListPage': CustomDateScopeListPage,
  'PrinterSettingsPage': PrinterSettingsPage,
};

// Loading component
const TabLoadingSpinner: React.FC = () => (
  <Loader size="lg" label="Loading..." />
);

const DashboardWithTabs: React.FC = () => {
  const {
    tabs,
    activeTabId,
    openTab,
    restoreWorkspace,
    isRestoringWorkspace,
    restoreError,
    clearRestoreError,
    clearAllTabState,
  } = useDashboardTabs();
  const hasRestoredRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  // Captured once: the URL at mount may be a deep link (e.g. /dashboard/items-list)
  // that should open its tab after workspace restore. We read it before restore
  // mutates tab state, which would otherwise rewrite the address bar first.
  const initialPathRef = useRef(location.pathname);
  // Gates the active-tab → URL mirror until the initial restore + deep-link open
  // has run, so restoring the saved workspace doesn't clobber an incoming link.
  // State (not a ref) so flipping it re-runs the mirror effect to sync the URL
  // to the restored active tab on a plain /dashboard load.
  const [didInit, setDidInit] = useState(false);
  // Tracks which tabs have been activated at least once. Used by the mount-once
  // renderer below to decide whether to render a hidden DOM tree for a tab.
  // We use a ref (not state) because adding to this set must NOT trigger a
  // re-render — the actual visibility flip is driven by `activeTabId` already.
  const mountedTabIdsRef = useRef<Set<string>>(new Set());

  // Active tenant — the value that stamps the CustomerId API header. When a super
  // admin switches tenant, force every open tab to refresh with the NEW tenant's
  // data without closing tabs or reloading the page: reset the keep-alive set so
  // inactive tabs lazy-remount fresh on next activation (no N parallel refetches),
  // and wipe the per-tab state cache so forms don't restore the old tenant's
  // values. The tenant id is also part of each tab's React key (below), which
  // remounts the currently-active tab immediately. (clearAllTabState only clears a
  // ref — no setState — so running this during render is safe and idempotent.)
  const currentCustomerId = useAppSelector((s) => s.customer.currentCustomer?.customerId) ?? null;
  const prevTenantRef = useRef(currentCustomerId);
  if (prevTenantRef.current !== currentCustomerId) {
    prevTenantRef.current = currentCustomerId;
    mountedTabIdsRef.current = new Set();
    clearAllTabState();
  }

  // Restore workspace on first mount
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    void restoreWorkspace().finally(() => {
      // A shared/bookmarked /dashboard/<screen> link opens its tab on top of the
      // restored workspace. openTab() focuses it if it's already open.
      const deepLink = parseDashboardDeepLink(initialPathRef.current);
      if (deepLink) {
        openTab({
          ...(deepLink.id ? { id: deepLink.id } : {}),
          component: deepLink.component,
          title: deepLink.title,
          closable: true,
          ...(deepLink.editMode ? { editMode: true } : {}),
          ...(deepLink.props ? { props: deepLink.props } : {}),
        });
      }
      setDidInit(true);
    });
  }, [restoreWorkspace, openTab]);

  // Mirror the active tab into the address bar so screens are linkable and the
  // URL reflects where the user is. Uses replace() so tab-to-tab switching does
  // not flood the back-stack — Back/Forward traversal across tabs is out of
  // scope here. Tabs with no canonical path (edit/new forms, filtered reports,
  // drill-downs) fall back to /dashboard.
  useEffect(() => {
    if (!didInit) return;
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const target = activeTab ? dashboardUrlForTab(activeTab) : '/dashboard';
    if (location.pathname !== target) {
      navigate(target, { replace: true });
    }
  }, [didInit, activeTabId, tabs, navigate, location.pathname]);

  // Prune the keep-alive set when tabs are closed so we don't keep stale
  // entries forever. The next render will skip mounting anything that's not in
  // the current `tabs` list anyway, but we clean the ref to be safe.
  useEffect(() => {
    if (mountedTabIdsRef.current.size === 0) return;
    const liveIds = new Set(tabs.map((t) => t.id));
    let changed = false;
    for (const id of Array.from(mountedTabIdsRef.current)) {
      if (!liveIds.has(id)) {
        mountedTabIdsRef.current.delete(id);
        changed = true;
      }
    }
    // No setState needed — the ref is intentionally side-channel state. The
    // boolean is kept so this block reads as intentional and lint stays happy.
    void changed;
  }, [tabs]);

  const handleRetryRestore = () => {
    hasRestoredRef.current = true; // keep local guard, but re-invoke manually
    restoreWorkspace(true); // force past the provider's once-per-session guard
  };

  return (
    <div className="dashboard-with-tabs h-full flex flex-col">
      {/* Tab Bar */}
      <DashboardTabBar />

      {/* Restore-error banner — lets the user recover if the session-restore
          request failed or timed out, instead of getting stuck on a spinner. */}
      {restoreError && !isRestoringWorkspace && (
        <div className="mx-4 mt-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-900/20 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.2 16a2 2 0 001.73 3z" />
            </svg>
            <div className="text-sm text-amber-800 dark:text-amber-200 truncate">
              <span className="font-medium">Couldn't restore your tabs.</span>{' '}
              <span className="text-amber-700 dark:text-amber-300">{restoreError}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleRetryRestore}
              disabled={isRestoringWorkspace}
              className="px-3 py-1 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-md transition-colors disabled:opacity-50"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={clearRestoreError}
              className="px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-md transition-colors"
            >
              Start fresh
            </button>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {/*
        Mount-once, keep-alive renderer:
        - Each tab is mounted the first time it becomes active.
        - On subsequent tab switches we DON'T unmount — we just hide the
          inactive tab's container with `display: none`. The component keeps
          its state (filters, fetched data, scroll position, unsaved form
          input), so when the user comes back the table is exactly as they
          left it. This is what fixes the "switch to detail / back -> filters
          and data are gone" complaint.
        - Closed tabs are still purged on the next render (the `tabs` array
          drives the .map), so memory doesn't leak across closes.
        - The very first activation of a tab is the only point we trigger the
          underlying component's data fetch.

        Trade-off: each opened tab keeps its memory + any background work
        (polling, websockets) until the tab is closed. Reports do a single
        fetch on mount so this is cheap; if a future tab does heavy
        background work, it can self-pause based on `document.visibilityState`.
      */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          // Skip rendering tabs that have never been activated yet — they'll
          // mount when the user first clicks them. This keeps the initial
          // workspace-restore from triggering N parallel fetches.
          if (!mountedTabIdsRef.current.has(tab.id) && !isActive) return null;
          if (isActive) mountedTabIdsRef.current.add(tab.id);

          const Component = componentRegistry[tab.component];
          if (!Component) {
            if (!isActive) return null;
            return (
              <div key={tab.id} className="h-full min-h-0 flex flex-col">
                <div className="flex items-center justify-center h-full min-h-[400px]">
                  <p className="text-gray-500 dark:text-gray-400">
                    Component "{tab.component}" not found
                  </p>
                </div>
              </div>
            );
          }

          // Key on tab.id only — NEVER include props in the key. If we hashed
          // filters here, any tab.props update (e.g. Report Manager re-issuing
          // filters, drill-downs touching _refreshKey) would change the key,
          // force React to unmount the old tree, and discard the user's local
          // state (their picked date, applied store, scroll position). That's
          // exactly the "date keeps resetting across tabs" bug.
          //
          // The way to get a fully fresh report is to close the tab and reopen
          // it — closeTab removes it from the tabs array, so the next openTab
          // creates a brand-new instance with the latest props from the caller.
          //
          // The tenant id is appended so a super-admin tenant switch remounts the
          // tab (refetch with the new CustomerId header). Within a tenant this is
          // constant, so normal tab switching still preserves filters/scroll/data.
          const tabKey = `${tab.id}::${currentCustomerId ?? 'none'}`;

          const needsPadding = [
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
            'SecuritySettingsPage',
            'SmtpSettingsPage',
            'GlobalPricingPage',
            'BillingOverviewPage',
            'CustomerBillingPage',
            'SuperAdminBillingPage',
            'GridColumnAccessPage',
            'CustomDateScopeListPage',
            'PrinterSettingsPage',
          ].includes(tab.component);

          // In-flow show/hide:
          //   Active tab: `flex-1 min-h-0 flex flex-col` -> takes all remaining height in the
          //     flex-column parent (the same as the original single-child layout did).
          //   Inactive tab: `display: none` -> stays in the React tree (keeps state) but
          //     contributes nothing to layout, so the active tab gets the full area to itself.
          return (
            <div
              key={tabKey}
              className="flex-1 min-h-0 flex flex-col"
              style={isActive ? undefined : { display: 'none' }}
              aria-hidden={!isActive}
            >
              <div className={needsPadding ? 'px-4 pb-4 pt-4 md:px-6 md:pb-6 h-full flex flex-col min-h-0 overflow-auto' : 'h-full min-h-0 overflow-hidden'}>
                <Suspense fallback={<TabLoadingSpinner />}>
                  {/* Match DashboardTabContent: forms need __tabId for useUnsavedChanges + updateTabProps (e.g. item pager). */}
                  <Component {...(tab.props || {})} __tabId={tab.id} />
                </Suspense>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardWithTabs;
