import React, { useState, useEffect, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import Button from "../ui/button/Button"
import Label from "../form/Label"
import SearchableSelect, { SelectOption } from "../form/SearchableSelect"
import { API_ENDPOINTS } from "../../constants/api"
import { userPreferenceService } from "../../services/userPreferenceService"
import { useTenant } from "../../context/TenantContext"
import { useStore } from "../../context/StoreContext"

interface Customer {
  customerId: number
  customerName: string
  connectionString?: string
}

interface User {
  userId: number
  userName: string
  email?: string 
  localUserId: string
}

interface Store {
  storeID: string
  storeName: string
}

interface LastSession {
  customerId?: number
  customerName?: string
  localUserId?: string
  storeId?: string
  storeName?: string
  userId?: number
}

interface CustomerSelectionModalProps {
  isOpen: boolean
  onSelect: (customer: Customer, user?: User, store?: Store) => void
  onClose?: () => void
  onCancel?: () => void
  loginMode?: boolean
}

const LAST_SESSION_KEY = 'lastSession'

const CustomerSelectionModal: React.FC<CustomerSelectionModalProps> = ({
  isOpen,
  onSelect,
  onClose,
  onCancel,
  loginMode = false,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [isLoadingStores, setIsLoadingStores] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSession, setLastSession] = useState<LastSession | null>(null)
  const [isAutoRestoring, setIsAutoRestoring] = useState(false)
  const autoRestoreAttempted = useRef(false)

  // Live "current session" sources used to pre-fill selections when the modal
  // is opened from the user dropdown (loginMode === false). We prefer live
  // contexts over the persisted `lastSession` preference because they reflect
  // what the user is actually using right now.
  const { currentTenant } = useTenant()
  const { currentStore } = useStore()

  // Superadmins don't impersonate a specific tenant user — picking one here is
  // confusing. We hide the User dropdown for them and auto-pick a user under
  // the hood (see effect below) purely so the Store list can still load.
  //
  // Read from localStorage rather than auth context: at login time the
  // superadmin's redux user state isn't populated yet (loginSuccess is deferred
  // until a tenant is chosen). `role` is persisted at login and is NOT
  // overwritten on tenant switch, so it stays reliable — unlike customerId,
  // which gets set to the chosen tenant once they switch.
  //
  // Depend on `isOpen`: this component stays mounted (the parent only toggles
  // isOpen), and at login `userData` is written to localStorage AFTER the first
  // render. Recomputing when the modal opens ensures we read the freshly-stored
  // role instead of a stale (pre-login) empty value.
  const isSuperAdmin = useMemo(() => {
    try {
      const raw = localStorage.getItem('userData')
      const u = raw ? JSON.parse(raw) : null
      if (!u) return false
      return u.role === 'SuperAdmin' ||
        u.customerId === 0 || u.customerId === null || u.customerId === undefined
    } catch {
      return false
    }
  }, [isOpen])

  const currentSession: LastSession | null = useMemo(() => {
    if (loginMode) return null
    try {
      const raw = localStorage.getItem("userData")
      const userData = raw ? JSON.parse(raw) : null
      return {
        customerId: currentTenant?.customerId ?? userData?.customerId,
        customerName: currentTenant?.customerName ?? userData?.customerName,
        localUserId: userData?.localUserId,
        userId: userData?.userId,
        storeId: currentStore?.storeId ?? userData?.storeId,
        storeName: currentStore?.storeName ?? userData?.storeName,
      }
    } catch {
      return {
        customerId: currentTenant?.customerId,
        customerName: currentTenant?.customerName,
        storeId: currentStore?.storeId,
        storeName: currentStore?.storeName,
      }
    }
  }, [loginMode, currentTenant, currentStore])

  useEffect(() => {
    if (isOpen && loginMode && !autoRestoreAttempted.current) {
      autoRestoreAttempted.current = true
      loadLastSession()
    }
    if (!isOpen) {
      autoRestoreAttempted.current = false
    }
  }, [isOpen, loginMode])

  const loadLastSession = async () => {
    try {
      const result = await userPreferenceService.getPreference(LAST_SESSION_KEY)
      if (result.isSuccess && result.response?.preferenceValue) {
        const session: LastSession = JSON.parse(result.response.preferenceValue)
        setLastSession(session)
      }
    } catch {
      // No last session — normal flow
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchCustomers()
    }
  }, [isOpen])

  // Auto-select customer from last session when customers load (login mode only)
  useEffect(() => {
    if (lastSession?.customerId && customers.length > 0 && !selectedCustomer && !isAutoRestoring) {
      const match = customers.find(c => c.customerId === lastSession.customerId)
      if (match) {
        setIsAutoRestoring(true)
        setSelectedCustomer(match)
      }
    }
  }, [lastSession, customers, selectedCustomer, isAutoRestoring])

  // Pre-select customer from the CURRENT session when opened as Switch Tenant
  // (loginMode === false). Does not trigger auto-submit — just fills the field
  // so the user sees what they're currently on and can change it if they want.
  useEffect(() => {
    if (loginMode) return
    if (!currentSession?.customerId) return
    if (customers.length === 0 || selectedCustomer) return
    const match = customers.find(c => c.customerId === currentSession.customerId)
    if (match) setSelectedCustomer(match)
  }, [loginMode, currentSession, customers, selectedCustomer])

  // Fetch users when customer is selected
  useEffect(() => {
    if (selectedCustomer) {
      fetchUsers(selectedCustomer.customerId)
    } else {
      setUsers([])
      setSelectedUser(null)
      setStores([])
      setSelectedStore(null)
    }
  }, [selectedCustomer])

  // Auto-select user from last session when users load
  useEffect(() => {
    if (isAutoRestoring && lastSession?.localUserId && users.length > 0 && !selectedUser) {
      const match = users.find(u => u.localUserId === lastSession.localUserId)
      if (match) {
        setSelectedUser(match)
      } else {
        setIsAutoRestoring(false)
      }
    }
  }, [isAutoRestoring, lastSession, users, selectedUser])

  // Pre-select user from current session (Switch Tenant mode, not login)
  useEffect(() => {
    if (loginMode) return
    if (!currentSession?.localUserId) return
    if (users.length === 0 || selectedUser) return
    const match = users.find(u => u.localUserId === currentSession.localUserId)
    if (match) setSelectedUser(match)
  }, [loginMode, currentSession, users, selectedUser])

  // Superadmins don't see the User dropdown, so silently pick a user once the
  // list loads — preferring the tenant's "admin" account — purely to drive the
  // store fetch. Gated on !isAutoRestoring so it never races the login-restore
  // and switch-tenant pre-fill effects above.
  useEffect(() => {
    if (!isSuperAdmin) return
    if (users.length === 0 || selectedUser || isAutoRestoring) return
    const admin = users.find(u => u.userName?.toLowerCase() === 'admin')
    setSelectedUser(admin ?? users[0])
  }, [isSuperAdmin, users, selectedUser, isAutoRestoring])

  // Fetch stores when user is selected
  useEffect(() => {
    if (selectedUser && selectedCustomer) {
      fetchStores(selectedUser.localUserId, selectedCustomer.customerId)
    } else {
      setStores([])
      setSelectedStore(null)
    }
  }, [selectedUser, selectedCustomer])

  // Auto-select store from last session when stores load, then auto-submit.
  // Guarded strictly to login mode — in switch-tenant mode we never auto-submit
  // because the user opened the modal intending to change something.
  useEffect(() => {
    if (!loginMode) return
    if (isAutoRestoring && lastSession?.storeId && stores.length > 0 && !selectedStore) {
      const match = stores.find(s => s.storeID === lastSession.storeId)
      if (match) {
        setSelectedStore(match)
        // Auto-submit after a small delay to let state settle
        setTimeout(() => {
          if (selectedCustomer) {
            onSelect(selectedCustomer, selectedUser || undefined, match)
          }
          setIsAutoRestoring(false)
        }, 300)
      } else {
        setIsAutoRestoring(false)
      }
    }
  }, [loginMode, isAutoRestoring, lastSession, stores, selectedStore, selectedCustomer, selectedUser, onSelect])

  // Pre-select store from current session (Switch Tenant mode). No auto-submit.
  useEffect(() => {
    if (loginMode) return
    if (!currentSession?.storeId) return
    if (stores.length === 0 || selectedStore) return
    const match = stores.find(s => s.storeID === currentSession.storeId)
    if (match) setSelectedStore(match)
  }, [loginMode, currentSession, stores, selectedStore])

  const fetchCustomers = async () => {
    setIsLoadingCustomers(true)
    setError(null)

    try {
      const token = localStorage.getItem("accessToken")
      const response = await fetch(API_ENDPOINTS.CUSTOMER.GET_ALL_TENANTS, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch customers")
      }

      const data = await response.json()

      // Handle API response structure
      if (data.isSuccess && data.response) {
        setCustomers(data.response)
        // Auto-select first customer if only one
        if (data.response.length === 1) {
          setSelectedCustomer(data.response[0])
        }
      } else if (Array.isArray(data)) {
        setCustomers(data)
        if (data.length === 1) {
          setSelectedCustomer(data[0])
        }
      } else {
        setError("No customers found")
      }
    } catch (err) {
      console.error("Error fetching customers:", err)
      setError("Failed to load customers. Please try again.")
    } finally {
      setIsLoadingCustomers(false)
    }
  }

  const fetchUsers = async (customerId: number) => {
    setIsLoadingUsers(true)
    // Only reset selected user if NOT auto-restoring
    if (!isAutoRestoring) {
      setSelectedUser(null)
    }

    try {
      const token = localStorage.getItem("accessToken")
      const response = await fetch(`${API_ENDPOINTS.USERS.GET_USERS_BY_CUSTOMER(customerId)}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch users")
      }

      const data = await response.json()

      // Handle API response structure
      if (data.isSuccess && data.response) {
        setUsers(data.response)
        // Auto-select first user if only one (and not auto-restoring)
        if (!isAutoRestoring && data.response.length === 1) {
          setSelectedUser(data.response[0])
        }
      } else if (Array.isArray(data)) {
        setUsers(data)
        if (!isAutoRestoring && data.length === 1) {
          setSelectedUser(data[0])
        }
      } else {
        setUsers([])
      }
    } catch (err) {
      console.error("Error fetching users:", err)
      setUsers([])
    } finally {
      setIsLoadingUsers(false)
    }
  }

  const fetchStores = async (localUserId: string, customerId: number) => {
    setIsLoadingStores(true)
    // Only reset selected store if NOT auto-restoring
    if (!isAutoRestoring) {
      setSelectedStore(null)
    }

    try {
      const token = localStorage.getItem("accessToken")
      const response = await fetch(
        `${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES_BY_USER(localUserId, customerId)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error("Failed to fetch stores")
      }

      const data = await response.json()

      // Handle API response structure
      if (data.isSuccess && data.response) {
        setStores(data.response)
        // Auto-select first store if only one (and not auto-restoring)
        if (!isAutoRestoring && data.response.length === 1) {
          setSelectedStore(data.response[0])
        }
      } else if (Array.isArray(data)) {
        setStores(data)
        if (!isAutoRestoring && data.length === 1) {
          setSelectedStore(data[0])
        }
      } else {
        setStores([])
      }
    } catch (err) {
      console.error("Error fetching stores:", err)
      setStores([])
    } finally {
      setIsLoadingStores(false)
    }
  }

  const handleSelect = () => {
    if (selectedCustomer) {
      onSelect(selectedCustomer, selectedUser || undefined, selectedStore || undefined)
    }
  }

  const handleCustomerChange = (value: string) => {
    if (!value) {
      setSelectedCustomer(null)
      return
    }
    setIsAutoRestoring(false) // User manually changed, stop auto-restore
    const customerId = parseInt(value)
    const customer = customers.find(c => c.customerId === customerId)
    setSelectedCustomer(customer || null)
  }

  const handleUserChange = (value: string) => {
    if (!value) {
      setSelectedUser(null)
      return
    }
    setIsAutoRestoring(false) // User manually changed, stop auto-restore
    const userId = parseInt(value)
    const user = users.find(u => u.userId === userId)
    setSelectedUser(user || null)
  }

  const handleStoreChange = (value: string) => {
    if (!value) {
      setSelectedStore(null)
      return
    }
    setIsAutoRestoring(false) // User manually changed, stop auto-restore
    const store = stores.find(s => s.storeID === value)
    setSelectedStore(store || null)
  }

  // Convert data to SelectOption format for SearchableSelect
  const customerOptions: SelectOption[] = useMemo(() =>
    customers.map(c => ({ value: c.customerId.toString(), label: c.customerName })),
    [customers]
  )

  const userOptions: SelectOption[] = useMemo(() =>
    users.map(u => ({ value: u.userId.toString(), label: `${u.userName}${u.email ? ` (${u.email})` : ''}` })),
    [users]
  )

  const storeOptions: SelectOption[] = useMemo(() =>
    stores.map(s => ({ value: s.storeID, label: s.storeName })),
    [stores]
  )

  if (!isOpen) return null

  // Show loading indicator while auto-restoring
  if (isAutoRestoring) {
    const modalContent = (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/80" />
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden z-[100000]">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-brand-500 to-brand-600">
            <h2 className="text-xl font-semibold text-white">Restoring Session</h2>
            <p className="text-sm text-white/80 mt-1">
              Reconnecting to your last store...
            </p>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Restoring last session...</span>
            </div>
          </div>
        </div>
      </div>
    )
    return createPortal(modalContent, document.body)
  }

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80"
        onClick={!loginMode ? onClose : undefined}
      />

      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden z-[100000]">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-brand-500 to-brand-600 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Select Customer, User & Store</h2>
            <p className="text-sm text-white/80 mt-1">
              Please select a customer, user and store to continue
            </p>
          </div>
          {!loginMode && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors mt-0.5"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoadingCustomers ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading customers...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={fetchCustomers}
              >
                Retry
              </Button>
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-400">No customers available</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Customer Dropdown — hidden when only one */}
              {customers.length > 1 ? (
                <div>
                  <Label>Customer <span className="text-red-500">*</span></Label>
                  <div className="mt-2">
                    <SearchableSelect
                      options={customerOptions}
                      value={selectedCustomer?.customerId?.toString() || ""}
                      onChange={handleCustomerChange}
                      placeholder="-- Select Customer --"
                      loading={isLoadingCustomers}
                    />
                  </div>
                </div>
              ) : selectedCustomer && (
                <div>
                  <Label>Customer</Label>
                  <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">{selectedCustomer.customerName}</p>
                </div>
              )}

              {/* User Dropdown — hidden for superadmins (auto-picked) and when only one */}
              {!isSuperAdmin && (users.length > 1 ? (
                <div>
                  <Label>User <span className="text-red-500">*</span></Label>
                  <div className="mt-2">
                    <SearchableSelect
                      options={userOptions}
                      value={selectedUser?.userId?.toString() || ""}
                      onChange={handleUserChange}
                      placeholder={
                        !selectedCustomer
                          ? "-- Select a customer first --"
                          : users.length === 0 && !isLoadingUsers
                            ? "-- No users available --"
                            : "-- Select User --"
                      }
                      disabled={!selectedCustomer}
                      loading={isLoadingUsers}
                    />
                  </div>
                </div>
              ) : selectedUser && (
                <div>
                  <Label>User</Label>
                  <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">{selectedUser.userName}</p>
                </div>
              ))}

              {/* Store Dropdown — hidden when only one */}
              {stores.length > 1 ? (
                <div>
                  <Label>Store <span className="text-red-500">*</span></Label>
                  <div className="mt-2">
                    <SearchableSelect
                      options={storeOptions}
                      value={selectedStore?.storeID || ""}
                      onChange={handleStoreChange}
                      placeholder={
                        !selectedUser
                          ? "-- Select a user first --"
                          : stores.length === 0 && !isLoadingStores
                            ? "-- No stores available --"
                            : "-- Select Store --"
                      }
                      disabled={!selectedUser}
                      loading={isLoadingStores}
                    />
                  </div>
                </div>
              ) : selectedStore && (
                <div>
                  <Label>Store</Label>
                  <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">{selectedStore.storeName}</p>
                </div>
              )}

              {/* Selected Info Display */}
              {selectedCustomer && (
                <div className="p-4 bg-brand-50 dark:bg-brand-900/20 rounded-lg border border-brand-200 dark:border-brand-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-brand-600 dark:text-brand-400">
                        {selectedCustomer.customerName}
                      </p>
                      {!isSuperAdmin && selectedUser && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          User: {selectedUser.userName}
                        </p>
                      )}
                      {selectedStore && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Store: {selectedStore.storeName}
                        </p>
                      )}
                    </div>
                    <svg className="w-6 h-6 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between">
          <div className="flex gap-2">
            {!loginMode && onClose && (
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
            {onCancel && (
              <Button
                variant="outline"
                onClick={onCancel}
                className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
              >
                {loginMode ? "Cancel & Logout" : "Logout"}
              </Button>
            )}
          </div>
          <Button
            variant="primary"
            onClick={handleSelect}
            disabled={!selectedCustomer || !selectedUser || !selectedStore || isLoadingCustomers || isLoadingUsers || isLoadingStores}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  )

  // Use portal to render modal at document body level, above everything including sidebar
  return createPortal(modalContent, document.body)
}

export default CustomerSelectionModal
