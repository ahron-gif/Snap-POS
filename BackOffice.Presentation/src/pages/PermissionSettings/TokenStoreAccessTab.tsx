import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { fetchTokensDropdown } from '../../store/slices/tokenPermissionSlice';
import {
  fetchStoresByToken,
  fetchTokenStoreAccess,
  bulkUpdateTokenStoreAccess,
  removeTokenStoreAccess,
  clearStoreAccessList,
  clearStores,
} from '../../store/slices/tokenStoreAccessSlice';
import SearchableSelect from '../../components/form/SearchableSelect';
import type { SelectOption } from '../../components/form/SearchableSelect';

const SkeletonRow: React.FC = () => (
  <tr className="animate-pulse">
    {[...Array(4)].map((_, i) => (
      <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div></td>
    ))}
  </tr>
);

const TokenStoreAccessTab: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { dropdownTokens, dropdownLoading } = useSelector((state: RootState) => state.tokenPermission);
  const { storeAccessList, stores, storesLoading, loading, saving } = useSelector(
    (state: RootState) => state.tokenStoreAccess
  );

  const [selectedTokenId, setSelectedTokenId] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<string>>(new Set());
  const [storeSearch, setStoreSearch] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => {
    dispatch(fetchTokensDropdown());
  }, [dispatch]);

  useEffect(() => {
    if (selectedTokenId !== '') {
      dispatch(fetchTokenStoreAccess(selectedTokenId as number));
      dispatch(fetchStoresByToken(selectedTokenId as number));
    } else {
      dispatch(clearStoreAccessList());
      dispatch(clearStores());
    }
  }, [dispatch, selectedTokenId]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const filteredAccess = useMemo(() => {
    if (!search.trim()) return storeAccessList;
    const lower = search.toLowerCase();
    return storeAccessList.filter(
      (s) =>
        (s.storeName || '').toLowerCase().includes(lower) ||
        (s.storeApp || '').toLowerCase().includes(lower)
    );
  }, [storeAccessList, search]);

  const assignedStoreIds = useMemo(
    () => new Set(storeAccessList.map((s) => s.storeId.toLowerCase())),
    [storeAccessList]
  );

  const selectedToken = dropdownTokens.find((t) => t.id === selectedTokenId);

  const tokenOptions: SelectOption[] = useMemo(() =>
    dropdownTokens.map((t) => ({
      value: t.id.toString(),
      label: `${t.storeApp} - ${t.storeName}${t.active ? '' : ' (Inactive)'}`,
    })),
    [dropdownTokens]
  );

  const availableStores = useMemo(() => {
    if (!storeSearch.trim()) return stores;
    const lower = storeSearch.toLowerCase();
    return stores.filter((s) => s.storeName.toLowerCase().includes(lower));
  }, [stores, storeSearch]);

  const handleOpenAddModal = () => {
    setSelectedStoreIds(new Set(assignedStoreIds));
    setStoreSearch('');
    setShowAddModal(true);
  };

  const toggleStoreSelection = (storeId: string) => {
    const normalized = storeId.toLowerCase();
    setSelectedStoreIds((prev) => {
      const next = new Set(prev);
      if (next.has(normalized)) {
        next.delete(normalized);
      } else {
        next.add(normalized);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedStoreIds.size === availableStores.length) {
      setSelectedStoreIds(new Set());
    } else {
      setSelectedStoreIds(new Set(availableStores.map((s) => s.storeId.toLowerCase())));
    }
  };

  const handleAddStores = async () => {
    if (selectedTokenId === '') return;

    try {
      await dispatch(
        bulkUpdateTokenStoreAccess({
          tokenId: selectedTokenId as number,
          dto: { storeIds: Array.from(selectedStoreIds) },
        })
      ).unwrap();
      setToast({ message: 'Store access updated successfully', type: 'success' });
      setShowAddModal(false);
      dispatch(fetchTokenStoreAccess(selectedTokenId as number));
    } catch (err: unknown) {
      setToast({ message: (err as string) || 'Failed to update store access', type: 'error' });
    }
  };

  const handleRemoveAccess = async (id: number) => {
    try {
      await dispatch(removeTokenStoreAccess(id)).unwrap();
      setToast({ message: 'Store access removed successfully', type: 'success' });
      setDeleteConfirmId(null);
    } catch (err: unknown) {
      setToast({ message: (err as string) || 'Failed to remove store access', type: 'error' });
      setDeleteConfirmId(null);
    }
  };

  return (
    <div>
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select Token
            </label>
            <div className="w-full sm:w-96">
              <SearchableSelect
                options={tokenOptions}
                value={selectedTokenId === '' ? '' : selectedTokenId.toString()}
                onChange={(val) => {
                  setSelectedTokenId(val === '' ? '' : Number(val));
                  setSearch('');
                }}
                placeholder="-- Select a token --"
                loading={dropdownLoading}
              />
            </div>
          </div>
          {selectedToken && (
            <div className="flex items-center gap-2 mt-2 sm:mt-6">
              <span
                className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                  selectedToken.active
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                {selectedToken.active ? 'Active' : 'Inactive'}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                {selectedToken.storeName}
              </span>
            </div>
          )}
        </div>
      </div>

      {selectedTokenId === '' ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-16">
          <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
            <svg className="w-16 h-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-sm">Select a token above to manage its store access</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <input
              type="text"
              placeholder="Search stores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Stores
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Store Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Store ID</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Date Added</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {loading ? (
                    [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                  ) : filteredAccess.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                        <div className="flex flex-col items-center gap-2">
                          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <p>{search.trim() ? 'No stores match your search' : 'No stores assigned to this token'}</p>
                          {!search.trim() && (
                            <button
                              onClick={handleOpenAddModal}
                              className="mt-2 text-sm text-brand-500 hover:text-brand-600 font-medium"
                            >
                              + Add stores now
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAccess.map((sa) => (
                      <tr key={sa.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">
                          {sa.storeName || '-'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 max-w-[220px] truncate" title={sa.storeId}>
                          {sa.storeId}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                          {sa.dateCreated ? new Date(sa.dateCreated).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setDeleteConfirmId(sa.id)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400"
                            title="Remove access"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {storeAccessList.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {storeAccessList.length} store{storeAccessList.length !== 1 ? 's' : ''} assigned
                  {filteredAccess.length !== storeAccessList.length && ` (showing ${filteredAccess.length})`}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Store Access</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                placeholder="Search available stores..."
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
              />
              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-brand-500 hover:text-brand-600 font-medium"
                >
                  {selectedStoreIds.size === availableStores.length && availableStores.length > 0
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedStoreIds.size} selected
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {storesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                </div>
              ) : availableStores.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-gray-500 dark:text-gray-400">
                  <p className="text-sm">
                    {storeSearch.trim()
                      ? 'No stores match your search'
                      : 'No stores available for this token'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {availableStores.map((store) => {
                    const isSelected = selectedStoreIds.has(store.storeId.toLowerCase());
                    return (
                      <button
                        key={store.storeId}
                        onClick={() => toggleStoreSelection(store.storeId)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                          isSelected
                            ? 'bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/30'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-750 border border-transparent'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                            isSelected
                              ? 'bg-brand-500 border-brand-500'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {store.storeName}
                          </p>
                          <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">
                            {store.storeId}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStores}
                disabled={saving}
                className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                )}
                Save ({selectedStoreIds.size} Store{selectedStoreIds.size !== 1 ? 's' : ''})
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Remove Store Access</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              Are you sure you want to remove this store's access from the token?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveAccess(deleteConfirmId)}
                disabled={saving}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                )}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenStoreAccessTab;
