import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import { useStore } from '../../context/StoreContext'
import { userPreferenceService } from '../../services/userPreferenceService'

// Must match WORKSPACE_PREFERENCE_KEY in DashboardTabContext — deleting it
// clears the persisted open tabs so the post-switch reload starts on a clean
// Dashboard-only workspace.
const WORKSPACE_PREFERENCE_KEY = 'workspaceState'

interface SwitchStoreModalProps {
  isOpen: boolean
  onClose: () => void
  /**
   * When true, the modal is being shown immediately after login because the user
   * has multiple stores and no auto-selectable choice. In this mode:
   *   - Cancel invokes onCancel (parent clears tokens + stays on sign-in)
   *   - After selection, parent is notified via onStoreSelected so it can navigate
   * In normal mode (header "Switch Store"), cancel just closes the modal.
   */
  loginMode?: boolean
  onCancel?: () => void
  onStoreSelected?: (store: Store) => void
}

interface Store {
  storeId: string
  storeName: string
}

export default function SwitchStoreModal({
  isOpen,
  onClose,
  loginMode = false,
  onCancel,
  onStoreSelected,
}: SwitchStoreModalProps) {
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const { currentStore, stores, isLoadingStores, switchStore, loadStores } = useStore()

  // Initialize selected store with current store when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedStore(currentStore)
      // Reload stores in case they've changed
      loadStores()
    }
  }, [isOpen, currentStore, loadStores])

  const filteredStores = stores.filter(store =>
    (store.storeName?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  )

  const handleSwitchStore = async () => {
    if (!selectedStore) return

    const isSameStore = currentStore?.storeId === selectedStore.storeId

    switchStore(selectedStore)

    if (loginMode && onStoreSelected) {
      // Login flow: the parent (SignInForm) handles navigation into the app.
      // Don't reload here — that would interrupt the sign-in transition.
      onStoreSelected(selectedStore)
      handleClose()
      return
    }

    handleClose()

    // Header "Switch Store": when the active store actually changes, reset the
    // whole session for the new store. We close every open tab (by clearing the
    // persisted workspace) and hard-reload to the dashboard so all store-scoped
    // screens — grids, counts, dashboard cards and the header label — refetch
    // against the new storeId instead of lingering on the previous store's data.
    if (!isSameStore) {
      try {
        await userPreferenceService.deletePreference(WORKSPACE_PREFERENCE_KEY)
      } catch {
        // Even if clearing the saved tabs fails, still reload so data refreshes.
      }
      window.location.assign('/dashboard')
    }
  }

  const handleClose = () => {
    setSelectedStore(null)
    setSearchTerm("")
    onClose()
  }

  const handleCancel = () => {
    setSelectedStore(null)
    setSearchTerm("")
    if (loginMode && onCancel) {
      onCancel()
    } else {
      onClose()
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center" style={{ zIndex: 99999 }}>
      {/* In loginMode, clicking the backdrop should NOT silently dismiss — the user
          must either pick a store or explicitly cancel (which logs them out). */}
      <div
        className="fixed inset-0 bg-white/60 backdrop-blur-md w-screen h-screen"
        onClick={loginMode ? undefined : handleClose}
        style={{ zIndex: 99998 }}
      />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl dark:bg-gray-800 mx-4" style={{ zIndex: 100000 }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {loginMode ? "Select a Store to Continue" : "Switch Store"}
          </h3>
          <button
            onClick={handleCancel}
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

        {/* Search */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <input
              type="text"
              placeholder="Search stores..."
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

        {/* Store List */}
        <div className="max-h-80 overflow-y-auto p-6">
          {isLoadingStores ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            </div>
          ) : stores.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 dark:text-gray-400 mb-2">
                No stores available
              </div>
              <div className="text-sm text-gray-400 dark:text-gray-500">
                Please log out and log in again to load stores.
              </div>
            </div>
          ) : filteredStores.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No stores match your search
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStores.map((store) => (
                <div
                  key={store.storeId}
                  onClick={() => setSelectedStore(store)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedStore?.storeId === store.storeId
                      ? "bg-brand-50 border-2 border-brand-500 dark:bg-brand-900/20 dark:border-brand-400"
                      : "bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-semibold">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {store.storeName}
                    </h4>
                  </div>
                  {selectedStore?.storeId === store.storeId && (
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

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 dark:text-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500"
          >
            {loginMode ? "Sign Out" : "Cancel"}
          </button>
          <button
            onClick={handleSwitchStore}
            disabled={!selectedStore}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loginMode ? "Continue" : "Switch Store"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
