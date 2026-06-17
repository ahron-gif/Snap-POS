import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from "react"
import Flatpickr from "react-flatpickr"
import "flatpickr/dist/themes/light.css"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import { Column as GridUtilsColumn } from "../../gridUtils"
import ExportModal from "../../components/common/ExportModal"
import { useExportModal } from "../../hooks/useExportModal"

interface ReceiveInventoryValueReportProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    storeId?: string
    storeName?: string
    vendorId?: string
    departmentId?: string
    brandId?: string
    brandName?: string
  }
}

interface LookupOption {
  id: string
  name: string
  code?: string
}

const getDefaultFrom = (f?: ReceiveInventoryValueReportProps["filters"]) =>
  f?.dateFrom || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
const getDefaultTo = (f?: ReceiveInventoryValueReportProps["filters"]) =>
  f?.dateTo || new Date().toISOString().split("T")[0]

function formatLocalDate(dateStr: string): string {
  if (!dateStr) return ""
  const parts = dateStr.split("-").map(Number)
  if (parts.length !== 3) return dateStr
  const [y, m, d] = parts
  return new Date(y, m - 1, d).toLocaleDateString()
}

const qtyRenderer = (v: unknown) => (v == null ? "" : typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v))
const currencyRenderer = (v: unknown) =>
  v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function toCamelCaseRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    const camel = k.charAt(0).toLowerCase() + k.slice(1)
    out[camel] = v
  }
  return out
}

