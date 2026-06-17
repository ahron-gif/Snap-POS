import React, { useState, useCallback, useMemo, useEffect } from "react"
import Flatpickr from "react-flatpickr"
import "flatpickr/dist/themes/light.css"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { usePermission } from "../../hooks/usePermission"
import { useStore } from "../../context/StoreContext"
import { API_ENDPOINTS } from "../../constants/api"
import { Column as GridUtilsColumn } from "../../gridUtils"
import ExportModal from "../../components/common/ExportModal"
import { useExportModal } from "../../hooks/useExportModal"
import axios from "axios"
import AdvancedFiltersModal, { type AdvancedFilters } from "../../components/reports/AdvancedFiltersModal"

// Column config: content-appropriate default widths in px. Columns size to
// their header + typical cell content rather than stretching to fill the
// viewport (users can further adjust via the grid's "Best Fit" menu).
const TAX_BY_STORE_COLUMN_CONFIG = [
  { field: "storeName", headerName: "Store Name", width: 160 },
  { field: "taxRate", headerName: "Tax Rate", width: 95 },
  { field: "totalSales", headerName: "Total Sales", width: 120 },
  { field: "taxableSales", headerName: "Taxable Sales", width: 130 },
  { field: "totalExempt", headerName: "Total Exempt", width: 120 },
  { field: "nonTaxableSales", headerName: "Non-Taxable Sales", width: 155 },
  { field: "tax", headerName: "Tax", width: 110 },
] as const

interface TaxByStoreReportProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    storeId?: string
    storeName?: string
  }
}

interface StoreOption {
  id: string
  name: string
  code?: string
}

const TAX_BY_STORE_SCREEN_CODE = "reports.tax_by_store"

