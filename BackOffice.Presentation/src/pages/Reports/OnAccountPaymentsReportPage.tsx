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

interface OnAccountPaymentsReportProps {
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

interface OnAccountPaymentsRow {
  storeId?: string
  storeName: string
  customerId?: string
  customerNo: string
  lastName: string
  firstName: string
  address: string
  phone: string
  name: string
  amount: number
}

const currency = (v: unknown) =>
  v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Column config: order and labels mirror the desktop "Account Receivable Payments"
// grid (Customer No. | Last Name | Address | First Name | Phone | Amount), grouped
// by Store Name. ratio = fraction of grid width when no group-by is active; minWidth
// = pixel floor.
const ON_ACCOUNT_PAYMENTS_COLUMN_CONFIG = [
  { field: "storeName", headerName: "Store", ratio: 0.10, minWidth: 80 },
  { field: "customerNo", headerName: "Customer No.", ratio: 0.14, minWidth: 110 },
  { field: "lastName", headerName: "Last Name", ratio: 0.18, minWidth: 110 },
  { field: "address", headerName: "Address", ratio: 0.22, minWidth: 140 },
  { field: "firstName", headerName: "First Name", ratio: 0.14, minWidth: 100 },
  { field: "phone", headerName: "Phone", ratio: 0.12, minWidth: 100 },
  { field: "amount", headerName: "Amount", ratio: 0.10, minWidth: 90 },
] as const

const ON_ACCOUNT_PAYMENTS_SCREEN_CODE = "reports.on_account_payments"

const OnAccountPaymentsReportPage: React.FC<OnAccountPaymentsReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { canExport } = usePermission(ON_ACCOUNT_PAYMENTS_SCREEN_CODE)
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

