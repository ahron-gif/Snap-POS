import React, { useState, useEffect, useRef, useLayoutEffect } from "react"
import { Column, HeaderSearchConfig } from "../types/grid"

// Custom context menu item interface
export interface CustomContextMenuItem {
  label: string | ((row: any) => string)
  icon?: React.ReactNode | ((row: any) => React.ReactNode)
  onClick: (row: any) => void
  color?: string
  hoverBgColor?: string
  dividerBefore?: boolean
  shortcut?: string // e.g. "Ctrl + G" - displayed right-aligned in menu
  subMenu?: CustomContextMenuItem[]
}

interface GridBodyProps {
  data: any[]
  columns: Column[]
  editable?: boolean
  onRowUpdate?: (updatedRow: any) => void
  showColumnChooser?: boolean
  ActionButtons?: React.ComponentType<{ row: any }>
  showCheckboxes?: boolean
  selectedRows?: Set<string>
  onRowSelection?: (rowId: string) => void
  getRowId?: (row: any) => string
  startIndex?: number
  onEditAction?: (row: any) => void
  onDeleteAction?: (row: any) => void
  onViewAction?: (row: any) => void;
  onSendInviteAction?: (row: any, showToastCallback: (msg: string, type: "success" | "error" | "info") => void) => void;
  // Header search config for text highlighting
  headerSearchConfig?: HeaderSearchConfig;
  // Whether groups should be expanded by default
  defaultGroupsExpanded?: boolean;
  // Custom context menu items
  customContextMenuItems?: CustomContextMenuItem[];
  // Hide default context menu items (View Details, Edit Details, Delete Row)
  hideDefaultContextMenuItems?: boolean;
  // Optional: called when a row is double-clicked (e.g. drill-down). When set, double-click calls this instead of edit.
  onRowDoubleClick?: (row: any) => void;
  // Optional: called when a data row is clicked (single click)
  onRowClick?: (row: any) => void;
  // Optional: returns a CSS class name for the row based on row data (e.g. for greying out inactive rows)
  getRowClassName?: (row: any) => string;
}

