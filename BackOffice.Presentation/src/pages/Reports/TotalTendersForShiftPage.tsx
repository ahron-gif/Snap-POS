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
 * Tender Details — web port of desktop RepTendersShift (Q.GetTendersShift).
 * Opens as a tab from the Shift Report's row context menu ("Total Tenders").
 *
 * Mirrors the desktop grid columns exactly:
 *   Tender | Transaction No | Date | Amount | Time | No
 * where Date and Time are split from the same StartSaleTime instant, and No is a
 * 1-based row index (matches the desktop's printed grid).
 */

interface TenderDetailsRow {
  tenderID: number
  tenderName: string
  transactionID: string | null
  transactionNo: string
  date: string | null
  amount: number
  creditType: string | null
}

interface ApiResponseShape {
  regShiftID: string
  shiftNo: string
  rows: TenderDetailsRow[]
  grandTotalAmount: number
  grandTotalCount: number
}

interface TotalTendersForShiftPageProps {
  /** Props are injected by DashboardWithTabs from the openTab() call. */
  regShiftId?: string
  shiftNo?: string
  /** Touched by openTab when the same tab is re-opened — used to trigger a refetch. */
  _refreshKey?: number
}

interface GridRow extends TenderDetailsRow {
  no: number
  /** Pure-time string for the Time column ("hh:mm AM/PM"). */
  timeDisplay: string
  /** Pure-date string for the Date column ("M/D/YYYY"). */
  dateDisplay: string
}

const fmtCurrency = (n: number | null | undefined) =>
  n == null ? "$0.00" : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const TENDER_DETAILS_COLUMNS: Column[] = [
  { field: "tenderName",   headerName: "Tender",         width: 160, sortable: true, filterable: true,  visible: true, dataType: "string" },
  { field: "transactionNo",headerName: "Transaction No", width: 150, sortable: true, filterable: true,  visible: true, dataType: "string" },
  {
    field: "dateDisplay",
    headerName: "Date",
    width: 120,
    sortable: true,
    filterable: false,
    visible: true,
    dataType: "string",
  },
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
  {
    field: "timeDisplay",
    headerName: "Time",
    width: 120,
    sortable: true,
    filterable: false,
    visible: true,
    dataType: "string",
  },
  { field: "no",          headerName: "No",             width:  80, sortable: true, filterable: false, visible: true, dataType: "number" },
]

const TotalTendersForShiftPage: React.FC<TotalTendersForShiftPageProps> = ({ regShiftId, shiftNo, _refreshKey }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const [rows, setRows] = useState<GridRow[]>([])
  const [grandAmount, setGrandAmount] = useState(0)
  const [grandCount, setGrandCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!regShiftId) return
    setLoading(true)
    setError(null)
    try {
      const res = await axios.post(
        API_ENDPOINTS.REPORTS.REGSHIFT_TOTAL_TENDERS,
        { regShiftID: regShiftId },
        { headers: getAuthHeaders() }
      )
      if (res.data?.isSuccess) {
        const r = res.data.response as ApiResponseShape
        const decorated: GridRow[] = (r.rows ?? []).map((row, idx) => {
          const dt = row.date ? new Date(row.date) : null
          return {
            ...row,
            no: idx + 1,
            dateDisplay: dt ? dt.toLocaleDateString() : "",
            timeDisplay: dt ? dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "",
          }
        })
        setRows(decorated)
        setGrandAmount(r.grandTotalAmount ?? 0)
        setGrandCount(r.grandTotalCount ?? 0)
      } else {
        setError(res.data?.message || "Failed to load tender details.")
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load tender details.")
    } finally {
      setLoading(false)
    }
  }, [regShiftId, getAuthHeaders])

  useEffect(() => {
    fetchData()
  }, [fetchData, _refreshKey])

  const subtitle = useMemo(() => {
    const parts: string[] = []
    if (shiftNo) parts.push(`Shift ${shiftNo}`)
    if (grandCount > 0) parts.push(`${grandCount.toLocaleString()} tender ${grandCount === 1 ? "entry" : "entries"}`)
    if (grandAmount !== 0) parts.push(`Total ${fmtCurrency(grandAmount)}`)
    return parts.join(" | ")
  }, [shiftNo, grandCount, grandAmount])

  const fetchAllData = useCallback(async (): Promise<any[]> => rows, [rows])

  const exportModal = useExportModal({
    columns: TENDER_DETAILS_COLUMNS as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "total-tenders-for-shift",
    pdfOptions: {
      title: "Tender Details",
      subtitle: subtitle || undefined,
      orientation: "landscape",
    },
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tender Details</h1>
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

        {!regShiftId ? (
          <p className="text-sm text-gray-500">No shift selected.</p>
        ) : (
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex-1 min-h-0 flex">
            <div className="flex-1 min-h-0">
              <ServerGrid
                hideDefaultContextMenuItems={true}
                data={rows}
                columns={TENDER_DETAILS_COLUMNS}
                loading={loading}
                error={error}
                pagination={true}
                pageSize={100}
                columnChooser={true}
                title="Tender Details"
                totalRecords={rows.length}
                emptyMessage={loading ? "Loading…" : "No tender activity for this shift"}
                getRowId={(r) => `${(r as GridRow)?.transactionID ?? ""}-${(r as GridRow)?.no ?? 0}`}
              />
            </div>
          </div>
        )}
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default TotalTendersForShiftPage
