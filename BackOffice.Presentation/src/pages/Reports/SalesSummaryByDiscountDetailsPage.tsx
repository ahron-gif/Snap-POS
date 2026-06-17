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
 * Sales Summary By Discount — drill-down detail page.
 *
 * Desktop equivalent: RepDiscountSummary.GridDoubleClick -> RepDiscountDetails
 *   ("Discount Details for <Discount Name>")
 *
 * Opened as a tab from the parent grid's row double-click. The parent passes the row's
 * `discountId` + `discountName` + the applied date/store window; this page POSTs them to
 * `/api/Reports/SalesSummaryByDiscountDetails`, which builds the desktop-style filter
 * (`dbo.TransactionEntryView.ItemStoreID = '<DiscountID>'` + `EndSaleTime` range + StoreID)
 * and calls `SP_GetTransactionDiscount`.
 */

interface DetailsRow {
  transactionId: string
  transactionNo: string
  startSaleTime: string | null
  customerNo: string
  customerName: string
  totalBeforeDiscount: number | null
  discount: number | null
  qty: number | null
  saleTotal: number | null
  saleTotalWithoutTax: number | null
  paid: number | null
  storeId: string | null
}

interface ApiResponseShape {
  data: DetailsRow[]
  totalRecords: number
  totalQty: number
  totalDiscount: number
  totalSale: number
}

interface SalesSummaryByDiscountDetailsPageProps {
  /** Discount GUID — required. Server uses it as the `ItemStoreID` filter on TransactionEntryView. */
  discountId?: string
  /** Display-only discount name shown in the header. */
  discountName?: string
  /** Display-only store label inherited from the parent. */
  storeName?: string
  /** Optional store GUID to scope the drill-down to a single store. */
  storeId?: string
  /** ISO YYYY-MM-DD inherited from the parent's applied range. */
  fromDate?: string
  toDate?: string
  /** Touched by openTab when the same tab is re-opened — triggers a refetch. */
  _refreshKey?: number
}

interface GridRow extends DetailsRow {
  rowNo: number
  /** Pre-formatted M/D/YYYY for the Date column. */
  saleDateDisplay: string
}

