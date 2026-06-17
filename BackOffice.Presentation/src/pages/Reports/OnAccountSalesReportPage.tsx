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

interface OnAccountSalesReportProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    storeId?: string
    storeName?: string
    customerId?: string
  }
}

interface StoreOption {
  id: string
  name: string
  code?: string
}

interface OnAccountSalesRow {
  storeId?: string
  storeName: string
  customerId?: string
  customerNo: string
  lastName: string
  firstName: string
  address: string
  phone: string
  name: string
  transactionNo: string
  saleTime?: string | null
  userName: string
  sale: number
  amountPayments: number
  amountSales: number
  balanceDoe: number
}

const currency = (v: unknown) =>
  v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Column config: ratio of total width (for responsive layout when group-by is used) and min width in px.
// Matches the desktop RepAcountReceivableSales grid (Sales / Payments / Balance columns side-by-side).
const ON_ACCOUNT_SALES_COLUMN_CONFIG = [
  { field: "storeName", headerName: "Store", ratio: 0.10, minWidth: 80 },
  { field: "customerNo", headerName: "Customer No.", ratio: 0.11, minWidth: 100 },
  { field: "lastName", headerName: "Last Name", ratio: 0.13, minWidth: 100 },
  { field: "address", headerName: "Address", ratio: 0.18, minWidth: 120 },
  { field: "firstName", headerName: "First Name", ratio: 0.10, minWidth: 90 },
  { field: "phone", headerName: "Phone", ratio: 0.10, minWidth: 100 },
  { field: "amountSales", headerName: "Amount Sales", ratio: 0.10, minWidth: 100 },
  { field: "amountPayments", headerName: "Amount Payments", ratio: 0.10, minWidth: 100 },
  { field: "balanceDoe", headerName: "Balance", ratio: 0.08, minWidth: 90 },
] as const

const ON_ACCOUNT_SALES_SCREEN_CODE = "reports.on_account_sales"