export const GridBody: React.FC<GridBodyProps> = ({
  data,
  columns,
  editable,
  onRowUpdate,
  showColumnChooser,
  ActionButtons,
  showCheckboxes = false,
  selectedRows = new Set(),
  onRowSelection,
  getRowId = (row) =>
    row.itemStoreID || row.id || row.itemID || row.userId || row.userID,
  startIndex = 0,
  onEditAction,
  onDeleteAction,
  onViewAction,
  onSendInviteAction,
  headerSearchConfig = {},
  defaultGroupsExpanded = false,
  customContextMenuItems = [],
  hideDefaultContextMenuItems = false,
  onRowDoubleClick,
  onRowClick,
  getRowClassName,
}) => {
  // All hooks must be at the top level, before any early returns
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number
    field: string
  } | null>(null)
  const [editValue, setEditValue] = useState<string>("")

  // Initialize expanded groups based on defaultGroupsExpanded prop
  // If defaultGroupsExpanded is true, collect all group keys from data
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    if (defaultGroupsExpanded) {
      const groupKeys = data
        .filter((row) => row.__isGroupHeader)
        .map((row) => row.__groupKey as string)
      return new Set(groupKeys)
    }
    return new Set()
  })

  // When defaultGroupsExpanded is true and data arrives async (server-side load),
  // mark any newly-seen group keys as expanded. We don't collapse user-toggled
  // groups: we only ADD missing keys, never remove existing ones.
  useEffect(() => {
    if (!defaultGroupsExpanded) return
    const groupKeys = data
      .filter((row) => row.__isGroupHeader)
      .map((row) => row.__groupKey as string)
      .filter((k) => typeof k === "string" && k.length > 0)
    if (groupKeys.length === 0) return
    setExpandedGroups((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const k of groupKeys) {
        if (!next.has(k)) { next.add(k); changed = true }
      }
      return changed ? next : prev
    })
  }, [data, defaultGroupsExpanded])
  const [contextMenu, setContextMenu] = useState<{
    show: boolean
    x: number
    y: number
    row: any
  }>({ show: false, x: 0, y: 0, row: null })
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Auto-reposition context menu if it overflows the viewport
  useLayoutEffect(() => {
    if (!contextMenu.show || !contextMenuRef.current) return
    const el = contextMenuRef.current
    const rect = el.getBoundingClientRect()
    const viewportH = window.innerHeight
    const viewportW = window.innerWidth
    let newY = contextMenu.y
    let newX = contextMenu.x

    if (rect.bottom > viewportH) {
      newY = contextMenu.y - rect.height
      if (newY < 0) newY = 4
    }
    if (rect.right > viewportW) {
      newX = viewportW - rect.width - 4
    }
    if (newY !== contextMenu.y || newX !== contextMenu.x) {
      el.style.top = `${newY}px`
      el.style.left = `${newX}px`
    }
  }, [contextMenu.show, contextMenu.x, contextMenu.y])

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu({ show: false, x: 0, y: 0, row: null })
    }

    if (contextMenu.show) {
      document.addEventListener("click", handleClickOutside)
      return () => document.removeEventListener("click", handleClickOutside)
    }
  }, [contextMenu.show])

  const handleRowContextMenu = (e: React.MouseEvent, row: any) => {
    // Don't show context menu for group headers
    if (row.__isGroupHeader) return

    // Skip entirely when there's nothing to show in the menu — otherwise the
    // popup renders as an empty box. Items appear only when (a) default items
    // are enabled AND the corresponding action prop is wired, or (b) the host
    // page provides customContextMenuItems.
    const hasDefaultItems = !hideDefaultContextMenuItems &&
      Boolean(onViewAction || onEditAction || onDeleteAction || onSendInviteAction)
    const hasCustomItems = Array.isArray(customContextMenuItems) && customContextMenuItems.length > 0
    if (!hasDefaultItems && !hasCustomItems) return

    e.preventDefault()
    e.stopPropagation()

    setContextMenu({
      show: true,
      x: e.pageX,
      y: e.pageY,
      row: row,
    })
  }

  const handleContextMenuEdit = () => {
    if (contextMenu.row && onEditAction) {
      onEditAction(contextMenu.row)
    }
    setContextMenu({ show: false, x: 0, y: 0, row: null })
  }

  const handleContextMenuDelete = () => {
    if (contextMenu.row && onDeleteAction) {
      onDeleteAction(contextMenu.row)
    }
    setContextMenu({ show: false, x: 0, y: 0, row: null })
  }

  const handleContextMenuView = () => {
    if (contextMenu.row && onViewAction) {
      onViewAction(contextMenu.row);
    }
    setContextMenu({ show: false, x: 0, y: 0, row: null });
  };

  const handleContextMenuSendInvite = () => {
    if (contextMenu.row && onSendInviteAction) {
      onSendInviteAction(contextMenu.row, (msg, type) => {
        // Assuming showUserToast is available for showing the toast
        (window as any).showUserToast(msg, type);
      });
    }
    setContextMenu({ show: false, x: 0, y: 0, row: null });
  };

  // If no data, show empty state in tbody
  if (!data || data.length === 0) {
    const visibleColumns = columns.filter((col) => col.visible !== false)
    const totalColumns =
      visibleColumns.length +
      (showColumnChooser ? 1 : 0) +
      (showCheckboxes ? 1 : 0)

    return (
      <tbody>
        <tr>
          <td
            colSpan={totalColumns}
            style={{
              padding: "60px 20px",
              textAlign: "center",
              border: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'}`,
              backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : '#fafbfc',
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
                color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#666',
              }}
            >
              <div style={{ fontSize: "48px", opacity: 0.5 }}>📋</div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "500",
                  color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#333',
                }}
              >
                No Data Found
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#666',
                  lineHeight: "1.5",
                }}
              >
                No records found matching your current search criteria or
                filters.
                <br />
                Try adjusting your filters or search terms to find what you're
                looking for.
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    )
  }

  const handleCellDoubleClick = (
    rowId: any,
    field: string,
    currentValue: any
  ) => {
    if (!editable) return

    // Don't allow editing of action columns
    const column = columns.find((col) => col.field === field)
    if (column?.dataType === "actions") return

    setEditingCell({ rowIndex: rowId, field })
    setEditValue(currentValue?.toString() || "")
  }

  const handleCellSave = (row: any) => {
    if (!editingCell || !onRowUpdate) return

    const updatedRow = {
      ...row,
      [editingCell.field]: editValue,
    }

    onRowUpdate(updatedRow)
    setEditingCell(null)
    setEditValue("")
  }

  const handleCellCancel = () => {
    setEditingCell(null)
    setEditValue("")
  }

  const handleKeyDown = (e: React.KeyboardEvent, row: any) => {
    if (e.key === "Enter") {
      handleCellSave(row)
    } else if (e.key === "Escape") {
      handleCellCancel()
    }
  }

  const toggleGroupExpansion = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey)
      } else {
        newSet.add(groupKey)
      }
      return newSet
    })
  }

  // Helper function to highlight search text in a string
  const highlightSearchText = (text: string, searchTerm: string): React.ReactNode => {
    if (!searchTerm || !text) return text

    const lowerText = text.toLowerCase()
    const lowerSearch = searchTerm.toLowerCase().trim()

    if (!lowerSearch || !lowerText.includes(lowerSearch)) return text

    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let index = lowerText.indexOf(lowerSearch)

    while (index !== -1) {
      // Add text before match
      if (index > lastIndex) {
        parts.push(text.substring(lastIndex, index))
      }
      // Add highlighted match
      parts.push(
        <mark
          key={`highlight-${index}`}
          style={{
            backgroundColor: "#fef08a",
            padding: "1px 2px",
            borderRadius: "2px",
            color: "#854d0e",
            fontWeight: 500,
          }}
        >
          {text.substring(index, index + lowerSearch.length)}
        </mark>
      )
      lastIndex = index + lowerSearch.length
      index = lowerText.indexOf(lowerSearch, lastIndex)
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }

    return <>{parts}</>
  }

  const renderCell = (row: any, column: Column) => {
    // Handle group header rows
    if (row.__isGroupHeader) {
      return null // Group headers are handled separately
    }

    // Handle action buttons
    if (column.dataType === "actions" && ActionButtons) {
      return <ActionButtons row={row} />
    }

    const value = row[column.field]
    const isEditing =
      editingCell?.rowIndex === row.id && editingCell?.field === column.field

    if (isEditing) {
      return (
        <input
          type={column.dataType === "number" ? "number" : "text"}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleCellSave(row)}
          onKeyDown={(e) => handleKeyDown(e, row)}
          autoFocus
          className="cell-editor"
          style={{
            width: "100%",
            border: "2px solid #1976d2",
            borderRadius: "4px",
            padding: "4px 8px",
            fontSize: "14px",
            outline: "none",
          }}
        />
      )
    }

    // Get search term for this column if any
    const searchTerm = headerSearchConfig[column.field] || ""

    // Handle different data types for display
    let displayValue: React.ReactNode = value

    if (column.cellRenderer) {
      displayValue = column.cellRenderer(value,row)
    } else {
      // Handle different data types
      if (column.dataType === "boolean") {
        const isTrue = value === 1 || value === true || value === "true"
        const color = isTrue ? "#16a34a" : "#dc2626"
        const bg = isTrue ? "#dcfce7" : "#fee2e2"
        const label = isTrue ? "Yes" : "No"
        displayValue = (
          <span
            aria-label={label}
            title={label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 22,
                height: 22,
                borderRadius: 9999,
                backgroundColor: bg,
                color,
              }}
            >
              {isTrue ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="5 12 10 17 19 7" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </svg>
              )}
            </span>
          </span>
        )
      } else if (column.dataType === "date" && value) {
        displayValue = new Date(value).toLocaleDateString()
      } else if (column.dataType === "datetime" && value) {
        displayValue = new Date(value).toLocaleString()
      } else if (column.dataType === "time" && value) {
        displayValue = new Date(value).toLocaleTimeString()
      } else if (column.dataType === "number" && typeof value === "number") {
        displayValue = value.toLocaleString()
      } else if (column.dataType === "email" && value) {
        const emailText = value.toString()
        displayValue = (
          <a
            href={`mailto:${value}`}
            style={{ color: "#1976d2", textDecoration: "none" }}
            onMouseOver={(e) =>
              (e.currentTarget.style.textDecoration = "underline")
            }
            onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
          >
            {searchTerm ? highlightSearchText(emailText, searchTerm) : emailText}
          </a>
        )
      } else if (column.dataType === "url" && value) {
        const urlText = value.toString()
        displayValue = (
          <a
            href={value.startsWith("http") ? value : `https://${value}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#1976d2", textDecoration: "none" }}
            onMouseOver={(e) =>
              (e.currentTarget.style.textDecoration = "underline")
            }
            onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
          >
            {searchTerm ? highlightSearchText(urlText, searchTerm) : urlText}
          </a>
        )
      } else {
        const textValue = value?.toString() || ""
        // Apply search highlighting for text values
        displayValue = searchTerm ? highlightSearchText(textValue, searchTerm) : textValue
      }
    }

    // Handle long text truncation (only for plain strings, not for highlighted content)
    if (typeof displayValue === "string" && displayValue.length > 50) {
      const truncatedText = displayValue.substring(0, 50) + "..."
      displayValue = searchTerm ? (
        <span title={displayValue}>{highlightSearchText(truncatedText, searchTerm)}</span>
      ) : (
        <span title={displayValue}>{truncatedText}</span>
      )
    }

    return (
      <span
        className={`cell-content ${
          editable && column.editable !== false && column.dataType !== "actions"
            ? "editable"
            : ""
        }`}
        onDoubleClick={() => {
          if (onRowDoubleClick && !row.__isGroupHeader) {
            onRowDoubleClick(row)
          } else {
            handleCellDoubleClick(row.id, column.field, value)
          }
        }}
        title={typeof value === "string" ? value : undefined}
      >
        {displayValue}
      </span>
    )
  }

  const visibleColumns = columns.filter((column) => column.visible !== false)

  return (
    <>
      <tbody>
        {data.map((row, dataIndex) => {
          // Handle group headers
          if (row.__isGroupHeader) {
            const groupColumns = row.__groupColumns || []
            const groupKey = row.__groupKey || "Unknown Group"
            const groupCount = row.__groupCount || 0
            const isExpanded = expandedGroups.has(groupKey)

            return (
              <tr
                key={`group-${groupKey}-${dataIndex}`}
                className="grid-group-header-row"
                style={{
                  backgroundColor: "#e9ecef",
                  fontWeight: "bold",
                }}
              >
                <td
                  colSpan={
                    visibleColumns.length +
                    (showColumnChooser ? 1 : 0) +
                    (showCheckboxes ? 1 : 0)
                  }
                  className="grid-group-header-cell"
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #dee2e6",
                  }}
                >
                  <div className="group-header-content">
                    <span
                      className="group-header-icon"
                      style={{
                        color: "#6c757d",
                        fontSize: "12px",
                        cursor: "pointer",
                        userSelect: "none",
                        transition: "transform 0.2s ease",
                        display: "inline-block",
                        width: "16px",
                        textAlign: "center",
                        transform: isExpanded
                          ? "rotate(90deg)"
                          : "rotate(0deg)",
                      }}
                      onClick={() => {
                        setExpandedGroups((prev) => {
                          const newSet = new Set(prev)
                          if (newSet.has(groupKey)) {
                            newSet.delete(groupKey)
                          } else {
                            newSet.add(groupKey)
                          }
                          return newSet
                        })
                      }}
                    >
                      ▶
                    </span>
                    <span className="group-header-text">
                      {groupColumns.map((col) => col.headerName).join(", ")}:{" "}
                      {groupKey} ({groupCount} items)
                    </span>
                  </div>
                </td>
              </tr>
            )
          }

          // ----- Group footer (subtotal) row -----
          // Opt-in via Grid's `summaryFields` prop. Renders directly
          // below its group with bold text + "{Group} Total" label and
          // the summed values in their matching columns. Shown even
          // when the group is COLLAPSED so the user always sees the
          // store total (matches desktop pivot-grid behaviour).
          if (row.__isGroupFooter) {
            const groupKey = row.__groupKey || ""
            const totals = (row.__totals || {}) as Record<string, number>
            // Group label cell spans the leading group-by columns,
            // then each summary field renders in its own column slot.
            const groupColumns = row.__groupColumns || []
            const labelText = `${groupKey} Total`
            return (
              <tr
                key={`group-footer-${groupKey}-${dataIndex}`}
                className="grid-group-footer-row"
                style={{
                  backgroundColor: "#f1f5f9",
                  fontWeight: 600,
                  borderTop: "1px solid #cbd5e1",
                }}
              >
                {showCheckboxes && <td style={{ width: 50 }} />}
                {visibleColumns.map((col, ci) => {
                  const isGroupCol = groupColumns.some((g) => g.field === col.field)
                  const isFirstColumn = ci === 0
                  // Label goes in the first column (or the first group-by column)
                  if (isFirstColumn || isGroupCol) {
                    return (
                      <td
                        key={`gf-${col.field}-${ci}`}
                        style={{ padding: "6px 12px", borderBottom: "1px solid #cbd5e1" }}
                      >
                        {isFirstColumn ? labelText : ""}
                      </td>
                    )
                  }
                  if (Object.prototype.hasOwnProperty.call(totals, col.field)) {
                    const value = totals[col.field]
                    const display = col.cellRenderer
                      ? col.cellRenderer(value, row)
                      : value
                    return (
                      <td
                        key={`gf-${col.field}-${ci}`}
                        style={{ padding: "6px 12px", textAlign: "right", borderBottom: "1px solid #cbd5e1" }}
                      >
                        {display as React.ReactNode}
                      </td>
                    )
                  }
                  return (
                    <td
                      key={`gf-${col.field}-${ci}`}
                      style={{ padding: "6px 12px", borderBottom: "1px solid #cbd5e1" }}
                    />
                  )
                })}
                {showColumnChooser && <td />}
              </tr>
            )
          }

          // ----- Grand total row (always at the bottom) -----
          if (row.__isGrandTotal) {
            const totals = (row.__totals || {}) as Record<string, number>
            return (
              <tr
                key={`grand-total-${dataIndex}`}
                className="grid-grand-total-row"
                style={{
                  backgroundColor: "#e2e8f0",
                  fontWeight: 700,
                  borderTop: "2px solid #94a3b8",
                }}
              >
                {showCheckboxes && <td style={{ width: 50 }} />}
                {visibleColumns.map((col, ci) => {
                  if (ci === 0) {
                    return (
                      <td key={`gt-${col.field}-${ci}`} style={{ padding: "8px 12px" }}>
                        Grand Total
                      </td>
                    )
                  }
                  if (Object.prototype.hasOwnProperty.call(totals, col.field)) {
                    const value = totals[col.field]
                    const display = col.cellRenderer
                      ? col.cellRenderer(value, row)
                      : value
                    return (
                      <td
                        key={`gt-${col.field}-${ci}`}
                        style={{ padding: "8px 12px", textAlign: "right" }}
                      >
                        {display as React.ReactNode}
                      </td>
                    )
                  }
                  return <td key={`gt-${col.field}-${ci}`} style={{ padding: "8px 12px" }} />
                })}
                {showColumnChooser && <td />}
              </tr>
            )
          }

          // Skip rendering regular rows if their group is collapsed.
          // Walk backwards past any footer pseudo-rows to find the
          // controlling group header.
          const rowGroupKey = data
            .slice(0, dataIndex)
            .reverse()
            .find((r) => r.__isGroupHeader)?.__groupKey
          if (rowGroupKey && !expandedGroups.has(rowGroupKey)) {
            return null
          }

          // Use itemStoreID directly for selection - no frontend ID generation
          const itemStoreID = getRowId(row) || `fallback-${dataIndex}`
          const rowId = getRowId(row)

          return (
            <tr
              key={`row-${itemStoreID}-${dataIndex}`}
              className={getRowClassName ? getRowClassName(row) : undefined}
              style={{ height: "24px" }}
              onContextMenu={(e) => handleRowContextMenu(e, row)}
              onClick={(e) => {
                if (!onRowClick || row.__isGroupHeader) return
                const target = e.target as HTMLElement | null
                if (!target) return
                // Prevent slide-over from opening when user interacts with UI controls
                if (
                  target.closest('input[type="checkbox"], button, a, input, select, textarea, label, [role="button"]')
                ) {
                  return
                }
                onRowClick(row)
              }}
            >
              {showCheckboxes && (
                <td
                  style={{
                    width: "50px",
                    padding: "4px",
                    textAlign: "center",
                    borderBottom: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'}`,
                    position: "sticky",
                    left: 0,
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : 'white',
                    zIndex: 5,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedRows.has(rowId) || false}
                    onChange={(e) => {
                      e.stopPropagation()
                      console.log(
                        "Checkbox onChange triggered, rowId:",
                        rowId,
                        "checked:",
                        e.target.checked
                      )
                      if (onRowSelection) {
                        onRowSelection(rowId)
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: "16px",
                      height: "16px",
                      cursor: "pointer",
                      accentColor: "#1e40af",
                      colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
                    }}
                  />
                </td>
              )}
              {(() => {
                // Pre-compute left offsets for pinned-left body cells in this row.
                // Same algorithm as GridHeader so columns stay aligned during horizontal scroll.
                const pinnedOffsetByIndex = new Map<number, number>();
                let runningLeft = 0;
                for (let i = 0; i < visibleColumns.length; i++) {
                  const col = visibleColumns[i];
                  if (col.pinned !== 'left') break;
                  pinnedOffsetByIndex.set(i, runningLeft);
                  runningLeft += col.width || 95;
                }
                return visibleColumns.map((column, colIndex) => {
                  const pinnedOffset = pinnedOffsetByIndex.get(colIndex);
                  const isPinned = pinnedOffset !== undefined;
                  return (
                    <td
                      key={`${itemStoreID}-${column.field}`}
                      className={`grid-cell${isPinned ? " pinned-left" : ""}`}
                      style={{
                        padding: "0px 6px",
                        borderBottom: "1px solid #e0e0e0",
                        verticalAlign: "middle",
                        fontSize: "12px",
                        lineHeight: "1.3",
                        textAlign:
                          column.dataType === "number"
                            ? "right"
                            : column.dataType === "boolean"
                            ? "center"
                            : column.dataType === "actions"
                            ? "center"
                            : "left",
                        width: column.width,
                        minWidth: column.width,
                        maxWidth: column.width,
                        ...(isPinned && {
                          position: "sticky",
                          left: pinnedOffset,
                          // Match the row background so scrolled tender cells don't bleed through.
                          // We sample the table's existing zebra background by reading from the parent row's
                          // computed style at render time would be expensive; using a CSS variable / class
                          // pair instead. The `.pinned-left` class in Grid.css sets the background.
                          backgroundColor: document.documentElement.classList.contains("dark") ? "#111827" : "#ffffff",
                          zIndex: 4,
                        }),
                      }}
                    >
                      {renderCell(row, column)}
                    </td>
                  );
                });
              })()}
            </tr>
          )
        })}
      </tbody>

      {/* Context Menu */}
      {contextMenu.show && (
        <div
          ref={contextMenuRef}
          className="context-menu-container"
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : 'white',
            border: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e0e0e0'}`,
            borderRadius: "8px",
            boxShadow: document.documentElement.classList.contains('dark')
              ? "0 4px 12px rgba(0, 0, 0, 0.3)"
              : "0 4px 12px rgba(0, 0, 0, 0.15)",
            zIndex: 1000,
            minWidth: "160px",
            padding: "4px 0",
          }}
          onClick={(e) => e.stopPropagation()}
        >

          {!hideDefaultContextMenuItems && onViewAction && (
          <div
            style={{
              padding: "8px 16px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "14px",
              color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
              transition: "background-color 0.2s ease",
            }}
            onClick={handleContextMenuView}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = document.documentElement.classList.contains('dark') ? "#374151" : "#f3f4f6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 11l3-3 3 3" />
              <path d="M9 16l3-3 3 3" />
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            </svg>
            View Details
          </div>
        )}
        {!hideDefaultContextMenuItems && onEditAction && (
            <div
              style={{
                padding: "8px 16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
                color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                transition: "background-color 0.2s ease",
              }}
              onClick={handleContextMenuEdit}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = document.documentElement.classList.contains('dark') ? "#374151" : "#f3f4f6"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="m18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit Details
            </div>
          )}
          
          {!hideDefaultContextMenuItems && onDeleteAction && (
            <div
              style={{
                padding: "8px 16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
                color: "#dc2626",
                transition: "background-color 0.2s ease",
              }}
              onClick={handleContextMenuDelete}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = document.documentElement.classList.contains('dark') ? "#450a0a" : "#fef2f2"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3,6 5,6 21,6" />
                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              Delete Row
            </div>
          )}

              {!hideDefaultContextMenuItems && onSendInviteAction && (
            <div
              style={{
                padding: "8px 16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
                color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151',
                transition: "background-color 0.2s ease",
              }}
              onClick={handleContextMenuSendInvite}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = document.documentElement.classList.contains('dark') ? "#374151" : "#f3f4f6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              Send Invite
            </div>
          )}

          {/* Custom Context Menu Items */}
          {customContextMenuItems.map((item, index) => (
            <React.Fragment key={`custom-menu-${index}`}>
              {item.dividerBefore && (
                <div style={{ borderTop: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e0e0e0'}`, margin: "4px 0" }} />
              )}
              {item.subMenu ? (
                <div
                  style={{
                    position: "relative",
                  }}
                  className="custom-submenu-container"
                >
                  <div
                    style={{
                      padding: "8px 16px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      fontSize: "14px",
                      color: item.color || (document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151'),
                      transition: "background-color 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      const isDark = document.documentElement.classList.contains('dark')
                      e.currentTarget.style.backgroundColor = item.hoverBgColor || (isDark ? "#374151" : "#f3f4f6");
                      const subMenu = e.currentTarget.nextElementSibling as HTMLElement;
                      if (subMenu) subMenu.style.display = "block";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {typeof item.icon === "function" ? item.icon(contextMenu.row) : item.icon}
                      {typeof item.label === "function" ? item.label(contextMenu.row) : item.label}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                  <div
                    className="context-menu-submenu"
                    style={{
                      position: "absolute",
                      left: "100%",
                      top: "0",
                      backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : 'white',
                      border: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e0e0e0'}`,
                      borderRadius: "8px",
                      boxShadow: document.documentElement.classList.contains('dark')
                        ? "0 4px 12px rgba(0, 0, 0, 0.3)"
                        : "0 4px 12px rgba(0, 0, 0, 0.15)",
                      minWidth: "140px",
                      padding: "4px 0",
                      display: "none",
                      zIndex: 1001,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.display = "block";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  >
                    {item.subMenu.map((subItem, subIndex) => (
                      <div
                        key={`sub-menu-${subIndex}`}
                        style={{
                          padding: "8px 16px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          fontSize: "14px",
                          color: subItem.color || (document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151'),
                          transition: "background-color 0.2s ease",
                        }}
                        onClick={() => {
                          subItem.onClick(contextMenu.row);
                          setContextMenu({ show: false, x: 0, y: 0, row: null });
                        }}
                        onMouseEnter={(e) => {
                          const isDark = document.documentElement.classList.contains('dark')
                          e.currentTarget.style.backgroundColor = subItem.hoverBgColor || (isDark ? "#374151" : "#f3f4f6");
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        {typeof subItem.icon === "function" ? subItem.icon(contextMenu.row) : subItem.icon}
                        {typeof subItem.label === "function" ? subItem.label(contextMenu.row) : subItem.label}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: "8px 16px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    fontSize: "14px",
                    color: item.color || (document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151'),
                    transition: "background-color 0.2s ease",
                  }}
                  onClick={() => {
                    item.onClick(contextMenu.row);
                    setContextMenu({ show: false, x: 0, y: 0, row: null });
                  }}
                  onMouseEnter={(e) => {
                    const isDark = document.documentElement.classList.contains('dark')
                    e.currentTarget.style.backgroundColor = item.hoverBgColor || (isDark ? "#374151" : "#f3f4f6");
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {typeof item.icon === "function" ? item.icon(contextMenu.row) : item.icon}
                    {typeof item.label === "function" ? item.label(contextMenu.row) : item.label}
                  </span>
                  {item.shortcut && (
                    <span style={{ fontSize: "12px", color: document.documentElement.classList.contains('dark') ? '#6b7280' : '#9ca3af', marginLeft: "16px", whiteSpace: "nowrap" }}>
                      {item.shortcut}
                    </span>
                  )}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </>
  )
}
