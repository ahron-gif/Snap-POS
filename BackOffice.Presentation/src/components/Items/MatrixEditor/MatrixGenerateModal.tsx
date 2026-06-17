import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../../ui/modal'
import {
  matrixTemplateService,
  MatrixTemplateDto,
  MatrixValueDto,
  MatrixAxis,
} from '../../../services/matrixTemplateService'

/**
 * Matrix Generate modal — port of legacy desktop FrmMatrix's
 * "create children" flow. Lets the user pick a template (or work
 * template-free), tick the colour + size values to spread across,
 * and preview the cross-product before committing.
 *
 * On confirm calls POST /api/Items/{parentId}/matrix-children/generate;
 * the backend skips combos that already exist as active children.
 *
 * Self-contained: imports its own services, owns its loading/save
 * state, surfaces errors inline. The host (MatrixEditor) just
 * opens / closes and refreshes its grid on close.
 */
export interface MatrixGenerateModalProps {
  isOpen: boolean
  parentItemId: string
  storeId: string
  /** Called after a successful generate so the parent can re-load its grid. */
  onGenerated: (created: number, skipped: number) => void
  onClose: () => void
}

type Toast = { kind: 'success' | 'error' | 'info'; text: string } | null

export default function MatrixGenerateModal({
  isOpen,
  parentItemId,
  storeId,
  onGenerated,
  onClose,
}: MatrixGenerateModalProps) {
  const [templates, setTemplates] = useState<MatrixTemplateDto[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [pickedColors, setPickedColors] = useState<Set<string>>(new Set())
  const [pickedSizes, setPickedSizes] = useState<Set<string>>(new Set())
  const [adhocColor, setAdhocColor] = useState('')
  const [adhocSize, setAdhocSize] = useState('')
  const [adhocColors, setAdhocColors] = useState<string[]>([])
  const [adhocSizes, setAdhocSizes] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [assignTemplate, setAssignTemplate] = useState(true)
  const [toast, setToast] = useState<Toast>(null)

  const selectedTemplate = templates.find(t => t.matrixTableID === selectedTemplateId)

  // Reset state when modal opens
  useEffect(() => {
    if (!isOpen) return
    setSelectedTemplateId('')
    setPickedColors(new Set())
    setPickedSizes(new Set())
    setAdhocColor('')
    setAdhocSize('')
    setAdhocColors([])
    setAdhocSizes([])
    setAssignTemplate(true)
    setToast(null)
  }, [isOpen])

  // Load templates on open
  useEffect(() => {
    if (!isOpen) return
    setIsLoading(true)
    matrixTemplateService.listTemplates().then(r => {
      setIsLoading(false)
      if (!r.isSuccess) {
        setToast({ kind: 'error', text: r.message || 'Failed to load templates.' })
        return
      }
      setTemplates(r.response ?? [])
    })
  }, [isOpen])

  const showToast = (kind: 'success' | 'error' | 'info', text: string) => {
    setToast({ kind, text })
    window.setTimeout(() => setToast(null), 4000)
  }

  // -------------------- Add inline value into template --------------------
  const addInlineValue = async (axis: MatrixAxis, displayValue: string) => {
    const trimmed = displayValue.trim()
    if (!trimmed) return
    if (!selectedTemplateId) {
      // No template chosen — add to ad-hoc list only.
      if (axis === 'color') {
        setAdhocColors(prev => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
        setAdhocColor('')
      } else {
        setAdhocSizes(prev => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
        setAdhocSize('')
      }
      return
    }
    // Persist into the picked template
    const r = await matrixTemplateService.addValue(selectedTemplateId, {
      axis,
      displayValue: trimmed,
    })
    if (!r.isSuccess || !r.response) {
      showToast('error', r.message || 'Add value failed.')
      return
    }
    // Reload the template to pick up the new row
    const detail = await matrixTemplateService.getTemplate(selectedTemplateId)
    if (detail.isSuccess && detail.response) {
      setTemplates(prev => prev.map(t => (t.matrixTableID === selectedTemplateId ? detail.response! : t)))
      if (axis === 'color') {
        setAdhocColor('')
        setPickedColors(prev => new Set(prev).add(trimmed))
      } else {
        setAdhocSize('')
        setPickedSizes(prev => new Set(prev).add(trimmed))
      }
    }
  }

  // -------------------- Cross-product preview --------------------
  const finalColors = useMemo(() => {
    const fromTemplate = selectedTemplate?.colors.filter(v => pickedColors.has(v.displayValue)).map(v => v.displayValue) ?? []
    return [...new Set([...fromTemplate, ...adhocColors])]
  }, [selectedTemplate, pickedColors, adhocColors])

  const finalSizes = useMemo(() => {
    const fromTemplate = selectedTemplate?.sizes.filter(v => pickedSizes.has(v.displayValue)).map(v => v.displayValue) ?? []
    return [...new Set([...fromTemplate, ...adhocSizes])]
  }, [selectedTemplate, pickedSizes, adhocSizes])

  const previewCount = useMemo(() => {
    const c = finalColors.length || 1
    const s = finalSizes.length || 1
    if (finalColors.length === 0 && finalSizes.length === 0) return 0
    return c * s
  }, [finalColors, finalSizes])

  const toggle = (axis: MatrixAxis, value: string) => {
    if (axis === 'color') {
      setPickedColors(prev => {
        const next = new Set(prev)
        next.has(value) ? next.delete(value) : next.add(value)
        return next
      })
    } else {
      setPickedSizes(prev => {
        const next = new Set(prev)
        next.has(value) ? next.delete(value) : next.add(value)
        return next
      })
    }
  }

  const handleGenerate = async () => {
    if (previewCount === 0) {
      showToast('info', 'Pick at least one colour or size value.')
      return
    }
    setIsSaving(true)
    const r = await matrixTemplateService.generateChildren(parentItemId, {
      storeId,
      assignTemplateId: assignTemplate && selectedTemplateId ? selectedTemplateId : undefined,
      colors: finalColors,
      sizes: finalSizes,
    })
    setIsSaving(false)
    if (!r.isSuccess || !r.response) {
      showToast('error', r.message || 'Generate failed.')
      return
    }
    onGenerated(r.response.created, r.response.skipped)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="matrix-modal-shell" showCloseButton={false}>
      <div className="matrix-modal">
        {/* Built-in Modal X is hidden (it absolute-positions to the
            modal root and floats above the content); we render our
            own inline X so it aligns with the title row. */}
        <div className="matrix-modal__head">
          <h3>Generate Matrix Children</h3>
          <button type="button" className="matrix-modal__x" onClick={onClose} disabled={isSaving} aria-label="Close">
            ×
          </button>
        </div>

        {toast && <div className={`matrix-toast matrix-toast--${toast.kind}`}>{toast.text}</div>}

        <div className="matrix-modal__row">
          <label className="matrix-modal__label">Template (optional)</label>
          <select
            className="me-input me-input--select"
            value={selectedTemplateId}
            onChange={e => {
              setSelectedTemplateId(e.target.value)
              setPickedColors(new Set())
              setPickedSizes(new Set())
            }}
            disabled={isLoading || isSaving}
          >
            <option value="">— No template (ad-hoc) —</option>
            {templates.map(t => (
              <option key={t.matrixTableID} value={t.matrixTableID}>
                {t.matrixName ?? '(unnamed)'}
              </option>
            ))}
          </select>
          {selectedTemplateId && (
            <label className="matrix-modal__inline">
              <input
                type="checkbox"
                checked={assignTemplate}
                onChange={e => setAssignTemplate(e.target.checked)}
              />
              Remember this template on the parent
            </label>
          )}
        </div>

        <div className="matrix-modal__axes">
          {/* Colors */}
          <AxisPicker
            title="Colors"
            templateValues={selectedTemplate?.colors ?? []}
            picked={pickedColors}
            adhoc={adhocColors}
            adhocInput={adhocColor}
            onAdhocChange={setAdhocColor}
            onAdd={() => addInlineValue('color', adhocColor)}
            onToggle={v => toggle('color', v)}
            onRemoveAdhoc={v => setAdhocColors(prev => prev.filter(x => x !== v))}
            disabled={isSaving}
          />

          {/* Sizes */}
          <AxisPicker
            title="Sizes"
            templateValues={selectedTemplate?.sizes ?? []}
            picked={pickedSizes}
            adhoc={adhocSizes}
            adhocInput={adhocSize}
            onAdhocChange={setAdhocSize}
            onAdd={() => addInlineValue('size', adhocSize)}
            onToggle={v => toggle('size', v)}
            onRemoveAdhoc={v => setAdhocSizes(prev => prev.filter(x => x !== v))}
            disabled={isSaving}
          />
        </div>

        <div className="matrix-modal__preview">
          {previewCount === 0 ? (
            <span>Pick at least one value above.</span>
          ) : (
            <span>
              Will create up to <strong>{previewCount}</strong> variant{previewCount === 1 ? '' : 's'}
              {' '}({finalColors.length || 1} colour{(finalColors.length || 1) === 1 ? '' : 's'} ×{' '}
              {finalSizes.length || 1} size{(finalSizes.length || 1) === 1 ? '' : 's'}).
              {' '}Combos that already exist are skipped automatically.
            </span>
          )}
        </div>

        <div className="matrix-modal__foot">
          <button type="button" className="me-btn me-btn--ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className="me-btn me-btn--primary"
            onClick={handleGenerate}
            disabled={isSaving || previewCount === 0}
          >
            {isSaving ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Single-axis picker (Colors or Sizes). Template values are tick-boxes;
// ad-hoc values appear underneath as removable chips.
// ---------------------------------------------------------------------------
function AxisPicker({
  title,
  templateValues,
  picked,
  adhoc,
  adhocInput,
  onAdhocChange,
  onAdd,
  onToggle,
  onRemoveAdhoc,
  disabled,
}: {
  title: string
  templateValues: MatrixValueDto[]
  picked: Set<string>
  adhoc: string[]
  adhocInput: string
  onAdhocChange: (v: string) => void
  onAdd: () => void
  onToggle: (v: string) => void
  onRemoveAdhoc: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div className="matrix-axis">
      <div className="matrix-axis__head">{title}</div>
      <div className="matrix-axis__list">
        {templateValues.length === 0 && adhoc.length === 0 && (
          <div className="matrix-axis__empty">No values yet — add one below.</div>
        )}
        {templateValues.map(v => (
          <label key={v.matrixValueID} className="matrix-axis__opt">
            <input
              type="checkbox"
              checked={picked.has(v.displayValue)}
              onChange={() => onToggle(v.displayValue)}
              disabled={disabled}
            />
            <span>{v.displayValue}</span>
          </label>
        ))}
        {adhoc.map(v => (
          <div key={v} className="matrix-axis__chip">
            <span>{v}</span>
            <button
              type="button"
              className="matrix-axis__chip-x"
              onClick={() => onRemoveAdhoc(v)}
              disabled={disabled}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="matrix-axis__add">
        <input
          className="me-input"
          placeholder={`Add ${title.toLowerCase().slice(0, -1)}…`}
          value={adhocInput}
          onChange={e => onAdhocChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onAdd()
            }
          }}
          disabled={disabled}
        />
        <button type="button" className="me-btn" onClick={onAdd} disabled={disabled || !adhocInput.trim()}>
          Add
        </button>
      </div>
    </div>
  )
}
