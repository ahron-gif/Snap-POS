import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useAuthHeaders } from '../../hooks/useAuthHeaders'
import { API_ENDPOINTS } from '../../constants/api'
import {
  LabelTemplate,
  LabelTemplateListItem,
  LabelElement,
  LabelDesign,
  LabelType,
  PaperSize,
  LABEL_PRESETS,
  DATA_FIELDS,
  BARCODE_TYPES,
  LabelData,
  DataField,
  SAMPLE_ITEM_DATA,
} from './types'
import BarcodeRenderer from './components/BarcodeRenderer'
import LabelPrintPreview from './components/LabelPrintPreview'
import DataSourcePanel from './components/DataSourcePanel'
import PreviewPanel from './components/PreviewPanel'
import './LabelDesignerPage.css'

// Convert inches to pixels (96 DPI for screen)
const INCH_TO_PX = 96
const inchesToPx = (inches: number) => inches * INCH_TO_PX
const pxToInches = (px: number) => px / INCH_TO_PX

// Generate unique ID
const generateId = () => `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

interface LabelDesignerPageProps {
  onClose?: () => void
}

const LabelDesignerPage: React.FC<LabelDesignerPageProps> = ({ onClose }) => {
  const { getAuthHeaders } = useAuthHeaders()

  // Template state
  const [templates, setTemplates] = useState<LabelTemplateListItem[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [currentTemplate, setCurrentTemplate] = useState<LabelTemplate | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Design state
  const [design, setDesign] = useState<LabelDesign>({ elements: [] })
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  // Template settings
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [labelType, setLabelType] = useState<LabelType>(LabelType.ItemLabel)
  const [labelWidth, setLabelWidth] = useState(2.625)
  const [labelHeight, setLabelHeight] = useState(1)
  const [columnsPerPage, setColumnsPerPage] = useState(3)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // Tool state
  const [selectedTool, setSelectedTool] = useState<'select' | 'text' | 'barcode' | 'rectangle' | 'line'>('select')

  // Print preview state
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [testItems, setTestItems] = useState<LabelData[]>([])

  // Left panel tab state
  const [leftPanelTab, setLeftPanelTab] = useState<'templates' | 'datasource'>('templates')

  // Zoom state
  const [zoom, setZoom] = useState(1)

  // Show preview panel
  const [showPreviewPanel, setShowPreviewPanel] = useState(true)

  // Canvas ref
  const canvasRef = useRef<HTMLDivElement>(null)

  // Toast state
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  })

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000)
  }, [])

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.LABEL_TEMPLATES.GET_ALL, {
        method: 'GET',
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          setTemplates(data.response)
        }
      }
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  }, [getAuthHeaders])

  // Load specific template
  const loadTemplate = useCallback(async (id: number) => {
    setIsLoading(true)
    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.LABEL_TEMPLATES.GET_BY_ID(id), {
        method: 'GET',
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          const template = data.response as LabelTemplate
          setCurrentTemplate(template)
          setTemplateName(template.name)
          setTemplateDescription(template.description || '')
          setLabelType(template.labelType)
          setLabelWidth(template.labelWidth)
          setLabelHeight(template.labelHeight)
          setColumnsPerPage(template.columnsPerPage)
          setRowsPerPage(template.rowsPerPage)

          try {
            const parsedDesign = JSON.parse(template.designJson)
            setDesign(parsedDesign)
          } catch {
            setDesign({ elements: [] })
          }
        }
      }
    } catch (error) {
      console.error('Error loading template:', error)
      showToast('Error loading template', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [getAuthHeaders, showToast])

  // Save template
  const saveTemplate = useCallback(async () => {
    if (!templateName.trim()) {
      showToast('Please enter a template name', 'error')
      return
    }

    setIsSaving(true)
    try {
      const headers = getAuthHeaders()
      const designJson = JSON.stringify(design)

      const payload = {
        name: templateName,
        description: templateDescription,
        labelType,
        paperSize: PaperSize.Letter,
        labelWidth,
        labelHeight,
        columnsPerPage,
        rowsPerPage,
        marginLeft: 0.1875,
        marginTop: 0.5,
        horizontalGap: 0.125,
        verticalGap: 0,
        designJson,
        isDefault: false,
      }

      const url = currentTemplate?.id
        ? API_ENDPOINTS.LABEL_TEMPLATES.UPDATE(currentTemplate.id)
        : API_ENDPOINTS.LABEL_TEMPLATES.CREATE

      const response = await fetch(url, {
        method: currentTemplate?.id ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess) {
          showToast('Template saved successfully', 'success')
          loadTemplates()
          if (data.response) {
            setCurrentTemplate(data.response)
            setSelectedTemplateId(data.response.id)
          }
        } else {
          showToast(data.message || 'Error saving template', 'error')
        }
      }
    } catch (error) {
      console.error('Error saving template:', error)
      showToast('Error saving template', 'error')
    } finally {
      setIsSaving(false)
    }
  }, [
    getAuthHeaders,
    templateName,
    templateDescription,
    labelType,
    labelWidth,
    labelHeight,
    columnsPerPage,
    rowsPerPage,
    design,
    currentTemplate,
    showToast,
    loadTemplates,
  ])

  // Delete template
  const deleteTemplate = useCallback(async () => {
    if (!currentTemplate?.id) return

    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.LABEL_TEMPLATES.DELETE(currentTemplate.id), {
        method: 'DELETE',
        headers,
      })

      if (response.ok) {
        showToast('Template deleted', 'success')
        setCurrentTemplate(null)
        setSelectedTemplateId(null)
        setDesign({ elements: [] })
        setTemplateName('')
        setTemplateDescription('')
        loadTemplates()
      }
    } catch (error) {
      console.error('Error deleting template:', error)
      showToast('Error deleting template', 'error')
    }
  }, [getAuthHeaders, currentTemplate, showToast, loadTemplates])

  // Add element
  const addElement = useCallback((type: 'text' | 'barcode' | 'rectangle' | 'line', dataField?: DataField) => {
    const isBarcode = type === 'barcode' || (dataField && dataField.type === 'barcode')
    const actualType = isBarcode ? 'barcode' : type

    const newElement: LabelElement = {
      id: generateId(),
      type: actualType,
      x: 10,
      y: 10,
      width: actualType === 'barcode' ? 150 : actualType === 'line' ? 100 : 100,
      height: actualType === 'barcode' ? 50 : actualType === 'line' ? 2 : 20,
      rotation: 0,
      properties: {
        ...(actualType === 'text' && {
          text: dataField?.sampleValue || 'Sample Text',
          fontFamily: 'Arial',
          fontSize: 12,
          color: '#000000',
          textAlign: 'left' as const,
          dataField: dataField?.value,
        }),
        ...(actualType === 'barcode' && {
          barcodeType: 'CODE128' as const,
          barcodeValue: dataField?.sampleValue || '123456789',
          showText: true,
          barcodeHeight: 40,
          dataField: dataField?.value || '[BarcodeNumber]',
        }),
        ...(actualType === 'rectangle' && {
          fillColor: 'transparent',
          strokeColor: '#000000',
          strokeWidth: 1,
        }),
        ...(actualType === 'line' && {
          strokeColor: '#000000',
          strokeWidth: 1,
        }),
      },
    }

    setDesign(prev => ({
      ...prev,
      elements: [...prev.elements, newElement],
    }))
    setSelectedElementId(newElement.id)
    setSelectedTool('select')
  }, [])

  // Add element from data field
  const addElementFromField = useCallback((field: DataField) => {
    if (field.type === 'barcode') {
      addElement('barcode', field)
    } else {
      addElement('text', field)
    }
  }, [addElement])

  // Handle data field drag start
  const handleFieldDragStart = useCallback((e: React.DragEvent, field: DataField) => {
    e.dataTransfer.setData('application/json', JSON.stringify(field))
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  // Handle canvas drop for data fields
  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const data = e.dataTransfer.getData('application/json')
    if (!data) return

    try {
      const field: DataField = JSON.parse(data)
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = (e.clientX - rect.left) / zoom
      const y = (e.clientY - rect.top) / zoom

      const isBarcode = field.type === 'barcode'
      const elementType = isBarcode ? 'barcode' : 'text'

      const newElement: LabelElement = {
        id: generateId(),
        type: elementType,
        x: Math.max(0, x - 40),
        y: Math.max(0, y - 10),
        width: isBarcode ? 150 : 100,
        height: isBarcode ? 50 : 20,
        rotation: 0,
        properties: {
          ...(elementType === 'text' && {
            text: field.sampleValue,
            fontFamily: 'Arial',
            fontSize: 12,
            color: '#000000',
            textAlign: 'left' as const,
            dataField: field.value,
          }),
          ...(elementType === 'barcode' && {
            barcodeType: 'CODE128' as const,
            barcodeValue: field.sampleValue,
            showText: true,
            barcodeHeight: 40,
            dataField: field.value,
          }),
        },
      }

      setDesign(prev => ({
        ...prev,
        elements: [...prev.elements, newElement],
      }))
      setSelectedElementId(newElement.id)
      setSelectedTool('select')
    } catch (error) {
      console.error('Error parsing drag data:', error)
    }
  }, [zoom])

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  // Delete selected element
  const deleteSelectedElement = useCallback(() => {
    if (!selectedElementId) return

    setDesign(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== selectedElementId),
    }))
    setSelectedElementId(null)
  }, [selectedElementId])

  // Update element
  const updateElement = useCallback((id: string, updates: Partial<LabelElement>) => {
    setDesign(prev => ({
      ...prev,
      elements: prev.elements.map(el =>
        el.id === id ? { ...el, ...updates } : el
      ),
    }))
  }, [])

  // Update element properties
  const updateElementProperties = useCallback((id: string, propUpdates: Partial<LabelElement['properties']>) => {
    setDesign(prev => ({
      ...prev,
      elements: prev.elements.map(el =>
        el.id === id ? { ...el, properties: { ...el.properties, ...propUpdates } } : el
      ),
    }))
  }, [])

  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (selectedTool !== 'select') {
      addElement(selectedTool as 'text' | 'barcode' | 'rectangle' | 'line')
    } else if (e.target === canvasRef.current) {
      setSelectedElementId(null)
    }
  }, [selectedTool, addElement])

  // Handle element mouse down for dragging
  const handleElementMouseDown = useCallback((e: React.MouseEvent, elementId: string) => {
    e.stopPropagation()
    setSelectedElementId(elementId)

    if (selectedTool === 'select') {
      const element = design.elements.find(el => el.id === elementId)
      if (element && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        setDragOffset({
          x: (e.clientX - rect.left) / zoom - element.x,
          y: (e.clientY - rect.top) / zoom - element.y,
        })
        setIsDragging(true)
      }
    }
  }, [selectedTool, design.elements, zoom])

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !selectedElementId || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const newX = Math.max(0, (e.clientX - rect.left) / zoom - dragOffset.x)
    const newY = Math.max(0, (e.clientY - rect.top) / zoom - dragOffset.y)

    updateElement(selectedElementId, { x: newX, y: newY })
  }, [isDragging, selectedElementId, dragOffset, updateElement, zoom])

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Apply preset
  const applyPreset = useCallback((preset: typeof LABEL_PRESETS[0]) => {
    setLabelWidth(preset.width)
    setLabelHeight(preset.height)
    setColumnsPerPage(preset.columns)
    setRowsPerPage(preset.rows)
  }, [])

  // New template
  const newTemplate = useCallback(() => {
    setCurrentTemplate(null)
    setSelectedTemplateId(null)
    setTemplateName('')
    setTemplateDescription('')
    setLabelType(LabelType.ItemLabel)
    setDesign({ elements: [] })
    setSelectedElementId(null)
  }, [])

  // Load templates on mount
  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // Load template when selected
  useEffect(() => {
    if (selectedTemplateId) {
      loadTemplate(selectedTemplateId)
    }
  }, [selectedTemplateId, loadTemplate])

  // Get selected element
  const selectedElement = design.elements.find(el => el.id === selectedElementId)

  return (
    <div className="label-designer-page">
      {/* Header */}
      <div className="label-designer-header">
        <h2>Label Designer</h2>
        <div className="header-actions">
          <button className="btn-secondary" onClick={newTemplate}>New</button>
          <button className="btn-primary" onClick={saveTemplate} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              // Create test data for preview
              setTestItems([
                {
                  itemStoreId: '00000000-0000-0000-0000-000000000001',
                  barcodeNumber: '1234567890123',
                  description: 'Sample Product Item',
                  price: 9.99,
                  size: 'Medium',
                  departmentName: 'General',
                  manufacturerName: 'Test Brand',
                },
                {
                  itemStoreId: '00000000-0000-0000-0000-000000000002',
                  barcodeNumber: '9876543210987',
                  description: 'Another Item Example',
                  price: 14.50,
                  size: 'Large',
                  departmentName: 'Electronics',
                  manufacturerName: 'Brand Co.',
                },
              ])
              setShowPrintPreview(true)
            }}
            disabled={design.elements.length === 0}
          >
            Test Print
          </button>
          {currentTemplate?.id && (
            <button className="btn-danger" onClick={deleteTemplate}>Delete</button>
          )}
          {onClose && (
            <button className="btn-secondary" onClick={onClose}>Close</button>
          )}
        </div>
      </div>

      <div className="label-designer-content">
        {/* Left Panel - Tabbed (Templates / DataSource) */}
        <div className="left-panel">
          <div className="left-panel-tabs">
            <button
              className={`panel-tab ${leftPanelTab === 'templates' ? 'active' : ''}`}
              onClick={() => setLeftPanelTab('templates')}
            >
              Templates
            </button>
            <button
              className={`panel-tab ${leftPanelTab === 'datasource' ? 'active' : ''}`}
              onClick={() => setLeftPanelTab('datasource')}
            >
              Data Fields
            </button>
          </div>

          {leftPanelTab === 'templates' && (
            <div className="templates-panel">
              <div className="templates-list">
                {templates.map(t => (
                  <div
                    key={t.id}
                    className={`template-item ${selectedTemplateId === t.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTemplateId(t.id)}
                  >
                    <div className="template-name">{t.name}</div>
                    <div className="template-size">{t.labelWidth}" x {t.labelHeight}"</div>
                  </div>
                ))}
                {templates.length === 0 && (
                  <div className="no-templates">
                    No templates yet.<br />Click "New" to create one.
                  </div>
                )}
              </div>
            </div>
          )}

          {leftPanelTab === 'datasource' && (
            <DataSourcePanel
              onFieldSelect={addElementFromField}
              onFieldDragStart={handleFieldDragStart}
            />
          )}
        </div>

        {/* Center - Canvas */}
        <div className="canvas-panel">
          {/* Toolbar */}
          <div className="canvas-toolbar">
            <button
              className={`tool-btn ${selectedTool === 'select' ? 'active' : ''}`}
              onClick={() => setSelectedTool('select')}
              title="Select"
            >
              <span>Select</span>
            </button>
            <button
              className={`tool-btn ${selectedTool === 'text' ? 'active' : ''}`}
              onClick={() => setSelectedTool('text')}
              title="Add Text"
            >
              <span>Text</span>
            </button>
            <button
              className={`tool-btn ${selectedTool === 'barcode' ? 'active' : ''}`}
              onClick={() => setSelectedTool('barcode')}
              title="Add Barcode"
            >
              <span>Barcode</span>
            </button>
            <button
              className={`tool-btn ${selectedTool === 'rectangle' ? 'active' : ''}`}
              onClick={() => setSelectedTool('rectangle')}
              title="Add Rectangle"
            >
              <span>Rectangle</span>
            </button>
            <button
              className={`tool-btn ${selectedTool === 'line' ? 'active' : ''}`}
              onClick={() => setSelectedTool('line')}
              title="Add Line"
            >
              <span>Line</span>
            </button>
            <div className="toolbar-separator" />
            <button
              className="tool-btn"
              onClick={deleteSelectedElement}
              disabled={!selectedElementId}
              title="Delete Selected"
            >
              <span>Delete</span>
            </button>
            <div className="toolbar-separator" />
            {/* Zoom Controls */}
            <div className="zoom-controls">
              <button
                className="zoom-btn"
                onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                title="Zoom Out"
              >
                −
              </button>
              <span className="zoom-level">{Math.round(zoom * 100)}%</span>
              <button
                className="zoom-btn"
                onClick={() => setZoom(z => Math.min(2, z + 0.25))}
                title="Zoom In"
              >
                +
              </button>
              <button
                className="zoom-btn zoom-reset"
                onClick={() => setZoom(1)}
                title="Reset Zoom"
              >
                100%
              </button>
            </div>
            <div className="toolbar-separator" />
            {/* Preview Toggle */}
            <button
              className={`tool-btn ${showPreviewPanel ? 'active' : ''}`}
              onClick={() => setShowPreviewPanel(!showPreviewPanel)}
              title="Toggle Preview"
            >
              <span>Preview</span>
            </button>
          </div>

          {/* Canvas Area */}
          <div className="canvas-container">
            <div
              ref={canvasRef}
              className="label-canvas"
              style={{
                width: inchesToPx(labelWidth) * zoom,
                height: inchesToPx(labelHeight) * zoom,
              }}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onDrop={handleCanvasDrop}
              onDragOver={handleCanvasDragOver}
            >
              {design.elements.map(element => (
                <div
                  key={element.id}
                  className={`canvas-element ${element.type} ${selectedElementId === element.id ? 'selected' : ''}`}
                  style={{
                    left: element.x * zoom,
                    top: element.y * zoom,
                    width: element.width * zoom,
                    height: element.height * zoom,
                    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                    backgroundColor: element.type === 'rectangle' ? element.properties.fillColor : undefined,
                    borderColor: element.type === 'rectangle' || element.type === 'line' ? element.properties.strokeColor : undefined,
                    borderWidth: element.type === 'rectangle' ? (element.properties.strokeWidth || 1) * zoom : undefined,
                    color: element.properties.color,
                    fontFamily: element.properties.fontFamily,
                    fontSize: (element.properties.fontSize || 12) * zoom,
                    fontWeight: element.properties.bold ? 'bold' : 'normal',
                    fontStyle: element.properties.italic ? 'italic' : 'normal',
                    textAlign: element.properties.textAlign,
                  }}
                  onMouseDown={(e) => handleElementMouseDown(e, element.id)}
                >
                  {element.type === 'text' && (
                    <span>{element.properties.dataField || element.properties.text}</span>
                  )}
                  {element.type === 'barcode' && (
                    <div className="barcode-container">
                      <BarcodeRenderer
                        value={element.properties.barcodeValue || '0000000000'}
                        format={(element.properties.barcodeType as any) || 'CODE128'}
                        height={(element.properties.barcodeHeight || 40) * zoom}
                        displayValue={element.properties.showText !== false}
                        fontSize={10 * zoom}
                      />
                    </div>
                  )}
                  {element.type === 'line' && (
                    <div
                      className="line-element"
                      style={{
                        backgroundColor: element.properties.strokeColor,
                        height: (element.properties.strokeWidth || 1) * zoom,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        {showPreviewPanel && (
          <div className="preview-panel-container">
            <PreviewPanel
              design={design}
              labelWidth={labelWidth}
              labelHeight={labelHeight}
              sampleData={SAMPLE_ITEM_DATA}
              zoom={0.8}
            />
          </div>
        )}

        {/* Right Panel - Properties */}
        <div className="properties-panel">
          <h3>Properties</h3>

          {/* Template Settings */}
          <div className="property-section">
            <h4>Template Settings</h4>
            <div className="property-row">
              <label>Name:</label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
              />
            </div>
            <div className="property-row">
              <label>Type:</label>
              <select
                value={labelType}
                onChange={(e) => setLabelType(Number(e.target.value) as LabelType)}
              >
                <option value={LabelType.ItemLabel}>Item Label</option>
                <option value={LabelType.ShelfTag}>Shelf Tag</option>
                <option value={LabelType.PriceLabel}>Price Label</option>
                <option value={LabelType.BarcodeLabel}>Barcode Label</option>
                <option value={LabelType.Custom}>Custom</option>
              </select>
            </div>
            <div className="property-row">
              <label>Preset:</label>
              <select onChange={(e) => {
                const preset = LABEL_PRESETS[Number(e.target.value)]
                if (preset) applyPreset(preset)
              }}>
                <option value="">Select preset...</option>
                {LABEL_PRESETS.map((p, i) => (
                  <option key={i} value={i}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="property-row">
              <label>Width (in):</label>
              <input
                type="number"
                step="0.125"
                value={labelWidth}
                onChange={(e) => setLabelWidth(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="property-row">
              <label>Height (in):</label>
              <input
                type="number"
                step="0.125"
                value={labelHeight}
                onChange={(e) => setLabelHeight(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="property-row">
              <label>Columns:</label>
              <input
                type="number"
                value={columnsPerPage}
                onChange={(e) => setColumnsPerPage(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="property-row">
              <label>Rows:</label>
              <input
                type="number"
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          {/* Element Properties */}
          {selectedElement && (
            <div className="property-section">
              <h4>Element Properties</h4>
              <div className="property-row">
                <label>X:</label>
                <input
                  type="number"
                  value={Math.round(selectedElement.x)}
                  onChange={(e) => updateElement(selectedElement.id, { x: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="property-row">
                <label>Y:</label>
                <input
                  type="number"
                  value={Math.round(selectedElement.y)}
                  onChange={(e) => updateElement(selectedElement.id, { y: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="property-row">
                <label>Width:</label>
                <input
                  type="number"
                  value={Math.round(selectedElement.width)}
                  onChange={(e) => updateElement(selectedElement.id, { width: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="property-row">
                <label>Height:</label>
                <input
                  type="number"
                  value={Math.round(selectedElement.height)}
                  onChange={(e) => updateElement(selectedElement.id, { height: parseFloat(e.target.value) || 0 })}
                />
              </div>

              {/* Text specific */}
              {selectedElement.type === 'text' && (
                <>
                  <div className="property-row">
                    <label>Text:</label>
                    <input
                      type="text"
                      value={selectedElement.properties.text || ''}
                      onChange={(e) => updateElementProperties(selectedElement.id, { text: e.target.value })}
                    />
                  </div>
                  <div className="property-row">
                    <label>Data Field:</label>
                    <select
                      value={selectedElement.properties.dataField || ''}
                      onChange={(e) => updateElementProperties(selectedElement.id, { dataField: e.target.value })}
                    >
                      <option value="">Static text</option>
                      {DATA_FIELDS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="property-row">
                    <label>Font Size:</label>
                    <input
                      type="number"
                      value={selectedElement.properties.fontSize || 12}
                      onChange={(e) => updateElementProperties(selectedElement.id, { fontSize: parseFloat(e.target.value) || 12 })}
                    />
                  </div>
                  <div className="property-row">
                    <label>Bold:</label>
                    <input
                      type="checkbox"
                      checked={selectedElement.properties.bold || false}
                      onChange={(e) => updateElementProperties(selectedElement.id, { bold: e.target.checked })}
                    />
                  </div>
                </>
              )}

              {/* Barcode specific */}
              {selectedElement.type === 'barcode' && (
                <>
                  <div className="property-row">
                    <label>Barcode Type:</label>
                    <select
                      value={selectedElement.properties.barcodeType || 'CODE128'}
                      onChange={(e) => updateElementProperties(selectedElement.id, { barcodeType: e.target.value as any })}
                    >
                      {BARCODE_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="property-row">
                    <label>Data Field:</label>
                    <select
                      value={selectedElement.properties.dataField || ''}
                      onChange={(e) => updateElementProperties(selectedElement.id, { dataField: e.target.value })}
                    >
                      <option value="">Static value</option>
                      {DATA_FIELDS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="property-row">
                    <label>Show Text:</label>
                    <input
                      type="checkbox"
                      checked={selectedElement.properties.showText || false}
                      onChange={(e) => updateElementProperties(selectedElement.id, { showText: e.target.checked })}
                    />
                  </div>
                </>
              )}

              {/* Rectangle/Line specific */}
              {(selectedElement.type === 'rectangle' || selectedElement.type === 'line') && (
                <>
                  <div className="property-row">
                    <label>Stroke Color:</label>
                    <input
                      type="color"
                      value={selectedElement.properties.strokeColor || '#000000'}
                      onChange={(e) => updateElementProperties(selectedElement.id, { strokeColor: e.target.value })}
                    />
                  </div>
                  <div className="property-row">
                    <label>Stroke Width:</label>
                    <input
                      type="number"
                      value={selectedElement.properties.strokeWidth || 1}
                      onChange={(e) => updateElementProperties(selectedElement.id, { strokeWidth: parseFloat(e.target.value) || 1 })}
                    />
                  </div>
                  {selectedElement.type === 'rectangle' && (
                    <div className="property-row">
                      <label>Fill Color:</label>
                      <input
                        type="color"
                        value={selectedElement.properties.fillColor || '#ffffff'}
                        onChange={(e) => updateElementProperties(selectedElement.id, { fillColor: e.target.value })}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast.show && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Print Preview Modal */}
      {showPrintPreview && currentTemplate && (
        <LabelPrintPreview
          template={{
            ...currentTemplate,
            labelWidth,
            labelHeight,
            columnsPerPage,
            rowsPerPage,
            marginLeft: 0.1875,
            marginTop: 0.5,
            horizontalGap: 0.125,
            verticalGap: 0,
            designJson: JSON.stringify(design),
          }}
          items={testItems}
          copies={1}
          onClose={() => setShowPrintPreview(false)}
        />
      )}

      {/* Print Preview for new (unsaved) template */}
      {showPrintPreview && !currentTemplate && (
        <LabelPrintPreview
          template={{
            id: 0,
            name: templateName || 'New Template',
            description: templateDescription,
            labelType,
            paperSize: PaperSize.Letter,
            labelWidth,
            labelHeight,
            columnsPerPage,
            rowsPerPage,
            marginLeft: 0.1875,
            marginTop: 0.5,
            horizontalGap: 0.125,
            verticalGap: 0,
            designJson: JSON.stringify(design),
            isDefault: false,
          }}
          items={testItems}
          copies={1}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  )
}

export default LabelDesignerPage
