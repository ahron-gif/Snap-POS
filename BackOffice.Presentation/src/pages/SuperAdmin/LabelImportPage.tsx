import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ServerGrid from '../../components/common/ServerGrid/ServerGrid';
import { convertToGridColumns, GridColDef } from '../../gridUtils';
import SearchableSelect from '../../components/form/SearchableSelect';
import { permissionService } from '../../services/permissionService';
import { getAuthHeadersWithCustomerId } from '../../utils/auth';
import { API_ENDPOINTS } from '../../constants/api';
import Tooltip from '../../components/common/Tooltip';
import type { TenantListItem } from '../../types/permission';

// Row shape returned by the paged endpoint (camelCase LegacyLayoutPreviewDto)
interface LegacyLayoutPreviewRow {
  printLabelLayoutId: string;
  layoutName: string;
  labelType: number;
  labelWidth: number;
  labelHeight: number;
  columnsPerPage: number;
  rowsPerPage: number;
  elementCount: number;
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

const LABEL_TYPE_NAMES: Record<number, string> = {
  1: 'Item Label',
  2: 'Shelf Tag',
  3: 'Price Label',
  4: 'Barcode Label',
  5: 'Custom',
};

const LABEL_IMPORT_GRID_ID = 'label-import-legacy-grid';

// ── Cell renderers ───────────────────────────────────────────────
const statusCell = (_v: unknown, row?: LegacyLayoutPreviewRow): React.ReactNode => {
  if (!row) return null;
  const base = 'px-2 py-0.5 rounded-full text-xs font-medium';
  if (row.failed)
    return <span className={`${base} bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300`}>Failed</span>;
  if (row.alreadyImported)
    return <span className={`${base} bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300`}>Already imported</span>;
  return <span className={`${base} bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300`}>Ready</span>;
};

const warningsCell = (_v: unknown, row?: LegacyLayoutPreviewRow): React.ReactNode => {
  const warnings = row?.warnings ?? [];
  if (warnings.length === 0) return <span className="text-gray-400">—</span>;
  return (
    <Tooltip text={warnings.join('\n')}>
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 cursor-help">
        {warnings.length} warning{warnings.length > 1 ? 's' : ''}
      </span>
    </Tooltip>
  );
};

const columnDefs: GridColDef[] = [
  { field: 'layoutName', headerName: 'Layout Name', width: 240, type: 'string', sortable: true, filterable: false },
  { field: 'labelType', headerName: 'Type', width: 130, type: 'number', sortable: true, filterable: false,
    cellRenderer: (v: number) => LABEL_TYPE_NAMES[v] ?? 'Custom' },
  { field: 'labelWidth', headerName: 'Size', width: 150, type: 'number', sortable: true, filterable: false,
    cellRenderer: (_v, row) => `${(row as LegacyLayoutPreviewRow).labelWidth}" × ${(row as LegacyLayoutPreviewRow).labelHeight}"` },
  { field: 'columnsPerPage', headerName: 'Cols × Rows', width: 120, type: 'number', sortable: true, filterable: false,
    cellRenderer: (_v, row) => `${(row as LegacyLayoutPreviewRow).columnsPerPage} × ${(row as LegacyLayoutPreviewRow).rowsPerPage}` },
  { field: 'elementCount', headerName: 'Elements', width: 110, type: 'number', sortable: true, filterable: false },
  { field: 'alreadyImported', headerName: 'Status', width: 160, type: 'string', sortable: true, filterable: false,
    cellRenderer: statusCell },
  { field: 'warnings', headerName: 'Warnings', width: 130, type: 'string', sortable: false, filterable: false,
    cellRenderer: warningsCell },
];

const LabelImportPage: React.FC = () => {
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [overwrite, setOverwrite] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [remountKey, setRemountKey] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [tenantsLoading, setTenantsLoading] = useState(true);

  const columns = useMemo(() => convertToGridColumns(columnDefs), []);
  const tenantOptions = useMemo(
    () => tenants.map((t) => ({ value: String(t.id), label: t.customerName })),
    [tenants],
  );

  // Load tenants for the dropdown
  useEffect(() => {
    permissionService
      .getTenants({ startRow: 0, endRow: 999, sortColumn: 'CustomerName', sortDirection: 'asc' })
      .then((res) => {
        if (res.data.isSuccess) setTenants(res.data.response.data);
      })
      .catch(() => setToast({ message: 'Failed to load tenants', type: 'error' }))
      .finally(() => setTenantsLoading(false));
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ServerGrid auth headers carry the selected tenant so the API binds to its DB.
  const getGridHeaders = useCallback(
    () => getAuthHeadersWithCustomerId(selectedTenantId) as Record<string, string>,
    [selectedTenantId],
  );

  const handleTenantSelect = (value: string) => {
    const id = value ? Number(value) : null;
    setSelectedTenantId(id);
    setSelectedRows(new Set());
    setResult(null);
    setRemountKey((k) => k + 1);
  };

  const handleRowSelection = useCallback((rowId: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const runImport = async (importAll: boolean) => {
    if (!selectedTenantId) return;
    const layoutIds = importAll ? null : Array.from(selectedRows);
    if (!importAll && layoutIds!.length === 0) return;

    setImporting(true);
    setResult(null);
    try {
      const res = await fetch(API_ENDPOINTS.LABEL_IMPORT.IMPORT, {
        method: 'POST',
        headers: getAuthHeadersWithCustomerId(selectedTenantId),
        body: JSON.stringify({ layoutIds, overwriteExisting: overwrite }),
      });
      const body = await res.json();
      if (body.isSuccess) {
        setResult(body.response as ImportResult);
        setToast({ message: body.message || 'Import complete', type: 'success' });
        setSelectedRows(new Set());
        setRemountKey((k) => k + 1); // refetch so "Already imported" badges update
      } else {
        setToast({ message: body.message || 'Import failed', type: 'error' });
      }
    } catch {
      setToast({ message: 'Import failed', type: 'error' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Legacy Labels</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Migrate a tenant's desktop Back Office label layouts into the web Label Designer. The original
          desktop layouts are left untouched, and layouts already imported are never duplicated.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-3">
        <div className="w-full sm:w-80">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tenant</label>
          <SearchableSelect
            options={tenantOptions}
            value={selectedTenantId ? String(selectedTenantId) : ''}
            placeholder="Select a tenant…"
            onChange={handleTenantSelect}
            loading={tenantsLoading}
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 pb-2">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          Overwrite templates with the same name
        </label>

        <div className="sm:ml-auto flex items-center gap-2 pb-1">
          <button
            onClick={() => runImport(false)}
            disabled={!selectedTenantId || selectedRows.size === 0 || importing}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? 'Importing…' : `Import selected (${selectedRows.size})`}
          </button>
          <button
            onClick={() => runImport(true)}
            disabled={!selectedTenantId || importing || totalRecords === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-brand-500 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Import all
          </button>
        </div>
      </div>

      {/* Result summary */}
      {result && (
        <div className="mb-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="font-semibold text-gray-900 dark:text-white">Last import:</span>
            <span className="text-green-600 dark:text-green-400">Imported {result.imported}</span>
            <span className="text-blue-600 dark:text-blue-400">Updated {result.updated}</span>
            <span className="text-gray-500 dark:text-gray-400">Skipped {result.skipped}</span>
            <span className="text-red-600 dark:text-red-400">Failed {result.failed}</span>
          </div>
        </div>
      )}

      {/* Grid */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {selectedTenantId ? (
          <ServerGrid
            key={`label-import-${selectedTenantId}-${remountKey}`}
            data={[]}
            columns={columns}
            gridId={LABEL_IMPORT_GRID_ID}
            loading={false}
            error={null}
            pagination={true}
            pageSize={10}
            serverSide={true}
            apiUrl={API_ENDPOINTS.LABEL_IMPORT.GET_LEGACY_LAYOUTS_PAGED}
            methodType="GET"
            getAuthHeaders={getGridHeaders}
            defaultSortColumn="layoutName"
            defaultSortDirection="asc"
            title="Legacy Layouts"
            emptyMessage="No legacy layouts found for this tenant"
            emptyIcon="🏷️"
            showCheckboxes={true}
            selectedRows={selectedRows}
            onRowSelection={handleRowSelection}
            getRowId={(row) => row.printLabelLayoutId}
            setTotalRecords={setTotalRecords}
            headerSearch={true}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 6h.008v.008H6V6z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">No tenant selected</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              Choose a tenant from the dropdown above to view its legacy Back Office label layouts and
              import them into the web Label Designer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LabelImportPage;
