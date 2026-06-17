// src/utils/gridUtils.ts

import React from "react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

// Type definitions
export interface GridColDef {
  field: string
  headerName: string
  width?: number
  type?: "string" | "number" | "date" | "datetime" | "time" | "boolean" | "actions"
  cellRenderer?: (value: any, row?: any) => React.ReactNode | string
  visible?: boolean
  sortable?: boolean
  filterable?: boolean
  editable?: boolean
  // Transform search value before sending to API (e.g., convert "Active" to "1")
  searchValueTransformer?: (searchValue: string) => string
}

export interface Column {
  field: string
  headerName: string
  width: number
  visible?: boolean
  sortable?: boolean
  filterable?: boolean
  editable?: boolean
  cellRenderer?: (value: any, row?: any) => string | React.ReactNode
  dataType?: "string" | "number" | "date" | "datetime" | "time" | "boolean" | "actions" | "email" | "url"
  // Transform search value before sending to API (e.g., convert "Active" to "1")
  searchValueTransformer?: (searchValue: string) => string
}

/**
 * Generic API response interface
 */
export interface StandardApiResponse<T> {
  success: boolean
  description?: string
  message?: string
  errors?: any
  data:
    | {
        totalRecords?: number
        recordsFiltered?: number
        pageSize?: number
        currentPage?: number
        records: T[]
      }
    | T[] // Support both nested and direct array responses
}

/**
 * Hook return type for useGridData
 */
export interface UseGridDataReturn<T> {
  data: T[]
  loading: boolean
  error: string | null
  totalRecords: number
  refetch: () => void
}

/**
 * Convert MUI-style GridColDef to custom Grid Column format
 */
export const convertToGridColumns = (colDefs: GridColDef[]): Column[] => {
  return colDefs.map((colDef) => ({
    field: colDef.field,
    headerName: colDef.headerName,
    width: colDef.width || 150,
    sortable: colDef.sortable !== false,
    filterable: colDef.filterable !== false,
    dataType: mapDataType(colDef.type),
    cellRenderer: colDef.cellRenderer,
    visible: colDef.visible !== false,
    searchValueTransformer: colDef.searchValueTransformer,
  }))
}

/**
 * Map data types to custom grid data types
 */
const mapDataType = (
  type?: string
): "string" | "number" | "date" | "datetime" | "time" | "boolean" => {
  switch (type) {
    case "number":
      return "number"
    case "date":
      return "date"
    case "datetime":
      return "datetime"
    case "time":
      return "time"
    case "boolean":
      return "boolean"
    default:
      return "string"
  }
}

/**
 * Generic hook for fetching grid data
 */
export const useGridData = <T>(
  apiUrl: string,
  deps: any[] = []
): UseGridDataReturn<T> => {
  const [data, setData] = React.useState<T[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [totalRecords, setTotalRecords] = React.useState(0)

  const fetchData = React.useCallback(async () => {
    if (!apiUrl) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          // Add authorization header if needed
          // 'Authorization': `Bearer ${getToken()}`,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const apiResponse: StandardApiResponse<T> = await response.json()

      // Handle different response formats
      let records: T[] = []
      let total = 0

      if (Array.isArray(apiResponse)) {
        // Direct array response
        records = apiResponse
        total = apiResponse.length
      } else if (apiResponse.success !== undefined) {
        // Standard API response format
        if (apiResponse.success && apiResponse.data) {
          if (Array.isArray(apiResponse.data)) {
            records = apiResponse.data
            total = apiResponse.data.length
          } else if (apiResponse.data.records) {
            records = apiResponse.data.records
            total =
              apiResponse.data.totalRecords || apiResponse.data.records.length
          }
        } else {
          throw new Error(
            apiResponse.description ||
              apiResponse.message ||
              "Failed to fetch data"
          )
        }
      } else if (apiResponse.data) {
        // Simple data wrapper
        if (Array.isArray(apiResponse.data)) {
          records = apiResponse.data
          total = apiResponse.data.length
        } else if (apiResponse.data.records) {
          records = apiResponse.data.records
          total =
            apiResponse.data.totalRecords || apiResponse.data.records.length
        }
      } else {
        throw new Error("Invalid API response format")
      }

      setData(records)
      setTotalRecords(total)
    } catch (err) {
      console.error("Error fetching data:", err)
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while fetching data"
      )
      setData([])
      setTotalRecords(0)
    } finally {
      setLoading(false)
    }
  }, [apiUrl])

  React.useEffect(() => {
    fetchData()
  }, [fetchData, ...deps])

  return {
    data,
    loading,
    error,
    totalRecords,
    refetch: fetchData,
  }
}

