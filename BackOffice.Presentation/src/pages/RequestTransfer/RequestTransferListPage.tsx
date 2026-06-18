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

// Request Transfer record interface based on RequestTransferGridDto
interface RequestTransferRecord {
  requestTransferID: string
  requestNo: string | null
  fromStore: string | null
  toStore: string | null
  requestTransferStatusDec: string | null
  status: number | null
  requestStatus: number
  note: string | null
  userName: string | null
  requestDate: string | null
  dateCreated: string | null
  fromStoreID: string | null
  toStoreID: string | null
  openItems: number | null
}

// Column definitions matching the Request Transfer screen
const requestTransferColumnDefs: GridColDef[] = [
  {
    field: "requestNo",
    headerName: "Request No",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "fromStore",
    headerName: "From Store",
    width: 180,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "toStore",
    headerName: "To Store",
    width: 180,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "requestTransferStatusDec",
    headerName: "Request Transfer Status",
    width: 180,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "note",
    headerName: "Note",
    width: 200,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "userName",
    headerName: "User Name",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "requestDate",
    headerName: "Request Date",
    width: 140,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "openItems",
    headerName: "Open Items",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    visible: false,
    cellRenderer: (value: any) =>
      value != null && value !== 0 ? Number(value).toString() : "",
  },
  {
    field: "status",
    headerName: "Status",
    width: 100,
    type: "string",
    sortable: true,
    filterable: true,
    visible: false,
    cellRenderer: cellRenderers.status,
  },
  {
    field: "dateCreated",
    headerName: "Date Created",
    width: 150,
    type: "datetime",
    sortable: true,
    filterable: true,
    visible: false,
    cellRenderer: cellRenderers.datetime,
  },
]

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

// Helper function to get date range from scope
function getDateRangeFromScope(scope: string): {
  fromDate: string
  toDate: string
} {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let fromDate: Date
  let toDate: Date

  switch (scope) {
    case "today":
      fromDate = today
      toDate = today
      break
    case "yesterday":
      fromDate = new Date(today)
      fromDate.setDate(fromDate.getDate() - 1)
      toDate = new Date(fromDate)
      break
    case "thisWeek":
      fromDate = new Date(today)
      fromDate.setDate(fromDate.getDate() - fromDate.getDay())
      toDate = today
      break
    case "lastWeek":
      fromDate = new Date(today)
      fromDate.setDate(fromDate.getDate() - fromDate.getDay() - 7)
      toDate = new Date(fromDate)
      toDate.setDate(toDate.getDate() + 6)
      break
    case "thisMonth":
      fromDate = new Date(today.getFullYear(), today.getMonth(), 1)
      toDate = today
      break
    case "lastMonth":
      fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      toDate = new Date(today.getFullYear(), today.getMonth(), 0)
      break
    case "thisYear":
      fromDate = new Date(today.getFullYear(), 0, 1)
      toDate = today
      break
    case "lastYear":
      fromDate = new Date(today.getFullYear() - 1, 0, 1)
      toDate = new Date(today.getFullYear() - 1, 11, 31)
      break
    default:
      return { fromDate: "", toDate: "" }
  }

  return {
    fromDate: fromDate.toISOString().split("T")[0],
    toDate: toDate.toISOString().split("T")[0],
  }
}

// Grid ID for settings persistence
const REQUEST_TRANSFERS_GRID_ID = "request-transfers-list-grid"

