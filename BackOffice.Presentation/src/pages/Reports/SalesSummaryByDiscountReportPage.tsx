import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import axios from "axios"
import Flatpickr from "react-flatpickr"
import "flatpickr/dist/themes/light.css"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { usePermission } from "../../hooks/usePermission"
import { useStore } from "../../context/StoreContext"
import { useDashboardTabs } from "../../context/DashboardTabContext"
import { API_ENDPOINTS } from "../../constants/api"
import { Column as GridUtilsColumn } from "../../gridUtils"
import ExportModal from "../../components/common/ExportModal"
import { useReportExportModal } from "../../hooks/useReportExportModal"

interface SalesSummaryByDiscountReportProps {
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

interface SalesSummaryByDiscountRow {
  discountID: string | null
  name: string | null
  percentsDiscount: number | null
  amountDiscount: number | null
  startDate: string | null
  endDate: string | null
  upcDiscount: string | null
  status: string | null
  customersNo: number | null
  transactionsCount: number | null
  totalQty: number | null
  totalBeforeDiscount: number | null
  discountTotal: number | null
  salesTotalWithoutTax: number | null
  salesTotal: number | null
  storeName: string | null
  storeID: string | null
}

// Mirrors the desktop RepDiscountSummary GridView column order/captions (caption text is
// taken from the .resx — note that "Item Count" is bound to the TotalQty field on the desktop
// even though the caption reads "Item Count". We follow that convention so users can find each
// column where they expect it.)
const SALES_SUMMARY_BY_DISCOUNT_COLUMN_CONFIG = [
  { field: "name" as const, headerName: "Discount Name", ratio: 0.13, minWidth: 140 },
  { field: "percentsDiscount" as const, headerName: "Percents Discount", ratio: 0.06, minWidth: 90 },
  { field: "amountDiscount" as const, headerName: "Amount Discount", ratio: 0.07, minWidth: 110 },
  { field: "discountTotal" as const, headerName: "Discount", ratio: 0.07, minWidth: 100 },
  { field: "totalBeforeDiscount" as const, headerName: "Total Before Discount", ratio: 0.09, minWidth: 130 },
  { field: "salesTotalWithoutTax" as const, headerName: "Total After Discount (excl. Tax)", ratio: 0.09, minWidth: 140 },
  { field: "salesTotal" as const, headerName: "Total After Discount (incl. Tax)", ratio: 0.09, minWidth: 140 },
  { field: "customersNo" as const, headerName: "Cust. Count", ratio: 0.05, minWidth: 80 },
  { field: "transactionsCount" as const, headerName: "Trn. Count", ratio: 0.05, minWidth: 90 },
  // TotalQty is bound to the desktop caption "Item Count" — same field, different caption.
  { field: "totalQty" as const, headerName: "Item Count", ratio: 0.05, minWidth: 90 },
  { field: "status" as const, headerName: "Status", ratio: 0.05, minWidth: 80 },
  { field: "storeName" as const, headerName: "Store Name", ratio: 0.08, minWidth: 120 },
  { field: "upcDiscount" as const, headerName: "Code", ratio: 0.05, minWidth: 90 },
  { field: "endDate" as const, headerName: "End Date", ratio: 0.06, minWidth: 100 },
  { field: "startDate" as const, headerName: "Start Date", ratio: 0.06, minWidth: 100 },
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
function guidStr(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === "" ? null : s
}
function dateStr(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === "string") return v
  if (v instanceof Date) return v.toISOString().split("T")[0]
  return null
}

function apiRowToGridRow(r: Record<string, unknown>): SalesSummaryByDiscountRow {
  const get = (camel: string, pascal: string) => (r as any)?.[camel] ?? (r as any)?.[pascal]
  return {
    discountID: guidStr(get("discountID", "DiscountID")),
    name: strOrNull(get("name", "Name")),
    percentsDiscount: num(get("percentsDiscount", "PercentsDiscount")),
    amountDiscount: num(get("amountDiscount", "AmountDiscount")),
    startDate: dateStr(get("startDate", "StartDate")),
    endDate: dateStr(get("endDate", "EndDate")),
    upcDiscount: strOrNull(get("upcDiscount", "UPCDiscount")),
    status: strOrNull(get("status", "Status")),
    customersNo: num(get("customersNo", "CustomersNo")),
    transactionsCount: num(get("transactionsCount", "TransactionsCount")),
    totalQty: num(get("totalQty", "TotalQty")),
    totalBeforeDiscount: num(get("totalBeforeDiscount", "TotalBeforeDiscount")),
    discountTotal: num(get("discountTotal", "DiscountTotal")),
    salesTotalWithoutTax: num(get("salesTotalWithoutTax", "SalesTotalWithoutTax")),
    salesTotal: num(get("salesTotal", "SalesTotal")),
    storeName: strOrNull(get("storeName", "StoreName")),
    storeID: guidStr(get("storeID", "StoreID")),
  }
}

const REPORT_TITLE = "Sales Summary By Discount"

const SALES_SUMMARY_BY_DISCOUNT_SCREEN_CODE = "reports.sales_summary_by_discount"

const SalesSummaryByDiscountReportPage: React.FC<SalesSummaryByDiscountReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { openTab } = useDashboardTabs()
  const { canExport } = usePermission(SALES_SUMMARY_BY_DISCOUNT_SCREEN_CODE)