/**
 * Common cell renderers for different data types
 */
export const cellRenderers = {
  // Boolean renderer — polished SVG tick (green) for true, cross (red) for
  // false or null/undefined. Fills the cell and centers horizontally so every
  // boolean column looks identical.
  boolean: (value: any): React.ReactNode => {
    const isTrue = value === 1 || value === true || value === "true"
    const color = isTrue ? "#16a34a" : "#dc2626"
    const bg = isTrue ? "#dcfce7" : "#fee2e2"
    const label = isTrue ? "Yes" : "No"
    return React.createElement(
      "span",
      {
        "aria-label": label,
        title: label,
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
        },
      },
      React.createElement(
        "span",
        {
          style: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "22px",
            height: "22px",
            borderRadius: "9999px",
            backgroundColor: bg,
            color,
          },
        },
        isTrue
          ? React.createElement(
              "svg",
              {
                width: "14",
                height: "14",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "3",
                strokeLinecap: "round",
                strokeLinejoin: "round",
                "aria-hidden": "true",
              },
              React.createElement("polyline", { points: "5 12 10 17 19 7" })
            )
          : React.createElement(
              "svg",
              {
                width: "14",
                height: "14",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "3",
                strokeLinecap: "round",
                strokeLinejoin: "round",
                "aria-hidden": "true",
              },
              React.createElement("line", { x1: "6", y1: "6", x2: "18", y2: "18" }),
              React.createElement("line", { x1: "6", y1: "18", x2: "18", y2: "6" })
            )
      )
    )
  },

  // Plain-text boolean renderer — kept for exports/PDF where ReactNode isn't rendered
  booleanText: (value: any): string => {
    if (value === null || value === undefined) return ""
    return value === 1 || value === true || value === "true" ? "Yes" : "No"
  },

  booleanIcon: (value: any): string => {
    if (value === null || value === undefined) return ""
    return value === 1 || value === true || value === "true" ? "✓" : "✗"
  },

  status: (value: any): string => {
    if (value === null || value === undefined) return ""
    return value === 1 || value === true || value === "true"
      ? "Active"
      : "Inactive"
  },

  // Numeric renderers
  currency: (value: number): string => {
    if (value === null || value === undefined || isNaN(value)) return "$0"
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  },

  percentage: (value: number): string => {
    if (value === null || value === undefined || isNaN(value)) return "0%"
    return `${value.toFixed(2)}%`
  },

  number: (value: number): string => {
    if (value === null || value === undefined || isNaN(value)) return "0"
    return value.toLocaleString()
  },

  // Date renderers
  date: (value: string | Date): string => {
    if (!value) return ""
    try {
      const date = new Date(value)
      if (isNaN(date.getTime())) return ""
      return date.toLocaleDateString()
    } catch {
      return ""
    }
  },

  datetime: (value: string | Date): string => {
    if (!value) return ""
    try {
      const date = new Date(value)
      if (isNaN(date.getTime())) return ""
      return date.toLocaleString()
    } catch {
      return ""
    }
  },

  time: (value: string): string => {
    if (!value) return ""
    // Handle both full datetime and time-only strings
    try {
      if (value.includes("T") || value.includes(" ")) {
        const date = new Date(value)
        return date.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      }
      return value // Already in time format
    } catch {
      return value
    }
  },

  // Text renderers
  truncatedText:
    (maxLength: number) =>
    (value: string): string => {
      if (!value) return ""
      return value.length > maxLength
        ? `${value.substring(0, maxLength)}...`
        : value
    },

  upperCase: (value: string): string => {
    return value ? value.toUpperCase() : ""
  },

  lowerCase: (value: string): string => {
    return value ? value.toLowerCase() : ""
  },

  capitalize: (value: string): string => {
    if (!value) return ""
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
  },

  // Email renderer
  email: (value: string): React.ReactNode => {
    if (!value) return ""
    return React.createElement(
      "a",
      {
        href: `mailto:${value}`,
        style: { color: "#1976d2", textDecoration: "none" },
      },
      value
    )
  },

  // Phone renderer
  phone: (value: string): string => {
    if (!value) return ""
    // Format US phone numbers (adjust regex for your needs)
    const cleaned = value.replace(/\D/g, "")
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(
        6
      )}`
    }
    return value
  },

  // URL renderer
  url: (value: string): React.ReactNode => {
    if (!value) return ""
    const url = value.startsWith("http") ? value : `https://${value}`
    return React.createElement(
      "a",
      {
        href: url,
        target: "_blank",
        rel: "noopener noreferrer",
        style: { color: "#1976d2", textDecoration: "none" },
      },
      value
    )
  },

  // Quantity chip renderer - green for positive, red for negative, grey for zero
  quantityChip: (value: any): React.ReactNode => {
    const num = Number(value ?? 0)
    const display = num.toLocaleString()
    let bgColor: string
    let textColor: string
    if (num > 0) {
      bgColor = "#dcfce7" // green-100
      textColor = "#166534" // green-800
    } else if (num < 0) {
      bgColor = "#fee2e2" // red-100
      textColor = "#991b1b" // red-800
    } else {
      bgColor = "#f3f4f6" // gray-100
      textColor = "#6b7280" // gray-500
    }
    return React.createElement(
      "span",
      {
        style: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2px 10px",
          borderRadius: "9999px",
          backgroundColor: bgColor,
          color: textColor,
          fontSize: "12px",
          fontWeight: "600",
          minWidth: "36px",
        },
      },
      display
    )
  },

  // Badge renderer for tags/categories
  badge: (value: string, color?: string): React.ReactNode => {
    if (!value) return ""
    return React.createElement(
      "span",
      {
        style: {
          padding: "2px 8px",
          borderRadius: "12px",
          backgroundColor: color || "#e3f2fd",
          color: "#1976d2",
          fontSize: "12px",
          fontWeight: "500",
        },
      },
      value
    )
  },
}

