import React from 'react';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import { dashboardService, type KpiCards as KpiData, type DashboardFilters } from '../../services/dashboardService';
import { KpiCardSkeleton, CardErrorState } from './SkeletonLoader';

interface Props {
  filters: DashboardFilters;
}

interface KpiCardItem {
  label: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  color: string;
  subLabel?: string;
}

const formatCurrency = (val: number) => {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
};

const formatNumber = (val: number) => {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString();
};

const ChangeBadge: React.FC<{ value: number }> = ({ value }) => {
  if (value === 0) return <span className="text-xs text-gray-400">--</span>;
  const isPositive = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${
      isPositive
        ? 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
        : 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
    }`}>
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d={isPositive ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
      </svg>
      {Math.abs(value).toFixed(1)}%
    </span>
  );
};

const kpiIcons = {
  sales: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  purchase: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  ),
  profit: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  ),
  customers: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  suppliers: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  ),
  items: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  pending: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  lowstock: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  receivable: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
  payable: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  ),
};

const colorMap: Record<string, string> = {
  blue: 'bg-brand-50 text-brand-500 dark:bg-brand-900/20 dark:text-brand-400',
  green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
  red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
  indigo: 'bg-brand-50 text-brand-500 dark:bg-brand-900/20 dark:text-brand-400',
  teal: 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
};

const buildCards = (data: KpiData): KpiCardItem[] => [
  { label: "Today's Sales", value: formatCurrency(data.todaySalesAmount), change: data.todaySalesChange, icon: kpiIcons.sales, color: 'blue', subLabel: `${data.todaySalesCount} transactions` },
  { label: "Today's Purchases", value: formatCurrency(data.todayPurchasesAmount), change: data.todayPurchasesChange, icon: kpiIcons.purchase, color: 'purple', subLabel: `${data.todayPurchasesCount} orders` },
  { label: "Today's Profit", value: formatCurrency(data.todayProfit), change: data.todayProfitChange, icon: kpiIcons.profit, color: 'green' },
  { label: 'Customers', value: formatNumber(data.totalCustomers), change: data.customersChange, icon: kpiIcons.customers, color: 'cyan' },
  { label: 'Suppliers', value: formatNumber(data.totalSuppliers), change: data.suppliersChange, icon: kpiIcons.suppliers, color: 'orange' },
  { label: 'Active Items', value: formatNumber(data.totalActiveItems), change: data.activeItemsChange, icon: kpiIcons.items, color: 'indigo' },
  { label: 'Pending Orders', value: formatNumber(data.pendingOrders), change: data.pendingOrdersChange, icon: kpiIcons.pending, color: 'amber' },
  { label: 'Low Stock Alerts', value: formatNumber(data.lowStockAlerts), change: 0, icon: kpiIcons.lowstock, color: 'red' },
  { label: 'Receivables', value: formatCurrency(data.totalReceivables), change: data.receivablesChange, icon: kpiIcons.receivable, color: 'teal' },
  { label: 'Payables', value: formatCurrency(data.totalPayables), change: data.payablesChange, icon: kpiIcons.payable, color: 'rose' },
];

const KpiCards: React.FC<Props> = ({ filters }) => {
  const { data, isLoading, error, refetch } = useDashboardApi(
    () => dashboardService.getKpiCards(filters),
    [filters.storeId, filters.dateFrom, filters.dateTo]
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => <KpiCardSkeleton key={i} />)}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <CardErrorState message={error || 'Failed to load KPIs'} onRetry={refetch} />
      </div>
    );
  }

  const cards = buildCards(data);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card, idx) => (
        <div
          key={card.label}
          className="dash-card rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm dash-fade-in"
          style={{ animationDelay: `${idx * 50}ms` }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className={`p-2 rounded-xl ${colorMap[card.color]}`}>
              {card.icon}
            </div>
            <ChangeBadge value={card.change} />
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{card.value}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{card.label}</div>
          {card.subLabel && (
            <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{card.subLabel}</div>
          )}
        </div>
      ))}
    </div>
  );
};

export default KpiCards;
