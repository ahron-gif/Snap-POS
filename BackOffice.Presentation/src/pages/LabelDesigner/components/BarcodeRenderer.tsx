import React, { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

interface BarcodeRendererProps {
  value: string
  format: 'CODE128' | 'EAN13' | 'UPC' | 'CODE39' | 'ITF' | 'QR'
  width?: number
  height?: number
  displayValue?: boolean
  fontSize?: number
  textAlign?: 'left' | 'center' | 'right'
  textMargin?: number
  margin?: number
  background?: string
  lineColor?: string
}

const BarcodeRenderer: React.FC<BarcodeRendererProps> = ({
  value,
  format,
  width = 2,
  height = 50,
  displayValue = true,
  fontSize = 12,
  textAlign = 'center',
  textMargin = 2,
  margin = 5,
  background = '#ffffff',
  lineColor = '#000000',
}) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        // Validate and format value based on barcode type
        let formattedValue = value
        let validFormat = format

        // Handle format-specific validation
        if (format === 'EAN13') {
          // EAN13 requires exactly 12 or 13 digits
          formattedValue = value.replace(/\D/g, '').padStart(12, '0').slice(0, 13)
          if (formattedValue.length < 12) {
            validFormat = 'CODE128' // Fallback
          }
        } else if (format === 'UPC') {
          // UPC-A requires exactly 11 or 12 digits
          formattedValue = value.replace(/\D/g, '').padStart(11, '0').slice(0, 12)
          if (formattedValue.length < 11) {
            validFormat = 'CODE128' // Fallback
          }
        } else if (format === 'ITF') {
          // ITF requires even number of digits
          formattedValue = value.replace(/\D/g, '')
          if (formattedValue.length % 2 !== 0) {
            formattedValue = '0' + formattedValue
          }
          if (formattedValue.length < 2) {
            validFormat = 'CODE128' // Fallback
          }
        }

        // QR codes not supported by JsBarcode, use CODE128 as fallback
        if (format === 'QR') {
          validFormat = 'CODE128'
        }

        JsBarcode(svgRef.current, formattedValue, {
          format: validFormat,
          width,
          height,
          displayValue,
          fontSize,
          textAlign,
          textMargin,
          margin,
          background,
          lineColor,
          valid: () => true, // Skip validation to avoid errors
        })
      } catch (error) {
        console.error('Barcode generation error:', error)
        // On error, try CODE128 as fallback
        try {
          JsBarcode(svgRef.current, value || '0000000', {
            format: 'CODE128',
            width,
            height,
            displayValue,
            fontSize,
            textAlign,
            textMargin,
            margin,
            background,
            lineColor,
          })
        } catch {
          // Silently fail
        }
      }
    }
  }, [value, format, width, height, displayValue, fontSize, textAlign, textMargin, margin, background, lineColor])

  return (
    <svg
      ref={svgRef}
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  )
}

export default BarcodeRenderer
