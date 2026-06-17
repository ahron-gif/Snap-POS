import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { fetchAppRegistrations, createAppRegistration, updateAppRegistration, deleteAppRegistration } from '../../store/slices/appRegistrationSlice';
import { applicationApi } from '../../services/smartKartReg/applicationApi';
import { registrationApi } from '../../services/smartKartReg/registrationApi';
import type { AppRegistration, CreateAppRegistrationDto, UpdateAppRegistrationDto } from '../../services/smartKartReg/appRegistrationApi';
import type { ApplicationDropdown } from '../../services/smartKartReg/applicationApi';

const SkeletonRow: React.FC = () => (
  <tr className="animate-pulse">
    {[...Array(5)].map((_, i) => (
      <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div></td>
    ))}
  </tr>
);

const AppRegistrationsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { appRegistrations, totalRecords, loading, saving } = useSelector((state: RootState) => state.appRegistration);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<AppRegistration | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [appsDropdown, setAppsDropdown] = useState<ApplicationDropdown[]>([]);
  const [regsDropdown, setRegsDropdown] = useState<{ registrationId: string; storeName: string }[]>([]);

  const [formData, setFormData] = useState<CreateAppRegistrationDto>({
    appId: '',
    registrationId: '',
    apiurl: '',
  });

  const loadData = useCallback(() => {
    const params: Record<string, any> = {
      startRow: page * pageSize,
      endRow: (page + 1) * pageSize,
      sortColumn: 'AppName',
      sortDirection: 'asc',
    };
    if (search.trim()) {
      params.customGridSearchText = search.trim();
      params.customGridSearchColumns = 'AppName,StoreName,Apiurl';
    }
    dispatch(fetchAppRegistrations(params));
  }, [dispatch, page, pageSize, search]);

  const loadDropdowns = useCallback(async () => {
    try {
      const [appsRes, regsRes] = await Promise.all([
        applicationApi.dropdown(),
        registrationApi.getAll({ startRow: 0, endRow: 1000 }),
      ]);
      if (appsRes.data.isSuccess) {
        setAppsDropdown(appsRes.data.response);
      }
      if (regsRes.data.isSuccess) {
        setRegsDropdown(regsRes.data.response.data.map((r: any) => ({
          registrationId: r.registrationId,
          storeName: r.storeName,
        })));
      }
    } catch {
      // dropdowns are non-critical
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadDropdowns(); }, [loadDropdowns]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({ appId: '', registrationId: '', apiurl: '' });
    setShowModal(true);
  };

  const openEditModal = (ar: AppRegistration) => {
    setEditingItem(ar);
    setFormData({
      appId: ar.appId,
      registrationId: ar.registrationId || '',
      apiurl: ar.apiurl || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        registrationId: formData.registrationId || undefined,
      };
      if (editingItem) {
        const dto: UpdateAppRegistrationDto = { ...payload, id: editingItem.id };
        await dispatch(updateAppRegistration({ id: editingItem.id, dto })).unwrap();
        setToast({ message: 'App registration updated successfully', type: 'success' });
      } else {
        await dispatch(createAppRegistration(payload)).unwrap();
        setToast({ message: 'App registration created successfully', type: 'success' });
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setToast({ message: err || 'Operation failed', type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await dispatch(deleteAppRegistration(id)).unwrap();
      setToast({ message: 'App registration deleted successfully', type: 'success' });
      setShowDeleteConfirm(null);
      loadData();
    } catch (err: any) {
      setToast({ message: err || 'Delete failed', type: 'error' });
      setShowDeleteConfirm(null);
    }
  };

  const totalPages = Math.ceil(totalRecords / pageSize);

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">App Registrations</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Link applications to customer registrations with their API URLs.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search app registrations..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="w-full sm:w-72 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add App Registration
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Application</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Customer (Store)</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">API URL</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              ) : appRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      <p>No app registrations found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                appRegistrations.map((ar) => (
                  <tr key={ar.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">{ar.appName}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{ar.storeName || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate">{ar.apiurl || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openEditModal(ar)} className="text-brand-500 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => setShowDeleteConfirm(ar.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Delete">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
              Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalRecords)} of {totalRecords}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700">Prev</button>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingItem ? 'Edit App Registration' : 'Add App Registration'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Application *</label>
                <select required value={formData.appId} onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500">
                  <option value="">Select application...</option>
                  {appsDropdown.map((a) => (
                    <option key={a.appId} value={a.appId}>{a.appName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer (Registration)</label>
                <select value={formData.registrationId || ''} onChange={(e) => setFormData({ ...formData, registrationId: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500">
                  <option value="">None</option>
                  {regsDropdown.map((r) => (
                    <option key={r.registrationId} value={r.registrationId}>{r.storeName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API URL</label>
                <input type="text" value={formData.apiurl || ''} onChange={(e) => setFormData({ ...formData, apiurl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500" placeholder="e.g. https://api.example.com" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
                  {saving && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>}
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete App Registration</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">Are you sure you want to delete this app registration? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Cancel</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} disabled={saving}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
                {saving && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppRegistrationsPage;
