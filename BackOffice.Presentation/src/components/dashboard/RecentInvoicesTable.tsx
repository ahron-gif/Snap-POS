import React, { useState } from 'react';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import { useLazyLoad } from '../../hooks/useLazyLoad';
import { dashboardService, type DashboardFilters, type PagedResult, type RecentInvoice } from '../../services/dashboardService';
import { TableSkeleton, CardErrorState } from './SkeletonLoader';

interface Props {
  filters: DashboardFilters;
}

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusColors: Record<string, string> = {
  Completed: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  Pending: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  Cancelled: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  Voided: 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400',
};

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

const RecentInvoicesTable: React.FC<Props> = ({ filters }) => {
  const [ref, isVisible] = useLazyLoad();
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading, error, refetch } = useDashboardApi<PagedResult<RecentInvoice>>(
    () => dashboardService.getRecentInvoices(filters, page, pageSize),
    [filters.storeId, filters.dateFrom, filters.dateTo, page],
    isVisible
  );

  return (
    <div ref={ref} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dash-fade-in">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Recent Invoices</h3>

      {!isVisible || isLoading ? (
        <TableSkeleton rows={5} />
      ) : error || !data ? (
        <CardErrorState message={error || 'Failed to load recent invoices'} onRetry={refetch} />
      ) : data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No invoices found</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-left">
                  <th className="pb-3 pr-4 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Transaction #</th>
                  <th className="pb-3 pr-4 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Customer</th>
                  <th className="pb-3 pr-4 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Store</th>
                  <th className="pb-3 pr-4 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider text-center">Items</th>
                  <th className="pb-3 pr-4 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider text-right">Amount</th>
                  <th className="pb-3 pr-4 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider text-center">Status</th>
                  <th className="pb-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {data.items.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">{inv.transactionNo}</td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 truncate max-w-[160px]">{inv.customer}</td>
                    <td className="py-3 pr-4 text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{inv.storeName}</td>
                    <td className="py-3 pr-4 text-gray-500 dark:text-gray-400 text-center">{inv.itemCount}</td>
                    <td className="py-3 pr-4 text-gray-900 dark:text-white font-medium text-right whitespace-nowrap">{fmt(inv.amount)}</td>
                    <td className="py-3 pr-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.status] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(inv.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Page {data.page} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RecentInvoicesTable;
