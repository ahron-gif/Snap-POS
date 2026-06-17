import React, { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import ExportModal from "../../components/common/ExportModal"
import { useExportModal } from "../../hooks/useExportModal"
import { Column as GridUtilsColumn } from "../../gridUtils"

/**
 * On Account Sales / Payments — drill-down detail page.
 *
 * Desktop equivalent: RepAcountReceivableSales.ClickOnRow -> FrmLiveReport
 *   ("Account Receivable Sales For <NAME>" / "...Payments For <NAME>")
 *
 * Opens as a tab from the parent grid's row double-click or right-click menu
 * with the same date/store window plus the chosen customer identifier.
 */

interface DetailsRow {
  transactionNo: string
  type: string
  date: string | null
  userName: string
  customerNo: string
  customerName: string
  total: number
  amount: number
  amountSales: number
  amountPayments: number
}

interface ApiResponseShape {
  rows: DetailsRow[]
  totalRecords: number
  grandTotalAmount: number
  customerNo: string
  customerName: string
}

interface OnAccountSalesDetailsPageProps {
  /** Date range carried over from the parent report (YYYY-MM-DD). */
  fromDate?: string
  toDate?: string
  /** Store filter. Empty/undefined = All Stores. */
  storeId?: string
  storeName?: string
  /** Customer identifiers — prefer customerId, fall back to customerNo. */
  customerId?: string
  customerNo?: string
  /** Customer display label for the heading ("LASTNAME, FIRSTNAME" or similar). */
  customerName?: string
  /** "sales" (default) or "payments" — picks the parent report mode. */
  mode?: "sales" | "payments"
  /** Touched by openTab when the same tab is re-opened — triggers a refetch. */
  _refreshKey?: number
}

interface GridRow extends DetailsRow {
  no: number
  dateDisplay: string
}

const fmtCurrency = (v: number | null | undefined) =>
  v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Parse a "YYYY-MM-DD" date string as LOCAL midnight (not UTC). This avoids the
 * off-by-one that happens when `new Date("2020-01-01")` is parsed as UTC and then
 * formatted in a negative-UTC timezone (which would display "12/31/2019" instead
 * of "1/1/2020").
 */
const fmtDateLabel = (s: string | undefined | null): string => {
  if (!s) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return d.toLocaleDateString()
  }
  return new Date(s).toLocaleDateString()
}

function buildColumns(): Column[] {
  return [
    { field: "transactionNo", headerName: "No.", width: 130, sortable: true, filterable: true, visible: true, dataType: "string" },
    { field: "type", headerName: "Type", width: 100, sortable: true, filterable: true, visible: true, dataType: "string" },
    { field: "dateDisplay", headerName: "Date", width: 120, sortable: true, filterable: false, visible: true, dataType: "string" },
    { field: "userName", headerName: "User", width: 100, sortable: true, filterable: true, visible: true, dataType: "string" },
    { field: "customerNo", headerName: "Customer No", width: 140, sortable: true, filterable: true, visible: true, dataType: "string" },
    { field: "customerName", headerName: "Customer Name", width: 200, sortable: true, filterable: true, visible: true, dataType: "string" },
    {
      field: "total",
      headerName: "Total",
      width: 110,
      sortable: true,
      filterable: false,
      visible: true,
      dataType: "number",
      cellRenderer: (v: number) => fmtCurrency(v),
    },
    {
      field: "amount",
      headerName: "Amount",
      width: 110,
      sortable: true,
      filterable: false,
      visible: true,
      dataType: "number",
      cellRenderer: (v: number) => fmtCurrency(v),
    },
  ]
}

