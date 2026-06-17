import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { billingService } from '../services/billingService';
import { usePermissions } from '../context/PermissionContext';
import { useConfirm } from '../components/ui/ConfirmModal';
import type {
  CustomerSubscriptionDetail,
  EstimatedBill,
  EstimatedBillLine,
  InvoiceSummary,
  InvoiceDetail,
  BillingStatus,
  PlanDetail,
  CustomerAppLicense,
  DeviceLimit,
  TransactionRecord,
} from '../types/billing';
import LegacyInvoiceModal from '../components/billing/LegacyInvoiceModal';
import LicenseChangesConfirmModal, { useAddOnPreview, type LicenseChangeLine } from '../components/billing/LicenseChangesConfirmModal';
import ApiCreditsPanel from '../components/billing/ApiCreditsPanel';
import {
  SubscriptionStatus,
  SubscriptionStatusLabel,
  InvoiceStatus,
  InvoiceStatusLabel,
  BillingCycleLabel,
  PlanTierLabel,
} from '../types/billing';

// Permission keys — match Perms.Admin.LicensesBilling in Perms.cs
const PERM_VIEW = 'admin.licenses_billing.view';
// "Edit" covers both plan changes and license add/remove (same key — see Perms.cs)
const PERM_EDIT = 'admin.licenses_billing.edit';

// ─── Helpers ───

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusBadge = (status: SubscriptionStatus) => {
  if (status === SubscriptionStatus.Active) return 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
  if (status === SubscriptionStatus.Trial) return 'bg-brand-100 text-brand-700 border border-brand-200 dark:bg-brand-900/30 dark:text-brand-400 dark:border-brand-800';
  if (status === SubscriptionStatus.PastDue) return 'bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
  if (status === SubscriptionStatus.Suspended) return 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
  return 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
};

const invoiceBadge = (status: InvoiceStatus) => {
  if (status === InvoiceStatus.Paid) return 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400';
  if (status === InvoiceStatus.PastDue) return 'bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400';
  if (status === InvoiceStatus.Void) return 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400';
  return 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-300';
};

// ─── Panel wrapper ───

const Panel: React.FC<{ title: string; badge?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }> = ({ title, badge, action, children }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{title}</span>
        {badge}
      </div>
      {action}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

// ─── Skeleton ───
//
// Each variant mirrors a real panel's shape so the loader doesn't visually
// "jump" when data arrives. All variants share the same panel chrome (rounded
// border, padding, header strip) and use the same `animate-pulse` shimmer.

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  // Uses the global `.skeleton-shimmer` class (defined in index.css with the
  // matching @keyframes shimmer). The previous bg-gray-200 + animate-pulse
  // combo was so subtle on light cards it read as a white screen — the
  // sweeping gradient is much more obviously "loading".
  <div
    className={`skeleton-shimmer rounded ${className}`}
    role="status"
    aria-busy="true"
  />
);

/** Reusable panel chrome — matches the real <Panel /> component visually. */
const SkeletonPanelShell: React.FC<{ children: React.ReactNode; titleWidthClass?: string }> = ({
  children,
  titleWidthClass = 'w-32',
}) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
      <Skeleton className={`h-3.5 ${titleWidthClass}`} />
    </div>
    <div className="p-4">{children}</div>
  </div>
);

/** Top stat card (Plan / Licenses / API Calls / Base Plan / Transactions) — label, big value, caption. */
const SkeletonStatCard: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5">
    <Skeleton className="h-2.5 w-16 mb-2" />
    <Skeleton className="h-5 w-24 mb-2" />
    <Skeleton className="h-2.5 w-20" />
  </div>
);

/** Current Plan: large plan name + price + 3 action buttons. */
const SkeletonCurrentPlan: React.FC = () => (
  <SkeletonPanelShell titleWidthClass="w-28">
    <div className="flex items-center justify-between mb-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-3 w-36" />
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-7 w-28" />
      </div>
    </div>
    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  </SkeletonPanelShell>
);

/** Device Licenses: 4 rows of (icon, name + sub, progress bar, qty controls, price). */
const SkeletonDeviceLicenses: React.FC = () => (
  <SkeletonPanelShell titleWidthClass="w-28">
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2 w-40" />
            <Skeleton className="h-1.5 w-full" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-7 w-7 rounded-full" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  </SkeletonPanelShell>
);

/** Estimated Bill: 3 sections of itemized lines + final total row. */
const SkeletonEstimatedBill: React.FC = () => (
  <SkeletonPanelShell titleWidthClass="w-44">
    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
      {[...Array(3)].map((_, s) => (
        <div key={s}>
          <Skeleton className="h-2.5 w-24 mb-2" />
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex justify-between py-1">
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      ))}
      <div className="flex justify-between pt-3 border-t border-gray-300 dark:border-gray-600">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  </SkeletonPanelShell>
);

/** API Usage / Transactions: list of metric rows, each with progress bar. */
const SkeletonUsageList: React.FC<{ rows?: number; titleWidthClass?: string }> = ({
  rows = 4,
  titleWidthClass = 'w-44',
}) => (
  <SkeletonPanelShell titleWidthClass={titleWidthClass}>
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="h-2 w-24" />
          </div>
        </div>
      ))}
    </div>
  </SkeletonPanelShell>
);

/** Transactions panel (single big stat). */
const SkeletonTransactionsStat: React.FC = () => (
  <SkeletonPanelShell titleWidthClass="w-48">
    <div className="grid grid-cols-2 gap-3">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-1.5">
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="h-6 w-10" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      ))}
    </div>
  </SkeletonPanelShell>
);

/** Invoice History: 4 rows of (icon, invoice no + date, view button). */
const SkeletonInvoiceHistory: React.FC = () => (
  <SkeletonPanelShell titleWidthClass="w-32">
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <Skeleton className="h-7 w-7 rounded shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2 w-20" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  </SkeletonPanelShell>
);

// Kept as a thin alias so any future generic-skeleton callers don't break.
const SkeletonPanel: React.FC = () => <SkeletonUsageList rows={3} />;

// ─── Main Component ───

// Pending license changes — net delta per appId, plus chosen IDs to remove (LIFO).
type PendingChange = { addCount: number; removeIds: number[] };

