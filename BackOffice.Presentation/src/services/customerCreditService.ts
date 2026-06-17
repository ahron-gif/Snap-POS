import apiClient from '../lib/axios';
import type { ApiResponse } from './permissionService';
import type {
  CreditBalance,
  PagedCreditTransactions,
  TopUpRequest,
  AdminAdjustCredit,
  CreditTopUpRecoveryResult,
  EnsureStripeCustomerResult,
  CreditTopUpTrace,
} from '../types/billing';

/**
 * OpenAPI prepaid-credit wallet service. Mirrors CustomerCreditController.cs.
 * Tenant endpoints scope by JWT; super-admin endpoints accept a customerId in
 * the URL and are guarded server-side by IsSuperAdminFromToken().
 */
export const customerCreditService = {
  // ─── Tenant (self-scoped) ─────────────────────────────────────────────

  getMyBalance: () =>
    apiClient.get<ApiResponse<CreditBalance>>('/api/CustomerCredit/MyBalance'),

  getMyTransactions: (page = 1, pageSize = 50) =>
    apiClient.get<ApiResponse<PagedCreditTransactions>>(
      `/api/CustomerCredit/MyTransactions?page=${page}&pageSize=${pageSize}`
    ),

  /**
   * Starts a Stripe Checkout session for a credit top-up. The response body
   * contains the hosted-checkout URL; the caller should redirect the browser to it.
   * On successful payment, Stripe's checkout.session.completed webhook credits
   * the wallet via CustomerCreditService.ApplyTopUpAsync (idempotent on PaymentIntentId).
   */
  createTopUpCheckoutSession: (data: TopUpRequest) =>
    apiClient.post<ApiResponse<{ sessionId: string; url: string }>>(
      '/api/CustomerCredit/TopUp',
      data
    ),

  /**
   * After returning from Stripe Checkout, ask the backend to look up the session
   * and apply the top-up if Stripe says it's paid. Backstop for environments
   * where the Stripe webhook can't reach the server (local dev). Idempotent.
   */
  reconcileTopUp: (sessionId: string) =>
    apiClient.post<ApiResponse<boolean>>(
      `/api/CustomerCredit/TopUp/Reconcile/${encodeURIComponent(sessionId)}`
    ),

  /**
   * Broader recovery scan: ask the backend to look at the tenant's recent Stripe
   * Checkout sessions and apply any paid credit top-ups that haven't been
   * credited yet. Used when the post-payment redirect was lost. Idempotent.
   * Returns a diagnostic so the UI can explain why the wallet may still be $0
   * (no Stripe customer linked, all sessions for other intents, none paid, etc.).
   */
  recoverPendingTopUps: () =>
    apiClient.post<ApiResponse<CreditTopUpRecoveryResult>>('/api/CustomerCredit/TopUp/Recover'),

  /**
   * Manual recovery: apply a Stripe Checkout Session by ID. Used when the
   * auto-scan can't find the payment (customer-linkage mismatch). The user
   * pastes the cs_… id from their Stripe Dashboard. Idempotent on PaymentIntentId.
   */
  applyTopUpBySessionId: (sessionId: string) =>
    apiClient.post<ApiResponse<boolean>>('/api/CustomerCredit/TopUp/ApplyBySessionId', { sessionId }),

  /**
   * Read-only dry-run for a Session ID. Returns the full trace: Stripe-side facts,
   * BackOffice-side facts, match analysis, idempotency state, and a "wouldApply"
   * verdict. Used by the "Inspect" button to debug "I paid but my wallet is $0".
   */
  traceTopUp: (sessionId: string) =>
    apiClient.post<ApiResponse<CreditTopUpTrace>>('/api/CustomerCredit/TopUp/Trace', { sessionId }),

  /**
   * Ensures a Stripe Customer exists for the calling tenant. Idempotent.
   * Drives the "Stripe linkage" status row on the panel header.
   */
  ensureStripeCustomer: () =>
    apiClient.post<ApiResponse<EnsureStripeCustomerResult>>('/api/CustomerCredit/EnsureStripeCustomer'),

  // ─── Super-admin (acts on behalf of a tenant) ─────────────────────────

  adminGetBalance: (customerId: number) =>
    apiClient.get<ApiResponse<CreditBalance>>(
      `/api/CustomerCredit/Customer/${customerId}`
    ),

  adminGetTransactions: (customerId: number, page = 1, pageSize = 50) =>
    apiClient.get<ApiResponse<PagedCreditTransactions>>(
      `/api/CustomerCredit/Customer/${customerId}/Transactions?page=${page}&pageSize=${pageSize}`
    ),

  adminAdjust: (customerId: number, data: AdminAdjustCredit) =>
    apiClient.post<ApiResponse<CreditBalance>>(
      `/api/CustomerCredit/Admin/Adjust/${customerId}`,
      data
    ),
};
