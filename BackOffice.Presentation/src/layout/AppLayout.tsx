import { useState, useEffect, useCallback } from "react"
import { SidebarProvider, useSidebar } from "../context/SidebarContext"
import { Outlet, useNavigate } from "react-router"
import AppHeader from "./AppHeader"
import Backdrop from "./Backdrop"
import AppSidebar from "./AppSidebar"
import { useAuth } from "../context/AuthContext"
import { permissionService } from "../services/permissionService"
import SwitchTenantModal from "../components/header/SwitchTenantModal"
import PaymentFailureBanner from "../components/billing/PaymentFailureBanner"
import ChatWidget from "../components/Chatbot/ChatWidget"
import { usePermission } from "../hooks/usePermission"

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar()
  const { isSuperAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const [showLoginTenantModal, setShowLoginTenantModal] = useState(false)
  const { hasPermission } = usePermission("CHATBOT_WIDGET")
  const canUseChatbot = isSuperAdmin() || hasPermission("chatbot.use")

  const checkPendingTenantSelection = useCallback(async () => {
    const pending = sessionStorage.getItem('pendingTenantSelection')
    if (pending !== 'true' || isSuperAdmin()) {
      sessionStorage.removeItem('pendingTenantSelection')
      return
    }

    try {
      const response = await permissionService.getMyAssignedTenants()
      if (response.data.isSuccess && response.data.response.length >= 2) {
        setShowLoginTenantModal(true)
      } else {
        sessionStorage.removeItem('pendingTenantSelection')
      }
    } catch {
      sessionStorage.removeItem('pendingTenantSelection')
    }
  }, [isSuperAdmin])

  useEffect(() => {
    checkPendingTenantSelection()
  }, [checkPendingTenantSelection])

  const handleTenantSelected = () => {
    sessionStorage.removeItem('pendingTenantSelection')
    setShowLoginTenantModal(false)
  }

  const handleTenantLogout = () => {
    sessionStorage.removeItem('pendingTenantSelection')
    setShowLoginTenantModal(false)
    logout()
    navigate('/signin')
  }

  return (
    <div className="h-screen flex overflow-hidden bg-white dark:bg-gray-900">
      <div className="relative">
        <AppSidebar />
        <Backdrop />
      </div>

      <div
        className={`flex-1 flex flex-col transition-all duration-300 ease-in-out min-w-0 ${
          isExpanded || isHovered ? "lg:ml-[260px]" : "lg:ml-[72px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <div className="flex-shrink-0">
          <AppHeader />
        </div>

        {!isSuperAdmin() && <PaymentFailureBanner />}

        <div className="flex-1 overflow-y-auto bg-content-bg dark:bg-gray-950">
          <div className="mx-auto min-h-full">
            <Outlet />
          </div>
        </div>
      </div>

      <SwitchTenantModal
        isOpen={showLoginTenantModal}
        onClose={handleTenantSelected}
        loginMode
        onLogout={handleTenantLogout}
      />

      {canUseChatbot && <ChatWidget />}
    </div>
  )
}

const AppLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  )
}

export default AppLayout
