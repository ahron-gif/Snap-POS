import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import SearchableSelect from '../../components/form/SearchableSelect';
import { permissionService } from '../../services/permissionService';
import { getAuthHeadersWithCustomerId } from '../../utils/auth';
import { API_ENDPOINTS } from '../../constants/api';
import { useAuth } from '../../context/AuthContext';

/** Minimal tenant shape used by the picker — normalized from either the
 *  all-tenants lookup (super admin) or the operator's assigned-tenants list. */
interface TenantOpt {
  id: number;
  name: string;
}

interface GroupRow {
  groupId: string;
  groupName: string;
  code: string;
  isActive: boolean;
  failed: boolean;
  alreadyImported: boolean;
  warnings: string[];
}

interface ImportResult {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
}

interface GroupImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a successful import (with the imported tenant id) so the caller can refresh roles. */
  onImported?: (tenantId: number) => void;
  defaultTenantId?: number | null;
}

/**
 * Quick "import a tenant's legacy groups as roles" dialog, used as a shortcut from the
 * User form's Roles section. Reuses the GroupImport API. On a successful import it calls
 * onImported() so the parent can refresh its roles.
 */
const GroupImportModal: React.FC<GroupImportModalProps> = ({ isOpen, onClose, onImported, defaultTenantId }) => {
  const { isSuperAdmin } = useAuth();
  const [tenants, setTenants] = useState<TenantOpt[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(defaultTenantId ?? null);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [overwrite, setOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tenantOptions = useMemo(
    () => tenants.map((t) => ({ value: String(t.id), label: t.name })),
    [tenants],
  );

  // The operator's current session tenant — a fallback for a non-super-admin whose
  // assigned-tenants list comes back empty (a plain tenant admin only ever works in
  // their own tenant), so Import Groups still has a tenant to target.
  const currentSessionTenant = useMemo<TenantOpt | null>(() => {
    try {
      const ud = JSON.parse(localStorage.getItem('userData') || 'null');
      if (ud?.customerId) return { id: Number(ud.customerId), name: ud.customerName || `Tenant ${ud.customerId}` };
    } catch { /* ignore malformed userData */ }
    return null;
  }, [isOpen]);

  // Show the dropdown only when there's a real choice: super admins pick from ALL
  // tenants; everyone else only when they have more than one assigned tenant.
  const showTenantPicker = isSuperAdmin() || tenants.length > 1;

  // Load tenants when the modal opens; reset transient state.
  // Super admins → all tenants. Non-super-admins → only their assigned tenants
  // (plus their current session tenant as a fallback).
  useEffect(() => {
    if (!isOpen) return;
    setResult(null);
    setError(null);
    setSelectedTenantId(defaultTenantId ?? null);
    setTenantsLoading(true);

    const loadTenants = async () => {
      try {
        if (isSuperAdmin()) {
          const res = await permissionService.getTenants({ startRow: 0, endRow: 999, sortColumn: 'CustomerName', sortDirection: 'asc' });
          if (res.data.isSuccess) setTenants(res.data.response.data.map((t) => ({ id: t.id, name: t.customerName })));
        } else {
          const res = await permissionService.getMyAssignedTenants();
          let list: TenantOpt[] = res.data.isSuccess
            ? res.data.response.map((t) => ({ id: t.customerId, name: t.customerName }))
            : [];
          if (currentSessionTenant && !list.some((t) => t.id === currentSessionTenant.id)) {
            list = [currentSessionTenant, ...list];
          }
          setTenants(list);
        }
      } catch {
        setError('Failed to load tenants');
      } finally {
        setTenantsLoading(false);
      }
    };
    loadTenants();
  }, [isOpen, defaultTenantId, isSuperAdmin, currentSessionTenant]);

  // When exactly one tenant is available, select it automatically so the user can
  // go straight to the group list without touching a dropdown.
  useEffect(() => {
    if (isOpen && !selectedTenantId && tenants.length === 1) {
      setSelectedTenantId(tenants[0].id);
    }
  }, [isOpen, tenants, selectedTenantId]);

  const loadGroups = useCallback(async (tenantId: number) => {
    setGroupsLoading(true);
    setGroups([]);
    setSelectedIds(new Set());
    try {
      const params = new URLSearchParams({
        startRow: '0', endRow: '999', sortColumn: 'groupName', sortDirection: 'asc',
      });
      const res = await fetch(`${API_ENDPOINTS.GROUP_IMPORT.GET_LEGACY_GROUPS_PAGED}?${params}`, {
        headers: getAuthHeadersWithCustomerId(tenantId),
      });
      const body = await res.json();
      if (body.isSuccess) {
        const rows: GroupRow[] = body.response?.data ?? [];
        setGroups(rows);
        setSelectedIds(new Set(rows.filter((g) => !g.failed && !g.alreadyImported).map((g) => g.groupId)));
      } else {
        setError(body.message || 'Failed to load groups');
      }
    } catch {
      setError('Failed to load groups');
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && selectedTenantId) loadGroups(selectedTenantId);
  }, [isOpen, selectedTenantId, loadGroups]);

  const handleTenantSelect = (value: string) => {
    setSelectedTenantId(value ? Number(value) : null);
    setResult(null);
    setGroups([]);
    setSelectedIds(new Set());
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectableIds = useMemo(() => groups.filter((g) => !g.failed).map((g) => g.groupId), [groups]);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(selectableIds));

  const runImport = async () => {
    if (!selectedTenantId || selectedIds.size === 0) return;
    setImporting(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(API_ENDPOINTS.GROUP_IMPORT.IMPORT, {
        method: 'POST',
        headers: getAuthHeadersWithCustomerId(selectedTenantId),
        body: JSON.stringify({ groupIds: Array.from(selectedIds), overwriteExisting: overwrite }),
      });
      const body = await res.json();
      if (body.isSuccess) {
        setResult(body.response as ImportResult);
        onImported?.(selectedTenantId);  // refresh the caller's roles for this tenant
        loadGroups(selectedTenantId);    // refresh badges
      } else {
        setError(body.message || 'Import failed');
      }
    } catch {
      setError('Import failed');
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Import Groups as Roles</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Pick a tenant and import its legacy desktop groups into RBAC roles. Already-imported
              groups are skipped.
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tenant</label>
          {showTenantPicker ? (
            <SearchableSelect
              options={tenantOptions}
              value={selectedTenantId ? String(selectedTenantId) : ''}
              placeholder="Select a tenant…"
              onChange={handleTenantSelect}
              loading={tenantsLoading}
            />
          ) : (
            <div className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100">
              {tenantsLoading ? 'Loading…' : (tenants[0]?.name ?? 'No tenant available')}
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

          {result && (
            <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm flex flex-wrap gap-x-5 gap-y-1">
              <span className="font-semibold text-green-700 dark:text-green-300">Imported {result.imported}</span>
              <span className="text-blue-600 dark:text-blue-400">Updated {result.updated}</span>
              <span className="text-gray-500 dark:text-gray-400">Skipped {result.skipped}</span>
              <span className="text-red-600 dark:text-red-400">Failed {result.failed}</span>
            </div>
          )}

          {selectedTenantId && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={selectableIds.length === 0}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  Select all ({selectableIds.length})
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={overwrite}
                    onChange={(e) => setOverwrite(e.target.checked)}
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  Update roles with the same code
                </label>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-800 max-h-64 overflow-y-auto">
                {groupsLoading ? (
                  <div className="py-8 text-center text-sm text-gray-500">Loading groups…</div>
                ) : groups.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">No legacy groups found for this tenant.</div>
                ) : (
                  groups.map((g) => (
                    <label
                      key={g.groupId}
                      className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(g.groupId)}
                        disabled={g.failed}
                        onChange={() => toggleRow(g.groupId)}
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-40"
                      />
                      <span className="flex-1 font-medium text-gray-800 dark:text-gray-100">{g.groupName}</span>
                      <span className="text-xs text-gray-400">{g.code}</span>
                      {g.alreadyImported && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          Imported
                        </span>
                      )}
                      {g.failed && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          Invalid
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Close
          </button>
          <button
            onClick={runImport}
            disabled={!selectedTenantId || selectedIds.size === 0 || importing}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? 'Importing…' : `Import selected (${selectedIds.size})`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default GroupImportModal;
