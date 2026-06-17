import React, { useState, useEffect, useMemo, useCallback } from "react"
import axios from "axios"
import Flatpickr from "react-flatpickr"
import "flatpickr/dist/themes/light.css"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { usePermission } from "../../hooks/usePermission"
import { useStore } from "../../context/StoreContext"
import { API_ENDPOINTS } from "../../constants/api"
import { Column as GridUtilsColumn } from "../../gridUtils"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import ExportModal from "../../components/common/ExportModal"
import { useReportExportModal } from "../../hooks/useReportExportModal"
import ReconcileBatchModal from "./modals/ReconcileBatchModal"
import InfoModal from "./modals/InfoModal"
import { useDashboardTabs } from "../../context/DashboardTabContext"

interface ShiftReportPageProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    storeId?: string
  }
}

interface RegisterShiftRow {
  regShiftID?: string | null
  shiftNo: string
  registerNo: string
  openDateTime: string | null
  closeDateTime: string | null
  /** Same instant as `openDateTime` — separate fields so grid columns have unique `field` keys (React / footer). */
  openDateDisplay?: string | null
  openTimeDisplay?: string | null
  closeDateDisplay?: string | null
  closeTimeDisplay?: string | null
  status: string
  closeBy: string
  expected: number
  pick: number
  discrepancy: number
}

interface ShiftSummary {
  shiftNo: string
  registerNo: string
  openDateTime: string | null
  closeDateTime: string | null
  status: string
  closeBy: string
  expected: number
  pick: number
  discrepancy: number
}

