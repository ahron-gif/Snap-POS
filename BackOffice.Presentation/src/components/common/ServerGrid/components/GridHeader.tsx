import React, { useState } from "react";
import { Column, SortConfig, FilterConfig, HeaderSearchConfig } from "../types/grid";
import { FilterDropdown } from "./FilterDropdown";
import { HeaderSearchRow } from "./HeaderSearchRow";

// Extend window interface for resize timeout
declare global {
  interface Window {
    columnResizeTimeout: NodeJS.Timeout;
  }
}

// Custom FilterIcon SVG component
const FilterIcon = ({ fill }: { fill?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    width="14"
    height="14"
  >
    <path
      fill={fill || "#6b7280"}
      d="M3.9 54.9C10.5 40.9 24.5 32 40 32H472c15.5 0 29.5 8.9 36.1 22.9s4.6 30.5-5.2 42.5L320 320.9V448c0 12.1-6.8 23.2-17.7 28.6s-23.8 4.3-33.5-3l-64-48c-8.1-6-12.8-15.5-12.8-25.6V320.9L9 97.3C-.7 85.4-2.8 68.8 3.9 54.9z"
    />
  </svg>
);

// Custom VerticalEllipsisIcon SVG component
const VerticalEllipsisIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 192 512"
    width="14"
    height="14"
  >
    <path
      fill="#6b7280"
      d="M96 184c39.8 0 72 32.2 72 72s-32.2 72-72 72-72-32.2-72-72 32.2-72 72-72zM24 80c0 39.8 32.2 72 72 72s72-32.2 72-72S135.8 8 96 8 24 40.2 24 80zm0 352c0 39.8 32.2 72 72 72s72-32.2 72-72-32.2-72-72-72-72 32.2-72 72z"
    />
  </svg>
);

const getSortIcon = (field: string, sortConfig: SortConfig | null) => {
  if (sortConfig?.field !== field) return <i className="fas fa-sort"></i>;
  return sortConfig.direction === "asc" ? (
    <i className="fas fa-sort-up"></i>
  ) : (
    <i className="fas fa-sort-down"></i>
  );
};

interface GridHeaderProps {
  columns: Column[];
  sortConfig: SortConfig | null;
  filterConfig: FilterConfig;
  onSort: (field: string, preventApiCall?: boolean) => void;
  onFilter: (field: string, conditions: any[], logic: any) => void;
  onColumnVisibilityChange: (field: string, visible: boolean) => void;
  setSortConfig: React.Dispatch<React.SetStateAction<SortConfig | null>>;
  setColumns?: React.Dispatch<React.SetStateAction<Column[]>>;
  showColumnChooser?: boolean;
  // Checkbox selection props
  showCheckboxes?: boolean;
  isAllSelected?: boolean;
  isIndeterminate?: boolean;
  onSelectAll?: () => void;
}

