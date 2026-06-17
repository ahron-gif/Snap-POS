import { useCallback, useState, RefObject } from "react"
import { useExportNotification, ExportType } from "../components/common/ExportNotification"
import { exportToCSV, exportToPDF, exportToExcel, generatePDFBlob, Column, PDFExportOptions } from "../gridUtils"
import printViaAgent from "../services/print/printViaAgent"
import { DocumentType } from "../services/print/types"

interface UseExportHandlersOptions {
  columns: Column[]
  gridDataRef: RefObject<any[]>
  fetchAllData: () => Promise<any[]>
  filename: string
  pdfOptions?: PDFExportOptions
  documentType?: DocumentType
}

interface ExportHandlers {
  handleExportCSV: (exportAll: boolean) => Promise<void>
  handleExportPDF: (exportAll: boolean) => Promise<void>
  handleExportExcel: (exportAll: boolean) => Promise<void>
  handlePrint: (printAll: boolean) => Promise<void>
  isExporting: boolean
  isPrinting: boolean
}

export const useExportHandlers = ({
  columns,
  gridDataRef,
  fetchAllData,
  filename,
  pdfOptions,
  documentType,
}: UseExportHandlersOptions): ExportHandlers => {
  const [isExporting, setIsExporting] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const { startExport, updateExport, completeExport, failExport } = useExportNotification()

  const executeExport = useCallback(async (
    type: ExportType,
    exportAll: boolean,
    exportFn: (data: any[]) => void
  ) => {
    const notificationId = startExport(type)
    setIsExporting(true)

    try {
      updateExport(notificationId, "fetching", exportAll ? "Fetching all data..." : "Preparing current page data...")

      const data = exportAll ? await fetchAllData() : (gridDataRef.current || [])

      if (data.length === 0) {
        failExport(notificationId, "No data to export")
        return
      }

      updateExport(notificationId, "generating", `Generating ${type.toUpperCase()} with ${data.length.toLocaleString()} records...`, data.length)

      // Small delay to show the generating state
      await new Promise(resolve => setTimeout(resolve, 100))

      exportFn(data)

      completeExport(notificationId, data.length)
    } catch (error) {
      console.error(`Export ${type} error:`, error)
      failExport(notificationId, error instanceof Error ? error.message : `Failed to export ${type.toUpperCase()}`)
    } finally {
      setIsExporting(false)
    }
  }, [startExport, updateExport, completeExport, failExport, fetchAllData, gridDataRef])

  const handleExportCSV = useCallback(async (exportAll: boolean) => {
    await executeExport("csv", exportAll, (data) => {
      exportToCSV(data, filename, columns)
    })
  }, [executeExport, filename, columns])

  const handleExportPDF = useCallback(async (exportAll: boolean) => {
    await executeExport("pdf", exportAll, (data) => {
      exportToPDF(data, filename, columns, pdfOptions)
    })
  }, [executeExport, filename, columns, pdfOptions])

  const handleExportExcel = useCallback(async (exportAll: boolean) => {
    await executeExport("excel", exportAll, (data) => {
      exportToExcel(data, filename, columns)
    })
  }, [executeExport, filename, columns])

  const handlePrint = useCallback(async (printAll: boolean) => {
    const notificationId = startExport("print")
    setIsPrinting(true)

    try {
      updateExport(notificationId, "fetching", printAll ? "Fetching all data for print..." : "Preparing current page for print...")

      const data = printAll ? await fetchAllData() : (gridDataRef.current || [])

      if (data.length === 0) {
        failExport(notificationId, "No data to print")
        return
      }

      updateExport(notificationId, "generating", `Preparing print view with ${data.length.toLocaleString()} records...`, data.length)

      if (documentType) {
        try {
          const visibleFields = columns.filter(c => c.visible !== false).map(c => c.field)
          const pdfBlob = generatePDFBlob(data, columns, visibleFields, pdfOptions)
          const buffer = await pdfBlob.arrayBuffer()
          const agentOutcome = await printViaAgent({
            documentType,
            contentType: "pdf",
            payload: buffer,
            jobName: filename,
          })
          if (agentOutcome.agentUsed && agentOutcome.result?.success) {
            completeExport(notificationId, data.length)
            return
          }
          if (agentOutcome.agentUsed && !agentOutcome.result?.success) {
            failExport(notificationId, agentOutcome.error || "Print agent failed")
            return
          }
        } catch (agentErr) {
          console.warn("Print agent path failed, falling back to browser print", agentErr)
        }
      }

      const visibleColumns = columns.filter(col => col.visible !== false)
      const headers = visibleColumns.map(col => col.headerName)

      // Build rows
      const rows = data.map(item =>
        visibleColumns.map(col => {
          const value = item[col.field]
          if (col.dataType === "boolean") {
            if (value === null || value === undefined) return ""
            return value === 1 || value === true || value === "true" ? "Yes" : "No"
          }
          if (col.cellRenderer) {
            const rendered = col.cellRenderer(value, item)
            if (typeof rendered === "string" || typeof rendered === "number") {
              return String(rendered)
            }
            return String(value ?? "")
          }
          return String(value ?? "")
        })
      )

      const title = pdfOptions?.title || filename.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())
      const orientation = pdfOptions?.orientation === "landscape" ? "landscape" : "portrait"

      const html = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    @page { size: ${orientation}; margin: 10mm; }
    body { font-family: Arial, sans-serif; margin: 0; font-size: 10px; }
    h1 { text-align: center; margin: 0 0 12px; font-size: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
    th { background-color: #f5f5f5; font-weight: bold; }
    tr:nth-child(even) { background-color: #fafafa; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <table>
    <thead>
      <tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`

      const iframe = document.createElement("iframe")
      iframe.setAttribute("aria-hidden", "true")
      iframe.style.position = "fixed"
      iframe.style.right = "0"
      iframe.style.bottom = "0"
      iframe.style.width = "0"
      iframe.style.height = "0"
      iframe.style.border = "0"
      iframe.srcdoc = html

      const cleanup = () => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe)
        }
      }

      iframe.onload = () => {
        const win = iframe.contentWindow
        if (!win) {
          failExport(notificationId, "Failed to prepare print frame")
          cleanup()
          return
        }
        win.onafterprint = cleanup
        win.focus()
        win.print()
        completeExport(notificationId, data.length)
        setTimeout(cleanup, 10000)
      }

      document.body.appendChild(iframe)

    } catch (error) {
      console.error("Print error:", error)
      failExport(notificationId, error instanceof Error ? error.message : "Failed to print")
    } finally {
      setIsPrinting(false)
    }
  }, [startExport, updateExport, completeExport, failExport, fetchAllData, gridDataRef, columns, filename, pdfOptions])

  return {
    handleExportCSV,
    handleExportPDF,
    handleExportExcel,
    handlePrint,
    isExporting,
    isPrinting,
  }
}

export default useExportHandlers
