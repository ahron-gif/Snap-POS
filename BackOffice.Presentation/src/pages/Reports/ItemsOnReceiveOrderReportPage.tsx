import React, { useState, useCallback, useMemo, useRef, useEffect } from "react"
import Flatpickr from "react-flatpickr"
import "flatpickr/dist/themes/light.css"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import { Column as GridUtilsColumn } from "../../gridUtils"
import ExportModal from "../../components/common/ExportModal"
import { useExportModal } from "../../hooks/useExportModal"

interface ItemsOnReceiveOrderReportProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    storeId?: string
    storeName?: string
    vendorId?: string
  }
}

interface LookupOption {
  id: string
  name: string
  code?: string
}

const getDefaultFrom = (f?: ItemsOnReceiveOrderReportProps["filters"]) =>
  f?.dateFrom || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
const getDefaultTo = (f?: ItemsOnReceiveOrderReportProps["filters"]) =>
  f?.dateTo || new Date().toISOString().split("T")[0]

function formatLocalDate(dateStr: string): string {
  if (!dateStr) return ""
  const parts = dateStr.split("-").map(Number)
  if (parts.length !== 3) return dateStr
  const [y, m, d] = parts
  return new Date(y, m - 1, d).toLocaleDateString()
}

const qty3Renderer = (v: unknown) => (v == null ? "" : typeof v === "number" ? v.toFixed(3) : String(v))
const currencyRenderer = (v: unknown) =>
  v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Normalize API row to camelCase keys so grid column.field binds correctly */
function toCamelCaseRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    const camel = k.charAt(0).toLowerCase() + k.slice(1)
    out[camel] = v
  }
  return out
}

