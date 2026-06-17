import React, { useState, useCallback, memo, useMemo, useRef, useEffect } from "react"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import {
  convertToGridColumns,
  cellRenderers,
  GridColDef,
} from "../../gridUtils"
import ActionHeader from "../../components/common/ActionHeader"
import { useColumnAccessFilter } from "../../hooks/useColumnAccessFilter"
import { departmentService } from "../../services/departmentService"
import { useDashboardTabs } from "../../context/DashboardTabContext"
import { API_ENDPOINTS } from "../../constants/api"
import { useExportHandlers } from "../../hooks/useExportHandlers"
import { useExportModal } from "../../hooks/useExportModal"
import ExportModal from "../../components/common/ExportModal"
import { CustomContextMenuItem } from "../../components/common/ServerGrid/components/GridBody"
import AuditHistoryModal from "../../components/common/AuditHistoryModal"
import axios from "axios"
import { useConfirm } from '../../components/ui/ConfirmModal'
import { useGridSettings } from "../../hooks/useGridSettings"
import DepartmentFormPage from "./DepartmentFormPage"

// Department record interface
interface DepartmentRecord {
  departmentStoreID: string
  name: string
  description: string | null
  parentDepartmentID: string | null
  parentDepartmentName: string | null
  defaultMarkup: number | null
  roundUp: number
  isDefaultTaxInclude: boolean | null
  isDefaultFoodStampable: boolean | null
  isDefaultDiscountable: boolean | null
  status: number | null
  dateCreated: string | null
  dateModified: string | null
  // Tree metadata added at runtime
  _depth?: number
  _hasChildren?: boolean
}

// Normalize an ID to a stable lowercase form so GUID casing mismatches between
// `parentDepartmentID` and `departmentStoreID` don't break the parent lookup.
const normId = (id: string | null | undefined): string => (id ? String(id).toLowerCase() : "")

// Build a depth-first ordered list of rows where each row knows its depth and
// whether it has children. Rows whose ancestor is collapsed are omitted.
const buildVisibleRows = (
  rows: DepartmentRecord[],
  expanded: Set<string>
): DepartmentRecord[] => {
  // Index children by their normalized parent id
  const byParent = new Map<string, DepartmentRecord[]>()
  for (const row of rows) {
    const key = normId(row.parentDepartmentID)
    if (!key) continue // roots handled separately
    const arr = byParent.get(key) || []
    arr.push(row)
    byParent.set(key, arr)
  }
  // Sort each sibling group alphabetically by name
  for (const arr of byParent.values()) {
    arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
  }

  // Roots: rows with no parent, or whose parent id is missing from the dataset.
  const knownIds = new Set(rows.map(r => normId(r.departmentStoreID)))
  const roots: DepartmentRecord[] = []
  const seenRootIds = new Set<string>()
  for (const row of rows) {
    const parentId = normId(row.parentDepartmentID)
    const isRoot = !parentId || !knownIds.has(parentId)
    if (isRoot && !seenRootIds.has(normId(row.departmentStoreID))) {
      seenRootIds.add(normId(row.departmentStoreID))
      roots.push(row)
    }
  }
  roots.sort((a, b) => (a.name || "").localeCompare(b.name || ""))

  const visible: DepartmentRecord[] = []
  const visited = new Set<string>() // guard against cycles / dup ids
  const walk = (row: DepartmentRecord, depth: number) => {
    const idNorm = normId(row.departmentStoreID)
    if (visited.has(idNorm)) return
    visited.add(idNorm)
    const children = byParent.get(idNorm) || []
    const hasChildren = children.length > 0
    visible.push({ ...row, _depth: depth, _hasChildren: hasChildren })
    if (hasChildren && expanded.has(idNorm)) {
      for (const child of children) walk(child, depth + 1)
    }
  }
  for (const root of roots) walk(root, 0)
  return visible
}

