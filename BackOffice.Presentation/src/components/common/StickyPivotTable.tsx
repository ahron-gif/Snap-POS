import React, { useMemo } from "react"

/**
 * StickyPivotTable
 * =================
 *
 * A reusable pivot grid for the BackOffice reports. Designed for tables where the
 * **left N columns must remain visible while the right side scrolls horizontally**
 * (e.g. Item Daily Sales: Department / Item / Barcode pinned on the left, one
 * Amount+Qty pair per date scrolling on the right).
 *
 * Important: this is its own component. It does NOT extend, depend on, or modify
 * ServerGrid / ServerDataGrid / any other shared table. Reports that need a
 * sticky-left pivot view should import this directly; ordinary tabular reports
 * keep using ServerGrid as before.
 *
 * How it works
 * ------------
 *  • One real `<table>` inside a single horizontally-scrolling container.
 *  • Sticky columns use `position: sticky; left: <cumulative-offset>`. The
 *    browser handles horizontal scroll natively, so cell alignment is perfect
 *    and there is no JS scroll-syncing to drift.
 *  • The header is `position: sticky; top: 0` so column headers stay visible
 *    while you vertically scroll.
 *  • Rows can be optionally grouped — pass `groupBy` and the component will
 *    insert collapsible group-header rows and per-group subtotal rows.
 *  • Grand-total row pins at the table bottom via a regular `<tfoot>`.
 */

// ----- public types ---------------------------------------------------------

export interface PivotLeftColumn<T> {
  /** Stable react key for the column. */
  key: string
  /** Header text. */
  header: React.ReactNode
  /** Pixel width — required so we can compute sticky `left` offsets. */
  width: number
  /** How to render the cell. Defaults to (row as any)[key]. */
  render?: (row: T) => React.ReactNode
  /** Optional cell className (e.g. dim secondary columns). */
  cellClassName?: string
}

/**
 * One scrolling column-group on the right side. Each group renders a single top
 * header (e.g. "1/8/2020") with N sub-columns underneath (e.g. Amount + Qty).
 *
 * For two-level column hierarchies (e.g. Year > Month in the monthly pivot), set
 * `superGroupKey` + `superGroupHeader` on each group. Consecutive groups sharing the
 * same `superGroupKey` are merged into a single colspan-ed header cell above the
 * group header row. Daily / weekly pivots leave these fields undefined and get the
 * usual two-row header.
 */
export interface PivotRightGroup {
  /** Stable react key for the group. */
  key: string
  /** Top header text shown above the sub-columns. */
  header: React.ReactNode
  /**
   * Optional super-group key. Consecutive groups with the same key are merged into
   * a single header cell that spans them all (e.g. all months of "2025" share
   * `superGroupKey: "2025"` and produce one "2025" cell above them).
   */
  superGroupKey?: string
  /** Label rendered in the merged super-group header. */
  superGroupHeader?: React.ReactNode
  /** Sub-columns under this group header. */
  subs: Array<{
    /** Stable react key for the sub-column. */
    key: string
    /** Sub-column label shown under the group header. */
    label: React.ReactNode
    /** Pixel width of the sub-column. */
    width: number
  }>
}

export interface StickyPivotTableProps<T> {
  /** Pinned left columns (e.g. Department, Item, Barcode). */
  leftColumns: PivotLeftColumn<T>[]
  /** Scrolling right column-groups (one per date in the report). */
  rightGroups: PivotRightGroup[]
  /** Flat list of rows. If `groupBy` is provided, rows will be grouped client-side. */
  rows: T[]

  /** Optional grouping. Returns the group key (e.g. department name) for a row. */
  groupBy?: (row: T) => string

  /**
   * Per-group header label. Default: `${groupKey} (${rows.length} items)`.
   */
  renderGroupHeaderLabel?: (groupKey: string, rows: T[]) => React.ReactNode

  /**
   * Per-group subtotal cell renderer. Called for each (group, rightGroup, sub).
   * Return null/undefined to leave the cell empty.
   */
  renderGroupSubtotal?: (groupKey: string, rows: T[], rg: PivotRightGroup, sub: PivotRightGroup["subs"][number]) => React.ReactNode

