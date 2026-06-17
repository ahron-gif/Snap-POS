import React from 'react';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import { useLazyLoad } from '../../hooks/useLazyLoad';
import { dashboardService, type DashboardFilters, type PurchaseOverview as PurchaseOverviewData } from '../../services/dashboardService';
import { TableSkeleton, CardErrorState } from './SkeletonLoader';

interface Props {
  filters: DashboardFilters;
}

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface StatusCard {
  label: string;
  count: number;
  amount: number;
  bgColor: string;
  textColor: string;
  iconColor: string;
  icon: React.ReactNode;
}

const PurchaseOverview: React.FC<Props> = ({ filters }) => {
  const [ref, isVisible] = useLazyLoad();

  const { data, isLoading, error, refetch } = useDashboardApi<PurchaseOverviewData>(
    () => dashboardService.getPurchaseOverview(filters),
    [filters.storeId, filters.dateFrom, filters.dateTo],
    isVisible
  );

  const buildCards = (d: PurchaseOverviewData): StatusCard[] => [
    {
      label: 'Pending',
      count: d.pendingCount,
      amount: d.pendingAmount,
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      textColor: 'text-amber-700 dark:text-amber-400',
      iconColor: 'text-amber-500',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Partial',
      count: d.partialCount,
      amount: d.partialAmount,
      bgColor: 'bg-brand-50 dark:bg-brand-900/20',
      textColor: 'text-brand-700 dark:text-brand-400',
      iconColor: 'text-brand-500',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
        </svg>
      ),
    },
    {
      label: 'Completed',
      count: d.completedCount,
      amount: d.completedAmount,
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-700 dark:text-green-400',
      iconColor: 'text-green-500',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Cancelled',
      count: d.cancelledCount,
      amount: d.cancelledAmount,
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-700 dark:text-red-400',
      iconColor: 'text-red-500',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div ref={ref} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dash-fade-in">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Purchase Overview</h3>

      {!isVisible || isLoading ? (
        <TableSkeleton rows={3} />
      ) : error || !data ? (
        <CardErrorState message={error || 'Failed to load purchase overview'} onRetry={refetch} />
      ) : (
        <>
          {/* 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {buildCards(data).map((card) => (
              <div key={card.label} className={`rounded-xl p-3.5 ${card.bgColor} transition-colors`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={card.iconColor}>{card.icon}</span>
                  <span className={`text-xs font-medium ${card.textColor}`}>{card.label}</span>
                </div>
                <div className={`text-lg font-bold ${card.textColor}`}>{card.count}</div>
                <div className={`text-xs ${card.textColor} opacity-80 mt-0.5`}>{fmt(card.amount)}</div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Total Orders</span>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{data.totalCount}</div>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500 dark:text-gray-400">Total Amount</span>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{fmt(data.totalAmount)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PurchaseOverview;
