import React from 'react';
import Chart from 'react-apexcharts';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import { useLazyLoad } from '../../hooks/useLazyLoad';
import { dashboardService, type DashboardFilters } from '../../services/dashboardService';
import { DonutSkeleton, CardErrorState } from './SkeletonLoader';

interface Props {
  filters: DashboardFilters;
}

const STATUS_COLORS: Record<string, string> = {
  Completed: '#10b981',
  Pending: '#f59e0b',
  Cancelled: '#ef4444',
  Voided: '#6b7280',
};

const DEFAULT_COLOR = '#94a3b8';

const formatCurrency = (val: number): string => {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
};

const InvoiceStatusChart: React.FC<Props> = ({ filters }) => {
  const [ref, isVisible] = useLazyLoad();

  const { data, isLoading, error, refetch } = useDashboardApi(
    () => dashboardService.getInvoiceStatusBreakdown(filters),
    [filters.storeId, filters.dateFrom, filters.dateTo],
    isVisible
  );

  const isDark = document.documentElement.classList.contains('dark');

  const statuses = data?.statuses ?? [];
  const colors = statuses.map((s) => STATUS_COLORS[s.status] ?? DEFAULT_COLOR);

  const chartOptions: ApexCharts.ApexOptions = {
    theme: { mode: isDark ? 'dark' : 'light' },
    chart: {
      background: 'transparent',
      toolbar: { show: false },
      fontFamily: 'inherit',
    },
    colors,
    labels: statuses.map((s) => s.status),
    legend: {
      position: 'bottom',
      labels: {
        colors: isDark ? '#d1d5db' : '#374151',
      },
      markers: {
        size: 4,
        shape: 'circle',
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '13px',
              fontWeight: 600,
              color: isDark ? '#d1d5db' : '#374151',
              offsetY: -8,
            },
            value: {
              show: true,
              fontSize: '20px',
              fontWeight: 700,
              color: isDark ? '#f9fafb' : '#111827',
              offsetY: 4,
              formatter: () => data ? data.totalCount.toLocaleString() : '0',
            },
            total: {
              show: true,
              label: 'Total Invoices',
              fontSize: '12px',
              fontWeight: 500,
              color: isDark ? '#9ca3af' : '#6b7280',
              formatter: () => data ? formatCurrency(data.totalAmount) : '$0',
            },
          },
        },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (_val: number, opts: { seriesIndex: number; w: { globals: { series: number[] } } }) => {
        const total = opts.w.globals.series.reduce((a: number, b: number) => a + b, 0);
        const current = opts.w.globals.series[opts.seriesIndex];
        const pct = total > 0 ? ((current / total) * 100).toFixed(1) : '0';
        return `${pct}%`;
      },
      style: {
        fontSize: '11px',
        fontWeight: 600,
      },
      dropShadow: { enabled: false },
    },
    stroke: {
      width: 2,
      colors: [isDark ? '#1f2937' : '#ffffff'],
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      custom: ({ seriesIndex }) => {
        const status = statuses[seriesIndex];
        if (!status) return '';
        return `
          <div class="px-3 py-2 text-sm">
            <div class="font-semibold">${status.status}</div>
            <div>Count: ${status.count.toLocaleString()}</div>
            <div>Amount: ${formatCurrency(status.amount)}</div>
          </div>
        `;
      },
    },
  };

  const chartSeries: number[] = statuses.map((s) => s.count);

  return (
    <div
      ref={ref}
      className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dash-fade-in"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Invoice Status
        </h3>
      </div>

      {isLoading ? (
        <DonutSkeleton />
      ) : error ? (
        <CardErrorState message={error} onRetry={refetch} />
      ) : !statuses.length ? (
        <div className="flex items-center justify-center h-64 text-sm text-gray-400 dark:text-gray-500">
          No invoice data available.
        </div>
      ) : (
        <Chart
          options={chartOptions}
          series={chartSeries}
          type="donut"
          height={320}
        />
      )}
    </div>
  );
};

export default InvoiceStatusChart;
