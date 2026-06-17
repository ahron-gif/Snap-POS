import { useCallback, useEffect, useRef, useState } from "react"
import { userPreferenceService } from "../services/userPreferenceService"

/**
 * Persisted filter state for the Reports page.
 *
 * Stored under UserPreference key `reports.filterState.v1` so the user's
 * last filter selections follow them across devices and survive reloads.
 * Same persistence mechanism used for workspace tabs, item-form layout,
 * and report favorites — zero new endpoints, no new tables.
 *
 * Shape is intentionally generic so adding a new facet later is additive
 * (just add a new optional field; old saved values still load).
 */
const FILTER_STATE_PREFERENCE_KEY = "reports.filterState.v1"
const SAVE_DEBOUNCE_MS = 400

export interface ReportFilterState {
    /** Free-text search query applied to report name + description. */
    searchText: string
    /** Selected top-level category ("all" when no filter). */
    selectedCategory: string
    /** Selected facet values, grouped by facet key (e.g. { status: ["active"] }). */
    selectedFacets: Record<string, string[]>
    /** When true, include coming-soon (not-yet-implemented) reports in results. */
    showComingSoon: boolean
    /** When true, restrict the grid to favorites only. */
    showOnlyFavorites: boolean
}

export const DEFAULT_REPORT_FILTER_STATE: ReportFilterState = {
    searchText: "",
    selectedCategory: "all",
    selectedFacets: {},
    showComingSoon: false,
    showOnlyFavorites: false,
}

interface UseReportFilterStateReturn {
    /** True while the initial hydration from the server is in flight. */
    loading: boolean
    /** Current filter state. */
    state: ReportFilterState
    /** Replace the entire filter state (e.g. after "Apply" in the drawer). */
    setState: (next: ReportFilterState) => void
    /** Merge a partial update. */
    patch: (partial: Partial<ReportFilterState>) => void
    /** Reset to defaults (clears all filters). */
    reset: () => void
}

const sanitize = (raw: unknown): ReportFilterState => {
    const base = { ...DEFAULT_REPORT_FILTER_STATE }
    if (!raw || typeof raw !== "object") return base
    const obj = raw as Record<string, unknown>
    if (typeof obj.searchText === "string") base.searchText = obj.searchText
    if (typeof obj.selectedCategory === "string") base.selectedCategory = obj.selectedCategory
    if (typeof obj.showComingSoon === "boolean") base.showComingSoon = obj.showComingSoon
    if (typeof obj.showOnlyFavorites === "boolean") base.showOnlyFavorites = obj.showOnlyFavorites
    if (obj.selectedFacets && typeof obj.selectedFacets === "object") {
        const cleaned: Record<string, string[]> = {}
        for (const [k, v] of Object.entries(obj.selectedFacets as Record<string, unknown>)) {
            if (Array.isArray(v)) {
                cleaned[k] = v.filter((x): x is string => typeof x === "string")
            }
        }
        base.selectedFacets = cleaned
    }
    return base
}

export const useReportFilterState = (): UseReportFilterStateReturn => {
    const [state, setStateInternal] = useState<ReportFilterState>(DEFAULT_REPORT_FILTER_STATE)
    const [loading, setLoading] = useState(true)
    const stateRef = useRef<ReportFilterState>(DEFAULT_REPORT_FILTER_STATE)
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const hydratedRef = useRef(false)

    // Initial hydration.
    useEffect(() => {
        let cancelled = false
        userPreferenceService
            .getPreference(FILTER_STATE_PREFERENCE_KEY)
            .then(result => {
                if (cancelled) return
                const raw = result?.response?.preferenceValue
                if (!raw) return
                try {
                    const parsed = JSON.parse(raw)
                    const next = sanitize(parsed)
                    stateRef.current = next
                    setStateInternal(next)
                } catch {
                    // Malformed saved value — ignore, keep defaults.
                }
            })
            .catch(() => {
                // Fail open — the feature is non-critical.
            })
            .finally(() => {
                if (!cancelled) {
                    hydratedRef.current = true
                    setLoading(false)
                }
            })
        return () => {
            cancelled = true
        }
    }, [])

    // Debounced save. Never saves before the initial load so we don't clobber
    // a freshly-fetched state with in-flight defaults.
    const scheduleSave = useCallback((next: ReportFilterState) => {
        if (!hydratedRef.current) return
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => {
            userPreferenceService
                .savePreference(FILTER_STATE_PREFERENCE_KEY, next)
                .catch(() => {
                    console.warn("Failed to save reports filter state")
                })
        }, SAVE_DEBOUNCE_MS)
    }, [])

    const setState = useCallback(
        (next: ReportFilterState) => {
            stateRef.current = next
            setStateInternal(next)
            scheduleSave(next)
        },
        [scheduleSave],
    )

    const patch = useCallback(
        (partial: Partial<ReportFilterState>) => {
            const next = { ...stateRef.current, ...partial }
            stateRef.current = next
            setStateInternal(next)
            scheduleSave(next)
        },
        [scheduleSave],
    )

    const reset = useCallback(() => {
        const next = { ...DEFAULT_REPORT_FILTER_STATE }
        stateRef.current = next
        setStateInternal(next)
        scheduleSave(next)
    }, [scheduleSave])

    // Flush on unmount so last-second changes aren't lost.
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current)
                if (hydratedRef.current) {
                    userPreferenceService
                        .savePreference(FILTER_STATE_PREFERENCE_KEY, stateRef.current)
                        .catch(() => {})
                }
            }
        }
    }, [])

    return { loading, state, setState, patch, reset }
}

export default useReportFilterState