const RequestTransferListPage = memo(function RequestTransferListPage() {
  const { getAuthHeaders } = useAuthHeaders()
  const { openTab } = useDashboardTabs()
  const { currentStore } = useStore()
  const { confirm, ConfirmDialog } = useConfirm()

  // State for search functionality
  const [searchText, setSearchText] = useState("")
  const [debouncedSearchText, setDebouncedSearchText] = useState("")

  // State for filters
  const [showVoid, setShowVoid] = useState(false)
  const [scope, setScope] = useState("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  // Applied filter state (only updates on Load)
  const [appliedFilters, setAppliedFilters] = useState({
    showVoid: false,
    fromDate: "",
    toDate: "",
  })

  // State for bulk selection
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [totalRecords, setTotalRecords] = useState(0)
  const [loadedCount, setLoadedCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [remountKey, setRemountKey] = useState(0)

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
    () => convertToGridColumns(requestTransferColumnDefs),
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
  } = useGridSettings(REQUEST_TRANSFERS_GRID_ID, defaultColumns)

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

  // Handle scope change
  const handleScopeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newScope = e.target.value
      setScope(newScope)

      if (newScope === "all") {
        setFromDate("")
        setToDate("")
      } else {
        const range = getDateRangeFromScope(newScope)
        setFromDate(range.fromDate)
        setToDate(range.toDate)
      }
    },
    []
  )

  // Handle Clear Filter
  const handleClearFilter = useCallback(() => {
    setShowVoid(false)
    setScope("all")
    setFromDate("")
    setToDate("")
    setAppliedFilters({
      showVoid: false,
      fromDate: "",
      toDate: "",
    })
    setRemountKey((prev) => prev + 1)
  }, [])

  // Handle Load
  const handleLoadFilter = useCallback(() => {
    setAppliedFilters({
      showVoid,
      fromDate,
      toDate,
    })
    setRemountKey((prev) => prev + 1)
  }, [showVoid, fromDate, toDate])

  // Build additional params for API request
  const additionalParams = useMemo(() => {
    const params: Record<string, string> = {}

    // Add search parameters if search text is provided
    if (debouncedSearchText.trim()) {
      params.CustomGridSearchText = debouncedSearchText.trim()
      params.CustomGridSearchColumns =
        "requestNo,fromStore,toStore,requestTransferStatusDec,note,userName"
    }

    // Build filters array for server-side filtering
    const serverFilters: any[] = []

    // Show Void filter: when false, filter Status > 0 (non-void)
    if (!appliedFilters.showVoid) {
      serverFilters.push({
        Column: "status",
        Value: "0",
        Operation: "greaterThan",
      })
    }

    // Date range filters on RequestDate
    if (appliedFilters.fromDate) {
      serverFilters.push({
        Column: "requestDate",
        Value: appliedFilters.fromDate,
        Operation: "greaterThanOrEqual",
      })
    }

    if (appliedFilters.toDate) {
      serverFilters.push({
        Column: "requestDate",
        Value: appliedFilters.toDate + "T23:59:59",
        Operation: "lessThanOrEqual",
      })
    }

    if (serverFilters.length > 0) {
      params.Filters = JSON.stringify(serverFilters)
    }

    return params
  }, [debouncedSearchText, appliedFilters])

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
    async (updatedRow: RequestTransferRecord) => {
      console.log("View request transfer:", updatedRow.requestTransferID)
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
  const handleRowSelection = useCallback((requestTransferID: string) => {
    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = new Set(prevSelectedRows)
      const wasSelected = newSelectedRows.has(requestTransferID)

      if (wasSelected) {
        newSelectedRows.delete(requestTransferID)
      } else {
        newSelectedRows.add(requestTransferID)
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
        title: 'Delete Request Transfers',
        message: `Are you sure you want to delete ${selectedRows.size} request transfer(s)? This action cannot be undone.`,
        variant: 'danger',
      })
      if (confirmed) {
        console.log("Bulk deleting request transfers:", selectedRows)
        setSelectedRows(new Set())
        showToast(
          `${selectedRows.size} request transfers deleted successfully!`,
          "success"
        )
      }
    }
  }, [selectedRows, showToast, confirm])

  // Handle bulk export (memoized)
  const handleBulkExport = useCallback(() => {
    if (selectedRows.size > 0) {
      console.log("Bulk exporting request transfers:", selectedRows)
      showToast(`Exporting ${selectedRows.size} request transfers...`, "info")
    }
  }, [selectedRows, showToast])

  // Handle View Details from context menu
  const handleViewRequestTransfer = useCallback(
    (row: RequestTransferRecord) => {
      console.log("View request transfer:", row.requestTransferID)
    },
    []
  )

  // Create custom context menu items: Show
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
        onClick: handleViewRequestTransfer,
      },
    ],
    [handleViewRequestTransfer]
  )

  // Fetch all data for export/print
  const fetchAllData = useCallback(async (dateFrom?: string, dateTo?: string): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const response = await axios({
        method: "GET",
        url: API_ENDPOINTS.REQUEST_TRANSFERS.GET_ALL,
        params: {
          startRow: 0,
          endRow: 1000000,
          ...(dateFrom && { dateFrom }),
          ...(dateTo && { dateTo }),
          sortColumn: "requestDate",
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
    filename: "request-transfers-list",
    pdfOptions: {
      title: "Request Transfers List",
      subtitle: currentStore?.storeName || "All Stores",
      orientation: "landscape",
    },
  })

  const exportModal = useExportModal({
    columns,
    fetchAllData,
    filename: "request-transfers-list",
    pdfOptions: { title: "Request Transfers List", orientation: "landscape" },
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
        showToast("Selecting all request transfers...", "info")
      }
    } catch (error) {
      console.error("Error in handleSelectAll:", error)
      showToast("Error selecting request transfers", "error")
    }
  }, [showToast])

  return (
    <div
      className="request-transfers-list-page p-2 mx-auto md:p-2 min-h-full"
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

      {/* Consolidated Action Header */}
      <ActionHeader
        selectedCount={selectedRows.size}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onBulkDelete={handleBulkDelete}
        onBulkExport={handleBulkExport}
        totalCount={totalRecords}
        loadedCount={loadedCount}
        itemType="request transfers"
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

      {/* Filter Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5 mb-2">
        <div className="flex flex-wrap items-center gap-4">
          {/* Show Void Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={showVoid}
              onChange={(e) => setShowVoid(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600"
            />
            <span className="text-gray-700 dark:text-gray-300">Show Void</span>
          </label>

          {/* Separator */}
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

          {/* Scope Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">
              Scope:
            </label>
            <select
              value={scope}
              onChange={handleScopeChange}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:ring-brand-500 focus:border-brand-500"
            >
              {scopeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">
              From:
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                setScope("all")
              }}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {/* To Date */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">
              To:
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value)
                setScope("all")
              }}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {/* Separator */}
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

          {/* Clear Filter Button */}
          <button
            onClick={handleClearFilter}
            className="text-sm px-3 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            Clear Filter
          </button>

          {/* Load Button */}
          <button
            onClick={handleLoadFilter}
            className="text-sm px-3 py-1 rounded-md bg-brand-500 text-white hover:bg-brand-600 transition-colors"
          >
            Load
          </button>
        </div>
      </div>

      {/* Main Grid Component */}
      <div style={{ flex: 1, minHeight: 0, height: "100%" }}>
        <ServerGrid
          key={`request-transfers-grid-${remountKey}`}
          data={[]}
          columns={columns}
          loading={false}
          error={null}
          totalRecords={totalRecords}
          onRowUpdate={handleRowUpdate}
          onRefresh={() => {}}
          pagination={true}
          pageSize={50}
          editable={false}
          columnChooser={true}
          title="Request Transfers List"
          emptyMessage="No request transfers found"
          emptyIcon="📦"
          serverSide={true}
          apiUrl={API_ENDPOINTS.REQUEST_TRANSFERS.GET_ALL}
          methodType="GET"
          getAuthHeaders={memoizedGetAuthHeaders}
          defaultSortColumn="requestDate"
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
          getRowId={(row) => row.requestTransferID}
          onSelectAll={(selectAllFn) => {
            serverGridSelectAllRef.current = selectAllFn
          }}
          headerSearch={true}
          infiniteScroll={false}
          onView={handleViewRequestTransfer}
          gridId={REQUEST_TRANSFERS_GRID_ID}
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
      {ConfirmDialog}
      <ExportModal {...exportModal.modalProps} />
    </div>
  )
})

export default RequestTransferListPage
