import { useCallback, useEffect, useRef, useState } from "react"
import { userPreferenceService } from "../services/userPreferenceService"

/**
 * Layout state for the Item Form's collapsible cards.
 * - `columns`: one string[] per visual column; supports cross-column drag.
 * - `collapsed`: per-section collapsed flag.
 * - `order` is kept for backward compatibility with previously-persisted
 *   v1 state. Not authoritative — `columns` is.
 */
export interface SectionLayoutState {
    collapsed: Record<string, boolean>
    columns: string[][]
    order?: string[]
}

const PREF_KEY = "itemForm.sectionLayout.v1"
const LOCAL_FALLBACK_KEY = "rdt.itemForm.sectionLayout.v1"

const cloneColumns = (cols: string[][]) => cols.map(c => [...c])

const sectionsInColumns = (cols: string[][]) => {
    const seen = new Set<string>()
    for (const col of cols) for (const id of col) seen.add(id)
    return seen
}

/**
 * Build a normalised columns array from any persisted layout plus the
 * caller's defaults. Sections in the persisted layout that no longer exist
 * are dropped; new sections that aren't in the persisted layout are
 * appended to their default-column home.
 */
const reconcileColumns = (
    persisted: string[][] | undefined,
    defaults: string[][],
): string[][] => {
    const defaultIds = sectionsInColumns(defaults)
    const out: string[][] = defaults.map(() => [])
    if (persisted && persisted.length > 0) {
        const colCount = Math.max(persisted.length, defaults.length)
        for (let c = 0; c < colCount; c++) {
            const src = persisted[c] || []
            const filtered = src.filter(id => defaultIds.has(id))
            // Bound to actual columns (e.g. persisted had 4 cols but
            // caller now only renders 3 — overflow merges into the last col).
            const targetCol = Math.min(c, out.length - 1)
            for (const id of filtered) out[targetCol].push(id)
        }
    }
    // Append any defaults that the persisted layout didn't include.
    const placed = sectionsInColumns(out)
    for (let c = 0; c < defaults.length; c++) {
        for (const id of defaults[c]) {
            if (!placed.has(id)) out[c].push(id)
        }
    }
    return out
}

const isEqualState = (a: SectionLayoutState, b: SectionLayoutState) =>
    JSON.stringify({ collapsed: a.collapsed, columns: a.columns }) ===
    JSON.stringify({ collapsed: b.collapsed, columns: b.columns })

