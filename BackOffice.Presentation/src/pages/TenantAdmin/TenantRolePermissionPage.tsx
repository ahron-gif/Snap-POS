import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { permissionService } from '../../services/permissionService';
import Loader from '../../components/ui/loader/Loader';
import type { TenantRolePermissionItem, PermMatrixModuleDto } from '../../types/permission';

interface TenantRolePermissionPageProps {
  isOpen: boolean;
  onClose: () => void;
  roleId: number;
  roleName: string;
}

interface ModuleGroup {
  moduleName: string;
  screens: ScreenGroup[];
}

interface ScreenGroup {
  screenName: string;
  permissions: TenantRolePermissionItem[];
}

const TenantRolePermissionPage: React.FC<TenantRolePermissionPageProps> = ({
  isOpen,
  onClose,
  roleId,
  roleName,
}) => {
  const [permissions, setPermissions] = useState<TenantRolePermissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Flatten the structured module→screen→permission response into a flat array
  const flattenMatrix = (modules: PermMatrixModuleDto[]): TenantRolePermissionItem[] => {
    const items: TenantRolePermissionItem[] = [];
    for (const mod of modules ?? []) {
      for (const screen of mod.screens ?? []) {
        for (const perm of screen.permissions ?? []) {
          items.push({
            permissionId: perm.permissionId,
            permissionKey: perm.permissionKey,
            permissionName: perm.permissionName ?? perm.permissionKey.split('.').pop() ?? '',
            category: perm.category ?? 'action',
            screenName: screen.screenName ?? screen.screenCode ?? '',
            moduleName: mod.moduleName ?? mod.moduleCode ?? '',
            isGranted: perm.isGranted,
            isInCeiling: perm.isInCeiling,
          });
        }
      }
    }
    return items;
  };

  const fetchPermissions = useCallback(async () => {
    if (!roleId) return;
    setLoading(true);
    try {
      const response = await permissionService.getRolePermMatrix(roleId);
      if (response.data.isSuccess) {
        const matrix = response.data.response;
        const flatPerms = flattenMatrix(matrix.modules ?? []);
        setPermissions(flatPerms);
        // Expand all modules by default
        const modules = new Set(flatPerms.map((p) => p.moduleName));
        const expanded: Record<string, boolean> = {};
        modules.forEach((m) => { expanded[m] = true; });
        setExpandedModules(expanded);
      }
    } catch {
      setToast({ message: 'Failed to load permissions', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [roleId]);

  useEffect(() => {
    if (isOpen && roleId) {
      fetchPermissions();
    }
    if (!isOpen) {
      setPermissions([]);
      setExpandedModules({});
      setToast(null);
    }
  }, [isOpen, roleId, fetchPermissions]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const groupedPermissions = useMemo((): ModuleGroup[] => {
    const moduleMap = new Map<string, Map<string, TenantRolePermissionItem[]>>();

    permissions.forEach((perm) => {
      if (!moduleMap.has(perm.moduleName)) {
        moduleMap.set(perm.moduleName, new Map());
      }
      const screenMap = moduleMap.get(perm.moduleName)!;
      if (!screenMap.has(perm.screenName)) {
        screenMap.set(perm.screenName, []);
      }
      screenMap.get(perm.screenName)!.push(perm);
    });

    const result: ModuleGroup[] = [];
    moduleMap.forEach((screenMap, moduleName) => {
      const screens: ScreenGroup[] = [];
      screenMap.forEach((perms, screenName) => {
        screens.push({ screenName, permissions: perms });
      });
      result.push({ moduleName, screens });
    });

    return result;
  }, [permissions]);

  const togglePermission = (permissionKey: string) => {
    setPermissions((prev) =>
      prev.map((p) => (p.permissionKey === permissionKey ? { ...p, isGranted: !p.isGranted } : p))
    );
  };

  const toggleModuleExpand = (moduleName: string) => {
    setExpandedModules((prev) => ({ ...prev, [moduleName]: !prev[moduleName] }));
  };

  const selectAllModule = (moduleName: string) => {
    setPermissions((prev) =>
      prev.map((p) => (p.moduleName === moduleName && p.isInCeiling ? { ...p, isGranted: true } : p))
    );
  };

  const deselectAllModule = (moduleName: string) => {
    setPermissions((prev) =>
      prev.map((p) => (p.moduleName === moduleName ? { ...p, isGranted: false } : p))
    );
  };

  const getModuleStats = (moduleName: string) => {
    const modulePerms = permissions.filter((p) => p.moduleName === moduleName);
    const inCeiling = modulePerms.filter((p) => p.isInCeiling);
    return {
      granted: modulePerms.filter((p) => p.isGranted).length,
      total: modulePerms.length,
      inCeiling: inCeiling.length,
    };
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Backend expects List<RbacRolePermissionItem> — raw array of { permissionKey, isGranted }
      const payload = permissions.map((p) => ({
        permissionKey: p.permissionKey,
        isGranted: p.isGranted,
      }));
      const response = await permissionService.updateRolePermissions(roleId, payload);
      if (response.data.isSuccess) {
        setToast({ message: 'Permissions updated successfully', type: 'success' });
        setTimeout(() => onClose(), 1000);
      } else {
        setToast({ message: response.data.message || 'Failed to update permissions', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to update permissions', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Role Permissions</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{roleName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {toast && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
              {toast.message}
            </div>
          )}

          {loading ? (
            <Loader label="Loading permissions..." />
          ) : groupedPermissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400">No permissions available</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Ask your Super Admin to enable permissions for your tenant</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedPermissions.map((module) => {
                const { granted, total, inCeiling } = getModuleStats(module.moduleName);
                const isExpanded = expandedModules[module.moduleName] ?? false;

                return (
                  <div key={module.moduleName} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900">
                      <button
                        onClick={() => toggleModuleExpand(module.moduleName)}
                        className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200"
                      >
                        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        {module.moduleName}
                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                          ({granted}/{inCeiling} enabled, {total} total)
                        </span>
                      </button>
                      <div className="flex gap-2">
                        <button onClick={() => selectAllModule(module.moduleName)}
                          className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50 transition-colors">
                          Select All
                        </button>
                        <button onClick={() => deselectAllModule(module.moduleName)}
                          className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors">
                          Deselect All
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {module.screens.map((screen) => (
                          <div key={screen.screenName} className="px-4 py-3">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 pl-6">
                              {screen.screenName}
                            </p>
                            <div className="flex flex-wrap gap-x-6 gap-y-2 pl-6">
                              {screen.permissions.map((perm) => (
                                <label
                                  key={perm.permissionKey}
                                  className={`flex items-center gap-2 ${perm.isInCeiling ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                                  title={!perm.isInCeiling ? 'Not in tenant ceiling — contact Super Admin to enable' : perm.permissionKey}
                                >
                                  <input
                                    type="checkbox"
                                    checked={perm.isGranted}
                                    onChange={() => perm.isInCeiling && togglePermission(perm.permissionKey)}
                                    disabled={!perm.isInCeiling}
                                    className="rounded border-gray-300 text-brand-500 focus:ring-brand-500 disabled:opacity-40"
                                  />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {perm.permissionName}
                                  </span>
                                  {!perm.isInCeiling && (
                                    <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <title>Not in tenant ceiling</title>
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
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
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || loading}
            className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
            {saving && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default TenantRolePermissionPage;
