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
import SearchableSelect, { SelectOption } from "../../components/form/SearchableSelect"
import ExportModal from "../../components/common/ExportModal"
import { useReportExportModal } from "../../hooks/useReportExportModal"

interface ActionDetailsReportProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    storeId?: string
    storeName?: string
    // Drill-down filters from Action Summary row double-click
    batchId?: string
    cashierId?: string
    actionType?: number
    registerId?: string
    approveById?: string
    /** Display-only: action name shown in header subtitle when drilling in. */
    actionLabel?: string
    /** When true, render the stripped-down drill-down layout (no date/store editor). */
    drillDown?: boolean
  }
}

interface StoreOption {
  id: string
  name: string
  code?: string
}

interface ActionDetailsRow {
  action: string
  // `tranDate` is the raw ISO DateTime from the backend in serverSide mode; the export
  // mapper writes a pre-formatted M/D/YYYY string into the same key.
  tranDate: string
  transactionNo: string
  register: string
  approveBy: string
  // Same dual usage: number-ish from the server, currency string after export mapping.
  amount: string | number
  info: string
  _rowId?: string
}

// Columns per desktop: Action, Date, Transaction No., Register, Approve By, Amount, Info.
// Field names match the backend DTO (camelCase from Newtonsoft) so the grid can render the
// raw response directly in serverSide mode — `tranDate` and `amount` are formatted via
// cellRenderer attached in the columns useMemo below.
const ACTION_DETAILS_COLUMN_CONFIG = [
  { field: "action", headerName: "Action", ratio: 0.16, minWidth: 120 },
  { field: "tranDate", headerName: "Date", ratio: 0.12, minWidth: 100 },
  { field: "transactionNo", headerName: "Transaction No.", ratio: 0.14, minWidth: 120 },
  { field: "register", headerName: "Register", ratio: 0.18, minWidth: 150 },
  { field: "approveBy", headerName: "Approve By", ratio: 0.12, minWidth: 100 },
  { field: "amount", headerName: "Amount", ratio: 0.12, minWidth: 100 },
  { field: "info", headerName: "Info", ratio: 0.16, minWidth: 120 },
] as const

const ACTION_DETAILS_SCREEN_CODE = "reports.action_details"

