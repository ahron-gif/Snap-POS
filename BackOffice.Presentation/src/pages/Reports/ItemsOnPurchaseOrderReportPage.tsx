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

interface ItemsOnPurchaseOrderReportProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    storeId?: string
    storeName?: string
    vendorId?: string
    departmentId?: string
    brandId?: string
    brandName?: string
    filterPartial?: boolean
    filterClosed?: boolean
  }
}

interface LookupOption {
  id: string
  name: string
  code?: string
}

const getDefaultFrom = (f?: ItemsOnPurchaseOrderReportProps["filters"]) =>
  f?.dateFrom || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
const getDefaultTo = (f?: ItemsOnPurchaseOrderReportProps["filters"]) =>
  f?.dateTo || new Date().toISOString().split("T")[0]

function formatLocalDate(dateStr: string): string {
  if (!dateStr) return ""
  const parts = dateStr.split("-").map(Number)
  if (parts.length !== 3) return dateStr
  const [y, m, d] = parts
  return new Date(y, m - 1, d).toLocaleDateString()
}

const qty3Renderer = (v: any) => (v == null ? "" : typeof v === "number" ? v.toFixed(3) : String(v))
const currencyRenderer = (v: any) =>
  v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const SUPPLIERS = [
  { name: "A to Z", no: "A TO Z" },
  { name: "Solo time ltd", no: "100" },
  { name: "ZAPF CREATION", no: "1" },
  { name: "ACADEMIC", no: "IA" },
  { name: "Small world living", no: "247" },
  { name: "Sports Hoop", no: "ST" },
  { name: "DYLAN SUPPLY", no: "145" },
]

function generateSampleRows(
  count: number,
  storeName: string,
  vendorOptions?: LookupOption[],
  departmentOptions?: LookupOption[],
  dateFrom?: string,
  dateTo?: string,
  storeOptions?: LookupOption[],
  brandOptions?: LookupOption[]
): Record<string, any>[] {
  const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null
  const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null
  const rangeMs = fromTs != null && toTs != null && toTs >= fromTs ? toTs - fromTs : 365 * 24 * 60 * 60 * 1000
  const baseMs = fromTs != null && toTs != null && toTs >= fromTs ? fromTs : Date.now() - rangeMs

  return Array.from({ length: count }, (_, i) => {
    const qtyOrdered = Math.round((Math.random() * 90 + 2) * 1000) / 1000
    const received = Math.round((Math.random() * (qtyOrdered * 0.6)) * 1000) / 1000
    const totalPrice = Math.round((Math.random() * 10000 + 10) * 100) / 100
    const totalCost = Math.round((Math.random() * totalPrice * 0.9) * 100) / 100
    const onHand = Math.round((Math.random() * 100 - 30) * 1000) / 1000
    const store = storeOptions?.length ? storeOptions[i % storeOptions.length] : null
    const rowStoreId = store?.id
    const rowStoreName = store?.name ?? storeName
    const supplier = vendorOptions?.length
      ? vendorOptions[i % vendorOptions.length]
      : SUPPLIERS[i % SUPPLIERS.length]
    const supplierId = vendorOptions?.length ? (supplier as LookupOption).id : undefined
    const supplierName = vendorOptions?.length ? supplier.name : (supplier as { name: string; no: string }).name
    const supplierNo = vendorOptions?.length ? ((supplier as LookupOption).code ?? "") : (supplier as { name: string; no: string }).no
    const dept = departmentOptions?.length ? departmentOptions[i % departmentOptions.length] : null
    const brand = brandOptions?.length ? brandOptions[i % brandOptions.length] : null
    const upc = String(10000000 + i * 111).slice(0, 12)
    const orderDate = new Date(baseMs + Math.random() * rangeMs)
    const orderDateStr = `${orderDate.getMonth() + 1}/${orderDate.getDate()}/${orderDate.getFullYear()}`
    const orderDateISO = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}-${String(orderDate.getDate()).padStart(2, "0")}`
    const status = received >= qtyOrdered ? "Received" : received > 0 ? "Partial" : "Open"
    return {
      name: `#${upc}, Item Desc ${i + 1} -${Math.floor(Math.random() * 200)}`,
      poNumber: i % 5 === 0 ? "" : [`GFRGDSF${1421 + i}`, "77015.08", "1234-MODEL-NO1"][i % 3],
      modelNumber: i % 4 === 0 ? "1538" : "",
      orderDate: orderDateStr,
      upc,
      qtyOrdered,
      received,
      storeName: rowStoreName,
      supplierName,
      supplierNo,
      totalPrice,
      totalCost,
      groups: 1,
      user: i % 3 === 0 ? "AMSTERDAM,BELTS 1" : "",
      onHand,
      _status: status,
      _storeId: rowStoreId,
      _supplierId: supplierId,
      _departmentId: dept?.id,
      _brandId: brand?.id,
      _orderDateISO: orderDateISO,
    }
  })
}

