import React, { useState, useCallback, useMemo, useEffect, useLayoutEffect } from "react"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { useStore } from "../../context/StoreContext"
import { API_ENDPOINTS } from "../../constants/api"
import { Column as GridUtilsColumn } from "../../gridUtils"
import ExportModal from "../../components/common/ExportModal"
import { useExportModal } from "../../hooks/useExportModal"
import axios from "axios"
import SearchableSelect, { SelectOption } from "../../components/form/SearchableSelect"
import AdvancedFiltersModal, { type AdvancedFilters } from "../../components/reports/AdvancedFiltersModal"

interface ItemInventoryReportProps {
  reportId?: string
  reportName?: string
  filters?: {
    storeId?: string
    departmentId?: string
  }
}

function getDefaultStoreId(f?: { storeId?: string }) {
  return f?.storeId ?? ""
}
function getDefaultDepartmentId(f?: { departmentId?: string }) {
  return f?.departmentId ?? ""
}

// Reserve space for scrollbar, padding, sidebar
const GRID_PADDING = 180

const ItemInventoryReportPage: React.FC<ItemInventoryReportProps> = ({ reportName, filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()

  const [storeId, setStoreId] = useState<string>(() => getDefaultStoreId(filters))
  const [departmentId, setDepartmentId] = useState<string>(() => getDefaultDepartmentId(filters))
  const [searchText, setSearchText] = useState<string>("")
  const [appliedStoreId, setAppliedStoreId] = useState<string>(() => getDefaultStoreId(filters))
  const [appliedDepartmentId, setAppliedDepartmentId] = useState<string>(() => getDefaultDepartmentId(filters))
  // Advanced multi-tab filters (Item / Supplier / Customer / More) — ported
  // from the universal Filters dialog in the desktop BackOffice. Only the
  // fields that actually apply to inventory data are read into
  // additionalParams below; the rest are kept in state so the modal can
  // re-open showing the user's prior selections.
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({})
  const [totalRecords, setTotalRecords] = useState(0)
  const [gridKey, setGridKey] = useState(0)
  const [screenWidth, setScreenWidth] = useState(() => typeof window !== "undefined" ? window.innerWidth : 1600)

  const [stores, setStores] = useState<SelectOption[]>([])
  const [departments, setDepartments] = useState<SelectOption[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [loadingDepartments, setLoadingDepartments] = useState(false)


  const getLocalUserId = useCallback(() => {
    try {
      const userData = localStorage.getItem("userData")
      if (!userData) return ""
      const parsed = JSON.parse(userData)
      return parsed.localUserId ?? ""
    } catch {
      return ""
    }
  }, [])

  useEffect(() => {
    const headers = getAuthHeaders()
    const userId = getLocalUserId()

    if (stores.length === 0) {
      setLoadingStores(true)
      const url = userId ? `${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${userId}` : API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES
      fetch(url, { headers })
        .then((res) => res.json())
        .then((data) => {
          if (data?.isSuccess && Array.isArray(data.response)) {
            setStores(
              data.response.map((s: any) => ({
                value: String(s.storeID ?? s.id ?? s.storeId ?? ""),
                label: s.storeName ?? s.name ?? "",
              }))
            )
          }
        })
        .catch(console.error)
        .finally(() => setLoadingStores(false))
    }

    if (departments.length === 0) {
      setLoadingDepartments(true)
      fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_DEPARTMENTS, { headers })
        .then((res) => res.json())
        .then((data) => {
          if (data?.isSuccess && Array.isArray(data.response)) {
            setDepartments(
              data.response.map((d: any) => ({
                value: String(d.departmentStoreID ?? d.id ?? d.departmentId ?? ""),
                label: d.name ?? "",
              }))
            )
          }
        })
        .catch(console.error)
        .finally(() => setLoadingDepartments(false))
    }
  }, [getAuthHeaders, getLocalUserId, stores.length, departments.length])

  useLayoutEffect(() => {
    const sid = filters?.storeId ?? ""
    const did = filters?.departmentId ?? ""
    setStoreId(sid)
    setDepartmentId(did)
    setAppliedStoreId(sid)
    setAppliedDepartmentId(did)
  }, [filters?.storeId, filters?.departmentId])

  useEffect(() => {
    const onResize = () => setScreenWidth(window.innerWidth)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const columns: Column[] = useMemo(() => {
    const available = Math.max(800, screenWidth - GRID_PADDING)
    const totalWeight = 10 + 12 + 24 + 12 + 12 + 8 + 8 + 8 + 8 + 6
    const w = (weight: number, min: number) => Math.max(min, Math.round((available * weight) / totalWeight))

    return [
      { field: "itemNo", headerName: "Item No", width: w(10, 90), sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "barcode", headerName: "Barcode", width: w(12, 110), sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "description", headerName: "Description", width: w(24, 180), sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "departmentName", headerName: "Department", width: w(12, 110), sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "itemGroupName", headerName: "Item Group", width: w(12, 110), sortable: true, filterable: true, visible: true, dataType: "string" },
      {
        field: "cost",
        headerName: "Cost",
        width: w(8, 80),
        sortable: true,
        filterable: false,
        visible: true,
        dataType: "number",
        cellRenderer: (v: number) => (v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`),
      },
      {
        field: "retailPrice",
        headerName: "Retail Price",
        width: w(8, 90),
        sortable: true,
        filterable: false,
        visible: true,
        dataType: "number",
        cellRenderer: (v: number) => (v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`),
      },
      {
        field: "qtyOnHand",
        headerName: "Qty On Hand",
        width: w(8, 85),
        sortable: true,
        filterable: false,
        visible: true,
        dataType: "number",
        cellRenderer: (v: number) => (v == null ? "0" : Number(v).toLocaleString()),
      },
      {
        field: "reorderPoint",
        headerName: "Reorder Point",
        width: w(8, 90),
        sortable: true,
        filterable: false,
        visible: true,
        dataType: "number",
        cellRenderer: (v: number) => (v == null ? "0" : Number(v).toLocaleString()),
      },
      {
        field: "isActive",
        headerName: "Status",
        width: w(6, 80),
        sortable: true,
        filterable: true,
        visible: true,
        dataType: "boolean",
        cellRenderer: (value: boolean | number) => {
          const isActive = value === true || value === 1
          return (
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}
            >
              {isActive ? "Active" : "Inactive"}
            </span>
          )
        },
      },
    ]
  }, [screenWidth])

  const additionalParams = useMemo(
    () => {
      const storeIdParam =
        appliedStoreId && String(appliedStoreId).trim() !== ""
          ? appliedStoreId
          : undefined
      return {
        departmentId: appliedDepartmentId && String(appliedDepartmentId).trim() !== "" ? appliedDepartmentId : undefined,
        searchText: searchText.trim() || undefined,
        storeId: storeIdParam,
        // Advanced filter fields relevant to inventory data. Customer-tab
        // values are intentionally ignored — they don't constrain inventory
        // rows (a customer can't filter what items exist). When this pattern
        // rolls out to sales-style reports, those reports will pick them up.
        // Item/Supplier-tab multi-selects (forward-compatible; the inventory
        // query honors what it understands and ignores the rest).
        itemIds: advancedFilters.itemIds,
        manufacturerIds: advancedFilters.manufacturerIds,
        supplierIds: advancedFilters.supplierIds,
        // userId from the More tab — filters by "last modified by" if the
        // backend supports it (harmless and forward-compatible).
        userId: advancedFilters.userId,
      }
    },
    [appliedDepartmentId, searchText, appliedStoreId, advancedFilters]
  )

  const handleApplyFilters = useCallback(() => {
    setAppliedStoreId(storeId)
    setAppliedDepartmentId(departmentId)
    setGridKey((k) => k + 1)
  }, [storeId, departmentId])

  const fetchAllData = useCallback(async (): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const res = await axios({
        method: "POST",
        url: API_ENDPOINTS.REPORTS.ITEMS,
        data: {
          startRow: 0,
          endRow: 1000000,
          sortColumn: "itemNo",
          sortDirection: "asc",
          departmentId: appliedDepartmentId || undefined,
          searchText: searchText.trim() || undefined,
          storeId: appliedStoreId || currentStore?.storeId || undefined,
        },
        headers,
      })
      if (res.data?.isSuccess && res.data.response?.data) return res.data.response.data
      return []
    } catch (e) {
      console.error("Item inventory fetch error:", e)
      return []
    }
  }, [getAuthHeaders, appliedDepartmentId, searchText, appliedStoreId, currentStore?.storeId])

  const storeLabel = stores.find((s) => s.value === appliedStoreId)?.label || (appliedStoreId ? "Store" : "All Stores")
  const departmentLabel = departments.find((d) => d.value === appliedDepartmentId)?.label || (appliedDepartmentId ? "Department" : "All Departments")

  // Pattern A export — reuse the existing full-dataset `fetchAllData` (serverSide grid has
  // no local row array). No per-row date filter on inventory, so use `useExportModal`
  // directly with no `filters`. The modal provides column selection, PDF preview,
  // PDF / Excel / CSV downloads and Print.
  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "item-inventory-report",
    pdfOptions: {
      title: "Item Inventory Report",
      subtitle: storeLabel,
      orientation: "landscape",
    },
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        {/* Title and summary - same structure as Tax By Store */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-brand-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            {reportName || "Item Inventory Report"}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{storeLabel}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>{departmentLabel}</span>
            {totalRecords > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{totalRecords.toLocaleString()} items</span>
              </>
            )}
          </div>
        </div>

        {/* Filters card - same layout as Tax By Store */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1 min-w-[280px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Store</label>
                <SearchableSelect
                  options={stores}
                  value={storeId}
                  onChange={setStoreId}
                  placeholder="All Stores"
                  loading={loadingStores}
                />
              </div>
              <div className="space-y-1 min-w-[280px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Department</label>
                <SearchableSelect
                  options={departments}
                  value={departmentId}
                  onChange={setDepartmentId}
                  placeholder="All Departments"
                  loading={loadingDepartments}
                />
              </div>
            </div>
            {/* Button sequence: Filters → Search → Export → Print */}
            <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm ml-auto overflow-visible">
              {/* Advanced multi-tab filters (Item/Supplier/Customer/More). Shows a
                  blue dot when any advanced filter is active so the user knows the
                  visible result-set is being further constrained beyond the top-bar
                  store/department/search controls. */}
              <button
                onClick={() => setShowAdvancedFilters(true)}
                className="h-10 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 border-0 border-r border-gray-200 dark:border-gray-600 relative"
                type="button"
                title="Open advanced filters"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
                {Object.values(advancedFilters).some(v => v !== undefined && v !== "" && v !== false) && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-500" />
                )}
              </button>
              <button
                onClick={handleApplyFilters}
                className="h-10 px-5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors flex items-center gap-2 border-0 border-r border-gray-200 dark:border-gray-600"
                type="button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
              <button
                onClick={exportModal.open}
                type="button"
                className="h-10 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 border-0 rounded-none"
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
      </div>

      <div className="flex-1 overflow-hidden p-6">
        <ServerGrid
          hideDefaultContextMenuItems={true}
          key={gridKey}
          columns={columns}
          apiUrl={API_ENDPOINTS.REPORTS.ITEMS}
          serverSide
          methodType="POST"
          getAuthHeaders={getAuthHeaders}
          pagination
          pageSize={100}
          headerSearch
          showActions={false}
          columnChooser
          title="Item Inventory"
          defaultSortColumn="itemNo"
          additionalParams={additionalParams}
          setTotalRecords={setTotalRecords}
          getRowId={(row) => row.itemStoreId || row.itemNo}
          containerWidth="100%"
          gridId="item-inventory-report"
          defaultGroupByColumns={[{ field: "departmentName", headerName: "Department" }]}
          defaultGroupsExpanded={true}
        />
      </div>

      {/* Multi-tab advanced filters dialog (pilot of the universal Filters
          modal from the desktop BackOffice). On Go, the draft state is
          adopted into `advancedFilters` which flows into additionalParams
          and triggers a grid refetch via remount. */}
      <AdvancedFiltersModal
        open={showAdvancedFilters}
        initial={advancedFilters}
        onApply={(next) => {
          setAdvancedFilters(next)
          setShowAdvancedFilters(false)
          setGridKey((k) => k + 1)
        }}
        onClose={() => setShowAdvancedFilters(false)}
      />

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default ItemInventoryReportPage