  /** Renders the value for a (row, rightGroup, sub) crossing. */
  renderCell: (row: T, rg: PivotRightGroup, sub: PivotRightGroup["subs"][number]) => React.ReactNode

  /** Optional grand-total cell renderer for each (rightGroup, sub). */
  renderGrandTotal?: (rg: PivotRightGroup, sub: PivotRightGroup["subs"][number]) => React.ReactNode
  /** Label printed in the grand-total row inside the left (sticky) area. */
  grandTotalLabel?: React.ReactNode

  /** Optional callback when a body row is double-clicked. */
  onRowDoubleClick?: (row: T) => void

  /**
   * Optional callback when a specific data CELL on the right (scrolling) side is
   * double-clicked. Lets the caller drill down with full column context — e.g. clicking
   * a "TEST 2 / Amount" cell can open another report filtered by both the row's keys
   * AND the cell's department. If onCellDoubleClick is set, it takes precedence over
   * onRowDoubleClick for cells (left-side / group-header / footer clicks still go to
   * onRowDoubleClick if provided).
   */
  onCellDoubleClick?: (row: T, rg: PivotRightGroup, sub: PivotRightGroup["subs"][number]) => void

  /** Empty-state message. */
  emptyMessage?: React.ReactNode
  /** Loading-state flag (shows a thin top bar). */
  loading?: boolean

  /** Default expand/collapse state for groups. Defaults to true (expanded). */
  defaultGroupsExpanded?: boolean
}

// ----- helpers --------------------------------------------------------------

function defaultGroupHeader(groupKey: string, rows: unknown[]): React.ReactNode {
  return (
    <>
      <span className="truncate">{groupKey}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
        ({rows.length} {rows.length === 1 ? "item" : "items"})
      </span>
    </>
  )
}

/** Compute cumulative `left` offsets for sticky left columns. */
function buildLeftOffsets(cols: PivotLeftColumn<unknown>[]): number[] {
  const out: number[] = []
  let acc = 0
  for (const c of cols) {
    out.push(acc)
    acc += c.width
  }
  return out
}

// ----- component ------------------------------------------------------------

