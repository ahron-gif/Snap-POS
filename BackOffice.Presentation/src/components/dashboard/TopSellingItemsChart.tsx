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

const truncate = (str: string, max: number): string =>
  str.length > max ? `${str.slice(0, max)}...` : str;

const TopSellingItemsChart: React.FC<Props> = ({ filters }) => {
  const [ref, isVisible] = useLazyLoad();

  const { data, isLoading, error, refetch } = useDashboardApi(
    () => dashboardService.getTopSellingItems(filters),
    [filters.storeId, filters.dateFrom, filters.dateTo],
    isVisible
  );

  const isDark = document.documentElement.classList.contains('dark');

  const items = data?.slice(0, 10) ?? [];

  const chartOptions: ApexCharts.ApexOptions = {
    theme: { mode: isDark ? 'dark' : 'light' },
    chart: {
      background: 'transparent',
      toolbar: { show: false },
      fontFamily: 'inherit',
    },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: '65%',
        borderRadius: 4,
      },
    },
    colors: ['#1e40af'],
    xaxis: {
      labels: {
        formatter: (val: string) => formatCurrency(Number(val)),
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
        style: {
          colors: isDark ? '#9ca3af' : '#6b7280',
          fontSize: '11px',
        },
        maxWidth: 160,
      },
    },
    grid: {
      borderColor: isDark ? '#374151' : '#f3f4f6',
      strokeDashArray: 4,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
    dataLabels: { enabled: false },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      custom: ({ dataPointIndex }) => {
        const item = items[dataPointIndex];
        if (!item) return '';
        return `
          <div class="px-3 py-2 text-sm">
            <div class="font-semibold">${item.name}</div>
            <div>Revenue: ${formatCurrency(item.totalRevenue)}</div>
            <div>Qty Sold: ${item.totalQty.toLocaleString()}</div>
          </div>
        `;
      },
    },
  };

  const chartSeries: ApexAxisChartSeries = [
    {
      name: 'Revenue',
      data: items.map((item) => ({
        x: truncate(item.name, 20),
        y: item.totalRevenue,
      })),
    },
  ];

  return (
    <div
      ref={ref}
      className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dash-fade-in"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Top Selling Items
        </h3>
      </div>

      {isLoading ? (
        <ChartSkeleton height="h-96" />
      ) : error ? (
        <CardErrorState message={error} onRetry={refetch} />
      ) : !items.length ? (
        <div className="flex items-center justify-center h-64 text-sm text-gray-400 dark:text-gray-500">
          No selling data available.
        </div>
      ) : (
        <Chart
          options={chartOptions}
          series={chartSeries}
          type="bar"
          height={Math.max(items.length * 40, 200)}
        />
      )}
    </div>
  );
};

export default TopSellingItemsChart;
