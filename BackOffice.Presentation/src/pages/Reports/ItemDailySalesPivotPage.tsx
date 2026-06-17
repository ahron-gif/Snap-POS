import React, { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import Flatpickr from "react-flatpickr"
import "flatpickr/dist/themes/light.css"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { usePermission } from "../../hooks/usePermission"
import { useStore } from "../../context/StoreContext"
import { useDashboardTabs } from "../../context/DashboardTabContext"
import { API_ENDPOINTS } from "../../constants/api"
import StickyPivotTable, {
  PivotLeftColumn,
  PivotRightGroup,
} from "../../components/common/StickyPivotTable"
import ExportModal from "../../components/common/ExportModal"
import { useExportModal } from "../../hooks/useExportModal"
import { Column as GridUtilsColumn } from "../../gridUtils"

/**
 * Item Daily Sales — pivot view.
 *
 * Mirrors the desktop's `RepItemsDailySales` DevExpress PivotGrid:
 *   • Row fields   : Department > Item Name > Barcode  (sticky LEFT columns)
 *   • Column field : Sale date                           (scrolling RIGHT columns)
 *   • Data fields  : Amount ($) and Qty                  (two sub-cols under each date)
 *
 * Rendering is delegated to <StickyPivotTable />. This file owns:
 *   • Toolbar state and the search action
 *   • The pivot-data fetch (POST /api/Reports/ItemDailySalesPivot)
 *   • Translating the API response into the props the table component understands
 */

// ---------- types -----------------------------------------------------------

interface ItemDailySalesPivotProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    storeId?: string
    storeName?: string
    departmentId?: string
  }
}

interface StoreOption { id: string; name: string }
interface DepartmentOption { id: string; name: string }

interface ApiCell { qty: number; amount: number }
interface ApiRow {
  itemId?: string | null
  itemStoreId?: string | null
  departmentId?: string | null
  department: string
  itemName: string
  barcode?: string | null
  cells: Record<string, ApiCell>
}
interface ApiTotals {
  byDate: Record<string, ApiCell>
  grand: ApiCell
}
interface ApiPivotResponse {
  dates: string[]
  rows: ApiRow[]
  totals: ApiTotals
  totalRecords: number
}

// ---------- helpers ---------------------------------------------------------

const REPORT_TITLE = "Item Daily Sales"
const SCREEN_CODE = "reports.item_daily_sales"