/**
 * Pre-defined column configurations for common fields
 */
export const commonColumns = {
  id: (field = "id", headerName = "ID"): GridColDef => ({
    field,
    headerName,
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
  }),

  name: (field = "name", headerName = "Name"): GridColDef => ({
    field,
    headerName,
    width: 200,
    type: "string",
    sortable: true,
    filterable: true,
  }),

  email: (field = "email", headerName = "Email"): GridColDef => ({
    field,
    headerName,
    width: 250,
    type: "string",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.email,
  }),

  phone: (field = "phone", headerName = "Phone"): GridColDef => ({
    field,
    headerName,
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.phone,
  }),

  status: (field = "status", headerName = "Status"): GridColDef => ({
    field,
    headerName,
    width: 120,
    type: "boolean",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.status,
  }),

  dateCreated: (
    field = "dateCreated",
    headerName = "Created Date"
  ): GridColDef => ({
    field,
    headerName,
    width: 150,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.date,
  }),

  dateModified: (
    field = "dateModified",
    headerName = "Modified Date"
  ): GridColDef => ({
    field,
    headerName,
    width: 150,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.date,
  }),

  currency: (field: string, headerName: string): GridColDef => ({
    field,
    headerName,
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.currency,
  }),

  percentage: (field: string, headerName: string): GridColDef => ({
    field,
    headerName,
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.percentage,
  }),

  truncatedText: (
    field: string,
    headerName: string,
    maxLength = 30
  ): GridColDef => ({
    field,
    headerName,
    width: 200,
    type: "string",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.truncatedText(maxLength),
  }),
}

