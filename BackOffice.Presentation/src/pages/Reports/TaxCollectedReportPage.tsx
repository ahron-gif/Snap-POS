import React, { useState, useCallback, useMemo, useRef } from "react"
import axios from "axios"
import Flatpickr from "react-flatpickr"
import "flatpickr/dist/themes/light.css"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { usePermission } from "../../hooks/usePermission"
import { useStore } from "../../context/StoreContext"
import { API_ENDPOINTS } from "../../constants/api"
import { exportToPDF, exportToCSV, Column as GridUtilsColumn } from "../../gridUtils"
import SearchableSelect, { SelectOption } from "../../components/form/SearchableSelect"
import ExportModal from "../../components/common/ExportModal"
import AdvancedFiltersModal, { type AdvancedFilters } from "../../components/reports/AdvancedFiltersModal"
import { useReportExportModal } from "../../hooks/useReportExportModal"

const TAX_COLLECTED_SCREEN_CODE = "reports.tax_collected"

const getLocalUserId = (): string => {
  try {
    const userData = localStorage.getItem("userData")
    if (userData) {
      const parsed = JSON.parse(userData)
      return parsed.localUserId ?? ""
    }
  } catch {
    // ignore
  }
  return ""
}

interface TaxCollectedReportProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    storeId?: string
    storeName?: string
  }
}

