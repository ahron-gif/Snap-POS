import React, { useState } from 'react';
import { customerCreditService } from '../../services/customerCreditService';

interface Props {
  onClose: () => void;
}

const PRESETS = [25, 50, 100, 500];
const MIN = 5;
const MAX = 5000;

/**
 * "Add Credit" modal. User picks a preset or enters a custom amount, hits
 * Continue → we open a Stripe Checkout session and redirect the browser to
 * the hosted page. The webhook handler (StripeCheckoutService) credits the
 * wallet on payment success; LicensesAndBillingPage polls /MyBalance on
 * return to show the new balance.
 */
const AddCreditModal: React.FC<Props> = ({ onClose }) => {
  const [amount, setAmount] = useState<number>(50);
  const [customStr, setCustomStr] = useState<string>('');
  const [usingCustom, setUsingCustom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveAmount = usingCustom ? Number(customStr) : amount;
  const isValid =
    Number.isFinite(effectiveAmount) &&
    effectiveAmount >= MIN &&
    effectiveAmount <= MAX;

  const handleContinue = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const resp = await customerCreditService.createTopUpCheckoutSession({ amount: effectiveAmount });
      if (resp.data?.isSuccess && resp.data.response?.url) {
        // Stripe-hosted checkout takes over. On success Stripe redirects back
        // to /licenses-billing?topup=success&session_id=… (configured in
        // StripeCheckoutService.CreateCreditTopUpSessionAsync).
        window.location.assign(resp.data.response.url);
        return;
      }
      setError(resp.data?.message ?? 'Failed to start checkout.');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to start checkout.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Add API Credit</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close"
            disabled={submitting}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Pick an amount to add to your OpenAPI credit balance. Payment is processed by Stripe;
            funds become available immediately after Stripe confirms the charge.
          </p>

          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => { setAmount(p); setUsingCustom(false); }}
                className={`px-2 py-2 rounded-lg border text-sm font-semibold transition ${
                  !usingCustom && amount === p
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                disabled={submitting}
              >
                ${p}
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Or enter a custom amount (USD, min ${MIN} – max ${MAX})
            </label>
            <input
              type="number"
              value={customStr}
              onChange={e => { setCustomStr(e.target.value); setUsingCustom(true); }}
              min={MIN}
              max={MAX}
              step="0.01"
              className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              placeholder="Custom amount"
              disabled={submitting}
            />
          </div>

          {!isValid && (
            <div className="text-xs text-red-600">
              Amount must be between ${MIN} and ${MAX}.
            </div>
          )}
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            disabled={!isValid || submitting}
            className="px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium"
          >
            {submitting ? 'Starting…' : `Continue to Pay $${isValid ? effectiveAmount.toFixed(2) : '—'}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCreditModal;
