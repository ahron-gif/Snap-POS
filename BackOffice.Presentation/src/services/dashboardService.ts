import { BASE_API_URL } from '../constants/api';

// ─── Interfaces ──────────────────────────────────────────

export interface ApiResult<T> {
  isSuccess: boolean;
  message: string;
  response: T | null;
}

export interface DashboardFilters {
  storeId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface KpiCards {
  todaySalesAmount: number;
  todaySalesCount: number;
  todaySalesChange: number;
  todayPurchasesAmount: number;
  todayPurchasesCount: number;
  todayPurchasesChange: number;
  todayProfit: number;
  todayProfitChange: number;
  totalCustomers: number;
  customersChange: number;
  totalSuppliers: number;
  suppliersChange: number;
  totalActiveItems: number;
  activeItemsChange: number;
  pendingOrders: number;
  pendingOrdersChange: number;
  lowStockAlerts: number;
  totalReceivables: number;
  receivablesChange: number;
  totalPayables: number;
  payablesChange: number;
  monthlyRevenue: number;
  monthlyRevenueChange: number;
}

export interface SalesTrendPoint {
  label: string;
  amount: number;
  count: number;
}

export interface RevenueExpense {
  month: string;
  revenue: number;
  expenses: number;
}

export interface TopSellingItem {
  name: string;
  totalQty: number;
  totalRevenue: number;
}

export interface SalesByDepartment {
  departmentName: string;
  totalSales: number;
}

export interface InvoiceStatusItem {
  status: string;
  count: number;
  amount: number;
}

export interface InvoiceStatusBreakdown {
  statuses: InvoiceStatusItem[];
  totalCount: number;
  totalAmount: number;
}

export interface RecentInvoice {
  id: string;
  transactionNo: string;
  customer: string;
  amount: number;
  status: string;
  date: string;
  itemCount: number;
  storeName: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PurchaseOverview {
  pendingCount: number;
  pendingAmount: number;
  partialCount: number;
  partialAmount: number;
  completedCount: number;
  completedAmount: number;
  cancelledCount: number;
  cancelledAmount: number;
  totalCount: number;
  totalAmount: number;
}

export interface LowStockItem {
  itemName: string;
  currentQty: number;
  reorderLevel: number;
  storeName: string;
  cost: number;
  price: number;
}

export interface AgingData {
  current: number;
  over30: number;
  over60: number;
  over90: number;
  over120: number;
  total: number;
  customerCount?: number;
  supplierCount?: number;
}

export interface DashboardNotification {
  type: string;
  title: string;
  message: string;
  severity: string;
  timestamp: string;
}

// ─── Service ─────────────────────────────────────────────

class DashboardService {
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('accessToken');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        if (parsed.customerId) headers['CustomerId'] = parsed.customerId.toString();
      } catch { /* ignore */ }
    }
    return headers;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildUrl(path: string, params: Record<string, any> = {}): string {
    const url = new URL(`${BASE_API_URL}/api/Dashboard/${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
    return url.toString();
  }

  private async fetchApi<T>(url: string): Promise<ApiResult<T>> {
    try {
      const response = await fetch(url, { method: 'GET', headers: this.getAuthHeaders() });
      const data = await response.json();
      if (!response.ok) return { isSuccess: false, message: data.message || 'Request failed', response: null };
      return data;
    } catch {
      return { isSuccess: false, message: 'Network error. Please try again.', response: null };
    }
  }

  async getKpiCards(filters: DashboardFilters = {}): Promise<ApiResult<KpiCards>> {
    return this.fetchApi<KpiCards>(this.buildUrl('kpi', filters));
  }

  async getSalesTrend(filters: DashboardFilters = {}, period = 'monthly'): Promise<ApiResult<SalesTrendPoint[]>> {
    return this.fetchApi<SalesTrendPoint[]>(this.buildUrl('sales-trend', { ...filters, period }));
  }

  async getRevenueVsExpenses(filters: DashboardFilters = {}): Promise<ApiResult<RevenueExpense[]>> {
    return this.fetchApi<RevenueExpense[]>(this.buildUrl('revenue-expenses', filters));
  }

  async getTopSellingItems(filters: DashboardFilters = {}, count = 10): Promise<ApiResult<TopSellingItem[]>> {
    return this.fetchApi<TopSellingItem[]>(this.buildUrl('top-selling-items', { ...filters, count }));
  }

  async getSalesByDepartment(filters: DashboardFilters = {}): Promise<ApiResult<SalesByDepartment[]>> {
    return this.fetchApi<SalesByDepartment[]>(this.buildUrl('sales-by-department', filters));
  }

  async getInvoiceStatusBreakdown(filters: DashboardFilters = {}): Promise<ApiResult<InvoiceStatusBreakdown>> {
    return this.fetchApi<InvoiceStatusBreakdown>(this.buildUrl('invoice-status', filters));
  }

  async getRecentInvoices(filters: DashboardFilters = {}, page = 1, pageSize = 10): Promise<ApiResult<PagedResult<RecentInvoice>>> {
    return this.fetchApi<PagedResult<RecentInvoice>>(this.buildUrl('recent-invoices', { ...filters, page, pageSize }));
  }

  async getPurchaseOverview(filters: DashboardFilters = {}): Promise<ApiResult<PurchaseOverview>> {
    return this.fetchApi<PurchaseOverview>(this.buildUrl('purchase-overview', filters));
  }

  async getLowStockItems(storeId?: string, count = 20): Promise<ApiResult<LowStockItem[]>> {
    return this.fetchApi<LowStockItem[]>(this.buildUrl('low-stock', { storeId, count }));
  }

  async getCustomerAging(storeId?: string): Promise<ApiResult<AgingData>> {
    return this.fetchApi<AgingData>(this.buildUrl('customer-aging', { storeId }));
  }

  async getSupplierAging(storeId?: string): Promise<ApiResult<AgingData>> {
    return this.fetchApi<AgingData>(this.buildUrl('supplier-aging', { storeId }));
  }

  async getNotifications(storeId?: string): Promise<ApiResult<DashboardNotification[]>> {
    return this.fetchApi<DashboardNotification[]>(this.buildUrl('notifications', { storeId }));
  }
}

export const dashboardService = new DashboardService();
