import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuthHeaders } from '../../../hooks/useAuthHeaders'
import usePrintAgent from '../../../hooks/usePrintAgent'
import printerMappings from '../../../services/print/printerMappings'
import printerRoster from '../../../services/print/printerRoster'
import printViaAgent from '../../../services/print/printViaAgent'
import { buildLabelPdf } from '../../../services/print/labelPdfBuilder'
import { API_ENDPOINTS } from '../../../constants/api'
import { LabelTemplate, LabelTemplateListItem, LabelData } from '../types'
import LabelPrintPreview from './LabelPrintPreview'
import './PrintLabelsDialog.css'

interface PrintLabelsDialogProps {
  isOpen: boolean
  onClose: () => void
  itemStoreIds: string[]
  /**
   * Retained for caller compatibility. The dialog no longer filters templates by
   * type — all of the user's templates are shown so none are silently hidden.
   */
  labelType?: number // 1=Item, 2=Shelf, 3=Price, 4=Barcode
}

function buildPlaceholderItems(ids: string[]): LabelData[] {
  return ids.map((id) => ({
    itemStoreId: id,
    barcodeNumber: '',
    description: '',
    price: 0,
  }))
}

const PrintLabelsDialog: React.FC<PrintLabelsDialogProps> = ({
  isOpen,
  onClose,
  itemStoreIds,
}) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { agentHealth, backendStatus, printers } = usePrintAgent(0)

  const [templates, setTemplates] = useState<LabelTemplateListItem[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<LabelTemplate | null>(null)
  const [items, setItems] = useState<LabelData[]>([])
  const [copies, setCopies] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPrinter, setSelectedPrinter] = useState<string>("")
  const [printingToAgent, setPrintingToAgent] = useState(false)
  const [agentMessage, setAgentMessage] = useState<string | null>(null)

  const agentPaired = (backendStatus?.paired ?? false) && (agentHealth?.isPaired ?? false)

  const printerOptions = useMemo(() => {
    const map = new Map<string, { name: string; isDefault: boolean }>()
    printers.forEach((p) => map.set(p.name.toLowerCase(), { name: p.name, isDefault: p.isDefault }))
    printerRoster.getAll().forEach((name) => {
      if (!map.has(name.toLowerCase())) map.set(name.toLowerCase(), { name, isDefault: false })
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [printers])

  useEffect(() => {
    if (!isOpen) return
    const labelPrinter = printerMappings.get("label")
    if (labelPrinter) {
      setSelectedPrinter(labelPrinter)
      return
    }
    const osDefault = printers.find((p) => p.isDefault)?.name
    if (osDefault) {
      setSelectedPrinter(osDefault)
      return
    }
    if (printerOptions.length > 0) setSelectedPrinter(printerOptions[0].name)
  }, [isOpen, printers, printerOptions])

  // Load templates when dialog opens. Use a serialized key for itemStoreIds so
  // a parent re-render that produces a new array reference (but same values)
  // doesn't refire this effect and pin isLoading to true.
  const itemStoreIdsKey = itemStoreIds.join(',')
  useEffect(() => {
    if (isOpen) {
      loadTemplates()
      loadItems()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, itemStoreIdsKey])

  // Load template details when selected
  useEffect(() => {
    if (selectedTemplateId) {
      loadTemplateDetails(selectedTemplateId)
    }
  }, [selectedTemplateId])

  const loadTemplates = async () => {
    try {
      const headers = getAuthHeaders()
      // Load every template the user has designed. We intentionally do NOT filter
      // by labelType here: templates saved in the Label Designer with a type other
      // than "Item Label" were previously hidden from this dialog, leaving users
      // unable to find templates they had just created (WEB-190). The type is shown
      // in each option instead so the choice stays clear.
      const url = API_ENDPOINTS.LABEL_TEMPLATES.GET_ALL

      const response = await fetch(url, {
        method: 'GET',
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          setTemplates(data.response)
          // Auto-select default template
          const defaultTemplate = data.response.find((t: LabelTemplateListItem) => t.isDefault)
          if (defaultTemplate) {
            setSelectedTemplateId(defaultTemplate.id)
          } else if (data.response.length > 0) {
            setSelectedTemplateId(data.response[0].id)
          }
        }
      }
    } catch (err) {
      console.error('Error loading templates:', err)
      setError('Failed to load templates')
    }
  }

  const loadTemplateDetails = async (id: number) => {
    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.LABEL_TEMPLATES.GET_BY_ID(id), {
        method: 'GET',
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          setSelectedTemplate(data.response)
        }
      }
    } catch (err) {
      console.error('Error loading template:', err)
    }
  }

  const loadItems = async () => {
    if (itemStoreIds.length === 0) return

    setIsLoading(true)
    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.LABEL_TEMPLATES.GET_ITEMS, {
        method: 'POST',
        headers,
        body: JSON.stringify(itemStoreIds),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && Array.isArray(data.response) && data.response.length > 0) {
          setItems(data.response)
        } else {
          // API succeeded but returned no enrichment — fall back to bare item ids so
          // the user can still print. Data fields like [Description] / [Price] will
          // be blank, but barcode-only labels still work.
          setItems(buildPlaceholderItems(itemStoreIds))
          if (data.message) setError(`Item details unavailable: ${data.message}. Printing without enrichment.`)
        }
      } else {
        setItems(buildPlaceholderItems(itemStoreIds))
        setError(`Couldn't load item details (HTTP ${response.status}). Printing without enrichment.`)
      }
    } catch (err) {
      console.error('Error loading items:', err)
      setItems(buildPlaceholderItems(itemStoreIds))
      setError('Couldn\'t load item details. Printing without enrichment.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrint = useCallback(() => {
    if (!selectedTemplate) {
      setError('Please select a template')
      return
    }
    if (itemStoreIds.length === 0) {
      setError('No items to print')
      return
    }
    setShowPreview(true)
  }, [selectedTemplate, itemStoreIds])

  const handleSendToPrinter = useCallback(async () => {
    if (!selectedTemplate) {
      setError('Please select a template')
      return
    }
    if (itemStoreIds.length === 0) {
      setError('No items to print')
      return
    }
    if (!selectedPrinter) {
      setError('Please select a printer')
      return
    }
    if (!agentPaired) {
      setError('Print Helper agent is not paired. Open Printer Settings to install/pair it, or use Print Preview.')
      return
    }
    setError(null)
    setAgentMessage(null)
    setPrintingToAgent(true)
    try {
      const labelItems = items.length > 0 ? items : buildPlaceholderItems(itemStoreIds)
      const pdf = buildLabelPdf(selectedTemplate, labelItems, copies)
      const result = await printViaAgent({
        documentType: 'label',
        contentType: 'pdf',
        payload: pdf,
        jobName: `BackOffice-Label-${selectedTemplate.name}`,
        fallbackPrinterName: selectedPrinter,
      })
      if (result.agentUsed && result.result?.success) {
        setAgentMessage(`Sent ${labelItems.length * copies} label(s) to ${selectedPrinter}.`)
      } else {
        setError(result.error || 'Print failed.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Print failed.')
    } finally {
      setPrintingToAgent(false)
    }
  }, [selectedTemplate, items, itemStoreIds, selectedPrinter, agentPaired, copies])

  if (!isOpen) return null

  return (
    <>
      <div className="print-dialog-overlay">
        <div className="print-dialog">
          <div className="print-dialog-header">
            <h3>Print Labels</h3>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>

          <div className="print-dialog-content">
            {error && (
              <div className="print-error">{error}</div>
            )}

            <div className="print-form-row">
              <label>Template:</label>
              <select
                value={selectedTemplateId || ''}
                onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
              >
                <option value="">Select a template...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.labelTypeName ? ` — ${t.labelTypeName}` : ''} ({t.labelWidth}" × {t.labelHeight}")
                    {t.isDefault && ' ★'}
                  </option>
                ))}
              </select>
            </div>

            <div className="print-form-row">
              <label>Printer:</label>
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
              >
                <option value="">Select a printer...</option>
                {printerOptions.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                    {p.isDefault ? ' (Windows default)' : ''}
                    {printerMappings.get('label') === p.name ? ' — your label printer' : ''}
                  </option>
                ))}
              </select>
              {!agentPaired && (
                <span className="hint" style={{ display: 'block', marginTop: 4, color: '#b45309' }}>
                  Print Helper agent not paired — direct printing is unavailable. Use Print Preview for the browser dialog, or set up the agent in Printer Settings.
                </span>
              )}
            </div>

            <div className="print-form-row">
              <label>Copies per item:</label>
              <input
                type="number"
                min={1}
                max={100}
                value={copies}
                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            <div className="print-summary">
              <p>
                <strong>{itemStoreIds.length}</strong> item(s) selected
                {copies > 1 && <> × <strong>{copies}</strong> copies</>}
                {' '}= <strong>{itemStoreIds.length * copies}</strong> label(s)
              </p>
              {selectedTemplate && (
                <p className="template-info">
                  Label size: {selectedTemplate.labelWidth}" × {selectedTemplate.labelHeight}" — one label per page
                </p>
              )}
            </div>

            {agentMessage && (
              <div style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: 4, padding: '6px 10px', marginTop: 8, fontSize: 13 }}>
                {agentMessage}
              </div>
            )}
          </div>

          <div className="print-dialog-footer">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-secondary"
              onClick={handlePrint}
              disabled={!selectedTemplate || itemStoreIds.length === 0 || isLoading}
            >
              {isLoading ? 'Loading...' : 'Print Preview'}
            </button>
            <button
              className="btn-primary"
              onClick={handleSendToPrinter}
              disabled={!selectedTemplate || itemStoreIds.length === 0 || !selectedPrinter || !agentPaired || printingToAgent}
              title={!agentPaired ? 'Print Helper agent must be paired' : selectedPrinter ? `Send directly to ${selectedPrinter}` : 'Select a printer'}
            >
              {printingToAgent ? 'Sending...' : selectedPrinter ? `Print to ${selectedPrinter}` : 'Print'}
            </button>
          </div>
        </div>
      </div>

      {/* Print Preview */}
      {showPreview && selectedTemplate && (
        <LabelPrintPreview
          template={selectedTemplate}
          items={items}
          copies={copies}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  )
}

export default PrintLabelsDialog