function StickyPivotTableInner<T>({
  leftColumns,
  rightGroups,
  rows,
  groupBy,
  renderGroupHeaderLabel,
  renderGroupSubtotal,
  renderCell,
  renderGrandTotal,
  grandTotalLabel = "Grand Total",
  onRowDoubleClick,
  onCellDoubleClick,
  emptyMessage = "No data.",
  loading = false,
  defaultGroupsExpanded = true,
}: StickyPivotTableProps<T>) {
  // Collapsed map — missing key means "use defaultGroupsExpanded".
  const [collapsed, setCollapsed] = React.useState<Record<string, true>>({})
  const toggleGroup = (k: string) =>
    setCollapsed((prev) => {
      const next = { ...prev }
      if (next[k]) delete next[k]
      else next[k] = true
      return next
    })
  const isCollapsed = (k: string) =>
    defaultGroupsExpanded ? !!collapsed[k] : !collapsed[k]

  // Group the rows once (or pass-through if no grouping).
  const groups = useMemo(() => {
    if (!groupBy) return [{ key: "__all", rows }]
    const map = new Map<string, T[]>()
    for (const r of rows) {
      const k = groupBy(r) || "(none)"
      const arr = map.get(k) ?? []
      arr.push(r)
      map.set(k, arr)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, rs]) => ({ key, rows: rs }))
  }, [groupBy, rows])

  const leftOffsets = useMemo(
    () => buildLeftOffsets(leftColumns as PivotLeftColumn<unknown>[]),
    [leftColumns]
  )
  const totalLeftWidth = useMemo(
    () => leftColumns.reduce((s, c) => s + c.width, 0),
    [leftColumns]
  )
  const totalRightSubs = useMemo(
    () => rightGroups.reduce((s, g) => s + g.subs.length, 0),
    [rightGroups]
  )

  // Style helpers --------------------------------------------------------------
  // Tailwind doesn't have dynamic class names for arbitrary left offsets, so we
  // emit inline styles. We DO use Tailwind for the visual look (border / bg).
  const stickyCellStyle = (left: number, isHeader = false): React.CSSProperties => ({
    position: "sticky",
    left,
    // Cells must paint over the scrolling area; header sits even higher.
    zIndex: isHeader ? 30 : 10,
  })

  return (
    <div className="relative w-full h-full rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-brand-500 animate-pulse z-40" />
      )}
      {/* The single scroll container — horizontal AND vertical scroll live here. */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table
          className="border-collapse text-sm"
          // We give the table a minimum width matching the data so the right side
          // is guaranteed to scroll horizontally when needed.
          style={{
            minWidth: totalLeftWidth + rightGroups.reduce((s, g) => s + g.subs.reduce((ss, sub) => ss + sub.width, 0), 0),
          }}
        >
          {/* HEAD —
              2 header rows for the common case (group label + per-sub label).
              3 header rows when at least one group has a superGroupKey (super-group spans
              its consecutive children, then group labels, then sub-column labels).
              Approximate fixed offsets keep the sticky rows aligned without measuring DOM:
                row1 top=0  (~32px), row2 top=32 (~32px), row3 top=64. */}
          {(() => {
            // Compute merged super-group runs once, so we can use the same array for both
            // colspan rendering and for figuring out whether to emit the super-group row.
            const hasSuperGroups = rightGroups.some((g) => !!g.superGroupKey)
            type SuperRun = { key: string; header: React.ReactNode; span: number }
            const superRuns: SuperRun[] = []
            if (hasSuperGroups) {
              let cur: SuperRun | null = null
              for (const g of rightGroups) {
                const k = g.superGroupKey ?? `__solo_${g.key}`
                if (cur && cur.key === k) {
                  cur.span += g.subs.length
                } else {
                  cur = { key: k, header: g.superGroupHeader ?? "", span: g.subs.length }
                  superRuns.push(cur)
                }
              }
            }
            const subRowTop = hasSuperGroups ? 64 : 32
            const groupRowTop = hasSuperGroups ? 32 : 0

            return (
              <thead className="select-none">
                {/* Optional row 0 — super-group headers (Year, etc.) */}
                {hasSuperGroups && (
                  <tr>
                    {leftColumns.map((col, i) => (
                      <th
                        key={`lh-super-${col.key}`}
                        rowSpan={3}
                        style={{
                          ...stickyCellStyle(leftOffsets[i], true),
                          top: 0,
                          width: col.width,
                          minWidth: col.width,
                          maxWidth: col.width,
                        }}
                        className={[
                          "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200",
                          "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide",
                          "border-b border-r border-gray-200 dark:border-gray-700",
                          i === leftColumns.length - 1 ? "border-r-2 border-gray-300 dark:border-gray-600" : "",
                        ].join(" ")}
                      >
                        {col.header}
                      </th>
                    ))}
                    {superRuns.map((run, idx) => (
                      <th
                        key={`rh-super-${run.key}-${idx}`}
                        colSpan={run.span}
                        style={{ position: "sticky", top: 0, zIndex: 25 }}
                        className="bg-gray-200 dark:bg-gray-900 text-gray-800 dark:text-gray-100 px-2 py-2 text-center text-xs font-bold uppercase tracking-wide border-b border-r border-gray-300 dark:border-gray-700"
                      >
                        {run.header}
                      </th>
                    ))}
                  </tr>
                )}

                {/* Row 1 (group headers — Date / Week / Month) */}
                <tr>
                  {!hasSuperGroups && leftColumns.map((col, i) => (
                    <th
                      key={`lh-top-${col.key}`}
                      rowSpan={2}
                      // top sticky + left sticky simultaneously for the corner cell
                      style={{
                        ...stickyCellStyle(leftOffsets[i], true),
                        top: 0,
                        width: col.width,
                        minWidth: col.width,
                        maxWidth: col.width,
                      }}
                      className={[
                        "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200",
                        "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide",
                        "border-b border-r border-gray-200 dark:border-gray-700",
                        i === leftColumns.length - 1 ? "border-r-2 border-gray-300 dark:border-gray-600" : "",
                      ].join(" ")}
                    >
                      {col.header}
                    </th>
                  ))}
                  {rightGroups.map((g) => (
                    <th
                      key={`rh-top-${g.key}`}
                      colSpan={g.subs.length}
                      style={{
                        position: "sticky",
                        top: groupRowTop,
                        zIndex: 20,
                      }}
                      className="bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200 px-2 py-2 text-center text-xs font-semibold border-b border-r border-gray-200 dark:border-gray-700"
                    >
                      {g.header}
                    </th>
                  ))}
                  {rightGroups.length === 0 && (
                    <th
                      className="bg-gray-100 dark:bg-gray-900 text-xs text-gray-400 px-4 py-2"
                      style={{ position: "sticky", top: groupRowTop, zIndex: 20 }}
                    >
                      No date columns
                    </th>
                  )}
                </tr>

                {/* Row 2 — sub-column labels (Amount / Qty / …) */}
                <tr>
                  {rightGroups.map((g) =>
                    g.subs.map((sub) => (
                      <th
                        key={`rh-sub-${g.key}-${sub.key}`}
                        style={{
                          position: "sticky",
                          top: subRowTop,
                          zIndex: 20,
                          width: sub.width,
                          minWidth: sub.width,
                          maxWidth: sub.width,
                        }}
                        className="bg-gray-50 dark:bg-gray-900/70 text-gray-500 dark:text-gray-400 text-[11px] font-medium uppercase tracking-wide px-2 py-1 text-right border-b border-r border-gray-200 dark:border-gray-700"
                      >
                        {sub.label}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
            )
          })()}

          {/* BODY */}
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={leftColumns.length + Math.max(totalRightSubs, 1)}
                  className="px-6 py-10 text-center text-sm text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              groups.map((g) => {
                const showGroupHeader = !!groupBy
                const collapsedNow = showGroupHeader && isCollapsed(g.key)
                return (
                  <React.Fragment key={`grp-${g.key}`}>
                    {showGroupHeader && (
                      <tr
                        className="bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100/70 dark:hover:bg-blue-900/30 cursor-pointer"
                        onClick={() => toggleGroup(g.key)}
                      >
                        {/* The group-header label spans all left columns and is sticky-left so
                            it stays visible during horizontal scroll. */}
                        <td
                          colSpan={leftColumns.length}
                          style={{ ...stickyCellStyle(0), width: totalLeftWidth, minWidth: totalLeftWidth }}
                          className="bg-blue-50 dark:bg-blue-900/20 px-3 py-2 font-medium text-sm text-gray-800 dark:text-gray-100 border-b border-r-2 border-gray-300 dark:border-gray-600"
                        >
                          <span className="inline-flex items-center gap-2">
                            <span className="inline-block w-3 text-center">{collapsedNow ? "▶" : "▼"}</span>
                            {(renderGroupHeaderLabel ?? defaultGroupHeader)(g.key, g.rows)}
                          </span>
                        </td>
                        {/* spacer cells for the right side to keep table structure */}
                        {rightGroups.map((rg) =>
                          rg.subs.map((sub) => (
                            <td
                              key={`grp-spacer-${g.key}-${rg.key}-${sub.key}`}
                              className="bg-blue-50 dark:bg-blue-900/20 border-b border-r border-gray-200 dark:border-gray-700"
                              style={{ width: sub.width, minWidth: sub.width, maxWidth: sub.width }}
                            />
                          ))
                        )}
                      </tr>
                    )}

                    {!collapsedNow &&
                      g.rows.map((r, ri) => (
                        <tr
                          key={`row-${g.key}-${ri}`}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/40"
                          onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(r) : undefined}
                        >
                          {leftColumns.map((col, ci) => {
                            const v = col.render ? col.render(r) : (r as any)?.[col.key]
                            return (
                              <td
                                key={`row-left-${g.key}-${ri}-${col.key}`}
                                style={{
                                  ...stickyCellStyle(leftOffsets[ci]),
                                  width: col.width,
                                  minWidth: col.width,
                                  maxWidth: col.width,
                                }}
                                className={[
                                  // The sticky cell needs a solid background so the scrolling
                                  // cells don't bleed through during horizontal scroll.
                                  "bg-white dark:bg-gray-800 px-3 py-2 truncate text-gray-800 dark:text-gray-100 border-b border-r border-gray-100 dark:border-gray-800",
                                  ci === leftColumns.length - 1 ? "border-r-2 border-gray-300 dark:border-gray-600" : "",
                                  col.cellClassName ?? "",
                                ].join(" ")}
                                title={typeof v === "string" ? v : undefined}
                              >
                                {v ?? ""}
                              </td>
                            )
                          })}
                          {rightGroups.map((rg) =>
                            rg.subs.map((sub) => (
                              <td
                                key={`row-cell-${g.key}-${ri}-${rg.key}-${sub.key}`}
                                className={[
                                  "px-2 py-2 text-right text-gray-700 dark:text-gray-200 border-b border-r border-gray-100 dark:border-gray-800 whitespace-nowrap",
                                  onCellDoubleClick ? "cursor-pointer" : "",
                                ].join(" ")}
                                style={{ width: sub.width, minWidth: sub.width, maxWidth: sub.width }}
                                onDoubleClick={
                                  onCellDoubleClick
                                    ? (e) => {
                                        // Stop the event from bubbling to the row-level handler so cell drill-downs
                                        // don't accidentally also fire the row-level callback.
                                        e.stopPropagation()
                                        onCellDoubleClick(r, rg, sub)
                                      }
                                    : undefined
                                }
                              >
                                {renderCell(r, rg, sub)}
                              </td>
                            ))
                          )}
                        </tr>
                      ))}

                    {showGroupHeader && !collapsedNow && renderGroupSubtotal && (
                      <tr className="bg-gray-50 dark:bg-gray-900/40 font-medium">
                        <td
                          colSpan={leftColumns.length}
                          style={{ ...stickyCellStyle(0), width: totalLeftWidth, minWidth: totalLeftWidth }}
                          className="bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 border-b border-r-2 border-gray-300 dark:border-gray-600"
                        >
                          {g.key} Total
                        </td>
                        {rightGroups.map((rg) =>
                          rg.subs.map((sub) => (
                            <td
                              key={`sub-${g.key}-${rg.key}-${sub.key}`}
                              className="px-2 py-2 text-right text-sm text-gray-800 dark:text-gray-100 border-b border-r border-gray-200 dark:border-gray-700 whitespace-nowrap"
                              style={{ width: sub.width, minWidth: sub.width, maxWidth: sub.width }}
                            >
                              {renderGroupSubtotal(g.key, g.rows, rg, sub)}
                            </td>
                          ))
                        )}
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>

          {/* FOOT — grand total */}
          {renderGrandTotal && rows.length > 0 && (
            <tfoot>
              <tr className="bg-blue-100/70 dark:bg-blue-900/30 font-semibold">
                <td
                  colSpan={leftColumns.length}
                  style={{ ...stickyCellStyle(0), width: totalLeftWidth, minWidth: totalLeftWidth }}
                  className="bg-blue-100/70 dark:bg-blue-900/30 px-3 py-2 text-sm text-gray-900 dark:text-white border-t-2 border-r-2 border-gray-300 dark:border-gray-600"
                >
                  {grandTotalLabel}
                </td>
                {rightGroups.map((rg) =>
                  rg.subs.map((sub) => (
                    <td
                      key={`grand-${rg.key}-${sub.key}`}
                      className="px-2 py-2 text-right text-sm text-gray-900 dark:text-white border-t-2 border-r border-gray-300 dark:border-gray-600 whitespace-nowrap"
                      style={{ width: sub.width, minWidth: sub.width, maxWidth: sub.width }}
                    >
                      {renderGrandTotal(rg, sub)}
                    </td>
                  ))
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// Generic-friendly default export (preserves type inference at call sites).
export const StickyPivotTable = StickyPivotTableInner as <T>(
  props: StickyPivotTableProps<T>
) => React.ReactElement

export default StickyPivotTable
