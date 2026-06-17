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

interface ItemDailySalesReportProps {
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

interface ItemDailySalesRow {
  saleDate: string
  itemName: string
  barcodeNumber?: string
  department?: string
  qty: number
  total: number
  averagePrice: number
}

const currency = (v: unknown) =>
  v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const numberFmt = (v: unknown) =>
  v == null ? "0" : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 })}`

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
  // Fallback: parse as Date and render dd/mm/yyyy (handles ISO datetimes from serverSide responses).
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0")
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }
  return s
}

const ITEM_DAILY_SALES_COLUMN_CONFIG = [
  { field: "department", headerName: "Department", ratio: 0.18, minWidth: 160 },
  { field: "itemName", headerName: "Item Name", ratio: 0.26, minWidth: 220 },
  { field: "barcodeNumber", headerName: "Barcode", ratio: 0.16, minWidth: 160 },
  { field: "saleDate", headerName: "Date", ratio: 0.14, minWidth: 120 },
  { field: "qty", headerName: "Qty", ratio: 0.08, minWidth: 90, type: "number" },
  { field: "total", headerName: "Amount", ratio: 0.09, minWidth: 120, type: "currency" },
  { field: "averagePrice", headerName: "Avg. Price", ratio: 0.09, minWidth: 110, type: "currency" },
]

const getLocalUserId = (): string => {
  try {
    const userData = localStorage.getItem("userData")
    if (userData) {
      const parsed = JSON.parse(userData)
      return parsed.localUserId ?? ""
    }
  } catch { /* ignore */ }
  return ""
}

const ITEM_DAILY_SALES_SCREEN_CODE = "reports.item_daily_sales"

const ItemDailySalesReportPage: React.FC<ItemDailySalesReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { canExport } = usePermission(ITEM_DAILY_SALES_SCREEN_CODE)

  const todayStr = new Date().toISOString().split("T")[0]
  const defaultDateFrom =
    filters?.dateFrom || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
  const defaultDateTo = filters?.dateTo || todayStr
  // For this report, "All Stores" should be the default when no store filter is provided.
  const defaultStoreId = filters?.storeId ?? ""

  const [dateFrom, setDateFrom] = useState<string>(defaultDateFrom)
  const [dateTo, setDateTo] = useState<string>(defaultDateTo)
  const [appliedDateFrom, setAppliedDateFrom] = useState<string>(defaultDateFrom)
  const [appliedDateTo, setAppliedDateTo] = useState<string>(defaultDateTo)
  const [stores, setStores] = useState<StoreOption[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [screenStoreId, setScreenStoreId] = useState<string>(defaultStoreId)
  const [appliedStoreId, setAppliedStoreId] = useState<string>(defaultStoreId)

  const [totalRecords, setTotalRecords] = useState(0)
  const [totalQty, setTotalQty] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)

  const [gridKey, setGridKey] = useState(0)
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
    setLoadingStores(true)
    fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${userId}`, { headers: getAuthHeaders() })
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
  }, [getAuthHeaders])

  // Sync with Report Manager filters — bumping gridKey triggers ServerGrid to refetch.
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
    if (filters.dateFrom || filters.dateTo || filters.storeId !== undefined) {
      setGridKey((k) => k + 1)
    }
  }, [filters?.dateFrom, filters?.dateTo, filters?.storeId, currentStore?.storeId])

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

  const columns: Column[] = useMemo(() => {
    const total = gridContainerWidth
    return ITEM_DAILY_SALES_COLUMN_CONFIG.map((cfg) => {
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
        col.cellRenderer = (value) => currency(value as number)
      }
      if (cfg.type === "number") {
        col.cellRenderer = (value) => numberFmt(value as number)
      }
      if (cfg.field === "saleDate") {
        col.cellRenderer = (value) => formatDateDMY(value as string)
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

  // Build the filter payload sent on every paginated request. Page navigation reuses this
  // and just varies startRow/endRow; only handleSearch (or a report-manager filter change)
  // mutates it.
  const additionalParams = useMemo(() => {
    const params: Record<string, unknown> = {
      fromDate: appliedDateFrom,
      toDate: appliedDateTo,
    }
    if (appliedStoreId && appliedStoreId.trim().length > 0) {
      params.storeId = appliedStoreId.trim()
    }
    return params
  }, [appliedDateFrom, appliedDateTo, appliedStoreId])

  const handleResponseLoaded = useCallback((responseData: Record<string, unknown>) => {
    const r = responseData as Record<string, unknown>
    setTotalQty(Number(r?.totalQty ?? r?.TotalQty ?? 0))
    setTotalAmount(Number(r?.totalAmount ?? r?.TotalAmount ?? 0))
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
    setAppliedStoreId(screenStoreId)
    setGridKey((k) => k + 1)
  }, [dateFrom, dateTo, screenStoreId])

  // Fetch every row for export, ignoring pagination by asking for a huge page.
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
        if (appliedStoreId && appliedStoreId.trim().length > 0) {
          body.storeId = appliedStoreId.trim()
        }
        const response = await axios.post(API_ENDPOINTS.REPORTS.ITEM_DAILY_SALES, body, { headers })
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess
        if (!ok) return []
        const res = response.data?.response ?? response.data?.Response ?? {}
        const dataRaw = res?.data ?? res?.Data ?? []
        return Array.isArray(dataRaw)
          ? dataRaw.map((r: any) => ({
              saleDate: (r.saleDate ?? r.SaleDate ?? "").toString(),
              itemName: (r.itemName ?? r.ItemName ?? "").toString(),
              barcodeNumber: r.barcodeNumber ?? r.BarcodeNumber ?? "",
              department: r.department ?? r.Department ?? "",
              qty: Number(r.qty ?? r.Qty ?? 0),
              total: Number(r.total ?? r.Total ?? 0),
              averagePrice: Number(r.averagePrice ?? r.AveragePrice ?? 0),
            }))
          : []
      } catch (error) {
        console.error("Failed to fetch Item Daily Sales for export:", error)
        return []
      }
    },
    [getAuthHeaders, appliedDateFrom, appliedDateTo, appliedStoreId]
  )

  const exportModal = useReportExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "item-daily-sales-report",
    title: "Item Daily Sales Report",
    subtitle: `${storeDisplayName} | ${new Date(appliedDateFrom).toLocaleDateString()} - ${new Date(appliedDateTo).toLocaleDateString()}`,
    dateField: "saleDate",
    defaultDateFrom: appliedDateFrom,
    defaultDateTo: appliedDateTo,
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Item Daily Sales</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            {appliedDateFrom && appliedDateTo && (
              <>
                <span>
                  {new Date(appliedDateFrom).toLocaleDateString()} –{" "}
                  {new Date(appliedDateTo).toLocaleDateString()}
                </span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{storeDisplayName}</span>
                {totalRecords > 0 && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span>
                      Qty {numberFmt(totalQty)} • Total {currency(totalAmount)}
                    </span>
                  </>
                )}
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

              <div className="space-y-1 min-w-[280px]">
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
            </div>

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
              apiUrl={API_ENDPOINTS.REPORTS.ITEM_DAILY_SALES}
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
              emptyMessage="No data for the selected criteria. Use filters and click Search to load data."
              defaultGroupByColumns={[{ field: "department", headerName: "Department" }]}
              defaultGroupsExpanded={true}
              containerWidth="100%"
              gridId="item-daily-sales-report"
              getRowId={(row) =>
                `${(row as ItemDailySalesRow)?.saleDate ?? ""}-${(row as ItemDailySalesRow)?.itemName ?? ""}-${(row as ItemDailySalesRow)?.barcodeNumber ?? ""}`
              }
            />
          </div>
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default ItemDailySalesReportPage