const LicensesAndBillingPage: React.FC = () => {
  const { hasPermission } = usePermissions();
  const { confirm, ConfirmDialog } = useConfirm();

  const canView = hasPermission(PERM_VIEW);
  const canChangePlan = hasPermission(PERM_EDIT);
  const canManageLicenses = hasPermission(PERM_EDIT);

  // API data
  const [subscription, setSubscription] = useState<CustomerSubscriptionDetail | null>(null);
  const [estimate, setEstimate] = useState<EstimatedBill | null>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [licenses, setLicenses] = useState<CustomerAppLicense[]>([]);
  const [deviceLimits, setDeviceLimits] = useState<DeviceLimit[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Pending license edits (cleared on save/discard/reload)
  const [pending, setPending] = useState<Record<number, PendingChange>>({});
  const [savingLicenses, setSavingLicenses] = useState(false);

  // Add-on confirm modal (shown when pending changes include billable adds).
  // Atomicity model: when the user confirms, we stash `pending` in sessionStorage
  // and redirect to Stripe. The license-row commits (addMyLicense / removeMyLicense)
  // run only after Stripe confirms payment on the return roundtrip.
  const [showAddOnModal, setShowAddOnModal] = useState(false);
  const [addOnSubmitting, setAddOnSubmitting] = useState(false);

  // Change Plan modal
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [plans, setPlans] = useState<PlanDetail[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [confirmPlanId, setConfirmPlanId] = useState<number | null>(null);
  // True once full per-plan details (appPricings/apiPricings) have been fetched
  // for the Change Plan modal. On load we only fetch the current plan's detail;
  // the rest are fetched the first time the modal opens. Reset on every reload.
  const plansDetailLoadedRef = useRef(false);

  // Invoice viewer (Stripe-hosted opens in new tab; legacy uses local modal)
  const [legacyInvoice, setLegacyInvoice] = useState<InvoiceDetail | null>(null);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<number | null>(null);

  // Set when the page loads with ?topup=success&session_id=... after a Stripe
  // credit-topup Checkout. ApiCreditsPanel polls /MyBalance while this is set,
  // then clears it via the onTopUpAcknowledged callback.
  const [pendingTopUpSessionId, setPendingTopUpSessionId] = useState<string | null>(null);

  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); } }, [toast]);

  // ─── Handle return from Stripe credit-topup Checkout ───
  // Separate from the upgrade/subscribe flow because it doesn't touch the
  // PendingUpgrade/Subscription tables — the panel itself polls /MyBalance.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topup = params.get('topup');
    if (!topup) return;

    const sessionId = params.get('session_id');

    if (topup === 'canceled') {
      setToast({ message: 'Credit top-up canceled — no charge was made.', type: 'error' });
    } else if (topup === 'success' && sessionId) {
      setPendingTopUpSessionId(sessionId);
      setToast({ message: 'Payment received — confirming credit…', type: 'success' });
    }

    // Strip query params so a refresh doesn't re-trigger.
    const url = new URL(window.location.href);
    url.searchParams.delete('topup');
    if (topup === 'success') url.searchParams.delete('session_id');
    window.history.replaceState({}, '', url.toString());
  }, []);

  // ─── Data fetching ───

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      // Backstops for a missed Stripe success-redirect (different port, ad/popup
      // blocker, browser back-button, etc.): apply any paid-but-unapplied
      // PendingUpgrade / PendingAddOn rows for this tenant.
      //
      // PERF: these were previously two SEQUENTIAL awaits, each a Stripe
      // round-trip, that fully BLOCKED the data fetch — the main reason the page
      // felt slow to load. Now we fire both in PARALLEL and OFF the critical
      // path: the page paints as soon as the data calls return. We reconcile in
      // the background and only refetch when a backstop actually applied
      // something (the rare missed-redirect case), so a normal load pays zero
      // reconcile latency.
      const reconcilePromise = Promise.allSettled([
        billingService.reconcilePendingUpgrades(),
        billingService.reconcilePendingAddOns(),
      ]);
      if (!opts?.silent) {
        void reconcilePromise.then(results => {
          const applied = results.reduce(
            (n, r) => n + (r.status === 'fulfilled' && r.value.data.isSuccess ? (r.value.data.response ?? 0) : 0),
            0,
          );
          if (applied > 0) void loadData({ silent: true });
        });
      }

      const [subRes, estRes, invRes, statusRes, plansRes, licRes, devRes, txnRes] = await Promise.allSettled([
        billingService.getMyPlan(),
        billingService.getMyEstimate(),
        billingService.getMyInvoices(),
        billingService.getMyBillingStatus(),
        billingService.getPlansLookup(),
        billingService.getMyLicenses(false),
        billingService.getMyDeviceLimits(),
        billingService.getMyTransactions(),
      ]);
      const currentSub = subRes.status === 'fulfilled' && subRes.value.data.isSuccess
        ? subRes.value.data.response
        : null;
      setSubscription(currentSub);
      if (estRes.status === 'fulfilled' && estRes.value.data.isSuccess) setEstimate(estRes.value.data.response);
      else setEstimate(null);
      if (invRes.status === 'fulfilled' && invRes.value.data.isSuccess) setInvoices(invRes.value.data.response ?? []);
      else setInvoices([]);
      if (statusRes.status === 'fulfilled' && statusRes.value.data.isSuccess) setBillingStatus(statusRes.value.data.response);
      else setBillingStatus(null);
      if (licRes.status === 'fulfilled' && licRes.value.data.isSuccess) setLicenses(licRes.value.data.response ?? []);
      else setLicenses([]);
      if (devRes.status === 'fulfilled' && devRes.value.data.isSuccess) setDeviceLimits(devRes.value.data.response ?? []);
      else setDeviceLimits([]);
      if (txnRes.status === 'fulfilled' && txnRes.value.data.isSuccess) setTransactions(txnRes.value.data.response ?? []);
      else setTransactions([]);
      setPending({});

      // Only the CURRENT plan needs its full detail (appPricings/apiPricings) for
      // the "Current Plan" display on load. Fetching detail for every plan here was
      // an N+1 that scaled the page's load time with the number of plans. The rest
      // are fetched lazily the first time the Change Plan modal opens (openChangePlan).
      plansDetailLoadedRef.current = false;
      if (plansRes.status === 'fulfilled' && plansRes.value.data.isSuccess && plansRes.value.data.response) {
        const basicPlans = plansRes.value.data.response;
        const currentPlanId = currentSub?.planId;
        if (currentPlanId) {
          const detailRes = await billingService.getPlanDetail(currentPlanId).catch(() => null);
          const detail = detailRes?.data.isSuccess ? detailRes.data.response : null;
          setPlans(detail
            ? basicPlans.map(p => (p.id === currentPlanId ? detail : p))
            : basicPlans);
        } else {
          setPlans(basicPlans);
        }
      }
    } catch {
      setToast({ message: 'Failed to load billing data', type: 'error' });
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  // loadData references itself for the rare background re-fetch after a backstop
  // applies a pending change; it's stable so an empty dep list is correct.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guard against a double initial load. React StrictMode (DEV) double-invokes
  // mount effects, and the in-app keep-alive tab system can remount this page —
  // both would otherwise fire the entire ~10-call billing data load twice. The
  // ref persists across the StrictMode remount, so loadData() runs exactly once.
  const didInitialLoadRef = useRef(false);
  useEffect(() => {
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    loadData();
  }, [loadData]);

  // ─── Add-on Stripe-return handler ────────────────────────────────────────
  // Runs once on mount. Looks for ?addon=success&session_id=... or ?addon=canceled
  // in the URL — both come from Stripe's success_url / cancel_url. On success,
  // polls the session status until paid, then commits the stashed pending license
  // changes via the existing Mine/Add and Mine/Remove endpoints. On cancel,
  // clears the stash and tells the user nothing was charged or saved.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addonParam = params.get('addon');
    const sessionId = params.get('session_id');
    if (!addonParam) return;

    // Strip the params from the URL so a refresh doesn't re-trigger the flow.
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    if (addonParam === 'canceled') {
      // User backed out at Stripe. Clear any stash for sessions we know about
      // (best-effort: we don't know the specific session id on cancel).
      setToast({ message: 'Payment canceled. No changes were made.', type: 'error' });
      return;
    }

    if (addonParam !== 'success' || !sessionId) return;

    // Backend-driven commit model: license rows are created/removed inside
    // AddOnService.ApplyAddOnCheckoutCompletedAsync (triggered by webhook,
    // status-poll, or reconcile). Frontend's only post-redirect job is to
    // poll until the apply step has run, then refresh the UI.
    //
    // The sessionStorage stash is no longer the source of truth — it's only
    // a remnant from older builds. Clear it so it doesn't confuse anything
    // on retries.
    const stashKey = `pendingLicenseChanges:${sessionId}`;
    sessionStorage.removeItem(stashKey);

    let cancelled = false;
    const POLL_INTERVAL_MS = 1500;
    const MAX_ATTEMPTS = 20;

    const pollUntilApplied = async () => {
      for (let attempt = 0; attempt < MAX_ATTEMPTS && !cancelled; attempt++) {
        try {
          const statusRes = await billingService.getAddOnSessionStatus(sessionId);
          const r = statusRes.data?.response;
          if (r?.isPaid && r?.planApplied) {
            // Backend has applied the Stripe subscription update AND committed
            // the CustomerAppLicense rows. Refresh the UI to reflect the new state.
            setToast({ message: 'Payment received. License changes applied.', type: 'success' });
            await loadData();
            return;
          }
          if (r?.paymentStatus && r.paymentStatus !== 'paid' && r.paymentStatus !== 'unpaid') {
            setToast({ message: `Payment ${r.paymentStatus}. License changes were not saved.`, type: 'error' });
            return;
          }
        } catch {
          // Transient — retry on the next tick.
        }
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      if (!cancelled) {
        // Polling exhausted. The reconcile-on-load backstop will catch it on
        // the next page navigation; for now, refresh in case state settled
        // server-side mid-poll.
        setToast({
          message: 'Still waiting for payment confirmation from Stripe. Refresh in a moment.',
          type: 'error',
        });
        await loadData();
      }
    };

    void pollUntilApplied();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Invoice viewer ───
  // Stripe-backed invoices open the Stripe-hosted page in a new tab.
  // Legacy DB-only invoices render in a local read-only modal.
  const handleViewInvoice = useCallback(async (inv: InvoiceSummary) => {
    setViewingInvoiceId(inv.id);
    try {
      const res = await billingService.getInvoiceViewLink(inv.id);
      if (!res.data.isSuccess || !res.data.response) {
        setToast({ message: 'Failed to load invoice', type: 'error' });
        return;
      }
      const link = res.data.response;
      if (link.hostedInvoiceUrl) {
        window.open(link.hostedInvoiceUrl, '_blank', 'noopener,noreferrer');
      } else if (link.detail) {
        setLegacyInvoice(link.detail);
      } else {
        setToast({ message: 'Invoice has no viewable copy', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to load invoice', type: 'error' });
    } finally {
      setViewingInvoiceId(null);
    }
  }, []);

  // ─── Derived data from estimate line items ───

  const deviceLines = estimate?.lineItems?.filter(l => l.category === 'device_license') ?? [];
  const apiLines = estimate?.lineItems?.filter(l => l.category === 'api_calls') ?? [];
  const txnLines = estimate?.lineItems?.filter(l => l.category === 'transaction') ?? [];

  const deviceTotal = deviceLines.reduce((s, l) => s + l.lineTotal, 0);
  const apiTotal = apiLines.reduce((s, l) => s + l.lineTotal, 0);
  const txnTotal = txnLines.reduce((s, l) => s + l.lineTotal, 0);
  const txnCount = txnLines.reduce((s, l) => s + l.quantity, 0);
  const txnFree = txnLines.reduce((s, l) => s + l.freeUnits, 0);
  const txnBillable = txnLines.reduce((s, l) => s + l.billableUnits, 0);

  // ─── License helpers ───

  // Net delta per app: existing active + adds - planned removals
  const effectiveCount = useCallback(
    (appId: number) => {
      const active = licenses.filter(l => l.appId === appId && l.isActive).length;
      const p = pending[appId];
      return active + (p?.addCount ?? 0) - (p?.removeIds?.length ?? 0);
    },
    [licenses, pending],
  );

  // Cycle math for proration preview (matches BillingService)
  const cycleStart = estimate?.billingPeriodStart ? new Date(estimate.billingPeriodStart) : null;
  const cycleEnd = estimate?.billingPeriodEnd ? new Date(estimate.billingPeriodEnd) : null;
  const today = new Date();
  const periodDays = cycleStart && cycleEnd ? Math.max(1, Math.round((cycleEnd.getTime() - cycleStart.getTime()) / 86_400_000)) : 30;
  const daysRemaining = cycleEnd ? Math.max(0, Math.round((cycleEnd.getTime() - today.getTime()) / 86_400_000)) : 0;
  const prorationFactor = periodDays > 0 ? daysRemaining / periodDays : 0;
  const cycleEndLabel = cycleEnd ? cycleEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  const hasPendingChanges = useMemo(
    () => Object.values(pending).some(p => p.addCount > 0 || p.removeIds.length > 0),
    [pending],
  );

  const incrementApp = useCallback((appId: number) => {
    setPending(prev => {
      const cur = prev[appId] ?? { addCount: 0, removeIds: [] };
      // If a planned removal exists, undo it first instead of stacking adds
      if (cur.removeIds.length > 0) {
        return { ...prev, [appId]: { addCount: cur.addCount, removeIds: cur.removeIds.slice(0, -1) } };
      }
      return { ...prev, [appId]: { addCount: cur.addCount + 1, removeIds: cur.removeIds } };
    });
  }, []);

  const decrementApp = useCallback((appId: number) => {
    setPending(prev => {
      const cur = prev[appId] ?? { addCount: 0, removeIds: [] };
      // Pop a pending add first
      if (cur.addCount > 0) {
        return { ...prev, [appId]: { addCount: cur.addCount - 1, removeIds: cur.removeIds } };
      }
      // Otherwise queue removal (LIFO — most recently activated active row not already queued)
      const queued = new Set(cur.removeIds);
      const candidate = licenses
        .filter(l => l.appId === appId && l.isActive && !queued.has(l.id))
        .sort((a, b) => new Date(b.activatedAt).getTime() - new Date(a.activatedAt).getTime())[0];
      if (!candidate) return prev;
      return { ...prev, [appId]: { addCount: cur.addCount, removeIds: [...cur.removeIds, candidate.id] } };
    });
  }, [licenses]);

  const discardChanges = useCallback(() => setPending({}), []);

  // ─── Add-on payload + line-item helpers (used by modal + commit) ─────────

  /**
   * Builds the data needed to ask Stripe for proration AND to render the modal:
   *   - `items`     : the {appId, quantity} list sent to PreviewAddOn / CreateAddOnSession.
   *                   `quantity` is the OVERAGE units (devices beyond plan FreeUnits)
   *                   the user wants AFTER applying the pending changes.
   *   - `lines`     : human-readable per-app rows for the modal's "Charges today" section.
   *                   Amounts are local-computed (qty × per-unit × proration factor) so the
   *                   modal renders instantly; the Stripe-authoritative total replaces this
   *                   sum once `previewAddOn` resolves inside the modal.
   *   - `localTotal`: sum of `lines.amount` — fallback while Stripe preview loads.
   *   - `hasBillableAdds`: true iff at least one app has a positive add count.
   *
   * Note: removals are intentionally NOT included in `items`/`lines`. Today's
   * UX leaves removed devices active until cycle end (legacy behavior), so they
   * generate no billing change at this moment. They DO get committed locally
   * after payment success for consistency.
   */
  const buildAddOnPayload = useCallback(() => {
    const items: Array<{
      appId: number;
      quantity: number;
      addedQuantity: number;
      removeLicenseIds?: number[];
    }> = [];
    const lines: LicenseChangeLine[] = [];
    let localTotal = 0;
    let hasBillableAdds = false;

    // Walk every app the user has touched (adds OR removes). Lines with only
    // removes don't generate a charge today, but their removeLicenseIds still
    // need to flow to the backend so it can mark those rows for removal after
    // payment success.
    const touchedAppIds = new Set<number>();
    for (const dl of deviceLines) {
      if (dl.appId != null) touchedAppIds.add(dl.appId);
    }
    // Also include any apps with pending removes that didn't appear in deviceLines
    // (defensive — shouldn't happen, but cheap).
    for (const k of Object.keys(pending)) touchedAppIds.add(Number(k));

    for (const appId of touchedAppIds) {
      if (appId === 0) continue;
      const p = pending[appId];
      const addCount = p?.addCount ?? 0;
      const removeIdsRaw = p?.removeIds ?? [];
      if (addCount === 0 && removeIdsRaw.length === 0) continue;

      const dl = deviceLines.find(d => d.appId === appId);
      const limit = deviceLimits.find(d => d.appId === appId);
      // FreeUnits comes from the plan ceiling: slotsTotal on DeviceLimit.
      // If unknown, treat as 0 → all desired qty is billable overage.
      const freeUnits = limit?.slotsTotal ?? 0;
      const desiredTotal = effectiveCount(appId);
      const overage = Math.max(0, desiredTotal - freeUnits);

      // CustomerAppLicense.id is an int — frontend stores it as string. Coerce
      // back so the backend's int? RemoveLicenseIds list deserializes cleanly.
      const removeLicenseIds = removeIdsRaw
        .map(s => Number(s))
        .filter(n => Number.isFinite(n) && n > 0);

      // addedQuantity = the user-clicked delta in THIS session. Backend uses this
      // for the prorated charge (instead of diffing against Stripe's current qty)
      // so the modal's per-line breakdown and the Checkout total always agree —
      // even if Stripe has stale overage items from prior tests.
      items.push({
        appId,
        quantity: overage,
        addedQuantity: addCount,
        removeLicenseIds: removeLicenseIds.length > 0 ? removeLicenseIds : undefined,
      });

      // Only emit a modal "Charges today" row when there's a positive add count;
      // pure-removes lines flow through `items` for backend processing but don't
      // contribute a charged line to the UI (removes don't bill today).
      if (addCount > 0) {
        const perUnit = dl?.unitPrice ?? 0;
        const proratedLineAmount = perUnit * addCount * prorationFactor;
        // EstimatedBillLine doesn't expose itemName; fall back to description, then a generic label.
        const featureName = dl?.description ?? `App ${appId}`;
        lines.push({
          description: `+${addCount} ${featureName}`,
          amount: Number(proratedLineAmount.toFixed(2)),
        });
        localTotal += proratedLineAmount;
        hasBillableAdds = true;
      }
    }

    return {
      items,
      lines,
      localTotal: Number(localTotal.toFixed(2)),
      hasBillableAdds,
    };
  }, [deviceLines, deviceLimits, pending, effectiveCount, prorationFactor]);

  // Memoized snapshot for the modal — recomputes when pending or the underlying data changes.
  const addOnPayload = useMemo(() => buildAddOnPayload(), [buildAddOnPayload]);
  const { total: serverPreviewTotal, loading: serverPreviewLoading } = useAddOnPreview(
    showAddOnModal,
    addOnPayload.items,
  );

  // Heuristic for current vs new monthly recurring shown in the modal's "next renewal"
  // section. We only know the device-line subtotal locally; for a richer breakdown the
  // backend would need a dedicated "next-renewal preview" endpoint. Keeping it simple.
  // CustomerSubscriptionDetail exposes monthlyAmount (not planPrice).
  const currentRecurringMonthly = subscription?.monthlyAmount ?? null;
  const newRecurringMonthly =
    currentRecurringMonthly != null && addOnPayload.lines.length > 0
      ? currentRecurringMonthly +
        // Approx future monthly impact: add count * per-unit * (1 - proration), i.e. the
        // un-prorated portion that recurs each month. Replace with backend value once we
        // surface NextCycleAmount from the preview API.
        deviceLines.reduce((s, dl) => {
          const p = pending[dl.appId ?? 0];
          if (!p?.addCount) return s;
          return s + (dl.unitPrice ?? 0) * p.addCount;
        }, 0)
      : null;

  /**
   * Commits the actual license-row changes (CustomerAppLicense add/remove rows)
   * via the existing Mine/Add and Mine/Remove endpoints. Called from two places:
   *   - The "no billable changes" path (only removals queued) — runs immediately.
   *   - The post-Stripe-payment success path — runs after the user returns paid.
   * Returns true on full success.
   */
  const commitPendingLicenseChanges = useCallback(async (
    pendingToCommit: Record<number, PendingChange>,
  ): Promise<boolean> => {
    try {
      const ops: Promise<unknown>[] = [];
      for (const [appIdStr, p] of Object.entries(pendingToCommit)) {
        const appId = Number(appIdStr);
        for (let i = 0; i < p.addCount; i++) {
          ops.push(billingService.addMyLicense({ appId }));
        }
        for (const id of p.removeIds) {
          ops.push(billingService.removeMyLicense(id));
        }
      }
      await Promise.all(ops);
      return true;
    } catch {
      return false;
    }
  }, []);

  // ─── Save / confirm flow ────────────────────────────────────────────────

  const saveLicenseChanges = useCallback(async () => {
    if (!hasPendingChanges) return;

    const { hasBillableAdds } = buildAddOnPayload();

    // No billable adds (only removals or zero changes) → keep legacy direct-save
    // behavior. Removed devices stay active until cycle end and are dropped at
    // renewal — no Stripe charge needed.
    if (!hasBillableAdds) {
      const totalRemovals = Object.values(pending).reduce((s, p) => s + p.removeIds.length, 0);
      if (totalRemovals > 0) {
        const ok = await confirm({
          title: 'Confirm license changes',
          message: `${totalRemovals} device(s) will stay active until ${cycleEndLabel} and will not be billed in the next cycle. Proceed?`,
          variant: 'warning',
          confirmLabel: 'Save changes',
        });
        if (!ok) return;
      }

      setSavingLicenses(true);
      const ok = await commitPendingLicenseChanges(pending);
      setSavingLicenses(false);

      if (ok) {
        setToast({ message: 'License changes saved', type: 'success' });
        await loadData();
      } else {
        setToast({ message: 'Failed to save license changes', type: 'error' });
      }
      return;
    }

    // Billable adds present → open the confirmation modal. Confirm there triggers
    // the Checkout-redirect flow.
    setShowAddOnModal(true);
  }, [pending, hasPendingChanges, confirm, cycleEndLabel, loadData, buildAddOnPayload, commitPendingLicenseChanges]);

  /**
   * Modal "Continue to Pay" handler. Stashes the pending state in sessionStorage
   * keyed by the Stripe session id, then redirects to Stripe Checkout. The
   * license-row commits happen on return (see the post-redirect effect below)
   * — only AFTER Stripe confirms the payment.
   */
  const handleConfirmAddOn = useCallback(async () => {
    setAddOnSubmitting(true);
    try {
      const { items } = buildAddOnPayload();
      if (items.length === 0) {
        setToast({ message: 'No billable changes detected', type: 'error' });
        setShowAddOnModal(false);
        return;
      }

      const res = await billingService.createAddOnCheckoutSession({
        items,
        notes: 'License changes via Licenses & Billing page',
      });

      if (!res.data.isSuccess || !res.data.response?.url) {
        setToast({ message: res.data.message || 'Failed to create payment session', type: 'error' });
        return;
      }

      // No sessionStorage stash needed — the backend persisted the full item set
      // (including addedQuantity and removeLicenseIds) into PendingAddOn.ItemsJson
      // when it created the Checkout session. On payment success, ApplyAddOn
      // CheckoutCompletedAsync commits both the Stripe sub update AND the
      // CustomerAppLicense rows from that single source of truth.
      window.location.href = res.data.response.url;
    } catch {
      setToast({ message: 'Failed to start checkout', type: 'error' });
    } finally {
      setAddOnSubmitting(false);
    }
  }, [pending, buildAddOnPayload]);

  // ─── Change Plan ───

  const openChangePlan = async () => {
    setShowChangePlan(true);
    // Lazily fetch full per-plan details (appPricings/apiPricings) the first time
    // the modal opens. On page load we only fetched the current plan's detail to
    // keep the initial load fast; the modal needs detail for all selectable plans.
    if (plansDetailLoadedRef.current || plans.length === 0) return;
    setLoadingPlans(true);
    try {
      const detailResults = await Promise.allSettled(
        plans.map(p => billingService.getPlanDetail(p.id))
      );
      setPlans(prev => prev.map((p, i) => {
        const r = detailResults[i];
        if (r.status === 'fulfilled' && r.value.data.isSuccess && r.value.data.response) return r.value.data.response;
        return p;
      }));
      plansDetailLoadedRef.current = true;
    } finally {
      setLoadingPlans(false);
    }
  };

  // ─── Phase 3: Subscription management (Cancel / Reactivate / Customer Portal) ───

  const handleCancelSubscription = useCallback(async () => {
    if (!subscription?.stripeSubscriptionId) return;
    const ok = await confirm({
      title: 'Cancel subscription?',
      message: `Service will continue until ${
        subscription.currentPeriodEnd
          ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
          : 'the end of the current period'
      }, then auto-renewal will stop. You can reactivate anytime before then.`,
      variant: 'warning',
      confirmLabel: 'Cancel subscription',
    });
    if (!ok) return;
    try {
      const res = await billingService.cancelSubscriptionStripe();
      if (res.data.isSuccess) {
        const planName = subscription.planName ?? 'subscription';
        const endLabel = subscription.currentPeriodEnd
          ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
          : 'the end of the current period';
        setToast({
          message: `${planName} subscription cancellation scheduled — service continues until ${endLabel}.`,
          type: 'success',
        });
        await loadData();
      } else {
        setToast({ message: res.data.message || 'Failed to cancel subscription', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to cancel subscription', type: 'error' });
    }
  }, [subscription, confirm, loadData]);

  const handleReactivateSubscription = useCallback(async () => {
    if (!subscription?.stripeSubscriptionId) return;
    try {
      const res = await billingService.reactivateSubscriptionStripe();
      if (res.data.isSuccess) {
        const planName = subscription.planName ?? 'subscription';
        setToast({
          message: `${planName} subscription reactivated — auto-renewal resumed.`,
          type: 'success',
        });
        await loadData();
      } else {
        setToast({ message: res.data.message || 'Failed to reactivate subscription', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to reactivate subscription', type: 'error' });
    }
  }, [subscription, loadData]);

  const handleOpenCustomerPortal = useCallback(async () => {
    try {
      const res = await billingService.createCustomerPortalSession();
      if (res.data.isSuccess && res.data.response?.url) {
        setToast({ message: 'Opening Stripe billing portal in a new tab…', type: 'success' });
        window.open(res.data.response.url, '_blank', 'noopener,noreferrer');
      } else {
        setToast({ message: res.data.message || 'Failed to open billing portal', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to open billing portal', type: 'error' });
    }
  }, []);

  const handleSelectPlan = (planId: number) => {
    setConfirmPlanId(planId);
  };

  const handleConfirmChangePlan = async () => {
    if (!confirmPlanId) return;
    setChangingPlan(true);

    const newPlan = plans.find(p => p.id === confirmPlanId);
    const newPlanName = newPlan?.name ?? 'new plan';

    // No existing subscription → first-time subscribe via Stripe Checkout.
    if (!subscription) {
      try {
        setToast({ message: `Redirecting to Stripe to subscribe to ${newPlanName}…`, type: 'success' });
        const res = await billingService.createSubscribeCheckoutSession({
          planId: confirmPlanId,
          notes: 'Subscribe via Licenses & Billing page',
        });
        if (res.data.isSuccess && res.data.response?.url) {
          window.location.href = res.data.response.url;
          return;
        }
        setToast({ message: res.data.message || 'Failed to start subscription', type: 'error' });
      } catch {
        setToast({ message: 'Failed to start subscription', type: 'error' });
      }
      setChangingPlan(false);
      return;
    }

    // Determine direction of the change so toasts can say "upgraded" / "downgraded"
    // / "switched" instead of a generic "changed".
    const currentPlan = plans.find(p => p.id === subscription.planId);
    const isUpgrade = !!(newPlan && currentPlan && newPlan.price > currentPlan.price);
    const isDowngrade = !!(newPlan && currentPlan && newPlan.price < currentPlan.price);
    const actionVerb = isUpgrade ? 'upgraded' : isDowngrade ? 'downgraded' : 'switched';
    const actionVerbing = isUpgrade ? 'upgrade' : isDowngrade ? 'downgrade' : 'plan change';

    try {
      // Phase 3 routing for any plan change (upgrade or downgrade):
      // - Already has a Stripe Subscription → call ChangePlan API directly (proration handled by Stripe).
      // - No Stripe Subscription yet AND it's an upgrade → first-time Subscribe (mode=subscription).
      // - No Stripe Subscription yet AND it's not an upgrade → existing direct DB path.
      if (subscription.stripeSubscriptionId) {
        const res = await billingService.changeSubscriptionPlanStripe({
          newPlanId: confirmPlanId,
          notes: 'Plan change via Licenses & Billing page',
        });
        if (res.data.isSuccess) {
          // Tailored message per direction: upgrade → charge today; downgrade → credit next cycle.
          const msg = isUpgrade
            ? `Plan upgraded to ${newPlanName}. Stripe charged the prorated difference to your card on file.`
            : isDowngrade
              ? `Plan downgraded to ${newPlanName}. Stripe will apply a prorated credit to your next invoice.`
              : `Plan switched to ${newPlanName}.`;
          setToast({ message: msg, type: 'success' });
          setShowChangePlan(false);
          setConfirmPlanId(null);
          await loadData();
        } else {
          setToast({ message: res.data.message || `Failed to ${actionVerbing} plan`, type: 'error' });
        }
        setChangingPlan(false);
        return;
      }

      if (isUpgrade) {
        // No Stripe sub yet — first-time Subscribe (mode=subscription, auto-renewing).
        // Drop a hint toast before we hand off to Stripe Checkout. The success-URL
        // handler shows the final confirmation when the user returns.
        setToast({ message: `Redirecting to Stripe to subscribe to ${newPlanName}…`, type: 'success' });
        const res = await billingService.createSubscribeCheckoutSession({
          planId: confirmPlanId,
          notes: 'Subscribe via Licenses & Billing page',
        });
        if (res.data.isSuccess && res.data.response?.url) {
          window.location.href = res.data.response.url;
          return;
        }
        setToast({ message: res.data.message || 'Failed to start subscription', type: 'error' });
        setChangingPlan(false);
        return;
      }

      // Direct path (downgrade or same price)
      const res = await billingService.changeSubscription({
        customerId: subscription.customerId,
        newPlanId: confirmPlanId,
        effectiveDate: new Date().toISOString(),
        notes: 'Changed via Licenses & Billing page',
      });
      if (res.data.isSuccess) {
        setToast({ message: `Plan ${actionVerb} to ${newPlanName}.`, type: 'success' });
        setShowChangePlan(false);
        setConfirmPlanId(null);
        loadData();
      } else {
        setToast({ message: res.data.message || `Failed to ${actionVerbing} plan`, type: 'error' });
      }
    } catch {
      setToast({ message: `Failed to ${actionVerbing} plan`, type: 'error' });
    } finally {
      setChangingPlan(false);
    }
  };

  // Handle return from Stripe Checkout. Stripe redirects to:
  //   /licenses-billing?upgrade=success&session_id=cs_...      (one-time mode=payment)
  //   /licenses-billing?upgrade=canceled
  //   /licenses-billing?subscribe=success&session_id=cs_...    (Phase 2 mode=subscription)
  //   /licenses-billing?subscribe=canceled
  // Both flows poll the same status endpoint; reconcile-on-load is the broader backstop.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Track which flow we came back from so the toast can say "subscription activated"
    // vs "plan upgraded" specifically, instead of a generic message.
    const isSubscribe = params.has('subscribe');
    const isUpgradeOneOff = params.has('upgrade');
    const flowParam = params.get('upgrade') ?? params.get('subscribe');
    const sessionId = params.get('session_id');
    if (!flowParam) return;
    const opLabel = isSubscribe ? 'Subscription' : 'Upgrade';

    // Strip query params so a refresh doesn't re-trigger this effect.
    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('upgrade');
      url.searchParams.delete('subscribe');
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.toString());
    };

    if (flowParam === 'canceled') {
      setToast({
        message: `${opLabel} canceled — no charge was made.`,
        type: 'error',
      });
      cleanUrl();
      return;
    }

    if (flowParam === 'success' && sessionId) {
      let cancelled = false;
      let attempts = 0;
      const maxAttempts = 6;
      const intervalMs = 2000;

      const poll = async () => {
        if (cancelled) return;
        attempts++;
        try {
          const res = await billingService.getCheckoutSessionStatus(sessionId);
          if (res.data.isSuccess && res.data.response?.isPaid) {
            // Differentiated success toast: tells the user exactly which Stripe
            // operation completed so the UI message lines up with the action they took.
            const msg = isSubscribe
              ? 'Payment received — subscription activated and your plan is now active.'
              : isUpgradeOneOff
                ? 'Payment received — plan upgraded successfully.'
                : 'Payment received.';
            setToast({ message: msg, type: 'success' });
            cleanUrl();
            await loadData();
            return;
          }
        } catch {
          // ignore transient errors and keep polling
        }
        if (attempts < maxAttempts) {
          setTimeout(poll, intervalMs);
        } else {
          setToast({
            message: `${opLabel} payment processing — refresh the page in a moment.`,
            type: 'success',
          });
          cleanUrl();
          await loadData();
        }
      };

      poll();
      return () => { cancelled = true; };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── No-permission state ───

  if (!canView) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Licenses & Billing</h1>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">You don't have permission to view billing details. Contact your administrator.</p>
        </div>
      </div>
    );
  }

  // ─── No subscription state ───

  if (!loading && !subscription) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Licenses & Billing</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No active subscription found</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Active Plan</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">You don't have an active subscription. Choose a plan to get started.</p>
          <button onClick={openChangePlan} className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors">
            Choose a Plan
          </button>
        </div>
        {showChangePlan && <ChangePlanModal plans={plans} loadingPlans={loadingPlans} currentPlanId={null} changingPlan={changingPlan} onSelect={handleSelectPlan} onConfirm={handleConfirmChangePlan} confirmPlanId={confirmPlanId} onCancelConfirm={() => setConfirmPlanId(null)} onClose={() => { setShowChangePlan(false); setConfirmPlanId(null); }} />}
      </div>
    );
  }

  // ─── Loading state ───
  // Layout-matched skeleton — proportions, panel chrome, and per-row shapes
  // mirror the real page so content swaps in without visual jump. All shimmer
  // pieces share `animate-pulse` so the page reads as a single loading surface.

  if (loading) {
    return (
      <div>
        {/* Header */}
        <div className="mb-3 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-80" />
        </div>

        {/* Top stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          {[...Array(5)].map((_, i) => <SkeletonStatCard key={i} />)}
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-4">
            <SkeletonCurrentPlan />
            <SkeletonDeviceLicenses />
            <SkeletonEstimatedBill />
          </div>
          <div className="flex flex-col gap-4">
            <SkeletonUsageList rows={4} titleWidthClass="w-44" />
            <SkeletonTransactionsStat />
            <SkeletonInvoiceHistory />
          </div>
        </div>
      </div>
    );
  }

  const periodStart = estimate?.billingPeriodStart ? new Date(estimate.billingPeriodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const periodEnd = estimate?.billingPeriodEnd ? new Date(estimate.billingPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const nextBill = subscription?.subscriptionEndDate ? new Date(subscription.subscriptionEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-3">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Licenses & Billing</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {subscription?.customerName} · {subscription?.planName} Plan · Billing period: {periodStart} – {periodEnd}
        </p>
      </div>

      {/* ═══ Top Stat Cards ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5">
          <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Plan</div>
          <div className="text-base font-bold text-purple-600 dark:text-purple-400">{subscription?.planName ?? '—'}</div>
          <div className="text-[10px] text-gray-400 mt-1">Next bill {nextBill}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5">
          <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Licenses</div>
          <div className="text-lg font-bold text-brand-600 dark:text-brand-400">${fmt(deviceTotal)}</div>
          <div className="text-[10px] text-gray-400 mt-1">devices & seats</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5">
          <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">API Calls</div>
          <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">${fmt(apiTotal)}</div>
          <div className="text-[10px] text-gray-400 mt-1">{apiLines.reduce((s, l) => s + l.quantity, 0)} calls this month</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5">
          <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Base Plan</div>
          <div className="text-lg font-bold text-orange-600 dark:text-orange-400">${fmt(subscription?.monthlyAmount ?? 0)}</div>
          <div className="text-[10px] text-gray-400 mt-1">{BillingCycleLabel[subscription?.billingCycleMonths === 12 ? 1 : 0]}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5">
          <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Transactions</div>
          <div className="text-lg font-bold text-green-600 dark:text-green-400">${fmt(txnTotal)}</div>
          <div className="text-[10px] text-gray-400 mt-1">{txnCount} this month</div>
        </div>
      </div>

      {/* ═══ Two Column Layout ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ─── LEFT COLUMN ─── */}
        <div className="flex flex-col gap-4">

          {/* Current Plan */}
          <Panel title="Current Plan" action={
            canChangePlan ? (
              <div className="flex flex-wrap gap-1.5">
                <button onClick={openChangePlan} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-colors">Change Plan</button>
                {subscription?.stripeSubscriptionId && (
                  <>
                    <button onClick={handleOpenCustomerPortal} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold transition-colors">Manage Billing</button>
                    {subscription.cancelAtPeriodEnd ? (
                      <button onClick={handleReactivateSubscription} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors">Reactivate</button>
                    ) : (
                      <button onClick={handleCancelSubscription} className="px-3 py-1.5 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-semibold transition-colors">Cancel</button>
                    )}
                  </>
                )}
              </div>
            ) : null
          }>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-base font-bold text-purple-600 dark:text-purple-400">{subscription?.planName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subscription?.planTier != null ? PlanTierLabel[subscription.planTier] : ''} plan · ${fmt(subscription?.monthlyAmount ?? 0)}/mo</div>
                {subscription?.stripeSubscriptionId && subscription.currentPeriodEnd && (
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    {subscription.cancelAtPeriodEnd
                      ? <>Cancels on <strong className="text-red-600 dark:text-red-400">{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</strong></>
                      : <>Renews on <strong>{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</strong></>}
                  </div>
                )}
              </div>
              <span className={`inline-flex px-2.5 py-0.5 text-[10px] font-semibold rounded-full ${statusBadge(subscription?.subscriptionStatus ?? SubscriptionStatus.Active)}`}>
                {SubscriptionStatusLabel[subscription?.subscriptionStatus ?? SubscriptionStatus.Active]}
              </span>
            </div>
            {/* Device & API limits from plan */}
            {(() => {
              const currentPlan = plans.find(p => p.id === subscription?.planId);
              const apps = currentPlan?.appPricings?.filter(a => a.isIncluded) ?? [];
              const apis = currentPlan?.apiPricings?.filter(a => a.isIncluded) ?? [];
              return (
                <>
                  {apps.length > 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3 mb-2">
                      <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Device Limits</div>
                      <div className="space-y-1">
                        {apps.map((a, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span><span className="text-green-500 mr-1.5">✓</span>{a.appName}</span>
                            <span className="text-gray-400">{a.maxUnits ?? '∞'} {a.pricingModel === 'per_user' ? 'users' : 'devices'} · ${fmt(a.pricePerUnit)}/{a.pricingModel === 'per_user' ? 'seat' : 'device'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {apis.length > 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-2 mb-2">
                      <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1.5">API Access</div>
                      <div className="space-y-1">
                        {apis.map((a, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span><span className="text-green-500 mr-1.5">✓</span>{a.apiName}</span>
                            <span className="text-gray-400">{a.freeTierCalls} free · ${a.ratePerCall.toFixed(4)}/call</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
            <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1">
              <div><span className="text-green-500 mr-1.5">✓</span>Start: {subscription?.subscriptionStartDate ? new Date(subscription.subscriptionStartDate).toLocaleDateString() : '—'}</div>
              <div><span className="text-green-500 mr-1.5">✓</span>End: {subscription?.subscriptionEndDate ? new Date(subscription.subscriptionEndDate).toLocaleDateString() : '—'}</div>
              <div><span className="text-green-500 mr-1.5">✓</span>Billing cycle: {subscription?.billingCycleMonths ?? 1} month(s)</div>
              {billingStatus?.isOverdue && <div><span className="text-red-500 mr-1.5">!</span>Account is overdue{billingStatus.daysUntilSuspension != null ? ` — ${billingStatus.daysUntilSuspension} days until suspension` : ''}</div>}
            </div>
          </Panel>

          {/* Device Licenses */}
          <Panel title="Device Licenses">
            {deviceLines.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No device licenses in current billing period</p>
            ) : (
              <>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {deviceLines.map((line, i) => {
                    const appId = line.appId ?? 0;
                    const p = pending[appId];
                    const limit = deviceLimits.find(d => d.appId === appId);
                    return (
                      <DeviceLicenseRow
                        key={i}
                        line={line}
                        canManage={canManageLicenses}
                        effective={effectiveCount(appId)}
                        addDelta={p?.addCount ?? 0}
                        removeDelta={p?.removeIds.length ?? 0}
                        prorationFactor={prorationFactor}
                        daysRemaining={daysRemaining}
                        cycleEndLabel={cycleEndLabel}
                        activeDevices={limit?.slotsUsed}
                        inactiveDays={limit?.inactiveDays}
                        onIncrement={() => incrementApp(appId)}
                        onDecrement={() => decrementApp(appId)}
                      />
                    );
                  })}
                </div>
                {canManageLicenses && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                    <button
                      onClick={discardChanges}
                      disabled={!hasPendingChanges || savingLicenses}
                      className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Discard
                    </button>
                    <button
                      onClick={saveLicenseChanges}
                      disabled={!hasPendingChanges || savingLicenses}
                      className="flex-1 px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      {savingLicenses ? 'Saving…' : 'Save License Changes'}
                    </button>
                  </div>
                )}
              </>
            )}
          </Panel>

          {/* Estimated Bill */}
          <Panel title={`Estimated Bill${periodEnd ? ` — ${periodEnd}` : ''}`} badge={subscription?.subscriptionEndDate ? <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400">Due {nextBill}</span> : undefined}>
            {!estimate ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No billing estimate available</p>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                {deviceLines.length > 0 && <BillSection title="Device Licenses" lines={deviceLines} />}
                {apiLines.length > 0 && <BillSection title="API Calls" lines={apiLines} />}
                {txnLines.length > 0 && <BillSection title="Transactions" lines={txnLines} />}
                <div className="flex justify-between items-center pt-3 mt-2 border-t border-gray-300 dark:border-gray-600">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">Total Estimated</span>
                  <span className="text-xl font-extrabold text-gray-900 dark:text-white">${fmt(estimate.totalAmount)}</span>
                </div>
              </div>
            )}
          </Panel>
        </div>

        {/* ─── RIGHT COLUMN ─── */}
        <div className="flex flex-col gap-4">

          {/* "API Usage — This Month" panel removed: the unified
              "API Credits & Usage" panel rendered below the two-column grid
              now shows lifetime free-tier consumption (one-time grant per
              customer), this-month activity, the wallet balance, and the
              full ledger in one place. */}

          {/* Transactions */}
          <Panel title="Transactions — This Month" badge={txnFree > 0 ? <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400">First {txnFree} free</span> : undefined}>
            {txnLines.length === 0 && transactions.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No transactions this period</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-center">
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Total</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">{txnCount}</div>
                    <div className="text-[10px] text-gray-400">transactions</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
                    <div className="text-[10px] font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider mb-1">Free Tier</div>
                    <div className="text-xl font-bold text-green-600 dark:text-green-400">{txnFree}</div>
                    <div className="text-[10px] text-green-400">included</div>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-center">
                    <div className="text-[10px] font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider mb-1">Billable</div>
                    <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{txnBillable}</div>
                    <div className="text-[10px] text-gray-400">× ${fmt(txnLines[0]?.unitPrice ?? 0)} each</div>
                  </div>
                </div>
                {txnCount > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span className="text-green-500">{txnFree} free</span>
                      <span className="text-yellow-600">{txnBillable} billable</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: '100%', background: `linear-gradient(90deg, #86efac ${Math.round((txnFree / Math.max(txnCount, 1)) * 100)}%, #fde68a ${Math.round((txnFree / Math.max(txnCount, 1)) * 100)}%)` }} />
                    </div>
                  </div>
                )}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-2.5 flex justify-between items-center">
                  <span className="text-xs text-yellow-700 dark:text-yellow-400">Transactions total this month</span>
                  <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">${fmt(txnTotal)}</span>
                </div>
              </>
            )}

            {/* Per-day breakdown: one row per recorded date, matching the Invoice History layout */}
            {transactions.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Daily Details</span>
                  <span className="text-[10px] text-gray-400">{transactions.length} day{transactions.length === 1 ? '' : 's'}</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-64 overflow-y-auto">
                  {transactions.map((t, idx) => (
                    <div key={`${t.recordedDate}-${t.appId ?? 'n'}-${idx}`} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md flex items-center justify-center">
                          <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                            {new Date(t.recordedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            {t.appName ? <span className="ml-1 text-[10px] text-gray-400 font-normal">· {t.appName}</span> : null}
                          </div>
                          <div className="text-[10px] text-gray-400 flex gap-2">
                            <span>{t.count} txn{t.count === 1 ? '' : 's'}</span>
                            {t.freeUnits > 0 && <span className="text-green-600 dark:text-green-400">{t.freeUnits} free</span>}
                            {t.billableUnits > 0 && <span className="text-yellow-600 dark:text-yellow-400">{t.billableUnits} × ${fmt(t.unitPrice)}</span>}
                          </div>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold ${t.lineTotal > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400'}`}>
                        ${fmt(t.lineTotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          {/* Invoice History */}
          <Panel title="Invoice History">
            {invoices.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No invoices yet</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {invoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">{inv.invoiceNumber}</div>
                        <div className="text-[10px] text-gray-400">{new Date(inv.issuedAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${invoiceBadge(inv.status)}`}>
                        {InvoiceStatusLabel[inv.status] ?? 'Unknown'}
                      </span>
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">${fmt(inv.totalAmount)}</span>
                      <button
                        onClick={() => handleViewInvoice(inv)}
                        disabled={viewingInvoiceId === inv.id}
                        className="px-2 py-1 text-[10px] font-medium border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md disabled:opacity-50"
                        title={inv.hasStripeLink ? 'Open Stripe-hosted invoice' : 'View invoice details'}
                      >
                        {viewingInvoiceId === inv.id ? '...' : 'View'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* OpenAPI prepaid-credit wallet — full width below the existing two-column billing layout. */}
      <div className="mt-4">
        <ApiCreditsPanel
          pendingTopUpSessionId={pendingTopUpSessionId}
          onTopUpAcknowledged={() => setPendingTopUpSessionId(null)}
        />
      </div>

      {/* Confirm dialog for license removals */}
      {ConfirmDialog}

      {/* Change Plan Modal */}
      {showChangePlan && (
        <ChangePlanModal
          plans={plans}
          loadingPlans={loadingPlans}
          currentPlanId={subscription?.planId ?? null}
          changingPlan={changingPlan}
          confirmPlanId={confirmPlanId}
          onSelect={handleSelectPlan}
          onConfirm={handleConfirmChangePlan}
          onCancelConfirm={() => setConfirmPlanId(null)}
          onClose={() => { setShowChangePlan(false); setConfirmPlanId(null); }}
        />
      )}

      {/* Legacy invoice viewer (pre-Stripe invoices only) */}
      {legacyInvoice && (
        <LegacyInvoiceModal
          invoice={legacyInvoice}
          onClose={() => setLegacyInvoice(null)}
        />
      )}

      {/* Confirm-and-pay modal for license-change add-ons. Opens when the user
          clicks "Save License Changes" with billable additions queued. Confirm
          → Stripe Checkout redirect (license rows commit only on payment success). */}
      <LicenseChangesConfirmModal
        isOpen={showAddOnModal}
        lines={addOnPayload.lines}
        localTotal={addOnPayload.localTotal}
        nextRenewalLabel={cycleEndLabel || undefined}
        currentRecurringMonthly={currentRecurringMonthly}
        newRecurringMonthly={newRecurringMonthly}
        // CustomerSubscriptionDetail / EstimatedBill don't expose these yet — backend wiring TBD.
        cardLast4={null}
        currency={'usd'}
        serverTotal={serverPreviewTotal}
        serverPreviewLoading={serverPreviewLoading}
        onCancel={() => setShowAddOnModal(false)}
        onConfirm={handleConfirmAddOn}
        submitting={addOnSubmitting}
      />
    </div>
  );
};

// ─── Sub-components ───

// Device style map: icon, color, subtitle per app name keyword
const deviceStyleMap: Record<string, { icon: React.ReactNode; color: string; barColor: string; subtitle: string }> = {
  'web': {
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth={1.5}/><path d="M12 3c-3 3.5-3 14.5 0 18M12 3c3 3.5 3 14.5 0 18M3 12h18" strokeWidth={1.3}/></svg>,
    color: 'text-brand-500 bg-brand-50 dark:bg-brand-900/30',
    barColor: 'bg-brand-500',
    subtitle: 'Per email address',
  },
  'pos': {
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2" strokeWidth={1.5}/><path d="M8 16v3M16 16v3M7 19h10" strokeWidth={1.3}/></svg>,
    color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30',
    barColor: 'bg-purple-500',
    subtitle: 'Desktop checkout',
  },
  'picking': {
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="3" strokeWidth={1.5}/><path d="M9 6h6M9 10h6M9 14h4" strokeWidth={1.3} strokeLinecap="round"/></svg>,
    color: 'text-green-500 bg-green-50 dark:bg-green-900/30',
    barColor: 'bg-green-500',
    subtitle: 'Warehouse handhelds',
  },
  'price': {
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" strokeWidth={1.5}/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 1v2M12 21v2M1 12h2M21 12h2" strokeWidth={1.3}/></svg>,
    color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/30',
    barColor: 'bg-amber-500',
    subtitle: 'Customer kiosks',
  },
  'smartkart': {
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="13" rx="2" strokeWidth={1.5}/><path d="M7 16v3M17 16v3M6 19h12" strokeWidth={1.3}/><path d="M7 8h10M7 11h5" strokeWidth={1.2} strokeLinecap="round"/></svg>,
    color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/30',
    barColor: 'bg-orange-500',
    subtitle: 'Payment integration',
  },
  'back office': {
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5}/><path d="M3 9h18M9 21V9" strokeWidth={1.3}/></svg>,
    color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30',
    barColor: 'bg-indigo-500',
    subtitle: 'Admin dashboard',
  },
};

const getDeviceStyle = (description: string) => {
  const lower = description.toLowerCase();
  for (const [key, style] of Object.entries(deviceStyleMap)) {
    if (lower.includes(key)) return style;
  }
  return { icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={1.5}/></svg>, color: 'text-gray-500 bg-gray-100 dark:bg-gray-700', barColor: 'bg-gray-400', subtitle: 'Device' };
};

interface DeviceLicenseRowProps {
  line: EstimatedBillLine;
  canManage: boolean;
  effective: number;
  addDelta: number;
  removeDelta: number;
  prorationFactor: number;
  daysRemaining: number;
  cycleEndLabel: string;
  activeDevices?: number;
  inactiveDays?: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

const DeviceLicenseRow: React.FC<DeviceLicenseRowProps> = ({
  line, canManage, effective, addDelta, removeDelta, prorationFactor, daysRemaining, cycleEndLabel,
  activeDevices, inactiveDays, onIncrement, onDecrement,
}) => {
  const pct = line.quantity > 0 ? Math.min(100, Math.round((Number(line.billableUnits) / line.quantity) * 100)) : 0;
  const style = getDeviceStyle(line.description);
  const proratedAdd = addDelta * line.unitPrice * prorationFactor;
  const hasPending = addDelta > 0 || removeDelta > 0;
  const canDecrement = canManage && effective > 0;

  return (
    <div className="flex items-center gap-3 py-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${style.color}`}>
        {style.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">{line.description.replace(/ - \d+ (devices|users)$/, '')}</div>
        <div className="text-[10px] text-gray-400 dark:text-gray-500">{style.subtitle}</div>
        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mt-1.5 mb-1">
          <div className={`h-full rounded-full transition-all ${style.barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[10px] text-gray-400">
          {activeDevices !== undefined
            ? <>{activeDevices} of {line.quantity} in use{inactiveDays ? ` (${inactiveDays}d window)` : ''} · </>
            : <>{line.quantity} allocated · </>
          }
          {Number(line.billableUnits).toFixed(2)} billable · ${fmt(line.unitPrice)} each
        </div>
        {hasPending && (
          <div className="mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            {addDelta > 0 && <span>+{addDelta} new (prorated ${fmt(proratedAdd)} for {daysRemaining}d remaining). </span>}
            {removeDelta > 0 && <span>{removeDelta} removal{removeDelta > 1 ? 's' : ''} take effect {cycleEndLabel}.</span>}
          </div>
        )}
      </div>
      {canManage ? (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onDecrement}
            disabled={!canDecrement}
            aria-label="Remove device"
            className="w-7 h-7 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-sm font-bold leading-none"
          >−</button>
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200 w-6 text-center tabular-nums">{effective}</span>
          <button
            onClick={onIncrement}
            aria-label="Add device"
            className="w-7 h-7 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-sm font-bold leading-none"
          >+</button>
          <div className="text-right ml-1 min-w-[60px]">
            <div className="text-sm font-bold text-gray-800 dark:text-gray-200">${fmt(line.lineTotal)}</div>
          </div>
        </div>
      ) : (
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold text-gray-800 dark:text-gray-200">${fmt(line.lineTotal)}</div>
        </div>
      )}
    </div>
  );
};

const ApiUsageRow: React.FC<{ line: EstimatedBillLine }> = ({ line }) => {
  const total = line.quantity;
  const free = line.freeUnits;
  const billable = line.billableUnits;
  const freePct = total > 0 ? Math.round((free / total) * 100) : 0;

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">{line.description}</div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1.5 mb-1">
          <span>{total} calls</span>
          <span>{free} free · {billable} billable</span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: '100%', background: `linear-gradient(90deg, #bbf7d0 ${freePct}%, #0e7490 ${freePct}%)` }} />
        </div>
        {free > 0 && <div className="inline-flex items-center gap-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2">✓ {free} free included</div>}
      </div>
      <div className="text-right flex-shrink-0 min-w-[70px]">
        <div className="text-sm font-bold text-gray-800 dark:text-gray-200">${fmt(line.lineTotal)}</div>
        <div className="text-[10px] text-gray-400">{billable} × ${fmt(line.unitPrice)}</div>
      </div>
    </div>
  );
};

const BillSection: React.FC<{ title: string; lines: EstimatedBillLine[] }> = ({ title, lines }) => (
  <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700 last:border-0 last:mb-0 last:pb-0">
    <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{title}</div>
    {lines.map((l, i) => {
      const units = Number(l.billableUnits);
      const unitsLabel = l.category === 'device_license' && units % 1 !== 0 ? units.toFixed(2) : Math.round(units).toString();
      return (
        <div key={i} className="flex justify-between text-xs py-0.5">
          <span className="text-gray-600 dark:text-gray-400">{l.description} ({unitsLabel} × ${fmt(l.unitPrice)})</span>
          <span className="font-semibold text-gray-800 dark:text-gray-200">${fmt(l.lineTotal)}</span>
        </div>
      );
    })}
  </div>
);

// Plan card color schemes by tier index
const tierColors = [
  { price: 'text-gray-500', btn: 'bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600', label: 'Downgrade' },
  { price: 'text-purple-600 dark:text-purple-400', btn: '', label: '' },
  { price: 'text-brand-600 dark:text-brand-400', btn: 'bg-brand-600 hover:bg-brand-700 text-white', label: 'Upgrade', badge: 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800', badgeText: 'Most popular' },
  { price: 'text-orange-600 dark:text-orange-400', btn: 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 text-orange-600 dark:text-orange-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/40', label: 'Contact Sales' },
];

const ChangePlanModal: React.FC<{
  plans: PlanDetail[];
  loadingPlans: boolean;
  currentPlanId: number | null;
  changingPlan: boolean;
  confirmPlanId: number | null;
  onSelect: (planId: number) => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
  onClose: () => void;
}> = ({ plans, loadingPlans, currentPlanId, changingPlan, confirmPlanId, onSelect, onConfirm, onCancelConfirm, onClose }) => {
  const activePlans = plans.filter(p => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const currentPrice = activePlans.find(p => p.id === currentPlanId)?.price ?? 0;

  // Proration preview for the confirm step. For a tenant that ALREADY has a
  // Stripe subscription (currentPlanId != null), confirming a plan change calls
  // the ChangePlan API, which charges/credits the prorated difference to the
  // card on file IMMEDIATELY and silently — no Stripe Checkout page. Users were
  // confused that an upgrade "didn't ask for payment". Surfacing the upcoming-
  // invoice amount here makes the charge explicit so they consent before we hit
  // their card. First-time subscribe (currentPlanId == null) goes through Stripe
  // Checkout, which shows its own payment page, so we skip the preview there.
  type PlanChangePreview = {
    amountDueNow: number;
    nextCycleAmount: number;
    nextBillingDate: string | null;
    currency: string;
  };
  const [preview, setPreview] = useState<PlanChangePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (confirmPlanId == null || currentPlanId == null) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreview(null);
    setPreviewLoading(true);
    billingService
      .previewPlanChange(confirmPlanId)
      .then(res => {
        if (cancelled) return;
        if (res.data.isSuccess && res.data.response) setPreview(res.data.response);
      })
      .catch(() => { /* leave preview null → fallback copy shown */ })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [confirmPlanId, currentPlanId]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10 px-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-[900px] mb-10 shadow-2xl">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-t-2xl">
          <span className="text-sm font-bold text-gray-900 dark:text-white">Change Plan</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">✕</button>
        </div>
        <div className="p-5">
          {loadingPlans ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                  <Skeleton className="h-5 w-20 mb-2" /><Skeleton className="h-3 w-16 mb-4" />
                  <Skeleton className="h-8 w-28 mb-4" /><Skeleton className="h-3 w-full mb-1.5" />
                  <Skeleton className="h-3 w-3/4 mb-1.5" /><Skeleton className="h-3 w-2/3 mb-4" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : activePlans.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No plans available</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {activePlans.map((plan, idx) => {
                const isCurrent = plan.id === currentPlanId;
                const colors = tierColors[Math.min(idx, tierColors.length - 1)];
                const isUpgrade = plan.price > currentPrice;

                return (
                  <div
                    key={plan.id}
                    className={`rounded-xl p-5 transition-all flex flex-col ${
                      isCurrent
                        ? 'border-2 border-green-500 bg-green-50 dark:bg-green-900/15'
                        : 'border-[1.5px] border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 hover:border-brand-300 dark:hover:border-brand-700'
                    }`}
                  >
                    {/* Badge */}
                    {isCurrent && (
                      <div className="inline-block bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-[10px] font-semibold px-2.5 py-0.5 rounded mb-2">
                        Current plan
                      </div>
                    )}
                    {!isCurrent && colors.badge && (
                      <div className={`inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded mb-2 ${colors.badge}`}>
                        {colors.badgeText}
                      </div>
                    )}

                    {/* Plan name & description */}
                    <div className="text-sm font-bold text-gray-900 dark:text-white">{plan.name}</div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {plan.description || (plan.tier != null ? PlanTierLabel[plan.tier] : '')}
                    </div>

                    {/* Price */}
                    <div className={`text-[22px] font-extrabold my-2.5 ${colors.price}`}>
                      ${fmt(plan.price)}
                      <span className="text-[13px] font-normal text-gray-400">
                        /{BillingCycleLabel[plan.billingCycle] === 'Yearly' ? 'yr' : 'mo'}
                      </span>
                    </div>

                    {/* Plan includes — compact summary */}
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-[1.9] mb-4 flex-1">
                      {/* App pricings as one compact line: "10 web · 5 POS · 8 picking" */}
                      {plan.appPricings && plan.appPricings.filter(a => a.isIncluded).length > 0 && (
                        <div><span className="text-green-500 mr-1">✓</span>
                          {plan.appPricings.filter(a => a.isIncluded).map(a => `${a.maxUnits ?? '∞'} ${a.appName.toLowerCase()}`).join(' · ')}
                        </div>
                      )}
                      {/* API access as one line */}
                      {plan.apiPricings && plan.apiPricings.filter(a => a.isIncluded).length > 0 && (
                        <div><span className="text-green-500 mr-1">✓</span>API access included</div>
                      )}
                      {/* Enabled features */}
                      {plan.features && plan.features.filter(f => f.isEnabled).slice(0, 3).map((f, i) => (
                        <div key={`f-${i}`}><span className="text-green-500 mr-1">✓</span>{f.featureName}</div>
                      ))}
                      {/* Disabled features */}
                      {plan.features && plan.features.filter(f => !f.isEnabled).slice(0, 1).map((f, i) => (
                        <div key={`nf-${i}`}><span className="text-gray-300 dark:text-gray-600 mr-1">✗</span>{f.featureName}</div>
                      ))}
                      {(!plan.appPricings || plan.appPricings.length === 0) && (!plan.apiPricings || plan.apiPricings.length === 0) && (!plan.features || plan.features.length === 0) && (
                        <div className="text-gray-400 italic">Contact us for details</div>
                      )}
                    </div>

                    {/* Action button — pinned to bottom */}
                    {confirmPlanId === plan.id ? (
                      <div className="mt-auto space-y-1.5">
                        {/* Charge preview — only for existing subscriptions, where the
                            change bills the card on file immediately (no Checkout page). */}
                        {currentPlanId != null && (
                          <div className="text-[10px] text-center leading-snug rounded px-2 py-1.5 bg-brand-50 dark:bg-brand-900/20 text-gray-600 dark:text-gray-300">
                            {previewLoading ? (
                              'Calculating charge…'
                            ) : preview ? (
                              <>
                                {preview.amountDueNow > 0 ? (
                                  <span>You'll be charged <strong>${fmt(preview.amountDueNow)}</strong> now (prorated).</span>
                                ) : preview.amountDueNow < 0 ? (
                                  <span>A <strong>${fmt(Math.abs(preview.amountDueNow))}</strong> credit applies to your next invoice.</span>
                                ) : (
                                  <span>No charge today.</span>
                                )}
                                {preview.nextBillingDate && (
                                  <span className="block text-gray-400 mt-0.5">
                                    Then ${fmt(preview.nextCycleAmount)}/mo from {new Date(preview.nextBillingDate).toLocaleDateString()}.
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400">Prorated difference will be charged to your card on file.</span>
                            )}
                          </div>
                        )}
                        <div className="text-[10px] text-center text-gray-500 dark:text-gray-400">Switch to <strong>{plan.name}</strong>?</div>
                        <div className="flex gap-2">
                          <button onClick={onCancelConfirm} className="flex-1 py-2 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200">Cancel</button>
                          <button onClick={onConfirm} disabled={changingPlan || previewLoading} className="flex-1 py-2 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50">
                            {changingPlan
                              ? 'Changing...'
                              : currentPlanId != null && preview && preview.amountDueNow > 0
                                ? `Pay $${fmt(preview.amountDueNow)} & switch`
                                : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => !isCurrent && !changingPlan && onSelect(plan.id)}
                        disabled={isCurrent || changingPlan}
                        className={`w-full py-2.5 rounded-lg text-xs font-semibold transition-colors mt-auto ${
                          isCurrent
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50'
                            : isUpgrade
                              ? 'bg-brand-600 hover:bg-brand-700 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {isCurrent ? 'Current' : isUpgrade ? 'Upgrade' : 'Downgrade'}
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Enterprise card */}
              <div className="rounded-xl p-5 border-[1.5px] border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col">
                <div className="text-sm font-bold text-gray-900 dark:text-white">Enterprise</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Unlimited scale</div>
                <div className="text-[22px] font-extrabold my-2.5 text-orange-600 dark:text-orange-400">Custom</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-[1.9] mb-4 flex-1">
                  <div><span className="text-green-500 mr-1">✓</span>Unlimited everything</div>
                  <div><span className="text-green-500 mr-1">✓</span>Dedicated support</div>
                  <div><span className="text-green-500 mr-1">✓</span>Unlimited stores</div>
                </div>
                <button
                  onClick={() => window.open('mailto:sales@rdt.com?subject=Enterprise Plan Inquiry', '_blank')}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold transition-colors bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 text-orange-600 dark:text-orange-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 mt-auto"
                >
                  Contact Sales
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LicensesAndBillingPage;