  const todayStr = new Date().toISOString().split("T")[0]
  const defaultDateFrom =
    filters?.dateFrom || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
  const defaultDateTo = filters?.dateTo || todayStr

  const [dateFrom, setDateFrom] = useState<string>(defaultDateFrom)
  const [dateTo, setDateTo] = useState<string>(defaultDateTo)
  const [appliedDateFrom, setAppliedDateFrom] = useState<string>(defaultDateFrom)
  const [appliedDateTo, setAppliedDateTo] = useState<string>(defaultDateTo)
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
  // "Only Active" check-edit on the desktop — when checked, server filters out discounts whose
  // window doesn't cover today (StartDate>today OR EndDate<today). Both-null windows are kept.
  const [screenActiveOnly, setScreenActiveOnly] = useState<boolean>(false)
  const [appliedActiveOnly, setAppliedActiveOnly] = useState<boolean>(false)
  const [rows, setRows] = useState<SalesSummaryByDiscountRow[]>([])
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
    const from = filters.dateFrom || defaultDateFrom
    const to = filters.dateTo || defaultDateTo
    setDateFrom(from)
    setDateTo(to)
    setAppliedDateFrom(from)
    setAppliedDateTo(to)
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
    const withWidths = SALES_SUMMARY_BY_DISCOUNT_COLUMN_CONFIG.map((cfg) => ({
      width: Math.max(cfg.minWidth, Math.floor(total * cfg.ratio)),
      ...cfg,
    }))
    const adjust = total - withWidths.reduce((s, c) => s + c.width, 0)
    if (adjust !== 0) withWidths[0].width += adjust

