import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { permissionService } from '../../services/permissionService';
import Loader from '../../components/ui/loader/Loader';
import SearchableSelect from '../../components/form/SearchableSelect';
import type { TenantPermissionCeiling, ModuleCeiling, TenantListItem } from '../../types/permission';

const TenantPermissionCeilingPage: React.FC = () => {
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [ceiling, setCeiling] = useState<TenantPermissionCeiling | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initializingAdmin, setInitializingAdmin] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string>('');
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [tenantsLoading, setTenantsLoading] = useState(true);

  const tenantOptions = useMemo(
    () => tenants.map((t) => ({ value: String(t.id), label: t.customerName })),
    [tenants],
  );

  // Load tenants for dropdown
  useEffect(() => {
    permissionService.getTenants({ startRow: 0, endRow: 999, sortColumn: 'CustomerName', sortDirection: 'asc' })
      .then((res) => {
        if (res.data.isSuccess) {
          setTenants(res.data.response.data);
        }
      })
      .catch(() => { /* ignore */ })
      .finally(() => setTenantsLoading(false));
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadCeiling = useCallback(async (tenantId: number) => {
    setLoading(true);
    try {
      const response = await permissionService.getTenantCeiling(tenantId);
      if (response.data.isSuccess) {
        const data = response.data.response;
        setCeiling(data);
        // Expand all modules by default
        const expanded: Record<number, boolean> = {};
        data.modules.forEach((m) => { expanded[m.moduleId] = true; });
        setExpandedModules(expanded);
      }
    } catch {
      setToast({ message: 'Failed to load permission ceiling', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTenantSelect = (value: string) => {
    const id = value ? Number(value) : null;
    setSelectedTenantId(id);
    setCeiling(null);
    if (id) {
      loadCeiling(id);
    }
  };

  const toggleModuleExpand = (moduleId: number) => {
    setExpandedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const toggleModuleEnabled = (moduleId: number) => {
    if (!ceiling) return;
    setCeiling({
      ...ceiling,
      modules: ceiling.modules.map((m) =>
        m.moduleId === moduleId ? { ...m, isEnabled: !m.isEnabled } : m
      ),
    });
  };

  const togglePermission = (moduleId: number, screenId: number, permissionId: number) => {
    if (!ceiling) return;
    setCeiling({
      ...ceiling,
      modules: ceiling.modules.map((m) => {
        if (m.moduleId !== moduleId) return m;
        return {
          ...m,
          screens: m.screens.map((s) => {
            if (s.screenId !== screenId) return s;
            return {
              ...s,
              permissions: s.permissions.map((p) =>
                p.permissionId === permissionId ? { ...p, isAllowed: !p.isAllowed } : p
              ),
            };
          }),
        };
      }),
    });
  };

  const enableAllPermissionsForModule = (moduleId: number) => {
    if (!ceiling) return;
    setCeiling({
      ...ceiling,
      modules: ceiling.modules.map((m) => {
        if (m.moduleId !== moduleId) return m;
        return {
          ...m,
          isEnabled: true,
          screens: m.screens.map((s) => ({
            ...s,
            permissions: s.permissions.map((p) => ({ ...p, isAllowed: true })),
          })),
        };
      }),
    });
  };

  const disableAllPermissionsForModule = (moduleId: number) => {
    if (!ceiling) return;
    setCeiling({
      ...ceiling,
      modules: ceiling.modules.map((m) => {
        if (m.moduleId !== moduleId) return m;
        return {
          ...m,
          screens: m.screens.map((s) => ({
            ...s,
            permissions: s.permissions.map((p) => ({ ...p, isAllowed: false })),
          })),
        };
      }),
    });
  };

  const handleEnableAll = async () => {
    if (!selectedTenantId) return;
    setSaving(true);
    try {
      await permissionService.enableAllForTenant(selectedTenantId);
      setToast({ message: 'All permissions enabled', type: 'success' });
      loadCeiling(selectedTenantId);
    } catch {
      setToast({ message: 'Failed to enable all', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!ceiling || !selectedTenantId) return;
    setSaving(true);
    try {
      // Save modules
      const enabledModuleIds = ceiling.modules.filter((m) => m.isEnabled).map((m) => m.moduleId);
      await permissionService.updateTenantModules({
        tenantId: selectedTenantId,
        moduleIds: enabledModuleIds,
      });

      // Save individual permissions
      const permissionUpdates: { permissionId: number; isAllowed: boolean }[] = [];
      ceiling.modules.forEach((m) => {
        m.screens.forEach((s) => {
          s.permissions.forEach((p) => {
            permissionUpdates.push({ permissionId: p.permissionId, isAllowed: p.isAllowed });
          });
        });
      });

      await permissionService.updateTenantPermissions({
        tenantId: selectedTenantId,
        permissions: permissionUpdates,
      });

      setToast({ message: 'Permission ceiling saved successfully', type: 'success' });
    } catch {
      setToast({ message: 'Failed to save permission ceiling', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleInitializeAdmin = async () => {
    if (!selectedTenantId) return;
    setInitializingAdmin(true);
    try {
      const userId = adminUserId ? parseInt(adminUserId, 10) : undefined;
      const response = await permissionService.initializeTenantAdmin(selectedTenantId, userId);
      if (response.data.isSuccess) {
        setToast({ message: response.data.message || 'Customer Admin initialized successfully', type: 'success' });
        setAdminUserId('');
      } else {
        setToast({ message: response.data.message || 'Failed to initialize admin', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to initialize customer admin', type: 'error' });
    } finally {
      setInitializingAdmin(false);
    }
  };

  const getModuleStats = (mod: ModuleCeiling) => {
    let total = 0;
    let allowed = 0;
    mod.screens.forEach((s) => {
      s.permissions.forEach((p) => {
        total++;
        if (p.isAllowed) allowed++;
      });
    });
    return { total, allowed };
  };

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tenant Permission Ceiling</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configure which modules and permissions are available for each tenant
        </p>
      </div>

      {/* Tenant selector + actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="w-full sm:w-80">
          <SearchableSelect
            options={tenantOptions}
            value={selectedTenantId ? String(selectedTenantId) : ''}
            placeholder="Select a tenant..."
            onChange={handleTenantSelect}
            loading={tenantsLoading}
          />
        </div>

        {selectedTenantId && ceiling && (
          <div className="flex gap-2">
            <button
              onClick={handleEnableAll}
              disabled={saving}
              className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Enable All
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              Save Changes
            </button>
          </div>
        )}
      </div>

      {/* Initialize Customer Admin section */}
      {selectedTenantId && ceiling && !loading && (
        <div className="mb-4 p-4 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-brand-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-brand-700 dark:text-brand-200">
                Initialize Customer Admin
              </p>
              <p className="text-xs text-brand-500 dark:text-brand-400 mt-1">
                Creates the Administrator role in the tenant database and syncs all ceiling permissions to it.
                Optionally assign a specific user as the admin (enter their User ID).
              </p>
              <div className="flex items-center gap-3 mt-3">
                <input
                  type="number"
                  placeholder="Admin User ID (optional)"
                  value={adminUserId}
                  onChange={(e) => setAdminUserId(e.target.value)}
                  className="w-52 px-3 py-1.5 text-sm border border-brand-300 dark:border-brand-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-400"
                />
                <button
                  onClick={handleInitializeAdmin}
                  disabled={initializingAdmin}
                  className="px-4 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {initializingAdmin && (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  Initialize Admin Role
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <Loader label="Loading permission ceiling..." />
      )}

      {/* Warning when no permissions enabled */}
      {!loading && ceiling && (() => {
        let totalAllowed = 0;
        ceiling.modules.forEach((m) => m.screens.forEach((s) => s.permissions.forEach((p) => { if (p.isAllowed) totalAllowed++; })));
        return totalAllowed === 0;
      })() && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                No permissions enabled for this tenant
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Tenant users will not see any modules or screens until permissions are enabled. Use the <strong>Enable All</strong> button to grant access to all modules, or select specific permissions below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Module tree */}
      {!loading && ceiling && (
        <div className="space-y-3">
          {ceiling.modules.map((mod) => {
            const { total, allowed } = getModuleStats(mod);
            const isExpanded = expandedModules[mod.moduleId] ?? false;

            return (
              <div key={mod.moduleId} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {/* Module header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleModuleExpand(mod.moduleId)}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200"
                    >
                      <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {mod.moduleName}
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400">({allowed}/{total})</span>
                    </button>

                    {/* Module enable/disable toggle */}
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={mod.isEnabled}
                        onChange={() => toggleModuleEnabled(mod.moduleId)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-brand-500" />
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{mod.isEnabled ? 'Enabled' : 'Disabled'}</span>
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => enableAllPermissionsForModule(mod.moduleId)}
                      className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 transition-colors">
                      Select All
                    </button>
                    <button onClick={() => disableAllPermissionsForModule(mod.moduleId)}
                      className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors">
                      Deselect All
                    </button>
                  </div>
                </div>

                {/* Screens and permissions */}
                {isExpanded && (
                  <div className={`divide-y divide-gray-100 dark:divide-gray-700 ${!mod.isEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                    {mod.screens.map((screen) => (
                      <div key={screen.screenId} className="px-4 py-3">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 pl-6">
                          {screen.screenName}
                        </p>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 pl-6">
                          {screen.permissions.map((perm) => (
                            <label key={perm.permissionId} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={perm.isAllowed}
                                onChange={() => togglePermission(mod.moduleId, screen.screenId, perm.permissionId)}
                                className="rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">{perm.permissionName}</span>
                              {perm.category && (
                                <span className="text-xs text-gray-400">({perm.category})</span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state when no tenant selected */}
      {!loading && !ceiling && !selectedTenantId && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
          <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-sm">Select a tenant to configure its permission ceiling</p>
        </div>
      )}
    </div>
  );
};

export default TenantPermissionCeilingPage;
