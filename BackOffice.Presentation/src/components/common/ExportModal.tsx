import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import Flatpickr from "react-flatpickr"
import "flatpickr/dist/themes/light.css"
import {
  Column,
  PDFExportOptions,
  generatePDFBlob,
  exportToCSVWithColumns,
  exportToExcelWithColumns,
} from "../../gridUtils"
import { useExportNotification, ExportType } from "./ExportNotification"
import printViaAgent from "../../services/print/printViaAgent"
import printerMappings from "../../services/print/printerMappings"
import printAgentClient from "../../services/print/PrintAgentClient"
import type { DocumentType } from "../../services/print/types"

// All report/list Print jobs from this modal resolve to the single "report"
// printer mapping configured in Printer Settings (/settings/printer-settings).
const PRINT_DOC_TYPE: DocumentType = "report"

// "Print to PDF / Save as PDF" virtual printers — printing to one of these should
// just generate the PDF file silently (no browser print dialog, no Windows
// "Save As" prompt, no print agent needed).
const isPdfPrinter = (name?: string | null): boolean => !!name && /pdf/i.test(name)

// --- Types ---

export interface ExportFilter {
  type: "dateRange" | "select" | "text"
  field: string
  label: string
  defaultFrom?: string
  defaultTo?: string
  options?: { value: string; label: string }[]
  placeholder?: string
}

export interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  columns: Column[]
  data?: any[]
  fetchData?: (dateFrom?: string, dateTo?: string) => Promise<any[]>
  filters?: ExportFilter[]
  filename?: string
  pdfOptions?: PDFExportOptions
  onBeforeExport?: (data: any[], format: string) => any[]
  renderCustomFilters?: () => React.ReactNode
}

// --- Icons ---

const CalendarIcon = () => (
  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const PrintIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
)

const SpinnerIcon = () => (
  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)

// --- Component ---