  const [totalRecords, setTotalRecords] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)

  const [gridKey, setGridKey] = useState(0)
  const gridDataRef = useRef<OnAccountPaymentsRow[]>([])
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
      setGridKey((k) => k + 1)
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
    return ON_ACCOUNT_PAYMENTS_COLUMN_CONFIG.map((cfg) => {
      const width = Math.max(cfg.minWidth, Math.floor(total * cfg.ratio))
      const col: Column = {
        field: cfg.field,
        headerName: cfg.headerName,
        width,
        sortable: true,
        filterable: cfg.field !== "amount",
        visible: cfg.field !== "storeName",
        dataType: cfg.field === "amount" ? "number" : "string",
      }
      if (cfg.field === "amount") {
        col.cellRenderer = (value: any) => currency(value)
      }
      return col
    })
  }, [gridContainerWidth])

  // Drill-down: open a tab with per-transaction payment rows for the selected customer.
  // Desktop equivalent: RepAcountReceivableSales (Payments mode) -> ClickOnRow -> FrmLiveReport.
  //
  // Store scope:
  //   - Row HAS a resolved storeId  -> drill-down narrows to that store.
  //   - Row HAS NO storeId (orphan transaction / null-store batch) -> drill-down passes NO
  //     store filter so the customer's rows are still visible (the desktop always returns
  //     all stores' rows for this report; falling back to the parent's appliedStoreId here
  //     would hide orphan-store transactions like the desktop never does).
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
      const tabKey = `on-account-payments-details-${appliedDateFrom}-${appliedDateTo}-${drillStoreId || "any"}-${customerId || customerNo}`
      openTab({
        id: tabKey,
        title: `Account Receivable Payments For ${customerName || customerNo}`,
        component: "OnAccountSalesDetailsPage",
        props: {
          fromDate: appliedDateFrom,
          toDate: appliedDateTo,
          storeId: drillStoreId,
          storeName: drillStoreName,
          customerId,
          customerNo,
          customerName,
          mode: "payments",
        },
        closable: true,
      })
    },
    [openTab, appliedDateFrom, appliedDateTo]
  )

  const rowContextMenuItems = useMemo(
    () => [
      {
        label: "View Payment Details",
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

  // Build the filter payload sent on every paginated request. Only changes when the user
  // applies a new search — page navigation reuses this and just varies startRow/endRow.
  const additionalParams = useMemo(() => {
    const params: Record<string, unknown> = {
      fromDate: appliedDateFrom,
      toDate: appliedDateTo,
    }
    // Pass storeId verbatim — empty string means "All Stores". The backend treats missing
    // and empty string the same, so we only attach it when non-empty to keep payloads lean.
    const storeIdToUse = appliedStoreId ?? filters?.storeId ?? ""
    if (storeIdToUse) params.storeId = storeIdToUse
    if (filters?.customerId) params.customerId = filters.customerId
    return params
  }, [appliedDateFrom, appliedDateTo, appliedStoreId, filters?.storeId, filters?.customerId])

  const handleResponseLoaded = useCallback((responseData: Record<string, unknown>) => {
    const r = responseData as Record<string, unknown>
    setTotalAmount(Number(r?.totalAmount ?? r?.TotalAmount ?? 0))
  }, [])

  const handleGridDataChange = useCallback((data: any[]) => {
    gridDataRef.current = data as OnAccountPaymentsRow[]
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
    // Pass screenStoreId verbatim — empty string means "All Stores" and must overwrite the
    // previous applied value so the next request drops the storeId filter.
    setAppliedStoreId(screenStoreId)
    setAppliedStoreName(screenStoreId ? (stores.find((s) => s.id === screenStoreId)?.name ?? screenStoreName) : "All Stores")
    setGridKey((k) => k + 1)
  }, [dateFrom, dateTo, screenStoreId, screenStoreName, stores])

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
        if (storeIdToUse) body.storeId = storeIdToUse
        if (filters?.customerId) body.customerId = filters.customerId

        const response = await axios.post(API_ENDPOINTS.REPORTS.ON_ACCOUNT_PAYMENTS, body, { headers })
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
              amount: Number(r?.amount ?? r?.Amount ?? 0),
            }))
          : []
      } catch (error) {
        console.error("Failed to fetch On Account Payments for export:", error)
        return []
      }
    },
    [getAuthHeaders, appliedDateFrom, appliedDateTo, appliedStoreId, filters?.storeId, filters?.customerId]
  )

  const exportModal = useReportExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "on-account-payments-report",
    title: "On Account Payments Report",
    subtitle: `${appliedStoreName || "All Stores"} | ${new Date(appliedDateFrom).toLocaleDateString()} - ${new Date(appliedDateTo).toLocaleDateString()}`,
    dateField: "date",
    defaultDateFrom: appliedDateFrom,
    defaultDateTo: appliedDateTo,
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">On Account Payments</h1>
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
            {totalAmount > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>Total Amount: {currency(totalAmount)}</span>
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
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col" ref={gridContainerRef}>
          <ServerGrid
            key={gridKey}
            hideDefaultContextMenuItems={true}
            customContextMenuItems={rowContextMenuItems}
            columns={columns}
            apiUrl={API_ENDPOINTS.REPORTS.ON_ACCOUNT_PAYMENTS}
            serverSide={true}
            methodType="POST"
            getAuthHeaders={getAuthHeaders}
            additionalParams={additionalParams}
            pagination={true}
            pageSize={100}
            columnChooser={true}
            title="On Account Payments"
            setTotalRecords={setTotalRecords}
            onResponseLoaded={handleResponseLoaded}
            onDataChange={handleGridDataChange}
            emptyMessage="No data for the selected criteria"
            defaultGroupByColumns={[{ field: "storeName", headerName: "Store Name" }]}
            defaultGroupsExpanded={true}
            containerWidth="100%"
            gridId="on-account-payments-report"
            getRowId={(row) =>
              // Per-(Store, Customer) row id — the same customer can now appear under
              // multiple "Store Name:" group headers, so the storeId must be part of the key.
              `${(row as any)?.storeId ?? ""}-${(row as any)?.storeName ?? ""}-${(row as any)?.customerNo ?? ""}-${(row as any)?.customerId ?? ""}`
            }
            onRowDoubleClick={(row) => openDetailsTab(row)}
          />
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default OnAccountPaymentsReportPage
