import React, { useState, useCallback, memo, useMemo, useRef } from "react"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { CustomContextMenuItem } from "../../components/common/ServerGrid/components/GridBody"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { usePermission } from "../../hooks/usePermission"
import { API_ENDPOINTS } from "../../constants/api"
import {
  convertToGridColumns,
  cellRenderers,
  GridColDef,
} from "../../gridUtils"
import ActionHeader from "../../components/common/ActionHeader"
import { useColumnAccessFilter } from "../../hooks/useColumnAccessFilter"
import ConfirmDeleteModal from "../../components/common/ConfirmDeleteModal"
import { useDashboardTabs } from "../../context/DashboardTabContext"
import { useStore } from "../../context/StoreContext"
import { useGridSettings } from "../../hooks/useGridSettings"
import { useExportHandlers } from "../../hooks/useExportHandlers"
import { useExportModal } from "../../hooks/useExportModal"
import ExportModal from "../../components/common/ExportModal"
import axios from "axios"

// Discount record interface based on DiscountGridDto
interface DiscountRecord {
  discountID: string
  name: string | null
  startDate: string | null
  endDate: string | null
  percentsDiscount: number | null
  amountDiscount: number | null
  discountType: number | null
  discountTypeName: string | null
  upcDiscount: string | null
  status: number | null
  dateCreated: string | null
  dateModified: string | null
}

