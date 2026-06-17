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
 * Department Monthly Sales — pivot view.
 *
 * Mirrors desktop RepDepartmentMonthlySales:
 *   • Row fields    : Year > Month                   (sticky LEFT, rows grouped by Year)
 *   • Column fields : Department > Store             (scrolling RIGHT, 3-level header)
 *   • Data fields   : Amount, Qty                    (sub-cols under each Store column)
 *
 * The 3-level column header uses StickyPivotTable's `superGroupKey`/`superGroupHeader` to
 * merge consecutive Store columns under their shared Department name.
 */

interface DepartmentMonthlySalesPivotProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    storeId?: string
    storeName?: string
  }
}
interface StoreOption { id: string; name: string }
interface ApiCell { qty: number; amount: number }
interface ApiColumn {
  key: string                  // "deptName|storeName"
  departmentId?: string | null
  departmentName: string
  storeId?: string | null
  storeName: string
}
interface ApiRow {
  year: number
  month: number               // 1-12
  monthName: string
  monthKey: string            // "yyyy-MM"
  cells: Record<string, ApiCell>  // keyed by column.key
}
interface ApiTotals {
  byColumn: Record<string, ApiCell>
  grand: ApiCell
}
interface ApiPivotResponse {
  columns: ApiColumn[]
  rows: ApiRow[]
  totals: ApiTotals
  totalRecords: number
}

const REPORT_TITLE = "Department Monthly Sales"
const SCREEN_CODE  = "reports.department_monthly_sales"

