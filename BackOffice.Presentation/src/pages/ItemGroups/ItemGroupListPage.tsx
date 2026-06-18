import React, { useState, useCallback, memo, useMemo, useRef } from "react"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import {
  convertToGridColumns,
  cellRenderers,
  GridColDef,
} from "../../gridUtils"
import ActionHeader from "../../components/common/ActionHeader"
import { useColumnAccessFilter } from "../../hooks/useColumnAccessFilter"
import { itemGroupService } from "../../services/itemGroupService"
import { useDashboardTabs } from "../../context/DashboardTabContext"
import { API_ENDPOINTS } from "../../constants/api"
import { useExportHandlers } from "../../hooks/useExportHandlers"
import { useExportModal } from "../../hooks/useExportModal"
import ExportModal from "../../components/common/ExportModal"
import { CustomContextMenuItem } from "../../components/common/ServerGrid/components/GridBody"
import AuditHistoryModal from "../../components/common/AuditHistoryModal"
import axios from "axios"
import { useConfirm } from '../../components/ui/ConfirmModal'
import { useGridSettings } from "../../hooks/useGridSettings"
import ItemGroupFormPage from "./ItemGroupFormPage"

// ItemGroup record interface
interface ItemGroupRecord {
  itemGroupID: string
  name: string
  parentID: string | null
  parentName: string | null
  status: number | null
  dateCreated: string | null
  dateModified: string | null
}

// Status cell renderer
const statusCellRenderer = (value: number | null): React.ReactNode => {
  let label = "Unknown"
  let bgColor = "#e5e7eb"
  let textColor = "#374151"

  switch (value) {
    case 1:
      label = "Active"
      bgColor = "#dcfce7"
      textColor = "#166534"
      break
    case 0:
      label = "Inactive"
      bgColor = "#f3f4f6"
      textColor = "#6b7280"
      break
    case 9:
      label = "Hidden"
      bgColor = "#fef3c7"
      textColor = "#92400e"
      break
  }

  return React.createElement(
    "span",
    {
      style: {
        padding: "2px 8px",
        borderRadius: "12px",
        backgroundColor: bgColor,
        color: textColor,
        fontSize: "12px",
        fontWeight: "500",
      },
    },
    label
  )
}

