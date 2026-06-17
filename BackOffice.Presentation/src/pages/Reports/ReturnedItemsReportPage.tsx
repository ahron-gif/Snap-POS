import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from "react"
import Flatpickr from "react-flatpickr"
import "flatpickr/dist/themes/light.css"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { useStore } from "../../context/StoreContext"
import { API_ENDPOINTS } from "../../constants/api"
import { Column as GridUtilsColumn } from "../../gridUtils"
import ExportModal from "../../components/common/ExportModal"
import { useExportModal } from "../../hooks/useExportModal"
import axios from "axios"

interface ReturnedItemsReportProps {
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

const getDefaultFrom = (f?: ReturnedItemsReportProps["filters"]) =>
  f?.dateFrom || new Date(new Date().setDate(1)).toISOString().split("T")[0]
const getDefaultTo = (f?: ReturnedItemsReportProps["filters"]) =>
  f?.dateTo || new Date().toISOString().split("T")[0]
const getDefaultStoreId = (f?: ReturnedItemsReportProps["filters"], currentStore?: { storeId?: string }) =>
  f !== undefined ? (f.storeId ?? "") : (currentStore?.storeId ?? "")
const getDefaultStoreName = (f?: ReturnedItemsReportProps["filters"], currentStore?: { storeName?: string }, storeId?: string) =>
  (storeId ? (f?.storeName?.trim() || currentStore?.storeName || "Selected Store") : "All Stores") as string

const ReturnedItemsReportPage: React.FC<ReturnedItemsReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()

