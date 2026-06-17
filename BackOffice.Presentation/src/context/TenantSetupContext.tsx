import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { tenantSetupService, TenantSetupDto } from '../services/tenantSetupService'

/**
 * Tenant-wide setup context. The new web app needs the same
 * StoreType / module flags the legacy desktop pulls from
 * <c>GlobalDataAccess.EncDateRow</c> so screens (Item form, Matrix
 * form, etc.) can drive show/hide behaviour. Backend exposes them
 * via <c>GET /api/Tenant/Setup</c>, cached server-side; we cache
 * once more in memory here so screens don't re-fetch on every nav.
 *
 * Sits between <c>TenantProvider</c> (which knows which tenant
 * we're on) and <c>StoreProvider</c> (which is per-store, not
 * per-tenant). When the user switches tenant we drop the cached
 * setup so the next read picks up the new one.
 */
interface TenantSetupContextType {
  setup: TenantSetupDto | null
  isLoading: boolean
  /** True once we've attempted a fetch — useful so consumers can
   *  distinguish "still loading" from "loaded but null". */
  hasLoaded: boolean
  /** Manually re-fetch. Used after SuperAdmin saves the license. */
  refresh: () => Promise<void>
}

const TenantSetupContext = createContext<TenantSetupContextType | undefined>(undefined)

export function TenantSetupProvider({ children }: { children: ReactNode }) {
  const [setup, setSetup] = useState<TenantSetupDto | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  const fetchSetup = useCallback(async () => {
    // Skip if there's no logged-in user yet — first paint can run
    // before AuthProvider has hydrated.
    const userData = localStorage.getItem('userData')
    if (!userData) {
      return
    }

    setIsLoading(true)
    try {
      const result = await tenantSetupService.getSetup()
      if (result.isSuccess && result.response) {
        setSetup(result.response)
      } else {
        // Don't blow up the app — leave setup as null so consumers
        // fall back to "show everything" defaults.
        setSetup(null)
      }
    } finally {
      setIsLoading(false)
      setHasLoaded(true)
    }
  }, [])

  useEffect(() => {
    fetchSetup()
  }, [fetchSetup])

  // Re-fetch when the active tenant changes. AuthProvider rewrites
  // userData on tenant switch, so we listen for storage events as
  // a cheap signal — covers both same-tab (custom event) and
  // cross-tab (native storage event).
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'userData') {
        fetchSetup()
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [fetchSetup])

  const value = useMemo<TenantSetupContextType>(
    () => ({
      setup,
      isLoading,
      hasLoaded,
      refresh: fetchSetup,
    }),
    [setup, isLoading, hasLoaded, fetchSetup],
  )

  return <TenantSetupContext.Provider value={value}>{children}</TenantSetupContext.Provider>
}

export function useTenantSetup() {
  const ctx = useContext(TenantSetupContext)
  if (ctx === undefined) {
    throw new Error('useTenantSetup must be used within a TenantSetupProvider')
  }
  return ctx
}
