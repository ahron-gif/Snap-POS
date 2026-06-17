import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  matrixChildrenService,
  MatrixChildDto,
  MatrixChildPatchDto,
  MatrixBulkPriceMode,
} from '../../../services/matrixChildrenService'
import { matrixTemplateService } from '../../../services/matrixTemplateService'
import MatrixGenerateModal from './MatrixGenerateModal'
import MatrixTemplateModal from './MatrixTemplateModal'
import './MatrixEditor.css'

/**
 * Matrix tab editor — port of legacy desktop FrmMatrix.vb.
 *
 * Modes:
 *   • `mode="parent"` — show the full grid of every child variant
 *     with the Default Information toolbar (Cost / Update Cost /
 *     Price / Margin% / Markup% / Update Price), inline-edit per
 *     row, add-child button, delete-row button. Mirrors screenshot 2.
 *   • `mode="child"`  — show only this child's row plus the price /
 *     margin / markup toolbar. Read-only on cost (managed by the
 *     parent's bulk update). Mirrors screenshot 1.
 *
 * Self-contained: handles its own confirm + toast UX so it doesn't
 * depend on the host page's state. No browser dialogs (the project
 * forbids window.confirm / alert per .claude memory).
 */
export interface MatrixEditorProps {
  parentItemId: string
  storeId: string
  mode: 'parent' | 'child'
  /** Only used in mode="child" — to filter the grid down to this row. */
  selfItemStoreId?: string
  /** Optional label override for the Style/Model columns (e.g. "ISBN" for Books). */
  styleNumberLabel?: string
  modelNumberLabel?: string
  /** Hook the host can use to refresh the parent's Cost/Price spinners
   *  after a bulk update completes. */
  onBulkUpdate?: () => void
}

type Toast = { kind: 'success' | 'error' | 'info'; text: string } | null

type Pending =
  | { kind: 'none' }
  | { kind: 'bulkCost'; cost: number }
  | { kind: 'bulkPrice'; mode: MatrixBulkPriceMode; value: number }
  | { kind: 'delete'; itemStoreId: string; rowLabel: string }
  | { kind: 'onHand'; reason: string; rowCount: number }

const fmtMoney = (n: number | null | undefined) =>
  n == null || isNaN(n as number) ? '' : `$${Number(n).toFixed(2)}`
const fmtPct = (n: number | null | undefined) =>
  n == null || isNaN(n as number) ? '' : `${Number(n).toFixed(2)}%`

