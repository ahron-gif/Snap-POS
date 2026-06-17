import React, { useState, useCallback, memo, useMemo, useRef } from "react"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { CustomContextMenuItem } from "../../components/common/ServerGrid/components/GridBody"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import {
  convertToGridColumns,
  cellRenderers,
  GridColDef,
} from "../../gridUtils"
import ActionHeader from "../../components/common/ActionHeader"
import { useDashboardTabs } from "../../context/DashboardTabContext"
import { useStore } from "../../context/StoreContext"
import { useGridSettings } from "../../hooks/useGridSettings"
import { useExportHandlers } from "../../hooks/useExportHandlers"
import { useExportModal } from "../../hooks/useExportModal"
import ExportModal from "../../components/common/ExportModal"
import axios from "axios"
import { useConfirm } from '../../components/ui/ConfirmModal'

// Phone Order record interface based on PhoneOrderViewDto
interface PhoneOrderRecord {
  phoneOrderID: string
  phoneOrderNo: string | null
  customerNo: string | null
  firstName: string | null
  lastName: string | null
  customerID: string
  storeID: string | null
  phoneOrderDate: string | null
  phoneOrderTime: string | null
  deliveryDate: string | null
  shiftID: string | null
  phoneOrderStatus: number | null
  phoneOrder_Status: string | null
  phoneOrderType: string | null
  total: number | null
  balanceDoe: number | null
  status: number | null
  freezer: boolean | null
  pickByID: string | null
  takeByID: string | null
  takenByUserName: string | null
  transactionID: string | null
  transactionNo: string | null
  driversNote: string | null
  customerNote: string | null
  pickNote: string | null
  paymentNote: string | null
  groups: string | null
  zones: string | null
  over30: number | null
  over60: number | null
  over90: number | null
  over120: number | null
  credit: number | null
  over0: number | null
  current: number | null
  lockAccount: boolean | null
  lastPaymentDate: string | null
  lastPayment: number | null
  paid: number | null
  onHoldMsg: string | null
  lockOutDays: number | null
  dateCreated: string | null
  dateModified: string | null
}

// Status filter options
interface StatusFilter {
  key: string
  label: string
  status: string
  checked: boolean
}

// Scope options for date filtering
const scopeOptions = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "thisWeek", label: "This Week" },
  { value: "lastWeek", label: "Last Week" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "thisYear", label: "This Year" },
  { value: "lastYear", label: "Last Year" },
]

// Column definitions for phone orders based on VB.NET grid columns
const phoneOrdersColumnDefs: GridColDef[] = [
  {
    field: "customerNo",
    headerName: "Phone No",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "customerID",
    headerName: "Customer ID",
    width: 100,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "customerName",
    headerName: "Customer Name",
    width: 180,
    type: "string",
    sortable: true,
    filterable: true,
    cellRenderer: (_value: any, row: PhoneOrderRecord) => {
      const firstName = row.firstName || ""
      const lastName = row.lastName || ""
      return `${firstName} ${lastName}`.trim() || "-"
    },
  },
  {
    field: "phoneOrderNo",
    headerName: "Phone Order",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "phoneOrderDate",
    headerName: "Date",
    width: 120,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "deliveryDate",
    headerName: "Delivery Date",
    width: 120,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "phoneOrderTime",
    headerName: "Time",
    width: 100,
    type: "string",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) => {
      if (!value) return "-"
      try {
        const date = new Date(value)
        return date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      } catch {
        return value
      }
    },
  },
  {
    field: "phoneOrder_Status",
    headerName: "Status",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) => {
      const statusColors: Record<string, string> = {
        Open: "#28a745",
        Process: "#6c757d",
        Pick: "#17a2b8",
        Hold: "#ffc107",
        "Pick Hold": "#fd7e14",
        Collecting: "#007bff",
        "Ready To Pick": "#6610f2",
      }
      const color = statusColors[value] || "#6c757d"
      return (
        <span
          style={{
            color: color,
            fontWeight: 500,
          }}
        >
          {value || "-"}
        </span>
      )
    },
  },
  {
    field: "total",
    headerName: "Total",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value != null ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "balanceDoe",
    headerName: "Balance",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value != null ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "paid",
    headerName: "Paid",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value != null ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "freezer",
    headerName: "Freezer",
    width: 80,
    type: "boolean",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) => {
      if (value === true) {
        return (
          <span style={{ color: "#17a2b8" }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L14.1 9H21L15.5 13.5L17.6 20.5L12 16L6.4 20.5L8.5 13.5L3 9H9.9L12 2Z" />
            </svg>
          </span>
        )
      }
      return null
    },
  },
  {
    field: "takenByUserName",
    headerName: "Taken By",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "transactionNo",
    headerName: "Transaction",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "phoneOrderType",
    headerName: "Type",
    width: 100,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "shiftID",
    headerName: "Shift",
    width: 80,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "driversNote",
    headerName: "Driver Note",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "pickNote",
    headerName: "Pick Note",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "groups",
    headerName: "Groups",
    width: 100,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "zones",
    headerName: "Zones",
    width: 100,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "lockOutDays",
    headerName: "Lock Days",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
  },
  {
    field: "lastPaymentDate",
    headerName: "Last Payment Date",
    width: 150,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "lastPayment",
    headerName: "Last Payment",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value != null ? `$${Number(value).toFixed(2)}` : "-",
  },
]

