import React, { useState } from 'react';
import Chart from 'react-apexcharts';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import { useLazyLoad } from '../../hooks/useLazyLoad';
import { dashboardService, type DashboardFilters } from '../../services/dashboardService';
import { ChartSkeleton, CardErrorState } from './SkeletonLoader';

interface Props {
  filters: DashboardFilters;
}

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

const periods: { label: string; value: Period }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

const formatCurrency = (val: number): string => {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
};

const SalesTrendChart: React.FC<Props> = ({ filters }) => {
  const [period, setPeriod] = useState<Period>('monthly');
  const [ref, isVisible] = useLazyLoad();

  const { data, isLoading, error, refetch } = useDashboardApi(
    () => dashboardService.getSalesTrend(filters, period),
    [filters.storeId, filters.dateFrom, filters.dateTo, period],
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
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 90, 100],
      },
    },
    colors: ['#1e40af'],
    xaxis: {
      categories: data?.map((p) => p.label) ?? [],
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
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: {
        formatter: (val: number) => formatCurrency(val),
      },
      custom: ({ series, seriesIndex, dataPointIndex }) => {
        const point = data?.[dataPointIndex];
        if (!point) return '';
        return `
          <div class="px-3 py-2 text-sm">
            <div class="font-semibold">${point.label}</div>
            <div>Amount: ${formatCurrency(point.amount)}</div>
            <div>Count: ${point.count}</div>
          </div>
        `;
      },
    },
  };

  const chartSeries: ApexAxisChartSeries = [
    {
      name: 'Sales',
      data: data?.map((p) => p.amount) ?? [],
    },
  ];

  return (
    <div
      ref={ref}
      className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dash-fade-in"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Sales Trend
        </h3>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                period === p.value
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <ChartSkeleton />
      ) : error ? (
        <CardErrorState message={error} onRetry={refetch} />
      ) : !data || data.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-sm text-gray-400 dark:text-gray-500">
          No sales data available for this period.
        </div>
      ) : (
        <Chart
          options={chartOptions}
          series={chartSeries}
          type="area"
          height={320}
        />
      )}
    </div>
  );
};

export default SalesTrendChart;