const TaxCollectedReportPage: React.FC<TaxCollectedReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { canExport } = usePermission(TAX_COLLECTED_SCREEN_CODE)

  // Date range state
  const [dateFrom, setDateFrom] = useState<string>(
    filters?.dateFrom || new Date(new Date().setDate(1)).toISOString().split("T")[0]
  )
  const [dateTo, setDateTo] = useState<string>(
    filters?.dateTo || new Date().toISOString().split("T")[0]
  )
  const [appliedDateFrom, setAppliedDateFrom] = useState<string>(dateFrom)
  const [appliedDateTo, setAppliedDateTo] = useState<string>(dateTo)

  // Pagination state for display
  const [totalRecords, setTotalRecords] = useState(0)

  // Grid refresh key - increment to force grid refresh
  const [gridKey, setGridKey] = useState(0)

  // Store filter state (copied from Total Monthly Sales style)
  const [stores, setStores] = useState<SelectOption[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [screenStoreId, setScreenStoreId] = useState<string>(filters?.storeId ?? "")

  // Advanced multi-tab "Filters" dialog (Customer / More tabs). Pilot wiring for
  // the universal filter dialog — Tax Collected is the first POS report to adopt
  // it (mirrors the desktop RepTaxCollected universal filter). Selected values
  // flow to the backend as forward-compatible keys through additionalParams.
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({})

  const flatpickrCommonOptions = useMemo(
    () => ({
      dateFormat: "Y-m-d",
      allowInput: true,
      static: false,
    }),
    [],
  )

  // Load stores for dropdown
  React.useEffect(() => {
    const userId = getLocalUserId()
    if (!userId) return
    setLoadingStores(true)
    const headers = getAuthHeaders()
    fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${userId}`, { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.isSuccess && data.response) {
          const options: SelectOption[] = data.response.map(
            (s: { storeID: string; storeName: string; storeNo?: number }) => ({
              value: s.storeID,
              label: s.storeNo ? `${s.storeNo} - ${s.storeName}` : s.storeName,
            }),
          )
          setStores(options)
        }
      })
      .catch((err) => {
        console.error("Failed to load stores for Tax Collected report", err)
      })
      .finally(() => setLoadingStores(false))
  }, [getAuthHeaders])

  // Define grid columns based on VB.NET RepTaxCollected grid
  const columns: Column[] = useMemo(() => [
    {
      field: "transactionNo",
      headerName: "Transaction No",
      width: 120,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "storeName",
      headerName: "Store Name",
      width: 130,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "date",
      headerName: "Date",
      width: 100,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "date",
      cellRenderer: (value: string) => {
        if (!value) return "-"
        return new Date(value).toLocaleDateString()
      },
    },
    {
      field: "taxRate",
      headerName: "Tax Rate",
      width: 80,
      sortable: true,
      filterable: false,
      visible: true,
      dataType: "number",
      cellRenderer: (value: number) => {
        if (value === null || value === undefined) return "-"
        return `${value.toFixed(2)}%`
      },
    },
    {
      field: "taxSum",
      headerName: "Tax Sum",
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
      field: "customerNo",
      headerName: "Customer No",
      width: 100,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "customerName",
      headerName: "Customer Name",
      width: 150,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "totalSale",
      headerName: "Total Sale",
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
      field: "payment",
      headerName: "Payment",
      width: 100,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "taxName",
      headerName: "Tax Name",
      width: 100,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
  ], [])

  // All Stores: when filters from modal have storeId "" or missing, send no storeId.
  // When user picks "All Stores" on screen (empty value), that also means no storeId.
  // Otherwise prefer explicit screen selection, then ReportManager filters, then login store.
  const effectiveStoreId = useMemo(() => {
    if (screenStoreId === "") {
      return undefined
    }
    if (screenStoreId && screenStoreId.trim() !== "") {
      return screenStoreId
    }
    if (filters?.storeId && filters.storeId.trim() !== "") {
      return filters.storeId
    }
    return currentStore?.storeId || undefined
  }, [screenStoreId, filters?.storeId, currentStore?.storeId])
  // Advanced filter values mapped to backend request keys. Shared by the grid's
  // additionalParams and the export/print fetch so on-screen and exported data
  // stay in sync. Only set keys are included (forward-compatible — the reader
  // ignores any it doesn't understand yet).
  const advancedFilterParams = useMemo(() => {
    const p: Record<string, unknown> = {}
    // Customer-tab multi-selects → arrays. Keys avoid the base
    // PaginationGridDto.customerId (int) collision; the backend builds the SP's
    // @CustomerFilter (AND <col> IN (...) against CustomerRepFilter) from these.
    if (advancedFilters.customerIds?.length) p.filterCustomerIds = advancedFilters.customerIds
    if (advancedFilters.customerTypes?.length) p.customerTypes = advancedFilters.customerTypes
    if (advancedFilters.groupIds?.length) p.customerGroupIds = advancedFilters.groupIds
    if (advancedFilters.priceLevels?.length) p.priceLevels = advancedFilters.priceLevels
    if (advancedFilters.zips?.length) p.zips = advancedFilters.zips
    if (advancedFilters.discountIds?.length) p.discountIds = advancedFilters.discountIds
    if (advancedFilters.taxable === true) p.taxable = true
    // "More" tab store overrides the top-bar store; User isn't wired server-side yet.
    if (advancedFilters.storeId) p.storeId = advancedFilters.storeId
    return p
  }, [advancedFilters])

  const additionalParams = useMemo(() => {
    const base: Record<string, string | number | boolean | undefined> = {
      fromDate: appliedDateFrom,
      toDate: appliedDateTo,
    }
    if (effectiveStoreId) base.storeId = effectiveStoreId
    return { ...base, ...advancedFilterParams }
  }, [appliedDateFrom, appliedDateTo, effectiveStoreId, advancedFilterParams])

  const storeDisplayName = useMemo(() => {
    // No effective store => All Stores, but prefer explicit text from Report Manager if provided
    if (!effectiveStoreId || effectiveStoreId.trim() === "") {
      if (filters?.storeName && filters.storeName.trim() !== "") {
        return filters.storeName.trim()
      }
      return "All Stores"
    }

    // If ReportManager passed a matching store + name, prefer that label
    if (filters?.storeId === effectiveStoreId && filters.storeName && filters.storeName.trim() !== "") {
      return filters.storeName.trim()
    }

    const fromStores = stores.find((s) => s.value === effectiveStoreId)?.label
    if (fromStores) {
      return fromStores
    }
    if (currentStore?.storeId === effectiveStoreId) {
      return currentStore.storeName || "Selected Store"
    }
    return "Selected Store"
  }, [effectiveStoreId, filters?.storeId, filters?.storeName, stores, currentStore?.storeId, currentStore?.storeName])

  // Handle search button click
  const handleSearch = useCallback(() => {
    setAppliedDateFrom(dateFrom)
    setAppliedDateTo(dateTo)
    setGridKey(prev => prev + 1) // Force grid refresh
  }, [dateFrom, dateTo])

  // Handle row double click (open transaction)
  const handleRowView = useCallback((row: any) => {
    if (row?.transactionID) {
      console.log("Open transaction:", row.transactionID)
      // TODO: Navigate to transaction details page
    }
  }, [])

  // Export/Print dropdown states
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [currentGridData, setCurrentGridData] = useState<any[]>([])

  // Ref to store grid data from ServerGrid
  const gridDataRef = useRef<any[]>([])

  // Close dropdowns when clicking outside
  const exportMenuRef = useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Fetch all data for export/print.
  // Accepts an optional date range from the caller (e.g. the Export modal's
  // date picker) so the backend query is scoped to just what the user wants.
  // Falls back to the page's applied date range when no override is provided.
  const fetchAllData = useCallback(async (dateFrom?: string, dateTo?: string): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const response = await axios({
        method: "POST",
        url: API_ENDPOINTS.REPORTS.TAX_COLLECTED,
        data: {
          startRow: 0,
          endRow: 1000000,
          sortColumn: "date",
          sortDirection: "asc",
          fromDate: dateFrom || appliedDateFrom,
          toDate: dateTo || appliedDateTo,
          storeId: effectiveStoreId,
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

  // Export Modal (with preview + date range filter + column selection)
  const exportModal = useReportExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "tax-collected-report",
    title: "Tax Collected Report",
    subtitle: `${storeDisplayName} | ${new Date(appliedDateFrom).toLocaleDateString()} - ${new Date(appliedDateTo).toLocaleDateString()}`,
    dateField: "date",
    defaultDateFrom: appliedDateFrom,
    defaultDateTo: appliedDateTo,
  })

  // Export handlers
  const handleExportPDF = useCallback(async (exportAll: boolean) => {
    setIsExporting(true)
    setShowExportMenu(false)
    try {
      const data = exportAll ? await fetchAllData() : gridDataRef.current
      if (data.length === 0) {
        alert("No data to export")
        return
      }
      exportToPDF(data, "tax-collected-report", columns, {
        title: "Tax Collected Report",
        subtitle: `${currentStore?.storeName || "All Stores"} | ${new Date(appliedDateFrom).toLocaleDateString()} - ${new Date(appliedDateTo).toLocaleDateString()}`,
        orientation: "landscape",
      })
    } finally {
      setIsExporting(false)
    }
  }, [fetchAllData, columns, currentStore?.storeName, appliedDateFrom, appliedDateTo])

  const handleExportCSV = useCallback(async (exportAll: boolean) => {
    setIsExporting(true)
    setShowExportMenu(false)
    try {
      const data = exportAll ? await fetchAllData() : gridDataRef.current
      if (data.length === 0) {
        alert("No data to export")
        return
      }
      exportToCSV(data, "tax-collected-report", columns)
    } finally {
      setIsExporting(false)
    }
  }, [fetchAllData, columns])

  // Callback to receive grid data from ServerGrid
  const handleGridDataChange = useCallback((data: any[]) => {
    gridDataRef.current = data
    setCurrentGridData(data)
  }, [])

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tax Collected Report</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            {appliedDateFrom && appliedDateTo && (
              <>
                <span>
                  {new Date(appliedDateFrom).toLocaleDateString()} –{" "}
                  {new Date(appliedDateTo).toLocaleDateString()}
                </span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{storeDisplayName}</span>
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

        {/* Filters card – styled like Total Monthly Sales */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Date Range
                </label>
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
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
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
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1 min-w-[260px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Store
              </label>
              <SearchableSelect
                options={[
                  { value: "", label: "All Stores" },
                  ...stores,
                ]}
                value={screenStoreId}
                onChange={(value) => setScreenStoreId(value)}
                placeholder="Search stores..."
                loading={loadingStores}
              />
            </div>

            {/* Button sequence: Filters → Search → Export → Print */}
            <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm ml-auto overflow-visible">
              {/* Advanced multi-tab filters dialog (Customer / More). Blue dot
                  marks an active filter set beyond the top-bar date/store inputs. */}
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
                {Object.values(advancedFilters).some((v) => v !== undefined && v !== "" && v !== false) && (
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
                <div className="relative border-0 border-r border-gray-200 dark:border-gray-600">
                  <button
                    onClick={exportModal.open}
                    disabled={isExporting}
                    type="button"
                    className="h-10 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 border-0 disabled:opacity-50 rounded-none"
                    title="Preview, filter and export"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 5.414V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Export
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-hidden p-6">
        <ServerGrid
          hideDefaultContextMenuItems={true}
          key={gridKey}
          columns={columns}
          apiUrl={API_ENDPOINTS.REPORTS.TAX_COLLECTED}
          serverSide={true}
          methodType="POST"
          getAuthHeaders={getAuthHeaders}
          pagination={true}
          pageSize={100}
          headerSearch={true}
          showActions={false}
          columnChooser={true}
          title="Tax Collected"
          defaultSortColumn="date"
          additionalParams={additionalParams}
          setTotalRecords={setTotalRecords}
          getRowId={(row) => row.transactionID || row.transactionNo}
          onView={handleRowView}
          containerWidth="100%"
          gridId="tax-collected-report"
          defaultGroupByColumns={[{ field: "storeName", headerName: "Store Name" }]}
          defaultGroupsExpanded={true}
          // Subtotal row after each store + Grand Total at the
          // bottom — matches legacy desktop tax-collected layout.
          // Sum the money + transaction-count columns; taxRate is a
          // rate so we deliberately leave it out.
          summaryFields={["taxSum", "totalSale", "payment"]}
          showGrandTotal={true}
          onDataChange={handleGridDataChange}
        />
      </div>

      <ExportModal {...exportModal.modalProps} />

      {/* Advanced multi-tab filter dialog — Customer / More tabs only. On Go we
          adopt the draft and re-apply the current top-bar dates so the grid
          refetches with the combined criteria. */}
      <AdvancedFiltersModal
        open={showAdvancedFilters}
        tabs={["customer", "more"]}
        initial={advancedFilters}
        onApply={(next) => {
          setAdvancedFilters(next)
          setShowAdvancedFilters(false)
          setAppliedDateFrom(dateFrom)
          setAppliedDateTo(dateTo)
          setGridKey((prev) => prev + 1)
        }}
        onClose={() => setShowAdvancedFilters(false)}
      />
    </div>
  )
}

export default TaxCollectedReportPage
