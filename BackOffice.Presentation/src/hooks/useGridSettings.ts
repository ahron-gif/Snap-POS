import { useState, useCallback, useEffect, useRef } from "react"
import { gridSettingsService, ColumnSettingDto } from "../services/gridSettingsService"
import { gridColumnAccessService } from "../services/gridColumnAccessService"
import {
  GRID_SETTINGS_RESET_EVENT,
  type GridSettingsResetDetail,
} from "../components/common/ServerGrid/gridSettingsEvents"

// Aggregate type definition
export type AggregateType = "sum" | "min" | "max" | "count" | "average" | "none"

// Interface for column settings that will be persisted
export interface ColumnSettings {
  field: string
  visible: boolean
  width: number
  aggregateType?: AggregateType
}

// Interface for the complete grid settings
export interface GridSettings {
  columns: ColumnSettings[]
  lastModified: number
}

// Debounce delay for saving settings (ms)
const SAVE_DEBOUNCE_DELAY = 1000

// ServerGrid injects a synthetic "actions" column (and may use "__"-prefixed
// placeholder fields). These are not real grid columns and must never be
// persisted — otherwise they round-trip into the saved settings and get
// re-injected on top of the freshly-added one, producing duplicate columns.
const isPersistableColumn = (field: string): boolean =>
  field !== "actions" && !field.startsWith("__")

/**
 * Hook to persist and retrieve grid column settings (visibility, width) from the database via API.
 * Settings are stored per grid per user using a unique gridId.
 *
 * @param gridId - Unique identifier for the grid (e.g., "items-list-grid", "users-list-grid")
 * @param defaultColumns - Default column definitions to use if no settings are stored
 * @returns Object containing columns with applied settings and functions to update them
 */