const OnAccountSalesReportPage: React.FC<OnAccountSalesReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { canExport } = usePermission(ON_ACCOUNT_SALES_SCREEN_CODE)
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
  const [screenStoreId, setScreenStoreId] = useState<string>(
    filters !== undefined ? (filters.storeId ?? "") : (currentStore?.storeId ?? "")
  )
  const [screenStoreName, setScreenStoreName] = useState<string>(
    filters?.storeName?.trim() || currentStore?.storeName || ""
  )
  const [appliedStoreId, setAppliedStoreId] = useState<string>(
    filters !== undefined ? (filters.storeId ?? "") : (currentStore?.storeId ?? "")
  )
  const [appliedStoreName, setAppliedStoreName] = useState<string>(() => {
    const id = filters !== undefined ? filters.storeId?.trim() : currentStore?.storeId
    return id ? (filters?.storeName?.trim() || currentStore?.storeName || "Selected Store") : "All Stores"
  })

  const [rows, setRows] = useState<OnAccountSalesRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalSale, setTotalSale] = useState(0)
  const [totalPayments, setTotalPayments] = useState(0)
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
    } catch { /* ignore */ }
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

  // Keep date range and filters in sync with Report Manager
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
    if (filters.dateFrom || filters.dateTo || filters.storeId || filters.customerId) {
      setRunSearchAfterFilters(true)
    }
  }, [filters?.dateFrom, filters?.dateTo, filters?.storeId, filters?.storeName, filters?.customerId])

  const storeSelectOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "All Stores" },
      ...stores.map((s) => ({ value: s.id, label: s.name })),
    ],
    [stores]
  )

  const columns: Column[] = useMemo(() => {
    const total = gridContainerWidth
    const numericFields = new Set(["amountSales", "amountPayments", "balanceDoe"])
    return ON_ACCOUNT_SALES_COLUMN_CONFIG.map((cfg) => {
      const width = Math.max(cfg.minWidth, Math.floor(total * cfg.ratio))
      const isNumeric = numericFields.has(cfg.field)
      const col: Column = {
        field: cfg.field,
        headerName: cfg.headerName,
        width,
        sortable: true,
        filterable: !isNumeric,
        // Store column is the row-group key now — keep it on the column list (for the
        // column-chooser) but hide it by default since its value already appears in the
        // "Store Name:" group header above each block of rows.
        visible: cfg.field !== "storeName",
        dataType: isNumeric ? "number" : "string",
      }
      if (isNumeric) {
        ;(col as Column & { cellRenderer?: (v: number) => string }).cellRenderer = (value: number) => currency(value)
      }
      return col
    })
  }, [gridContainerWidth])

  // Drill-down: open a tab with per-transaction rows for the selected customer.
  // Desktop equivalent: RepAcountReceivableSales -> ClickOnRow -> FrmLiveReport.
  //
  // Store scope:
  //   - Row HAS a resolved storeId  -> drill-down narrows to that store (per-store filter).
  //   - Row HAS NO storeId (orphan transaction whose StoreID doesn't resolve to a Store row,
  //     or null-store batches) -> drill-down passes NO store filter so the customer's rows
  //     are still visible. The desktop's RepAcountReceivable SP gets called WITHOUT a
  //     @StoreID parameter (Queries.vb sets _dbGate.StoreID on a side channel that the SP
  //     ignores), so the desktop always returns ALL stores' rows for the customer — that's
  //     why a transaction with an orphan StoreID still appears under "TOYS 4 YOU" on the
  //     desktop. Falling back to the parent's appliedStoreId here would hide those rows.
  const openDetailsTab = useCallback(
    (row: any) => {
      const customerId = String(row?.customerId ?? "").trim()
      const customerNo = String(row?.customerNo ?? "").trim()
      if (!customerId && !customerNo) return
      const lastName = String(row?.lastName ?? "").trim()
      const firstName = String(row?.firstName ?? "").trim()
      const customerName = [lastName, firstName].filter(Boolean).join(", ") || customerNo
      const rowStoreId = String(row?.storeId ?? "").trim()
      const rowStoreName = String(row?.storeName ?? "").trim()
      // Use the row's own store only. Empty = no store filter (orphan/null-store rows).
      const drillStoreId = rowStoreId
      const drillStoreName = rowStoreName || "All Stores"
      const tabKey = `on-account-sales-details-${appliedDateFrom}-${appliedDateTo}-${drillStoreId || "any"}-${customerId || customerNo}`
      openTab({
        id: tabKey,
        title: `Account Receivable Sales For ${customerName || customerNo}`,
        component: "OnAccountSalesDetailsPage",
        props: {
          fromDate: appliedDateFrom,
          toDate: appliedDateTo,
          storeId: drillStoreId,
          storeName: drillStoreName,
          customerId,
          customerNo,
          customerName,
          mode: "sales",
        },
        closable: true,
      })
    },
    [openTab, appliedDateFrom, appliedDateTo]
  )

  const rowContextMenuItems = useMemo(
    () => [
      {
        label: "View Sales Details",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
        onClick: (row: any) => openDetailsTab(row),
      },
    ],
    [openDetailsTab]
  )

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
        }
        // When overrides is provided (Search button) the screen value is the source of
        // truth — empty string means "All Stores" and should NOT fall back to the
        // previously-applied storeId. Otherwise (initial load / report-manager sync)
        // keep the existing applied/filters fallback chain.
        const storeIdToUse = overrides !== undefined
          ? (overrides.storeId ?? "")
          : (appliedStoreId ?? filters?.storeId ?? "")
        if (storeIdToUse) body.storeId = storeIdToUse
        if (filters?.customerId) body.customerId = filters.customerId

        const response = await axios.post(API_ENDPOINTS.REPORTS.ON_ACCOUNT_SALES, body, { headers })
      const ok = response.data?.isSuccess ?? response.data?.IsSuccess

      if (!ok) {
        const message = response.data?.message || response.data?.Message || "Failed to load On Account Sales report"
        setError(message)
        setRows([])
        setTotalRecords(0)
        setTotalSale(0)
        setTotalPayments(0)
        setTotalBalance(0)
        return
      }

      const res = response.data?.response ?? response.data?.Response ?? {}
      const dataRaw = res?.data ?? res?.Data ?? []
      const list: OnAccountSalesRow[] = Array.isArray(dataRaw)
        ? dataRaw.map((r: any) => ({
            storeId: r?.storeId ?? r?.StoreId ?? "",
            storeName: r?.storeName ?? r?.StoreName ?? "",
            customerId: String(r?.customerId ?? r?.CustomerId ?? r?.customerID ?? r?.CustomerID ?? ""),
            customerNo: r?.customerNo ?? r?.CustomerNo ?? "",
            lastName: r?.lastName ?? r?.LastName ?? "",
            firstName: r?.firstName ?? r?.FirstName ?? "",
            address: r?.address ?? r?.Address ?? "",
            phone: r?.phone ?? r?.Phone ?? "",
            name: r?.name ?? r?.Name ?? "",
            transactionNo: r?.transactionNo ?? r?.TransactionNo ?? "",
            saleTime: r?.saleTime ?? r?.SaleTime ?? null,
            userName: r?.userName ?? r?.UserName ?? "",
            sale: Number(r?.sale ?? r?.Sale ?? 0),
            amountPayments: Number(r?.amountPayments ?? r?.AmountPayments ?? 0),
            amountSales: Number(r?.amountSales ?? r?.AmountSales ?? 0),
            balanceDoe: Number(r?.balanceDoe ?? r?.BalanceDoe ?? 0),
          }))
        : []

      setRows(list)
      setTotalRecords(res?.totalRecords ?? res?.TotalRecords ?? list.length)
      setTotalSale(Number(res?.totalSale ?? res?.TotalSale ?? list.reduce((s, r) => s + (r.sale || 0), 0)))
      setTotalPayments(
        Number(res?.totalPayments ?? res?.TotalPayments ?? list.reduce((s, r) => s + (r.amountPayments || 0), 0))
      )
      setTotalBalance(
        Number(res?.totalBalance ?? res?.TotalBalance ?? list.reduce((s, r) => s + (r.balanceDoe || 0), 0))
      )
      if (overrides) {
        setAppliedDateFrom(from)
        setAppliedDateTo(to)
        // Always sync applied store from overrides — empty string is meaningful here
        // ("All Stores" was selected). The previous `!== undefined` guard skipped this
        // branch when handleSearch coerced "" to undefined, leaving the stale ID applied.
        const nextStoreId = overrides.storeId ?? ""
        setAppliedStoreId(nextStoreId)
        setAppliedStoreName(
          nextStoreId ? stores.find((s) => s.id === nextStoreId)?.name ?? "Selected Store" : "All Stores"
        )
      }
    } catch (e: any) {
      console.error("Error loading On Account Sales report", e)
      setError(e?.message || "Failed to load On Account Sales report")
    } finally {
      setLoading(false)
    }
  },
    [appliedDateFrom, appliedDateTo, appliedStoreId, filters?.storeId, filters?.customerId, getAuthHeaders, stores]
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
    // Pass screenStoreId verbatim — empty string means "All Stores" and must reach
    // fetchData so it can clear the previous store filter. Coercing "" to undefined
    // here is exactly what caused the stale storeId to ride along on the next request.
    fetchData({ dateFrom, dateTo, storeId: screenStoreId })
  }, [dateFrom, dateTo, screenStoreId, fetchData])

  const fetchAllData = useCallback(
    async (overrideFrom?: string, overrideTo?: string): Promise<any[]> => {
      try {
        const headers = getAuthHeaders()
        const body: Record<string, unknown> = {
          fromDate: overrideFrom || appliedDateFrom,
          toDate: overrideTo || appliedDateTo,
        }
        const storeIdToUse = appliedStoreId ?? filters?.storeId
        if (storeIdToUse) body.storeId = storeIdToUse
        if (filters?.customerId) body.customerId = filters.customerId

        const response = await axios.post(API_ENDPOINTS.REPORTS.ON_ACCOUNT_SALES, body, { headers })
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess
        if (!ok) return []
        const res = response.data?.response ?? response.data?.Response ?? {}
        const dataRaw = res?.data ?? res?.Data ?? []
        return Array.isArray(dataRaw)
          ? dataRaw.map((r: any) => ({
              storeId: r?.storeId ?? r?.StoreId ?? "",
              storeName: r?.storeName ?? r?.StoreName ?? "",
              customerId: String(r?.customerId ?? r?.CustomerId ?? r?.customerID ?? r?.CustomerID ?? ""),
              customerNo: r?.customerNo ?? r?.CustomerNo ?? "",
              lastName: r?.lastName ?? r?.LastName ?? "",
              firstName: r?.firstName ?? r?.FirstName ?? "",
              address: r?.address ?? r?.Address ?? "",
              phone: r?.phone ?? r?.Phone ?? "",
              name: r?.name ?? r?.Name ?? "",
              transactionNo: r?.transactionNo ?? r?.TransactionNo ?? "",
              saleTime: r?.saleTime ?? r?.SaleTime ?? null,
              userName: r?.userName ?? r?.UserName ?? "",
              sale: Number(r?.sale ?? r?.Sale ?? 0),
              amountPayments: Number(r?.amountPayments ?? r?.AmountPayments ?? 0),
              amountSales: Number(r?.amountSales ?? r?.AmountSales ?? 0),
              balanceDoe: Number(r?.balanceDoe ?? r?.BalanceDoe ?? 0),
            }))
          : []
      } catch (error) {
        console.error("Failed to fetch On Account Sales for export:", error)
        return []
      }
    },
    [getAuthHeaders, appliedDateFrom, appliedDateTo, appliedStoreId, filters?.storeId, filters?.customerId]
  )

  const exportModal = useReportExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "on-account-sales-report",
    title: "On Account Sales Report",
    subtitle: `${appliedStoreName || "All Stores"} | ${new Date(appliedDateFrom).toLocaleDateString()} - ${new Date(appliedDateTo).toLocaleDateString()}`,
    dateField: "saleTime",
    defaultDateFrom: appliedDateFrom,
    defaultDateTo: appliedDateTo,
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">On Account Sales</h1>
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
            {/* Button sequence: Search → Export */}
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
                <div className="relative">
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
            customContextMenuItems={rowContextMenuItems}
            data={rows}
            columns={columns}
            loading={loading}
            error={error}
            pagination={true}
            pageSize={100}
            columnChooser={true}
            title="On Account Sales"
            totalRecords={totalRecords}
            emptyMessage="No data for the selected criteria"
            getRowId={(row) =>
              // Per-(Store, Customer) row id — must include storeName since the same
              // customer can now appear under multiple "Store Name:" group headers.
              `${(row as any)?.storeName ?? ""}-${(row as any)?.storeId ?? ""}-${(row as any)?.customerNo ?? ""}-${(row as any)?.customerId ?? ""}`
            }
            defaultGroupByColumns={[{ field: "storeName", headerName: "Store Name" }]}
            defaultGroupsExpanded={true}
            onRowDoubleClick={(row) => openDetailsTab(row)}
          />
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default OnAccountSalesReportPage

