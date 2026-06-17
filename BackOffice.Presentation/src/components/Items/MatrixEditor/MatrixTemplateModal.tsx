import { useEffect, useState } from 'react'
import { Modal } from '../../ui/modal'
import {
  matrixTemplateService,
  MatrixTemplateDto,
  MatrixValueDto,
  MatrixAxis,
} from '../../../services/matrixTemplateService'

/**
 * Matrix Template manager modal — port of legacy desktop FrmMatrix's
 * template editor. Lets the user:
 *   • List active templates
 *   • Create a new template (auto-creates Color + Size columns)
 *   • Edit a template's name / description
 *   • Soft-delete a template
 *   • Add / remove values on each axis, with optional "promote new
 *     colour to the global picker" and "cascade-soft-delete the items
 *     that use this value" prompts (matches FrmMatrix UX).
 *
 * Self-contained: handles its own confirm + toast UX inline. The
 * host MatrixEditor just opens / closes; no template-change events
 * fire to the host because the host's grid is keyed off the parent's
 * existing children, not the template list.
 */
export interface MatrixTemplateModalProps {
  isOpen: boolean
  onClose: () => void
}

type Toast = { kind: 'success' | 'error' | 'info'; text: string } | null
type ConfirmDeleteValue = {
  valueId: string
  displayValue: string
  axis: MatrixAxis
}

