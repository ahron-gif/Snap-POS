import React, { useState, useEffect, useCallback, useRef } from "react"
import "./ServerGrid.css"
import { Grid } from "./components/Grid"
import { Column } from "./types/grid"
import { CustomContextMenuItem } from "./components/GridBody"
import UserProfiles from "../../../pages/UserProfiles"
import axios from "axios"
import { useAppSelector } from "../../../hooks/useAppSelector"
import { exportToPDF, exportToCSV, PDFExportOptions } from "../../../gridUtils"
import CardGrid from "../CardGrid/CardGrid"

// Transform a header-search value based on column type so the backend LIKE
// against ToString() matches correctly. Booleans are serialized as "True"/"False"
// by .NET, and date/datetime/time pickers emit ISO fragments the server needs
// in "YYYY-MM-DD" form.
const transformHeaderSearchValue = (column: Column | undefined, raw: string): string => {
  const value = raw.trim()
  if (!value) return value
  if (column?.dataType === "boolean") {
    if (value === "true") return "True"
    if (value === "false") return "False"
    return value
  }
  if (column?.dataType === "date" && value.includes("-")) {
    // Input type="date" already returns YYYY-MM-DD
    return value
  }
  if (column?.dataType === "datetime" && value.includes("T")) {
    // Input type="datetime-local" returns "YYYY-MM-DDTHH:mm" — strip time portion
    // for simple contains match against persisted datetimes
    return value.split("T")[0]
  }
  return value
}

// Toast Component for error notifications
const Toast: React.FC<{
  show: boolean
  message: string
  type: "success" | "error" | "warning"
  onClose: () => void
}> = ({ show, message, type, onClose }) => {
  if (!show) return null

  const getIcon = () => {
    switch (type) {
      case "success":
        return (
          <svg
            className="w-6 h-6 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M5 13l4 4L19 7"
            ></path>
          </svg>
        )
      case "error":
        return (
          <svg
            className="w-6 h-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        )
      case "warning":
        return (
          <svg
            className="w-6 h-6 text-yellow-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 13.5c-.77.833.192 2.5 1.732 2.5z"
            ></path>
          </svg>
        )
    }
  }

  const getBgColor = () => {
    switch (type) {
      case "success":
        return "bg-green-100"
      case "error":
        return "bg-red-100"
      case "warning":
        return "bg-yellow-100"
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[350px] max-w-[400px] transition-all duration-300 animate-slide-in">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex-shrink-0 w-10 h-10 ${getBgColor()} rounded-lg flex items-center justify-center`}
          >
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              {type === "error"
                ? "Error"
                : type === "warning"
                ? "Warning"
                : "Success"}
            </h4>
            <p className="text-sm text-gray-500">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// Modal Component (enhanced with better styling)
const Modal: React.FC<{
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}> = ({ isOpen, onClose, children, className = "" }) => {
  if (!isOpen) return null

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        className={`modal-content ${className}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : 'white',
          borderRadius: "24px",
          maxWidth: "90vw",
          maxHeight: "90vh",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="modal-close-btn"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            zIndex: 10,
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            border: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'}`,
            backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : 'white',
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280',
            transition: "all 0.2s",
          }}
          onMouseOver={(e) => {
            const isDark = document.documentElement.classList.contains('dark')
            e.currentTarget.style.backgroundColor = isDark ? "#374151" : "#f3f4f6"
            e.currentTarget.style.color = isDark ? "#e5e7eb" : "#374151"
          }}
          onMouseOut={(e) => {
            const isDark = document.documentElement.classList.contains('dark')
            e.currentTarget.style.backgroundColor = isDark ? "#1f2937" : "white"
            e.currentTarget.style.color = isDark ? "#9ca3af" : "#6b7280"
          }}
        >
          ×
        </button>
        {children}
      </div>
    </div>
  )
}

// Input Component with better styling
const Input: React.FC<{
  type?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}> = ({
  type = "text",
  value,
  onChange,
  disabled = false,
  className = "",
  placeholder,
}) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    disabled={disabled}
    placeholder={placeholder}
    className={`input-field ${className}`}
    style={{
      width: "100%",
      padding: "12px 16px",
      borderRadius: "8px",
      fontSize: "14px",
      transition: "all 0.2s",
      outline: "none",
    }}
    onFocus={(e) => {
      e.currentTarget.style.borderColor = "#1e40af"
      const isDark = document.documentElement.classList.contains('dark')
      e.currentTarget.style.boxShadow = isDark ? "0 0 0 3px rgba(30, 64, 175, 0.2)" : "0 0 0 3px rgba(30, 64, 175, 0.1)"
    }}
    onBlur={(e) => {
      const isDark = document.documentElement.classList.contains('dark')
      e.currentTarget.style.borderColor = isDark ? "#4b5563" : "#d1d5db"
      e.currentTarget.style.boxShadow = "none"
    }}
  />
)

// Label Component with better styling
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label
    style={{
      display: "block",
      marginBottom: "6px",
      fontSize: "14px",
      fontWeight: "500",
      color: document.documentElement.classList.contains('dark') ? '#d1d5db' : '#374151',
    }}
  >
    {children}
  </label>
)

// Button Component with better styling
const Button: React.FC<{
  children: React.ReactNode
  onClick?: () => void
  variant?: "primary" | "secondary" | "danger" | "outline"
  size?: "sm" | "md" | "lg"
  disabled?: boolean
}> = ({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
}) => {
  const baseStyle = {
    padding:
      size === "sm" ? "8px 16px" : size === "lg" ? "16px 32px" : "12px 24px",
    fontSize: size === "sm" ? "14px" : size === "lg" ? "16px" : "14px",
    borderRadius: "8px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: "500",
    transition: "all 0.2s",
    opacity: disabled ? 0.6 : 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid transparent",
  }

  const variantStyles = {
    primary: {
      backgroundColor: "#1e40af",
      color: "white",
      borderColor: "#1e40af",
    },
    secondary: {
      backgroundColor: "#6b7280",
      color: "white",
      borderColor: "#6b7280",
    },
    danger: {
      backgroundColor: "#ef4444",
      color: "white",
      borderColor: "#ef4444",
    },
    outline: {
      backgroundColor: "transparent",
      color: document.documentElement.classList.contains('dark') ? '#d1d5db' : '#6b7280',
      borderColor: document.documentElement.classList.contains('dark') ? '#4b5563' : '#d1d5db',
    },
  }

  return (
    <button
      style={{ ...baseStyle, ...variantStyles[variant] }}
      onClick={onClick}
      disabled={disabled}
      onMouseOver={(e) => {
        if (!disabled) {
          const isDark = document.documentElement.classList.contains('dark')
          if (variant === "outline") {
            e.currentTarget.style.backgroundColor = isDark ? "#374151" : "#f9fafb"
            e.currentTarget.style.borderColor = isDark ? "#6b7280" : "#9ca3af"
          } else {
            e.currentTarget.style.transform = "translateY(-1px)"
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)"
          }
        }
      }}
      onMouseOut={(e) => {
        if (!disabled) {
          const isDark = document.documentElement.classList.contains('dark')
          if (variant === "outline") {
            e.currentTarget.style.backgroundColor = "transparent"
            e.currentTarget.style.borderColor = isDark ? "#4b5563" : "#d1d5db"
          } else {
            e.currentTarget.style.transform = "translateY(0)"
            e.currentTarget.style.boxShadow = "none"
          }
        }
      }}
    >
      {children}
    </button>
  )
}