// Status cell renderer — only Active or Inactive
const statusCellRenderer = (value: number | null): React.ReactNode => {
  const isActive = value === 1
  const label = isActive ? "Active" : "Inactive"
  const bgColor = isActive ? "#dcfce7" : "#fee2e2"
  const textColor = isActive ? "#166534" : "#991b1b"

  return React.createElement(
    "span",
    {
      style: {
        padding: "2px 8px",
        borderRadius: "12px",
        backgroundColor: bgColor,
        color: textColor,
        fontSize: "12px",
        fontWeight: "500",
      },
    },
    label
  )
}

// Boolean cell renderer — delegate to centralized tick/cross renderer
const booleanCellRenderer = cellRenderers.boolean

// Markup cell renderer
const markupCellRenderer = (value: number | null): string => {
  if (value === null || value === undefined) return "-"
  return `${value.toFixed(2)}%`
}

// Round up cell renderer
const roundUpCellRenderer = (value: number): React.ReactNode => {
  let label = "None"
  let bgColor = "#f3f4f6"
  let textColor = "#6b7280"

  switch (value) {
    case 1:
      label = "Up"
      bgColor = "#dcfce7"
      textColor = "#166534"
      break
    case 2:
      label = "Down"
      bgColor = "#dbeafe"
      textColor = "#1e40af"
      break
  }

  return React.createElement(
    "span",
    {
      style: {
        padding: "2px 8px",
        borderRadius: "4px",
        backgroundColor: bgColor,
        color: textColor,
        fontSize: "12px",
        fontWeight: "500",
      },
    },
    label
  )
}