/**
 * Helper function for building query parameters
 */
export const buildQueryParams = (params: Record<string, any>): string => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      if (Array.isArray(value)) {
        value.forEach((item) => searchParams.append(key, String(item)))
      } else {
        searchParams.append(key, String(value))
      }
    }
  })

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ""
}

/**
 * Debounce function for search inputs
 */
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

/**
 * Export data to CSV
 */
export const exportToCSV = (
  data: any[],
  filename: string,
  columns?: Column[]
): void => {
  if (!data.length && !columns) return

  const csvContent = [
    // Header row
    columns
      ? columns.map((col) => col.headerName).join(",")
      : data.length > 0 ? Object.keys(data[0]).join(",") : "",
    // Data rows
    ...data.map((row) =>
      columns
        ? columns
            .map((col) => {
              const value = row[col.field]
              // Handle values that might contain commas
              return typeof value === "string" && value.includes(",")
                ? `"${value}"`
                : value || ""
            })
            .join(",")
        : Object.values(row)
            .map((value) =>
              typeof value === "string" && value.includes(",")
                ? `"${value}"`
                : value || ""
            )
            .join(",")
    ),
  ].join("\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${filename}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

/**
 * Export data to Excel (proper XLSX format using xlsx library)
 */
export const exportToExcel = (
  data: any[],
  filename: string,
  columns?: Column[]
): void => {
  if (!data.length && !columns) return

  // Filter visible columns excluding actions
  const visibleColumns = columns
    ? columns.filter(
        (col) =>
          col.visible !== false &&
          col.field !== "actions" &&
          col.dataType !== "actions"
      )
    : null

  // Prepare headers
  const headers = visibleColumns
    ? visibleColumns.map((col) => col.headerName)
    : data.length > 0 ? Object.keys(data[0]) : []

  // Prepare data rows
  const rows = data.map((row) =>
    visibleColumns
      ? visibleColumns.map((col) => {
          const value = row[col.field]
          if (value === null || value === undefined) return ""
          // Format based on data type
          if (col.dataType === "boolean") {
            return value === 1 || value === true || value === "true" ? "Yes" : "No"
          }
          if (col.dataType === "date" && value) {
            try {
              return new Date(value).toLocaleDateString()
            } catch {
              return String(value)
            }
          }
          if (col.dataType === "datetime" && value) {
            try {
              return new Date(value).toLocaleString()
            } catch {
              return String(value)
            }
          }
          if (col.dataType === "number" && typeof value === "number") {
            return value
          }
          return String(value)
        })
      : Object.values(row).map((value) => {
          if (value === null || value === undefined) return ""
          return value
        })
  )

  // Create worksheet data with headers as first row
  const wsData = [headers, ...rows]

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Auto-size columns based on content
  const colWidths = headers.map((header, idx) => {
    let maxLen = header.length
    rows.forEach((row) => {
      const cellValue = row[idx]
      const len = cellValue ? String(cellValue).length : 0
      if (len > maxLen) maxLen = len
    })
    return { wch: Math.min(maxLen + 2, 50) } // Cap at 50 characters width
  })
  ws["!cols"] = colWidths

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Data")

  // Generate and download the file
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/**
 * PDF Export Options Interface
 */
export interface PDFExportOptions {
  title?: string
  subtitle?: string
  orientation?: "portrait" | "landscape"
  pageSize?: "a4" | "letter" | "legal" | "a3" | "a5"
  includeDate?: boolean
  headerColor?: string
  alternateRowColor?: string
  // New option: show all columns with full values (may result in very wide PDF)
  showFullValues?: boolean
  /**
   * Number of leading columns to repeat on every horizontal page when the table is too
   * wide for a single page (e.g. pivot reports with many date columns).
   *
   * When set and the total preferred column width exceeds the available page width,
   * `generatePDFBlob` splits the remaining ("data") columns into chunks that each fit
   * the page, and renders one table per chunk — each starting on a new page, with the
   * `repeatColumns` identity columns (e.g. Department / Item / Barcode) repeated on the
   * left so the reader can always tell which row a cell belongs to.
   *
   * Default 0 = no horizontal pagination; columns are squeeze-scaled to a single page
   * (legacy behavior).
   */
  repeatColumns?: number
}

/**
 * Export data to PDF - optimized for showing all columns with complete values
 * Creates a wide PDF that fits all columns horizontally
 */
export const exportToPDF = (
  data: any[],
  filename: string,
  columns?: Column[],
  options?: PDFExportOptions
): void => {
  if (!data.length && !columns) return

  const {
    title = "Data Export",
    subtitle = "",
    includeDate = true,
    headerColor = "#1e40af",
    alternateRowColor = "#f8fafc",
  } = options || {}

  // Filter visible columns and exclude action columns
  const visibleColumns = columns
    ? columns.filter(
        (col) =>
          col.visible !== false &&
          col.field !== "actions" &&
          col.dataType !== "actions"
      )
    : (data.length > 0 ? Object.keys(data[0]) : []).map((key) => ({
        field: key,
        headerName: key,
        width: 100,
        visible: true as const,
        sortable: true,
        filterable: true,
        dataType: "string" as const,
      }))

  // Prepare headers (full names)
  const headers = visibleColumns.map((col) => col.headerName)

  // Prepare data rows with full values
  const rows = data.map((row) =>
    visibleColumns.map((col) => {
      const value = row[col.field]
      if (value === null || value === undefined) return ""

      // Format based on data type
      if (col.dataType === "boolean") {
        return value === 1 || value === true || value === "true" ? "Yes" : "No"
      } else if (col.dataType === "date" && value) {
        try {
          return new Date(value).toLocaleDateString()
        } catch {
          return String(value)
        }
      } else if (col.dataType === "datetime" && value) {
        try {
          return new Date(value).toLocaleString()
        } catch {
          return String(value)
        }
      } else if (col.dataType === "number" && typeof value === "number") {
        return value.toLocaleString()
      }
      return String(value)
    })
  )

  // Calculate minimum column width needed for each column based on content
  const fontSize = 7 // Slightly smaller font for more columns
  const charWidthMm = 1.6 // Approximate mm per character at font size 7
  const cellPaddingMm = 3 // Padding on each side
  const minColWidth = 15 // Minimum column width in mm

  const columnWidths: number[] = visibleColumns.map((col, idx) => {
    // Find the max length of content in this column (header + all data cells)
    let maxLen = headers[idx].length
    rows.forEach(row => {
      const cellLen = String(row[idx]).length
      if (cellLen > maxLen) maxLen = cellLen
    })
    // Calculate width: characters * charWidth + padding
    const calculatedWidth = maxLen * charWidthMm + (cellPaddingMm * 2)
    return Math.max(calculatedWidth, minColWidth)
  })

  // Calculate total table width
  const totalTableWidth = columnWidths.reduce((sum, w) => sum + w, 0)

  // Add margins
  const marginLeft = 10
  const marginRight = 10
  const totalPageWidth = totalTableWidth + marginLeft + marginRight + 10 // Extra buffer

  // Set page height (A4 landscape height)
  const pageHeight = 210

  // Create PDF with custom width to fit all columns
  // jsPDF format: [width, height] in mm
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [totalPageWidth, pageHeight],
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const actualPageHeight = doc.internal.pageSize.getHeight()

  // Add title
  doc.setFontSize(14)
  doc.setTextColor(33, 37, 41)
  doc.text(title, marginLeft, 12)

  // Add subtitle and date on same line
  let yPosition = 12
  if (subtitle) {
    doc.setFontSize(9)
    doc.setTextColor(108, 117, 125)
    doc.text(subtitle, marginLeft, yPosition + 6)
    yPosition += 6
  }

  if (includeDate) {
    doc.setFontSize(8)
    doc.setTextColor(108, 117, 125)
    const dateText = `Generated: ${new Date().toLocaleString()}`
    doc.text(dateText, pageWidth - marginRight - doc.getTextWidth(dateText), 12)
  }

  yPosition += 8

  // Convert hex color to RGB
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16),
        ]
      : [59, 130, 246]
  }

  // Generate table using autoTable with calculated column widths
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: yPosition,
    theme: "striped",
    styles: {
      fontSize: fontSize,
      cellPadding: 2,
      overflow: "linebreak",
      halign: "left",
      valign: "middle",
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: hexToRgb(headerColor),
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: fontSize,
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: hexToRgb(alternateRowColor),
    },
    columnStyles: columnWidths.reduce((acc, width, index) => {
      acc[index] = {
        cellWidth: width,
        halign: visibleColumns[index].dataType === "number" ? "right" : "left",
      }
      return acc
    }, {} as { [key: number]: { cellWidth: number; halign: "right" | "left" | "center" } }),
    margin: { top: 10, right: marginRight, bottom: 15, left: marginLeft },
    tableWidth: "auto",
  })

  // Add page numbers after table is fully rendered (so total page count is known)
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `Page ${i} of ${totalPages} | Total Records: ${data.length}`,
      marginLeft,
      actualPageHeight - 8
    )
  }

  // Save the PDF
  doc.save(`${filename}.pdf`)
}

