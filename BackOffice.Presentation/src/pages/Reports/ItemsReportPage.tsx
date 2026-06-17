import React, { useState, useCallback, useMemo } from "react"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { useStore } from "../../context/StoreContext"
import { API_ENDPOINTS } from "../../constants/api"
import { Column as GridUtilsColumn } from "../../gridUtils"
import ExportModal from "../../components/common/ExportModal"
import { useExportModal } from "../../hooks/useExportModal"
import axios from "axios"

interface ItemsReportProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    storeId?: string
    departmentId?: string
  }
}

const ItemsReportPage: React.FC<ItemsReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()

  // Filter states
  const [departmentId, setDepartmentId] = useState<string>(filters?.departmentId || "")
  const [searchText, setSearchText] = useState<string>("")
  const [appliedDepartmentId, setAppliedDepartmentId] = useState<string>(departmentId)
  const [appliedSearchText, setAppliedSearchText] = useState<string>(searchText)

  // Pagination state for display
  const [totalRecords, setTotalRecords] = useState(0)

  // Grid refresh key - increment to force grid refresh
  const [gridKey, setGridKey] = useState(0)

  // Define grid columns for Items Report
  const columns: Column[] = useMemo(() => [
    {
      field: "itemNo",
      headerName: "Item No",
      width: 100,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "barcode",
      headerName: "Barcode",
      width: 130,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "description",
      headerName: "Description",
      width: 200,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "departmentName",
      headerName: "Department",
      width: 130,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "itemGroupName",
      headerName: "Item Group",
      width: 130,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "manufacturerName",
      headerName: "Manufacturer",
      width: 130,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "vendorName",
      headerName: "Vendor",
      width: 130,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "cost",
      headerName: "Cost",
      width: 90,
      sortable: true,
      filterable: false,
      visible: true,
      dataType: "number",
      cellRenderer: (value: number) => {
        if (value === null || value === undefined) return "$0.00"
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      },
    },
    {
      field: "retailPrice",
      headerName: "Retail Price",
      width: 100,
      sortable: true,
      filterable: false,
      visible: true,
      dataType: "number",
      cellRenderer: (value: number) => {
        if (value === null || value === undefined) return "$0.00"
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      },
    },
    {
      field: "qtyOnHand",
      headerName: "Qty On Hand",
      width: 100,
      sortable: true,
      filterable: false,
      visible: true,
      dataType: "number",
      cellRenderer: (value: number) => {
        if (value === null || value === undefined) return "0"
        return value.toLocaleString()
      },
    },
    {
      field: "reorderPoint",
      headerName: "Reorder Point",
      width: 100,
      sortable: true,
      filterable: false,
      visible: true,
      dataType: "number",
      cellRenderer: (value: number) => {
        if (value === null || value === undefined) return "0"
        return value.toLocaleString()
      },
    },
    {
      field: "isActive",
      headerName: "Status",
      width: 80,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "boolean",
      cellRenderer: (value: boolean | number) => {
        const isActive = value === true || value === 1
        return (
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
            isActive
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}>
            {isActive ? "Active" : "Inactive"}
          </span>
        )
      },
    },
    {
      field: "itemTypeName",
      headerName: "Item Type",
      width: 100,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "uomName",
      headerName: "UOM",
      width: 80,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "dateCreated",
      headerName: "Date Created",
      width: 110,
      sortable: true,
      filterable: true,
      visible: false,
      dataType: "date",
      cellRenderer: (value: string) => {
        if (!value) return "-"
        return new Date(value).toLocaleDateString()
      },
    },
  ], [])

  // All Stores: when filters from modal have storeId "" or missing, send no storeId. When no filters, use currentStore.
  const effectiveStoreId = filters
    ? (filters.storeId && filters.storeId.trim() !== "" ? filters.storeId : undefined)
    : (currentStore?.storeId || undefined)
  const additionalParams = useMemo(() => {
    const base: Record<string, string | undefined> = {
      departmentId: appliedDepartmentId || undefined,
      searchText: appliedSearchText || undefined,
    }
    if (effectiveStoreId) base.storeId = effectiveStoreId
    return base
  }, [appliedDepartmentId, appliedSearchText, effectiveStoreId])

  // Handle search button click
  const handleSearch = useCallback(() => {
    setAppliedDepartmentId(departmentId)
    setAppliedSearchText(searchText)
    setGridKey(prev => prev + 1) // Force grid refresh
  }, [departmentId, searchText])

  // Handle row double click (view item)
  const handleRowView = useCallback((row: any) => {
    if (row?.itemStoreId) {
      console.log("View item:", row.itemStoreId)
      // TODO: Navigate to item details page
    }
  }, [])

  // Fetch all data for export/print
  const fetchAllData = useCallback(async (): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const response = await axios({
        method: "POST",
        url: API_ENDPOINTS.REPORTS.ITEMS,
        data: {
          startRow: 0,
          endRow: 1000000,
          sortColumn: "itemNo",
          sortDirection: "asc",
          departmentId: appliedDepartmentId || undefined,
          searchText: appliedSearchText || undefined,
          ...(effectiveStoreId ? { storeId: effectiveStoreId } : {}),
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
  }, [getAuthHeaders, appliedDepartmentId, appliedSearchText, effectiveStoreId])

  // Pattern A export — reuse the full-dataset `fetchAllData`. No per-row date
  // filter, so use `useExportModal` directly with no `filters`.
  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "items-report",
    pdfOptions: {
      title: "Items Report",
      subtitle: currentStore?.storeName || "All Stores",
      orientation: "landscape",
    },
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-6 h-6 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Items Report
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
              <span>{currentStore?.storeName || "All Stores"}</span>
              {totalRecords > 0 && (
                <>
                  <span className="mx-1">|</span>
                  <span>{totalRecords.toLocaleString()} items</span>
                </>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search items..."
                className="pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 w-48"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearch}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </button>

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

            {/* Export (modal) */}
            <button
              onClick={exportModal.open}
              type="button"
              className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
              title="Preview, filter and export"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-hidden p-6">
        <ServerGrid
          hideDefaultContextMenuItems={true}
          key={gridKey}
          columns={columns}
          apiUrl={API_ENDPOINTS.REPORTS.ITEMS}
          serverSide={true}
          methodType="POST"
          getAuthHeaders={getAuthHeaders}
          pagination={true}
          pageSize={100}
          headerSearch={true}
          showActions={false}
          columnChooser={true}
          title="Items"
          defaultSortColumn="itemNo"
          additionalParams={additionalParams}
          setTotalRecords={setTotalRecords}
          getRowId={(row) => row.itemStoreId || row.itemNo}
          onView={handleRowView}
          containerWidth="100%"
          gridId="items-report"
          defaultGroupByColumns={[{ field: "departmentName", headerName: "Department" }]}
          defaultGroupsExpanded={true}
        />
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default ItemsReportPage