// Non-name column definitions — the Name column is built inside the component
// so its cell renderer can access tree expand/collapse state.
const staticDepartmentColumnDefs: GridColDef[] = [
  {
    field: "description",
    headerName: "Description",
    width: 200,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "defaultMarkup",
    headerName: "Default Markup",
    width: 130,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: markupCellRenderer,
  },
  {
    field: "roundUp",
    headerName: "Round Up",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: roundUpCellRenderer,
  },
  {
    field: "isDefaultTaxInclude",
    headerName: "Taxable",
    width: 100,
    type: "boolean",
    sortable: true,
    filterable: true,
    cellRenderer: booleanCellRenderer,
  },
  {
    field: "isDefaultFoodStampable",
    headerName: "Food Stampable",
    width: 130,
    type: "boolean",
    sortable: true,
    filterable: true,
    cellRenderer: booleanCellRenderer,
  },
  {
    field: "isDefaultDiscountable",
    headerName: "Discountable",
    width: 120,
    type: "boolean",
    sortable: true,
    filterable: true,
    cellRenderer: booleanCellRenderer,
  },
  {
    field: "status",
    headerName: "Status",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: statusCellRenderer,
    searchValueTransformer: (searchValue: string) => {
      const v = searchValue.toLowerCase()
      if (v.includes("active") && !v.includes("inactive")) return "1"
      if (v.includes("inactive")) return "0"
      return searchValue
    },
  },
  {
    field: "dateModified",
    headerName: "Date Modified",
    width: 180,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
]

const DEPARTMENTS_GRID_ID = "departments-list-grid"

const DepartmentListPage = memo(function DepartmentListPage() {
  const { getAuthHeaders } = useAuthHeaders()
  const { openTab } = useDashboardTabs()
  const { confirm, ConfirmDialog } = useConfirm()

  // State for search functionality
  const [searchText, setSearchText] = useState("")
  const [debouncedSearchText, setDebouncedSearchText] = useState("")

  // State for bulk selection
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [totalRecords, setTotalRecords] = useState(0)
  const [loadedCount, setLoadedCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [remountKey, setRemountKey] = useState(0)

  // Refs for page navigation callbacks from ServerGrid
  const pageNavigationRef = React.useRef<{
    goToFirstPage: () => void
    goToPreviousPage: () => void
    goToNextPage: () => void
    goToLastPage: () => void
  } | null>(null)

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean
    message: string
    type: "success" | "error" | "info"
  }>({
    show: false,
    message: "",
    type: "success",
  })

  const [isAuditHistoryOpen, setIsAuditHistoryOpen] = useState(false)
  const [auditEntityId, setAuditEntityId] = useState("")
  const [auditEntityName, setAuditEntityName] = useState("")

  // WEB-187: side-panel state for opening Department edit form on row click.
  // Mirrors ItemGroupListPage's pattern so the screens behave consistently.
  const [sidePanel, setSidePanel] = useState<{
    open: boolean
    id?: string
    isNew?: boolean
  }>({ open: false })

  const closeSidePanel = useCallback(() => {
    setSidePanel({ open: false })
  }, [])

  // Grid data ref for export
  const gridDataRef = useRef<any[]>([])

  // Full department list + expansion state for tree view
  const [allDepartments, setAllDepartments] = useState<DepartmentRecord[]>([])
  const [isLoadingAll, setIsLoadingAll] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Ref mirror so the Name cell renderer (frozen by useGridSettings) always
  // reads the *current* expansion set rather than a stale closure value.
  // Sync during render (not in effect) so the renderer sees the latest value
  // on the very same render pass that triggered the state change.
  const expandedIdsRef = useRef<Set<string>>(expandedIds)
  expandedIdsRef.current = expandedIds

  const toggleExpand = useCallback((id: string) => {
    const key = normId(id)
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // Memoize auth headers to prevent re-creation
  const memoizedGetAuthHeaders = useCallback(() => {
    return getAuthHeaders()
  }, [getAuthHeaders])

  // Stable Name column — never rebuilt. Reads live expansion state from the ref.
  // Kept as useCallback (stable identity) so useGridSettings doesn't resync.
  const renderNameCell = useCallback((value: string, row: DepartmentRecord) => {
    const depth = row?._depth ?? 0
    const hasChildren = row?._hasChildren ?? false
    const isExpanded = !!row?.departmentStoreID && expandedIdsRef.current.has(normId(row.departmentStoreID))
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, paddingLeft: depth * 18 }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toggleExpand(row.departmentStoreID)
            }}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            title={isExpanded ? "Collapse" : "Expand"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 18,
              height: 18,
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#6b7280",
              transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </button>
        ) : (
          <span style={{ display: "inline-block", width: 18 }} />
        )}
        <span style={{ fontWeight: hasChildren ? 600 : 400 }}>{value || ""}</span>
      </span>
    )
  }, [toggleExpand])

  const nameColumnDef: GridColDef = useMemo(() => ({
    field: "name",
    headerName: "Name",
    width: 320,
    type: "string",
    sortable: true,
    filterable: true,
    cellRenderer: renderNameCell,
  }), [renderNameCell])

  // Convert column definitions to grid format (stable — renderer ident is stable)
  const defaultColumns = useMemo(
    () => convertToGridColumns([nameColumnDef, ...staticDepartmentColumnDefs]),
    [nameColumnDef]
  )

  const {
    columns: persistedColumns,
    setColumns,
    updateColumnVisibility,
    updateColumnWidth,
    updateColumnAggregate,
  } = useGridSettings(DEPARTMENTS_GRID_ID, defaultColumns)

  // Super-Admin ceiling: strip tenant-restricted columns + apply tenant
  // displayName / sortOrder overrides BEFORE the renderer-remap below, so the
  // remap only iterates over columns the user is actually allowed to see.
  const { filteredColumns: accessFilteredColumns } = useColumnAccessFilter(
    DEPARTMENTS_GRID_ID,
    persistedColumns,
  )

  // Ensure the Name column's renderer is always the current one even if
  // useGridSettings cached an older reference on mount.
  const columns = useMemo(
    () =>
      accessFilteredColumns.map(col =>
        col.field === "name" ? { ...col, cellRenderer: renderNameCell } : col
      ),
    [accessFilteredColumns, renderNameCell]
  )

  const handleColumnsChange = useCallback(
    (newColumns: any[]) => setColumns(newColumns),
    [setColumns],
  )

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchText])

  // Handle search input change
  const handleSearchInputChange = useCallback((value: string) => {
    setSearchText(value)
  }, [])

  // Handle search on Enter key press
  const handleSearchKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        setDebouncedSearchText(searchText)
      }
    },
    [searchText]
  )

  // Toast notification function
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      setToast({ show: true, message, type })
      setTimeout(() => {
        setToast({ show: false, message: "", type: "success" })
      }, 3000)
    },
    []
  )

  // Handle adding new department
  const handleAddDepartment = useCallback(() => {
    openTab({
      component: "DepartmentFormPage",
      title: "New Department",
      closable: true,
      props: { isNew: true },
    })
  }, [openTab])

  // Handle row selection
  const handleRowSelection = useCallback((departmentStoreID: string) => {
    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = new Set(prevSelectedRows)
      if (newSelectedRows.has(departmentStoreID)) {
        newSelectedRows.delete(departmentStoreID)
      } else {
        newSelectedRows.add(departmentStoreID)
      }
      return newSelectedRows
    })
  }, [])

  // Handle deselect all
  const handleDeselectAll = useCallback(() => {
    setSelectedRows(new Set())
  }, [])

  // Handle remount grid
  const handleRemountGrid = useCallback(() => {
    setSelectedRows(new Set())
    setSearchText("")
    setDebouncedSearchText("")
    setRemountKey((prev) => prev + 1)
    showToast("Grid refreshed and search cleared", "info")
  }, [showToast])

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (selectedRows.size === 0) {
      showToast("Please select departments to delete", "info")
      return
    }

    const confirmed = await confirm({
      title: 'Delete Departments',
      message: `Are you sure you want to delete ${selectedRows.size} department(s)?`,
      variant: 'danger',
    })
    if (!confirmed) return

    let successCount = 0
    let failCount = 0

    for (const id of selectedRows) {
      try {
        // Check if can delete
        const canDelete = await departmentService.canDeleteDepartment(id)
        if (!canDelete.success || !canDelete.data) {
          failCount++
          continue
        }

        const result = await departmentService.deleteDepartment(id)
        if (result.success) {
          successCount++
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }

    if (successCount > 0) {
      showToast(`${successCount} department(s) deleted successfully`, "success")
      setSelectedRows(new Set())
      setRemountKey((prev) => prev + 1)
    }
    if (failCount > 0) {
      showToast(`${failCount} department(s) could not be deleted`, "error")
    }
  }, [selectedRows, showToast, confirm])

  // Handle bulk export
  const handleBulkExport = useCallback(() => {
    if (selectedRows.size > 0) {
      showToast(`Exporting ${selectedRows.size} departments...`, "info")
    }
  }, [selectedRows, showToast])

  // Static action handlers
  const handleStaticEdit = useCallback(() => {
    if (selectedRows.size === 1) {
      const id = Array.from(selectedRows)[0]
      openTab({
        component: "DepartmentFormPage",
        title: "Edit Department",
        closable: true,
        props: { id },
      })
    } else if (selectedRows.size > 1) {
      showToast("Please select only one department to edit", "info")
    } else {
      showToast("Please select a department to edit", "info")
    }
  }, [selectedRows, openTab, showToast])

  const handleStaticDownloadReport = useCallback(() => {
    showToast("Downloading report for departments", "success")
  }, [showToast])

  const handleStaticDelete = useCallback(() => {
    handleBulkDelete()
  }, [handleBulkDelete])

  // Store reference to ServerGrid's select all function
  const serverGridSelectAllRef = React.useRef<(() => void) | null>(null)

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (serverGridSelectAllRef.current) {
      serverGridSelectAllRef.current()
    } else {
      showToast("Selecting all departments...", "info")
    }
  }, [showToast])

  // Handle row double-click to edit
  const handleRowUpdate = useCallback(
    async (updatedRow: DepartmentRecord) => {
      openTab({
        component: "DepartmentFormPage",
        title: "Edit Department",
        closable: true,
        props: { id: updatedRow.departmentStoreID },
      })
    },
    [openTab]
  )

  // Handle View Details action (context menu)
  const handleViewAction = useCallback(
    (row: DepartmentRecord) => {
      openTab({
        component: "DepartmentFormPage",
        title: "View Department",
        closable: true,
        props: { id: row.departmentStoreID, viewMode: true },
      })
    },
    [openTab]
  )

  // WEB-187: row-click + context-menu "Edit" both open the form as a side panel
  // (matches Item Groups). Was previously openTab to a "DepartmentFormPage" tab.
  const handleEditAction = useCallback(
    (row: DepartmentRecord) => {
      setSidePanel({ open: true, id: row.departmentStoreID, isNew: false })
    },
    []
  )

  // Handle Delete Row action (context menu)
  const handleDeleteAction = useCallback(
    async (row: DepartmentRecord) => {
      const confirmed = await confirm({
        title: 'Delete Department',
        message: `Are you sure you want to delete department "${row.name}"?`,
        variant: 'danger',
      })
      if (!confirmed) return

      try {
        const canDelete = await departmentService.canDeleteDepartment(row.departmentStoreID)
        if (!canDelete.success || !canDelete.data) {
          showToast("This department cannot be deleted. It may be in use.", "error")
          return
        }

        const result = await departmentService.deleteDepartment(row.departmentStoreID)
        if (result.success) {
          showToast(`Department "${row.name}" deleted successfully`, "success")
          setRemountKey((prev) => prev + 1)
        } else {
          showToast("Failed to delete department", "error")
        }
      } catch {
        showToast("An error occurred while deleting the department", "error")
      }
    },
    [showToast, confirm]
  )

  // Fetch all data for export/print
  const fetchAllData = useCallback(async (dateFrom?: string, dateTo?: string): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const response = await axios({
        method: "GET",
        url: API_ENDPOINTS.DEPARTMENTS.GET_ALL_DEPARTMENTS,
        params: {
          startRow: 0,
          endRow: 1000000,
          ...(dateFrom && { dateFrom }),
          ...(dateTo && { dateTo }),
          sortColumn: "name",
          sortDirection: "asc",
        },
        headers,
      })
      if (response.data?.isSuccess) {
        return response.data.response.data || []
      }
      return []
    } catch (error) {
      console.error("Failed to fetch all data:", error)
      return []
    }
  }, [getAuthHeaders])

  // Load all departments for client-side tree view. Re-runs on remount signal.
  const loadAll = useCallback(async () => {
    setIsLoadingAll(true)
    try {
      const rows = (await fetchAllData()) as DepartmentRecord[]
      setAllDepartments(rows)
      setTotalRecords(rows.length)
      setLoadedCount(rows.length)
    } finally {
      setIsLoadingAll(false)
    }
  }, [fetchAllData])

  useEffect(() => {
    loadAll()
  }, [loadAll, remountKey])

  // Apply free-text search from the top bar, then build the tree and flatten.
  const visibleTreeRows = useMemo(() => {
    const q = debouncedSearchText.trim().toLowerCase()
    // Filter first — if a match is found, include all its ancestors so it
    // still lives in a meaningful tree branch.
    let source = allDepartments
    if (q) {
      const byId = new Map(allDepartments.map(d => [d.departmentStoreID, d]))
      const keep = new Set<string>()
      for (const row of allDepartments) {
        const hay = `${row.name || ""} ${row.description || ""}`.toLowerCase()
        if (hay.includes(q)) {
          let cur: DepartmentRecord | undefined = row
          while (cur) {
            if (keep.has(cur.departmentStoreID)) break
            keep.add(cur.departmentStoreID)
            cur = cur.parentDepartmentID ? byId.get(cur.parentDepartmentID) : undefined
          }
        }
      }
      source = allDepartments.filter(d => keep.has(d.departmentStoreID))
    }
    // When searching, expand everything so matches are visible; otherwise
    // honor the user's expansion state.
    const expanded = q ? new Set(source.map(r => normId(r.departmentStoreID))) : expandedIds
    return buildVisibleRows(source, expanded)
  }, [allDepartments, expandedIds, debouncedSearchText])

  // Use the export handlers hook
  const {
    handleExportCSV,
    handleExportPDF,
    handleExportExcel,
    handlePrint,
    isExporting,
    isPrinting,
  } = useExportHandlers({
    columns,
    gridDataRef,
    fetchAllData,
    filename: "departments-list",
    pdfOptions: { title: "Departments List", orientation: "landscape" },
  })

  // Export modal
  const exportModal = useExportModal({
    columns,
    fetchAllData,
    filename: "departments-list",
    pdfOptions: { title: "Departments List", orientation: "landscape" },
    dateFilterField: "dateModified",
  })

  // Callback to receive grid data from ServerGrid
  const handleGridDataChange = useCallback((data: any[]) => {
    gridDataRef.current = data
  }, [])

  const iconPlus = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
  const iconPlusNested = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )

  /** Tree-style menu: New = sibling (same parent), New Child = under selected row (matches classic ERP trees). */
  const departmentContextMenuItems: CustomContextMenuItem[] = useMemo(
    () => [
      {
        label: "New",
        icon: iconPlus,
        onClick: (row: any) => {
          const r = row as DepartmentRecord
          const sameParent = r.parentDepartmentID?.trim() || ""
          openTab({
            component: "DepartmentFormPage",
            title: "New Department",
            closable: true,
            props: sameParent ? { isNew: true, parentId: sameParent } : { isNew: true },
          })
        },
      },
      {
        label: "New Child",
        icon: iconPlusNested,
        onClick: (row: any) => {
          const r = row as DepartmentRecord
          openTab({
            component: "DepartmentFormPage",
            title: `New Child — under ${r.name || "department"}`,
            closable: true,
            props: { isNew: true, parentId: r.departmentStoreID },
          })
        },
      },
      {
        label: "View Details",
        dividerBefore: true,
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3-3 3 3" />
            <path d="M9 16l3-3 3 3" />
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          </svg>
        ),
        onClick: (row: any) => handleViewAction(row as DepartmentRecord),
      },
      {
        label: "Edit Details",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="m18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        ),
        onClick: (row: any) => handleEditAction(row as DepartmentRecord),
      },
      {
        label: "Delete Row",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3,6 5,6 21,6" />
            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        ),
        color: "#dc2626",
        onClick: (row: any) => {
          handleDeleteAction(row as DepartmentRecord)
        },
      },
      {
        label: "Audit History",
        dividerBefore: true,
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
        onClick: (row: any) => {
          const record = row as DepartmentRecord
          setAuditEntityId(record.departmentStoreID)
          setAuditEntityName(record.name || "")
          setIsAuditHistoryOpen(true)
        },
      },
    ],
    [openTab, handleViewAction, handleEditAction, handleDeleteAction]
  )

  return (
    <div
      className="departments-list-page p-2 mx-auto md:p-2 min-h-full"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        margin: 0,
        paddingTop: "5px",
        paddingBottom: "5px",
      }}
    >
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[350px] max-w-[400px] transition-all duration-300 animate-slide-in">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                  toast.type === "success"
                    ? "bg-green-100"
                    : toast.type === "error"
                    ? "bg-red-100"
                    : "bg-brand-50"
                }`}
              >
                <svg
                  className={`w-6 h-6 ${
                    toast.type === "success"
                      ? "text-green-600"
                      : toast.type === "error"
                      ? "text-red-600"
                      : "text-brand-500"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {toast.type === "success" && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  )}
                  {toast.type === "error" && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  )}
                  {toast.type === "info" && (
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
                  {toast.type === "success" && "Success"}
                  {toast.type === "error" && "Error"}
                  {toast.type === "info" && "Information"}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{toast.message}</p>
              </div>

              <button
                onClick={() =>
                  setToast({ show: false, message: "", type: "success" })
                }
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
              <div
                className={`h-1 rounded-full ${
                  toast.type === "success"
                    ? "bg-green-500"
                    : toast.type === "error"
                    ? "bg-red-500"
                    : "bg-brand-500"
                }`}
                style={{
                  width: "100%",
                  animation: "progressBar 3s linear forwards",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Action Header with Search */}
      <ActionHeader
        selectedCount={selectedRows.size}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onBulkDelete={handleBulkDelete}
        onBulkExport={handleBulkExport}
        totalCount={totalRecords}
        loadedCount={loadedCount}
        itemType="departments"
        onAddNew={handleAddDepartment}
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
        showExportPrintButtons={true}
        onRefresh={() => {
          showToast("Refreshing grid...", "info")
          setTimeout(handleRemountGrid, 300)
        }}
        onExport={exportModal.open}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        onPrint={handlePrint}
        isExporting={isExporting}
        isPrinting={isPrinting}
        gridId={DEPARTMENTS_GRID_ID}
      />

      {/* Expand / collapse toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 8px",
          borderBottom: "1px solid var(--color-gray-200, #e5e7eb)",
        }}
      >
        <button
          type="button"
          onClick={() => setExpandedIds(new Set(allDepartments.map(d => normId(d.departmentStoreID))))}
          style={{
            padding: "4px 10px",
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            cursor: "pointer",
            color: "#374151",
          }}
          title="Expand all departments"
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={() => setExpandedIds(new Set())}
          style={{
            padding: "4px 10px",
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            cursor: "pointer",
            color: "#374151",
          }}
          title="Collapse all departments"
        >
          Collapse all
        </button>
      </div>

      {/* Main Grid Component */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ServerGrid
          key={`departments-grid-${remountKey}`}
          data={visibleTreeRows}
          columns={columns}
          gridId={DEPARTMENTS_GRID_ID}
          onColumnVisibilityChange={updateColumnVisibility}
          onColumnWidthChange={updateColumnWidth}
          onColumnsChange={handleColumnsChange}
          onAggregateChange={updateColumnAggregate}
          loading={isLoadingAll}
          error={null}
          totalRecords={totalRecords}
          onRowUpdate={handleRowUpdate}
          // WEB-187: single left-click opens the edit form, matching Item List behavior.
          onRowClick={(row) => handleEditAction(row as DepartmentRecord)}
          onRefresh={loadAll}
          pagination={false}
          editable={false}
          columnChooser={true}
          title="Departments List"
          emptyMessage="No departments found"
          emptyIcon="📁"
          serverSide={false}
          getAuthHeaders={memoizedGetAuthHeaders}
          // Empty default sort — our tree flattening already produces the
          // correct depth-first order; any column sort would scramble it.
          defaultSortColumn=""
          containerWidth="47%"
          onRowSelection={handleRowSelection}
          selectedRows={selectedRows}
          setTotalRecords={setTotalRecords}
          setLoadedCount={setLoadedCount}
          setCurrentPage={setCurrentPage}
          setTotalPages={setTotalPages}
          onPageNavigation={(callbacks) => {
            pageNavigationRef.current = callbacks
          }}
          showCheckboxes={true}
          getRowId={(row) => row.departmentStoreID}
          onSelectAll={(selectAllFn) => {
            serverGridSelectAllRef.current = selectAllFn
          }}
          headerSearch={true}
          infiniteScroll={false}
          onDataChange={handleGridDataChange}
          onView={handleViewAction}
          onEdit={handleEditAction}
          onDelete={handleDeleteAction}
          hideDefaultContextMenuItems
          customContextMenuItems={departmentContextMenuItems}
        />
      </div>

      <AuditHistoryModal
        isOpen={isAuditHistoryOpen}
        onClose={() => setIsAuditHistoryOpen(false)}
        entityType="DepartmentStore"
        entityId={auditEntityId}
        entityName={auditEntityName}
      />

      {/* Embedded CSS for animations */}
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
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
      <ExportModal {...exportModal.modalProps} />
      {ConfirmDialog}

      {/* WEB-187: side-panel host for row-click edit. Mirrors Item Groups. */}
      {sidePanel.open && (
        <div
          className="fixed inset-0 z-[70] bg-black/30"
          onClick={closeSidePanel}
        >
          <div
            className="absolute right-0 top-0 h-full w-full max-w-[720px] bg-white dark:bg-gray-900 shadow-xl border-l border-gray-200 dark:border-gray-700 animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <DepartmentFormPage
              id={sidePanel.id}
              isNew={sidePanel.isNew}
              embedded={true}
              onClose={closeSidePanel}
              onSaved={() => setRemountKey((prev) => prev + 1)}
            />
          </div>
        </div>
      )}
    </div>
  )
})

export default DepartmentListPage
