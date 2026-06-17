import apiClient from '../lib/axios';
import type { ApiResponse } from './permissionService';
import type {
  PlanDetail,
  PlanAppPricing,
  PlanApiPricing,
  PlanFeature,
  ApiDefinition,
  CreateApiDefinition,
  BillingConfigItem,
  CustomerSubscriptionDetail,
  ChangeSubscription,
  CustomerAppOverride,
  CustomerApiOverride,
  SubscriptionHistory,
  CustomerUsageDashboard,
  TransactionRecord,
  InvoiceSummary,
  InvoiceDetail,
  EstimatedBill,
  BillingStatus,
  CustomerAppLicense,
  AddLicense,
  LicenseSummary,
  DeviceLimit,
} from '../types/billing';

export const billingService = {
  // ─── Plan Pricing ───

  getPlanDetail: (planId: number) =>
    apiClient.get<ApiResponse<PlanDetail>>(`/api/PlanPricing/Plan/${planId}`),

  updatePlanAppPricings: (planId: number, data: PlanAppPricing[]) =>
    apiClient.put<ApiResponse<boolean>>(`/api/PlanPricing/Plan/${planId}/AppPricings`, data),

  updatePlanApiPricings: (planId: number, data: PlanApiPricing[]) =>
    apiClient.put<ApiResponse<boolean>>(`/api/PlanPricing/Plan/${planId}/ApiPricings`, data),

  updatePlanFeatures: (planId: number, data: PlanFeature[]) =>
    apiClient.put<ApiResponse<boolean>>(`/api/PlanPricing/Plan/${planId}/Features`, data),

  // ─── API Definitions ───

  getApiDefinitions: () =>
    apiClient.get<ApiResponse<ApiDefinition[]>>('/api/ApiDefinition'),

  createApiDefinition: (data: CreateApiDefinition) =>
    apiClient.post<ApiResponse<number>>('/api/ApiDefinition', data),

  updateApiDefinition: (id: number, data: Partial<ApiDefinition>) =>
    apiClient.put<ApiResponse<boolean>>(`/api/ApiDefinition/${id}`, data),

  deleteApiDefinition: (id: number) =>
    apiClient.delete<ApiResponse<boolean>>(`/api/ApiDefinition/${id}`),

  // ─── Plans Lookup ───

  getPlansLookup: () =>
    apiClient.get<ApiResponse<PlanDetail[]>>('/api/Plan/Lookup'),

  // ─── Billing Config ───

  getBillingConfigs: () =>
    apiClient.get<ApiResponse<BillingConfigItem[]>>('/api/PlanPricing/Configs'),

  updateBillingConfig: (data: { configKey: string; configValue: string }) =>
    apiClient.put<ApiResponse<boolean>>('/api/PlanPricing/Configs', data),

  // ─── Subscription ───

  getSubscription: (customerId: number) =>
    apiClient.get<ApiResponse<CustomerSubscriptionDetail>>(`/api/Subscription/Customer/${customerId}`),

  changeSubscription: (data: ChangeSubscription) =>
    apiClient.post<ApiResponse<boolean>>('/api/Subscription/Change', data),

  // ─── Stripe Checkout (tenant-self upgrade) ───

  createUpgradeCheckoutSession: (data: { newPlanId: number; notes?: string }) =>
    apiClient.post<ApiResponse<{ sessionId: string; url: string }>>(
      '/api/Billing/Checkout/CreateUpgradeSession',
      data
    ),

  getCheckoutSessionStatus: (sessionId: string) =>
    apiClient.get<ApiResponse<{ sessionId: string; isPaid: boolean; planApplied: boolean; paymentStatus: string | null }>>(
      `/api/Billing/Checkout/Session/${encodeURIComponent(sessionId)}/Status`
    ),

  reconcilePendingUpgrades: () =>
    apiClient.post<ApiResponse<number>>('/api/Billing/Checkout/ReconcilePending'),

  // Phase 2: first-time subscribe (mode=subscription, auto-renewing)
  createSubscribeCheckoutSession: (data: { planId: number; notes?: string }) =>
    apiClient.post<ApiResponse<{ sessionId: string; url: string }>>(
      '/api/Billing/Checkout/CreateSubscribeSession',
      data
    ),

  // Phase 3: direct subscription management (no redirect)
  changeSubscriptionPlanStripe: (data: { newPlanId: number; notes?: string }) =>
    apiClient.post<ApiResponse<boolean>>('/api/Billing/Checkout/ChangePlan', data),

  previewPlanChange: (newPlanId: number) =>
    apiClient.get<ApiResponse<{
      amountDueNow: number;
      nextCycleAmount: number;
      nextBillingDate: string | null;
      currency: string;
      lines: Array<{ description: string; amount: number; isProration: boolean }>;
    }>>(`/api/Billing/Checkout/PreviewPlanChange/${newPlanId}`),

  cancelSubscriptionStripe: () =>
    apiClient.post<ApiResponse<boolean>>('/api/Billing/Checkout/Cancel'),

  reactivateSubscriptionStripe: () =>
    apiClient.post<ApiResponse<boolean>>('/api/Billing/Checkout/Reactivate'),

  createCustomerPortalSession: () =>
    apiClient.post<ApiResponse<{ url: string }>>('/api/Billing/Checkout/CustomerPortalSession'),

  // ─── Mid-cycle add-ons (extra devices/users beyond plan's FreeUnits) ───

  /**
   * Dry-run preview of the prorated total for a proposed quantity change set.
   * `quantity` is the OVERAGE units (devices/users beyond the plan's FreeUnits)
   * for that App. Drives the modal's "Charges today / Next renewal" panels.
   */
  previewAddOn: (data: { items: Array<{ appId: number; quantity: number; addedQuantity?: number; removeLicenseIds?: number[] }>; notes?: string }) =>
    apiClient.post<ApiResponse<{
      amountDueNow: number;
      nextCycleAmount: number;
      nextBillingDate: string | null;
      currency: string;
      lines: Array<{ description: string; amount: number; isProration: boolean }>;
    }>>('/api/Billing/Checkout/PreviewAddOn', data),

  /**
   * Creates a Stripe Checkout Session for the add-on changes. Frontend redirects
   * window.location to the returned `url`. After payment, Stripe sends the user
   * back to /licenses-billing?addon=success&session_id=... and the matching
   * webhook applies the change to the recurring subscription.
   */
  createAddOnCheckoutSession: (data: { items: Array<{ appId: number; quantity: number; addedQuantity?: number; removeLicenseIds?: number[] }>; notes?: string }) =>
    apiClient.post<ApiResponse<{ sessionId: string; url: string }>>(
      '/api/Billing/Checkout/CreateAddOnSession',
      data
    ),

  /** Polled by the success page until `planApplied=true`. Idempotent — runs the apply step inline if the session is paid. */
  getAddOnSessionStatus: (sessionId: string) =>
    apiClient.get<ApiResponse<{ sessionId: string; isPaid: boolean; planApplied: boolean; paymentStatus: string | null }>>(
      `/api/Billing/Checkout/AddOnSession/${encodeURIComponent(sessionId)}/Status`
    ),

  /** Backstop — applies any incomplete PendingAddOn that Stripe has marked paid. Called on every billing-page load. */
  reconcilePendingAddOns: () =>
    apiClient.post<ApiResponse<number>>('/api/Billing/Checkout/ReconcilePendingAddOns'),

  // ─── Phase 6: Super-admin Stripe actions on any tenant ───
  // All take customerId in the URL so SA can act on a specific tenant.

  adminGetSubscriptionDetail: (customerId: number) =>
    apiClient.get<ApiResponse<{
      customerId: number;
      customerName: string;
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      planId: number;
      planName: string;
      monthlyAmount: number;
      status: string;
      stripeStatus: string | null;
      currentPeriodStart: string | null;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
      canceledAt: string | null;
      pauseCollectionBehavior: string | null;
      defaultPaymentMethodId: string | null;
      defaultPaymentMethodBrand: string | null;
      defaultPaymentMethodLast4: string | null;
      lastPaymentAt: string | null;
      isPaid: boolean;
    }>>(`/api/Stripe/Admin/Subscription/${customerId}`),

  adminChangePlan: (customerId: number, data: { newPlanId: number; prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice'; notes?: string }) =>
    apiClient.post<ApiResponse<boolean>>(`/api/Stripe/Admin/Subscription/${customerId}/ChangePlan`, {
      newPlanId: data.newPlanId,
      prorationBehavior: data.prorationBehavior ?? 'create_prorations',
      notes: data.notes,
    }),

  adminPreviewPlanChange: (customerId: number, newPlanId: number) =>
    apiClient.get<ApiResponse<{
      amountDueNow: number;
      nextCycleAmount: number;
      nextBillingDate: string | null;
      currency: string;
      lines: Array<{ description: string; amount: number; isProration: boolean }>;
    }>>(`/api/Stripe/Admin/Subscription/${customerId}/PreviewPlanChange/${newPlanId}`),

  adminCancel: (customerId: number, immediately = false, notes?: string) =>
    apiClient.post<ApiResponse<boolean>>(`/api/Stripe/Admin/Subscription/${customerId}/Cancel`, { immediately, notes }),

  adminReactivate: (customerId: number) =>
    apiClient.post<ApiResponse<boolean>>(`/api/Stripe/Admin/Subscription/${customerId}/Reactivate`),

  adminPause: (customerId: number, behavior: 'keep_as_draft' | 'mark_uncollectible' | 'void' = 'keep_as_draft', notes?: string) =>
    apiClient.post<ApiResponse<boolean>>(`/api/Stripe/Admin/Subscription/${customerId}/Pause`, { behavior, notes }),

  adminResume: (customerId: number) =>
    apiClient.post<ApiResponse<boolean>>(`/api/Stripe/Admin/Subscription/${customerId}/Resume`),

  adminSyncFromStripe: (customerId: number) =>
    apiClient.post<ApiResponse<boolean>>(`/api/Stripe/Admin/Subscription/${customerId}/SyncFromStripe`),

  // ─── View Invoice (Stripe-hosted URL or legacy fallback) ───
  getInvoiceViewLink: (invoiceId: number) =>
    apiClient.get<ApiResponse<{
      invoiceId: number;
      isLegacy: boolean;
      hostedInvoiceUrl: string | null;
      invoicePdfUrl: string | null;
      detail: InvoiceDetail | null;
    }>>(`/api/Billing/Invoices/${invoiceId}/ViewLink`),

  // Super-admin backfill: imports historical Stripe invoices for the tenant.
  adminSyncInvoices: (customerId: number) =>
    apiClient.post<ApiResponse<number>>(`/api/Stripe/Admin/Subscription/${customerId}/SyncInvoices`),

  // Super-admin QA helper: creates a real Stripe test-mode invoice ($1, paid out-of-band).
  // Mirrors into the local DB inline. Returns the resulting InvoiceSummary.
  adminCreateTestInvoice: (customerId: number) =>
    apiClient.post<ApiResponse<InvoiceSummary>>(
      `/api/Stripe/Admin/Subscription/${customerId}/CreateTestInvoice`
    ),

  applyAppOverride: (data: CustomerAppOverride) =>
    apiClient.put<ApiResponse<boolean>>(`/api/Subscription/Customer/${data.customerId}/AppOverride`, data),

  applyApiOverride: (data: CustomerApiOverride) =>
    apiClient.put<ApiResponse<boolean>>(`/api/Subscription/Customer/${data.customerId}/ApiOverride`, data),

  suspendCustomer: (customerId: number, reason: string) =>
    apiClient.put<ApiResponse<boolean>>(`/api/Subscription/Customer/${customerId}/Suspend`, { reason }),

  reactivateCustomer: (customerId: number) =>
    apiClient.put<ApiResponse<boolean>>(`/api/Subscription/Customer/${customerId}/Reactivate`),

  getSubscriptionHistory: (customerId: number) =>
    apiClient.get<ApiResponse<SubscriptionHistory[]>>(`/api/Subscription/Customer/${customerId}/History`),

  getMyPlan: () =>
    apiClient.get<ApiResponse<CustomerSubscriptionDetail>>('/api/Subscription/MySubscription'),

  // ─── Usage ───

  getCustomerUsage: (customerId: number) =>
    apiClient.get<ApiResponse<CustomerUsageDashboard>>(`/api/Usage/Customer/${customerId}`),

  getMyUsage: () =>
    apiClient.get<ApiResponse<CustomerUsageDashboard>>('/api/Usage/MyUsage'),

  // Per-day transaction records for the current billing cycle. Renders as a list
  // under the Transactions summary cards on the Licenses & Billing page.
  getMyTransactions: () =>
    apiClient.get<ApiResponse<TransactionRecord[]>>('/api/Usage/MyTransactions'),

  getCustomerTransactions: (customerId: number) =>
    apiClient.get<ApiResponse<TransactionRecord[]>>(`/api/Usage/Customer/${customerId}/Transactions`),

  // ─── Invoices ───

  getCustomerInvoices: (customerId: number) =>
    apiClient.get<ApiResponse<InvoiceSummary[]>>(`/api/Billing/Invoices/Customer/${customerId}`),

  getInvoice: (invoiceId: number) =>
    apiClient.get<ApiResponse<InvoiceDetail>>(`/api/Billing/Invoices/${invoiceId}`),

  generateInvoice: (customerId: number, start: string, end: string) =>
    apiClient.post<ApiResponse<InvoiceDetail>>(`/api/Billing/GenerateInvoice`, {
      customerId,
      billingPeriodStart: start,
      billingPeriodEnd: end,
    }),

  markInvoicePaid: (invoiceId: number, paymentReference?: string) =>
    apiClient.put<ApiResponse<boolean>>(`/api/Billing/Invoices/${invoiceId}/MarkPaid`, { paymentReference }),

  getMyInvoices: () =>
    apiClient.get<ApiResponse<InvoiceSummary[]>>('/api/Billing/MyInvoices'),

  // ─── Estimated Bill ───

  getEstimatedBill: (customerId: number) =>
    apiClient.get<ApiResponse<EstimatedBill>>(`/api/Billing/EstimatedBill/${customerId}`),

  getMyEstimate: () =>
    apiClient.get<ApiResponse<EstimatedBill>>('/api/Billing/MyEstimate'),

  // ─── Billing Status ───

  getBillingStatus: (customerId: number) =>
    apiClient.get<ApiResponse<BillingStatus>>(`/api/Billing/Customer/${customerId}/Status`),

  getMyBillingStatus: () =>
    apiClient.get<ApiResponse<BillingStatus>>('/api/Billing/MyStatus'),

  // ─── Customer App Licenses (per-device add-on slots) ───

  getMyLicenses: (includeRemoved = false) =>
    apiClient.get<ApiResponse<CustomerAppLicense[]>>(
      `/api/CustomerAppLicense/Mine?includeRemoved=${includeRemoved}`,
    ),

  getMyLicenseSummary: () =>
    apiClient.get<ApiResponse<LicenseSummary>>('/api/CustomerAppLicense/MySummary'),

  addMyLicense: (data: AddLicense) =>
    apiClient.post<ApiResponse<CustomerAppLicense>>('/api/CustomerAppLicense/Mine/Add', data),

  removeMyLicense: (licenseId: number) =>
    apiClient.delete<ApiResponse<boolean>>(`/api/CustomerAppLicense/Mine/${licenseId}`),

  // Runtime device occupancy — how many real devices are using each license slot.
  // Used by the Licenses & Billing panel to show "X active / Y allocated".
  getMyDeviceLimits: () =>
    apiClient.get<ApiResponse<DeviceLimit[]>>('/api/Usage/MyDeviceLimits'),
};
