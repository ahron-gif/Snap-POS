import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { permissionService } from '../../services/permissionService';
import { billingService } from '../../services/billingService';
import { useConfirm } from '../../components/ui/ConfirmModal';
import LegacyInvoiceModal from '../../components/billing/LegacyInvoiceModal';
import type { TenantListItem } from '../../types/permission';
import type { CustomerSubscriptionDetail, InvoiceSummary, InvoiceDetail } from '../../types/billing';
import {
  SubscriptionStatus,
  SubscriptionStatusLabel,
  InvoiceStatus,
  InvoiceStatusLabel,
} from '../../types/billing';

// ─── Combined row type ───

interface CustomerBillingRow {
  id: number;
  customerName: string;
  planName: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionEndDate: string | null;
  lastInvoiceAmount: number | null;
  monthlyAmount: number;
}

type StatusFilter = 'All' | SubscriptionStatus;

const invoiceStatusBadge = (status: InvoiceStatus) => {
  if (status === InvoiceStatus.Paid)
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (status === InvoiceStatus.Issued || status === InvoiceStatus.Draft)
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  if (status === InvoiceStatus.PastDue)
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
};

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

const SkeletonRow: React.FC = () => (
  <tr className="animate-pulse">
    {[...Array(6)].map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
      </td>
    ))}
  </tr>
);

const BillingOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();

  const [rows, setRows] = useState<CustomerBillingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Tenant-scoped invoices modal (opened by the row "Invoices" button).
  const [invoicesModalFor, setInvoicesModalFor] = useState<{ id: number; name: string } | null>(null);
  const [invoicesList, setInvoicesList] = useState<InvoiceSummary[]>([]);
  const [loadingInvoicesList, setLoadingInvoicesList] = useState(false);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<number | null>(null);
  const [legacyInvoice, setLegacyInvoice] = useState<InvoiceDetail | null>(null);

  // ─── Summary cards ───
  const [totalActive, setTotalActive] = useState(0);
  const [totalPastDue, setTotalPastDue] = useState(0);
  const [totalSuspended, setTotalSuspended] = useState(0);
  const [revenueThisMonth, setRevenueThisMonth] = useState(0);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all tenants
      const tenantsRes = await permissionService.getTenants({
        startRow: 0,
        endRow: 9999,
        sortColumn: 'CustomerName',
        sortDirection: 'asc',
      });

      if (!tenantsRes.data.isSuccess) {
        setToast({ message: 'Failed to load customers', type: 'error' });
        setLoading(false);
        return;
      }

      const tenants: TenantListItem[] = tenantsRes.data.response.data;

      // Fetch subscription details for each tenant in parallel
      const subResults = await Promise.allSettled(
        tenants.map((t) => billingService.getSubscription(t.id))
      );

      // Fetch last invoice for each tenant in parallel
      const invResults = await Promise.allSettled(
        tenants.map((t) => billingService.getCustomerInvoices(t.id))
      );

      const combined: CustomerBillingRow[] = tenants.map((t, idx) => {
        const subResult = subResults[idx];
        let sub: CustomerSubscriptionDetail | null = null;
        if (subResult.status === 'fulfilled' && subResult.value.data.isSuccess) {
          sub = subResult.value.data.response;
        }

        const invResult = invResults[idx];
        let lastAmount: number | null = null;
        if (invResult.status === 'fulfilled' && invResult.value.data.isSuccess) {
          const invoices = invResult.value.data.response;
          if (invoices.length > 0) {
            lastAmount = invoices[0].totalAmount;
          }
        }

        return {
          id: t.id,
          customerName: t.customerName,
          planName: sub?.planName || t.planName || '—',
          subscriptionStatus: sub?.subscriptionStatus ?? (t.isActive ? SubscriptionStatus.Active : SubscriptionStatus.Cancelled),
          subscriptionEndDate: sub?.subscriptionEndDate || t.expiresAt || null,
          lastInvoiceAmount: lastAmount,
          monthlyAmount: sub?.monthlyAmount || 0,
        };
      });

      setRows(combined);

      // Compute summary
      const active = combined.filter((r) => r.subscriptionStatus === SubscriptionStatus.Active).length;
      const pastDue = combined.filter((r) => r.subscriptionStatus === SubscriptionStatus.PastDue).length;
      const suspended = combined.filter((r) => r.subscriptionStatus === SubscriptionStatus.Suspended).length;

      // Revenue = sum of all paid invoice amounts this month (approximate from lastInvoiceAmount for active customers)
      let revenue = 0;
      invResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.data.isSuccess) {
          const invoices = result.value.data.response;
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          invoices.forEach((inv) => {
            if (inv.status === InvoiceStatus.Paid && inv.paidAt) {
              const paidDate = new Date(inv.paidAt);
              if (paidDate >= monthStart) {
                revenue += inv.totalAmount;
              }
            }
          });
        }
      });

      setTotalActive(active);
      setTotalPastDue(pastDue);
      setTotalSuspended(suspended);
      setRevenueThisMonth(revenue);
    } catch {
      setToast({ message: 'Failed to load billing overview', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Actions ───

  const handleSuspend = async (customerId: number, customerName: string) => {
    const ok = await confirm({
      title: 'Suspend Customer',
      message: `Are you sure you want to suspend "${customerName}"? They will lose access to all services.`,
      confirmLabel: 'Suspend',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await billingService.suspendCustomer(customerId, 'Suspended by admin');
      setToast({ message: `${customerName} suspended`, type: 'success' });
      loadData();
    } catch {
      setToast({ message: 'Suspend failed', type: 'error' });
    }
  };

  const handleReactivate = async (customerId: number, customerName: string) => {
    const ok = await confirm({
      title: 'Reactivate Customer',
      message: `Reactivate "${customerName}"? This will restore their access.`,
      confirmLabel: 'Reactivate',
      variant: 'info',
    });
    if (!ok) return;
    try {
      await billingService.reactivateCustomer(customerId);
      setToast({ message: `${customerName} reactivated`, type: 'success' });
      loadData();
    } catch {
      setToast({ message: 'Reactivate failed', type: 'error' });
    }
  };

  const handleGenerateInvoice = async (customerId: number, customerName: string) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const ok = await confirm({
      title: 'Generate Invoice',
      message: `Generate invoice for "${customerName}" for period ${start} to ${end}?`,
      confirmLabel: 'Generate',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      const res = await billingService.generateInvoice(customerId, start, end);
      if (res.data.isSuccess) {
        setToast({ message: `Invoice generated for ${customerName}.`, type: 'success' });
        loadData();
      } else {
        // Surface the actual API message (e.g. "Customer does not have an assigned plan.")
        setToast({
          message: res.data.message || 'Invoice generation failed',
          type: 'error',
        });
      }
    } catch (err: unknown) {
      // axios throws on 4xx — pull the server's structured message if available.
      const apiMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setToast({
        message: apiMsg || 'Invoice generation failed',
        type: 'error',
      });
    }
  };

  // Open the per-tenant invoices viewer modal. Loads the list lazily on open so
  // we don't refetch invoices for every row on the overview grid.
  const handleOpenInvoicesModal = async (customerId: number, customerName: string) => {
    setInvoicesModalFor({ id: customerId, name: customerName });
    setInvoicesList([]);
    setLoadingInvoicesList(true);
    try {
      const res = await billingService.getCustomerInvoices(customerId);
      if (res.data.isSuccess) {
        setInvoicesList(res.data.response ?? []);
      } else {
        setToast({ message: res.data.message || 'Failed to load invoices', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to load invoices', type: 'error' });
    } finally {
      setLoadingInvoicesList(false);
    }
  };

  const handleCloseInvoicesModal = () => {
    setInvoicesModalFor(null);
    setInvoicesList([]);
  };

  // Open a single invoice from the modal — Stripe-hosted URL if present,
  // otherwise the legacy fallback modal.
  const handleViewInvoiceFromModal = async (inv: InvoiceSummary) => {
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

  // ─── Filtering ───

  const filteredRows = rows.filter((r) => {
    // Search filter
    if (search.trim() && !r.customerName.toLowerCase().includes(search.trim().toLowerCase())) {
      return false;
    }
    // Status filter
    if (statusFilter === 'All') return true;
    return r.subscriptionStatus === statusFilter;
  });

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

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing Overview</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Dashboard of billing status across all customers
        </p>
      </div>

      {/* ═══════════════════ Summary Cards ═══════════════════ */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Active</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{loading ? '...' : totalActive}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Past Due</p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{loading ? '...' : totalPastDue}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Suspended</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{loading ? '...' : totalSuspended}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Revenue This Month</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {loading ? '...' : `$${revenueThisMonth.toFixed(2)}`}
          </p>
        </div>
      </div>

      {/* ═══════════════════ Filters ═══════════════════ */}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              const v = e.target.value;
              setStatusFilter(v === 'All' ? 'All' : (Number(v) as SubscriptionStatus));
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
          >
            <option value="All">All Statuses</option>
            <option value={SubscriptionStatus.Active}>{SubscriptionStatusLabel[SubscriptionStatus.Active]}</option>
            <option value={SubscriptionStatus.PastDue}>{SubscriptionStatusLabel[SubscriptionStatus.PastDue]}</option>
            <option value={SubscriptionStatus.Suspended}>{SubscriptionStatusLabel[SubscriptionStatus.Suspended]}</option>
            <option value={SubscriptionStatus.Trial}>{SubscriptionStatusLabel[SubscriptionStatus.Trial]}</option>
          </select>
        </div>
      </div>

      {/* ═══════════════════ Customer Billing Table ═══════════════════ */}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Customer Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Plan</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Subscription End</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Last Invoice</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <p>No customers found</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{row.customerName}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.planName}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusBadge(row.subscriptionStatus)}`}>
                        {SubscriptionStatusLabel[row.subscriptionStatus] ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {row.subscriptionEndDate ? new Date(row.subscriptionEndDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                      {row.lastInvoiceAmount != null ? `$${row.lastInvoiceAmount.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1 flex-wrap">
                        <button
                          onClick={() => navigate(`/super-admin/customer-billing/${row.id}`)}
                          className="px-2 py-1 text-xs bg-brand-500 hover:bg-brand-600 text-white rounded font-medium transition-colors"
                          title="View Details"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleOpenInvoicesModal(row.id, row.customerName)}
                          className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-medium transition-colors"
                          title="View Invoices"
                        >
                          Invoices
                        </button>
                        {row.subscriptionStatus !== SubscriptionStatus.Suspended ? (
                          <button
                            onClick={() => handleSuspend(row.id, row.customerName)}
                            className="px-2 py-1 text-xs border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded font-medium transition-colors"
                            title="Suspend"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(row.id, row.customerName)}
                            className="px-2 py-1 text-xs border border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 rounded font-medium transition-colors"
                            title="Reactivate"
                          >
                            Reactivate
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

        {filteredRows.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Showing {filteredRows.length} customer{filteredRows.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Per-tenant invoices modal — opened by the row "Invoices" button.
          Scrollable body (max-h-[70vh]) so long lists don't break the layout. */}
      {invoicesModalFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleCloseInvoicesModal}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Invoices</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{invoicesModalFor.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const id = invoicesModalFor.id;
                    handleCloseInvoicesModal();
                    navigate(`/super-admin/customer-billing/${id}`);
                  }}
                  className="px-3 py-1.5 text-xs border border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg font-medium"
                  title="Open the full billing page for this customer"
                >
                  Open Billing Page
                </button>
                <button
                  onClick={handleCloseInvoicesModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body — scrollable. */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingInvoicesList ? (
                <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">Loading invoices…</div>
              ) : invoicesList.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm text-gray-500 dark:text-gray-400">No invoices for this customer yet.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold">Invoice #</th>
                      <th className="px-2 py-2 text-left font-semibold">Period</th>
                      <th className="px-2 py-2 text-right font-semibold">Amount</th>
                      <th className="px-2 py-2 text-center font-semibold">Status</th>
                      <th className="px-2 py-2 text-left font-semibold">Paid</th>
                      <th className="px-2 py-2 text-center font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {invoicesList.map((inv) => (
                      <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-2 py-3 font-medium text-gray-800 dark:text-gray-200">{inv.invoiceNumber}</td>
                        <td className="px-2 py-3 text-xs text-gray-600 dark:text-gray-400">
                          {new Date(inv.billingPeriodStart).toLocaleDateString()} – {new Date(inv.billingPeriodEnd).toLocaleDateString()}
                        </td>
                        <td className="px-2 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">${inv.totalAmount.toFixed(2)}</td>
                        <td className="px-2 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${invoiceStatusBadge(inv.status)}`}>
                            {InvoiceStatusLabel[inv.status] ?? 'Unknown'}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-xs text-gray-600 dark:text-gray-400">
                          {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <button
                            onClick={() => handleViewInvoiceFromModal(inv)}
                            disabled={viewingInvoiceId === inv.id}
                            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 rounded font-medium transition-colors disabled:opacity-50"
                            title={inv.hasStripeLink ? 'Open Stripe-hosted invoice' : 'View invoice details'}
                          >
                            {viewingInvoiceId === inv.id ? '…' : 'View'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center flex-shrink-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {invoicesList.length} invoice{invoicesList.length === 1 ? '' : 's'}
              </span>
              <button
                onClick={handleCloseInvoicesModal}
                className="px-4 py-1.5 text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legacy invoice fallback (pre-Stripe invoices) — opened from the modal */}
      {legacyInvoice && (
        <LegacyInvoiceModal
          invoice={legacyInvoice}
          onClose={() => setLegacyInvoice(null)}
        />
      )}

      {ConfirmDialog}
    </div>
  );
};

export default BillingOverviewPage;
