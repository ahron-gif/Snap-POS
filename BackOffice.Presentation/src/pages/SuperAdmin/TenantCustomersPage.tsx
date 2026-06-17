import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API_ENDPOINTS } from '../../constants/api';
import { useAuthHeaders } from '../../hooks/useAuthHeaders';
import LicenseSetupModal from './LicenseSetupModal';

type TenantCustomer = {
  customerId: number;
  customerName: string;
  serverName: string;
  dbName: string;
  dbUser: string;
  dbPass: string;
  environment: number;
  dateCreated?: string | null;
  dateModified?: string | null;
  systemUserCreated?: number | null;
  licenseKey?: string | null;
  email?: string | null;
};

type TenantCustomerForm = {
  customerName: string;
  serverName: string;
  dbName: string;
  dbUser: string;
  dbPass: string;
  environment: number;
  licenseKey: string;
  email: string;
};

const SkeletonRow: React.FC = () => (
  <tr className="animate-pulse">
    {[...Array(8)].map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
      </td>
    ))}
  </tr>
);

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
};

const TenantCustomersPage: React.FC = () => {
  const { getAuthHeaders } = useAuthHeaders();

  const [customers, setCustomers] = useState<TenantCustomer[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<TenantCustomer | null>(null);
  // WEB-152: eye-toggle for the DB Password field on the edit/create form.
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null
  );
  // License Setup modal — opens the FrmStartWz-equivalent screen for the
  // selected tenant. We keep the *whole* customer (not just id) so the modal
  // can show the name in its header without a second fetch.
  const [licenseCustomer, setLicenseCustomer] = useState<TenantCustomer | null>(null);

  const emptyForm: TenantCustomerForm = {
    customerName: '',
    serverName: '',
    dbName: '',
    dbUser: '',
    dbPass: '',
    environment: 1,
    licenseKey: '',
    email: '',
  };

  const [formData, setFormData] = useState<TenantCustomerForm>(emptyForm);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const params: Record<string, any> = {
        startRow: page * pageSize,
        endRow: (page + 1) * pageSize,
        sortColumn: 'DateCreated',
        sortDirection: 'desc',
      };
      if (search.trim()) {
        params.customGridSearchText = search.trim();
        params.customGridSearchColumns = 'CustomerName,DBName,Email,ServerName';
      }

      const response = await axios.get(API_ENDPOINTS.SUPERADMIN_CUSTOMERS.GET_ALL, {
        params,
        headers,
      });

      if (response.data?.isSuccess) {
        const payload = response.data.response;
        setCustomers(payload.data || []);
        setTotalRecords(payload.totalRecords || payload.data?.length || 0);
      } else {
        setToast({
          message: response.data?.message || 'Failed to load tenant customers',
          type: 'error',
        });
      }
    } catch (error: any) {
      setToast({
        message: error?.response?.data?.message || 'Failed to load tenant customers',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, page, pageSize, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData(emptyForm);
    setShowPassword(false);
    setShowModal(true);
  };

  const openEditModal = async (c: TenantCustomer) => {
    setEditingItem(c);
    // Pre-fill from the row data so the modal opens instantly.
    // Password is intentionally empty here — the list endpoint masks it for security.
    setFormData({
      customerName: c.customerName,
      serverName: c.serverName,
      dbName: c.dbName,
      dbUser: c.dbUser,
      dbPass: c.dbPass,
      environment: c.environment ?? 1,
      licenseKey: c.licenseKey || '',
      email: c.email || '',
    });
    setShowPassword(false);
    setShowModal(true);

    // WEB-152: fetch single-customer detail to get the decrypted password.
    // The list endpoint masks it; only the by-id endpoint returns it for the edit form.
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(API_ENDPOINTS.SUPERADMIN_CUSTOMERS.GET_BY_ID(c.customerId), {
        headers,
      });
      if (response.data?.isSuccess && response.data.response) {
        const detail = response.data.response;
        setFormData((prev) => ({
          ...prev,
          dbPass: detail.dbPass ?? '',
        }));
      }
    } catch {
      // If the detail call fails, the user still has a usable form — they just
      // need to type the new password. No need to show a blocking error.
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingItem) {
        const headers = getAuthHeaders();
        const dto = {
          customerName: formData.customerName,
          serverName: formData.serverName,
          dbName: formData.dbName,
          dbUser: formData.dbUser,
          dbPass: formData.dbPass,
          environment: formData.environment,
          licenseKey: formData.licenseKey,
          email: formData.email,
        };
        const response = await axios.put(API_ENDPOINTS.SUPERADMIN_CUSTOMERS.UPDATE(editingItem.customerId), dto, {
          headers,
        });
        if (!response.data?.isSuccess) {
          throw new Error(response.data?.message || 'Update failed');
        }
        setToast({ message: 'Tenant customer updated successfully', type: 'success' });
      } else {
        const headers = getAuthHeaders();
        const dto = {
          customerName: formData.customerName,
          serverName: formData.serverName,
          dbName: formData.dbName,
          dbUser: formData.dbUser,
          dbPass: formData.dbPass,
          environment: formData.environment,
          licenseKey: formData.licenseKey,
          email: formData.email,
        };
        const response = await axios.post(API_ENDPOINTS.SUPERADMIN_CUSTOMERS.CREATE, dto, { headers });
        if (!response.data?.isSuccess) {
          throw new Error(response.data?.message || 'Create failed');
        }
        setToast({ message: 'Tenant customer created successfully', type: 'success' });
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setToast({
        message: err?.message || err?.response?.data?.message || 'Operation failed',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setSaving(true);
      const headers = getAuthHeaders();
      const response = await axios.delete(API_ENDPOINTS.SUPERADMIN_CUSTOMERS.DELETE(id), { headers });
      if (!response.data?.isSuccess) {
        throw new Error(response.data?.message || 'Delete failed');
      }
      setToast({ message: 'Tenant customer deleted successfully', type: 'success' });
      setShowDeleteConfirm(null);
      loadData();
    } catch (err: any) {
      setToast({
        message: err?.message || err?.response?.data?.message || 'Delete failed',
        type: 'error',
      });
      setShowDeleteConfirm(null);
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(totalRecords / pageSize);

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tenant Customers</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage RTD Cloud tenant customers and their database connection information.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search tenant customers..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="w-full sm:w-72 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Tenant Customer
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Customer Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Server Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  DB Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  DB User
                </th>
                {/* WEB-152: DB Password column removed from listing — never exposed in the grid. */}
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  License Key
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                  Email
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">
                  Date Created
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">
                  Date Modified
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              ) : customers.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <svg
                        className="w-12 h-12 text-gray-300 dark:text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <p>No tenant customers found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c.customerId}
                    className="hover:bg-gray-50 dark:hover:bg-gray-750"
                  >
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">
                      {c.customerName}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {c.serverName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {c.dbName}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {c.dbUser}
                    </td>
                    {/* WEB-152: DB Password cell removed from listing. */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {c.licenseKey || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {c.email || '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                      {formatDate(c.dateCreated)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                      {formatDate(c.dateModified)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => openEditModal(c)}
                          className="text-brand-500 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                          title="Edit"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => setLicenseCustomer(c)}
                          className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                          title="License Setup"
                        >
                          {/* Key icon — matches the FrmStartWz "License Setup" affordance. */}
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(String(c.customerId))}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalRecords > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalRecords)} of{' '}
              {totalRecords}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingItem ? 'Edit Tenant Customer' : 'Add Tenant Customer'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Server Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.serverName}
                    onChange={(e) => setFormData({ ...formData, serverName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    DB Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.dbName}
                    onChange={(e) => setFormData({ ...formData, dbName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    DB User *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.dbUser}
                    onChange={(e) => setFormData({ ...formData, dbUser: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    DB Password {!editingItem && '*'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required={!editingItem}
                      value={formData.dbPass}
                      onChange={(e) => setFormData({ ...formData, dbPass: e.target.value })}
                      className="w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
                    >
                      {showPassword ? (
                        // Eye-off icon (Heroicons)
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        // Eye icon (Heroicons)
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Environment
                  </label>
                  <select
                    value={formData.environment}
                    onChange={(e) =>
                      setFormData({ ...formData, environment: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  >
                    <option value={1}>Production (1)</option>
                    <option value={2}>Non‑Production (2)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    License Key
                  </label>
                  <input
                    type="text"
                    value={formData.licenseKey}
                    onChange={(e) => setFormData({ ...formData, licenseKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      ></path>
                    </svg>
                  )}
                  {editingItem ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete Tenant Customer
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              Are you sure you want to delete this tenant customer? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={saving}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    ></path>
                  </svg>
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* License Setup — decrypted view/edit of the per-tenant EncData blob. */}
      {licenseCustomer && (
        <LicenseSetupModal
          customerId={licenseCustomer.customerId}
          customerName={licenseCustomer.customerName}
          onClose={() => setLicenseCustomer(null)}
          onToast={(message, type) => setToast({ message, type })}
        />
      )}
    </div>
  );
};

export default TenantCustomersPage;

