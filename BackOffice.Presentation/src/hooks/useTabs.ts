
import { useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';

interface Tab {
  id: string;
  name: string;
  path: string;
  closeable?: boolean;
}

export const useTabs = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);

  const addTab = useCallback((tab: Tab) => {
    setOpenTabs(prev => {
      const exists = prev.find(t => t.path === tab.path);
      if (exists) {
        // If tab exists, just navigate to it
        if (location.pathname !== tab.path) {
          navigate(tab.path);
        }
        return prev;
      }
      // Add new tab and navigate to it
      navigate(tab.path);
      return [...prev, { ...tab, closeable: true }];
    });
  }, [location.pathname, navigate]);

  const removeTab = useCallback((tabId: string) => {
    console.log('removeTab called with tabId:', tabId);
    
    // Get current state synchronously for navigation logic
    const currentTabs = openTabs;
    const tabToRemove = currentTabs.find(tab => tab.id === tabId);
    const removedTabIndex = currentTabs.findIndex(tab => tab.id === tabId);
    
    if (!tabToRemove) {
      console.log('Tab not found:', tabId);
      return;
    }
    
    console.log('Removing tab:', tabToRemove, 'at index:', removedTabIndex);
    
    const filteredTabs = currentTabs.filter(tab => tab.id !== tabId);
    console.log('Filtered tabs after removal:', filteredTabs);
    
    // Check if we're removing the currently active tab
    const isRemovingActiveTab = location.pathname === tabToRemove.path;
    console.log('Is removing active tab?', isRemovingActiveTab);
    
    // Immediately update the state to remove the tab from UI
    setOpenTabs(filteredTabs);
    
    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      // Handle navigation logic
      if (isRemovingActiveTab) {
        console.log('Removing active tab, need to navigate');
        
        // Check if there are any other tabs open
        if (filteredTabs.length > 0) {
          console.log('Other tabs are open, finding target tab');
          
          // Navigate to any one tab from the tab list
          // Prefer the tab to the left, otherwise go to the right
          let targetTab;
          if (removedTabIndex > 0 && filteredTabs[removedTabIndex - 1]) {
            // Go to the tab on the left
            targetTab = filteredTabs[removedTabIndex - 1];
            console.log('Navigating to left tab:', targetTab);
          } else {
            // If we're removing the first tab or no left tab, go to the first available tab
            targetTab = filteredTabs[0];
            console.log('Navigating to first available tab:', targetTab);
          }
          
          // Navigate immediately
          navigate(targetTab.path);
        } else {
          // No other tabs are open, route to "/"
          console.log('No other tabs open, routing to "/" - Last tab closed');
          navigate('/', { replace: true });
        }
      } else {
        // Even if we're not removing the active tab, if this was the last tab, we should navigate to home
        if (filteredTabs.length === 0) {
          console.log('Last remaining tab closed, routing to "/"');
          navigate('/', { replace: true });
        } else {
          console.log('Not removing active tab, no navigation needed');
        }
      }
    }, 0);
  }, [openTabs, location.pathname, navigate]);

  const switchToTab = useCallback((path: string) => {
    if (location.pathname !== path) {
      navigate(path);
    }
  }, [location.pathname, navigate]);

  const getActiveTab = useCallback(() => {
    return openTabs.find(tab => tab.path === location.pathname);
  }, [openTabs, location.pathname]);

  // Memoize route tab map to prevent recreation on every render
  const routeTabMap = useMemo(() => ({
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
    }), []);

  // Auto-add current route as tab if it's a valid tab route
  const initializeCurrentTab = useCallback(() => {
    // Don't initialize tabs if we're on the home route
    if (location.pathname === '/') {
      return;
    }

    // Check for static routes first
    const currentTab = routeTabMap[location.pathname];
    if (currentTab && !openTabs.find(tab => tab.path === currentTab.path)) {
      addTab(currentTab);
      return;
    }

    // Check for dynamic item form route: /item/:itemId
    const itemFormMatch = location.pathname.match(/^\/item\/(.+)$/);
    if (itemFormMatch) {
      const itemId = itemFormMatch[1];
      const isNewItem = itemId === 'new';
      const tabName = isNewItem ? 'New Item' : `Edit Item`;
      const existingTab = openTabs.find(tab => tab.path === location.pathname);
      if (!existingTab) {
        addTab({
          id: `item-${itemId}`,
          name: tabName,
          path: location.pathname,
          closeable: true
        });
      }
    }
  }, [location.pathname, openTabs, addTab, routeTabMap]);

  return {
    openTabs,
    addTab,
    removeTab,
    switchToTab,
    getActiveTab,
    initializeCurrentTab
  };
};
