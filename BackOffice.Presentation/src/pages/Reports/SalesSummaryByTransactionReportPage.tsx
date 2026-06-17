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
import { useDashboardTabs } from "../../context/DashboardTabContext"

interface SalesSummaryByTransactionReportProps {
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

interface CustomerOption {
  id: string
  name: string
  code?: string
}

interface UserOption {
  id: string
  name: string
}

/** Grid row shape matching SalesSummaryByTransactionRowDto (desktop clone). */
interface SalesSummaryByTransactionRow {
  storeName: string
  no: string
  customerNo: string
  date: string
  customerName: string
  discountPercent: number | null
  user: string
  total: number | null
  subTotal: number | null
  discountAmount: number | null
  tax: number | null
  markup: number | null
  margin: number | null
  profit: number | null
  storeName2: string
}

const SCOPE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "custom", label: "Custom" },
] as const

/** Grid columns matching desktop order: No, Customer No., Date, Customer Name, Discount %, User, Total, Sub Total, Discount $, Tax, Markup, Margin, Profit, Store Name. */
const SALES_SUMMARY_BY_TRANSACTION_COLUMNS = [
  { field: "no" as const, headerName: "No", ratio: 0.06, minWidth: 80 },
  { field: "customerNo" as const, headerName: "Customer No.", ratio: 0.08, minWidth: 110 },
  { field: "date" as const, headerName: "Date", ratio: 0.07, minWidth: 95 },
  { field: "customerName" as const, headerName: "Customer Name", ratio: 0.12, minWidth: 140 },
  { field: "discountPercent" as const, headerName: "Discount %", ratio: 0.05, minWidth: 80 },
  { field: "user" as const, headerName: "User", ratio: 0.06, minWidth: 80 },
  { field: "total" as const, headerName: "Total", ratio: 0.06, minWidth: 85 },
  { field: "subTotal" as const, headerName: "Sub Total", ratio: 0.06, minWidth: 85 },
  { field: "discountAmount" as const, headerName: "Discount $", ratio: 0.06, minWidth: 85 },
  { field: "tax" as const, headerName: "Tax", ratio: 0.05, minWidth: 70 },
  { field: "markup" as const, headerName: "Markup", ratio: 0.05, minWidth: 75 },
  { field: "margin" as const, headerName: "Margin", ratio: 0.05, minWidth: 75 },
  { field: "profit" as const, headerName: "Profit", ratio: 0.06, minWidth: 85 },
  { field: "storeName" as const, headerName: "Store Name", ratio: 0.10, minWidth: 120 },
] as const

const REPORT_TITLE = "Sales Summary By Transaction"

const SALES_SUMMARY_BY_TRANSACTION_SCREEN_CODE = "reports.sales_summary_by_transaction"

const CURRENCY_FIELDS = ["total", "subTotal", "discountAmount", "tax", "markup", "margin", "profit"] as const
const NUMERIC_FIELDS = ["discountPercent", ...CURRENCY_FIELDS] as const