// Column definitions matching the Discounts List screen
const discountColumnDefs: GridColDef[] = [
  {
    field: "name",
    headerName: "Name",
    width: 200,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "startDate",
    headerName: "Start Date",
    width: 140,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "endDate",
    headerName: "End Date",
    width: 140,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "percentsDiscount",
    headerName: "Percents Discount",
    width: 150,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value != null && value !== 0 ? `${Number(value).toFixed(2)} %` : "",
  },
  {
    field: "amountDiscount",
    headerName: "Amount Discount",
    width: 150,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value != null && value !== 0 ? `$${Number(value).toFixed(2)}` : "",
  },
  {
    field: "discountTypeName",
    headerName: "Discount Type",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "upcDiscount",
    headerName: "Discount Code",
    width: 140,
    type: "string",
    sortable: true,
    filterable: true,
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
  {
    field: "dateModified",
    headerName: "Date Modified",
    width: 150,
    type: "datetime",
    sortable: true,
    filterable: true,
    visible: false,
    cellRenderer: cellRenderers.datetime,
  },
]

// Grid ID for settings persistence
const DISCOUNTS_GRID_ID = "discounts-list-grid"

interface DiscountListPageProps {
  /**
   * Touched by `openTab` whenever this tab is re-opened with the same id (e.g. after the
   * user saves an edit in DiscountFormPage and the form's `goBackToList` re-opens this
   * list). When it changes we bump `remountKey` so the ServerGrid re-mounts and re-fetches
   * — without this, the saved edits would only become visible after a manual refresh
   * because the grid component is otherwise kept alive across tab activations.
   *
   * Provided automatically by DashboardTabContext.openTab — callers don't pass it
   * explicitly.
   */
  _refreshKey?: number
}

const DiscountListPage = memo(function DiscountListPage({ _refreshKey }: DiscountListPageProps = {}) {
  const { getAuthHeaders } = useAuthHeaders()
  const { openTab } = useDashboardTabs()
  const { currentStore } = useStore()

  // Permission check — uses correct API screen code
  const { canDelete: hasDeletePermission, canCreate: hasCreatePermission, canEdit: hasEditPermission, loading: permLoading } = usePermission("sales.discount_list")

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

  // Delete confirmation modal state
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean
    mode: "single" | "bulk"
    row: DiscountRecord | null
  }>({ open: false, mode: "single", row: null })
  const [isDeleting, setIsDeleting] = useState(false)

  // Ref to store grid data from ServerGrid
  const gridDataRef = useRef<any[]>([])

  // Memoize auth headers to prevent re-creation
  const memoizedGetAuthHeaders = useCallback(() => {
    return getAuthHeaders()
  }, [getAuthHeaders])

  // Convert column definitions to grid format
  const defaultColumns = useMemo(
    () => convertToGridColumns(discountColumnDefs),
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
  } = useGridSettings(DISCOUNTS_GRID_ID, defaultColumns)

  // Super-Admin ceiling: strip tenant-restricted columns + apply tenant
  // displayName / sortOrder overrides. See ItemListPage for the pattern.
  const {
    filteredColumns: columns,
    loading: columnAccessLoading,
    failed: columnAccessFailed,
    refresh: refreshColumnAccess,
  } = useColumnAccessFilter(DISCOUNTS_GRID_ID, userPrefColumns)

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

  // Auto-refresh when the tab is re-opened (e.g. after saving an edit in DiscountFormPage).
  // DashboardTabContext bumps `_refreshKey` whenever an existing tab is re-activated; we
  // bump `remountKey` in response so the ServerGrid drops its cached page and refetches.
  // Skip the very first render (initial mount already triggers a fetch).
  const hasMountedRef = useRef(false)
  React.useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    if (_refreshKey === undefined) return
    setSelectedRows(new Set())
    setRemountKey((prev) => prev + 1)
  }, [_refreshKey])

  // Build additional params for API request
  const additionalParams = useMemo(() => {
    const params: Record<string, string> = {}

    // Add search parameters if search text is provided
    if (debouncedSearchText.trim()) {
      params.CustomGridSearchText = debouncedSearchText.trim()
      params.CustomGridSearchColumns =
        "name,upcDiscount,discountTypeName"
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

  // Handle add new discount
  const handleAddDiscount = useCallback(() => {
    openTab({
      component: "DiscountFormPage",
      title: "New Discount",
      closable: true,
      props: { isNew: true },
    })
  }, [openTab])

  // Handle edit discount
  const handleEditDiscount = useCallback(
    (row: DiscountRecord) => {
      openTab({
        component: "DiscountFormPage",
        title: `Edit: ${row.name || "Discount"}`,
        closable: true,
        props: { id: row.discountID },
      })
    },
    [openTab]
  )

  // Handle static edit (from ActionHeader)
  const handleStaticEdit = useCallback(() => {
    if (selectedRows.size === 1) {
      const selectedId = Array.from(selectedRows)[0]
      const rowData = gridDataRef.current.find(
        (r: any) => r.discountID === selectedId
      )
      if (rowData) {
        handleEditDiscount(rowData)
      }
    }
  }, [selectedRows, handleEditDiscount])

  // Handle row updates (double-click to edit)
  const handleRowUpdate = useCallback(
    async (updatedRow: DiscountRecord) => {
      handleEditDiscount(updatedRow)
    },
    [handleEditDiscount]
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
  const handleRowSelection = useCallback((discountID: string) => {
    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = new Set(prevSelectedRows)
      const wasSelected = newSelectedRows.has(discountID)

      if (wasSelected) {
        newSelectedRows.delete(discountID)
      } else {
        newSelectedRows.add(discountID)
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

  // Handle bulk delete — permission check then opens modal
  const handleBulkDelete = useCallback(() => {
    if (selectedRows.size === 0) return

    // Permission check (maps to old VB.NET BO_DiscountDelete)
    // Only enforce when permissions are loaded (screen is registered)
    if (!permLoading && !hasDeletePermission) {
      showToast("You do not have permission to delete discounts.", "error")
      return
    }

    setDeleteModal({ open: true, mode: "bulk", row: null })
  }, [selectedRows.size, hasDeletePermission, permLoading, showToast])

  // Handle bulk export (memoized)
  const handleBulkExport = useCallback(() => {
    if (selectedRows.size > 0) {
      console.log("Bulk exporting discounts:", selectedRows)
      showToast(`Exporting ${selectedRows.size} discounts...`, "info")
    }
  }, [selectedRows, showToast])

  // Handle View Details — opens dedicated read-only detail page
  const handleViewDiscount = useCallback(
    (row: DiscountRecord) => {
      openTab({
        component: "DiscountDetailPage",
        title: `View: ${row.name || "Discount"}`,
        closable: true,
        props: { id: row.discountID },
      })
    },
    [openTab]
  )

  // Handle single row delete — permission check + canDelete API check, then opens modal
  const handleDeleteDiscount = useCallback(
    async (row: DiscountRecord) => {
      // 1. Permission check (maps to old VB.NET BO_DiscountDelete)
      // Only enforce when permissions are loaded (screen is registered)
      if (!permLoading && !hasDeletePermission) {
        showToast("You do not have permission to delete discounts.", "error")
        return
      }

      // 2. Can-delete check (maps to old VB.NET CanDelete(DiscountID))
      try {
        const headers = getAuthHeaders()
        const canDeleteRes = await axios.get(
          API_ENDPOINTS.DISCOUNTS.CAN_DELETE(row.discountID),
          { headers }
        )
        const canDelete = canDeleteRes.data?.response ?? canDeleteRes.data?.Response
        if (!canDelete) {
          const msg = canDeleteRes.data?.message || canDeleteRes.data?.Message || "This discount cannot be deleted."
          showToast(msg, "error")
          return
        }
      } catch {
        showToast("Failed to verify if discount can be deleted.", "error")
        return
      }

      // 3. All checks passed — open the confirmation modal
      setDeleteModal({ open: true, mode: "single", row })
    },
    [hasDeletePermission, permLoading, getAuthHeaders, showToast]
  )

  // Confirm delete — called when user clicks "Delete" in modal
  const handleConfirmDelete = useCallback(async () => {
    setIsDeleting(true)
    try {
      const headers = getAuthHeaders()

      if (deleteModal.mode === "single" && deleteModal.row) {
        // Single row delete
        await axios.delete(
          API_ENDPOINTS.DISCOUNTS.DELETE(deleteModal.row.discountID),
          { headers }
        )
        showToast("Discount deleted successfully!", "success")
      } else if (deleteModal.mode === "bulk" && selectedRows.size > 0) {
        // Bulk delete — call can-delete for each, skip ones that can't be deleted
        let deletedCount = 0
        let skippedCount = 0

        for (const discountId of Array.from(selectedRows)) {
          try {
            const canDeleteRes = await axios.get(
              API_ENDPOINTS.DISCOUNTS.CAN_DELETE(discountId),
              { headers }
            )
            const canDelete = canDeleteRes.data?.response ?? canDeleteRes.data?.Response
            if (!canDelete) {
              skippedCount++
              continue
            }
            await axios.delete(API_ENDPOINTS.DISCOUNTS.DELETE(discountId), { headers })
            deletedCount++
          } catch {
            skippedCount++
          }
        }

        setSelectedRows(new Set())
        if (skippedCount > 0) {
          showToast(
            `${deletedCount} discount(s) deleted. ${skippedCount} could not be deleted.`,
            deletedCount > 0 ? "success" : "error"
          )
        } else {
          showToast(`${deletedCount} discount(s) deleted successfully!`, "success")
        }
      }

      setDeleteModal({ open: false, mode: "single", row: null })
      setTimeout(handleRemountGrid, 500)
    } catch (error) {
      console.error("Error deleting discount:", error)
      showToast("Failed to delete discount", "error")
    } finally {
      setIsDeleting(false)
    }
  }, [deleteModal, selectedRows, getAuthHeaders, showToast, handleRemountGrid])

  // Close delete modal
  const handleCloseDeleteModal = useCallback(() => {
    if (!isDeleting) {
      setDeleteModal({ open: false, mode: "single", row: null })
    }
  }, [isDeleting])

  // Create custom context menu items: View, Edit, Delete
  const customContextMenuItems: CustomContextMenuItem[] = useMemo(
    () => [
      {
        label: "View",
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
        onClick: handleViewDiscount,
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
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        ),
        onClick: handleEditDiscount,
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
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        ),
        onClick: handleDeleteDiscount,
        color: "#dc2626",
        hoverBgColor: "#fef2f2",
        dividerBefore: true,
      },
    ],
    [handleViewDiscount, handleEditDiscount, handleDeleteDiscount]
  )

  // Fetch all data for export/print
  const fetchAllData = useCallback(async (dateFrom?: string, dateTo?: string): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const response = await axios({
        method: "GET",
        url: API_ENDPOINTS.DISCOUNTS.GET_ALL,
        params: {
          startRow: 0,
          endRow: 1000000,
          ...(dateFrom && { dateFrom }),
          ...(dateTo && { dateTo }),
          sortColumn: "name",
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
    filename: "discounts-list",
    pdfOptions: {
      title: "Discounts List",
      subtitle: currentStore?.storeName || "All Stores",
      orientation: "landscape",
    },
  })

  // Export modal
  const exportModal = useExportModal({
    columns,
    fetchAllData,
    filename: "discounts-list",
    pdfOptions: { title: "Discounts List", orientation: "landscape" },
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
        showToast("Selecting all discounts...", "info")
      }
    } catch (error) {
      console.error("Error in handleSelectAll:", error)
      showToast("Error selecting discounts", "error")
    }
  }, [showToast])

  return (
    <div
      className="discounts-list-page p-2 mx-auto md:p-2 min-h-full"
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
        itemType="discounts"
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
        onAddNew={handleAddDiscount}
        staticActions={{
          onEdit: handleStaticEdit,
        }}
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
        gridId={DISCOUNTS_GRID_ID}
      />

      {/* Column-access state — the grid's visible columns are gated by the
          per-grid access rules. Surface loading/failure instead of a silent
          blank grid (rows with only checkboxes). */}
      {columnAccessFailed && (
        <div className="mx-1 mb-2 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          <span>Couldn’t load column settings — the grid may show no columns.</span>
          <button
            type="button"
            onClick={refreshColumnAccess}
            className="ml-3 rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
          >
            Retry
          </button>
        </div>
      )}
      {columnAccessLoading && columns.length === 0 && (
        <div className="mx-1 mb-2 text-xs text-gray-500 dark:text-gray-400">Loading columns…</div>
      )}

      {/* Main Grid Component */}
      <div style={{ flex: 1, minHeight: 0, height: "100%" }}>
        <ServerGrid
          key={`discounts-grid-${remountKey}`}
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
          title="Discounts List"
          emptyMessage="No discounts found"
          emptyIcon="🏷️"
          serverSide={true}
          apiUrl={API_ENDPOINTS.DISCOUNTS.GET_ALL}
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
          getRowId={(row) => row.discountID}
          onSelectAll={(selectAllFn) => {
            serverGridSelectAllRef.current = selectAllFn
          }}
          headerSearch={true}
          infiniteScroll={false}
          onView={handleViewDiscount}
          onEdit={handleEditDiscount}
          onRowDoubleClick={handleEditDiscount}
          gridId={DISCOUNTS_GRID_ID}
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

      {/* Delete Confirmation Modal */}
      <ExportModal {...exportModal.modalProps} />
      <ConfirmDeleteModal
        isOpen={deleteModal.open}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
        title={
          deleteModal.mode === "bulk"
            ? `Delete ${selectedRows.size} Discount(s)`
            : "Delete Discount"
        }
        itemName={
          deleteModal.mode === "single"
            ? deleteModal.row?.name || "Untitled Discount"
            : undefined
        }
        message={
          deleteModal.mode === "bulk"
            ? `Are you sure you want to delete ${selectedRows.size} selected discount(s)? This action cannot be undone.`
            : undefined
        }
      />

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
    </div>
  )
})

export default DiscountListPage