  const [dateFrom, setDateFrom] = useState<string>(() => getDefaultFrom(filters))
  const [dateTo, setDateTo] = useState<string>(() => getDefaultTo(filters))
  const [appliedDateFrom, setAppliedDateFrom] = useState<string>(() => getDefaultFrom(filters))
  const [appliedDateTo, setAppliedDateTo] = useState<string>(() => getDefaultTo(filters))
  const [stores, setStores] = useState<StoreOption[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const defaultStoreId = getDefaultStoreId(filters, currentStore)
  const [screenStoreId, setScreenStoreId] = useState<string>(defaultStoreId)
  const [screenStoreName, setScreenStoreName] = useState<string>(
    () => filters?.storeName?.trim() || currentStore?.storeName || ""
  )
  const [appliedStoreId, setAppliedStoreId] = useState<string>(defaultStoreId)
  const [appliedStoreName, setAppliedStoreName] = useState<string>(() =>
    getDefaultStoreName(filters, currentStore, defaultStoreId)
  )
  const [totalRecords, setTotalRecords] = useState(0)
  const [gridKey, setGridKey] = useState(0)
  const gridContainerRef = useRef<HTMLDivElement>(null)

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

  // Sync filters from Report Manager (or parent) before first paint so header text is correct on first render
  useLayoutEffect(() => {
    if (!filters) return
    const from = filters.dateFrom || new Date(new Date().setDate(1)).toISOString().split("T")[0]
    const to = filters.dateTo || new Date().toISOString().split("T")[0]
    // Modal omits storeId when "All Stores" was chosen — don't fall back to current store.
    const storeId = filters.storeId ?? ""
    const storeName = filters.storeName?.trim() || (stores.find(s => s.id === storeId)?.name) || currentStore?.storeName || (storeId ? "Selected Store" : "All Stores")

    setDateFrom(from)
    setDateTo(to)
    setAppliedDateFrom(from)
    setAppliedDateTo(to)
    setScreenStoreId(storeId)
    setScreenStoreName(storeName)
    setAppliedStoreId(storeId)
    setAppliedStoreName(storeId ? storeName : "All Stores")
    setGridKey(prev => prev + 1)
  }, [filters?.dateFrom, filters?.dateTo, filters?.storeId, filters?.storeName, currentStore?.storeId, currentStore?.storeName, stores])

  // Resolve store name from stores list when it loads (e.g. Report Manager only passes storeId)
  useEffect(() => {
    if (stores.length === 0 || !appliedStoreId) return
    const name = stores.find(s => s.id === appliedStoreId)?.name
    if (name && (appliedStoreName === "Selected Store" || !appliedStoreName)) {
      setAppliedStoreName(name)
      setScreenStoreName(prev => prev === "Selected Store" || !prev ? name : prev)
    }
  }, [stores, appliedStoreId, appliedStoreName])

  const flatpickrCommonOptions = useMemo(() => ({
    dateFormat: "Y-m-d",
    allowInput: true,
    static: false,
  }), [])

  // Columns aligned with the legacy desktop report; widths tuned for full-screen layout
  const columns: Column[] = useMemo(() => [
    { field: "name", headerName: "Name", width: 300, sortable: true, filterable: true, visible: true, dataType: "string" },
    { field: "upc", headerName: "UPC", width: 160, sortable: true, filterable: true, visible: true, dataType: "string" },
    { field: "modelNumber", headerName: "Model Number", width: 160, sortable: true, filterable: true, visible: true, dataType: "string" },
    { field: "returnReason", headerName: "Return Reason", width: 200, sortable: true, filterable: true, visible: true, dataType: "string" },
    { field: "supplierName", headerName: "Supplier Name", width: 200, sortable: true, filterable: true, visible: true, dataType: "string" },
    { field: "quantityReturned", headerName: "Qty", width: 90, sortable: true, filterable: false, visible: true, dataType: "number" },
    {
      field: "amount",
      headerName: "Amount",
      width: 130,
      sortable: true,
      filterable: false,
      visible: true,
      dataType: "number",
      cellRenderer: (value: number) =>
        value == null ? "$0.00" : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    { field: "department", headerName: "Department", width: 200, sortable: true, filterable: true, visible: true, dataType: "string" },
    { field: "styleNo", headerName: "Style No", width: 160, sortable: true, filterable: true, visible: true, dataType: "string" },
  ], [])

  const effectiveStoreId = appliedStoreId?.trim() ? appliedStoreId : undefined
  const displayStoreName = effectiveStoreId ? (appliedStoreName || "Selected Store") : "All Stores"
  const additionalParams = useMemo(() => {
    const base: Record<string, string | undefined> = { fromDate: appliedDateFrom, toDate: appliedDateTo }
    if (effectiveStoreId) base.storeId = effectiveStoreId
    return base
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
        url: API_ENDPOINTS.REPORTS.RETURNED_ITEMS,
        data: {
          startRow: 0,
          endRow: 1000000,
          sortColumn: "date",
          sortDirection: "desc",
          fromDate: appliedDateFrom,
          toDate: appliedDateTo,
          ...(effectiveStoreId ? { storeId: effectiveStoreId } : {}),
        },
        headers,
      })
      if (response.data?.isSuccess) {
        return response.data.response.data || []
      }
      return []
    } catch (error) {
      console.error("Failed to fetch returned items:", error)
      return []
    }
  }, [getAuthHeaders, appliedDateFrom, appliedDateTo, effectiveStoreId])

  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "returned-items-report",
    pdfOptions: {
      title: "Returned Items Report",
      subtitle: `${displayStoreName} | ${new Date(appliedDateFrom).toLocaleDateString()} - ${new Date(appliedDateTo).toLocaleDateString()}`,
      orientation: "landscape",
    },
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Returned Items Report</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-600 dark:text-gray-300">
            <span><span className="font-medium text-gray-500 dark:text-gray-400">Store:</span> {displayStoreName}</span>
            {appliedDateFrom && appliedDateTo && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Date range:</span> {new Date(appliedDateFrom).toLocaleDateString()} – {new Date(appliedDateTo).toLocaleDateString()}
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date Range</label>
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
                className="h-10 px-5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors flex items-center gap-2 border-0 border-r border-gray-200 dark:border-gray-600"
                type="button"
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

      <div className="flex-1 flex flex-col min-h-0 p-6">
        <div className="flex-1 min-h-0 overflow-auto flex flex-col" ref={gridContainerRef}>
          <div className="min-h-0 flex-1">
            <ServerGrid
              hideDefaultContextMenuItems={true}
              key={gridKey}
              columns={columns}
              apiUrl={API_ENDPOINTS.REPORTS.RETURNED_ITEMS}
              serverSide={true}
              methodType="POST"
              getAuthHeaders={getAuthHeaders}
              pagination={true}
              pageSize={100}
              headerSearch={true}
              showActions={false}
              columnChooser={true}
              title="Returned Items"
              defaultSortColumn="date"
              additionalParams={additionalParams}
              setTotalRecords={setTotalRecords}
              getRowId={(row) => row.id ?? [row.transactionId, row.transactionNo, row.itemCode, row.storeId, row.date, row.quantityReturned, row.amount].join("-")}
              containerWidth="100%"
              gridId="returned-items-report"
              defaultGroupByColumns={[{ field: "storeName", headerName: "Store Name" }]}
              defaultGroupsExpanded={true}
            />
          </div>
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default ReturnedItemsReportPage
