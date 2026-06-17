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
 * Daily Hour Sales — drill-down detail page.
 *
 * Desktop equivalent: RepDailyHoursSales.ClickOnTheGrid -> FrmLiveReport
 *   ("Daily Hours Sales For <Day>, <Date> / <Hour bucket>")
 *
 * Opened as a tab from the parent grid's row double-click. The parent passes the
 * row's `hourStart` (DateTime ISO string — bucket start) and `storeId`; this page
 * POSTs them to `/api/Reports/DailyHourSalesDetails`, which calls SP_GetInvoices
 * with a [hourStart, hourStart + 1h) window for that store.
 */

interface DetailsRow {
  no: string
  type: string
  date: string | null
  userName: string
  customerNo: string
  customerName: string
  total: number | null
  openBalance: number | null
  amountPay: number | null
  amount: number | null
  transactionId?: string | null
}

interface ApiResponseShape {
  data: DetailsRow[]
  totalRecords: number
  totalAmount: number
  hourLabel: string
  storeName: string
}

interface DailyHourSalesDetailsPageProps {
  /** Bucket start (DateTime ISO string). Required — the backend builds the [+1h) range from this. */
  hourStart?: string
  /** Store filter. Empty/undefined = all stores. */
  storeId?: string
  /** Display-only store label inherited from the parent. */
  storeName?: string
  /** Display-only — the desktop's "Daily Hours Sales For …" header is rebuilt server-side, but
   *  if the parent already computed it the page uses it before the response arrives. */
  hourLabel?: string
  /** Touched by openTab when the same tab is re-opened — triggers a refetch. */
  _refreshKey?: number
}

interface GridRow extends DetailsRow {
  rowNo: number
  dateDisplay: string
}

const fmtCurrency = (v: number | null | undefined) =>
  v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDateTime = (s: string | null | undefined): string => {
  if (!s) return ""
  const d = new Date(s)
  if (isNaN(d.getTime())) return String(s)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

const DailyHourSalesDetailsPage: React.FC<DailyHourSalesDetailsPageProps> = ({
  hourStart,
  storeId,
  storeName,
  hourLabel,
  _refreshKey,
}) => {
  const { getAuthHeaders } = useAuthHeaders()

  const [rows, setRows] = useState<GridRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [resolvedHourLabel, setResolvedHourLabel] = useState<string>(hourLabel ?? "")
  const [resolvedStoreName, setResolvedStoreName] = useState<string>(storeName ?? "")

  const fetchData = useCallback(async () => {
    if (!hourStart) {
      setError("Missing hour bucket")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const headers = getAuthHeaders()
      const body: Record<string, unknown> = { hourStart }
      const validStoreId =
        typeof storeId === "string" &&
        storeId.trim().length > 0 &&
        /^[0-9a-f-]{36}$/i.test(storeId.trim())
      if (validStoreId) body.storeId = storeId!.trim()

      const response = await axios.post(API_ENDPOINTS.REPORTS.DAILY_HOUR_SALES_DETAILS, body, { headers })
      const ok = response.data?.isSuccess ?? response.data?.IsSuccess
      if (!ok) {
        const msg = response.data?.message || response.data?.Message || "Failed to load Daily Hour Sales drill-down"
        setError(msg)
        setRows([])
        setTotalRecords(0)
        setTotalAmount(0)
        return
      }

      const res = (response.data?.response ?? response.data?.Response ?? {}) as Partial<ApiResponseShape>
      const dataRaw = (res.data as DetailsRow[] | undefined) ?? []
      const list: GridRow[] = dataRaw.map((r, idx) => ({
        ...r,
        rowNo: idx + 1,
        dateDisplay: fmtDateTime(r?.date),
      }))
      setRows(list)
      setTotalRecords(Number(res.totalRecords ?? list.length))
      setTotalAmount(Number(res.totalAmount ?? 0))
      if (res.hourLabel) setResolvedHourLabel(res.hourLabel)
      if (res.storeName) setResolvedStoreName(res.storeName)
    } catch (e: any) {
      console.error("Error loading Daily Hour Sales drill-down", e)
      setError(e?.message || "Failed to load Daily Hour Sales drill-down")
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders, hourStart, storeId])

  useEffect(() => {
    fetchData()
  }, [fetchData, _refreshKey])

  // Column layout matches the desktop FrmLiveReport: No / Type / Date / User /
  // Customer No / Customer Name / Total / OpenBalance / Amount Pay / Amount.
  const columns: Column[] = useMemo(
    () => [
      { field: "no", headerName: "No.", width: 130, sortable: true, dataType: "string" },
      { field: "type", headerName: "Type", width: 100, sortable: true, dataType: "string" },
      { field: "dateDisplay", headerName: "Date", width: 110, sortable: true, dataType: "string" },
      { field: "userName", headerName: "User", width: 100, sortable: true, dataType: "string" },
      { field: "customerNo", headerName: "Customer No", width: 160, sortable: true, dataType: "string" },
      { field: "customerName", headerName: "Customer Name", width: 220, sortable: true, dataType: "string" },
      { field: "total", headerName: "Total", width: 120, sortable: true, dataType: "number", cellRenderer: (v) => fmtCurrency(v) },
      { field: "openBalance", headerName: "OpenBalance", width: 130, sortable: true, dataType: "number", cellRenderer: (v) => fmtCurrency(v) },
      { field: "amountPay", headerName: "Amount Pay", width: 130, sortable: true, dataType: "number", cellRenderer: (v) => fmtCurrency(v) },
      { field: "amount", headerName: "Amount", width: 130, sortable: true, dataType: "number", cellRenderer: (v) => fmtCurrency(v) },
    ],
    []
  )

  const fetchAllData = useCallback(async (): Promise<any[]> => rows, [rows])

  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "daily-hour-sales-details",
    pdfOptions: {
      title: "Daily Hours Sales",
      subtitle: resolvedStoreName || undefined,
      orientation: "landscape",
    },
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Daily Hours Sales</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
              {resolvedStoreName && <span>{resolvedStoreName}</span>}
          {resolvedStoreName && resolvedHourLabel && (
            <span className="text-gray-300 dark:text-gray-600">|</span>
          )}
          {resolvedHourLabel && <span>{resolvedHourLabel}</span>}
          {totalRecords > 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>{totalRecords.toLocaleString()} records</span>
            </>
          )}
          {totalAmount > 0 && (
            <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>Total {fmtCurrency(totalAmount)}</span>
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
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
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
            title="Daily Hours Sales Details"
            totalRecords={totalRecords}
            emptyMessage="No transactions in this hour for the selected store"
            getRowId={(row) => (row as any)?.transactionId ?? (row as any)?.no ?? `row-${(row as any)?.rowNo}`}
          />
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default DailyHourSalesDetailsPage
