
import React, { useEffect, memo } from "react";
import { useLocation } from "react-router";
import { useTabs } from "../../hooks/useTabs";
import { 
  UserIcon, 
  BoxIcon, 
  TableIcon, 
  PieChartIcon,
  DocsIcon,
  CalenderIcon,
  TaskIcon
} from "../../icons";

interface ActionButton {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  customButton?: React.ReactNode;
}

interface TabHeaderProps {
  actionButton?: ActionButton;
}

const TabHeader: React.FC<TabHeaderProps> = memo(({ actionButton }) => {
  const location = useLocation();
  const { openTabs, removeTab, switchToTab, initializeCurrentTab } = useTabs();

  // Initialize current tab when component mounts or route changes
  useEffect(() => {
    initializeCurrentTab();
  }, [location.pathname, initializeCurrentTab]);

  // Debug: Log when tabs change
  useEffect(() => {
    console.log('Open tabs:', openTabs);
  }, [openTabs]);

  const isActiveTab = (path: string) => {
    return location.pathname === path;
  };

  // Get icon based on tab path
  const getTabIcon = (path: string) => {
    if (path.includes('/users')) {
      return <UserIcon className="w-4 h-4" />;
    } else if (path.includes('/items')) {
      return <BoxIcon className="w-4 h-4" />;
    } else if (path.includes('/customers')) {
      return <UserIcon className="w-4 h-4" />;
    } else if (path.includes('/stores')) {
      return <BoxIcon className="w-4 h-4" />;
    } else if (path.includes('/vendors')) {
      return <UserIcon className="w-4 h-4" />;
    } else if (path.includes('/basic-tables')) {
      return <TableIcon className="w-4 h-4" />;
    } else if (path.includes('/dashboard')) {
      return <PieChartIcon className="w-4 h-4" />;
    } else if (path.includes('/calendar')) {
      return <CalenderIcon className="w-4 h-4" />;
    } else if (path.includes('/forms')) {
      return <DocsIcon className="w-4 h-4" />;
    } else if (path.includes('/phone-order')) {
      return <TaskIcon className="w-4 h-4" />;
    } else if (path.includes('/chart')) {
      return <PieChartIcon className="w-4 h-4" />;
    } else if (path.includes('/alert')) {
      return <DocsIcon className="w-4 h-4" />;
    } else if (path.includes('/avatar') || path.includes('/badge') || path.includes('/button') || path.includes('/image') || path.includes('/video')) {
      return <DocsIcon className="w-4 h-4" />;
    }
    // Default icon for unknown paths
    return <DocsIcon className="w-4 h-4" />;
  };

  // Get the route tab map to check if current route should have a tab
  const routeTabMap = {
    '/users-list': { id: 'users-list', name: 'Users', path: '/users-list', closeable: true },
    '/items-list': { id: 'items-list', name: 'Items', path: '/items-list', closeable: true },
    '/phone-orders': { id: 'phone-orders', name: 'Phone Orders', path: '/phone-orders', closeable: true },
    '/calendar': { id: 'calendar', name: 'Calendar', path: '/calendar', closeable: true },
    '/basic-tables': { id: 'basic-tables', name: 'Tables', path: '/basic-tables', closeable: true },
    '/form-elements': { id: 'form-elements', name: 'Forms', path: '/form-elements', closeable: true },
    '/bar-chart': { id: 'bar-chart', name: 'Bar Chart', path: '/bar-chart', closeable: true },
    '/line-chart': { id: 'line-chart', name: 'Line Chart', path: '/line-chart', closeable: true },
    '/alerts': { id: 'alerts', name: 'Alerts', path: '/alerts', closeable: true },
    '/avatars': { id: 'avatars', name: 'Avatars', path: '/avatars', closeable: true },
    '/badge': { id: 'badge', name: 'Badges', path: '/badge', closeable: true },
    '/buttons': { id: 'buttons', name: 'Buttons', path: '/buttons', closeable: true },
    '/images': { id: 'images', name: 'Images', path: '/images', closeable: true },
    '/videos': { id: 'videos', name: 'Videos', path: '/videos', closeable: true },
    '/customers-list': { id: 'customers-list', name: 'Customers', path: '/customers-list', closeable: true },
    '/stores-list': { id: 'stores-list', name: 'Stores', path: '/stores-list', closeable: true },
    '/vendors-list': { id: 'vendors-list', name: 'Vendors', path: '/vendors-list', closeable: true },
  };

  // Don't render if current route is not a valid tab route
  const currentRouteTab = routeTabMap[location.pathname as keyof typeof routeTabMap];
  if (!currentRouteTab && openTabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center justify-between" style={{ height: '52px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0 20px', gap: '4px' }}>
      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {openTabs.map((tab) => {
          const active = isActiveTab(tab.path);
          return (
            <div key={tab.id} className="relative flex items-center group flex-shrink-0">
              <button
                onClick={() => switchToTab(tab.path)}
                className="flex items-center gap-1.5 border-none transition-all duration-100"
                style={{
                  padding: '6px 11px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: active ? 500 : 400,
                  fontFamily: "'DM Sans', sans-serif",
                  color: active ? '#1e40af' : '#475569',
                  background: active ? '#dddeff' : 'transparent',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; } }}
                onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569'; } }}
              >
                <span style={{ width: '14px', height: '14px', opacity: active ? 0.7 : 0.5, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  {getTabIcon(tab.path)}
                </span>
                <span>{tab.name}</span>
                {tab.closeable && (
                  <span
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      removeTab(tab.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      width: '16px', height: '16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '3px',
                      fontSize: '11px',
                      color: '#94a3b8',
                      lineHeight: 1,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#c7caff'; e.currentTarget.style.color = '#1e40af'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                    title={`Close ${tab.name} tab`}
                  >
                    ✕
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* Close all button */}
      {openTabs.length > 1 && (
        <button
          onClick={() => openTabs.forEach(t => t.closeable && removeTab(t.id))}
          className="flex items-center gap-[5px] transition-all duration-100"
          style={{
            height: '28px', padding: '0 10px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            background: 'transparent',
            color: '#94a3b8',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '12px',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fca5a5'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          Close all
        </button>
      )}

      {/* Action Button */}
      {actionButton && (
        <div className="flex-shrink-0">
          {actionButton.customButton ? (
            actionButton.customButton
          ) : (
            <button
              onClick={actionButton.onClick}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm transition-colors"
              style={{ background: '#1e40af', borderColor: '#1e40af' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1a3799'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#1e40af'; }}
            >
              {actionButton.icon}
              {actionButton.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export default TabHeader;
