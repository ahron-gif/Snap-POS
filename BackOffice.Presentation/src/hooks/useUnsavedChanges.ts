import { useEffect, useMemo, useRef, useCallback } from "react"
import { useDashboardTabs } from "../context/DashboardTabContext"

/**
 * Form-facing hook for the unsaved-changes UX.
 *
 * Contract:
 *   1. Compares `formData` against the last-saved `initialSnapshot` using
 *      JSON.stringify (per the spec). Reports `isDirty` upward to the
 *      DashboardTabContext keyed by `tabId` so the tab strip can draw a dot
 *      indicator and the close-tab guard can intercept ✕ clicks.
 *   2. Registers the caller's `saveHandler` so the "Save Changes" button in
 *      the unsaved-changes modal can trigger the form's own save path.
 *   3. Does NOT clear dirty state on unmount — the context auto-cleans when
 *      the tab is removed from `tabs[]`. This lets the asterisk persist while
 *      the user is on a different tab (the form is unmounted but the tab is
 *      still alive).
 *
 * Usage:
 *
 *   const MyForm: React.FC<{ __tabId?: string; id?: string }> = ({ __tabId, id }) => {
 *     const [formData, setFormData] = useState(initial)
 *     const [savedSnapshot, setSavedSnapshot] = useState(initial)
 *
 *     // After a successful save:
 *     //   await api.save(formData)
 *     //   setSavedSnapshot(formData)   ← clears dirty flag via comparator
 *
 *     useUnsavedChanges({
 *       tabId: __tabId,
 *       formData,
 *       initialSnapshot: savedSnapshot,
 *       saveHandler: async () => {
 *         const ok = await saveForm()
 *         if (!ok) throw new Error("Could not save. Fix validation errors and try again.")
 *       },
 *     })
 *     ...
 *   }
 *
 * Important:
 *   - Clear the flag AFTER the save API resolves, not before. The modal's
 *     "Save Changes" branch awaits `saveHandler()` and closes the tab only
 *     on resolve, so the cleanest pattern is to call setSavedSnapshot inside
 *     your save handler on success.
 *   - `initialSnapshot` should be reference-stable unless the baseline
 *     genuinely changed (after a save, or after the initial data load).
 *     Re-creating it every render will flag the tab clean every render.
 *   - Non-serialisable fields (File, Map, circular refs) bypass the default
 *     JSON.stringify comparator. Pass a custom `compare` if your form
 *     depends on detecting changes in such fields.
 */
export interface UseUnsavedChangesOptions<T> {
    /** The id of the tab this form lives inside. When undefined the hook is a
     *  no-op (useful for pages rendered outside the tab system). */
    tabId: string | null | undefined
    /** Current live form state. */
    formData: T
    /** Snapshot of the form state at the last save (or initial load). */
    initialSnapshot: T | null | undefined
    /** Async save function invoked when the user clicks "Save Changes" in the
     *  unsaved-changes modal. Should resolve on success, reject on failure. */
    saveHandler?: () => Promise<void>
    /** Optional custom equality check. Return true when inputs are equal. */
    compare?: (a: T, b: T) => boolean
    /** Set to false to suppress the hook (e.g. while still loading data). */
    enabled?: boolean
}

export interface UseUnsavedChangesReturn {
    /** True when current form state differs from the last-saved baseline. */
    isDirty: boolean
    /** Clears the dirty dot immediately. Prefer updating `initialSnapshot` to match
     *  `formData` so the tab stays clean on the next evaluation. */
    markSaved: () => void
}

const defaultCompare = <T>(a: T, b: T): boolean => {
    try {
        return JSON.stringify(a) === JSON.stringify(b)
    } catch {
        // Circular ref or similar — err on the side of "dirty" so we don't
        // silently discard the user's work.
        return false
    }
}

export function useUnsavedChanges<T>({
    tabId,
    formData,
    initialSnapshot,
    saveHandler,
    compare = defaultCompare,
    enabled = true,
}: UseUnsavedChangesOptions<T>): UseUnsavedChangesReturn {
    const { setTabDirty, registerSaveHandler } = useDashboardTabs()

    // Keep latest compare + saveHandler in refs so effect deps stay stable and
    // we don't churn the registry on every keystroke.
    const compareRef = useRef(compare)
    compareRef.current = compare
    const saveHandlerRef = useRef(saveHandler)
    saveHandlerRef.current = saveHandler

    // Compare to `initialSnapshot` directly. A ref updated in useEffect would lag
    // one render behind prop updates and falsely mark the tab dirty right after
    // the parent sets a fresh baseline (e.g. post-load sync).
    const isDirty = useMemo(() => {
        if (!enabled) return false
        if (initialSnapshot === null || initialSnapshot === undefined) {
            // No baseline yet (loading) → always report clean so the tab dot
            // doesn't flash before data arrives.
            return false
        }
        return !compareRef.current(formData, initialSnapshot)
    }, [formData, initialSnapshot, enabled])

    // Report dirty state up to the context.
    useEffect(() => {
        if (!tabId) return
        setTabDirty(tabId, isDirty)
    }, [tabId, isDirty, setTabDirty])

    // Register the save handler (so the modal can invoke it).
    //
    // Intentionally NO unmount unregister.
    //
    // The form unmounts on every tab switch (active-only renderer). If we
    // unregistered here, close-all and close-others would skip every dirty
    // tab whose form isn't currently mounted, silently dropping the user's
    // edits. Instead the handler stays in the map until the tab is removed
    // from `tabs[]`, at which point the DashboardTabContext prunes the map
    // entry (single source of truth — same pattern as dirtyTabIds + the
    // per-tab state cache). Re-mount overwrites the entry last-write-wins,
    // so no stale-handler accumulation.
    useEffect(() => {
        if (!tabId) return
        const handler = async () => {
            if (saveHandlerRef.current) await saveHandlerRef.current()
        }
        registerSaveHandler(tabId, handler)
    }, [tabId, registerSaveHandler])

    // Intentionally NO unmount-clears-dirty effect here.
    //
    // Previously this hook cleared the dirty flag on unmount, but the form
    // component unmounts on every tab switch (active-only renderer). Clearing
    // on unmount made the asterisk disappear when the user switched away from
    // an edited tab. The context now owns dirty cleanup: when a tab is removed
    // from `tabs[]` (close, close-all, close-others, workspace replace), the
    // provider prunes both `dirtyTabIds` and the per-tab state cache in one
    // pass. Unmount-because-tab-switch leaves the flag intact, so the asterisk
    // stays visible while the user is on another tab.

    /** Clears the tab dirty flag. Caller should align `initialSnapshot` with the
     *  current form on the next render (e.g. `setSavedFormData(formData)`), or
     *  the dot will return when this hook re-evaluates. */
    const markSaved = useCallback(() => {
        if (tabId) setTabDirty(tabId, false)
    }, [tabId, setTabDirty])

    return { isDirty, markSaved }
}

export default useUnsavedChanges
