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

// Store record interface based on StoreGridDto / StoreView
interface StoreRecord {
  storeID: string
  storeName: string | null
  storeDescription: string | null
  parentStore: string | null
  defaultMarkup: number | null
  defaultMarkupA: number | null
  defaultMarkupB: number | null
  defaultMarkupC: number | null
  defaultMarkupD: number | null
  roundUp: number | null
  roundValue: number | null
  defaultCogsAccount: number | null
  defaultIncomeAccount: number | null
  defaultTaxNo: string | null
  isDefaultTaxInclude: boolean | null
  defaultProfitCalculation: number | null
  storeEmail: string | null
  isMainStore: boolean | null
  status: number | null
  dateCreated: string | null
  userCreated: string | null
  dateModified: string | null
  userModified: string | null
  address: string | null
  cityStateZip: string | null
  country: string | null
  dateClosed: string | null
  dateOpened: string | null
  districtID: string | null
  fax: string | null
  phone1: string | null
  phone2: string | null
  regionID: string | null
  storeNumber: string | null
  storeInt: number
}

// Column definitions matching the old Store List screen columns
const storeColumnDefs: GridColDef[] = [
  {
    field: "storeID",
    headerName: "Store ID",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "storeName",
    headerName: "Store Name",
    width: 160,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "storeDescription",
    headerName: "Store Description",
    width: 170,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "parentStore",
    headerName: "Parent Store",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "defaultMarkup",
    headerName: "Default Markup",
    width: 130,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value != null ? Number(value).toFixed(3) : "",
  },
  {
    field: "defaultMarkupA",
    headerName: "Markup A",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "defaultMarkupB",
    headerName: "Markup B",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "defaultMarkupC",
    headerName: "Markup C",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "defaultMarkupD",
    headerName: "Markup D",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "roundUp",
    headerName: "Round Up",
    width: 90,
    type: "number",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "roundValue",
    headerName: "Round Value",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "defaultCogsAccount",
    headerName: "COGS Account",
    width: 110,
    type: "number",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "defaultIncomeAccount",
    headerName: "Income Account",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "isDefaultTaxInclude",
    headerName: "Tax Include",
    width: 100,
    type: "string",
    sortable: true,
    filterable: true,
    visible: false,
    cellRenderer: cellRenderers.boolean,
  },
  {
    field: "defaultProfitCalculation",
    headerName: "Profit Calc",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "userModified",
    headerName: "User Modified",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "isMainStore",
    headerName: "Is Main",
    width: 80,
    type: "string",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.boolean,
  },
  {
    field: "address",
    headerName: "Address",
    width: 200,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "cityStateZip",
    headerName: "City State Zip",
    width: 180,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "country",
    headerName: "Country",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "dateCreated",
    headerName: "Date Created",
    width: 140,
    type: "datetime",
    sortable: true,
    filterable: true,
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
  {
    field: "districtID",
    headerName: "District",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "fax",
    headerName: "Fax",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "phone1",
    headerName: "Phone1",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "phone2",
    headerName: "Phone2",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "regionID",
    headerName: "Region",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "storeNumber",
    headerName: "Store Number",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "storeInt",
    headerName: "Store Int",
    width: 90,
    type: "number",
    sortable: true,
    filterable: true,
  },
]

// Grid ID for settings persistence
const STORES_GRID_ID = "stores-list-grid"

const StoreListPage = memo(function StoreListPage() {
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
    () => convertToGridColumns(storeColumnDefs),
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
  } = useGridSettings(STORES_GRID_ID, defaultColumns)

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
        "storeName,storeDescription,address,cityStateZip,country,phone1,phone2,fax,storeNumber"
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
    async (updatedRow: StoreRecord) => {
      console.log("Edit store:", updatedRow.storeID)
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
  const handleRowSelection = useCallback((storeID: string) => {
    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = new Set(prevSelectedRows)
      const wasSelected = newSelectedRows.has(storeID)

      if (wasSelected) {
        newSelectedRows.delete(storeID)
      } else {
        newSelectedRows.add(storeID)
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
        title: 'Delete Selected Stores',
        message: `Are you sure you want to delete ${selectedRows.size} store(s)? This action cannot be undone.`,
        variant: 'danger',
      })
      if (confirmed) {
        console.log("Bulk deleting stores:", selectedRows)
        setSelectedRows(new Set())
        showToast(
          `${selectedRows.size} stores deleted successfully!`,
          "success"
        )
      }
    }
  }, [selectedRows, showToast, confirm])

  // Handle bulk export (memoized)
  const handleBulkExport = useCallback(() => {
    if (selectedRows.size > 0) {
      console.log("Bulk exporting stores:", selectedRows)
      showToast(`Exporting ${selectedRows.size} stores...`, "info")
    }
  }, [selectedRows, showToast])

  // Handle View / Edit Details from context menu
  const handleViewStore = useCallback(
    (row: StoreRecord) => {
      openTab({
        component: 'StoreFormPage',
        title: `View: ${row.storeName || 'Store'}`,
        closable: true,
        props: { id: row.storeID, mode: 'view' },
      });
    },
    [openTab]
  )

  const handleEditStore = useCallback(
    (row: StoreRecord) => {
      openTab({
        component: 'StoreFormPage',
        title: `Edit: ${row.storeName || 'Store'}`,
        closable: true,
        props: { id: row.storeID, mode: 'edit' },
      });
    },
    [openTab]
  )

  // Create custom context menu items: Show, Edit (matching old app's New/Edit)
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
        onClick: handleViewStore,
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
        onClick: handleEditStore,
      },
    ],
    [handleViewStore, handleEditStore]
  )

  // Fetch all data for export/print
  const fetchAllData = useCallback(async (dateFrom?: string, dateTo?: string): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const response = await axios({
        method: "GET",
        url: API_ENDPOINTS.STORES.GET_ALL,
        params: {
          startRow: 0,
          endRow: 1000000,
          ...(dateFrom && { dateFrom }),
          ...(dateTo && { dateTo }),
          sortColumn: "storeName",
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
    filename: "stores-list",
    pdfOptions: {
      title: "Store List",
      subtitle: currentStore?.storeName || "All Stores",
      orientation: "landscape",
    },
  })

  // Export modal
  const exportModal = useExportModal({
    columns,
    fetchAllData,
    filename: "stores-list",
    pdfOptions: { title: "Store List", orientation: "landscape" },
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
        showToast("Selecting all stores...", "info")
      }
    } catch (error) {
      console.error("Error in handleSelectAll:", error)
      showToast("Error selecting stores", "error")
    }
  }, [showToast])

  return (
    <div
      className="stores-list-page p-2 mx-auto md:p-2 min-h-full"
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
        itemType="stores"
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
          key={`stores-grid-${remountKey}`}
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
          title="Store List"
          emptyMessage="No stores found"
          emptyIcon="🏪"
          serverSide={true}
          apiUrl={API_ENDPOINTS.STORES.GET_ALL}
          methodType="GET"
          getAuthHeaders={memoizedGetAuthHeaders}
          defaultSortColumn="storeName"
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
          getRowId={(row) => row.storeID}
          onSelectAll={(selectAllFn) => {
            serverGridSelectAllRef.current = selectAllFn
          }}
          headerSearch={true}
          infiniteScroll={false}
          onView={handleViewStore}
          gridId={STORES_GRID_ID}
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

export default StoreListPage