const fmtCurrency = (v: number | null | undefined) =>
  v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtNumber = (v: number | null | undefined) =>
  v == null ? "0" : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 })}`

const fmtDate = (v: string | null | undefined): string => {
  if (!v) return ""
  const d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

const SalesSummaryByDiscountDetailsPage: React.FC<SalesSummaryByDiscountDetailsPageProps> = ({
  discountId,
  discountName,
  storeName,
  storeId,
  fromDate,
  toDate,
  _refreshKey,
}) => {
  const { getAuthHeaders } = useAuthHeaders()

  const [rows, setRows] = useState<GridRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalQty, setTotalQty] = useState(0)
  const [totalDiscount, setTotalDiscount] = useState(0)
  const [totalSale, setTotalSale] = useState(0)

  const fetchData = useCallback(async () => {
    if (!discountId) {
      setError("Missing discount id")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const headers = getAuthHeaders()
      const body: Record<string, unknown> = { discountId }
      if (fromDate) body.fromDate = fromDate
      if (toDate) body.toDate = toDate
      if (storeId && /^[0-9a-f-]{36}$/i.test(storeId.trim())) {
        body.storeId = storeId.trim()
      }

      const response = await axios.post(API_ENDPOINTS.REPORTS.SALES_SUMMARY_BY_DISCOUNT_DETAILS, body, { headers })
      const ok = response.data?.isSuccess ?? response.data?.IsSuccess
      if (!ok) {
        const msg =
          response.data?.message ||
          response.data?.Message ||
          "Failed to load Sales Summary By Discount drill-down"
        setError(msg)
        setRows([])
        setTotalRecords(0)
        setTotalQty(0)
        setTotalDiscount(0)
        setTotalSale(0)
        return
      }

      const res = (response.data?.response ?? response.data?.Response ?? {}) as Partial<ApiResponseShape>
      const dataRaw = (res.data as DetailsRow[] | undefined) ?? []
      const list: GridRow[] = dataRaw.map((r, idx) => ({
        ...r,
        rowNo: idx + 1,
        saleDateDisplay: fmtDate(r?.startSaleTime),
      }))
      setRows(list)
      setTotalRecords(Number(res.totalRecords ?? list.length))
      setTotalQty(Number(res.totalQty ?? 0))
      setTotalDiscount(Number(res.totalDiscount ?? 0))
      setTotalSale(Number(res.totalSale ?? 0))
    } catch (e: any) {
      console.error("Error loading Sales Summary By Discount drill-down", e)
      setError(e?.message || "Failed to load Sales Summary By Discount drill-down")
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders, discountId, fromDate, toDate, storeId])

  useEffect(() => {
    fetchData()
  }, [fetchData, _refreshKey])

  // Mirrors the desktop's RepDiscountDetails grid columns.
  // "Open Receipt" modal state.
  const [receiptTxId, setReceiptTxId] = useState<string | null>(null)
  const [receiptTxNo, setReceiptTxNo] = useState<string>("")
  const openReceipt = useCallback((txId: string | null | undefined, txNo: string | null | undefined) => {
    if (!txId) return
    setReceiptTxId(String(txId))
    setReceiptTxNo(String(txNo ?? ""))
  }, [])

  const columns: Column[] = useMemo(
    () => [
      {
        field: "transactionNo", headerName: "Transaction No.", width: 160, sortable: true, dataType: "string",
        cellRenderer: (v, row) => v
          ? (
              <button
                type="button"
                onClick={() => openReceipt(row?.transactionId, String(v))}
                className="text-brand-500 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
                title="Open Receipt"
              >
                {v}
              </button>
            )
          : "",
      },
      { field: "saleDateDisplay", headerName: "Date", width: 110, sortable: true, dataType: "string" },
      { field: "customerNo", headerName: "Customer No.", width: 140, sortable: true, dataType: "string" },
      { field: "customerName", headerName: "Customer Name", width: 220, sortable: true, dataType: "string" },
      { field: "qty", headerName: "Qty", width: 90, sortable: true, dataType: "number", cellRenderer: (v) => fmtNumber(v) },
      { field: "totalBeforeDiscount", headerName: "Before Disc.", width: 130, sortable: true, dataType: "number", cellRenderer: (v) => fmtCurrency(v) },
      { field: "discount", headerName: "Discount", width: 120, sortable: true, dataType: "number", cellRenderer: (v) => fmtCurrency(v) },
      { field: "saleTotalWithoutTax", headerName: "Sale (no tax)", width: 130, sortable: true, dataType: "number", cellRenderer: (v) => fmtCurrency(v) },
      { field: "saleTotal", headerName: "Sale Total", width: 130, sortable: true, dataType: "number", cellRenderer: (v) => fmtCurrency(v) },
      { field: "paid", headerName: "Paid", width: 120, sortable: true, dataType: "number", cellRenderer: (v) => fmtCurrency(v) },
    ],
    [openReceipt]
  )

  const headerTitle = discountName ? `Discount Details — ${discountName}` : "Discount Details"

  const fetchAllData = useCallback(async (): Promise<any[]> => rows, [rows])

  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "sales-summary-by-discount-details",
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
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
              {storeName && <span>{storeName}</span>}
              {fromDate && toDate && (
            <>
              {storeName && <span className="text-gray-300 dark:text-gray-600">|</span>}
              <span>
                {new Date(fromDate).toLocaleDateString()} – {new Date(toDate).toLocaleDateString()}
              </span>
            </>
          )}
          {totalRecords > 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>{totalRecords.toLocaleString()} transactions</span>
            </>
          )}
          {totalQty !== 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>Total Qty {fmtNumber(totalQty)}</span>
            </>
          )}
          {totalDiscount !== 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>Total Disc. {fmtCurrency(totalDiscount)}</span>
            </>
          )}
          {totalSale !== 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>Total Sale {fmtCurrency(totalSale)}</span>
            </>
          )}
            </div>
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
            title="Discount Details"
            totalRecords={totalRecords}
            emptyMessage="No transactions found for this discount"
            getRowId={(row) => (row as any)?.transactionId ?? `row-${(row as any)?.rowNo}`}
          />
        </div>
      </div>

      <ReceiptModal
        transactionId={receiptTxId}
        transactionNo={receiptTxNo}
        onClose={() => setReceiptTxId(null)}
      />

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default SalesSummaryByDiscountDetailsPage
