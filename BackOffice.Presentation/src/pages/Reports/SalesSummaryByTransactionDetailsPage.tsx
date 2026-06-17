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
 * Sales Summary By Transaction — drill-down detail page.
 *
 * Desktop equivalent: RepSalesProfit.GridDoubleClick -> RepEntryProfit
 *   ("Sales Profit Details for transaction <No>")
 *
 * Opened as a tab from the parent grid's row double-click. The parent passes the
 * row's `transactionId`; this page POSTs it to `/api/Reports/SalesSummaryByTransactionDetails`,
 * which calls SP_GetEntryProfit and returns the per-line profit breakdown for that
 * transaction.
 */

interface DetailsRow {
  name: string
  uomPrice: number | null
  uomQty: number | null
  total: number | null
  cost: number | null
  discountPerc: number | null
  discountAmount: number | null
  totalAfterDiscount: number | null
  markup: number | null
  margin: number | null
  profit: number | null
  discountOnTotal: number | null
}

interface ApiResponseShape {
  data: DetailsRow[]
  totalRecords: number
  totalProfit: number
  totalCost: number
  totalAmount: number
}

interface SalesSummaryByTransactionDetailsPageProps {
  /** Transaction GUID — required for the backend to query SP_GetEntryProfit. */
  transactionId?: string
  /** Display-only transaction number for the header (e.g. "NE-311856"). */
  transactionNo?: string
  /** Display-only customer label inherited from the parent row. */
  customerName?: string
  /** Display-only store label inherited from the parent. */
  storeName?: string
  /** Touched by openTab when the same tab is re-opened — triggers a refetch. */
  _refreshKey?: number
}

interface GridRow extends DetailsRow {
  rowNo: number
}

