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

interface DailyHourSalesReportProps {
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

interface DailyHourSalesRow {
  storeName: string
  weekDay: string
  hour: string
  debit: number
  credit: number
  balance: number
  countTransaction: number
  registers: number
  salePrec: number
  customers: number
  transactionWithCustomer: number
  customerPrec: number
  customerDebit: number
  items: number
}

const currency = (v: unknown) =>
  v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const percent = (v: unknown) =>
  v == null ? "0.00%" : `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`

// Column configuration – match desktop Daily Hour Sales columns and labels
const DAILY_HOUR_SALES_COLUMN_CONFIG = [
  { field: "hour", headerName: "Hour", ratio: 0.11, minWidth: 120 },
  { field: "debit", headerName: "Debit", ratio: 0.08, minWidth: 90, type: "currency" },
  { field: "credit", headerName: "Credit", ratio: 0.08, minWidth: 90, type: "currency" },
  { field: "balance", headerName: "Balance", ratio: 0.08, minWidth: 90, type: "currency" },
  { field: "countTransaction", headerName: "No. of transactions", ratio: 0.1, minWidth: 130 },
  { field: "registers", headerName: "No. of Registers", ratio: 0.09, minWidth: 120 },
  { field: "customers", headerName: "No. of Customers", ratio: 0.09, minWidth: 130 },
  { field: "salePrec", headerName: "Daily Sales %", ratio: 0.08, minWidth: 110, type: "percent" },
  { field: "customerPrec", headerName: "Customer %", ratio: 0.08, minWidth: 100, type: "percent" },
  { field: "customerDebit", headerName: "Customer $", ratio: 0.08, minWidth: 110, type: "currency" },
  { field: "items", headerName: "No. of Items", ratio: 0.08, minWidth: 110 },
  { field: "transactionWithCustomer", headerName: "Customer Track", ratio: 0.08, minWidth: 120 },
  { field: "weekDay", headerName: "Weekday", ratio: 0.07, minWidth: 100 },
  { field: "storeName", headerName: "Store", ratio: 0.08, minWidth: 110 },
] as const

const DAILY_HOUR_SALES_SCREEN_CODE = "reports.daily_hour_sales"

const DailyHourSalesReportPage: React.FC<DailyHourSalesReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { canExport } = usePermission(DAILY_HOUR_SALES_SCREEN_CODE)
  const { openTab } = useDashboardTabs()

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
  const [screenStoreId, setScreenStoreId] = useState<string>(filters !== undefined ? (filters.storeId ?? "") : (currentStore?.storeId ?? ""))
  const [screenStoreName, setScreenStoreName] = useState<string>(
    filters?.storeName?.trim() || currentStore?.storeName || ""
  )
  const [appliedStoreId, setAppliedStoreId] = useState<string>(filters !== undefined ? (filters.storeId ?? "") : (currentStore?.storeId ?? ""))
  const [appliedStoreName, setAppliedStoreName] = useState<string>(() => {
    const id = filters !== undefined ? filters.storeId?.trim() : currentStore?.storeId
    return id ? (filters?.storeName?.trim() || currentStore?.storeName || "Selected Store") : "All Stores"
  })