// Column definitions for item groups
const itemGroupColumnDefs: GridColDef[] = [
  {
    field: "name",
    headerName: "Group Name",
    width: 300,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "status",
    headerName: "Status",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
    cellRenderer: statusCellRenderer,
    // Transform status text search to numeric value for API
    searchValueTransformer: (searchValue: string) => {
      const lowerValue = searchValue.toLowerCase()
      if (lowerValue.includes("active") && !lowerValue.includes("inactive")) {
        return "1"
      } else if (lowerValue.includes("inactive")) {
        return "0"
      } else if (lowerValue.includes("hidden")) {
        return "9"
      }
      return searchValue // Return original if no match
    },
  },
  {
    field: "dateModified",
    headerName: "Date Modified",
    width: 180,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "dateCreated",
    headerName: "Date Created",
    width: 180,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
]

const ITEM_GROUPS_GRID_ID = "item-groups-list-grid"

interface ItemGroupSidePanelState {
  open: boolean
  id?: string
  isNew?: boolean
  title: string
}

const ItemGroupListPage = memo(function ItemGroupListPage() {
  const { getAuthHeaders } = useAuthHeaders()
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

  const [isAuditHistoryOpen, setIsAuditHistoryOpen] = useState(false)
  const [auditEntityId, setAuditEntityId] = useState("")
  const [auditEntityName, setAuditEntityName] = useState("")
  const [sidePanel, setSidePanel] = useState<ItemGroupSidePanelState>({
    open: false,
    title: "",
  })

  // Grid data ref for export
  const gridDataRef = useRef<any[]>([])

  // Memoize auth headers to prevent re-creation
  const memoizedGetAuthHeaders = useCallback(() => {
    return getAuthHeaders()
  }, [getAuthHeaders])

  // Convert column definitions to grid format (memoized)
  const defaultColumns = useMemo(() => convertToGridColumns(itemGroupColumnDefs), [])

  const {
    columns: userPrefColumns,
    setColumns,
    updateColumnVisibility,
    updateColumnWidth,
    updateColumnAggregate,
  } = useGridSettings(ITEM_GROUPS_GRID_ID, defaultColumns)

  // Super-Admin ceiling: strip tenant-restricted columns + apply tenant
  // displayName / sortOrder overrides. See ItemListPage for the pattern.
  const { filteredColumns: columns } = useColumnAccessFilter(ITEM_GROUPS_GRID_ID, userPrefColumns)

  const handleColumnsChange = useCallback(
    (newColumns: any[]) => setColumns(newColumns),
    [setColumns],
  )

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchText])

  // Create API search parameters
  const additionalParams = useMemo(() => {
    if (!debouncedSearchText.trim()) {
      return {}
    }

    return {
      CustomGridSearchText: debouncedSearchText.trim(),
      CustomGridSearchColumns: "name",
    }
  }, [debouncedSearchText])

  // Handle search input change
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

  // Handle adding new item group
  const handleAddItemGroup = useCallback(() => {
    setSidePanel({
      open: true,
      isNew: true,
      title: "New Item Group",
    })
  }, [])

  // Handle row selection
  const handleRowSelection = useCallback((itemGroupID: string) => {
    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = new Set(prevSelectedRows)
      if (newSelectedRows.has(itemGroupID)) {
        newSelectedRows.delete(itemGroupID)
      } else {
        newSelectedRows.add(itemGroupID)
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
    if (selectedRows.size === 0) {
      showToast("Please select item groups to delete", "info")
      return
    }

    const confirmed = await confirm({
      title: 'Delete Item Groups',
      message: `Are you sure you want to delete ${selectedRows.size} item group(s)?`,
      variant: 'danger',
    })
    if (!confirmed) return

    let successCount = 0
    let failCount = 0

    for (const id of selectedRows) {
      try {
        // Check if can delete
        const canDelete = await itemGroupService.canDeleteItemGroup(id)
        if (!canDelete.success || !canDelete.data) {
          failCount++
          continue
        }

        const result = await itemGroupService.deleteItemGroup(id)
        if (result.success) {
          successCount++
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }

    if (successCount > 0) {
      showToast(`${successCount} item group(s) deleted successfully`, "success")
      setSelectedRows(new Set())
      setRemountKey((prev) => prev + 1)
    }
    if (failCount > 0) {
      showToast(`${failCount} item group(s) could not be deleted`, "error")
    }
  }, [selectedRows, showToast, confirm])

  // Handle bulk export
  const handleBulkExport = useCallback(() => {
    if (selectedRows.size > 0) {
      showToast(`Exporting ${selectedRows.size} item groups...`, "info")
    }
  }, [selectedRows, showToast])

  // Static action handlers
  const handleStaticEdit = useCallback(() => {
    if (selectedRows.size === 1) {
      const id = Array.from(selectedRows)[0]
      setSidePanel({
        open: true,
        id,
        isNew: false,
        title: "View/Edit Item Group",
      })
    } else if (selectedRows.size > 1) {
      showToast("Please select only one item group to edit", "info")
    } else {
      showToast("Please select an item group to edit", "info")
    }
  }, [selectedRows, showToast])

  const handleStaticDownloadReport = useCallback(() => {
    showToast("Downloading report for item groups", "success")
  }, [showToast])

  const handleStaticDelete = useCallback(() => {
    handleBulkDelete()
  }, [handleBulkDelete])

  // Store reference to ServerGrid's select all function
  const serverGridSelectAllRef = React.useRef<(() => void) | null>(null)

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (serverGridSelectAllRef.current) {
      serverGridSelectAllRef.current()
    } else {
      showToast("Selecting all item groups...", "info")
    }
  }, [showToast])

  // Handle row double-click to open View/Edit sidebar
  const handleRowUpdate = useCallback(
    async (updatedRow: ItemGroupRecord) => {
      setSidePanel({
        open: true,
        id: updatedRow.itemGroupID,
        isNew: false,
        title: "View/Edit Item Group",
      })
    },
    []
  )

  // Handle View/Edit action (context menu)
  const handleEditAction = useCallback(
    (row: ItemGroupRecord) => {
      setSidePanel({
        open: true,
        id: row.itemGroupID,
        isNew: false,
        title: "View/Edit Item Group",
      })
    },
    []
  )

  const closeSidePanel = useCallback(() => {
    setSidePanel({ open: false, title: "" })
  }, [])

  // Handle Delete Row action (context menu)
  const handleDeleteAction = useCallback(
    async (row: ItemGroupRecord) => {
      const confirmed = await confirm({
        title: 'Delete Item Group',
        message: `Are you sure you want to delete item group "${row.name}"?`,
        variant: 'danger',
      })
      if (!confirmed) return

      try {
        const canDelete = await itemGroupService.canDeleteItemGroup(row.itemGroupID)
        if (!canDelete.success || !canDelete.data) {
          showToast("This item group cannot be deleted. It may be in use.", "error")
          return
        }

        const result = await itemGroupService.deleteItemGroup(row.itemGroupID)
        if (result.success) {
          showToast(`Item group "${row.name}" deleted successfully`, "success")
          setRemountKey((prev) => prev + 1)
        } else {
          showToast("Failed to delete item group", "error")
        }
      } catch {
        showToast("An error occurred while deleting the item group", "error")
      }
    },
    [showToast, confirm]
  )

  // Fetch all data for export/print
  const fetchAllData = useCallback(async (dateFrom?: string, dateTo?: string): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const response = await axios({
        method: "GET",
        url: API_ENDPOINTS.ITEM_GROUPS.GET_ALL_ITEM_GROUPS,
        params: {
          startRow: 0,
          endRow: 1000000,
          ...(dateFrom && { dateFrom }),
          ...(dateTo && { dateTo }),
          sortColumn: "name",
          sortDirection: "asc",
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
  }, [getAuthHeaders])

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
    filename: "item-groups-list",
    pdfOptions: { title: "Item Groups List", orientation: "landscape" },
  })

  // Export modal
  const exportModal = useExportModal({
    columns,
    fetchAllData,
    filename: "item-groups-list",
    pdfOptions: { title: "Item Groups List", orientation: "landscape" },
    dateFilterField: "dateCreated",
  })

  // Callback to receive grid data from ServerGrid
  const handleGridDataChange = useCallback((data: any[]) => {
    gridDataRef.current = data
  }, [])

  const auditHistoryContextMenuItem: CustomContextMenuItem = useMemo(() => ({
    label: "Audit History",
    dividerBefore: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    onClick: (row: any) => {
      const record = row as ItemGroupRecord
      setAuditEntityId(record.itemGroupID)
      setAuditEntityName(record.name || "")
      setIsAuditHistoryOpen(true)
    },
  }), [])

  const viewEditContextMenuItem: CustomContextMenuItem = useMemo(() => ({
    label: "View/Edit",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    ),
    onClick: (row: any) => handleEditAction(row as ItemGroupRecord),
  }), [handleEditAction])

  const deleteContextMenuItem: CustomContextMenuItem = useMemo(() => ({
    label: "Delete Group",
    color: "#ef4444",
    hoverBgColor: "#fef2f2",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    ),
    onClick: (row: any) => handleDeleteAction(row as ItemGroupRecord),
  }), [handleDeleteAction])

  return (
    <div
      className="item-groups-list-page p-2 mx-auto md:p-2 min-h-full"
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

      {/* Action Header with Search */}
      <ActionHeader
        selectedCount={selectedRows.size}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onBulkDelete={handleBulkDelete}
        onBulkExport={handleBulkExport}
        totalCount={totalRecords}
        loadedCount={loadedCount}
        itemType="item groups"
        onAddNew={handleAddItemGroup}
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
        gridId={ITEM_GROUPS_GRID_ID}
      />

      {/* Main Grid Component */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ServerGrid
          key={`item-groups-grid-${remountKey}`}
          data={[]}
          columns={columns}
          gridId={ITEM_GROUPS_GRID_ID}
          onColumnVisibilityChange={updateColumnVisibility}
          onColumnWidthChange={updateColumnWidth}
          onColumnsChange={handleColumnsChange}
          onAggregateChange={updateColumnAggregate}
          loading={false}
          error={null}
          totalRecords={totalRecords}
          onRowUpdate={handleRowUpdate}
          // WEB-187: single left-click opens the edit panel, matching Item List behavior.
          onRowClick={(row) => handleEditAction(row as ItemGroupRecord)}
          onRefresh={() => {}}
          pagination={true}
          pageSize={50}
          editable={false}
          columnChooser={true}
          title="Item Groups List"
          emptyMessage="No item groups found"
          emptyIcon="📦"
          serverSide={true}
          apiUrl={API_ENDPOINTS.ITEM_GROUPS.GET_ALL_ITEM_GROUPS}
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
          getRowId={(row) => row.itemGroupID}
          onSelectAll={(selectAllFn) => {
            serverGridSelectAllRef.current = selectAllFn
          }}
          headerSearch={true}
          infiniteScroll={false}
          onDataChange={handleGridDataChange}
          hideDefaultContextMenuItems={true}
          customContextMenuItems={[viewEditContextMenuItem, deleteContextMenuItem, auditHistoryContextMenuItem]}
        />
      </div>

      <AuditHistoryModal
        isOpen={isAuditHistoryOpen}
        onClose={() => setIsAuditHistoryOpen(false)}
        entityType="ItemGroup"
        entityId={auditEntityId}
        entityName={auditEntityName}
      />

      {sidePanel.open && (
        <div
          className="fixed inset-0 z-[70] bg-black/30"
          onClick={closeSidePanel}
        >
          <div
            className="absolute right-0 top-0 h-full w-full max-w-[720px] bg-white dark:bg-gray-900 shadow-xl border-l border-gray-200 dark:border-gray-700 animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <ItemGroupFormPage
              id={sidePanel.id}
              isNew={sidePanel.isNew}
              embedded={true}
              onClose={closeSidePanel}
              onSaved={() => setRemountKey((prev) => prev + 1)}
            />
          </div>
        </div>
      )}

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
        `}
      </style>
      <ExportModal {...exportModal.modalProps} />
      {ConfirmDialog}
    </div>
  )
})

export default ItemGroupListPage
