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

// Transaction record interface based on TransactionGridDto
interface TransactionRecord {
  transactionID: string
  transactionNo: string
  transactionType: number
  transactionTypeName: string
  customerName: string
  customerNo: string | null
  debit: number | null
  credit: number | null
  amount: number | null
  appliedAmount: number | null
  balance: number | null
  subTotal: number | null
  tax: number | null
  freight: number | null
  startSaleTime: string | null
  startTime: string | null
  endSaleTime: string | null
  dueDate: string | null
  deliveryDate: string | null
  trackNo: string | null
  status: number | null
  voidReason: string | null
  storeName: string | null
  user: string | null
  saleAssociate: string | null
  note: string | null
  resellerName: string
  poNo: string | null
  registerTransaction: boolean | null
  phoneOrder: boolean | null
  batchID: string | null
  storeID: string | null
  customerID: string | null
}

// Transaction type filter options
interface TransactionTypeFilter {
  key: string
  value: number
  label: string
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

// Column definitions matching the Transactions screen
const transactionColumnDefs: GridColDef[] = [
  {
    field: "transactionNo",
    headerName: "Transaction No",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "transactionTypeName",
    headerName: "Type",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "startSaleTime",
    headerName: "Sale Date",
    width: 120,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "startTime",
    headerName: "Sale Time",
    width: 100,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "customerNo",
    headerName: "Customer No",
    width: 120,
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
  },
  {
    field: "amount",
    headerName: "Amount",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value != null ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "appliedAmount",
    headerName: "Amount Paid",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value != null ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "balance",
    headerName: "Balance",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value != null ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "note",
    headerName: "Note",
    width: 180,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "storeName",
    headerName: "Store",
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
    field: "saleAssociate",
    headerName: "Sale Associate",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
  },
  // Hidden columns (available via column chooser)
  {
    field: "subTotal",
    headerName: "SubTotal",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    visible: false,
    cellRenderer: (value: any) =>
      value != null ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "tax",
    headerName: "Tax",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    visible: false,
    cellRenderer: (value: any) =>
      value != null ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "freight",
    headerName: "Freight",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    visible: false,
    cellRenderer: (value: any) =>
      value != null ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "dueDate",
    headerName: "Due Date",
    width: 120,
    type: "datetime",
    sortable: true,
    filterable: true,
    visible: false,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "deliveryDate",
    headerName: "Delivery Date",
    width: 120,
    type: "datetime",
    sortable: true,
    filterable: true,
    visible: false,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "trackNo",
    headerName: "Track No",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "resellerName",
    headerName: "Reseller",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "poNo",
    headerName: "PO No",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "status",
    headerName: "Status",
    width: 100,
    type: "string",
    sortable: true,
    filterable: true,
    visible: false,
    cellRenderer: (value: any) => {
      if (value === 0) return "Void"
      if (value === 1) return "Active"
      return value ?? ""
    },
  },
  {
    field: "voidReason",
    headerName: "Void Reason",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
    visible: false,
  },
]

// Grid ID for settings persistence
const TRANSACTIONS_GRID_ID = "transactions-list-grid"

const TransactionListPage = memo(function TransactionListPage() {
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

  // Transaction type filter state
  const [transactionTypeFilters, setTransactionTypeFilters] = useState<
    TransactionTypeFilter[]
  >([
    { key: "sale", value: 0, label: "Sale", checked: true },
    { key: "phoneOrder", value: 1, label: "Phone Order", checked: true },
    { key: "return", value: 2, label: "Return", checked: true },
    { key: "returnItem", value: 3, label: "Return Item", checked: true },
    { key: "payment", value: 4, label: "Payment", checked: true },
    { key: "openingBalance", value: 5, label: "Opening Balance", checked: true },
  ])
  const [allTypesChecked, setAllTypesChecked] = useState(true)

  // Show void filter
  const [showVoid, setShowVoid] = useState(false)

  // Only open invoices filter
  const [onlyOpenInvoices, setOnlyOpenInvoices] = useState(false)

  // Date filter state - default to today
  const [scope, setScope] = useState("today")
  const [fromDate, setFromDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  )
  const [toDate, setToDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  )

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
    () => convertToGridColumns(transactionColumnDefs),
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
  } = useGridSettings(TRANSACTIONS_GRID_ID, defaultColumns)

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

  // Handle transaction type filter toggle
  const handleTypeFilterToggle = useCallback((key: string) => {
    setTransactionTypeFilters((prev) => {
      const updated = prev.map((f) =>
        f.key === key ? { ...f, checked: !f.checked } : f
      )
      setAllTypesChecked(updated.every((f) => f.checked))
      return updated
    })
  }, [])

  // Handle "All" checkbox toggle for transaction types
  const handleAllTypesToggle = useCallback(() => {
    const newChecked = !allTypesChecked
    setAllTypesChecked(newChecked)
    setTransactionTypeFilters((prev) =>
      prev.map((f) => ({ ...f, checked: newChecked }))
    )
  }, [allTypesChecked])

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
        "transactionNo,transactionTypeName,customerName,customerNo,storeName,user,saleAssociate,note,trackNo,resellerName,poNo"
    }

