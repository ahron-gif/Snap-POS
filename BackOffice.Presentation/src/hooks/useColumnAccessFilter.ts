import { useEffect, useMemo, useRef, useState } from 'react'
import { gridColumnAccessService, ColumnAccessItemDto } from '../services/gridColumnAccessService'
import {
  GRID_SETTINGS_RESET_EVENT,
  type GridSettingsResetDetail,
} from '../components/common/ServerGrid/gridSettingsEvents'

/**
 * Removes columns the Super Admin has revoked for the current tenant, and
 * applies the tenant's displayName / sortOrder overrides.
 *
 * Fetches the caller's column-access rules for the given gridId on mount.
 * A column is stripped from the array ONLY when the backend marks it
 * `isTenantRestricted = true` (i.e. the tenant-default row says
 * AllowedToView=false). That makes it disappear from the grid, the column
 * chooser, the three-dots menu, and the export modal — Super Admin's
 * decision is a hard ceiling.
 *
 * Importantly we do NOT strip on `allowedToView = false` directly, because
 * that field also goes false when the USER hides a column from their own
 * chooser. Stripping on it would make user-hidden columns disappear from
 * the chooser too, with no way to re-check them. User visibility prefs are
 * handled separately by useGridSettings; the chooser receives the column
 * with `visible=false` and renders an unchecked box.
 *
 * Semantics:
 *   - Absence of a rule for a column => allowed (default permissive).
 *   - Rule with isTenantRestricted=true => column removed entirely.
 *   - Rule with allowedToView=false but isTenantRestricted=false => column
 *     stays in the list (user hid it; chooser still shows it as unchecked).
 *
 * Failure handling — FAIL CLOSED, NOT OPEN:
 *   - During the initial fetch window, the hook returns an EMPTY column
 *     array (not allColumns). That means the grid renders blank for the
 *     short load window. We picked this over the previous "show everything
 *     while loading" behavior because the latter leaks tenant-restricted
 *     columns into view on every page mount, and on transient API failures
 *     (auth refresh, slow cold start) the leak became permanent.
 *   - On API error or non-success response, we retry once with a short
 *     backoff. If the retry also fails, the hook stays in 'failed' state
 *     and keeps returning an empty array — restricted columns NEVER leak
 *     just because the rules endpoint hiccupped. The grid stays empty so
 *     the user can refresh, but no privacy boundary is crossed.
 *
 * @param gridId  Stable grid identifier (same one used by useGridSettings).
 * @param allColumns  The grid's full column list (before admin filtering).
 * @returns Object with `filteredColumns` ready to pass downstream, plus
 *          `loading` / `failed` flags and a `refresh` function for callers
 *          that want to react to state.
 */

type LoadStatus = 'loading' | 'loaded' | 'failed'

// Initial fetch + this many retries on failure. Total max attempts = 1 + RETRY_COUNT.
// Bumped from 1 → 2: cold starts / token-refresh races on the rules endpoint were
// occasionally exhausting the budget and failing closed (blank grid) on first load.
const RETRY_COUNT = 2
// Delay before each retry. Short enough not to annoy, long enough to ride
// out brief network blips and token-refresh races.
const RETRY_DELAY_MS = 600

// ── Self-healing after a failed first load ──────────────────────────────────
// When the very first rules fetch exhausts its retry budget (cold start,
// token-refresh race, transient 5xx) the hook fails CLOSED and returns an
// empty column list — the grid renders with only the checkbox column and no
// headers/data ("blank grid" bug). Previously that state was permanent until
// the user did a hard browser refresh. To make it self-heal, once we're in
// the 'failed' state we keep re-attempting the whole fetch on a slow cadence
// so a recovered backend repopulates the columns without user intervention.
// Bounded so a genuinely-down server isn't hammered forever.
const AUTO_RECOVER_DELAY_MS = 2_500
const MAX_AUTO_RECOVERIES = 8

// ── Session cache of resolved rules (in-memory + localStorage) ──────────────
// The fail-closed first load returns an EMPTY column list while the rules fetch
// is in flight, which renders the grid blank. On a fresh mount / tab-switch /
// remountKey bump that looked like an intermittent "blank grid until Refresh"
// bug on EVERY list page. Caching the last resolved rules (keyed by tenant +
// gridId) lets any subsequent mount resolve columns SYNCHRONOUSLY (no blank);
// we still revalidate in the background. Rules are non-sensitive column-
// visibility config, so persisting them is fine. localStorage survives reloads;
// the in-memory Map avoids re-parsing every mount within a session.
const RULES_CACHE = new Map<string, ColumnAccessItemDto[]>()
const RULES_LS_PREFIX = 'gridColAccess::'

function colAccessCacheKey(gridId: string): string {
  let cust = ''
  try {
    const ud = localStorage.getItem('userData')
    if (ud) cust = String(JSON.parse(ud).customerId ?? '')
  } catch {
    /* ignore */
  }
  return `${cust}::${gridId}`
}