// Grid ID for settings persistence
const PHONE_ORDERS_GRID_ID = "phone-orders-list-grid"

const PhoneOrderListPage = memo(function PhoneOrderListPage() {
  const { getAuthHeaders } = useAuthHeaders()
  const { openTab } = useDashboardTabs()
  const { currentStore } = useStore()
  const { confirm, ConfirmDialog } = useConfirm()

  // State for search functionality
  const [searchText, setSearchText] = useState("")
  const [debouncedSearchText, setDebouncedSearchText] = useState("")

  // State for bulk selection
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [totalRecords, setTotalRecords] = useState(0)
  const [loadedCount, setLoadedCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [remountKey, setRemountKey] = useState(0)

  // Status filter state
  const [statusFilters, setStatusFilters] = useState<StatusFilter[]>([
    { key: "open", label: "Open", status: "Open", checked: true },
    { key: "process", label: "Process", status: "Process", checked: false },
    { key: "pick", label: "Pick", status: "Pick", checked: false },
    { key: "collecting", label: "Collecting", status: "Collecting", checked: false },
    { key: "holdByCollector", label: "Hold By Collector", status: "Pick Hold", checked: false },
    { key: "hold", label: "Hold", status: "Hold", checked: false },
    { key: "readyToPick", label: "Ready To Pick", status: "Ready To Pick", checked: false },
  ])

  // Show void filter
  const [showVoid, setShowVoid] = useState(false)

  // Date filter state
  const [scope, setScope] = useState("today")
  const [fromDate, setFromDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  })
  const [toDate, setToDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  })
  const [fromTime, setFromTime] = useState("00:00")
  const [toTime, setToTime] = useState("23:59")

  // Shift filter
  const [shiftFilter, setShiftFilter] = useState("")

  // Store filter
  const [storeFilter, setStoreFilter] = useState("")

  // Filter panel expanded state
  const [filterPanelExpanded, setFilterPanelExpanded] = useState(true)

  // Refs for page navigation callbacks from ServerGrid
  const pageNavigationRef = React.useRef<{
    goToFirstPage: () => void
    goToPreviousPage: () => void
    goToNextPage: () => void
    goToLastPage: () => void
  } | null>(null)

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean
    message: string
    type: "success" | "error" | "info"
  }>({
    show: false,
    message: "",
    type: "success",
  })

  // Ref to store grid data from ServerGrid
  const gridDataRef = useRef<any[]>([])

  // Memoize auth headers to prevent re-creation
  const memoizedGetAuthHeaders = useCallback(() => {
    return getAuthHeaders()
  }, [getAuthHeaders])

  // Convert column definitions to grid format
  const defaultColumns = useMemo(
    () => convertToGridColumns(phoneOrdersColumnDefs),
    []
  )

  // Use grid settings hook for column visibility, width, and aggregate persistence
  const {
    columns,
    setColumns,
    updateColumnVisibility,
    updateColumnWidth,
    columnAggregates,
    updateColumnAggregate,
  } = useGridSettings(PHONE_ORDERS_GRID_ID, defaultColumns)

  // Handle column changes from grid for persistence
  const handleColumnsChange = useCallback(
    (newColumns: any[]) => {
      setColumns(newColumns)
    },
    [setColumns]
  )

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchText])

  // Handle scope change - update date filters accordingly
  const handleScopeChange = useCallback((newScope: string) => {
    setScope(newScope)
    const today = new Date()
    let startDate = new Date()
    let endDate = new Date()

    switch (newScope) {
      case "today":
        startDate = today
        endDate = today
        break
      case "yesterday":
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 1)
        endDate = new Date(startDate)
        break
      case "thisWeek":
        startDate = new Date(today)
        startDate.setDate(today.getDate() - today.getDay())
        endDate = today
        break
      case "lastWeek":
        startDate = new Date(today)
        startDate.setDate(today.getDate() - today.getDay() - 7)
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 6)
        break
      case "thisMonth":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        endDate = today
        break
      case "lastMonth":
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        endDate = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case "thisYear":
        startDate = new Date(today.getFullYear(), 0, 1)
        endDate = today
        break
      case "lastYear":
        startDate = new Date(today.getFullYear() - 1, 0, 1)
        endDate = new Date(today.getFullYear() - 1, 11, 31)
        break
      case "all":
      default:
        startDate = new Date(1900, 0, 1)
        endDate = new Date(2100, 11, 31)
        break
    }

    setFromDate(startDate.toISOString().split("T")[0])
    setToDate(endDate.toISOString().split("T")[0])
  }, [])

  // Handle status filter toggle
  const handleStatusFilterToggle = useCallback((key: string) => {
    setStatusFilters((prev) =>
      prev.map((filter) =>
        filter.key === key ? { ...filter, checked: !filter.checked } : filter
      )
    )
  }, [])

  // Build additional params for API request
  const additionalParams = useMemo(() => {
    const params: Record<string, string> = {}

    // Filter by current store
    if (currentStore?.storeId) {
      params.storeId = currentStore.storeId
    }

    // Store filter override
    if (storeFilter) {
      params.storeId = storeFilter
    }

    // Add search parameters if search text is provided
    if (debouncedSearchText.trim()) {
      params.CustomGridSearchText = debouncedSearchText.trim()
      params.CustomGridSearchColumns = "customerNo,firstName,lastName,phoneOrderNo"
    }

    // Status filters
    const activeStatuses = statusFilters
      .filter((f) => f.checked)
      .map((f) => f.status)
    if (activeStatuses.length > 0) {
      params.statuses = activeStatuses.join(",")
    }

    // Show void filter
    params.showVoid = showVoid ? "true" : "false"

    // Date filters
    if (scope !== "all") {
      params.fromDate = fromDate
      params.toDate = toDate
      params.fromTime = fromTime
      params.toTime = toTime
    }

    // Shift filter
    if (shiftFilter) {
      params.shiftID = shiftFilter
    }

    return params
  }, [
    currentStore?.storeId,
    storeFilter,
    debouncedSearchText,
    statusFilters,
    showVoid,
    scope,
    fromDate,
    toDate,
    fromTime,
    toTime,
    shiftFilter,
  ])

  // Handle search input change from ActionHeader (memoized)
  const handleSearchInputChange = useCallback((value: string) => {
    setSearchText(value)
  }, [])

  // Handle search on Enter key press
  const handleSearchKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        setDebouncedSearchText(searchText)
      }
    },
    [searchText]
  )

  // Handle row updates (double-click to edit)
  const handleRowUpdate = useCallback(
    async (updatedRow: PhoneOrderRecord) => {
      openTab({
        component: "PhoneOrderFormPage",
        title: "Edit Phone Order",
        closable: true,
        props: { id: updatedRow.phoneOrderID },
      })
    },
    [openTab]
  )

  // Handle opening the add phone order page
  const handleAddPhoneOrder = useCallback(() => {
    openTab({
      component: "PhoneOrderFormPage",
      title: "New Phone Order",
      closable: true,
      props: { isNew: true },
    })
  }, [openTab])

  // Toast notification function (memoized)
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      setToast({ show: true, message, type })
      setTimeout(() => {
        setToast({ show: false, message: "", type: "success" })
      }, 3000)
    },
    []
  )

  // Handle checkbox selection using phoneOrderID as the primary identifier
  const handleRowSelection = useCallback((phoneOrderID: string) => {
    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = new Set(prevSelectedRows)
      const wasSelected = newSelectedRows.has(phoneOrderID)

      if (wasSelected) {
        newSelectedRows.delete(phoneOrderID)
      } else {
        newSelectedRows.add(phoneOrderID)
      }

      return newSelectedRows
    })
  }, [])

  // Handle deselect all (memoized)
  const handleDeselectAll = useCallback(() => {
    setSelectedRows(new Set())
  }, [])

  // Handle remount grid (memoized)
  const handleRemountGrid = useCallback(() => {
    setSelectedRows(new Set())
    setRemountKey((prev) => prev + 1)
    showToast("Grid refreshed", "info")
  }, [showToast])

  // Handle bulk delete (memoized)
  const handleBulkDelete = useCallback(async () => {
    if (selectedRows.size > 0) {
      const confirmed = await confirm({
        title: 'Delete Phone Orders',
        message: `Are you sure you want to delete ${selectedRows.size} phone order(s)? This action cannot be undone.`,
        variant: 'danger',
      })
      if (confirmed) {
        console.log("Bulk deleting phone orders:", selectedRows)
        setSelectedRows(new Set())
        showToast(
          `${selectedRows.size} phone orders deleted successfully!`,
          "success"
        )
      }
    }
  }, [selectedRows, showToast, confirm])

  // Handle bulk export (memoized)
  const handleBulkExport = useCallback(() => {
    if (selectedRows.size > 0) {
      console.log("Bulk exporting phone orders:", selectedRows)
      showToast(`Exporting ${selectedRows.size} phone orders...`, "info")
    }
  }, [selectedRows, showToast])

  // Handle View Details from context menu
  const handleViewPhoneOrder = useCallback(
    (row: PhoneOrderRecord) => {
      openTab({
        component: "PhoneOrderFormPage",
        title: `View: ${row.phoneOrderNo || "Phone Order"}`,
        closable: true,
        props: { id: row.phoneOrderID, readOnly: true },
      })
    },
    [openTab]
  )

  // Handle Edit from context menu
  const handleEditPhoneOrder = useCallback(
    (row: PhoneOrderRecord) => {
      openTab({
        component: "PhoneOrderFormPage",
        title: `Edit: ${row.phoneOrderNo || "Phone Order"}`,
        closable: true,
        props: { id: row.phoneOrderID },
      })
    },
    [openTab]
  )

  // Handle Print from context menu
  const handlePrintPhoneOrder = useCallback(
    (row: PhoneOrderRecord) => {
      showToast(`Printing phone order ${row.phoneOrderNo || row.phoneOrderID}...`, "info")
      // TODO: Implement print functionality
    },
    [showToast]
  )

  // Handle Preview from context menu
  const handlePreviewPhoneOrder = useCallback(
    (row: PhoneOrderRecord) => {
      openTab({
        component: "PhoneOrderFormPage",
        title: `Preview: ${row.phoneOrderNo || "Phone Order"}`,
        closable: true,
        props: { id: row.phoneOrderID, readOnly: true },
      })
    },
    [openTab]
  )

  // Handle Void from context menu
  const handleVoidPhoneOrder = useCallback(
    async (row: PhoneOrderRecord) => {
      const confirmed = await confirm({
        title: 'Void Phone Order',
        message: `Are you sure you want to void phone order ${row.phoneOrderNo || row.phoneOrderID}? This action cannot be undone.`,
        variant: 'warning',
      })
      if (confirmed) {
        showToast(`Phone order ${row.phoneOrderNo || row.phoneOrderID} voided`, "success")
        handleRemountGrid()
      }
    },
    [showToast, handleRemountGrid, confirm]
  )

  // Handle Delete from context menu
  const handleDeletePhoneOrder = useCallback(
    async (row: PhoneOrderRecord) => {
      const confirmed = await confirm({
        title: 'Delete Phone Order',
        message: `Are you sure you want to delete phone order ${row.phoneOrderNo || row.phoneOrderID}? This action cannot be undone.`,
        variant: 'danger',
      })
      if (confirmed) {
        showToast(`Phone order ${row.phoneOrderNo || row.phoneOrderID} deleted`, "success")
        handleRemountGrid()
      }
    },
    [showToast, handleRemountGrid, confirm]
  )

  // Handle Change Priority from context menu
  const handleChangePriority = useCallback(
    (row: PhoneOrderRecord) => {
      showToast(`Changing priority for phone order ${row.phoneOrderNo || row.phoneOrderID}...`, "info")
      // TODO: Implement priority change functionality
    },
    [showToast]
  )

  // Handle Change Status from context menu
  const handleChangeStatus = useCallback(
    (row: PhoneOrderRecord, newStatus: string) => {
      showToast(`Changing status to "${newStatus}" for phone order ${row.phoneOrderNo || row.phoneOrderID}...`, "info")
      // TODO: Implement status change API call
      handleRemountGrid()
    },
    [showToast, handleRemountGrid]
  )

  // Create custom context menu items
  const customContextMenuItems: CustomContextMenuItem[] = useMemo(
    () => [
      {
        label: "Show",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
        onClick: handleViewPhoneOrder,
      },
      {
        label: "Print",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
        ),
        onClick: handlePrintPhoneOrder,
      },
      {
        label: "Preview",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        ),
        onClick: handlePreviewPhoneOrder,
        dividerBefore: true,
      },
      {
        label: "New",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        ),
        onClick: () => handleAddPhoneOrder(),
        dividerBefore: true,
      },
      {
        label: "Edit",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="m18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        ),
        onClick: handleEditPhoneOrder,
      },
      {
        label: "Void",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        ),
        onClick: handleVoidPhoneOrder,
        color: "#dc2626",
        hoverBgColor: "#fef2f2",
        dividerBefore: true,
      },
      {
        label: "Delete",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3,6 5,6 21,6" />
            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        ),
        onClick: handleDeletePhoneOrder,
        color: "#dc2626",
        hoverBgColor: "#fef2f2",
      },
      {
        label: "Change Priority",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ),
        onClick: handleChangePriority,
        dividerBefore: true,
      },
      {
        label: "Change Status",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ),
        onClick: () => {},
        subMenu: [
          {
            label: "Open",
            onClick: (row: any) => handleChangeStatus(row, "Open"),
          },
          {
            label: "Send To App",
            onClick: (row: any) => handleChangeStatus(row, "Send To App"),
          },
          {
            label: "Picked",
            onClick: (row: any) => handleChangeStatus(row, "Picked"),
          },
          {
            label: "Processed",
            onClick: (row: any) => handleChangeStatus(row, "Processed"),
          },
        ],
      },
    ],
    [
      handleViewPhoneOrder,
      handlePrintPhoneOrder,
      handlePreviewPhoneOrder,
      handleAddPhoneOrder,
      handleEditPhoneOrder,
      handleVoidPhoneOrder,
      handleDeletePhoneOrder,
      handleChangePriority,
      handleChangeStatus,
    ]
  )

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setStatusFilters((prev) =>
      prev.map((filter) => ({ ...filter, checked: false }))
    )
    setShowVoid(false)
    setScope("all")
    setFromDate("")
    setToDate("")
    setFromTime("00:00")
    setToTime("23:59")
    setShiftFilter("")
    setStoreFilter("")
    setSearchText("")
    setDebouncedSearchText("")
    showToast("Filters cleared", "info")
  }, [showToast])

  // Fetch all data for export/print
  const fetchAllData = useCallback(async (dateFrom?: string, dateTo?: string): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const response = await axios({
        method: "GET",
        url: API_ENDPOINTS.PHONE_ORDERS.GET_ALL,
        params: {
          startRow: 0,
          endRow: 1000000,
          ...(dateFrom && { dateFrom }),
          ...(dateTo && { dateTo }),
          sortColumn: "phoneOrderDate",
          sortDirection: "desc",
          ...additionalParams,
        },
        headers,
      })
      if (response.data?.isSuccess) {
        return response.data.response.data || []
      }
      return []
    } catch (error) {
      console.error("Failed to fetch all data:", error)
      return []
    }
  }, [getAuthHeaders, additionalParams])

  // Use the export handlers hook
  const {
    handleExportCSV,
    handleExportPDF,
    handleExportExcel,
    handlePrint,
    isExporting,
    isPrinting,
  } = useExportHandlers({
    columns,
    gridDataRef,
    fetchAllData,
    filename: "phone-orders-list",
    pdfOptions: {
      title: "Phone Orders List",
      subtitle: currentStore?.storeName || "All Stores",
      orientation: "landscape",
    },
  })

  // Export modal
  const exportModal = useExportModal({
    columns,
    fetchAllData,
    filename: "phone-orders-list",
    pdfOptions: { title: "Phone Orders List", orientation: "landscape" },
    dateFilterField: "dateCreated",
  })

  // Callback to receive grid data from ServerGrid
  const handleGridDataChange = useCallback((data: any[]) => {
    gridDataRef.current = data
  }, [])

  // Store reference to ServerGrid's select all function
  const serverGridSelectAllRef = React.useRef<(() => void) | null>(null)

  // Handle select all
  const handleSelectAll = useCallback(() => {
    try {
      if (serverGridSelectAllRef.current) {
        serverGridSelectAllRef.current()
      } else {
        showToast("Selecting all phone orders...", "info")
      }
    } catch (error) {
      console.error("Error in handleSelectAll:", error)
      showToast("Error selecting phone orders", "error")
    }
  }, [showToast])

  return (
    <div
      className="phone-orders-list-page p-2 mx-auto md:p-2 min-h-full"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        margin: 0,
        paddingTop: "5px",
        paddingBottom: "5px",
      }}
    >
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[350px] max-w-[400px] transition-all duration-300 animate-slide-in dark:bg-gray-800 dark:border-gray-700">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                  toast.type === "success"
                    ? "bg-green-100"
                    : toast.type === "error"
                    ? "bg-red-100"
                    : "bg-brand-50"
                }`}
              >
                {toast.type === "success" && (
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
                    />
                  </svg>
                )}
                {toast.type === "error" && (
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
                    />
                  </svg>
                )}
                {toast.type === "info" && (
                  <svg
                    className="w-6 h-6 text-brand-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 mb-1 dark:text-white">
                  {toast.type === "success" && "Success"}
                  {toast.type === "error" && "Error"}
                  {toast.type === "info" && "Information"}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() =>
                  setToast({ show: false, message: "", type: "success" })
                }
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors dark:hover:text-gray-300"
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
                  />
                </svg>
              </button>
            </div>
            <div className="mt-3 w-full bg-gray-200 rounded-full h-1 overflow-hidden dark:bg-gray-700">
              <div
                className={`h-1 rounded-full ${
                  toast.type === "success"
                    ? "bg-green-500"
                    : toast.type === "error"
                    ? "bg-red-500"
                    : "bg-brand-500"
                }`}
                style={{
                  width: "100%",
                  animation: "progressBar 3s linear forwards",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-2">
        {/* Filter Header with Toggle */}
        <div
          className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
          onClick={() => setFilterPanelExpanded(!filterPanelExpanded)}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Filters
            </span>
            {(statusFilters.some((f) => f.checked) ||
              showVoid ||
              scope !== "all" ||
              searchText) && (
              <span className="bg-brand-50 text-brand-700 text-xs font-medium px-2 py-0.5 rounded dark:bg-brand-900 dark:text-brand-300">
                Active
              </span>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${
              filterPanelExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>

        {/* Filter Content */}
        {filterPanelExpanded && (
          <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
            {/* Status Filters Row */}
            <div className="flex flex-wrap items-center gap-4 py-3 border-b border-gray-100 dark:border-gray-700">
              {statusFilters.map((filter) => (
                <label
                  key={filter.key}
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={filter.checked}
                    onChange={() => handleStatusFilterToggle(filter.key)}
                    className="w-4 h-4 text-brand-500 bg-gray-100 border-gray-300 rounded focus:ring-brand-500 dark:focus:ring-brand-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {filter.label}
                  </span>
                </label>
              ))}
              <label className="flex items-center gap-2 cursor-pointer select-none ml-4 pl-4 border-l border-gray-300 dark:border-gray-600">
                <input
                  type="checkbox"
                  checked={showVoid}
                  onChange={() => setShowVoid(!showVoid)}
                  className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 dark:focus:ring-red-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Show Void
                </span>
              </label>
            </div>

            {/* Date Filters Row */}
            <div className="flex flex-wrap items-end gap-4 py-3">
              {/* Scope Dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Scope
                </label>
                <select
                  value={scope}
                  onChange={(e) => handleScopeChange(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  {scopeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* From Date */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value)
                    setScope("custom")
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              {/* From Time */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  From Time
                </label>
                <input
                  type="time"
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              {/* To Date */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value)
                    setScope("custom")
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              {/* To Time */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  To Time
                </label>
                <input
                  type="time"
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>

              {/* Shift Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Shift
                </label>
                <select
                  value={shiftFilter}
                  onChange={(e) => setShiftFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white min-w-[100px]"
                >
                  <option value="">All</option>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>

              {/* Store Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Store
                </label>
                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white min-w-[120px]"
                >
                  <option value="">All Stores</option>
                  {currentStore && (
                    <option value={currentStore.storeId}>
                      {currentStore.storeName}
                    </option>
                  )}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-brand-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  Clear Filter
                </button>
                <button
                  onClick={handleRemountGrid}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 focus:ring-2 focus:ring-brand-500"
                >
                  Load
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Consolidated Action Header */}
      <ActionHeader
        selectedCount={selectedRows.size}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onBulkDelete={handleBulkDelete}
        onBulkExport={handleBulkExport}
        totalCount={totalRecords}
        loadedCount={loadedCount}
        itemType="phone orders"
        onAddNew={handleAddPhoneOrder}
        onRemountGrid={handleRemountGrid}
        showToast={showToast}
        searchText={searchText}
        onSearchChange={handleSearchInputChange}
        onSearchKeyPress={handleSearchKeyPress}
        currentPage={currentPage}
        totalPages={totalPages}
        onFirstPage={() => pageNavigationRef.current?.goToFirstPage()}
        onPreviousPage={() => pageNavigationRef.current?.goToPreviousPage()}
        onNextPage={() => pageNavigationRef.current?.goToNextPage()}
        onLastPage={() => pageNavigationRef.current?.goToLastPage()}
        staticActions={{}}
        showExportPrintButtons={true}
        onRefresh={() => {
          showToast("Refreshing grid...", "info")
          setTimeout(handleRemountGrid, 300)
        }}
        onExport={exportModal.open}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        onPrint={handlePrint}
        isExporting={isExporting}
        isPrinting={isPrinting}
      />

      {/* Main Grid Component */}
      <div style={{ flex: 1, minHeight: 0, height: "100%" }}>
        <ServerGrid
          key={`phone-orders-grid-${remountKey}`}
          data={[]}
          columns={columns}
          loading={false}
          error={null}
          totalRecords={totalRecords}
          onRowUpdate={handleRowUpdate}
          onRefresh={() => {}}
          pagination={true}
          pageSize={20}
          editable={true}
          columnChooser={true}
          title="Phone Orders List"
          emptyMessage="No phone orders found"
          emptyIcon="📞"
          serverSide={true}
          apiUrl={API_ENDPOINTS.PHONE_ORDERS.GET_ALL}
          methodType="GET"
          getAuthHeaders={memoizedGetAuthHeaders}
          defaultSortColumn="phoneOrderDate"
          containerWidth="47%"
          additionalParams={additionalParams}
          onRowSelection={handleRowSelection}
          selectedRows={selectedRows}
          setTotalRecords={setTotalRecords}
          setLoadedCount={setLoadedCount}
          setCurrentPage={setCurrentPage}
          setTotalPages={setTotalPages}
          onPageNavigation={(callbacks) => {
            pageNavigationRef.current = callbacks
          }}
          showCheckboxes={true}
          getRowId={(row) => row.phoneOrderID}
          onSelectAll={(selectAllFn) => {
            serverGridSelectAllRef.current = selectAllFn
          }}
          headerSearch={true}
          infiniteScroll={true}
          onView={handleViewPhoneOrder}
          onEdit={handleEditPhoneOrder}
          gridId={PHONE_ORDERS_GRID_ID}
          onColumnVisibilityChange={updateColumnVisibility}
          onColumnWidthChange={updateColumnWidth}
          onColumnsChange={handleColumnsChange}
          columnAggregates={columnAggregates}
          onAggregateChange={updateColumnAggregate}
          onDataChange={handleGridDataChange}
          customContextMenuItems={customContextMenuItems}
        />
      </div>

      {/* Embedded CSS for animations */}
      <style>
        {`
          @keyframes progressBar {
            0% { width: 100%; }
            100% { width: 0%; }
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

          .animate-progress-bar {
            animation: progressBar 3s linear forwards;
          }
        `}
      </style>
      <ExportModal {...exportModal.modalProps} />
      {ConfirmDialog}
    </div>
  )
})

export default PhoneOrderListPage
