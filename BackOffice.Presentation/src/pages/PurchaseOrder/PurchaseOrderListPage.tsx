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

// Purchase Order record interface based on PurchaseOrderGridDto
interface PurchaseOrderRecord {
  purchaseOrderId: string
  poNo: string | null
  grandTotal: number | null
  purchaseOrderDate: string | null
  reqDate: string | null
  expirationDate: string | null
  reorder: boolean | null
  note: string | null
  vendorPONo: string | null
  openItemsCount: number
  storeName: string | null
  user: string | null
  supplier: string | null
  supplier_No: string | null
  poStatus: number | null
  emailAddress: string | null
  sent: boolean | null
  classID: string | null
  minMarkup: number | null
  listPrice: number | null
  import: number | null
  approved: boolean | null
  storeNo: string | null
  status: number | null
}

// Status filter options
interface StatusFilter {
  key: string
  label: string
  status: string
  checked: boolean
}

// PO Status mapping
const PO_STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: "Open", color: "#007bff" },
  1: { label: "Partial", color: "#fd7e14" },
  2: { label: "Close", color: "#800000" },
  3: { label: "Submitted", color: "#28a745" },
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

// Column definitions for purchase orders
const purchaseOrderColumnDefs: GridColDef[] = [
  {
    field: "poNo",
    headerName: "PO No",
    width: 100,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "grandTotal",
    headerName: "Total",
    width: 110,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value != null ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "purchaseOrderDate",
    headerName: "PO Date",
    width: 120,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "reqDate",
    headerName: "Expect Date",
    width: 120,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "expirationDate",
    headerName: "Expiration",
    width: 120,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "reorder",
    headerName: "Reorder",
    width: 80,
    type: "boolean",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.boolean,
  },
  {
    field: "note",
    headerName: "Note",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "vendorPONo",
    headerName: "Vendor PO",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "openItemsCount",
    headerName: "Open Items",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
  },
  {
    field: "storeName",
    headerName: "Store Name",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "user",
    headerName: "User",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "supplier",
    headerName: "Supplier",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "supplier_No",
    headerName: "Supplier No",
    width: 110,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "poStatus",
    headerName: "PO Status",
    width: 110,
    type: "string",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) => {
      const statusInfo = PO_STATUS_MAP[value] || {
        label: value?.toString() || "-",
        color: "#6c757d",
      }
      return (
        <span
          style={{
            color: statusInfo.color,
            fontWeight: 500,
          }}
        >
          {statusInfo.label}
        </span>
      )
    },
  },
  {
    field: "emailAddress",
    headerName: "Email Address",
    width: 180,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "sent",
    headerName: "Sent",
    width: 70,
    type: "boolean",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.boolean,
  },
  {
    field: "classID",
    headerName: "Class ID",
    width: 100,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "minMarkup",
    headerName: "Min Markup",
    width: 110,
    type: "number",
    sortable: true,
    filterable: true,
  },
  {
    field: "listPrice",
    headerName: "List Price",
    width: 110,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value != null ? `$${Number(value).toFixed(2)}` : "-",
  },
  {
    field: "import",
    headerName: "Import",
    width: 80,
    type: "number",
    sortable: true,
    filterable: true,
  },
  {
    field: "approved",
    headerName: "Approved",
    width: 90,
    type: "boolean",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.boolean,
  },
]

// Grid ID for settings persistence
const PURCHASE_ORDERS_GRID_ID = "purchase-orders-list-grid"

