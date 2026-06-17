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
import { useExportModal } from "../../hooks/useExportModal"

interface SummaryReportProps {
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

interface SummaryRow {
  label: string
  value: string
}

const SCOPE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "custom", label: "Custom" },
] as const

const SUMMARY_COLUMN_CONFIG = [
  { field: "label", headerName: "Label", ratio: 0.5, minWidth: 200 },
  { field: "value", headerName: "Value", ratio: 0.5, minWidth: 120 },
] as const

/** Map API row (from SummaryReportRowDto) to grid row — same two columns from SP. */
function apiRowToGridRow(r: Record<string, unknown>): SummaryRow {
  return {
    label: String(r?.label ?? r?.Label ?? ""),
    value: String(r?.value ?? r?.Value ?? ""),
  }
}

const SUMMARY_REPORTS_SCREEN_CODE = "reports.summary_reports"

const SummaryReportPage: React.FC<SummaryReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { canExport } = usePermission(SUMMARY_REPORTS_SCREEN_CODE)

  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0]
  const defaultDateFrom = filters?.dateFrom || firstOfMonth
  const defaultDateTo = filters?.dateTo || todayStr

  const [dateFrom, setDateFrom] = useState<string>(defaultDateFrom)
  const [dateTo, setDateTo] = useState<string>(defaultDateTo)
  const [appliedDateFrom, setAppliedDateFrom] = useState<string>(defaultDateFrom)
  const [appliedDateTo, setAppliedDateTo] = useState<string>(defaultDateTo)

  const [stores, setStores] = useState<StoreOption[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const initialStoreId = filters ? (filters.storeId ?? "") : (currentStore?.storeId ?? "")
  const [screenStoreId, setScreenStoreId] = useState<string>(initialStoreId)
  const [screenStoreName, setScreenStoreName] = useState<string>(
    filters ? (filters.storeName?.trim() || "") : (currentStore?.storeName || "")
  )
  const [appliedStoreId, setAppliedStoreId] = useState<string>(initialStoreId)
  const [appliedStoreName, setAppliedStoreName] = useState<string>(() => {
    const id = filters ? (filters.storeId ?? "").trim() : (currentStore?.storeId ?? "").trim()
    return id ? (filters?.storeName?.trim() || currentStore?.storeName || "Selected Store") : "All Stores"
  })

  const [rows, setRows] = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalRecords, setTotalRecords] = useState(0)

  const [runSearchAfterFilters, setRunSearchAfterFilters] = useState(false)
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [scope, setScope] = useState<string>("this-month")
  const [loadAllChecks, setLoadAllChecks] = useState(true)
  // Advanced multi-tab "Filters" dialog (Customer / More tabs).
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({})
  const moreFiltersRef = useRef<HTMLDivElement | null>(null)
  const gridContainerRef = useRef<HTMLDivElement | null>(null)
  const [gridContainerWidth, setGridContainerWidth] = useState(900)

  useEffect(() => {
    const el = gridContainerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0]?.contentRect ?? { width: 900 }
      setGridContainerWidth(Math.max(600, Math.floor(width)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const getLocalUserId = useCallback(() => {
    try {
      const userData = localStorage.getItem("userData")
      if (userData) {
        const parsed = JSON.parse(userData)
        return parsed.localUserId || ""
      }
    } catch {
      // ignore
    }
    return ""
  }, [])

  useEffect(() => {
    const userId = getLocalUserId()
    if (!userId) return
    setLoadingStores(true)
    const headers = getAuthHeaders()
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
  }, [getAuthHeaders, getLocalUserId])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreFiltersRef.current && !moreFiltersRef.current.contains(event.target as Node)) setShowMoreFilters(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Apply scope to date range
  const applyScopeToDates = useCallback((scopeValue: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let from = new Date(today)
    let to = new Date(today)
    if (scopeValue === "today") {
      from = new Date(today)
      to = new Date(today)
    } else if (scopeValue === "this-week") {
      const day = today.getDay()
      const diff = today.getDate() - day + (day === 0 ? -6 : 1)
      from.setDate(diff)
      to = new Date(today)
    } else if (scopeValue === "this-month") {
      from.setDate(1)
      to = new Date(today)
    }
    const fromStr = from.toISOString().split("T")[0]
    const toStr = to.toISOString().split("T")[0]
    setDateFrom(fromStr)
    setDateTo(toStr)
  }, [])

  useEffect(() => {
    if (scope && scope !== "custom") applyScopeToDates(scope)
  }, [scope]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!filters) return
    const from = filters.dateFrom || defaultDateFrom
    const to = filters.dateTo || defaultDateTo
    setDateFrom(from)
    setDateTo(to)
    setAppliedDateFrom(from)
    setAppliedDateTo(to)
    if (filters.storeId !== undefined) {
      setScreenStoreId(filters.storeId)
      setScreenStoreName(filters.storeName?.trim() || "")
      setAppliedStoreId(filters.storeId)
      setAppliedStoreName(filters.storeName?.trim() || (filters.storeId ? "Selected Store" : "All Stores"))
    }
    if (filters.dateFrom || filters.dateTo || filters.storeId) {
      setRunSearchAfterFilters(true)
    }
  }, [filters?.dateFrom, filters?.dateTo, filters?.storeId, filters?.storeName])

  const storeSelectOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "All Stores" },
      ...stores.map((s) => ({ value: s.id, label: s.name })),
    ],
    [stores]
  )

  // Customer-tab multi-selects → arrays under non-colliding keys; the backend
  // builds the Summary SP's @CustomerFilter from these.
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

  const columns: Column[] = useMemo(() => {
    const total = gridContainerWidth
    return SUMMARY_COLUMN_CONFIG.map((cfg) => {
      const width = Math.max(cfg.minWidth, Math.floor(total * cfg.ratio))
      return {
        field: cfg.field,
        headerName: cfg.headerName,
        width,
        sortable: true,
        filterable: true,
        dataType: "string" as const,
      }
    })
  }, [gridContainerWidth])

  const fetchData = useCallback(
    async (overrides?: { dateFrom?: string; dateTo?: string; storeId?: string }) => {
      const from = overrides?.dateFrom ?? appliedDateFrom
      const to = overrides?.dateTo ?? appliedDateTo
      if (!from || !to) return

      setLoading(true)
      setError(null)

      try {
        const headers = getAuthHeaders()
        const body: Record<string, unknown> = { fromDate: from, toDate: to, loadAllChecks: loadAllChecks, ...advancedFilterParams }
        // When overrides is provided (Search button) the screen value is the source of truth —
        // empty string means "All Stores" and must NOT fall back to the previously-applied storeId.
        const storeIdToUse = overrides !== undefined
          ? (overrides.storeId ?? "")
          : (appliedStoreId ?? filters?.storeId ?? "")
        const validStoreId =
          typeof storeIdToUse === "string" &&
          storeIdToUse.trim().length > 0 &&
          /^[0-9a-f-]{36}$/i.test(storeIdToUse.trim())
        if (validStoreId) body.storeId = storeIdToUse!.trim()

        const response = await axios.post(API_ENDPOINTS.REPORTS.SUMMARY, body, { headers })
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess

        if (!ok) {
          const message = response.data?.message || response.data?.Message || "Failed to load Summary report"
          setError(message)
          setRows([])
          setTotalRecords(0)
          return
        }

        const res = response.data?.response ?? response.data?.Response ?? {}
        const dataRaw = res?.data ?? res?.Data ?? []
        const list: SummaryRow[] = Array.isArray(dataRaw) ? dataRaw.map(apiRowToGridRow) : []
        setRows(list)
        setTotalRecords(res?.totalRecords ?? res?.TotalRecords ?? list.length)

        if (overrides) {
          setAppliedDateFrom(from)
          setAppliedDateTo(to)
          const nextStoreId = overrides.storeId ?? ""
          setAppliedStoreId(nextStoreId)
          setAppliedStoreName(
            nextStoreId ? stores.find((s) => s.id === nextStoreId)?.name ?? "Selected Store" : "All Stores"
          )
        }
      } catch (e: any) {
        console.error("Error loading Summary report", e)
        const data = e?.response?.data
        const serverMessage = data?.message ?? data?.Message
        setError(serverMessage || e?.message || "Failed to load Summary report")
        setRows([])
        setTotalRecords(0)
      } finally {
        setLoading(false)
      }
    },
    [appliedDateFrom, appliedDateTo, appliedStoreId, filters?.storeId, getAuthHeaders, stores, loadAllChecks, advancedFilterParams]
  )

  useEffect(() => {
    if (!runSearchAfterFilters) return
    setRunSearchAfterFilters(false)
    fetchData()
  }, [runSearchAfterFilters, fetchData])

  useEffect(() => {
    if (!filters) {
      fetchData()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const displayStoreName = appliedStoreName || "All Stores"

  const flatpickrCommonOptions = useMemo(
    () => ({
      dateFormat: "Y-m-d",
      allowInput: true,
      static: false,
    }),
    []
  )

  const handleSearch = useCallback(() => {
    // Pass screenStoreId verbatim — empty string means "All Stores" and must reach fetchData so it clears the previous filter.
    fetchData({ dateFrom, dateTo, storeId: screenStoreId })
  }, [dateFrom, dateTo, screenStoreId, fetchData])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault()
        handleSearch()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleSearch])

  const formatCurrency = (v: number) =>
    v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const fetchAllData = useCallback(
    async (overrideFrom?: string, overrideTo?: string): Promise<any[]> => {
      try {
        const headers = getAuthHeaders()
        const body: Record<string, unknown> = {
          fromDate: overrideFrom || appliedDateFrom,
          toDate: overrideTo || appliedDateTo,
          loadAllChecks: loadAllChecks,
          ...advancedFilterParams,
        }
        const storeIdToUse = appliedStoreId ?? filters?.storeId
        const validStoreId =
          typeof storeIdToUse === "string" &&
          storeIdToUse.trim().length > 0 &&
          /^[0-9a-f-]{36}$/i.test(storeIdToUse.trim())
        if (validStoreId) body.storeId = storeIdToUse!.trim()

        const response = await axios.post(API_ENDPOINTS.REPORTS.SUMMARY, body, { headers })
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess
        if (!ok) return []
        const res = response.data?.response ?? response.data?.Response ?? {}
        const dataRaw = res?.data ?? res?.Data ?? []
        return Array.isArray(dataRaw) ? dataRaw.map(apiRowToGridRow) : []
      } catch (error) {
        console.error("Failed to fetch Summary Report for export:", error)
        return []
      }
    },
    [getAuthHeaders, appliedDateFrom, appliedDateTo, appliedStoreId, filters?.storeId, loadAllChecks, advancedFilterParams]
  )

  // Use `useExportModal` directly (not `useReportExportModal`) — Summary Report rows are
  // just `{ label, value }` pairs with NO per-row date field. The wrapper hook always
  // injects a row-level `dateRange` filter that does `if (!row[field]) return false`, which
  // drops every row and surfaces "No data found for the selected date range filter" even
  // though the grid clearly has data. Same fix used on Tender Totals + Item Daily/Weekly/
  // Monthly Sales pivots.
  //
  // Date scoping is preserved: `fetchAllData` reads `appliedDateFrom` / `appliedDateTo`
  // from the page's currently-applied filters and forwards them to the backend.
  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "summary-report",
    pdfOptions: {
      title: "Summary Report",
      subtitle: `${displayStoreName} | ${new Date(appliedDateFrom).toLocaleDateString()} - ${new Date(appliedDateTo).toLocaleDateString()}`,
      orientation: "landscape",
    },
    // No `filters` → modal renders no Date Range picker, and no client-side filter is applied.
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Summary Report</h1>
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

        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Store Filter
                </label>
                <SearchableSelect
                  options={storeSelectOptions}
                  value={screenStoreId}
                  onChange={(value) => {
                    setScreenStoreId(value)
                    const store = stores.find((s) => s.id === value)
                    setScreenStoreName(store?.name ?? "")
                  }}
                  placeholder="Search stores..."
                  loading={loadingStores}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  From
                </label>
                <div className="flatpickr-wrapper w-[120px] relative">
                  <Flatpickr
                    value={dateFrom}
                    onChange={([d]) => { setDateFrom(d ? d.toISOString().split("T")[0] : dateFrom); setScope("custom") }}
                    options={flatpickrCommonOptions}
                    placeholder="From"
                    className="w-full h-10 pl-8 pr-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  To
                </label>
                <div className="flatpickr-wrapper w-[120px] relative">
                  <Flatpickr
                    value={dateTo}
                    onChange={([d]) => { setDateTo(d ? d.toISOString().split("T")[0] : dateTo); setScope("custom") }}
                    options={flatpickrCommonOptions}
                    placeholder="To"
                    className="w-full h-10 pl-8 pr-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </span>
                </div>
              </div>
              <label className="flex items-center gap-2 h-10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={loadAllChecks}
                  onChange={(e) => setLoadAllChecks(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500 bg-white dark:bg-gray-700"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">Load All Checks</span>
              </label>
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
                title="Search"
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
                    type="button"
                    className="h-10 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 border-0 disabled:opacity-50 rounded-none"
                    title="Preview, filter and export"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 5.414V19a2 2 0 01-2 2z" />
                    </svg>
                    Export
                  </button>
                </div>
              )}

              <div className="relative" ref={moreFiltersRef}>
                <button
                  type="button"
                  onClick={() => setShowMoreFilters(!showMoreFilters)}
                  className="h-10 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                  title="More Filters"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  More Filters
                </button>
                {showMoreFilters && (
                  <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Additional options</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={loadAllChecks} onChange={(e) => setLoadAllChecks(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-brand-500" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Load All Checks</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6 flex flex-col min-h-0">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex-shrink-0">
            {error}
          </div>
        )}

        {/* Data Grid - primary content: report data in grid */}
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex-1 min-h-[320px] flex flex-col" ref={gridContainerRef}>
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Report Data</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {displayStoreName} • {appliedDateFrom && appliedDateTo ? `${new Date(appliedDateFrom).toLocaleDateString()} – ${new Date(appliedDateTo).toLocaleDateString()}` : ""} • {totalRecords} record{totalRecords !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex-1 min-h-0">
            <ServerGrid
              hideDefaultContextMenuItems={true}
              data={rows}
              columns={columns}
              loading={loading}
              error={error}
              pagination={true}
              pageSize={100}
              columnChooser={true}
              title=""
              totalRecords={totalRecords}
              emptyMessage="No data for the selected criteria. Use filters and click Search to load data."
              getRowId={(row) => `${(row as SummaryRow)?.label ?? ""}-${(row as SummaryRow)?.value ?? ""}`}
            />
          </div>
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />

      {/* Advanced multi-tab filter dialog — Customer / More tabs. On Go we adopt
          the draft and re-run with the current top-bar date/store. */}
      <AdvancedFiltersModal
        open={showAdvancedFilters}
        tabs={["customer", "more"]}
        initial={advancedFilters}
        onApply={(next) => {
          setAdvancedFilters(next)
          setShowAdvancedFilters(false)
          // Apply current top-bar selection, then let the post-render effect run
          // fetchData. Calling fetchData() synchronously here would close over the
          // STALE advancedFilterParams (setAdvancedFilters hasn't re-rendered yet),
          // so the customer filter wouldn't apply until a second click.
          setAppliedDateFrom(dateFrom)
          setAppliedDateTo(dateTo)
          setAppliedStoreId(screenStoreId)
          setAppliedStoreName(screenStoreId ? (stores.find((s) => s.id === screenStoreId)?.name ?? screenStoreName) : "All Stores")
          setRunSearchAfterFilters(true)
        }}
        onClose={() => setShowAdvancedFilters(false)}
      />
    </div>
  )
}

export default SummaryReportPage
