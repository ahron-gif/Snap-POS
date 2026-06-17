import React, { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import ReceiptModal from "../../components/common/ReceiptModal"
import ExportModal from "../../components/common/ExportModal"
import { useExportModal } from "../../hooks/useExportModal"
import { Column as GridUtilsColumn } from "../../gridUtils"

/**
 * Tender Totals Details — web port of desktop RepTendersCashier
 * (opened via double-click on a row/cell in the parent RepTenders pivot).
 *
 * Shows the transaction-level rows that make up the Register+Cashier cell
 * in the parent Tender Totals report. Reuses SP_GetTendersCashier server-side,
 * filtered by Cashier (and optionally RegisterNo) for the same date/store window.
 */

interface TenderTotalsDetailsRow {
  transactionType: string
  tenderType: string
  creditType: string
  transactionNo: string
  transactionID: string | null
  tenderDate: string | null
  amount: number
  cashier: string
  registerNo: string
  customerNo: string
  customerName: string
  storeName: string
}

interface ApiResponseShape {
  rows: TenderTotalsDetailsRow[]
  totalRecords: number
  grandTotalAmount: number
  cashier: string
  registerNo: string
}

interface TenderTotalsDetailsPageProps {
  /** Date range from the parent Tender Totals report (YYYY-MM-DD). */
  fromDate?: string
  toDate?: string
  fromTime?: string
  toTime?: string
  /** Store filter from parent. Empty string / undefined = All Stores. */
  storeId?: string
  storeName?: string
  /** "Include Payout" checkbox state on the parent. */
  includePayOut?: boolean
  /** Cashier identifier from the parent pivot row that was double-clicked. */
  cashier?: string
  /** Register/Location of the parent pivot row. */
  registerNo?: string
  /** Touched by openTab when the same tab is re-opened — triggers a refetch. */
  _refreshKey?: number
}

interface GridRow extends TenderTotalsDetailsRow {
  no: number
  dateDisplay: string
  timeDisplay: string
  /** Combined "TenderType / CreditType" for grouping under the parent-pivot column label. */
  tenderLabel: string
}

const fmtCurrency = (n: number | null | undefined) =>
  n == null ? "$0.00" : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function buildColumns(): Column[] {
  return [
    { field: "tenderLabel", headerName: "Tender", width: 180, sortable: true, filterable: true, visible: true, dataType: "string" },
    { field: "transactionNo", headerName: "Transaction No", width: 150, sortable: true, filterable: true, visible: true, dataType: "string" },
    { field: "transactionType", headerName: "Type", width: 120, sortable: true, filterable: true, visible: true, dataType: "string" },
    { field: "dateDisplay", headerName: "Date", width: 110, sortable: true, filterable: false, visible: true, dataType: "string" },
    { field: "timeDisplay", headerName: "Time", width: 100, sortable: true, filterable: false, visible: true, dataType: "string" },
    {
      field: "amount",
      headerName: "Amount",
      width: 130,
      sortable: true,
      filterable: false,
      visible: true,
      dataType: "number",
      cellRenderer: (v: number) => fmtCurrency(v),
    },
    { field: "cashier", headerName: "Cashier", width: 140, sortable: true, filterable: true, visible: true, dataType: "string" },
    { field: "registerNo", headerName: "Location", width: 120, sortable: true, filterable: true, visible: true, dataType: "string" },
    { field: "customerName", headerName: "Customer", width: 200, sortable: true, filterable: true, visible: true, dataType: "string" },
    { field: "customerNo", headerName: "Customer #", width: 120, sortable: true, filterable: true, visible: false, dataType: "string" },
    { field: "storeName", headerName: "Store", width: 150, sortable: true, filterable: true, visible: false, dataType: "string" },
    { field: "no", headerName: "No", width: 70, sortable: true, filterable: false, visible: true, dataType: "number" },
  ]
}

const TenderTotalsDetailsPage: React.FC<TenderTotalsDetailsPageProps> = ({
  fromDate,
  toDate,
  fromTime,
  toTime,
  storeId,
  storeName,
  includePayOut,
  cashier,
  registerNo,
  _refreshKey,
}) => {
  const { getAuthHeaders } = useAuthHeaders()
  const [rows, setRows] = useState<GridRow[]>([])
  const [grandTotal, setGrandTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drillError, setDrillError] = useState<string | null>(null)
  // Receipt-modal state — opens the desktop-parity Receipt view
  // (monospaced, line-oriented; same source the desktop's FrmReciept
  // pulls via SP_GetReciept) on double-click.
  const [receiptTxId, setReceiptTxId] = useState<string | null>(null)
  const [receiptTxNo, setReceiptTxNo] = useState<string | undefined>(undefined)

  const fetchData = useCallback(async () => {
    if (!fromDate || !toDate || !cashier) return
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        fromDate,
        toDate,
        fromTime: fromTime || "00:00",
        toTime: toTime || "23:59",
        includePayOut: includePayOut ?? true,
        cashier,
        registerNo: registerNo ?? "",
      }
      if (storeId && storeId.trim().length > 0) body.storeId = storeId.trim()

      const res = await axios.post(API_ENDPOINTS.REPORTS.TENDER_TOTALS_DETAILS, body, {
        headers: getAuthHeaders(),
      })

      const ok = res.data?.isSuccess ?? res.data?.IsSuccess
      if (ok) {
        const r = (res.data?.response ?? res.data?.Response) as ApiResponseShape
        const decorated: GridRow[] = (r?.rows ?? []).map((row, idx) => {
          const dt = row.tenderDate ? new Date(row.tenderDate) : null
          const tt = (row.tenderType ?? "").trim()
          const ct = (row.creditType ?? "").trim()
          const tenderLabel =
            tt && ct && ct.toLowerCase() !== "other cc"
              ? `${tt} / ${ct}`
              : tt || ct
          return {
            ...row,
            no: idx + 1,
            tenderLabel,
            dateDisplay: dt ? dt.toLocaleDateString() : "",
            timeDisplay: dt ? dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "",
          }
        })
        setRows(decorated)
        setGrandTotal(r?.grandTotalAmount ?? 0)
      } else {
        setError(res.data?.message || "Failed to load tender details.")
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load tender details.")
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, fromTime, toTime, storeId, includePayOut, cashier, registerNo, getAuthHeaders])

  useEffect(() => {
    fetchData()
  }, [fetchData, _refreshKey])

  const columns = useMemo(() => buildColumns(), [])

  /**
   * Drill-down on a transaction row → opens the Receipt modal with
   * the formatted, monospaced receipt for this transaction. Mirrors
   * the legacy desktop FrmReciept dialog that opens from the tender
   * details grid in RepTendersCashier.
   *
   * Some rows can come back from SP_GetTendersCashier without a
   * transactionID populated (e.g. legacy pay-out / no-sale entries).
   * Those rows surface a friendly amber banner instead of opening a
   * blank modal.
   */
  const handleRowDoubleClick = useCallback((row: any) => {
    const r = (row || {}) as Partial<GridRow>
    const txId = String(r.transactionID ?? "").trim()
    if (!txId) {
      setDrillError("This row has no transaction record — no receipt to open.")
      window.setTimeout(() => setDrillError(null), 3500)
      return
    }
    const txNo = String(r.transactionNo ?? "").trim()
    setReceiptTxId(txId)
    setReceiptTxNo(txNo || undefined)
  }, [])

  const subtitle = useMemo(() => {
    const parts: string[] = []
    if (cashier) parts.push(`Cashier: ${cashier}`)
    if (registerNo) parts.push(`Location: ${registerNo}`)
    if (storeName) parts.push(storeName)
    if (fromDate && toDate)
      parts.push(`${new Date(fromDate).toLocaleDateString()} – ${new Date(toDate).toLocaleDateString()}`)
    if (rows.length) parts.push(`${rows.length.toLocaleString()} rows`)
    if (grandTotal !== 0) parts.push(`Total ${fmtCurrency(grandTotal)}`)
    return parts.join(" | ")
  }, [cashier, registerNo, storeName, fromDate, toDate, rows.length, grandTotal])

  const fetchAllData = useCallback(async (): Promise<any[]> => rows, [rows])

  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "tender-totals-details",
    pdfOptions: {
      title: "Tender Totals Details",
      subtitle: subtitle || undefined,
      orientation: "landscape",
    },
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tender Totals Details</h1>
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
        {drillError && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {drillError}
          </div>
        )}

        {!cashier ? (
          <p className="text-sm text-gray-500">No cashier selected.</p>
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
                title="Tender Totals Details"
                totalRecords={rows.length}
                emptyMessage={loading ? "Loading…" : "No transactions for this cashier in the selected window"}
                getRowId={(r) => `${(r as GridRow)?.transactionID ?? ""}-${(r as GridRow)?.no ?? 0}`}
                // Double-click drill-down — opens the Receipt modal
                // for that transaction (line items + totals + payments
                // formatted exactly the way the desktop FrmReciept
                // does it). Matches what the user sees when they
                // double-click in the legacy RepTendersCashier grid.
                onRowDoubleClick={handleRowDoubleClick}
              />
            </div>
          </div>
        )}
      </div>

      {/* Receipt modal — appears on top of the page; cleared when
          the user hits Close / backdrop / Esc. */}
      <ReceiptModal
        transactionId={receiptTxId}
        transactionNo={receiptTxNo}
        onClose={() => { setReceiptTxId(null); setReceiptTxNo(undefined) }}
      />

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default TenderTotalsDetailsPage