const ItemsOnPurchaseOrderReportPage: React.FC<ItemsOnPurchaseOrderReportProps> = ({ filters }) => {
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
  const [filterPartial, setFilterPartial] = useState(filters?.filterPartial !== undefined ? !!filters.filterPartial : true)
  const [filterClosed, setFilterClosed] = useState(filters?.filterClosed !== undefined ? !!filters.filterClosed : false)

  const [appliedDateFrom, setAppliedDateFrom] = useState<string>(() => getDefaultFrom(filters))
  const [appliedDateTo, setAppliedDateTo] = useState<string>(() => getDefaultTo(filters))
  const [appliedStoreId, setAppliedStoreId] = useState<string>(filters?.storeId ?? "")
  const [appliedStoreName, setAppliedStoreName] = useState<string>(filters?.storeName ?? "All Stores")
  const [appliedVendorId, setAppliedVendorId] = useState<string>(filters?.vendorId ?? "")
  const [appliedDepartmentId, setAppliedDepartmentId] = useState<string>(filters?.departmentId ?? "")
  const [appliedBrandId, setAppliedBrandId] = useState<string>(filters?.brandId ?? "")
  const [appliedBrandName, setAppliedBrandName] = useState<string>(filters?.brandName ?? "All Brands")

  const [rows, setRows] = useState<Record<string, any>[]>(() => generateSampleRows(500, "All Stores"))
  const [gridKey, setGridKey] = useState(0)
  const [loadingReportData, setLoadingReportData] = useState(false)
  const [runSearchAfterFilters, setRunSearchAfterFilters] = useState(false)
  const handleSearchRef = useRef<() => void>(() => {})
  const flatpickrOptions = useMemo(() => ({ dateFormat: "Y-m-d", allowInput: true }), [])

  const columns: Column[] = useMemo(
    () => [
      { field: "name", headerName: "Name", width: 280, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "poNumber", headerName: "Po #", width: 120, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "modelNumber", headerName: "Model Number", width: 120, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "orderDate", headerName: "Order Date", width: 110, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "upc", headerName: "UPC", width: 120, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "qtyOrdered", headerName: "Qty Ordered", width: 100, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (v) => qty3Renderer(v) },
      { field: "received", headerName: "Received", width: 100, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (v) => qty3Renderer(v) },
      { field: "storeName", headerName: "Store Name /", width: 140, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "supplierName", headerName: "Supplier Name", width: 160, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "supplierNo", headerName: "Supplier No", width: 100, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "totalPrice", headerName: "Total Price", width: 120, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (v) => currencyRenderer(v) },
      { field: "totalCost", headerName: "Total Cost", width: 120, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (v) => currencyRenderer(v) },
      { field: "groups", headerName: "Groups", width: 80, sortable: true, filterable: false, visible: true, dataType: "number" },
      { field: "user", headerName: "User", width: 160, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "onHand", headerName: "On Hand", width: 100, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (v) => qty3Renderer(v) },
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
    } catch { }
    return ""
  }, [])

  useEffect(() => {
    const userId = getLocalUserId()
    const headers = getAuthHeaders()
    if (userId) {
      setLoadingStores(true)
      fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${userId}`, { headers })
        .then(res => res.json())
        .then(data => {
          if (data.isSuccess && data.response) {
            setStores(data.response.map((s: { storeID: string | number; storeName: string; storeNo?: number }) => ({
              id: String(s.storeID),
              name: s.storeName,
              code: s.storeNo?.toString(),
            })))
          }
        })
        .catch(console.error)
        .finally(() => setLoadingStores(false))
    }
    setLoadingVendors(true)
    fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_SUPPLIERS_LOOKUP, { headers })
      .then(res => {
        if (!res.ok) throw new Error(`Suppliers: ${res.status}`)
        return res.json()
      })
      .then((data: any) => {
        const ok = data?.isSuccess === true || data?.IsSuccess === true
        const list = data?.response ?? data?.Response
        if (ok && Array.isArray(list)) {
          const mapped: LookupOption[] = list.map((s: any) => {
            const rawId = s.SupplierID ?? s.supplierID ?? s.supplierId ?? s.id
            const id = rawId != null ? String(rawId).trim() : ""
            const name = (s.Name ?? s.name ?? "").trim()
            const code = (s.SupplierNo ?? s.supplierNo ?? s.code ?? "").trim()
            return { id, name, code }
          }).filter((x: LookupOption) => x.id !== "" && x.name !== "")
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

    setLoadingDepartments(true)
    fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_DEPARTMENTS, { headers })
      .then(res => {
        if (!res.ok) throw new Error(`Departments: ${res.status}`)
        return res.json()
      })
      .then((data: any) => {
        const ok = data?.isSuccess === true || data?.IsSuccess === true
        const list = data?.response ?? data?.Response
        if (ok && Array.isArray(list)) {
          setDepartments(list.map((d: any) => ({
            id: String(d.DepartmentStoreID ?? d.departmentStoreID ?? d.departmentStoreId ?? d.id ?? ""),
            name: d.Name ?? d.name ?? "",
          })))
        } else {
          setDepartments([])
        }
      })
      .catch((err) => {
        console.error("Departments lookup failed:", err)
        setDepartments([])
      })
      .finally(() => setLoadingDepartments(false))

    setLoadingBrands(true)
    fetch(API_ENDPOINTS.MANUFACTURERS.GET_ALL, { headers })
      .then(res => {
        if (!res.ok) throw new Error(`Brands: ${res.status}`)
        return res.json()
      })
      .then((data: any) => {
        const ok = data?.isSuccess === true || data?.IsSuccess === true
        const list = data?.response ?? data?.Response ?? data?.data
        if (ok && Array.isArray(list)) {
          const mapped: LookupOption[] = list.map((b: any) => {
            const rawId = b.ManufacturerID ?? b.manufacturerID ?? b.manufacturerId ?? b.id
            const id = rawId != null ? String(rawId).trim() : ""
            const name = (b.ManufacturerName ?? b.manufacturerName ?? b.name ?? "").trim()
            return { id, name }
          }).filter((x: LookupOption) => x.id !== "" && x.name !== "")
          mapped.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }))
          setBrands(mapped)
        } else {
          setBrands([])
        }
      })
      .catch((err) => {
        console.error("Brands lookup failed:", err)
        setBrands([])
      })
      .finally(() => setLoadingBrands(false))
  }, [getAuthHeaders, getLocalUserId])

  useLayoutEffect(() => {
    if (!filters) return
    const from = filters.dateFrom || getDefaultFrom()
    let to = filters.dateTo || getDefaultTo()
    if (to < from) to = from
    const storeId = filters.storeId != null ? String(filters.storeId) : ""
    const storeName = filters.storeName?.trim() || (stores.find(s => s.id === storeId || String(s.id) === storeId)?.name) || "All Stores"
    setDateFrom(from)
    setDateTo(to)
    setScreenStoreId(storeId)
    setScreenVendorId(filters.vendorId ?? "")
    setScreenDepartmentId(filters.departmentId ?? "")
    setScreenBrandId(filters.brandId ?? "")
    setFilterPartial(filters.filterPartial !== undefined ? !!filters.filterPartial : true)
    setFilterClosed(filters.filterClosed !== undefined ? !!filters.filterClosed : false)
    setAppliedDateFrom(from)
    setAppliedDateTo(to)
    setAppliedStoreId(storeId)
    setAppliedStoreName(storeId ? storeName : "All Stores")
    setAppliedVendorId(filters.vendorId ?? "")
    setAppliedDepartmentId(filters.departmentId ?? "")
    setAppliedBrandId(filters.brandId ?? "")
    setAppliedBrandName(filters.brandId && filters.brandName ? filters.brandName : "All Brands")
    if (stores.length > 0) setRunSearchAfterFilters(true)
  }, [filters, filters?.dateFrom, filters?.dateTo, filters?.storeId, filters?.storeName, filters?.vendorId, filters?.departmentId, filters?.brandId, filters?.brandName, filters?.filterPartial, filters?.filterClosed, stores])

  useEffect(() => {
    if (!runSearchAfterFilters) return
    setRunSearchAfterFilters(false)
    handleSearchRef.current?.()
  }, [runSearchAfterFilters])

  const handleSearch = useCallback(() => {
    const storeName = screenStoreId
      ? (stores.find(s => s.id === screenStoreId)?.name ?? (filters?.storeId === screenStoreId ? filters.storeName : undefined) ?? "Selected Store")
      : "All Stores"
    const brandName = screenBrandId ? (brands.find(b => b.id === screenBrandId)?.name ?? "Selected Brand") : "All Brands"
    setAppliedDateFrom(dateFrom)
    setAppliedDateTo(dateTo)
    setAppliedStoreId(screenStoreId)
    setAppliedStoreName(storeName)
    setAppliedVendorId(screenVendorId)
    setAppliedDepartmentId(screenDepartmentId)
    setAppliedBrandId(screenBrandId)
    setAppliedBrandName(brandName)
    setLoadingReportData(true)
    setTimeout(() => {
      let data = generateSampleRows(500, storeName, vendors, departments, dateFrom, dateTo, stores, brands)
      if (dateFrom && dateTo) {
        data = data.filter((r: Record<string, any>) => {
          const d = r._orderDateISO
          return d && d >= dateFrom && d <= dateTo
        })
      }
      if (screenStoreId) data = data.filter((r: Record<string, any>) => String(r._storeId) === String(screenStoreId))
      if (screenVendorId) data = data.filter((r: Record<string, any>) => r._supplierId === screenVendorId)
      if (screenDepartmentId) data = data.filter((r: Record<string, any>) => r._departmentId === screenDepartmentId)
      if (screenBrandId) data = data.filter((r: Record<string, any>) => r._brandId === screenBrandId)
      if (filterPartial) data = data.filter((r: Record<string, any>) => r._status === "Open" || r._status === "Partial")
      if (filterClosed) data = data.filter((r: Record<string, any>) => r._status === "Received")
      if (screenStoreId && storeName) {
        data = data.map((r: Record<string, any>) => ({ ...r, storeName }))
      }
      setRows(data)
      setGridKey(prev => prev + 1)
      setLoadingReportData(false)
    }, 0)
  }, [dateFrom, dateTo, screenStoreId, screenVendorId, screenDepartmentId, screenBrandId, stores, vendors, departments, brands, filterPartial, filterClosed, filters?.storeId, filters?.storeName])

  useEffect(() => {
    handleSearchRef.current = handleSearch
  }, [handleSearch])

  const handlePartialChange = useCallback((checked: boolean) => {
    setFilterPartial(checked)
    if (checked) setFilterClosed(false)
  }, [])
  const handleClosedChange = useCallback((checked: boolean) => {
    setFilterClosed(checked)
    if (checked) setFilterPartial(false)
  }, [])

  const displayStoreName = appliedStoreId ? (appliedStoreName || "Selected Store") : "All Stores"
  const displayVendorName = appliedVendorId ? (vendors.find(v => v.id === appliedVendorId)?.name ?? "Selected Supplier") : "All Suppliers"
  const displayDepartmentName = appliedDepartmentId ? (departments.find(d => d.id === appliedDepartmentId)?.name ?? "Selected Department") : "All Departments"
  const displayBrandName = appliedBrandId ? (appliedBrandName || (brands.find(b => b.id === appliedBrandId)?.name ?? "Selected Brand")) : "All Brands"
  const displayPoStatus = filterPartial ? "Partial / Open" : filterClosed ? "Closed" : null

  // Pattern A export — rows are generated/filtered client-side and held in the
  // in-memory `rows` array; there is no all-records endpoint, so export the
  // rows directly. No per-row date filter, so `useExportModal` with no `filters`.
  const fetchAllData = useCallback(async (): Promise<any[]> => rows, [rows])

  const exportSubtitle = `${displayStoreName} | ${appliedDateFrom && appliedDateTo ? `${formatLocalDate(appliedDateFrom)} - ${formatLocalDate(appliedDateTo)}` : ""}`.trim()

  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "items-on-purchase-order",
    pdfOptions: {
      title: "Items on Purchase Order",
      subtitle: exportSubtitle,
      orientation: "landscape",
    },
  })

  return (
    <div className="h-full w-full min-w-0 flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 w-full min-w-0">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Items on Purchase Order</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-600 dark:text-gray-300">
            <span><span className="font-medium text-gray-500 dark:text-gray-400">Store Name:</span> {displayStoreName}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span><span className="font-medium text-gray-500 dark:text-gray-400">Supplier:</span> {displayVendorName}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span><span className="font-medium text-gray-500 dark:text-gray-400">Department:</span> {displayDepartmentName}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span><span className="font-medium text-gray-500 dark:text-gray-400">Brand:</span> {displayBrandName}</span>
            {appliedDateFrom && appliedDateTo && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Date range:</span> {formatLocalDate(appliedDateFrom)} – {formatLocalDate(appliedDateTo)}
                </span>
              </>
            )}
            {displayPoStatus && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span><span className="font-medium text-gray-500 dark:text-gray-400">PO Status:</span> {displayPoStatus}</span>
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
                    setDateTo(prev => (prev && prev < fromStr ? fromStr : prev))
                  }}
                    options={flatpickrOptions}
                    placeholder="From"
                    className="w-full h-10 pl-9 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
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
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
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
                {filters?.storeId != null && filters?.storeName && !stores.some(s => String(s.id) === String(filters.storeId)) && (
                  <option value={String(filters.storeId)}>{filters.storeName}</option>
                )}
                {stores.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
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
                {vendors.map(v => (<option key={v.id} value={v.id}>{v.name}</option>))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Department</label>
              <select
                value={screenDepartmentId}
                onChange={(e) => setScreenDepartmentId(e.target.value)}
                disabled={loadingDepartments}
                className="h-10 min-w-[140px] px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60"
              >
                <option value="">All Departments</option>
                {departments.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Brand</label>
              <select
                value={screenBrandId}
                onChange={(e) => setScreenBrandId(e.target.value)}
                disabled={loadingBrands}
                className="h-10 min-w-[140px] px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60"
              >
                <option value="">All Brands</option>
                {brands.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}
              </select>
            </div>
            <div className="flex items-center gap-4 h-10 pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterPartial}
                  onChange={(e) => handlePartialChange(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500 bg-white dark:bg-gray-700"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Partial / Open</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterClosed}
                  onChange={(e) => handleClosedChange(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500 bg-white dark:bg-gray-700"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Closed</span>
              </label>
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
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
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

      <div className="flex-1 flex flex-col min-h-0 p-6 w-full min-w-0">
        <div className="flex-1 min-h-0 overflow-auto flex flex-col">
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
              title="Items on Purchase Order"
              defaultSortColumn="orderDate"
              containerWidth="100%"
              gridId="items-on-purchase-order-report"
              getRowId={(row) => `${row.upc}-${row.poNumber || ""}-${row.supplierNo}-${row.orderDate}`}
            />
          </div>
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default ItemsOnPurchaseOrderReportPage
