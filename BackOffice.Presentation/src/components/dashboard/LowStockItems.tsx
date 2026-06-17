import React from 'react';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import { useLazyLoad } from '../../hooks/useLazyLoad';
import { dashboardService, type DashboardFilters, type LowStockItem } from '../../services/dashboardService';
import { TableSkeleton, CardErrorState } from './SkeletonLoader';

interface Props {
  filters: DashboardFilters;
}

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getRowClasses = (item: LowStockItem): string => {
  if (item.currentQty === 0) {
    return 'bg-red-50 dark:bg-red-900/15 text-red-700 dark:text-red-400';
  }
  if (item.currentQty < item.reorderLevel / 2) {
    return 'bg-amber-50 dark:bg-amber-900/15';
  }
  return '';
};

const LowStockItems: React.FC<Props> = ({ filters }) => {
  const [ref, isVisible] = useLazyLoad();

  const { data, isLoading, error, refetch } = useDashboardApi<LowStockItem[]>(
    () => dashboardService.getLowStockItems(filters.storeId, 20),
    [filters.storeId],
    isVisible
  );

  const items = data ?? [];

  return (
    <div ref={ref} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dash-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Low Stock Items</h3>
        {items.length > 0 && (
          <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {items.length}
          </span>
        )}
      </div>

      {!isVisible || isLoading ? (
        <TableSkeleton rows={5} />
      ) : error || !data ? (
        <CardErrorState message={error || 'Failed to load low stock items'} onRetry={refetch} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <svg className="w-10 h-10 text-green-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">All items are well stocked</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-left">
                <th className="pb-3 pr-4 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Item Name</th>
                <th className="pb-3 pr-4 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Store</th>
                <th className="pb-3 pr-4 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider text-right">Current Qty</th>
                <th className="pb-3 pr-4 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider text-right">Reorder Level</th>
                <th className="pb-3 font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider text-right">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {items.map((item, idx) => {
                const rowClass = getRowClasses(item);
                return (
                  <tr key={`${item.itemName}-${item.storeName}-${idx}`} className={`${rowClass} hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors`}>
                    <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white truncate max-w-[180px]">
                      <div className="flex items-center gap-2">
                        {item.currentQty === 0 && (
                          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                          </svg>
                        )}
                        <span className="truncate">{item.itemName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400 truncate max-w-[120px]">{item.storeName}</td>
                    <td className={`py-2.5 pr-4 text-right font-medium ${item.currentQty === 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-900 dark:text-white'}`}>
                      {item.currentQty}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-gray-500 dark:text-gray-400">{item.reorderLevel}</td>
                    <td className="py-2.5 text-right text-gray-900 dark:text-white whitespace-nowrap">{fmt(item.price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LowStockItems;
