import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { API_ENDPOINTS } from '../../constants/api'
import {
  getRegisteredGrid,
  getAllRegisteredGrids,
  RegisteredColumn,
} from '../../constants/gridRegistry'
import { gridColumnAccessService, ColumnAccessItemDto } from '../../services/gridColumnAccessService'
import SearchableSelect, { SelectOption } from '../../components/form/SearchableSelect'

// ---------------------------------------------------------------------------
// Super-Admin-only page for defining the ALLOWED COLUMN SET per tenant.
//
// Flow:
//   1. Pick Tenant  (required)
//   2. Pick Grid    (required)
//   3. Tick the columns allowed for that tenant
//
// Whatever the admin saves here becomes the tenant's column ceiling:
//   - Users under the tenant can only see columns the admin allowed.
//   - Within that allowed set, each user can show/hide columns via the
//     in-grid column chooser; their preferences persist per user.
//   - User preferences NEVER widen the allowed set — Super Admin's decision
//     is a hard ceiling enforced in GridColumnAccessService.GetEffectiveForUserAsync.
//
// This page used to also offer a per-user override mode (target a specific
// user, edit their personal column rules). That option was removed because
// it confused tenants who expected admin settings to be tenant-wide.
// Per-user customization now happens exclusively through the in-grid chooser
// driven by the user themselves.
//
// The sentinel GUID `00000000-0000-0000-0000-000000000000` is used as the
// UserId in every save payload — the backend treats that value as
// "tenant-wide" instead of a real user reference.
// ---------------------------------------------------------------------------

const TENANT_DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000'

// Sentinel tenant id for the "Default (all tenants)" entry in the Tenant
// selector. Selecting it lets the admin view + edit the baseline column
// config that applies to any tenant which hasn't overridden the grid. In
// default mode the page talks to the dedicated /default endpoints, which
// read/write the global row in the MAIN DB — it does NOT route by CustomerId.
const DEFAULT_TENANT_SENTINEL_ID = 0
const DEFAULT_TENANT_LABEL = 'Default (all tenants)'

interface Tenant {
  customerId: number
  customerName: string
  email?: string
}

// Per-field state: whether the column is allowed, plus an optional label
// override. Empty `label` = no override (stored as NULL in the backend).
interface FieldState {
  allowed: boolean
  label: string
}
type AccessState = Record<string, FieldState>

const buildDefaultAccess = (
  registeredColumns: RegisteredColumn[],
  savedRules: ColumnAccessItemDto[],
): { state: AccessState; orderedFields: string[] } => {
  const state: AccessState = {}
  const savedMap = new Map(savedRules.map(r => [r.field, r]))
  registeredColumns.forEach(col => {
    const saved = savedMap.get(col.field)
    state[col.field] = {
      allowed: saved ? saved.allowedToView : true,
      label: saved?.displayName ?? '',
    }
  })

  // Compute the initial column order:
  //   1. Columns with a saved SortOrder first, ascending by that number.
  //      Ties (or identical values) resolved by their registered index.
  //   2. Columns without a saved SortOrder preserve their registered order.
  const withIndex = registeredColumns.map((col, idx) => ({
    field: col.field,
    registeredIndex: idx,
    sortOrder: savedMap.get(col.field)?.sortOrder,
  }))
  withIndex.sort((a, b) => {
    const aHas = typeof a.sortOrder === 'number'
    const bHas = typeof b.sortOrder === 'number'
    if (aHas && bHas) {
      if (a.sortOrder! !== b.sortOrder!) return a.sortOrder! - b.sortOrder!
      return a.registeredIndex - b.registeredIndex
    }
    if (aHas) return -1
    if (bHas) return 1
    return a.registeredIndex - b.registeredIndex
  })

  return { state, orderedFields: withIndex.map(x => x.field) }
}