    // Show void filter
    params.showVoid = showVoid ? "true" : "false"

    // Only open invoices filter
    if (onlyOpenInvoices) {
      params.onlyOpenInvoices = "true"
    }

    // Transaction type filters (if not all selected)
    const activeTypes = transactionTypeFilters
      .filter((f) => f.checked)
      .map((f) => f.value.toString())
    if (activeTypes.length > 0 && activeTypes.length < transactionTypeFilters.length) {
      params.transactionTypes = activeTypes.join(",")
    }

    // Date filters
    if (fromDate && toDate) {
      params.fromDate = fromDate
      params.toDate = toDate
    }

    return params
  }, [
    currentStore?.storeId,
    debouncedSearchText,
    showVoid,
    onlyOpenInvoices,
    transactionTypeFilters,
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

  // Handle row updates (double-click to view)
  const handleRowUpdate = useCallback(
    async (updatedRow: TransactionRecord) => {
      // View transaction details on double-click
      console.log("View transaction:", updatedRow.transactionID)
    },
    []
  )

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

  // Handle checkbox selection
  const handleRowSelection = useCallback((transactionID: string) => {
    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = new Set(prevSelectedRows)
      const wasSelected = newSelectedRows.has(transactionID)

      if (wasSelected) {
        newSelectedRows.delete(transactionID)
      } else {
        newSelectedRows.add(transactionID)
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
        title: 'Delete Transactions',
        message: `Are you sure you want to delete ${selectedRows.size} transaction(s)? This action cannot be undone.`,
        variant: 'danger',
      })
      if (confirmed) {
        console.log("Bulk deleting transactions:", selectedRows)
        setSelectedRows(new Set())
        showToast(
          `${selectedRows.size} transactions deleted successfully!`,
          "success"
        )
      }
    }
  }, [selectedRows, showToast, confirm])

  // Handle bulk export (memoized)
  const handleBulkExport = useCallback(() => {
    if (selectedRows.size > 0) {
      console.log("Bulk exporting transactions:", selectedRows)
      showToast(`Exporting ${selectedRows.size} transactions...`, "info")
    }
  }, [selectedRows, showToast])

  // Handle View Details from context menu
  const handleViewTransaction = useCallback(
    (row: TransactionRecord) => {
      console.log("View transaction:", row.transactionID)
    },
    []
  )

  // Handle View Customer from context menu
  const handleViewCustomer = useCallback(
    (row: TransactionRecord) => {
      if (row.customerNo) {
        openTab({
          component: "CustomerListPage",
          title: "Customer List",
          closable: true,
        })
      }
    },
    [openTab]
  )

  // Create custom context menu items: Show, View Customer
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
        onClick: handleViewTransaction,
      },
      {
        label: "View Customer",
        icon: (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
        onClick: handleViewCustomer,
        dividerBefore: true,
      },
    ],
    [handleViewTransaction, handleViewCustomer]
  )

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setShowVoid(false)
    setOnlyOpenInvoices(false)
    setAllTypesChecked(true)
    setTransactionTypeFilters((prev) =>
      prev.map((f) => ({ ...f, checked: true }))
    )
    setScope("today")
    setFromDate(new Date().toISOString().split("T")[0])
    setToDate(new Date().toISOString().split("T")[0])
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
        url: API_ENDPOINTS.TRANSACTIONS.GET_ALL,
        params: {
          startRow: 0,
          endRow: 1000000,
          ...(dateFrom && { dateFrom }),
          ...(dateTo && { dateTo }),
          sortColumn: "startSaleTime",
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
    filename: "transactions-list",
    pdfOptions: {
      title: "Transactions List",
      subtitle: currentStore?.storeName || "All Stores",
      orientation: "landscape",
    },
  })

  // Export modal
  const exportModal = useExportModal({
    columns,
    fetchAllData,
    filename: "transactions-list",
    pdfOptions: { title: "Transactions List", orientation: "landscape" },
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
        showToast("Selecting all transactions...", "info")
      }
    } catch (error) {
      console.error("Error in handleSelectAll:", error)
      showToast("Error selecting transactions", "error")
    }
  }, [showToast])

  return (
    <div
      className="transactions-list-page p-2 mx-auto md:p-2 min-h-full"
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
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {toast.type === "error" && (
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                {toast.type === "info" && (
                  <svg className="w-6 h-6 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-3 w-full bg-gray-200 rounded-full h-1 overflow-hidden dark:bg-gray-700">
              <div
                className={`h-1 rounded-full ${
                  toast.type === "success" ? "bg-green-500" : toast.type === "error" ? "bg-red-500" : "bg-brand-500"
                }`}
                style={{ width: "100%", animation: "progressBar 3s linear forwards" }}
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
            {(showVoid || onlyOpenInvoices || !allTypesChecked || scope !== "today" || searchText) && (
              <span className="bg-brand-50 text-brand-700 text-xs font-medium px-2 py-0.5 rounded dark:bg-brand-900 dark:text-brand-300">
                Active
              </span>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform ${filterPanelExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Filter Content */}
        {filterPanelExpanded && (
          <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
            {/* Transaction Type Filter Row */}
            <div className="flex flex-wrap items-center gap-4 py-3 border-b border-gray-100 dark:border-gray-700">
              {/* All checkbox */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allTypesChecked}
                  onChange={handleAllTypesToggle}
                  className="w-4 h-4 text-brand-500 bg-gray-100 border-gray-300 rounded focus:ring-brand-500 dark:focus:ring-brand-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  All
                </span>
              </label>

              {/* Individual type checkboxes */}
              {transactionTypeFilters.map((filter) => (
                <label
                  key={filter.key}
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={filter.checked}
                    onChange={() => handleTypeFilterToggle(filter.key)}
                    className="w-4 h-4 text-brand-500 bg-gray-100 border-gray-300 rounded focus:ring-brand-500 dark:focus:ring-brand-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {filter.label}
                  </span>
                </label>
              ))}

              {/* Separator */}
              <div className="h-5 border-l border-gray-300 dark:border-gray-600 mx-1" />

              {/* Show Void */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
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

              {/* Only Open Invoices */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyOpenInvoices}
                  onChange={() => setOnlyOpenInvoices(!onlyOpenInvoices)}
                  className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 dark:focus:ring-orange-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Only Open Invoices
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
        itemType="transactions"
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
          key={`transactions-grid-${remountKey}`}
          data={[]}
          columns={columns}
          loading={false}
          error={null}
          totalRecords={totalRecords}
          onRowUpdate={handleRowUpdate}
          onRefresh={() => {}}
          pagination={true}
          pageSize={20}
          editable={false}
          columnChooser={true}
          title="Transactions List"
          emptyMessage="No transactions found"
          emptyIcon="📋"
          serverSide={true}
          apiUrl={API_ENDPOINTS.TRANSACTIONS.GET_ALL}
          methodType="GET"
          getAuthHeaders={memoizedGetAuthHeaders}
          defaultSortColumn="startSaleTime"
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
          getRowId={(row) => row.transactionID}
          onSelectAll={(selectAllFn) => {
            serverGridSelectAllRef.current = selectAllFn
          }}
          headerSearch={true}
          infiniteScroll={true}
          onView={handleViewTransaction}
          gridId={TRANSACTIONS_GRID_ID}
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

export default TransactionListPage