    const currency = (v: number | null) => (v == null ? "-" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    const numFmt = (v: number | null) => (v == null ? "-" : Number(v).toLocaleString())
    const pctFmt = (v: number | null) => (v == null ? "-" : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`)
    // Desktop binds StartDate/EndDate as plain dates with no time. Render M/D/YYYY to match.
    const dateFmt = (v: unknown): string => {
      if (v == null || v === "") return ""
      const d = new Date(String(v))
      if (isNaN(d.getTime())) return String(v)
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
    }
    const cellRenderers: Record<string, (value: any) => string> = {
      percentsDiscount: (v) => pctFmt(v as number | null),
      amountDiscount: (v) => currency(v as number | null),
      customersNo: (v) => numFmt(v as number | null),
      transactionsCount: (v) => numFmt(v as number | null),
      totalQty: (v) => numFmt(v as number | null),
      totalBeforeDiscount: (v) => currency(v as number | null),
      discountTotal: (v) => currency(v as number | null),
      salesTotalWithoutTax: (v) => currency(v as number | null),
      salesTotal: (v) => currency(v as number | null),
      startDate: (v) => dateFmt(v),
      endDate: (v) => dateFmt(v),
    }
    const numberFields = ["percentsDiscount", "amountDiscount", "customersNo", "transactionsCount", "totalQty", "totalBeforeDiscount", "discountTotal", "salesTotalWithoutTax", "salesTotal"]
    return withWidths.map(({ field, headerName, width, minWidth: _mw, ratio: _r }) => ({
      field,
      headerName,
      width,
      sortable: true,
      filterable: field === "name" || field === "storeName" || field === "status" || field === "upcDiscount",
      visible: true,
      dataType: (numberFields.includes(field) ? "number" : "string") as "string" | "number",
      cellRenderer: cellRenderers[field] ? (value: any) => cellRenderers[field](value) : undefined,
    }))
  }, [gridContainerWidth])

  const fetchData = useCallback(
    async (overrides?: { dateFrom?: string; dateTo?: string; storeId?: string; activeOnly?: boolean }) => {
      const from = overrides?.dateFrom ?? appliedDateFrom
      const to = overrides?.dateTo ?? appliedDateTo
      if (!from || !to) return

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
        const activeOnly = overrides !== undefined ? !!overrides.activeOnly : appliedActiveOnly
        const body: Record<string, unknown> = {
          fromDate: from,
          fromTime: "12:00:00 AM",
          toDate: to,
          toTime: "11:59:59 PM",
          storeId: effectiveStoreId,
          activeOnly,
        }

        const response = await axios.post(API_ENDPOINTS.REPORTS.SALES_SUMMARY_BY_DISCOUNT, body, { headers })
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess
        if (!ok) {
          setError(response.data?.message || response.data?.Message || `Failed to load ${REPORT_TITLE}`)
          setRows([])
          setTotalRecords(0)
          return
        }
        const res = response.data?.response ?? response.data?.Response ?? {}
        const dataRaw = res?.data ?? res?.Data ?? []
        const list: SalesSummaryByDiscountRow[] = Array.isArray(dataRaw) ? dataRaw.map(apiRowToGridRow) : []
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
          setAppliedActiveOnly(!!overrides.activeOnly)
        }
      } catch (e: any) {
        setError(e?.response?.data?.message ?? e?.message ?? `Failed to load ${REPORT_TITLE}`)
        setRows([])
        setTotalRecords(0)
      } finally {
        setLoading(false)
      }
    },
    [appliedDateFrom, appliedDateTo, appliedStoreId, appliedActiveOnly, filters?.storeId, getAuthHeaders, stores]
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
    setAppliedDateFrom(dateFrom)
    setAppliedDateTo(dateTo)
    setAppliedStoreId(screenStoreId)
    setAppliedStoreName(screenStoreId ? (stores.find((s) => s.id === screenStoreId)?.name ?? screenStoreName) : "All Stores")
    setAppliedActiveOnly(screenActiveOnly)
    setGridKey((prev) => prev + 1)
    // Pass screenStoreId verbatim — empty string means "All Stores" and must reach fetchData so it can clear the previous store filter.
    fetchData({ dateFrom, dateTo, storeId: screenStoreId, activeOnly: screenActiveOnly })
  }, [dateFrom, dateTo, screenStoreId, screenStoreName, screenActiveOnly, stores, fetchData])

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
          fromDate: overrideFrom || appliedDateFrom,
          fromTime: "12:00:00 AM",
          toDate: overrideTo || appliedDateTo,
          toTime: "11:59:59 PM",
          storeId: effectiveStoreIdLocal,
          activeOnly: appliedActiveOnly,
        }
        const response = await axios.post(API_ENDPOINTS.REPORTS.SALES_SUMMARY_BY_DISCOUNT, body, { headers })
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
    [getAuthHeaders, appliedDateFrom, appliedDateTo, appliedStoreId, appliedActiveOnly, filters?.storeId]
  )

  const exportModal = useReportExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "sales-summary-by-discount",
    title: `${REPORT_TITLE} Report`,
    subtitle: `${displayStoreName} | ${new Date(appliedDateFrom).toLocaleDateString()} - ${new Date(appliedDateTo).toLocaleDateString()}`,
    dateField: "date",
    defaultDateFrom: appliedDateFrom,
    defaultDateTo: appliedDateTo,
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{REPORT_TITLE}</h1>
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
            {appliedActiveOnly && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>Active Only</span>
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
              {/* Desktop parity: RepDiscountSummary "Only Active" check-edit. */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Filter</label>
                <label className="flex items-center gap-2 h-10 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={screenActiveOnly}
                    onChange={(e) => setScreenActiveOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  <span>Active Only</span>
                </label>
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
              getRowId={(row) => `${(row as SalesSummaryByDiscountRow)?.discountID ?? ""}-${(row as SalesSummaryByDiscountRow)?.storeID ?? ""}`}
              containerWidth="100%"
              defaultSortColumn="storeName"
              defaultSortDirection="asc"
              defaultGroupByColumns={[{ field: "storeName", headerName: "Store Name" }]}
              defaultGroupsExpanded={true}
              onRowDoubleClick={(row) => {
                // Desktop parity: RepDiscountSummary.GridDoubleClick -> RepDiscountDetails
                // (ItemQ.GetTransacionByDiscount -> SP_GetTransactionDiscount, filter built
                // around dbo.TransactionEntryView.ItemStoreID = '<DiscountID>').
                // Group-header rows have no discountID — no-op gracefully.
                const r = row as SalesSummaryByDiscountRow
                const discountId = (r?.discountID ?? "").toString().trim()
                if (!discountId) return
                const discountName = (r?.name ?? "").toString().trim()
                const rowStoreName = (r?.storeName ?? "").toString().trim()
                const rowStoreId = (r?.storeID ?? "").toString().trim()
                const effStoreName = rowStoreName || appliedStoreName || ""
                const effStoreId = rowStoreId || appliedStoreId || ""

                openTab({
                  id: `sales-summary-by-discount-details-${discountId}`,
                  title: discountName ? `Discount Details [${discountName}]` : "Discount Details",
                  component: "SalesSummaryByDiscountDetailsPage",
                  props: {
                    discountId,
                    discountName: discountName || undefined,
                    storeName: effStoreName || undefined,
                    storeId: effStoreId || undefined,
                    fromDate: appliedDateFrom,
                    toDate: appliedDateTo,
                  },
                  closable: true,
                })
              }}
            />
          </div>
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default SalesSummaryByDiscountReportPage
