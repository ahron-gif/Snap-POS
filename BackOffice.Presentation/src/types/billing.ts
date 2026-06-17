// ─── Enums (matching backend int values) ───

export enum SubscriptionStatus {
  Active = 0,
  Trial = 1,
  PastDue = 2,
  Suspended = 3,
  Cancelled = 4,
}

export enum SubscriptionAction {
  Created = 0,
  Upgraded = 1,
  Downgraded = 2,
  Renewed = 3,
  Cancelled = 4,
  Suspended = 5,
  Reactivated = 6,
}

export enum InvoiceStatus {
  Draft = 0,
  Issued = 1,
  Paid = 2,
  PastDue = 3,
  Void = 4,
  Refunded = 5,
}

export enum PaymentStatus {
  Pending = 0,
  Success = 1,
  Failed = 2,
}

export enum PlanTier {
  Starter = 0,
  Pro = 1,
  Business = 2,
  Enterprise = 3,
}

export enum BillingCycle {
  Monthly = 0,
  Yearly = 1,
}

// ─── Enum Label Maps ───

export const SubscriptionStatusLabel: Record<number, string> = {
  [SubscriptionStatus.Active]: 'Active',
  [SubscriptionStatus.Trial]: 'Trial',
  [SubscriptionStatus.PastDue]: 'Past Due',
  [SubscriptionStatus.Suspended]: 'Suspended',
  [SubscriptionStatus.Cancelled]: 'Cancelled',
};

export const SubscriptionActionLabel: Record<number, string> = {
  [SubscriptionAction.Created]: 'Created',
  [SubscriptionAction.Upgraded]: 'Upgraded',
  [SubscriptionAction.Downgraded]: 'Downgraded',
  [SubscriptionAction.Renewed]: 'Renewed',
  [SubscriptionAction.Cancelled]: 'Cancelled',
  [SubscriptionAction.Suspended]: 'Suspended',
  [SubscriptionAction.Reactivated]: 'Reactivated',
};

export const InvoiceStatusLabel: Record<number, string> = {
  [InvoiceStatus.Draft]: 'Draft',
  [InvoiceStatus.Issued]: 'Issued',
  [InvoiceStatus.Paid]: 'Paid',
  [InvoiceStatus.PastDue]: 'Past Due',
  [InvoiceStatus.Void]: 'Void',
  [InvoiceStatus.Refunded]: 'Refunded',
};

export const PaymentStatusLabel: Record<number, string> = {
  [PaymentStatus.Pending]: 'Pending',
  [PaymentStatus.Success]: 'Success',
  [PaymentStatus.Failed]: 'Failed',
};

export const PlanTierLabel: Record<number, string> = {
  [PlanTier.Starter]: 'Starter',
  [PlanTier.Pro]: 'Pro',
  [PlanTier.Business]: 'Business',
  [PlanTier.Enterprise]: 'Enterprise',
};

export const BillingCycleLabel: Record<number, string> = {
  [BillingCycle.Monthly]: 'Monthly',
  [BillingCycle.Yearly]: 'Yearly',
};

// ─── Plan Pricing ───

export interface PlanAppPricing {
  id: number;
  planId: number;
  appId: number;
  appName: string;
  pricingModel: 'per_user' | 'per_device' | 'flat';
  pricePerUnit: number;
  freeUnits: number;
  maxUnits: number | null;
  isIncluded: boolean;
}

export interface PlanApiPricing {
  id: number;
  planId: number;
  apiDefinitionId: number;
  apiName: string;
  ratePerCall: number;
  freeTierCalls: number;
  maxCallsPerMonth: number | null;
  isIncluded: boolean;
}

export interface PlanFeature {
  id: number;
  planId: number;
  appId: number | null;
  category: string;
  featureName: string;
  description: string | null;
  isEnabled: boolean;
  sortOrder: number;
}

export interface PlanDetail {
  id: number;
  name: string;
  code: string;
  description: string | null;
  tier: PlanTier | null;
  maxUsers: number;
  billingCycle: BillingCycle;
  price: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  appPricings: PlanAppPricing[];
  apiPricings: PlanApiPricing[];
  features: PlanFeature[];
  moduleIds: number[];
}

// ─── API Definition ───

export interface ApiDefinition {
  id: number;
  name: string;
  code: string;
  description: string | null;
  defaultRatePerCall: number;
  defaultFreeTier: number;
  isActive: boolean;
  sortOrder: number;
}