const DraggableHeaderCell: React.FC<{
  column: Column;
  index: number;
  moveColumn: (fromIndex: number, toIndex: number) => void;
  onSort: (field: string, preventApiCall?: boolean) => void;
  sortConfig: SortConfig | null;
  filterConfig: FilterConfig;
  activeFilterDropdown: string | null;
  setActiveFilterDropdown: (field: string | null) => void;
  setFilterDropdownPosition: (
    position: { x: number; y: number } | null,
  ) => void;
  setThreeDotsMenuPosition: (position: { x: number; y: number } | null) => void;
  setThreeDotsMenuField: (field: string | null) => void;
  handleColumnRightClick: (e: React.MouseEvent, field: string) => void;
  /** Left offset in px when this header should be sticky-pinned to the left edge. Undefined = not pinned. */
  pinnedLeftOffset?: number;
  /** rowSpan for this header cell. >1 makes the column header straddle multiple
   *  header rows — used for columns that lack a sub-group band in the 3-row layout. */
  rowSpan?: number;
}> = ({
  column,
  index,
  moveColumn,
  onSort,
  sortConfig,
  filterConfig,
  activeFilterDropdown,
  setActiveFilterDropdown,
  setFilterDropdownPosition,
  setThreeDotsMenuPosition,
  setThreeDotsMenuField,
  handleColumnRightClick,
  pinnedLeftOffset,
  rowSpan,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const [resizeColumn, setResizeColumn] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData("text/plain", column.field);
    e.dataTransfer.setData(
      "application/column",
      JSON.stringify({
        field: column.field,
        headerName: column.headerName,
        index: index,
      }),
    );
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    // Stop the drop from bubbling to the grid-container's onDrop, which treats a
    // drop as a "remove column" / group-by gesture and would hide the column we
    // just reordered. A header-to-header drop is a reorder and must be terminal.
    e.stopPropagation();
    setIsOver(false);

    try {
      const columnData = e.dataTransfer.getData("application/column");
      if (columnData) {
        const draggedColumn = JSON.parse(columnData);
        if (draggedColumn.index !== index) {
          moveColumn(draggedColumn.index, index);
        }
      }
    } catch (error) {
      console.error("Error parsing column data:", error);
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const field = column.field;
    setIsResizing(true);
    resizeColumn !== field && setResizeColumn(field);

    const startX = e.clientX;
    const startWidth = column.width || 95;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(95, startWidth + (e.clientX - startX));
      // Update column width here if you have access to setColumns
      document.dispatchEvent(
        new CustomEvent("columnResize", {
          detail: { field: column.field, width: newWidth },
        }),
      );
    };

    const handleMouseUp = () => {
      // Add a small delay before clearing isResizing to prevent sort trigger
      setTimeout(() => {
        setIsResizing(false);
        setResizeColumn(null);
      }, 100);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <th
      rowSpan={rowSpan && rowSpan > 1 ? rowSpan : undefined}
      style={{
        width: column.width || 95,
        opacity: isDragging ? 0.5 : 1,
        // When pinned (sticky-left), preserve the drag highlight but make sure the
        // background stays opaque so scrolled content doesn't bleed through.
        backgroundColor: isOver
          ? "#e3f2fd"
          : pinnedLeftOffset !== undefined
            ? (document.documentElement.classList.contains("dark") ? "#1f2937" : "#ffffff")
            : undefined,
        borderLeft: isOver ? "3px solid #007bff" : undefined,
        cursor: "grab",
        // Center the label vertically when the cell straddles multiple header rows.
        ...(rowSpan && rowSpan > 1 ? { verticalAlign: "middle" } : {}),
        ...(pinnedLeftOffset !== undefined && {
          position: "sticky",
          left: pinnedLeftOffset,
          // Header is already z-index 10 via thead sticky; pinned cells need to
          // sit above non-pinned header cells but still under any overlay popups.
          zIndex: 11,
        }),
      }}
      className={`grid-header-cell ${isOver ? "drag-over" : ""} ${
        isDragging ? "dragging" : ""
      }${pinnedLeftOffset !== undefined ? " pinned-left" : ""}`}
      title="Drag to reorder column or group by"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(e) => {
        // Check if click is near the resize handle (right edge of header)
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX;
        const isNearRightEdge = rect.right - clickX < 10;

        // Only trigger sort if we're not clicking on filter buttons, not resizing, and not near resize handle
        if (column.sortable && !isResizing && !isNearRightEdge) {
          onSort(column.field);
        }
      }}
    >
      <div className="header-content">
        <span
          className={`header-title ${column.sortable ? "sortable" : ""}`}
          style={{ paddingLeft: "6px" }}
          onContextMenu={(e) => handleColumnRightClick(e, column.field)}
        >
          {column.headerName}
          {column.sortable && (
            <span className="sort-icon">
              {getSortIcon(column.field, sortConfig)}
            </span>
          )}
        </span>

        <div className="filter-controls">
          <button
            className="filter-menu-button"
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setThreeDotsMenuPosition({
                x: rect.left,
                y: rect.bottom + 2,
              });
              setThreeDotsMenuField(column.field);
            }}
            title="Column options"
          >
            <VerticalEllipsisIcon />
          </button>
        </div>
      </div>
      <div
        className="resize-handle"
        onMouseDown={handleResizeStart}
        title="Resize column"
      />
    </th>
  );
};

interface GridHeaderProps {
  columns: Column[];
  sortConfig: SortConfig | null;
  filterConfig: FilterConfig;
  onSort: (field: string, preventApiCall?: boolean) => void;
  onFilter: (field: string, conditions: any[], logic: any) => void;
  onColumnVisibilityChange: (field: string, visible: boolean) => void;
  setSortConfig: React.Dispatch<React.SetStateAction<SortConfig | null>>;
  setColumns?: React.Dispatch<React.SetStateAction<Column[]>>;
  showColumnChooser?: boolean;
  // Checkbox selection props
  showCheckboxes?: boolean;
  isAllSelected?: boolean;
  isIndeterminate?: boolean;
  onSelectAll?: () => void;
  // Header search props
  headerSearch?: boolean;
  headerSearchConfig?: HeaderSearchConfig;
  onHeaderSearch?: (field: string, value: string) => void;
  isSearching?: boolean;
  // Collapsible header bands (row-1 groups). When a group label is in
  // `collapsibleGroups`, its band header renders an expand/collapse arrow that
  // calls `onToggleGroupCollapsed`. `collapsedGroups` drives the arrow direction.
  collapsibleGroups?: Set<string>;
  collapsedGroups?: Set<string>;
  onToggleGroupCollapsed?: (label: string) => void;
  // Sub-group (row-2 band) collapse, keyed by sub-group label.
  collapsibleSubGroups?: Set<string>;
  collapsedSubGroups?: Set<string>;
  onToggleSubGroupCollapsed?: (label: string) => void;
}