const SHIFT_REPORT_COLUMNS: Column[] = [
  {
    field: "shiftNo",
    headerName: "Shift No",
    width: 110,
    sortable: true,
    filterable: true,
    visible: true,
    dataType: "string",
  },
  {
    field: "registerNo",
    headerName: "Register No",
    width: 110,
    sortable: true,
    filterable: true,
    visible: true,
    dataType: "string",
  },
  {
    field: "openDateDisplay",
    headerName: "Open Date",
    width: 130,
    sortable: true,
    filterable: true,
    visible: true,
    dataType: "date",
    cellRenderer: (value: string | null) => (value ? new Date(value).toLocaleDateString() : "-"),
  },
  {
    field: "openTimeDisplay",
    headerName: "Open Time",
    width: 110,
    sortable: false,
    filterable: false,
    visible: true,
    dataType: "string",
    cellRenderer: (value: string | null) =>
      value ? new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "-",
  },
  {
    field: "status",
    headerName: "Status",
    width: 90,
    sortable: true,
    filterable: true,
    visible: true,
    dataType: "string",
  },
  {
    field: "closeDateDisplay",
    headerName: "Close Date",
    width: 130,
    sortable: true,
    filterable: true,
    visible: true,
    dataType: "date",
    cellRenderer: (value: string | null) => (value ? new Date(value).toLocaleDateString() : "-"),
  },
  {
    field: "closeTimeDisplay",
    headerName: "Close Time",
    width: 110,
    sortable: false,
    filterable: false,
    visible: true,
    dataType: "string",
    cellRenderer: (value: string | null) =>
      value ? new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "-",
  },
  {
    field: "closeBy",
    headerName: "Close By",
    width: 140,
    sortable: true,
    filterable: true,
    visible: true,
    dataType: "string",
  },
  {
    field: "expected",
    headerName: "Expected",
    width: 120,
    sortable: true,
    filterable: false,
    visible: true,
    dataType: "number",
    cellRenderer: (value: number) =>
      value == null ? "$0.00" : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
  {
    field: "pick",
    headerName: "Pick",
    width: 120,
    sortable: true,
    filterable: false,
    visible: true,
    dataType: "number",
    cellRenderer: (value: number) =>
      value == null ? "$0.00" : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
  {
    field: "discrepancy",
    headerName: "Discrepancy",
    width: 130,
    sortable: true,
    filterable: false,
    visible: true,
    dataType: "number",
    cellRenderer: (value: number) =>
      value == null ? "$0.00" : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
] as const

const SHIFT_REPORT_SCREEN_CODE = "reports.shift_report"

const ShiftReportPage: React.FC<ShiftReportPageProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { canExport } = usePermission(SHIFT_REPORT_SCREEN_CODE)

  // Default date range: either values from Report Manager filters, or last 30 days
  const defaultDateTo = filters?.dateTo || new Date().toISOString().split("T")[0]
  const defaultDateFrom =
    filters?.dateFrom ||
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]

  const [dateFrom, setDateFrom] = useState<string>(defaultDateFrom)
  const [dateTo, setDateTo] = useState<string>(defaultDateTo)
  const [appliedDateFrom, setAppliedDateFrom] = useState<string>(defaultDateFrom)
  const [appliedDateTo, setAppliedDateTo] = useState<string>(defaultDateTo)
  const [rows, setRows] = useState<RegisterShiftRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalRecords, setTotalRecords] = useState(0)

  // Store: Register Shifts is always scoped to the currently-selected store, matching
  // the desktop's FillRegShiftRep(Dates, GlobalDataAccess.StoreID). No store dropdown
  // shown here — the user's active store is used implicitly.
  const effectiveStoreId =
    currentStore?.storeId && currentStore.storeId.trim().length > 0
      ? currentStore.storeId.trim()
      : undefined
  const appliedStoreName = currentStore?.storeName || ""

  const summaries: ShiftSummary[] = useMemo(() => {
    if (!rows.length) return []

    return rows.map((row) => ({
      shiftNo: row.shiftNo,
      registerNo: row.registerNo,
      openDateTime: row.openDateTime,
      closeDateTime: row.closeDateTime,
      status: row.status,
      closeBy: row.closeBy,
      expected: row.expected,
      pick: row.pick,
      discrepancy: row.discrepancy,
    }))
  }, [rows])

  const grandTotals = useMemo(
    () =>
      summaries.reduce(
        (acc, s) => {
          acc.expected += s.expected
          acc.pick += s.pick
          acc.discrepancy += s.discrepancy
          return acc
        },
        { expected: 0, pick: 0, discrepancy: 0 }
      ),
    [summaries]
  )

  const flatpickrCommonOptions = useMemo(
    () => ({
      dateFormat: "Y-m-d",
      allowInput: true,
      static: false,
    }),
    []
  )

  const fetchData = useCallback(async () => {
    if (!dateFrom || !dateTo) return

    setLoading(true)
    setError(null)

    try {
      const headers = getAuthHeaders()
      const body: Record<string, any> = {
        fromDate: dateFrom,
        toDate: dateTo,
      }

      if (effectiveStoreId) {
        body.storeId = effectiveStoreId
      }

      const response = await axios.post(API_ENDPOINTS.REPORTS.REGISTER_SHIFTS, body, { headers })

      if (response.data?.isSuccess) {
        const res = response.data.response ?? response.data.Response
        const raw = (res?.data ?? res?.Data ?? []) as RegisterShiftRow[]
        const data = raw.map((r) => ({
          ...r,
          openDateDisplay: r.openDateTime,
          openTimeDisplay: r.openDateTime,
          closeDateDisplay: r.closeDateTime,
          closeTimeDisplay: r.closeDateTime,
        }))

        setRows(data)
        setTotalRecords(data.length)
        setAppliedDateFrom(dateFrom)
        setAppliedDateTo(dateTo)
      } else {
        const message = response.data?.message || "Failed to load shift report data"
        setError(message)
      }
    } catch (e: any) {
      console.error("Error loading shift report", e)
      setError(e?.message || "Failed to load shift report data")
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, effectiveStoreId, getAuthHeaders])

  const handleSearch = useCallback(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // ------------------------------------------------------------------------------------------
  // Row context menu — mirrors the desktop RegShifts.vb PopupMenu1 (btnReconcile + btTotalTender).
  // - Reconcile Batch: only enabled when Status <> "OPEN" (desktop blocks reconcile on open shifts
  //   with a message: "This Batch has to closed in order reconcile.").
  // - Total Tenders:   shows the per-shift tender breakdown (desktop opens RepTendersShift).
  // The actual Reconcile and Total Tenders screens aren't ported yet — handlers below currently
  // surface an informational alert so the menu is wired and visible. Replace with router pushes
  // (or modal opens) once those pages exist.
  // ------------------------------------------------------------------------------------------
  const [reconcileTarget, setReconcileTarget] = useState<{ regShiftId: string; shiftNo: string } | null>(null)
  const [infoMsg, setInfoMsg] = useState<{ title?: string; message: string; variant?: "info" | "warning" | "error" } | null>(null)
  const { openTab } = useDashboardTabs()

  const shiftContextMenuItems = useMemo(
    () => [
      {
        label: "Reconcile Batch",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M3 12h18" />
            <path d="M3 18h18" />
            <path d="M9 3v18" />
          </svg>
        ),
        onClick: (row: any) => {
          if (row?.status === "OPEN") {
            // Desktop parity: RegShifts.btnReconcile_ItemClick blocks open batches with this exact message.
            setInfoMsg({
              title: "Cannot reconcile yet",
              message: "This Batch has to closed in order reconcile.",
              variant: "warning",
            })
            return
          }
          if (!row?.regShiftID) {
            setInfoMsg({
              title: "Missing shift ID",
              message: "This shift is missing its RegShiftID and cannot be reconciled.",
              variant: "error",
            })
            return
          }
          setReconcileTarget({ regShiftId: row.regShiftID, shiftNo: row.shiftNo ?? "" })
        },
      },
      {
        label: "Total Tenders",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="3" />
            <path d="M6 12h.01M18 12h.01" />
          </svg>
        ),
        onClick: (row: any) => {
          if (!row?.regShiftID) {
            setInfoMsg({
              title: "Missing shift ID",
              message: "This shift is missing its RegShiftID.",
              variant: "error",
            })
            return
          }
          // Desktop parity: opens RepTendersShift as a new MDI child. Web equivalent is a tab.
          const shiftNo = row.shiftNo ?? ""
          openTab({
            id: `tender-details-${row.regShiftID}`,
            title: shiftNo ? `Tender Details [${shiftNo}]` : "Tender Details",
            component: "TotalTendersForShiftPage",
            props: { regShiftId: row.regShiftID, shiftNo },
            closable: true,
          })
        },
      },
    ],
    [openTab]
  )

  // Fetch all rows for the export modal, scoped to an optional override date
  // range (falls back to the page's currently-applied range).
  const fetchAllData = useCallback(
    async (overrideFrom?: string, overrideTo?: string): Promise<any[]> => {
      try {
        const headers = getAuthHeaders()
        const body: Record<string, any> = {
          fromDate: overrideFrom || appliedDateFrom,
          toDate: overrideTo || appliedDateTo,
        }
        if (effectiveStoreId) body.storeId = effectiveStoreId
        const response = await axios.post(API_ENDPOINTS.REPORTS.REGISTER_SHIFTS, body, { headers })
        if (response.data?.isSuccess) {
          const res = response.data.response ?? response.data.Response
          const raw = (res?.data ?? res?.Data ?? []) as RegisterShiftRow[]
          return raw.map((r) => ({
            ...r,
            openDateDisplay: r.openDateTime,
            openTimeDisplay: r.openDateTime,
            closeDateDisplay: r.closeDateTime,
            closeTimeDisplay: r.closeDateTime,
          }))
        }
        return []
      } catch (error) {
        console.error("Failed to fetch shift report data for export:", error)
        return []
      }
    },
    [getAuthHeaders, appliedDateFrom, appliedDateTo, effectiveStoreId]
  )

  const exportModal = useReportExportModal({
    columns: SHIFT_REPORT_COLUMNS as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "shift-report",
    title: "Register Shift Report",
    subtitle: `${appliedStoreName} | ${new Date(appliedDateFrom).toLocaleDateString()} - ${new Date(appliedDateTo).toLocaleDateString()}`,
    dateField: "openDateTime",
    defaultDateFrom: appliedDateFrom,
    defaultDateTo: appliedDateTo,
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        {/* Title and summary */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Shift Report</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{appliedStoreName || "All Stores"}</span>
            {appliedDateFrom && appliedDateTo && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>
                  {new Date(appliedDateFrom).toLocaleDateString()} – {new Date(appliedDateTo).toLocaleDateString()}
                </span>
              </>
            )}
            {totalRecords > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{totalRecords.toLocaleString()} shifts</span>
              </>
            )}
          </div>
        </div>

        {/* Filters card and buttons styled like Tax By Store */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Date Range
                </label>
                <div className="flex items-center gap-2">
                  <div className="flatpickr-wrapper w-[142px] relative">
                    <Flatpickr
                      value={dateFrom}
                      onChange={([d]) => setDateFrom(d ? d.toISOString().split("T")[0] : dateFrom)}
                      options={flatpickrCommonOptions}
                      placeholder="From"
                      className="w-full h-10 pl-9 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </span>
                  </div>
                  <span className="text-gray-400 dark:text-gray-500 font-medium">to</span>
                  <div className="flatpickr-wrapper w-[142px] relative">
                    <Flatpickr
                      value={dateTo}
                      onChange={([d]) => setDateTo(d ? d.toISOString().split("T")[0] : dateTo)}
                      options={flatpickrCommonOptions}
                      placeholder="To"
                      className="w-full h-10 pl-9 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Button group: Search, Export */}
            <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm ml-auto overflow-visible">
              <button
                onClick={handleSearch}
                className="h-10 px-5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors flex items-center gap-2 border-0 border-r border-gray-200 dark:border-gray-600"
                type="button"
                disabled={loading}
              >
                {loading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                )}
                Search
              </button>

              {canExport && (
                <div className="relative">
                  <button
                    onClick={exportModal.open}
                    type="button"
                    className="h-10 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 border-0 disabled:opacity-50 rounded-none"
                    title="Preview, filter and export"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 5.414V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Export
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <ServerGrid
            hideDefaultContextMenuItems={true}
            customContextMenuItems={shiftContextMenuItems}
            data={rows}
            columns={SHIFT_REPORT_COLUMNS}
            loading={loading}
            error={error}
            pagination={true}
            pageSize={100}
            columnChooser={true}
            title="Register Shifts"
            totalRecords={totalRecords}
            emptyMessage="No data for the selected criteria"
          />
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />

      {reconcileTarget && (
        <ReconcileBatchModal
          open={!!reconcileTarget}
          regShiftId={reconcileTarget.regShiftId}
          shiftNo={reconcileTarget.shiftNo}
          onClose={() => setReconcileTarget(null)}
          onSaved={() => {
            setReconcileTarget(null)
            // Refresh the shift list so the status flips to RECONCILE in the grid.
            fetchData()
          }}
        />
      )}

      {infoMsg && (
        <InfoModal
          open={!!infoMsg}
          title={infoMsg.title}
          message={infoMsg.message}
          variant={infoMsg.variant}
          onClose={() => setInfoMsg(null)}
        />
      )}
    </div>
  )
}

export default ShiftReportPage