export interface CreateApiDefinition {
  name: string;
  code: string;
  description?: string;
  defaultRatePerCall: number;
  defaultFreeTier: number;
}

// ─── Usage ───

export interface UsageSnapshot {
  metricType: string;
  appId: number | null;
  appName: string | null;
  currentCount: number;
  limit: number;
  percentUsed: number;
}

export interface ApiUsageSnapshot {
  apiDefinitionId: number;
  apiName: string;
  totalCalls: number;
  freeTier: number;
  billableCalls: number;
  rate: number;
  cost: number;
}

export interface CustomerUsageDashboard {
  customerId: number;
  customerName: string;
  planName: string;
  deviceUsage: UsageSnapshot[];
  apiUsage: ApiUsageSnapshot[];
  transactionCount: number;
  transactionFreeTier: number;
  transactionBillable: number;
  transactionRate: number;
  transactionCost: number;
}

// Per-day transaction record returned by /api/Usage/MyTransactions.
// Used by the Licenses & Billing Transactions panel to render a row-per-day
// breakdown under the Total/Free/Billable summary cards.
export interface TransactionRecord {
  recordedDate: string;
  count: number;
  freeUnits: number;
  billableUnits: number;
  unitPrice: number;
  lineTotal: number;
  appId: number | null;
  appName: string | null;
}

// ─── Subscription ───

export interface CustomerSubscriptionDetail {
  customerId: number;
  customerName: string;
  planId: number;
  planName: string;
  planTier: PlanTier | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  gracePeriodEndsAt: string | null;
  suspendedAt: string | null;
  billingCycleMonths: number;
  monthlyAmount: number;
  isPaid: boolean;
  lastPaymentAt: string | null;
  // Phase 2: real Stripe Subscriptions
  stripeSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
}

export interface ChangeSubscription {
  customerId: number;
  newPlanId: number;
  effectiveDate?: string;
  notes?: string;
}

export interface CustomerAppOverride {
  customerId: number;
  appId: number;
  priceOverride: number | null;
  deviceLimitOverride: number | null;
  freeTierOverride: number | null;
  isEnabled: boolean;
}

export interface CustomerApiOverride {
  customerId: number;
  apiDefinitionId: number;
  rateOverride: number | null;
  freeTierOverride: number | null;
  maxCallsOverride: number | null;
  isEnabled: boolean;
}

export interface SubscriptionHistory {
  id: number;
  planName: string;
  action: SubscriptionAction;
  previousPlanName: string | null;
  monthlyAmount: number;
  effectiveDate: string;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
}

// ─── Invoice ───

export interface InvoiceSummary {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string | null;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  issuedAt: string;
  dueDate: string;
  totalAmount: number;
  status: InvoiceStatus;
  paidAt: string | null;
  hasStripeLink: boolean;
}

export interface InvoiceLineItem {
  id: number;
  description: string;
  appId: number | null;
  apiDefinitionId: number | null;
  category: string;
  pricingModel: string | null;
  quantity: number;
  freeUnits: number;
  billableUnits: number;
  unitPrice: number;
  lineTotal: number;
}

export interface InvoiceDetail extends InvoiceSummary {
  subTotal: number;
  taxAmount: number;
  paymentReference: string | null;
  notes: string | null;
  lineItems: InvoiceLineItem[];
}

export interface PaymentAttemptItem {
  id: number;
  invoiceId: number;
  attemptedAt: string;
  status: PaymentStatus;
  failureReason: string | null;
  paymentProvider: string | null;
  amount: number;
  attemptNumber: number;
}

// ─── Estimated Bill ───

export interface EstimatedBillLine {
  description: string;
  appId: number | null;
  apiDefinitionId: number | null;
  category: string;
  quantity: number;
  freeUnits: number;
  billableUnits: number;
  unitPrice: number;
  lineTotal: number;
}

export interface EstimatedBill {
  customerId: number;
  customerName: string;
  planName: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  lineItems: EstimatedBillLine[];
  subTotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
}

// ─── Billing Config ───

export interface BillingConfigItem {
  id: number;
  configKey: string;
  configValue: string;
  description: string | null;
}

// ─── Customer App Licenses (per-device add-on slots) ───

