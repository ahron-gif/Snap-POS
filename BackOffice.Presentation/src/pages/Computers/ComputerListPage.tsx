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
import { useColumnAccessFilter } from "../../hooks/useColumnAccessFilter"
import { useExportHandlers } from "../../hooks/useExportHandlers"
import { useExportModal } from "../../hooks/useExportModal"
import ExportModal from "../../components/common/ExportModal"
import axios from "axios"
import { useConfirm } from '../../components/ui/ConfirmModal'

// Computer record interface based on ComputerGridDto / ComputersView
interface ComputerRecord {
  computerID: string
  computerName: string | null
  computerNo: string | null
  storeID: string | null
  labelPrinter: string | null
  shelfPrinter: string | null
  invoicePrinter: string | null
  statementPrinter: string | null
  status: number | null
  dateCreated: string | null
  userCreated: string | null
  dateModified: string | null
  userModified: string | null
}

// Column definitions matching the old Computers screen columns
const computerColumnDefs: GridColDef[] = [
  {
    field: "computerName",
    headerName: "Computer Name",
    width: 200,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "labelPrinter",
    headerName: "Label Printer",
    width: 250,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "shelfPrinter",
    headerName: "Shelf Printer",
    width: 200,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "invoicePrinter",
    headerName: "Invoice Printer",
    width: 200,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "statementPrinter",
    headerName: "Statement Printer",
    width: 200,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "computerNo",
    headerName: "Computer No",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "storeID",
    headerName: "Store",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "status",
    headerName: "Status",
    width: 90,
    type: "number",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "dateCreated",
    headerName: "Date Created",
    width: 140,
    type: "datetime",
    sortable: true,
    filterable: true,
    visible: false,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "dateModified",
    headerName: "Date Modified",
    width: 140,
    type: "datetime",
    sortable: true,
    filterable: true,
    visible: false,
    cellRenderer: cellRenderers.datetime,
  },
]

// Grid ID for settings persistence
const COMPUTERS_GRID_ID = "computers-list-grid"

