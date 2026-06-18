import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { permissionService } from '../../services/permissionService';
import Loader from '../../components/ui/loader/Loader';
import type { TenantRole, CreateTenantRoleDto, UpdateTenantRoleDto, UserRoleAssignment } from '../../types/permission';
import TenantRolePermissionPage from './TenantRolePermissionPage';
import GroupImportModal from '../users/GroupImportModal';
import { useConfirm } from '../../components/ui/ConfirmModal';
import SearchableSelect from '../../components/form/SearchableSelect';
import apiClient from '../../lib/axios';
import { API_ENDPOINTS } from '../../constants/api';
import ServerGrid from '../../components/common/ServerGrid/ServerGrid';
import { useAuthHeaders } from '../../hooks/useAuthHeaders';
import { convertToGridColumns, cellRenderers, GridColDef } from '../../gridUtils';
import { useGridSettings } from '../../hooks/useGridSettings';
import { useColumnAccessFilter } from '../../hooks/useColumnAccessFilter';
import { CustomContextMenuItem } from '../../components/common/ServerGrid/components/GridBody';

// Grid id — must match the entry in src/constants/gridRegistry.ts so the
// Super Admin "Grid Settings" screen can govern this grid's columns.
const USER_ROLES_GRID_ID = 'user-roles-list-grid';

