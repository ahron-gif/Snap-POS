import { useEffect, useMemo, useState } from 'react'
import { gridColumnAccessService } from '../services/gridColumnAccessService'
import { getRegisteredGrid } from '../constants/gridRegistry'

/**
 * Field-level companion to {@link useColumnAccessFilter}. Where that hook
 * filters a column array, this returns a flat `Set<string>` of field
 * identifiers the current user is NOT allowed to see — convenient for
 * non-grid surfaces (form modals, detail panels, export pickers) that
 * just need to ask "is this field revoked?".
 *
 * Semantics:
 *   - Loading state => returns an empty set (fail open during the brief
 *     window so inputs don't flash in/out).
 *   - Network / API error => same fail-open behaviour.
 *   - Fields flagged `required: true` in the registry are NEVER reported
 *     as revoked, even if a stale DB rule says so. The backend validates
 *     them as required, so hiding them would break Create / Update.
 *
 * @param gridId  Stable grid identifier (same one used by
 *                useGridSettings / useColumnAccessFilter).
 */
export function useFieldAccessSet(gridId: string) {
  const [revoked, setRevoked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  // Cache the set of required fields for this grid so the hook can ignore
  // stale revocations on them. Recomputed only when gridId changes.
  const requiredFields = useMemo(() => {
    const reg = getRegisteredGrid(gridId)
    if (!reg) return new Set<string>()
    return new Set(reg.columns.filter(c => c.required).map(c => c.field))
  }, [gridId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    gridColumnAccessService
      .getMine(gridId)
      .then(result => {
        if (cancelled) return
        const next = new Set<string>()
        if (result.isSuccess && result.response?.columns) {
          for (const r of result.response.columns) {
            if (r.allowedToView === false && !requiredFields.has(r.field)) {
              next.add(r.field)
            }
          }
        }
        setRevoked(next)
      })
      .catch(() => {
        // Fail open: if we can't fetch the rules, show every field rather
        // than locking users out of editing their own data.
        if (!cancelled) setRevoked(new Set())
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [gridId, refreshKey, requiredFields])

  return {
    /** Set of `field` strings revoked for the current user. */
    revokedFields: revoked,
    /** True while the rules are being fetched. */
    loading,
    /** Convenience predicate. Required fields always return false. */
    isHidden: (field: string) =>
      !requiredFields.has(field) && revoked.has(field),
    /** Force a re-fetch (e.g. after an explicit UI action). */
    refresh: () => setRefreshKey(k => k + 1),
  }
}

export default useFieldAccessSet