const ComputerListPage = memo(function ComputerListPage() {
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
    () => convertToGridColumns(computerColumnDefs),
    []
  )

  // Use grid settings hook for column visibility, width, and aggregate persistence
  const {
    columns: userPrefColumns,
    setColumns,
    updateColumnVisibility,
    updateColumnWidth,
    columnAggregates,
    updateColumnAggregate,
  } = useGridSettings(COMPUTERS_GRID_ID, defaultColumns)

  // Super-Admin ceiling: strip tenant-restricted columns + apply tenant
  // displayName / sortOrder overrides. See ItemListPage for the pattern.
  const { filteredColumns: columns } = useColumnAccessFilter(COMPUTERS_GRID_ID, userPrefColumns)

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

  // Build additional params for API request
  const additionalParams = useMemo(() => {
    const params: Record<string, string> = {}

    // Add search parameters if search text is provided
    if (debouncedSearchText.trim()) {
      params.CustomGridSearchText = debouncedSearchText.trim()
      params.CustomGridSearchColumns =
        "computerName,computerNo,labelPrinter,shelfPrinter,invoicePrinter,statementPrinter"
    }

    return params
  }, [debouncedSearchText])

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
    async (updatedRow: ComputerRecord) => {
      console.log("Edit computer:", updatedRow.computerID)
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
  const handleRowSelection = useCallback((computerID: string) => {
    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = new Set(prevSelectedRows)
      const wasSelected = newSelectedRows.has(computerID)

      if (wasSelected) {
        newSelectedRows.delete(computerID)
      } else {
        newSelectedRows.add(computerID)
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
        title: 'Delete Computers',
        message: `Are you sure you want to delete ${selectedRows.size} computer(s)? This action cannot be undone.`,
        variant: 'danger',
      })
      if (confirmed) {
        console.log("Bulk deleting computers:", selectedRows)
        setSelectedRows(new Set())
        showToast(
          `${selectedRows.size} computers deleted successfully!`,
          "success"
        )
      }
    }
  }, [selectedRows, showToast, confirm])

  // Handle bulk export (memoized)
  const handleBulkExport = useCallback(() => {
    if (selectedRows.size > 0) {
      console.log("Bulk exporting computers:", selectedRows)
      showToast(`Exporting ${selectedRows.size} computers...`, "info")
    }
  }, [selectedRows, showToast])

  // Handle View / Edit / New / Delete from context menu
  const handleViewComputer = useCallback(
    (row: ComputerRecord) => {
      console.log("View computer:", row.computerID)
    },
    []
  )

  const handleEditComputer = useCallback(
    (row: ComputerRecord) => {
      console.log("Edit computer:", row.computerID)
    },
    []
  )

  const handleNewComputer = useCallback(
    (row: ComputerRecord) => {
      console.log("New computer")
    },
    []
  )

  const handleDeleteComputer = useCallback(
    async (row: ComputerRecord) => {
      const confirmed = await confirm({
        title: 'Delete Computer',
        message: 'Are you sure you want to delete this computer? This action cannot be undone.',
        variant: 'danger',
      })
      if (confirmed) {
        console.log("Delete computer:", row.computerID)
        showToast("Computer deleted successfully!", "success")
      }
    },
    [showToast, confirm]
  )

  // Create custom context menu items: New, Show, Edit, Delete (matching old app)
  const customContextMenuItems: CustomContextMenuItem[] = useMemo(
    () => [
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
        onClick: handleNewComputer,
      },
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
        onClick: handleViewComputer,
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
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        ),
        onClick: handleEditComputer,
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
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        ),
        onClick: handleDeleteComputer,
      },
    ],
    [handleNewComputer, handleViewComputer, handleEditComputer, handleDeleteComputer]
  )

  // Fetch all data for export/print
  const fetchAllData = useCallback(async (dateFrom?: string, dateTo?: string): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const response = await axios({
        method: "GET",
        url: API_ENDPOINTS.COMPUTERS.GET_ALL,
        params: {
          startRow: 0,
          endRow: 1000000,
          ...(dateFrom && { dateFrom }),
          ...(dateTo && { dateTo }),
          sortColumn: "computerName",
          sortDirection: "asc",
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
    filename: "computers-list",
    pdfOptions: {
      title: "Computer List",
      subtitle: currentStore?.storeName || "All Stores",
      orientation: "landscape",
    },
  })

  const exportModal = useExportModal({
    columns,
    fetchAllData,
    filename: "computers-list",
    pdfOptions: { title: "Computer List", orientation: "landscape" },
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
        showToast("Selecting all computers...", "info")
      }
    } catch (error) {
      console.error("Error in handleSelectAll:", error)
      showToast("Error selecting computers", "error")
    }
  }, [showToast])

  return (
    <div
      className="computers-list-page p-2 mx-auto md:p-2 min-h-full"
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
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[350px] max-w-[400px] transition-all duration-300 animate-slide-in dark:bg-gray-800 dark:border-gray-700">
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
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 dark:text-white">
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
            <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden dark:bg-gray-700">
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
        itemType="computers"
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
        gridId={COMPUTERS_GRID_ID}
      />

      {/* Main Grid Component */}
      <div style={{ flex: 1, minHeight: 0, height: "100%" }}>
        <ServerGrid
          key={`computers-grid-${remountKey}`}
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
          title="Computer List"
          emptyMessage="No computers found"
          emptyIcon="🖥️"
          serverSide={true}
          apiUrl={API_ENDPOINTS.COMPUTERS.GET_ALL}
          methodType="GET"
          getAuthHeaders={memoizedGetAuthHeaders}
          defaultSortColumn="computerName"
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
          getRowId={(row) => row.computerID}
          onSelectAll={(selectAllFn) => {
            serverGridSelectAllRef.current = selectAllFn
          }}
          headerSearch={true}
          infiniteScroll={true}
          onView={handleViewComputer}
          gridId={COMPUTERS_GRID_ID}
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

export default ComputerListPage