// Props interface for the ServerGrid component
interface ServerGridProps {
  data?: any[]
  columns: Column[]
  loading?: boolean
  error?: string | null
  totalRecords?: number
  onRowUpdate?: (updatedRow: any) => void
  onRowDelete?: (row: any) => void
  onRefresh?: () => void
  pagination?: boolean
  pageSize?: number
  editable?: boolean
  columnChooser?: boolean
  title?: string
  emptyMessage?: string
  emptyIcon?: string
  showStats?: boolean
  actions?: React.ReactNode
  // Action button configurations
  showActions?: boolean
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => void
  onAssignRoles?: (row: any) => void
  editableFields?: Array<{
    key: string
    label: string
    type: string
    colSpan?: number
  }>
  ViewComponent?: React.ComponentType<{ selectedRow: any; onBack: () => void }>
  // Server-side data fetching props
  apiUrl?: string
  serverSide?: boolean
  methodType?: "GET" | "POST"
  getAuthHeaders?: () => { [key: string]: string }
  defaultSortColumn?: string
  defaultSortDirection?: "asc" | "desc"
  containerWidth?: string
  initialFilters?: any
  additionalParams?: Record<string, any> // Added for direct API parameters like search
  orFilters?: Array<{
    col: string
    type: string
    value: string
    operatorType: "and" | "or"
  }>
  showCheckboxes?: boolean
  selectedRows?: Set<any>
  onRowSelection?: (rowId: string) => void
  setTotalRecords?: (totalRecords: number) => void
  setLoadedCount?: (loadedCount: number) => void
  setCurrentPage?: (page: number) => void
  setTotalPages?: (pages: number) => void
  onPageNavigation?: (callbacks: {
    goToFirstPage: () => void
    goToPreviousPage: () => void
    goToNextPage: () => void
    goToLastPage: () => void
  }) => void
  onSelectAll?: (selectAllFn?: any) => void
  onSelectAllFromHeader?: (selectAllFn?: any) => void
  getRowId?: (row: any) => string
  onSendInviteAction?: (
    row: any,
    showToastCallback: (msg: string, type: "success" | "error" | "info") => void
  ) => void
  // Header search props
  headerSearch?: boolean
  onHeaderSearch?: (field: string, value: string) => void
  // Infinite scroll props
  infiniteScroll?: boolean
  // Column settings persistence callbacks
  onColumnVisibilityChange?: (field: string, visible: boolean) => void
  onColumnWidthChange?: (field: string, width: number) => void
  onColumnsChange?: (columns: any[]) => void
  // Grid identifier for settings persistence
  gridId?: string
  // Column aggregates persistence
  columnAggregates?: Map<string, "sum" | "min" | "max" | "count" | "average" | "none">
  onAggregateChange?: (field: string, type: "sum" | "min" | "max" | "count" | "average" | "none") => void
  // Default grouping columns
  defaultGroupByColumns?: Array<{ field: string; headerName: string }>
  // Whether groups should be expanded by default
  defaultGroupsExpanded?: boolean
  // Opt-in subtotals + grand total. When set, the grid will:
  //   - after each group's rows, inject a "{Group} Total" row with
  //     the listed fields summed (group footer)
  //   - if showGrandTotal is true, append a "Grand Total" row at the
  //     end with the same fields summed across ALL rows
  // Other reports that don't pass these props see zero behaviour
  // change. Only the two tax reports use this currently — the desktop
  // matrix-and-totals look from FrmReports' tax pages.
  summaryFields?: string[]
  showGrandTotal?: boolean
  // Custom context menu items
  customContextMenuItems?: CustomContextMenuItem[]
  // Hide default context menu items (View Details, Edit Details, Delete Row)
  hideDefaultContextMenuItems?: boolean
  // Export functionality props
  showExportButtons?: boolean
  exportFileName?: string
  exportTitle?: string
  pdfExportOptions?: PDFExportOptions
  onExportPDF?: (data: any[]) => void
  onExportCSV?: (data: any[]) => void
  onExportAllData?: () => Promise<any[]>
  // Callback when grid data changes (for external export/print functionality)
  onDataChange?: (data: any[]) => void
  // Callback when server response is received (e.g. for report grand totals: totalTaxSum, totalSale)
  onResponseLoaded?: (response: Record<string, unknown>) => void
  // Optional: called when a data row is double-clicked (e.g. drill-down in reports)
  onRowDoubleClick?: (row: any) => void
  // Optional: called when a data row is clicked (single click)
  onRowClick?: (row: any) => void
  // Optional: returns a CSS class name for the row based on row data
  getRowClassName?: (row: any) => string
  onExposeUpdateRow?: (updateFn: (rowId: string, updater: (row: any) => any) => void) => void
  cardRenderer?: (row: any, index: number) => React.ReactNode
  displayMode?: "table" | "card"
  footerStats?: Array<{ label: string; value: string }>
}

type ViewMode = "grid" | "view" | "delete"

