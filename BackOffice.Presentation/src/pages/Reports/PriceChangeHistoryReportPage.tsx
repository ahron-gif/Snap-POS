import React, { useState, useCallback, useMemo, useLayoutEffect } from "react"
import Flatpickr from "react-flatpickr"
import "flatpickr/dist/themes/light.css"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import { Column as GridUtilsColumn } from "../../gridUtils"
import ExportModal from "../../components/common/ExportModal"
import { useExportModal } from "../../hooks/useExportModal"
import axios from "axios"

interface StoreOption {
  id: string
  name: string
  code?: string
}

interface PriceChangeHistoryReportProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    storeId?: string
    storeName?: string
  }
}

const getDefaultFrom = (f?: PriceChangeHistoryReportProps["filters"]) =>
  f?.dateFrom || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
const getDefaultTo = (f?: PriceChangeHistoryReportProps["filters"]) =>
  f?.dateTo || new Date().toISOString().split("T")[0]

/** Parse YYYY-MM-DD as local date and format for display (avoids UTC midnight shifting the day). */
function formatLocalDate(dateStr: string): string {
  if (!dateStr) return ""
  const parts = dateStr.split("-").map(Number)
  if (parts.length !== 3) return dateStr
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString()
}

type ScopeValue = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "lastMonth" | "thisYear" | "all" | "custom"

const SCOPE_OPTIONS: { value: ScopeValue; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "thisYear", label: "This Year" },
  { value: "all", label: "All" },
  { value: "custom", label: "Custom" },
]

function getDateRangeForScope(scope: ScopeValue): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  switch (scope) {
    case "today":
    case "yesterday":
      from.setDate(to.getDate() - (scope === "today" ? 0 : 1))
      to.setDate(to.getDate() - (scope === "today" ? 0 : 1))
      break
    case "last7":
      from.setDate(to.getDate() - 6)
      break
    case "last30":
      from.setDate(to.getDate() - 29)
      break
    case "thisMonth":
      from.setDate(1)
      break
    case "lastMonth": {
      from.setMonth(from.getMonth() - 1)
      from.setDate(1)
      const lastDay = new Date(from.getFullYear(), from.getMonth() + 1, 0)
      to.setTime(lastDay.getTime())
      break
    }
    case "thisYear":
      from.setMonth(0, 1)
      break
    case "all":
      from.setFullYear(from.getFullYear() - 1)
      break
    default:
      return { from: getDefaultFrom(), to: getDefaultTo() }
  }
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  }
}

