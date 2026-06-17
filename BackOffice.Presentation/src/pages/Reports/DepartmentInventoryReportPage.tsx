import React, { useState, useCallback, useMemo, useEffect, useLayoutEffect } from "react"
import Loader from "../../components/ui/loader/Loader"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { useStore } from "../../context/StoreContext"
import { API_ENDPOINTS } from "../../constants/api"
import { Column as GridUtilsColumn } from "../../gridUtils"
import ExportModal from "../../components/common/ExportModal"
import { useExportModal } from "../../hooks/useExportModal"
import axios from "axios"
import SearchableSelect, { SelectOption } from "../../components/form/SearchableSelect"

interface DepartmentInventoryReportProps {
  reportId?: string
  reportName?: string
  filters?: {
    storeId?: string
    asOfDate?: string
    /** From generic report filter modal (date range "To" = as of date) */
    dateTo?: string
  }
}

function getDefaultStoreId(f?: { storeId?: string }) {
  return f?.storeId ?? ""
}
function getDefaultAsOfDate(f?: { asOfDate?: string; dateTo?: string }) {
  return f?.asOfDate ?? f?.dateTo ?? new Date().toISOString().slice(0, 10)
}

const GRID_PADDING = 180

function toNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const DepartmentInventoryReportPage: React.FC<DepartmentInventoryReportProps> = ({ reportName, filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()

  const [storeId, setStoreId] = useState<string>(() => getDefaultStoreId(filters))
  const [asOfDate, setAsOfDate] = useState<string>(() => getDefaultAsOfDate(filters))
  const [appliedStoreId, setAppliedStoreId] = useState<string>(() => getDefaultStoreId(filters))
  const [appliedAsOfDate, setAppliedAsOfDate] = useState<string>(() => getDefaultAsOfDate(filters))
  const [totalRecords, setTotalRecords] = useState(0)
  const [gridKey, setGridKey] = useState(0)
  const [screenWidth, setScreenWidth] = useState(() => typeof window !== "undefined" ? window.innerWidth : 1600)
  const [grandTotals, setGrandTotals] = useState<{
    grandTotalOnHand: number
    grandTotalOnOrder: number
    grandTotalOnSaleOrder: number
    grandTotalCost: number
    grandTotalAVGCost: number
    grandTotalPrice: number
  }>({
    grandTotalOnHand: 0,
    grandTotalOnOrder: 0,
    grandTotalOnSaleOrder: 0,
    grandTotalCost: 0,
    grandTotalAVGCost: 0,
    grandTotalPrice: 0,
  })

  const [stores, setStores] = useState<SelectOption[]>([])
  const [loadingStores, setLoadingStores] = useState(false)

  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailDepartmentStoreId, setDetailDepartmentStoreId] = useState<string | null>(null)
  const [detailStoreId, setDetailStoreId] = useState<string | null>(null)
  const [detailDepartmentName, setDetailDepartmentName] = useState<string>("")
  const [detailItems, setDetailItems] = useState<any[]>([])
  const [detailItemsLoading, setDetailItemsLoading] = useState(false)
  const [detailTotals, setDetailTotals] = useState<{ totalQtyOnHand: number; totalCostValue: number; totalRetailValue: number } | null>(null)

  const getLocalUserId = useCallback(() => {
    try {
      const userData = localStorage.getItem("userData")
      if (!userData) return ""
      const parsed = JSON.parse(userData)
      return parsed.localUserId ?? ""
    } catch {
      return ""
    }
  }, [])

  useEffect(() => {
    const headers = getAuthHeaders()
    const userId = getLocalUserId()

    if (stores.length === 0) {
      setLoadingStores(true)
      const url = userId ? `${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${userId}` : API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES
      fetch(url, { headers })
        .then((res) => res.json())
        .then((data) => {
          if (data?.isSuccess && Array.isArray(data.response)) {
            setStores(
              data.response.map((s: any) => ({
                value: String(s.storeID ?? s.id ?? s.storeId ?? ""),
                label: s.storeName ?? s.name ?? "",
              }))
            )
          }
        })
        .catch(console.error)
        .finally(() => setLoadingStores(false))
    }

  }, [getAuthHeaders, getLocalUserId, stores.length])

  useLayoutEffect(() => {
    const sid = filters?.storeId ?? ""
    const ad = filters?.asOfDate ?? filters?.dateTo ?? getDefaultAsOfDate(filters)
    setStoreId(sid)
    setAsOfDate(ad)
    setAppliedStoreId(sid)
    setAppliedAsOfDate(ad)
  }, [filters?.storeId, filters?.asOfDate, filters?.dateTo])

  useEffect(() => {
    const onResize = () => setScreenWidth(window.innerWidth)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const columns: Column[] = useMemo(() => {
    const available = Math.max(800, screenWidth - GRID_PADDING)
    const totalWeight = 12 + 12 + 12 + 14 + 8 + 8 + 8 + 10 + 10 + 10 + 14
    const w = (weight: number, min: number) => Math.max(min, Math.round((available * weight) / totalWeight))
    const fmtMoney = (v: number) => (v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
    const str = (r: any, key: string) => r?.[key] ?? r?.[key.charAt(0).toLowerCase() + key.slice(1)] ?? ""
    const num = (r: any, key: string) => Number(r?.[key] ?? r?.[key.charAt(0).toLowerCase() + key.slice(1)] ?? 0)

    return [
      { field: "mainDepartment", headerName: "Main Department", width: w(12, 100), sortable: true, filterable: true, visible: true, dataType: "string", cellRenderer: (_: unknown, row?: any) => (row ? str(row, "MainDepartment") : "") },
      { field: "subDepartment", headerName: "Sub Department", width: w(12, 100), sortable: true, filterable: true, visible: true, dataType: "string", cellRenderer: (_: unknown, row?: any) => (row ? str(row, "SubDepartment") : "") },
      { field: "subSubDepartment", headerName: "SubSub Department", width: w(12, 100), sortable: true, filterable: true, visible: true, dataType: "string", cellRenderer: (_: unknown, row?: any) => (row ? str(row, "SubSubDepartment") : "") },
      { field: "name", headerName: "Name", width: w(14, 120), sortable: true, filterable: true, visible: true, dataType: "string", cellRenderer: (_: unknown, row?: any) => (row ? str(row, "Name") : "") },
      { field: "onHand", headerName: "On Hand", width: w(8, 80), sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (_: unknown, row?: any) => (row ? Number(num(row, "OnHand")).toLocaleString() : "0") },
      { field: "onOrder", headerName: "On Order", width: w(8, 80), sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (_: unknown, row?: any) => (row ? Number(num(row, "OnOrder")).toLocaleString() : "0") },
      { field: "onSaleOrder", headerName: "On Sale Order", width: w(8, 90), sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (_: unknown, row?: any) => (row ? Number(num(row, "OnSaleOrder")).toLocaleString() : "0") },
      { field: "cost", headerName: "Cost", width: w(10, 90), sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (_: unknown, row?: any) => (row ? fmtMoney(num(row, "Cost")) : "$0.00") },
      { field: "avgCost", headerName: "AVG Cost", width: w(10, 90), sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (_: unknown, row?: any) => (row ? fmtMoney(num(row, "AVGCost")) : "$0.00") },
      { field: "price", headerName: "Price", width: w(10, 90), sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (_: unknown, row?: any) => (row ? fmtMoney(num(row, "Price")) : "$0.00") },
      { field: "storeName", headerName: "Store Name", width: w(14, 120), sortable: true, filterable: true, visible: true, dataType: "string", cellRenderer: (_: unknown, row?: any) => (row ? str(row, "StoreName") : "") },
    ]
  }, [screenWidth])

  // Detail modal grid: columns for Items in Department (Ext Cost / Ext Price always visible; money supports negatives)
  const detailColumns: Column[] = useMemo(() => {
    const fmtMoney = (v: number) => {
      const n = Number(v)
      if (v == null || Number.isNaN(n)) return "$0.00"
      const abs = Math.abs(n)
      const s = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return n < 0 ? `-$${s}` : `$${s}`
    }
    const str = (v: unknown) => (v != null && v !== "" ? String(v) : "")
    return [
      { field: "itemNo", headerName: "Item No", width: 100, sortable: true, filterable: true, visible: true, dataType: "string", cellRenderer: (val: unknown, row?: any) => str(row?.itemNo ?? val) },
      { field: "description", headerName: "Description", width: 180, sortable: true, filterable: true, visible: true, dataType: "string", cellRenderer: (val: unknown, row?: any) => str(row?.description ?? val) },
      { field: "departmentName", headerName: "Department", width: 110, sortable: true, filterable: true, visible: true, dataType: "string", cellRenderer: (val: unknown, row?: any) => str(row?.departmentName ?? val) },
      { field: "qtyOnHand", headerName: "Qty On Hand", width: 95, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (_: unknown, row?: any) => (row != null ? Number(row.qtyOnHand ?? 0).toLocaleString() : "0") },
      { field: "cost", headerName: "Cost", width: 95, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (_: unknown, row?: any) => (row != null ? fmtMoney(Number(row.cost ?? 0)) : "$0.00") },
      { field: "price", headerName: "Price", width: 95, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (_: unknown, row?: any) => (row != null ? fmtMoney(Number(row.price ?? 0)) : "$0.00") },
      { field: "extCost", headerName: "Ext Cost", width: 100, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (_: unknown, row?: any) => (row != null ? fmtMoney(Number(row.extCost ?? 0)) : "$0.00") },
      { field: "extPrice", headerName: "Ext Price", width: 100, sortable: true, filterable: false, visible: true, dataType: "number", cellRenderer: (_: unknown, row?: any) => (row != null ? fmtMoney(Number(row.extPrice ?? 0)) : "$0.00") },
    ]
  }, [])

  // Normalize API item to grid row (handle various API response shapes)
  const detailGridData = useMemo(() => {
    return detailItems.map((item, index) => {
      const qty = toNum(
        item?.qtyOnHand ?? item?.QtyOnHand ?? item?.quantityOnHand ?? item?.QuantityOnHand ?? item?.onHand ?? item?.OnHand ?? 0
      )
      const cost = toNum(item?.cost ?? item?.Cost ?? item?.unitCost ?? item?.UnitCost ?? 0)
      const price = toNum(
        item?.retailPrice ?? item?.RetailPrice ?? item?.price ?? item?.Price ?? item?.sellingPrice ?? item?.SellingPrice ?? 0
      )
      const itemNo =
        item?.itemNo ?? item?.ItemNo ?? item?.itemID ?? item?.ItemID ?? item?.itemNumber ?? item?.ItemNumber ?? ""
      const description =
        item?.description ?? item?.Description ?? item?.productDescription ?? item?.ProductDescription ?? ""
      const departmentName =
        item?.departmentName ?? item?.DepartmentName ?? item?.department ?? item?.Department ?? ""
      return {
        itemNo: String(itemNo ?? ""),
        description: String(description ?? ""),
        departmentName: String(departmentName ?? ""),
        qtyOnHand: qty,
        cost,
        price,
        extCost: cost * qty,
        extPrice: price * qty,
        _rowId: item?.itemStoreId ?? item?.itemStoreID ?? item?.itemStoreID ?? `${itemNo}-${index}`,
      }
    })
  }, [detailItems])

  const additionalParams = useMemo(
    () => {
      const storeIdParam = appliedStoreId && String(appliedStoreId).trim() !== "" ? appliedStoreId : undefined
      const asOfDateParam = appliedAsOfDate && String(appliedAsOfDate).trim() !== "" ? appliedAsOfDate : undefined
      return { storeId: storeIdParam, asOfDate: asOfDateParam }
    },
    [appliedStoreId, appliedAsOfDate]
  )

  const handleApplyFilters = useCallback(() => {
    setAppliedStoreId(storeId)
    setAppliedAsOfDate(asOfDate)
    setGridKey((k) => k + 1)
  }, [storeId, asOfDate])

  const handleResponseLoaded = useCallback((responseData: Record<string, unknown>) => {
    const r = responseData as Record<string, unknown>
    setGrandTotals({
      grandTotalOnHand: Number(r?.grandTotalOnHand ?? r?.GrandTotalOnHand ?? 0),
      grandTotalOnOrder: Number(r?.grandTotalOnOrder ?? r?.GrandTotalOnOrder ?? 0),
      grandTotalOnSaleOrder: Number(r?.grandTotalOnSaleOrder ?? r?.GrandTotalOnSaleOrder ?? 0),
      grandTotalCost: Number(r?.grandTotalCost ?? r?.GrandTotalCost ?? 0),
      grandTotalAVGCost: Number(r?.grandTotalAVGCost ?? r?.GrandTotalAVGCost ?? 0),
      grandTotalPrice: Number(r?.grandTotalPrice ?? r?.GrandTotalPrice ?? 0),
    })
  }, [])

  const fetchAllData = useCallback(async (): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const res = await axios({
        method: "POST",
        url: API_ENDPOINTS.REPORTS.DEPARTMENTS_VALUATION,
        data: {
          storeId: appliedStoreId || currentStore?.storeId || undefined,
          asOfDate: appliedAsOfDate || undefined,
        },
        headers,
      })
      if (res.data?.isSuccess && res.data.response?.data) return res.data.response.data
      return []
    } catch (e) {
      console.error("Department inventory fetch error:", e)
      return []
    }
  }, [getAuthHeaders, appliedStoreId, appliedAsOfDate, currentStore?.storeId])

  useEffect(() => {
    if (!detailModalOpen || !detailDepartmentStoreId || !detailStoreId) return
    setDetailItemsLoading(true)
    setDetailItems([])
    setDetailTotals(null)
    const headers = getAuthHeaders()
    axios({
      method: "POST",
      url: API_ENDPOINTS.REPORTS.ITEMS,
      data: {
        startRow: 0,
        endRow: 10000,
        storeId: detailStoreId,
        departmentId: detailDepartmentStoreId,
      },
      headers,
    })
      .then((res) => {
        if (res.data?.isSuccess && res.data.response) {
          const resp = res.data.response
          const dataArray = Array.isArray(resp?.data)
            ? resp.data
            : Array.isArray(resp?.Data)
              ? resp.Data
              : Array.isArray(resp?.items)
                ? resp.items
                : Array.isArray(resp) ? resp : []
          setDetailItems(dataArray)
          setDetailTotals({
            totalQtyOnHand: Number(resp?.totalQtyOnHand ?? resp?.TotalQtyOnHand ?? 0) || 0,
            totalCostValue: Number(resp?.totalCostValue ?? resp?.TotalCostValue ?? 0) || 0,
            totalRetailValue: Number(resp?.totalRetailValue ?? resp?.TotalRetailValue ?? 0) || 0,
          })
        } else {
          setDetailItems([])
          setDetailTotals(null)
        }
      })
      .catch(() => {
        setDetailItems([])
        setDetailTotals(null)
      })
      .finally(() => setDetailItemsLoading(false))
  }, [detailModalOpen, detailDepartmentStoreId, detailStoreId, getAuthHeaders])

  const storeLabel = stores.find((s) => s.value === appliedStoreId)?.label || (appliedStoreId ? "Store" : "All Stores")

  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "department-inventory-report",
    pdfOptions: {
      title: "Department Inventory Report",
      subtitle: storeLabel,
      orientation: "landscape",
    },
  })

  const handleRowDoubleClick = useCallback((row: any) => {
    const depId = row?.departmentStoreID ?? row?.departmentStoreId ?? row?.DepartmentStoreID
    const sid = row?.storeID ?? row?.storeId ?? row?.StoreID
    const name = row?.name ?? row?.Name ?? ""
    if (depId != null && sid != null) {
      setDetailDepartmentStoreId(String(depId))
      setDetailStoreId(String(sid))
      setDetailDepartmentName(name)
      setDetailModalOpen(true)
    }
  }, [])

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-brand-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012 2h6a2 2 0 012-2M5 11a2 2 0 012 2v6m-6-4h6" />
            </svg>
            {reportName || "Department Inventory Report"}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{storeLabel}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>As of {appliedAsOfDate || "today"}</span>
            {totalRecords > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{totalRecords.toLocaleString()} departments</span>
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1 min-w-[320px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Store</label>
              <SearchableSelect
                options={stores}
                value={storeId}
                onChange={setStoreId}
                placeholder="All Stores"
                loading={loadingStores}
              />
            </div>
            <div className="space-y-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">As of date</label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 text-sm"
              />
            </div>
            <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm ml-auto overflow-visible">
              <button
                onClick={handleApplyFilters}
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

      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <div className="flex-1 min-h-0 overflow-hidden">
          <ServerGrid
            hideDefaultContextMenuItems={true}
            key={gridKey}
            columns={columns}
            apiUrl={API_ENDPOINTS.REPORTS.DEPARTMENTS_VALUATION}
            serverSide
            methodType="POST"
            getAuthHeaders={getAuthHeaders}
            pagination
            pageSize={100}
            headerSearch={false}
            showActions={false}
            columnChooser
            title="Department Inventory"
            defaultSortColumn="mainDepartment"
            additionalParams={additionalParams}
            setTotalRecords={setTotalRecords}
            onResponseLoaded={handleResponseLoaded}
            getRowId={(row) => row?.departmentStoreID ?? row?.departmentStoreId ?? `${row?.storeID ?? row?.storeId ?? ""}-${row?.name ?? ""}` ?? String(Math.random())}
            containerWidth="100%"
            gridId="department-inventory-report"
            onRowDoubleClick={handleRowDoubleClick}
          />
        </div>
        {/* Total row - desktop column order */}
        {totalRecords > 0 && (
          <div className="mt-0 border-t border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/80">
            <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
              <tbody>
                <tr className="font-semibold text-gray-900 dark:text-white">
                  <td className="py-2 px-2 border-b border-gray-200 dark:border-gray-600">Total</td>
                  <td className="py-2 px-2 border-b border-gray-200 dark:border-gray-600" />
                  <td className="py-2 px-2 border-b border-gray-200 dark:border-gray-600" />
                  <td className="py-2 px-2 border-b border-gray-200 dark:border-gray-600" />
                  <td className="py-2 px-2 border-b border-gray-200 dark:border-gray-600 text-right">{grandTotals.grandTotalOnHand.toLocaleString()}</td>
                  <td className="py-2 px-2 border-b border-gray-200 dark:border-gray-600 text-right">{grandTotals.grandTotalOnOrder.toLocaleString()}</td>
                  <td className="py-2 px-2 border-b border-gray-200 dark:border-gray-600 text-right">{grandTotals.grandTotalOnSaleOrder.toLocaleString()}</td>
                  <td className="py-2 px-2 border-b border-gray-200 dark:border-gray-600 text-right">${grandTotals.grandTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="py-2 px-2 border-b border-gray-200 dark:border-gray-600 text-right">${grandTotals.grandTotalAVGCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="py-2 px-2 border-b border-gray-200 dark:border-gray-600 text-right">${grandTotals.grandTotalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="py-2 px-2 border-b border-gray-200 dark:border-gray-600" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Items in Department detail modal: fixed layout so page-size change doesn't hide data; Ext Cost/Ext Price shown; last row = empty aggregate (right-click Sum/Average/etc.) */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4" onClick={() => setDetailModalOpen(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl flex flex-col border border-gray-200 dark:border-gray-600"
            style={{
              width: "min(96vw, 1400px)",
              minWidth: "min(900px, 98vw)",
              height: "min(90vh, 900px)",
              maxHeight: "min(90vh, 900px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Items in Department: {detailDepartmentName || "—"}</h2>
              <button type="button" onClick={() => setDetailModalOpen(false)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div
              className="flex-1 flex flex-col p-4 min-h-0"
              style={{ overflow: "hidden" }}
            >
              {detailItemsLoading ? (
                <Loader />
              ) : detailItems.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No items in this department.</p>
              ) : (
                <div
                  className="flex-1 min-h-0 w-full"
                  style={{ minHeight: "380px", display: "flex", flexDirection: "column", overflow: "hidden" }}
                >
                  <ServerGrid
                    key={`detail-${detailDepartmentStoreId}-${detailStoreId}`}
                    columns={detailColumns}
                    data={detailGridData}
                    serverSide={false}
                    pagination
                    pageSize={25}
                    headerSearch={false}
                    showActions={false}
                    columnChooser
                    title=""
                    containerWidth="100%"
                    gridId="department-inventory-detail"
                    getRowId={(row) => (row as any)?._rowId ?? String(Math.random())}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default DepartmentInventoryReportPage
