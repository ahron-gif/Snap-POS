import React from 'react';
import Chart from 'react-apexcharts';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import { useLazyLoad } from '../../hooks/useLazyLoad';
import { dashboardService, type DashboardFilters } from '../../services/dashboardService';
import { DonutSkeleton, CardErrorState } from './SkeletonLoader';

interface Props {
  filters: DashboardFilters;
}

const COLORS = [
  '#1e40af',
  '#7c3aed',
  '#06b6d4',
  '#f59e0b',
  '#ef4444',
  '#10b981',
  '#ec4899',
  '#8b5cf6',
];

const formatCurrency = (val: number): string => {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
};

const SalesByDepartmentChart: React.FC<Props> = ({ filters }) => {
  const [ref, isVisible] = useLazyLoad();

  const { data, isLoading, error, refetch } = useDashboardApi(
    () => dashboardService.getSalesByDepartment(filters),
    [filters.storeId, filters.dateFrom, filters.dateTo],
    isVisible
  );

  const isDark = document.documentElement.classList.contains('dark');

  const chartOptions: ApexCharts.ApexOptions = {
    theme: { mode: isDark ? 'dark' : 'light' },
    chart: {
      background: 'transparent',
      toolbar: { show: false },
      fontFamily: 'inherit',
    },
    colors: COLORS,
    labels: data?.map((d) => d.departmentName) ?? [],
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
          size: '60%',
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
      y: {
        formatter: (val: number) => formatCurrency(val),
      },
    },
  };

  const chartSeries: number[] = data?.map((d) => d.totalSales) ?? [];

  return (
    <div
      ref={ref}
      className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dash-fade-in"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Sales by Department
        </h3>
      </div>

      {isLoading ? (
        <DonutSkeleton />
      ) : error ? (
        <CardErrorState message={error} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-sm text-gray-400 dark:text-gray-500">
          No department sales data available.
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

export default SalesByDepartmentChart;
