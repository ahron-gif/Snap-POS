import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { fetchTokens, createToken, updateToken, deleteToken } from '../../store/slices/tokenSlice';
import { tokenApi } from '../../services/smartKartReg/permissionApi';
import type { StoreToken, CreateStoreTokenDto, UpdateStoreTokenDto, StoreDropdown } from '../../services/smartKartReg/permissionApi';

const SkeletonRow: React.FC = () => (
  <tr className="animate-pulse">
    {[...Array(6)].map((_, i) => (
      <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div></td>
    ))}
  </tr>
);

// Searchable Registration Dropdown Component
const RegistrationSearchDropdown: React.FC<{
  value: string;
  onChange: (storeId: string) => void;
  stores: StoreDropdown[];
  loadingStores: boolean;
}> = ({ value, onChange, stores, loadingStores }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find selected store name
  const selectedStore = stores.find(s => s.storeId === value);

  // Filter stores by search text
  const filteredStores = stores.filter(s =>
    s.storeName.toLowerCase().includes(searchText.toLowerCase()) ||
    s.storeId.toLowerCase().includes(searchText.toLowerCase())
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (store: StoreDropdown) => {
    onChange(store.storeId);
    setSearchText('');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchText('');
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Selected value display / trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 border rounded-lg text-sm text-left flex items-center gap-2 transition-colors ${
          isOpen
            ? 'border-brand-500 ring-2 ring-brand-500 bg-white dark:bg-gray-700'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        {selectedStore ? (
          <div className="flex-1 min-w-0">
            <span className="text-gray-900 dark:text-gray-100 font-medium">{selectedStore.storeName}</span>
            <span className="text-gray-400 dark:text-gray-500 text-xs ml-2 font-mono">{selectedStore.storeId.substring(0, 8)}...</span>
          </div>
        ) : (
          <span className="flex-1 text-gray-400 dark:text-gray-500">Search by store name...</span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </span>
          )}
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Hidden input for form validation */}
      <input type="hidden" required value={value} />

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Type to search store name..."
                className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:bg-white dark:focus:bg-gray-700"
              />
            </div>
          </div>

          {/* Store list */}
          <div className="max-h-52 overflow-y-auto">
            {loadingStores ? (
              <div className="px-4 py-6 text-center">
                <svg className="animate-spin w-5 h-5 text-brand-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                <p className="text-xs text-gray-500 dark:text-gray-400">Loading stores...</p>
              </div>
            ) : filteredStores.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {searchText ? 'No stores match your search' : 'No stores available'}
              </div>
            ) : (
              filteredStores.map((store) => (
                <button
                  key={store.storeId}
                  type="button"
                  onClick={() => handleSelect(store)}
                  className={`w-full px-3 py-2.5 text-left hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 last:border-0 ${
                    store.storeId === value ? 'bg-brand-50 dark:bg-brand-500/10' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{store.storeName}</p>
                    <p className="text-xs font-mono text-gray-400 dark:text-gray-500 truncate">{store.storeId}</p>
                  </div>
                  {store.storeId === value && (
                    <svg className="w-4 h-4 text-brand-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const TokensTab: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { tokens, totalRecords, loading, saving } = useSelector((state: RootState) => state.token);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(20);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [editingToken, setEditingToken] = useState<StoreToken | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Stores dropdown state
  const [storesDropdown, setStoresDropdown] = useState<StoreDropdown[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);

  const [formData, setFormData] = useState<CreateStoreTokenDto>({
    registrationId: '',
    storeApp: '',
    active: true,
  });

  const loadTokens = useCallback(() => {
    const params: Record<string, any> = {
      startRow: page * pageSize,
      endRow: (page + 1) * pageSize,
      sortColumn: 'DateCreated',
      sortDirection: 'desc',
    };
    if (search.trim()) {
      params.customGridSearchText = search.trim();
      params.customGridSearchColumns = 'StoreApp,StoreName,Token';
    }
    if (activeFilter === 'active') {
      params.filters = JSON.stringify([{ col: 'Active', type: 'equals', value: 'true' }]);
    } else if (activeFilter === 'inactive') {
      params.filters = JSON.stringify([{ col: 'Active', type: 'equals', value: 'false' }]);
    }
    dispatch(fetchTokens(params));
  }, [dispatch, page, pageSize, search, activeFilter]);

  const loadStoresDropdown = useCallback(async () => {
    setLoadingStores(true);
    try {
      const response = await tokenApi.storesDropdown();
      if (response.data.isSuccess) {
        setStoresDropdown(response.data.response);
      }
    } catch {
      // silently fail - dropdown will show empty
    } finally {
      setLoadingStores(false);
    }
  }, []);

  useEffect(() => { loadTokens(); }, [loadTokens]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const openCreateModal = () => {
    setEditingToken(null);
    setFormData({ registrationId: '', storeApp: '', active: true });
    setShowModal(true);
    loadStoresDropdown();
  };

  const openEditModal = (t: StoreToken) => {
    setEditingToken(t);
    setFormData({ registrationId: t.registrationId, storeApp: t.storeApp, active: t.active });
    setShowModal(true);
    loadStoresDropdown();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.registrationId) {
      setToast({ message: 'Please select a store (Registration ID)', type: 'error' });
      return;
    }
    try {
      if (editingToken) {
        const dto: UpdateStoreTokenDto = { ...formData, id: editingToken.id };
        await dispatch(updateToken({ id: editingToken.id, dto })).unwrap();
        setToast({ message: 'Token updated successfully', type: 'success' });
      } else {
        await dispatch(createToken(formData)).unwrap();
        setToast({ message: 'Token created successfully', type: 'success' });
      }
      setShowModal(false);
      loadTokens();
    } catch (err: any) {
      setToast({ message: err || 'Operation failed', type: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await dispatch(deleteToken(id)).unwrap();
      setToast({ message: 'Token deleted successfully', type: 'success' });
      setShowDeleteConfirm(null);
      loadTokens();
    } catch (err: any) {
      setToast({ message: err || 'Delete failed', type: 'error' });
      setShowDeleteConfirm(null);
    }
  };

  const handleToggleActive = async (t: StoreToken) => {
    try {
      const dto: UpdateStoreTokenDto = {
        id: t.id,
        registrationId: t.registrationId,
        storeApp: t.storeApp,
        active: !t.active,
      };
      await dispatch(updateToken({ id: t.id, dto })).unwrap();
      setToast({ message: `Token ${!t.active ? 'activated' : 'deactivated'} successfully`, type: 'success' });
      loadTokens();
    } catch (err: any) {
      setToast({ message: err || 'Toggle failed', type: 'error' });
    }
  };

  const totalPages = Math.ceil(totalRecords / pageSize);

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search tokens..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full sm:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex gap-1">
            {(['all', 'active', 'inactive'] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setActiveFilter(f); setPage(0); }}
                className={`px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                  activeFilter === f
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <button onClick={openCreateModal} className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Token
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Store App</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Store Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Token</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Registration ID</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              ) : tokens.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                      <p>No tokens found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tokens.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{t.storeApp}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{t.storeName || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200 max-w-[200px] truncate" title={t.token}>{t.token}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title={t.registrationId}>{t.registrationId}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(t)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${t.active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${t.active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openEditModal(t)} className="text-brand-500 hover:text-brand-700 dark:text-brand-400" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => setShowDeleteConfirm(t.id)} className="text-red-600 hover:text-red-800 dark:text-red-400" title="Delete">
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{editingToken ? 'Edit Token' : 'Add Token'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Store App *</label>
                <input type="text" required value={formData.storeApp} onChange={(e) => setFormData({ ...formData, storeApp: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500" placeholder="e.g. SmartKart POS" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Registration (Store) *</label>
                <RegistrationSearchDropdown
                  value={formData.registrationId}
                  onChange={(id) => setFormData({ ...formData, registrationId: id })}
                  stores={storesDropdown}
                  loadingStores={loadingStores}
                />
                {formData.registrationId && (
                  <p className="mt-1 text-xs font-mono text-gray-400 dark:text-gray-500 truncate">
                    ID: {formData.registrationId}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="tokenActive" checked={formData.active} onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                <label htmlFor="tokenActive" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
              </div>
              {editingToken && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Token Value (auto-generated)</label>
                  <p className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all">{editingToken.token}</p>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Cancel</button>
                <button type="submit" disabled={saving || !formData.registrationId}
                  className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
                  {saving && <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>}
                  {editingToken ? 'Update' : 'Create'}
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Token</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">Are you sure you want to delete this token? This action cannot be undone.</p>
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

export default TokensTab;
