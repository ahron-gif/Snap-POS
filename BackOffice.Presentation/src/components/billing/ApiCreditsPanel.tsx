import React, { useCallback, useEffect, useState } from 'react';
import { customerCreditService } from '../../services/customerCreditService';
import { usePermissions } from '../../context/PermissionContext';
import type {
  CreditBalance,
  CreditTransaction,
  PagedCreditTransactions,
} from '../../types/billing';
import { CreditTransactionType, CreditTransactionTypeLabel } from '../../types/billing';
import AddCreditModal from './AddCreditModal';

// Reuse the page-level Licenses & Billing permissions so anyone who can see
// this page also sees the credit panel, and anyone who can change the plan can
// also top up credit. The finer-grained admin.api_credits.* permissions are
// still seeded in the DB for future use but aren't enforced in the UI.
const PERM_VIEW = 'admin.licenses_billing.view';
const PERM_TOPUP = 'admin.licenses_billing.edit';

const LOW_BALANCE_THRESHOLD = 5;
const PAGE_SIZE = 25;

const fmtMoney = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtSignedMoney = (n: number) => {
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  return `${sign}$${fmtMoney(Math.abs(n))}`;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleString();

const txnAmountClass = (type: number) => {
  if (type === CreditTransactionType.TopUp || type === CreditTransactionType.Refund) {
    return 'text-green-600 dark:text-green-400';
  }
  if (type === CreditTransactionType.ApiDeduction) {
    return 'text-red-600 dark:text-red-400';
  }
  return 'text-gray-700 dark:text-gray-300';
};

interface Props {
  /**
   * When set, the page just returned from Stripe Checkout. The panel polls
   * /MyBalance until the balance updates (webhook has landed) and then clears
   * the marker via onTopUpAcknowledged.
   */
  pendingTopUpSessionId?: string | null;
  onTopUpAcknowledged?: () => void;
}

/**
 * Wallet panel rendered on the License & Billing page. Shows the OpenAPI
 * credit balance, the per-API one-time free-tier consumption, the "Add Credit"
 * Stripe button, and a paged ledger.
 */
const ApiCreditsPanel: React.FC<Props> = ({ pendingTopUpSessionId, onTopUpAcknowledged }) => {
  const { hasPermission } = usePermissions();
  const canView = hasPermission(PERM_VIEW);
  const canTopUp = hasPermission(PERM_TOPUP);

  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [topUpPolling, setTopUpPolling] = useState(false);

  const loadBalance = useCallback(async () => {
    try {
      const resp = await customerCreditService.getMyBalance();
      if (resp.data?.isSuccess && resp.data.response) {
        setBalance(resp.data.response);
        return resp.data.response;
      }
      setError(resp.data?.message ?? 'Failed to load credit balance.');
      return null;
    } catch (e: any) {
      // Surface the HTTP status + a usable message. Response body can be:
      //  - a structured ApiResponse { message: "..." } from ApiResponseFactory
      //  - a plain string from `return BadRequest("some text")`
      //  - undefined (network failure)
      const status = e?.response?.status;
      const data = e?.response?.data;
      const body =
        (typeof data === 'string' && data.trim().length > 0 ? data : null)
        ?? data?.message
        ?? e?.message
        ?? 'unknown error';
      setError(status ? `HTTP ${status}: ${body}` : body);
      return null;
    }
  }, []);

  const loadTransactions = useCallback(async (page: number) => {
    try {
      const resp = await customerCreditService.getMyTransactions(page, PAGE_SIZE);
      if (resp.data?.isSuccess && resp.data.response) {
        const paged: PagedCreditTransactions = resp.data.response;
        setTransactions(paged.items);
        setTxTotal(paged.total);
        setTxPage(paged.page);
      }
    } catch {
      // Non-fatal — balance load already sets the error banner.
    }
  }, []);

  // Recovery state — surfaces "recovered N payments" feedback after the
  // silent on-load scan and the explicit "Recover pending payments" button.
  const [recovering, setRecovering] = useState(false);
  const [recoveryToast, setRecoveryToast] = useState<string | null>(null);
  const [recoveryDiag, setRecoveryDiag] = useState<import('../../types/billing').CreditTopUpRecoveryResult | null>(null);

  const runRecovery = useCallback(async (silent: boolean): Promise<number> => {
    try {
      const resp = await customerCreditService.recoverPendingTopUps();
      const diag = resp.data?.response ?? null;
      if (resp.data?.isSuccess && diag) {
        const applied = diag.applied ?? 0;
        // Show the diagnostic block when:
        //   • manual click (user expects feedback either way), OR
        //   • silent scan found Stripe sessions but couldn't apply any
        //     (so the tenant immediately sees WHY their wallet is empty).
        // A silent scan with zero Stripe sessions stays quiet — common for
        // brand-new tenants and not worth a UI panel.
        const isInteresting = applied === 0 && diag.scanned > 0;
        if (!silent || isInteresting) setRecoveryDiag(diag);
        if (!silent || applied > 0) {
          setRecoveryToast(diag.note ?? (
            applied > 0
              ? `Recovered ${applied} pending payment${applied === 1 ? '' : 's'}.`
              : 'No pending payments to recover.'
          ));
        }
        return applied;
      }
      if (!silent) {
        setRecoveryDiag(null);
        setRecoveryToast(resp.data?.message ?? 'Recovery failed.');
      }
      return 0;
    } catch (e: any) {
      if (!silent) {
        setRecoveryDiag(null);
        const status = e?.response?.status;
        const msg = e?.response?.data?.message ?? e?.message ?? 'unknown error';
        setRecoveryToast(status ? `HTTP ${status}: ${msg}` : msg);
      }
      return 0;
    }
  }, []);

  // Initial load: local-DB only. The wallet balance + ledger are the source of
  // truth for what's been applied; we don't need to call Stripe just to render
  // the page. Stripe is only queried on explicit triggers:
  //   • Post-Checkout redirect (?topup=success&session_id=… → reconcile)
  //   • User clicks "Recover pending payments" (manual scan)
  //   • User clicks Inspect / Apply on a Session ID (targeted lookup)
  // This keeps the panel snappy on every refresh.
  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadBalance(), loadTransactions(1)]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [canView, loadBalance, loadTransactions]);

  // Auto-dismiss the recovery toast after 4s.
  useEffect(() => {
    if (!recoveryToast) return;
    const t = setTimeout(() => setRecoveryToast(null), 4000);
    return () => clearTimeout(t);
  }, [recoveryToast]);

  const handleManualRecover = useCallback(async () => {
    if (recovering) return;
    setRecovering(true);
    try {
      const applied = await runRecovery(false);
      if (applied > 0) {
        await Promise.all([loadBalance(), loadTransactions(1)]);
      }
    } finally {
      setRecovering(false);
    }
  }, [recovering, runRecovery, loadBalance, loadTransactions]);

  // ─── Apply-by-Session-ID escape hatch ────────────────────────────────
  // Used when the auto-scan can't find a payment because the BackOffice
  // Customer.StripeCustomerId linkage doesn't match the Stripe Customer
  // the payment was actually made under. The tenant pastes the cs_…
  // session id from their Stripe Dashboard and we apply it directly.
  const [showManualApply, setShowManualApply] = useState(false);
  const [manualSessionId, setManualSessionId] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [trace, setTrace] = useState<import('../../types/billing').CreditTopUpTrace | null>(null);

  const handleInspectSession = useCallback(async () => {
    const sid = manualSessionId.trim();
    if (!sid || inspecting) return;
    setInspecting(true);
    setApplyResult(null);
    setTrace(null);
    try {
      const resp = await customerCreditService.traceTopUp(sid);
      if (resp.data?.isSuccess && resp.data.response) {
        setTrace(resp.data.response);
      } else {
        setApplyResult({ ok: false, message: resp.data?.message ?? 'Inspect failed.' });
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message ?? e?.message ?? 'unknown error';
      setApplyResult({ ok: false, message: status ? `HTTP ${status}: ${msg}` : msg });
    } finally {
      setInspecting(false);
    }
  }, [manualSessionId, inspecting]);

  // ─── Stripe customer linkage status (informational) ────────────────────
  // Shown on the panel header. Driven by the diagnostic returned from the
  // last recovery scan (which carries hasStripeCustomer), plus an on-demand
  // "Link now" button that calls EnsureStripeCustomerAsync directly.
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [linkingStripe, setLinkingStripe] = useState(false);

  const handleEnsureStripeCustomer = useCallback(async () => {
    if (linkingStripe) return;
    setLinkingStripe(true);
    try {
      const resp = await customerCreditService.ensureStripeCustomer();
      if (resp.data?.isSuccess && resp.data.response) {
        setStripeCustomerId(resp.data.response.stripeCustomerId);
        setRecoveryToast(
          resp.data.response.source === 'created'
            ? `Linked new Stripe customer ${resp.data.response.stripeCustomerId}`
            : resp.data.response.source === 'found_orphan'
              ? `Re-linked orphan Stripe customer ${resp.data.response.stripeCustomerId}`
              : `Stripe customer: ${resp.data.response.stripeCustomerId}`
        );
      } else {
        setRecoveryToast(resp.data?.message ?? 'Could not link Stripe customer.');
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message ?? e?.message ?? 'unknown error';
      setRecoveryToast(status ? `HTTP ${status}: ${msg}` : msg);
    } finally {
      setLinkingStripe(false);
    }
  }, [linkingStripe]);

  const handleApplyBySessionId = useCallback(async () => {
    const sid = manualSessionId.trim();
    if (!sid || applying) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const resp = await customerCreditService.applyTopUpBySessionId(sid);
      if (resp.data?.isSuccess) {
        setApplyResult({ ok: true, message: resp.data.message ?? 'Applied.' });
        setManualSessionId('');
        await Promise.all([loadBalance(), loadTransactions(1)]);
      } else {
        setApplyResult({ ok: false, message: resp.data?.message ?? 'Apply failed.' });
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message ?? e?.message ?? 'unknown error';
      setApplyResult({ ok: false, message: status ? `HTTP ${status}: ${msg}` : msg });
    } finally {
      setApplying(false);
    }
  }, [manualSessionId, applying, loadBalance, loadTransactions]);

  // After returning from Stripe Checkout, ask the backend to reconcile against
  // Stripe (handles the local-dev case where the webhook can't reach us). The
  // reconcile call is idempotent on PaymentIntentId so a late webhook delivery
  // is a no-op. If reconcile reports the session isn't yet paid (async payment
  // method still pending), fall back to a short balance-polling loop.
  useEffect(() => {
    if (!pendingTopUpSessionId || !canView) return;

    let cancelled = false;
    setTopUpPolling(true);
    const startBalance = balance?.balance ?? 0;

    (async () => {
      // 1) Inline reconcile — credits the wallet now if Stripe says paid.
      let reconciled = false;
      try {
        const resp = await customerCreditService.reconcileTopUp(pendingTopUpSessionId);
        // Backend returns Success(true) when actually applied, Success(false)
        // when the session isn't yet paid (rare for cards, common for ACH).
        reconciled = resp.data?.isSuccess === true && resp.data.response === true;
      } catch {
        // Swallow — fall back to polling. The webhook may still deliver.
      }
      if (cancelled) return;

      // 2) Refresh balance + ledger regardless (cheap, gives instant UI feedback).
      const fresh = await loadBalance();
      if (cancelled) return;
      await loadTransactions(1);
      if (cancelled) return;

      const newBalance = fresh?.balance ?? startBalance;
      if (reconciled || newBalance > startBalance) {
        setTopUpPolling(false);
        onTopUpAcknowledged?.();
        return;
      }

      // 3) Fallback poll — for the case where the payment is genuinely pending
      // (e.g. async payment method) or webhook is delayed. Up to ~12s.
      const startedAt = Date.now();
      const MAX_MS = 12000;
      const tick = async () => {
        if (cancelled) return;
        const fresh2 = await loadBalance();
        if ((fresh2?.balance ?? startBalance) > startBalance) {
          if (cancelled) return;
          setTopUpPolling(false);
          await loadTransactions(1);
          onTopUpAcknowledged?.();
          return;
        }
        if (Date.now() - startedAt > MAX_MS) {
          if (cancelled) return;
          setTopUpPolling(false);
          // Give up after MAX_MS. The user can hit refresh; Stripe webhooks will
          // eventually deliver and the credit service is idempotent.
          onTopUpAcknowledged?.();
          return;
        }
        setTimeout(tick, 1500);
      };
      tick();
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTopUpSessionId]);

  if (!canView) return null;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div className="text-xs text-gray-500 dark:text-gray-400">Loading API credits…</div>
      </div>
    );
  }

  if (error || !balance) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-xs text-red-700 dark:text-red-300">
        <div className="font-semibold mb-1">Couldn't load the API credit wallet.</div>
        <div className="font-mono break-all">{error ?? 'No response from /api/CustomerCredit/MyBalance.'}</div>
        <div className="mt-2 text-[11px] text-red-600 dark:text-red-400">
          Common causes: BackOffice.Api isn't running, the
          {' '}<code>20260521_CustomerCredits_AndLedger.sql</code> migration hasn't been applied, or you aren't signed in.
        </div>
      </div>
    );
  }

  const lowBalance = balance.balance < LOW_BALANCE_THRESHOLD;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-800 dark:text-gray-200">API Credits &amp; Usage</span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400">
            One-time free tier · pay-as-you-go past quota
          </span>
          {topUpPolling && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              Confirming payment…
            </span>
          )}
          {recoveryToast && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {recoveryToast}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canTopUp && (
            <button
              onClick={handleManualRecover}
              disabled={recovering}
              title="Scan Stripe for any paid top-ups that haven't credited yet"
              className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {recovering ? 'Scanning…' : 'Recover pending payments'}
            </button>
          )}
          {canTopUp && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium"
            >
              Add Credit
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Balance summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Wallet balance</div>
            <div className={`text-2xl font-bold mt-1 ${lowBalance ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
              ${fmtMoney(balance.balance)}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{balance.currency}</div>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Last top-up</div>
            <div className="text-base font-semibold mt-1 text-gray-900 dark:text-white">
              {balance.lastTopUpAmount != null ? `$${fmtMoney(balance.lastTopUpAmount)}` : '—'}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
              {balance.lastTopUpAt ? fmtDate(balance.lastTopUpAt) : 'No top-ups yet'}
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">APIs configured</div>
            <div className="text-base font-semibold mt-1 text-gray-900 dark:text-white">
              {balance.perApi.length}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
              with free-tier + paid pricing
            </div>
          </div>
        </div>

        {lowBalance && canTopUp && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
            Your balance is low. Once it reaches $0 and the free tier is exhausted, API calls will be
            blocked with HTTP 402 until you top up.
          </div>
        )}

        {/* Stripe customer linkage status. Surfaces whether this tenant has a
            cus_… linked in BackOffice — critical for the Add Credit and auto-
            recovery flows to work. When unlinked, "Link now" creates (or
            re-links an orphan) on demand without going through a checkout. */}
        {(recoveryDiag && !recoveryDiag.hasStripeCustomer) || stripeCustomerId ? (
          <div className={`rounded-lg px-3 py-2 text-[11px] flex items-center justify-between gap-3 ${
            stripeCustomerId || recoveryDiag?.hasStripeCustomer
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
              : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300'
          }`}>
            <div>
              <span className="font-semibold">Stripe customer:</span>{' '}
              {stripeCustomerId
                ? <span className="font-mono">{stripeCustomerId}</span>
                : (recoveryDiag?.hasStripeCustomer ? 'linked' : 'not linked — required before payments can be applied to this tenant')}
            </div>
            {canTopUp && !stripeCustomerId && recoveryDiag && !recoveryDiag.hasStripeCustomer && (
              <button
                onClick={handleEnsureStripeCustomer}
                disabled={linkingStripe}
                className="px-2.5 py-1 text-[11px] bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white rounded font-medium"
              >
                {linkingStripe ? 'Linking…' : 'Link now'}
              </button>
            )}
          </div>
        ) : null}

        {/* Apply-by-Session-ID escape hatch. Always available as a small
            disclosure — primary use case is when the auto-scan can't find a
            payment because the customer linkage is broken. The tenant pastes
            the cs_… ID from their Stripe Dashboard and we apply it directly. */}
        {canTopUp && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowManualApply(s => !s)}
              className="w-full px-3 py-2 text-left text-[11px] font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between"
            >
              <span>Have a Stripe payment that didn't apply? Apply it by Session ID</span>
              <span className="text-gray-400">{showManualApply ? '▴' : '▾'}</span>
            </button>
            {showManualApply && (
              <div className="px-3 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 space-y-2">
                <div className="text-[11px] text-gray-600 dark:text-gray-400">
                  In your <a href="https://dashboard.stripe.com/payments" target="_blank" rel="noreferrer" className="underline text-brand-600 dark:text-brand-400">Stripe Dashboard</a>, open the paid $50 payment, scroll to the <b>Checkout summary</b> card on the right, and copy the
                  {' '}<span className="font-mono">cs_…</span> ID. Paste it here. This bypasses the customer-linkage scan and applies the payment directly to your wallet.
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualSessionId}
                    onChange={e => { setManualSessionId(e.target.value); setTrace(null); setApplyResult(null); }}
                    placeholder="cs_test_a1B2c3D4… or cs_live_…"
                    className="flex-1 px-2 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    disabled={applying || inspecting}
                  />
                  <button
                    onClick={handleInspectSession}
                    disabled={inspecting || applying || !manualSessionId.trim()}
                    title="Read-only diagnostic: see exactly why Apply would or wouldn't succeed"
                    className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {inspecting ? 'Inspecting…' : 'Inspect'}
                  </button>
                  <button
                    onClick={handleApplyBySessionId}
                    disabled={applying || inspecting || !manualSessionId.trim()}
                    className="px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded font-medium"
                  >
                    {applying ? 'Applying…' : 'Apply'}
                  </button>
                </div>
                {applyResult && (
                  <div className={`text-[11px] px-2 py-1.5 rounded ${
                    applyResult.ok
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                  }`}>
                    {applyResult.message}
                  </div>
                )}

                {/* Trace verdict — read-only dump of what the backend sees for this session. */}
                {trace && (
                  <div className={`border rounded-lg p-2.5 space-y-1.5 text-[11px] ${
                    trace.wouldApply
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                  }`}>
                    <div className="font-semibold flex items-center gap-2">
                      <span className={trace.wouldApply ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}>
                        {trace.wouldApply ? '✓ Would apply' : '✗ Would NOT apply'}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 font-normal">{trace.note}</span>
                    </div>
                    {trace.blockers.length > 0 && (
                      <ul className="list-disc list-inside text-amber-800 dark:text-amber-300">
                        {trace.blockers.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 pt-1 border-t border-gray-300/50 dark:border-gray-600/50 font-mono text-[10px] text-gray-700 dark:text-gray-300">
                      <div><b>session.found:</b> {String(trace.sessionFound)}</div>
                      <div><b>session.mode:</b> {trace.mode ?? '—'}</div>
                      <div><b>payment_status:</b> {trace.paymentStatus ?? '—'}</div>
                      <div><b>amount_total:</b> {trace.amountTotalCents != null ? `${trace.amountTotalCents}¢ ($${trace.amountFromSession?.toFixed(2)})` : '—'}</div>
                      <div><b>payment_intent:</b> {trace.paymentIntentId ?? '—'}</div>
                      <div><b>meta.intent:</b> {trace.metadataIntent ?? '—'}</div>
                      <div><b>meta.customer_id:</b> {trace.metadataCustomerId ?? '—'}</div>
                      <div><b>meta.topup_amount:</b> {trace.metadataTopUpAmount ?? '—'}</div>
                      <div><b>session.customer:</b> {trace.stripeCustomerIdOnSession ?? '—'}</div>
                      <div><b>caller.stripeCustomerId:</b> {trace.callerStripeCustomerId ?? '—'}</div>
                      <div><b>stripe_customer_match:</b> {String(trace.stripeCustomerMatchesCaller)}</div>
                      <div><b>meta_customer_match:</b> {String(trace.metadataCustomerIdMatchesCaller)}</div>
                      <div><b>intent_is_credit_topup:</b> {String(trace.intentIsCreditTopUp)}</div>
                      <div><b>already_on_ledger:</b> {trace.paymentIntentAlreadyOnLedger ? `yes (CustomerId=${trace.alreadyAppliedToCustomerId})` : 'no'}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recovery diagnostic — shown after a manual "Recover pending payments" click.
            Helps the tenant understand why their wallet stayed at $0 after they say
            they paid (no Stripe customer linked, all sessions for other intents,
            none paid, customer_id mismatch, etc.). */}
        {recoveryDiag && recoveryDiag.applied === 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2.5 text-xs text-blue-900 dark:text-blue-200 space-y-1.5">
            <div className="font-semibold">Recovery scan result</div>
            <div className="text-[11px]">{recoveryDiag.note ?? 'Scan complete.'}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-0.5 text-[11px] font-mono tabular-nums">
              <div><span className="text-blue-700 dark:text-blue-400">Scanned:</span> {recoveryDiag.scanned}</div>
              <div><span className="text-blue-700 dark:text-blue-400">Applied:</span> {recoveryDiag.applied}</div>
              <div><span className="text-blue-700 dark:text-blue-400">Already on ledger:</span> {recoveryDiag.alreadyApplied}</div>
              <div><span className="text-blue-700 dark:text-blue-400">Stripe customer:</span> {recoveryDiag.hasStripeCustomer ? 'linked' : 'not linked'}</div>
              <div><span className="text-blue-700 dark:text-blue-400">Not credit-top-up:</span> {recoveryDiag.skippedNotCreditTopUp}</div>
              <div><span className="text-blue-700 dark:text-blue-400">Not paid:</span> {recoveryDiag.skippedNotPaid}</div>
              <div><span className="text-blue-700 dark:text-blue-400">Customer mismatch:</span> {recoveryDiag.skippedCustomerMismatch}</div>
              <div><span className="text-blue-700 dark:text-blue-400">No PaymentIntent:</span> {recoveryDiag.skippedNoPaymentIntent}</div>
            </div>
          </div>
        )}

        {/* Per-API consumption table — lifetime free tier + current-month activity in one view. */}
        {balance.perApi.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-2">
              Per-API consumption
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400">
                  <tr>
                    <th className="text-left px-2 py-1.5">API</th>
                    <th className="text-right px-2 py-1.5">This month</th>
                    <th className="text-right px-2 py-1.5">Lifetime used / Free tier</th>
                    <th className="text-left px-2 py-1.5 w-1/4">Free tier remaining</th>
                    <th className="text-right px-2 py-1.5">Rate / call</th>
                  </tr>
                </thead>
                <tbody>
                  {balance.perApi.map(row => {
                    const pct = row.freeTierLimit === 0
                      ? 100
                      : Math.min(100, Math.round((row.callsUsed / row.freeTierLimit) * 100));
                    const exhausted = row.freeRemaining === 0 && row.freeTierLimit > 0;
                    return (
                      <tr key={row.apiDefinitionId} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="px-2 py-1.5 text-gray-900 dark:text-gray-100">
                          <div className="font-medium">{row.apiName}</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">{row.apiCode}</div>
                        </td>
                        <td className="px-2 py-1.5 text-right text-gray-800 dark:text-gray-200 tabular-nums">
                          {row.callsThisMonth.toLocaleString()}
                        </td>
                        <td className="px-2 py-1.5 text-right text-gray-800 dark:text-gray-200 tabular-nums">
                          {row.callsUsed.toLocaleString()} / {row.freeTierLimit.toLocaleString()}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${exhausted ? 'bg-red-500' : 'bg-brand-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-medium ${exhausted ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                              {row.freeRemaining.toLocaleString()} left
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right text-gray-800 dark:text-gray-200 tabular-nums">
                          ${fmtMoney(row.effectiveRate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
              Free tier is a one-time grant per customer and never resets. Calls past the free tier
              are paid from your wallet at the rate above.
            </div>
          </div>
        )}

        {/* Transaction ledger */}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-2">
            Transactions
          </div>
          {transactions.length === 0 ? (
            <div className="text-xs text-gray-500 dark:text-gray-400">No transactions yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400">
                  <tr>
                    <th className="text-left px-2 py-1.5">When</th>
                    <th className="text-left px-2 py-1.5">Type</th>
                    <th className="text-left px-2 py-1.5">Details</th>
                    <th className="text-right px-2 py-1.5">Amount</th>
                    <th className="text-right px-2 py-1.5">Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="px-2 py-1.5 text-gray-800 dark:text-gray-200">{fmtDate(tx.createdAt)}</td>
                      <td className="px-2 py-1.5 text-gray-800 dark:text-gray-200">
                        {CreditTransactionTypeLabel[tx.type] ?? tx.typeLabel}
                      </td>
                      <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400">
                        {tx.apiCode ? `${tx.apiCode}${tx.callCount ? ` × ${tx.callCount}` : ''}` : (tx.description ?? '—')}
                      </td>
                      <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${txnAmountClass(tx.type)}`}>
                        {fmtSignedMoney(tx.amount)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-800 dark:text-gray-200 tabular-nums">
                        ${fmtMoney(tx.balanceAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {txTotal > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-2 text-[11px] text-gray-600 dark:text-gray-400">
                  <span>Page {txPage} · {txTotal.toLocaleString()} total</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => loadTransactions(Math.max(1, txPage - 1))}
                      disabled={txPage <= 1}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => loadTransactions(txPage + 1)}
                      disabled={txPage * PAGE_SIZE >= txTotal}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showAddModal && <AddCreditModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
};

export default ApiCreditsPanel;
