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
import SearchableSelect, { SelectOption } from "../../components/form/SearchableSelect"
import ExportModal from "../../components/common/ExportModal"
import { useReportExportModal } from "../../hooks/useReportExportModal"

interface ActionSummaryReportProps {
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

interface ActionSummaryRow {
  storeId?: string
  storeName: string
  actionDate: string
  action: string
  times: number
  cashier: string
  batchNumber: string
  // IDs needed for drill-down to Action Details
  batchId?: string
  cashierId?: string
  actionType?: number
}

// Column configuration – summary of POS actions
const ACTION_SUMMARY_COLUMN_CONFIG = [
  { field: "actionDate", headerName: "Date", ratio: 0.16, minWidth: 130 },
  { field: "action", headerName: "Action", ratio: 0.24, minWidth: 160 },
  { field: "times", headerName: "Times", ratio: 0.12, minWidth: 90 },
  { field: "cashier", headerName: "Cashier", ratio: 0.18, minWidth: 130 },
  { field: "batchNumber", headerName: "Batch No.", ratio: 0.14, minWidth: 110 },
  { field: "storeName", headerName: "Store", ratio: 0.16, minWidth: 130 },
] as const

const ACTION_SUMMARY_SCREEN_CODE = "reports.action_summary"

const ActionSummaryReportPage: React.FC<ActionSummaryReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { canExport } = usePermission(ACTION_SUMMARY_SCREEN_CODE)
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
  // When opened from Report Manager with "All Stores", filters.storeId is "" — do not set default store
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
  const [totalTimes, setTotalTimes] = useState(0)
  const [error] = useState<string | null>(null)

  // Desktop-parity dropdown filters: Batch / Register / Cashier / Approve By.
  // Each has a "screen" value (what the user is editing) and an "applied" value
  // (what's actually in the request). The grid only refetches when applied changes.
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
  const [cashierOptions, setCashierOptions] = useState<SelectOption[]>([{ value: "", label: "All cashiers" }])
  const [approveByOptions, setApproveByOptions] = useState<SelectOption[]>([{ value: "", label: "All users" }])

  const [gridKey, setGridKey] = useState(0)
  const gridDataRef = useRef<ActionSummaryRow[]>([])
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

  const columns: Column[] = useMemo(() => {
    const total = gridContainerWidth
    return ACTION_SUMMARY_COLUMN_CONFIG.map((cfg) => {
      const width = Math.max(cfg.minWidth, Math.floor(total * cfg.ratio))
      const col: Column = {
        field: cfg.field,
        headerName: cfg.headerName,
        width,
        sortable: true,
        filterable: true,
        dataType: cfg.field === "times" ? "number" : "string",
      }
      return col
    })
  }, [gridContainerWidth])

