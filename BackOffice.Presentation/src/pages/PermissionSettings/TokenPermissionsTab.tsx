import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { fetchPermissions } from '../../store/slices/permissionSlice';
import { fetchTokensDropdown, fetchTokenPermissions, bulkUpdateTokenPermissions, clearTokenPermissions } from '../../store/slices/tokenPermissionSlice';
import type { Permission, TokenPermission, BulkTokenPermissionItem } from '../../services/smartKartReg/permissionApi';

interface PermissionRow {
  permissionId: number;
  permissionKey: string;
  permissionName: string;
  category: string;
  isAllowed: boolean;
  originalIsAllowed: boolean | null; // null = not yet assigned
}

const SkeletonRow: React.FC = () => (
  <tr className="animate-pulse">
    {[...Array(4)].map((_, i) => (
      <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div></td>
    ))}
  </tr>
);

const TokenPermissionsTab: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { permissions } = useSelector((state: RootState) => state.permission);
  const { tokenPermissions, dropdownTokens, dropdownLoading, loading: tpLoading, saving } = useSelector((state: RootState) => state.tokenPermission);

  const [selectedTokenId, setSelectedTokenId] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [permissionRows, setPermissionRows] = useState<PermissionRow[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [permsLoaded, setPermsLoaded] = useState(false);

  // Load dropdown tokens and permissions on mount
  useEffect(() => {
    dispatch(fetchTokensDropdown());
    dispatch(fetchPermissions({ startRow: 0, endRow: 1000, sortColumn: 'PermissionName', sortDirection: 'asc' }))
      .then(() => setPermsLoaded(true));
  }, [dispatch]);

  // When token selected, fetch its permissions
  useEffect(() => {
    if (selectedTokenId !== '') {
      dispatch(fetchTokenPermissions(selectedTokenId as number));
    } else {
      dispatch(clearTokenPermissions());
    }
  }, [dispatch, selectedTokenId]);

  // Build permission rows when permissions or token permissions change
  useEffect(() => {
    if (permissions.length === 0) return;

    const tpMap = new Map<number, TokenPermission>();
    tokenPermissions.forEach((tp) => tpMap.set(tp.permissionId, tp));

    const rows: PermissionRow[] = permissions.map((p) => {
      const tp = tpMap.get(p.id);
      return {
        permissionId: p.id,
        permissionKey: p.permissionKey,
        permissionName: p.permissionName,
        category: p.category || 'Uncategorized',
        isAllowed: tp ? tp.isAllowed : false,
        originalIsAllowed: tp ? tp.isAllowed : null,
      };
    });

    setPermissionRows(rows);
  }, [permissions, tokenPermissions]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    permissionRows.forEach((r) => cats.add(r.category));
    return Array.from(cats).sort();
  }, [permissionRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return permissionRows.filter((r) => {
      const matchSearch = !search.trim() ||
        r.permissionKey.toLowerCase().includes(search.toLowerCase()) ||
        r.permissionName.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === 'all' || r.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [permissionRows, search, categoryFilter]);

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    return permissionRows.some((r) => {
      if (r.originalIsAllowed === null) return r.isAllowed;
      return r.isAllowed !== r.originalIsAllowed;
    });
  }, [permissionRows]);

  // Count changes
  const changeCount = useMemo(() => {
    return permissionRows.filter((r) => {
      if (r.originalIsAllowed === null) return r.isAllowed;
      return r.isAllowed !== r.originalIsAllowed;
    }).length;
  }, [permissionRows]);

  const handleToggle = (permissionId: number) => {
    setPermissionRows((prev) =>
      prev.map((r) => r.permissionId === permissionId ? { ...r, isAllowed: !r.isAllowed } : r)
    );
  };

  const handleAllowAll = () => {
    setPermissionRows((prev) => prev.map((r) => ({ ...r, isAllowed: true })));
  };

  const handleDenyAll = () => {
    setPermissionRows((prev) => prev.map((r) => ({ ...r, isAllowed: false })));
  };

  const handleResetChanges = () => {
    setPermissionRows((prev) =>
      prev.map((r) => ({
        ...r,
        isAllowed: r.originalIsAllowed !== null ? r.originalIsAllowed : false,
      }))
    );
  };

  const handleSave = async () => {
    if (selectedTokenId === '') return;

    // Build the permissions list - include all permissions that have been changed or that are denied
    const permissionsToSend: BulkTokenPermissionItem[] = permissionRows
      .filter((r) => {
        // Include if changed from original or if it was assigned and has a value
        if (r.originalIsAllowed === null) return r.isAllowed;
        return true;
      })
      .map((r) => ({
        permissionId: r.permissionId,
        isAllowed: r.isAllowed,
      }));

    try {
      await dispatch(bulkUpdateTokenPermissions({
        tokenId: selectedTokenId as number,
        dto: { permissions: permissionsToSend },
      })).unwrap();
      setToast({ message: 'Permissions updated successfully', type: 'success' });
      // Refresh the token permissions to get updated state
      dispatch(fetchTokenPermissions(selectedTokenId as number));
    } catch (err: any) {
      setToast({ message: err || 'Failed to save permissions', type: 'error' });
    }
  };

  const selectedToken = dropdownTokens.find((t) => t.id === selectedTokenId);
  const isLoading = !permsLoaded || tpLoading;

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Token Selector */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Token</label>
            {dropdownLoading ? (
              <div className="w-full sm:w-96 h-[38px] bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
            ) : (
              <select
                value={selectedTokenId}
                onChange={(e) => {
                  setSelectedTokenId(e.target.value === '' ? '' : Number(e.target.value));
                  setSearch('');
                  setCategoryFilter('all');
                }}
                className="w-full sm:w-96 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
              >
                <option value="">-- Select a token --</option>
                {dropdownTokens.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.storeApp} - {t.storeName}{t.active ? '' : ' (Inactive)'}
                  </option>
                ))}
              </select>
            )}
          </div>
          {selectedToken && (
            <div className="flex items-center gap-2 mt-2 sm:mt-6">
              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                selectedToken.active
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {selectedToken.active ? 'Active' : 'Inactive'}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">{selectedToken.storeName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      {selectedTokenId === '' ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg py-16">
          <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
            <svg className="w-16 h-16 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <p className="text-sm">Select a token above to manage its permissions</p>
          </div>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mb-4">
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <input
                type="text"
                placeholder="Search permissions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
              />
              {categories.length > 1 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Bulk Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleAllowAll}
                className="px-3 py-2 text-xs rounded-lg font-medium bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 transition-colors"
              >
                Allow All
              </button>
              <button
                onClick={handleDenyAll}
                className="px-3 py-2 text-xs rounded-lg font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors"
              >
                Deny All
              </button>
              <button
                onClick={handleResetChanges}
                disabled={!hasChanges}
                className="px-3 py-2 text-xs rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                )}
                Save Changes
                {hasChanges && (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-white/20">
                    {changeCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Unsaved changes banner */}
          {hasChanges && (
            <div className="mb-4 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm text-amber-700 dark:text-amber-300">
                You have {changeCount} unsaved change{changeCount !== 1 ? 's' : ''}. Click <strong>Save Changes</strong> to apply.
              </span>
            </div>
          )}

          {/* Permissions Table */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Permission Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Key</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Category</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoading ? (
                    [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                        <div className="flex flex-col items-center gap-2">
                          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p>{search.trim() ? 'No permissions match your search' : 'No permissions available'}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => {
                      const isModified = row.originalIsAllowed !== null
                        ? row.isAllowed !== row.originalIsAllowed
                        : row.isAllowed;
                      return (
                        <tr
                          key={row.permissionId}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-750 ${isModified ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}
                        >
                          <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                            <div className="flex items-center gap-2">
                              {row.permissionName}
                              {isModified && (
                                <span className="inline-flex w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" title="Modified"></span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{row.permissionKey}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                              {row.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`text-xs font-medium w-12 text-right ${row.isAllowed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {row.isAllowed ? 'Allow' : 'Deny'}
                              </span>
                              <button
                                onClick={() => handleToggle(row.permissionId)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  row.isAllowed ? 'bg-green-500' : 'bg-red-400 dark:bg-red-500'
                                }`}
                              >
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                  row.isAllowed ? 'translate-x-4.5' : 'translate-x-0.5'
                                }`} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary Footer */}
            {filteredRows.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {filteredRows.length} permission{filteredRows.length !== 1 ? 's' : ''}
                  {filteredRows.length !== permissionRows.length && ` (filtered from ${permissionRows.length})`}
                </span>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-gray-600 dark:text-gray-400">{filteredRows.filter((r) => r.isAllowed).length} allowed</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    <span className="text-gray-600 dark:text-gray-400">{filteredRows.filter((r) => !r.isAllowed).length} denied</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TokenPermissionsTab;
