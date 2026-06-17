import React, { useCallback, useMemo, useRef, useState } from 'react';
import ServerGrid from '../../../components/common/ServerGrid/ServerGrid';
import { useAuthHeaders } from '../../../hooks/useAuthHeaders';
import {
  convertToGridColumns,
  cellRenderers,
  GridColDef,
} from '../../../gridUtils';
import ActionHeader from '../../../components/common/ActionHeader';
import { useGridSettings } from '../../../hooks/useGridSettings';
import { useColumnAccessFilter } from '../../../hooks/useColumnAccessFilter';
import { useConfirm } from '../../../components/ui/ConfirmModal';
import { CustomContextMenuItem } from '../../../components/common/ServerGrid/components/GridBody';
import { BASE_API_URL } from '../../../constants/api';
import {
  customDateScopeService,
  type CustomDateScope,
} from '../../../services/customDateScopeService';
import CustomDateScopeFormModal from './CustomDateScopeFormModal';

// Module-level ref carrying the live row-action handlers. The Actions column
// renderer is defined statically (so `useGridSettings` can keep its identity
// stable across renders), but it needs to dispatch into hot React-state
// callbacks. Pointing it at this ref — which the component re-populates each
// render — gives us closure-fresh handlers without forcing column re-creation.
const rowActionHandlersRef: {
  current: {
    onEdit?: (row: CustomDateScope) => void;
    onDelete?: (row: CustomDateScope) => void;
  };
} = { current: {} };