const fmtMoney = (v: number | null | undefined): string => {
  if (v == null || !Number.isFinite(v) || v === 0) return ""
  return `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const fmtQty = (v: number | null | undefined): string => {
  if (v == null || !Number.isFinite(v) || v === 0) return ""
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 })
}
/** yyyy-MM-dd → M/D/YYYY (no timezone shift). */
const fmtDateHeader = (key: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return key
  const [, yyyy, mm, dd] = m
  return `${Number(mm)}/${Number(dd)}/${yyyy}`
}

const todayStr = () => new Date().toISOString().split("T")[0]
const daysAgoStr = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split("T")[0]
}
const getLocalUserId = (): string => {
  try {
    const userData = localStorage.getItem("userData")
    if (userData) {
      const parsed = JSON.parse(userData)
      return parsed.localUserId || ""
    }
  } catch { /* ignore */ }
  return ""
}

// ---------- component -------------------------------------------------------

const ItemDailySalesPivotPage: React.FC<ItemDailySalesPivotProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { openTab } = useDashboardTabs()
  const { canExport: _canExport, canPrint: _canPrint } = usePermission(SCREEN_CODE)

  // toolbar state
  const defaultFrom = filters?.dateFrom || daysAgoStr(30)
  const defaultTo   = filters?.dateTo   || todayStr()
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo]     = useState(defaultTo)
  const [appliedFrom, setAppliedFrom] = useState(defaultFrom)
  const [appliedTo,   setAppliedTo]   = useState(defaultTo)

  const [stores, setStores] = useState<StoreOption[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const initialStoreId = filters ? (filters.storeId ?? "") : (currentStore?.storeId ?? "")
  const [screenStoreId,  setScreenStoreId]  = useState<string>(initialStoreId)
  const [appliedStoreId, setAppliedStoreId] = useState<string>(initialStoreId)
  const [appliedStoreName, setAppliedStoreName] = useState<string>(() => {
    return initialStoreId
      ? (filters?.storeName?.trim() || currentStore?.storeName || "Selected Store")
      : "All Stores"
  })

  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [loadingDepts, setLoadingDepts] = useState(false)
  const [screenDeptId,  setScreenDeptId]  = useState<string>(filters?.departmentId ?? "")
  const [appliedDeptId, setAppliedDeptId] = useState<string>(filters?.departmentId ?? "")

  // Date-column sort direction — mirrors desktop's "Day In Year ▲▼" header indicator.
  // 'asc' = oldest date first (default, matches desktop); 'desc' = latest date first.
  const [dateSortDir, setDateSortDir] = useState<"asc" | "desc">("asc")

  // data state
  const [data, setData] = useState<ApiPivotResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // load lookups
  useEffect(() => {
    const userId = getLocalUserId()
    setLoadingStores(true)
    const headers = getAuthHeaders()
    const url = userId
      ? `${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${userId}`
      : API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES
    fetch(url, { headers })
      .then((res) => res.json())
      .then((d) => {
        const list = d?.response ?? d?.Response ?? d
        const arr = Array.isArray(list) ? list : []
        setStores(arr.map((s: any) => ({
          id: String(s.storeID ?? s.storeId ?? s.id ?? ""),
          name: String(s.storeName ?? s.name ?? s.StoreName ?? ""),
        })))
      })
      .catch(console.error)
      .finally(() => setLoadingStores(false))
  }, [getAuthHeaders])

  useEffect(() => {
    setLoadingDepts(true)
    const headers = getAuthHeaders()
    fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_DEPARTMENTS, { headers })
      .then((res) => res.json())
      .then((d) => {
        const list = d?.response ?? d?.Response ?? d
        const arr = Array.isArray(list) ? list : []
        setDepartments(arr.map((x: any) => ({
          id: String(x.departmentStoreID ?? x.departmentStoreId ?? x.id ?? ""),
          name: String(x.name ?? x.Name ?? ""),
        })).filter((x: DepartmentOption) => x.id))
      })
      .catch(console.error)
      .finally(() => setLoadingDepts(false))
  }, [getAuthHeaders])

  // fetch pivot
  const fetchData = useCallback(async (overrides?: {
    dateFrom?: string; dateTo?: string; storeId?: string; departmentId?: string;
  }) => {
    const from = overrides?.dateFrom ?? appliedFrom
    const to   = overrides?.dateTo   ?? appliedTo
    if (!from || !to) return

    setLoading(true)
    setError(null)
    try {
      const headers = getAuthHeaders()
      const storeIdRaw = overrides !== undefined ? (overrides.storeId ?? "") : appliedStoreId
      const deptIdRaw  = overrides !== undefined ? (overrides.departmentId ?? "") : appliedDeptId
      const effectiveStoreId = storeIdRaw && /^[0-9a-f-]{36}$/i.test(storeIdRaw.trim()) ? storeIdRaw.trim() : null
      const effectiveDeptId  = deptIdRaw  && /^[0-9a-f-]{36}$/i.test(deptIdRaw.trim())  ? deptIdRaw.trim()  : null

      const body = { fromDate: from, toDate: to, storeId: effectiveStoreId, departmentId: effectiveDeptId }
      const response = await axios.post<{
        isSuccess?: boolean; IsSuccess?: boolean;
        message?: string; Message?: string;
        response?: ApiPivotResponse; Response?: ApiPivotResponse;
      }>(API_ENDPOINTS.REPORTS.ITEM_DAILY_SALES_PIVOT, body, { headers })

      const ok = response.data?.isSuccess ?? response.data?.IsSuccess
      if (!ok) {
        setError(response.data?.message || response.data?.Message || `Failed to load ${REPORT_TITLE}`)
        setData(null)
        return
      }
      setData(response.data?.response ?? response.data?.Response ?? null)

      if (overrides) {
        setAppliedFrom(from)
        setAppliedTo(to)
        const nextStoreId = overrides.storeId ?? ""
        setAppliedStoreId(nextStoreId)
        setAppliedStoreName(
          nextStoreId ? (stores.find((s) => s.id === nextStoreId)?.name ?? "Selected Store") : "All Stores"
        )
        setAppliedDeptId(overrides.departmentId ?? "")
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? `Failed to load ${REPORT_TITLE}`)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [appliedFrom, appliedTo, appliedStoreId, appliedDeptId, getAuthHeaders, stores])

  useEffect(() => { fetchData() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  const handleSearch = useCallback(() => {
    fetchData({ dateFrom, dateTo, storeId: screenStoreId, departmentId: screenDeptId })
  }, [dateFrom, dateTo, screenStoreId, screenDeptId, fetchData])

  // ---- shape data for <StickyPivotTable /> ----

  const leftColumns: PivotLeftColumn<ApiRow>[] = useMemo(
    () => [
      { key: "department", header: "Department", width: 200, render: (r) => r.department || "[NO DEPARTMENT]", cellClassName: "text-gray-500 dark:text-gray-400" },
      { key: "itemName",   header: "Item Name",   width: 300, render: (r) => r.itemName  || "[MANUAL ITEM]" },
      { key: "barcode",    header: "Barcode",     width: 160, render: (r) => r.barcode   || "", cellClassName: "text-gray-500 dark:text-gray-400" },
    ],
    []
  )

  const rightGroups: PivotRightGroup[] = useMemo(() => {
    // Backend already returns `dates` ascending (oldest first). For 'desc' we just reverse
    // — the per-cell lookup uses `rg.key` (the yyyy-MM-dd string) so the data layer is
    // untouched and totals stay correct regardless of display order.
    const dates = data?.dates ?? []
    const ordered = dateSortDir === "desc" ? [...dates].reverse() : dates
    return ordered.map((d) => ({
      key: d,
      header: fmtDateHeader(d),
      subs: [
        { key: "amount", label: "Amount", width: 100 },
        { key: "qty",    label: "Qty",    width: 70 },
      ],
    }))
  }, [data?.dates, dateSortDir])

  // Per-group subtotal: sum each (department, date) across the group's rows.
  const renderGroupSubtotal = useCallback(
    (_groupKey: string, rows: ApiRow[], rg: PivotRightGroup, sub: PivotRightGroup["subs"][number]) => {
      let s = 0
      for (const r of rows) {
        const c = r.cells?.[rg.key]
        if (!c) continue
        s += sub.key === "amount" ? c.amount : c.qty
      }
      return sub.key === "amount" ? fmtMoney(s) : fmtQty(s)
    },
    []
  )

  const renderCell = useCallback(
    (row: ApiRow, rg: PivotRightGroup, sub: PivotRightGroup["subs"][number]) => {
      const c = row.cells?.[rg.key]
      if (!c) return <span className="text-gray-300">—</span>
      if (sub.key === "amount") return fmtMoney(c.amount) || <span className="text-gray-300">—</span>
      return fmtQty(c.qty) || <span className="text-gray-300">—</span>
    },
    []
  )

  const renderGrandTotal = useCallback(
    (rg: PivotRightGroup, sub: PivotRightGroup["subs"][number]) => {
      const c = data?.totals?.byDate?.[rg.key]
      if (!c) return ""
      return sub.key === "amount" ? fmtMoney(c.amount) : fmtQty(c.qty)
    },
    [data]
  )

  const onRowDoubleClick = useCallback(
    (row: ApiRow) => {
      // Row-level drill-down → "Sales Details for {ItemName}" scoped to the row's item +
      // the applied date window. Backend ItemSalesTransactions handles both catalog
      // items (by ItemID) and manual items (by Name + DepartmentID).
      const itemName = row.itemName || "[MANUAL ITEM]"
      const itemIdKey = (row.itemId ?? "").toString()
      openTab({
        id: `item-sales-tx-${itemIdKey || "manual"}-${itemName.toLowerCase().replace(/\s+/g, "_")}-${appliedFrom}-${appliedTo}`,
        title: `Sales Details for ${itemName}`,
        component: "ItemSalesTransactionsDetailsPage",
        props: {
          itemId: itemIdKey || undefined,
          itemName,
          departmentId: row.departmentId ?? undefined,
          storeId: appliedStoreId || undefined,
          storeName: appliedStoreName || undefined,
          fromDate: appliedFrom,
          toDate: appliedTo,
        },
        closable: true,
      })
    },
    [openTab, appliedFrom, appliedTo, appliedStoreId, appliedStoreName]
  )

  const grand = data?.totals?.grand ?? { qty: 0, amount: 0 }
  const displayStoreName = appliedStoreId ? appliedStoreName : "All Stores"
  const displayDept = appliedDeptId
    ? (departments.find((d) => d.id === appliedDeptId)?.name ?? "Selected Department")
    : "All Departments"

  // ---- Export / Print -------------------------------------------------------
  // We use the shared <ExportModal /> for full parity with other reports (CSV / Excel / PDF /
  // Print + live preview + column chooser + PDF settings). The pivot has dynamic per-date
  // columns, so we build the column list and the row list from the same `data` payload the
  // user is looking at — what they preview / export is always exactly what's on screen,
  // honoring the Date Order toggle.

  /** Date keys ordered to match the on-screen pivot (asc/desc). */
  const orderedDateKeys = useMemo(() => {
    const ds = data?.dates ?? []
    return dateSortDir === "desc" ? [...ds].reverse() : ds
  }, [data?.dates, dateSortDir])

  /** Per-date field-name helpers (safe characters for object keys / CSV / PDF). */
  const amtField = (d: string) => `amt_${d}`
  const qtyField = (d: string) => `qty_${d}`

  /**
   * Columns fed to <ExportModal />. The three pinned columns first, then one Amount + Qty
   * pair per date in the user's chosen order. `dataType: "number"` lets the modal right-align
   * numeric cells in the preview / PDF.
   */
  const exportColumns = useMemo<GridUtilsColumn[]>(() => {
    const cols: GridUtilsColumn[] = [
      { field: "department", headerName: "Department", width: 160, dataType: "string" },
      { field: "itemName",   headerName: "Item Name",   width: 220, dataType: "string" },
      { field: "barcode",    headerName: "Barcode",     width: 140, dataType: "string" },
    ]
    for (const d of orderedDateKeys) {
      const label = fmtDateHeader(d)
      cols.push({
        field: amtField(d),
        headerName: `${label} Amount`,
        width: 110,
        dataType: "number",
        cellRenderer: (v: any) => (v == null || v === "" ? "" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`),
      })
      cols.push({
        field: qtyField(d),
        headerName: `${label} Qty`,
        width: 80,
        dataType: "number",
        cellRenderer: (v: any) => (v == null || v === "" ? "" : Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 })),
      })
    }
    return cols
  }, [orderedDateKeys])

  /**
   * Flatten the pivot rows for the export modal: each item becomes one row with
   * amt_<date> / qty_<date> properties. Department subtotal + grand-total summary rows are
   * appended at the end so the exported file mirrors what's on screen.
   */
  const fetchAllExportRows = useCallback(async (): Promise<any[]> => {
    if (!data) return []

    const flat: any[] = []
    // group by department to match the on-screen ordering + emit subtotals
    const groups = new Map<string, ApiRow[]>()
    for (const r of data.rows) {
      const k = r.department || "[NO DEPARTMENT]"
      const arr = groups.get(k) ?? []
      arr.push(r)
      groups.set(k, arr)
    }
    const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))

    for (const [dept, rows] of sortedGroups) {
      for (const r of rows) {
        const flatRow: Record<string, any> = {
          department: dept,
          itemName: r.itemName || "[MANUAL ITEM]",
          barcode: r.barcode ?? "",
        }
        for (const d of orderedDateKeys) {
          const c = r.cells?.[d]
          flatRow[amtField(d)] = c ? c.amount : null
          flatRow[qtyField(d)] = c ? c.qty : null
        }
        flat.push(flatRow)
      }
      // dept subtotal row
      const subt: Record<string, ApiCell> = {}
      for (const r of rows) for (const [k, c] of Object.entries(r.cells)) {
        const cur = subt[k] ?? { qty: 0, amount: 0 }
        cur.qty += c.qty; cur.amount += c.amount
        subt[k] = cur
      }
      const subRow: Record<string, any> = { department: `${dept} Total`, itemName: "", barcode: "" }
      for (const d of orderedDateKeys) {
        const c = subt[d]
        subRow[amtField(d)] = c ? c.amount : null
        subRow[qtyField(d)] = c ? c.qty : null
      }
      flat.push(subRow)
    }

    // Grand total
    const grandRow: Record<string, any> = { department: "Grand Total", itemName: "", barcode: "" }
    for (const d of orderedDateKeys) {
      const c = data.totals?.byDate?.[d]
      grandRow[amtField(d)] = c ? c.amount : null
      grandRow[qtyField(d)] = c ? c.qty : null
    }
    flat.push(grandRow)

    return flat
  }, [data, orderedDateKeys])

  // Use `useExportModal` directly (not `useReportExportModal`) so we can skip the date-range
  // filter entirely. The hook's wrapper always injects a dateRange filter, but for a pivot
  // the "date" lives in COLUMNS (not rows), so the modal's row-level date filter would drop
  // every row (filter looks up row[field], finds nothing, returns false).
  const exportModal = useExportModal({
    columns: exportColumns,
    fetchAllData: fetchAllExportRows,
    filename: "item-daily-sales",
    pdfOptions: {
      title: `${REPORT_TITLE} Report`,
      subtitle: `${displayStoreName} | ${new Date(appliedFrom).toLocaleDateString()} - ${new Date(appliedTo).toLocaleDateString()} | ${displayDept}`,
      orientation: "landscape",
      // Keep Department / Item Name / Barcode on every horizontal page so a reader
      // scanning across dates can always tell which row a cell belongs to. Without
      // this, the 40+ date columns get squeezed onto a single page width and values
      // clip — see WEB-pivot-pdf-cutoff fix.
      repeatColumns: 3,
    },
    // No `filters` → modal renders no Date Range picker, and no client-side filter is applied.
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header + toolbar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{REPORT_TITLE}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{displayStoreName}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>{new Date(appliedFrom).toLocaleDateString()} – {new Date(appliedTo).toLocaleDateString()}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>{displayDept}</span>
            {data && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>Qty: {fmtQty(grand.qty) || 0}</span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>Total: {fmtMoney(grand.amount) || "$0.00"}</span>
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date Range</label>
              <div className="flex items-center gap-2">
                <div className="w-[142px] relative">
                  <Flatpickr
                    value={dateFrom}
                    onChange={([d]) => setDateFrom(d ? d.toISOString().split("T")[0] : dateFrom)}
                    options={{ dateFormat: "Y-m-d", allowInput: true }}
                    placeholder="From"
                    className="w-full h-10 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
                <span className="text-gray-400 dark:text-gray-500 font-medium">to</span>
                <div className="w-[142px] relative">
                  <Flatpickr
                    value={dateTo}
                    onChange={([d]) => setDateTo(d ? d.toISOString().split("T")[0] : dateTo)}
                    options={{ dateFormat: "Y-m-d", allowInput: true }}
                    placeholder="To"
                    className="w-full h-10 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Store</label>
              <select
                value={screenStoreId}
                onChange={(e) => setScreenStoreId(e.target.value)}
                disabled={loadingStores}
                className="h-10 min-w-[240px] px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60"
              >
                <option value="">All Stores</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Department</label>
              <select
                value={screenDeptId}
                onChange={(e) => setScreenDeptId(e.target.value)}
                disabled={loadingDepts}
                className="h-10 min-w-[240px] px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60"
              >
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {/* Date sort direction — desktop parity for the "Day In Year ▲▼" indicator. */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date Order</label>
              <button
                type="button"
                onClick={() => setDateSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                title={dateSortDir === "asc" ? "Oldest date first — click to reverse" : "Latest date first — click to reverse"}
                className="h-10 px-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                {dateSortDir === "asc" ? (
                  <>
                    <span className="text-base leading-none">▲</span>
                    <span>Oldest first</span>
                  </>
                ) : (
                  <>
                    <span className="text-base leading-none">▼</span>
                    <span>Latest first</span>
                  </>
                )}
              </button>
            </div>

            <div className="ml-auto flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm overflow-hidden">
              <button
                onClick={handleSearch}
                disabled={loading}
                type="button"
                className="h-10 px-5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors flex items-center gap-2 border-0 border-r border-gray-200 dark:border-gray-600 disabled:opacity-60"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {loading ? "Loading…" : "Search"}
              </button>

              {/* Opens the same shared <ExportModal /> used everywhere else (CSV / Excel / PDF /
                  Print + live preview + column chooser + PDF settings). */}
              <button
                onClick={exportModal.open}
                type="button"
                title="Preview, filter and export"
                className="h-10 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 border-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 5.414V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Pivot table */}
      <div className="flex-1 min-h-0 p-6">
        <StickyPivotTable<ApiRow>
          leftColumns={leftColumns}
          rightGroups={rightGroups}
          rows={data?.rows ?? []}
          groupBy={(r) => r.department || "[NO DEPARTMENT]"}
          renderCell={renderCell}
          renderGroupSubtotal={renderGroupSubtotal}
          renderGrandTotal={renderGrandTotal}
          grandTotalLabel="Grand Total"
          onRowDoubleClick={onRowDoubleClick}
          loading={loading}
          emptyMessage="No data for the selected criteria. Use filters and click Search to load data."
        />
      </div>

      {/* Shared export modal — Export button above opens this; CSV / Excel / PDF / Print live inside. */}
      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default ItemDailySalesPivotPage
