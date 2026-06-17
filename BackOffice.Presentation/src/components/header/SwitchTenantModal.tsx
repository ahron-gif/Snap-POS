import { createPortal } from 'react-dom'
import { useState, useEffect, useRef } from 'react'
import { useTenant } from '../../context/TenantContext'
import { useAppDispatch } from '../../hooks/useAppSelector'
import { setCurrentCustomer, resetCurrentCustomer } from '../../store/slices/customerSlice'
import { clearPermissions, loadPermissions, loadMenu } from '../../store/slices/effectivePermissionSlice'
import { API_ENDPOINTS } from '../../constants/api'
import { useAuthHeaders } from '../../hooks/useAuthHeaders'
import { useAuth } from '../../context/AuthContext'
import { useStore } from '../../context/StoreContext'
import { permissionService } from '../../services/permissionService'
import { userPreferenceService } from '../../services/userPreferenceService'

interface SwitchTenantModalProps {
  isOpen: boolean
  onClose: () => void
  loginMode?: boolean
  onLogout?: () => void
}

interface Customer {
  customerId: number
  customerName: string
  email: string
}

interface StoreItem {
  storeID: string
  storeName: string
}

export default function SwitchTenantModal({ isOpen, onClose, loginMode = false, onLogout }: SwitchTenantModalProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [tenants, setTenants] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [stores, setStores] = useState<StoreItem[]>([])
  const [selectedStore, setSelectedStore] = useState<StoreItem | null>(null)
  const [loadingStores, setLoadingStores] = useState(false)
  const { switchTenant, currentTenant } = useTenant()
  const { switchStore, loadStores, currentStore } = useStore()
  const dispatch = useAppDispatch()
  const { getAuthHeaders } = useAuthHeaders()
  const { isSuperAdmin, updateCustomerId } = useAuth()
  const [isAutoRestoring, setIsAutoRestoring] = useState(false)
  const autoRestoreAttempted = useRef(false)

  useEffect(() => {
    if (isOpen) {
      if (loginMode) {
        setSelectedCustomer(null)
        setSelectedStore(null)
        setStores([])
        // Try auto-restore from last session
        if (!autoRestoreAttempted.current) {
          autoRestoreAttempted.current = true
          tryAutoRestore()
        }
      } else {
        setSelectedCustomer(currentTenant)
      }
      fetchTenants()
    }
    if (!isOpen) {
      autoRestoreAttempted.current = false
      setIsAutoRestoring(false)
    }
  }, [isOpen, currentTenant, loginMode])

  const tryAutoRestore = async () => {
    try {
      const result = await userPreferenceService.getPreference('lastSession')
      if (result.isSuccess && result.response?.preferenceValue) {
        const lastSession = JSON.parse(result.response.preferenceValue)
        if (lastSession.customerId) {
          setIsAutoRestoring(true)
          // The auto-select will happen in the effects below once tenants/stores load
          // Store the lastSession info for matching
          ;(window as any).__lastSessionRestore = lastSession
        }
      }
    } catch {
      // No auto-restore available
    }
  }

  useEffect(() => {
    if (selectedCustomer) {
      fetchStores(selectedCustomer.customerId)
    } else {
      setStores([])
      setSelectedStore(null)
    }
  }, [selectedCustomer])

  // Auto-select tenant from last session when tenants load
  useEffect(() => {
    if (isAutoRestoring && loginMode && tenants.length > 0 && !selectedCustomer) {
      const lastSession = (window as any).__lastSessionRestore
      if (lastSession?.customerId) {
        const match = tenants.find(t => t.customerId === lastSession.customerId)
        if (match) {
          setSelectedCustomer(match)
        } else {
          setIsAutoRestoring(false)
          delete (window as any).__lastSessionRestore
        }
      }
    }
  }, [isAutoRestoring, loginMode, tenants, selectedCustomer])

  // Auto-select store from last session when stores load, then auto-submit
  useEffect(() => {
    if (isAutoRestoring && loginMode && stores.length > 0 && !selectedStore && selectedCustomer) {
      const lastSession = (window as any).__lastSessionRestore
      if (lastSession?.storeId) {
        const match = stores.find(s => s.storeID === lastSession.storeId)
        if (match) {
          setSelectedStore(match)
          // Auto-submit
          setTimeout(() => {
            updateCustomerId(selectedCustomer.customerId)
            switchTenant(selectedCustomer)
            dispatch(setCurrentCustomer(selectedCustomer))
            switchStore({ storeId: match.storeID, storeName: match.storeName })

            const storedUser = localStorage.getItem('userData')
            if (storedUser) {
              try {
                const userData = JSON.parse(storedUser)
                userData.storeId = match.storeID
                userData.storeName = match.storeName
                localStorage.setItem('userData', JSON.stringify(userData))
              } catch {}
            }

            loadStores()
            dispatch(clearPermissions())
            dispatch(loadPermissions())
            dispatch(loadMenu())

            setIsAutoRestoring(false)
            delete (window as any).__lastSessionRestore
            onClose()
          }, 300)
        } else {
          setIsAutoRestoring(false)
          delete (window as any).__lastSessionRestore
        }
      }
    }
  }, [isAutoRestoring, loginMode, stores, selectedStore, selectedCustomer])

  const fetchTenants = async () => {
    setLoading(true)
    try {
      if (isSuperAdmin()) {
        const response = await fetch(API_ENDPOINTS.CUSTOMER.GET_ALL_TENANTS, {
          method: 'GET',
          headers: getAuthHeaders(),
        })
        const data = await response.json()
        if (data.isSuccess) {
          setTenants(data.response)
        }
      } else {
        const response = await permissionService.getMyAssignedTenants()
        if (response.data.isSuccess) {
          setTenants(
            response.data.response.map((t) => ({
              customerId: t.customerId,
              customerName: t.customerName,
              email: t.email || '',
            }))
          )
        }
      }
    } catch (error) {
      console.error('Error fetching tenants:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStores = async (customerId: number) => {
    setLoadingStores(true)
    setSelectedStore(null)
    setStores([])
    try {
      const userData = localStorage.getItem('userData')
      if (!userData) return
      const parsed = JSON.parse(userData)
      const localUserId = parsed.localUserId || ''
      if (!localUserId) return

      const token = localStorage.getItem('accessToken')
      const response = await fetch(
        API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES_BY_USER(localUserId, customerId),
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
            'CustomerId': customerId.toString(),
          },
        }
      )
      if (!response.ok) return
      const data = await response.json()
      if (data.isSuccess && data.response) {
        setStores(data.response)
        // Skip pre-selection while auto-restoring so the lastSession effect (below)
        // can run and trigger the auto-submit. Otherwise selectedStore is set here
        // and the `!selectedStore` guard in the auto-restore effect short-circuits,
        // leaving the "Restoring Session" spinner up forever.
        if (data.response.length === 1 && !isAutoRestoring) {
          setSelectedStore(data.response[0])
        } else if (!loginMode && currentStore?.storeId) {
          // Pre-select the currently-active store so the user sees their
          // current context pre-filled when they open Switch Tenant.
          const match = data.response.find((s: StoreItem) => s.storeID === currentStore.storeId)
          if (match) setSelectedStore(match)
        }
      } else if (Array.isArray(data)) {
        setStores(data)
        if (data.length === 1 && !isAutoRestoring) {
          setSelectedStore(data[0])
        } else if (!loginMode && currentStore?.storeId) {
          const match = data.find((s: StoreItem) => s.storeID === currentStore.storeId)
          if (match) setSelectedStore(match)
        }
      }
    } catch (error) {
      console.error('Error fetching stores:', error)
    } finally {
      setLoadingStores(false)
    }
  }

  const filteredCustomers = tenants.filter(customer =>
    (customer.customerName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (customer.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  )

  const handleSwitchTenant = () => {
    if (selectedCustomer) {
      updateCustomerId(selectedCustomer.customerId)
      switchTenant(selectedCustomer)
      dispatch(setCurrentCustomer(selectedCustomer))

      if (selectedStore) {
        switchStore({
          storeId: selectedStore.storeID,
          storeName: selectedStore.storeName,
        })

        const storedUser = localStorage.getItem('userData')
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser)
            userData.storeId = selectedStore.storeID
            userData.storeName = selectedStore.storeName
            localStorage.setItem('userData', JSON.stringify(userData))
          } catch (err) {
            console.error('Error updating store in userData:', err)
          }
        }
      }

      loadStores()

      dispatch(clearPermissions())
      dispatch(loadPermissions())
      dispatch(loadMenu())
    } else if (!loginMode) {
      switchTenant(null)
      dispatch(resetCurrentCustomer())
    }
    handleClose()
  }

  const handleClose = () => {
    setSelectedCustomer(null)
    setSelectedStore(null)
    setStores([])
    setSearchTerm("")
    onClose()
  }

  const handleBackdropClick = () => {
    if (!loginMode) {
      handleClose()
    }
  }

  const handleTenantSelect = (customer: Customer) => {
    setSelectedCustomer(customer)
    setSelectedStore(null)
    setStores([])
  }

  const switchDisabled = selectedCustomer && (loadingStores || (stores.length > 0 && !selectedStore))
  const loginContinueDisabled = loginMode && (!selectedCustomer || loadingStores || (stores.length > 0 && !selectedStore))

  if (!isOpen) return null

  // Show loading indicator while auto-restoring in login mode
  if (isAutoRestoring && loginMode) {
    return createPortal(
      <div className="fixed inset-0 z-[99999] flex items-center justify-center" style={{ zIndex: 99999 }}>
        <div className="fixed inset-0 bg-black/80 w-screen h-screen" style={{ zIndex: 99998 }} />
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl dark:bg-gray-800 mx-4" style={{ zIndex: 100000 }}>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-brand-500 to-brand-600 rounded-t-2xl">
            <h3 className="text-lg font-semibold text-white">Restoring Session</h3>
            <p className="text-sm text-white/80 mt-1">Reconnecting to your last tenant and store...</p>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Restoring last session...</span>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center" style={{ zIndex: 99999 }}>
      <div
        className={`fixed inset-0 w-screen h-screen ${loginMode ? 'bg-black/80' : 'bg-white/60 backdrop-blur-md'}`}
        onClick={handleBackdropClick}
        style={{ zIndex: 99998 }}
      />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl dark:bg-gray-800 mx-4" style={{ zIndex: 100000 }}>
        {loginMode && (
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-brand-500 to-brand-600 rounded-t-2xl">
            <h3 className="text-lg font-semibold text-white">
              Select Tenant & Store
            </h3>
            <p className="text-sm text-white/80 mt-1">
              You have access to multiple tenants. Please select a tenant and store to continue.
            </p>
          </div>
        )}

        {!loginMode && (
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Switch Tenant
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        )}

        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <svg
              className="absolute right-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        <div className={`overflow-y-auto p-6 ${selectedCustomer && stores.length > 0 ? 'max-h-52' : 'max-h-80'}`}>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            </div>
          ) : tenants.length === 0 && !isSuperAdmin() ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h2M7 7h.01M7 3h5v2H7V3z" />
              </svg>
              <p className="text-sm font-medium">No tenants assigned</p>
              <p className="text-xs mt-1">Contact your administrator to get access.</p>
            </div>
          ) : (
            <div className="space-y-3">

              {filteredCustomers.map((customer) => (
                <div
                  key={customer.customerId}
                  onClick={() => handleTenantSelect(customer)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedCustomer?.customerId === customer.customerId
                      ? "bg-brand-50 border-2 border-brand-500 dark:bg-brand-900/20 dark:border-brand-400"
                      : "bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                    {customer.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {customer.customerName}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {customer.email}
                    </p>
                  </div>
                  {selectedCustomer?.customerId === customer.customerId && (
                    <svg
                      className="w-6 h-6 text-brand-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedCustomer && (
          <div className="border-t border-gray-200 dark:border-gray-700">
            <div className="px-6 pt-4 pb-2">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Select Store
              </h4>
            </div>
            <div className="max-h-36 overflow-y-auto px-6 pb-4">
              {loadingStores ? (
                <div className="flex justify-center items-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500"></div>
                  <span className="ml-2 text-sm text-gray-500">Loading stores...</span>
                </div>
              ) : stores.length === 0 ? (
                <div className="flex items-center gap-2 py-3 px-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <p className="text-sm text-amber-700 dark:text-amber-400">No stores available for this tenant.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stores.map((store) => (
                    <div
                      key={store.storeID}
                      onClick={() => setSelectedStore(store)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedStore?.storeID === store.storeID
                          ? "bg-brand-50 border-2 border-brand-500 dark:bg-brand-900/20 dark:border-brand-400"
                          : "bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">
                        {store.storeName}
                      </span>
                      {selectedStore?.storeID === store.storeID && (
                        <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          {loginMode ? (
            <>
              <button
                onClick={onLogout}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40"
              >
                Logout
              </button>
              <button
                onClick={handleSwitchTenant}
                disabled={!!loginContinueDisabled}
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
                  loginContinueDisabled
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                    : 'text-white bg-brand-500 hover:bg-brand-600'
                }`}
              >
                Continue
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 dark:text-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSwitchTenant}
                disabled={!!switchDisabled}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  switchDisabled
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                    : 'text-white bg-brand-500 hover:bg-brand-600'
                }`}
              >
                Switch Tenant
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
