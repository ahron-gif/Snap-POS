import React, { useState, useRef, useEffect, useMemo } from "react"

// Aggregate types
export type AggregateType = "sum" | "min" | "max" | "count" | "average" | "none"

// Interface for column aggregate settings
export interface ColumnAggregate {
  field: string
  type: AggregateType
}

interface GridFooterProps {
  columns: Array<{
    field: string
    headerName: string
    type?: string
    visible?: boolean
    width?: number
    dataType?: string
  }>
  data: any[]
  showCheckboxes?: boolean
  columnAggregates: Map<string, AggregateType>
  onAggregateChange: (field: string, type: AggregateType) => void
}

// Context menu position state
interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  field: string
}

export const GridFooter: React.FC<GridFooterProps> = ({
  columns,
  data,
  showCheckboxes = false,
  columnAggregates,
  onAggregateChange,
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    field: "",
  })

  const contextMenuRef = useRef<HTMLDivElement>(null)

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node)
      ) {
        setContextMenu((prev) => ({ ...prev, visible: false }))
      }
    }

    if (contextMenu.visible) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [contextMenu.visible])

  // Calculate aggregate value for a column
  const calculateAggregate = useMemo(() => {
    return (field: string, type: AggregateType): string | number => {
      if (type === "none" || !data || data.length === 0) {
        return ""
      }

      // Get numeric values from data
      const values = data
        .map((row) => {
          const val = row[field]
          if (val === null || val === undefined || val === "") return null
          const num = parseFloat(val)
          return isNaN(num) ? null : num
        })
        .filter((val): val is number => val !== null)

      if (values.length === 0) {
        return type === "count" ? data.length : ""
      }

      switch (type) {
        case "sum":
          return values.reduce((acc, val) => acc + val, 0).toFixed(2)
        case "min":
          return Math.min(...values).toFixed(2)
        case "max":
          return Math.max(...values).toFixed(2)
        case "count":
          return data.length
        case "average":
          return (values.reduce((acc, val) => acc + val, 0) / values.length).toFixed(2)
        default:
          return ""
      }
    }
  }, [data])

  // Handle right-click on footer cell
  const handleContextMenu = (e: React.MouseEvent, field: string) => {
    e.preventDefault()

    // Calculate menu height (approximately 6 items * 36px + padding)
    const menuHeight = 250
    const menuWidth = 150

    // Get viewport dimensions
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth

    // Calculate position - open upward since footer is at bottom
    let x = e.clientX
    let y = e.clientY - menuHeight // Position above the click point

    // Ensure menu doesn't go above viewport
    if (y < 10) {
      y = 10
    }

    // Ensure menu doesn't go off right edge
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10
    }

    setContextMenu({
      visible: true,
      x,
      y,
      field,
    })
  }

  // Handle aggregate option selection
  const handleSelectAggregate = (type: AggregateType) => {
    console.log(`[GridFooter] handleSelectAggregate: field=${contextMenu.field}, type=${type}`)
    onAggregateChange(contextMenu.field, type)
    setContextMenu((prev) => ({ ...prev, visible: false }))
  }

  // Get display label for aggregate type
  const getAggregateLabel = (type: AggregateType): string => {
    switch (type) {
      case "sum":
        return "Sum"
      case "min":
        return "Min"
      case "max":
        return "Max"
      case "count":
        return "Count"
      case "average":
        return "Avg"
      default:
        return ""
    }
  }

  // Get visible columns (excluding action columns for aggregation but including for display)
  const visibleColumns = columns.filter((col) => col.visible !== false)

  return (
    <>
      <tfoot className="grid-footer">
        <tr>
          {/* Checkbox column placeholder */}
          {showCheckboxes && (
            <td
              className="grid-footer-cell"
              style={{
                width: 50,
                minWidth: 50,
                maxWidth: 50,
              }}
            />
          )}

          {/* Footer cells for each visible column */}
          {visibleColumns.map((col) => {
            const isActionColumn = col.dataType === "actions"
            const aggregateType = columnAggregates.get(col.field) || "none"
            const aggregateValue = isActionColumn ? "" : calculateAggregate(col.field, aggregateType)

            return (
              <td
                key={col.field}
                className={`grid-footer-cell ${!isActionColumn ? "can-aggregate" : ""}`}
                style={{
                  width: col.width || "auto",
                  minWidth: 80,
                }}
                onContextMenu={!isActionColumn ? (e) => handleContextMenu(e, col.field) : undefined}
                title={!isActionColumn ? "Right-click to select aggregate function" : ""}
              >
                {aggregateType !== "none" && aggregateValue !== "" ? (
                  <div className="aggregate-display">
                    <span className="aggregate-label">{getAggregateLabel(aggregateType)}:</span>
                    <span className="aggregate-value">{aggregateValue}</span>
                  </div>
                ) : (
                  !isActionColumn && (
                    <span className="aggregate-placeholder">-</span>
                  )
                )}
              </td>
            )
          })}
        </tr>
      </tfoot>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          ref={contextMenuRef}
          className="aggregate-context-menu"
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
          }}
        >
          <div
            className={`context-menu-item ${columnAggregates.get(contextMenu.field) === "sum" ? "selected" : ""}`}
            onClick={() => handleSelectAggregate("sum")}
          >
            <span>Sum</span>
          </div>
          <div
            className={`context-menu-item ${columnAggregates.get(contextMenu.field) === "min" ? "selected" : ""}`}
            onClick={() => handleSelectAggregate("min")}
          >
            <span>Min</span>
          </div>
          <div
            className={`context-menu-item ${columnAggregates.get(contextMenu.field) === "max" ? "selected" : ""}`}
            onClick={() => handleSelectAggregate("max")}
          >
            <span>Max</span>
          </div>
          <div
            className={`context-menu-item ${columnAggregates.get(contextMenu.field) === "count" ? "selected" : ""}`}
            onClick={() => handleSelectAggregate("count")}
          >
            <span>Count</span>
          </div>
          <div
            className={`context-menu-item ${columnAggregates.get(contextMenu.field) === "average" ? "selected" : ""}`}
            onClick={() => handleSelectAggregate("average")}
          >
            <span>Average</span>
          </div>
          <div className="context-menu-divider" />
          <div
            className={`context-menu-item ${columnAggregates.get(contextMenu.field) === "none" || !columnAggregates.has(contextMenu.field) ? "selected" : ""}`}
            onClick={() => handleSelectAggregate("none")}
          >
            <span>None</span>
          </div>
        </div>
      )}

      <style>{`
        .grid-footer {
          background-color: #f8fafc;
        }

        .grid-footer tr {
          height: 28px !important;
          min-height: 28px !important;
        }

        .grid-footer-cell {
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 600;
          color: #475569;
          text-align: right;
          vertical-align: middle;
          background-color: #f8fafc;
          box-sizing: border-box;
          height: 28px !important;
          min-height: 28px !important;
        }

        .grid-footer-cell.can-aggregate {
          cursor: context-menu;
          position: relative;
        }

        .grid-footer-cell.can-aggregate::after {
          content: '⋮';
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          color: #cbd5e1;
          font-size: 10px;
          opacity: 0;
          transition: opacity 0.15s;
        }

        .grid-footer-cell.can-aggregate:hover::after {
          opacity: 1;
        }

        .grid-footer-cell.can-aggregate:hover {
          background-color: #f1f5f9;
        }

        .aggregate-display {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
        }

        .aggregate-label {
          color: #64748b;
          font-weight: 500;
          font-size: 10px;
        }

        .aggregate-value {
          color: #1e40af;
          font-weight: 700;
          font-size: 11px;
        }

        .aggregate-placeholder {
          color: #cbd5e1;
          font-size: 11px;
          display: block;
          text-align: center;
        }

        .aggregate-context-menu {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          min-width: 150px;
          padding: 4px 0;
          animation: fadeIn 0.15s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .context-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          cursor: pointer;
          font-size: 13px;
          color: #374151;
          transition: background-color 0.15s;
        }

        .context-menu-item:hover {
          background-color: #f3f4f6;
        }

        .context-menu-item.selected {
          background-color: #eff6ff;
          color: #1a3799;
        }

        .context-menu-item.selected .context-menu-icon {
          color: #1a3799;
        }

        .context-menu-icon {
          width: 20px;
          text-align: center;
          font-size: 14px;
          color: #6b7280;
        }

        .context-menu-divider {
          height: 1px;
          background-color: #e5e7eb;
          margin: 4px 0;
        }

        /* Dark mode for aggregate context menu */
        .dark .aggregate-context-menu {
          background: #1f2937;
          border-color: #374151;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        }
        .dark .context-menu-item {
          color: #e5e7eb;
        }
        .dark .context-menu-item:hover {
          background-color: #374151;
        }
        .dark .context-menu-item.selected {
          background-color: #1e3a5f;
          color: #60a5fa;
        }
        .dark .context-menu-icon {
          color: #9ca3af;
        }
        .dark .context-menu-divider {
          background-color: #374151;
        }
        .dark .aggregate-placeholder {
          color: #6b7280;
        }
      `}</style>
    </>
  )
}