export default function MatrixTemplateModal({ isOpen, onClose }: MatrixTemplateModalProps) {
  const [templates, setTemplates] = useState<MatrixTemplateDto[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isWriting, setIsWriting] = useState(false)
  const [toast, setToast] = useState<Toast>(null)

  // Create-new form
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateDesc, setNewTemplateDesc] = useState('')

  // Edit form
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  // Value add inputs
  const [newColorValue, setNewColorValue] = useState('')
  const [newSizeValue, setNewSizeValue] = useState('')
  const [promoteColor, setPromoteColor] = useState(false)

  // Delete-value confirm
  const [pendingDelete, setPendingDelete] = useState<ConfirmDeleteValue | null>(null)
  const [cascadeChildren, setCascadeChildren] = useState(false)

  // Delete-template confirm
  const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState<MatrixTemplateDto | null>(null)

  const selected = templates.find(t => t.matrixTableID === selectedId) ?? null

  const showToast = (kind: 'success' | 'error' | 'info', text: string) => {
    setToast({ kind, text })
    window.setTimeout(() => setToast(null), 4000)
  }

  // ---------- Load ----------
  const load = async () => {
    setIsLoading(true)
    const r = await matrixTemplateService.listTemplates()
    setIsLoading(false)
    if (!r.isSuccess) {
      showToast('error', r.message || 'Failed to load templates.')
      return
    }
    setTemplates(r.response ?? [])
    // Preserve selection if possible, else select first
    if (r.response && r.response.length > 0) {
      const keep = r.response.find(t => t.matrixTableID === selectedId)
      const next = keep ?? r.response[0]
      setSelectedId(next.matrixTableID)
      setEditName(next.matrixName ?? '')
      setEditDesc(next.matrixDescription ?? '')
    } else {
      setSelectedId('')
      setEditName('')
      setEditDesc('')
    }
  }

  useEffect(() => {
    if (!isOpen) return
    setNewTemplateName('')
    setNewTemplateDesc('')
    setNewColorValue('')
    setNewSizeValue('')
    setPendingDelete(null)
    setPendingDeleteTemplate(null)
    setToast(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Keep edit fields in sync when user changes selection
  useEffect(() => {
    if (selected) {
      setEditName(selected.matrixName ?? '')
      setEditDesc(selected.matrixDescription ?? '')
    }
  }, [selectedId, selected])

  // ---------- Template CRUD ----------
  const handleCreateTemplate = async () => {
    const name = newTemplateName.trim()
    if (!name) {
      showToast('error', 'Name is required.')
      return
    }
    setIsWriting(true)
    const r = await matrixTemplateService.createTemplate({ name, description: newTemplateDesc.trim() })
    setIsWriting(false)
    if (!r.isSuccess || !r.response) {
      showToast('error', r.message || 'Create failed.')
      return
    }
    showToast('success', 'Template created.')
    setNewTemplateName('')
    setNewTemplateDesc('')
    setSelectedId(r.response.matrixTableID)
    await load()
  }

  const handleUpdateTemplate = async () => {
    if (!selected) return
    const name = editName.trim()
    if (!name) {
      showToast('error', 'Name is required.')
      return
    }
    setIsWriting(true)
    const r = await matrixTemplateService.updateTemplate(selected.matrixTableID, {
      name,
      description: editDesc.trim(),
    })
    setIsWriting(false)
    if (!r.isSuccess) {
      showToast('error', r.message || 'Update failed.')
      return
    }
    showToast('success', 'Template updated.')
    await load()
  }

  const confirmDeleteTemplate = async () => {
    if (!pendingDeleteTemplate) return
    setIsWriting(true)
    const r = await matrixTemplateService.deleteTemplate(pendingDeleteTemplate.matrixTableID)
    setIsWriting(false)
    setPendingDeleteTemplate(null)
    if (!r.isSuccess) {
      showToast('error', r.message || 'Delete failed.')
      return
    }
    showToast('success', 'Template removed.')
    await load()
  }

  // ---------- Values CRUD ----------
  const handleAddValue = async (axis: MatrixAxis, displayValue: string) => {
    if (!selected) return
    const v = displayValue.trim()
    if (!v) return
    setIsWriting(true)
    const r = await matrixTemplateService.addValue(selected.matrixTableID, {
      axis,
      displayValue: v,
      promoteToGlobal: axis === 'color' && promoteColor,
    })
    setIsWriting(false)
    if (!r.isSuccess) {
      showToast('error', r.message || 'Add failed.')
      return
    }
    if (axis === 'color') setNewColorValue('')
    else setNewSizeValue('')
    await load()
  }

  const confirmDeleteValue = async () => {
    if (!pendingDelete) return
    setIsWriting(true)
    const r = await matrixTemplateService.deleteValue(pendingDelete.valueId, cascadeChildren)
    setIsWriting(false)
    setPendingDelete(null)
    setCascadeChildren(false)
    if (!r.isSuccess) {
      showToast('error', r.message || 'Delete failed.')
      return
    }
    showToast('success', 'Value removed.')
    await load()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="matrix-modal-shell matrix-modal-shell--wide" showCloseButton={false}>
      <div className="matrix-modal">
        {/* Built-in Modal X disabled — using our inline one so it
            sits flush with the title row instead of floating above. */}
        <div className="matrix-modal__head">
          <h3>Matrix Templates</h3>
          <button type="button" className="matrix-modal__x" onClick={onClose} disabled={isWriting} aria-label="Close">
            ×
          </button>
        </div>

        {toast && <div className={`matrix-toast matrix-toast--${toast.kind}`}>{toast.text}</div>}

        {pendingDelete && (
          <div className="matrix-confirm">
            <div className="matrix-confirm__msg">
              Remove <strong>{pendingDelete.displayValue}</strong> from {pendingDelete.axis} values?
              <label style={{ marginLeft: 16 }}>
                <input
                  type="checkbox"
                  checked={cascadeChildren}
                  onChange={e => setCascadeChildren(e.target.checked)}
                />
                {' '}Also deactivate matrix items currently using this value
              </label>
            </div>
            <div className="matrix-confirm__actions">
              <button
                type="button"
                className="me-btn me-btn--ghost"
                onClick={() => { setPendingDelete(null); setCascadeChildren(false) }}
                disabled={isWriting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="me-btn me-btn--primary"
                onClick={confirmDeleteValue}
                disabled={isWriting}
              >
                {isWriting ? 'Working…' : 'Remove'}
              </button>
            </div>
          </div>
        )}

        {pendingDeleteTemplate && (
          <div className="matrix-confirm">
            <div className="matrix-confirm__msg">
              Remove template <strong>{pendingDeleteTemplate.matrixName ?? '(unnamed)'}</strong>?
              {' '}Existing items keep their template reference for history.
            </div>
            <div className="matrix-confirm__actions">
              <button type="button" className="me-btn me-btn--ghost" onClick={() => setPendingDeleteTemplate(null)} disabled={isWriting}>
                Cancel
              </button>
              <button type="button" className="me-btn me-btn--primary" onClick={confirmDeleteTemplate} disabled={isWriting}>
                {isWriting ? 'Working…' : 'Remove'}
              </button>
            </div>
          </div>
        )}

        <div className="matrix-modal__split">
          {/* LEFT: templates list + create-new */}
          <div className="matrix-modal__pane">
            <div className="matrix-axis__head">Templates</div>
            <div className="matrix-template-list">
              {isLoading && <div className="matrix-axis__empty">Loading…</div>}
              {!isLoading && templates.length === 0 && (
                <div className="matrix-axis__empty">No templates yet.</div>
              )}
              {!isLoading && templates.map(t => (
                <div
                  key={t.matrixTableID}
                  className={`matrix-template-list__row ${t.matrixTableID === selectedId ? 'is-selected' : ''}`}
                  onClick={() => setSelectedId(t.matrixTableID)}
                  role="button"
                  tabIndex={0}
                >
                  <span className="matrix-template-list__name">{t.matrixName ?? '(unnamed)'}</span>
                  <span className="matrix-template-list__counts">
                    {t.colors.length}C · {t.sizes.length}S
                  </span>
                  <button
                    type="button"
                    className="me-row-x"
                    title="Remove template"
                    onClick={e => { e.stopPropagation(); setPendingDeleteTemplate(t) }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="matrix-modal__create-row">
              <input
                className="me-input"
                placeholder="New template name"
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                disabled={isWriting}
              />
              <input
                className="me-input"
                placeholder="Description (optional)"
                value={newTemplateDesc}
                onChange={e => setNewTemplateDesc(e.target.value)}
                disabled={isWriting}
              />
              <button
                type="button"
                className="me-btn me-btn--primary"
                onClick={handleCreateTemplate}
                disabled={isWriting || !newTemplateName.trim()}
              >
                Create
              </button>
            </div>
          </div>

          {/* RIGHT: selected template editor */}
          <div className="matrix-modal__pane matrix-modal__pane--main">
            {!selected ? (
              <div className="matrix-axis__empty">
                Select a template on the left, or create a new one.
              </div>
            ) : (
              <>
                <div className="matrix-modal__row">
                  <label className="matrix-modal__label">Name</label>
                  <input
                    className="me-input"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    disabled={isWriting}
                  />
                  <label className="matrix-modal__label">Description</label>
                  <input
                    className="me-input"
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    disabled={isWriting}
                  />
                  <button
                    type="button"
                    className="me-btn"
                    onClick={handleUpdateTemplate}
                    disabled={isWriting}
                  >
                    Save
                  </button>
                </div>

                <div className="matrix-modal__axes">
                  <ValueListEditor
                    title="Colors"
                    values={selected.colors}
                    inputValue={newColorValue}
                    onInputChange={setNewColorValue}
                    onAdd={() => handleAddValue('color', newColorValue)}
                    onDelete={v => setPendingDelete({ valueId: v.matrixValueID, displayValue: v.displayValue, axis: 'color' })}
                    disabled={isWriting}
                    extraToggle={(
                      <label className="matrix-modal__inline">
                        <input
                          type="checkbox"
                          checked={promoteColor}
                          onChange={e => setPromoteColor(e.target.checked)}
                        />
                        Also add to global colour list
                      </label>
                    )}
                  />
                  <ValueListEditor
                    title="Sizes"
                    values={selected.sizes}
                    inputValue={newSizeValue}
                    onInputChange={setNewSizeValue}
                    onAdd={() => handleAddValue('size', newSizeValue)}
                    onDelete={v => setPendingDelete({ valueId: v.matrixValueID, displayValue: v.displayValue, axis: 'size' })}
                    disabled={isWriting}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ValueListEditor({
  title,
  values,
  inputValue,
  onInputChange,
  onAdd,
  onDelete,
  disabled,
  extraToggle,
}: {
  title: string
  values: MatrixValueDto[]
  inputValue: string
  onInputChange: (v: string) => void
  onAdd: () => void
  onDelete: (v: MatrixValueDto) => void
  disabled?: boolean
  extraToggle?: React.ReactNode
}) {
  return (
    <div className="matrix-axis">
      <div className="matrix-axis__head">{title}</div>
      <div className="matrix-axis__list">
        {values.length === 0 && <div className="matrix-axis__empty">No values yet.</div>}
        {values.map(v => (
          <div key={v.matrixValueID} className="matrix-axis__chip matrix-axis__chip--big">
            <span>{v.displayValue}</span>
            <button
              type="button"
              className="matrix-axis__chip-x"
              onClick={() => onDelete(v)}
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
          value={inputValue}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onAdd()
            }
          }}
          disabled={disabled}
        />
        <button type="button" className="me-btn" onClick={onAdd} disabled={disabled || !inputValue.trim()}>
          Add
        </button>
      </div>
      {extraToggle}
    </div>
  )
}