export function useItemSectionLayout(defaultColumns: string[][]) {
    const defaultsRef = useRef(defaultColumns)
    defaultsRef.current = defaultColumns

    const [state, setState] = useState<SectionLayoutState>(() => ({
        collapsed: {},
        columns: cloneColumns(defaultColumns),
    }))
    const [loaded, setLoaded] = useState(false)
    const saveTimer = useRef<number | null>(null)
    const lastPersisted = useRef<SectionLayoutState>({ collapsed: {}, columns: cloneColumns(defaultColumns) })

    useEffect(() => {
        let cancelled = false

        const hydrate = async () => {
            let parsed: any = null
            try {
                const local = localStorage.getItem(LOCAL_FALLBACK_KEY)
                if (local) parsed = JSON.parse(local)
            } catch {
                // ignore
            }

            try {
                const result = await userPreferenceService.getPreference(PREF_KEY)
                if (result.isSuccess && result.response?.preferenceValue) {
                    parsed = JSON.parse(result.response.preferenceValue)
                }
            } catch {
                // Network failure is fine; we use local fallback.
            }

            if (cancelled) return

            const defaults = defaultsRef.current
            let columns: string[][]
            if (parsed && Array.isArray(parsed.columns)) {
                columns = reconcileColumns(parsed.columns as string[][], defaults)
            } else if (parsed && Array.isArray(parsed.order)) {
                // v1 fallback: round-trip a flat order through the default
                // column homes so previously-saved within-column ordering is
                // preserved.
                const order: string[] = parsed.order
                const homeOf = new Map<string, number>()
                defaults.forEach((col, idx) => col.forEach(id => homeOf.set(id, idx)))
                const seeded: string[][] = defaults.map(() => [])
                for (const id of order) {
                    const home = homeOf.get(id)
                    if (home !== undefined) seeded[home].push(id)
                }
                columns = reconcileColumns(seeded, defaults)
            } else {
                columns = cloneColumns(defaults)
            }

            const next: SectionLayoutState = {
                collapsed: (parsed && parsed.collapsed) || {},
                columns,
            }
            lastPersisted.current = next
            setState(next)
            setLoaded(true)
        }

        hydrate()
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const persist = useCallback((next: SectionLayoutState) => {
        if (saveTimer.current) window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => {
            const payload = { collapsed: next.collapsed, columns: next.columns }
            try {
                localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(payload))
            } catch {
                // ignore quota
            }
            userPreferenceService.savePreference(PREF_KEY, payload).catch(() => {
                // Backend unavailable — localStorage already saved.
            })
            lastPersisted.current = next
        }, 400)
    }, [])

    const setCollapsed = useCallback(
        (sectionId: string, collapsed: boolean) => {
            setState(prev => {
                const next: SectionLayoutState = {
                    ...prev,
                    collapsed: { ...prev.collapsed, [sectionId]: collapsed },
                }
                if (!isEqualState(next, lastPersisted.current)) persist(next)
                return next
            })
        },
        [persist],
    )

    const toggle = useCallback(
        (sectionId: string) => {
            setState(prev => {
                const next: SectionLayoutState = {
                    ...prev,
                    collapsed: {
                        ...prev.collapsed,
                        [sectionId]: !prev.collapsed[sectionId],
                    },
                }
                if (!isEqualState(next, lastPersisted.current)) persist(next)
                return next
            })
        },
        [persist],
    )

    const setColumns = useCallback(
        (columns: string[][]) => {
            setState(prev => {
                const next: SectionLayoutState = { ...prev, columns }
                if (!isEqualState(next, lastPersisted.current)) persist(next)
                return next
            })
        },
        [persist],
    )

    /**
     * Move `sourceId` to sit at `targetId`'s position, possibly into a
     * different column. The card drops *into* the target's slot; the
     * target and everything after it shifts down by one.
     */
    const reorderByDrag = useCallback(
        (sourceId: string, targetId: string) => {
            if (sourceId === targetId) return
            setState(prev => {
                const columns = cloneColumns(prev.columns)
                let sourceCol = -1, sourcePos = -1
                let targetCol = -1, targetPos = -1
                for (let c = 0; c < columns.length; c++) {
                    const si = columns[c].indexOf(sourceId)
                    if (si >= 0) { sourceCol = c; sourcePos = si }
                    const ti = columns[c].indexOf(targetId)
                    if (ti >= 0) { targetCol = c; targetPos = ti }
                }
                if (sourceCol < 0 || targetCol < 0) return prev
                // Pull source out first.
                columns[sourceCol].splice(sourcePos, 1)
                // If source was in the same column and before the target,
                // removing it shifts the target up by one.
                let insertPos = targetPos
                if (sourceCol === targetCol && sourcePos < targetPos) insertPos -= 1
                columns[targetCol].splice(insertPos, 0, sourceId)
                const next: SectionLayoutState = { ...prev, columns }
                if (!isEqualState(next, lastPersisted.current)) persist(next)
                return next
            })
        },
        [persist],
    )

    /**
     * Drop a section at the *end* of a column — used when the user releases
     * over empty space in a column rather than over a specific target card.
     */
    const moveToColumnEnd = useCallback(
        (sourceId: string, targetColumn: number) => {
            setState(prev => {
                if (targetColumn < 0 || targetColumn >= prev.columns.length) return prev
                const columns = cloneColumns(prev.columns)
                let sourceCol = -1, sourcePos = -1
                for (let c = 0; c < columns.length; c++) {
                    const si = columns[c].indexOf(sourceId)
                    if (si >= 0) { sourceCol = c; sourcePos = si; break }
                }
                if (sourceCol < 0) return prev
                if (sourceCol === targetColumn && sourcePos === columns[targetColumn].length - 1) return prev
                columns[sourceCol].splice(sourcePos, 1)
                columns[targetColumn].push(sourceId)
                const next: SectionLayoutState = { ...prev, columns }
                if (!isEqualState(next, lastPersisted.current)) persist(next)
                return next
            })
        },
        [persist],
    )

    return {
        collapsed: state.collapsed,
        columns: state.columns,
        loaded,
        setCollapsed,
        toggle,
        setColumns,
        reorderByDrag,
        moveToColumnEnd,
    }
}