// "May 26, 2026" style date used in the Created column.
const formatRoleDate = (value: unknown): string => {
  if (!value) return '-';
  return new Date(value as string).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Column metadata for the roles ServerGrid. Field names mirror the registry
// entry (name, code, description, isActive, createdAt) so admin column rules
// resolve correctly. cellRenderers are static (no component closures) to stay
// compatible with useGridSettings' one-shot column initializer — per-row
// actions live in the right-click context menu instead.
const roleColumnDefs: GridColDef[] = [
  {
    field: 'name',
    headerName: 'Name',
    width: 220,
    type: 'string',
    sortable: true,
    filterable: true,
    cellRenderer: (value: unknown, row?: Record<string, unknown>) => (
      <span className="flex items-center">
        <span className="font-medium text-gray-800 dark:text-gray-200">{value as string}</span>
        {row?.isSystemRole ? (
          <span className="ml-2 text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">
            System
          </span>
        ) : null}
      </span>
    ),
  },
  {
    field: 'code',
    headerName: 'Code',
    width: 160,
    type: 'string',
    sortable: true,
    filterable: true,
    cellRenderer: (value: unknown) => (
      <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{value as string}</span>
    ),
  },
  {
    field: 'description',
    headerName: 'Description',
    width: 300,
    type: 'string',
    sortable: true,
    filterable: true,
    cellRenderer: (value: unknown) => (value ? String(value) : '-'),
  },
  {
    field: 'isActive',
    headerName: 'Active',
    width: 100,
    type: 'boolean',
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.boolean,
  },
  {
    field: 'createdAt',
    headerName: 'Created',
    width: 160,
    type: 'datetime',
    sortable: true,
    filterable: true,
    cellRenderer: formatRoleDate,
  },
];

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

interface UserOption {
  userId: number;
  username: string;
  email: string;
}

const TenantUserRolePage: React.FC = () => {
  const { confirm, ConfirmDialog } = useConfirm();
  const [activeTab, setActiveTab] = useState<'roles' | 'assignment'>('roles');

  const [totalRecords, setTotalRecords] = useState(0);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // Bumped to force the ServerGrid to remount + re-fetch after create/update/delete.
  const [remountKey, setRemountKey] = useState(0);

  // Auth headers for the grid's server-side fetch (Bearer token + CustomerId).
  const { getAuthHeaders } = useAuthHeaders();
  const memoizedGetAuthHeaders = useCallback(() => getAuthHeaders(), [getAuthHeaders]);

  // Column metadata → grid columns, then user prefs (visibility/width/aggregates),
  // then the Super-Admin column ceiling (strips tenant-restricted columns).
  const allRoleColumns = useMemo(() => convertToGridColumns(roleColumnDefs), []);
  const {
    columns: userPrefColumns,
    setColumns,
    updateColumnVisibility,
    updateColumnWidth,
    columnAggregates,
    updateColumnAggregate,
  } = useGridSettings(USER_ROLES_GRID_ID, allRoleColumns);
  const { filteredColumns: roleColumns } = useColumnAccessFilter(USER_ROLES_GRID_ID, userPrefColumns);

  const handleColumnsChange = useCallback((newColumns: any[]) => {
    setColumns(newColumns);
  }, [setColumns]);

  const refreshGrid = useCallback(() => setRemountKey((k) => k + 1), []);

  // Debounce the search box before it reaches the grid's fetch params.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const additionalParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch.trim()) {
      params.CustomGridSearchText = debouncedSearch.trim();
      params.CustomGridSearchColumns = 'Name,Code,Description';
    }
    return params;
  }, [debouncedSearch]);

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

  const [permModal, setPermModal] = useState<{ isOpen: boolean; roleId: number; roleName: string }>({
    isOpen: false, roleId: 0, roleName: '',
  });

  // "Import Groups as roles" shortcut (mirrors the one on the User form). Imports
  // the current tenant's legacy desktop groups as RBAC roles, then refreshes the grid.
  const [groupImportOpen, setGroupImportOpen] = useState(false);
  const currentCustomerId = useMemo<number | null>(() => {
    try {
      const ud = JSON.parse(localStorage.getItem('userData') || 'null');
      return ud?.customerId ? Number(ud.customerId) : null;
    } catch {
      return null;
    }
  }, []);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userRoles, setUserRoles] = useState<UserRoleAssignment[]>([]);
  const [userRolesLoading, setUserRolesLoading] = useState(false);
  const [usersSaving, setUsersSaving] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'assignment' && users.length === 0) {
      setUsersLoading(true);
      apiClient
        .get(API_ENDPOINTS.USERS.GET_USERS, { params: { startRow: 0, endRow: 999 } })
        .then((res) => {
          if (res.data.isSuccess) {
            const data = res.data.response?.data || res.data.response || [];
            setUsers(
              data.map((u: Record<string, unknown>) => ({
                userId: u.userId || u.id,
                username: u.username || u.userName || '',
                email: u.email || '',
              }))
            );
          }
        })
        .catch(() => {})
        .finally(() => setUsersLoading(false));
    }
  }, [activeTab, users.length]);

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
        console.error('[TenantUserRolePage] code-exists check failed', err);
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

  const openEditModal = useCallback((role: TenantRole) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      code: role.code,
      description: role.description || '',
      isActive: role.isActive,
    });
    // In Edit mode the code already exists, so treat it as user-owned — don't
    // let typing in Name overwrite it.
    setCodeManuallyEdited(true);
    setCodeError(null);
    setShowModal(true);
  }, []);

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      // Auto-fill Code from Name while the user hasn't touched it themselves.
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
        const createResponse = await permissionService.createTenantRole(dto);
        if (createResponse.data.isSuccess) {
          const newRoleId = createResponse.data.response;
          setToast({ message: 'Role created successfully', type: 'success' });
          setShowModal(false);
          refreshGrid();
          if (newRoleId) {
            setPermModal({ isOpen: true, roleId: newRoleId, roleName: formData.name });
          }
          setSaving(false);
          return;
        } else {
          // Server rejected — duplicate-code conflict comes back as 400 with this message.
          const msg = createResponse.data.message || 'Failed to create role';
          if (/code .* already exists/i.test(msg)) {
            setCodeError(msg);
            codeInputRef.current?.focus();
            codeInputRef.current?.select();
          } else {
            setToast({ message: msg, type: 'error' });
          }
          setSaving(false);
          return;
        }
      }
      setShowModal(false);
      refreshGrid();
    } catch (err) {
      const apiMessage = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
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

  const handleDelete = useCallback(async (role: TenantRole) => {
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
      refreshGrid();
    } catch {
      setToast({ message: 'Delete failed', type: 'error' });
    }
  }, [confirm, refreshGrid]);

  // Right-click row actions for the roles grid — mirrors the old inline buttons
  // (Edit / Permissions / Delete). System roles can't be deleted.
  const roleContextMenuItems: CustomContextMenuItem[] = useMemo(() => [
    {
      label: 'Edit',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      onClick: (row: TenantRole) => openEditModal(row),
    },
    {
      label: 'Permissions',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      onClick: (row: TenantRole) => setPermModal({ isOpen: true, roleId: row.id, roleName: row.name }),
    },
    {
      label: 'Delete',
      dividerBefore: true,
      color: '#dc2626',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      onClick: (row: TenantRole) => handleDelete(row),
    },
  ], [openEditModal, handleDelete]);

  const loadUserRoles = useCallback(async (userId: number) => {
    setUserRolesLoading(true);
    try {
      const response = await permissionService.getUserRoles(userId);
      if (response.data.isSuccess) {
        setUserRoles(response.data.response);
      } else {
        setToast({ message: response.data.message || 'Failed to load user roles', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to load user roles', type: 'error' });
    } finally {
      setUserRolesLoading(false);
    }
  }, []);

  const handleUserChange = (value: string) => {
    const id = Number(value);
    setSelectedUserId(id || null);
    setUserRoles([]);
    if (id) {
      loadUserRoles(id);
    }
  };

  const userOptions = useMemo(() =>
    users.map((u) => ({
      value: String(u.userId),
      label: `${u.username} (${u.email})`,
    })),
    [users]
  );

  const toggleRole = (roleId: number) => {
    setUserRoles((prev) =>
      prev.map((r) => (r.roleId === roleId ? { ...r, isAssigned: !r.isAssigned } : r))
    );
  };

  const handleSaveAssignments = async () => {
    if (!selectedUserId) return;
    setUsersSaving(true);
    try {
      const assignedRoleIds = userRoles.filter((r) => r.isAssigned).map((r) => r.roleId);
      const response = await permissionService.assignUserRoles(selectedUserId, { userId: selectedUserId, roleIds: assignedRoleIds });
      if (response.data.isSuccess) {
        setToast({ message: 'User roles updated successfully', type: 'success' });
      } else {
        setToast({ message: 'Failed to update user roles', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to update user roles', type: 'error' });
    } finally {
      setUsersSaving(false);
    }
  };

  const assignedCount = userRoles.filter((r) => r.isAssigned).length;

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Roles</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage roles, permissions, and user assignments
        </p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'roles'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Roles & Permissions
        </button>
        <button
          onClick={() => setActiveTab('assignment')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'assignment'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          User Assignment
        </button>
      </div>

      {activeTab === 'roles' && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <input
              type="text"
              placeholder="Search roles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-72 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
            <div className="flex items-center gap-2">
              <button onClick={() => setGroupImportOpen(true)}
                className="px-4 py-2 border border-brand-500 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v10m0 0l-3-3m3 3l3-3M5 19h14" />
                </svg>
                Import Groups
              </button>
              <button onClick={openCreateModal}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Role
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <ServerGrid
              key={`user-roles-grid-${remountKey}`}
              data={[]}
              columns={roleColumns}
              loading={false}
              error={null}
              totalRecords={totalRecords}
              setTotalRecords={setTotalRecords}
              pagination={true}
              pageSize={50}
              editable={false}
              columnChooser={true}
              title="User Roles"
              emptyMessage="No roles found"
              serverSide={true}
              apiUrl={API_ENDPOINTS.TENANT_RBAC.GET_ROLES}
              methodType="GET"
              getAuthHeaders={memoizedGetAuthHeaders}
              defaultSortColumn="createdAt"
              defaultSortDirection="desc"
              additionalParams={additionalParams}
              headerSearch={true}
              gridId={USER_ROLES_GRID_ID}
              getRowId={(row) => String(row.id)}
              onColumnVisibilityChange={updateColumnVisibility}
              onColumnWidthChange={updateColumnWidth}
              onColumnsChange={handleColumnsChange}
              columnAggregates={columnAggregates}
              onAggregateChange={updateColumnAggregate}
              onRowDoubleClick={(row) => openEditModal(row as TenantRole)}
              hideDefaultContextMenuItems={true}
              customContextMenuItems={roleContextMenuItems}
              containerWidth="47%"
            />
          </div>
        </>
      )}

      {activeTab === 'assignment' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <SearchableSelect
              options={userOptions}
              value={selectedUserId ? String(selectedUserId) : ''}
              onChange={handleUserChange}
              placeholder={usersLoading ? 'Loading users...' : 'Select a user...'}
              disabled={usersLoading}
              loading={usersLoading}
              className="w-full sm:w-80"
            />

            {selectedUserId && userRoles.length > 0 && (
              <button
                onClick={handleSaveAssignments}
                disabled={usersSaving}
                className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {usersSaving && (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                Save Assignments
              </button>
            )}
          </div>

          {userRolesLoading && <Loader label="Loading roles..." />}

          {!userRolesLoading && selectedUserId && userRoles.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {assignedCount} of {userRoles.length} roles assigned
                </p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {userRoles.map((role) => (
                  <label
                    key={role.roleId}
                    className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={role.isAssigned}
                      onChange={() => toggleRole(role.roleId)}
                      className="rounded border-gray-300 text-brand-500 focus:ring-brand-500 w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {role.roleName}
                      </p>
                      {role.roleCode && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{role.roleCode}</p>
                      )}
                    </div>
                    {role.isAssigned && (
                      <span className="text-xs px-2 py-0.5 bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 rounded-full">
                        Assigned
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {!userRolesLoading && selectedUserId && userRoles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-sm">No roles available for assignment</p>
            </div>
          )}

          {!selectedUserId && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-sm">Select a user to manage their role assignments</p>
            </div>
          )}
        </>
      )}

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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-brand-500" placeholder="e.g. Store Manager" />
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
                    className={`w-full px-3 py-2 pr-9 border rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none ${
                      codeError
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-gray-300 dark:border-gray-600 focus:border-brand-500'
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-brand-500 resize-none" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="roleIsActive" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                <label htmlFor="roleIsActive" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
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

      <TenantRolePermissionPage
        isOpen={permModal.isOpen}
        onClose={() => setPermModal({ isOpen: false, roleId: 0, roleName: '' })}
        roleId={permModal.roleId}
        roleName={permModal.roleName}
      />

      <GroupImportModal
        isOpen={groupImportOpen}
        onClose={() => setGroupImportOpen(false)}
        defaultTenantId={currentCustomerId}
        onImported={() => {
          setToast({ message: 'Groups imported as roles', type: 'success' });
          refreshGrid();
        }}
      />
      {ConfirmDialog}
    </div>
  );
};

export default TenantUserRolePage;
