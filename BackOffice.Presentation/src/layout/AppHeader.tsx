import React, { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import SwitchTenantModal from "../components/header/SwitchTenantModal";
import TabHeader from "../components/common/TabHeader";
import { useTabs } from "../hooks/useTabs";
import { useModal } from "../hooks/useModal";
import { Modal } from "../components/ui/modal";
import Button from "../components/ui/button/Button";
import Input from "../components/form/input/InputField";
import Label from "../components/form/Label";
import { useDashboardTabs } from "../context/DashboardTabContext";
import HelpButton from "../components/help/HelpButton";

const AppHeader = () => {
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar()
  const location = useLocation()
  const { isOpen: isUserModalOpen, openModal: openUserModal, closeModal: closeUserModal } = useModal();
  const { openTab: openDashboardTab } = useDashboardTabs();

  // Form state for new user
  const [newUserData, setNewUserData] = useState({
    userName: "",
    password: "",
    userFName: "",
    userLName: "",
    address: "",
    homePhoneNumber: "",
    workPhoneNumber: "",
    fax: "",
    email: "",
    zipCode: "",
    isSuperAdmin: "No",
  });

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({
    show: false,
    message: "",
    type: "success",
  });

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar()
    } else {
      toggleMobileSidebar()
    }
  }

  // Get page title based on current route
  const getPageInfo = (pathname: string) => {
    const routeMap: Record<string, { title: string; subtitle: string }> = {
      '/': { title: 'Dashboard', subtitle: 'Welcome to your dashboard overview' },
      '/users-list': { title: 'User List', subtitle: 'Manage and view all users in the system' },
      '/items-list': { title: 'Item List', subtitle: 'Manage and view all items in the inventory' },
      '/phone-orders': { title: 'Phone Orders', subtitle: 'Manage and track phone orders' },
      '/profile': { title: 'User Profile', subtitle: 'Manage your profile settings' },
      '/bar-chart': { title: 'Bar Charts', subtitle: 'View and analyze bar chart data' },
      '/line-chart': { title: 'Line Charts', subtitle: 'View and analyze line chart data' },
      '/form-elements': { title: 'Form Elements', subtitle: 'Interactive form components and inputs' },
      '/basic-tables': { title: 'Basic Tables', subtitle: 'Data table components and layouts' },
      '/alerts': { title: 'Alerts', subtitle: 'Alert components and notifications' },
      '/avatars': { title: 'Avatars', subtitle: 'User avatar components' },
      '/badge': { title: 'Badges', subtitle: 'Badge and label components' },
      '/buttons': { title: 'Buttons', subtitle: 'Button components and styles' },
      '/images': { title: 'Images', subtitle: 'Image components and galleries' },
      '/videos': { title: 'Videos', subtitle: 'Video components and players' },
      '/calendar': { title: 'Calendar', subtitle: 'Schedule and event management' },
      '/blank': { title: 'Blank Page', subtitle: 'Start building your content here' },
    }

    return routeMap[pathname] || { title: 'Page', subtitle: 'Navigation and content management' }
  }

  const { title, subtitle } = getPageInfo(location.pathname)

  const inputRef = useRef<HTMLInputElement>(null)

  // Define action button based on current route (removed users-list and items-list)
  const getActionButtonForRoute = (pathname: string) => {
    const actionButtonMap: Record<string, any> = {
      '/dashboard': {
        label: 'Reports',
        onClick: () =>
          openDashboardTab({
            component: 'ReportManagerPage',
            title: 'Reports',
            closable: true,
          }),
      },
      '/calendar': {
        label: 'Add Event',
        onClick: () => console.log('Add Event clicked'),
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        )
      }
    };

    return actionButtonMap[pathname] || null;
  };

  const actionButton = getActionButtonForRoute(location.pathname)

  // Define tabs based on current route
  const getTabsForRoute = (pathname: string) => {
    const routeTabsMap: Record<string, { tabs: any[], actionButton?: any }> = {
      '/users-list': {
        tabs: [
          { id: 'users', name: 'Users List', path: '/users-list', closeable: false },
        ]
      },
      '/items-list': {
        tabs: [
          { id: 'items', name: 'Item List', path: '/items-list', closeable: false },
        ]
      },
      '/calendar': {
        tabs: [
          { id: 'calendar', name: 'Calendar', path: '/calendar', closeable: false },
        ],
        actionButton: {
          label: 'Add Event',
          onClick: () => console.log('Add Event clicked'),
          icon: null,
          customButton: (
            <button
              style={{
                padding: "10px 18px",
                backgroundColor: "#1976d2",
                border: "none",
                borderRadius: "12px",
                cursor: "pointer",
                fontSize: "14px",
                color: "white",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: "500",
                transition: "all 0.2s ease-in-out",
              }}
              onClick={() => console.log('Add Event clicked')}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "#1565c0";
                (e.target as HTMLElement).style.transform = "translateY(-1px)";
                (e.target as HTMLElement).style.boxShadow = "0 4px 12px rgba(25, 118, 210, 0.3)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "#1976d2";
                (e.target as HTMLElement).style.transform = "translateY(0px)";
                (e.target as HTMLElement).style.boxShadow = "none";
              }}
            >
              + Add Event
            </button>
          )
        }
      },
      '/basic-tables': {
        tabs: [
          { id: 'tables', name: 'Tables', path: '/basic-tables', closeable: false },
        ]
      }
    }

    return routeTabsMap[pathname] || null
  }
  const currentRouteConfig = getTabsForRoute(location.pathname)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const { openTabs, addTab, removeTab, switchToTab, getActiveTab, initializeCurrentTab } = useTabs();

  const handleOpenTenant = () => {
    setIsTenantModalOpen(true);
  };

  const handleCloseTenant = () => {
    setIsTenantModalOpen(false);
  };

  // Handle input changes for new user form (memoized)
  const handleInputChange = useCallback((field: string, value: string) => {
    setNewUserData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // Handle opening the add user modal (memoized)
  const handleAddUser = useCallback(() => {
    // Reset form data
    setNewUserData({
      userName: "",
      password: "",
      userFName: "",
      userLName: "",
      address: "",
      homePhoneNumber: "",
      workPhoneNumber: "",
      fax: "",
      email: "",
      zipCode: "",
      isSuperAdmin: "No",
    });
    openUserModal();
  }, [openUserModal]);

  // Handle saving new user (memoized)
  const handleSaveUser = useCallback(() => {
    console.log("Creating new user:", newUserData);
    closeUserModal();
    showToast("User has been created successfully!", "success");
  }, [newUserData, closeUserModal]);

  // Handle modal close (memoized)
  const handleModalClose = useCallback(() => {
    setNewUserData({
      userName: "",
      password: "",
      userFName: "",
      userLName: "",
      address: "",
      homePhoneNumber: "",
      workPhoneNumber: "",
      fax: "",
      email: "",
      zipCode: "",
      isSuperAdmin: "No",
    });
    closeUserModal();
  }, [closeUserModal]);

  // Toast notification function (memoized)
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      setToast({ show: true, message, type });
      setTimeout(() => {
        setToast({ show: false, message: "", type: "success" });
      }, 3000);
    },
    [],
  );

  return (
    <>
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[350px] max-w-[400px] transition-all duration-300 animate-slide-in">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-500/10 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  Saved Successfully
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{toast.message}</p>
              </div>
              <button
                onClick={() =>
                  setToast({ show: false, message: "", type: "success" })
                }
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>
            <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
              <div
                className="bg-green-500 h-1 rounded-full animate-progress-bar"
                style={{
                  width: "100%",
                  animation: "progressBar 3s linear forwards",
                }}
              ></div>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 flex flex-col w-full bg-white z-9 dark:bg-gray-900 max-w-full overflow-x-hidden">
      {/* Dynamic Tab Header with mobile hamburger */}
      <div className="flex items-center">
        {/* Hamburger menu button — visible only on small screens */}
        <button
          onClick={handleToggle}
          className="lg:hidden flex items-center justify-center w-10 h-10 ml-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
          aria-label={isMobileOpen ? "Close sidebar" : "Open sidebar"}
        >
          {isMobileOpen ? (
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <TabHeader actionButton={actionButton} />
        </div>
        {/* Global in-product help button — opens a context-aware help drawer for the current page. */}
        <div className="flex items-center pr-3">
          <HelpButton />
        </div>
      </div>
    </header>
      {/* Switch Tenant Modal */}
      <SwitchTenantModal 
        isOpen={isTenantModalOpen} 
        onClose={handleCloseTenant} 
      />

      {/* Add User Modal */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={handleModalClose}
        className="max-w-[700px] m-4"
      >
        <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Add New User
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Enter user details to create a new user account.
            </p>
          </div>

          <form className="flex flex-col">
            <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
              <div>
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  User Information
                </h5>

                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div>
                    <Label>User Name</Label>
                    <Input
                      type="text"
                      value={newUserData.userName}
                      onChange={(e) => {
                        const target = e.target as HTMLInputElement;
                        handleInputChange("userName", target.value);
                      }}
                      placeholder="Enter username"
                    />
                  </div>

                  <div>
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={newUserData.password}
                      onChange={(e) => {
                        const target = e.target as HTMLInputElement;
                        handleInputChange("password", target.value);
                      }}
                      placeholder="Enter password"
                    />
                  </div>

                  <div>
                    <Label>First Name</Label>
                    <Input
                      type="text"
                      value={newUserData.userFName}
                      onChange={(e) => {
                        const target = e.target as HTMLInputElement;
                        handleInputChange("userFName", target.value);
                      }}
                      placeholder="Enter first name"
                    />
                  </div>

                  <div>
                    <Label>Last Name</Label>
                    <Input
                      type="text"
                      value={newUserData.userLName}
                      onChange={(e) => {
                        const target = e.target as HTMLInputElement;
                        handleInputChange("userLName", target.value);
                      }}
                      placeholder="Enter last name"
                    />
                  </div>

                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newUserData.email}
                      onChange={(e) => {
                        const target = e.target as HTMLInputElement;
                        handleInputChange("email", target.value);
                      }}
                      placeholder="Enter email address"
                    />
                  </div>

                  <div>
                    <Label>Home Phone</Label>
                    <Input
                      type="text"
                      value={newUserData.homePhoneNumber}
                      onChange={(e) => {
                        const target = e.target as HTMLInputElement;
                        handleInputChange("homePhoneNumber", target.value);
                      }}
                      placeholder="Enter home phone number"
                    />
                  </div>

                  <div>
                    <Label>Work Phone</Label>
                    <Input
                      type="text"
                      value={newUserData.workPhoneNumber}
                      onChange={(e) => {
                        const target = e.target as HTMLInputElement;
                        handleInputChange("workPhoneNumber", target.value);
                      }}
                      placeholder="Enter work phone number"
                    />
                  </div>

                  <div>
                    <Label>Fax</Label>
                    <Input
                      type="text"
                      value={newUserData.fax}
                      onChange={(e) => {
                        const target = e.target as HTMLInputElement;
                        handleInputChange("fax", target.value);
                      }}
                      placeholder="Enter fax number"
                    />
                  </div>

                  <div>
                    <Label>Zip Code</Label>
                    <Input
                      type="text"
                      value={newUserData.zipCode}
                      onChange={(e) => {
                        const target = e.target as HTMLInputElement;
                        handleInputChange("zipCode", target.value);
                      }}
                      placeholder="Enter zip code"
                    />
                  </div>

                  <div>
                    <Label>Super Admin</Label>
                    <select
                      value={newUserData.isSuperAdmin}
                      onChange={(e) => {
                        const target = e.target as HTMLSelectElement;
                        handleInputChange("isSuperAdmin", target.value);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <Label>Address</Label>
                    <Input
                      type="text"
                      value={newUserData.address}
                      onChange={(e) => {
                        const target = e.target as HTMLInputElement;
                        handleInputChange("address", target.value);
                      }}
                      placeholder="Enter address"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" onClick={handleModalClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveUser}>
                Save User
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  )
}

export default AppHeader