const OnAccountSalesDetailsPage: React.FC<OnAccountSalesDetailsPageProps> = ({
  fromDate,
  toDate,
  storeId,
  storeName,
  customerId,
  customerNo,
  customerName,
  mode = "sales",
  _refreshKey,
}) => {
  const { getAuthHeaders } = useAuthHeaders()
  const [rows, setRows] = useState<GridRow[]>([])
  const [grandTotal, setGrandTotal] = useState(0)
  const [resolvedCustomerName, setResolvedCustomerName] = useState(customerName ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!fromDate || !toDate || (!customerId && !customerNo)) return
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        fromDate,
        toDate,
        mode,
      }
      if (storeId && storeId.trim().length > 0) body.storeId = storeId.trim()
      if (customerId && customerId.trim().length > 0) body.customerId = customerId.trim()
      if (customerNo && customerNo.trim().length > 0) body.customerNo = customerNo.trim()

      const res = await axios.post(API_ENDPOINTS.REPORTS.ON_ACCOUNT_SALES_DETAILS, body, {
        headers: getAuthHeaders(),
      })

      const ok = res.data?.isSuccess ?? res.data?.IsSuccess
      if (ok) {
        const r = (res.data?.response ?? res.data?.Response) as ApiResponseShape
        const decorated: GridRow[] = (r?.rows ?? []).map((row, idx) => {
          const dt = row.date ? new Date(row.date) : null
          return {
            ...row,
            no: idx + 1,
            dateDisplay: dt ? dt.toLocaleDateString() : "",
          }
        })
        setRows(decorated)
        setGrandTotal(r?.grandTotalAmount ?? 0)
        if (r?.customerName) setResolvedCustomerName(r.customerName)
      } else {
        setError(res.data?.message || "Failed to load drill-down details.")
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load drill-down details.")
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, storeId, customerId, customerNo, mode, getAuthHeaders])

  useEffect(() => {
    fetchData()
  }, [fetchData, _refreshKey])

  const columns = useMemo(() => buildColumns(), [])

  const heading = useMemo(() => {
    const label = mode === "payments" ? "Account Receivable Payments For" : "Account Receivable Sales For"
    const name = resolvedCustomerName || customerNo || ""
    return `${label} ${name}`.trim()
  }, [mode, resolvedCustomerName, customerNo])

  const subtitle = useMemo(() => {
    const parts: string[] = []
    // Show the scope explicitly so it's obvious whether the drill-down inherited
    // "All Stores" or a specific store filter from the parent report.
    parts.push(storeName?.trim() ? storeName.trim() : "All Stores")
    if (fromDate && toDate)
      parts.push(`${fmtDateLabel(fromDate)} – ${fmtDateLabel(toDate)}`)
    if (rows.length) parts.push(`${rows.length.toLocaleString()} rows`)
    if (grandTotal !== 0) parts.push(`Total ${fmtCurrency(grandTotal)}`)
    return parts.join(" | ")
  }, [storeName, fromDate, toDate, rows.length, grandTotal])

  const fetchAllData = useCallback(async (): Promise<any[]> => rows, [rows])

  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "on-account-sales-details",
    pdfOptions: {
      title: heading,
      subtitle: subtitle,
      orientation: "landscape",
    },
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{heading}</h1>
            {subtitle && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm shrink-0 overflow-visible">
            <button
              onClick={exportModal.open}
              type="button"
              className="h-10 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 rounded-lg"
              title="Preview, filter and export"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 5.414V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 p-6">
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!customerId && !customerNo ? (
          <p className="text-sm text-gray-500">No customer selected.</p>
        ) : (
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex-1 min-h-0 flex">
            <div className="flex-1 min-h-0">
              <ServerGrid
                hideDefaultContextMenuItems={true}
                data={rows}
                columns={columns}
                loading={loading}
                error={error}
                pagination={true}
                pageSize={100}
                columnChooser={true}
                title="On Account Details"
                totalRecords={rows.length}
                emptyMessage={loading ? "Loading…" : "No transactions for this customer in the selected window"}
                getRowId={(r) => `${(r as GridRow)?.transactionNo ?? ""}-${(r as GridRow)?.no ?? 0}`}
              />
            </div>
          </div>
        )}
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default OnAccountSalesDetailsPage
