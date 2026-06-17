import React, { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import { useAuthHeaders } from "../../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../../constants/api"

/**
 * Reconcile Batch modal — web port of desktop BatchReconciles.vb.
 * Inputs: RegShiftID + display name (Shift NO).
 * Init: POST /api/Reports/RegShift/ReconcileInit  (calls SP_AddBatchToRec, returns tender rows)
 * Save: POST /api/Reports/RegShift/ReconcileSave  (updates BatchRec rows + sets Status = 3)
 *
 * Differences from desktop:
 *  - Calculator/tape (denomination counter) feature is NOT ported yet. Cash PickUpAmount is
 *    edited as a single number. The calculator can be added incrementally later.
 *  - "Use checkpoint" (decimal insertion) registry preference is not ported.
 */

export interface ReconcileBatchRow {
  batchRecId: number
  tenderId: number
  tenderName: string
  expectedAmount: number | null
  expectedCount: number | null
  pickUpAmount: number | null
  pickUpCount: number | null
  overShort: number | null
  note: string | null
}

interface InitResponse {
  regShiftID: string
  shiftNo: string
  status: string
  openingAmount: number | null
  rows: ReconcileBatchRow[]
}

interface Props {
  open: boolean
  regShiftId: string
  shiftNo: string
  onClose: () => void
  onSaved?: () => void
}

const fmtCurrency = (n: number | null | undefined) =>
  n == null ? "$0.00" : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const ReconcileBatchModal: React.FC<Props> = ({ open, regShiftId, shiftNo, onClose, onSaved }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const [rows, setRows] = useState<ReconcileBatchRow[]>([])
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInit = useCallback(async () => {
    if (!regShiftId) return
    setLoading(true)
    setError(null)
    try {
      const res = await axios.post(
        API_ENDPOINTS.REPORTS.REGSHIFT_RECONCILE_INIT,
        { regShiftID: regShiftId },
        { headers: getAuthHeaders() }
      )
      if (res.data?.isSuccess) {
        const r = res.data.response as InitResponse
        setRows(r.rows ?? [])
        setStatus(r.status ?? "")
      } else {
        setError(res.data?.message || "Failed to initialize reconcile.")
      }
    } catch (e: any) {
      setError(e?.message || "Failed to initialize reconcile.")
    } finally {
      setLoading(false)
    }
  }, [regShiftId, getAuthHeaders])

  useEffect(() => {
    if (open) fetchInit()
  }, [open, fetchInit])

  const setRowField = (batchRecId: number, patch: Partial<ReconcileBatchRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.batchRecId !== batchRecId) return r
        const merged = { ...r, ...patch }
        const expected = merged.expectedAmount ?? 0
        const pick = merged.pickUpAmount ?? 0
        merged.overShort = expected - pick
        return merged
      })
    )
  }

  const totals = useMemo(() => {
    const expected = rows.reduce((s, r) => s + (r.expectedAmount ?? 0), 0)
    const pick     = rows.reduce((s, r) => s + (r.pickUpAmount ?? 0), 0)
    return { expected, pick, overShort: expected - pick }
  }, [rows])

  const handleSave = useCallback(async () => {
    if (!regShiftId) return
    setSaving(true)
    setError(null)
    try {
      const res = await axios.post(
        API_ENDPOINTS.REPORTS.REGSHIFT_RECONCILE_SAVE,
        {
          regShiftID: regShiftId,
          rows: rows.map((r) => ({
            batchRecId: r.batchRecId,
            pickUpAmount: r.pickUpAmount,
            pickUpCount: r.pickUpCount,
            note: r.note,
          })),
        },
        { headers: getAuthHeaders() }
      )
      if (res.data?.isSuccess) {
        onSaved?.()
        onClose()
      } else {
        setError(res.data?.message || "Failed to save reconcile.")
      }
    } catch (e: any) {
      setError(e?.message || "Failed to save reconcile.")
    } finally {
      setSaving(false)
    }
  }, [regShiftId, rows, getAuthHeaders, onSaved, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[95%] max-w-5xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Reconcile Batch {shiftNo ? `[${shiftNo}]` : ""}
            </h2>
            {status && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Current status: <span className="font-medium">{status}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {error && (
            <div className="mb-3 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500">No tender rows for this shift.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Tender</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Expected Amount</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Expected Count</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Pick-up Amount</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Pick-up Count</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Over / Short</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((r) => (
                    <tr key={r.batchRecId}>
                      <td className="px-3 py-2 text-gray-800 dark:text-gray-100">{r.tenderName}</td>
                      <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{fmtCurrency(r.expectedAmount)}</td>
                      <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">{r.expectedCount ?? 0}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          className="w-28 text-right border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          value={r.pickUpAmount ?? ""}
                          onChange={(e) => setRowField(r.batchRecId, { pickUpAmount: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="1"
                          className="w-20 text-right border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          value={r.pickUpCount ?? ""}
                          onChange={(e) => setRowField(r.batchRecId, { pickUpCount: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${(r.overShort ?? 0) === 0 ? "text-gray-700 dark:text-gray-200" : (r.overShort ?? 0) > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {fmtCurrency(r.overShort)}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          value={r.note ?? ""}
                          onChange={(e) => setRowField(r.batchRecId, { note: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-800 font-medium">
                  <tr>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">Totals:</td>
                    <td className="px-3 py-2 text-right">{fmtCurrency(totals.expected)}</td>
                    <td />
                    <td className="px-3 py-2 text-right">{fmtCurrency(totals.pick)}</td>
                    <td />
                    <td className={`px-3 py-2 text-right ${totals.overShort === 0 ? "text-gray-700 dark:text-gray-200" : totals.overShort > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {fmtCurrency(totals.overShort)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || rows.length === 0}
            className="h-9 px-4 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReconcileBatchModal
