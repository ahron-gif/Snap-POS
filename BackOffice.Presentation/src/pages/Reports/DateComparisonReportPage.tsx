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
import ExportModal from "../../components/common/ExportModal"
import { useReportExportModal } from "../../hooks/useReportExportModal"
import "./DateComparisonReportPage.css"

interface DateComparisonReportProps {
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

interface DateComparisonRow {
  departmentName: string | null
  qty1: number | null
  extCost1: number | null
  extPrice1: number | null
  qty2: number | null
  extCost2: number | null
  extPrice2: number | null
  isTotalRow?: boolean
}

const DATE_COMPARISON_COLUMN_CONFIG = [
  { field: "departmentName" as const, headerName: "Department Name", ratio: 0.22, minWidth: 180 },
  { field: "qty1" as const, headerName: "Qty 1", ratio: 0.10, minWidth: 90 },
  { field: "extCost1" as const, headerName: "Ext Cost 1", ratio: 0.12, minWidth: 110 },
  { field: "extPrice1" as const, headerName: "Ext Price 1", ratio: 0.12, minWidth: 110 },
  { field: "qty2" as const, headerName: "Qty 2", ratio: 0.10, minWidth: 90 },
  { field: "extCost2" as const, headerName: "Ext Cost 2", ratio: 0.12, minWidth: 110 },
  { field: "extPrice2" as const, headerName: "Ext Price 2", ratio: 0.12, minWidth: 110 },
] as const

function num(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function str(v: unknown): string {
  return v != null ? String(v) : ""
}
function strOrNull(v: unknown): string | null {
  const s = str(v)
  return s === "" ? null : s
}

function apiRowToGridRow(r: Record<string, unknown>): DateComparisonRow {
  const get = (camel: string, pascal: string) => (r as any)?.[camel] ?? (r as any)?.[pascal]
  return {
    departmentName: strOrNull(get("departmentName", "DepartmentName")),
    qty1: num(get("qty1", "Qty1")),
    extCost1: num(get("extCost1", "ExtCost1")),
    extPrice1: num(get("extPrice1", "ExtPrice1")),
    qty2: num(get("qty2", "Qty2")),
    extCost2: num(get("extCost2", "ExtCost2")),
    extPrice2: num(get("extPrice2", "ExtPrice2")),
    isTotalRow: Boolean((r as any)?.isTotalRow ?? (r as any)?.IsTotalRow),
  }
}

const REPORT_TITLE = "Date Comparison"

const DATE_COMPARISON_SCREEN_CODE = "reports.date_comparison"

const DateComparisonReportPage: React.FC<DateComparisonReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { canExport } = usePermission(DATE_COMPARISON_SCREEN_CODE)

  const todayStr = new Date().toISOString().split("T")[0]
  const defaultCurrentFrom =
    filters?.dateFrom || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
  const defaultCurrentTo = filters?.dateTo || todayStr

  // Current period
  const [currentFrom, setCurrentFrom] = useState<string>(defaultCurrentFrom)
  const [currentTo, setCurrentTo] = useState<string>(defaultCurrentTo)

  // Comparison period
  const [comparisonFrom, setComparisonFrom] = useState<string>(() => {
    const fromDate = new Date(defaultCurrentFrom)
    const toDate = new Date(defaultCurrentTo)
    const diffDays = Math.max(0, Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)))
    const compTo = new Date(fromDate)
    compTo.setDate(compTo.getDate() - 1)
    const compFrom = new Date(compTo)
    compFrom.setDate(compFrom.getDate() - diffDays)
    return compFrom.toISOString().split("T")[0]
  })
  const [comparisonTo, setComparisonTo] = useState<string>(() => {
    const fromDate = new Date(defaultCurrentFrom)
    const compTo = new Date(fromDate)
    compTo.setDate(compTo.getDate() - 1)
    return compTo.toISOString().split("T")[0]
  })

  const [appliedCurrentFrom, setAppliedCurrentFrom] = useState<string>(defaultCurrentFrom)
  const [appliedCurrentTo, setAppliedCurrentTo] = useState<string>(defaultCurrentTo)
  const [appliedComparisonFrom, setAppliedComparisonFrom] = useState<string>(comparisonFrom)
  const [appliedComparisonTo, setAppliedComparisonTo] = useState<string>(comparisonTo)

  const [stores, setStores] = useState<StoreOption[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [screenStoreId, setScreenStoreId] = useState<string>(() =>
    filters ? (filters.storeId ?? "") : (currentStore?.storeId ?? "")
  )
  const [screenStoreName, setScreenStoreName] = useState<string>(() =>
    filters && filters.storeId ? (filters.storeName?.trim() || "") : (currentStore?.storeName || "")
  )
  const [appliedStoreId, setAppliedStoreId] = useState<string>(() =>
    filters ? (filters.storeId ?? "") : (currentStore?.storeId ?? "")
  )
  const [appliedStoreName, setAppliedStoreName] = useState<string>(() => {
    const id = filters ? (filters.storeId ?? "") : (currentStore?.storeId ?? "")
    return id?.trim() ? (filters?.storeName?.trim() || currentStore?.storeName || "Selected Store") : "All Stores"
  })

  const [rows, setRows] = useState<DateComparisonRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalRecords, setTotalRecords] = useState(0)
  const [gridKey, setGridKey] = useState(0)
  const [runSearchAfterFilters, setRunSearchAfterFilters] = useState(false)
  const gridContainerRef = useRef<HTMLDivElement>(null)
  const [gridContainerWidth, setGridContainerWidth] = useState(900)

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
    setLoadingStores(true)
    const headers = getAuthHeaders()
    const url = userId ? `${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${userId}` : API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES
    fetch(url, { headers })
      .then((res) => res.json())
      .then((data) => {
        const list = data?.response ?? data?.Response ?? data
        const arr = Array.isArray(list) ? list : []
        setStores(arr.map((s: any) => ({
          id: String(s.storeID ?? s.storeId ?? s.id ?? ""),
          name: String(s.storeName ?? s.name ?? s.StoreName ?? ""),
          code: s.storeNumber != null ? String(s.storeNumber) : undefined,
        })))
      })
      .catch(console.error)
      .finally(() => setLoadingStores(false))
  }, [getAuthHeaders, getLocalUserId])

  useEffect(() => {
    const el = gridContainerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0]?.contentRect ?? { width: 900 }
      setGridContainerWidth(Math.max(400, Math.floor(width)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!filters) return
    const from = filters.dateFrom || defaultCurrentFrom
    const to = filters.dateTo || defaultCurrentTo
    setCurrentFrom(from)
    setCurrentTo(to)
    setAppliedCurrentFrom(from)
    setAppliedCurrentTo(to)
    const storeIdFromFilters = filters.storeId ?? ""
    setScreenStoreId(storeIdFromFilters)
    setAppliedStoreId(storeIdFromFilters)
    setAppliedStoreName(storeIdFromFilters?.trim() ? (filters.storeName?.trim() || "Selected Store") : "All Stores")
    setRunSearchAfterFilters(true)
  }, [filters?.dateFrom, filters?.dateTo, filters?.storeId, filters?.storeName])

  const flatpickrCommonOptions = useMemo(() => ({
    dateFormat: "Y-m-d",
    allowInput: true,
    static: false,
  }), [])

  const effectiveStoreId = appliedStoreId?.trim() ? appliedStoreId : undefined
  const displayStoreName = effectiveStoreId ? (appliedStoreName || "Selected Store") : "All Stores"

  const columns: Column[] = useMemo(() => {
    const total = gridContainerWidth
    const withWidths = DATE_COMPARISON_COLUMN_CONFIG.map((cfg) => ({
      width: Math.max(cfg.minWidth, Math.floor(total * cfg.ratio)),
      ...cfg,
    }))
    const adjust = total - withWidths.reduce((s, c) => s + c.width, 0)
    if (adjust !== 0) withWidths[0].width += adjust

    const currency = (v: number | null) => (v == null ? "-" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    const numFmt = (v: number | null) => (v == null ? "-" : Number(v).toLocaleString())
    const cellRenderers: Record<string, (value: number | null) => string> = {
      qty1: numFmt,
      extCost1: currency,
      extPrice1: currency,
      qty2: numFmt,
      extCost2: currency,
      extPrice2: currency,
    }
    const numberFields = ["qty1", "extCost1", "extPrice1", "qty2", "extCost2", "extPrice2"]
    return withWidths.map(({ field, headerName, width, minWidth: _mw, ratio: _r }) => ({
      field,
      headerName,
      width,
      sortable: true,
      filterable: field === "departmentName",
      visible: true,
      dataType: (numberFields.includes(field) ? "number" : "string") as "string" | "number",
      cellRenderer: cellRenderers[field] ? (value: number) => cellRenderers[field](value as number | null) : undefined,
    }))
  }, [gridContainerWidth])

  const fetchData = useCallback(
    async (overrides?: { currentFrom?: string; currentTo?: string; comparisonFrom?: string; comparisonTo?: string; storeId?: string }) => {
      const curFrom = overrides?.currentFrom ?? appliedCurrentFrom
      const curTo = overrides?.currentTo ?? appliedCurrentTo
      const compFrom = overrides?.comparisonFrom ?? appliedComparisonFrom
      const compTo = overrides?.comparisonTo ?? appliedComparisonTo
      if (!curFrom || !curTo || !compFrom || !compTo) return

      setLoading(true)
      setError(null)
      try {
        const headers = getAuthHeaders()
        // When overrides is provided (Search button) the screen value is the source of truth —
        // empty string means "All Stores" and must NOT fall back to the previously-applied storeId.
        const storeIdToUse = overrides !== undefined
          ? (overrides.storeId ?? "")
          : (appliedStoreId ?? filters?.storeId ?? "")
        const effectiveStoreId =
          typeof storeIdToUse === "string" && storeIdToUse.trim().length > 0 && /^[0-9a-f-]{36}$/i.test(storeIdToUse.trim())
            ? storeIdToUse.trim()
            : null

        const body: Record<string, unknown> = {
          fromDate: curFrom,
          toDate: curTo,
          comparisonFromDate: compFrom,
          comparisonToDate: compTo,
          storeId: effectiveStoreId,
        }

        const response = await axios.post(API_ENDPOINTS.REPORTS.DATE_COMPARISON, body, { headers })
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess
        if (!ok) {
          setError(response.data?.message || response.data?.Message || `Failed to load ${REPORT_TITLE}`)
          setRows([])
          setTotalRecords(0)
          return
        }
        const res = response.data?.response ?? response.data?.Response ?? {}
        const dataRaw = res?.data ?? res?.Data ?? []
        const list: DateComparisonRow[] = Array.isArray(dataRaw) ? dataRaw.map(apiRowToGridRow) : []
        setRows(list)
        setTotalRecords(res?.totalRecords ?? res?.TotalRecords ?? list.length)
        if (overrides) {
          setAppliedCurrentFrom(curFrom)
          setAppliedCurrentTo(curTo)
          setAppliedComparisonFrom(compFrom)
          setAppliedComparisonTo(compTo)
          const nextStoreId = overrides.storeId ?? ""
          setAppliedStoreId(nextStoreId)
          setAppliedStoreName(
            nextStoreId ? stores.find((s) => s.id === nextStoreId)?.name ?? "Selected Store" : "All Stores"
          )
        }
      } catch (e: any) {
        setError(e?.response?.data?.message ?? e?.message ?? `Failed to load ${REPORT_TITLE}`)
        setRows([])
        setTotalRecords(0)
      } finally {
        setLoading(false)
      }
    },
    [appliedCurrentFrom, appliedCurrentTo, appliedComparisonFrom, appliedComparisonTo, appliedStoreId, filters?.storeId, getAuthHeaders, stores]
  )

  useEffect(() => {
    if (!runSearchAfterFilters) return
    setRunSearchAfterFilters(false)
    fetchData()
  }, [runSearchAfterFilters, fetchData])

  useEffect(() => {
    if (!filters) fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback(() => {
    setAppliedCurrentFrom(currentFrom)
    setAppliedCurrentTo(currentTo)
    setAppliedComparisonFrom(comparisonFrom)
    setAppliedComparisonTo(comparisonTo)
    setAppliedStoreId(screenStoreId)
    setAppliedStoreName(screenStoreId ? (stores.find((s) => s.id === screenStoreId)?.name ?? screenStoreName) : "All Stores")
    setGridKey((prev) => prev + 1)
    // Pass screenStoreId verbatim — empty string means "All Stores" and must reach fetchData so it clears the previous filter.
    fetchData({ currentFrom, currentTo, comparisonFrom, comparisonTo, storeId: screenStoreId })
  }, [currentFrom, currentTo, comparisonFrom, comparisonTo, screenStoreId, screenStoreName, stores, fetchData])

  const fetchAllData = useCallback(
    async (overrideFrom?: string, overrideTo?: string): Promise<any[]> => {
      try {
        const headers = getAuthHeaders()
        const storeIdToUse = appliedStoreId ?? filters?.storeId
        const effectiveStoreIdLocal =
          typeof storeIdToUse === "string" && storeIdToUse.trim().length > 0 && /^[0-9a-f-]{36}$/i.test(storeIdToUse.trim())
            ? storeIdToUse.trim()
            : null
        const body: Record<string, unknown> = {
          fromDate: overrideFrom || appliedCurrentFrom,
          toDate: overrideTo || appliedCurrentTo,
          comparisonFromDate: appliedComparisonFrom,
          comparisonToDate: appliedComparisonTo,
          storeId: effectiveStoreIdLocal,
        }
        const response = await axios.post(API_ENDPOINTS.REPORTS.DATE_COMPARISON, body, { headers })
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess
        if (!ok) return []
        const res = response.data?.response ?? response.data?.Response ?? {}
        const dataRaw = res?.data ?? res?.Data ?? []
        return Array.isArray(dataRaw) ? dataRaw.map(apiRowToGridRow) : []
      } catch (error) {
        console.error(`Failed to fetch ${REPORT_TITLE} for export:`, error)
        return []
      }
    },
    [getAuthHeaders, appliedCurrentFrom, appliedCurrentTo, appliedComparisonFrom, appliedComparisonTo, appliedStoreId, filters?.storeId]
  )

  const exportModal = useReportExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "date-comparison",
    title: `${REPORT_TITLE} Report`,
    subtitle: `${displayStoreName} | Current: ${new Date(appliedCurrentFrom).toLocaleDateString()} - ${new Date(appliedCurrentTo).toLocaleDateString()} | Comparison: ${new Date(appliedComparisonFrom).toLocaleDateString()} - ${new Date(appliedComparisonTo).toLocaleDateString()}`,
    dateField: "date",
    defaultDateFrom: appliedCurrentFrom,
    defaultDateTo: appliedCurrentTo,
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{REPORT_TITLE}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{displayStoreName}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>
              Current: {new Date(appliedCurrentFrom).toLocaleDateString()} – {new Date(appliedCurrentTo).toLocaleDateString()}
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>
              Comparison: {new Date(appliedComparisonFrom).toLocaleDateString()} – {new Date(appliedComparisonTo).toLocaleDateString()}
            </span>
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
            <div className="flex flex-wrap items-center gap-6">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Current Period</label>
                <div className="flex items-center gap-2">
                  <div className="flatpickr-wrapper w-[142px] relative">
                    <Flatpickr
                      value={currentFrom}
                      onChange={([d]) => setCurrentFrom(d ? d.toISOString().split("T")[0] : currentFrom)}
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
                      value={currentTo}
                      onChange={([d]) => setCurrentTo(d ? d.toISOString().split("T")[0] : currentTo)}
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
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Comparison Period</label>
                <div className="flex items-center gap-2">
                  <div className="flatpickr-wrapper w-[142px] relative">
                    <Flatpickr
                      value={comparisonFrom}
                      onChange={([d]) => setComparisonFrom(d ? d.toISOString().split("T")[0] : comparisonFrom)}
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
                      value={comparisonTo}
                      onChange={([d]) => setComparisonTo(d ? d.toISOString().split("T")[0] : comparisonTo)}
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
                    setScreenStoreName(id ? (stores.find((s) => s.id === id)?.name ?? "") : "")
                  }}
                  disabled={loadingStores}
                  className="h-10 min-w-[280px] px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60"
                >
                  <option value="">All Stores</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm ml-auto overflow-visible">
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
                <div className="relative">
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
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex-shrink-0 mb-4">{error}</div>
        )}
        <div className="flex-1 min-h-0 overflow-auto flex flex-col" ref={gridContainerRef}>
          <div className="min-h-0 flex-1">
            <ServerGrid
              hideDefaultContextMenuItems={true}
              key={gridKey}
              data={rows}
              columns={columns}
              loading={loading}
              error={error}
              pagination={true}
              pageSize={100}
              headerSearch={true}
              columnChooser={true}
              title={REPORT_TITLE}
              totalRecords={totalRecords}
              emptyMessage="No data for the selected criteria. Use filters and click Search to load data."
                getRowClassName={(row) => ((row as DateComparisonRow).isTotalRow ? "dc-report-total-row" : "")}
                getRowId={(row) => {
                    const r = row as DateComparisonRow
                    if (r.isTotalRow) return "__date_comparison_total__"
                    const name = (r.departmentName ?? "").trim() || "__blank__"
                    return `dc-dept-${name}`
                }}
              containerWidth="100%"
              defaultSortColumn="customerName"
              defaultSortDirection="asc"
              defaultGroupByColumns={[]}
              defaultGroupsExpanded={true}
            />
          </div>
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default DateComparisonReportPage