  // Build the filter payload sent on every paginated request. Only changes when the user
  // applies a new search — page navigation reuses this and just varies startRow/endRow.
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
    if (appliedBatchId) params.batchId = appliedBatchId
    if (appliedRegisterId) params.registerId = appliedRegisterId
    if (appliedCashierId) params.cashierId = appliedCashierId
    if (appliedApproveById) params.approveById = appliedApproveById
    return params
  }, [appliedDateFrom, appliedDateTo, appliedStoreId, filters?.storeId, appliedBatchId, appliedRegisterId, appliedCashierId, appliedApproveById])

  const handleResponseLoaded = useCallback((responseData: Record<string, unknown>) => {
    const r = responseData as Record<string, unknown>
    setTotalTimes(Number(r?.totalTimes ?? r?.TotalTimes ?? 0))

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
    if (Array.isArray(rawCashOpts) && rawCashOpts.length > 0) setCashierOptions(toLookupOptions(rawCashOpts, "All cashiers"))
    if (Array.isArray(rawApvOpts) && rawApvOpts.length > 0) setApproveByOptions(toLookupOptions(rawApvOpts, "All users"))
  }, [])

  const handleGridDataChange = useCallback((data: any[]) => {
    gridDataRef.current = data as ActionSummaryRow[]
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

  // Fetch every row for export/print, ignoring pagination by asking for a huge page.
  const fetchAllData = useCallback(
    async (overrideFrom?: string, overrideTo?: string): Promise<any[]> => {
      try {
        const headers = getAuthHeaders()
        const body: Record<string, unknown> = {
          fromDate: overrideFrom || appliedDateFrom,
          toDate: overrideTo || appliedDateTo,
          startRow: 0,
          endRow: 1000000,
        }
        const storeIdToUse = appliedStoreId ?? filters?.storeId
        const validStoreId =
          typeof storeIdToUse === "string" &&
          storeIdToUse.trim().length > 0 &&
          /^[0-9a-f-]{36}$/i.test(storeIdToUse.trim())
        if (validStoreId) body.storeId = storeIdToUse!.trim()
        if (appliedBatchId) body.batchId = appliedBatchId
        if (appliedRegisterId) body.registerId = appliedRegisterId
        if (appliedCashierId) body.cashierId = appliedCashierId
        if (appliedApproveById) body.approveById = appliedApproveById

        const response = await axios.post(API_ENDPOINTS.REPORTS.ACTION_SUMMARY, body, { headers })
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess
        if (!ok) return []
        const res = response.data?.response ?? response.data?.Response ?? {}
        const dataRaw = res?.data ?? res?.Data ?? []
        return Array.isArray(dataRaw)
          ? dataRaw.map((r: any) => ({
              storeId: String(r?.storeId ?? r?.StoreId ?? r?.storeID ?? r?.StoreID ?? ""),
              storeName: r?.storeName ?? r?.StoreName ?? "",
              actionDate: r?.actionDate ?? r?.ActionDate ?? "",
              action: r?.action ?? r?.Action ?? "",
              times: Number(r?.times ?? r?.Times ?? 0),
              cashier: r?.cashier ?? r?.Cashier ?? "",
              batchNumber: r?.batchNumber ?? r?.BatchNumber ?? "",
            }))
          : []
      } catch (error) {
        console.error("Failed to fetch Action Summary for export:", error)
        return []
      }
    },
    [getAuthHeaders, appliedDateFrom, appliedDateTo, appliedStoreId, filters?.storeId, appliedBatchId, appliedRegisterId, appliedCashierId, appliedApproveById]
  )

  const exportModal = useReportExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "action-summary-report",
    title: "Action Summary Report",
    subtitle: `${appliedStoreName || "All Stores"} | ${new Date(appliedDateFrom).toLocaleDateString()} - ${new Date(appliedDateTo).toLocaleDateString()}`,
    dateField: "actionDate",
    defaultDateFrom: appliedDateFrom,
    defaultDateTo: appliedDateTo,
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Action Summary</h1>
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
            {totalTimes > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>Total Actions: {totalTimes.toLocaleString()}</span>
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
                  options={cashierOptions}
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
            key={gridKey}
            hideDefaultContextMenuItems={true}
            columns={columns}
            apiUrl={API_ENDPOINTS.REPORTS.ACTION_SUMMARY}
            serverSide={true}
            methodType="POST"
            getAuthHeaders={getAuthHeaders}
            additionalParams={additionalParams}
            pagination={true}
            pageSize={100}
            columnChooser={true}
            title="Action Summary"
            setTotalRecords={setTotalRecords}
            onResponseLoaded={handleResponseLoaded}
            onDataChange={handleGridDataChange}
            defaultSortColumn="actionDate"
            defaultSortDirection="desc"
            emptyMessage="No data for the selected criteria"
            defaultGroupByColumns={[{ field: "storeName", headerName: "Store" }]}
            defaultGroupsExpanded={true}
            containerWidth="100%"
            gridId="action-summary-report"
            getRowId={(row) =>
              `${(row as any)?.storeName ?? ""}-${(row as any)?.actionDate ?? ""}-${(row as any)?.action ?? ""}-${(row as any)?.cashier ?? ""}-${(row as any)?.batchNumber ?? ""}`
            }
            onRowDoubleClick={(row) => {
              // Desktop parity: double-click drills into Action Details, scoped to the
              // batch + cashier + action type of the clicked summary row, on its action date.
              const r = row as any
              const batchId = String(r?.batchId ?? r?.BatchId ?? r?.batchID ?? r?.BatchID ?? "").trim()
              const cashierId = String(r?.cashierId ?? r?.CashierId ?? r?.cashierID ?? r?.CashierID ?? "").trim()
              const actionTypeRaw = r?.actionType ?? r?.ActionType
              const actionType = typeof actionTypeRaw === "number" ? actionTypeRaw : (actionTypeRaw != null ? Number(actionTypeRaw) : undefined)
              const rowStoreId = String(r?.storeId ?? r?.StoreId ?? r?.storeID ?? r?.StoreID ?? "").trim()
              const actionLabel = String(r?.action ?? r?.Action ?? "").trim()
              const actionDateStr = String(r?.actionDate ?? r?.ActionDate ?? "").trim()
              // Parse the SP's date string (CONVERT style 111 = yyyy/mm/dd) without going
              // through Date.toISOString — that converts to UTC and pulls the day backwards
              // for any timezone west of UTC, which is exactly the bug that surfaced on
              // double-click (web showed Jan 14 for a desktop row of Jan 15).
              let dayFrom = appliedDateFrom
              let dayTo = appliedDateTo
              if (actionDateStr) {
                const m = actionDateStr.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/)
                if (m) {
                  const iso = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
                  dayFrom = iso
                  dayTo = iso
                }
              }
              const effStoreId = rowStoreId || appliedStoreId || ""
              const effStoreName = effStoreId
                ? (stores.find((s) => s.id === effStoreId)?.name ?? appliedStoreName ?? "Selected Store")
                : "All Stores"

              const tabKey = `action-details-${batchId || "nobatch"}-${cashierId || "nocash"}-${actionType ?? "noatype"}-${dayFrom}-${dayTo}-${effStoreId || "all"}`
              openTab({
                id: tabKey,
                title: actionLabel ? `Action Details [${actionLabel}]` : "Action Details",
                component: "ActionDetailsReportPage",
                props: {
                  filters: {
                    dateFrom: dayFrom,
                    dateTo: dayTo,
                    storeId: effStoreId,
                    storeName: effStoreName,
                    batchId: batchId || undefined,
                    cashierId: cashierId || undefined,
                    actionType,
                    actionLabel: actionLabel || undefined,
                    drillDown: true,
                  },
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

export default ActionSummaryReportPage