export default function ServerGrid({
  data = [],
  columns = [],
  loading = false,
  error = null,
  totalRecords = 0,
  onRowUpdate,
  onRowDelete,
  onRefresh,
  pagination = false,
  pageSize = 10,
  editable = false,
  columnChooser = false,
  title = "Data Grid",

  showActions = false,
  onView,
  onEdit,
  onDelete,
  onAssignRoles,
  editableFields = [],

  apiUrl,
  serverSide = false,
  methodType = "GET",
  getAuthHeaders,
  defaultSortColumn = "id",
  defaultSortDirection = "asc",
  containerWidth = "74%",
  initialFilters = {},
  additionalParams = {}, // Added with default empty object
  showCheckboxes = false,
  selectedRows,
  onRowSelection,
  setTotalRecords,
  setLoadedCount,
  setCurrentPage: setCurrentPageProp,
  setTotalPages: setTotalPagesProp,
  onPageNavigation,
  onSelectAll,
  onSelectAllFromHeader,
  onSendInviteAction,
  getRowId = (row) =>
    row.itemStoreID ||
    row.id ||
    row.itemID ||
    row.userId ||
    row.userID ||
    `fallback_${Math.random()}`,
  headerSearch = false,
  onHeaderSearch,
  infiniteScroll = false,
  onColumnVisibilityChange,
  onColumnWidthChange,
  onColumnsChange,
  gridId,
  columnAggregates,
  onAggregateChange,
  defaultGroupByColumns = [],
  defaultGroupsExpanded = false,
  summaryFields,
  showGrandTotal = false,
  customContextMenuItems = [],
  hideDefaultContextMenuItems = false,
  showExportButtons = false,
  exportFileName = "data-export",
  exportTitle = "Data Export",
  pdfExportOptions,
  onExportPDF,
  onExportCSV,
  onExportAllData,
  onDataChange,
  onResponseLoaded,
  onRowDoubleClick,
  onRowClick,
  getRowClassName,
  onExposeUpdateRow,
  cardRenderer,
  displayMode = "table",
  footerStats,
}: ServerGridProps) {
  // Get auth token from Redux store
  const { user } = useAppSelector((state) => state.auth)
  const [localData, setLocalData] = useState(data)
  const [serverLoading, setServerLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [serverTotalRecords, setServerTotalRecords] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [currentPageSize, setCurrentPageSize] = useState(pageSize)

  // Header search state for server-side filtering
  const [headerSearchConfig, setHeaderSearchConfig] = useState<Record<string, string>>({})

  // Infinite scroll state
  const [infiniteScrollData, setInfiniteScrollData] = useState<any[]>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreData, setHasMoreData] = useState(true)

  // Static checkbox selection state (no API calls)
  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<string>>(
    new Set()
  )

  const handleRowSelectionChange = (rowIndex: string) => {
    const newSelectedRows = new Set(internalSelectedRows)
    if (newSelectedRows.has(rowIndex)) {
      newSelectedRows.delete(rowIndex)
    } else {
      newSelectedRows.add(rowIndex)
    }
    setInternalSelectedRows(newSelectedRows)

    // Call the external handler if provided (for parent component state sync)
    if (onRowSelection) {
      onRowSelection(rowIndex)
    }
  }

  // Handle select all rows across all pages
  const handleSelectAll = () => {
    if (!onRowSelection) return

    console.log(
      "ServerGrid handleSelectAll triggered, current data length:",
      localData.length
    )

    // Get all row IDs from current data
    const allRowIds = localData
      .filter((row: any) => !row.__isGroupHeader)
      .map((row: any) => {
        // Use the same logic as in Grid component
        return (
          row.itemStoreID ||
          row.id ||
          row.itemID ||
          row.userId ||
          row.userID ||
          `fallback_${Math.random()}`
        )
      })

    console.log("All row IDs to select:", allRowIds)

    // Select all rows that are not already selected
    allRowIds.forEach((id) => {
      if (!internalSelectedRows.has(id)) {
        console.log("Selecting row:", id)
        handleRowSelectionChange(id)
      }
    })

    console.log(
      "Selection completed. New selected rows count:",
      internalSelectedRows.size +
        allRowIds.filter((id) => !internalSelectedRows.has(id)).length
    )
  }

  React.useEffect(() => {
    if (!selectedRows) return
    const same =
      selectedRows.size === internalSelectedRows.size &&
      Array.from(selectedRows).every((id) => internalSelectedRows.has(id))
    if (!same) {
      setInternalSelectedRows(new Set(selectedRows))
    }
  }, [selectedRows])
  // URL parameter utilities
  const getUrlParams = () => {
    const params = new URLSearchParams(window.location.search)
    return params
  }

  const updateUrlParams = (newParams: Record<string, string>) => {
    const params = new URLSearchParams(window.location.search)

    Object.entries(newParams).forEach(([key, value]) => {
      if (value && value.trim() !== "") {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })

    const newUrl = `${window.location.pathname}${
      params.toString() ? `?${params.toString()}` : ""
    }`
    window.history.replaceState({}, "", newUrl)
  }

  // Clear all filter parameters from URL
  const clearFilterParams = () => {
    const params = new URLSearchParams(window.location.search)

    // Remove all filter parameters
    const keysToDelete: string[] = []
    params.forEach((_, key) => {
      if (key.startsWith("filter_")) {
        keysToDelete.push(key)
      }
    })

    keysToDelete.forEach((key) => params.delete(key))

    const newUrl = `${window.location.pathname}${
      params.toString() ? `?${params.toString()}` : ""
    }`
    window.history.replaceState({}, "", newUrl)
  }

  // ServerGrid is reused across many tab-based pages that share a single URL
  // (the dashboard route never changes when switching tabs). Without scoping,
  // a `?sort_field=fromDate&sort_direction=asc` written by one grid would be
  // read by the next grid on mount even when that field doesn't exist as a
  // column there — leaking sort/filter state across unrelated screens and
  // sometimes 500'ing the API. Build a set of valid column fields for this
  // grid so we can ignore (and strip) URL params that don't belong here.
  const validFieldSet = React.useMemo(
    () => new Set(columns.map((c) => c.field)),
    [columns]
  )

  // Initialize filter config from URL parameters
  const initializeFiltersFromUrl = (): any => {
    const params = getUrlParams()
    const filters: any = {}
    // Track filter_* keys that reference fields not on this grid so we can
    // delete them from the URL after parsing.
    const staleFilterKeys: string[] = []

    // Look for filter parameters in URL
    params.forEach((value, key) => {
      if (key.startsWith("filter_")) {
        const field = key.replace("filter_", "")
        // Skip filters that target columns this grid doesn't have. These
        // belong to a different grid that wrote to the URL before mount.
        if (!validFieldSet.has(field)) {
          staleFilterKeys.push(key)
          return
        }
        try {
          // Handle triple-encoded URL parameters properly
          let decodedValue = value

          // Decode multiple times if needed
          for (let i = 0; i < 3; i++) {
            if (decodedValue.includes("%")) {
              decodedValue = decodeURIComponent(decodedValue)
            } else {
              break
            }
          }

          console.log(`Parsing filter for ${field}:`, {
            raw: value,
            decoded: decodedValue,
          })

          const filterData = JSON.parse(decodedValue)
          if (filterData.conditions && filterData.conditions.length > 0) {
            // Validate that conditions have valid values
            const validConditions = filterData.conditions.filter(
              (condition: any) =>
                condition.value && condition.value.toString().trim() !== ""
            )

            if (validConditions.length > 0) {
              filters[field] = {
                conditions: validConditions,
                logic: filterData.logic || "AND",
              }
              console.log(
                `Successfully parsed filter for ${field}:`,
                filters[field]
              )
            }
          }
        } catch (error) {
          console.warn(`Failed to parse filter for ${field}:`, error)
          console.warn("Raw value:", value)

          // Try alternative parsing approaches
          try {
            // Try parsing the raw value directly
            const directParse = JSON.parse(value)
            if (directParse.conditions && directParse.conditions.length > 0) {
              filters[field] = directParse
              console.log(
                `Alternative parsing succeeded for ${field}:`,
                filters[field]
              )
            }
          } catch (altError) {
            console.warn("Alternative parsing also failed:", altError)
          }
        }
      }
    })

    // Strip stale filter_* keys (filters referencing columns that don't
    // exist on this grid) from the URL so they don't leak forward when the
    // user navigates back to the originating grid or another grid mounts.
    if (staleFilterKeys.length > 0) {
      const cleanup = new URLSearchParams(window.location.search)
      staleFilterKeys.forEach((k) => cleanup.delete(k))
      const newUrl = `${window.location.pathname}${
        cleanup.toString() ? `?${cleanup.toString()}` : ""
      }`
      window.history.replaceState({}, "", newUrl)
    }

    console.log("Final initialized filters from URL:", filters)
    return filters
  }

  // Initialize sort config from URL parameters
  const initializeSortFromUrl = (): any | null => {
    const params = getUrlParams()
    const sortField = params.get("sort_field")
    const sortDirection = params.get("sort_direction") as "asc" | "desc"

    // If the persisted sort field doesn't exist on this grid, the URL state
    // belongs to a different screen — drop it and fall back to this grid's
    // default sort instead of forwarding a column the API will reject.
    if (sortField && !validFieldSet.has(sortField)) {
      const cleanup = new URLSearchParams(window.location.search)
      cleanup.delete("sort_field")
      cleanup.delete("sort_direction")
      const newUrl = `${window.location.pathname}${
        cleanup.toString() ? `?${cleanup.toString()}` : ""
      }`
      window.history.replaceState({}, "", newUrl)
      return defaultSortColumn
        ? { field: defaultSortColumn, direction: defaultSortDirection }
        : null
    }

    if (sortField && sortDirection) {
      return { field: sortField, direction: sortDirection }
    }

    return defaultSortColumn
      ? { field: defaultSortColumn, direction: defaultSortDirection }
      : null
  }

  // Initialize state with URL parameters
  const [sortConfig, setSortConfig] = useState<any | null>(
    initializeSortFromUrl()
  )
  const [filterConfig, setFilterConfig] = useState<any>(
    initializeFiltersFromUrl()
  )

  // Navigation states
  const [currentView, setCurrentView] = useState<ViewMode>("grid")
  const [selectedRow, setSelectedRow] = useState<any>(null)

  // Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editFormData, setEditFormData] = useState<any>({})

  // Toast state
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success" as "success" | "error" | "warning",
  })

  const showToast = (
    message: string,
    type: "success" | "error" | "warning" = "success"
  ) => {
    setToast({ show: true, message, type })
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }))
    }, 5000)
  }

  const hideToast = () => {
    setToast((prev) => ({ ...prev, show: false }))
  }

  // Export state
  const [isExporting, setIsExporting] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showExportMenu && !target.closest(".export-toolbar")) {
        setShowExportMenu(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showExportMenu])

  // Export handler for current page data
  const handleExportCurrentPage = useCallback(
    (format: "pdf" | "csv") => {
      const dataToExport = infiniteScroll ? infiniteScrollData : localData
      if (!dataToExport.length) {
        showToast("No data to export", "warning")
        return
      }

      const visibleColumns = columns.filter(
        (col) =>
          col.visible !== false &&
          col.field !== "actions" &&
          col.dataType !== "actions"
      )

      if (format === "pdf") {
        if (onExportPDF) {
          onExportPDF(dataToExport)
        } else {
          exportToPDF(dataToExport, exportFileName, visibleColumns, {
            title: exportTitle,
            ...pdfExportOptions,
          })
        }
        showToast("PDF exported successfully", "success")
      } else {
        if (onExportCSV) {
          onExportCSV(dataToExport)
        } else {
          exportToCSV(dataToExport, exportFileName, visibleColumns)
        }
        showToast("CSV exported successfully", "success")
      }
      setShowExportMenu(false)
    },
    [
      infiniteScroll,
      infiniteScrollData,
      localData,
      columns,
      exportFileName,
      exportTitle,
      pdfExportOptions,
      onExportPDF,
      onExportCSV,
    ]
  )

  // Export handler for all data (fetches all records from server)
  const handleExportAllData = useCallback(
    async (format: "pdf" | "csv") => {
      setIsExporting(true)
      setShowExportMenu(false)

      try {
        let allData: any[] = []

        if (onExportAllData) {
          // Use custom export all data function if provided
          allData = await onExportAllData()
        } else if (serverSide && apiUrl) {
          // Fetch all data from server
          const authHeaders = getAuthHeaders
            ? getAuthHeaders()
            : {
                "Content-Type": "application/json",
                ...(user?.accessToken && {
                  Authorization: `Bearer ${user.accessToken}`,
                }),
              }

          // Convert filter config to API format
          const filters: any[] = []
          Object.entries(filterConfig).forEach(
            ([field, config]: [string, any]) => {
              if (config?.conditions && config.conditions.length > 0) {
                config.conditions.forEach((condition: any) => {
                  filters.push({
                    col: field,
                    type: condition.operator,
                    value: condition.value,
                    operatorType: config.logic?.toLowerCase() || "and",
                  })
                })
              }
            }
          )

          // Add header search filters
          Object.entries(headerSearchConfig).forEach(([field, searchValue]) => {
            if (searchValue && searchValue.trim() !== "") {
              const column = columns.find((col) => col.field === field)
              let transformedValue = transformHeaderSearchValue(column, searchValue)
              if (column?.searchValueTransformer) {
                transformedValue = column.searchValueTransformer(transformedValue)
              }
              filters.push({
                col: field,
                type: "contains",
                value: transformedValue,
                operatorType: "and",
              })
            }
          })

          const requestPayload = {
            startRow: 0,
            endRow: 1000000, // Fetch all records
            sortColumn: sortConfig?.field || defaultSortColumn,
            sortDirection: sortConfig?.direction || defaultSortDirection,
            filters: filters.length > 0 ? JSON.stringify(filters) : null,
            ...additionalParams,
          }

          const config = {
            method: methodType,
            url: apiUrl,
            ...(methodType === "GET"
              ? { params: requestPayload }
              : { data: requestPayload }),
            headers: authHeaders,
          }

          const response = await axios(config)

          if (response.data?.isSuccess) {
            const res = response.data.response ?? response.data.Response
            allData = res?.data ?? res?.Data ?? []
          } else {
            throw new Error(response.data?.message || "Failed to fetch all data")
          }
        } else {
          // Client-side: use all available data
          allData = infiniteScroll ? infiniteScrollData : localData
        }

        if (!allData.length) {
          showToast("No data to export", "warning")
          return
        }

        const visibleColumns = columns.filter(
          (col) =>
            col.visible !== false &&
            col.field !== "actions" &&
            col.dataType !== "actions"
        )

        if (format === "pdf") {
          exportToPDF(allData, `${exportFileName}-all`, visibleColumns, {
            title: exportTitle,
            subtitle: `Total Records: ${allData.length}`,
            ...pdfExportOptions,
          })
          showToast(`PDF exported with ${allData.length} records`, "success")
        } else {
          exportToCSV(allData, `${exportFileName}-all`, visibleColumns)
          showToast(`CSV exported with ${allData.length} records`, "success")
        }
      } catch (error: any) {
        console.error("Export error:", error)
        showToast(error.message || "Failed to export data", "error")
      } finally {
        setIsExporting(false)
      }
    },
    [
      serverSide,
      apiUrl,
      getAuthHeaders,
      user?.accessToken,
      filterConfig,
      headerSearchConfig,
      sortConfig,
      defaultSortColumn,
      additionalParams,
      methodType,
      columns,
      infiniteScroll,
      infiniteScrollData,
      localData,
      exportFileName,
      exportTitle,
      pdfExportOptions,
      onExportAllData,
    ]
  )

  // Ref to track if a fetch is already in progress to prevent duplicate calls
  const isFetchingRef = useRef(false)
  // Ref to track the last request parameters to prevent duplicate requests with same params
  const lastRequestParamsRef = useRef<string | null>("")

  // Server-side data fetching function
  const fetchServerData = useCallback(async () => {
    if (!serverSide || !apiUrl) {
      return
    }

    // Prevent duplicate fetch calls while one is in progress
    if (isFetchingRef.current) {
      console.log("Fetch already in progress, skipping duplicate call")
      return
    }

    // Create a unique key for this request to prevent duplicate requests
    const requestKey = JSON.stringify({
      page: currentPage,
      pageSize: currentPageSize,
      sort: sortConfig,
      filter: filterConfig,
      headerSearch: headerSearchConfig,
      additionalParams,
    })

    // Skip if this is the same request as the last one
    if (requestKey === lastRequestParamsRef.current) {
      console.log("Skipping duplicate request with same parameters")
      return
    }

    try {
      isFetchingRef.current = true
      lastRequestParamsRef.current = requestKey
      setServerLoading(true)
      setServerError(null)

      const startRow = (currentPage - 1) * currentPageSize
      const endRow = startRow + currentPageSize

      // Convert filter config to API format
      const filters: any[] = []
      Object.entries(filterConfig).forEach(([field, config]: [string, any]) => {
        if (config?.conditions && config.conditions.length > 0) {
          // Handle global search (search from top search bar)
          if (field === "globalSearch") {
            config.conditions.forEach((condition: any, index: number) => {
              filters.push({
                col: condition.field || field,
                type: condition.operator,
                value: condition.value,
                operatorType: index === 0 ? "and" : "or", // First condition is "and", rest are "or"
              })
            })
          } else {
            // Handle regular field filters
            config.conditions.forEach((condition: any) => {
              filters.push({
                col: field,
                type: condition.operator,
                value: condition.value,
                operatorType: config.logic?.toLowerCase() || "and",
              })
            })
          }
        }
      })

      // Add header search filters (column-specific search)
      Object.entries(headerSearchConfig).forEach(([field, searchValue]) => {
        if (searchValue && searchValue.trim() !== "") {
          // Find the column to check for searchValueTransformer
          const column = columns.find(col => col.field === field)
          let transformedValue = transformHeaderSearchValue(column, searchValue)

          // Apply searchValueTransformer if defined
          if (column?.searchValueTransformer) {
            transformedValue = column.searchValueTransformer(transformedValue)
          }

          filters.push({
            col: field,
            type: "contains",
            value: transformedValue,
            operatorType: "and",
          })
        }
      })

      // Debug logging
      console.log("Filter Config:", filterConfig)
      console.log("Header Search Config:", headerSearchConfig)
      console.log("Processed Filters:", filters)
      console.log("Additional Params:", additionalParams) // Added debug log

      // Prepare request payload according to your API specification
      const requestPayload = {
        startRow,
        endRow,
        sortColumn: sortConfig?.field || defaultSortColumn,
        sortDirection: sortConfig?.direction || defaultSortDirection,
        filters: filters.length > 0 ? JSON.stringify(filters) : null,
        filterModel: filterConfig,
        sortModel: sortConfig
          ? [
              {
                colId: sortConfig.field,
                sort: sortConfig.direction,
              },
            ]
          : [],
        // Spread additional params (like search parameters) into the payload
        ...additionalParams,
      }

      console.log("Final API Request Payload:", requestPayload) // Added debug log

      // Get the auth headers from the prop or use the utility function
      const authHeaders = getAuthHeaders
        ? getAuthHeaders()
        : {
            "Content-Type": "application/json",
            ...(user?.accessToken && {
              Authorization: `Bearer ${user.accessToken}`,
            }),
          }

      const config = {
        method: methodType,
        url: apiUrl,
        ...(methodType === "GET"
          ? { params: requestPayload }
          : { data: requestPayload }),
        headers: authHeaders,
      }

      console.log("Final Axios Config:", config) // Added debug log

      const response = await axios(config)

      // Handle the response structure from your API (support both camelCase and PascalCase from Newtonsoft.Json)
      if (response.data?.isSuccess) {
        const responseData = response.data.response ?? response.data.Response
        const fetchedData = responseData?.data ?? responseData?.Data ?? []
        // Prefer recordsFiltered (post-filter count) over totalRecords (pre-quick-filter count).
        // Why: backend's TotalRecords reflects only store/status filters, so when a quick filter
        // (e.g. saleItems=true) yields 3 rows out of 8856 active items, infinite scroll would
        // never stop — loadedCount (3) is always < totalRecs (8856).
        const totalRecs =
          responseData?.recordsFiltered ??
          responseData?.RecordsFiltered ??
          responseData?.totalRecords ??
          responseData?.TotalRecords ??
          0

        if (onResponseLoaded) {
          onResponseLoaded(responseData as Record<string, unknown>)
        }

        if (infiniteScroll) {
          // For infinite scroll, append data on page > 1, replace on page 1
          if (currentPage === 1) {
            setInfiniteScrollData(fetchedData)
          } else {
            setInfiniteScrollData((prev) => [...prev, ...fetchedData])
          }
          // Check if there's more data to load
          const loadedCount = currentPage === 1 ? fetchedData.length : (currentPage - 1) * currentPageSize + fetchedData.length
          setHasMoreData(loadedCount < totalRecs)
        } else {
          setLocalData(fetchedData)
        }
        setServerTotalRecords(totalRecs)

        // Show toast if no data found
        if (fetchedData.length === 0 && currentPage === 1) {
          showToast("No data found matching your criteria", "warning")
        }
      } else {
        // Handle API error response with detailed error information
        const errorMessage = response.data?.message || "Failed to fetch data"
        const errors = response.data?.errors || []

        // Combine main message with detailed errors if available
        const fullErrorMessage =
          errors.length > 0
            ? `${errorMessage}. Details: ${errors.join("; ")}`
            : errorMessage

        setServerError(fullErrorMessage)
        setLocalData([])
        setServerTotalRecords(0)
        showToast(fullErrorMessage, "error")
      }
    } catch (error: any) {
      console.error("Error fetching server data:", error)
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        config: error.config,
        response: error.response,
      })

      let errorMessage = "Failed to fetch data from server"

      if (error.code === "ERR_NETWORK") {
        errorMessage =
          "Network error: Unable to connect to the API server. This could be due to CORS policy, network restrictions, or the server being unavailable."
      } else if (error.response) {
        errorMessage = `Server error (${error.response.status}): ${
          error.response.data?.message || error.message
        }`
      } else if (error.request) {
        errorMessage =
          "No response received from server. Please check your network connection."
      } else {
        errorMessage = error.message || "Unknown error occurred"
      }

      setServerError(errorMessage)
      setLocalData([])
      setServerTotalRecords(0)
      showToast(errorMessage, "error")
    } finally {
      isFetchingRef.current = false
      setServerLoading(false)
      setLoadingMore(false)
    }
  }, [
    apiUrl,
    serverSide,
    methodType,
    currentPage,
    currentPageSize,
    sortConfig,
    filterConfig,
    headerSearchConfig,
    additionalParams,
    getAuthHeaders,
    user?.accessToken,
    defaultSortColumn,
    infiniteScroll,
    onResponseLoaded,
  ]) // Added additionalParams, headerSearchConfig and infiniteScroll to dependency array

  // Handle load more for infinite scroll
  const handleLoadMore = useCallback(() => {
    if (loadingMore || serverLoading || !hasMoreData) return
    if (infiniteScroll && infiniteScrollData.length === 0) return
    setLoadingMore(true)
    setCurrentPage((prev) => prev + 1)
  }, [loadingMore, serverLoading, hasMoreData, infiniteScroll, infiniteScrollData.length])

  // Reset infinite scroll data when filters/sort/search changes
  useEffect(() => {
    if (infiniteScroll && serverSide) {
      setInfiniteScrollData([])
      setCurrentPage(1)
      setHasMoreData(true)
      lastRequestParamsRef.current = ""
    }
  }, [filterConfig, headerSearchConfig, sortConfig, additionalParams, infiniteScroll, serverSide])

  const additionalParamsStr = JSON.stringify(additionalParams)
  const prevAdditionalParamsRef = React.useRef(additionalParamsStr)
  useEffect(() => {
    if (serverSide && !infiniteScroll && prevAdditionalParamsRef.current !== additionalParamsStr) {
      prevAdditionalParamsRef.current = additionalParamsStr
      setCurrentPage(1)
      lastRequestParamsRef.current = ""
    }
  }, [additionalParamsStr, serverSide, infiniteScroll])

  // Pass handleSelectAll function to parent component
  React.useEffect(() => {
    if (onSelectAll && handleSelectAll) {
      onSelectAll(handleSelectAll)
    }
  }, [onSelectAll, handleSelectAll])

  // Pass total records to parent when it changes
  React.useEffect(() => {
    if (setTotalRecords && serverSide) {
      setTotalRecords(serverTotalRecords)
    }
  }, [serverTotalRecords, setTotalRecords, serverSide])

  // Pass loaded count to parent when data changes
  React.useEffect(() => {
    if (setLoadedCount) {
      const loadedCount = infiniteScroll ? infiniteScrollData.length : localData.length
      setLoadedCount(loadedCount)
    }
  }, [infiniteScrollData.length, localData.length, setLoadedCount, infiniteScroll])

  // Pass current page to parent when it changes
  React.useEffect(() => {
    if (setCurrentPageProp) {
      setCurrentPageProp(currentPage)
    }
  }, [currentPage, setCurrentPageProp])

  // Pass total pages to parent when total records or page size changes
  React.useEffect(() => {
    if (setTotalPagesProp && serverSide) {
      const totalPages = Math.ceil(serverTotalRecords / currentPageSize) || 1
      setTotalPagesProp(totalPages)
    }
  }, [serverTotalRecords, currentPageSize, setTotalPagesProp, serverSide])

  // Page navigation functions
  const goToFirstPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(1)
    }
  }, [currentPage])

  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }, [currentPage])

  const goToNextPage = useCallback(() => {
    const totalPages = Math.ceil(serverTotalRecords / currentPageSize) || 1
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }, [currentPage, serverTotalRecords, currentPageSize])

  const goToLastPage = useCallback(() => {
    const totalPages = Math.ceil(serverTotalRecords / currentPageSize) || 1
    if (currentPage < totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, serverTotalRecords, currentPageSize])

  // Pass navigation callbacks to parent
  React.useEffect(() => {
    if (onPageNavigation) {
      onPageNavigation({
        goToFirstPage,
        goToPreviousPage,
        goToNextPage,
        goToLastPage,
      })
    }
  }, [onPageNavigation, goToFirstPage, goToPreviousPage, goToNextPage, goToLastPage])

  // Debug URL parameters
  useEffect(() => {
    const params = getUrlParams()
    const filterParams: Record<string, any> = {}

    params.forEach((value, key) => {
      if (key.startsWith("filter_")) {
        const field = key.replace("filter_", "")
        try {
          let decodedValue = decodeURIComponent(value)
          if (decodedValue.includes("%")) {
            decodedValue = decodeURIComponent(decodedValue)
          }
          filterParams[field] = JSON.parse(decodedValue)
        } catch (error) {
          filterParams[field] = { error: "Failed to parse", raw: value }
        }
      }
    })

    if (Object.keys(filterParams).length > 0) {
      console.log("Current URL Filter Parameters:", filterParams)
    }
  }, [window.location.search])

  // Track if initial load has happened
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false)

  // Debounced fetch data when dependencies change (but not on initial load)
  // Use stringified values to prevent unnecessary re-renders from object reference changes
  const sortConfigStr = JSON.stringify(sortConfig)
  const filterConfigStr = JSON.stringify(filterConfig)
  const headerSearchConfigStr = JSON.stringify(headerSearchConfig)

  useEffect(() => {
    if (serverSide && hasInitiallyLoaded) {
      const timer = setTimeout(() => {
        fetchServerData()
      }, 500) // 500ms debounce for API calls

      return () => clearTimeout(timer)
    }
  }, [
    apiUrl,
    serverSide,
    methodType,
    currentPage,
    currentPageSize,
    sortConfigStr,
    filterConfigStr,
    headerSearchConfigStr,
    additionalParamsStr,
    user?.accessToken,
    defaultSortColumn,
    hasInitiallyLoaded,
    fetchServerData,
  ])

  // Only fetch on initial load, not on subsequent tab changes
  useEffect(() => {
    if (serverSide && !hasInitiallyLoaded) {
      fetchServerData()
      setHasInitiallyLoaded(true)
    }
  }, [serverSide, hasInitiallyLoaded]) // Only depend on serverSide and hasInitiallyLoaded

  // Debug filter config changes
  useEffect(() => {
    console.log("Filter config updated:", filterConfig)
  }, [filterConfig])

  // Smooth data update function that doesn't reload the entire grid
  const updateGridData = useCallback(async () => {
    if (!serverSide || !apiUrl) {
      return
    }

    try {
      // Don't show loading spinner for filter/search updates
      setServerError(null)

      const startRow = (currentPage - 1) * currentPageSize
      const endRow = startRow + currentPageSize

      // Convert filter config to API format
      const filters: any[] = []
      Object.entries(filterConfig).forEach(([field, config]: [string, any]) => {
        if (config?.conditions && config.conditions.length > 0) {
          // Handle global search (search from top search bar)
          if (field === "globalSearch") {
            config.conditions.forEach((condition: any, index: number) => {
              filters.push({
                col: condition.field || field,
                type: condition.operator,
                value: condition.value,
                operatorType: index === 0 ? "and" : "or", // First condition is "and", rest are "or",
              })
            })
          } else {
            // Handle regular field filters
            config.conditions.forEach((condition: any) => {
              filters.push({
                col: field,
                type: condition.operator,
                value: condition.value,
                operatorType: config.logic?.toLowerCase() || "and",
              })
            })
          }
        }
      })

      // Add header search filters (column-specific search)
      Object.entries(headerSearchConfig).forEach(([field, searchValue]) => {
        if (searchValue && searchValue.trim() !== "") {
          // Find the column to check for searchValueTransformer
          const column = columns.find(col => col.field === field)
          let transformedValue = transformHeaderSearchValue(column, searchValue)

          // Apply searchValueTransformer if defined
          if (column?.searchValueTransformer) {
            transformedValue = column.searchValueTransformer(transformedValue)
          }

          filters.push({
            col: field,
            type: "contains",
            value: transformedValue,
            operatorType: "and",
          })
        }
      })

      // Prepare request payload according to your API specification
      const requestPayload = {
        startRow,
        endRow,
        sortColumn: sortConfig?.field || defaultSortColumn,
        sortDirection: sortConfig?.direction || defaultSortDirection,
        filters: filters.length > 0 ? JSON.stringify(filters) : null,
        filterModel: filterConfig,
        sortModel: sortConfig
          ? [
              {
                colId: sortConfig.field,
                sort: sortConfig.direction,
              },
            ]
          : [],
        // Spread additional params (like search parameters) into the payload
        ...additionalParams,
      }

      // Get the auth headers from the prop or use the utility function
      const authHeaders = getAuthHeaders
        ? getAuthHeaders()
        : {
            "Content-Type": "application/json",
            ...(user?.accessToken && {
              Authorization: `Bearer ${user.accessToken}`,
            }),
          }

      const config = {
        method: methodType,
        url: apiUrl,
        ...(methodType === "GET"
          ? { params: requestPayload }
          : { data: requestPayload }),
        headers: authHeaders,
      }

      const response = await axios(config)

      // Handle the response structure from your API
      if (response.data?.isSuccess) {
        const responseData = response.data.response
        const fetchedData = responseData.data || []

        if (onResponseLoaded) {
          onResponseLoaded(responseData as Record<string, unknown>)
        }

        // Smoothly update the data without showing loading state
        setLocalData(fetchedData)
        setServerTotalRecords(responseData.totalRecords || 0)

        // Show toast if no data found
        if (fetchedData.length === 0) {
          showToast("No data found matching your criteria", "warning")
        }
      } else {
        // Handle API error response with detailed error information
        const errorMessage = response.data?.message || "Failed to fetch data"
        const errors = response.data?.errors || []

        // Combine main message with detailed errors if available
        const fullErrorMessage =
          errors.length > 0
            ? `${errorMessage}. Details: ${errors.join("; ")}`
            : errorMessage

        setServerError(fullErrorMessage)
        setLocalData([])
        setServerTotalRecords(0)
        showToast(fullErrorMessage, "error")
      }
    } catch (error: any) {
      console.error("Error fetching server data:", error)

      let errorMessage = "Failed to fetch data from server"

      if (error.code === "ERR_NETWORK") {
        errorMessage =
          "Network error: Unable to connect to the API server. This could be due to CORS policy, network restrictions, or the server being unavailable."
      } else if (error.response) {
        errorMessage = `Server error (${error.response.status}): ${
          error.response.data?.message || error.message
        }`
      } else if (error.request) {
        errorMessage =
          "No response received from server. Please check your network connection."
      } else {
        errorMessage = error.message || "Unknown error occurred"
      }

      setServerError(errorMessage)
      setLocalData([])
      setServerTotalRecords(0)
      showToast(errorMessage, "error")
    }
  }, [
    apiUrl,
    serverSide,
    methodType,
    currentPage,
    currentPageSize,
    sortConfig,
    filterConfig,
    headerSearchConfig,
    additionalParams,
    getAuthHeaders,
    user?.accessToken,
    defaultSortColumn,
    onResponseLoaded,
  ]) // Added additionalParams and headerSearchConfig to dependency array

  // Update local data when props change (for client-side mode)
  React.useEffect(() => {
    if (!serverSide) {
      setLocalData(data)
    }
  }, [data, serverSide])

  // Notify parent when data changes (for external export/print)
  React.useEffect(() => {
    if (onDataChange) {
      const currentData = infiniteScroll ? infiniteScrollData : localData
      onDataChange(currentData)
    }
  }, [localData, infiniteScrollData, infiniteScroll, onDataChange])

  // Expose updateRow function to parent for local row updates (avoids full grid remount)
  React.useEffect(() => {
    if (onExposeUpdateRow) {
      const updateRow = (rowId: string, updater: (row: any) => any) => {
        const mapFn = (row: any) => {
          const id = getRowId(row)
          return id === rowId ? updater(row) : row
        }
        if (infiniteScroll) {
          setInfiniteScrollData((prev) => prev.map(mapFn))
        } else {
          setLocalData((prev) => prev.map(mapFn))
        }
      }
      onExposeUpdateRow(updateRow)
    }
  }, [onExposeUpdateRow, infiniteScroll, getRowId])

  // Handle page change for server-side pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // Handle page size change for server-side pagination
  const handlePageSizeChange = (newPageSize: number) => {
    setCurrentPageSize(newPageSize)
    setCurrentPage(1) // Reset to first page
  }

  // Handle sorting for server-side
  const handleSort = (field: string, direction: "asc" | "desc" | null) => {
    if (serverSide) {
      setSortConfig(direction ? { field, direction } : null)

      // Update URL parameters for sort
      updateUrlParams({
        sort_field: direction ? field : "",
        sort_direction: direction || "",
      })

      setCurrentPage(1) // Reset to first page
      // Don't call updateGridData here as it will be triggered by the useEffect
    }
  }

  // Handle filtering for server-side
  const handleFilter = (field: string, conditions: any[], logic: any) => {
    if (serverSide) {
      setFilterConfig((prev: any) => {
        const newConfig = { ...prev }

        // Filter out empty conditions
        const validConditions = conditions.filter(
          (condition: any) =>
            condition.value && condition.value.toString().trim() !== ""
        )

        if (validConditions.length > 0) {
          newConfig[field] = { conditions: validConditions, logic }
        } else {
          delete newConfig[field]
        }

        // Update URL parameters for filters
        const filterParamKey = `filter_${field}`
        if (validConditions.length > 0) {
          const filterValue = JSON.stringify({
            conditions: validConditions,
            logic,
          })
          updateUrlParams({ [filterParamKey]: encodeURIComponent(filterValue) })
        } else {
          updateUrlParams({ [filterParamKey]: "" })
        }

        return newConfig
      })
      setCurrentPage(1) // Reset to first page
      // Don't call updateGridData here as it will be triggered by the useEffect
    }
  }

  // Handle clearing all filters
  const handleClearAllFilters = () => {
    if (serverSide) {
      // Invalidate the duplicate-request cache so the next fetch is not skipped
      lastRequestParamsRef.current = null
      setFilterConfig({})
      setHeaderSearchConfig({}) // Also clear header search
      clearFilterParams()
      setCurrentPage(1)
    }
  }

  // Handle header search for server-side filtering
  const handleHeaderSearch = useCallback(
    (field: string, value: string) => {
      if (serverSide) {
        setHeaderSearchConfig((prev) => {
          const newConfig = { ...prev }
          if (value.trim()) {
            newConfig[field] = value
          } else {
            delete newConfig[field]
          }
          return newConfig
        })
        setCurrentPage(1) // Reset to first page when searching
      }

      // Also call external handler if provided
      if (onHeaderSearch) {
        onHeaderSearch(field, value)
      }
    },
    [serverSide, onHeaderSearch]
  )

  // Action handlers
  const handleViewClick = (row: any) => {
    setSelectedRow(row)
    if (onView) {
      onView(row)
    } else {
      setCurrentView("view")
    }
  }

  const handleEditClick = (row: any) => {
    setSelectedRow(row)
    setEditFormData({ ...row })
    if (onEdit) {
      onEdit(row)
    } else {
      setIsEditModalOpen(true)
    }
  }

  const handleDeleteClick = (row: any) => {
    setSelectedRow(row)
    if (onDelete) {
      onDelete(row)
    } else {
      setCurrentView("delete")
    }
  }

  const handleBackToGrid = () => {
    setCurrentView("grid")
    setSelectedRow(null)
  }

  const handleSave = () => {
    console.log("Saving changes...", editFormData)

    // Update the row in the local state
    setLocalData((prevData) =>
      prevData.map((row) => {
        const idField =
          columns.find((col) => col.field.toLowerCase().includes("id"))
            ?.field || "id"
        return row[idField] === editFormData[idField] ? editFormData : row
      })
    )

    // Call parent's update handler
    if (onRowUpdate) {
      onRowUpdate(editFormData)
    }

    setIsEditModalOpen(false)
    setSelectedRow(null)
    setEditFormData({})
  }

  const handleDeleteConfirm = () => {
    console.log("Deleting data:", selectedRow)

    // Remove from local state
    const idField =
      columns.find((col) => col.field.toLowerCase().includes("id"))?.field ||
      "id"
    setLocalData((prevData) =>
      prevData.filter((row) => row[idField] !== selectedRow[idField])
    )

    // Call parent's delete handler
    if (onRowDelete) {
      onRowDelete(selectedRow)
    }

    handleBackToGrid()
  }

  const handleInputChange = (field: string, value: string) => {
    setEditFormData((prev: any) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleRowUpdate = (updatedRow: any) => {
    // Update local state immediately for better UX
    setLocalData((prevData) =>
      prevData.map((row) => {
        // Use a unique identifier to match rows (adjust based on your data structure)
        const idField =
          columns.find((col) => col.field.toLowerCase().includes("id"))
            ?.field || "id"
        return row[idField] === updatedRow[idField] ? updatedRow : row
      })
    )

    // Call the parent's update handler
    if (onRowUpdate) {
      onRowUpdate(updatedRow)
    }
  }

  // Add actions column to columns if showActions is true
  const columnsWithActions = React.useMemo(() => {
    if (showActions) {
      const actionsColumn: Column = {
        field: "actions",
        headerName: "Actions",
        width: 180,
        editable: false,
        sortable: false,
        filterable: false,
        dataType: "actions",
        visible: true,
      }

      return [...columns, actionsColumn]
    }

    return columns // If showActions is false, return columns without the actions column
  }, [columns, showActions])

  // Use server-side states when in server-side mode
  const isLoading = serverSide ? serverLoading : loading
  const currentError = serverSide ? serverError : error
  const currentTotalRecords = serverSide ? serverTotalRecords : totalRecords
  // Use infinite scroll data when enabled, otherwise use localData
  const currentData = infiniteScroll ? infiniteScrollData : localData

  // Get visible columns for skeleton loading
  const visibleColumns = columnsWithActions.filter((col) => col.visible !== false)
  const skeletonRowCount = Math.min(pageSize, 10) // Show skeleton rows based on page size, max 10

  // Columns can be briefly empty on first load while the column-access rules /
  // saved grid settings resolve. Without a fallback the skeleton renders as just
  // the checkbox column + a single header bar, then "jumps" to the full skeleton
  // once columns arrive — looking like two different loaders. Render the skeleton
  // over placeholder columns when none are available yet so it's always the same
  // full-table loader.
  const skeletonColumns =
    visibleColumns.length > 0
      ? visibleColumns
      : (Array.from({ length: 6 }, (_, i) => ({ field: `__skeleton_col_${i}`, width: 150 })) as typeof visibleColumns)

  // Loading state (don't show full loading for infinite scroll load more)
  if (isLoading && !(infiniteScroll && loadingMore)) {
    // Generate varied widths for skeleton cells to look more natural
    const getSkeletonWidth = (rowIndex: number, cellIndex: number) => {
      const widths = [35, 45, 55, 65, 75, 85, 95]
      const index = (rowIndex * 7 + cellIndex * 3) % widths.length
      return widths[index]
    }

    return (
      <div className="main-grid-app">
        {/* Grid wrapper matches actual grid structure */}
        <div
          className="grid-wrapper"
          style={{
            backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : 'white',
            borderRadius: "12px",
            border: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'}`,
            boxShadow: document.documentElement.classList.contains('dark')
              ? "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)"
              : "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            overflow: "hidden",
            height: "70vh",
            minHeight: "400px",
            maxHeight: "80vh",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          {/* Skeleton Drag Area */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: "12px",
              padding: "12px 16px",
              background: document.documentElement.classList.contains('dark')
                ? "linear-gradient(135deg, #1f2937 0%, #1e293b 100%)"
                : "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
              borderBottom: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e2e8f0'}`,
              minHeight: "48px",
            }}
          >
            <div
              className="skeleton-pulse"
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "4px",
              }}
            ></div>
            <div
              className="skeleton-pulse"
              style={{
                width: "280px",
                height: "16px",
                borderRadius: "4px",
              }}
            ></div>
          </div>

          {/* Skeleton Table Container */}
          <div
            style={{
              flex: 1,
              overflowX: "auto",
              overflowY: "auto",
              background: document.documentElement.classList.contains('dark') ? '#111827' : 'white',
            }}
          >
            <table
              style={{
                width: "100%",
                minWidth: "max-content",
                borderCollapse: "collapse",
                tableLayout: "auto"
              }}
            >
              {/* Skeleton Header */}
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                <tr>
                  {showCheckboxes && (
                    <th
                      style={{
                        width: "50px",
                        minWidth: "50px",
                        padding: "14px 8px",
                        background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                        borderBottom: "2px solid #e2e8f0",
                        borderRight: "1px solid #e2e8f0",
                        textAlign: "center",
                      }}
                    >
                      <div
                        className="skeleton-pulse"
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "4px",
                          margin: "0 auto",
                        }}
                      ></div>
                    </th>
                  )}
                  {skeletonColumns.map((col, i) => (
                    <th
                      key={`skeleton-header-${col.field}`}
                      style={{
                        width: col.width || 120,
                        minWidth: col.width || 120,
                        maxWidth: 250,
                        padding: "14px 12px",
                        background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                        borderBottom: "2px solid #e2e8f0",
                        borderRight: "1px solid #e2e8f0",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                        <div
                          className="skeleton-pulse"
                          style={{
                            width: `${60 + (i % 3) * 15}%`,
                            height: "14px",
                            borderRadius: "4px",
                            animationDelay: `${i * 0.05}s`,
                          }}
                        ></div>
                        <div
                          className="skeleton-pulse"
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "4px",
                            flexShrink: 0,
                            animationDelay: `${i * 0.05 + 0.1}s`,
                          }}
                        ></div>
                      </div>
                    </th>
                  ))}
                </tr>
                {/* Skeleton Search Row - if header search enabled */}
                {headerSearch && (
                  <tr>
                    {showCheckboxes && (
                      <th
                        style={{
                          width: "50px",
                          padding: "8px",
                          background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#fafbfc',
                          borderBottom: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'}`,
                          borderRight: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'}`,
                        }}
                      ></th>
                    )}
                    {skeletonColumns.map((col, i) => (
                      <th
                        key={`skeleton-search-${col.field}`}
                        style={{
                          width: col.width || 120,
                          minWidth: col.width || 120,
                          padding: "6px 8px",
                          background: document.documentElement.classList.contains('dark') ? '#1f2937' : '#fafbfc',
                          borderBottom: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'}`,
                          borderRight: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'}`,
                        }}
                      >
                        <div
                          className="skeleton-pulse"
                          style={{
                            width: "100%",
                            height: "32px",
                            borderRadius: "6px",
                            animationDelay: `${i * 0.03}s`,
                          }}
                        ></div>
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              {/* Skeleton Body */}
              <tbody>
                {[...Array(skeletonRowCount)].map((_, rowIndex) => (
                  <tr
                    key={`skeleton-row-${rowIndex}`}
                    className="skeleton-row"
                    style={{
                      backgroundColor: document.documentElement.classList.contains('dark')
                        ? (rowIndex % 2 === 0 ? "#111827" : "#0f172a")
                        : (rowIndex % 2 === 0 ? "white" : "#fafbfc"),
                      animationDelay: `${rowIndex * 0.03}s`,
                    }}
                  >
                    {showCheckboxes && (
                      <td
                        style={{
                          width: "50px",
                          padding: "12px 8px",
                          textAlign: "center",
                          borderBottom: `1px solid ${document.documentElement.classList.contains('dark') ? '#1f2937' : '#f1f5f9'}`,
                          borderRight: `1px solid ${document.documentElement.classList.contains('dark') ? '#1f2937' : '#f1f5f9'}`,
                          backgroundColor: document.documentElement.classList.contains('dark')
                            ? (rowIndex % 2 === 0 ? "#111827" : "#0f172a")
                            : (rowIndex % 2 === 0 ? "white" : "#fafbfc"),
                        }}
                      >
                        <div
                          className="skeleton-pulse"
                          style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "4px",
                            margin: "0 auto",
                            animationDelay: `${rowIndex * 0.05}s`,
                          }}
                        ></div>
                      </td>
                    )}
                    {skeletonColumns.map((col, cellIndex) => (
                      <td
                        key={`skeleton-cell-${rowIndex}-${col.field}`}
                        style={{
                          padding: "12px",
                          borderBottom: `1px solid ${document.documentElement.classList.contains('dark') ? '#1f2937' : '#f1f5f9'}`,
                          borderRight: `1px solid ${document.documentElement.classList.contains('dark') ? '#1f2937' : '#f1f5f9'}`,
                          verticalAlign: "middle",
                          width: col.width || 120,
                          minWidth: col.width || 120,
                          maxWidth: 250,
                        }}
                      >
                        <div
                          className="skeleton-pulse"
                          style={{
                            width: `${getSkeletonWidth(rowIndex, cellIndex)}%`,
                            height: "16px",
                            borderRadius: "4px",
                            animationDelay: `${(rowIndex * 0.05) + (cellIndex * 0.02)}s`,
                          }}
                        ></div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Skeleton Pagination - if pagination enabled and not infinite scroll */}
          {pagination && !infiniteScroll && (
            <div
              style={{
                flexShrink: 0,
                borderTop: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e2e8f0'}`,
                background: document.documentElement.classList.contains('dark')
                  ? "linear-gradient(135deg, #1f2937 0%, #111827 100%)"
                  : "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                minHeight: "64px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                <div
                  className="skeleton-pulse"
                  style={{
                    width: "140px",
                    height: "16px",
                    borderRadius: "4px",
                  }}
                ></div>
                <div
                  className="skeleton-pulse"
                  style={{
                    width: "80px",
                    height: "36px",
                    borderRadius: "6px",
                  }}
                ></div>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                {[...Array(5)].map((_, i) => (
                  <div
                    key={`skeleton-page-${i}`}
                    className="skeleton-pulse"
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "6px",
                      animationDelay: `${i * 0.05}s`,
                    }}
                  ></div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    )
  }

  // Error state
  if (currentError) {
    return (
      <div className="main-grid-app">
        <div
          className="error-container"
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "200px",
            height: "fit-content",
            padding: "40px 32px",
            backgroundColor: "#fef2f2",
            borderRadius: "12px",
            border: "1px solid #fecaca",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
          <div
            style={{
              color: "#d32f2f",
              fontSize: "18px",
              fontWeight: "600",
              marginBottom: "8px",
              textAlign: "center",
            }}
          >
            Failed to load {title.toLowerCase()}
          </div>
          <div
            style={{
              color: "#666",
              fontSize: "14px",
              marginBottom: "20px",
              textAlign: "center",
              maxWidth: "400px",
            }}
          >
            {currentError}
          </div>
          {(onRefresh || serverSide) && (
            <button
              onClick={() => {
                if (serverSide) {
                  fetchServerData()
                } else if (onRefresh) {
                  onRefresh()
                }
              }}
              style={{
                padding: "10px 20px",
                backgroundColor: "#1976d2",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
                transition: "background-color 0.2s",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = "#1565c0")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor = "#1976d2")
              }
            >
              🔄 Try Again
            </button>
          )}
        </div>
      </div>
    )
  }

  // Don't render empty state here - let the grid handle it

  // View mode - render UserProfile component with back handler
  if (currentView === "view") {
    return (
      <div style={{ width: "100%", height: "100vh" }}>
        <UserProfiles
          handleBackToGrid={handleBackToGrid}
          selectedRow={selectedRow}
        />
      </div>
    )
  }

  // Delete confirmation view
  if (currentView === "delete") {
    return (
      <div style={{ width: "100%", height: "100vh" }}>
        <Modal
          isOpen={true}
          onClose={handleBackToGrid}
          className="max-w-[600px]"
        >
          <div style={{ width: "100%", maxWidth: "600px", overflow: "hidden" }}>
            <div style={{ padding: "44px 44px 0 44px" }}>
              <div style={{ paddingRight: "56px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      backgroundColor: "#fef2f2",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: "16px",
                    }}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3,6 5,6 21,6" />
                      <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </div>{" "}
                  <h4
                    style={{
                      fontSize: "24px",
                      fontWeight: "600",
                      color: "#111827",
                      margin: 0,
                    }}
                  >
                    Delete Record
                  </h4>
                </div>
                <p
                  style={{
                    marginBottom: "28px",
                    fontSize: "16px",
                    color: "#6b7280",
                    lineHeight: "1.5",
                  }}
                >
                  Are you sure you want to delete this record? This action
                  cannot be undone and will permanently remove all data
                  associated with this record.
                </p>
              </div>
            </div>

            <div
              style={{
                padding: "0 44px 32px 44px",
              }}
            >
              {selectedRow && (
                <div
                  style={{
                    padding: "20px",
                    backgroundColor: "#f9fafb",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    marginBottom: "24px",
                  }}
                >
                  <h6
                    style={{
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#374151",
                      marginBottom: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Record Details
                  </h6>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {columns.slice(0, 4).map((column) => (
                      <div
                        key={column.field}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "14px",
                            color: "#6b7280",
                            fontWeight: "500",
                          }}
                        >
                          {column.headerName}:
                        </span>
                        <span
                          style={{
                            fontSize: "14px",
                            color: "#111827",
                            fontWeight: "500",
                          }}
                        >
                          {selectedRow[column.field] || "N/A"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div
                style={{
                  padding: "16px",
                  backgroundColor: "#fef2f2",
                  borderRadius: "8px",
                  border: "1px solid #fecaca",
                  marginBottom: "24px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginTop: "2px", flexShrink: 0 }}
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#991b1b",
                      fontWeight: "500",
                      margin: 0,
                      lineHeight: "1.4",
                    }}
                  >
                    <strong>Warning:</strong> This action cannot be undone. The
                    record will be permanently deleted from the system.
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <Button variant="outline" onClick={handleBackToGrid} size="md">
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteConfirm}
                  size="md"
                >
                  Delete Record
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    )
  }

  return (
    <div className="main-grid-app">
      {/* Toast Notification */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={hideToast}
      />

      {/* Export Toolbar */}
      {showExportButtons && (
        <div
          className="export-toolbar"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            padding: "12px 16px",
            backgroundColor: "#f8fafc",
            borderBottom: "1px solid #e5e7eb",
            borderRadius: "12px 12px 0 0",
            gap: "12px",
          }}
        >
          {isExporting && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#6b7280",
                fontSize: "14px",
              }}
            >
              <svg
                className="animate-spin"
                style={{
                  animation: "spin 1s linear infinite",
                  width: "16px",
                  height: "16px",
                }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  strokeWidth="3"
                  strokeDasharray="60"
                  strokeDashoffset="20"
                />
              </svg>
              Exporting...
            </div>
          )}

          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                backgroundColor: "#1e40af",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: isExporting ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "500",
                transition: "all 0.2s",
                opacity: isExporting ? 0.6 : 1,
              }}
              onMouseOver={(e) => {
                if (!isExporting) {
                  e.currentTarget.style.backgroundColor = "#1e40af"
                }
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "#1e40af"
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showExportMenu && (
              <div
                className="export-dropdown-menu"
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: "4px",
                  backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : 'white',
                  borderRadius: "8px",
                  boxShadow: document.documentElement.classList.contains('dark')
                    ? "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)"
                    : "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                  border: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'}`,
                  minWidth: "200px",
                  zIndex: 50,
                  overflow: "hidden",
                }}
              >
                <div
                  className="export-section-divider"
                  style={{
                    padding: "8px 0",
                    borderBottom: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'}`,
                  }}
                >
                  <div
                    className="export-section-label"
                    style={{
                      padding: "4px 12px",
                      fontSize: "11px",
                      fontWeight: "600",
                      color: document.documentElement.classList.contains('dark') ? '#6b7280' : '#9ca3af',
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Current Page
                  </div>
                  <button
                    onClick={() => handleExportCurrentPage("pdf")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "100%",
                      padding: "10px 12px",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      fontSize: "14px",
                      color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                      textAlign: "left",
                      transition: "background-color 0.15s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = document.documentElement.classList.contains('dark') ? "#374151" : "#f3f4f6"
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent"
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    Export to PDF
                  </button>
                  <button
                    onClick={() => handleExportCurrentPage("csv")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "100%",
                      padding: "10px 12px",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      fontSize: "14px",
                      color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                      textAlign: "left",
                      transition: "background-color 0.15s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = document.documentElement.classList.contains('dark') ? "#374151" : "#f3f4f6"
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent"
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    Export to CSV
                  </button>
                </div>
                <div style={{ padding: "8px 0" }}>
                  <div
                    className="export-section-label"
                    style={{
                      padding: "4px 12px",
                      fontSize: "11px",
                      fontWeight: "600",
                      color: document.documentElement.classList.contains('dark') ? '#6b7280' : '#9ca3af',
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    All Data
                  </div>
                  <button
                    onClick={() => handleExportAllData("pdf")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "100%",
                      padding: "10px 12px",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      fontSize: "14px",
                      color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                      textAlign: "left",
                      transition: "background-color 0.15s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = document.documentElement.classList.contains('dark') ? "#374151" : "#f3f4f6"
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent"
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    Export All to PDF
                  </button>
                  <button
                    onClick={() => handleExportAllData("csv")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "100%",
                      padding: "10px 12px",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      fontSize: "14px",
                      color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                      textAlign: "left",
                      transition: "background-color 0.15s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = document.documentElement.classList.contains('dark') ? "#374151" : "#f3f4f6"
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent"
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    Export All to CSV
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main grid / card view */}
      <div
        className="grid-wrapper"
        style={{
          backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : 'white',
          borderRadius: "10px",
          border: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e2e8f0'}`,
          boxShadow: "none",
          overflow: "hidden",
          height: "100%",
          minHeight: 0,
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          flex: 1,
        }}
      >
        {displayMode === "card" && cardRenderer ? (
          <CardGrid
            data={currentData}
            cardRenderer={cardRenderer}
            loading={serverLoading || loadingMore}
            emptyMessage={title ? `No ${title.toLowerCase()} found` : "No records found"}
            infiniteScroll={infiniteScroll}
            onLoadMore={handleLoadMore}
            hasMoreData={hasMoreData}
            loadingMore={loadingMore}
          />
        ) : (
          <Grid
            data={currentData}
            columns={columnsWithActions}
            onRowUpdate={handleRowUpdate}
            pagination={pagination}
            pageSize={serverSide ? currentPageSize : pageSize}
            editable={editable}
            columnChooser={columnChooser}
            getRowId={getRowId}
            onViewAction={handleViewClick}
            onEditAction={handleEditClick}
            onDeleteAction={handleDeleteClick}
            onAssignRolesAction={onAssignRoles}
            onSendInviteAction={onSendInviteAction}
            onRowDoubleClick={onRowDoubleClick}
            onRowClick={onRowClick}
            getRowClassName={getRowClassName}
            serverSide={serverSide}
            totalRecords={currentTotalRecords}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            onSort={handleSort}
            onFilter={handleFilter}
            onClearAllFilters={handleClearAllFilters}
            initialSortConfig={sortConfig}
            initialFilterConfig={filterConfig}
            containerWidth={containerWidth}
            showCheckboxes={showCheckboxes}
            selectedRows={internalSelectedRows}
            onRowSelection={handleRowSelectionChange}
            onSelectAll={handleSelectAll}
            onSelectAllFromHeader={onSelectAll || handleSelectAll}
            headerSearch={headerSearch}
            onHeaderSearch={handleHeaderSearch}
            initialHeaderSearchConfig={headerSearchConfig}
            infiniteScroll={infiniteScroll}
            onLoadMore={handleLoadMore}
            hasMoreData={hasMoreData}
            loadingMore={loadingMore}
            isSearching={serverLoading || loadingMore}
            onColumnVisibilityChange={onColumnVisibilityChange}
            onColumnWidthChange={onColumnWidthChange}
            onColumnsChange={onColumnsChange}
            initialColumnAggregates={columnAggregates}
            onAggregateChange={onAggregateChange}
            defaultGroupByColumns={defaultGroupByColumns}
            defaultGroupsExpanded={defaultGroupsExpanded}
            summaryFields={summaryFields}
            showGrandTotal={showGrandTotal}
            customContextMenuItems={customContextMenuItems}
            hideDefaultContextMenuItems={hideDefaultContextMenuItems}
            footerStats={footerStats}
          />
        )}
      </div>

      {/* Enhanced Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        className="max-w-[700px]"
      >
        <div style={{ width: "100%", maxWidth: "700px", overflow: "hidden" }}>
          <div style={{ padding: "44px 44px 0 44px" }}>
            <div style={{ paddingRight: "56px" }}>
              <h4
                style={{
                  marginBottom: "8px",
                  fontSize: "32px",
                  fontWeight: "600",
                  color: "#111827",
                }}
              >
                Edit Personal Information
              </h4>
              <p
                style={{
                  marginBottom: "28px",
                  fontSize: "14px",
                  color: "#6b7280",
                }}
              >
                Update your details to keep your profile up-to-date.
              </p>
            </div>
          </div>

          <form style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                height: "450px",
                overflowY: "auto",
                padding: "0 44px 12px 44px",
              }}
              className="custom-scrollbar"
            >
              {/* Social Links Section */}
              <div>
                <h5
                  style={{
                    marginBottom: "24px",
                    fontSize: "18px",
                    fontWeight: "500",
                    color: "#111827",
                  }}
                >
                  Social Links
                </h5>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "24px 24px",
                  }}
                >
                  <div>
                    <Label>Facebook</Label>
                    <Input
                      type="text"
                      value={editFormData.facebook || ""}
                      onChange={(e) =>
                        handleInputChange("facebook", e.target.value)
                      }
                      placeholder="https://www.facebook.com/username"
                    />
                  </div>

                  <div>
                    <Label>X.com</Label>
                    <Input
                      type="text"
                      value={editFormData.twitter || ""}
                      onChange={(e) =>
                        handleInputChange("twitter", e.target.value)
                      }
                      placeholder="https://x.com/username"
                    />
                  </div>

                  <div>
                    <Label>LinkedIn</Label>
                    <Input
                      type="text"
                      value={editFormData.linkedin || ""}
                      onChange={(e) =>
                        handleInputChange("linkedin", e.target.value)
                      }
                      placeholder="https://www.linkedin.com/in/username"
                    />
                  </div>

                  <div>
                    <Label>Instagram</Label>
                    <Input
                      type="text"
                      value={editFormData.instagram || ""}
                      onChange={(e) =>
                        handleInputChange("instagram", e.target.value)
                      }
                      placeholder="https://instagram.com/username"
                    />
                  </div>
                </div>
              </div>

              {/* Personal Information Section */}
              <div style={{ marginTop: "28px" }}>
                <h5
                  style={{
                    marginBottom: "24px",
                    fontSize: "18px",
                    fontWeight: "500",
                    color: "#111827",
                  }}
                >
                  Personal Information
                </h5>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "24px 24px",
                  }}
                >
                  {editableFields.length > 0
                    ? editableFields.map((field) => (
                        <div
                          key={field.key}
                          style={{
                            gridColumn:
                              field.colSpan === 2 ? "1 / -1" : "span 1",
                          }}
                        >
                          <Label>{field.label}</Label>
                          <Input
                            type={field.type}
                            value={editFormData[field.key] || ""}
                            onChange={(e) =>
                              handleInputChange(field.key, e.target.value)
                            }
                          />
                        </div>
                      ))
                    : // Default to showing all editable columns if no editableFields specified
                      columns
                        .filter(
                          (col) =>
                            col.field !== "actions" && col.editable !== false
                        )
                        .map((column) => (
                          <div
                            key={column.field}
                            style={{
                              gridColumn:
                                column.field === "bio" ? "1 / -1" : "span 1",
                            }}
                          >
                            <Label>{column.headerName}</Label>
                            <Input
                              type={
                                column.dataType === "number"
                                  ? "number"
                                  : column.dataType === "email"
                                  ? "email"
                                  : "text"
                              }
                              value={editFormData[column.field] || ""}
                              onChange={(e) =>
                                handleInputChange(column.field, e.target.value)
                              }
                            />
                          </div>
                        ))}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "24px 44px",
                justifyContent: "flex-end",
              }}
            >
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
              >
                Close
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Embedded CSS */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          .main-grid-app {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            width: 100%;
            height: 100%;
          }

          .grid-wrapper {
            scroll-behavior: smooth;
            scrollbar-width: thin;
            scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
          }

          .grid-wrapper::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }

          .grid-wrapper::-webkit-scrollbar-track {
            background: transparent;
          }

          .grid-wrapper::-webkit-scrollbar-thumb {
            background-color: rgba(155, 155, 155, 0.5);
            border-radius: 20px;
            border: transparent;
          }

          .grid-wrapper::-webkit-scrollbar-thumb:hover {
            background-color: rgba(155, 155, 155, 0.7);
          }

          .grid-container {
            width: 100%;
            min-width: fit-content;
          }

          .grid-table {
            width: 100%;
            min-width: max-content;
          }

          .input-field:focus {
            outline: none;
            border-color: #1e40af;
            box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
          }

          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
          }

          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }

          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }

          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: rgba(155, 155, 155, 0.5);
            border-radius: 20px;
            border: transparent;
          }

          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: rgba(155, 155, 155, 0.7);
          }

          .animate-slide-in {
            animation: slideInFromRight 0.3s ease-out;
          }

          @keyframes slideInFromRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          .ag-header-cell[col-id="checkbox"] {
            width: 50px;
            padding: 0px;
            text-align: center;
            border-bottom: 2px solid rgb(224, 224, 224);
            background-color: transparent;
            position: sticky;
            top: 0px;
            z-index: 10;
          }
        `}
      </style>
    </div>
  )
}