export function useGridSettings<T extends { field: string; width?: number; visible?: boolean }>(
  gridId: string,
  defaultColumns: T[]
) {
  // State for columns with settings applied
  const [columns, setColumns] = useState<T[]>(() => {
    // Initialize with defaults (will be updated once API response comes back)
    return defaultColumns.map(col => ({
      ...col,
      visible: col.visible !== false,
      width: col.width || 95,
    }))
  })

  // State for column aggregates
  const [columnAggregates, setColumnAggregates] = useState<Map<string, AggregateType>>(new Map())

  // Loading state
  const [isLoading, setIsLoading] = useState(true)

  // Track if settings have been loaded from API
  const settingsLoadedRef = useRef(false)

  // Debounce timer ref for saving
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Track the last saved settings to avoid unnecessary API calls
  const lastSavedSettingsRef = useRef<string>("")

  // Ref to hold save function to avoid stale closures in setTimeout
  const saveSettingsRef = useRef<((cols: T[], aggregates: Map<string, AggregateType>) => Promise<void>) | null>(null)

  // Merge saved settings with default columns and extract aggregates
  const mergeSettingsWithColumns = useCallback((
    cols: T[],
    savedColumns: ColumnSettingDto[] | null
  ): { columns: T[], aggregates: Map<string, AggregateType> } => {
    const aggregates = new Map<string, AggregateType>()

    console.log(`[GridSettings] mergeSettingsWithColumns: savedColumns =`, savedColumns)

    if (!savedColumns || savedColumns.length === 0) {
      console.log(`[GridSettings] No saved columns, returning defaults`)
      return {
        columns: cols.map(col => ({
          ...col,
          visible: col.visible !== false,
          width: col.width || 95,
        })),
        aggregates
      }
    }

    // Create a map of saved settings by field
    const savedMap = new Map(
      savedColumns.map(col => [col.field, col])
    )

    // Extract aggregates from saved settings
    savedColumns.forEach(col => {
      console.log(`[GridSettings] Column ${col.field}: aggregateType =`, col.aggregateType)
      if (col.aggregateType && col.aggregateType !== "none") {
        aggregates.set(col.field, col.aggregateType as AggregateType)
        console.log(`[GridSettings] Added aggregate for ${col.field}: ${col.aggregateType}`)
      }
    })

    console.log(`[GridSettings] Final aggregates map:`, Array.from(aggregates.entries()))

    // Apply saved settings to columns.
    // Width may come back as 0/undefined when there's no per-column width
    // override (the unified UserGridColumnAccess store treats width as
    // optional and the shim resolves null → 0). In that case keep the
    // column's natural width — never let width collapse to 0 here.
    const mergedColumns = cols.map(col => {
      const saved = savedMap.get(col.field)
      if (saved) {
        return {
          ...col,
          visible: saved.visible,
          width: saved.width || (col as { width?: number }).width || 95,
        }
      }
      // New column not in saved settings - use defaults
      return {
        ...col,
        visible: col.visible !== false,
        width: col.width || 95,
      }
    })

    // Restore the user's saved column ORDER. The persisted array order is the
    // source of truth for ordering; columns not present in the saved set (newly
    // added to the grid since the user last saved) keep their default relative
    // position and sort to the end. Without this, a user's drag-reorder is lost
    // on every settings reload / page refresh because we'd fall back to the
    // default column order.
    const savedOrder = new Map(savedColumns.map((c, i) => [c.field, i]))
    const orderedColumns = mergedColumns
      .map((col, defaultIndex) => ({ col, defaultIndex }))
      .sort((a, b) => {
        const ai = savedOrder.has(a.col.field) ? savedOrder.get(a.col.field)! : Number.MAX_SAFE_INTEGER
        const bi = savedOrder.has(b.col.field) ? savedOrder.get(b.col.field)! : Number.MAX_SAFE_INTEGER
        if (ai !== bi) return ai - bi
        return a.defaultIndex - b.defaultIndex
      })
      .map(entry => entry.col)

    return { columns: orderedColumns, aggregates }
  }, [])

  // Helper to create a normalized hash from columns and aggregates
  const createSettingsHash = useCallback((cols: T[], aggregates: Map<string, AggregateType>) => {
    const normalized = cols.filter(col => isPersistableColumn(col.field)).map(col => {
      const aggregateType = aggregates.get(col.field)
      return {
        field: col.field,
        visible: (col as any).visible !== false,
        width: (col as any).width || 95,
        ...(aggregateType && aggregateType !== "none" ? { aggregateType } : {})
      }
    })
    return JSON.stringify(normalized)
  }, [])

  // Load settings from API
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true)
      console.log(`[GridSettings] Loading settings for ${gridId}...`)
      const result = await gridSettingsService.getGridSettings(gridId)
      console.log(`[GridSettings] API response:`, result)

      if (result.isSuccess && result.response) {
        console.log(`[GridSettings] Saved columns from API:`, result.response.columns)
        const { columns: mergedColumns, aggregates } = mergeSettingsWithColumns(defaultColumns, result.response.columns)
        console.log(`[GridSettings] Extracted aggregates:`, Array.from(aggregates.entries()))
        setColumns(mergedColumns)
        setColumnAggregates(aggregates)
        // Store the initial settings hash in the same format we use for saving
        lastSavedSettingsRef.current = createSettingsHash(mergedColumns, aggregates)
      } else {
        console.log(`[GridSettings] No settings found, using defaults`)
        // No settings found, use defaults
        const { columns: mergedColumns, aggregates } = mergeSettingsWithColumns(defaultColumns, null)
        setColumns(mergedColumns)
        setColumnAggregates(aggregates)
        lastSavedSettingsRef.current = ""
      }
      settingsLoadedRef.current = true
    } catch (error) {
      console.warn(`Failed to load grid settings for ${gridId}:`, error)
      // On error, use defaults
      const { columns: mergedColumns, aggregates } = mergeSettingsWithColumns(defaultColumns, null)
      setColumns(mergedColumns)
      setColumnAggregates(aggregates)
      settingsLoadedRef.current = true
    } finally {
      setIsLoading(false)
    }
  }, [gridId, defaultColumns, mergeSettingsWithColumns, createSettingsHash])

  // Save settings to API (direct call, not memoized to avoid stale closures)
  const saveSettingsToApi = async (cols: T[], aggregates: Map<string, AggregateType>) => {
    console.log(`[GridSettings] saveSettingsToApi called with aggregates:`, Array.from(aggregates.entries()))

    const settingsToSave: ColumnSettingDto[] = cols.filter(col => isPersistableColumn(col.field)).map(col => {
      const aggregateType = aggregates.get(col.field)
      return {
        field: col.field,
        visible: (col as any).visible !== false,
        width: (col as any).width || 95,
        // Only include aggregateType if it's set and not "none"
        ...(aggregateType && aggregateType !== "none" ? { aggregateType } : {})
      }
    })

    // Check if settings actually changed (use the same hash format as loadSettings)
    const settingsHash = JSON.stringify(settingsToSave)

    console.log(`[GridSettings] Current hash (first 200 chars):`, settingsHash.substring(0, 200))
    console.log(`[GridSettings] Last saved hash (first 200 chars):`, lastSavedSettingsRef.current.substring(0, 200))

    if (settingsHash === lastSavedSettingsRef.current) {
      console.log(`[GridSettings] No changes detected, skipping save`)
      return // No changes, skip save
    }

    console.log(`[GridSettings] Saving to API...`)

    try {
      const result = await gridSettingsService.saveGridSettings({
        gridId,
        columns: settingsToSave,
      })

      if (result.isSuccess) {
        console.log(`[GridSettings] Save successful`)
        lastSavedSettingsRef.current = settingsHash
      } else {
        console.warn(`Failed to save grid settings for ${gridId}:`, result.message)
      }
    } catch (error) {
      console.warn(`Error saving grid settings for ${gridId}:`, error)
    }
  }

  // Store the save function in a ref to always have latest version
  saveSettingsRef.current = saveSettingsToApi

  // Debounced save function - uses ref to avoid stale closure
  const debouncedSave = useCallback((cols: T[], aggregates: Map<string, AggregateType>) => {
    console.log(`[GridSettings] debouncedSave called with aggregates:`, Array.from(aggregates.entries()))

    // Clear any existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    // Set new timer - use ref to get latest save function
    saveTimerRef.current = setTimeout(() => {
      console.log(`[GridSettings] Timer fired, calling saveSettingsRef.current`)
      if (saveSettingsRef.current) {
        saveSettingsRef.current(cols, aggregates)
      }
    }, SAVE_DEBOUNCE_DELAY)
  }, []) // No dependencies needed since we use ref

  // Load settings on mount
  useEffect(() => {
    loadSettings()

    // Cleanup timer on unmount
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [loadSettings])

  // Listen for the in-grid "Reset to Default" event (dispatched by ServerGrid
  // after the user confirms a reset) and for the visibility-change refresh
  // event. Both should re-pull the effective settings so the UI snaps to the
  // current server state without a page reload.
  useEffect(() => {
    const handleReset = (e: Event) => {
      const detail = (e as CustomEvent<GridSettingsResetDetail>).detail
      if (!detail || detail.gridId !== gridId) return
      console.log(`[GridSettings] reset event received for ${gridId} (${detail.reason}); reloading.`)
      // Clear the "last saved hash" so the next change definitely triggers a
      // save (otherwise stale-hash comparison can suppress legitimate writes
      // right after a reset).
      lastSavedSettingsRef.current = ""
      loadSettings()
    }
    window.addEventListener(GRID_SETTINGS_RESET_EVENT, handleReset)
    return () => window.removeEventListener(GRID_SETTINGS_RESET_EVENT, handleReset)
  }, [gridId, loadSettings])

  // ---------------------------------------------------------------------------
  // Req 5: refresh on tab return if effective settings changed server-side.
  //
  // Cache the server-side version (max DateModified across rows that affect
  // this user for this grid). On document.visibilitychange (visible), call
  // the cheap version endpoint; if it differs from the cached value, dispatch
  // the unified reset event so the existing handler above re-pulls + the UI
  // snaps. Avoids polling while the tab is hidden; one HTTP round-trip per
  // visibility flip; coalesces concurrent checks.
  // ---------------------------------------------------------------------------

  const cachedVersionRef = useRef<string | null>(null)
  const versionCheckInFlightRef = useRef(false)

  // Seed the cached version once on mount (and refresh it whenever loadSettings
  // runs). We use a separate call to the version endpoint because the shim
  // strips null lastModified values; the raw version endpoint preserves them.
  useEffect(() => {
    let cancelled = false
    const seedVersion = async () => {
      const result = await gridColumnAccessService.getMineVersion(gridId)
      if (cancelled) return
      if (result.isSuccess) {
        cachedVersionRef.current = result.response ?? null
      }
    }
    seedVersion()
    return () => { cancelled = true }
  }, [gridId])

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return
      if (versionCheckInFlightRef.current) return
      versionCheckInFlightRef.current = true
      try {
        const result = await gridColumnAccessService.getMineVersion(gridId)
        if (!result.isSuccess) return
        const serverVersion = result.response ?? null
        if (serverVersion === cachedVersionRef.current) return
        // Server-side changed while we were away — update cache then trigger
        // the same handler the user-reset path uses, so behavior stays uniform.
        console.log(
          `[GridSettings] version bump detected for ${gridId} ` +
          `(cached=${cachedVersionRef.current} server=${serverVersion}); refetching.`
        )
        cachedVersionRef.current = serverVersion
        const detail: GridSettingsResetDetail = { gridId, reason: "version-bump" }
        window.dispatchEvent(new CustomEvent(GRID_SETTINGS_RESET_EVENT, { detail }))
      } finally {
        versionCheckInFlightRef.current = false
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [gridId])

  // Save settings whenever columns or aggregates change (after initial load)
  useEffect(() => {
    console.log(`[GridSettings] useEffect triggered: settingsLoaded=${settingsLoadedRef.current}, aggregates=`, Array.from(columnAggregates.entries()))
    if (settingsLoadedRef.current) {
      console.log(`[GridSettings] Calling debouncedSave`)
      debouncedSave(columns, columnAggregates)
    }
  }, [columns, columnAggregates, debouncedSave])

  // Update column visibility
  const updateColumnVisibility = useCallback((field: string, visible: boolean) => {
    setColumns(prev =>
      prev.map(col =>
        col.field === field ? { ...col, visible } : col
      )
    )
  }, [])

  // Update column width
  const updateColumnWidth = useCallback((field: string, width: number) => {
    setColumns(prev =>
      prev.map(col =>
        col.field === field ? { ...col, width } : col
      )
    )
  }, [])

  // Update multiple column settings at once
  const updateColumns = useCallback((updates: Partial<ColumnSettings>[]) => {
    setColumns(prev => {
      const updateMap = new Map(updates.map(u => [u.field, u]))
      return prev.map(col => {
        const update = updateMap.get(col.field)
        if (update) {
          return {
            ...col,
            ...(update.visible !== undefined && { visible: update.visible }),
            ...(update.width !== undefined && { width: update.width }),
          }
        }
        return col
      })
    })
  }, [])

  // Update column aggregate - saves immediately without debounce
  const updateColumnAggregate = useCallback((field: string, aggregateType: AggregateType) => {
    console.log(`[GridSettings] updateColumnAggregate called: field=${field}, type=${aggregateType}`)

    // Create new aggregates map
    const newAggregates = new Map(columnAggregates)
    if (aggregateType === "none") {
      newAggregates.delete(field)
    } else {
      newAggregates.set(field, aggregateType)
    }

    // Update state
    setColumnAggregates(newAggregates)

    // Save immediately (bypass debounce for aggregate changes)
    if (saveSettingsRef.current) {
      console.log(`[GridSettings] Saving aggregates immediately`)
      saveSettingsRef.current(columns, newAggregates)
    }
  }, [columns, columnAggregates])

  // Reset to default settings
  const resetToDefaults = useCallback(async () => {
    const resetColumns = defaultColumns.map(col => ({
      ...col,
      visible: col.visible !== false,
      width: col.width || 95,
    }))
    setColumns(resetColumns)
    setColumnAggregates(new Map()) // Clear all aggregates

    // Delete settings from API
    try {
      await gridSettingsService.deleteGridSettings(gridId)
      lastSavedSettingsRef.current = ""
    } catch (error) {
      console.warn(`Failed to delete grid settings for ${gridId}:`, error)
    }
  }, [defaultColumns, gridId])

  // Clear saved settings for this grid (same as resetToDefaults for API version)
  const clearSavedSettings = useCallback(async () => {
    await resetToDefaults()
  }, [resetToDefaults])

  return {
    columns,
    setColumns,
    updateColumnVisibility,
    updateColumnWidth,
    updateColumns,
    columnAggregates,
    updateColumnAggregate,
    resetToDefaults,
    clearSavedSettings,
    isLoading,
  }
}

/**
 * Utility function to clear all grid settings from the database
 */
export async function clearAllGridSettings(): Promise<void> {
  try {
    await gridSettingsService.deleteAllGridSettings()
  } catch (error) {
    console.warn("Failed to clear all grid settings:", error)
  }
}
