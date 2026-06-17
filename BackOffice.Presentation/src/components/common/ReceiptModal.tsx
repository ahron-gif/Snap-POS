import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import axios from "axios"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"

/**
 * ReceiptModal
 * =============
 *
 * Drop-in "Open Receipt" modal used by every detail report that surfaces a Transaction No.
 * Mirrors the desktop's `FrmReciept` dialog:
 *   • Monospaced receipt body (line-oriented, exactly as `SP_GetReciept` returns it).
 *   • In-modal search input — typing highlights every matching occurrence in the receipt
 *     (case-insensitive, all matches highlighted simultaneously). Same UX as
 *     `FrmReciept.FindTextInBox`.
 *   • Print button — opens the OS print dialog scoped to the receipt only.
 *   • Close button — dismisses the modal.
 *
 * Open it by setting `transactionId` to a non-null value; clear it (via `onClose`) to dismiss.
 * The receipt text is fetched lazily the first time the modal is shown for a given txId.
 */

export interface ReceiptModalProps {
  /** Transaction ID to load; modal is hidden when null/undefined. */
  transactionId?: string | null
  /** Optional transaction number shown in the modal header for context. */
  transactionNo?: string
  /** Fired when the user closes the modal (Close button, backdrop, or Escape). */
  onClose: () => void
}

/** Escape a string for safe use inside `new RegExp(...)`. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Strip printer control tokens embedded in the raw receipt text — markers like `{27}`,
 * `{97}`, `{27a}`, `{0}`, etc. These are ESC/POS-ish formatting codes the POS prints to a
 * thermal printer (font size, bold, alignment, etc.) but they're meaningless / noisy when
 * the receipt is displayed or printed in a web context.
 *
 * Mirrors the desktop's FrmReciept regex: `([{](\d|\d\w+)[}])` → "".
 */
function stripPrinterCodes(raw: string): string {
  return raw.replace(/\{(\d|\d\w+)\}/g, "")
}

/**
 * Split the receipt body into runs of matching / non-matching text so we can wrap matches
 * in a highlight span. Returns flat segments — render alternating in JSX.
 */
function highlightedSegments(text: string, query: string): Array<{ text: string; match: boolean }> {
  if (!query) return [{ text, match: false }]
  const re = new RegExp(escapeRegex(query), "gi")
  const out: Array<{ text: string; match: boolean }> = []
  let lastIdx = 0
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0
    if (idx > lastIdx) out.push({ text: text.slice(lastIdx, idx), match: false })
    out.push({ text: m[0], match: true })
    lastIdx = idx + m[0].length
  }
  if (lastIdx < text.length) out.push({ text: text.slice(lastIdx), match: false })
  return out
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ transactionId, transactionNo, onClose }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const [text, setText] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const receiptRef = useRef<HTMLDivElement>(null)

  // Reset state when txId changes / modal closes
  useEffect(() => {
    if (!transactionId) {
      setText(""); setSearch(""); setError(null); setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true); setError(null); setText(""); setSearch("")
    ;(async () => {
      try {
        const headers = getAuthHeaders()
        const response = await axios.post(
          API_ENDPOINTS.REPORTS.TRANSACTION_RECEIPT,
          { transactionId },
          { headers }
        )
        if (cancelled) return
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess
        if (!ok) {
          setError(response.data?.message || response.data?.Message || "Failed to load receipt")
          return
        }
        const payload = response.data?.response ?? response.data?.Response ?? {}
        const raw = String(payload.receiptText ?? payload.ReceiptText ?? "").replace(/\r\n/g, "\n")
        // Strip printer control codes ({27}, {97a}, ...) before they ever hit the UI or printer.
        setText(stripPrinterCodes(raw))
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.message ?? e?.message ?? "Failed to load receipt")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [transactionId, getAuthHeaders])

  // Escape closes the modal — standard expected behavior
  useEffect(() => {
    if (!transactionId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [transactionId, onClose])

  /** Print just the receipt content (not the surrounding dashboard). */
  const handlePrint = useCallback(() => {
    if (!text) return
    const w = window.open("", "_blank", "noopener,noreferrer,width=480,height=720")
    if (!w) { alert("Please allow popups to print the receipt."); return }
    // Plain monospace body — exactly the same shape as the desktop receipt printer
    // (Lucida Console at 8pt). Wrap in <pre> to preserve whitespace.
    const escaped = text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt${transactionNo ? " — " + transactionNo : ""}</title>
<style>
  body { margin: 0; padding: 16px; font-family: "Lucida Console", "Courier New", monospace; font-size: 11px; line-height: 1.35; color: #000; }
  pre  { white-space: pre-wrap; word-break: break-word; }
  @media print { body { padding: 0; } @page { margin: 1cm; } }
</style></head><body><pre>${escaped}</pre></body></html>`)
    w.document.close()
    w.onload = () => { try { w.focus(); w.print() } catch { /* ignore */ } }
  }, [text, transactionNo])

  const segments = useMemo(() => highlightedSegments(text, search.trim()), [text, search])
  const matchCount = useMemo(() => segments.reduce((n, s) => n + (s.match ? 1 : 0), 0), [segments])

  if (!transactionId) return null

  return (
    // Backdrop — semi-transparent, click dismisses (mirrors typical modal UX).
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      {/* Modal panel — stop propagation so clicks inside don't dismiss */}
      <div
        className="relative w-[520px] max-h-[85vh] flex flex-col bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
            </svg>
            <h2 id="receipt-modal-title" className="text-base font-semibold text-gray-900 dark:text-white">
              Receipt{transactionNo ? ` — ${transactionNo}` : ""}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search receipt…"
              className="w-full h-9 pl-9 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              autoFocus
            />
          </div>
          {search.trim() && (
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {matchCount} {matchCount === 1 ? "match" : "matches"}
            </span>
          )}
        </div>

        {/* Receipt body */}
        <div ref={receiptRef} className="flex-1 overflow-auto px-5 py-4 bg-gray-50 dark:bg-gray-900">
          {loading && <div className="text-sm text-gray-500">Loading receipt…</div>}
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {!loading && !error && (
            <pre className="font-mono text-[12px] leading-snug text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
              {/*
                Rendering as alternating spans rather than a single <pre> with innerHTML
                avoids dangerouslySetInnerHTML; React still preserves whitespace inside <pre>.
              */}
              {segments.map((seg, i) =>
                seg.match
                  ? <mark key={i} className="bg-yellow-300 dark:bg-yellow-500/60 text-black rounded px-0.5">{seg.text}</mark>
                  : <span key={i}>{seg.text}</span>
              )}
              {text === "" && !loading && !error && (
                <span className="text-gray-400">No receipt found for this transaction.</span>
              )}
            </pre>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!text || loading}
            className="h-9 px-4 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-lg disabled:opacity-60 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReceiptModal
