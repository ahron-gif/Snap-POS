import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router"
import { lazy, Suspense, useEffect } from "react"
import SignIn from "./pages/AuthPages/SignIn"
import SignUp from "./pages/AuthPages/SignUp"
import ForgotPassword from "./pages/AuthPages/ForgotPassword";
import ResetPassword from "./pages/AuthPages/ResetPassword";
import NotFound from "./pages/OtherPage/NotFound"
import UserProfiles from "./pages/UserProfiles"
import Videos from "./pages/UiElements/Videos"
import Images from "./pages/UiElements/Images"
import Alerts from "./pages/UiElements/Alerts"
import Badges from "./pages/UiElements/Badges"
import Avatars from "./pages/UiElements/Avatars"
import Buttons from "./pages/UiElements/Buttons"
import LineChart from "./pages/Charts/LineChart"
import BarChart from "./pages/Charts/BarChart"
import Calendar from "./pages/Calendar"
import BasicTables from "./pages/Tables/BasicTables"
import FormElements from "./pages/Forms/FormElements"
import Blank from "./pages/Blank"
import PrinterSettingsPage from "./pages/Settings/PrinterSettings/PrinterSettingsPage"
import HelpCenterPage from "./pages/Help/HelpCenterPage"
import AppLayout from "./layout/AppLayout"
import SmartKartLayout from "./layout/SmartKartLayout"
import SmartKartOverview from "./pages/SmartKartRegistration/OverviewPage"
import SmartKartPermissions from "./pages/SmartKartRegistration/PermissionsPage"
import SmartKartTokens from "./pages/SmartKartRegistration/TokensPage"
import SmartKartTokenPermissions from "./pages/SmartKartRegistration/TokenPermissionsPage"
import SmartKartTokenStoreAccess from "./pages/SmartKartRegistration/TokenStoreAccessPage"
import SmartKartCustomers from "./pages/SmartKartRegistration/CustomersPage"
import SmartKartApplications from "./pages/SmartKartRegistration/ApplicationsPage"
import SmartKartAppRegistrations from "./pages/SmartKartRegistration/AppRegistrationsPage"
import { ScrollToTop } from "./components/common/ScrollToTop"
import DashboardWithTabs from "./pages/Dashboard/DashboardWithTabs"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { ProfileProvider } from "./context/ProfileContext"
import { PermissionProvider } from "./context/PermissionContext"
import ProtectedRoute from "./components/ProtectedRoute"
import { TenantProvider } from "./context/TenantContext"
import { TenantSetupProvider } from "./context/TenantSetupContext"
import { StoreProvider } from "./context/StoreContext"
import { DashboardTabProvider } from "./context/DashboardTabContext"
import { Provider } from 'react-redux'
import { store } from './store/store'
import { ExportNotificationProvider } from './components/common/ExportNotification'
import { HelpProvider } from './context/HelpContext'
import HelpDrawer from './components/help/HelpDrawer'
import { GoogleOAuthProvider } from '@react-oauth/google'
import TenantCustomersPage from "./pages/SuperAdmin/TenantCustomersPage"

// Super Admin pages
import SuperAdminLayout from "./pages/SuperAdmin/SuperAdminLayout"
import TenantManagementPage from "./pages/SuperAdmin/TenantManagementPage"
import LabelImportPage from "./pages/SuperAdmin/LabelImportPage"
import GroupImportPage from "./pages/SuperAdmin/GroupImportPage"
import PlanManagementPage from "./pages/SuperAdmin/PlanManagementPage"
import TenantPermissionCeilingPage from "./pages/SuperAdmin/TenantPermissionCeilingPage"
import PermissionRegistryPage from "./pages/SuperAdmin/PermissionRegistryPage"
import UserTenantAssignmentPage from "./pages/SuperAdmin/UserTenantAssignmentPage"
import SmtpSettingsPage from "./pages/SuperAdmin/SmtpSettingsPage"

// Tenant Admin pages
import TenantRoleListPage from "./pages/TenantAdmin/TenantRoleListPage"
import TenantUserRolePage from "./pages/TenantAdmin/TenantUserRolePage"

// Billing pages (lazy-loaded)
const GlobalPricingPage = lazy(() => import("./pages/SuperAdmin/GlobalPricingPage"))
const BillingOverviewPage = lazy(() => import("./pages/SuperAdmin/BillingOverviewPage"))
const CustomerBillingPage = lazy(() => import("./pages/SuperAdmin/CustomerBillingPage"))
const ApiPricingPage = lazy(() => import("./pages/SuperAdmin/ApiPricingPage"))
const LicensesAndBillingPage = lazy(() => import("./pages/LicensesAndBillingPage"))

// Preload critical lazy-loaded components to ensure they're included in the build
const preloadComponents = () => {
  import('./pages/vendors/VendorFormPage');
};

/**
 * Guard for /tenant-admin/* routes.
 * Ensures user is authenticated and has a tenant context (CustomerId).
 * Super admins can also access (they can switch tenant context).
 */
const TenantAdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isSuperAdmin } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  // Super admins can access tenant admin pages (they operate on behalf of tenants)
  // Regular users must have a tenant context (customerId)
  if (!isSuperAdmin()) {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const parsed = JSON.parse(userData);
      if (!parsed.customerId || parsed.customerId <= 0) {
        return <Navigate to="/dashboard" replace />;
      }
    }
  }

  return <>{children}</>;
};

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  // Preload components on mount
  useEffect(() => {
    preloadComponents();
  }, []);

  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Public routes */}
        <Route
          path="/signin"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <SignIn />}
        />
        <Route
          path="/signup"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <SignUp />}
        />
         <Route
          path="/forgot-password"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPassword />}
        />
        <Route
          path="/reset-password"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ResetPassword />}
        />

        {/* Protected routes */}
        <Route element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }>
          {/* Main Dashboard - all screens open here as tabs. The /* splat lets the
              active tab mirror into the address bar (/dashboard/items-list, etc.)
              and lets shared/bookmarked links open the matching tab on load, while
              still rendering the single tab shell. */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard/*" element={<DashboardWithTabs />} />

          {/* Others Page - these still have their own routes */}
          <Route path="/profile" element={<UserProfiles />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/blank" element={<Blank />} />
          <Route path="/settings/printer-settings" element={<PrinterSettingsPage />} />
          <Route path="/help" element={<HelpCenterPage />} />

          {/* Forms */}
          <Route path="/form-elements" element={<FormElements />} />

          {/* Tables */}
          <Route path="/basic-tables" element={<BasicTables />} />

          {/* Ui Elements */}
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/avatars" element={<Avatars />} />
          <Route path="/badge" element={<Badges />} />
          <Route path="/buttons" element={<Buttons />} />
          <Route path="/images" element={<Images />} />
          <Route path="/videos" element={<Videos />} />

          {/* Charts */}
          <Route path="/line-chart" element={<LineChart />} />
          <Route path="/bar-chart" element={<BarChart />} />

          {/* Super Admin routes - protected by SuperAdminLayout guard */}
          <Route path="/super-admin" element={<SuperAdminLayout />}>
            <Route index element={<Navigate to="/super-admin/tenants" replace />} />
            <Route path="tenants" element={<TenantManagementPage />} />
            <Route path="plans" element={<PlanManagementPage />} />
            <Route path="tenant-customers" element={<TenantCustomersPage />} />
            <Route path="label-import" element={<LabelImportPage />} />
            <Route path="group-import" element={<GroupImportPage />} />
            <Route path="permission-ceiling" element={<TenantPermissionCeilingPage />} />
            <Route path="permission-registry" element={<PermissionRegistryPage />} />
            <Route path="user-tenants" element={<UserTenantAssignmentPage />} />
            <Route path="global-pricing" element={<Suspense fallback={<div>Loading...</div>}><GlobalPricingPage /></Suspense>} />
            <Route path="billing-overview" element={<Suspense fallback={<div>Loading...</div>}><BillingOverviewPage /></Suspense>} />
            <Route path="customer-billing/:customerId" element={<Suspense fallback={<div>Loading...</div>}><CustomerBillingPage /></Suspense>} />
            <Route path="api-pricing" element={<Suspense fallback={<div>Loading...</div>}><ApiPricingPage /></Suspense>} />
            <Route path="smtp-settings" element={<SmtpSettingsPage />} />
            <Route path="smtp-settings/:customerId" element={<SmtpSettingsPage />} />
          </Route>

          {/* Tenant Admin routes - guarded by TenantAdminGuard */}
          <Route path="/tenant-admin/roles" element={<TenantAdminGuard><TenantRoleListPage /></TenantAdminGuard>} />
          <Route path="/tenant-admin/user-roles" element={<TenantAdminGuard><TenantUserRolePage /></TenantAdminGuard>} />

          {/* Billing route for customer users */}
          <Route path="/licenses-billing" element={<Suspense fallback={<div>Loading...</div>}><LicensesAndBillingPage /></Suspense>} />
        </Route>

        {/* SmartKart Registration - Separate layout with its own sidebar */}
        <Route element={
          <ProtectedRoute>
            <SmartKartLayout />
          </ProtectedRoute>
        }>
          <Route path="/smartkart-registration" element={<SmartKartOverview />} />
          <Route path="/smartkart-registration/permissions" element={<SmartKartPermissions />} />
          <Route path="/smartkart-registration/tokens" element={<SmartKartTokens />} />
          <Route path="/smartkart-registration/token-store-access" element={<SmartKartTokenStoreAccess />} />
          <Route path="/smartkart-registration/token-permissions" element={<SmartKartTokenPermissions />} />
          <Route path="/smartkart-registration/customers" element={<SmartKartCustomers />} />
          <Route path="/smartkart-registration/applications" element={<SmartKartApplications />} />
          <Route path="/smartkart-registration/app-registrations" element={<SmartKartAppRegistrations />} />
        </Route>

        {/* Fallback Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      {/* Help drawer lives inside the Router so it can use useLocation()/useNavigate(). */}
      <HelpDrawer />
    </Router>
  );
}

export default function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <Provider store={store}>
        <AuthProvider>
          <ProfileProvider>
            <PermissionProvider>
              <TenantProvider>
                <TenantSetupProvider>
                  <StoreProvider>
                    <DashboardTabProvider>
                      <ExportNotificationProvider>
                        <HelpProvider>
                          <AppRoutes />
                        </HelpProvider>
                      </ExportNotificationProvider>
                    </DashboardTabProvider>
                  </StoreProvider>
                </TenantSetupProvider>
              </TenantProvider>
            </PermissionProvider>
          </ProfileProvider>
        </AuthProvider>
      </Provider>
    </GoogleOAuthProvider>
  )
}