const TaxByStoreReportPage: React.FC<TaxByStoreReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { canExport } = usePermission(TAX_BY_STORE_SCREEN_CODE)

  const [dateFrom, setDateFrom] = useState<string>(
    filters?.dateFrom || new Date(new Date().setDate(1)).toISOString().split("T")[0]
  )
  const [dateTo, setDateTo] = useState<string>(
    filters?.dateTo || new Date().toISOString().split("T")[0]
  )
  const [appliedDateFrom, setAppliedDateFrom] = useState<string>(dateFrom)
  const [appliedDateTo, setAppliedDateTo] = useState<string>(dateTo)
  const [stores, setStores] = useState<StoreOption[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  // Resolve the initial store from the modal-supplied `filters` prop.
  //   - When `filters` exists with a non-empty storeId → that explicit store.
  //   - When `filters` exists without storeId (the user picked "All Stores"
  //     in the FilterModal — its handleRunReport deletes the storeId key
  //     before opening the tab) → "All Stores" (empty string).
  //   - When `filters` is undefined entirely (page opened directly without
  //     going through the modal) → fall back to the user's logged-in store.
  // Note: this is the SOURCE OF TRUTH for the initial mount only. The effect
  // below re-syncs whenever the parent passes a new `filters` prop (e.g. when
  // the user re-opens this tab from the Report Manager with different filters).
  const initialStoreId =
    filters !== undefined
      ? (filters.storeId?.trim() || "")
      : (currentStore?.storeId ?? "")
  const initialStoreName = filters !== undefined
    ? (filters.storeId?.trim() ? (filters.storeName?.trim() || "") : "")
    : (currentStore?.storeName || "")

  const [screenStoreId, setScreenStoreId] = useState<string>(initialStoreId)
  const [screenStoreName, setScreenStoreName] = useState<string>(initialStoreName)
  const [appliedStoreId, setAppliedStoreId] = useState<string>(initialStoreId)
  const [appliedStoreName, setAppliedStoreName] = useState<string>(
    initialStoreId ? (initialStoreName || "Selected Store") : "All Stores"
  )
  // Re-sync store state when the parent passes a new `filters` prop.
  // Important for the case where a user re-opens this tab from the Report
  // Manager with a different store selection — DashboardWithTabs re-keys
  // the wrapper div by JSON.stringify(filters), which usually remounts and
  // resets state. This effect is a safety net in case the same component
  // instance is reused (e.g. workspace restore quirk, identical JSON strings,
  // etc.) so the dropdown ALWAYS reflects what the user picked in the modal.
  useEffect(() => {
    if (filters === undefined) return
    const storeId = filters.storeId?.trim() || ""
    const storeName = storeId ? (filters.storeName?.trim() || "") : ""
    setScreenStoreId(storeId)
    setScreenStoreName(storeName)
    setAppliedStoreId(storeId)
    setAppliedStoreName(storeId ? (storeName || "Selected Store") : "All Stores")
    // Watching the trimmed values — equivalent objects don't refire.
  }, [filters?.storeId, filters?.storeName])

  const [totalRecords, setTotalRecords] = useState(0)
  const [gridKey, setGridKey] = useState(0)
  // Advanced multi-tab "Filters" dialog (Customer / More tabs).
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({})

  const getLocalUserId = useCallback(() => {
    try {
      const userData = localStorage.getItem("userData")
      if (userData) {
        const parsed = JSON.parse(userData)
        return parsed.localUserId || ""
      }
    } catch { /* ignore */ }
    return ""
  }, [])

  useEffect(() => {
    const userId = getLocalUserId()
    if (!userId) return
    setLoadingStores(true)
    const headers = getAuthHeaders()
    fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${userId}`, { headers })
      .then(res => res.json())
      .then(data => {
        if (data.isSuccess && data.response) {
          setStores(data.response.map((s: { storeID: string; storeName: string; storeNo?: number }) => ({
            id: s.storeID,
            name: s.storeName,
            code: s.storeNo?.toString()
          })))
        }
      })
      .catch(console.error)
      .finally(() => setLoadingStores(false))
  }, [getAuthHeaders, getLocalUserId])

  const flatpickrCommonOptions = useMemo(() => ({
    dateFormat: "Y-m-d",
    allowInput: true,
    static: false,
  }), [])

  const columns: Column[] = useMemo(() => {
    const cellRenderers: Record<string, (value: number) => string> = {
      taxRate: (v) => (v == null ? "-" : `${Number(v).toFixed(2)}%`),
      totalSales: (v) => (v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`),
      taxableSales: (v) => (v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`),
      totalExempt: (v) => (v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`),
      nonTaxableSales: (v) => (v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`),
      tax: (v) => (v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`),
    }
    return TAX_BY_STORE_COLUMN_CONFIG.map(({ field, headerName, width }) => ({
      field,
      headerName,
      width,
      sortable: true,
      filterable: field === "storeName",
      visible: true,
      dataType: (field === "storeName" ? "string" : "number") as "string" | "number",
      cellRenderer: cellRenderers[field] ? (value: number) => cellRenderers[field](value) : undefined,
    }))
  }, [])

  const effectiveStoreId = appliedStoreId?.trim() ? appliedStoreId : undefined
  const displayStoreName = effectiveStoreId ? (appliedStoreName || "Selected Store") : "All Stores"
  // Customer-tab multi-selects → arrays under non-colliding keys; the backend
  // builds the SP's @CustomerFilter from these (filterCustomerIds avoids the
  // PaginationGridDto int customerId collision).
  const advancedFilterParams = useMemo(() => {
    const p: Record<string, unknown> = {}
    if (advancedFilters.customerIds?.length) p.filterCustomerIds = advancedFilters.customerIds
    if (advancedFilters.customerTypes?.length) p.customerTypes = advancedFilters.customerTypes
    if (advancedFilters.groupIds?.length) p.customerGroupIds = advancedFilters.groupIds
    if (advancedFilters.priceLevels?.length) p.priceLevels = advancedFilters.priceLevels
    if (advancedFilters.zips?.length) p.zips = advancedFilters.zips
    if (advancedFilters.discountIds?.length) p.discountIds = advancedFilters.discountIds
    if (advancedFilters.taxable === true) p.taxable = true
    return p
  }, [advancedFilters])

  const additionalParams = useMemo(() => {
    const base: Record<string, unknown> = { fromDate: appliedDateFrom, toDate: appliedDateTo }
    if (effectiveStoreId) base.storeId = effectiveStoreId
    return { ...base, ...advancedFilterParams }
  }, [appliedDateFrom, appliedDateTo, effectiveStoreId, advancedFilterParams])

  const handleSearch = useCallback(() => {
    setAppliedDateFrom(dateFrom)
    setAppliedDateTo(dateTo)
    setAppliedStoreId(screenStoreId)
    setAppliedStoreName(screenStoreId ? (stores.find(s => s.id === screenStoreId)?.name ?? screenStoreName) : "All Stores")
    setGridKey(prev => prev + 1)
  }, [dateFrom, dateTo, screenStoreId, screenStoreName, stores])

  const handleRowView = useCallback((_row: any) => {
    // Optional: drill-down or detail view
  }, [])

  const fetchAllData = useCallback(async (): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const response = await axios({
        method: "POST",
        url: API_ENDPOINTS.REPORTS.TAX_BY_STORE,
        data: {
          startRow: 0,
          endRow: 1000000,
          sortColumn: "storeName",
          sortDirection: "asc",
          fromDate: appliedDateFrom,
          toDate: appliedDateTo,
          ...(effectiveStoreId ? { storeId: effectiveStoreId } : {}),
          ...advancedFilterParams,
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
  }, [getAuthHeaders, appliedDateFrom, appliedDateTo, effectiveStoreId, advancedFilterParams])

  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "tax-by-store-report",
    pdfOptions: {
      title: "Tax By Store Report",
      subtitle: `${displayStoreName} | ${new Date(appliedDateFrom).toLocaleDateString()} - ${new Date(appliedDateTo).toLocaleDateString()}`,
      orientation: "landscape",
    },
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        {/* Title and summary */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tax By Store Report</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{displayStoreName}</span>
            {appliedDateFrom && appliedDateTo && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>
                  {new Date(appliedDateFrom).toLocaleDateString()} – {new Date(appliedDateTo).toLocaleDateString()}
                </span>
              </>
            )}
            {totalRecords > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{totalRecords.toLocaleString()} records</span>
              </>
            )}
          </div>
        </div>

        {/* Filters card */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date Range</label>
                <div className="flex items-center gap-2">
                  <div className="flatpickr-wrapper w-[142px] relative">
                    <Flatpickr
                      value={dateFrom}
                      onChange={([d]) => setDateFrom(d ? d.toISOString().split("T")[0] : dateFrom)}
                      options={flatpickrCommonOptions}
                      placeholder="From"
                      className="w-full h-10 pl-9 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </span>
                  </div>
                  <span className="text-gray-400 dark:text-gray-500 font-medium">to</span>
                  <div className="flatpickr-wrapper w-[142px] relative">
                    <Flatpickr
                      value={dateTo}
                      onChange={([d]) => setDateTo(d ? d.toISOString().split("T")[0] : dateTo)}
                      options={flatpickrCommonOptions}
                      placeholder="To"
                      className="w-full h-10 pl-9 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Store</label>
                <select
                  value={screenStoreId}
                  onChange={(e) => {
                    const id = e.target.value
                    setScreenStoreId(id)
                    setScreenStoreName(id ? (stores.find(s => s.id === id)?.name ?? "") : "")
                  }}
                  disabled={loadingStores}
                  className="h-10 min-w-[280px] px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60"
                >
                  <option value="">All Stores</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Button sequence: Filters → Search → Export → Print */}
            <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm ml-auto overflow-visible">
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
                {Object.values(advancedFilters).some((v) => Array.isArray(v) ? v.length > 0 : (v !== undefined && v !== "" && v !== false)) && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-500" />
                )}
              </button>
              <button
                onClick={handleSearch}
                className="h-10 px-5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors flex items-center gap-2 border-0 border-r border-gray-200 dark:border-gray-600"
                type="button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
              {canExport && (
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
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 p-6">
        <div className="flex-1 min-h-0 overflow-auto flex flex-col">
          <div className="min-h-0 flex-1">
            <ServerGrid
              hideDefaultContextMenuItems={true}
              key={gridKey}
              columns={columns}
              apiUrl={API_ENDPOINTS.REPORTS.TAX_BY_STORE}
              serverSide={true}
              methodType="POST"
              getAuthHeaders={getAuthHeaders}
              pagination={true}
              pageSize={100}
              headerSearch={true}
              showActions={false}
              columnChooser={true}
              title="Tax By Store"
              defaultSortColumn="storeName"
              additionalParams={additionalParams}
              setTotalRecords={setTotalRecords}
              getRowId={(row) => `${row.storeName ?? ""}-${row.tax ?? 0}-${row.totalSales ?? 0}`.trim() || `row-${Math.random()}`}
              onView={handleRowView}
              containerWidth="100%"
              gridId="tax-by-store-report"
              defaultGroupByColumns={[{ field: "storeName", headerName: "Store Name" }]}
              defaultGroupsExpanded={true}
              // Subtotal row after each store + Grand Total at the
              // bottom — matches the legacy desktop's pivot-grid
              // tax-by-store layout. taxRate is excluded because
              // averaging / summing a rate column is meaningless.
              summaryFields={["totalSales", "taxableSales", "totalExempt", "nonTaxableSales", "tax"]}
              showGrandTotal={true}
            />
          </div>
        </div>
      </div>

      {/* Advanced multi-tab filter dialog — Customer / More tabs. On Go we adopt
          the draft, re-apply the current top-bar selection, and refetch. */}
      <AdvancedFiltersModal
        open={showAdvancedFilters}
        tabs={["customer", "more"]}
        initial={advancedFilters}
        onApply={(next) => {
          setAdvancedFilters(next)
          setShowAdvancedFilters(false)
          setAppliedDateFrom(dateFrom)
          setAppliedDateTo(dateTo)
          setAppliedStoreId(screenStoreId)
          setAppliedStoreName(screenStoreId ? (stores.find(s => s.id === screenStoreId)?.name ?? screenStoreName) : "All Stores")
          setGridKey(prev => prev + 1)
        }}
        onClose={() => setShowAdvancedFilters(false)}
      />

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default TaxByStoreReportPage
