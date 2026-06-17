import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import axios from "axios"
import Flatpickr from "react-flatpickr"
import "flatpickr/dist/themes/light.css"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { usePermission } from "../../hooks/usePermission"
import { useStore } from "../../context/StoreContext"
import { API_ENDPOINTS } from "../../constants/api"
import { Column as GridUtilsColumn } from "../../gridUtils"
import SearchableSelect, { SelectOption } from "../../components/form/SearchableSelect"
import ExportModal from "../../components/common/ExportModal"
import { useReportExportModal } from "../../hooks/useReportExportModal"
import AdvancedFiltersModal, { type AdvancedFilters } from "../../components/reports/AdvancedFiltersModal"

interface TotalDailySalesReportProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    storeId?: string
    storeName?: string
    departmentId?: string
    departmentName?: string
  }
}

interface StoreOption {
  id: string
  name: string
  code?: string
}

interface DepartmentOption {
  id: string
  name: string
  code?: string
}

interface TotalDailySalesRow {
  date: string
  total: number
  transactions: number
  averageSale: number
}

const currency = (v: unknown) =>
  v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const numberFmt = (v: unknown) =>
  v == null ? "0" : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 })}`

const formatLocalDateForHeader = (value: string | null | undefined): string => {
  if (!value) return ""
  const raw = value.split("T")[0] // handle ISO strings
  const parts = raw.split("-").map((p) => parseInt(p, 10))
  if (parts.length === 3 && !parts.some((n) => Number.isNaN(n))) {
    const [yyyy, mm, dd] = parts
    const d = new Date(yyyy, mm - 1, dd)
    return d.toLocaleDateString()
  }
  // Fallback – may still be slightly off with TZ, but better than nothing
  return new Date(value).toLocaleDateString()
}

const formatDateDMY = (value: string | null | undefined): string => {
  if (!value) return ""
  const s = value.toString()
  const raw = s.length >= 10 ? s.substring(0, 10) : s
  const parts = raw.split("-")
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts
    if (yyyy && mm && dd) {
      return `${dd.padStart(2, "0")}/${mm.padStart(2, "0")}/${yyyy}`
    }
  }
  return s
}

const TOTAL_DAILY_SALES_COLUMN_CONFIG = [
  { field: "date", headerName: "Date", ratio: 0.3, minWidth: 160 },
  { field: "total", headerName: "Total Amount", ratio: 0.25, minWidth: 160, type: "currency" },
  { field: "transactions", headerName: "Transactions", ratio: 0.2, minWidth: 140, type: "number" },
  { field: "averageSale", headerName: "Avg. Sale", ratio: 0.25, minWidth: 160, type: "currency" },
]

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

const TOTAL_DAILY_SALES_SCREEN_CODE = "reports.total_daily_sales"

const TotalDailySalesReportPage: React.FC<TotalDailySalesReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { canExport } = usePermission(TOTAL_DAILY_SALES_SCREEN_CODE)

  const todayStr = new Date().toISOString().split("T")[0]
  const defaultDateFrom =
    filters?.dateFrom || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
  const defaultDateTo = filters?.dateTo || todayStr
  const defaultStoreId = filters?.storeId ?? ""
  const defaultDepartmentId = filters?.departmentId ?? ""

  const [dateFrom, setDateFrom] = useState<string>(defaultDateFrom)
  const [dateTo, setDateTo] = useState<string>(defaultDateTo)
  const [appliedDateFrom, setAppliedDateFrom] = useState<string>(defaultDateFrom)
  const [appliedDateTo, setAppliedDateTo] = useState<string>(defaultDateTo)
  const [stores, setStores] = useState<StoreOption[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [screenStoreId, setScreenStoreId] = useState<string>(defaultStoreId)
  const [appliedStoreId, setAppliedStoreId] = useState<string>(defaultStoreId)

  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [loadingDepartments, setLoadingDepartments] = useState(false)
  const [screenDepartmentId, setScreenDepartmentId] = useState<string>(defaultDepartmentId)
  const [appliedDepartmentId, setAppliedDepartmentId] = useState<string>(defaultDepartmentId)

  // Grid manages rows/loading/error in serverSide mode; we only keep page-level totals
  // that come back in the response alongside the row data.
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [totalTransactions, setTotalTransactions] = useState(0)

  const [gridKey, setGridKey] = useState(0)
  // Advanced multi-tab "Filters" dialog (Item / Supplier / Customer / More).
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({})
  const gridDataRef = useRef<TotalDailySalesRow[]>([])

  const gridContainerRef = useRef<HTMLDivElement | null>(null)
  const [gridContainerWidth, setGridContainerWidth] = useState(960)

  useEffect(() => {
    const el = gridContainerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0]?.contentRect ?? { width: 960 }
      setGridContainerWidth(Math.max(640, Math.floor(width)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const userId = getLocalUserId()
    if (!userId) return
    const headers = getAuthHeaders()

    setLoadingStores(true)
    fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${userId}`, { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.isSuccess && data.response) {
          setStores(
            data.response.map((s: { storeID: string; storeName: string; storeNo?: number }) => ({
              id: s.storeID,
              name: s.storeName,
              code: s.storeNo?.toString(),
            }))
          )
        }
      })
      .catch(console.error)
      .finally(() => setLoadingStores(false))

    setLoadingDepartments(true)
    fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_DEPARTMENTS, { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.isSuccess && data.response) {
          setDepartments(
            // Backend (SystemLookupService.GetDepartmentsAsync) returns DepartmentLookupDto:
            // { DepartmentStoreID, Name, ParentDepartmentID } — camelCased by Newtonsoft.
            // The previous mapping read non-existent fields (departmentID/departmentName/
            // departmentNo), so every option was undefined and the dropdown rendered empty.
            data.response.map((d: { departmentStoreID: string; name: string }) => ({
              id: d.departmentStoreID,
              name: d.name,
              code: undefined,
            }))
          )
        }
      })
      .catch(console.error)
      .finally(() => setLoadingDepartments(false))
  }, [getAuthHeaders])

  // Sync with Report Manager filters. In serverSide mode we just bump gridKey to force
  // a refetch — the grid pulls from additionalParams which is derived from applied state.
  useEffect(() => {
    if (!filters) return
    const from = filters.dateFrom || defaultDateFrom
    const to = filters.dateTo || defaultDateTo
    setDateFrom(from)
    setDateTo(to)
    setAppliedDateFrom(from)
    setAppliedDateTo(to)
    const storeId = filters.storeId ?? ""
    setScreenStoreId(storeId)
    setAppliedStoreId(storeId)
    const departmentId = filters.departmentId ?? ""
    setScreenDepartmentId(departmentId)
    setAppliedDepartmentId(departmentId)
    if (filters.dateFrom || filters.dateTo || filters.storeId !== undefined || filters.departmentId !== undefined) {
      setGridKey((k) => k + 1)
    }
  }, [filters?.dateFrom, filters?.dateTo, filters?.storeId, filters?.departmentId, currentStore?.storeId])

  const storeDisplayName = useMemo(() => {
    if (!appliedStoreId || appliedStoreId.trim() === "") {
      return "All Stores"
    }
    if (filters?.storeName?.trim()) {
      return filters.storeName.trim()
    }
    const fromStores = stores.find((s) => s.id === appliedStoreId)?.name
    if (fromStores) {
      return fromStores
    }
    if (currentStore?.storeId === appliedStoreId) {
      return currentStore.storeName || "Selected Store"
    }
    return "Selected Store"
  }, [appliedStoreId, filters?.storeName, stores, currentStore?.storeId, currentStore?.storeName])

  const departmentDisplayName = useMemo(() => {
    if (!appliedDepartmentId || appliedDepartmentId.trim() === "") {
      return "All Departments"
    }
    if (filters?.departmentName?.trim()) {
      return filters.departmentName.trim()
    }
    const fromDepartments = departments.find((d) => d.id === appliedDepartmentId)?.name
    if (fromDepartments) {
      return fromDepartments
    }
    return "Selected Department"
  }, [appliedDepartmentId, filters?.departmentName, departments])

  const columns: Column[] = useMemo(() => {
    const total = gridContainerWidth
    return TOTAL_DAILY_SALES_COLUMN_CONFIG.map((cfg) => {
      const width = Math.max(cfg.minWidth, Math.floor(total * cfg.ratio))
      const col: Column = {
        field: cfg.field,
        headerName: cfg.headerName,
        width,
        sortable: true,
        filterable: true,
        dataType: cfg.type === "number" || cfg.type === "currency" ? "number" : "string",
      }
      if (cfg.type === "currency") {
        ;(col as Column & { cellRenderer?: (v: number) => string }).cellRenderer = (value: number) => currency(value)
      }
      if (cfg.type === "number") {
        ;(col as Column & { cellRenderer?: (v: number) => string }).cellRenderer = (value: number) => numberFmt(value)
      }
      if (cfg.field === "date") {
        ;(col as Column & { cellRenderer?: (v: string) => string }).cellRenderer = (value: string) => formatDateDMY(value)
      }
      return col
    })
  }, [gridContainerWidth])

  const storeSelectOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "All Stores" },
      ...stores.map((s) => ({
        value: s.id,
        label: s.code ? `${s.code} - ${s.name}` : s.name,
      })),
    ],
    [stores]
  )

  const departmentSelectOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "All Departments" },
      ...departments.map((d) => ({
        value: d.id,
        label: d.code ? `${d.code} - ${d.name}` : d.name,
      })),
    ],
    [departments]
  )

  // Advanced "Filters" dialog selections → request params. Item/Supplier/Customer
  // tabs are applied server-side via EXISTS subqueries on @Filter (see ReportService).
  const advancedFilterParams = useMemo(() => {
    const p: Record<string, unknown> = {}
    if (advancedFilters.itemIds?.length) p.itemIds = advancedFilters.itemIds
    if (advancedFilters.departmentIds?.length) p.itemDepartmentIds = advancedFilters.departmentIds
    if (advancedFilters.includeSubDept) p.includeSubDept = true
    if (advancedFilters.manufacturerIds?.length) p.manufacturerIds = advancedFilters.manufacturerIds
    if (advancedFilters.itemTypes?.length) p.itemTypes = advancedFilters.itemTypes
    if (advancedFilters.itemGroupIds?.length) p.itemGroupIds = advancedFilters.itemGroupIds
    if (advancedFilters.supplierIds?.length) p.supplierIds = advancedFilters.supplierIds
    if (advancedFilters.isDiscount) p.isDiscount = true
    if (advancedFilters.isTaxable) p.isTaxable = true
    if (advancedFilters.isFoodStampable) p.isFoodStampable = true
    if (advancedFilters.isWic) p.isWic = true
    if (advancedFilters.customerIds?.length) p.filterCustomerIds = advancedFilters.customerIds
    if (advancedFilters.customerTypes?.length) p.customerTypes = advancedFilters.customerTypes
    if (advancedFilters.groupIds?.length) p.customerGroupIds = advancedFilters.groupIds
    if (advancedFilters.priceLevels?.length) p.priceLevels = advancedFilters.priceLevels
    if (advancedFilters.zips?.length) p.zips = advancedFilters.zips
    if (advancedFilters.discountIds?.length) p.discountIds = advancedFilters.discountIds
    if (advancedFilters.taxable === true) p.taxable = true
    return p
  }, [advancedFilters])

  // Build the filter payload sent on every paginated request. Only changes when the user
  // applies a new search — page navigation reuses this and just varies startRow/endRow.
  // Only include storeId/departmentId when the trimmed value is non-empty + (for GUIDs)
  // regex-validates, so the "All Stores" / "All Departments" cases omit the key entirely.
  const additionalParams = useMemo(() => {
    const params: Record<string, unknown> = {
      fromDate: appliedDateFrom,
      toDate: appliedDateTo,
    }
    const storeIdToUse = appliedStoreId
    const validStoreId =
      typeof storeIdToUse === "string" &&
      storeIdToUse.trim().length > 0 &&
      /^[0-9a-f-]{36}$/i.test(storeIdToUse.trim())
    if (validStoreId) params.storeId = storeIdToUse.trim()

    const departmentIdToUse = appliedDepartmentId
    const validDepartmentId =
      typeof departmentIdToUse === "string" &&
      departmentIdToUse.trim().length > 0 &&
      /^[0-9a-f-]{36}$/i.test(departmentIdToUse.trim())
    if (validDepartmentId) params.departmentId = departmentIdToUse.trim()

    return { ...params, ...advancedFilterParams }
  }, [appliedDateFrom, appliedDateTo, appliedStoreId, appliedDepartmentId, advancedFilterParams])

  const handleResponseLoaded = useCallback((responseData: Record<string, unknown>) => {
    const r = responseData as Record<string, unknown>
    setTotalAmount(Number(r?.totalAmount ?? (r as any)?.TotalAmount ?? 0))
    setTotalTransactions(Number(r?.totalTransactions ?? (r as any)?.TotalTransactions ?? 0))
  }, [])

  const handleGridDataChange = useCallback((data: any[]) => {
    gridDataRef.current = data as TotalDailySalesRow[]
  }, [])

  const flatpickrCommonOptions = useMemo(
    () => ({
      dateFormat: "Y-m-d",
      allowInput: true,
      static: false,
    }),
    []
  )

  const handleSearch = useCallback(() => {
    setAppliedDateFrom(dateFrom)
    setAppliedDateTo(dateTo)
    // Pass screen values RAW — empty string is the All-Stores / All-Departments signal and
    // must reach additionalParams as-is so the regex check there omits the filter from the
    // request body. Coercing with `|| undefined` would re-introduce the bug we just fixed.
    setAppliedStoreId(screenStoreId)
    setAppliedDepartmentId(screenDepartmentId)
    setGridKey((k) => k + 1)
  }, [dateFrom, dateTo, screenStoreId, screenDepartmentId])

  // Fetch all rows for the export modal, scoped to an optional override date
  // range (falls back to the page's currently-applied range). Asks for a huge page
  // window so we get every row in a single request.
  const fetchAllData = useCallback(
    async (overrideFrom?: string, overrideTo?: string): Promise<any[]> => {
      try {
        const headers = getAuthHeaders()
        const body: Record<string, unknown> = {
          fromDate: overrideFrom || appliedDateFrom,
          toDate: overrideTo || appliedDateTo,
          startRow: 0,
          endRow: 1000000,
          ...advancedFilterParams,
        }
        if (appliedStoreId && appliedStoreId.trim().length > 0) {
          body.storeId = appliedStoreId.trim()
        }
        if (appliedDepartmentId && appliedDepartmentId.trim().length > 0) {
          body.departmentId = appliedDepartmentId.trim()
        }
        const response = await axios.post(API_ENDPOINTS.REPORTS.TOTAL_DAILY_SALES, body, { headers })
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess
        if (!ok) return []
        const res = response.data?.response ?? response.data?.Response ?? {}
        const dataRaw = res?.data ?? res?.Data ?? []
        return Array.isArray(dataRaw)
          ? dataRaw.map((r: any) => ({
              date: (r.date ?? r.Date ?? "").toString(),
              total: Number(r.total ?? r.Total ?? 0),
              transactions: Number(r.transactions ?? r.Transactions ?? r.trans ?? r.Trans ?? 0),
              averageSale: Number(r.averageSale ?? r.AverageSale ?? r.avgSale ?? r.AvgSale ?? 0),
            }))
          : []
      } catch (error) {
        console.error("Failed to fetch Total Daily Sales for export:", error)
        return []
      }
    },
    [getAuthHeaders, appliedDateFrom, appliedDateTo, appliedStoreId, appliedDepartmentId, advancedFilterParams]
  )

  const exportModal = useReportExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "total-daily-sales-report",
    title: "Total Daily Sales Report",
    subtitle: `${storeDisplayName} | ${formatLocalDateForHeader(appliedDateFrom)} - ${formatLocalDateForHeader(appliedDateTo)}`,
    dateField: "date",
    defaultDateFrom: appliedDateFrom,
    defaultDateTo: appliedDateTo,
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Total Daily Sales</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            {appliedDateFrom && appliedDateTo && (
              <>
                <span>{formatLocalDateForHeader(appliedDateFrom)} – {formatLocalDateForHeader(appliedDateTo)}</span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{storeDisplayName}</span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{departmentDisplayName}</span>
              </>
            )}
            {totalRecords > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{totalRecords.toLocaleString()} records</span>
              </>
            )}
            {totalAmount > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>Total: {currency(totalAmount)}</span>
              </>
            )}
            {totalTransactions > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>Transactions: {totalTransactions.toLocaleString()}</span>
              </>
            )}
          </div>
        </div>

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

              <div className="space-y-1 min-w-[260px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Store
                </label>
                <SearchableSelect
                  options={storeSelectOptions}
                  value={screenStoreId}
                  onChange={(value) => setScreenStoreId(value)}
                  placeholder="Search stores..."
                  loading={loadingStores}
                />
              </div>

              <div className="space-y-1 min-w-[260px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Department
                </label>
                <SearchableSelect
                  options={departmentSelectOptions}
                  value={screenDepartmentId}
                  onChange={(value) => setScreenDepartmentId(value)}
                  placeholder="All departments"
                  loading={loadingDepartments}
                />
              </div>
            </div>

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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Search
              </button>

              {canExport && (
                <div className="relative border-0 border-r border-gray-200 dark:border-gray-600">
                  <button
                    onClick={exportModal.open}
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

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div
          className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex-1 min-h-[320px] flex flex-col"
          ref={gridContainerRef}
        >
          <div className="flex-1 min-h-0">
            <ServerGrid
              key={gridKey}
              hideDefaultContextMenuItems={true}
              columns={columns}
              apiUrl={API_ENDPOINTS.REPORTS.TOTAL_DAILY_SALES}
              serverSide={true}
              methodType="POST"
              getAuthHeaders={getAuthHeaders}
              additionalParams={additionalParams}
              pagination={true}
              pageSize={100}
              columnChooser={true}
              title=""
              setTotalRecords={setTotalRecords}
              onResponseLoaded={handleResponseLoaded}
              onDataChange={handleGridDataChange}
              defaultSortColumn="date"
              defaultSortDirection="desc"
              emptyMessage="No data for the selected criteria. Use filters and click Search to load data."
              containerWidth="100%"
              gridId="total-daily-sales-report"
              getRowId={(row) =>
                `${(row as TotalDailySalesRow)?.date ?? ""}-${(row as TotalDailySalesRow)?.total ?? 0}-${(row as TotalDailySalesRow)?.transactions ?? 0}`
              }
            />
          </div>
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />

      {/* Advanced multi-tab filter dialog — full Item / Supplier / Customer / More
          tabs. On Go we adopt the draft, re-apply the current top-bar selection,
          and refetch (declarative via additionalParams + gridKey bump). */}
      <AdvancedFiltersModal
        open={showAdvancedFilters}
        initial={advancedFilters}
        onApply={(next) => {
          setAdvancedFilters(next)
          setShowAdvancedFilters(false)
          setAppliedDateFrom(dateFrom)
          setAppliedDateTo(dateTo)
          setAppliedStoreId(screenStoreId)
          setAppliedDepartmentId(screenDepartmentId)
          setGridKey((k) => k + 1)
        }}
        onClose={() => setShowAdvancedFilters(false)}
      />
    </div>
  )
}

export default TotalDailySalesReportPage
