import React, { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import ReceiptModal from "../../components/common/ReceiptModal"
import ExportModal from "../../components/common/ExportModal"
import { useExportModal } from "../../hooks/useExportModal"
import { Column as GridUtilsColumn } from "../../gridUtils"

/**
 * Pivot drill-down detail page — "Sales Details for {ItemName}".
 *
 * Opened from the daily / weekly / monthly pivot's cell double-click. Receives the master
 * ItemID + the cell's date window + (optionally) DepartmentID for manual items, then POSTs
 * to /api/Reports/ItemSalesTransactions and renders transactions in the same columns the
 * desktop's RepMothlySalesDetails / RepWeeklySalesDetails shows:
 *
 *   Transaction No | Date | Type | Qty | Price | Ext Cost | Cost | Ext Price
 *
 * For manual rows (no ItemID), backend falls back to ItemName + DepartmentID matching.
 */

interface DetailsRow {
  transactionId: string
  transactionNo: string
  saleDate: string | null
  transactionType: number
  qty: number | null
  price: number | null
  cost: number | null
  extCost: number | null
  extPrice: number | null
  storeId: string | null
  storeName: string | null
}

interface ApiResponseShape {
  data: DetailsRow[]
  totalRecords: number
  totalQty: number
  totalExtCost: number
  totalExtPrice: number
}

interface ItemSalesTransactionsDetailsPageProps {
  /** Master ItemID — null/empty for manual items (server falls back to itemName matching). */
  itemId?: string
  /** Display name + manual-item key. */
  itemName?: string
  /** Optional DepartmentID disambiguator (for manual items). */
  departmentId?: string
  /** Friendly text shown in the header chip. */
  storeName?: string
  /** Optional store filter. */
  storeId?: string
  /** Inclusive yyyy-MM-dd window covering the clicked cell (single day / week / month). */
  fromDate?: string
  toDate?: string
  /** When the same tab is re-opened from another double-click, bumped to trigger refetch. */
  _refreshKey?: number
}

interface GridRow extends DetailsRow {
  rowNo: number
  saleDateDisplay: string
  typeLabel: string
}

const fmtMoney = (v: number | null | undefined): string => {
  if (v == null || !Number.isFinite(v)) return ""
  return `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
const fmtQty = (v: number | null | undefined): string => {
  if (v == null || !Number.isFinite(v)) return ""
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 })
}
const fmtDate = (v: string | null | undefined): string => {
  if (!v) return ""
  const d = new Date(v)
  if (isNaN(d.getTime())) return String(v)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}
/** Best-effort transaction-type label. Desktop labels these with similar strings. */
const typeLabel = (t: number): string => {
  switch (t) {
    case 0: return "Sale"
    case 1: return "Return"
    case 2: return "Void"
    case 3: return "Refund"
    case 4: return "Discount"
    default: return String(t ?? "")
  }
}

const ItemSalesTransactionsDetailsPage: React.FC<ItemSalesTransactionsDetailsPageProps> = ({
  itemId,
  itemName,
  departmentId,
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
  const [totalExtPrice, setTotalExtPrice] = useState(0)
  const [totalExtCost, setTotalExtCost] = useState(0)

  // "Open Receipt" modal — set the txId to show, clear it to dismiss.
  const [receiptTxId, setReceiptTxId] = useState<string | null>(null)
  const [receiptTxNo, setReceiptTxNo] = useState<string>("")
  const openReceipt = useCallback((txId: string | null | undefined, txNo: string | null | undefined) => {
    if (!txId) return
    setReceiptTxId(String(txId))
    setReceiptTxNo(String(txNo ?? ""))
  }, [])

  const fetchData = useCallback(async () => {
    // Need at least an item key OR a name to drill into something — otherwise the backend
    // would do nothing (matches desktop where double-clicking a totals cell doesn't open).
    const trimmedId = (itemId ?? "").trim()
    const trimmedName = (itemName ?? "").trim()
    if (!trimmedId && !trimmedName) {
      setError("Missing item id or name")
      return
    }
    if (!fromDate || !toDate) {
      setError("Missing date range")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const headers = getAuthHeaders()
      const EMPTY_GUID = "00000000-0000-0000-0000-000000000000"
      const body: Record<string, unknown> = {
        itemId: trimmedId && trimmedId.toLowerCase() !== EMPTY_GUID ? trimmedId : null,
        itemName: trimmedName || null,
        departmentId: departmentId && departmentId.toLowerCase() !== EMPTY_GUID ? departmentId : null,
        fromDate,
        toDate,
        storeId: storeId && storeId.toLowerCase() !== EMPTY_GUID ? storeId : null,
      }
      const response = await axios.post(API_ENDPOINTS.REPORTS.ITEM_SALES_TRANSACTIONS, body, { headers })
      const ok = response.data?.isSuccess ?? response.data?.IsSuccess
      if (!ok) {
        const msg =
          response.data?.message ||
          response.data?.Message ||
          "Failed to load item sales transactions"
        setError(msg)
        setRows([]); setTotalRecords(0); setTotalQty(0); setTotalExtPrice(0); setTotalExtCost(0)
        return
      }
      const res = (response.data?.response ?? response.data?.Response ?? {}) as Partial<ApiResponseShape>
      const dataRaw = (res.data as DetailsRow[] | undefined) ?? []
      const list: GridRow[] = dataRaw.map((r, idx) => ({
        ...r,
        rowNo: idx + 1,
        saleDateDisplay: fmtDate(r?.saleDate),
        typeLabel: typeLabel(r?.transactionType ?? 0),
      }))
      setRows(list)
      setTotalRecords(Number(res.totalRecords ?? list.length))
      setTotalQty(Number(res.totalQty ?? 0))
      setTotalExtPrice(Number(res.totalExtPrice ?? 0))
      setTotalExtCost(Number(res.totalExtCost ?? 0))
    } catch (e: any) {
      console.error("Error loading item sales transactions", e)
      setError(e?.message || "Failed to load item sales transactions")
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders, itemId, itemName, departmentId, storeId, fromDate, toDate])

  useEffect(() => {
    fetchData()
  }, [fetchData, _refreshKey])

  // Columns mirror the desktop RepMothlySalesDetails: TransactionNo, Date, Type, Qty, Price,
  // Ext Cost, Cost, Ext Price.
  const columns: Column[] = useMemo(
    () => [
      // Transaction No. is rendered as a link that opens the Receipt modal — matches desktop
      // FrmReciept double-click behavior on transaction grid rows.
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
      { field: "saleDateDisplay", headerName: "Date",            width: 110, sortable: true, dataType: "string" },
      { field: "typeLabel",       headerName: "Type",            width: 100, sortable: true, dataType: "string" },
      { field: "qty",             headerName: "Qty",             width: 90,  sortable: true, dataType: "number", cellRenderer: (v) => fmtQty(v) },
      { field: "price",           headerName: "Price",           width: 110, sortable: true, dataType: "number", cellRenderer: (v) => fmtMoney(v) },
      { field: "extCost",         headerName: "Ext Cost",        width: 110, sortable: true, dataType: "number", cellRenderer: (v) => fmtMoney(v) },
      { field: "cost",            headerName: "Cost",            width: 110, sortable: true, dataType: "number", cellRenderer: (v) => fmtMoney(v) },
      { field: "extPrice",        headerName: "Ext Price",       width: 120, sortable: true, dataType: "number", cellRenderer: (v) => fmtMoney(v) },
      { field: "storeName",       headerName: "Store",           width: 160, sortable: true, dataType: "string" },
    ],
    [openReceipt]
  )

  const headerTitle = itemName ? `Sales Details for ${itemName}` : "Sales Details"

  const fetchAllData = useCallback(async (): Promise<any[]> => rows, [rows])

  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "item-sales-transactions-details",
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
              <span>Total Qty {fmtQty(totalQty)}</span>
            </>
          )}
          {totalExtPrice !== 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>Total Ext Price {fmtMoney(totalExtPrice)}</span>
            </>
          )}
          {totalExtCost !== 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>Total Ext Cost {fmtMoney(totalExtCost)}</span>
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
            title="Sales Details"
            totalRecords={totalRecords}
            emptyMessage="No transactions found for this item in the selected window"
            getRowId={(row) => (row as any)?.transactionId ?? `row-${(row as any)?.rowNo}`}
          />
        </div>
      </div>

      {/* Receipt modal — opened from the Transaction No. link in any data row. */}
      <ReceiptModal
        transactionId={receiptTxId}
        transactionNo={receiptTxNo}
        onClose={() => setReceiptTxId(null)}
      />

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default ItemSalesTransactionsDetailsPage