/**
 * Generate a PDF as a Blob at standard page sizes (A4/Letter).
 * Used for PDF preview and download in the ExportModal.
 * Unlike exportToPDF which creates dynamic-width pages, this scales columns
 * proportionally to fit within standard page dimensions.
 */
export const generatePDFBlob = (
  data: any[],
  allColumns: Column[],
  selectedColumnFields: string[],
  options?: PDFExportOptions & {
    orientation?: "portrait" | "landscape"
    pageSize?: "a3" | "a4" | "a5" | "letter" | "legal"
  }
): Blob => {
  const {
    title = "Data Export",
    subtitle = "",
    orientation = "landscape",
    pageSize = "a4",
    includeDate = true,
    headerColor = "#1e40af",
    alternateRowColor = "#f8fafc",
    repeatColumns = 0,
  } = options || {}

  // Filter to selected columns only
  const visibleColumns = allColumns.filter(
    (col) =>
      selectedColumnFields.includes(col.field) &&
      col.field !== "actions" &&
      col.dataType !== "actions"
  )

  if (visibleColumns.length === 0) {
    // No columns selected — return minimal valid PDF
    const doc = new jsPDF({ orientation, unit: "mm", format: pageSize })
    doc.setFontSize(12)
    doc.text("No columns selected", 20, 30)
    return doc.output("blob")
  }

  // Prepare headers
  const headers = visibleColumns.map((col) => col.headerName)

  // Prepare data rows
  const rows = data.map((row) =>
    visibleColumns.map((col) => {
      const value = row[col.field]
      if (value === null || value === undefined) return ""
      if (col.dataType === "boolean") {
        return value === 1 || value === true || value === "true" ? "Yes" : "No"
      } else if (col.dataType === "date" && value) {
        try { return new Date(value).toLocaleDateString() } catch { return String(value) }
      } else if (col.dataType === "datetime" && value) {
        try { return new Date(value).toLocaleString() } catch { return String(value) }
      } else if (col.dataType === "number" && typeof value === "number") {
        return value.toLocaleString()
      }
      return String(value)
    })
  )

  // Create PDF with standard page size
  const doc = new jsPDF({ orientation, unit: "mm", format: pageSize })
  const pageWidth = doc.internal.pageSize.getWidth()
  const actualPageHeight = doc.internal.pageSize.getHeight()
  const marginLeft = 10
  const marginRight = 10
  const availableWidth = pageWidth - marginLeft - marginRight

  // Calculate preferred column widths
  const fontSize = 7
  const charWidthMm = 1.6
  const cellPaddingMm = 3
  const minColWidth = 12

  const preferredWidths = visibleColumns.map((col, idx) => {
    let maxLen = headers[idx].length
    rows.forEach(row => {
      const cellLen = String(row[idx]).length
      if (cellLen > maxLen) maxLen = cellLen
    })
    return Math.max(maxLen * charWidthMm + (cellPaddingMm * 2), minColWidth)
  })

  const totalPreferred = preferredWidths.reduce((sum, w) => sum + w, 0)

  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [59, 130, 246]
  }

  /** Render the title + subtitle + "Generated:" header on the current PDF page.
   *  Returns the y-position where the table body should start. */
  const renderHeader = (): number => {
    doc.setFontSize(14)
    doc.setTextColor(33, 37, 41)
    doc.text(title, marginLeft, 12)

    let y = 12
    if (subtitle) {
      doc.setFontSize(9)
      doc.setTextColor(108, 117, 125)
      doc.text(subtitle, marginLeft, y + 6)
      y += 6
    }

    if (includeDate) {
      doc.setFontSize(8)
      doc.setTextColor(108, 117, 125)
      const dateText = `Generated: ${new Date().toLocaleString()}`
      doc.text(dateText, pageWidth - marginRight - doc.getTextWidth(dateText), 12)
    }

    return y + 8
  }

  /** Render a single autoTable for the given subset of columns (by their index into
   *  `visibleColumns`). Used both by the single-page path and the horizontal-pagination
   *  path; in the latter we call this once per column chunk. */
  const renderTable = (columnIndices: number[], yStart: number) => {
    const chunkCols = columnIndices.map((i) => visibleColumns[i])
    const chunkHeaders = columnIndices.map((i) => headers[i])
    const chunkPreferred = columnIndices.map((i) => preferredWidths[i])
    const chunkPreferredTotal = chunkPreferred.reduce((a, b) => a + b, 0)
    // Scale this chunk's preferred widths to exactly fill availableWidth.
    const chunkWidths = chunkPreferred.map((w) =>
      Math.max((w / chunkPreferredTotal) * availableWidth, minColWidth)
    )
    const chunkRows = rows.map((row) => columnIndices.map((i) => row[i]))

    autoTable(doc, {
      head: [chunkHeaders],
      body: chunkRows,
      startY: yStart,
      theme: "striped",
      styles: {
        fontSize: fontSize,
        cellPadding: 2,
        overflow: "linebreak",
        halign: "left",
        valign: "middle",
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: hexToRgb(headerColor),
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
        fontSize: fontSize,
        cellPadding: 2,
      },
      alternateRowStyles: {
        fillColor: hexToRgb(alternateRowColor),
      },
      columnStyles: chunkWidths.reduce((acc, width, index) => {
        acc[index] = {
          cellWidth: width,
          halign: chunkCols[index].dataType === "number" ? "right" : "left",
        }
        return acc
      }, {} as { [key: number]: { cellWidth: number; halign: "right" | "left" | "center" } }),
      margin: { top: 10, right: marginRight, bottom: 15, left: marginLeft },
      tableWidth: availableWidth,
    })
  }

  // Decide between single-table layout (legacy) and horizontal pagination.
  //
  // Horizontal pagination triggers when:
  //   - the caller asked for it (`repeatColumns > 0`), AND
  //   - the natural / preferred total table width exceeds the page's available width.
  //
  // Without horizontal pagination we'd squeeze 40+ pivot columns into a single page width
  // — each cell becomes so narrow that values clip and headers wrap to 3-4 lines.
  const needsHorizontalPagination =
    repeatColumns > 0 &&
    repeatColumns < visibleColumns.length &&
    totalPreferred > availableWidth

  const yPosition = renderHeader()

  if (!needsHorizontalPagination) {
    // Single-page layout — all columns proportionally scaled to fit (legacy behavior).
    renderTable(
      visibleColumns.map((_, i) => i),
      yPosition
    )
  } else {
    // Horizontal pagination: keep the first `repeatColumns` columns on every page,
    // chunk the remaining data columns into groups that fit the page width.
    const stickyIdx = Array.from({ length: repeatColumns }, (_, i) => i)
    const stickyWidth = stickyIdx.reduce((sum, i) => sum + preferredWidths[i], 0)

    // Reserve a chunk of the page for the sticky columns. The data columns share whatever
    // is left over. Cap sticky at ~45% of the page so very wide identity columns can't
    // starve the data columns. If the cap kicks in, sticky columns will scale-down inside
    // renderTable (each renderTable call rescales its chunk to availableWidth).
    const stickyCap = availableWidth * 0.45
    const usableForData = availableWidth - Math.min(stickyWidth, stickyCap)

    // Build chunks of data column indices that each fit `usableForData`.
    const dataIdx: number[] = []
    for (let i = repeatColumns; i < visibleColumns.length; i++) dataIdx.push(i)

    const chunks: number[][] = []
    let current: number[] = []
    let curWidth = 0
    for (const idx of dataIdx) {
      const w = preferredWidths[idx]
      if (curWidth + w > usableForData && current.length > 0) {
        chunks.push(current)
        current = []
        curWidth = 0
      }
      current.push(idx)
      curWidth += w
    }
    if (current.length) chunks.push(current)

    chunks.forEach((chunkDataIdx, i) => {
      const yStart = i === 0 ? yPosition : (doc.addPage(), renderHeader())
      renderTable([...stickyIdx, ...chunkDataIdx], yStart)
    })
  }

  // Add page numbers after table is fully rendered (so total page count is known)
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(
      `Page ${i} of ${totalPages} | Total Records: ${data.length}`,
      marginLeft,
      actualPageHeight - 8
    )
  }

  return doc.output("blob")
}

