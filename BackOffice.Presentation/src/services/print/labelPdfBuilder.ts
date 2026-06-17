import jsPDF from "jspdf"
import JsBarcode from "jsbarcode"
import { LabelTemplate, LabelData, LabelDesign, LabelElement } from "../../pages/LabelDesigner/types"

const PX_PER_INCH = 96

function pxToIn(px: number): number {
  return px / PX_PER_INCH
}

function replaceDataFields(text: string, data: LabelData): string {
  if (!text) return ""
  return text
    .replace(/\[BarcodeNumber\]/g, data.barcodeNumber || "")
    .replace(/\[Description\]/g, data.description || "")
    .replace(/\[Price\]/g, data.price?.toFixed(2) || "0.00")
    .replace(/\[PriceA\]/g, data.priceA?.toFixed(2) || "0.00")
    .replace(/\[PriceB\]/g, data.priceB?.toFixed(2) || "0.00")
    .replace(/\[Cost\]/g, data.cost?.toFixed(2) || "0.00")
    .replace(/\[Size\]/g, data.size || "")
    .replace(/\[Measure\]/g, data.measure || "")
    .replace(/\[ModelNo\]/g, data.modelNo || "")
    .replace(/\[StyleNo\]/g, data.styleNo || "")
    .replace(/\[Department\]/g, data.departmentName || "")
    .replace(/\[Manufacturer\]/g, data.manufacturerName || "")
    .replace(/\[ExtraInfo\]/g, data.extraInfo || "")
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = (hex || "#000000").replace("#", "")
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value
  const num = parseInt(full, 16)
  if (Number.isNaN(num)) return { r: 0, g: 0, b: 0 }
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

function renderBarcodeToDataUrl(value: string, format: string, widthIn: number, heightIn: number, displayValue: boolean): string {
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(widthIn * 300))
  canvas.height = Math.max(1, Math.round(heightIn * 300))
  let formattedValue = value || "0000000"
  let validFormat = format
  if (format === "EAN13") {
    formattedValue = formattedValue.replace(/\D/g, "").padStart(12, "0").slice(0, 13)
    if (formattedValue.length < 12) validFormat = "CODE128"
  } else if (format === "UPC") {
    formattedValue = formattedValue.replace(/\D/g, "").padStart(11, "0").slice(0, 12)
    if (formattedValue.length < 11) validFormat = "CODE128"
  } else if (format === "QR") {
    validFormat = "CODE128"
  }
  try {
    JsBarcode(canvas, formattedValue, {
      format: validFormat,
      displayValue,
      margin: 0,
      width: 2,
      height: Math.max(20, Math.round(heightIn * 240)),
      fontSize: Math.max(10, Math.round(heightIn * 30)),
      valid: () => true,
    } as JsBarcode.Options)
  } catch {
    try {
      JsBarcode(canvas, formattedValue, { format: "CODE128", displayValue, margin: 0 })
    } catch {
      /* ignore */
    }
  }
  return canvas.toDataURL("image/png")
}

function renderElement(doc: jsPDF, element: LabelElement, data: LabelData): void {
  const xIn = pxToIn(element.x)
  const yIn = pxToIn(element.y)
  const wIn = pxToIn(element.width)
  const hIn = pxToIn(element.height)

  if (element.type === "text") {
    const raw = element.properties.dataField || element.properties.text || ""
    const text = element.properties.dataField ? replaceDataFields(raw, data) : raw
    if (!text) return
    const fontSizePt = element.properties.fontSize || 12
    const color = hexToRgb(element.properties.color || "#000000")
    let fontStyle: "normal" | "bold" | "italic" | "bolditalic" = "normal"
    if (element.properties.bold && element.properties.italic) fontStyle = "bolditalic"
    else if (element.properties.bold) fontStyle = "bold"
    else if (element.properties.italic) fontStyle = "italic"
    doc.setFont("helvetica", fontStyle)
    doc.setFontSize(fontSizePt)
    doc.setTextColor(color.r, color.g, color.b)
    const align = (element.properties.textAlign || "left") as "left" | "center" | "right"
    const textX = align === "center" ? xIn + wIn / 2 : align === "right" ? xIn + wIn : xIn
    const baselineY = yIn + (fontSizePt / 72) * 0.85
    doc.text(text, textX, baselineY, { align, maxWidth: wIn })
    return
  }

  if (element.type === "barcode") {
    const raw = element.properties.dataField || element.properties.barcodeValue || "0000000"
    const value = element.properties.dataField ? replaceDataFields(raw, data) : raw
    const format = element.properties.barcodeType || "CODE128"
    const showText = element.properties.showText !== false
    const dataUrl = renderBarcodeToDataUrl(value, format, wIn, hIn, showText)
    doc.addImage(dataUrl, "PNG", xIn, yIn, wIn, hIn, undefined, "FAST")
    return
  }

  if (element.type === "rectangle") {
    const stroke = hexToRgb(element.properties.strokeColor || "#000000")
    const fill = element.properties.fillColor && element.properties.fillColor !== "transparent"
      ? hexToRgb(element.properties.fillColor)
      : null
    doc.setDrawColor(stroke.r, stroke.g, stroke.b)
    doc.setLineWidth(pxToIn(element.properties.strokeWidth || 1))
    if (fill) {
      doc.setFillColor(fill.r, fill.g, fill.b)
      doc.rect(xIn, yIn, wIn, hIn, "FD")
    } else {
      doc.rect(xIn, yIn, wIn, hIn, "S")
    }
    return
  }

  if (element.type === "line") {
    const color = hexToRgb(element.properties.strokeColor || "#000000")
    doc.setDrawColor(color.r, color.g, color.b)
    doc.setLineWidth(pxToIn(element.properties.strokeWidth || 1))
    doc.line(xIn, yIn, xIn + wIn, yIn + hIn)
  }
}

export function buildLabelPdf(template: LabelTemplate, items: LabelData[], copies: number): ArrayBuffer {
  const labels: LabelData[] = []
  items.forEach((item) => {
    for (let i = 0; i < copies; i++) labels.push(item)
  })
  if (labels.length === 0) {
    const empty = new jsPDF({ unit: "in", format: [template.labelWidth, template.labelHeight] })
    return empty.output("arraybuffer")
  }

  let design: LabelDesign = { elements: [] }
  try {
    design = JSON.parse(template.designJson)
  } catch {
    /* empty design */
  }

  const widthIn = template.labelWidth
  const heightIn = template.labelHeight
  const orientation: "landscape" | "portrait" = widthIn >= heightIn ? "landscape" : "portrait"

  const doc = new jsPDF({ unit: "in", format: [widthIn, heightIn], orientation })

  labels.forEach((label, idx) => {
    if (idx > 0) doc.addPage([widthIn, heightIn], orientation)
    design.elements.forEach((element) => renderElement(doc, element, label))
  })

  return doc.output("arraybuffer")
}