  const [rows, setRows] = useState<DailyHourSalesRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalDebit, setTotalDebit] = useState(0)
  const [totalCredit, setTotalCredit] = useState(0)
  const [totalBalance, setTotalBalance] = useState(0)

  const [runSearchAfterFilters, setRunSearchAfterFilters] = useState(false)
  const gridContainerRef = useRef<HTMLDivElement | null>(null)
  const [gridContainerWidth, setGridContainerWidth] = useState(900)

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

  // Sync with Report Manager filters
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

  const columns: Column[] = useMemo(() => {
    const total = gridContainerWidth
    return DAILY_HOUR_SALES_COLUMN_CONFIG.map((cfg) => {
      const width = Math.max(cfg.minWidth, Math.floor(total * cfg.ratio))
      const col: Column = {
        field: cfg.field,
        headerName: cfg.headerName,
        width,
        sortable: true,
        filterable: true,
        dataType: ('type' in cfg && cfg.type === "currency") || ('type' in cfg && cfg.type === "percent") || typeof ({} as any)[cfg.field] === "number"
          ? "number"
          : "string",
      }
      if ('type' in cfg && cfg.type === "currency") {
        ;(col as Column & { cellRenderer?: (v: number) => string }).cellRenderer = (value: number) => currency(value)
      } else if ('type' in cfg && cfg.type === "percent") {
        ;(col as Column & { cellRenderer?: (v: number) => string }).cellRenderer = (value: number) => percent(value)
      }
      return col
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
        const body: Record<string, unknown> = {
          fromDate: from,
          toDate: to,
          reportType: null,
        }
        // When overrides is provided (Search button) the screen value is the source of truth —
        // empty string means "All Stores" and must NOT fall back to the previously-applied storeId.
        const storeIdToUse = overrides !== undefined
          ? (overrides.storeId ?? "")
          : (appliedStoreId ?? filters?.storeId ?? "")
        if (storeIdToUse) body.storeId = storeIdToUse

        const response = await axios.post(API_ENDPOINTS.REPORTS.DAILY_HOUR_SALES, body, { headers })
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess

        if (!ok) {
          const message =
            response.data?.message || response.data?.Message || "Failed to load Daily Hour Sales report"
          setError(message)
          setRows([])
          setTotalRecords(0)
          setTotalDebit(0)
          setTotalCredit(0)
          setTotalBalance(0)
          return
        }

        const res = response.data?.response ?? response.data?.Response ?? {}
        const dataRaw = res?.data ?? res?.Data ?? []
        const list: DailyHourSalesRow[] = Array.isArray(dataRaw)
          ? dataRaw.map((r: any) => ({
              storeName: r?.storeName ?? r?.StoreName ?? "",
              weekDay: r?.weekDay ?? r?.WeekDay ?? "",
              hour: r?.hour ?? r?.Hour ?? "",
              debit: Number(r?.debit ?? r?.Debit ?? 0),
              credit: Number(r?.credit ?? r?.Credit ?? 0),
              balance: Number(r?.balance ?? r?.Balance ?? 0),
              countTransaction: Number(r?.countTransaction ?? r?.CountTransaction ?? 0),
              registers: Number(r?.registers ?? r?.Registers ?? 0),
              salePrec: Number(r?.salePrec ?? r?.SalePrec ?? 0),
              customers: Number(r?.customers ?? r?.Customers ?? 0),
              transactionWithCustomer: Number(
                r?.transactionWithCustomer ?? r?.TransactionWithCustomer ?? 0
              ),
              customerPrec: Number(r?.customerPrec ?? r?.CustomerPrec ?? 0),
              customerDebit: Number(r?.customerDebit ?? r?.CustomerDebit ?? 0),
              items: Number(r?.items ?? r?.Items ?? 0),
            }))
          : []

        setRows(list)
        setTotalRecords(res?.totalRecords ?? res?.TotalRecords ?? list.length)
        setTotalDebit(
          Number(res?.totalDebit ?? res?.TotalDebit ?? list.reduce((sum, row) => sum + (row.debit || 0), 0))
        )
        setTotalCredit(
          Number(res?.totalCredit ?? res?.TotalCredit ?? list.reduce((sum, row) => sum + (row.credit || 0), 0))
        )
        setTotalBalance(
          Number(res?.totalBalance ?? res?.TotalBalance ?? list.reduce((sum, row) => sum + (row.balance || 0), 0))
        )
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
        console.error("Error loading Daily Hour Sales report", e)
        setError(e?.message || "Failed to load Daily Hour Sales report")
      } finally {
        setLoading(false)
      }
    },
    [appliedDateFrom, appliedDateTo, appliedStoreId, filters?.storeId, getAuthHeaders, stores]
  )

  useEffect(() => {
    if (!runSearchAfterFilters) return
    setRunSearchAfterFilters(false)
    fetchData()
  }, [runSearchAfterFilters, fetchData])

  useEffect(() => {
    // Initial load if opened directly
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

  // Fetch all rows for the export modal, scoped to an optional override date range.
  const fetchAllData = useCallback(
    async (overrideFrom?: string, overrideTo?: string): Promise<any[]> => {
      try {
        const headers = getAuthHeaders()
        const body: Record<string, unknown> = {
          fromDate: overrideFrom || appliedDateFrom,
          toDate: overrideTo || appliedDateTo,
          reportType: null,
        }
        const storeIdToUse = appliedStoreId ?? filters?.storeId
        if (storeIdToUse) body.storeId = storeIdToUse

        const response = await axios.post(API_ENDPOINTS.REPORTS.DAILY_HOUR_SALES, body, { headers })
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess
        if (!ok) return []
        const res = response.data?.response ?? response.data?.Response ?? {}
        const dataRaw = res?.data ?? res?.Data ?? []
        return Array.isArray(dataRaw)
          ? dataRaw.map((r: any) => ({
              storeName: r?.storeName ?? r?.StoreName ?? "",
              weekDay: r?.weekDay ?? r?.WeekDay ?? "",
              hour: r?.hour ?? r?.Hour ?? "",
              debit: Number(r?.debit ?? r?.Debit ?? 0),
              credit: Number(r?.credit ?? r?.Credit ?? 0),
              balance: Number(r?.balance ?? r?.Balance ?? 0),
              countTransaction: Number(r?.countTransaction ?? r?.CountTransaction ?? 0),
              registers: Number(r?.registers ?? r?.Registers ?? 0),
              salePrec: Number(r?.salePrec ?? r?.SalePrec ?? 0),
              customers: Number(r?.customers ?? r?.Customers ?? 0),
              transactionWithCustomer: Number(r?.transactionWithCustomer ?? r?.TransactionWithCustomer ?? 0),
              customerPrec: Number(r?.customerPrec ?? r?.CustomerPrec ?? 0),
              customerDebit: Number(r?.customerDebit ?? r?.CustomerDebit ?? 0),
              items: Number(r?.items ?? r?.Items ?? 0),
            }))
          : []
      } catch (error) {
        console.error("Failed to fetch Daily Hour Sales for export:", error)
        return []
      }
    },
    [getAuthHeaders, appliedDateFrom, appliedDateTo, appliedStoreId, filters?.storeId]
  )

  const exportModal = useReportExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "daily-hour-sales-report",
    title: "Daily Hour Sales Report",
    subtitle: `${appliedStoreName || "All Stores"} | ${new Date(appliedDateFrom).toLocaleDateString()} - ${new Date(appliedDateTo).toLocaleDateString()}`,
    dateField: "hour",
    defaultDateFrom: appliedDateFrom,
    defaultDateTo: appliedDateTo,
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Daily Hour Sales</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{displayStoreName}</span>
            {appliedDateFrom && appliedDateTo && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>
                  {new Date(appliedDateFrom).toLocaleDateString()} –{" "}
                  {new Date(appliedDateTo).toLocaleDateString()}
                </span>
              </>
            )}
            {totalRecords > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{totalRecords.toLocaleString()} records</span>
              </>
            )}
            {(totalDebit !== 0 || totalCredit !== 0 || totalBalance !== 0) && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>Totals: Debit {currency(totalDebit)}, Credit {currency(totalCredit)}, Balance {currency(totalBalance)}</span>
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
            </div>

            {/* Buttons: Search → Export */}
            <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm ml-auto overflow-visible">
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
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col" ref={gridContainerRef}>
          <ServerGrid
            hideDefaultContextMenuItems={true}
            data={rows}
            columns={columns}
            loading={loading}
            error={error}
            pagination={true}
            pageSize={100}
            columnChooser={true}
            title="Daily Hour Sales"
            totalRecords={totalRecords}
            emptyMessage="No data for the selected criteria"
            getRowId={(row) =>
              `${(row as any)?.storeName ?? ""}-${(row as any)?.weekDay ?? ""}-${(row as any)?.hour ?? ""}`
            }
            defaultGroupByColumns={[{ field: "storeName", headerName: "Store" }, { field: "weekDay", headerName: "Weekday" }]}
            defaultGroupsExpanded={true}
            onRowDoubleClick={(row) => {
              // Desktop parity: row double-click drills into the per-hour transaction list.
              // The backend takes hourStart (DateTime) + storeId and builds the [+1h) window.
              const r = row as any
              const orderColRaw = r?.orderCol ?? r?.OrderCol
              const rowStoreId = String(r?.storeId ?? r?.StoreId ?? r?.storeID ?? r?.StoreID ?? "").trim()
              if (!orderColRaw) return // can't drill in without the bucket start

              const hourStart = typeof orderColRaw === "string" ? orderColRaw : new Date(orderColRaw).toISOString()
              const hourLabel = String(r?.hour ?? r?.Hour ?? "").trim()
              const effStoreId = rowStoreId || appliedStoreId || ""
              const effStoreName = effStoreId
                ? (stores.find((s) => s.id === effStoreId)?.name ?? appliedStoreName ?? "Selected Store")
                : "All Stores"

              const tabKey = `daily-hour-sales-details-${hourStart}-${effStoreId || "all"}`
              openTab({
                id: tabKey,
                title: hourLabel ? `Daily Hour Sales [${hourLabel}]` : "Daily Hour Sales Details",
                component: "DailyHourSalesDetailsPage",
                props: {
                  hourStart,
                  storeId: effStoreId || undefined,
                  storeName: effStoreName,
                  hourLabel,
                },
                closable: true,
              })
            }}
          />
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default DailyHourSalesReportPage

