import { useState, useCallback } from 'react';
import PageMeta from '../../components/common/PageMeta';
import { useStore } from '../../context/StoreContext';
import type { DashboardFilters } from '../../services/dashboardService';
import DashboardFiltersBar from '../../components/dashboard/DashboardFilters';
import KpiCards from '../../components/dashboard/KpiCards';
import SalesTrendChart from '../../components/dashboard/SalesTrendChart';
import RevenueExpenseChart from '../../components/dashboard/RevenueExpenseChart';
import TopSellingItemsChart from '../../components/dashboard/TopSellingItemsChart';
import SalesByDepartmentChart from '../../components/dashboard/SalesByDepartmentChart';
import InvoiceStatusChart from '../../components/dashboard/InvoiceStatusChart';
import RecentInvoicesTable from '../../components/dashboard/RecentInvoicesTable';
import PurchaseOverview from '../../components/dashboard/PurchaseOverview';
import LowStockItems from '../../components/dashboard/LowStockItems';
import CustomerAging from '../../components/dashboard/CustomerAging';
import SupplierAging from '../../components/dashboard/SupplierAging';
import NotificationPanel from '../../components/dashboard/NotificationPanel';

export default function Home() {
  const { currentStore } = useStore();

  const [filters, setFilters] = useState<DashboardFilters>({
    storeId: currentStore?.storeId,
  });

  const handleFiltersChange = useCallback((newFilters: DashboardFilters) => {
    setFilters(newFilters);
  }, []);

  return (
    <>
      <PageMeta title="RDT Systems" description="RDT BackOffice Dashboard" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Business overview and key metrics
          </p>
        </div>
        <DashboardFiltersBar filters={filters} onFiltersChange={handleFiltersChange} />
      </div>

      {/* KPI Cards */}
      <section className="mb-6">
        <KpiCards filters={filters} />
      </section>

      {/* Charts Row 1 - Sales Trend & Revenue vs Expenses */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <SalesTrendChart filters={filters} />
        <RevenueExpenseChart filters={filters} />
      </section>

      {/* Charts Row 2 - Top Items, Sales by Dept, Invoice Status */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <TopSellingItemsChart filters={filters} />
        <SalesByDepartmentChart filters={filters} />
        <InvoiceStatusChart filters={filters} />
      </section>

      {/* Purchase Overview & Low Stock */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <PurchaseOverview filters={filters} />
        <LowStockItems filters={filters} />
      </section>

      {/* Recent Invoices - Full width */}
      <section className="mb-6">
        <RecentInvoicesTable filters={filters} />
      </section>

      {/* Aging & Notifications */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <CustomerAging filters={filters} />
        <SupplierAging filters={filters} />
        <NotificationPanel filters={filters} />
      </section>
    </>
  );
}
