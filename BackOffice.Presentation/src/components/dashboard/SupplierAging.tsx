import React from 'react';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import { useLazyLoad } from '../../hooks/useLazyLoad';
import { dashboardService, type DashboardFilters, type AgingData } from '../../services/dashboardService';
import { AgingSkeleton, CardErrorState } from './SkeletonLoader';

interface Props {
  filters: DashboardFilters;
}

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface AgingBucket {
  label: string;
  value: number;
  barColor: string;
  textColor: string;
}

const buildBuckets = (data: AgingData): AgingBucket[] => [
  {
    label: 'Current',
    value: data.current,
    barColor: 'bg-green-500',
    textColor: 'text-green-600 dark:text-green-400',
  },
  {
    label: '30+ Days',
    value: data.over30,
    barColor: 'bg-yellow-500',
    textColor: 'text-yellow-600 dark:text-yellow-400',
  },
  {
    label: '60+ Days',
    value: data.over60,
    barColor: 'bg-orange-500',
    textColor: 'text-orange-600 dark:text-orange-400',
  },
  {
    label: '90+ Days',
    value: data.over90,
    barColor: 'bg-red-500',
    textColor: 'text-red-600 dark:text-red-400',
  },
  {
    label: '120+ Days',
    value: data.over120,
    barColor: 'bg-red-800',
    textColor: 'text-red-800 dark:text-red-300',
  },
];

const SupplierAging: React.FC<Props> = ({ filters }) => {
  const [ref, isVisible] = useLazyLoad();

  const { data, isLoading, error, refetch } = useDashboardApi<AgingData>(
    () => dashboardService.getSupplierAging(filters.storeId),
    [filters.storeId],
    isVisible
  );

  return (
    <div ref={ref} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dash-fade-in">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Supplier Aging</h3>

      {!isVisible || isLoading ? (
        <AgingSkeleton />
      ) : error || !data ? (
        <CardErrorState message={error || 'Failed to load supplier aging'} onRetry={refetch} />
      ) : (
        <>
          <div className="space-y-3">
            {buildBuckets(data).map((bucket) => {
              const pct = data.total > 0 ? (bucket.value / data.total) * 100 : 0;
              return (
                <div key={bucket.label} className="flex items-center gap-3">
                  <span className={`text-xs font-medium w-20 flex-shrink-0 ${bucket.textColor}`}>
                    {bucket.label}
                  </span>
                  <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${bucket.barColor} rounded-full transition-all duration-500 ease-out`}
                      style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-24 text-right flex-shrink-0">
                    {fmt(bucket.value)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="border-t border-gray-100 dark:border-gray-700 mt-4 pt-3 flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Suppliers</span>
              <div className="text-sm font-bold text-gray-900 dark:text-white">{data.supplierCount ?? 0}</div>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500 dark:text-gray-400">Total Payable</span>
              <div className="text-sm font-bold text-gray-900 dark:text-white">{fmt(data.total)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SupplierAging;
