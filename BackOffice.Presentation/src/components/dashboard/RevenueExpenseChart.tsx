import React from 'react';
import Chart from 'react-apexcharts';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import { useLazyLoad } from '../../hooks/useLazyLoad';
import { dashboardService, type DashboardFilters } from '../../services/dashboardService';
import { ChartSkeleton, CardErrorState } from './SkeletonLoader';

interface Props {
  filters: DashboardFilters;
}

const formatCurrency = (val: number): string => {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
};

const RevenueExpenseChart: React.FC<Props> = ({ filters }) => {
  const [ref, isVisible] = useLazyLoad();

  const { data, isLoading, error, refetch } = useDashboardApi(
    () => dashboardService.getRevenueVsExpenses(filters),
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
    plotOptions: {
      bar: {
        columnWidth: '60%',
        borderRadius: 4,
      },
    },
    colors: ['#1e40af', '#f87171'],
    xaxis: {
      categories: data?.map((d) => d.month) ?? [],
      labels: {
        style: {
          colors: isDark ? '#9ca3af' : '#6b7280',
          fontSize: '11px',
        },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        formatter: (val: number) => formatCurrency(val),
        style: {
          colors: isDark ? '#9ca3af' : '#6b7280',
          fontSize: '11px',
        },
      },
    },
    grid: {
      borderColor: isDark ? '#374151' : '#f3f4f6',
      strokeDashArray: 4,
    },
    dataLabels: { enabled: false },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      labels: {
        colors: isDark ? '#d1d5db' : '#374151',
      },
      markers: {
        size: 4,
        shape: 'circle',
      },
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: {
        formatter: (val: number) => formatCurrency(val),
      },
    },
  };

  const chartSeries: ApexAxisChartSeries = [
    {
      name: 'Revenue',
      data: data?.map((d) => d.revenue) ?? [],
    },
    {
      name: 'Expenses',
      data: data?.map((d) => d.expenses) ?? [],
    },
  ];

  return (
    <div
      ref={ref}
      className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dash-fade-in"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Revenue vs Expenses
        </h3>
      </div>

      {isLoading ? (
        <ChartSkeleton />
      ) : error ? (
        <CardErrorState message={error} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-sm text-gray-400 dark:text-gray-500">
          No revenue/expense data available.
        </div>
      ) : (
        <Chart
          options={chartOptions}
          series={chartSeries}
          type="bar"
          height={320}
        />
      )}
    </div>
  );
};

export default RevenueExpenseChart;