// Inline Edit / Delete buttons rendered in the row's Actions cell.
const rowActionsCellRenderer = (_value: unknown, row?: CustomDateScope): React.ReactNode => {
  if (!row) return null;
  return (
    <div
      // Stop propagation so clicking a button doesn't also trigger the row's
      // double-click / selection handlers in the grid.
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{ display: 'inline-flex', gap: 6 }}
    >
      <button
        type="button"
        onClick={() => rowActionHandlersRef.current.onEdit?.(row)}
        title="Edit"
        style={{
          padding: '2px 10px',
          fontSize: 11,
          borderRadius: 6,
          border: '1px solid #c7d2fe',
          background: '#eef2ff',
          color: '#4338ca',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => rowActionHandlersRef.current.onDelete?.(row)}
        title="Delete"
        style={{
          padding: '2px 10px',
          fontSize: 11,
          borderRadius: 6,
          border: '1px solid #fecaca',
          background: '#fef2f2',
          color: '#b91c1c',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        Delete
      </button>
    </div>
  );
};

// Status renderer — same Active / Inactive pill the rest of the app uses
// (Manufacturer / ItemGroup list pages). Kept inline so the visual matches
// without dragging in a shared helper that's only used here.
const statusCellRenderer = (value: boolean | null | undefined): React.ReactNode => {
  const isActive = value === true;
  return React.createElement(
    'span',
    {
      style: {
        padding: '2px 8px',
        borderRadius: '12px',
        backgroundColor: isActive ? '#dcfce7' : '#f3f4f6',
        color: isActive ? '#166534' : '#6b7280',
        fontSize: '12px',
        fontWeight: 500,
      },
    },
    isActive ? 'Active' : 'Inactive',
  );
};

// Column definitions for Custom Date Scope grid. Field names mirror the
// camelCase JSON the API emits; the backend's SortHelper resolves them
// case-insensitively against the DTO.
const customDateScopeColumnDefs: GridColDef[] = [
  {
    // Declared as a string column on purpose. ServerGrid's GridBody
    // hard-codes `textAlign: right` for number columns, but visually we want
    // the position number left-aligned next to the Name. The backend's
    // SortHelper still sorts the underlying int property correctly
    // regardless of what the frontend column type says.
    field: 'sortOrder',
    headerName: 'Sort',
    width: 110,
    type: 'string',
    sortable: true,
    filterable: true,
  },
  {
    field: 'name',
    headerName: 'Name',
    width: 240,
    type: 'string',
    sortable: true,
    filterable: true,
  },
  {
    field: 'description',
    headerName: 'Description',
    width: 280,
    type: 'string',
    sortable: true,
    filterable: true,
  },
  {
    field: 'fromDate',
    headerName: 'From',
    width: 130,
    type: 'date',
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.date,
  },
  {
    field: 'toDate',
    headerName: 'To',
    width: 130,
    type: 'date',
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.date,
  },
  {
    field: 'isActive',
    headerName: 'Status',
    width: 110,
    type: 'boolean',
    sortable: true,
    filterable: true,
    cellRenderer: statusCellRenderer,
  },
  {
    // Pinned-feel actions column. Not sortable / filterable — this isn't
    // data, it's per-row controls. The renderer dispatches into the
    // module-level handler ref so the buttons always invoke the latest
    // edit / delete callbacks from the parent component.
    field: '_actions',
    headerName: 'Actions',
    width: 140,
    type: 'string',
    sortable: false,
    filterable: false,
    cellRenderer: rowActionsCellRenderer as (value: any, row?: any) => React.ReactNode,
  },
];

const CUSTOM_DATE_SCOPE_GRID_ID = 'custom-date-scope-list-grid';
const CUSTOM_DATE_SCOPE_API_URL = `${BASE_API_URL}/api/CustomDateScope`;

const CustomDateScopeListPage: React.FC = () => {
  const { getAuthHeaders } = useAuthHeaders();
  const { confirm, ConfirmDialog } = useConfirm();

  // Search + grid state — mirrors the conventions used by ManufacturerListPage
  // / DepartmentListPage so the UX matches every other list grid in the app.
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [totalRecords, setTotalRecords] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // Bumping `remountKey` forces ServerGrid to refetch — used after
  // create / edit / delete so the caller sees the new SortOrder ordering
  // immediately.
  const [remountKey, setRemountKey] = useState(0);

  // Form modal state — local to this page; opens on Create / Edit / row
  // double-click. The modal calls `onSaved` after a successful save.
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomDateScope | null>(null);

  // Page-navigation callbacks exposed by ServerGrid so the ActionHeader's
  // First / Prev / Next / Last buttons drive the grid.
  const pageNavigationRef = useRef<{
    goToFirstPage: () => void;
    goToPreviousPage: () => void;
    goToNextPage: () => void;
    goToLastPage: () => void;
  } | null>(null);

  // App-wide toast pattern (same shape Manufacturer / Department pages use).
  // Replaces the bespoke toast that lived in the previous version of this page.
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ show: false, message: '', type: 'success' });

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ show: true, message, type });
      setTimeout(() => {
        setToast({ show: false, message: '', type: 'success' });
      }, 3000);
    },
    [],
  );

  const memoizedGetAuthHeaders = useCallback(() => getAuthHeaders(), [getAuthHeaders]);

  const defaultColumns = useMemo(
    () => convertToGridColumns(customDateScopeColumnDefs),
    [],
  );

  const {
    columns: userPrefColumns,
    setColumns,
    updateColumnVisibility,
    updateColumnWidth,
    updateColumnAggregate,
  } = useGridSettings(CUSTOM_DATE_SCOPE_GRID_ID, defaultColumns);

  // Super-Admin access layer: strip any column revoked for this user via
  // Grid Settings. Applied AFTER useGridSettings so the access filter can
  // react to the asynchronously-loaded rules without fighting the
  // settings hook's one-shot initializer. Revoked columns disappear from
  // the grid, three-dots menu, column chooser, and export modal — and
  // the form modal already honors the same rules via useFieldAccessSet
  // (so a hidden Description, Status, etc. is gone from both places).
  const { filteredColumns: columns, refresh: refreshAccessRules } = useColumnAccessFilter(
    CUSTOM_DATE_SCOPE_GRID_ID,
    userPrefColumns,
  );

  // Re-pull access rules whenever the user explicitly refreshes the grid
  // OR brings the window back into focus. Without this the dashboard's
  // tab-keep-alive behaviour means the page is mounted once and never
  // re-fetches the rules — so an admin's "hide Description" change made
  // while the tab was open wouldn't take effect until full reload.
  React.useEffect(() => {
    const onFocus = () => refreshAccessRules();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshAccessRules]);

  const handleColumnsChange = useCallback(
    (newColumns: any[]) => setColumns(newColumns),
    [setColumns],
  );

  // Debounce free-text search so we don't spam the server on every keystroke.
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchText(searchText), 500);
    return () => clearTimeout(timer);
  }, [searchText]);

  const additionalParams = useMemo(() => {
    if (!debouncedSearchText.trim()) return {};
    return {
      CustomGridSearchText: debouncedSearchText.trim(),
      CustomGridSearchColumns: 'name,description',
    };
  }, [debouncedSearchText]);

  const handleSearchInputChange = useCallback((value: string) => {
    setSearchText(value);
  }, []);

  const handleSearchKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') setDebouncedSearchText(searchText);
    },
    [searchText],
  );

  // CRUD handlers ---------------------------------------------------------

  const handleAddNew = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((row: CustomDateScope) => {
    setEditing(row);
    setModalOpen(true);
  }, []);

  // Double-click in the grid edits the row — ServerGrid wires this through
  // `onRowUpdate`. We just open the modal in edit mode.
  const handleRowUpdate = useCallback(
    async (row: CustomDateScope) => {
      handleEdit(row);
    },
    [handleEdit],
  );

  const handleDelete = useCallback(
    async (row: CustomDateScope) => {
      const ok = await confirm({
        title: 'Delete custom date scope',
        message: `Delete "${row.name}"?`,
        variant: 'danger',
      });
      if (!ok) return;
      try {
        const res = await customDateScopeService.delete(row.customDateScopeID);
        if (res.data.isSuccess) {
          // Remount fetches the fresh list so the server-side compaction
          // (1..N gap-free SortOrder) is reflected immediately.
          setRemountKey((p) => p + 1);
          showToast(`Custom date scope "${row.name}" deleted successfully`, 'success');
        } else {
          showToast(res.data.message || 'Delete failed', 'error');
        }
      } catch {
        showToast('An error occurred while deleting the scope', 'error');
      }
    },
    [confirm, showToast],
  );

  // Keep the module-level action handler ref pointed at the latest closures
  // so the inline Edit / Delete buttons in the Actions column always operate
  // on fresh React state (selectedRows, editing, etc.).
  React.useEffect(() => {
    rowActionHandlersRef.current.onEdit = handleEdit;
    rowActionHandlersRef.current.onDelete = handleDelete;
  }, [handleEdit, handleDelete]);

  // Triggered by the form modal after a successful create / update.
  // We refresh the grid first, then surface the toast — by the time the user
  // reads the message the new row order is already on screen.
  const handleSaved = useCallback(
    (mode: 'create' | 'update') => {
      setRemountKey((p) => p + 1);
      showToast(
        mode === 'create'
          ? 'Custom date scope created successfully'
          : 'Custom date scope updated successfully',
        'success',
      );
    },
    [showToast],
  );

  // ActionHeader plumbing -------------------------------------------------

  const handleRowSelection = useCallback((id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDeselectAll = useCallback(() => setSelectedRows(new Set()), []);

  const handleRemountGrid = useCallback(() => {
    setSelectedRows(new Set());
    setSearchText('');
    setDebouncedSearchText('');
    setRemountKey((p) => p + 1);
    // Refresh access rules alongside the data — if an admin just changed
    // visibility, the user should see the new column set after pressing
    // Refresh, not after a full page reload.
    refreshAccessRules();
    showToast('Grid refreshed and search cleared', 'info');
  }, [showToast, refreshAccessRules]);

  const serverGridSelectAllRef = useRef<(() => void) | null>(null);
  const handleSelectAll = useCallback(() => {
    serverGridSelectAllRef.current?.();
  }, []);

  // Bulk delete: soft-deletes every selected scope in a single API round
  // trip. The server re-compacts SortOrder so the surviving active rows
  // stay 1..N contiguous. We then bump remountKey to refetch, clear the
  // selection, and surface a toast with the actual server-reported count
  // (not the client-side selection size, in case some ids were already
  // inactive).
  const handleBulkDelete = useCallback(async () => {
    if (selectedRows.size === 0) {
      showToast('Please select scopes to delete', 'info');
      return;
    }
    const ok = await confirm({
      title: 'Delete custom date scopes',
      message: `Delete ${selectedRows.size} selected scope(s)?`,
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const ids = Array.from(selectedRows);
      const res = await customDateScopeService.bulkDelete(ids);
      if (res.data.isSuccess) {
        const count = res.data.response ?? ids.length;
        setSelectedRows(new Set());
        setRemountKey((p) => p + 1);
        showToast(
          count === 0
            ? 'No active scopes were deleted (selection was already inactive).'
            : `${count} custom date scope(s) deleted successfully`,
          count === 0 ? 'info' : 'success',
        );
      } else {
        showToast(res.data.message || 'Bulk delete failed', 'error');
      }
    } catch {
      showToast('An error occurred during bulk delete', 'error');
    }
  }, [selectedRows, confirm, showToast]);

  const handleBulkExport = useCallback(() => {
    if (selectedRows.size > 0) {
      showToast(`Exporting ${selectedRows.size} scopes...`, 'info');
    }
  }, [selectedRows, showToast]);

  // No additional context-menu items needed beyond the built-in
  // Edit / Delete that ServerGrid renders from `onEdit` / `onDelete`.
  const customContextMenuItems = useMemo<CustomContextMenuItem[]>(() => [], []);

  return (
    <div
      className="custom-date-scope-list-page p-2 mx-auto md:p-2 min-h-full"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        margin: 0,
        paddingTop: '5px',
        paddingBottom: '5px',
      }}
    >
      {/* App-wide toast (matches DepartmentListPage / ManufacturerListPage). */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[350px] max-w-[400px] transition-all duration-300 animate-slide-in">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                  toast.type === 'success'
                    ? 'bg-green-100'
                    : toast.type === 'error'
                    ? 'bg-red-100'
                    : 'bg-brand-50'
                }`}
              >
                <svg
                  className={`w-6 h-6 ${
                    toast.type === 'success'
                      ? 'text-green-600'
                      : toast.type === 'error'
                      ? 'text-red-600'
                      : 'text-brand-500'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {toast.type === 'success' && (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  )}
                  {toast.type === 'error' && (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  )}
                  {toast.type === 'info' && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  )}
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  {toast.type === 'success' && 'Success'}
                  {toast.type === 'error' && 'Error'}
                  {toast.type === 'info' && 'Information'}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{toast.message}</p>
              </div>
              <button
                onClick={() => setToast({ show: false, message: '', type: 'success' })}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
              <div
                className={`h-1 rounded-full ${
                  toast.type === 'success'
                    ? 'bg-green-500'
                    : toast.type === 'error'
                    ? 'bg-red-500'
                    : 'bg-brand-500'
                }`}
                style={{ width: '100%', animation: 'progressBar 3s linear forwards' }}
              />
            </div>
          </div>
        </div>
      )}

      <ActionHeader
        selectedCount={selectedRows.size}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onBulkDelete={handleBulkDelete}
        onBulkExport={handleBulkExport}
        totalCount={totalRecords}
        loadedCount={loadedCount}
        itemType="custom date scopes"
        onAddNew={handleAddNew}
        onRemountGrid={handleRemountGrid}
        showToast={showToast}
        searchText={searchText}
        onSearchChange={handleSearchInputChange}
        onSearchKeyPress={handleSearchKeyPress}
        currentPage={currentPage}
        totalPages={totalPages}
        onFirstPage={() => pageNavigationRef.current?.goToFirstPage()}
        onPreviousPage={() => pageNavigationRef.current?.goToPreviousPage()}
        onNextPage={() => pageNavigationRef.current?.goToNextPage()}
        onLastPage={() => pageNavigationRef.current?.goToLastPage()}
        staticActions={{}}
        showExportPrintButtons={false}
        onRefresh={() => {
          showToast('Refreshing grid...', 'info');
          setTimeout(handleRemountGrid, 300);
        }}
      />

      <div style={{ flex: 1, minHeight: 0 }}>
        <ServerGrid
          key={`custom-date-scope-grid-${remountKey}`}
          data={[]}
          columns={columns}
          gridId={CUSTOM_DATE_SCOPE_GRID_ID}
          onColumnVisibilityChange={updateColumnVisibility}
          onColumnWidthChange={updateColumnWidth}
          onColumnsChange={handleColumnsChange}
          onAggregateChange={updateColumnAggregate}
          loading={false}
          error={null}
          totalRecords={totalRecords}
          onRowUpdate={handleRowUpdate}
          onRefresh={() => {}}
          pagination={true}
          pageSize={20}
          editable={false}
          columnChooser={true}
          title="Custom Date Scope"
          emptyMessage="No custom date scopes yet"
          emptyIcon="📅"
          serverSide={true}
          apiUrl={CUSTOM_DATE_SCOPE_API_URL}
          methodType="GET"
          getAuthHeaders={memoizedGetAuthHeaders}
          // Default sort = manual SortOrder ascending so the grid mirrors the
          // ordering users maintain via the form's Sort Order dropdown and
          // the More-dropdown on report pages.
          defaultSortColumn="sortOrder"
          additionalParams={additionalParams}
          onRowSelection={handleRowSelection}
          selectedRows={selectedRows}
          setTotalRecords={setTotalRecords}
          setLoadedCount={setLoadedCount}
          setCurrentPage={setCurrentPage}
          setTotalPages={setTotalPages}
          onPageNavigation={(callbacks) => {
            pageNavigationRef.current = callbacks;
          }}
          showCheckboxes={true}
          getRowId={(row) => row.customDateScopeID}
          onSelectAll={(fn) => {
            serverGridSelectAllRef.current = fn;
          }}
          headerSearch={true}
          infiniteScroll={true}
          onEdit={handleEdit}
          onDelete={handleDelete}
          customContextMenuItems={customContextMenuItems}
        />
      </div>

      <CustomDateScopeFormModal
        isOpen={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSaved={(mode) => handleSaved(mode)}
      />

      {/* Embedded animations to match the rest of the app's toast presentation. */}
      <style>
        {`
          @keyframes progressBar {
            0% { width: 100%; }
            100% { width: 0%; }
          }
          .animate-slide-in {
            animation: slideInFromRight 0.3s ease-out;
          }
          @keyframes slideInFromRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}
      </style>

      {ConfirmDialog}
    </div>
  );
};

export default CustomDateScopeListPage;
