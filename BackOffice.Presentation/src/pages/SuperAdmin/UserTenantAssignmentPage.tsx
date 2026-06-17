import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { permissionService } from '../../services/permissionService';
import SearchableSelect from '../../components/form/SearchableSelect';
import type { TenantLookupItem } from '../../types/permission';
import apiClient from '../../lib/axios';

interface UserLookup {
  userId: number;
  userName: string;
  email: string;
}

const UserTenantAssignmentPage: React.FC = () => {
  const [users, setUsers] = useState<UserLookup[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const [tenants, setTenants] = useState<TenantLookupItem[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const response = await apiClient.get('/api/User/GetDistinctUsers');
      const data = response.data;
      if (data.isSuccess && data.response) {
        setUsers(
          data.response.map((u: { userId: number; userName: string; email: string }) => ({
            userId: u.userId,
            userName: u.userName,
            email: u.email || '',
          }))
        );
      }
    } catch {
      setToast({ message: 'Failed to load users', type: 'error' });
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const loadTenantAssignments = useCallback(async (userId: number) => {
    setTenantsLoading(true);
    try {
      const response = await permissionService.getUserTenantAssignments(userId);
      if (response.data.isSuccess) {
        setTenants(response.data.response);
        setDirty(false);
      } else {
        setToast({ message: response.data.message || 'Failed to load assignments', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to load tenant assignments', type: 'error' });
    } finally {
      setTenantsLoading(false);
    }
  }, []);

  const handleUserChange = useCallback(
    (value: string) => {
      const uid = value ? parseInt(value, 10) : null;
      setSelectedUserId(uid);
      setSearchTerm('');
      setDirty(false);
      if (uid) {
        loadTenantAssignments(uid);
      } else {
        setTenants([]);
      }
    },
    [loadTenantAssignments]
  );

  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        value: String(u.userId),
        label: `${u.userName} (${u.email})`,
      })),
    [users]
  );

  const filteredTenants = useMemo(() => {
    if (!searchTerm) return tenants;
    const lower = searchTerm.toLowerCase();
    return tenants.filter(
      (t) =>
        t.customerName.toLowerCase().includes(lower) ||
        (t.email && t.email.toLowerCase().includes(lower))
    );
  }, [tenants, searchTerm]);

  const assignedCount = useMemo(() => tenants.filter((t) => t.isAssigned).length, [tenants]);

  const handleToggleTenant = (customerId: number) => {
    setTenants((prev) =>
      prev.map((t) => (t.customerId === customerId ? { ...t, isAssigned: !t.isAssigned } : t))
    );
    setDirty(true);
  };

  const handleSelectAll = () => {
    setTenants((prev) => prev.map((t) => ({ ...t, isAssigned: true })));
    setDirty(true);
  };

  const handleDeselectAll = () => {
    setTenants((prev) => prev.map((t) => ({ ...t, isAssigned: false })));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const customerIds = tenants.filter((t) => t.isAssigned).map((t) => t.customerId);
      const response = await permissionService.assignTenantsToUser(selectedUserId, {
        userId: selectedUserId,
        customerIds,
      });
      if (response.data.isSuccess) {
        setToast({ message: 'Tenant assignments saved successfully', type: 'success' });
        setDirty(false);
      } else {
        setToast({ message: response.data.message || 'Failed to save', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to save tenant assignments', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          User Tenant Assignment
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Assign tenants to users so they can switch between them.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select User
          </label>
          <SearchableSelect
            options={userOptions}
            value={selectedUserId ? String(selectedUserId) : ''}
            onChange={handleUserChange}
            placeholder={usersLoading ? 'Loading users...' : 'Search and select a user...'}
            disabled={usersLoading}
            loading={usersLoading}
            className="w-full sm:w-96"
          />
        </div>

        {selectedUserId && (
          <>
            <div className="p-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 sm:w-72">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search tenants..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-brand-300 focus:ring-1 focus:ring-brand-500/20 dark:text-white placeholder:text-gray-400"
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {assignedCount} of {tenants.length} assigned
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 dark:text-brand-400 dark:bg-brand-900/20 dark:hover:bg-brand-900/40 rounded-md transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-md transition-colors"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            </div>

            <div className="max-h-[28rem] overflow-y-auto">
              {tenantsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
                </div>
              ) : filteredTenants.length === 0 ? (
                <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                  {searchTerm ? 'No tenants match your search' : 'No tenants available'}
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredTenants.map((tenant) => (
                    <label
                      key={tenant.customerId}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={tenant.isAssigned}
                        onChange={() => handleToggleTenant(tenant.customerId)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                      />
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                        {tenant.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {tenant.customerName}
                        </div>
                        {tenant.email && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {tenant.email}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {dirty ? 'Unsaved changes' : 'All changes saved'}
              </span>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !dirty}
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
                  saving || !dirty
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                    : 'bg-brand-500 text-white hover:bg-brand-600'
                }`}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Saving...
                  </span>
                ) : (
                  'Save Assignments'
                )}
              </button>
            </div>
          </>
        )}

        {!selectedUserId && !usersLoading && (
          <div className="py-16 text-center text-gray-400 dark:text-gray-500">
            <svg
              className="mx-auto h-12 w-12 mb-3 text-gray-300 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="text-sm">Select a user to manage their tenant assignments</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserTenantAssignmentPage;