const ActionDetailsReportPage: React.FC<ActionDetailsReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { canExport } = usePermission(ACTION_DETAILS_SCREEN_CODE)

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

  const [totalRecords, setTotalRecords] = useState(0)
  const [error] = useState<string | null>(null)

  // Desktop-parity dropdown filters: Batch / Register / Cashier / Approve By.
  // Each has a "screen" value (what the user is editing) and an "applied" value
  // (what's actually in the request). The grid refetches when applied changes.
  const [screenBatchId, setScreenBatchId] = useState("")
  const [screenRegisterId, setScreenRegisterId] = useState("")
  const [screenCashierId, setScreenCashierId] = useState("")
  const [screenApproveById, setScreenApproveById] = useState("")
  const [appliedBatchId, setAppliedBatchId] = useState("")
  const [appliedRegisterId, setAppliedRegisterId] = useState("")
  const [appliedCashierId, setAppliedCashierId] = useState("")
  const [appliedApproveById, setAppliedApproveById] = useState("")

  // Option lists populated from the response on the first page only.
  const [batchOptions, setBatchOptions] = useState<SelectOption[]>([{ value: "", label: "All batches" }])
  const [registerOptions, setRegisterOptions] = useState<SelectOption[]>([{ value: "", label: "All registers" }])
  const [cashierFilterOptions, setCashierFilterOptions] = useState<SelectOption[]>([{ value: "", label: "All cashiers" }])
  const [approveByOptions, setApproveByOptions] = useState<SelectOption[]>([{ value: "", label: "All users" }])

  const [gridKey, setGridKey] = useState(0)
  const gridDataRef = useRef<ActionDetailsRow[]>([])

  const [showExportMenu, setShowExportMenu] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement | null>(null)
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
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) setShowExportMenu(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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
      setGridKey((k) => k + 1)
    }
  }, [filters?.dateFrom, filters?.dateTo, filters?.storeId, filters?.storeName])

  const storeSelectOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "All Stores" },
      ...stores.map((s) => ({ value: s.id, label: s.name })),
    ],
    [stores]
  )

  const formatTranDate = useCallback((v: any): string => {
    if (v == null || v === "") return ""
    // Backend serializes DateTime as ISO; render in local M/D/YYYY (matches desktop).
    const d = new Date(v)
    if (isNaN(d.getTime())) return String(v)
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
  }, [])

  const formatAmount = useCallback((v: any): string => {
    if (v == null || v === "") return "$0.00"
    const n = Number(v)
    if (!isFinite(n)) return String(v)
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
  }, [])

  const columns: Column[] = useMemo(() => {
    const total = gridContainerWidth
    return ACTION_DETAILS_COLUMN_CONFIG.map((cfg) => {
      const width = Math.max(cfg.minWidth, Math.floor(total * cfg.ratio))
      const col: Column = {
        field: cfg.field,
        headerName: cfg.headerName,
        width,
        sortable: true,
        filterable: true,
        dataType: cfg.field === "amount" ? "number" : cfg.field === "tranDate" ? "date" : "string",
      }
      if (cfg.field === "tranDate") col.cellRenderer = (v) => formatTranDate(v)
      if (cfg.field === "amount") col.cellRenderer = (v) => formatAmount(v)
      return col
    })
  }, [gridContainerWidth, formatTranDate, formatAmount])

  // Build the filter payload sent on every paginated request. Page navigation reuses this
  // and just varies startRow/endRow; only handleSearch (or a drill-down prop change) mutates it.
  const additionalParams = useMemo(() => {
    const params: Record<string, unknown> = {
      fromDate: appliedDateFrom,
      toDate: appliedDateTo,
    }
    const storeIdToUse = appliedStoreId ?? filters?.storeId
    const validStoreId =
      typeof storeIdToUse === "string" &&
      storeIdToUse.trim().length > 0 &&
      /^[0-9a-f-]{36}$/i.test(storeIdToUse.trim())
    if (validStoreId) params.storeId = storeIdToUse!.trim()
    // Drill-down scope (from Action Summary row double-click) takes precedence over
    // the on-screen dropdowns since those dropdowns are hidden in drill-down mode.
    if (filters?.batchId) params.batchId = filters.batchId
    else if (appliedBatchId) params.batchId = appliedBatchId
    if (filters?.cashierId) params.cashierId = filters.cashierId
    else if (appliedCashierId) params.cashierId = appliedCashierId
    if (typeof filters?.actionType === "number") params.actionType = filters.actionType
    if (filters?.registerId) params.registerId = filters.registerId
    else if (appliedRegisterId) params.registerId = appliedRegisterId
    if (filters?.approveById) params.approveById = filters.approveById
    else if (appliedApproveById) params.approveById = appliedApproveById
    return params
  }, [
    appliedDateFrom, appliedDateTo, appliedStoreId, filters?.storeId,
    appliedBatchId, appliedRegisterId, appliedCashierId, appliedApproveById,
    filters?.batchId, filters?.cashierId, filters?.actionType, filters?.registerId, filters?.approveById,
  ])

  const handleResponseLoaded = useCallback((responseData: Record<string, unknown>) => {
    const r = responseData as Record<string, unknown>

    type OptionPair = { id?: string; Id?: string; name?: string; Name?: string }
    const toLookupOptions = (arr: unknown, allLabel: string): SelectOption[] => {
      const items = Array.isArray(arr) ? (arr as OptionPair[]) : []
      const seen = new Set<string>()
      const out: SelectOption[] = []
      for (const it of items) {
        const id = String(it?.id ?? it?.Id ?? "").trim()
        const name = String(it?.name ?? it?.Name ?? "").trim()
        if (!id || !name || seen.has(id)) continue
        seen.add(id)
        out.push({ value: id, label: name })
      }
      out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
      return [{ value: "", label: allLabel }, ...out]
    }

    // Backend only emits these on the first page; ignore empty arrays so we don't wipe earlier values.
    const rawBatchOpts = r?.batchOptions ?? r?.BatchOptions
    const rawRegOpts = r?.registerOptions ?? r?.RegisterOptions
    const rawCashOpts = r?.cashierOptions ?? r?.CashierOptions
    const rawApvOpts = r?.approveByOptions ?? r?.ApproveByOptions
    if (Array.isArray(rawBatchOpts) && rawBatchOpts.length > 0) setBatchOptions(toLookupOptions(rawBatchOpts, "All batches"))
    if (Array.isArray(rawRegOpts) && rawRegOpts.length > 0) setRegisterOptions(toLookupOptions(rawRegOpts, "All registers"))
    if (Array.isArray(rawCashOpts) && rawCashOpts.length > 0) setCashierFilterOptions(toLookupOptions(rawCashOpts, "All cashiers"))
    if (Array.isArray(rawApvOpts) && rawApvOpts.length > 0) setApproveByOptions(toLookupOptions(rawApvOpts, "All users"))
  }, [])

  const handleGridDataChange = useCallback((data: any[]) => {
    gridDataRef.current = data as ActionDetailsRow[]
  }, [])

  const displayStoreName = appliedStoreName || "All Stores"
  // Drill-down mode is set when ActionSummary opens this page on row double-click. The
  // scope (batch / cashier / action type / day / store) is fixed for the lifetime of the
  // tab — desktop parity is to show only the result + a search box, with no date or
  // store editor.
  const isDrillDown = filters?.drillDown === true
  const drillDownActionLabel = filters?.actionLabel?.trim() ?? ""

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
    setAppliedStoreId(screenStoreId)
    setAppliedStoreName(screenStoreId ? (stores.find((s) => s.id === screenStoreId)?.name ?? screenStoreName) : "All Stores")
    setAppliedBatchId(screenBatchId)
    setAppliedRegisterId(screenRegisterId)
    setAppliedCashierId(screenCashierId)
    setAppliedApproveById(screenApproveById)
    setGridKey((k) => k + 1)
  }, [dateFrom, dateTo, screenStoreId, screenStoreName, stores, screenBatchId, screenRegisterId, screenCashierId, screenApproveById])

  // Re-fetch the full (unpaged) dataset for the export modal — ask for one giant page.
  // Mirrors handleSearch's applied filters (including drill-down props) so the export
  // covers exactly what the user is looking at on screen.
  const fetchAllDataForExport = useCallback(async (dateFrom?: string, dateTo?: string): Promise<ActionDetailsRow[]> => {
    const effectiveFrom = dateFrom || appliedDateFrom
    const effectiveTo = dateTo || appliedDateTo
    if (!effectiveFrom || !effectiveTo) return gridDataRef.current
    try {
      const headers = getAuthHeaders()
      const body: Record<string, unknown> = {
        fromDate: effectiveFrom,
        toDate: effectiveTo,
        startRow: 0,
        endRow: 1000000,
      }
      const storeIdToUse = appliedStoreId ?? filters?.storeId
      const validStoreId =
        typeof storeIdToUse === "string" &&
        storeIdToUse.trim().length > 0 &&
        /^[0-9a-f-]{36}$/i.test(storeIdToUse.trim())
      if (validStoreId) body.storeId = storeIdToUse!.trim()
      // Drill-down scope takes precedence over on-screen dropdowns (same rule as additionalParams).
      if (filters?.batchId) body.batchId = filters.batchId
      else if (appliedBatchId) body.batchId = appliedBatchId
      if (filters?.cashierId) body.cashierId = filters.cashierId
      else if (appliedCashierId) body.cashierId = appliedCashierId
      if (typeof filters?.actionType === "number") body.actionType = filters.actionType
      if (filters?.registerId) body.registerId = filters.registerId
      else if (appliedRegisterId) body.registerId = appliedRegisterId
      if (filters?.approveById) body.approveById = filters.approveById
      else if (appliedApproveById) body.approveById = appliedApproveById

      const response = await axios.post(API_ENDPOINTS.REPORTS.ACTION_DETAILS, body, { headers })
      const ok = response.data?.isSuccess ?? response.data?.IsSuccess
      if (!ok) return gridDataRef.current

      const res = response.data?.response ?? response.data?.Response ?? {}
      const dataRaw = res?.data ?? res?.Data ?? []
      return Array.isArray(dataRaw)
        ? dataRaw.map((r: any, idx: number) => {
            const tranDate = r?.tranDate ?? r?.TranDate
            const d = tranDate != null ? new Date(tranDate) : null
            const dateStr = d ? `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}` : ""
            const amt = r?.amount ?? r?.Amount
            const amountStr =
              amt != null && amt !== ""
                ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(amt))
                : "$0.00"
            return {
              action: r?.action ?? r?.Action ?? "",
              tranDate: dateStr,
              transactionNo: r?.transactionNo ?? r?.TransactionNo ?? "",
              register: r?.register ?? r?.Register ?? "",
              approveBy: r?.approveBy ?? r?.ApproveBy ?? r?.userName ?? r?.UserName ?? "",
              amount: amountStr,
              info: r?.info ?? r?.Info ?? "",
              _rowId: r?.transactionID ?? r?.TransactionID ?? `row-${idx}`,
            }
          })
        : gridDataRef.current
    } catch (e) {
      console.error("Export fetch failed", e)
      return gridDataRef.current
    }
  }, [appliedDateFrom, appliedDateTo, appliedStoreId, filters?.storeId, getAuthHeaders, appliedBatchId, appliedRegisterId, appliedCashierId, appliedApproveById, filters?.batchId, filters?.cashierId, filters?.actionType, filters?.registerId, filters?.approveById])

  const exportModal = useReportExportModal({
    columns,
    fetchAllData: fetchAllDataForExport,
    filename: "action-details-report",
    title: "Action Details",
    subtitle: displayStoreName,
    dateField: "tranDate",
    defaultDateFrom: appliedDateFrom,
    defaultDateTo: appliedDateTo,
  })

  const handleExportCSV = useCallback(async () => {
    setIsExporting(true)
    setShowExportMenu(false)
    try {
      const { exportToCSV } = await import("../../gridUtils")
      const data = gridDataRef.current
      if (!data.length) {
        alert("No data to export. Run Search first.")
        return
      }
      const columnsForExport = columns.map((c) => ({
        field: c.field,
        headerName: c.headerName,
        dataType: c.dataType || "string",
      }))
      exportToCSV(data as any[], "action-details-report", columnsForExport as any)
    } finally {
      setIsExporting(false)
    }
  }, [columns])

  const handleExportPDF = useCallback(async () => {
    setIsExporting(true)
    setShowExportMenu(false)
    try {
      const { exportToPDF } = await import("../../gridUtils")
      const data = gridDataRef.current
      if (!data.length) {
        alert("No data to export. Run Search first.")
        return
      }
      const columnsForExport = columns.map((c) => ({
        field: c.field,
        headerName: c.headerName,
        dataType: c.dataType || "string",
      }))
      exportToPDF(data as any[], "action-details-report", columnsForExport as any, {
        title: "Action Details",
        subtitle: `${new Date(appliedDateFrom).toLocaleDateString()} - ${new Date(appliedDateTo).toLocaleDateString()}`,
        orientation: "landscape",
      })
    } finally {
      setIsExporting(false)
    }
  }, [columns, appliedDateFrom, appliedDateTo])

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {isDrillDown && drillDownActionLabel ? `${drillDownActionLabel} Details` : "Action Details"}
          </h1>
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
            {!isDrillDown && (
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
              <div className="space-y-1 min-w-[220px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Store
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

              {/* Desktop-parity filters: Batch / Register / Cashier / Approve By.
                  Options come from the report response on the first page. */}
              <div className="space-y-1 min-w-[180px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Batch</label>
                <SearchableSelect
                  options={batchOptions}
                  value={screenBatchId}
                  onChange={setScreenBatchId}
                  placeholder="All batches"
                />
              </div>
              <div className="space-y-1 min-w-[180px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Register</label>
                <SearchableSelect
                  options={registerOptions}
                  value={screenRegisterId}
                  onChange={setScreenRegisterId}
                  placeholder="All registers"
                />
              </div>
              <div className="space-y-1 min-w-[180px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cashier</label>
                <SearchableSelect
                  options={cashierFilterOptions}
                  value={screenCashierId}
                  onChange={setScreenCashierId}
                  placeholder="All cashiers"
                />
              </div>
              <div className="space-y-1 min-w-[180px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Approve By</label>
                <SearchableSelect
                  options={approveByOptions}
                  value={screenApproveById}
                  onChange={setScreenApproveById}
                  placeholder="All users"
                />
              </div>
            </div>
            )}

            <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm ml-auto overflow-visible">
              {!isDrillDown && (
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
              )}
              {canExport && (
              <div className="relative border-0 border-r border-gray-200 dark:border-gray-600" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={isExporting}
                  type="button"
                  className="h-10 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 border-0 border-r border-gray-200 dark:border-gray-600 disabled:opacity-50 rounded-none"
                  title="Export"
                >
                  {isExporting ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  Export
                  <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowExportMenu(false)
                          exportModal.open()
                        }}
                        className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700"
                      >
                        <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Export with Preview…
                      </button>
                      <button type="button" onClick={() => handleExportPDF()} className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        Export to PDF
                      </button>
                      <button type="button" onClick={() => handleExportCSV()} className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        Export to CSV
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col" ref={gridContainerRef}>
          <ServerGrid
            key={gridKey}
            hideDefaultContextMenuItems={true}
            columns={columns}
            apiUrl={API_ENDPOINTS.REPORTS.ACTION_DETAILS}
            serverSide={true}
            methodType="POST"
            getAuthHeaders={getAuthHeaders}
            additionalParams={additionalParams}
            pagination={true}
            pageSize={100}
            columnChooser={true}
            title="Action Details"
            setTotalRecords={setTotalRecords}
            onResponseLoaded={handleResponseLoaded}
            onDataChange={handleGridDataChange}
            defaultSortColumn="tranDate"
            defaultSortDirection="desc"
            emptyMessage="No data for the selected criteria"
            headerSearch={isDrillDown}
            containerWidth="100%"
            gridId="action-details-report"
            getRowId={(row) => (row as any)?._rowId ?? `${(row as any)?.transactionNo}-${(row as any)?.action}-${(row as any)?.tranDate}`}
          />
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default ActionDetailsReportPage
