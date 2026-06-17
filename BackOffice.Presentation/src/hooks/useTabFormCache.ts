import { useEffect, useMemo } from "react"
import { useDashboardTabs } from "../context/DashboardTabContext"

/**
 * Per-tab in-memory form-state cache — split into READ and WRITE hooks so
 * the form can sequence the calls correctly around its `useState` declarations.
 *
 * Why this exists:
 *   With the active-only tab renderer, every tab switch unmounts the form.
 *   `useState` is wiped. On switch-back the form would re-fetch from the API
 *   and lose the user's in-progress edits + the dirty flag. These hooks let
 *   a form persist a snapshot for the lifetime of the tab so a remount sees
 *   the user's previous state and skips the fetch.
 *
 *   The cache is:
 *     - Per-tab, keyed by `__tabId`.
 *     - In-memory only. Page reload starts fresh.
 *     - userPreferences workspace JSON is NEVER touched.
 *     - Auto-pruned when the tab is removed from `tabs[]` (context cleanup).
 *
 * Pattern:
 *
 *   interface MyFormCache { formData: MyData; savedFormData: MyData | null; hasFetched: boolean }
 *
 *   const ItemForm: React.FC<Props> = ({ __tabId, id }) => {
 *     // 1. READ once — runs before useState so we can seed initializers.
 *     const { initial, hasCachedState } =
 *       useTabFormCacheRead<MyFormCache>(__tabId)
 *
 *     const [formData, setFormData] = useState<MyData>(
 *       () => initial?.formData ?? initialFormData,
 *     )
 *     const [savedFormData, setSavedFormData] = useState<MyData | null>(
 *       () => initial?.savedFormData ?? null,
 *     )
 *     const hasLoadedOnceRef = useRef(hasCachedState)
 *
 *     // 2. WRITE — fires after every relevant state change once we've loaded.
 *     useTabFormCacheWrite<MyFormCache>(
 *       __tabId,
 *       hasLoadedOnceRef.current ? { formData, savedFormData, hasFetched: true } : null,
 *     )
 *
 *     // 3. GATE the initial fetch on the cache hit so remounts don't re-fetch.
 *     useEffect(() => {
 *       if (hasCachedState) return
 *       loadItem(id).then(d => {
 *         setFormData(d); setSavedFormData(d); hasLoadedOnceRef.current = true
 *       })
 *     }, [id, hasCachedState])
 *   }
 */

/**
 * Reads the per-tab cache once on mount. Returned values are stable across
 * the component's lifetime; safe to use inside `useState` initializers.
 */
export function useTabFormCacheRead<T>(tabId: string | undefined): {
  initial: T | undefined
  hasCachedState: boolean
} {
  const { getTabState } = useDashboardTabs()

  const initial = useMemo<T | undefined>(
    () => (tabId ? getTabState<T>(tabId) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return { initial, hasCachedState: initial !== undefined }
}

/**
 * Mirrors `state` into the per-tab cache. Pass `null` to suppress writes
 * (e.g. while the form is still in its initial fetch phase — caching a
 * half-built snapshot then would clobber the previous valid one on remount).
 */
export function useTabFormCacheWrite<T>(tabId: string | undefined, state: T | null): void {
  const { setTabState } = useDashboardTabs()

  useEffect(() => {
    if (!tabId || state === null) return
    setTabState<T>(tabId, state)
  }, [tabId, state, setTabState])
}