/**
 * Export to CSV with only selected columns
 */
export const exportToCSVWithColumns = (
  data: any[],
  filename: string,
  columns: Column[],
  selectedFields: string[]
): void => {
  const filteredColumns = columns.filter(
    (col) => selectedFields.includes(col.field) && col.field !== "actions" && col.dataType !== "actions"
  )
  exportToCSV(data, filename, filteredColumns)
}

/**
 * Export to Excel with only selected columns
 */
export const exportToExcelWithColumns = (
  data: any[],
  filename: string,
  columns: Column[],
  selectedFields: string[]
): void => {
  const filteredColumns = columns.filter(
    (col) => selectedFields.includes(col.field) && col.field !== "actions" && col.dataType !== "actions"
  )
  exportToExcel(data, filename, filteredColumns)
}

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate phone number format (US format)
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/
  return phoneRegex.test(phone)
}

/**
 * Generate random ID
 */
export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9)
}

/**
 * Deep clone object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Sort array by field
 */
export const sortByField = <T>(
  array: T[],
  field: keyof T,
  direction: "asc" | "desc" = "asc"
): T[] => {
  return [...array].sort((a, b) => {
    const aVal = a[field]
    const bVal = b[field]

    if (aVal < bVal) return direction === "asc" ? -1 : 1
    if (aVal > bVal) return direction === "asc" ? 1 : -1
    return 0
  })
}

/**
 * Group array by field
 */
export const groupByField = <T>(
  array: T[],
  field: keyof T
): Record<string, T[]> => {
  return array.reduce((groups, item) => {
    const key = String(item[field])
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(item)
    return groups
  }, {} as Record<string, T[]>)
}

// Export default object with all utilities
export default {
  convertToGridColumns,
  useGridData,
  cellRenderers,
  commonColumns,
  buildQueryParams,
  useDebounce,
  formatFileSize,
  exportToCSV,
  exportToExcel,
  exportToPDF,
  generatePDFBlob,
  exportToCSVWithColumns,
  exportToExcelWithColumns,
  isValidEmail,
  isValidPhone,
  generateId,
  deepClone,
  sortByField,
  groupByField,
}