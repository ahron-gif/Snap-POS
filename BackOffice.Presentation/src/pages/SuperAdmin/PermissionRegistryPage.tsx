import React, { useEffect, useState } from 'react';
import { permissionService } from '../../services/permissionService';
import Loader from '../../components/ui/loader/Loader';
import type { RegistryModule, RegistryPermission, RegistryScreen } from '../../types/permission';

// Flatten module tree (modules can have children in a tree structure)
const flattenModules = (modules: RegistryModule[]): RegistryModule[] => {
  const result: RegistryModule[] = [];
  const traverse = (list: RegistryModule[]) => {
    for (const m of list) {
      result.push(m);
      if (m.children && m.children.length > 0) {
        traverse(m.children);
      }
    }
  };
  traverse(modules);
  return result;
};

const getModuleId = (mod: RegistryModule): number => {
  return mod.moduleId ?? 0;
};

const PermissionRegistryPage: React.FC = () => {
  const [modules, setModules] = useState<RegistryModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({});
  const [searchText, setSearchText] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [editingPermission, setEditingPermission] = useState<RegistryPermission | null>(null);
  const [permissionScreen, setPermissionScreen] = useState<RegistryScreen | null>(null);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);

  const [editingScreen, setEditingScreen] = useState<RegistryScreen | null>(null);
  const [screenModuleName, setScreenModuleName] = useState<string>('');
  const [isScreenModalOpen, setIsScreenModalOpen] = useState(false);

  // Add new screen (module-wise)
  const [newScreenModuleId, setNewScreenModuleId] = useState<number | null>(null);
  const [newScreenModuleName, setNewScreenModuleName] = useState<string>('');
  const [newScreenForm, setNewScreenForm] = useState({
    code: '',
    name: '',
    route: '',
    icon: '',
    sortOrder: 0,
  });
  const [isNewScreenModalOpen, setIsNewScreenModalOpen] = useState(false);
  const [savingScreen, setSavingScreen] = useState(false);
  const [resolvingModuleId, setResolvingModuleId] = useState(false);

  useEffect(() => {
    setLoading(true);
    permissionService.getModuleTree()
      .then((res) => {
        if (res.data.isSuccess) {
          const data = flattenModules(res.data.response);
          setModules(data);
          const expanded: Record<number, boolean> = {};
          data.forEach((m) => { const id = getModuleId(m); if (id) expanded[id] = true; });
          setExpandedModules(expanded);
        }
      })
      .catch(() => {
        setToast({ message: 'Failed to load permission registry', type: 'error' });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // When Add Screen modal opens, resolve Module Id from backend using the header's module name
  useEffect(() => {
    if (!isNewScreenModalOpen || !newScreenModuleName?.trim()) return;
    let cancelled = false;
    setResolvingModuleId(true);
    setNewScreenModuleId(null);
    permissionService
      .getModuleByName(newScreenModuleName.trim())
      .then((res) => {
        if (cancelled) return;
        if (res.data.isSuccess && res.data.response?.moduleId != null) {
          setNewScreenModuleId(res.data.response.moduleId);
        } else {
          setNewScreenModuleId(null);
          setToast({ message: res.data.message || `Module not found: ${newScreenModuleName}`, type: 'error' });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNewScreenModuleId(null);
          setToast({ message: 'Failed to resolve module', type: 'error' });
        }
      })
      .finally(() => {
        if (!cancelled) setResolvingModuleId(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isNewScreenModalOpen, newScreenModuleName]);

  const toggleModule = (moduleId: number) => {
    setExpandedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const openCreatePermissionModal = (screen: RegistryScreen, moduleName: string) => {
    setPermissionScreen(screen);
    setEditingPermission({
      id: 0,
      moduleId: screen.moduleId,
      screenId: screen.id,
      permissionKey: '',
      name: '',
      category: 'action',
      sortOrder: (screen.permissions?.length ?? 0) + 1,
      isActive: true,
      moduleName,
      screenName: screen.name,
    });
    setIsPermissionModalOpen(true);
  };

  const openEditPermissionModal = (perm: RegistryPermission, screen: RegistryScreen) => {
    setPermissionScreen(screen);
    setEditingPermission(perm);
    setIsPermissionModalOpen(true);
  };

  const closePermissionModal = () => {
    setIsPermissionModalOpen(false);
    setEditingPermission(null);
    setPermissionScreen(null);
  };

  // Open Add Screen popup: module name from header; Module Id will be resolved from backend by that name
  const openAddScreenModal = (mod: RegistryModule) => {
    const moduleName = mod.moduleName ?? '';
    if (!moduleName.trim()) {
      setToast({ message: 'Module name is required', type: 'error' });
      return;
    }
    const screens = mod.screens ?? [];
    setNewScreenModuleName(moduleName.trim());
    setNewScreenModuleId(null);
    setNewScreenForm({
      code: '',
      name: '',
      route: '',
      icon: '',
      sortOrder: screens.length,
    });
    setIsNewScreenModalOpen(true);
  };

  const closeNewScreenModal = () => {
    setIsNewScreenModalOpen(false);
    setNewScreenModuleId(null);
    setNewScreenModuleName('');
    setResolvingModuleId(false);
    setNewScreenForm({ code: '', name: '', route: '', icon: '', sortOrder: 0 });
  };

  const handleCreateScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newScreenModuleId == null) {
      setToast({ message: 'Module Id is not set. Close and reopen the popup or check the module name.', type: 'error' });
      return;
    }
    const { code, name, route, icon, sortOrder } = newScreenForm;
    if (!code.trim() || !name.trim()) {
      setToast({ message: 'Code and Name are required', type: 'error' });
      return;
    }
    try {
      setSavingScreen(true);
      const res = await permissionService.createScreen({
        moduleId: newScreenModuleId,
        code: code.trim(),
        name: name.trim(),
        route: route.trim() || undefined,
        icon: icon.trim() || undefined,
        sortOrder,
      });
      if (!res.data.isSuccess) {
        throw new Error(res.data.message);
      }
      setToast({ message: 'Screen created successfully', type: 'success' });
      closeNewScreenModal();
      await refreshModuleTree();
    } catch (err: any) {
      setToast({
        message: err?.message || 'Failed to create screen',
        type: 'error',
      });
    } finally {
      setSavingScreen(false);
    }
  };

  const refreshModuleTree = async () => {
    try {
      setLoading(true);
      const res = await permissionService.getModuleTree();
      if (res.data.isSuccess) {
        const data = flattenModules(res.data.response);
        setModules(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSavePermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPermission || !permissionScreen) return;

    try {
      const isNew = editingPermission.id === 0;
      if (isNew) {
        const dto = {
          moduleId: editingPermission.moduleId,
          screenId: editingPermission.screenId,
          permissionKey: editingPermission.permissionKey.trim(),
          name: editingPermission.name.trim(),
          category: editingPermission.category || 'action',
          sortOrder: editingPermission.sortOrder,
        };
        const res = await permissionService.createPermission(dto);
        if (!res.data.isSuccess) {
          throw new Error(res.data.message);
        }
        setToast({ message: 'Permission created successfully', type: 'success' });
      } else {
        const dto = {
          moduleId: editingPermission.moduleId,
          screenId: editingPermission.screenId,
          permissionKey: editingPermission.permissionKey.trim(),
          name: editingPermission.name.trim(),
          category: editingPermission.category || 'action',
          sortOrder: editingPermission.sortOrder,
          isActive: editingPermission.isActive,
        };
        const res = await permissionService.updatePermission(editingPermission.id, dto);
        if (!res.data.isSuccess) {
          throw new Error(res.data.message);
        }
        setToast({ message: 'Permission updated successfully', type: 'success' });
      }

      closePermissionModal();
      await refreshModuleTree();
    } catch (err: any) {
      setToast({
        message: err?.message || 'Failed to save permission',
        type: 'error',
      });
    }
  };

  // Filter modules/screens/permissions based on search
  const filteredModules = modules
    .map((mod) => {
      if (!searchText.trim()) return mod;
      const lowerSearch = searchText.toLowerCase();
      const screens = mod.screens ?? [];

      const filteredScreens = screens
        .map((screen) => {
          const perms = screen.permissions ?? [];
          const filteredPerms = perms.filter(
            (p) =>
              p.permissionKey.toLowerCase().includes(lowerSearch) ||
              p.name.toLowerCase().includes(lowerSearch) ||
              p.category?.toLowerCase().includes(lowerSearch)
          );
          if (filteredPerms.length > 0) {
            return { ...screen, permissions: filteredPerms };
          }
          if (screen.name.toLowerCase().includes(lowerSearch) || screen.code.toLowerCase().includes(lowerSearch)) {
            return screen;
          }
          return null;
        })
        .filter(Boolean) as typeof mod.screens;

      if (filteredScreens.length > 0) {
        return { ...mod, screens: filteredScreens };
      }
      if (mod.moduleName.toLowerCase().includes(lowerSearch) || mod.code.toLowerCase().includes(lowerSearch)) {
        return mod;
      }
      return null;
    })
    .filter(Boolean) as RegistryModule[];

  const totalPermissions = modules.reduce(
    (sum, m) => sum + (m.screens ?? []).reduce((s2, sc) => s2 + (sc.permissions ?? []).length, 0),
    0
  );

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Permission Registry</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Browse all registered modules, screens, and permissions ({modules.length} modules, {totalPermissions} permissions)
        </p>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search permissions, screens, or modules..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-full sm:w-96 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
      </div>

      {loading && (
        <Loader label="Loading permission registry..." />
      )}

      {!loading && (
        <div className="space-y-3">
          {filteredModules.map((mod) => {
            const modId = getModuleId(mod);
            const isExpanded = expandedModules[modId] ?? false;
            const screens = mod.screens ?? [];
            const permCount = screens.reduce((sum, s) => sum + (s.permissions ?? []).length, 0);

            return (
              <div key={modId} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleModule(modId)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className={`w-4 h-4 transition-transform text-gray-500 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{mod.moduleName}</span>
                    <span className="text-xs px-2 py-0.5 bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 rounded-full">{mod.code}</span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {screens.length} screens, {permCount} permissions
                  </span>
                </button>

                {isExpanded && (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    <div className="px-4 py-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => openAddScreenModal(mod)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-dashed border-brand-400 text-brand-600 hover:bg-brand-50 dark:border-brand-500 dark:text-brand-400 dark:hover:bg-brand-900/20"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Screen
                      </button>
                    </div>
                    {screens.map((screen) => {
                      const perms = screen.permissions ?? [];
                      return (
                        <div key={screen.id} className="px-4 py-3">
                          <div className="flex items-center gap-2 mb-2 pl-6">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {screen.name}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded">
                              {screen.code}
                            </span>
                          </div>
                          {perms.length > 0 ? (
                            <div className="pl-6">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-400 dark:text-gray-500">
                                    <th className="text-left py-1 pr-4 font-medium">Key</th>
                                    <th className="text-left py-1 pr-4 font-medium">Name</th>
                                    <th className="text-left py-1 font-medium">Category</th>
                                    <th className="text-right py-1 font-medium">Sort</th>
                                    <th className="text-center py-1 font-medium">Active</th>
                                    <th className="text-center py-1 font-medium">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {perms.map((perm) => (
                                    <tr key={perm.id} className="text-gray-600 dark:text-gray-400">
                                      <td className="py-1 pr-4 font-mono text-xs text-brand-600 dark:text-brand-400">{perm.permissionKey}</td>
                                      <td className="py-1 pr-4">{perm.name}</td>
                                      <td className="py-1">
                                        {perm.category && (
                                          <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400">
                                            {perm.category}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-1 text-right">{perm.sortOrder}</td>
                                      <td className="py-1 text-center">
                                        <span
                                          className={`inline-flex px-1.5 py-0.5 rounded text-[10px] ${
                                            perm.isActive
                                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                              : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                          }`}
                                        >
                                          {perm.isActive ? 'Yes' : 'No'}
                                        </span>
                                      </td>
                                      <td className="py-1 text-center">
                                        <button
                                          type="button"
                                          onClick={() => openEditPermissionModal(perm, screen)}
                                          className="text-brand-500 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-[11px]"
                                        >
                                          Edit
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="pl-6 text-xs text-gray-400 italic">No permissions registered</p>
                          )}
                          <div className="pl-6 mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => openCreatePermissionModal(screen, mod.moduleName)}
                              className="inline-flex items-center px-2 py-1 text-[11px] rounded border border-dashed border-gray-300 text-gray-600 hover:border-brand-400 hover:text-brand-500 dark:border-gray-600 dark:text-gray-300"
                            >
                              + Add Permission
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingScreen(screen);
                                setScreenModuleName(mod.moduleName);
                                setIsScreenModalOpen(true);
                              }}
                              className="inline-flex items-center px-2 py-1 text-[11px] rounded border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-500 dark:border-gray-600 dark:text-gray-300"
                            >
                              Edit Screen
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {filteredModules.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {searchText ? 'No results match your search' : 'No modules registered'}
            </div>
          )}
        </div>
      )}

      {/* Permission Create/Edit Modal */}
      {isPermissionModalOpen && editingPermission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {editingPermission.id === 0 ? 'Add Permission' : 'Edit Permission'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {editingPermission.moduleName} / {editingPermission.screenName}
                </p>
              </div>
              <button
                type="button"
                onClick={closePermissionModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSavePermission} className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Permission Key *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPermission.permissionKey}
                    onChange={(e) =>
                      setEditingPermission({ ...editingPermission, permissionKey: e.target.value })
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPermission.name}
                    onChange={(e) =>
                      setEditingPermission({ ...editingPermission, name: e.target.value })
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={editingPermission.category || 'action'}
                    onChange={(e) =>
                      setEditingPermission({ ...editingPermission, category: e.target.value })
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="action">action</option>
                    <option value="field">field</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={editingPermission.sortOrder}
                    onChange={(e) =>
                      setEditingPermission({
                        ...editingPermission,
                        sortOrder: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={editingPermission.isActive}
                      onChange={(e) =>
                        setEditingPermission({ ...editingPermission, isActive: e.target.checked })
                      }
                      className="h-3.5 w-3.5 rounded border-gray-300"
                    />
                    Active
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 pb-3">
                <button
                  type="button"
                  onClick={closePermissionModal}
                  className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium"
                >
                  {editingPermission.id === 0 ? 'Create' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Screen Edit Modal */}
      {isScreenModalOpen && editingScreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Edit Screen
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {screenModuleName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsScreenModalOpen(false);
                  setEditingScreen(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingScreen) return;
                const headerModuleName = (screenModuleName ?? '').trim();
                if (!headerModuleName) {
                  setToast({ message: 'Module name from header is missing', type: 'error' });
                  return;
                }
                try {
                  // Obtain ModuleId from backend using ModuleName from the header
                  const moduleRes = await permissionService.getModuleByName(headerModuleName);
                  if (!moduleRes.data.isSuccess || !moduleRes.data.response?.moduleId) {
                    setToast({ message: moduleRes.data.message || `Module not found: ${headerModuleName}`, type: 'error' });
                    return;
                  }
                  const moduleId = moduleRes.data.response.moduleId;
                  const dto = {
                    moduleId,
                    code: (editingScreen.code ?? '').trim(),
                    name: (editingScreen.name ?? '').trim(),
                    route: editingScreen.route?.trim() || null,
                    icon: editingScreen.icon?.trim() || null,
                    sortOrder: editingScreen.sortOrder,
                    isActive: editingScreen.isActive,
                  };
                  const res = await permissionService.updateScreen(editingScreen.id, dto);
                  if (!res.data.isSuccess) {
                    throw new Error(res.data.message);
                  }
                  setToast({ message: 'Screen updated successfully', type: 'success' });
                  setIsScreenModalOpen(false);
                  setEditingScreen(null);
                  await refreshModuleTree();
                } catch (err: any) {
                  setToast({
                    message: err?.message || 'Failed to update screen',
                    type: 'error',
                  });
                }
              }}
              className="px-5 py-4 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingScreen.code}
                    onChange={(e) =>
                      setEditingScreen({ ...editingScreen, code: e.target.value })
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingScreen.name}
                    onChange={(e) =>
                      setEditingScreen({ ...editingScreen, name: e.target.value })
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Route
                  </label>
                  <input
                    type="text"
                    value={editingScreen.route || ''}
                    onChange={(e) =>
                      setEditingScreen({ ...editingScreen, route: e.target.value })
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Icon
                  </label>
                  <input
                    type="text"
                    value={editingScreen.icon || ''}
                    onChange={(e) =>
                      setEditingScreen({ ...editingScreen, icon: e.target.value })
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={editingScreen.sortOrder}
                    onChange={(e) =>
                      setEditingScreen({
                        ...editingScreen,
                        sortOrder: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={editingScreen.isActive}
                      onChange={(e) =>
                        setEditingScreen({ ...editingScreen, isActive: e.target.checked })
                      }
                      className="h-3.5 w-3.5 rounded border-gray-300"
                    />
                    Active
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 pb-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsScreenModalOpen(false);
                    setEditingScreen(null);
                  }}
                  className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Screen Modal (module-wise) */}
      {isNewScreenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Add Screen
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Module: {newScreenModuleName}
                </p>
              </div>
              <button
                type="button"
                onClick={closeNewScreenModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateScreen} className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={newScreenForm.code}
                    onChange={(e) =>
                      setNewScreenForm((f) => ({ ...f, code: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newScreenForm.name}
                    onChange={(e) =>
                      setNewScreenForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Route
                  </label>
                  <input
                    type="text"
                    value={newScreenForm.route}
                    onChange={(e) =>
                      setNewScreenForm((f) => ({ ...f, route: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Icon
                  </label>
                  <input
                    type="text"
                    value={newScreenForm.icon}
                    onChange={(e) =>
                      setNewScreenForm((f) => ({ ...f, icon: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={newScreenForm.sortOrder}
                  onChange={(e) =>
                    setNewScreenForm((f) => ({
                      ...f,
                      sortOrder: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className="w-full max-w-[120px] px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 pb-3">
                <button
                  type="button"
                  onClick={closeNewScreenModal}
                  className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingScreen || resolvingModuleId || newScreenModuleId == null}
                  className="px-4 py-1.5 text-xs bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-60"
                >
                  {savingScreen ? 'Creating...' : resolvingModuleId ? 'Resolving module...' : 'Create Screen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermissionRegistryPage;
