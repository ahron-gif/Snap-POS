import { createPortal } from "react-dom"
import { useEffect, useState } from "react"
import { billingService } from "../../services/billingService"

/**
 * One human-readable line in the "Charges today" section. Rendered as
 * "+N <FeatureName>     $X.XX". The amount is computed from the local
 * device-license panel (qty × per-unit price × proration factor) so the
 * user sees the breakdown immediately, before the Stripe round-trip.
 */
export interface LicenseChangeLine {
  description: string
  amount: number
}

interface LicenseChangesConfirmModalProps {
  isOpen: boolean
  /** Local-computed line-items shown in the "Charges today" section. */
  lines: LicenseChangeLine[]
  /** Sum of `lines` — used as the modal's headline number until Stripe's authoritative preview returns. */
  localTotal: number
  /** ISO/string label for next renewal — used in the "From your next renewal" section. */
  nextRenewalLabel?: string
  /** New monthly recurring total (current + add-on impact). Optional — hides the renewal section if absent. */
  newRecurringMonthly?: number | null
  /** Existing monthly recurring total (for "X → Y" display). */
  currentRecurringMonthly?: number | null
  /**
   * Last 4 digits of card on file, if available. Shown as "Charged today to ••4242".
   * If absent, says "to your card on file".
   */
  cardLast4?: string | null
  currency?: string

  /**
   * Stripe-authoritative preview. Optional — if provided, overrides the local
   * total so the user sees the EXACT amount Stripe will charge. We refresh
   * this when the modal opens via billingService.previewAddOn.
   */
  serverTotal?: number | null
  serverPreviewLoading?: boolean

  onCancel: () => void
  onConfirm: () => void
  /** Disables the action button while the parent is creating the Checkout Session. */
  submitting?: boolean
}

/**
 * Confirm step before the Stripe Checkout redirect for license-change add-ons.
 *
 * Mirrors the design from chat:
 *
 *   ┌────────────────────────────────────────────────┐
 *   │  Confirm License Changes                  ×    │
 *   ├────────────────────────────────────────────────┤
 *   │  Charges today (prorated)                      │
 *   │    +1 Picking Device         $7.42             │
 *   │    +1 Price Checker          $7.71             │
 *   │    ──────────────────────                      │
 *   │    Charged today to ••4242  $15.13             │
 *   │                                                │
 *   │  From your next renewal (Jun 6)                │
 *   │    Monthly subscription   $1,059 → $1,082      │
 *   │                                                │
 *   │           [Cancel]  [Continue to Pay $15.13]   │
 *   └────────────────────────────────────────────────┘
 *
 * Action button label is "Continue to Pay $X.XX" because the actual payment
 * happens on Stripe's hosted page, not here. Click → parent calls
 * createAddOnCheckoutSession + redirects window.location.
 */
export default function LicenseChangesConfirmModal({
  isOpen,
  lines,
  localTotal,
  nextRenewalLabel,
  newRecurringMonthly,
  currentRecurringMonthly,
  cardLast4,
  currency = "usd",
  serverTotal,
  serverPreviewLoading,
  onCancel,
  onConfirm,
  submitting = false,
}: LicenseChangesConfirmModalProps) {
  // Authoritative-when-available pattern: prefer the server-computed total, fall
  // back to the locally-computed sum so the user always sees a number even if
  // the preview API is mid-flight or errored out.
  const displayedTotal = serverTotal ?? localTotal

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n)

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center" style={{ zIndex: 99999 }}>
      {/* Backdrop is dismissive — clicking it cancels. The submitting guard prevents
          double-submit if the user clicks while the Checkout session is being created. */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm w-screen h-screen"
        onClick={submitting ? undefined : onCancel}
        style={{ zIndex: 99998 }}
      />

      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl dark:bg-gray-800 mx-4 overflow-hidden"
        style={{ zIndex: 100000 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Confirm License Changes
          </h3>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-40"
            aria-label="Cancel"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Charges today (prorated) */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Charges today (prorated)
            </div>

            {lines.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">No billable changes.</p>
            ) : (
              <div className="space-y-1.5">
                {lines.map((line, i) => (
                  <div key={i} className="flex justify-between items-baseline text-sm">
                    <span className="text-gray-700 dark:text-gray-200">{line.description}</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                      {fmt(line.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-gray-700 flex justify-between items-baseline">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Charged today {cardLast4 ? `to ••${cardLast4}` : "to your card on file"}
              </span>
              <span className="text-base font-bold text-gray-900 dark:text-white tabular-nums">
                {serverPreviewLoading ? (
                  <span className="text-xs text-gray-400 font-normal">computing…</span>
                ) : (
                  fmt(displayedTotal)
                )}
              </span>
            </div>
          </div>

          {/* From your next renewal */}
          {newRecurringMonthly != null && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                From your next renewal{nextRenewalLabel ? ` (${nextRenewalLabel})` : ""}
              </div>
              <div className="flex justify-between items-baseline text-sm">
                <span className="text-gray-700 dark:text-gray-200">Monthly subscription</span>
                <span className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                  {currentRecurringMonthly != null ? (
                    <>
                      <span className="text-gray-400">{fmt(currentRecurringMonthly)} → </span>
                      {fmt(newRecurringMonthly)}
                    </>
                  ) : (
                    fmt(newRecurringMonthly)
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Disclosure — keeps users from being surprised by the redirect */}
          <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            You'll be sent to Stripe's secure payment page to complete the charge.
            License changes apply only after payment is confirmed; if you cancel
            on Stripe, no changes are made.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed dark:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting || lines.length === 0 || displayedTotal <= 0}
            className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Redirecting…" : `Continue to Pay ${fmt(displayedTotal)}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/**
 * Convenience hook that re-fetches the Stripe-authoritative preview every
 * time the modal opens with a different items payload. Returns `null` while
 * loading or on error so the modal falls back to the local total.
 */
export function useAddOnPreview(
  isOpen: boolean,
  items: Array<{ appId: number; quantity: number }>
): { total: number | null; loading: boolean } {
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  // Stringify the items so React's effect deps treat reordered/equal arrays as equal.
  const itemsKey = JSON.stringify(items)

  useEffect(() => {
    if (!isOpen || items.length === 0) {
      setTotal(null)
      return
    }

    let cancelled = false
    setLoading(true)
    billingService
      .previewAddOn({ items })
      .then(res => {
        if (cancelled) return
        if (res.data?.isSuccess && res.data.response) {
          setTotal(res.data.response.amountDueNow)
        } else {
          setTotal(null)
        }
      })
      .catch(() => {
        if (!cancelled) setTotal(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, itemsKey])

  return { total, loading }
}
