import React, { useRef, useCallback } from 'react'
import BarcodeRenderer from './BarcodeRenderer'
import { LabelTemplate, LabelElement, LabelData, LabelDesign } from '../types'
import './LabelPrintPreview.css'

interface LabelPrintPreviewProps {
  template: LabelTemplate
  items: LabelData[]
  copies?: number
  onClose: () => void
}

const LabelPrintPreview: React.FC<LabelPrintPreviewProps> = ({
  template,
  items,
  copies = 1,
  onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null)

  let design: LabelDesign = { elements: [] }
  try {
    design = JSON.parse(template.designJson)
  } catch {
    console.error('Failed to parse design JSON')
  }

  const labels: LabelData[] = []
  items.forEach(item => {
    for (let i = 0; i < copies; i++) {
      labels.push(item)
    }
  })


  // Replace data field placeholders with actual values
  const replaceDataFields = (text: string, data: LabelData): string => {
    if (!text) return ''
    return text
      .replace(/\[BarcodeNumber\]/g, data.barcodeNumber || '')
      .replace(/\[Description\]/g, data.description || '')
      .replace(/\[Price\]/g, data.price?.toFixed(2) || '0.00')
      .replace(/\[PriceA\]/g, data.priceA?.toFixed(2) || '0.00')
      .replace(/\[PriceB\]/g, data.priceB?.toFixed(2) || '0.00')
      .replace(/\[Cost\]/g, data.cost?.toFixed(2) || '0.00')
      .replace(/\[Size\]/g, data.size || '')
      .replace(/\[Measure\]/g, data.measure || '')
      .replace(/\[ModelNo\]/g, data.modelNo || '')
      .replace(/\[StyleNo\]/g, data.styleNo || '')
      .replace(/\[Department\]/g, data.departmentName || '')
      .replace(/\[Manufacturer\]/g, data.manufacturerName || '')
      .replace(/\[ExtraInfo\]/g, data.extraInfo || '')
  }

  // Render single element with data
  const renderElement = (element: LabelElement, data: LabelData) => {
    const style: React.CSSProperties = {
      position: 'absolute',
      left: element.x,
      top: element.y,
      width: element.width,
      height: element.height,
      transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    }

    if (element.type === 'text') {
      const text = element.properties.dataField
        ? replaceDataFields(element.properties.dataField, data)
        : element.properties.text || ''

      return (
        <div
          key={element.id}
          style={{
            ...style,
            color: element.properties.color || '#000000',
            fontFamily: element.properties.fontFamily || 'Arial',
            fontSize: element.properties.fontSize || 12,
            fontWeight: element.properties.bold ? 'bold' : 'normal',
            fontStyle: element.properties.italic ? 'italic' : 'normal',
            textAlign: element.properties.textAlign || 'left',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          {text}
        </div>
      )
    }

    if (element.type === 'barcode') {
      const barcodeValue = element.properties.dataField
        ? replaceDataFields(element.properties.dataField, data)
        : element.properties.barcodeValue || '000000000'

      return (
        <div key={element.id} style={style}>
          <BarcodeRenderer
            value={barcodeValue}
            format={(element.properties.barcodeType as any) || 'CODE128'}
            height={element.properties.barcodeHeight || 40}
            displayValue={element.properties.showText !== false}
            fontSize={10}
          />
        </div>
      )
    }

    if (element.type === 'rectangle') {
      return (
        <div
          key={element.id}
          style={{
            ...style,
            backgroundColor: element.properties.fillColor || 'transparent',
            borderStyle: 'solid',
            borderColor: element.properties.strokeColor || '#000000',
            borderWidth: element.properties.strokeWidth || 1,
          }}
        />
      )
    }

    if (element.type === 'line') {
      return (
        <div
          key={element.id}
          style={{
            ...style,
            backgroundColor: element.properties.strokeColor || '#000000',
            height: element.properties.strokeWidth || 1,
          }}
        />
      )
    }

    return null
  }

  // Handle print
  const handlePrint = useCallback(() => {
    const printContent = printRef.current
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow popups to print labels')
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Labels</title>
          <style>
            @page {
              size: ${template.labelWidth}in ${template.labelHeight}in;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            .print-page {
              width: ${template.labelWidth}in;
              height: ${template.labelHeight}in;
              position: relative;
              page-break-after: always;
              box-sizing: border-box;
              overflow: hidden;
            }
            .print-page:last-child {
              page-break-after: auto;
            }
            .label-content {
              position: relative;
              width: 100%;
              height: 100%;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `)
    printWindow.document.close()

    // Wait for content to load before printing
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 500)
  }, [])

  return (
    <div className="print-preview-overlay">
      <div className="print-preview-container">
        <div className="print-preview-header">
          <h3>Print Preview</h3>
          <div className="print-preview-actions">
            <span className="print-info">
              {labels.length} label(s) — one label per page ({template.labelWidth}" × {template.labelHeight}")
            </span>
            <button className="btn-primary" onClick={handlePrint}>
              Print
            </button>
            <button className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="print-preview-scroll">
          <div ref={printRef}>
            {labels.map((labelData, pageIndex) => (
              <div
                key={pageIndex}
                className="print-page"
                style={{
                  width: `${template.labelWidth}in`,
                  height: `${template.labelHeight}in`,
                  position: 'relative',
                  backgroundColor: '#fff',
                  marginBottom: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  overflow: 'hidden',
                }}
              >
                <div className="label-content">
                  {design.elements.map(element =>
                    renderElement(element, labelData)
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LabelPrintPreview
