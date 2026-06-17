import React from 'react';
import type { InvoiceDetail } from '../../types/billing';
import { InvoiceStatus, InvoiceStatusLabel } from '../../types/billing';

interface Props {
  invoice: InvoiceDetail;
  onClose: () => void;
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusBadge = (status: InvoiceStatus) => {
  if (status === InvoiceStatus.Paid)
    return 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400';
  if (status === InvoiceStatus.PastDue)
    return 'bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400';
  if (status === InvoiceStatus.Void)
    return 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400';
  return 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-700 dark:text-gray-300';
};

// Conservative HTML escaping for fields that get injected into the print-window
// HTML literal. Customer-name, descriptions, and payment references all come
// from user input or third-party data — never trust them in innerHTML.
const escapeHtml = (s: string | null | undefined): string =>
  (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Pop a clean, print-ready receipt in a new window and auto-trigger the print
 * dialog there. Bypasses the rest of the SPA's chrome (sidebar, header, other
 * panels) which would otherwise be printed by a naive window.print() on the
 * parent. The new window closes itself after the print dialog completes.
 *
 * Why a new window instead of CSS print rules on the parent? Two reasons:
 *   1. We don't have to fight the rest of the app's print styles (or lack of
 *      them) on every panel — receipts often need to print from contexts other
 *      than this modal, and a separate document is portable.
 *   2. Pop-up blockers permit window.open() when it's triggered by a user click
 *      (the Print button), so there's no permission friction.
 */
const buildReceiptHtml = (invoice: InvoiceDetail): string => {
  const lineItems = invoice.lineItems.length === 0
    ? `<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No line items.</td></tr>`
    : invoice.lineItems.map(li => `
        <tr>
          <td>${escapeHtml(li.description)}</td>
          <td class="right">${li.quantity}</td>
          <td class="right">$${fmt(li.unitPrice)}</td>
          <td class="right" style="font-weight:600;">$${fmt(li.lineTotal)}</td>
        </tr>`).join('');

  const paymentBlock = (invoice.paidAt || invoice.paymentReference) ? `
    <div class="payment-info">
      ${invoice.paidAt ? `<div class="payment-info-row"><b>Paid on:</b> ${escapeHtml(new Date(invoice.paidAt).toLocaleString())}</div>` : ''}
      ${invoice.paymentReference ? `<div class="payment-info-row"><b>Reference:</b> <span class="mono">${escapeHtml(invoice.paymentReference)}</span></div>` : ''}
    </div>` : '';

  const notesBlock = invoice.notes
    ? `<div class="notes"><b>Notes:</b> ${escapeHtml(invoice.notes)}</div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt #${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    @page { margin: 12mm; size: auto; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, system-ui, sans-serif;
      color: #1a202c;
      max-width: 720px;
      margin: 0 auto;
      padding: 32px 24px;
      font-size: 13px;
      line-height: 1.5;
    }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; color: #0f172a; }
    h2 { font-size: 11px; font-weight: 600; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: 0.6px; color: #475569; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a202c; padding-bottom: 14px; margin-bottom: 22px; }
    .brand { font-size: 17px; font-weight: 700; color: #0f172a; letter-spacing: -0.2px; }
    .brand-sub { font-size: 10px; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }
    .status { padding: 4px 12px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; }
    .status-paid     { background: #dcfce7; color: #166534; }
    .status-pastdue  { background: #fef3c7; color: #92400e; }
    .status-void     { background: #fee2e2; color: #991b1b; }
    .status-refunded { background: #ede9fe; color: #5b21b6; }
    .status-other    { background: #f1f5f9; color: #475569; }

    .invoice-sub { color: #64748b; font-size: 12px; margin-bottom: 22px; }

    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px; }
    .meta-label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 2px; }
    .meta-value { font-weight: 600; color: #1e293b; }

    table { width: 100%; border-collapse: collapse; margin: 4px 0 16px; }
    th { background: #f8fafc; padding: 8px 10px; text-align: left; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #475569; border-bottom: 1px solid #e2e8f0; }
    th.right, td.right { text-align: right; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tbody tr:last-child td { border-bottom: none; }

    .totals { margin-left: auto; width: 260px; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #475569; }
    .totals-row.total { border-top: 1.5px solid #1e293b; padding-top: 8px; margin-top: 8px; font-size: 16px; font-weight: 700; color: #0f172a; }

    .payment-info { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 14px; margin-top: 20px; font-size: 12px; }
    .payment-info-row { color: #166534; margin: 2px 0; }
    .payment-info-row b { color: #14532d; font-weight: 600; }

    .notes { font-size: 11px; color: #64748b; margin-top: 14px; padding: 8px 12px; border-left: 3px solid #cbd5e1; background: #f8fafc; }
    .notes b { color: #334155; }

    .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; letter-spacing: 0.4px; }

    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">RDT Cloud</div>
      <div class="brand-sub">inSight &middot; inStinct &middot; inCrease</div>
    </div>
    <div>
      <span class="status ${
        invoice.status === InvoiceStatus.Paid       ? 'status-paid'
        : invoice.status === InvoiceStatus.PastDue  ? 'status-pastdue'
        : invoice.status === InvoiceStatus.Void     ? 'status-void'
        : invoice.status === InvoiceStatus.Refunded ? 'status-refunded'
        : 'status-other'
      }">${escapeHtml(InvoiceStatusLabel[invoice.status] ?? '')}</span>
    </div>
  </div>

  <h1>Receipt #${escapeHtml(invoice.invoiceNumber)}</h1>
  <div class="invoice-sub">
    ${escapeHtml(invoice.customerName ?? '')} &middot; Issued ${escapeHtml(new Date(invoice.issuedAt).toLocaleDateString())}
  </div>

  <div class="meta">
    <div>
      <div class="meta-label">Billing Period</div>
      <div class="meta-value">${escapeHtml(new Date(invoice.billingPeriodStart).toLocaleDateString())} &rarr; ${escapeHtml(new Date(invoice.billingPeriodEnd).toLocaleDateString())}</div>
    </div>
    <div>
      <div class="meta-label">Due Date</div>
      <div class="meta-value">${escapeHtml(new Date(invoice.dueDate).toLocaleDateString())}</div>
    </div>
  </div>

  <h2>Line Items</h2>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="right">Qty</th>
        <th class="right">Unit</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>${lineItems}</tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>$${fmt(invoice.subTotal)}</span></div>
    <div class="totals-row"><span>Tax</span><span>$${fmt(invoice.taxAmount)}</span></div>
    <div class="totals-row total"><span>Total</span><span>$${fmt(invoice.totalAmount)}</span></div>
  </div>

  ${paymentBlock}
  ${notesBlock}

  <div class="footer">
    Thank you for your business &middot; Generated ${escapeHtml(new Date().toLocaleString())}
  </div>
</body>
</html>`;
};

/**
 * Read-only invoice viewer for legacy DB invoices that pre-date the Stripe integration.
 * Stripe-backed invoices use the Stripe-hosted page instead — this modal is the fallback.
 */
const LegacyInvoiceModal: React.FC<Props> = ({ invoice, onClose }) => {
  const handlePrint = () => {
    // Open a fresh window with a clean printable HTML document, then auto-fire
    // the print dialog inside it. Avoids printing the surrounding SPA chrome.
    const win = window.open('', '_blank', 'width=720,height=900,noopener=no,noreferrer=no');
    if (!win) {
      // Pop-up blocked → fall back to printing the current page. The existing
      // `print:` Tailwind classes on this modal will at least make the result
      // somewhat readable.
      window.print();
      return;
    }
    win.document.open();
    win.document.write(buildReceiptHtml(invoice));
    win.document.close();
    // Some browsers (Safari) need the load event before the print dialog will
    // pick up styles; others fire immediately. Use both: an onload handler and
    // a short fallback timeout, with cleanup-on-close.
    const triggerPrint = () => {
      try {
        win.focus();
        win.print();
      } catch {
        /* user-cancelled or browser-blocked — let them close manually */
      }
    };
    win.onafterprint = () => win.close();
    if (win.document.readyState === 'complete') {
      triggerPrint();
    } else {
      win.addEventListener('load', triggerPrint, { once: true });
      // Fallback in case the load event is missed (older Edge / Safari quirks).
      setTimeout(triggerPrint, 400);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:bg-transparent print:static print:items-start">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col print:shadow-none print:max-h-none print:overflow-visible print:w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between print:border-none">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Invoice #{invoice.invoiceNumber}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {invoice.customerName} · Issued {new Date(invoice.issuedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${statusBadge(invoice.status)}`}>
              {InvoiceStatusLabel[invoice.status]}
            </span>
            <button onClick={handlePrint} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium">
              Print
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Close">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-sm">
          {/* Billing period + due date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Billing Period</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">
                {new Date(invoice.billingPeriodStart).toLocaleDateString()} → {new Date(invoice.billingPeriodEnd).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Due Date</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">{new Date(invoice.dueDate).toLocaleDateString()}</div>
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wider">Line Items</div>
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Description</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Unit</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {invoice.lineItems.length === 0 ? (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-500">No line items.</td></tr>
                  ) : invoice.lineItems.map(li => (
                    <tr key={li.id}>
                      <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{li.description}</td>
                      <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{li.quantity}</td>
                      <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">${fmt(li.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100">${fmt(li.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1">
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Subtotal</span>
                <span>${fmt(invoice.subTotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Tax</span>
                <span>${fmt(invoice.taxAmount)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700 font-bold text-gray-900 dark:text-white">
                <span>Total</span>
                <span>${fmt(invoice.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Payment info */}
          {(invoice.paidAt || invoice.paymentReference) && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-xs">
              {invoice.paidAt && (
                <div className="text-green-800 dark:text-green-300">
                  <span className="font-semibold">Paid on:</span> {new Date(invoice.paidAt).toLocaleString()}
                </div>
              )}
              {invoice.paymentReference && (
                <div className="text-green-800 dark:text-green-300 mt-1">
                  <span className="font-semibold">Reference:</span> {invoice.paymentReference}
                </div>
              )}
            </div>
          )}

          {invoice.notes && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-semibold">Notes:</span> {invoice.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LegacyInvoiceModal;
