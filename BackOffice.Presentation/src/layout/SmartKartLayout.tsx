import { Outlet, useNavigate } from 'react-router';
import SmartKartSidebar from './SmartKartSidebar';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useTenant } from '../context/TenantContext';
import { useStore } from '../context/StoreContext';
import { ThemeToggleButton } from '../components/common/ThemeToggleButton';

const SmartKartHeader: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { currentTenant } = useTenant();
  const { currentStore } = useStore();

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 sm:px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      {/* Left - Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
        >
          Dashboard
        </button>
        <svg className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium text-gray-900 dark:text-white">SmartKart Registration</span>
      </div>

      {/* Right - User info + Theme */}
      <div className="flex items-center gap-4">
        {/* Tenant & Store info */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-right">
          {currentTenant && (
            <div>
              <span className="text-gray-400 dark:text-gray-500">Tenant: </span>
              <span className="text-gray-700 dark:text-gray-300 font-medium">{currentTenant.customerName}</span>
            </div>
          )}
          {currentStore && (
            <div>
              <span className="text-gray-400 dark:text-gray-500">Store: </span>
              <span className="text-gray-700 dark:text-gray-300 font-medium">{currentStore.storeName}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-gray-700"></div>

        {/* Theme Toggle */}
        <ThemeToggleButton />

        {/* User avatar */}
        <div className="flex items-center gap-2">
          <span className="hidden sm:block text-sm text-gray-700 dark:text-gray-300 font-medium">
            {user?.username || 'User'}
          </span>
          <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-gray-100 dark:ring-gray-700">
            <img
              src={profile?.profileImageUrl || "/images/user/owner.jpg"}
              alt="User"
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.src = "/images/user/owner.jpg" }}
            />
          </div>
        </div>
      </div>
    </header>
  );
};

const SmartKartLayout: React.FC = () => {
  return (
    <div className="h-screen flex overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <SmartKartSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <SmartKartHeader />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartKartLayout;