const GridColumnAccessPage: React.FC = () => {
  // ---- Token + auth headers ----------------------------------------------

  const getAuthToken = () => localStorage.getItem('accessToken') || ''

  // ---- Selectors ---------------------------------------------------------

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tenantsLoading, setTenantsLoading] = useState(false)
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null)

  const [selectedGridId, setSelectedGridId] = useState<string | null>(null)

  // ---- Fan-out: copy the same settings to additional tenants -------------
  // The Tenant selector above is the SOURCE we load + edit. These let an
  // admin push that exact column config to other tenants on Save. Saving
  // always includes the source tenant; extras are layered on top.
  const [applyToAll, setApplyToAll] = useState(false)
  const [applyTargetIds, setApplyTargetIds] = useState<number[]>([])
  const [targetSearch, setTargetSearch] = useState('')
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)

  // ---- Column access state ----------------------------------------------

  const [accessState, setAccessState] = useState<AccessState>({})
  const [savedAccessState, setSavedAccessState] = useState<AccessState>({})
  // Current visible order of columns in the checklist. Each entry is a `field`
  // key from the registered columns. Drag-and-drop mutates this list; saving
  // writes each column's SortOrder as its index in the array.
  const [orderedFields, setOrderedFields] = useState<string[]>([])
  const [savedOrderedFields, setSavedOrderedFields] = useState<string[]>([])
  // Which field is currently being dragged (null when not dragging).
  const [draggingField, setDraggingField] = useState<string | null>(null)
  const [accessLoading, setAccessLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastModified, setLastModified] = useState<string | null>(null)

  // ---- UI feedback -------------------------------------------------------

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const flashToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ---- Load tenants once on mount ---------------------------------------

  useEffect(() => {
    const loadTenants = async () => {
      setTenantsLoading(true)
      try {
        const res = await fetch(API_ENDPOINTS.CUSTOMER.GET_ALL_TENANTS, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAuthToken()}`,
          },
        })
        const data = await res.json()
        if (data.isSuccess && Array.isArray(data.response)) {
          setTenants(data.response)
        } else if (Array.isArray(data)) {
          setTenants(data)
        }
      } catch (err) {
        console.error('Failed to load tenants', err)
        flashToast('Failed to load tenants', 'error')
      } finally {
        setTenantsLoading(false)
      }
    }
    loadTenants()
  }, [])

  // (Per-user loading was removed when this page was simplified to
  // tenant-only editing — see the file-top comment block for context.)

  // ---- Load access rules when tenant + grid are both chosen -------------

  const registeredGrid = useMemo(
    () => (selectedGridId ? getRegisteredGrid(selectedGridId) : null),
    [selectedGridId],
  )
  const registeredColumns = registeredGrid?.columns ?? []

  // After simplification this page always edits the tenant-wide default
  // (per-user override mode was removed). Kept as constants here so the
  // backend call sites still read naturally and a future per-user mode
  // could re-introduce real state without rewriting the call sites.
  const effectiveUserId = TENANT_DEFAULT_USER_ID

  // True when the admin is editing the global default config rather than a
  // real tenant. Drives label/behavior differences (no fan-out, different
  // copy). Note: the sentinel id is 0, which is falsy — every guard below
  // uses `== null` rather than `!selectedTenantId` so default mode is honored.
  const isDefaultMode = selectedTenantId === DEFAULT_TENANT_SENTINEL_ID

  useEffect(() => {
    if (selectedTenantId == null || !selectedGridId || registeredColumns.length === 0) {
      setAccessState({})
      setSavedAccessState({})
      setOrderedFields([])
      setSavedOrderedFields([])
      setLastModified(null)
      return
    }
    const loadAccess = async () => {
      setAccessLoading(true)
      try {
        // Default mode reads the global config from the MAIN DB; tenant mode
        // reads the tenant's own config (CustomerId-routed).
        const result = isDefaultMode
          ? await gridColumnAccessService.getDefault(selectedGridId)
          : await gridColumnAccessService.getForUser(
              effectiveUserId,
              selectedGridId,
              selectedTenantId,
            )
        const savedRules = result.response?.columns ?? []
        const { state, orderedFields: initialOrder } = buildDefaultAccess(registeredColumns, savedRules)
        setAccessState(state)
        setSavedAccessState(state)
        setOrderedFields(initialOrder)
        setSavedOrderedFields(initialOrder)
        setLastModified(result.response?.lastModified ?? null)
      } catch (err) {
        console.error('Failed to load column access', err)
        flashToast('Failed to load column access', 'error')
      } finally {
        setAccessLoading(false)
      }
    }
    loadAccess()
  }, [selectedTenantId, isDefaultMode, effectiveUserId, selectedGridId, registeredColumns])

  // ---- Actions ----------------------------------------------------------

  const isDirty = useMemo(() => {
    // Check access state (allowed + label).
    const keys = Object.keys(accessState)
    if (keys.length !== Object.keys(savedAccessState).length) return true
    for (const key of keys) {
      const a = accessState[key]
      const b = savedAccessState[key]
      if (!b || a.allowed !== b.allowed || a.label !== b.label) return true
    }
    // Check column order.
    if (orderedFields.length !== savedOrderedFields.length) return true
    for (let i = 0; i < orderedFields.length; i++) {
      if (orderedFields[i] !== savedOrderedFields[i]) return true
    }
    return false
  }, [accessState, savedAccessState, orderedFields, savedOrderedFields])

  const toggleColumn = (field: string) => {
    setAccessState(prev => ({
      ...prev,
      [field]: { ...prev[field], allowed: !prev[field]?.allowed },
    }))
  }

  const updateLabel = (field: string, label: string) => {
    setAccessState(prev => ({
      ...prev,
      [field]: { ...prev[field], label },
    }))
  }

  const selectAll = () => {
    setAccessState(prev => {
      const next: AccessState = {}
      registeredColumns.forEach(col => {
        next[col.field] = { allowed: true, label: prev[col.field]?.label ?? '' }
      })
      return next
    })
  }

  const deselectAll = () => {
    setAccessState(prev => {
      const next: AccessState = {}
      registeredColumns.forEach(col => {
        // Required fields stay allowed even on bulk-revoke — the backend
        // would reject Create / Update if they were ever hidden.
        next[col.field] = {
          allowed: col.required ? true : false,
          label: prev[col.field]?.label ?? '',
        }
      })
      return next
    })
  }

  // Resolve the full set of tenant ids the save should target. Always
  // includes the source tenant; "All" expands to every loaded tenant.
  const resolveTargetIds = useCallback((): number[] => {
    if (selectedTenantId == null) return []
    // Default mode never fans out — it only writes the single default row.
    if (isDefaultMode) return [DEFAULT_TENANT_SENTINEL_ID]
    if (applyToAll) return tenants.map(t => t.customerId)
    return Array.from(new Set([selectedTenantId, ...applyTargetIds]))
  }, [selectedTenantId, isDefaultMode, applyToAll, applyTargetIds, tenants])

  // Tenants beyond the source that the save will also write to.
  const extraTargetCount = useMemo(() => {
    if (selectedTenantId == null || isDefaultMode) return 0
    if (applyToAll) return Math.max(0, tenants.length - 1)
    return applyTargetIds.filter(id => id !== selectedTenantId).length
  }, [selectedTenantId, isDefaultMode, applyToAll, applyTargetIds, tenants])

  // Write the current column config to every target tenant, in parallel.
  const performSave = useCallback(
    async (targetIds: number[]) => {
      if (!selectedGridId || targetIds.length === 0) return
      setSaving(true)
      try {
        // Build position map from the current ordered list (array index = sortOrder).
        const positionByField = new Map<string, number>()
        orderedFields.forEach((field, idx) => positionByField.set(field, idx))

        const columns: ColumnAccessItemDto[] = Object.entries(accessState).map(
          ([field, state]) => ({
            field,
            allowedToView: state.allowed,
            // Empty / whitespace label -> null ("use default header")
            displayName: state.label.trim() === '' ? null : state.label.trim(),
            sortOrder: positionByField.has(field) ? positionByField.get(field)! : null,
          }),
        )

        // Default mode writes a SINGLE global row to the MAIN DB — never fans
        // out to tenant DBs (CustomerId 0 is not a real tenant).
        if (isDefaultMode) {
          const result = await gridColumnAccessService.saveDefault({
            gridId: selectedGridId,
            columns,
          })
          if (result.isSuccess) {
            setSavedAccessState(accessState)
            setSavedOrderedFields(orderedFields)
            flashToast('Default column settings saved.')
          } else {
            flashToast(result.message || 'Save failed', 'error')
          }
          return
        }

        const results = await Promise.allSettled(
          targetIds.map(id =>
            gridColumnAccessService.save(
              { userId: effectiveUserId, gridId: selectedGridId, columns },
              id,
            ),
          ),
        )

        let ok = 0
        let failed = 0
        results.forEach(r => {
          if (r.status === 'fulfilled' && r.value.isSuccess) ok++
          else failed++
        })

        if (ok > 0) {
          setSavedAccessState(accessState)
          setSavedOrderedFields(orderedFields)
        }
        if (failed === 0) {
          flashToast(
            targetIds.length === 1
              ? 'Tenant column settings saved.'
              : `Settings saved to ${ok} tenants.`,
          )
        } else if (ok > 0) {
          flashToast(`Saved to ${ok} tenant(s); ${failed} failed.`, 'error')
        } else {
          flashToast('Save failed for all selected tenants.', 'error')
        }
      } catch (err) {
        console.error('Save failed', err)
        flashToast('Save failed', 'error')
      } finally {
        setSaving(false)
      }
    },
    [selectedGridId, isDefaultMode, effectiveUserId, accessState, orderedFields],
  )

  const handleSave = useCallback(() => {
    if (selectedTenantId == null || !selectedGridId) return
    const targets = resolveTargetIds()
    // Writing to more than the source tenant overwrites other tenants'
    // settings — confirm before fanning out.
    if (targets.length > 1) {
      setShowApplyConfirm(true)
    } else {
      performSave(targets)
    }
  }, [selectedTenantId, selectedGridId, resolveTargetIds, performSave])

  const handleReset = useCallback(async () => {
    if (selectedTenantId == null || !selectedGridId) return
    setSaving(true)
    try {
      const result = await gridColumnAccessService.reset(
        effectiveUserId,
        selectedGridId,
        selectedTenantId,
      )
      if (result.isSuccess) {
        // Clearing the tenant's overrides makes it inherit the global
        // default. Reload the default config (from the MAIN DB) so the screen
        // shows what the tenant will actually get, instead of "all visible".
        const defaultResult = await gridColumnAccessService.getDefault(selectedGridId)
        const defaultRules = defaultResult.response?.columns ?? []
        const { state, orderedFields: initialOrder } = buildDefaultAccess(
          registeredColumns,
          defaultRules,
        )
        setAccessState(state)
        setSavedAccessState(state)
        setOrderedFields(initialOrder)
        setSavedOrderedFields(initialOrder)
        setLastModified(null)
        flashToast('Tenant reset to default settings.')
      } else {
        flashToast(result.message || 'Reset failed', 'error')
      }
    } catch (err) {
      console.error('Reset failed', err)
      flashToast('Reset failed', 'error')
    } finally {
      setSaving(false)
    }
  }, [selectedTenantId, effectiveUserId, selectedGridId, registeredColumns])

  const handleRevert = () => {
    setAccessState(savedAccessState)
    setOrderedFields(savedOrderedFields)
  }

  const toggleTarget = (id: number) => {
    setApplyTargetIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    )
  }

  // Reset the fan-out selection. Called when the source tenant changes so
  // stale targets (or the new source itself) don't linger in the list.
  const clearApplyTargets = () => {
    setApplyToAll(false)
    setApplyTargetIds([])
    setTargetSearch('')
  }

  // Drag-and-drop reorder handlers for the column cards.
  const handleDragStart = (e: React.DragEvent, field: string) => {
    setDraggingField(field)
    e.dataTransfer.setData('text/plain', field)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, dropTargetField: string) => {
    e.preventDefault()
    const draggedField = e.dataTransfer.getData('text/plain')
    if (!draggedField || draggedField === dropTargetField) {
      setDraggingField(null)
      return
    }
    setOrderedFields(prev => {
      const fromIdx = prev.indexOf(draggedField)
      const toIdx = prev.indexOf(dropTargetField)
      if (fromIdx === -1 || toIdx === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
    setDraggingField(null)
  }

  const handleDragEnd = () => setDraggingField(null)

  // ---- Options lists ----------------------------------------------------

  const tenantOptions: SelectOption[] = useMemo(
    () => [
      // The global default sits at the top so it's the obvious starting point.
      { value: DEFAULT_TENANT_SENTINEL_ID.toString(), label: DEFAULT_TENANT_LABEL },
      ...tenants.map(t => ({ value: t.customerId.toString(), label: t.customerName })),
    ],
    [tenants],
  )

  const sourceTenantName = useMemo(
    () =>
      isDefaultMode
        ? DEFAULT_TENANT_LABEL
        : tenants.find(t => t.customerId === selectedTenantId)?.customerName ?? '',
    [tenants, selectedTenantId, isDefaultMode],
  )

  // Tenants the config can be copied to (everything except the source),
  // filtered by the fan-out search box.
  const otherTenants = useMemo(() => {
    const term = targetSearch.trim().toLowerCase()
    return tenants
      .filter(t => t.customerId !== selectedTenantId)
      .filter(t => (term ? t.customerName.toLowerCase().includes(term) : true))
  }, [tenants, selectedTenantId, targetSearch])

  const gridOptions: SelectOption[] = useMemo(() => {
    // Show every registered grid here — admins should see the full list
    // (including grids whose column metadata hasn't been populated yet)
    // so they can discover what's available and don't think a grid is
    // missing. Empty-columns grids still render in the dropdown; the
    // body just won't show any tickable columns until the registry is
    // filled in for that grid.
    const registered = getAllRegisteredGrids()
    return registered.map(g => ({ value: g.gridId, label: g.label }))
  }, [])

  // ---- Render -----------------------------------------------------------

  const selectedCount = Object.values(accessState).filter(v => v.allowed === true).length
  const totalCount = registeredColumns.length

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Grid Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Define the columns a tenant is allowed to see. Users under the tenant can show or hide
          columns from this allowed set via the in-grid column chooser, but cannot see anything
          outside it.
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* Left: selectors — Tenant → Grid. Per-user override was removed
              when this page was simplified; see the file-top comment. */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                Tenant
              </label>
              <SearchableSelect
                options={tenantOptions}
                value={selectedTenantId?.toString() ?? ''}
                onChange={val => {
                  setSelectedTenantId(val ? parseInt(val, 10) : null)
                  setSelectedGridId(null)
                  clearApplyTargets()
                }}
                placeholder={tenantsLoading ? 'Loading tenants…' : 'Select a tenant'}
                loading={tenantsLoading}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                Grid
              </label>
              <SearchableSelect
                options={gridOptions}
                value={selectedGridId ?? ''}
                onChange={val => setSelectedGridId(val || null)}
                placeholder={selectedTenantId == null ? 'Select a tenant first' : 'Select a grid'}
                disabled={selectedTenantId == null}
              />
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-snug">
                {isDefaultMode
                  ? 'These are the default columns applied to any tenant that has not set its own configuration for this grid.'
                  : 'Settings here apply to every user under this tenant. Within the allowed set each user can still show/hide columns from their own grid chooser.'}
              </p>
            </div>

            {/* Fan-out: copy the same config to additional tenants on Save.
                Hidden in default mode — the default writes a single row. */}
            {selectedTenantId != null && !isDefaultMode && selectedGridId && (
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-1.5">
                  Also apply to
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToAll}
                    onChange={e => {
                      setApplyToAll(e.target.checked)
                      if (e.target.checked) setApplyTargetIds([])
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  All tenants ({tenants.length})
                </label>

                {!applyToAll && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={targetSearch}
                      onChange={e => setTargetSearch(e.target.value)}
                      placeholder="Search tenants…"
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <div className="mt-1.5 max-h-44 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                      {otherTenants.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-center text-gray-400 dark:text-gray-500">
                          {targetSearch ? 'No matches' : 'No other tenants'}
                        </p>
                      ) : (
                        otherTenants.map(t => (
                          <label
                            key={t.customerId}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40"
                          >
                            <input
                              type="checkbox"
                              checked={applyTargetIds.includes(t.customerId)}
                              onChange={() => toggleTarget(t.customerId)}
                              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                            />
                            <span className="truncate">{t.customerName}</span>
                          </label>
                        ))
                      )}
                    </div>
                    {applyTargetIds.length > 0 && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                        {applyTargetIds.length} selected
                        <span className="mx-1.5">·</span>
                        <button
                          type="button"
                          onClick={() => setApplyTargetIds([])}
                          className="text-brand-600 dark:text-brand-400 hover:underline"
                        >
                          Clear
                        </button>
                      </p>
                    )}
                  </div>
                )}

                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 leading-snug">
                  Columns above are loaded from{' '}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {sourceTenantName || 'this tenant'}
                  </span>
                  . Selecting tenants here copies the same configuration to them on Save,
                  overwriting their current settings for this grid.
                </p>
              </div>
            )}

            {lastModified && (
              <p className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                Last saved: {new Date(lastModified).toLocaleString()}
              </p>
            )}
          </div>

          {/* Right: column checklist */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            {selectedTenantId == null || !selectedGridId ? (
              <div className="py-16 text-center text-gray-400 dark:text-gray-500">
                <svg
                  className="w-16 h-16 mx-auto mb-3 opacity-40"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
                <p className="text-sm">Pick a tenant and a grid to manage allowed columns.</p>
                <p className="text-xs mt-1.5">
                  Whatever you allow here is what users under the tenant can choose from in
                  their grid column chooser.
                </p>
              </div>
            ) : registeredColumns.length === 0 ? (
              <div className="py-16 text-center text-gray-400 dark:text-gray-500">
                <p className="text-sm">
                  This grid's column metadata has not been registered yet. Please update{' '}
                  <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-xs">
                    src/constants/gridRegistry.ts
                  </code>{' '}
                  to list the columns.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100 dark:border-gray-700">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {registeredGrid?.label} — Columns
                      </h3>
                      <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        {isDefaultMode ? 'Default Set' : 'Tenant Allowed Set'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {selectedCount} of {totalCount} columns allowed
                      <span className="mx-1.5">·</span>
                      <span className="text-gray-400 dark:text-gray-500">Drag cards to reorder</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-xs font-medium px-2.5 py-1 rounded text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={deselectAll}
                      className="text-xs font-medium px-2.5 py-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {accessLoading ? (
                  <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
                    <p className="mt-3 text-sm">Loading access rules…</p>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {orderedFields.map(fieldKey => {
                      const col = registeredColumns.find(c => c.field === fieldKey)
                      if (!col) return null
                      const state = accessState[col.field] ?? { allowed: true, label: '' }
                      const allowed = state.allowed === true
                      const hasOverride = state.label.trim() !== ''
                      const isBeingDragged = draggingField === col.field
                      return (
                        <div
                          key={col.field}
                          draggable
                          onDragStart={(e) => handleDragStart(e, col.field)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, col.field)}
                          onDragEnd={handleDragEnd}
                          className={`flex flex-col gap-2 p-3 rounded-lg border transition-colors ${
                            isBeingDragged ? 'opacity-40 ring-2 ring-brand-400' : ''
                          } ${
                            allowed
                              ? 'bg-brand-50/40 border-brand-200 dark:bg-brand-900/20 dark:border-brand-700'
                              : 'bg-gray-50 border-gray-200 dark:bg-gray-700/30 dark:border-gray-600'
                          }`}
                        >
                          {/* Top row: drag handle + checkbox + header name */}
                          <div className="flex items-start gap-2">
                            <span
                              className="mt-0.5 text-gray-400 dark:text-gray-500 cursor-grab active:cursor-grabbing select-none"
                              title="Drag to reorder"
                              aria-label="Drag to reorder"
                            >
                              {/* Drag handle (two vertical bars of dots) */}
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <circle cx="7" cy="4" r="1.4" />
                                <circle cx="13" cy="4" r="1.4" />
                                <circle cx="7" cy="10" r="1.4" />
                                <circle cx="13" cy="10" r="1.4" />
                                <circle cx="7" cy="16" r="1.4" />
                                <circle cx="13" cy="16" r="1.4" />
                              </svg>
                            </span>
                            {/* Required-field guard: a column flagged
                                `required` in the registry can never be
                                revoked, because the backend treats it as
                                mandatory and Create / Update would fail.
                                Render the checkbox disabled (forced
                                checked) with a tooltip so the admin
                                understands why. */}
                            <label
                              className={`flex items-start gap-3 flex-1 min-w-0 ${
                                col.required ? 'cursor-not-allowed' : 'cursor-pointer'
                              }`}
                              title={
                                col.required
                                  ? 'Required field — cannot be hidden.'
                                  : undefined
                              }
                            >
                              <input
                                type="checkbox"
                                checked={col.required ? true : allowed}
                                disabled={col.required}
                                onChange={() => {
                                  if (col.required) return
                                  toggleColumn(col.field)
                                }}
                                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-60 disabled:cursor-not-allowed"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                                  {col.headerName}
                                  {col.required && (
                                    <span
                                      className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                      title="Required field"
                                    >
                                      Required
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {col.field}
                                </p>
                                {col.description && (
                                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    {col.description}
                                  </p>
                                )}
                              </div>
                            </label>
                          </div>

                          {/* Bottom row: rename input. Disabled when column is
                              revoked since a hidden column has no label to show. */}
                          <div className="flex items-center gap-2 pl-12">
                            <input
                              type="text"
                              maxLength={100}
                              value={state.label}
                              onChange={(e) => updateLabel(col.field, e.target.value)}
                              placeholder={col.headerName}
                              disabled={!allowed}
                              className={`flex-1 min-w-0 text-xs px-2 py-1 rounded border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                                hasOverride
                                  ? 'border-brand-300 dark:border-brand-600'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}
                              title={
                                !allowed
                                  ? 'Column is hidden — enable it to set a custom label.'
                                  : 'Custom label (leave empty to use the default)'
                              }
                            />
                            {hasOverride && allowed && (
                              <button
                                type="button"
                                onClick={() => updateLabel(col.field, '')}
                                className="text-[11px] text-gray-500 hover:text-red-500"
                                title="Clear custom label"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Footer actions */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  {/* Reset only makes sense for a real tenant — it drops the
                      tenant's overrides so it inherits the default. Hidden in
                      default mode (you're already editing the default). The
                      empty span preserves the justify-between layout. */}
                  {isDefaultMode ? (
                    <span />
                  ) : (
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={saving}
                      className="text-sm px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    >
                      Reset to default
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRevert}
                      disabled={!isDirty || saving}
                      className="text-sm px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={(!isDirty && extraTargetCount === 0) || saving}
                      className="text-sm px-5 py-2 rounded-lg text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving
                        ? 'Saving…'
                        : extraTargetCount > 0
                          ? `Save to ${extraTargetCount + 1} tenants`
                          : 'Save'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Fan-out confirmation */}
      {showApplyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Apply to {extraTargetCount + 1} tenants?
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              The current column configuration for{' '}
              <span className="font-medium">{registeredGrid?.label}</span> will be written to{' '}
              <span className="font-medium">{extraTargetCount + 1}</span> tenants
              {applyToAll ? ' (all tenants)' : ''}. This overwrites their existing settings for
              this grid and cannot be undone in bulk.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowApplyConfirm(false)}
                disabled={saving}
                className="text-sm px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowApplyConfirm(false)
                  performSave(resolveTargetIds())
                }}
                disabled={saving}
                className="text-sm px-5 py-2 rounded-lg text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-50"
              >
                Apply to all selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50 ${
            toast.type === 'success'
              ? 'bg-emerald-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default GridColumnAccessPage