const ReceiveInventoryValueReportPage: React.FC<ReceiveInventoryValueReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()

  const [dateFrom, setDateFrom] = useState<string>(() => getDefaultFrom(filters))
  const [dateTo, setDateTo] = useState<string>(() => getDefaultTo(filters))
  const [stores, setStores] = useState<LookupOption[]>([])
  const [vendors, setVendors] = useState<LookupOption[]>([])
  const [departments, setDepartments] = useState<LookupOption[]>([])
  const [brands, setBrands] = useState<LookupOption[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [loadingVendors, setLoadingVendors] = useState(false)
  const [loadingDepartments, setLoadingDepartments] = useState(false)
  const [loadingBrands, setLoadingBrands] = useState(false)

  const [screenStoreId, setScreenStoreId] = useState<string>(filters?.storeId ?? "")
  const [screenVendorId, setScreenVendorId] = useState<string>(filters?.vendorId ?? "")
  const [screenDepartmentId, setScreenDepartmentId] = useState<string>(filters?.departmentId ?? "")
  const [screenBrandId, setScreenBrandId] = useState<string>(filters?.brandId ?? "")

  const [appliedDateFrom, setAppliedDateFrom] = useState<string>(() => getDefaultFrom(filters))
  const [appliedDateTo, setAppliedDateTo] = useState<string>(() => getDefaultTo(filters))
  const [appliedStoreId, setAppliedStoreId] = useState<string>(filters?.storeId ?? "")
  const [appliedStoreName, setAppliedStoreName] = useState<string>(filters?.storeName ?? "All Stores")
  const [appliedVendorId, setAppliedVendorId] = useState<string>(filters?.vendorId ?? "")
  const [appliedDepartmentId, setAppliedDepartmentId] = useState<string>(filters?.departmentId ?? "")
  const [appliedBrandId, setAppliedBrandId] = useState<string>(filters?.brandId ?? "")
  const [appliedBrandName, setAppliedBrandName] = useState<string>(filters?.brandName ?? "All Brands")

  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [gridKey, setGridKey] = useState(0)
  const [loadingReportData, setLoadingReportData] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [runSearchAfterFilters, setRunSearchAfterFilters] = useState(false)
  const handleSearchRef = useRef<() => void>(() => {})
  const flatpickrOptions = useMemo(() => ({ dateFormat: "Y-m-d", allowInput: true }), [])

  const columns: Column[] = useMemo(
    () => [
      { field: "storeName", headerName: "Store Name", width: 140, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "department", headerName: "Department", width: 140, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "mainDepartment", headerName: "Main Dept", width: 110, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "subDepartment", headerName: "Sub Dept", width: 110, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "subSubDepartment", headerName: "SubSub Dept", width: 110, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "qty", headerName: "Qty", width: 100, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (v) => qtyRenderer(v) },
      { field: "cost", headerName: "Cost", width: 110, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (v) => currencyRenderer(v) },
      { field: "price", headerName: "Price", width: 110, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (v) => currencyRenderer(v) },
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
    } catch {
      /* ignore */
    }
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
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Suppliers: ${res.status}`))))
      .then((data: { isSuccess?: boolean; IsSuccess?: boolean; response?: unknown[]; Response?: unknown[] }) => {
        const ok = data?.isSuccess === true || data?.IsSuccess === true
        const list = data?.response ?? data?.Response
        if (ok && Array.isArray(list)) {
          const mapped: LookupOption[] = (list as { SupplierID?: string; supplierID?: string; Name?: string; name?: string; SupplierNo?: string; supplierNo?: string; code?: string }[])
            .map((s) => ({
              id: String(s.SupplierID ?? s.supplierID ?? "").trim(),
              name: (s.Name ?? s.name ?? "").trim(),
              code: (s.SupplierNo ?? s.supplierNo ?? s.code ?? "").trim(),
            }))
            .filter((x) => x.id && x.name)
          mapped.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }))
          setVendors(mapped)
        } else setVendors([])
      })
      .catch(() => setVendors([]))
      .finally(() => setLoadingVendors(false))

    setLoadingDepartments(true)
    fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_DEPARTMENTS, { headers })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Departments: ${res.status}`))))
      .then((data: { isSuccess?: boolean; IsSuccess?: boolean; response?: unknown[]; Response?: unknown[] }) => {
        const ok = data?.isSuccess === true || data?.IsSuccess === true
        const list = data?.response ?? data?.Response
        if (ok && Array.isArray(list)) {
          setDepartments(
            (list as { DepartmentStoreID?: string; departmentStoreID?: string; id?: string; Name?: string; name?: string }[]).map((d) => ({
              id: String(d.DepartmentStoreID ?? d.departmentStoreID ?? d.id ?? ""),
              name: (d.Name ?? d.name ?? "").trim(),
            }))
          )
        } else setDepartments([])
      })
      .catch(() => setDepartments([]))
      .finally(() => setLoadingDepartments(false))

    setLoadingBrands(true)
    fetch(API_ENDPOINTS.MANUFACTURERS.GET_ALL, { headers })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Brands: ${res.status}`))))
      .then((data: { isSuccess?: boolean; IsSuccess?: boolean; response?: unknown[]; Response?: unknown[]; data?: unknown[] }) => {
        const ok = data?.isSuccess === true || data?.IsSuccess === true
        const list = data?.response ?? data?.Response ?? data?.data
        if (ok && Array.isArray(list)) {
          const mapped: LookupOption[] = (list as { ManufacturerID?: string; manufacturerID?: string; id?: string; ManufacturerName?: string; manufacturerName?: string; name?: string }[])
            .map((b) => ({
              id: String(b.ManufacturerID ?? b.manufacturerID ?? b.id ?? "").trim(),
              name: (b.ManufacturerName ?? b.manufacturerName ?? b.name ?? "").trim(),
            }))
            .filter((x) => x.id && x.name)
          mapped.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }))
          setBrands(mapped)
        } else setBrands([])
      })
      .catch(() => setBrands([]))
      .finally(() => setLoadingBrands(false))
  }, [getAuthHeaders, getLocalUserId])

  useLayoutEffect(() => {
    if (!filters) return
    const from = filters.dateFrom || getDefaultFrom()
    const to = filters.dateTo || getDefaultTo()
    const storeId = filters.storeId != null ? String(filters.storeId) : ""
    const storeName = filters.storeName?.trim() || (stores.find((s) => s.id === storeId)?.name) || "All Stores"
    setDateFrom(from)
    setDateTo(to)
    setScreenStoreId(storeId)
    setScreenVendorId(filters.vendorId ?? "")
    setScreenDepartmentId(filters.departmentId ?? "")
    setScreenBrandId(filters.brandId ?? "")
    setAppliedDateFrom(from)
    setAppliedDateTo(to)
    setAppliedStoreId(storeId)
    setAppliedStoreName(storeId ? storeName : "All Stores")
    setAppliedVendorId(filters.vendorId ?? "")
    setAppliedDepartmentId(filters.departmentId ?? "")
    setAppliedBrandId(filters.brandId ?? "")
    setAppliedBrandName(filters.brandId && filters.brandName ? filters.brandName : "All Brands")
    if (stores.length > 0) setRunSearchAfterFilters(true)
  }, [filters?.dateFrom, filters?.dateTo, filters?.storeId, filters?.storeName, filters?.vendorId, filters?.departmentId, filters?.brandId, filters?.brandName, stores])

  useEffect(() => {
    if (!runSearchAfterFilters) return
    setRunSearchAfterFilters(false)
    handleSearchRef.current?.()
  }, [runSearchAfterFilters])

  useEffect(() => {
    if (filters && (filters.dateFrom || filters.dateTo || filters.storeId || filters.vendorId || filters.departmentId || filters.brandId)) setRunSearchAfterFilters(true)
  }, [])

  const handleSearch = useCallback(() => {
    const storeName = screenStoreId ? (stores.find((s) => s.id === screenStoreId)?.name ?? (filters?.storeId === screenStoreId ? filters.storeName : undefined) ?? "Selected Store") : "All Stores"
    const brandName = screenBrandId ? (brands.find((b) => b.id === screenBrandId)?.name ?? "Selected Brand") : "All Brands"
    setAppliedDateFrom(dateFrom)
    setAppliedDateTo(dateTo)
    setAppliedStoreId(screenStoreId)
    setAppliedStoreName(storeName)
    setAppliedVendorId(screenVendorId)
    setAppliedDepartmentId(screenDepartmentId)
    setAppliedBrandId(screenBrandId)
    setAppliedBrandName(brandName)
    setLoadingReportData(true)
    setReportError(null)

    const body = {
      fromDate: dateFrom ? new Date(dateFrom + "T00:00:00").toISOString().slice(0, 10) : null,
      toDate: dateTo ? new Date(dateTo + "T23:59:59").toISOString().slice(0, 10) : null,
      storeId: screenStoreId && /^[0-9a-f-]{36}$/i.test(screenStoreId) ? screenStoreId : null,
      supplierIds: screenVendorId && /^[0-9a-f-]{36}$/i.test(screenVendorId) ? screenVendorId : "",
      departmentIds: screenDepartmentId && /^[0-9a-f-]{36}$/i.test(screenDepartmentId) ? screenDepartmentId : "",
      brandNames: screenBrandId ? (brands.find((b) => b.id === screenBrandId)?.name ?? "") : "",
    }

    fetch(API_ENDPOINTS.REPORTS.RECEIVE_INVENTORY_VALUE, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setReportError((data?.message ?? data?.Message ?? `Request failed (${res.status})`) as string)
          setRows([])
          return
        }
        const ok = data?.isSuccess === true || data?.IsSuccess === true
        if (!ok) {
          setReportError((data?.message ?? data?.Message ?? "Report request failed") as string)
          setRows([])
          return
        }
        const resp = data?.response ?? data?.Response
        const rawList = Array.isArray(resp) ? resp : Array.isArray((resp as Record<string, unknown>)?.data) ? (resp as Record<string, unknown>).data : Array.isArray((resp as Record<string, unknown>)?.Data) ? (resp as Record<string, unknown>).Data : []
        setRows((rawList as Record<string, unknown>[]).map((row) => toCamelCaseRow(row)))
      })
      .catch((err) => {
        setReportError(err?.message ?? "Network or server error")
        setRows([])
      })
      .finally(() => {
        setLoadingReportData(false)
        setGridKey((k) => k + 1)
        setHasSearched(true)
      })
  }, [dateFrom, dateTo, screenStoreId, screenVendorId, screenDepartmentId, screenBrandId, stores, brands, filters?.storeId, filters?.storeName, getAuthHeaders])

  useEffect(() => {
    handleSearchRef.current = handleSearch
  }, [handleSearch])

  const displayStoreName = appliedStoreId ? appliedStoreName || "Selected Store" : "All Stores"
  const displayVendorName = appliedVendorId ? (vendors.find((v) => v.id === appliedVendorId)?.name ?? "Selected Supplier") : "All Suppliers"
  const displayDepartmentName = appliedDepartmentId ? (departments.find((d) => d.id === appliedDepartmentId)?.name ?? "Selected Department") : "All Departments"
  const displayBrandName = appliedBrandId ? (appliedBrandName || (brands.find((b) => b.id === appliedBrandId)?.name ?? "Selected Brand")) : "All Brands"

  // Pattern A export — report data lives in the in-memory `rows` array (loaded
  // by Search); no separate all-records endpoint, so export the rows directly.
  // No per-row date filter, so `useExportModal` with no `filters`.
  const fetchAllData = useCallback(async (): Promise<any[]> => rows, [rows])

  const exportSubtitle = `${displayStoreName} | ${appliedDateFrom && appliedDateTo ? `${formatLocalDate(appliedDateFrom)} - ${formatLocalDate(appliedDateTo)}` : ""}`.trim()

  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "receive-inventory-value",
    pdfOptions: {
      title: "Receive Inventory Value",
      subtitle: exportSubtitle,
      orientation: "landscape",
    },
  })

  return (
    <div className="h-full w-full min-w-0 flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 w-full min-w-0">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Receive Inventory Value</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-600 dark:text-gray-300">
            <span><span className="font-medium text-gray-500 dark:text-gray-400">Store:</span> {displayStoreName}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span><span className="font-medium text-gray-500 dark:text-gray-400">Supplier:</span> {displayVendorName}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span><span className="font-medium text-gray-500 dark:text-gray-400">Department:</span> {displayDepartmentName}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span><span className="font-medium text-gray-500 dark:text-gray-400">Brand:</span> {displayBrandName}</span>
            {appliedDateFrom && appliedDateTo && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span><span className="font-medium text-gray-500 dark:text-gray-400">Date range:</span> {formatLocalDate(appliedDateFrom)} – {formatLocalDate(appliedDateTo)}</span>
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
                  <Flatpickr value={dateFrom} onChange={([d]) => { if (d) { const fromStr = d.toISOString().split("T")[0]; setDateFrom(fromStr); setDateTo((p) => (p && p < fromStr ? fromStr : p)) } }} options={flatpickrOptions} placeholder="From" className="w-full h-10 pl-9 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></span>
                </div>
                <span className="text-gray-400 dark:text-gray-500 font-medium text-sm">to</span>
                <div className="flatpickr-wrapper w-[130px] relative">
                  <Flatpickr value={dateTo} onChange={([d]) => { if (d) { const toStr = d.toISOString().split("T")[0]; setDateTo(dateFrom && toStr < dateFrom ? dateFrom : toStr) } }} options={flatpickrOptions} placeholder="To" className="w-full h-10 pl-9 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></span>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Store</label>
              <select value={screenStoreId} onChange={(e) => setScreenStoreId(e.target.value)} disabled={loadingStores} className="h-10 min-w-[160px] px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60">
                <option value="">All Stores</option>
                {filters?.storeId != null && filters?.storeName && !stores.some((s) => String(s.id) === String(filters.storeId)) && <option value={String(filters.storeId)}>{filters.storeName}</option>}
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Supplier</label>
              <select value={screenVendorId} onChange={(e) => setScreenVendorId(e.target.value)} disabled={loadingVendors} className="h-10 min-w-[160px] px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60">
                <option value="">All Suppliers</option>
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Department</label>
              <select value={screenDepartmentId} onChange={(e) => setScreenDepartmentId(e.target.value)} disabled={loadingDepartments} className="h-10 min-w-[140px] px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60">
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Brand</label>
              <select value={screenBrandId} onChange={(e) => setScreenBrandId(e.target.value)} disabled={loadingBrands} className="h-10 min-w-[140px] px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60">
                <option value="">All Brands</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="ml-auto flex items-center rounded-lg overflow-visible border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 flex-shrink-0">
              <button onClick={handleSearch} disabled={loadingReportData} type="button" className="h-10 px-5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors flex items-center gap-2 border-0 border-r border-gray-200 dark:border-gray-600 disabled:opacity-70 disabled:cursor-not-allowed">
                {loadingReportData ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
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
        <div className="mx-6 mt-2 px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">{reportError}</div>
      )}

      <div className="flex-1 flex flex-col min-h-0 p-6 w-full min-w-0">
        <div className="flex-1 min-h-0 overflow-auto flex flex-col">
          {hasSearched && !loadingReportData && rows.length === 0 && !reportError && (
            <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400 text-sm">No data. Try a different date range, store, supplier, department, or brand.</div>
          )}
          <div className="min-h-0 flex-1">
            <ServerGrid hideDefaultContextMenuItems={true} key={gridKey} columns={columns} data={rows} serverSide={false} loading={loadingReportData} getAuthHeaders={getAuthHeaders} pagination={true} pageSize={100} headerSearch={true} showActions={false} columnChooser={true} title="Receive Inventory Value" defaultSortColumn="storeName" containerWidth="100%" gridId="receive-inventory-value-report" getRowId={(row) => `${(row as Record<string, unknown>).storeName}-${(row as Record<string, unknown>).department}-${(row as Record<string, unknown>).qty}`.slice(0, 200)} />
          </div>
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default ReceiveInventoryValueReportPage
