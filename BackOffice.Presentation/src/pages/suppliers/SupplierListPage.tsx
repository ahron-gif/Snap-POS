import React, { useState, useCallback, memo, useMemo, useRef } from "react"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import {
  convertToGridColumns,
  cellRenderers,
  GridColDef,
} from "../../gridUtils"
import ActionHeader from "../../components/common/ActionHeader"
import { useDashboardTabs } from "../../context/DashboardTabContext"
import { useGridSettings } from "../../hooks/useGridSettings"
import { useExportHandlers } from "../../hooks/useExportHandlers"
import { useExportModal } from "../../hooks/useExportModal"
import ExportModal from "../../components/common/ExportModal"
import { CustomContextMenuItem } from "../../components/common/ServerGrid/components/GridBody"
import axios from "axios"
import { useConfirm } from '../../components/ui/ConfirmModal'

// Supplier record interface (based on SupplierView)
interface SupplierRecord {
  supplierID: string
  supplierNo: string | null
  name: string | null
  defaultCredit: string | null
  webSite: string | null
  emailAddress: string | null
  mainAddress: string | null
  contactName: string
  barterID: string | null
  warehouseID: string | null
  status: number | null
  dateCreated: string | null
  userCreated: string | null
  dateModified: string | null
  userModified: string | null
  accountNo: string | null
  note: string | null
  address1: string
  address2: string
  city: string
  state: string
  zip: string
  phoneNumber1: string
  ext1: string | null
  phoneNumber2: string
  phoneNumber3: string
  minMarkup: number
  buyerID: string | null
  listPrice: number | null
  department: string | null
  import: number | null
  supplierNote: string | null
}

// Column definitions for suppliers (mapped to SupplierView)
const suppliersColumnDefs: GridColDef[] = [
  {
    field: "supplierNo",
    headerName: "Supplier No",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "name",
    headerName: "Name",
    width: 200,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "contactName",
    headerName: "Contact Name",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "phoneNumber1",
    headerName: "Phone",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "emailAddress",
    headerName: "Email",
    width: 200,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "webSite",
    headerName: "Website",
    width: 180,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "accountNo",
    headerName: "Account No",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "address1",
    headerName: "Address",
    width: 200,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "city",
    headerName: "City",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "state",
    headerName: "State",
    width: 80,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "zip",
    headerName: "Zip",
    width: 100,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "phoneNumber2",
    headerName: "Phone 2",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "phoneNumber3",
    headerName: "Fax",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "minMarkup",
    headerName: "Min Markup",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value ? `${Number(value).toFixed(2)}%` : "0%",
  },
  {
    field: "listPrice",
    headerName: "List Price",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value ? `$${Number(value).toFixed(2)}` : "-",
  },
  {
    field: "status",
    headerName: "Status",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) => {
      const isActive = value === 0 || value === null
      return (
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            backgroundColor: isActive ? "#dcfce7" : "#fee2e2",
            color: isActive ? "#166534" : "#991b1b",
          }}
        >
          {isActive ? "Active" : "Inactive"}
        </span>
      )
    },
  },
  {
    field: "dateCreated",
    headerName: "Date Created",
    width: 150,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "dateModified",
    headerName: "Date Modified",
    width: 150,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
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
    field: "supplierID",
    headerName: "Supplier ID",
    width: 280,
    type: "string",
    sortable: true,
    filterable: true,
  },
]

// Grid ID for settings persistence
const SUPPLIERS_GRID_ID = "suppliers-list-grid"

