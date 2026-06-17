import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { billingService } from '../../services/billingService';
import { permissionService } from '../../services/permissionService';
import { useConfirm } from '../../components/ui/ConfirmModal';
import type {
  CustomerSubscriptionDetail,
  InvoiceSummary,
  InvoiceDetail,
  EstimatedBill,
  PlanAppPricing,
  PlanApiPricing,
  CustomerAppOverride,
  CustomerApiOverride,
} from '../../types/billing';
import LegacyInvoiceModal from '../../components/billing/LegacyInvoiceModal';
import {
  SubscriptionStatus,
  InvoiceStatus,
  SubscriptionStatusLabel,
  InvoiceStatusLabel,
  PlanTierLabel,
  BillingCycleLabel,
} from '../../types/billing';
import type { Plan } from '../../types/permission';

// ─── Helpers ───

const statusBadge = (status: SubscriptionStatus) => {
  if (status === SubscriptionStatus.Active)
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (status === SubscriptionStatus.PastDue)
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  if (status === SubscriptionStatus.Suspended)
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (status === SubscriptionStatus.Trial)
    return 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
};

const invoiceStatusBadge = (status: InvoiceStatus) => {
  if (status === InvoiceStatus.Paid)
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (status === InvoiceStatus.Issued || status === InvoiceStatus.Draft)
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  if (status === InvoiceStatus.PastDue)
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
};

const SkeletonRow: React.FC<{ cols: number }> = ({ cols }) => (
  <tr className="animate-pulse">
    {[...Array(cols)].map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
      </td>
    ))}
  </tr>
);

// ─── App Override Modal Form ───

interface AppOverrideFormData {
  appId: number;
  appName: string;
  priceOverride: string;
  deviceLimitOverride: string;
  freeTierOverride: string;
  isEnabled: boolean;
}

// ─── API Override Modal Form ───

interface ApiOverrideFormData {
  apiDefinitionId: number;
  apiName: string;
  rateOverride: string;
  freeTierOverride: string;
  maxCallsOverride: string;
  isEnabled: boolean;
}