const PriceChangeHistoryReportPage: React.FC<PriceChangeHistoryReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()

  const [scope, setScope] = useState<ScopeValue>("last30")
  const [dateFrom, setDateFrom] = useState<string>(() => getDefaultFrom(filters))
  const [dateTo, setDateTo] = useState<string>(() => getDefaultTo(filters))
  const [stores, setStores] = useState<StoreOption[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [screenStoreId, setScreenStoreId] = useState<string>(filters?.storeId ?? "")
  const [screenStoreName, setScreenStoreName] = useState<string>(filters?.storeName ?? "")
  const [appliedDateFrom, setAppliedDateFrom] = useState<string>(() => getDefaultFrom(filters))
  const [appliedDateTo, setAppliedDateTo] = useState<string>(() => getDefaultTo(filters))
  const [appliedStoreId, setAppliedStoreId] = useState<string>(filters?.storeId ?? "")
  const [appliedStoreName, setAppliedStoreName] = useState<string>(filters?.storeName ?? "All Stores")

  const flatpickrCommonOptions = useMemo(() => ({
    dateFormat: "Y-m-d",
    allowInput: true,
    static: false,
  }), [])

  const [totalRecords, setTotalRecords] = useState(0)
  const [gridKey, setGridKey] = useState(0)

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

  React.useEffect(() => {
    const userId = getLocalUserId()
    if (!userId) return
    setLoadingStores(true)
    const headers = getAuthHeaders()
    fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${userId}`, { headers })
      .then(res => res.json())
      .then(data => {
        if (data.isSuccess && data.response) {
          setStores(data.response.map((s: { storeID: string; storeName: string; storeNo?: number }) => ({
            id: s.storeID,
            name: s.storeName,
            code: s.storeNo?.toString()
          })))
        }
      })
      .catch(console.error)
      .finally(() => setLoadingStores(false))
  }, [getAuthHeaders, getLocalUserId])

  const effectiveStoreId = appliedStoreId?.trim() ? appliedStoreId : undefined
  const displayStoreName = effectiveStoreId ? (appliedStoreName || "Selected Store") : "All Stores"

  React.useEffect(() => {
    if (stores.length === 0 || !appliedStoreId) return
    const name = stores.find(s => s.id === appliedStoreId)?.name
    if (name && (appliedStoreName === "Selected Store" || !appliedStoreName)) {
      setAppliedStoreName(name)
      setScreenStoreName(prev => prev === "Selected Store" || !prev ? name : prev)
    }
  }, [stores, appliedStoreId, appliedStoreName])

  const columns: Column[] = useMemo(() => [
    {
      field: "changeDate",
      headerName: "Change Date",
      width: 120,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "date",
      cellRenderer: (value: string) => {
        if (!value) return "-"
        return new Date(value).toLocaleDateString()
      },
    },
    {
      field: "name",
      headerName: "Item Name",
      width: 200,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "modalNumber",
      headerName: "Model Number",
      width: 120,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "barcodeNumber",
      headerName: "Barcode",
      width: 130,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "priceLevel",
      headerName: "Price Level",
      width: 100,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "oldPrice",
      headerName: "Old Price",
      width: 100,
      sortable: true,
      filterable: false,
      visible: true,
      dataType: "number",
      cellRenderer: (value: number) => {
        if (value === null || value === undefined) return "-"
        return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      },
    },
    {
      field: "newPrice",
      headerName: "New Price",
      width: 100,
      sortable: true,
      filterable: false,
      visible: true,
      dataType: "number",
      cellRenderer: (value: number) => {
        if (value === null || value === undefined) return "-"
        return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      },
    },
    {
      field: "saleType",
      headerName: "Sale Type",
      width: 100,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "sP_Price",
      headerName: "Special Price",
      width: 110,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "department",
      headerName: "Department",
      width: 140,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "brand",
      headerName: "Brand",
      width: 100,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "userName",
      headerName: "Changed By",
      width: 120,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
  ], [])

  const additionalParams = useMemo(() => {
    const params: Record<string, string | undefined> = {
      fromDate: appliedDateFrom,
      toDate: appliedDateTo,
    }
    if (effectiveStoreId) params.storeId = effectiveStoreId
    return params
  }, [appliedDateFrom, appliedDateTo, effectiveStoreId])

  const handleSearch = useCallback(() => {
    setAppliedDateFrom(dateFrom)
    setAppliedDateTo(dateTo)
    setAppliedStoreId(screenStoreId)
    setAppliedStoreName(screenStoreId ? (stores.find(s => s.id === screenStoreId)?.name ?? screenStoreName) : "All Stores")
    setGridKey(prev => prev + 1)
  }, [dateFrom, dateTo, screenStoreId, screenStoreName, stores])

  const fetchAllData = useCallback(async (): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const response = await axios({
        method: "POST",
        url: API_ENDPOINTS.REPORTS.PRICE_CHANGE_HISTORY,
        data: {
          startRow: 0,
          endRow: 1000000,
          sortColumn: "changeDate",
          sortDirection: "desc",
          fromDate: appliedDateFrom,
          toDate: appliedDateTo,
          ...(effectiveStoreId ? { storeId: effectiveStoreId } : {}),
        },
        headers,
      })
      if (response.data?.isSuccess && response.data?.response?.data) {
        return response.data.response.data
      }
      return []
    } catch (error) {
      console.error("Failed to fetch all data:", error)
      return []
    }
  }, [getAuthHeaders, appliedDateFrom, appliedDateTo, effectiveStoreId])

  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "price-change-history-report",
    pdfOptions: {
      title: "Price Change History Report",
      subtitle: `${displayStoreName} | ${formatLocalDate(appliedDateFrom)} - ${formatLocalDate(appliedDateTo)}`,
      orientation: "landscape",
    },
  })

  // Sync display and grid when filters from Report Manager (or parent) change
  useLayoutEffect(() => {
    if (!filters) return
    const from = filters.dateFrom || getDefaultFrom()
    const to = filters.dateTo || getDefaultTo()
    const storeId = filters.storeId ?? ""
    const storeName = filters.storeName?.trim() || (stores.find(s => s.id === storeId)?.name) || "All Stores"
    setScope("custom")
    setDateFrom(from)
    setDateTo(to)
    setScreenStoreId(storeId)
    setScreenStoreName(storeId ? storeName : "")
    setAppliedDateFrom(from)
    setAppliedDateTo(to)
    setAppliedStoreId(storeId)
    setAppliedStoreName(storeId ? storeName : "All Stores")
    setGridKey(prev => prev + 1)
    // Include filters so we re-sync when tab is updated with new props (e.g. new dates from Report Manager)
  }, [filters, filters?.dateFrom, filters?.dateTo, filters?.storeId, filters?.storeName, stores])

  return (
    <div className="h-full w-full min-w-0 flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 w-full min-w-0">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Price Change History Report</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-600 dark:text-gray-300">
            <span><span className="font-medium text-gray-500 dark:text-gray-400">Store:</span> {displayStoreName}</span>
            {appliedDateFrom && appliedDateTo && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Date range:</span> {formatLocalDate(appliedDateFrom)} – {formatLocalDate(appliedDateTo)}
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Scope</label>
                <select
                  value={scope}
                  onChange={(e) => {
                    const val = e.target.value as ScopeValue
                    setScope(val)
                    if (val !== "custom") {
                      const { from, to } = getDateRangeForScope(val)
                      setDateFrom(from)
                      setDateTo(to)
                    }
                  }}
                  className="h-10 min-w-[140px] px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  {SCOPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date Range</label>
                <div className="flex items-center gap-2">
                  <div className="flatpickr-wrapper w-[142px] relative">
                    <Flatpickr
                      value={dateFrom}
                      onChange={([d]) => {
                        if (d) setDateFrom(d.toISOString().split("T")[0])
                        setScope("custom")
                      }}
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
                      onChange={([d]) => {
                        if (d) setDateTo(d.toISOString().split("T")[0])
                        setScope("custom")
                      }}
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Store</label>
                <select
                  value={screenStoreId}
                  onChange={(e) => {
                    const id = e.target.value
                    setScreenStoreId(id)
                    setScreenStoreName(id ? (stores.find(s => s.id === id)?.name ?? "") : "")
                  }}
                  disabled={loadingStores}
                  className="h-10 min-w-[280px] px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60"
                >
                  <option value="">All Stores</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm ml-auto overflow-visible">
              <button
                onClick={handleSearch}
                type="button"
                className="h-10 px-5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors flex items-center gap-2 border-0 border-r border-gray-200 dark:border-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
              <button
                onClick={exportModal.open}
                type="button"
                className="h-10 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 border-0 rounded-none"
                title="Preview, filter and export"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 p-6 w-full min-w-0">
        <div className="flex-1 min-h-0 overflow-auto flex flex-col w-full min-w-0">
          <div className="min-h-0 flex-1">
            <ServerGrid
              hideDefaultContextMenuItems={true}
              key={gridKey}
              columns={columns}
              apiUrl={API_ENDPOINTS.REPORTS.PRICE_CHANGE_HISTORY}
              serverSide={true}
              methodType="POST"
              getAuthHeaders={getAuthHeaders}
              pagination={true}
              pageSize={100}
              headerSearch={true}
              showActions={false}
              columnChooser={true}
              title="Price Change History"
              defaultSortColumn="changeDate"
              defaultSortDirection="desc"
              additionalParams={additionalParams}
              setTotalRecords={setTotalRecords}
              getRowId={(row) => row.itemStoreID || row.itemID || `${row.changeDate}-${row.modalNumber}`}
              containerWidth="100%"
              gridId="price-change-history-report"
            />
          </div>
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default PriceChangeHistoryReportPage