const fmtCurrency = (v: number | null | undefined) =>
  v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtNumber = (v: number | null | undefined) =>
  v == null ? "0" : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 })}`

const fmtPercent = (v: number | null | undefined) => {
  if (v == null) return ""
  const n = Number(v)
  if (!isFinite(n)) return String(v)
  return `${n.toFixed(2)}%`
}

const SalesSummaryByTransactionDetailsPage: React.FC<SalesSummaryByTransactionDetailsPageProps> = ({
  transactionId,
  transactionNo,
  customerName,
  storeName,
  _refreshKey,
}) => {
  const { getAuthHeaders } = useAuthHeaders()

  const [rows, setRows] = useState<GridRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)

  const fetchData = useCallback(async () => {
    if (!transactionId) {
      setError("Missing transaction id")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const headers = getAuthHeaders()
      const body = { transactionId }
      const response = await axios.post(API_ENDPOINTS.REPORTS.SALES_SUMMARY_BY_TRANSACTION_DETAILS, body, { headers })
      const ok = response.data?.isSuccess ?? response.data?.IsSuccess
      if (!ok) {
        const msg =
          response.data?.message ||
          response.data?.Message ||
          "Failed to load Sales Summary By Transaction drill-down"
        setError(msg)
        setRows([])
        setTotalRecords(0)
        setTotalProfit(0)
        setTotalCost(0)
        setTotalAmount(0)
        return
      }

      const res = (response.data?.response ?? response.data?.Response ?? {}) as Partial<ApiResponseShape>
      const dataRaw = (res.data as DetailsRow[] | undefined) ?? []
      const list: GridRow[] = dataRaw.map((r, idx) => ({ ...r, rowNo: idx + 1 }))
      setRows(list)
      setTotalRecords(Number(res.totalRecords ?? list.length))
      setTotalProfit(Number(res.totalProfit ?? 0))
      setTotalCost(Number(res.totalCost ?? 0))
      setTotalAmount(Number(res.totalAmount ?? 0))
    } catch (e: any) {
      console.error("Error loading Sales Summary By Transaction drill-down", e)
      setError(e?.message || "Failed to load Sales Summary By Transaction drill-down")
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders, transactionId])

  useEffect(() => {
    fetchData()
  }, [fetchData, _refreshKey])

  // Column layout mirrors the desktop RepEntryProfit grid.
  const columns: Column[] = useMemo(
    () => [
      { field: "name", headerName: "Item", width: 260, sortable: true, dataType: "string" },
      { field: "uomPrice", headerName: "UOM Price", width: 120, sortable: true, dataType: "number", cellRenderer: (v) => fmtCurrency(v) },
      { field: "uomQty", headerName: "Qty", width: 100, sortable: true, dataType: "number", cellRenderer: (v) => fmtNumber(v) },
      { field: "total", headerName: "Total", width: 120, sortable: true, dataType: "number", cellRenderer: (v) => fmtCurrency(v) },
      { field: "cost", headerName: "Cost", width: 120, sortable: true, dataType: "number", cellRenderer: (v) => fmtCurrency(v) },
      { field: "discountPerc", headerName: "Disc %", width: 100, sortable: true, dataType: "number", cellRenderer: (v) => fmtPercent(v) },
      { field: "discountAmount", headerName: "Disc Amt", width: 120, sortable: true, dataType: "number", cellRenderer: (v) => fmtCurrency(v) },
      { field: "totalAfterDiscount", headerName: "After Disc.", width: 130, sortable: true, dataType: "number", cellRenderer: (v) => fmtCurrency(v) },
      { field: "markup", headerName: "Markup", width: 100, sortable: true, dataType: "number", cellRenderer: (v) => fmtPercent(v) },
      { field: "margin", headerName: "Margin", width: 100, sortable: true, dataType: "number", cellRenderer: (v) => fmtPercent(v) },
      { field: "profit", headerName: "Profit", width: 120, sortable: true, dataType: "number", cellRenderer: (v) => fmtCurrency(v) },
      { field: "discountOnTotal", headerName: "Disc. on Total", width: 130, sortable: true, dataType: "number", cellRenderer: (v) => fmtCurrency(v) },
    ],
    []
  )

  const headerTitle = transactionNo
    ? `Sales Profit Details — ${transactionNo}`
    : "Sales Profit Details"

  // "Open Receipt" toggle — all rows on this page belong to the SAME transaction, so the
  // button lives once in the header rather than per-row.
  const [receiptOpen, setReceiptOpen] = useState(false)

  const fetchAllData = useCallback(async (): Promise<any[]> => rows, [rows])

  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "sales-summary-by-transaction-details",
    pdfOptions: {
      title: headerTitle,
      subtitle: storeName,
      orientation: "landscape",
    },
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{headerTitle}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {transactionId && (
              <button
                type="button"
                onClick={() => setReceiptOpen(true)}
                className="h-9 px-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 shrink-0"
                title="Open Receipt"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
                </svg>
                Open Receipt
              </button>
            )}
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
        <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
          {storeName && <span>{storeName}</span>}
          {storeName && customerName && <span className="text-gray-300 dark:text-gray-600">|</span>}
          {customerName && <span>{customerName}</span>}
          {totalRecords > 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>{totalRecords.toLocaleString()} lines</span>
            </>
          )}
          {totalAmount !== 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>Total {fmtCurrency(totalAmount)}</span>
            </>
          )}
          {totalCost !== 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>Cost {fmtCurrency(totalCost)}</span>
            </>
          )}
          {totalProfit !== 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>Profit {fmtCurrency(totalProfit)}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
          <ServerGrid
            hideDefaultContextMenuItems={true}
            data={rows}
            columns={columns}
            loading={loading}
            error={error}
            pagination={true}
            pageSize={100}
            columnChooser={true}
            title="Sales Profit Details"
            totalRecords={totalRecords}
            emptyMessage="No line items for this transaction"
            getRowId={(row) => `${(row as any)?.rowNo}-${(row as any)?.name ?? ""}`}
          />
        </div>
      </div>

      <ReceiptModal
        transactionId={receiptOpen ? transactionId ?? null : null}
        transactionNo={transactionNo}
        onClose={() => setReceiptOpen(false)}
      />

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default SalesSummaryByTransactionDetailsPage
