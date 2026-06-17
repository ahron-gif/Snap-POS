import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { permissionService } from '../../services/permissionService';
import type { TenantRole, CreateTenantRoleDto, UpdateTenantRoleDto } from '../../types/permission';
import TenantRolePermissionPage from './TenantRolePermissionPage';
import { useConfirm } from '../../components/ui/ConfirmModal';

interface RoleFormData {
  name: string;
  code: string;
  description: string;
  isActive: boolean;
}

const initialForm: RoleFormData = {
  name: '',
  code: '',
  description: '',
  isActive: true,
};

// Convert a free-text name into a stable role code: uppercase, alphanumerics + underscores only.
const slugifyCode = (name: string): string =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const SkeletonRow: React.FC = () => (
  <tr className="animate-pulse">
    {[...Array(5)].map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
      </td>
    ))}
  </tr>
);

const TenantRoleListPage: React.FC = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [roles, setRoles] = useState<TenantRole[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<TenantRole | null>(null);
  const [formData, setFormData] = useState<RoleFormData>(initialForm);
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  // Token used to ignore stale duplicate-check responses when the user keeps typing.
  const codeCheckSeqRef = useRef(0);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Permission matrix modal
  const [permModal, setPermModal] = useState<{ isOpen: boolean; roleId: number; roleName: string }>({
    isOpen: false, roleId: 0, roleName: '',
  });

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = {
        startRow: page * pageSize,
        endRow: (page + 1) * pageSize,
        sortColumn: 'CreatedAt',
        sortDirection: 'desc',
      };
      if (search.trim()) {
        params.customGridSearchText = search.trim();
        params.customGridSearchColumns = 'Name,Code,Description';
      }
      const response = await permissionService.getTenantRoles(params);
      if (response.data.isSuccess) {
        setRoles(response.data.response.data);
        setTotalRecords(response.data.response.totalRecords);
      } else {
        console.error('[TenantRoles] API error:', response.data.message, response.data);
        setToast({ message: response.data.message || 'Failed to load roles', type: 'error' });
      }
    } catch (err) {
      console.error('[TenantRoles] Request error:', err);
      setToast({ message: 'Failed to load roles', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Debounced duplicate-code check: fires as the Code field changes (whether typed by
  // the user or auto-derived from the Name). Skips the no-op cases (modal closed, empty
  // code, or — in the Edit flow — the code the role already had).
  useEffect(() => {
    if (!showModal) return;
    const code = formData.code.trim();
    if (!code) {
      setCodeError(null);
      setIsCheckingCode(false);
      return;
    }
    if (editingRole && code === editingRole.code) {
      setCodeError(null);
      setIsCheckingCode(false);
      return;
    }

    setIsCheckingCode(true);
    const seq = ++codeCheckSeqRef.current;
    const timer = setTimeout(async () => {
      try {
        const response = await permissionService.tenantRoleCodeExists(code, editingRole?.id);
        if (seq !== codeCheckSeqRef.current) return; // a newer keystroke has superseded this check
        if (response.data.isSuccess && response.data.response) {
          setCodeError(`Code '${code}' is already used.`);
        } else {
          setCodeError(null);
        }
      } catch (err) {
        if (seq !== codeCheckSeqRef.current) return;
        console.error('[TenantRoles] code-exists check failed', err);
        // Network/permission errors shouldn't block the user — the server still validates on submit.
        setCodeError(null);
      } finally {
        if (seq === codeCheckSeqRef.current) setIsCheckingCode(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.code, showModal, editingRole]);

  const openCreateModal = () => {
    setEditingRole(null);
    setFormData(initialForm);
    setCodeManuallyEdited(false);
    setCodeError(null);
    setShowModal(true);
  };

  const openEditModal = (role: TenantRole) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      code: role.code,
      description: role.description || '',
      isActive: role.isActive,
    });
    setCodeManuallyEdited(true);
    setCodeError(null);
    setShowModal(true);
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      // Auto-generate the Code from the Name while the user hasn't touched it themselves.
      code: !editingRole && !codeManuallyEdited ? slugifyCode(name) : prev.code,
    }));
    if (codeError) setCodeError(null);
  };

  const handleCodeChange = (code: string) => {
    setFormData((prev) => ({ ...prev, code }));
    setCodeManuallyEdited(true);
    if (codeError) setCodeError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    setSaving(true);
    try {
      if (editingRole) {
        const dto: UpdateTenantRoleDto = { id: editingRole.id, isSystemRole: editingRole.isSystemRole, ...formData };
        await permissionService.updateTenantRole(editingRole.id, dto);
        setToast({ message: 'Role updated successfully', type: 'success' });
      } else {
        const dto: CreateTenantRoleDto = { ...formData };
        await permissionService.createTenantRole(dto);
        setToast({ message: 'Role created successfully', type: 'success' });
      }
      setShowModal(false);
      loadRoles();
    } catch (err) {
      const apiMessage = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
      // Duplicate-code conflict comes back as a 400 like "Role with code 'X' already exists." — show it inline.
      if (apiMessage && /code .* already exists/i.test(apiMessage)) {
        setCodeError(apiMessage);
        codeInputRef.current?.focus();
        codeInputRef.current?.select();
      } else {
        setToast({ message: apiMessage || 'Operation failed', type: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: TenantRole) => {
    if (role.isSystemRole) {
      setToast({ message: 'System roles cannot be deleted', type: 'error' });
      return;
    }
    const confirmed = await confirm({
      title: 'Delete Role',
      message: `Are you sure you want to delete the role "${role.name}"?`,
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await permissionService.deleteTenantRole(role.id);
      setToast({ message: 'Role deleted successfully', type: 'success' });
      loadRoles();
    } catch {
      setToast({ message: 'Delete failed', type: 'error' });
    }
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const totalPages = Math.ceil(totalRecords / pageSize);

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tenant Roles</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage roles and their permission assignments within your organization
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search roles..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="w-full sm:w-72 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        />
        <button onClick={openCreateModal}
          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Role
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Code</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Description</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Active</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Created</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <p>No roles found</p>
                  </td>
                </tr>
              ) : (
                roles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                      {role.name}
                      {role.isSystemRole && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">{role.code}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">{role.description || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${role.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {role.isActive ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(role.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openEditModal(role)} className="text-brand-500 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {!role.isSystemRole && (
                          <button onClick={() => handleDelete(role)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Delete">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                        <button onClick={() => setPermModal({ isOpen: true, roleId: role.id, roleName: role.name })}
                          className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300" title="Permissions">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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

      {/* Create / Edit Role Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingRole ? 'Edit Role' : 'Add Role'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                <input type="text" required value={formData.name} onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500" placeholder="e.g. Store Manager" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Code *
                  {!editingRole && !codeManuallyEdited && (
                    <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">(auto-generated, edit to override)</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    ref={codeInputRef}
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    aria-invalid={!!codeError}
                    aria-busy={isCheckingCode}
                    className={`w-full px-3 py-2 pr-9 border rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 ${
                      codeError
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-brand-500'
                    }`}
                    placeholder="e.g. STORE_MGR"
                  />
                  {isCheckingCode && (
                    <svg className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                </div>
                {codeError && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{codeError} Please choose a different code.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 resize-none" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="tenantRoleIsActive" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                <label htmlFor="tenantRoleIsActive" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Cancel</button>
                <button type="submit" disabled={saving || isCheckingCode || !!codeError}
                  className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
                  {saving && (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {editingRole ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permission matrix modal */}
      <TenantRolePermissionPage
        isOpen={permModal.isOpen}
        onClose={() => setPermModal({ isOpen: false, roleId: 0, roleName: '' })}
        roleId={permModal.roleId}
        roleName={permModal.roleName}
      />
      {ConfirmDialog}
    </div>
  );
};

export default TenantRoleListPage;