const SalesSummaryByTransactionReportPage: React.FC<SalesSummaryByTransactionReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { canExport } = usePermission(SALES_SUMMARY_BY_TRANSACTION_SCREEN_CODE)
  const { openTab } = useDashboardTabs()

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
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [users, setUsers] = useState<UserOption[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
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

  // Screen filters (what the user is editing) vs applied filters (what's in the request).
  // additionalParams depends only on applied state so page navigation reuses the same payload.
  const [scope, setScope] = useState<string>("this-month")
  const [fromTime, setFromTime] = useState<string>("12:00:00 AM")
  const [toTime, setToTime] = useState<string>("11:59:59 PM")
  const [customerFilter, setCustomerFilter] = useState<string>("")
  const [userFilter, setUserFilter] = useState<string>("")
  const [onlyRegister, setOnlyRegister] = useState(false)

  const [appliedScope, setAppliedScope] = useState<string>("this-month")
  const [appliedFromTime, setAppliedFromTime] = useState<string>("12:00:00 AM")
  const [appliedToTime, setAppliedToTime] = useState<string>("11:59:59 PM")
  const [appliedCustomerFilter, setAppliedCustomerFilter] = useState<string>("")
  const [appliedUserFilter, setAppliedUserFilter] = useState<string>("")
  const [appliedOnlyRegister, setAppliedOnlyRegister] = useState(false)

  const [gridKey, setGridKey] = useState(0)
  const gridDataRef = useRef<SalesSummaryByTransactionRow[]>([])

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

  const getLocalCustomerId = useCallback((): number | null => {
    try {
      const userData = localStorage.getItem("userData")
      if (userData) {
        const parsed = JSON.parse(userData)
        const id = parsed.customerId ?? parsed.customerID
        if (id != null) return typeof id === "number" ? id : parseInt(String(id), 10)
      }
    } catch {
      // ignore
    }
    return null
  }, [])

  useEffect(() => {
    setLoadingCustomers(true)
    const headers = getAuthHeaders()
    fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_CUSTOMERS_LOOKUP, { headers })
      .then((res) => res.json())
      .then((data) => {
        const ok = data?.isSuccess === true || data?.IsSuccess === true
        const list = data?.response ?? data?.Response
        if (ok && Array.isArray(list)) {
          const mapped = list
            .map((c: any) => {
              const rawId = c.customerID ?? c.CustomerID ?? c.id
              const id = rawId != null ? String(rawId).trim() : ""
              const name = (c.name ?? c.Name ?? "").trim()
              const code = c.customerNo != null || c.CustomerNo != null ? String(c.customerNo ?? c.CustomerNo ?? "").trim() : undefined
              return { id, name, code }
            })
            .filter((c) => c.id !== "")
          setCustomers(mapped)
        } else {
          setCustomers([])
        }
      })
      .catch(console.error)
      .finally(() => setLoadingCustomers(false))
  }, [getAuthHeaders])

  useEffect(() => {
    const customerId = getLocalCustomerId()
    if (customerId == null) {
      setUsers([])
      return
    }
    setLoadingUsers(true)
    const headers = getAuthHeaders()
    fetch(API_ENDPOINTS.USERS.GET_USERS_BY_CUSTOMER(customerId), { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.isSuccess && data.response) {
          const list = (data.response as Array<{ localUserId?: string; userId?: number; userName?: string; displayName?: string }>).map(
            (u) => ({
              id: String(u.localUserId ?? u.userId ?? u.userName ?? ""),
              name: u.userName ?? u.displayName ?? String(u.userId ?? u.localUserId ?? ""),
            })
          )
          setUsers(list)
        } else if (Array.isArray(data)) {
          setUsers(
            data.map((u: any) => ({
              id: String(u.localUserId ?? u.userId ?? u.userName ?? ""),
              name: u.userName ?? u.displayName ?? String(u.userId ?? u.localUserId ?? ""),
            }))
          )
        } else {
          setUsers([])
        }
      })
      .catch(console.error)
      .finally(() => setLoadingUsers(false))
  }, [getAuthHeaders, getLocalCustomerId])

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

  // Sync with Report Manager filters.
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
    if (filters.dateFrom || filters.dateTo || filters.storeId || filters.storeName) {
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
  const customerSelectOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "All Customers" },
      ...customers.map((c) => ({ value: c.id, label: c.name || c.code || c.id })),
    ],
    [customers]
  )
  const userSelectOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "All Users" },
      ...users.map((u) => ({ value: u.id, label: u.name })),
    ],
    [users]
  )

  // Formatters used in cellRenderers and the print fallback. The grid renders raw
  // response fields in serverSide mode, so dates/currency need explicit formatting.
  const formatDate = useCallback((v: any): string => {
    if (v == null || v === "") return ""
    const d = new Date(v)
    if (isNaN(d.getTime())) return String(v)
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
  }, [])

  const formatCurrency = useCallback((v: any): string => {
    if (v == null || v === "") return ""
    const n = Number(v)
    if (!isFinite(n)) return String(v)
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
  }, [])

  const formatPercent = useCallback((v: any): string => {
    if (v == null || v === "") return ""
    const n = Number(v)
    if (!isFinite(n)) return String(v)
    return `${n.toFixed(2)}%`
  }, [])

  const columns: Column[] = useMemo(() => {
    const total = gridContainerWidth
    const numericFields: readonly string[] = NUMERIC_FIELDS
    const currencyFields: readonly string[] = CURRENCY_FIELDS
    return SALES_SUMMARY_BY_TRANSACTION_COLUMNS.map((cfg) => {
      const width = Math.max(cfg.minWidth, Math.floor(total * cfg.ratio))
      const col: Column = {
        field: cfg.field,
        headerName: cfg.headerName,
        width,
        sortable: true,
        filterable: true,
        dataType: (numericFields.includes(cfg.field) ? "number" : cfg.field === "date" ? "date" : "string") as
          | "string"
          | "number"
          | "date",
      }
      if (cfg.field === "date") col.cellRenderer = (v) => formatDate(v)
      else if (cfg.field === "discountPercent") col.cellRenderer = (v) => formatPercent(v)
      else if (currencyFields.includes(cfg.field)) col.cellRenderer = (v) => formatCurrency(v)
      return col
    })
  }, [gridContainerWidth, formatDate, formatCurrency, formatPercent])

  // Build the filter payload sent on every paginated request. Only changes when the user
  // applies a new search via handleSearch — page navigation reuses this and just varies
  // startRow/endRow.
  const additionalParams = useMemo(() => {
    const params: Record<string, unknown> = {
      scope: appliedScope,
      fromDate: appliedDateFrom,
      fromTime: appliedFromTime || "12:00:00 AM",
      toDate: appliedDateTo,
      toTime: appliedToTime || "11:59:59 PM",
      onlyRegister: appliedOnlyRegister,
    }
    if (appliedCustomerFilter) params.customerFilter = appliedCustomerFilter
    if (appliedUserFilter) params.userFilter = appliedUserFilter
    const storeIdToUse = appliedStoreId ?? filters?.storeId
    const validStoreId =
      typeof storeIdToUse === "string" &&
      storeIdToUse.trim().length > 0 &&
      /^[0-9a-f-]{36}$/i.test(storeIdToUse.trim())
    if (validStoreId) params.storeId = storeIdToUse!.trim()
    return params
  }, [
    appliedScope,
    appliedDateFrom,
    appliedDateTo,
    appliedFromTime,
    appliedToTime,
    appliedCustomerFilter,
    appliedUserFilter,
    appliedOnlyRegister,
    appliedStoreId,
    filters?.storeId,
  ])

  // No page-level totals on this report — totalRecords is plumbed via setTotalRecords prop.
  // Keep the callback for parity with the canonical pattern in case totals are added later.
  const handleResponseLoaded = useCallback((_responseData: Record<string, unknown>) => {
    // Intentionally empty: this report has no header totals beyond record count.
  }, [])

  const handleGridDataChange = useCallback((data: any[]) => {
    gridDataRef.current = data as SalesSummaryByTransactionRow[]
  }, [])

  const displayStoreName = appliedStoreName || "All Stores"

  const flatpickrCommonOptions = useMemo(
    () => ({
      dateFormat: "Y-m-d",
      allowInput: true,
      static: false,
    }),
    []
  )

  const handleGo = useCallback(() => {
    // Pass screenStoreId verbatim — empty string means "All Stores" and must reach the
    // applied state so it can clear the previous store filter.
    setAppliedDateFrom(dateFrom)
    setAppliedDateTo(dateTo)
    setAppliedStoreId(screenStoreId)
    setAppliedStoreName(
      screenStoreId ? (stores.find((s) => s.id === screenStoreId)?.name ?? screenStoreName ?? "Selected Store") : "All Stores"
    )
    setAppliedScope(scope)
    setAppliedFromTime(fromTime)
    setAppliedToTime(toTime)
    setAppliedCustomerFilter(customerFilter)
    setAppliedUserFilter(userFilter)
    setAppliedOnlyRegister(onlyRegister)
    setGridKey((k) => k + 1)
  }, [dateFrom, dateTo, screenStoreId, screenStoreName, stores, scope, fromTime, toTime, customerFilter, userFilter, onlyRegister])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault()
        handleGo()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleGo])

  // Fetch every row for export/print by asking for one giant page; mirrors the applied
  // filters so the export covers exactly what the user is looking at on screen.
  const fetchAllData = useCallback(
    async (overrideFrom?: string, overrideTo?: string): Promise<any[]> => {
      try {
        const headers = getAuthHeaders()
        const body: Record<string, unknown> = {
          scope: appliedScope,
          fromDate: overrideFrom || appliedDateFrom,
          fromTime: appliedFromTime || "12:00:00 AM",
          toDate: overrideTo || appliedDateTo,
          toTime: appliedToTime || "11:59:59 PM",
          onlyRegister: appliedOnlyRegister,
          startRow: 0,
          endRow: 1000000,
        }
        if (appliedCustomerFilter) body.customerFilter = appliedCustomerFilter
        if (appliedUserFilter) body.userFilter = appliedUserFilter
        const storeIdToUse = appliedStoreId ?? filters?.storeId
        const validStoreId =
          typeof storeIdToUse === "string" &&
          storeIdToUse.trim().length > 0 &&
          /^[0-9a-f-]{36}$/i.test(storeIdToUse.trim())
        if (validStoreId) body.storeId = storeIdToUse!.trim()
        const response = await axios.post(API_ENDPOINTS.REPORTS.SALES_SUMMARY_BY_TRANSACTION, body, { headers })
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess
        if (!ok) return []
        const res = response.data?.response ?? response.data?.Response ?? {}
        const dataRaw = res?.data ?? res?.Data ?? []
        // Map to the same row shape the grid uses so export columns line up.
        return Array.isArray(dataRaw)
          ? dataRaw.map((r: any) => ({
              storeName: String(r?.storeName ?? r?.StoreName ?? ""),
              no: String(r?.no ?? r?.No ?? ""),
              customerNo: String(r?.customerNo ?? r?.CustomerNo ?? ""),
              date: r?.date ?? r?.Date ?? "",
              customerName: String(r?.customerName ?? r?.CustomerName ?? ""),
              discountPercent: r?.discountPercent ?? r?.DiscountPercent ?? null,
              user: String(r?.user ?? r?.User ?? ""),
              total: r?.total ?? r?.Total ?? null,
              subTotal: r?.subTotal ?? r?.SubTotal ?? null,
              discountAmount: r?.discountAmount ?? r?.DiscountAmount ?? null,
              tax: r?.tax ?? r?.Tax ?? null,
              markup: r?.markup ?? r?.Markup ?? null,
              margin: r?.margin ?? r?.Margin ?? null,
              profit: r?.profit ?? r?.Profit ?? null,
              storeName2: String(r?.storeName2 ?? r?.StoreName2 ?? ""),
            }))
          : []
      } catch (error) {
        console.error(`Failed to fetch ${REPORT_TITLE} for export:`, error)
        return []
      }
    },
    [
      getAuthHeaders,
      appliedDateFrom,
      appliedDateTo,
      appliedStoreId,
      filters?.storeId,
      appliedScope,
      appliedFromTime,
      appliedToTime,
      appliedCustomerFilter,
      appliedUserFilter,
      appliedOnlyRegister,
    ]
  )

  const exportModal = useReportExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "sales-summary-by-transaction",
    title: `${REPORT_TITLE} Report`,
    subtitle: `${displayStoreName} | ${new Date(appliedDateFrom).toLocaleDateString()} - ${new Date(appliedDateTo).toLocaleDateString()}`,
    dateField: "date",
    defaultDateFrom: appliedDateFrom,
    defaultDateTo: appliedDateTo,
  })

  return (
    <>
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          {/* Title and summary (same as Tax By Store) */}
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
              <div className="space-y-1 hidden">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Scope</label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="h-10 min-w-[100px] px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                >
                  {SCOPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">From</label>
                <div className="flex gap-1">
                  <div className="flatpickr-wrapper w-[120px] relative">
                    <Flatpickr
                      value={dateFrom}
                      onChange={([d]) => { setDateFrom(d ? d.toISOString().split("T")[0] : dateFrom); setScope("custom") }}
                      options={flatpickrCommonOptions}
                      placeholder="Date"
                      className="w-full h-10 pl-8 pr-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </span>
                  </div>
                  <input
                    type="text"
                    value={fromTime}
                    onChange={(e) => setFromTime(e.target.value)}
                    placeholder="12:00:00 AM"
                    className="w-[100px] h-10 px-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">To</label>
                <div className="flex gap-1">
                  <div className="flatpickr-wrapper w-[120px] relative">
                    <Flatpickr
                      value={dateTo}
                      onChange={([d]) => { setDateTo(d ? d.toISOString().split("T")[0] : dateTo); setScope("custom") }}
                      options={flatpickrCommonOptions}
                      placeholder="Date"
                      className="w-full h-10 pl-8 pr-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </span>
                  </div>
                  <input
                    type="text"
                    value={toTime}
                    onChange={(e) => setToTime(e.target.value)}
                    placeholder="11:59:59 PM"
                    className="w-[100px] h-10 px-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="space-y-1 min-w-[180px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Customer</label>
                <div className="flex items-center gap-1">
                  <SearchableSelect
                    options={customerSelectOptions}
                    value={customerFilter}
                    onChange={(value) => setCustomerFilter(value)}
                    placeholder="Customer..."
                    loading={loadingCustomers}
                  />
                  {customerFilter && (
                    <button type="button" onClick={() => setCustomerFilter("")} className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-400" title="Clear">×</button>
                  )}
                </div>
              </div>
              <div className="space-y-1 min-w-[160px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">User</label>
                <div className="flex items-center gap-1">
                  <SearchableSelect
                    options={userSelectOptions}
                    value={userFilter}
                    onChange={(value) => setUserFilter(value)}
                    placeholder="User..."
                    loading={loadingUsers}
                  />
                  {userFilter && (
                    <button type="button" onClick={() => setUserFilter("")} className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-400" title="Clear">×</button>
                  )}
                </div>
              </div>
              <div className="space-y-1 min-w-[180px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Store</label>
                <div className="flex items-center gap-1">
                  <SearchableSelect
                    options={storeSelectOptions}
                    value={screenStoreId}
                    onChange={(value) => {
                      setScreenStoreId(value)
                      const store = stores.find((s) => s.id === value)
                      setScreenStoreName(store?.name ?? "")
                    }}
                    placeholder="Store..."
                    loading={loadingStores}
                  />
                  {screenStoreId && (
                    <button type="button" onClick={() => { setScreenStoreId(""); setScreenStoreName("") }} className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-400" title="Clear">×</button>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2 h-10 cursor-pointer">
                <input type="checkbox" checked={onlyRegister} onChange={(e) => setOnlyRegister(e.target.checked)} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500 bg-white dark:bg-gray-700" />
                <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">Only Register</span>
              </label>
              </div>
              {/* Button bar: Go (Search) → Export (same as Tax By Store) */}
              <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm ml-auto overflow-visible">
                <button
                  onClick={handleGo}
                  type="button"
                  className="h-10 px-5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors flex items-center gap-2 border-0 border-r border-gray-200 dark:border-gray-600 rounded-none"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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

      <div className="flex-1 overflow-auto p-6 space-y-6 flex flex-col min-h-0">
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex-1 min-h-[320px] flex flex-col" ref={gridContainerRef}>
          <div className="flex-1 min-h-0">
            <ServerGrid
              key={gridKey}
              hideDefaultContextMenuItems={true}
              columns={columns}
              apiUrl={API_ENDPOINTS.REPORTS.SALES_SUMMARY_BY_TRANSACTION}
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
              containerWidth="100%"
              gridId="sales-summary-by-transaction"
              emptyMessage="No data for the selected criteria. Use filters and click Search to load data."
              getRowId={(row) => `${(row as SalesSummaryByTransactionRow)?.no ?? ""}-${(row as SalesSummaryByTransactionRow)?.date ?? ""}-${(row as SalesSummaryByTransactionRow)?.storeName ?? ""}`}
              onRowDoubleClick={(row) => {
                // Desktop parity: double-click drills into RepEntryProfit, scoped to the
                // transaction by GUID. SalesProfitView exposes TransactionID and the backend
                // forwards it on each row as transactionId (camelCased by Newtonsoft).
                const r = row as any
                const transactionId = String(
                  r?.transactionId ?? r?.TransactionId ?? r?.transactionID ?? r?.TransactionID ?? ""
                ).trim()
                if (!transactionId) return
                const transactionNo = String(r?.no ?? r?.No ?? "").trim()
                const customerName = String(r?.customerName ?? r?.CustomerName ?? "").trim()
                const rowStoreName = String(r?.storeName ?? r?.StoreName ?? "").trim()
                const effStoreName = rowStoreName || appliedStoreName || ""

                openTab({
                  id: `sales-summary-by-transaction-details-${transactionId}`,
                  title: transactionNo ? `Sales Profit [${transactionNo}]` : "Sales Profit Details",
                  component: "SalesSummaryByTransactionDetailsPage",
                  props: {
                    transactionId,
                    transactionNo: transactionNo || undefined,
                    customerName: customerName || undefined,
                    storeName: effStoreName || undefined,
                  },
                  closable: true,
                })
              }}
            />
          </div>
        </div>
      </div>
      </div>
    </div>

      <ExportModal {...exportModal.modalProps} />
    </>
  )
}

export default SalesSummaryByTransactionReportPage