const PurchaseOrderListPage = memo(function PurchaseOrderListPage() {
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
    { key: "open", label: "Open", status: "0", checked: true },
    { key: "partial", label: "Partial", status: "1", checked: true },
    { key: "close", label: "Close", status: "2", checked: false },
    { key: "submitted", label: "Submitted", status: "3", checked: false },
  ])

  // Show void filter
  const [showVoid, setShowVoid] = useState(false)

  // Date filter state
  const [scope, setScope] = useState("all")
  const [fromDate, setFromDate] = useState<string>("")
  const [toDate, setToDate] = useState<string>("")

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
    () => convertToGridColumns(purchaseOrderColumnDefs),
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
  } = useGridSettings(PURCHASE_ORDERS_GRID_ID, defaultColumns)

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
        setFromDate("")
        setToDate("")
        return
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

    // Add search parameters if search text is provided
    if (debouncedSearchText.trim()) {
      params.CustomGridSearchText = debouncedSearchText.trim()
      params.CustomGridSearchColumns =
        "poNo,supplier,supplier_No,storeName,user,vendorPONo,note"
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
    if (scope !== "all" && fromDate && toDate) {
      params.fromDate = fromDate
      params.toDate = toDate
    }

    return params
  }, [
    currentStore?.storeId,
    debouncedSearchText,
    statusFilters,
    showVoid,
    scope,
    fromDate,
    toDate,
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
    async (updatedRow: PurchaseOrderRecord) => {
      openTab({
        component: "PurchaseOrderFormPage",
        title: `Edit: PO ${updatedRow.poNo || ""}`,
        closable: true,
        props: { id: updatedRow.purchaseOrderId },
      })
    },
    [openTab]
  )

  // Handle opening the add purchase order page
  const handleAddPurchaseOrder = useCallback(() => {
    openTab({
      component: "PurchaseOrderFormPage",
      title: "New Purchase Order",
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

  // Handle checkbox selection using purchaseOrderId as the primary identifier
  const handleRowSelection = useCallback((purchaseOrderId: string) => {
    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = new Set(prevSelectedRows)
      const wasSelected = newSelectedRows.has(purchaseOrderId)

      if (wasSelected) {
        newSelectedRows.delete(purchaseOrderId)
      } else {
        newSelectedRows.add(purchaseOrderId)
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
        title: 'Delete Purchase Orders',
        message: `Are you sure you want to delete ${selectedRows.size} purchase order(s)? This action cannot be undone.`,
        variant: 'danger',
      })
      if (confirmed) {
        console.log("Bulk deleting purchase orders:", selectedRows)
        setSelectedRows(new Set())
        showToast(
          `${selectedRows.size} purchase orders deleted successfully!`,
          "success"
        )
      }
    }
  }, [selectedRows, showToast, confirm])

  // Handle bulk export (memoized)
  const handleBulkExport = useCallback(() => {
    if (selectedRows.size > 0) {
      console.log("Bulk exporting purchase orders:", selectedRows)
      showToast(`Exporting ${selectedRows.size} purchase orders...`, "info")
    }
  }, [selectedRows, showToast])

  // Handle View Details from context menu
  const handleViewPurchaseOrder = useCallback(
    (row: PurchaseOrderRecord) => {
      openTab({
        component: "PurchaseOrderFormPage",
        title: `View: PO ${row.poNo || ""}`,
        closable: true,
        props: { id: row.purchaseOrderId, readOnly: true },
      })
    },
    [openTab]
  )

  // Handle Edit from context menu
  const handleEditPurchaseOrder = useCallback(
    (row: PurchaseOrderRecord) => {
      openTab({
        component: "PurchaseOrderFormPage",
        title: `Edit: PO ${row.poNo || ""}`,
        closable: true,
        props: { id: row.purchaseOrderId },
      })
    },
    [openTab]
  )

  // Handle Delete from context menu
  const handleDeletePurchaseOrder = useCallback(
    async (row: PurchaseOrderRecord) => {
      const confirmed = await confirm({
        title: 'Delete Purchase Order',
        message: `Are you sure you want to delete purchase order ${row.poNo || row.purchaseOrderId}? This action cannot be undone.`,
        variant: 'danger',
      })
      if (confirmed) {
        showToast(
          `Purchase order ${row.poNo || row.purchaseOrderId} deleted`,
          "success"
        )
        handleRemountGrid()
      }
    },
    [showToast, handleRemountGrid, confirm]
  )

  // Create custom context menu items
  const customContextMenuItems: CustomContextMenuItem[] = useMemo(
    () => [
      {
        label: "Show",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
        onClick: handleViewPurchaseOrder,
      },
      {
        label: "New",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        ),
        onClick: () => handleAddPurchaseOrder(),
        dividerBefore: true,
      },
      {
        label: "Edit",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="m18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        ),
        onClick: handleEditPurchaseOrder,
      },
      {
        label: "Delete",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="3,6 5,6 21,6" />
            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        ),
        onClick: handleDeletePurchaseOrder,
        color: "#dc2626",
        hoverBgColor: "#fef2f2",
        dividerBefore: true,
      },
    ],
    [
      handleViewPurchaseOrder,
      handleAddPurchaseOrder,
      handleEditPurchaseOrder,
      handleDeletePurchaseOrder,
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
        url: API_ENDPOINTS.PURCHASE_ORDERS.GET_ALL,
        params: {
          startRow: 0,
          endRow: 1000000,
          ...(dateFrom && { dateFrom }),
          ...(dateTo && { dateTo }),
          sortColumn: "purchaseOrderDate",
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
    filename: "purchase-orders-list",
    pdfOptions: {
      title: "Purchase Orders List",
      subtitle: currentStore?.storeName || "All Stores",
      orientation: "landscape",
    },
  })

  // Export modal
  const exportModal = useExportModal({
    columns,
    fetchAllData,
    filename: "purchase-orders-list",
    pdfOptions: { title: "Purchase Orders List", orientation: "landscape" },
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
        showToast("Selecting all purchase orders...", "info")
      }
    } catch (error) {
      console.error("Error in handleSelectAll:", error)
      showToast("Error selecting purchase orders", "error")
    }
  }, [showToast])

  return (
    <div
      className="purchase-orders-list-page p-2 mx-auto md:p-2 min-h-full"
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
        itemType="purchase orders"
        onAddNew={handleAddPurchaseOrder}
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
          key={`purchase-orders-grid-${remountKey}`}
          data={[]}
          columns={columns}
          loading={false}
          error={null}
          totalRecords={totalRecords}
          onRowUpdate={handleRowUpdate}
          onRefresh={() => {}}
          pagination={true}
          pageSize={50}
          editable={true}
          columnChooser={true}
          title="Purchase Orders List"
          emptyMessage="No purchase orders found"
          emptyIcon="📦"
          serverSide={true}
          apiUrl={API_ENDPOINTS.PURCHASE_ORDERS.GET_ALL}
          methodType="GET"
          getAuthHeaders={memoizedGetAuthHeaders}
          defaultSortColumn="purchaseOrderDate"
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
          getRowId={(row) => row.purchaseOrderId}
          onSelectAll={(selectAllFn) => {
            serverGridSelectAllRef.current = selectAllFn
          }}
          headerSearch={true}
          infiniteScroll={false}
          onView={handleViewPurchaseOrder}
          onEdit={handleEditPurchaseOrder}
          gridId={PURCHASE_ORDERS_GRID_ID}
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

export default PurchaseOrderListPage