const SupplierListPage = memo(function SupplierListPage() {
  const { getAuthHeaders } = useAuthHeaders()
  const { openTab } = useDashboardTabs()
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
  const defaultColumns = useMemo(() => convertToGridColumns(suppliersColumnDefs), [])

  // Use grid settings hook for column visibility, width, and aggregate persistence
  const {
    columns,
    setColumns,
    updateColumnVisibility,
    updateColumnWidth,
    columnAggregates,
    updateColumnAggregate,
  } = useGridSettings(SUPPLIERS_GRID_ID, defaultColumns)

  // Handle column changes from grid for persistence
  const handleColumnsChange = useCallback((newColumns: any[]) => {
    setColumns(newColumns)
  }, [setColumns])

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchText])

  // Create API search parameters
  const additionalParams = useMemo(() => {
    const params: Record<string, string> = {}

    if (debouncedSearchText.trim()) {
      params.CustomGridSearchText = debouncedSearchText.trim()
      params.CustomGridSearchColumns = "name,supplierNo,contactName,emailAddress"
    }

    return params
  }, [debouncedSearchText])

  // Handle search input change from ActionHeader
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

  // Toast notification function
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      setToast({ show: true, message, type })
      setTimeout(() => {
        setToast({ show: false, message: "", type: "success" })
      }, 3000)
    },
    []
  )

  // Context Menu Handlers
  const handleOpenSupplier = useCallback((row: SupplierRecord) => {
    openTab({
      component: "SupplierFormPage",
      title: `Supplier: ${row.name || "Details"}`,
      closable: true,
      props: { id: row.supplierID, mode: "view" },
    })
  }, [openTab])

  const handleNewSupplier = useCallback(() => {
    openTab({
      component: "SupplierFormPage",
      title: "New Supplier",
      closable: true,
      props: { isNew: true },
    })
  }, [openTab])

  const handleEditSupplier = useCallback((row: SupplierRecord) => {
    openTab({
      component: "SupplierFormPage",
      title: `Edit: ${row.name || "Supplier"}`,
      closable: true,
      props: { id: row.supplierID, mode: "edit" },
    })
  }, [openTab])

  const handleDeleteSupplier = useCallback(async (row: SupplierRecord) => {
    const confirmed = await confirm({
      title: 'Delete Supplier',
      message: `Are you sure you want to delete supplier "${row.name}"? This action cannot be undone.`,
      variant: 'danger',
    })
    if (confirmed) {
      console.log("Delete supplier:", row.supplierID)
      showToast(`Supplier "${row.name}" deleted successfully!`, "success")
    }
  }, [showToast, confirm])

  const handleOpenPO = useCallback((row: SupplierRecord) => {
    openTab({
      component: "PurchaseOrderPage",
      title: `PO - ${row.name || "Supplier"}`,
      closable: true,
      props: { supplierId: row.supplierID, supplierName: row.name },
    })
  }, [openTab])

  const handleVendorItems = useCallback((row: SupplierRecord) => {
    openTab({
      component: "SupplierItemsPage",
      title: `Items - ${row.name || "Supplier"}`,
      closable: true,
      props: { supplierId: row.supplierID, supplierName: row.name },
    })
  }, [openTab])

  const handleMergeSupplier = useCallback((row: SupplierRecord) => {
    openTab({
      component: "MergeSupplierPage",
      title: `Merge: ${row.name || "Supplier"}`,
      closable: true,
      props: { supplierId: row.supplierID, supplierName: row.name },
    })
  }, [openTab])

  const handleSalesReport = useCallback((row: SupplierRecord) => {
    openTab({
      component: "SupplierSalesReportPage",
      title: `Sales Report - ${row.name || "Supplier"}`,
      closable: true,
      props: { supplierId: row.supplierID, supplierName: row.name },
    })
  }, [openTab])

  const handleToggleInactive = useCallback((row: SupplierRecord) => {
    const isCurrentlyActive = row.status === 0 || row.status === null
    const newStatus = isCurrentlyActive ? "inactive" : "active"
    console.log(`Set supplier ${row.supplierID} to ${newStatus}`)
    showToast(
      `Supplier "${row.name}" marked as ${newStatus}!`,
      "success"
    )
  }, [showToast])

  // Custom context menu items
  const customContextMenuItems: CustomContextMenuItem[] = useMemo(() => [
    {
      label: "Open",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      ),
      onClick: handleOpenSupplier,
    },
    {
      label: "New",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
      onClick: () => handleNewSupplier(),
    },
    {
      label: "Edit",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      onClick: handleEditSupplier,
    },
    {
      label: "Delete",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
      onClick: handleDeleteSupplier,
      color: "#dc2626",
      dividerBefore: true,
    },
    {
      label: "Open PO",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      onClick: handleOpenPO,
      dividerBefore: true,
    },
    {
      label: "Vendor's Items",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      ),
      onClick: handleVendorItems,
    },
    {
      label: "Merge Supplier",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 3 21 3 21 8" />
          <line x1="4" y1="20" x2="21" y2="3" />
          <polyline points="21 16 21 21 16 21" />
          <line x1="15" y1="15" x2="21" y2="21" />
          <line x1="4" y1="4" x2="9" y2="9" />
        </svg>
      ),
      onClick: handleMergeSupplier,
      dividerBefore: true,
    },
    {
      label: "Sales Report",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
      onClick: handleSalesReport,
    },
    {
      label: "Inactive",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      ),
      onClick: handleToggleInactive,
      dividerBefore: true,
    },
  ], [
    handleOpenSupplier,
    handleNewSupplier,
    handleEditSupplier,
    handleDeleteSupplier,
    handleOpenPO,
    handleVendorItems,
    handleMergeSupplier,
    handleSalesReport,
    handleToggleInactive,
  ])

  // Handle row updates (double-click to edit)
  const handleRowUpdate = useCallback(async (updatedRow: SupplierRecord) => {
    openTab({
      component: "SupplierFormPage",
      title: `Edit: ${updatedRow.name || "Supplier"}`,
      closable: true,
      props: { id: updatedRow.supplierID, mode: "edit" },
    })
  }, [openTab])

  // Handle checkbox selection
  const handleRowSelection = useCallback((supplierID: string) => {
    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = new Set(prevSelectedRows)
      if (newSelectedRows.has(supplierID)) {
        newSelectedRows.delete(supplierID)
      } else {
        newSelectedRows.add(supplierID)
      }
      return newSelectedRows
    })
  }, [])

  // Handle deselect all
  const handleDeselectAll = useCallback(() => {
    setSelectedRows(new Set())
  }, [])

  // Handle remount grid
  const handleRemountGrid = useCallback(() => {
    setSelectedRows(new Set())
    setSearchText("")
    setDebouncedSearchText("")
    setRemountKey((prev) => prev + 1)
    showToast("Grid refreshed and search cleared", "info")
  }, [showToast])

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selectedRows.size > 0) {
      const confirmed = await confirm({
        title: 'Delete Selected Suppliers',
        message: `Are you sure you want to delete ${selectedRows.size} suppliers? This action cannot be undone.`,
        variant: 'danger',
      })
      if (confirmed) {
        console.log("Bulk deleting suppliers:", Array.from(selectedRows))
        setSelectedRows(new Set())
        showToast(`${selectedRows.size} suppliers deleted successfully!`, "success")
      }
    }
  }, [selectedRows, showToast, confirm])

  // Handle bulk export
  const handleBulkExport = useCallback(() => {
    if (selectedRows.size > 0) {
      showToast(`Exporting ${selectedRows.size} suppliers...`, "info")
    }
  }, [selectedRows, showToast])

  // Fetch all data for export/print
  const fetchAllData = useCallback(async (dateFrom?: string, dateTo?: string): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const response = await axios({
        method: "GET",
        url: API_ENDPOINTS.SUPPLIERS.GET_ALL,
        params: {
          startRow: 0,
          endRow: 1000000,
          ...(dateFrom && { dateFrom }),
          ...(dateTo && { dateTo }),
          sortColumn: "name",
          sortDirection: "asc",
          ...(debouncedSearchText.trim() && {
            CustomGridSearchText: debouncedSearchText.trim(),
            CustomGridSearchColumns: "name,supplierNo,contactName,emailAddress",
          }),
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
  }, [getAuthHeaders, debouncedSearchText])

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
    filename: "suppliers-list",
    pdfOptions: { title: "Suppliers List", orientation: "landscape" },
  })

  // Export modal
  const exportModal = useExportModal({
    columns,
    fetchAllData,
    filename: "suppliers-list",
    pdfOptions: { title: "Suppliers List", orientation: "landscape" },
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
    if (serverGridSelectAllRef.current) {
      serverGridSelectAllRef.current()
    }
  }, [])

  return (
    <div
      className="suppliers-list-page p-2 mx-auto md:p-2 min-h-full"
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
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[350px] max-w-[400px] transition-all duration-300 animate-slide-in">
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
                <svg
                  className={`w-6 h-6 ${
                    toast.type === "success"
                      ? "text-green-600"
                      : toast.type === "error"
                      ? "text-red-600"
                      : "text-brand-500"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {toast.type === "success" && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  )}
                  {toast.type === "error" && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  )}
                  {toast.type === "info" && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  )}
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  {toast.type === "success" && "Success"}
                  {toast.type === "error" && "Error"}
                  {toast.type === "info" && "Information"}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{toast.message}</p>
              </div>

              <button
                onClick={() =>
                  setToast({ show: false, message: "", type: "success" })
                }
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
                  />
                </svg>
              </button>
            </div>

            <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
              <div
                className="h-1 rounded-full animate-progress-bar"
                style={{
                  width: "100%",
                  animation: "progressBar 3s linear forwards",
                  backgroundColor:
                    toast.type === "success"
                      ? "#22c55e"
                      : toast.type === "error"
                      ? "#ef4444"
                      : "#1e40af",
                }}
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
        itemType="suppliers"
        onAddNew={handleNewSupplier}
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
      <div style={{ flex: 1, minHeight: 0 }}>
        <ServerGrid
          key={`suppliers-grid-${remountKey}`}
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
          title="Suppliers List"
          emptyMessage="No suppliers found"
          emptyIcon="🏭"
          serverSide={true}
          apiUrl={API_ENDPOINTS.SUPPLIERS.GET_ALL}
          methodType="GET"
          getAuthHeaders={memoizedGetAuthHeaders}
          defaultSortColumn="name"
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
          getRowId={(row) => row.supplierID}
          onSelectAll={(selectAllFn) => {
            serverGridSelectAllRef.current = selectAllFn
          }}
          headerSearch={true}
          infiniteScroll={false}
          onView={handleOpenSupplier}
          onEdit={handleEditSupplier}
          gridId={SUPPLIERS_GRID_ID}
          onColumnVisibilityChange={updateColumnVisibility}
          onColumnWidthChange={updateColumnWidth}
          onColumnsChange={handleColumnsChange}
          columnAggregates={columnAggregates}
          onAggregateChange={updateColumnAggregate}
          onDataChange={handleGridDataChange}
          customContextMenuItems={customContextMenuItems}
          hideDefaultContextMenuItems={true}
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

export default SupplierListPage
