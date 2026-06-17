import React, { useMemo } from 'react'
import BarcodeRenderer from './BarcodeRenderer'
import { LabelElement, LabelDesign, LabelData, SAMPLE_ITEM_DATA, DATA_FIELD_CATEGORIES } from '../types'
import './PreviewPanel.css'

interface PreviewPanelProps {
  design: LabelDesign
  labelWidth: number
  labelHeight: number
  sampleData?: LabelData
  zoom?: number
}

const INCH_TO_PX = 96

const PreviewPanel: React.FC<PreviewPanelProps> = ({
  design,
  labelWidth,
  labelHeight,
  sampleData = SAMPLE_ITEM_DATA,
  zoom = 1,
}) => {
  // Get sample value for a data field
  const getSampleValue = (dataField: string): string => {
    if (!dataField) return ''

    // Check if it's a data field token
    if (!dataField.startsWith('[') || !dataField.endsWith(']')) {
      return dataField
    }

    // Find in categories
    for (const category of DATA_FIELD_CATEGORIES) {
      const field = category.fields.find(f => f.value === dataField)
      if (field) {
        return field.sampleValue
      }
    }

    // Fallback to actual data if available
    const fieldKey = dataField.slice(1, -1) // Remove [ and ]
    const mappedKey = fieldKey.charAt(0).toLowerCase() + fieldKey.slice(1)
    const value = (sampleData as any)[mappedKey]

    if (value !== undefined && value !== null) {
      if (typeof value === 'number') {
        // Format currency
        if (fieldKey.toLowerCase().includes('price') || fieldKey.toLowerCase().includes('cost')) {
          return `$${value.toFixed(2)}`
        }
        return value.toString()
      }
      return String(value)
    }

    return dataField
  }

  // Replace data field placeholders with sample values
  const replaceDataFields = (text: string): string => {
    if (!text) return ''

    // Replace all [FieldName] patterns
    return text.replace(/\[([^\]]+)\]/g, (match) => {
      return getSampleValue(match)
    })
  }

  // Memoize rendered elements for performance
  const renderedElements = useMemo(() => {
    return design.elements.map(element => {
      const style: React.CSSProperties = {
        position: 'absolute',
        left: element.x * zoom,
        top: element.y * zoom,
        width: element.width * zoom,
        height: element.height * zoom,
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
      }

      if (element.type === 'text') {
        const displayText = element.properties.dataField
          ? replaceDataFields(element.properties.dataField)
          : element.properties.text || ''

        return (
          <div
            key={element.id}
            className="preview-element preview-text"
            style={{
              ...style,
              color: element.properties.color || '#000000',
              fontFamily: element.properties.fontFamily || 'Arial',
              fontSize: (element.properties.fontSize || 12) * zoom,
              fontWeight: element.properties.bold ? 'bold' : 'normal',
              fontStyle: element.properties.italic ? 'italic' : 'normal',
              textAlign: element.properties.textAlign || 'left',
            }}
          >
            {displayText}
          </div>
        )
      }

      if (element.type === 'barcode') {
        const barcodeValue = element.properties.dataField
          ? replaceDataFields(element.properties.dataField)
          : element.properties.barcodeValue || '0000000000'

        // Clean barcode value (remove $ and other non-numeric for certain types)
        const cleanValue = barcodeValue.replace(/[^a-zA-Z0-9]/g, '') || '0000000000'

        return (
          <div key={element.id} className="preview-element preview-barcode" style={style}>
            <BarcodeRenderer
              value={cleanValue}
              format={(element.properties.barcodeType as any) || 'CODE128'}
              height={(element.properties.barcodeHeight || 40) * zoom}
              displayValue={element.properties.showText !== false}
              fontSize={10 * zoom}
            />
          </div>
        )
      }

      if (element.type === 'rectangle') {
        return (
          <div
            key={element.id}
            className="preview-element preview-rectangle"
            style={{
              ...style,
              backgroundColor: element.properties.fillColor || 'transparent',
              borderStyle: 'solid',
              borderColor: element.properties.strokeColor || '#000000',
              borderWidth: (element.properties.strokeWidth || 1) * zoom,
            }}
          />
        )
      }

      if (element.type === 'line') {
        return (
          <div
            key={element.id}
            className="preview-element preview-line"
            style={{
              ...style,
              backgroundColor: element.properties.strokeColor || '#000000',
              height: (element.properties.strokeWidth || 1) * zoom,
            }}
          />
        )
      }

      return null
    })
  }, [design.elements, zoom, sampleData])

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <h4>Live Preview</h4>
        <span className="preview-size">
          {labelWidth}" × {labelHeight}"
        </span>
      </div>

      <div className="preview-container">
        <div className="preview-label-wrapper">
          <div
            className="preview-label"
            style={{
              width: labelWidth * INCH_TO_PX * zoom,
              height: labelHeight * INCH_TO_PX * zoom,
              backgroundColor: design.backgroundColor || '#ffffff',
              border: design.showBorder ? `1px solid ${design.borderColor || '#000'}` : '1px dashed #ccc',
            }}
          >
            {renderedElements}
          </div>
        </div>
      </div>

      <div className="preview-footer">
        <div className="preview-data-info">
          <span className="data-label">Sample Data:</span>
          <span className="data-value">{sampleData.description}</span>
        </div>
        <div className="preview-hint">
          Fields show sample values
        </div>
      </div>
    </div>
  )
}

export default PreviewPanel