export const GridHeader: React.FC<GridHeaderProps> = ({
  columns,
  sortConfig,
  filterConfig,
  onSort,
  onFilter,
  onColumnVisibilityChange,
  setSortConfig,
  setColumns,
  showCheckboxes = false,
  isAllSelected = false,
  isIndeterminate = false,
  onSelectAll,
  headerSearch = false,
  headerSearchConfig = {},
  onHeaderSearch,
  isSearching = false,
  collapsibleGroups,
  collapsedGroups,
  onToggleGroupCollapsed,
  collapsibleSubGroups,
  collapsedSubGroups,
  onToggleSubGroupCollapsed,
}) => {
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<
    string | null
  >(null);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [columnMenuField, setColumnMenuField] = useState<string | null>(null);
  const [columnMenuPosition, setColumnMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [threeDotsMenuField, setThreeDotsMenuField] = useState<string | null>(
    null,
  );
  const [threeDotsMenuPosition, setThreeDotsMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [filterDropdownPosition, setFilterDropdownPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [columnSearchTerm, setColumnSearchTerm] = useState("");
  const [pendingColumnVisibility, setPendingColumnVisibility] = useState<
    Record<string, boolean>
  >({});

  const visibleColumns = columns.filter((column) => column.visible !== false);
  const filteredColumns = columns.filter((column) =>
    column.headerName.toLowerCase().includes(columnSearchTerm.toLowerCase()),
  );

  // fromIndex/toIndex are positions within the *visible* columns (what the
  // header renders). Translate them to the corresponding columns by field and
  // reorder the full columns array, so hidden columns don't throw off the
  // indices and cause the wrong (or a hidden) column to move.
  const moveColumn = (fromIndex: number, toIndex: number) => {
    if (!setColumns) return;
    const fromField = visibleColumns[fromIndex]?.field;
    const toField = visibleColumns[toIndex]?.field;
    if (!fromField || !toField || fromField === toField) return;

    setColumns((prevColumns) => {
      const fromIdx = prevColumns.findIndex((c) => c.field === fromField);
      const toIdx = prevColumns.findIndex((c) => c.field === toField);
      if (fromIdx === -1 || toIdx === -1) return prevColumns;
      const newColumns = [...prevColumns];
      const [movedColumn] = newColumns.splice(fromIdx, 1);
      newColumns.splice(toIdx, 0, movedColumn);
      return newColumns;
    });
  };

  const handleColumnVisibilityToggle = (field: string) => {
    const currentValue =
      pendingColumnVisibility[field] !== undefined
        ? pendingColumnVisibility[field]
        : columns.find((col) => col.field === field)?.visible !== false;

    setPendingColumnVisibility((prev) => ({
      ...prev,
      [field]: !currentValue,
    }));
  };

  const handleApplyChanges = () => {
    Object.entries(pendingColumnVisibility).forEach(([field, visible]) => {
      if (onColumnVisibilityChange) {
        onColumnVisibilityChange(field, visible);
      }
    });
    setPendingColumnVisibility({});
    setShowColumnDropdown(false);
  };

  const handleCancelChanges = () => {
    setPendingColumnVisibility({});
    setShowColumnDropdown(false);
  };

  const getColumnVisibility = (field: string) => {
    return pendingColumnVisibility[field] !== undefined
      ? pendingColumnVisibility[field]
      : columns.find((col) => col.field === field)?.visible !== false;
  };

  const handleColumnRightClick = (e: React.MouseEvent, field: string) => {
    e.preventDefault();
    setColumnMenuField(field);
    setColumnMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const handleColumnMenuClose = () => {
    setColumnMenuField(null);
    setColumnMenuPosition(null);
  };

  const handleSortAscending = () => {
    if (columnMenuField) {
      onSort(columnMenuField);
      if (setSortConfig) {
        setSortConfig({ field: columnMenuField, direction: "asc" });
      }
    }
    handleColumnMenuClose();
  };

  const handleClearSort = () => {
    if (setSortConfig) {
      setSortConfig(null);
    }
    handleColumnMenuClose();
  };

  const handleColumnChooserFromMenu = () => {
    // Initialize pending state with current column visibility
    const initialState: Record<string, boolean> = {};
    columns.forEach((col) => {
      initialState[col.field] = col.visible !== false;
    });
    setPendingColumnVisibility(initialState);
    setShowColumnDropdown(true);
    handleColumnMenuClose();
  };

  const handleThreeDotsMenuClose = () => {
    setThreeDotsMenuField(null);
    setThreeDotsMenuPosition(null);
  };

  const handleSortDescending = () => {
    if (threeDotsMenuField) {
      onSort(threeDotsMenuField);
      if (setSortConfig) {
        setSortConfig({ field: threeDotsMenuField, direction: "desc" });
      }
    }
    handleThreeDotsMenuClose();
  };

  // Measures the best-fit width for a single column (by its index among
  // visible columns) using canvas text measurement of the header + cells.
  const measureColumnWidth = (
    context: CanvasRenderingContext2D,
    columnIndex: number,
    headerName: string,
  ): number => {
    const cells = document.querySelectorAll(
      `table.grid-table td:nth-child(${columnIndex + 1})`,
    );
    const headerCell = document.querySelector(
      `table.grid-table th:nth-child(${columnIndex + 1})`,
    );

    let maxWidth = 100;

    if (headerCell) {
      const headerWidth = context.measureText(headerName).width + 60;
      maxWidth = Math.max(maxWidth, headerWidth);
    }

    cells.forEach((cell) => {
      const cellText = cell.textContent || "";
      const cellWidth = context.measureText(cellText).width + 24;
      maxWidth = Math.max(maxWidth, cellWidth);
    });

    return Math.ceil(Math.min(maxWidth, 400));
  };

  const bestFitColumn = (field: string | null) => {
    if (!field || !setColumns) return;
    const columnIndex = columns.findIndex((col) => col.field === field);
    if (columnIndex === -1) return;

    const context = document.createElement("canvas").getContext("2d");
    if (!context) return;
    context.font = "14px Arial";

    const newWidth = measureColumnWidth(
      context,
      columnIndex,
      columns[columnIndex].headerName,
    );

    setColumns((prev) =>
      prev.map((col) =>
        col.field === field ? { ...col, width: newWidth } : col,
      ),
    );
  };

  const bestFitAllColumns = () => {
    if (!setColumns) return;
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return;
    context.font = "14px Arial";

    const updatedColumns = columns.map((column, columnIndex) => ({
      ...column,
      width: measureColumnWidth(context, columnIndex, column.headerName),
    }));

    setColumns(updatedColumns);
  };

  const handleAutosizeColumn = () => {
    bestFitColumn(threeDotsMenuField);
    handleThreeDotsMenuClose();
  };

  const handleAutosizeAllColumns = () => {
    bestFitAllColumns();
    handleThreeDotsMenuClose();
  };

  const handleBestFitColumnFromMenu = () => {
    bestFitColumn(columnMenuField);
    handleColumnMenuClose();
  };

  const handleBestFitAllFromMenu = () => {
    bestFitAllColumns();
    handleColumnMenuClose();
  };

  const handlePinColumn = () => {
    console.log("Pin column:", threeDotsMenuField);
    handleThreeDotsMenuClose();
  };

  const handleGroupByColumn = () => {
    if (threeDotsMenuField) {
      const column = columns.find((col) => col.field === threeDotsMenuField);
      if (column) {
        const event = new CustomEvent("groupByColumn", {
          detail: { field: threeDotsMenuField, headerName: column.headerName },
        });
        window.dispatchEvent(event);
      }
    }
    handleThreeDotsMenuClose();
  };

  const handleResetColumns = () => {
    columns.forEach((column) => {
      if (onColumnVisibilityChange) {
        onColumnVisibilityChange(column.field, true);
      }
    });
    handleThreeDotsMenuClose();
  };

  // Compute multi-tier column bands. Each column resolves to a (group, subGroup)
  // pair via either explicit Column props (preferred) or legacy field-name parsing
  // ("CREDIT CARD / AMEX" → group="Actual Cash", subGroup="CREDIT CARD").
  //
  // Tender Totals renders 3 header rows:
  //   row 1 (group):     Actual Cash | Gift
  //   row 2 (subGroup):  CREDIT CARD (over AMEX/Disc/MC/Visa); other cols span rows 2-3
  //   row 3 (column):    AMEX, Discover, Master Card, Visa, plus DEBIT/EBT/WIC/etc.
  //
  // When NO column has a subGroup, the grid renders the legacy 2-row layout.
  const { row1Groups, row2Plan, row3Indices, hasRow3, hasGroups, hasSubGroups } = React.useMemo(() => {
    // Legacy field-name derivation kept for reports that don't set Column.group explicitly.
    const deriveGroup = (col: Column): string | null => {
      if (col.group) return col.group;
      const field = col.field;
      const parts = field.split("/");
      if (parts.length === 2) {
        const rawGroup = parts[0].trim();
        if (!rawGroup) return null;
        const upper = rawGroup.toUpperCase();
        if (upper === "CREDIT CARD") return "Actual Cash";
        if (upper === "GIFT") return "Gift";
        return null;
      }

      const upperField = field.trim().toUpperCase();
      if (
        upperField === "CASH" ||
        upperField === "CHECK" ||
        upperField === "CREDIT CARD" ||
        upperField === "EBT" ||
        upperField === "DEBIT" ||
        upperField === "WIC" ||
        upperField === "CC OFFLINE" ||
        upperField === "CREDIT CARD TOTAL" ||
        upperField === "ACTUAL CASH TOTAL" ||
        upperField.startsWith("CASH ") ||
        upperField.startsWith("EBT ") ||
        upperField === "ERROR TOTAL"
      ) {
        return "Actual Cash";
      }

      if (
        upperField === "GIFT" ||
        upperField === "GIFT CARD" ||
        upperField === "CREDIT SLIP" ||
        upperField === "GIFT TOTAL" ||
        upperField.startsWith("GIFT ") ||
        upperField === "ERROR"
      ) {
        return "Gift";
      }

      return null;
    };

    const deriveSubGroup = (col: Column): string | null => {
      if (col.subGroup) return col.subGroup;
      // Legacy: "CREDIT CARD / Visa" → subGroup "CREDIT CARD".
      // We do NOT auto-derive a subGroup for "GIFT / *" because Gift's children
      // (CREDIT SLIP / GIFT CARD) sit directly under the Type band in the desktop layout.
      const parts = col.field.split("/");
      if (parts.length === 2) {
        const rawGroup = parts[0].trim();
        if (rawGroup.toUpperCase() === "CREDIT CARD") return "CREDIT CARD";
      }
      return null;
    };

    const resolved = visibleColumns.map((col) => ({
      group: deriveGroup(col),
      subGroup: deriveSubGroup(col),
    }));

    // Row 1: merge consecutive columns with the same group.
    const r1: { label: string | null; span: number }[] = [];
    {
      let currentLabel: string | null = null;
      let currentSpan = 0;
      resolved.forEach((r, idx) => {
        if (idx === 0) {
          currentLabel = r.group;
          currentSpan = 1;
        } else if (r.group === currentLabel) {
          currentSpan += 1;
        } else {
          r1.push({ label: currentLabel, span: currentSpan });
          currentLabel = r.group;
          currentSpan = 1;
        }
      });
      if (resolved.length > 0) r1.push({ label: currentLabel, span: currentSpan });
    }

    // Build the row-2 render plan. Each visible column either:
    //   - belongs to a sub-group band (consecutive same group+subGroup), or
    //   - is a plain column whose header leaf renders in row 2 and spans down
    //     into row 3 (rowSpan) so it lines up with the sub-group children.
    // A collapsed sub-group shows only its summary column, rendered as a single
    // merged band cell (rowSpan over rows 2-3) carrying an expand arrow.
    type Row2Cell =
      | { kind: "leaf"; index: number }
      | {
          kind: "band";
          label: string;
          span: number;
          startIndex: number;
          collapsed: boolean;
          collapsible: boolean;
        };
    const row2Plan: Row2Cell[] = [];
    const row3Indices: number[] = [];
    {
      let i = 0;
      while (i < resolved.length) {
        const { group, subGroup } = resolved[i];
        if (subGroup) {
          let j = i;
          while (
            j < resolved.length &&
            resolved[j].group === group &&
            resolved[j].subGroup === subGroup
          ) {
            j++;
          }
          const collapsed = !!collapsedSubGroups?.has(subGroup);
          row2Plan.push({
            kind: "band",
            label: subGroup,
            span: j - i,
            startIndex: i,
            collapsed,
            collapsible: !!collapsibleSubGroups?.has(subGroup),
          });
          // Expanded sub-group children get their own leaves in row 3. A
          // collapsed sub-group has only its summary column, covered by the
          // merged band cell, so it contributes no row-3 leaf.
          if (!collapsed) for (let k = i; k < j; k++) row3Indices.push(k);
          i = j;
        } else {
          row2Plan.push({ kind: "leaf", index: i });
          i += 1;
        }
      }
    }

    const hasSubGroups = resolved.some((r) => !!r.subGroup);
    const hasRow3 = row3Indices.length > 0;

    return {
      row1Groups: r1,
      row2Plan,
      row3Indices,
      hasRow3,
      hasGroups: r1.some((g) => g.label),
      hasSubGroups,
    };
  }, [visibleColumns, collapsedSubGroups, collapsibleSubGroups]);

  const hasColumnGroups = hasGroups;
  // Header rows = optional group band (row 1) + the leaf/band row (row 2) +
  // optional expanded-sub-group leaf row (row 3).
  const totalHeaderRows = (hasGroups ? 1 : 0) + 1 + (hasRow3 ? 1 : 0);
  // Plain/collapsed leaves span down into row 3 to line up with expanded
  // sub-group children when any sub-group is expanded.
  const leafRowSpan = hasRow3 ? 2 : 1;

  // Left offset (px) for each leading pinned-left column. Shared by the leaf
  // renderer so headers placed in row 2 and row 3 both stay sticky-aligned.
  const pinnedOffsetByIndex = React.useMemo(() => {
    const map = new Map<number, number>();
    let runningLeft = 0;
    for (let i = 0; i < visibleColumns.length; i++) {
      const col = visibleColumns[i];
      if (col.pinned !== "left") break;
      map.set(i, runningLeft);
      runningLeft += col.width || 95;
    }
    return map;
  }, [visibleColumns]);

  const renderLeaf = (index: number, rowSpan: number) => {
    const column = visibleColumns[index];
    return (
      <DraggableHeaderCell
        key={column.field}
        column={column}
        index={index}
        moveColumn={moveColumn}
        onSort={onSort}
        sortConfig={sortConfig}
        filterConfig={filterConfig}
        activeFilterDropdown={activeFilterDropdown}
        setActiveFilterDropdown={setActiveFilterDropdown}
        setFilterDropdownPosition={setFilterDropdownPosition}
        setThreeDotsMenuPosition={setThreeDotsMenuPosition}
        setThreeDotsMenuField={setThreeDotsMenuField}
        handleColumnRightClick={handleColumnRightClick}
        pinnedLeftOffset={pinnedOffsetByIndex.get(index)}
        rowSpan={rowSpan}
      />
    );
  };

  const renderCheckboxHeader = (rowSpan: number = 1) =>
    showCheckboxes && (
      <th
        style={{
          width: "50px",
          padding: "4px",
          textAlign: "center",
          backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#f8f9fa',
          position: "sticky",
          borderBottom: `2px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'}`,
          left: 0,
          zIndex: 5,
        }}
        rowSpan={rowSpan}
      >
        <input
          type="checkbox"
          data-header-checkbox="true"
          checked={isAllSelected}
          ref={(input) => {
            if (input) {
              input.indeterminate = isIndeterminate;
            }
          }}
          onChange={onSelectAll}
          style={{
            width: "16px",
            height: "16px",
            cursor: "pointer",
            accentColor:
              isAllSelected || isIndeterminate ? "#1e40af" : "#6b7280",
            colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
            backgroundColor: isAllSelected
              ? "#1e40af"
              : isIndeterminate
                ? "#1e40af"
                : "transparent",
          }}
        />
      </th>
    );

  return (
    <>
      <thead>
        {/* Row 1: top-level Type band (e.g. "Actual Cash" / "Gift" for Tender Totals). */}
        {hasColumnGroups && (
          <tr>
            {/* Checkbox spans all header rows below (group + optional sub-group + column row). */}
            {renderCheckboxHeader(totalHeaderRows)}
            {row1Groups.map((group, idx) => {
              const label = group.label ?? "";
              const isCollapsible =
                !!label && !!collapsibleGroups?.has(label) && !!onToggleGroupCollapsed;
              const isCollapsed = !!label && !!collapsedGroups?.has(label);
              return (
                <th
                  key={`group-${idx}`}
                  className="grid-header-group-cell"
                  colSpan={group.span}
                >
                  {isCollapsible ? (
                    <button
                      type="button"
                      onClick={() => onToggleGroupCollapsed!(label)}
                      title={isCollapsed ? `Expand ${label}` : `Collapse ${label}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        font: "inherit",
                        color: "inherit",
                        padding: 0,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          display: "inline-block",
                          transition: "transform 0.15s ease",
                          transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                          fontSize: "0.7em",
                          lineHeight: 1,
                        }}
                      >
                        ▶
                      </span>
                      {label}
                    </button>
                  ) : (
                    label
                  )}
                </th>
              );
            })}
          </tr>
        )}

        {/* Row 2: sub-group bands (e.g. collapsed/expanded "CREDIT CARD") interleaved
            with plain leaves. A plain leaf renders here and spans down into row 3
            (rowSpan=leafRowSpan) so it lines up with expanded sub-group children. A
            collapsed sub-group renders as a single merged band cell (rowSpan=leafRowSpan)
            over its summary column, carrying an expand arrow. */}
        {hasSubGroups && (
          <tr>
            {/* Checkbox lives here when there is no separate row-1 group band. */}
            {!hasColumnGroups && renderCheckboxHeader(totalHeaderRows)}
            {row2Plan.map((cell, idx) => {
              if (cell.kind === "leaf") {
                return renderLeaf(cell.index, leafRowSpan);
              }
              const isCollapsible = cell.collapsible && !!onToggleSubGroupCollapsed;
              const isCollapsed = cell.collapsed;
              return (
                <th
                  key={`subgroup-${idx}`}
                  className="grid-header-group-cell"
                  colSpan={cell.span}
                  rowSpan={isCollapsed ? leafRowSpan : 1}
                >
                  {isCollapsible ? (
                    <button
                      type="button"
                      onClick={() => onToggleSubGroupCollapsed!(cell.label)}
                      title={
                        isCollapsed
                          ? `Expand ${cell.label}`
                          : `Collapse ${cell.label}`
                      }
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        font: "inherit",
                        color: "inherit",
                        padding: 0,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          display: "inline-block",
                          transition: "transform 0.15s ease",
                          transform: isCollapsed
                            ? "rotate(0deg)"
                            : "rotate(90deg)",
                          fontSize: "0.7em",
                          lineHeight: 1,
                        }}
                      >
                        ▶
                      </span>
                      {cell.label}
                    </button>
                  ) : (
                    cell.label
                  )}
                </th>
              );
            })}
          </tr>
        )}

        {/* Row 3: leaves of expanded sub-groups only. */}
        {hasRow3 && (
          <tr>{row3Indices.map((index) => renderLeaf(index, 1))}</tr>
        )}

        {/* Legacy single leaf row when no column declares a sub-group. */}
        {!hasSubGroups && (
          <tr>
            {/* Checkbox column header when there is no separate group row */}
            {!hasColumnGroups && renderCheckboxHeader(1)}
            {visibleColumns.map((_, index) => renderLeaf(index, 1))}
          </tr>
        )}

        {/* Header Search Row */}
        {headerSearch && onHeaderSearch && (
          <HeaderSearchRow
            columns={columns}
            showCheckboxes={showCheckboxes}
            headerSearchConfig={headerSearchConfig}
            onHeaderSearch={onHeaderSearch}
            isSearching={isSearching}
          />
        )}
      </thead>

      {/* Column Context Menu */}
      {columnMenuField && columnMenuPosition && (
        <div
          className="column-context-menu-overlay"
          onClick={handleColumnMenuClose}
        >
          <div
            className="column-context-menu"
            style={{
              left: columnMenuPosition.x,
              top: columnMenuPosition.y,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="column-menu-item" onClick={handleSortAscending}>
              <span className="column-menu-icon">
                <i className="fas fa-sort-up"></i>
              </span>
              <span>Sort Ascending</span>
            </div>
            <div className="column-menu-item" onClick={handleClearSort}>
              <span className="column-menu-icon">
                <i className="fas fa-times"></i>
              </span>
              <span>Clear Sort</span>
            </div>
            <div className="column-menu-divider"></div>
            <div
              className="column-menu-item"
              onClick={handleBestFitColumnFromMenu}
            >
              <span className="column-menu-icon">
                <i className="fas fa-arrows-alt-h"></i>
              </span>
              <span>Best Fit</span>
            </div>
            <div
              className="column-menu-item"
              onClick={handleBestFitAllFromMenu}
            >
              <span className="column-menu-icon">
                <i className="fas fa-arrows-alt-h"></i>
              </span>
              <span>Best Fit (all columns)</span>
            </div>
            <div className="column-menu-divider"></div>
            <div
              className="column-menu-item"
              onClick={handleColumnChooserFromMenu}
            >
              <span className="column-menu-icon">
                <i className="fas fa-columns"></i>
              </span>
              <span>Choose Columns</span>
            </div>
          </div>
        </div>
      )}

      {/* Three Dots Menu */}
      {threeDotsMenuField && threeDotsMenuPosition && (
        <div
          className="column-context-menu-overlay"
          onClick={handleThreeDotsMenuClose}
        >
          <div
            className="three-dots-context-menu"
            style={{
              left: threeDotsMenuPosition.x,
              top: threeDotsMenuPosition.y,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="column-menu-item"
              onClick={() => {
                onSort(threeDotsMenuField);
                if (setSortConfig) {
                  setSortConfig({
                    field: threeDotsMenuField,
                    direction: "asc",
                  });
                }
                handleThreeDotsMenuClose();
              }}
            >
              <span className="column-menu-icon">
                <i className="fas fa-sort-up"></i>
              </span>
              <span>Sort Ascending</span>
            </div>
            <div className="column-menu-item" onClick={handleSortDescending}>
              <span className="column-menu-icon">
                <i className="fas fa-sort-down"></i>
              </span>
              <span>Sort Descending</span>
            </div>
            <div
              className="column-menu-item"
              onClick={() => {
                if (setSortConfig) {
                  setSortConfig(null);
                }
                handleThreeDotsMenuClose();
              }}
            >
              <span className="column-menu-icon">
                <i className="fas fa-times"></i>
              </span>
              <span>Clear Sort</span>
            </div>
            {(() => {
              const hasActiveFilter = filterConfig[
                threeDotsMenuField
              ]?.conditions?.some((c) => c.value && c.value.trim() !== "");

              if (hasActiveFilter) {
                return (
                  <div
                    className="column-menu-item"
                    style={{
                      color: "#dc2626",
                    }}
                    onClick={() => {
                      if (threeDotsMenuField) {
                        onFilter(threeDotsMenuField, [], "AND");
                      }
                      handleThreeDotsMenuClose();
                    }}
                  >
                    <span className="column-menu-icon">
                      <i
                        className="fas fa-filter"
                        style={{ textDecoration: "line-through" }}
                      ></i>
                    </span>
                    <span>Clear Filter</span>
                  </div>
                );
              }
              return null;
            })()}
            {columns.find((col) => col.field === threeDotsMenuField)
              ?.filterable && (
              <>
                <div className="column-menu-divider"></div>
                <div
                  className="column-menu-item"
                  onClick={() => {
                    if (threeDotsMenuPosition) {
                      setFilterDropdownPosition({
                        x: threeDotsMenuPosition.x,
                        y: threeDotsMenuPosition.y + 30,
                      });
                      setActiveFilterDropdown(threeDotsMenuField);
                      handleThreeDotsMenuClose();
                    }
                  }}
                >
                  <span className="column-menu-icon">
                    <FilterIcon />
                  </span>
                  <span>Filter</span>
                </div>
              </>
            )}
            <div className="column-menu-divider"></div>
            <div className="column-menu-item" onClick={handlePinColumn}>
              <span className="column-menu-icon">
                <i className="fas fa-thumbtack"></i>
              </span>
              <span>Pin Column</span>
              <span className="column-menu-arrow">
                <i className="fas fa-chevron-right"></i>
              </span>
            </div>
            <div className="column-menu-divider"></div>
            <div className="column-menu-item" onClick={handleAutosizeColumn}>
              <span className="column-menu-icon">
                <i className="fas fa-arrows-alt-h"></i>
              </span>
              <span>Best Fit</span>
            </div>
            <div
              className="column-menu-item"
              onClick={handleAutosizeAllColumns}
            >
              <span className="column-menu-icon">
                <i className="fas fa-arrows-alt-h"></i>
              </span>
              <span>Best Fit (all columns)</span>
            </div>
            <div className="column-menu-divider"></div>
            <div className="column-menu-item" onClick={handleGroupByColumn}>
              <span className="column-menu-icon">
                <i className="fas fa-layer-group"></i>
              </span>
              <span>
                Group by{" "}
                {threeDotsMenuField
                  ? columns.find((col) => col.field === threeDotsMenuField)
                      ?.headerName
                  : "Column"}
              </span>
            </div>
            <div className="column-menu-divider"></div>
            <div
              className="column-menu-item"
              onClick={() => {
                // Initialize pending state with current column visibility
                const initialState: Record<string, boolean> = {};
                columns.forEach((col) => {
                  initialState[col.field] = col.visible !== false;
                });
                setPendingColumnVisibility(initialState);
                setShowColumnDropdown(true);
                handleThreeDotsMenuClose();
              }}
            >
              <span className="column-menu-icon">
                <i className="fas fa-columns"></i>
              </span>
              <span>Choose Columns</span>
            </div>
            <div className="column-menu-item" onClick={handleResetColumns}>
              <span className="column-menu-icon">
                <i className="fas fa-undo"></i>
              </span>
              <span>Reset Columns</span>
            </div>
          </div>
        </div>
      )}

      {/* Column Chooser Dropdown */}
      {showColumnDropdown && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
          onClick={handleCancelChanges}
        >
          <div
            style={{
              position: "relative",
              backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : 'white',
              borderRadius: "24px",
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflow: "hidden",
              boxShadow: document.documentElement.classList.contains('dark')
                ? "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                : "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              width: "400px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleCancelChanges}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                zIndex: 10,
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                border: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'}`,
                backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : 'white',
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280',
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => {
                const isDark = document.documentElement.classList.contains('dark')
                e.currentTarget.style.backgroundColor = isDark ? "#374151" : "#f3f4f6";
                e.currentTarget.style.color = isDark ? "#e5e7eb" : "#374151";
              }}
              onMouseOut={(e) => {
                const isDark = document.documentElement.classList.contains('dark')
                e.currentTarget.style.backgroundColor = isDark ? "#1f2937" : "white";
                e.currentTarget.style.color = isDark ? "#9ca3af" : "#6b7280";
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="18"
                height="18"
              >
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18 6L6 18M6 6l12 12"
                />
              </svg>
            </button>

            {/* Modal content */}
            <div style={{ width: "100%", overflow: "hidden" }}>
              <div style={{ padding: "25px" }}>
                <div style={{ paddingRight: "40px" }}>
                  <h4
                    style={{
                      marginBottom: "8px",
                      fontSize: "25px",
                      fontWeight: "600",
                      color: document.documentElement.classList.contains('dark') ? '#f3f4f6' : '#111827',
                    }}
                  >
                    Choose Columns
                  </h4>
                  <p
                    style={{
                      marginBottom: "20px",
                      fontSize: "14px",
                      color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280',
                    }}
                  >
                    Select which columns to display in the table.
                  </p>
                </div>

                {/* Search input */}
                <div
                  style={{
                    position: "relative",
                    marginBottom: "20px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <svg
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "16px",
                      height: "16px",
                      color: "#9ca3af",
                      zIndex: 1,
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 7 0 11-140 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search columns..."
                    value={columnSearchTerm}
                    onChange={(e) => setColumnSearchTerm(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 16px 10px 40px",
                      border: `1px solid ${document.documentElement.classList.contains('dark') ? '#4b5563' : '#e5e7eb'}`,
                      borderRadius: "12px",
                      fontSize: "14px",
                      backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : '#f9fafb',
                      color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#111827',
                      transition: "all 0.2s ease-in-out",
                      boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                      outline: "none",
                    }}
                    onFocus={(e) => {
                      const isDark = document.documentElement.classList.contains('dark')
                      e.target.style.backgroundColor = isDark ? "#1f2937" : "#ffffff";
                      e.target.style.borderColor = "#1e40af";
                      e.target.style.boxShadow = isDark
                        ? "0 0 0 3px rgba(59, 130, 246, 0.2)"
                        : "0 0 0 3px rgba(59, 130, 246, 0.1)";
                    }}
                    onBlur={(e) => {
                      const isDark = document.documentElement.classList.contains('dark')
                      e.target.style.backgroundColor = isDark ? "#111827" : "#f9fafb";
                      e.target.style.borderColor = isDark ? "#4b5563" : "#e5e7eb";
                      e.target.style.boxShadow =
                        "0 1px 2px 0 rgba(0, 0, 0, 0.05)";
                    }}
                  />
                </div>

                {/* Column list */}
                <div
                  style={{
                    maxHeight: "400px",
                    overflowY: "auto",
                    paddingRight: "8px",
                    marginBottom: "20px",
                  }}
                >
                  {filteredColumns.map((column) => (
                    <label
                      key={column.field}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "12px 16px",
                        marginBottom: "8px",
                        backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : '#f9fafb',
                        borderRadius: "12px",
                        cursor: "pointer",
                        border: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'}`,
                        transition: "all 0.2s ease-in-out",
                      }}
                      onMouseOver={(e) => {
                        const isDark = document.documentElement.classList.contains('dark')
                        e.currentTarget.style.backgroundColor = isDark ? "#1f2937" : "#f3f4f6";
                        e.currentTarget.style.borderColor = isDark ? "#4b5563" : "#d1d5db";
                      }}
                      onMouseOut={(e) => {
                        const isDark = document.documentElement.classList.contains('dark')
                        e.currentTarget.style.backgroundColor = isDark ? "#111827" : "#f9fafb";
                        e.currentTarget.style.borderColor = isDark ? "#374151" : "#e5e7eb";
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={getColumnVisibility(column.field)}
                        onChange={() =>
                          handleColumnVisibilityToggle(column.field)
                        }
                        style={{
                          marginRight: "12px",
                          width: "16px",
                          height: "16px",
                          accentColor: "#1e40af",
                          cursor: "pointer",
                          colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
                        }}
                      />
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: "500",
                          color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                          transition: "all 0.2s ease-in-out",
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.textDecoration = "underline";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.textDecoration = "none";
                        }}
                      >
                        {column.headerName}
                      </span>
                    </label>
                  ))}
                </div>

                {/* Action buttons */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={handleCancelChanges}
                    style={{
                      padding: "10px 18px",
                      backgroundColor: document.documentElement.classList.contains('dark') ? '#374151' : 'white',
                      border: `1px solid ${document.documentElement.classList.contains('dark') ? '#4b5563' : '#d1d5db'}`,
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                      transition: "all 0.2s ease-in-out",
                    }}
                    onMouseOver={(e) => {
                      const isDark = document.documentElement.classList.contains('dark')
                      e.currentTarget.style.backgroundColor = isDark ? "#4b5563" : "#f9fafb";
                      e.currentTarget.style.borderColor = isDark ? "#6b7280" : "#9ca3af";
                    }}
                    onMouseOut={(e) => {
                      const isDark = document.documentElement.classList.contains('dark')
                      e.currentTarget.style.backgroundColor = isDark ? "#374151" : "white";
                      e.currentTarget.style.borderColor = isDark ? "#4b5563" : "#d1d5db";
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplyChanges}
                    style={{
                      padding: "10px 18px",
                      backgroundColor: "#1e40af",
                      border: "1px solid #1e40af",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "white",
                      transition: "all 0.2s ease-in-out",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = "#1e40af";
                      e.currentTarget.style.borderColor = "#1e40af";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = "#1e40af";
                      e.currentTarget.style.borderColor = "#1e40af";
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeFilterDropdown && (
        <FilterDropdown
          field={activeFilterDropdown}
          column={
            columns.find((col) => col.field === activeFilterDropdown) || {
              field: activeFilterDropdown,
            }
          }
          filterConfig={filterConfig}
          onFilterChange={(field: string, conditions: any[], logic: any) => {
            onFilter(field, conditions, logic);
          }}
          onClose={() => setActiveFilterDropdown(null)}
          position={filterDropdownPosition}
        />
      )}
    </>
  );
};