const ItemsOnReceiveOrderReportPage: React.FC<ItemsOnReceiveOrderReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()

  const [dateFrom, setDateFrom] = useState<string>(() => getDefaultFrom(filters))
  const [dateTo, setDateTo] = useState<string>(() => getDefaultTo(filters))
  const [stores, setStores] = useState<LookupOption[]>([])
  const [vendors, setVendors] = useState<LookupOption[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [loadingVendors, setLoadingVendors] = useState(false)

  const [screenStoreId, setScreenStoreId] = useState<string>(filters?.storeId ?? "")
  const [screenVendorId, setScreenVendorId] = useState<string>(filters?.vendorId ?? "")

  const [appliedDateFrom, setAppliedDateFrom] = useState<string>(() => getDefaultFrom(filters))
  const [appliedDateTo, setAppliedDateTo] = useState<string>(() => getDefaultTo(filters))
  const [appliedStoreId, setAppliedStoreId] = useState<string>(filters?.storeId ?? "")
  const [appliedStoreName, setAppliedStoreName] = useState<string>(filters?.storeName ?? "All Stores")
  const [appliedVendorId, setAppliedVendorId] = useState<string>(filters?.vendorId ?? "")

  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [gridKey, setGridKey] = useState(0)
  const [loadingReportData, setLoadingReportData] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [runSearchAfterFilters, setRunSearchAfterFilters] = useState(false)
  const handleSearchRef = useRef<() => void>(() => {})
  const flatpickrOptions = useMemo(() => ({ dateFormat: "Y-m-d", allowInput: true }), [])

  // Keep dates and filters in sync with Report Manager when filters prop changes (same dates in both)
  useEffect(() => {
    if (!filters) return
    const from = filters.dateFrom ?? new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
    const to = filters.dateTo ?? new Date().toISOString().split("T")[0]
    setDateFrom(from)
    setDateTo(to)
    setAppliedDateFrom(from)
    setAppliedDateTo(to)
    if (filters.storeId !== undefined) {
      setScreenStoreId(filters.storeId ?? "")
      setAppliedStoreId(filters.storeId ?? "")
      setAppliedStoreName(filters.storeName ?? "All Stores")
    }
    if (filters.vendorId !== undefined) {
      setScreenVendorId(filters.vendorId ?? "")
      setAppliedVendorId(filters.vendorId ?? "")
    }
  }, [filters?.dateFrom, filters?.dateTo, filters?.storeId, filters?.storeName, filters?.vendorId])

  const columns: Column[] = useMemo(
    () => [
      { field: "storeName", headerName: "Store Name", width: 140, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "barcodeNumber", headerName: "Barcode", width: 120, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "modalNumber", headerName: "Model Number", width: 120, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "name", headerName: "Item Name", width: 220, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "manufacturerName", headerName: "Manufacturer", width: 140, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "mainDepartment", headerName: "Main Dept", width: 110, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "subDepartment", headerName: "Sub Dept", width: 110, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "subSubDepartment", headerName: "SubSub Dept", width: 110, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "onHand", headerName: "On Hand", width: 90, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (v) => qty3Renderer(v) },
      { field: "supplier", headerName: "Supplier", width: 160, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "cost", headerName: "Cost", width: 100, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (v) => currencyRenderer(v) },
      { field: "price", headerName: "Price", width: 100, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (v) => currencyRenderer(v) },
      { field: "qtyReceived", headerName: "Qty Received", width: 110, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (v) => qty3Renderer(v) },
      { field: "receivedValue", headerName: "Received Value", width: 120, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (v) => currencyRenderer(v) },
      { field: "receivedSellingPrice", headerName: "Received Selling Price", width: 140, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (v) => currencyRenderer(v) },
      { field: "customField1", headerName: "Custom 1", width: 100, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "customField2", headerName: "Custom 2", width: 100, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "customField3", headerName: "Custom 3", width: 100, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "customField4", headerName: "Custom 4", width: 100, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "customField5", headerName: "Custom 5", width: 100, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "customField6", headerName: "Custom 6", width: 100, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "customField7", headerName: "Custom 7", width: 100, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "customField8", headerName: "Custom 8", width: 100, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "customField9", headerName: "Custom 9", width: 100, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "customField10", headerName: "Custom 10", width: 100, sortable: true, filterable: true, visible: true, dataType: "string" },
    ],
    []
  )

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
    const headers = getAuthHeaders()
    if (userId) {
      setLoadingStores(true)
      fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${userId}`, { headers })
        .then((res) => res.json())
        .then((data) => {
          if (data.isSuccess && data.response) {
            setStores(
              data.response.map((s: { storeID: string | number; storeName: string; storeNo?: number }) => ({
                id: String(s.storeID),
                name: s.storeName,
                code: s.storeNo?.toString(),
              }))
            )
          }
        })
        .catch(console.error)
        .finally(() => setLoadingStores(false))
    }
    setLoadingVendors(true)
    fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_SUPPLIERS_LOOKUP, { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`Suppliers: ${res.status}`)
        return res.json()
      })
      .then((data: { isSuccess?: boolean; IsSuccess?: boolean; response?: unknown[]; Response?: unknown[] }) => {
        const ok = data?.isSuccess === true || data?.IsSuccess === true
        const list = data?.response ?? data?.Response
        if (ok && Array.isArray(list)) {
          const mapped: LookupOption[] = (list as { SupplierID?: string; supplierID?: string; supplierId?: string; id?: string; Name?: string; name?: string; SupplierNo?: string; supplierNo?: string; code?: string }[]).map((s) => {
            const rawId = s.SupplierID ?? s.supplierID ?? s.supplierId ?? s.id
            const id = rawId != null ? String(rawId).trim() : ""
            const name = (s.Name ?? s.name ?? "").trim()
            const code = (s.SupplierNo ?? s.supplierNo ?? s.code ?? "").trim()
            return { id, name, code }
          }).filter((x) => x.id !== "" && x.name !== "")
          mapped.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }))
          setVendors(mapped)
        } else {
          setVendors([])
        }
      })
      .catch((err) => {
        console.error("Suppliers lookup failed:", err)
        setVendors([])
      })
      .finally(() => setLoadingVendors(false))
  }, [getLocalUserId, getAuthHeaders])

  useEffect(() => {
    if (!runSearchAfterFilters) return
    setRunSearchAfterFilters(false)
    handleSearchRef.current?.()
  }, [runSearchAfterFilters])

  // When opened from Report Manager with filters, run search once after mount
  useEffect(() => {
    if (filters && (filters.dateFrom || filters.dateTo || filters.storeId || filters.vendorId)) {
      setRunSearchAfterFilters(true)
    }
  }, [])

  const handleSearch = useCallback(() => {
    const storeName = screenStoreId
      ? (stores.find((s) => s.id === screenStoreId)?.name ?? (filters?.storeId === screenStoreId ? filters.storeName : undefined) ?? "Selected Store")
      : "All Stores"
    setAppliedDateFrom(dateFrom)
    setAppliedDateTo(dateTo)
    setAppliedStoreId(screenStoreId)
    setAppliedStoreName(storeName)
    setAppliedVendorId(screenVendorId)
    setLoadingReportData(true)

    const fromDate = dateFrom ? new Date(dateFrom + "T00:00:00").toISOString().slice(0, 10) : null
    const toDate = dateTo ? new Date(dateTo + "T23:59:59").toISOString().slice(0, 10) : null
    const storeId = screenStoreId && /^[0-9a-f-]{36}$/i.test(screenStoreId) ? screenStoreId : null
    const supplierIds = screenVendorId && /^[0-9a-f-]{36}$/i.test(screenVendorId) ? screenVendorId : ""

    const body = {
      fromDate: fromDate || null,
      toDate: toDate || null,
      storeId: storeId || null,
      supplierIds: supplierIds || "",
      departmentFilter: "",
    }

    setReportError(null)
    fetch(API_ENDPOINTS.REPORTS.ITEMS_ON_RECEIVE_ORDER, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg = (data?.message ?? data?.Message ?? `Request failed (${res.status})`) as string
          setReportError(msg)
          setRows([])
          return
        }
        const ok = data?.isSuccess === true || data?.IsSuccess === true
        if (!ok) {
          const msg = (data?.message ?? data?.Message ?? "Report request failed") as string
          setReportError(msg)
          setRows([])
          return
        }
        const resp = data?.response ?? data?.Response
        const rawList = Array.isArray(resp)
          ? resp
          : Array.isArray((resp as Record<string, unknown>)?.data)
            ? (resp as Record<string, unknown>).data
            : Array.isArray((resp as Record<string, unknown>)?.Data)
              ? (resp as Record<string, unknown>).Data
              : []
        const list = (rawList as Record<string, unknown>[]).map((row) => toCamelCaseRow(row))
        setRows(list)
      })
      .catch((err) => {
        setReportError(err?.message ?? "Network or server error")
        setRows([])
      })
      .finally(() => {
        setLoadingReportData(false)
        setGridKey((prev) => prev + 1)
        setHasSearched(true)
      })
  }, [dateFrom, dateTo, screenStoreId, screenVendorId, stores, filters?.storeId, filters?.storeName, getAuthHeaders])

  useEffect(() => {
    handleSearchRef.current = handleSearch
  }, [handleSearch])

  const displayStoreName = appliedStoreId ? appliedStoreName || "Selected Store" : "All Stores"
  const displayVendorName = appliedVendorId ? (vendors.find((v) => v.id === appliedVendorId)?.name ?? "Selected Supplier") : "All Suppliers"

  // Pattern A export — report data lives in the in-memory `rows` array (loaded
  // by Search); no separate all-records endpoint, so export the rows directly.
  // No per-row date filter, so `useExportModal` with no `filters`.
  const fetchAllData = useCallback(async (): Promise<any[]> => rows, [rows])

  const exportSubtitle = `${displayStoreName} | ${appliedDateFrom && appliedDateTo ? `${formatLocalDate(appliedDateFrom)} - ${formatLocalDate(appliedDateTo)}` : ""}`.trim()

  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "items-on-receive-order",
    pdfOptions: {
      title: "Items on Receive Order",
      subtitle: exportSubtitle,
      orientation: "landscape",
    },
  })

  return (
    <div className="h-full w-full min-w-0 flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 w-full min-w-0">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Items on Receive Order</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-600 dark:text-gray-300">
            <span>
              <span className="font-medium text-gray-500 dark:text-gray-400">Store:</span> {displayStoreName}
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>
              <span className="font-medium text-gray-500 dark:text-gray-400">Supplier:</span> {displayVendorName}
            </span>
            {appliedDateFrom && appliedDateTo && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Date range:</span>{" "}
                  {formatLocalDate(appliedDateFrom)} – {formatLocalDate(appliedDateTo)}
                </span>
              </>
            )}
            {rows.length > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{rows.length} records</span>
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date Range</label>
              <div className="flex items-center gap-2">
                <div className="flatpickr-wrapper w-[130px] relative">
                  <Flatpickr
                    value={dateFrom}
                    onChange={([d]) => {
                      if (!d) return
                      const fromStr = d.toISOString().split("T")[0]
                      setDateFrom(fromStr)
                      setDateTo((prev) => (prev && prev < fromStr ? fromStr : prev))
                    }}
                    options={flatpickrOptions}
                    placeholder="From"
                    className="w-full h-10 pl-9 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                </div>
                <span className="text-gray-400 dark:text-gray-500 font-medium text-sm">to</span>
                <div className="flatpickr-wrapper w-[130px] relative">
                  <Flatpickr
                    value={dateTo}
                    onChange={([d]) => {
                      if (!d) return
                      const toStr = d.toISOString().split("T")[0]
                      setDateTo(dateFrom && toStr < dateFrom ? dateFrom : toStr)
                    }}
                    options={flatpickrOptions}
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
                onChange={(e) => setScreenStoreId(e.target.value)}
                disabled={loadingStores}
                className="h-10 min-w-[160px] px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60"
              >
                <option value="">All Stores</option>
                {filters?.storeId != null &&
                  filters?.storeName &&
                  !stores.some((s) => String(s.id) === String(filters.storeId)) && (
                  <option value={String(filters.storeId)}>{filters.storeName}</option>
                )}
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Supplier</label>
              <select
                value={screenVendorId}
                onChange={(e) => setScreenVendorId(e.target.value)}
                disabled={loadingVendors}
                className="h-10 min-w-[160px] px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60"
              >
                <option value="">All Suppliers</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="ml-auto flex items-center rounded-lg overflow-visible border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 flex-shrink-0">
              <button
                onClick={handleSearch}
                disabled={loadingReportData}
                type="button"
                className="h-10 px-5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors flex items-center gap-2 border-0 border-r border-gray-200 dark:border-gray-600 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loadingReportData ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
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

      {reportError && (
        <div className="mx-6 mt-2 px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {reportError}
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 p-6 w-full min-w-0">
        <div className="flex-1 min-h-0 overflow-auto flex flex-col">
          {hasSearched && !loadingReportData && rows.length === 0 && !reportError && (
            <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400 text-sm">
              No data. Try a different date range, store, or supplier.
            </div>
          )}
          <div className="min-h-0 flex-1">
            <ServerGrid
              hideDefaultContextMenuItems={true}
              key={gridKey}
              columns={columns}
              data={rows}
              serverSide={false}
              loading={loadingReportData}
              getAuthHeaders={getAuthHeaders}
              pagination={true}
              pageSize={100}
              headerSearch={true}
              showActions={false}
              columnChooser={true}
              title="Items on Receive Order"
              defaultSortColumn="storeName"
              containerWidth="100%"
              gridId="items-on-receive-order-report"
              getRowId={(row) => `${(row as Record<string, unknown>).barcodeNumber}-${(row as Record<string, unknown>).storeName}-${(row as Record<string, unknown>).supplier}`}
            />
          </div>
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default ItemsOnReceiveOrderReportPage