const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  columns,
  data: externalData,
  fetchData,
  filters,
  filename = "export",
  pdfOptions,
  onBeforeExport,
  renderCustomFilters,
}) => {
  // State
  const [filterValues, setFilterValues] = useState<Record<string, any>>({})
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set())
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape")
  const [pageSize, setPageSize] = useState<"a3" | "a4" | "a5" | "letter" | "legal">("a4")
  const [isExporting, setIsExporting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const prevBlobUrlRef = useRef<string | null>(null)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filterValuesRef = useRef<Record<string, any>>({})
  const selectedColumnsRef = useRef<Set<string>>(new Set())
  const { startExport, updateExport, completeExport, failExport } = useExportNotification()

  // Keep refs in sync with state so async callbacks always read latest values
  useEffect(() => { filterValuesRef.current = filterValues }, [filterValues])
  useEffect(() => { selectedColumnsRef.current = selectedColumns }, [selectedColumns])

  // Get available (non-action) columns
  const availableColumns = useMemo(
    () => columns.filter((col) => col.field !== "actions" && col.dataType !== "actions" && col.visible !== false),
    [columns]
  )

  // Initialize state on open
  useEffect(() => {
    if (isOpen) {
      const initialColumns = new Set(availableColumns.map((col) => col.field))
      setSelectedColumns(initialColumns)
      selectedColumnsRef.current = initialColumns

      const defaults: Record<string, any> = {}
      filters?.forEach((f) => {
        if (f.type === "dateRange") {
          // Default to last 1 week range
          const today = new Date()
          const oneWeekAgo = new Date()
          oneWeekAgo.setDate(today.getDate() - 7)
          defaults[`${f.field}_from`] = f.defaultFrom || oneWeekAgo.toISOString().split("T")[0]
          defaults[`${f.field}_to`] = f.defaultTo || today.toISOString().split("T")[0]
        }
      })
      setFilterValues(defaults)
      filterValuesRef.current = defaults

      setOrientation("landscape")
      setPageSize("a4")
    } else {
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current)
        prevBlobUrlRef.current = null
      }
      setPreviewUrl(null)
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedColumnFields = useMemo(() => Array.from(selectedColumns), [selectedColumns])

  // Date range is a required field — block exports until both From and To are set.
  const missingDateRange = useMemo(() => {
    if (!filters || filters.length === 0) return false
    return filters.some((f) => {
      if (f.type !== "dateRange") return false
      const from = filterValues[`${f.field}_from`]
      const to = filterValues[`${f.field}_to`]
      return !from || !to
    })
  }, [filters, filterValues])

  // Safety net: if a date-range value ever becomes empty (e.g. Flatpickr's
  // display goes out of sync with React state), auto-restore the last valid
  // date or the default range. This guarantees the user can never end up
  // with empty date inputs while the modal is open.
  useEffect(() => {
    if (!isOpen || !filters || filters.length === 0) return
    const patch: Record<string, any> = {}
    let needsPatch = false
    filters.forEach((f) => {
      if (f.type !== "dateRange") return
      const fromKey = `${f.field}_from`
      const toKey = `${f.field}_to`
      if (!filterValues[fromKey]) {
        const today = new Date()
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(today.getDate() - 7)
        patch[fromKey] = f.defaultFrom || oneWeekAgo.toISOString().split("T")[0]
        needsPatch = true
      }
      if (!filterValues[toKey]) {
        patch[toKey] = f.defaultTo || new Date().toISOString().split("T")[0]
        needsPatch = true
      }
    })
    if (needsPatch) {
      const updated = { ...filterValues, ...patch }
      filterValuesRef.current = updated
      setFilterValues(updated)
    }
  }, [isOpen, filters, filterValues])

  // Generate static sample data for preview (no API call)
  const samplePreviewData = useMemo(() => {
    const selected = availableColumns.filter((col) => selectedColumnFields.includes(col.field))
    if (selected.length === 0) return []

    // Generate 8 sample rows with realistic placeholder values per column type
    const rows: Record<string, any>[] = []
    for (let i = 1; i <= 8; i++) {
      const row: Record<string, any> = {}
      selected.forEach((col) => {
        switch (col.dataType) {
          case "number":
            row[col.field] = Math.round(Math.random() * 1000 * 100) / 100
            break
          case "boolean":
            row[col.field] = i % 2 === 0
            break
          case "date":
            row[col.field] = new Date(2025, 0, i).toISOString()
            break
          case "datetime":
            row[col.field] = new Date(2025, 0, i, 9 + i, i * 5).toISOString()
            break
          default:
            row[col.field] = `${col.headerName} ${i}`
        }
      })
      rows.push(row)
    }
    return rows
  }, [availableColumns, selectedColumnFields])

  // Debounced preview generation using static sample data
  useEffect(() => {
    if (!isOpen || selectedColumnFields.length === 0) {
      setPreviewUrl(null)
      return
    }

    if (previewTimerRef.current) clearTimeout(previewTimerRef.current)

    previewTimerRef.current = setTimeout(() => {
      generatePreview()
    }, 300)

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    }
  }, [samplePreviewData, selectedColumnFields, orientation, pageSize, isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const generatePreview = useCallback(() => {
    if (samplePreviewData.length === 0 || selectedColumnFields.length === 0) return
    try {
      setIsGeneratingPreview(true)
      const blob = generatePDFBlob(samplePreviewData, availableColumns, selectedColumnFields, {
        ...pdfOptions,
        orientation,
        pageSize,
      })

      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current)
      }

      const url = URL.createObjectURL(blob)
      prevBlobUrlRef.current = url
      setPreviewUrl(url + "#navpanes=0&toolbar=0&view=FitH")
    } catch (err) {
      console.error("Preview generation failed:", err)
    } finally {
      setIsGeneratingPreview(false)
    }
  }, [samplePreviewData, availableColumns, selectedColumnFields, orientation, pageSize, pdfOptions])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (prevBlobUrlRef.current) {
        URL.revokeObjectURL(prevBlobUrlRef.current)
      }
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    }
  }, [])

  // --- Fetch + filter data at export time ---

  const fetchAndFilterData = useCallback(async (): Promise<any[]> => {
    let data: any[] = []

    // Read latest filter values from ref (avoids stale closure issue)
    const currentFilterValues = filterValuesRef.current
    const dateFilter = filters?.find((f) => f.type === "dateRange")
    const dateFrom = dateFilter ? currentFilterValues[`${dateFilter.field}_from`] : undefined
    const dateTo = dateFilter ? currentFilterValues[`${dateFilter.field}_to`] : undefined

    // Fetch data — forward the modal's current date range so the backend
    // can filter server-side instead of us pulling the entire dataset.
    if (externalData) {
      data = externalData
    } else if (fetchData) {
      data = await fetchData(dateFrom, dateTo)
    }

    // Apply client-side filters (date range, select, text)
    if (filters && filters.length > 0) {
      data = data.filter((row) => {
        for (const filter of filters) {
          if (filter.type === "dateRange") {
            const fromVal = currentFilterValues[`${filter.field}_from`]
            const toVal = currentFilterValues[`${filter.field}_to`]
            if (!fromVal && !toVal) continue

            const dateValue = row[filter.field]
            // If the row has no value for the configured date field, the filter
            // cannot make a meaningful decision — skip it instead of dropping
            // the row. This protects pivot / summary reports whose rows don't
            // carry a per-row date (the backend already scoped the result by
            // date via `fetchData(dateFrom, dateTo)`). Previously, any caller
            // that passed a `dateField` not present on the rows would have every
            // row dropped → "No data found for the selected date range filter"
            // despite the grid clearly showing rows.
            if (!dateValue) continue
            const rowDate = new Date(dateValue)
            if (isNaN(rowDate.getTime())) continue

            if (fromVal) {
              const fromDate = new Date(fromVal)
              fromDate.setHours(0, 0, 0, 0)
              if (rowDate < fromDate) return false
            }
            if (toVal) {
              const endDate = new Date(toVal)
              endDate.setHours(23, 59, 59, 999)
              if (rowDate > endDate) return false
            }
          } else if (filter.type === "select") {
            const val = currentFilterValues[filter.field]
            if (!val) continue
            if (String(row[filter.field]) !== String(val)) return false
          } else if (filter.type === "text") {
            const val = currentFilterValues[filter.field]
            if (!val) continue
            if (!String(row[filter.field] || "").toLowerCase().includes(val.toLowerCase())) return false
          }
        }
        return true
      })
    }

    // Strip to selected columns only (read from ref for latest)
    const fields = Array.from(selectedColumnsRef.current)
    data = data.map((row) => {
      const newRow: Record<string, any> = {}
      fields.forEach((field) => {
        newRow[field] = row[field]
      })
      return newRow
    })

    if (onBeforeExport) {
      data = onBeforeExport(data, "export")
    }

    return data
  }, [externalData, fetchData, filters, onBeforeExport])

  // --- Export handlers ---

  // Generate the report PDF and save it as a file — no print dialog, no agent.
  // Shared by the "Download PDF" button and the silent print-to-PDF path.
  const downloadPdfFile = useCallback(async (notifType: ExportType) => {
    const id = startExport(notifType)
    setIsExporting(true)
    try {
      updateExport(id, "fetching", "Fetching data...")
      const data = await fetchAndFilterData()

      if (!data.length) {
        failExport(id, "No data found for the selected date range filter")
        return
      }

      updateExport(id, "generating", `Generating PDF with ${data.length.toLocaleString()} records...`, data.length)
      await new Promise((r) => setTimeout(r, 50))

      const blob = generatePDFBlob(data, availableColumns, selectedColumnFields, {
        ...pdfOptions,
        orientation,
        pageSize,
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${filename}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      completeExport(id, data.length)
    } catch (err) {
      failExport(id, err instanceof Error ? err.message : "PDF export failed")
    } finally {
      setIsExporting(false)
    }
  }, [fetchAndFilterData, availableColumns, selectedColumnFields, pdfOptions, orientation, pageSize, filename, startExport, updateExport, completeExport, failExport])

  const handleDownloadPDF = useCallback(() => downloadPdfFile("pdf"), [downloadPdfFile])

  // Generate the report PDF and let the user choose WHERE to save it via the native
  // OS "Save As" dialog (File System Access API). No browser print preview. Falls back
  // to a normal download (Downloads folder) on browsers without showSaveFilePicker.
  const savePdfViaPicker = useCallback(async (notifType: ExportType) => {
    // Request the file handle FIRST — while the click still has user activation
    // (calling it after an await would be rejected for lacking a user gesture).
    const picker = (window as unknown as { showSaveFilePicker?: (opts: unknown) => Promise<any> }).showSaveFilePicker
    let handle: any = null
    if (typeof picker === "function") {
      try {
        handle = await picker({
          suggestedName: `${filename}.pdf`,
          types: [{ description: "PDF Document", accept: { "application/pdf": [".pdf"] } }],
        })
      } catch (e: any) {
        if (e?.name === "AbortError") return // user cancelled the Save dialog → stop quietly
        handle = null // unsupported / denied → fall back to download below
      }
    }

    const id = startExport(notifType)
    setIsExporting(true)
    try {
      updateExport(id, "fetching", "Fetching data...")
      const data = await fetchAndFilterData()

      if (!data.length) {
        failExport(id, "No data found for the selected date range filter")
        return
      }

      updateExport(id, "generating", `Generating PDF with ${data.length.toLocaleString()} records...`, data.length)
      await new Promise((r) => setTimeout(r, 50))

      const blob = generatePDFBlob(data, availableColumns, selectedColumnFields, {
        ...pdfOptions,
        orientation,
        pageSize,
      })

      if (handle) {
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
      } else {
        // Fallback: download to the Downloads folder (no picker available).
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `${filename}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }

      completeExport(id, data.length)
    } catch (err) {
      failExport(id, err instanceof Error ? err.message : "PDF export failed")
    } finally {
      setIsExporting(false)
    }
  }, [fetchAndFilterData, availableColumns, selectedColumnFields, pdfOptions, orientation, pageSize, filename, startExport, updateExport, completeExport, failExport])

  const handleDownloadCSV = useCallback(async () => {
    const id = startExport("csv")
    setIsExporting(true)
    try {
      updateExport(id, "fetching", "Fetching data...")
      const data = await fetchAndFilterData()

      if (!data.length) {
        failExport(id, "No data found for the selected date range filter")
        return
      }

      updateExport(id, "generating", `Generating CSV with ${data.length.toLocaleString()} records...`, data.length)
      await new Promise((r) => setTimeout(r, 50))

      exportToCSVWithColumns(data, filename, availableColumns, selectedColumnFields)
      completeExport(id, data.length)
    } catch (err) {
      failExport(id, err instanceof Error ? err.message : "CSV export failed")
    } finally {
      setIsExporting(false)
    }
  }, [fetchAndFilterData, filename, availableColumns, selectedColumnFields, startExport, updateExport, completeExport, failExport])

  const handleDownloadExcel = useCallback(async () => {
    const id = startExport("excel")
    setIsExporting(true)
    try {
      updateExport(id, "fetching", "Fetching data...")
      const data = await fetchAndFilterData()

      if (!data.length) {
        failExport(id, "No data found for the selected date range filter")
        return
      }

      updateExport(id, "generating", `Generating Excel with ${data.length.toLocaleString()} records...`, data.length)
      await new Promise((r) => setTimeout(r, 50))

      exportToExcelWithColumns(data, filename, availableColumns, selectedColumnFields)
      completeExport(id, data.length)
    } catch (err) {
      failExport(id, err instanceof Error ? err.message : "Excel export failed")
    } finally {
      setIsExporting(false)
    }
  }, [fetchAndFilterData, filename, availableColumns, selectedColumnFields, startExport, updateExport, completeExport, failExport])

  // --- Direct-to-printer (Print Agent) ---
  // Probe the local Print Agent once when the modal opens so handlePrint can
  // decide SYNCHRONOUSLY at click time whether to print directly (no window.open),
  // which keeps the browser-print fallback inside the user gesture (no popup block).
  const [agentReady, setAgentReady] = useState(false)
  // Lower-cased names of printers the agent currently sees — used to tell whether a
  // mapped real printer is actually attached (decided synchronously at click time).
  const [availablePrinters, setAvailablePrinters] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!isOpen) {
      setAgentReady(false)
      setAvailablePrinters(new Set())
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const health = await printAgentClient.health()
        if (cancelled) return
        const paired = !!health?.isPaired
        setAgentReady(paired)
        if (paired) {
          try {
            const list = await printAgentClient.listPrinters()
            if (!cancelled) setAvailablePrinters(new Set(list.map((p) => p.name.toLowerCase())))
          } catch {
            if (!cancelled) setAvailablePrinters(new Set())
          }
        } else {
          setAvailablePrinters(new Set())
        }
      } catch {
        if (!cancelled) {
          setAgentReady(false)
          setAvailablePrinters(new Set())
        }
      }
    })()
    return () => { cancelled = true }
  }, [isOpen])

  // Resolve what the Print button will do, from the "report" printer mapping:
  //   - empty            → "Use browser print dialog" (the blank option in Printer Settings)
  //   - PDF-type printer → save PDF to a chosen folder
  //   - real printer attached (in the agent's list) → print directly  ("Print → <printer>")
  //   - real printer NOT attached / no agent        → save PDF to a chosen folder
  const mappedPrinter = printerMappings.get(PRINT_DOC_TYPE) || null
  const printerAttached =
    !!mappedPrinter && !isPdfPrinter(mappedPrinter) && agentReady && availablePrinters.has(mappedPrinter.toLowerCase())
  const printDestination = printerAttached ? mappedPrinter : null
  const printTooltip = !mappedPrinter
    ? "Print via the browser print dialog"
    : printerAttached
    ? `Print to ${mappedPrinter}`
    : isPdfPrinter(mappedPrinter)
    ? "Save as PDF (choose a folder)"
    : "Save as PDF (printer not available)"

  // Browser print dialog — used only when no printer is mapped (the explicit
  // "Use browser print dialog" choice). window.open runs synchronously from the
  // click (the branch is decided without an await) so it isn't popup-blocked.
  const printViaBrowserDialog = useCallback(async () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      const id = startExport("print")
      failExport(id, "Could not open print window. Please allow popups for this site.")
      return
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Loading...</title>
        <style>body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; color: #666; }</style>
      </head><body><div><p style="font-size: 18px;">Loading data for print...</p></div></body></html>
    `)

    const notificationId = startExport("print")
    setIsExporting(true)
    try {
      updateExport(notificationId, "fetching", "Fetching all data for print...")

      const currentFilterValues = filterValuesRef.current
      const dateFilter = filters?.find((f) => f.type === "dateRange")
      const printDateFrom = dateFilter ? currentFilterValues[`${dateFilter.field}_from`] : undefined
      const printDateTo = dateFilter ? currentFilterValues[`${dateFilter.field}_to`] : undefined

      let rawData: any[] = []
      if (externalData) rawData = externalData
      else if (fetchData) rawData = await fetchData(printDateFrom, printDateTo)

      if (filters && filters.length > 0) {
        rawData = rawData.filter((row) => {
          for (const filter of filters) {
            if (filter.type === "dateRange") {
              const fromVal = currentFilterValues[`${filter.field}_from`]
              const toVal = currentFilterValues[`${filter.field}_to`]
              if (!fromVal && !toVal) continue
              const dateValue = row[filter.field]
              if (!dateValue) continue
              const rowDate = new Date(dateValue)
              if (isNaN(rowDate.getTime())) continue
              if (fromVal) { const d = new Date(fromVal); d.setHours(0, 0, 0, 0); if (rowDate < d) return false }
              if (toVal) { const d = new Date(toVal); d.setHours(23, 59, 59, 999); if (rowDate > d) return false }
            } else if (filter.type === "select") {
              const val = currentFilterValues[filter.field]
              if (!val) continue
              if (String(row[filter.field]) !== String(val)) return false
            } else if (filter.type === "text") {
              const val = currentFilterValues[filter.field]
              if (!val) continue
              if (!String(row[filter.field] || "").toLowerCase().includes(val.toLowerCase())) return false
            }
          }
          return true
        })
      }

      if (rawData.length === 0) {
        printWindow.close()
        failExport(notificationId, "No data found for the selected date range filter")
        return
      }

      updateExport(notificationId, "generating", `Preparing print view with ${rawData.length.toLocaleString()} records...`, rawData.length)

      const currentSelectedFields = Array.from(selectedColumnsRef.current)
      const visibleColumns = columns.filter((col) => col.visible !== false && currentSelectedFields.includes(col.field))
      const headers = visibleColumns.map((col) => col.headerName)
      const rows = rawData.map((item) =>
        visibleColumns.map((col) => {
          const value = item[col.field]
          if (col.dataType === "boolean") {
            if (value === null || value === undefined) return ""
            return value === 1 || value === true || value === "true" ? "Yes" : "No"
          }
          if (col.cellRenderer) {
            const rendered = col.cellRenderer(value, item)
            if (typeof rendered === "string" || typeof rendered === "number") return String(rendered)
            return String(value ?? "")
          }
          return String(value ?? "")
        })
      )
      const title = pdfOptions?.title || filename.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())

      printWindow.document.open()
      printWindow.document.write(`
        <!DOCTYPE html>
        <html><head><title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 10px; }
            h1 { text-align: center; margin-bottom: 20px; font-size: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #fafafa; }
            @media print { body { margin: 0; } h1 { margin-top: 0; } }
          </style>
        </head><body>
          <h1>${title}</h1>
          <table>
            <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
            <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
          </table>
        </body></html>
      `)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
        completeExport(notificationId, rawData.length)
      }, 250)
    } catch (error) {
      console.error("Print error:", error)
      printWindow.close()
      failExport(notificationId, error instanceof Error ? error.message : "Failed to print")
    } finally {
      setIsExporting(false)
    }
  }, [externalData, fetchData, filters, columns, pdfOptions, filename, startExport, updateExport, completeExport, failExport])

  const handlePrint = useCallback(async () => {
    const mapped = printerMappings.get(PRINT_DOC_TYPE)

    // 1) No printer mapped → the "Use browser print dialog" choice.
    if (!mapped) {
      await printViaBrowserDialog()
      return
    }

    // 2) "Print to PDF" printer → save the PDF to a folder the user picks.
    if (isPdfPrinter(mapped)) {
      await savePdfViaPicker("print")
      return
    }

    // 3) Real printer that is actually attached (in the agent's list) → print directly.
    if (agentReady && availablePrinters.has(mapped.toLowerCase())) {
      const id = startExport("print")
      setIsExporting(true)
      try {
        updateExport(id, "fetching", "Preparing print…")
        const data = await fetchAndFilterData()
        if (!data.length) {
          failExport(id, "No data to print")
          return
        }
        updateExport(id, "generating", `Sending ${data.length.toLocaleString()} records to printer...`, data.length)
        const blob = generatePDFBlob(data, availableColumns, selectedColumnFields, {
          ...pdfOptions,
          orientation,
          pageSize,
        })
        const buffer = await blob.arrayBuffer()
        const outcome = await printViaAgent({
          documentType: PRINT_DOC_TYPE,
          contentType: "pdf",
          payload: buffer,
          jobName: filename,
        })
        if (outcome.agentUsed && outcome.result?.success) {
          completeExport(id, data.length)
          return
        }
        failExport(id, outcome.error || "Print failed")
      } catch (e) {
        console.error("Direct print error:", e)
        failExport(id, e instanceof Error ? e.message : "Failed to print")
      } finally {
        setIsExporting(false)
      }
      return
    }

    // 4) Real printer mapped but NOT attached (or no agent) → save the PDF to a folder.
    await savePdfViaPicker("print")
  }, [agentReady, availablePrinters, printViaBrowserDialog, savePdfViaPicker, fetchAndFilterData, availableColumns, selectedColumnFields, orientation, pageSize, pdfOptions, filename, startExport, updateExport, completeExport, failExport])

  // --- Column selection ---

  const toggleColumn = (field: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev)
      if (next.has(field)) {
        next.delete(field)
      } else {
        next.add(field)
      }
      selectedColumnsRef.current = next
      return next
    })
  }

  const selectAllColumns = () => {
    const all = new Set(availableColumns.map((col) => col.field))
    setSelectedColumns(all)
    selectedColumnsRef.current = all
  }

  const deselectAllColumns = () => {
    const empty = new Set<string>()
    setSelectedColumns(empty)
    selectedColumnsRef.current = empty
  }

  // --- Filter change handler ---

  const handleFilterChange = (key: string, value: any) => {
    setFilterValues((prev) => {
      const updated = { ...prev, [key]: value }
      filterValuesRef.current = updated
      return updated
    })
  }

  // --- Render ---

  if (!isOpen) return null

  const flatpickrOptions = {
    dateFormat: "Y-m-d",
    // Date range is required — disallow manual typing/deletion so the user
    // can only change the value by picking from the calendar. This prevents
    // the "empty input" state entirely.
    allowInput: false,
    disableMobile: true,
  }

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col mx-4"
        style={{ width: "1100px", maxWidth: "95vw", height: "85vh", maxHeight: "800px", zIndex: 100000 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Export Data</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Filter, select columns, and preview before exporting
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left Panel — Filters + Columns + Page Settings */}
          <div className="w-[280px] flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4 space-y-5">
            {/* Filters Section */}
            {(filters && filters.length > 0) || renderCustomFilters ? (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Filters
                </h3>

                {renderCustomFilters ? (
                  renderCustomFilters()
                ) : (
                  <div className="space-y-3">
                    {filters?.map((filter) => {
                      if (filter.type === "dateRange") {
                        const fromVal = filterValues[`${filter.field}_from`]
                        const toVal = filterValues[`${filter.field}_to`]
                        const fromMissing = !fromVal
                        const toMissing = !toVal
                        return (
                          <div key={filter.field} className="space-y-2">
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
                              {filter.label} <span className="text-red-500">*</span>
                            </label>
                            <div className="space-y-1.5">
                              <div className="relative">
                                <Flatpickr
                                  value={fromVal || ""}
                                  onChange={([d]) => {
                                    // Date range is required — silently ignore attempts
                                    // to clear the picker (manual delete, X button, etc.)
                                    if (!d) return
                                    handleFilterChange(
                                      `${filter.field}_from`,
                                      d.toISOString().split("T")[0]
                                    )
                                  }}
                                  options={flatpickrOptions}
                                  placeholder="From date"
                                  className={`w-full h-9 pl-8 pr-3 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 ${
                                    fromMissing
                                      ? "border-red-400 dark:border-red-500 focus:ring-red-500 focus:border-red-500"
                                      : "border-gray-300 dark:border-gray-600 focus:ring-brand-500 focus:border-brand-500"
                                  }`}
                                />
                                <span className="absolute left-2.5 top-2.5 pointer-events-none">
                                  <CalendarIcon />
                                </span>
                              </div>
                              <div className="relative">
                                <Flatpickr
                                  value={toVal || ""}
                                  onChange={([d]) => {
                                    if (!d) return
                                    handleFilterChange(
                                      `${filter.field}_to`,
                                      d.toISOString().split("T")[0]
                                    )
                                  }}
                                  options={flatpickrOptions}
                                  placeholder="To date"
                                  className={`w-full h-9 pl-8 pr-3 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 ${
                                    toMissing
                                      ? "border-red-400 dark:border-red-500 focus:ring-red-500 focus:border-red-500"
                                      : "border-gray-300 dark:border-gray-600 focus:ring-brand-500 focus:border-brand-500"
                                  }`}
                                />
                                <span className="absolute left-2.5 top-2.5 pointer-events-none">
                                  <CalendarIcon />
                                </span>
                              </div>
                              {(fromMissing || toMissing) && (
                                <p className="text-xs text-red-500 mt-1">
                                  Both From and To dates are required.
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      }

                      if (filter.type === "select") {
                        return (
                          <div key={filter.field}>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                              {filter.label}
                            </label>
                            <select
                              value={filterValues[filter.field] || ""}
                              onChange={(e) => handleFilterChange(filter.field, e.target.value)}
                              className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                            >
                              <option value="">All</option>
                              {filter.options?.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )
                      }

                      if (filter.type === "text") {
                        return (
                          <div key={filter.field}>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                              {filter.label}
                            </label>
                            <input
                              type="text"
                              value={filterValues[filter.field] || ""}
                              onChange={(e) => handleFilterChange(filter.field, e.target.value)}
                              placeholder={filter.placeholder || `Filter by ${filter.label}...`}
                              className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                            />
                          </div>
                        )
                      }

                      return null
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {/* Columns Section */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Columns ({selectedColumns.size}/{availableColumns.length})
              </h3>
              <div className="flex gap-1 mb-2">
                <button
                  onClick={selectAllColumns}
                  className="text-xs px-2 py-1 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllColumns}
                  className="text-xs px-2 py-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                >
                  Deselect All
                </button>
              </div>
              <div className="space-y-0.5 max-h-[240px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                {availableColumns.map((col) => (
                  <label
                    key={col.field}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumns.has(col.field)}
                      onChange={() => toggleColumn(col.field)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{col.headerName}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Page Settings */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                PDF Settings
              </h3>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Orientation</label>
                  <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                    <button
                      onClick={() => setOrientation("landscape")}
                      className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                        orientation === "landscape"
                          ? "bg-brand-500 text-white"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      Landscape
                    </button>
                    <button
                      onClick={() => setOrientation("portrait")}
                      className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                        orientation === "portrait"
                          ? "bg-brand-500 text-white"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      Portrait
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Page Size</label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value as "a3" | "a4" | "a5" | "letter" | "legal")}
                    className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="a3">A3 (297 x 420 mm)</option>
                    <option value="a4">A4 (210 x 297 mm)</option>
                    <option value="a5">A5 (148 x 210 mm)</option>
                    <option value="letter">Letter (8.5 x 11 in)</option>
                    <option value="legal">Legal (8.5 x 14 in)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel — Preview */}
          <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-950">
            {selectedColumnFields.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Select at least one column to see preview</p>
                </div>
              </div>
            ) : previewUrl ? (
              <div className="flex-1 flex flex-col min-h-0 p-3">
                {/* Page-styled preview container — always fits within available space, no scroll */}
                <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg p-4 overflow-hidden">
                  {(() => {
                    // Page dimensions in mm (width x height in portrait)
                    const pageDims: Record<string, [number, number]> = {
                      a3: [297, 420],
                      a4: [210, 297],
                      a5: [148, 210],
                      letter: [215.9, 279.4],
                      legal: [215.9, 355.6],
                    }
                    const [w, h] = pageDims[pageSize] || [210, 297]
                    const pageW = orientation === "landscape" ? h : w
                    const pageH = orientation === "landscape" ? w : h

                    return (
                      <div
                        className="bg-white rounded-sm"
                        style={{
                          width: "100%",
                          height: "100%",
                          maxWidth: `calc(100%)`,
                          maxHeight: `calc(100%)`,
                          aspectRatio: `${pageW} / ${pageH}`,
                          boxShadow: "0 2px 12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)",
                        }}
                      >
                        <iframe
                          src={previewUrl}
                          className="w-full h-full"
                          title="PDF Preview"
                          style={{ border: "none" }}
                        />
                      </div>
                    )
                  })()}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <SpinnerIcon />
                  <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Generating preview...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-2xl flex-shrink-0">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {isExporting ? (
              <span className="flex items-center gap-2">
                <SpinnerIcon />
                Exporting...
              </span>
            ) : missingDateRange ? (
              <span className="text-red-500 font-medium">
                Select a date range to continue.
              </span>
            ) : (
              <span>{selectedColumnFields.length} of {availableColumns.length} columns selected</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Page size selector */}
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as "a3" | "a4" | "a5" | "letter" | "legal")}
              className="h-9 px-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
            >
              <option value="a3">A3</option>
              <option value="a4">A4</option>
              <option value="a5">A5</option>
              <option value="letter">Letter</option>
              <option value="legal">Legal</option>
            </select>

            <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePrint}
              disabled={isExporting || selectedColumnFields.length === 0 || missingDateRange}
              title={printTooltip}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed max-w-[260px]"
            >
              <PrintIcon />
              <span className="truncate">{printDestination ? `Print → ${printDestination}` : "Print"}</span>
            </button>
            <button
              onClick={handleDownloadCSV}
              disabled={isExporting || selectedColumnFields.length === 0 || missingDateRange}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DownloadIcon />
              CSV
            </button>
            <button
              onClick={handleDownloadExcel}
              disabled={isExporting || selectedColumnFields.length === 0 || missingDateRange}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DownloadIcon />
              Excel
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isExporting || selectedColumnFields.length === 0 || missingDateRange}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DownloadIcon />
              PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default ExportModal
