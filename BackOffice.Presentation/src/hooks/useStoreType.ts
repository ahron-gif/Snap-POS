import { useTenantSetup } from '../context/TenantSetupContext'
import { StoreType, StoreTypeValue } from '../services/tenantSetupService'

/**
 * Returns the active tenant's StoreType plus convenience booleans —
 * mirrors the legacy desktop's
 *   <c>GlobalDataAccess.EncDateRow.StoreType</c>
 * checks scattered through FrmItems / FrmMatrix / report screens.
 *
 * Defaults to <c>Regular</c> when the tenant setup hasn't loaded yet
 * or has no StoreType set. Callers that need to hide controls
 * pessimistically (e.g. "only show Food-Stamp checkbox if Food")
 * should branch on <c>isFood</c>; callers that need to enable extras
 * for non-Regular stores should branch on the specific flag.
 *
 * Safe to call from any component beneath <c>TenantSetupProvider</c>.
 */
export interface StoreTypeInfo {
  /** Raw StoreType enum value (0 Food, 1 Books, 2 Apparel, 3 Regular). */
  storeType: StoreTypeValue
  /** True while the first fetch is in flight. */
  isLoading: boolean
  /** True once the fetch has attempted at least once. */
  hasLoaded: boolean
  isFood: boolean
  isBooks: boolean
  isApparel: boolean
  isRegular: boolean
}

export function useStoreType(): StoreTypeInfo {
  const { setup, isLoading, hasLoaded } = useTenantSetup()

  // Default Regular when missing — matches desktop behaviour for a
  // brand-new install (no EncData row yet) which shows the standard
  // Regular-store UI rather than hiding everything.
  const raw = setup?.storeType
  const storeType: StoreTypeValue =
    raw === StoreType.Food ||
    raw === StoreType.Books ||
    raw === StoreType.Apparel ||
    raw === StoreType.Regular
      ? (raw as StoreTypeValue)
      : StoreType.Regular

  return {
    storeType,
    isLoading,
    hasLoaded,
    isFood: storeType === StoreType.Food,
    isBooks: storeType === StoreType.Books,
    isApparel: storeType === StoreType.Apparel,
    isRegular: storeType === StoreType.Regular,
  }
}