export interface CustomerAppLicense {
  id: number;
  customerId: number;
  appId: number;
  appName: string | null;
  deviceLabel: string | null;
  activatedAt: string;
  billingEndsAt: string | null;
  removalRequestedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AddLicense {
  appId: number;
  deviceLabel?: string | null;
}

export interface LicenseSummaryByApp {
  appId: number;
  appName: string | null;
  activeCount: number;
  pendingRemovalCount: number;
}

export interface LicenseSummary {
  customerId: number;
  cycleStart: string;
  cycleEnd: string;
  byApp: LicenseSummaryByApp[];
}

// ─── Device limits (runtime registration vs allocated slots) ───

export interface DeviceLimit {
  appId: number;
  slotsTotal: number;
  slotsUsed: number;
  canRegisterNew: boolean;
  inactiveDays: number;
}

// ─── Billing Status ───

export interface BillingStatus {
  subscriptionStatus: SubscriptionStatus;
  planName: string | null;
  gracePeriodEndsAt: string | null;
  suspendedAt: string | null;
  isOverdue: boolean;
  daysUntilSuspension: number | null;
}

// ─── OpenAPI Credit Wallet ───

export enum CreditTransactionType {
  TopUp = 1,
  ApiDeduction = 2,
  Refund = 3,
  AdminAdjustment = 4,
}

export const CreditTransactionTypeLabel: Record<number, string> = {
  [CreditTransactionType.TopUp]: 'Top-up',
  [CreditTransactionType.ApiDeduction]: 'API call',
  [CreditTransactionType.Refund]: 'Refund',
  [CreditTransactionType.AdminAdjustment]: 'Adjustment',
};

export interface ApiFreeTierSnapshot {
  apiDefinitionId: number;
  apiCode: string;
  apiName: string;
  freeTierLimit: number;
  /** Lifetime calls consumed against the one-time free grant. */
  callsUsed: number;
  /** Calls in the current calendar month — informational only. */
  callsThisMonth: number;
  freeRemaining: number;
  effectiveRate: number;
}

export interface CreditBalance {
  customerId: number;
  balance: number;
  currency: string;
  lastTopUpAt: string | null;
  lastTopUpAmount: number | null;
  perApi: ApiFreeTierSnapshot[];
}

export interface CreditTransaction {
  id: number;
  customerId: number;
  type: CreditTransactionType;
  typeLabel: string;
  amount: number;
  balanceAfter: number;
  apiCode: string | null;
  callCount: number | null;
  stripePaymentIntentId: string | null;
  description: string | null;
  createdAt: string;
  createdByUserId: number | null;
}

export interface PagedCreditTransactions {
  items: CreditTransaction[];
  page: number;
  pageSize: number;
  total: number;
}

export interface TopUpRequest {
  amount: number;
}

export interface AdminAdjustCredit {
  amount: number;
  description: string;
}

/** Result of POST /api/CustomerCredit/EnsureStripeCustomer. */
export interface EnsureStripeCustomerResult {
  stripeCustomerId: string;
  /** "already_linked" | "found_orphan" | "created" */
  source: string;
}

/**
 * Result of POST /api/CustomerCredit/TopUp/Trace — full dry-run of an Apply for
 * a given Stripe Session ID. Lets the panel show exactly why an Apply would or
 * wouldn't succeed without performing any writes.
 */
export interface CreditTopUpTrace {
  sessionFound: boolean;
  sessionId: string;
  mode: string | null;
  paymentStatus: string | null;
  stripeCustomerIdOnSession: string | null;
  paymentIntentId: string | null;
  amountTotalCents: number | null;
  amountFromSession: number | null;
  metadataIntent: string | null;
  metadataCustomerId: string | null;
  metadataTopUpAmount: string | null;
  callerCustomerId: number;
  callerStripeCustomerId: string | null;
  sessionIsPaid: boolean;
  intentIsCreditTopUp: boolean;
  stripeCustomerMatchesCaller: boolean;
  metadataCustomerIdMatchesCaller: boolean;
  paymentIntentAlreadyOnLedger: boolean;
  alreadyAppliedToCustomerId: number | null;
  wouldApply: boolean;
  blockers: string[];
  note: string;
}

/**
 * Result of POST /api/CustomerCredit/TopUp/Recover — diagnostic counters that
 * let the panel explain why a tenant's wallet is still $0 after they say they
 * paid (e.g. all sessions were canceled, customer_id mismatch, etc.).
 */
export interface CreditTopUpRecoveryResult {
  scanned: number;
  applied: number;
  skippedNotCreditTopUp: number;
  skippedNotPaid: number;
  skippedCustomerMismatch: number;
  skippedNoPaymentIntent: number;
  alreadyApplied: number;
  hasStripeCustomer: boolean;
  note: string | null;
}