const CustomerBillingPage: React.FC = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const { customerId: customerIdParam } = useParams<{ customerId: string }>();
  const customerId = Number(customerIdParam);
  const navigate = useNavigate();

  // ─── State ───
  const [subscription, setSubscription] = useState<CustomerSubscriptionDetail | null>(null);
  const [appPricings, setAppPricings] = useState<PlanAppPricing[]>([]);
  const [apiPricings, setApiPricings] = useState<PlanApiPricing[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [estimate, setEstimate] = useState<EstimatedBill | null>(null);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ─── App Override Modal ───
  const [showAppOverrideModal, setShowAppOverrideModal] = useState(false);
  const [appOverrideForm, setAppOverrideForm] = useState<AppOverrideFormData | null>(null);
  const [appOverrideSaving, setAppOverrideSaving] = useState(false);

  // ─── API Override Modal ───
  const [showApiOverrideModal, setShowApiOverrideModal] = useState(false);
  const [apiOverrideForm, setApiOverrideForm] = useState<ApiOverrideFormData | null>(null);
  const [apiOverrideSaving, setApiOverrideSaving] = useState(false);

  // ─── Change Plan Modal ───
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [changePlanNotes, setChangePlanNotes] = useState('');
  const [changePlanSaving, setChangePlanSaving] = useState(false);
  const [prorationBehavior, setProrationBehavior] = useState<'create_prorations' | 'none' | 'always_invoice'>('create_prorations');
  const [planChangePreview, setPlanChangePreview] = useState<{ amountDueNow: number; nextCycleAmount: number; nextBillingDate: string | null; currency: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // ─── Phase 6: Admin Stripe Subscription view + actions ───
  type AdminSubDetail = Awaited<ReturnType<typeof billingService.adminGetSubscriptionDetail>>['data']['response'];
  const [adminSub, setAdminSub] = useState<AdminSubDetail | null>(null);
  const [adminActing, setAdminActing] = useState(false);

  // ─── Invoice viewer state ───
  const [legacyInvoice, setLegacyInvoice] = useState<InvoiceDetail | null>(null);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<number | null>(null);
  const [syncingInvoices, setSyncingInvoices] = useState(false);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ─── Load All Data ───

  // Load admin Stripe detail (separate from main loadData so it can refresh independently after actions).
  const loadAdminSub = useCallback(async () => {
    if (!customerId || isNaN(customerId)) return;
    try {
      const res = await billingService.adminGetSubscriptionDetail(customerId);
      if (res.data.isSuccess) setAdminSub(res.data.response);
    } catch {
      // non-fatal — admin Stripe view is informational
    }
  }, [customerId]);

  const loadData = useCallback(async () => {
    if (!customerId || isNaN(customerId)) return;
    setLoading(true);
    try {
      const [subRes, invRes, estRes] = await Promise.allSettled([
        billingService.getSubscription(customerId),
        billingService.getCustomerInvoices(customerId),
        billingService.getEstimatedBill(customerId),
      ]);

      if (subRes.status === 'fulfilled' && subRes.value.data.isSuccess) {
        const sub = subRes.value.data.response;
        setSubscription(sub);

        // Load plan detail for app/api pricings
        if (sub.planId) {
          try {
            const planRes = await billingService.getPlanDetail(sub.planId);
            if (planRes.data.isSuccess) {
              setAppPricings(planRes.data.response.appPricings || []);
              setApiPricings(planRes.data.response.apiPricings || []);
            }
          } catch {
            // non-critical
          }
        }
      }

      if (invRes.status === 'fulfilled' && invRes.value.data.isSuccess) {
        setInvoices(invRes.value.data.response);
      }

      if (estRes.status === 'fulfilled' && estRes.value.data.isSuccess) {
        setEstimate(estRes.value.data.response);
      }
    } catch {
      setToast({ message: 'Failed to load customer billing data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadData();
    loadAdminSub();
  }, [loadData, loadAdminSub]);

  // ─── Phase 6: Admin Stripe Actions ───

  const refreshAfterAdmin = async () => {
    await Promise.all([loadData(), loadAdminSub()]);
  };

  const handleAdminPause = async () => {
    if (!adminSub?.stripeSubscriptionId) return;
    const ok = await confirm({
      title: 'Pause Stripe billing?',
      message: 'Stripe will stop generating invoices for this tenant until you resume. Service continues; no charges happen during the pause.',
      variant: 'warning',
    });
    if (!ok) return;
    setAdminActing(true);
    try {
      const res = await billingService.adminPause(customerId);
      if (res.data.isSuccess) {
        setToast({ message: 'Stripe billing paused', type: 'success' });
        await refreshAfterAdmin();
      } else {
        setToast({ message: res.data.message || 'Failed to pause', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to pause Stripe billing', type: 'error' });
    } finally {
      setAdminActing(false);
    }
  };

  const handleAdminResume = async () => {
    if (!adminSub?.stripeSubscriptionId) return;
    setAdminActing(true);
    try {
      const res = await billingService.adminResume(customerId);
      if (res.data.isSuccess) {
        setToast({ message: 'Stripe billing resumed', type: 'success' });
        await refreshAfterAdmin();
      } else {
        setToast({ message: res.data.message || 'Failed to resume', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to resume Stripe billing', type: 'error' });
    } finally {
      setAdminActing(false);
    }
  };

  const handleAdminCancel = async (immediately: boolean) => {
    if (!adminSub?.stripeSubscriptionId) return;
    const ok = await confirm({
      title: immediately ? 'Cancel immediately?' : 'Cancel at period end?',
      message: immediately
        ? `Subscription will end NOW. Stripe will prorate and refund unused time. This cannot be undone via this UI (customer must resubscribe).`
        : `Subscription will continue until ${adminSub.currentPeriodEnd ? new Date(adminSub.currentPeriodEnd).toLocaleDateString() : 'period end'}, then stop auto-renewing. You can undo this with Reactivate.`,
      variant: 'danger',
    });
    if (!ok) return;
    setAdminActing(true);
    try {
      const res = await billingService.adminCancel(customerId, immediately);
      if (res.data.isSuccess) {
        setToast({ message: immediately ? 'Subscription canceled immediately' : 'Subscription will cancel at period end', type: 'success' });
        await refreshAfterAdmin();
      } else {
        setToast({ message: res.data.message || 'Failed to cancel', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to cancel subscription', type: 'error' });
    } finally {
      setAdminActing(false);
    }
  };

  const handleAdminReactivateStripe = async () => {
    if (!adminSub?.stripeSubscriptionId) return;
    setAdminActing(true);
    try {
      const res = await billingService.adminReactivate(customerId);
      if (res.data.isSuccess) {
        setToast({ message: 'Subscription reactivated', type: 'success' });
        await refreshAfterAdmin();
      } else {
        setToast({ message: res.data.message || 'Failed to reactivate', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to reactivate', type: 'error' });
    } finally {
      setAdminActing(false);
    }
  };

  const handleAdminSyncFromStripe = async () => {
    setAdminActing(true);
    try {
      const res = await billingService.adminSyncFromStripe(customerId);
      if (res.data.isSuccess) {
        setToast({ message: 'Synced from Stripe', type: 'success' });
        await refreshAfterAdmin();
      } else {
        setToast({ message: res.data.message || 'Sync failed', type: 'error' });
      }
    } catch {
      setToast({ message: 'Sync failed', type: 'error' });
    } finally {
      setAdminActing(false);
    }
  };

  // ─── Subscription Actions ───

  const handleSuspend = async () => {
    const ok = await confirm({
      title: 'Suspend Customer',
      message: `Are you sure you want to suspend this customer? They will lose access to all services until reactivated.`,
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await billingService.suspendCustomer(customerId, 'Suspended by admin');
      setToast({ message: 'Customer suspended', type: 'success' });
      loadData();
    } catch {
      setToast({ message: 'Suspend failed', type: 'error' });
    }
  };

  const handleReactivate = async () => {
    const ok = await confirm({
      title: 'Reactivate Customer',
      message: `Are you sure you want to reactivate this customer? Their subscription will be restored.`,
      variant: 'info',
    });
    if (!ok) return;
    try {
      await billingService.reactivateCustomer(customerId);
      setToast({ message: 'Customer reactivated', type: 'success' });
      loadData();
    } catch {
      setToast({ message: 'Reactivate failed', type: 'error' });
    }
  };

  // ─── Change Plan ───

  const openChangePlanModal = async () => {
    setShowChangePlanModal(true);
    setSelectedPlanId(null);
    setChangePlanNotes('');
    setLoadingPlans(true);
    try {
      const res = await permissionService.getPlans({ startRow: 0, endRow: 100, sortColumn: 'Name', sortDirection: 'asc' });
      if (res.data.isSuccess) {
        setAvailablePlans(res.data.response.data.filter((p: Plan) => p.isActive));
      }
    } catch {
      setToast({ message: 'Failed to load plans', type: 'error' });
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleChangePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;
    setChangePlanSaving(true);
    try {
      // Phase 6: use Stripe-aware admin endpoint with proration choice.
      // The admin service handles both cases: Stripe sub exists → subscriptions.update,
      // no Stripe sub → direct DB update with a warning message in the response.
      const res = await billingService.adminChangePlan(customerId, {
        newPlanId: selectedPlanId,
        prorationBehavior,
        notes: changePlanNotes || undefined,
      });
      if (res.data.isSuccess) {
        setToast({ message: res.data.message || 'Plan changed', type: 'success' });
        setShowChangePlanModal(false);
        setPlanChangePreview(null);
        await refreshAfterAdmin();
      } else {
        setToast({ message: res.data.message || 'Failed to change plan', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to change plan', type: 'error' });
    } finally {
      setChangePlanSaving(false);
    }
  };

  // Fetch a live preview from Stripe whenever the admin picks a plan in the modal.
  useEffect(() => {
    if (!showChangePlanModal || !selectedPlanId || !adminSub?.stripeSubscriptionId) {
      setPlanChangePreview(null);
      return;
    }
    let cancelled = false;
    setPreviewing(true);
    billingService.adminPreviewPlanChange(customerId, selectedPlanId)
      .then(res => { if (!cancelled && res.data.isSuccess) setPlanChangePreview(res.data.response); })
      .catch(() => { /* ignore — preview is best-effort */ })
      .finally(() => { if (!cancelled) setPreviewing(false); });
    return () => { cancelled = true; };
  }, [showChangePlanModal, selectedPlanId, prorationBehavior, customerId, adminSub?.stripeSubscriptionId]);

  // ─── App Override ───

  const openAppOverrideModal = (ap: PlanAppPricing) => {
    setAppOverrideForm({
      appId: ap.appId,
      appName: ap.appName,
      priceOverride: '',
      deviceLimitOverride: '',
      freeTierOverride: '',
      isEnabled: ap.isIncluded,
    });
    setShowAppOverrideModal(true);
  };

  const handleAppOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appOverrideForm) return;
    setAppOverrideSaving(true);
    try {
      const dto: CustomerAppOverride = {
        customerId,
        appId: appOverrideForm.appId,
        priceOverride: appOverrideForm.priceOverride ? Number(appOverrideForm.priceOverride) : null,
        deviceLimitOverride: appOverrideForm.deviceLimitOverride ? Number(appOverrideForm.deviceLimitOverride) : null,
        freeTierOverride: appOverrideForm.freeTierOverride ? Number(appOverrideForm.freeTierOverride) : null,
        isEnabled: appOverrideForm.isEnabled,
      };
      await billingService.applyAppOverride(dto);
      setToast({ message: 'App override applied', type: 'success' });
      setShowAppOverrideModal(false);
      loadData();
    } catch {
      setToast({ message: 'Override failed', type: 'error' });
    } finally {
      setAppOverrideSaving(false);
    }
  };

  // ─── API Override ───

  const openApiOverrideModal = (ap: PlanApiPricing) => {
    setApiOverrideForm({
      apiDefinitionId: ap.apiDefinitionId,
      apiName: ap.apiName,
      rateOverride: '',
      freeTierOverride: '',
      maxCallsOverride: '',
      isEnabled: ap.isIncluded,
    });
    setShowApiOverrideModal(true);
  };

  const handleApiOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiOverrideForm) return;
    setApiOverrideSaving(true);
    try {
      const dto: CustomerApiOverride = {
        customerId,
        apiDefinitionId: apiOverrideForm.apiDefinitionId,
        rateOverride: apiOverrideForm.rateOverride ? Number(apiOverrideForm.rateOverride) : null,
        freeTierOverride: apiOverrideForm.freeTierOverride ? Number(apiOverrideForm.freeTierOverride) : null,
        maxCallsOverride: apiOverrideForm.maxCallsOverride ? Number(apiOverrideForm.maxCallsOverride) : null,
        isEnabled: apiOverrideForm.isEnabled,
      };
      await billingService.applyApiOverride(dto);
      setToast({ message: 'API override applied', type: 'success' });
      setShowApiOverrideModal(false);
      loadData();
    } catch {
      setToast({ message: 'Override failed', type: 'error' });
    } finally {
      setApiOverrideSaving(false);
    }
  };

  // ─── Invoice Actions ───

  const handleMarkPaid = async (invoiceId: number) => {
    const ok = await confirm({
      title: 'Mark Invoice as Paid',
      message: 'Are you sure you want to mark this invoice as paid? This will update the billing records.',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      await billingService.markInvoicePaid(invoiceId);
      setToast({ message: 'Invoice marked as paid', type: 'success' });
      loadData();
    } catch {
      setToast({ message: 'Operation failed', type: 'error' });
    }
  };

  // Open Stripe-hosted invoice in a new tab, or the legacy modal for pre-Stripe invoices.
  const handleViewInvoice = async (inv: InvoiceSummary) => {
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
  };

  // Backfill historical Stripe invoices into our DB so HostedInvoiceUrl/PdfUrl populate.
  const handleSyncInvoices = async () => {
    setSyncingInvoices(true);
    try {
      const res = await billingService.adminSyncInvoices(customerId);
      if (res.data.isSuccess) {
        setToast({ message: `Synced ${res.data.response ?? 0} invoice(s) from Stripe`, type: 'success' });
        loadData();
      } else {
        setToast({ message: res.data.message || 'Sync failed', type: 'error' });
      }
    } catch {
      setToast({ message: 'Sync failed', type: 'error' });
    } finally {
      setSyncingInvoices(false);
    }
  };


  // ─── Shared CSS classes ───
  const sectionHeading = 'text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3';
  const card = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg';
  const tableHead = 'bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700';
  const th = 'px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300';
  const thCenter = 'px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300';
  const thRight = 'px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300';
  const td = 'px-4 py-3 text-gray-600 dark:text-gray-400';
  const tdMed = 'px-4 py-3 font-medium text-gray-800 dark:text-gray-200';

  if (!customerId || isNaN(customerId)) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        Invalid customer ID
      </div>
    );
  }

  return (
    <div>
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* ═══════════════════ Header ═══════════════════ */}

      <div className="mb-6">
        <button
          onClick={() => navigate('/super-admin/billing-overview')}
          className="text-sm text-brand-500 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 mb-2 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Billing Overview
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {loading ? 'Loading...' : subscription?.customerName || `Customer #${customerId}`}
          </h1>
          {subscription && (
            <>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {subscription.planName} {subscription.planTier != null ? `(${PlanTierLabel[subscription.planTier] ?? 'Unknown'})` : ''}
              </span>
              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusBadge(subscription.subscriptionStatus)}`}>
                {SubscriptionStatusLabel[subscription.subscriptionStatus] ?? 'Unknown'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════ 1. Subscription Info Card ═══════════════════ */}

      <div className={`${card} p-5 mb-6`}>
        <h2 className={sectionHeading}>Subscription Info</h2>
        {loading ? (
          <div className="animate-pulse space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            ))}
          </div>
        ) : subscription ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Plan:</span>{' '}
              <span className="font-medium text-gray-800 dark:text-gray-200">{subscription.planName}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Tier:</span>{' '}
              <span className="font-medium text-gray-800 dark:text-gray-200">{subscription.planTier != null ? (PlanTierLabel[subscription.planTier] ?? 'Unknown') : '—'}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Status:</span>{' '}
              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusBadge(subscription.subscriptionStatus)}`}>
                {SubscriptionStatusLabel[subscription.subscriptionStatus] ?? 'Unknown'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Start Date:</span>{' '}
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {subscription.subscriptionStartDate ? new Date(subscription.subscriptionStartDate).toLocaleDateString() : '—'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">End Date:</span>{' '}
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {subscription.subscriptionEndDate ? new Date(subscription.subscriptionEndDate).toLocaleDateString() : '—'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Billing Cycle:</span>{' '}
              <span className="font-medium text-gray-800 dark:text-gray-200">{subscription.billingCycleMonths} month(s)</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Monthly Amount:</span>{' '}
              <span className="font-medium text-gray-800 dark:text-gray-200">${subscription.monthlyAmount.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Payment:</span>{' '}
              {subscription.isPaid ? (
                <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                  Paid
                </span>
              ) : (
                <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800">
                  Unpaid
                </span>
              )}
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Last Payment:</span>{' '}
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {subscription.lastPaymentAt ? new Date(subscription.lastPaymentAt).toLocaleString() : '—'}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No subscription data available</p>
        )}

        {subscription && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={openChangePlanModal}
              className="px-3 py-1.5 text-xs bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors"
            >
              Change Plan
            </button>
            {subscription.subscriptionStatus !== SubscriptionStatus.Suspended ? (
              <button
                onClick={handleSuspend}
                className="px-3 py-1.5 text-xs border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg font-medium transition-colors"
              >
                Suspend (local)
              </button>
            ) : (
              <button
                onClick={handleReactivate}
                className="px-3 py-1.5 text-xs border border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg font-medium transition-colors"
              >
                Reactivate (local)
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════ 1b. Stripe Subscription (Phase 6) ═══════════════════ */}

      {adminSub && (
        <div className={`${card} mb-6 p-4`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Stripe Subscription</h2>
            <button
              onClick={handleAdminSyncFromStripe}
              disabled={adminActing}
              title="Force-refresh from Stripe (debugging)"
              className="px-3 py-1 text-[11px] border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md font-medium transition-colors disabled:opacity-50"
            >
              Sync from Stripe
            </button>
          </div>

          {!adminSub.stripeSubscriptionId ? (
            <div className="text-xs p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300">
              This customer has no Stripe subscription. Plan changes here update local DB only.
              For recurring billing, the customer needs to subscribe via their own Licenses &amp; Billing page.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Stripe Sub ID:</span>{' '}
                  <a
                    href={`https://dashboard.stripe.com/test/subscriptions/${adminSub.stripeSubscriptionId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="font-mono text-xs text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    {adminSub.stripeSubscriptionId}
                  </a>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Stripe Status:</span>{' '}
                  <span className="font-medium text-gray-800 dark:text-gray-200">{adminSub.stripeStatus ?? '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Current Period:</span>{' '}
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {adminSub.currentPeriodStart ? new Date(adminSub.currentPeriodStart).toLocaleDateString() : '—'} → {adminSub.currentPeriodEnd ? new Date(adminSub.currentPeriodEnd).toLocaleDateString() : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Auto-renew:</span>{' '}
                  {adminSub.cancelAtPeriodEnd
                    ? <span className="font-medium text-red-600 dark:text-red-400">Will cancel at period end</span>
                    : adminSub.pauseCollectionBehavior
                      ? <span className="font-medium text-yellow-600 dark:text-yellow-400">Paused ({adminSub.pauseCollectionBehavior})</span>
                      : <span className="font-medium text-green-600 dark:text-green-400">On</span>}
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Card:</span>{' '}
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {adminSub.defaultPaymentMethodBrand && adminSub.defaultPaymentMethodLast4
                      ? `${adminSub.defaultPaymentMethodBrand} •••• ${adminSub.defaultPaymentMethodLast4}`
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Last Payment:</span>{' '}
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {adminSub.lastPaymentAt ? new Date(adminSub.lastPaymentAt).toLocaleString() : '—'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                {adminSub.pauseCollectionBehavior ? (
                  <button
                    onClick={handleAdminResume}
                    disabled={adminActing}
                    className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    Resume Billing
                  </button>
                ) : (
                  <button
                    onClick={handleAdminPause}
                    disabled={adminActing || adminSub.cancelAtPeriodEnd}
                    className="px-3 py-1.5 text-xs border border-yellow-300 dark:border-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    Pause Billing
                  </button>
                )}

                {adminSub.cancelAtPeriodEnd ? (
                  <button
                    onClick={handleAdminReactivateStripe}
                    disabled={adminActing}
                    className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    Reactivate (undo cancel)
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleAdminCancel(false)}
                      disabled={adminActing}
                      className="px-3 py-1.5 text-xs border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      Cancel at period end
                    </button>
                    <button
                      onClick={() => handleAdminCancel(true)}
                      disabled={adminActing}
                      className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      Cancel immediately
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════ 2. App Overrides Table ═══════════════════ */}

      <div className="mb-6">
        <h2 className={sectionHeading}>App Pricing Overrides</h2>
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className={th}>App</th>
                  <th className={thRight}>Plan Price</th>
                  <th className={thRight}>Override Price</th>
                  <th className={thCenter}>Plan Limit</th>
                  <th className={thCenter}>Override Limit</th>
                  <th className={thCenter}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  [...Array(3)].map((_, i) => <SkeletonRow key={i} cols={6} />)
                ) : appPricings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No app pricings configured for this plan
                    </td>
                  </tr>
                ) : (
                  appPricings.map((ap) => (
                    <tr key={ap.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className={tdMed}>{ap.appName}</td>
                      <td className={`${td} text-right`}>${ap.pricePerUnit.toFixed(2)}</td>
                      <td className={`${td} text-right`}>—</td>
                      <td className={`${td} text-center`}>{ap.maxUnits ?? 'Unlimited'}</td>
                      <td className={`${td} text-center`}>—</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openAppOverrideModal(ap)}
                          className="text-brand-500 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                          title="Apply Override"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══════════════════ 3. API Overrides Table ═══════════════════ */}

      <div className="mb-6">
        <h2 className={sectionHeading}>API Pricing Overrides</h2>
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className={th}>API</th>
                  <th className={thRight}>Plan Rate</th>
                  <th className={thRight}>Override Rate</th>
                  <th className={thCenter}>Plan Free Tier</th>
                  <th className={thCenter}>Override Free Tier</th>
                  <th className={thCenter}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  [...Array(3)].map((_, i) => <SkeletonRow key={i} cols={6} />)
                ) : apiPricings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No API pricings configured for this plan
                    </td>
                  </tr>
                ) : (
                  apiPricings.map((ap) => (
                    <tr key={ap.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className={tdMed}>{ap.apiName}</td>
                      <td className={`${td} text-right`}>${ap.ratePerCall.toFixed(4)}</td>
                      <td className={`${td} text-right`}>—</td>
                      <td className={`${td} text-center`}>{ap.freeTierCalls.toLocaleString()}</td>
                      <td className={`${td} text-center`}>—</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openApiOverrideModal(ap)}
                          className="text-brand-500 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                          title="Apply Override"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══════════════════ 4. Invoices Table ═══════════════════ */}

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className={`${sectionHeading} mb-0`}>Invoices</h2>
          {invoices.length > 0 && (
            <button
              onClick={handleSyncInvoices}
              disabled={syncingInvoices}
              className="px-3 py-1.5 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800 dark:hover:bg-indigo-900/50 rounded-lg disabled:opacity-50"
              title="Backfill historical Stripe invoices into the local DB"
            >
              {syncingInvoices ? 'Syncing...' : 'Sync Invoices from Stripe'}
            </button>
          )}
        </div>
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHead}>
                  <th className={th}>Invoice #</th>
                  <th className={th}>Period</th>
                  <th className={thRight}>Amount</th>
                  <th className={thCenter}>Status</th>
                  <th className={th}>Paid At</th>
                  <th className={thCenter}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  [...Array(3)].map((_, i) => <SkeletonRow key={i} cols={6} />)
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No invoices found
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className={tdMed}>{inv.invoiceNumber}</td>
                      <td className={td}>
                        {new Date(inv.billingPeriodStart).toLocaleDateString()} - {new Date(inv.billingPeriodEnd).toLocaleDateString()}
                      </td>
                      <td className={`${td} text-right`}>${inv.totalAmount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${invoiceStatusBadge(inv.status)}`}>
                          {InvoiceStatusLabel[inv.status] ?? 'Unknown'}
                        </span>
                      </td>
                      <td className={td}>{inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => handleViewInvoice(inv)}
                            disabled={viewingInvoiceId === inv.id}
                            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 rounded font-medium transition-colors disabled:opacity-50"
                            title={inv.hasStripeLink ? 'Open Stripe-hosted invoice' : 'View invoice details'}
                          >
                            {viewingInvoiceId === inv.id ? '...' : 'View'}
                          </button>
                          {inv.status !== InvoiceStatus.Paid && (
                            <button
                              onClick={() => handleMarkPaid(inv.id)}
                              className="px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors"
                            >
                              Mark Paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══════════════════ 5. Estimated Bill Preview ═══════════════════ */}

      <div className="mb-6">
        <h2 className={sectionHeading}>Estimated Bill Preview</h2>
        <div className={`${card} p-5`}>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              ))}
            </div>
          ) : estimate ? (
            <>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Period: {new Date(estimate.billingPeriodStart).toLocaleDateString()} - {new Date(estimate.billingPeriodEnd).toLocaleDateString()}
              </div>

              {estimate.lineItems.length > 0 && (
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2 text-left font-medium text-gray-700 dark:text-gray-300">Description</th>
                        <th className="py-2 text-right font-medium text-gray-700 dark:text-gray-300">Qty</th>
                        <th className="py-2 text-right font-medium text-gray-700 dark:text-gray-300">Free</th>
                        <th className="py-2 text-right font-medium text-gray-700 dark:text-gray-300">Billable</th>
                        <th className="py-2 text-right font-medium text-gray-700 dark:text-gray-300">Rate</th>
                        <th className="py-2 text-right font-medium text-gray-700 dark:text-gray-300">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {estimate.lineItems.map((li, idx) => (
                        <tr key={idx}>
                          <td className="py-2 text-gray-800 dark:text-gray-200">{li.description}</td>
                          <td className="py-2 text-right text-gray-600 dark:text-gray-400">{li.quantity}</td>
                          <td className="py-2 text-right text-gray-600 dark:text-gray-400">{li.freeUnits}</td>
                          <td className="py-2 text-right text-gray-600 dark:text-gray-400">{li.billableUnits}</td>
                          <td className="py-2 text-right text-gray-600 dark:text-gray-400">${li.unitPrice.toFixed(4)}</td>
                          <td className="py-2 text-right font-medium text-gray-800 dark:text-gray-200">${li.lineTotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">${estimate.subTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Tax ({(estimate.taxRate * 100).toFixed(1)}%)</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">${estimate.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-gray-200 dark:border-gray-700 pt-2">
                  <span className="text-gray-900 dark:text-white">Total</span>
                  <span className="text-gray-900 dark:text-white">${estimate.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No estimate available</p>
          )}
        </div>
      </div>

      {/* ═══════════════════ App Override Modal ═══════════════════ */}

      {showAppOverrideModal && appOverrideForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Override: {appOverrideForm.appName}
              </h3>
              <button onClick={() => setShowAppOverrideModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAppOverrideSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price Override ($)</label>
                <input type="number" min={0} step={0.01} value={appOverrideForm.priceOverride} onChange={(e) => setAppOverrideForm({ ...appOverrideForm, priceOverride: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  placeholder="Leave empty to use plan default" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Device Limit Override</label>
                <input type="number" min={0} value={appOverrideForm.deviceLimitOverride} onChange={(e) => setAppOverrideForm({ ...appOverrideForm, deviceLimitOverride: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  placeholder="Leave empty to use plan default" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Free Tier Override</label>
                <input type="number" min={0} value={appOverrideForm.freeTierOverride} onChange={(e) => setAppOverrideForm({ ...appOverrideForm, freeTierOverride: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  placeholder="Leave empty to use plan default" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="appOverrideEnabled" checked={appOverrideForm.isEnabled} onChange={(e) => setAppOverrideForm({ ...appOverrideForm, isEnabled: e.target.checked })}
                  className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                <label htmlFor="appOverrideEnabled" className="text-sm text-gray-700 dark:text-gray-300">Enabled</label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAppOverrideModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Cancel
                </button>
                <button type="submit" disabled={appOverrideSaving}
                  className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
                  {appOverrideSaving && (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  Apply Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════ API Override Modal ═══════════════════ */}

      {showApiOverrideModal && apiOverrideForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Override: {apiOverrideForm.apiName}
              </h3>
              <button onClick={() => setShowApiOverrideModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleApiOverrideSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rate Override ($ per call)</label>
                <input type="number" min={0} step={0.0001} value={apiOverrideForm.rateOverride} onChange={(e) => setApiOverrideForm({ ...apiOverrideForm, rateOverride: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  placeholder="Leave empty to use plan default" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Free Tier Override</label>
                <input type="number" min={0} value={apiOverrideForm.freeTierOverride} onChange={(e) => setApiOverrideForm({ ...apiOverrideForm, freeTierOverride: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  placeholder="Leave empty to use plan default" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Calls Override</label>
                <input type="number" min={0} value={apiOverrideForm.maxCallsOverride} onChange={(e) => setApiOverrideForm({ ...apiOverrideForm, maxCallsOverride: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  placeholder="Leave empty to use plan default" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="apiOverrideEnabled" checked={apiOverrideForm.isEnabled} onChange={(e) => setApiOverrideForm({ ...apiOverrideForm, isEnabled: e.target.checked })}
                  className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                <label htmlFor="apiOverrideEnabled" className="text-sm text-gray-700 dark:text-gray-300">Enabled</label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowApiOverrideModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Cancel
                </button>
                <button type="submit" disabled={apiOverrideSaving}
                  className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
                  {apiOverrideSaving && (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  Apply Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {ConfirmDialog}

      {/* ═══════════════════ Change Plan Modal ═══════════════════ */}

      {showChangePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Change Plan
              </h3>
              <button onClick={() => setShowChangePlanModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleChangePlanSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Current Plan Info */}
              {subscription && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Current Plan: </span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{subscription.planName}</span>
                  <span className="text-gray-500 dark:text-gray-400"> &mdash; ${subscription.monthlyAmount.toFixed(2)}/mo</span>
                </div>
              )}

              {/* Plan Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select New Plan *</label>
                {loadingPlans ? (
                  <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                    <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading plans...
                  </div>
                ) : availablePlans.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No active plans found. Create a plan first.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                    {availablePlans.map((plan) => {
                      const isCurrent = subscription?.planId === plan.id;
                      const isSelected = selectedPlanId === plan.id;
                      return (
                        <label
                          key={plan.id}
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                              : isCurrent
                              ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10'
                              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="newPlan"
                              value={plan.id}
                              checked={isSelected}
                              onChange={() => setSelectedPlanId(plan.id)}
                              disabled={isCurrent}
                              className="text-brand-500 focus:ring-brand-500"
                            />
                            <div>
                              <div className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                                {plan.name}
                                {isCurrent && (
                                  <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">(Current)</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Code: {plan.code} &middot; Max Users: {plan.maxUsers}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                              ${plan.price?.toFixed(2) ?? '0.00'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {BillingCycleLabel[plan.billingCycle] ?? 'Monthly'}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Proration picker — only meaningful when customer has a Stripe sub */}
              {adminSub?.stripeSubscriptionId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Proration</label>
                  <div className="space-y-2">
                    {[
                      { v: 'create_prorations' as const, label: 'Charge prorated difference now', help: 'Customer is billed/credited the difference today. Default.' },
                      { v: 'none' as const, label: 'No charge — new price next cycle', help: 'For comps / courtesy upgrades. Stripe makes no proration invoice.' },
                      { v: 'always_invoice' as const, label: 'Charge full new amount today', help: 'Generates a full-cycle invoice immediately.' },
                    ].map(opt => (
                      <label key={opt.v} className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="prorationBehavior"
                          value={opt.v}
                          checked={prorationBehavior === opt.v}
                          onChange={() => setProrationBehavior(opt.v)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium text-gray-800 dark:text-gray-200">{opt.label}</span>
                          <span className="block text-[11px] text-gray-500 dark:text-gray-400">{opt.help}</span>
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* Live preview from Stripe */}
                  {selectedPlanId && (
                    <div className="mt-3 p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs">
                      {previewing ? (
                        <span className="text-blue-700 dark:text-blue-300">Calculating preview…</span>
                      ) : planChangePreview ? (
                        <>
                          <div className="font-semibold text-blue-800 dark:text-blue-300">
                            Will charge today: ${planChangePreview.amountDueNow.toFixed(2)}
                          </div>
                          <div className="text-blue-700 dark:text-blue-400 mt-1">
                            Next cycle ({planChangePreview.nextBillingDate ? new Date(planChangePreview.nextBillingDate).toLocaleDateString() : '—'}): ${planChangePreview.nextCycleAmount.toFixed(2)}
                          </div>
                        </>
                      ) : (
                        <span className="text-blue-700 dark:text-blue-300">Preview unavailable for this combination.</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
                <textarea
                  rows={2}
                  value={changePlanNotes}
                  onChange={(e) => setChangePlanNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 resize-none"
                  placeholder="e.g. Customer requested upgrade"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePlanModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changePlanSaving || !selectedPlanId}
                  className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {changePlanSaving && (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  Assign Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Legacy invoice viewer (pre-Stripe invoices only) */}
      {legacyInvoice && (
        <LegacyInvoiceModal
          invoice={legacyInvoice}
          onClose={() => setLegacyInvoice(null)}
        />
      )}

    </div>
  );
};

export default CustomerBillingPage;