const fmtMoney = (v: number | null | undefined): string => {
  if (v == null || !Number.isFinite(v) || v === 0) return ""
  return `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const fmtQty = (v: number | null | undefined): string => {
  if (v == null || !Number.isFinite(v) || v === 0) return ""
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

const todayStr = () => new Date().toISOString().split("T")[0]
const daysAgoStr = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().split("T")[0]
}
const getLocalUserId = (): string => {
  try {
    const u = localStorage.getItem("userData")
    if (u) { const p = JSON.parse(u); return p.localUserId || "" }
  } catch { /* ignore */ }
  return ""
}

const DepartmentMonthlySalesPivotPage: React.FC<DepartmentMonthlySalesPivotProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { openTab } = useDashboardTabs()
  const { canExport: _ce, canPrint: _cp } = usePermission(SCREEN_CODE)

  const defaultFrom = filters?.dateFrom || daysAgoStr(365)
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

  // Independent toggles — Year/Month sort and Department/Store sort.
  const [yearSortDir,  setYearSortDir]  = useState<"asc" | "desc">("desc") // newest year first
  const [monthSortDir, setMonthSortDir] = useState<"asc" | "desc">("asc")
  const [deptSortDir,  setDeptSortDir]  = useState<"asc" | "desc">("asc")
  const [valueMode, setValueMode] = useState<"amount" | "qty" | "both">("amount")

  const [data, setData] = useState<ApiPivotResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // stores
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

  const fetchData = useCallback(async (overrides?: { dateFrom?: string; dateTo?: string; storeId?: string }) => {
    const from = overrides?.dateFrom ?? appliedFrom
    const to   = overrides?.dateTo   ?? appliedTo
    if (!from || !to) return
    setLoading(true); setError(null)
    try {
      const headers = getAuthHeaders()
      const storeIdRaw = overrides !== undefined ? (overrides.storeId ?? "") : appliedStoreId
      const effectiveStoreId = storeIdRaw && /^[0-9a-f-]{36}$/i.test(storeIdRaw.trim()) ? storeIdRaw.trim() : null
      const body = { fromDate: from, toDate: to, storeId: effectiveStoreId }
      const response = await axios.post<{
        isSuccess?: boolean; IsSuccess?: boolean;
        message?: string; Message?: string;
        response?: ApiPivotResponse; Response?: ApiPivotResponse;
      }>(API_ENDPOINTS.REPORTS.DEPARTMENT_MONTHLY_SALES_PIVOT, body, { headers })
      const ok = response.data?.isSuccess ?? response.data?.IsSuccess
      if (!ok) {
        setError(response.data?.message || response.data?.Message || `Failed to load ${REPORT_TITLE}`)
        setData(null); return
      }
      setData(response.data?.response ?? response.data?.Response ?? null)
      if (overrides) {
        setAppliedFrom(from); setAppliedTo(to)
        const nextStoreId = overrides.storeId ?? ""
        setAppliedStoreId(nextStoreId)
        setAppliedStoreName(
          nextStoreId ? (stores.find((s) => s.id === nextStoreId)?.name ?? "Selected Store") : "All Stores"
        )
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? `Failed to load ${REPORT_TITLE}`)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [appliedFrom, appliedTo, appliedStoreId, getAuthHeaders, stores])

  useEffect(() => { fetchData() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  const handleSearch = useCallback(() => {
    fetchData({ dateFrom, dateTo, storeId: screenStoreId })
  }, [dateFrom, dateTo, screenStoreId, fetchData])

  // ----- shape data for StickyPivotTable -----

  // Left columns: Year + Month. Rows GROUPED by Year so the year only shows on its own
  // header row, then months underneath (matches desktop).
  const leftColumns: PivotLeftColumn<ApiRow>[] = useMemo(() => [
    { key: "year",      header: "Year",  width: 90,  render: (r) => String(r.year) },
    { key: "monthName", header: "Month", width: 140, render: (r) => r.monthName },
  ], [])

  // Order columns: Department, then Store (matches desktop). superGroupKey = Department
  // means consecutive Stores under the same Department merge into one "Dept" header above.
  const orderedColumns = useMemo(() => {
    const cs = data?.columns ?? []
    const sorted = [...cs].sort((a, b) => {
      const da = a.departmentName.localeCompare(b.departmentName, undefined, { sensitivity: "base" })
      if (da !== 0) return deptSortDir === "asc" ? da : -da
      return a.storeName.localeCompare(b.storeName, undefined, { sensitivity: "base" })
    })
    return sorted
  }, [data?.columns, deptSortDir])

  const rightGroups: PivotRightGroup[] = useMemo(() => {
    const subs: PivotRightGroup["subs"] =
      valueMode === "amount" ? [{ key: "amount", label: "Amount", width: 110 }]
      : valueMode === "qty"  ? [{ key: "qty",    label: "Qty",    width: 90  }]
      : [
          { key: "amount", label: "Amount", width: 100 },
          { key: "qty",    label: "Qty",    width: 70  },
        ]
    return orderedColumns.map((c) => ({
      key: c.key,
      header: c.storeName || "(no store)",
      // Super-group = department — consecutive columns sharing the same dept name merge.
      superGroupKey: c.departmentName,
      superGroupHeader: c.departmentName,
      subs,
    }))
  }, [orderedColumns, valueMode])

  // Rows ordered by (Year, Month).
  const orderedRows = useMemo(() => {
    const rs = data?.rows ?? []
    return [...rs].sort((a, b) => {
      const dy = yearSortDir === "asc" ? a.year - b.year : b.year - a.year
      if (dy !== 0) return dy
      return monthSortDir === "asc" ? a.month - b.month : b.month - a.month
    })
  }, [data?.rows, yearSortDir, monthSortDir])

  const renderCell = useCallback(
    (row: ApiRow, rg: PivotRightGroup, sub: PivotRightGroup["subs"][number]) => {
      const c = row.cells?.[rg.key]
      if (!c) return <span className="text-gray-300">—</span>
      if (sub.key === "amount") return fmtMoney(c.amount) || <span className="text-gray-300">—</span>
      return fmtQty(c.qty) || <span className="text-gray-300">—</span>
    }, [])

  const renderGrandTotal = useCallback(
    (rg: PivotRightGroup, sub: PivotRightGroup["subs"][number]) => {
      const c = data?.totals?.byColumn?.[rg.key]
      if (!c) return ""
      return sub.key === "amount" ? fmtMoney(c.amount) : fmtQty(c.qty)
    }, [data])

  /**
   * Cell double-click — drill into Item Monthly Sales scoped to the (Year, Month, Store,
   * Department). Mirrors desktop RepDepartmentMonthlySales → RepItemsMonthlySales.
   */
  const onCellDoubleClick = useCallback(
    (row: ApiRow, rg: PivotRightGroup, _sub: PivotRightGroup["subs"][number]) => {
      const col = orderedColumns.find((c) => c.key === rg.key)
      if (!col) return
      const monthStart = `${row.year}-${String(row.month).padStart(2, "0")}-01`
      // Last day of month
      const last = new Date(row.year, row.month, 0)
      const monthEnd = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`
      const storeId = (col.storeId ?? "").toString()
      const deptId  = (col.departmentId ?? "").toString()

      openTab({
        id: `item-monthly-from-dept-${row.monthKey}-${storeId || "all"}-${deptId || "all"}`,
        title: `Item Monthly Sales — ${row.monthName} ${row.year} · ${col.departmentName}`,
        component: "ItemMonthlySalesPivotPage",
        props: {
          filters: {
            dateFrom: monthStart,
            dateTo: monthEnd,
            storeId: storeId || undefined,
            storeName: col.storeName || appliedStoreName,
            departmentId: deptId || undefined,
          },
        },
        closable: true,
      })
    },
    [orderedColumns, openTab, appliedStoreName]
  )

  const grand = data?.totals?.grand ?? { qty: 0, amount: 0 }
  const displayStoreName = appliedStoreId ? appliedStoreName : "All Stores"

  // ---- Export ----
  const amtField = (k: string) => `amt_${k.replace(/[^a-zA-Z0-9]+/g, "_")}`
  const qtyField = (k: string) => `qty_${k.replace(/[^a-zA-Z0-9]+/g, "_")}`
  const exportColumns = useMemo<GridUtilsColumn[]>(() => {
    const cols: GridUtilsColumn[] = [
      { field: "year",      headerName: "Year",  width: 80,  dataType: "string" },
      { field: "monthName", headerName: "Month", width: 110, dataType: "string" },
    ]
    for (const c of orderedColumns) {
      const label = `${c.departmentName} / ${c.storeName}`
      if (valueMode === "amount" || valueMode === "both") {
        cols.push({
          field: amtField(c.key),
          headerName: valueMode === "both" ? `${label} Amount` : label,
          width: 130,
          dataType: "number",
          cellRenderer: (v: any) => (v == null || v === "" ? "" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`),
        })
      }
      if (valueMode === "qty" || valueMode === "both") {
        cols.push({
          field: qtyField(c.key),
          headerName: valueMode === "both" ? `${label} Qty` : `${label} (Qty)`,
          width: 90,
          dataType: "number",
          cellRenderer: (v: any) => (v == null || v === "" ? "" : Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 })),
        })
      }
    }
    return cols
  }, [orderedColumns, valueMode])

  const fetchAllExportRows = useCallback(async (): Promise<any[]> => {
    if (!data) return []
    const flat: any[] = []
    for (const r of orderedRows) {
      const fr: Record<string, any> = { year: String(r.year), monthName: r.monthName }
      for (const c of orderedColumns) {
        const cell = r.cells?.[c.key]
        fr[amtField(c.key)] = cell ? cell.amount : null
        fr[qtyField(c.key)] = cell ? cell.qty : null
      }
      flat.push(fr)
    }
    // Grand total row
    const gr: Record<string, any> = { year: "Grand Total", monthName: "" }
    for (const c of orderedColumns) {
      const tc = data.totals?.byColumn?.[c.key]
      gr[amtField(c.key)] = tc ? tc.amount : null
      gr[qtyField(c.key)] = tc ? tc.qty : null
    }
    flat.push(gr)
    return flat
  }, [data, orderedRows, orderedColumns])

  const exportModal = useExportModal({
    columns: exportColumns,
    fetchAllData: fetchAllExportRows,
    filename: "department-monthly-sales",
    pdfOptions: {
      title: `${REPORT_TITLE} Report`,
      subtitle: `${displayStoreName} | ${new Date(appliedFrom).toLocaleDateString()} - ${new Date(appliedTo).toLocaleDateString()}`,
      // Keep Year / Month on every horizontal page so a reader scanning across many
      // (department / store) columns can always tell which row a cell belongs to.
      repeatColumns: 2,
      orientation: "landscape",
    },
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{REPORT_TITLE}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{displayStoreName}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>{new Date(appliedFrom).toLocaleDateString()} – {new Date(appliedTo).toLocaleDateString()}</span>
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
                  <Flatpickr value={dateFrom} onChange={([d]) => setDateFrom(d ? d.toISOString().split("T")[0] : dateFrom)}
                    options={{ dateFormat: "Y-m-d", allowInput: true }} placeholder="From"
                    className="w-full h-10 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
                </div>
                <span className="text-gray-400 dark:text-gray-500 font-medium">to</span>
                <div className="w-[142px] relative">
                  <Flatpickr value={dateTo} onChange={([d]) => setDateTo(d ? d.toISOString().split("T")[0] : dateTo)}
                    options={{ dateFormat: "Y-m-d", allowInput: true }} placeholder="To"
                    className="w-full h-10 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500" />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Store</label>
              <select value={screenStoreId} onChange={(e) => setScreenStoreId(e.target.value)} disabled={loadingStores}
                className="h-10 min-w-[220px] px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60">
                <option value="">All Stores</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Year Order</label>
              <button type="button" onClick={() => setYearSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="h-10 px-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2">
                {yearSortDir === "asc"
                  ? (<><span className="text-base leading-none">▲</span><span>Oldest</span></>)
                  : (<><span className="text-base leading-none">▼</span><span>Latest</span></>)}
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Month Order</label>
              <button type="button" onClick={() => setMonthSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="h-10 px-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2">
                {monthSortDir === "asc"
                  ? (<><span className="text-base leading-none">▲</span><span>Jan → Dec</span></>)
                  : (<><span className="text-base leading-none">▼</span><span>Dec → Jan</span></>)}
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Dept Order</label>
              <button type="button" onClick={() => setDeptSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="h-10 px-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2">
                {deptSortDir === "asc"
                  ? (<><span className="text-base leading-none">▲</span><span>A → Z</span></>)
                  : (<><span className="text-base leading-none">▼</span><span>Z → A</span></>)}
              </button>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Show</label>
              <div className="inline-flex h-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 overflow-hidden">
                {(["amount", "qty", "both"] as const).map((m, idx) => (
                  <button key={m} type="button" onClick={() => setValueMode(m)}
                    className={[
                      "px-3 text-sm font-medium transition-colors",
                      idx > 0 ? "border-l border-gray-300 dark:border-gray-600" : "",
                      valueMode === m ? "bg-brand-500 text-white" : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600",
                    ].join(" ")}>
                    {m === "amount" ? "Amount" : m === "qty" ? "Qty" : "Both"}
                  </button>
                ))}
              </div>
            </div>

            <div className="ml-auto flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm overflow-hidden">
              <button onClick={handleSearch} disabled={loading} type="button"
                className="h-10 px-5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors flex items-center gap-2 border-0 border-r border-gray-200 dark:border-gray-600 disabled:opacity-60">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                {loading ? "Loading…" : "Search"}
              </button>
              <button onClick={exportModal.open} type="button" title="Preview, filter and export"
                className="h-10 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 border-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 5.414V19a2 2 0 01-2 2z" /></svg>
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      <div className="flex-1 min-h-0 p-6">
        <StickyPivotTable<ApiRow>
          leftColumns={leftColumns}
          rightGroups={rightGroups}
          rows={orderedRows}
          // Group rows by Year so the year only shows on its own header row, like desktop.
          groupBy={(r) => String(r.year)}
          renderCell={renderCell}
          renderGrandTotal={renderGrandTotal}
          grandTotalLabel="Grand Total"
          onCellDoubleClick={onCellDoubleClick}
          loading={loading}
          emptyMessage="No data for the selected criteria. Use filters and click Search to load data."
        />
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default DepartmentMonthlySalesPivotPage