export default function MatrixEditor({
  parentItemId,
  storeId,
  mode,
  selfItemStoreId,
  styleNumberLabel = 'Style Number',
  modelNumberLabel = 'Model Number',
  onBulkUpdate,
}: MatrixEditorProps) {
  const [children, setChildren] = useState<MatrixChildDto[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)
  const [pending, setPending] = useState<Pending>({ kind: 'none' })
  const [isWriting, setIsWriting] = useState(false)
  // Tracks per-row in-flight PATCH so we can throttle and revert on error
  const inflightPatch = useRef<Set<string>>(new Set())

  // Toolbar input state
  const [bulkCost, setBulkCost] = useState<string>('')
  const [bulkPriceMode, setBulkPriceMode] = useState<MatrixBulkPriceMode>('margin')
  const [bulkPriceValue, setBulkPriceValue] = useState<string>('')

  // On-hand dirty tracking — per-row pending OnHand value. Cleared on
  // successful adjust-onhand POST or after the user discards changes.
  const [dirtyOnHand, setDirtyOnHand] = useState<Record<string, number>>({})
  const [onHandReason, setOnHandReason] = useState<string>('')

  // Phase 2 modals
  const [showGenerate, setShowGenerate] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  // -------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------
  const load = useCallback(async () => {
    if (!parentItemId || !storeId) return
    setIsLoading(true)
    setLoadError(null)
    const result = await matrixChildrenService.listChildren(parentItemId, storeId)
    setIsLoading(false)
    if (!result.isSuccess) {
      setLoadError(result.message || 'Failed to load matrix children.')
      setChildren([])
      return
    }
    setChildren(result.response ?? [])
  }, [parentItemId, storeId])

  useEffect(() => {
    load()
  }, [load])

  const visibleRows = useMemo(() => {
    if (mode === 'parent') return children
    if (selfItemStoreId) return children.filter(c => c.itemStoreID === selfItemStoreId)
    return []
  }, [children, mode, selfItemStoreId])

  const showToast = (kind: 'success' | 'error' | 'info', text: string) => {
    setToast({ kind, text })
    window.setTimeout(() => setToast(null), 4000)
  }

  // -------------------------------------------------------------------
  // Per-cell inline edit — PATCH on blur, optimistic update
  // -------------------------------------------------------------------
  const patchCell = useCallback(
    async (itemStoreId: string, patch: MatrixChildPatchDto) => {
      // Optimistic local update first so the cell doesn't flicker.
      setChildren(prev =>
        prev.map(c =>
          c.itemStoreID === itemStoreId ? { ...c, ...mapPatchToDto(patch, c) } : c,
        ),
      )
      inflightPatch.current.add(itemStoreId)
      const result = await matrixChildrenService.patchChild(itemStoreId, patch)
      inflightPatch.current.delete(itemStoreId)
      if (!result.isSuccess || !result.response) {
        showToast('error', result.message || 'Update failed.')
        // Revert by reloading the full list — cheaper than tracking pre-state
        load()
        return
      }
      // Reconcile with server response (margin/markup recomputed there)
      const server = result.response
      setChildren(prev => prev.map(c => (c.itemStoreID === itemStoreId ? server : c)))
    },
    [load],
  )

  // -------------------------------------------------------------------
  // Bulk actions — staged via Pending so the user sees an inline
  // confirm bar instead of a browser confirm()
  // -------------------------------------------------------------------
  const stageBulkCost = () => {
    const n = parseFloat(bulkCost)
    if (isNaN(n) || n < 0) {
      showToast('error', 'Enter a valid cost (>= 0).')
      return
    }
    if (visibleRows.length === 0) {
      showToast('info', 'No matrix children to update.')
      return
    }
    setPending({ kind: 'bulkCost', cost: n })
  }

  const stageBulkPrice = () => {
    const n = parseFloat(bulkPriceValue)
    if (isNaN(n)) {
      showToast('error', 'Enter a valid price/percent.')
      return
    }
    if (bulkPriceMode === 'margin' && n >= 100) {
      showToast('error', 'Margin must be less than 100%.')
      return
    }
    if (visibleRows.length === 0) {
      showToast('info', 'No matrix children to update.')
      return
    }
    setPending({ kind: 'bulkPrice', mode: bulkPriceMode, value: n })
  }

  const stageDelete = (row: MatrixChildDto) => {
    if (!row.itemStoreID) return
    const label = [row.name, row.barcode].filter(Boolean).join(' — ') || 'this child'
    setPending({ kind: 'delete', itemStoreId: row.itemStoreID, rowLabel: label })
  }

  // ----- On-hand dirty tracking + adjust batch flow -----
  const setOnHandFor = (itemStoreId: string, newValue: number, currentValue: number | null) => {
    setDirtyOnHand(prev => {
      const next = { ...prev }
      // Drop the entry if user reverted to the original — keeps the
      // "Save On Hand" button accurate.
      if (currentValue == null ? newValue === 0 : newValue === currentValue) {
        delete next[itemStoreId]
      } else {
        next[itemStoreId] = newValue
      }
      return next
    })
  }

  const dirtyCount = Object.keys(dirtyOnHand).length

  const stageOnHandAdjust = () => {
    if (dirtyCount === 0) {
      showToast('info', 'No on-hand changes to save.')
      return
    }
    const r = onHandReason.trim()
    if (!r) {
      showToast('error', 'Enter a reason for the on-hand adjustment.')
      return
    }
    setPending({ kind: 'onHand', reason: r, rowCount: dirtyCount })
  }

  const discardOnHandChanges = () => {
    setDirtyOnHand({})
    setOnHandReason('')
    showToast('info', 'On-hand edits discarded.')
  }

  const cancelPending = () => setPending({ kind: 'none' })

  const confirmPending = async () => {
    if (pending.kind === 'none') return
    setIsWriting(true)
    try {
      if (pending.kind === 'bulkCost') {
        const r = await matrixChildrenService.bulkCost(parentItemId, {
          storeId,
          cost: pending.cost,
        })
        if (!r.isSuccess) {
          showToast('error', r.message || 'Bulk cost failed.')
        } else {
          showToast('success', r.message || 'Cost updated.')
          setBulkCost('')
          await load()
          onBulkUpdate?.()
        }
      } else if (pending.kind === 'bulkPrice') {
        const r = await matrixChildrenService.bulkPrice(parentItemId, {
          storeId,
          mode: pending.mode,
          value: pending.value,
        })
        if (!r.isSuccess) {
          showToast('error', r.message || 'Bulk price failed.')
        } else {
          showToast('success', r.message || 'Price updated.')
          setBulkPriceValue('')
          await load()
          onBulkUpdate?.()
        }
      } else if (pending.kind === 'delete') {
        const r = await matrixChildrenService.deleteChild(pending.itemStoreId)
        if (!r.isSuccess) {
          showToast('error', r.message || 'Delete failed.')
        } else {
          showToast('success', 'Matrix child removed.')
          await load()
        }
      } else if (pending.kind === 'onHand') {
        const rows = Object.entries(dirtyOnHand).map(([itemStoreId, newOnHand]) => ({
          itemStoreId,
          newOnHand,
        }))
        const r = await matrixTemplateService.adjustOnHand({ rows, reason: pending.reason })
        if (!r.isSuccess) {
          showToast('error', r.message || 'On-hand adjust failed.')
        } else {
          showToast('success', r.message || 'On-hand updated.')
          setDirtyOnHand({})
          setOnHandReason('')
          await load()
        }
      }
    } finally {
      setIsWriting(false)
      setPending({ kind: 'none' })
    }
  }

  // -------------------------------------------------------------------
  // Add child
  // -------------------------------------------------------------------
  const handleAdd = async () => {
    setIsWriting(true)
    const r = await matrixChildrenService.addChild(parentItemId, { storeId })
    setIsWriting(false)
    if (!r.isSuccess || !r.response) {
      showToast('error', r.message || 'Add failed.')
      return
    }
    showToast('success', 'Child added — edit colour/size below.')
    setChildren(prev => [...prev, r.response!])
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  if (!parentItemId || !storeId) {
    return (
      <div className="matrix-editor matrix-editor--empty">
        Save the parent item first to manage its matrix variants.
      </div>
    )
  }

  return (
    <div className="matrix-editor">
      {toast && (
        <div className={`matrix-toast matrix-toast--${toast.kind}`}>{toast.text}</div>
      )}

      {pending.kind !== 'none' && (
        <div className="matrix-confirm">
          <div className="matrix-confirm__msg">
            {pending.kind === 'bulkCost' &&
              `Update cost to $${pending.cost.toFixed(2)} for ${visibleRows.length} children?`}
            {pending.kind === 'bulkPrice' &&
              (pending.mode === 'absolute'
                ? `Set price to $${pending.value.toFixed(2)} on ${visibleRows.length} children?`
                : `Recompute price using ${pending.mode} ${pending.value}% on ${visibleRows.length} children?`)}
            {pending.kind === 'delete' && `Remove ${pending.rowLabel}?`}
            {pending.kind === 'onHand' &&
              `Save on-hand changes on ${pending.rowCount} rows with reason "${pending.reason}"?`}
          </div>
          <div className="matrix-confirm__actions">
            <button type="button" className="me-btn me-btn--ghost" onClick={cancelPending} disabled={isWriting}>
              Cancel
            </button>
            <button type="button" className="me-btn me-btn--primary" onClick={confirmPending} disabled={isWriting}>
              {isWriting ? 'Working…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* Toolbar — Default Information / bulk update */}
      <div className="matrix-toolbar">
        <div className="matrix-toolbar__group">
          <label>Cost</label>
          <input
            type="number"
            step="0.01"
            value={bulkCost}
            onChange={e => setBulkCost(e.target.value)}
            placeholder="$0.00"
            className="me-input me-input--num"
          />
          <button
            type="button"
            className="me-btn"
            onClick={stageBulkCost}
            disabled={isLoading || isWriting}
          >
            Update Cost
          </button>
        </div>
        <div className="matrix-toolbar__group">
          <label>Price ({bulkPriceMode})</label>
          <select
            className="me-input me-input--select"
            value={bulkPriceMode}
            onChange={e => setBulkPriceMode(e.target.value as MatrixBulkPriceMode)}
          >
            <option value="margin">Margin %</option>
            <option value="markup">Markup %</option>
            <option value="absolute">Absolute $</option>
          </select>
          <input
            type="number"
            step="0.01"
            value={bulkPriceValue}
            onChange={e => setBulkPriceValue(e.target.value)}
            placeholder={bulkPriceMode === 'absolute' ? '$0.00' : '0.00 %'}
            className="me-input me-input--num"
          />
          <button
            type="button"
            className="me-btn"
            onClick={stageBulkPrice}
            disabled={isLoading || isWriting}
          >
            Update Price
          </button>
        </div>
        {mode === 'parent' && (
          <div className="matrix-toolbar__group matrix-toolbar__group--right">
            <button
              type="button"
              className="me-btn"
              onClick={() => setShowTemplates(true)}
              disabled={isWriting}
              title="Manage colour / size templates"
            >
              Templates…
            </button>
            <button
              type="button"
              className="me-btn me-btn--primary"
              onClick={() => setShowGenerate(true)}
              disabled={isWriting}
              title="Bulk-create variants from picked colours × sizes"
            >
              Generate…
            </button>
            <button
              type="button"
              className="me-btn"
              onClick={handleAdd}
              disabled={isWriting}
              title="Add a single blank child"
            >
              + Add child
            </button>
          </div>
        )}
      </div>

      {/* On-hand adjust bar — only shown for the parent grid, and
          only surfaces when the user has staged unsaved OnHand edits.
          Mirrors desktop FrmMatrix.SaveOnHand UX: a single reason
          field applies to every changed row in one batch. */}
      {mode === 'parent' && dirtyCount > 0 && (
        <div className="matrix-toolbar matrix-toolbar--secondary">
          <div className="matrix-toolbar__group">
            <label>{dirtyCount} row{dirtyCount === 1 ? '' : 's'} pending on-hand change</label>
            <input
              type="text"
              value={onHandReason}
              onChange={e => setOnHandReason(e.target.value)}
              placeholder="Reason (required)"
              className="me-input"
              style={{ minWidth: 240 }}
              maxLength={200}
            />
            <button
              type="button"
              className="me-btn me-btn--primary"
              onClick={stageOnHandAdjust}
              disabled={isWriting || !onHandReason.trim()}
            >
              Save On Hand
            </button>
            <button
              type="button"
              className="me-btn me-btn--ghost"
              onClick={discardOnHandChanges}
              disabled={isWriting}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {loadError && <div className="matrix-error">{loadError}</div>}

      <div className="matrix-grid-wrap">
        <table className="matrix-grid">
          <thead>
            <tr>
              <th className="me-col-name">Item Name</th>
              <th className="me-col-bc">Barcode</th>
              <th className="me-col-money">Price</th>
              <th className="me-col-money">Pc Cost</th>
              <th className="me-col-money">Cost</th>
              <th className="me-col-axis">Color</th>
              <th className="me-col-axis">Size</th>
              <th className="me-col-num">On Hand</th>
              <th className="me-col-id">{modelNumberLabel}</th>
              <th className="me-col-id">Link No</th>
              <th className="me-col-id">{styleNumberLabel}</th>
              <th className="me-col-pct">Margin</th>
              <th className="me-col-pct">Markup</th>
              {mode === 'parent' && <th className="me-col-x" />}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={mode === 'parent' ? 14 : 13} className="me-empty">Loading…</td></tr>
            )}
            {!isLoading && visibleRows.length === 0 && (
              <tr>
                <td colSpan={mode === 'parent' ? 14 : 13} className="me-empty">
                  No matrix children yet. {mode === 'parent' && 'Click "+ Add child" to create one.'}
                </td>
              </tr>
            )}
            {!isLoading && visibleRows.map(row => (
              <MatrixRow
                key={row.itemStoreID ?? row.itemID}
                row={row}
                pendingOnHand={row.itemStoreID ? dirtyOnHand[row.itemStoreID] : undefined}
                onPatch={patch => row.itemStoreID && patchCell(row.itemStoreID, patch)}
                onDelete={mode === 'parent' ? () => stageDelete(row) : undefined}
                onOnHandChange={mode === 'parent' && row.itemStoreID
                  ? v => setOnHandFor(row.itemStoreID!, v, row.onHand ?? null)
                  : undefined}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Phase 2 modals */}
      {mode === 'parent' && (
        <MatrixGenerateModal
          isOpen={showGenerate}
          parentItemId={parentItemId}
          storeId={storeId}
          onGenerated={(created, skipped) => {
            showToast('success', `${created} created, ${skipped} skipped.`)
            load()
            onBulkUpdate?.()
          }}
          onClose={() => setShowGenerate(false)}
        />
      )}
      <MatrixTemplateModal
        isOpen={showTemplates}
        onClose={() => setShowTemplates(false)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------
// Single grid row — uncontrolled inputs that commit on blur. Lets the
// user type freely without firing a PATCH per keystroke.
// ---------------------------------------------------------------------
function MatrixRow({
  row,
  pendingOnHand,
  onPatch,
  onDelete,
  onOnHandChange,
}: {
  row: MatrixChildDto
  /** Locally-edited OnHand awaiting batch save; overrides row.onHand for display. */
  pendingOnHand?: number
  onPatch: (patch: MatrixChildPatchDto) => void
  onDelete?: () => void
  /** When undefined, OnHand renders as read-only (e.g. mode="child"). */
  onOnHandChange?: (newValue: number) => void
}) {
  const linkShort = row.linkNo
    ? row.linkNo.length > 18
      ? `${row.linkNo.slice(0, 8)}…${row.linkNo.slice(-6)}`
      : row.linkNo
    : ''

  // Helper: commit a patch only if the value actually changed.
  const commit = <K extends keyof MatrixChildPatchDto>(
    field: K,
    rawValue: string,
    isNum = false,
  ) => {
    const cur = (row as any)[field === 'modelNumber' ? 'modelNumber' : field === 'styleNumber' ? 'styleNumber' : field]
    if (isNum) {
      const num = rawValue === '' ? null : parseFloat(rawValue)
      if (num == null || isNaN(num)) return
      if (Number(cur) === num) return
      onPatch({ [field]: num } as MatrixChildPatchDto)
    } else {
      const v = rawValue === '' ? '' : rawValue
      if ((cur ?? '') === v) return
      onPatch({ [field]: v } as MatrixChildPatchDto)
    }
  }

  return (
    <tr>
      <td>
        <input
          className="me-cell"
          defaultValue={row.name ?? ''}
          onBlur={e => commit('name', e.target.value)}
        />
      </td>
      <td>
        <input
          className="me-cell"
          defaultValue={row.barcode ?? ''}
          onBlur={e => commit('barcode', e.target.value)}
        />
      </td>
      <td>
        <input
          className="me-cell me-cell--num"
          type="number"
          step="0.01"
          defaultValue={row.price ?? ''}
          onBlur={e => commit('price', e.target.value, true)}
        />
      </td>
      <td className="me-readonly">{fmtMoney(row.pcCost)}</td>
      <td>
        <input
          className="me-cell me-cell--num"
          type="number"
          step="0.01"
          defaultValue={row.cost ?? ''}
          onBlur={e => commit('cost', e.target.value, true)}
        />
      </td>
      <td>
        <input
          className="me-cell"
          defaultValue={row.color ?? ''}
          onBlur={e => commit('color', e.target.value)}
        />
      </td>
      <td>
        <input
          className="me-cell"
          defaultValue={row.size ?? ''}
          onBlur={e => commit('size', e.target.value)}
        />
      </td>
      <td className={pendingOnHand !== undefined ? 'me-cell--dirty' : ''}>
        {onOnHandChange ? (
          <input
            className="me-cell me-cell--num"
            type="number"
            step="1"
            value={pendingOnHand !== undefined ? pendingOnHand : (row.onHand ?? 0)}
            onChange={e => {
              const n = parseFloat(e.target.value)
              if (!isNaN(n)) onOnHandChange(n)
            }}
            title={pendingOnHand !== undefined
              ? `Pending: was ${row.onHand ?? 0}, will be ${pendingOnHand} (use Save On Hand to commit)`
              : 'Edit to stage an on-hand adjustment'}
          />
        ) : (
          <span className="me-readonly me-cell--num">{row.onHand ?? 0}</span>
        )}
      </td>
      <td>
        <input
          className="me-cell"
          defaultValue={row.modelNumber ?? ''}
          onBlur={e => commit('modelNumber', e.target.value)}
        />
      </td>
      <td className="me-readonly me-mono" title={row.linkNo ?? ''}>{linkShort}</td>
      <td>
        <input
          className="me-cell"
          defaultValue={row.styleNumber ?? ''}
          onBlur={e => commit('styleNumber', e.target.value)}
        />
      </td>
      <td className="me-readonly">{fmtPct(row.margin)}</td>
      <td className="me-readonly">{fmtPct(row.markup)}</td>
      {onDelete && (
        <td>
          <button type="button" className="me-row-x" onClick={onDelete} title="Remove">
            ×
          </button>
        </td>
      )}
    </tr>
  )
}

// ---------------------------------------------------------------------
// Helper: map a patch back into a DTO-shaped partial so the optimistic
// update reflects what the user just typed (server reply will reconcile).
// ---------------------------------------------------------------------
function mapPatchToDto(patch: MatrixChildPatchDto, current: MatrixChildDto): Partial<MatrixChildDto> {
  const out: Partial<MatrixChildDto> = {}
  if (patch.name !== undefined) out.name = patch.name
  if (patch.barcode !== undefined) out.barcode = patch.barcode
  if (patch.modelNumber !== undefined) out.modelNumber = patch.modelNumber
  if (patch.styleNumber !== undefined) out.styleNumber = patch.styleNumber
  if (patch.color !== undefined) out.color = patch.color
  if (patch.size !== undefined) out.size = patch.size
  if (patch.cost !== undefined) out.cost = patch.cost
  if (patch.specialCost !== undefined) out.specialCost = patch.specialCost
  if (patch.price !== undefined) out.price = patch.price
  // Recompute margin/markup client-side so the row updates immediately
  const cost = patch.cost ?? current.cost
  const price = patch.price ?? current.price
  if (price != null && price !== 0 && cost != null) {
    out.margin = Math.round((price - cost) * 100 / price * 100) / 100
  }
  if (cost != null && cost !== 0 && price != null) {
    out.markup = Math.round((price - cost) * 100 / cost * 100) / 100
  }
  return out
}
