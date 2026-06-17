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
 * Item Weekly Sales — pivot view.
 *
 * Mirrors the desktop's `RepItemsWeeklySales` DevExpress PivotGrid:
 *   • Row fields   : Department > Item Name > Barcode  (sticky LEFT)
 *   • Column field : WeekNumber (start-of-week date)   (scrolling RIGHT)
 *   • Data fields  : Amount ($) and Qty                (two sub-cols under each week)
 *
 * Structure-wise this is the daily pivot's twin — only difference is the column-group header
 * shows a *week range* ("5/10 - 5/16") instead of a single date. Same StickyPivotTable, same
 * Export modal flow, same Date Order toggle.
 *
 * Double-click on a cell: opens the existing item-detail tab (best-available equivalent of the
 * desktop's RepWeeklySalesDetails) scoped to that item. The pivot SP doesn't surface
 * ItemStoreID today, so the detail tab opens with an empty Guid + renders an empty grid for
 * manual items — matching how the daily pivot already behaves.
 */

// ---------- types -----------------------------------------------------------

interface ItemWeeklySalesPivotProps {
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

const REPORT_TITLE = "Item Weekly Sales"
const SCREEN_CODE = "reports.item_weekly_sales"

const fmtMoney = (v: number | null | undefined): string => {
  if (v == null || !Number.isFinite(v) || v === 0) return ""
  return `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const fmtQty = (v: number | null | undefined): string => {
  if (v == null || !Number.isFinite(v) || v === 0) return ""
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 })
}
/**
 * yyyy-MM-dd (week start) → "M/D/YYYY" — single-date header matches the desktop
 * RepItemsWeeklySales pivot, which shows the week-start date alone in each column
 * (no range). Tooltip on the header still shows the full range for clarity.
 */
const fmtWeekHeader = (key: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return key
  const [, yyyy, mm, dd] = m
  return `${Number(mm)}/${Number(dd)}/${yyyy}`
}

/** yyyy-MM-dd → "M/D - M/D" 7-day range (used for header tooltips + Export labels). */
const fmtWeekRange = (key: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return key
  const [, yyyy, mm, dd] = m
  const start = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  return `${fmt(start)} - ${fmt(end)}`
}
/** yyyy-MM-dd → M/D/YYYY (used inside Export column headers). */
const fmtDateForExport = (key: string): string => {
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
    const u = localStorage.getItem("userData")
    if (u) { const p = JSON.parse(u); return p.localUserId || "" }
  } catch { /* ignore */ }
  return ""
}

// ---------- component -------------------------------------------------------

const ItemWeeklySalesPivotPage: React.FC<ItemWeeklySalesPivotProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { openTab } = useDashboardTabs()
  const { canExport: _ce, canPrint: _cp } = usePermission(SCREEN_CODE)

  // toolbar
  // Default to a 12-week window so the weekly pivot has meaningful columns out of the box.
  const defaultFrom = filters?.dateFrom || daysAgoStr(84)
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
  const [appliedStoreName, setAppliedStoreName] = useState<string>(() => initialStoreId
    ? (filters?.storeName?.trim() || currentStore?.storeName || "Selected Store")
    : "All Stores")

  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [loadingDepts, setLoadingDepts] = useState(false)
  const [screenDeptId,  setScreenDeptId]  = useState<string>(filters?.departmentId ?? "")
  const [appliedDeptId, setAppliedDeptId] = useState<string>(filters?.departmentId ?? "")

  // Default ascending; user can flip to descending — matches the desktop "Day In Year ▲▼"
  // affordance and the equivalent toggle on the daily pivot.
  const [dateSortDir, setDateSortDir] = useState<"asc" | "desc">("asc")

  // Desktop's pivot lets the user drag Amount / Qty in & out of the data area; users typically
  // pick ONE so each week is a single column. Default to "amount" here to match the desktop's
  // default "Amount" view; users can flip to Qty or show Both.
  const [valueMode, setValueMode] = useState<"amount" | "qty" | "both">("amount")

  const [data, setData] = useState<ApiPivotResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // lookups
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

  // fetch
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
      }>(API_ENDPOINTS.REPORTS.ITEM_WEEKLY_SALES_PIVOT, body, { headers })

      const ok = response.data?.isSuccess ?? response.data?.IsSuccess
      if (!ok) {
        setError(response.data?.message || response.data?.Message || `Failed to load ${REPORT_TITLE}`)
        setData(null)
        return
      }
      setData(response.data?.response ?? response.data?.Response ?? null)

      if (overrides) {
        setAppliedFrom(from); setAppliedTo(to)
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

  const leftColumns: PivotLeftColumn<ApiRow>[] = useMemo(() => [
    { key: "department", header: "Department", width: 200, render: (r) => r.department || "[NO DEPARTMENT]", cellClassName: "text-gray-500 dark:text-gray-400" },
    { key: "itemName",   header: "Item Name",   width: 300, render: (r) => r.itemName  || "[MANUAL ITEM]" },
    { key: "barcode",    header: "Barcode",     width: 160, render: (r) => r.barcode   || "", cellClassName: "text-gray-500 dark:text-gray-400" },
  ], [])

  const rightGroups: PivotRightGroup[] = useMemo(() => {
    const dates = data?.dates ?? []
    const ordered = dateSortDir === "desc" ? [...dates].reverse() : dates
    // Sub-columns reflect the user's value-mode choice: Amount only, Qty only, or both
    // (current implementation always shows both was awkward — desktop default is a single
    // column per week with the user picking which value).
    const subs: PivotRightGroup["subs"] =
      valueMode === "amount" ? [{ key: "amount", label: "Amount", width: 130 }]
      : valueMode === "qty"  ? [{ key: "qty",    label: "Qty",    width: 110 }]
      : [
          { key: "amount", label: "Amount", width: 110 },
          { key: "qty",    label: "Qty",    width: 70  },
        ]
    return ordered.map((d) => ({
      key: d,
      // Single-date header matches the desktop. `title` attribute (via React's `title`) shows
      // the full 7-day range on hover so users still know what range each column covers.
      header: (
        <span title={`Week of ${fmtWeekRange(d)}`}>{fmtWeekHeader(d)}</span>
      ),
      subs,
    }))
  }, [data?.dates, dateSortDir, valueMode])

  const renderGroupSubtotal = useCallback(
    (_g: string, rows: ApiRow[], rg: PivotRightGroup, sub: PivotRightGroup["subs"][number]) => {
      let s = 0
      for (const r of rows) {
        const c = r.cells?.[rg.key]; if (!c) continue
        s += sub.key === "amount" ? c.amount : c.qty
      }
      return sub.key === "amount" ? fmtMoney(s) : fmtQty(s)
    }, [])

  const renderCell = useCallback(
    (row: ApiRow, rg: PivotRightGroup, sub: PivotRightGroup["subs"][number]) => {
      const c = row.cells?.[rg.key]
      if (!c) return <span className="text-gray-300">—</span>
      if (sub.key === "amount") return fmtMoney(c.amount) || <span className="text-gray-300">—</span>
      return fmtQty(c.qty) || <span className="text-gray-300">—</span>
    }, [])

  const renderGrandTotal = useCallback(
    (rg: PivotRightGroup, sub: PivotRightGroup["subs"][number]) => {
      const c = data?.totals?.byDate?.[rg.key]
      if (!c) return ""
      return sub.key === "amount" ? fmtMoney(c.amount) : fmtQty(c.qty)
    }, [data])

  /**
   * Row-level drill-down (StickyPivotTable fires onRowDoubleClick at the row level). Opens
   * the desktop-equivalent "Sales Details for {ItemName}" tab scoped to the row's item +
   * the applied date window. Backend ItemSalesTransactions endpoint handles both catalog
   * items (by ItemID) and manual items (by Name + DepartmentID).
   */
  const onRowDoubleClick = useCallback((row: ApiRow) => {
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
  }, [openTab, appliedFrom, appliedTo, appliedStoreId, appliedStoreName])

  const grand = data?.totals?.grand ?? { qty: 0, amount: 0 }
  const displayStoreName = appliedStoreId ? appliedStoreName : "All Stores"
  const displayDept = appliedDeptId
    ? (departments.find((d) => d.id === appliedDeptId)?.name ?? "Selected Department")
    : "All Departments"

  // ---- Export modal --------------------------------------------------------
  // Same approach as the daily pivot: use `useExportModal` directly (NOT the wrapper) so we
  // can skip the date-range filter that would otherwise drop every row. Date is a column key,
  // not a row attribute, so client-side row filtering is meaningless here.

  const orderedDateKeys = useMemo(() => {
    const ds = data?.dates ?? []
    return dateSortDir === "desc" ? [...ds].reverse() : ds
  }, [data?.dates, dateSortDir])

  const amtField = (d: string) => `amt_${d}`
  const qtyField = (d: string) => `qty_${d}`

  const exportColumns = useMemo<GridUtilsColumn[]>(() => {
    const cols: GridUtilsColumn[] = [
      { field: "department", headerName: "Department", width: 160, dataType: "string" },
      { field: "itemName",   headerName: "Item Name",   width: 220, dataType: "string" },
      { field: "barcode",    headerName: "Barcode",     width: 140, dataType: "string" },
    ]
    for (const d of orderedDateKeys) {
      // Week-of header: "Week of M/D/YYYY". Easier to read in CSV / PDF than the bare date.
      const label = `Week of ${fmtDateForExport(d)}`
      if (valueMode === "amount" || valueMode === "both") {
        cols.push({
          field: amtField(d),
          headerName: valueMode === "both" ? `${label} Amount` : label,
          width: 130,
          dataType: "number",
          cellRenderer: (v: any) => (v == null || v === "" ? "" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`),
        })
      }
      if (valueMode === "qty" || valueMode === "both") {
        cols.push({
          field: qtyField(d),
          headerName: valueMode === "both" ? `${label} Qty` : `${label} (Qty)`,
          width: 90,
          dataType: "number",
          cellRenderer: (v: any) => (v == null || v === "" ? "" : Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 })),
        })
      }
    }
    return cols
  }, [orderedDateKeys, valueMode])

  const fetchAllExportRows = useCallback(async (): Promise<any[]> => {
    if (!data) return []
    const flat: any[] = []
    const groups = new Map<string, ApiRow[]>()
    for (const r of data.rows) {
      const k = r.department || "[NO DEPARTMENT]"
      const arr = groups.get(k) ?? []
      arr.push(r); groups.set(k, arr)
    }
    const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))

    for (const [dept, rows] of sortedGroups) {
      for (const r of rows) {
        const fr: Record<string, any> = { department: dept, itemName: r.itemName || "[MANUAL ITEM]", barcode: r.barcode ?? "" }
        for (const d of orderedDateKeys) {
          const c = r.cells?.[d]
          fr[amtField(d)] = c ? c.amount : null
          fr[qtyField(d)] = c ? c.qty : null
        }
        flat.push(fr)
      }
      const sub: Record<string, ApiCell> = {}
      for (const r of rows) for (const [k, c] of Object.entries(r.cells)) {
        const cur = sub[k] ?? { qty: 0, amount: 0 }; cur.qty += c.qty; cur.amount += c.amount; sub[k] = cur
      }
      const subRow: Record<string, any> = { department: `${dept} Total`, itemName: "", barcode: "" }
      for (const d of orderedDateKeys) {
        const c = sub[d]
        subRow[amtField(d)] = c ? c.amount : null
        subRow[qtyField(d)] = c ? c.qty : null
      }
      flat.push(subRow)
    }
    const grandRow: Record<string, any> = { department: "Grand Total", itemName: "", barcode: "" }
    for (const d of orderedDateKeys) {
      const c = data.totals?.byDate?.[d]
      grandRow[amtField(d)] = c ? c.amount : null
      grandRow[qtyField(d)] = c ? c.qty : null
    }
    flat.push(grandRow)
    return flat
  }, [data, orderedDateKeys])

  const exportModal = useExportModal({
    columns: exportColumns,
    fetchAllData: fetchAllExportRows,
    filename: "item-weekly-sales",
    pdfOptions: {
      title: `${REPORT_TITLE} Report`,
      subtitle: `${displayStoreName} | ${new Date(appliedFrom).toLocaleDateString()} - ${new Date(appliedTo).toLocaleDateString()} | ${displayDept}`,
      // Keep Department / Item Name / Barcode on every horizontal page so a reader
      // scanning across weeks can always tell which row a cell belongs to. Without
      // this, many week columns squeeze onto a single page width and values clip.
      repeatColumns: 3,
      orientation: "landscape",
    },
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

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Week Order</label>
              <button
                type="button"
                onClick={() => setDateSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                title={dateSortDir === "asc" ? "Oldest week first — click to reverse" : "Latest week first — click to reverse"}
                className="h-10 px-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                {dateSortDir === "asc" ? (<><span className="text-base leading-none">▲</span><span>Oldest first</span></>)
                                       : (<><span className="text-base leading-none">▼</span><span>Latest first</span></>)}
              </button>
            </div>

            {/* Desktop parity: RepItemsWeeklySales lets the user drag Amount/Qty in/out of the
                pivot data area. We surface that as a 3-way segmented control. */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Show</label>
              <div className="inline-flex h-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 overflow-hidden">
                {(["amount", "qty", "both"] as const).map((m, idx) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setValueMode(m)}
                    className={[
                      "px-3 text-sm font-medium transition-colors",
                      idx > 0 ? "border-l border-gray-300 dark:border-gray-600" : "",
                      valueMode === m
                        ? "bg-brand-500 text-white"
                        : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600",
                    ].join(" ")}
                    title={
                      m === "amount" ? "Show Amount only per week (default)"
                      : m === "qty"  ? "Show Qty only per week"
                      :                 "Show both Amount and Qty per week"
                    }
                  >
                    {m === "amount" ? "Amount" : m === "qty" ? "Qty" : "Both"}
                  </button>
                ))}
              </div>
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

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default ItemWeeklySalesPivotPage
