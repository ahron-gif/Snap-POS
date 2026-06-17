import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react'
import { lookupService, StoreLookupDto } from '../services/lookupService'
import { userPreferenceService } from '../services/userPreferenceService'

interface Store {
  storeId: string
  storeName: string
}

interface StoreContextType {
  currentStore: Store | null
  stores: Store[]
  isLoadingStores: boolean
  switchStore: (store: Store | null) => void
  loadStores: () => Promise<void>
}

const STORE_STORAGE_KEY = 'currentStore'
const LAST_SESSION_KEY = 'lastSession'

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currentStore, setCurrentStore] = useState<Store | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [isLoadingStores, setIsLoadingStores] = useState(false)
  const hasLoadedInitialStore = useRef(false)

  // Load stored store from localStorage on mount
  useEffect(() => {
    const storedStore = localStorage.getItem(STORE_STORAGE_KEY)
    if (storedStore) {
      try {
        const parsed = JSON.parse(storedStore)
        setCurrentStore(parsed)
        hasLoadedInitialStore.current = true
      } catch (e) {
        console.error('Error parsing stored store:', e)
      }
    }
  }, [])

  // Helper function to check if a string is a valid GUID format
  const isValidGuid = (str: string): boolean => {
    if (!str) return false
    const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    return guidRegex.test(str)
  }

  const loadStores = useCallback(async () => {
    setIsLoadingStores(true)
    try {
      const userData = localStorage.getItem('userData')
      if (!userData) {
        console.warn('StoreContext: No userData found in localStorage')
        setIsLoadingStores(false)
        return
      }

      const parsed = JSON.parse(userData)
      const localUserId = parsed.localUserId || ''
      const storeId = parsed.storeId || parsed.storeID || ''

      if (!localUserId) {
        console.warn('StoreContext: No localUserId found in userData. User may need to log in again.')
        setIsLoadingStores(false)
        return
      }

      if (!isValidGuid(localUserId)) {
        console.warn('StoreContext: localUserId is not a valid GUID:', localUserId)
        setIsLoadingStores(false)
        return
      }

      const response = await lookupService.getStoresByUser(
        localUserId,
        isValidGuid(storeId) ? storeId : undefined
      )

      if (response.success && response.data && response.data.length > 0) {
        const storeList: Store[] = response.data.map((store: StoreLookupDto) => ({
          storeId: store.storeID,
          storeName: store.storeName,
        }))
        setStores(storeList)

        // If no current store is set and no stored store was loaded, try to restore from backend
        if (!hasLoadedInitialStore.current && storeList.length > 0) {
          let restoredFromBackend = false

          try {
            const prefResult = await userPreferenceService.getPreference(LAST_SESSION_KEY)
            if (prefResult.isSuccess && prefResult.response?.preferenceValue) {
              const lastSession = JSON.parse(prefResult.response.preferenceValue)
              if (lastSession.storeId) {
                const matchingStore = storeList.find(s => s.storeId === lastSession.storeId)
                if (matchingStore) {
                  setCurrentStore(matchingStore)
                  localStorage.setItem(STORE_STORAGE_KEY, JSON.stringify(matchingStore))
                  hasLoadedInitialStore.current = true
                  restoredFromBackend = true
                }
              }
            }
          } catch {
            // Silently fail — will fall back to default
          }

          if (!restoredFromBackend) {
            const defaultStore = storeList[0]
            setCurrentStore(defaultStore)
            localStorage.setItem(STORE_STORAGE_KEY, JSON.stringify(defaultStore))
            hasLoadedInitialStore.current = true
          }
        }
      } else {
        console.warn('StoreContext: API returned no stores or failed:', response.message)
      }
    } catch (error) {
      console.error('Error loading stores:', error)
    } finally {
      setIsLoadingStores(false)
    }
  }, [])

  // Load stores when component mounts and user is logged in
  useEffect(() => {
    const userData = localStorage.getItem('userData')
    if (userData) {
      loadStores()
    }
  }, [loadStores])

  const switchStore = (store: Store | null) => {
    setCurrentStore(store)
    if (store) {
      localStorage.setItem(STORE_STORAGE_KEY, JSON.stringify(store))

      const userData = localStorage.getItem('userData')
      if (userData) {
        try {
          const parsed = JSON.parse(userData)

          // Keep userData.storeId/storeName in sync with the active store.
          // Several layers read the store from userData rather than this
          // context — store-scoped API params, axios/lookup headers, etc. The
          // Switch Tenant flow already syncs these; without doing the same here
          // the header "Switch Store" path leaves userData pinned to the store
          // captured at login, so requests keep returning the old store's data.
          parsed.storeId = store.storeId
          parsed.storeName = store.storeName
          localStorage.setItem('userData', JSON.stringify(parsed))

          // Save last session to backend (fire-and-forget)
          const lastSession = {
            storeId: store.storeId,
            storeName: store.storeName,
            localUserId: parsed.localUserId || '',
            customerId: parsed.customerId || null,
          }
          userPreferenceService.savePreference(LAST_SESSION_KEY, lastSession).catch(() => {})
        } catch {
          // Silently fail
        }
      }
    } else {
      localStorage.removeItem(STORE_STORAGE_KEY)
    }
  }

  return (
    <StoreContext.Provider value={{ currentStore, stores, isLoadingStores, switchStore, loadStores }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider')
  }
  return context
}