function readRulesCache(gridId: string): ColumnAccessItemDto[] | null {
  const key = colAccessCacheKey(gridId)
  const mem = RULES_CACHE.get(key)
  if (mem) return mem
  try {
    const raw = localStorage.getItem(RULES_LS_PREFIX + key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        RULES_CACHE.set(key, parsed)
        return parsed
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function writeRulesCache(gridId: string, rules: ColumnAccessItemDto[]): void {
  const key = colAccessCacheKey(gridId)
  RULES_CACHE.set(key, rules)
  try {
    localStorage.setItem(RULES_LS_PREFIX + key, JSON.stringify(rules))
  } catch {
    /* ignore */
  }
}

export function useColumnAccessFilter<T extends { field: string; headerName?: string }>(
  gridId: string,
  allColumns: T[],
) {
  // Seed from cache so remounts / tab-switches render columns immediately (no
  // fail-closed blank). A null seed means this grid hasn't been resolved yet in
  // this browser → genuine first load (fail closed while fetching).
  const [rules, setRules] = useState<ColumnAccessItemDto[] | null>(() => readRulesCache(gridId))
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(() =>
    readRulesCache(gridId) != null ? 'loaded' : 'loading',
  )
  const [refreshKey, setRefreshKey] = useState(0)

  // True once we've successfully loaded rules at least once. After that, a
  // re-fetch (tab-focus version-bump / reset event) must NOT blank the grid:
  // we keep the last-known-good columns until the new rules arrive, and a
  // FAILED re-fetch keeps them too. Only the genuine FIRST load fails closed
  // (empty columns) — the one window where we can't yet know which columns are
  // tenant-restricted. (Restricted columns can't leak on a kept set because the
  // previously-loaded rules already excluded them.)
  const hasLoadedOnceRef = useRef(readRulesCache(gridId) != null)

  // Counts background auto-recovery attempts after a failed first load so we
  // stop hammering a genuinely-down endpoint. Reset whenever we leave 'failed'.
  const autoRecoverCountRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    const isFirstLoad = !hasLoadedOnceRef.current
    // Only enter the blanking 'loading' state on the very first load. On a
    // re-fetch we leave loadStatus = 'loaded' so filteredColumns keeps
    // returning the previously-resolved columns (no blank flash).
    if (isFirstLoad) {
      setLoadStatus('loading')
    }

    const failOrKeep = (reason: unknown): void => {
      if (isFirstLoad) {
        console.error(
          '[ColumnAccessFilter] first load exhausted — failing CLOSED (empty column list).',
          reason,
        )
        setRules([])
        setLoadStatus('failed')
      } else {
        // Re-fetch failed: keep the last-known-good columns instead of blanking.
        console.warn(
          '[ColumnAccessFilter] re-fetch failed; keeping previously-loaded columns.',
          reason,
        )
      }
    }

    const attempt = (attemptsLeft: number): void => {
      console.log(
        `[ColumnAccessFilter] fetching for gridId = ${gridId} (attempts left: ${attemptsLeft})`,
      )
      gridColumnAccessService
        .getMine(gridId)
        .then(result => {
          if (cancelled) return
          if (result.isSuccess && result.response) {
            const incoming = result.response.columns ?? []
            console.log('[ColumnAccessFilter] rules loaded:', incoming.length, 'rule(s)')
            setRules(incoming)
            setLoadStatus('loaded')
            hasLoadedOnceRef.current = true
            writeRulesCache(gridId, incoming)
            return
          }
          if (attemptsLeft > 0) {
            retryTimer = setTimeout(() => {
              if (!cancelled) attempt(attemptsLeft - 1)
            }, RETRY_DELAY_MS)
            return
          }
          failOrKeep(result.message)
        })
        .catch(err => {
          if (cancelled) return
          if (attemptsLeft > 0) {
            retryTimer = setTimeout(() => {
              if (!cancelled) attempt(attemptsLeft - 1)
            }, RETRY_DELAY_MS)
            return
          }
          failOrKeep(err)
        })
    }

    attempt(RETRY_COUNT)

    return () => {
      cancelled = true
      if (retryTimer != null) clearTimeout(retryTimer)
    }
  }, [gridId, refreshKey])

  // Self-heal a failed first load. The fetch effect above fails CLOSED (empty
  // columns) when the genuine first load can't reach the rules endpoint, which
  // renders the grid blank (only the checkbox column). Rather than leave it
  // blank until a manual browser refresh, schedule a bounded background
  // re-fetch so a recovered backend repopulates the columns automatically.
  // Once any attempt succeeds, loadStatus flips to 'loaded' and this effect
  // resets its counter and stops.
  useEffect(() => {
    // Only a genuine success clears the budget. Note we must NOT reset on the
    // transient 'loading' window between recovery attempts, or the cap would
    // never be reached and we'd retry forever against a down server.
    if (loadStatus === 'loaded') {
      autoRecoverCountRef.current = 0
      return
    }
    if (loadStatus !== 'failed') return
    if (autoRecoverCountRef.current >= MAX_AUTO_RECOVERIES) return

    const timer = setTimeout(() => {
      autoRecoverCountRef.current += 1
      console.warn(
        `[ColumnAccessFilter] auto-recovering blank grid for ${gridId} ` +
          `(attempt ${autoRecoverCountRef.current}/${MAX_AUTO_RECOVERIES}).`,
      )
      // Allow the next fetch to enter the blanking 'loading' path again so a
      // successful response actually populates columns.
      hasLoadedOnceRef.current = false
      setRefreshKey(k => k + 1)
    }, AUTO_RECOVER_DELAY_MS)

    return () => clearTimeout(timer)
  }, [loadStatus, gridId])

  // Re-fetch the access rules whenever ServerGrid (or any other path) fires
  // the shared "grid-settings:reset" event for THIS grid. Without this listener
  // the user clicks Reset Grid, useGridSettings refetches visibility/width,
  // but THIS hook keeps its stale `rules` — and since the page renders the
  // column list from filteredColumns (which is derived from `rules`), the
  // visible columns don't change until a hard browser refresh. The reset
  // event also fires on the visibility-change refresh path (reason:
  // 'version-bump'), so a Super-Admin update made while the user is on
  // another tab gets picked up here too.
  useEffect(() => {
    const handleReset = (e: Event) => {
      const detail = (e as CustomEvent<GridSettingsResetDetail>).detail
      if (!detail || detail.gridId !== gridId) return
      console.log(
        `[ColumnAccessFilter] reset event received for ${gridId} (${detail.reason}); refetching rules.`,
      )
      setRefreshKey(k => k + 1)
    }
    window.addEventListener(GRID_SETTINGS_RESET_EVENT, handleReset)
    return () => window.removeEventListener(GRID_SETTINGS_RESET_EVENT, handleReset)
  }, [gridId])

  const filteredColumns = useMemo(() => {
    // FAIL CLOSED on loading + failure. Returning an empty array means the
    // grid renders blank instead of leaking restricted columns. See the
    // module-level docstring for why we chose this over the previous
    // "show everything while loading" behavior.
    if (loadStatus !== 'loaded' || rules == null) return [] as T[]

    // Loaded with zero rules => no admin configuration for this grid =>
    // default-permissive: show all columns the page knows about.
    if (rules.length === 0) return allColumns

    // Build quick lookup maps from the rules array:
    //   - revoked: fields the TENANT explicitly hid (strip entirely; do
    //     NOT include user-hidden columns here — the chooser needs to keep
    //     showing those so the user can toggle them back on).
    //   - labelOverrides: field -> custom display label
    //   - sortOverrides:  field -> admin-defined position (lower = earlier)
    const revoked = new Set<string>()
    const labelOverrides = new Map<string, string>()
    const sortOverrides = new Map<string, number>()
    for (const r of rules) {
      if (r.isTenantRestricted === true) revoked.add(r.field)
      if (r.displayName && r.displayName.trim() !== '') {
        labelOverrides.set(r.field, r.displayName.trim())
      }
      if (typeof r.sortOrder === 'number') {
        sortOverrides.set(r.field, r.sortOrder)
      }
    }

    // Step 1: filter + label override, preserving original (natural) index.
    type Indexed = { col: T; naturalIndex: number }
    const kept: Indexed[] = []
    allColumns.forEach((col, idx) => {
      if (revoked.has(col.field)) return
      const override = labelOverrides.get(col.field)
      const finalCol = override ? ({ ...col, headerName: override } as T) : col
      kept.push({ col: finalCol, naturalIndex: idx })
    })

    // Step 2: apply sort overrides. Columns with a defined sortOrder are
    // placed by that number (ascending); columns without one fall back to
    // their natural position. Ties broken by natural index (stable).
    kept.sort((a, b) => {
      const aOverride = sortOverrides.get(a.col.field)
      const bOverride = sortOverrides.get(b.col.field)
      const aHas = typeof aOverride === 'number'
      const bHas = typeof bOverride === 'number'

      // Columns with an explicit sortOrder come before those without,
      // so the admin's order is honoured and untouched columns trail.
      if (aHas && bHas) {
        if (aOverride! !== bOverride!) return aOverride! - bOverride!
        return a.naturalIndex - b.naturalIndex
      }
      if (aHas) return -1
      if (bHas) return 1
      return a.naturalIndex - b.naturalIndex
    })

    return kept.map(k => k.col)
  }, [loadStatus, rules, allColumns])

  return {
    /** Columns the current user is allowed to see. */
    filteredColumns,
    /** True while the access rules are being fetched from the backend. */
    loading: loadStatus === 'loading',
    /** True when the fetch failed after all retries; grid will be empty. */
    failed: loadStatus === 'failed',
    /** Force a re-fetch (e.g. after an explicit UI action). */
    refresh: () => setRefreshKey(k => k + 1),
  }
}

export default useColumnAccessFilter
