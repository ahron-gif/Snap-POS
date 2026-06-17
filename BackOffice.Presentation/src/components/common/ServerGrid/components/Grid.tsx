import React, { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { GridProps, SortConfig, FilterConfig, HeaderSearchConfig } from "../types/grid"
import { GridHeader } from "./GridHeader"
import { GridBody, CustomContextMenuItem } from "./GridBody"
import { GridFooter, AggregateType } from "./GridFooter"
import { ColumnChooser } from "./ColumnChooser"
import "./Grid.css"

// ── Default footer aggregate detection ──────────────────────────────────────
// Amount / quantity numeric columns get a "sum" footer aggregate by default so
// users don't have to set it every time (matches the legacy desktop behaviour).
// Percentages/ratios and running balances are deliberately excluded — summing
// them is meaningless. A column can always override this via `defaultAggregate`,
// and a user's own footer choice (loaded from saved grid settings) wins over it.
const AMOUNT_QTY_RE =
  /(amount|\btotal\b|sub.?total|\bqty\b|quantit|\bprice\b|\bcost\b|\btax\b|discount|profit|markup|margin|\bsales\b|revenue|charge|\bfee\b|\bpaid\b|\bdue\b|\bnet\b|gross|extended|\bext\b|on.?hand)/i
const PERCENT_RE = /(%|percent|\bpct\b|\brate\b|ratio)/i

function getDefaultAggregate(col: {
  field?: string
  headerName?: string
  dataType?: string
  type?: string
  defaultAggregate?: AggregateType
}): AggregateType {
  if (col.defaultAggregate) return col.defaultAggregate
  const isNumeric = col.dataType === "number" || col.type === "number" || col.type === "currency"
  if (!isNumeric) return "none"
  const text = `${col.field || ""} ${col.headerName || ""}`
  if (PERCENT_RE.test(text)) return "none"
  return AMOUNT_QTY_RE.test(text) ? "sum" : "none"
}

// Enhanced GridProps to include action handlers
interface EnhancedGridProps extends GridProps {
  onViewAction?: (row: any) => void
  onEditAction?: (row: any) => void
  onDeleteAction?: (row: any) => void
  onSendInviteAction?: (
    row: any,
    showToastCallback: (msg: string, type: "success" | "error" | "info") => void
  ) => void
  onAssignRolesAction?: (row: any) => void
  initialSortConfig?: SortConfig | null
  initialFilterConfig?: FilterConfig
  containerWidth?: string
  onClearAllFilters?: () => void
  // Checkbox selection props
  showCheckboxes?: boolean
  selectedRows?: Set<string>
  onRowSelection?: (rowId: string) => void
  getRowId?: (row: any) => string
  remountKey?: string | number
  onSelectAllFromHeader?: () => void
  onSelectAll?: () => void
  // Header search props
  headerSearch?: boolean
  onHeaderSearch?: (field: string, value: string) => void
  initialHeaderSearchConfig?: HeaderSearchConfig
  // Infinite scroll props
  infiniteScroll?: boolean
  onLoadMore?: () => void
  hasMoreData?: boolean
  loadingMore?: boolean
  // Loading state for search
  isSearching?: boolean
  // Column settings persistence callbacks
  onColumnVisibilityChange?: (field: string, visible: boolean) => void
  onColumnWidthChange?: (field: string, width: number) => void
  onColumnsChange?: (columns: any[]) => void
  // Column aggregates persistence
  initialColumnAggregates?: Map<string, AggregateType>
  onAggregateChange?: (field: string, type: AggregateType) => void
  // Default grouping columns
  defaultGroupByColumns?: Array<{ field: string; headerName: string }>
  // Whether groups should be expanded by default
  defaultGroupsExpanded?: boolean
  // Opt-in subtotal + grand total rows. See ServerGridProps for full doc.
  summaryFields?: string[]
  showGrandTotal?: boolean
  // Custom context menu items
  customContextMenuItems?: CustomContextMenuItem[]
  // Hide default context menu items (View Details, Edit Details, Delete Row)
  hideDefaultContextMenuItems?: boolean
  // Optional: called when a data row is double-clicked (e.g. drill-down)
  onRowDoubleClick?: (row: any) => void
  // Optional: called when a data row is clicked (single click)
  onRowClick?: (row: any) => void
  // Optional: returns a CSS class name for the row based on row data
  getRowClassName?: (row: any) => string
  // Footer stats to display in the records info bar (left side)
  footerStats?: Array<{ label: string; value: string }>
}

// Estimates a reasonable default column width from the header text so columns
// aren't oversized before the user/auto-fit adjusts them. ~8px per character
// (matches the 14px Arial header font) plus padding + room for the sort/menu
// affordances, clamped to a sensible range.
const getResponsiveWidth = (_field: string, headerName: string) => {
  const estimated = Math.ceil((headerName?.length || 0) * 8) + 48
  return Math.max(90, Math.min(estimated, 220))
}

export const Grid: React.FC<EnhancedGridProps> = ({
  data,
  columns: initialColumns,
  onRowUpdate,
  pagination = false,
  pageSize = 10,
  editable = false,
  columnChooser = false,
  onViewAction,
  onEditAction,
  onDeleteAction,
  onSendInviteAction,
  onAssignRolesAction,
  serverSide = false,
  totalRecords = 0,
  currentPage = 1,
  onPageChange,
  onPageSizeChange,
  onSort,
  onFilter,
  onClearAllFilters,
  initialSortConfig,
  initialFilterConfig = {},
  containerWidth = "74%",
  showCheckboxes = false,
  selectedRows = new Set(),
  onRowSelection,
  getRowId = (row) =>
    row.itemStoreID || row.id || row.itemID || row.userId || row.userID,
  remountKey,
  onSelectAllFromHeader,
  headerSearch = false,
  onHeaderSearch,
  initialHeaderSearchConfig = {},
  infiniteScroll = false,
  onLoadMore,
  hasMoreData = false,
  loadingMore = false,
  isSearching = false,
  onColumnVisibilityChange: onColumnVisibilityChangeProp,
  onColumnWidthChange: onColumnWidthChangeProp,
  onColumnsChange: onColumnsChangeProp,
  initialColumnAggregates,
  onAggregateChange: onAggregateChangeProp,
  defaultGroupByColumns = [],
  defaultGroupsExpanded = false,
  summaryFields,
  showGrandTotal = false,
  customContextMenuItems = [],
  hideDefaultContextMenuItems = false,
  onRowDoubleClick,
  onRowClick,
  getRowClassName,
  footerStats,
}) => {
  const [columns, setColumns] = useState(
    initialColumns.map((col) => ({
      ...col,
      visible: col.visible !== false,
      // Default to a header-aware width when none was specified.
      width: col.width || getResponsiveWidth(col.field, col.headerName),
    }))
  )

  // Collapsible top-level header bands (e.g. Tender Totals' Actual Cash / Gift).
  // A band is collapsible when any of its columns sets `groupCollapsible`. When
  // collapsed, every child column of the band is hidden except the one flagged
  // `groupSummary`, so the band shows just its running total.
  const collapsibleGroups = useMemo(() => {
    const set = new Set<string>()
    columns.forEach((c) => {
      if (c.group && c.groupCollapsible) set.add(c.group)
    })
    return set
  }, [columns])

  // Sub-group (row-2 band) collapse, keyed by sub-group label.
  const collapsibleSubGroups = useMemo(() => {
    const set = new Set<string>()
    columns.forEach((c) => {
      if (c.subGroup && c.subGroupCollapsible) set.add(c.subGroup)
    })
    return set
  }, [columns])

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const set = new Set<string>()
    initialColumns.forEach((c) => {
      if (c.group && c.groupCollapsible && c.groupDefaultCollapsed) set.add(c.group)
    })
    return set
  })

  const [collapsedSubGroups, setCollapsedSubGroups] = useState<Set<string>>(() => {
    const set = new Set<string>()
    initialColumns.forEach((c) => {
      if (c.subGroup && c.subGroupCollapsible && c.subGroupDefaultCollapsed) set.add(c.subGroup)
    })
    return set
  })

  const toggleGroupCollapsed = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }, [])

  const toggleSubGroupCollapsed = useCallback((label: string) => {
    setCollapsedSubGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }, [])

  // Columns as they should render given the current collapse state. Children of
  // a collapsed band/sub-band are forced hidden; their summary column stays.
  // Everything downstream (widths, header, body, footer) reads this so header
  // and body stay aligned.
  const displayColumns = useMemo(() => {
    if (collapsedGroups.size === 0 && collapsedSubGroups.size === 0) return columns
    return columns.map((c) => {
      const hiddenByGroup = !!c.group && collapsedGroups.has(c.group) && !c.groupSummary
      const hiddenBySubGroup =
        !!c.subGroup && collapsedSubGroups.has(c.subGroup) && !c.subGroupSummary
      return hiddenByGroup || hiddenBySubGroup ? { ...c, visible: false } : c
    })
  }, [columns, collapsedGroups, collapsedSubGroups])

  // Notify the parent whenever the columns change (reorder, best-fit/autosize,
  // visibility, width) so changes persist. Without this, header-driven changes
  // live only in this component's internal state and are lost whenever the host
  // remounts the grid (e.g. ItemListPage bumps a remountKey on many actions).
  const prevColumnsRef = useRef(columns)
  useEffect(() => {
    if (prevColumnsRef.current === columns) return
    prevColumnsRef.current = columns
    if (onColumnsChangeProp) onColumnsChangeProp(columns)
  }, [columns, onColumnsChangeProp])
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(
    initialSortConfig || null
  )
  const [filterConfig, setFilterConfig] =
    useState<FilterConfig>(initialFilterConfig)
  const [headerSearchConfig, setHeaderSearchConfig] =
    useState<HeaderSearchConfig>(initialHeaderSearchConfig)
  const [localCurrentPage, setLocalCurrentPage] = useState(1)
  const [currentPageSize, setCurrentPageSize] = useState(pageSize)

  // Use server-side page state if available
  const effectiveCurrentPage = serverSide ? currentPage || 1 : localCurrentPage
  const [showColumnChooser, setShowColumnChooser] = useState(false)
  const [groupByColumns, setGroupByColumns] = useState<
    Array<{ field: string; headerName: string }>
  >(defaultGroupByColumns)

  // Auto-defaults: amount/quantity numeric columns → "sum" (unless the column
  // opts out via `defaultAggregate`). Keyed by field; "none" entries are omitted.
  const defaultAggregates = useMemo(() => {
    const map = new Map<string, AggregateType>()
    for (const col of (initialColumns || [])) {
      const def = getDefaultAggregate(col as any)
      if (def !== "none") map.set((col as any).field, def)
    }
    return map
  }, [initialColumns])

  const defaultAggregatesKey = useMemo(
    () => JSON.stringify(Array.from(defaultAggregates.entries()).sort()),
    [defaultAggregates]
  )

  // State for column aggregates (footer calculations): start from the auto
  // defaults, then overlay any saved/user-provided aggregates (which win).
  const [columnAggregates, setColumnAggregates] = useState<Map<string, AggregateType>>(
    () => new Map<string, AggregateType>([...defaultAggregates, ...(initialColumnAggregates || new Map())])
  )

  // Create a stable string representation of initialColumnAggregates for dependency tracking
  const initialAggregatesKey = useMemo(() => {
    if (!initialColumnAggregates || initialColumnAggregates.size === 0) return ''
    return JSON.stringify(Array.from(initialColumnAggregates.entries()).sort())
  }, [initialColumnAggregates])

  // Re-merge whenever the columns (defaults) or the saved aggregates change
  // (e.g. columns load async, or settings arrive from the API). Saved values
  // overlay the defaults so a user's explicit choice always wins.
  useEffect(() => {
    setColumnAggregates(
      new Map<string, AggregateType>([...defaultAggregates, ...(initialColumnAggregates || new Map())])
    )
  }, [defaultAggregatesKey, initialAggregatesKey])

  // Ref for infinite scroll container
  const tableContainerRef = useRef<HTMLDivElement>(null)
  // Sentinel element at the bottom of the table; an IntersectionObserver
  // fires onLoadMore when this enters the viewport. Using IO instead of an
  // onScroll listener works regardless of WHICH element actually scrolls
  // (table container vs. page) — important because the table container's
  // `flex: 1; overflow-y: auto` only scrolls independently when its parent
  // chain has a constrained height, which isn't true on every host page.
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null)
  // Ref for footer aggregation wrapper to sync horizontal scroll
  const footerScrollRef = useRef<HTMLDivElement>(null)
  // Ref for the outermost grid container; used to compute the table's max
  // height (see effect below).
  const gridContainerRef = useRef<HTMLDivElement>(null)
  // Ref for the totals/aggregation footer; we measure its height so the
  // table-container leaves exactly enough viewport space for it to stay
  // visible at the bottom.
  const fixedFooterRef = useRef<HTMLDivElement>(null)

  // Visible inner width of the scroll container. Used to stretch columns to
  // fill the viewport when their combined width is smaller than it (so there's
  // no empty gap on the right), while still allowing a horizontal scrollbar
  // when the columns are genuinely wider than the viewport.
  const [availableWidth, setAvailableWidth] = useState(0)
  useEffect(() => {
    const el = tableContainerRef.current
    if (!el) return
    const update = () => setAvailableWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Effective per-column widths and the table's total width. When the columns
  // fit within the viewport their widths are scaled up proportionally to fill
  // it exactly (no right-hand gap, no scrollbar). When they don't, raw widths
  // are used and the total exceeds the viewport so the container scrolls.
  const { columnWidths, effectiveTotalWidth } = useMemo(() => {
    const visibleCols = displayColumns.filter((col) => col.visible !== false)
    const checkboxW = showCheckboxes ? 50 : 0
    const rawDataTotal = visibleCols.reduce((s, c) => s + (c.width || 95), 0)
    const rawTotal = checkboxW + rawDataTotal
    const widths: Record<string, number> = {}

    if (availableWidth > 0 && rawTotal < availableWidth && rawDataTotal > 0) {
      const target = availableWidth - checkboxW
      const scale = target / rawDataTotal
      let acc = 0
      visibleCols.forEach((c) => {
        const w = Math.floor((c.width || 95) * scale)
        widths[c.field] = w
        acc += w
      })
      // Put the rounding remainder into the last column so the columns sum to
      // exactly the available width.
      const last = visibleCols[visibleCols.length - 1]
      if (last) widths[last.field] += target - acc
      return { columnWidths: widths, effectiveTotalWidth: availableWidth }
    }

    visibleCols.forEach((c) => {
      widths[c.field] = c.width || 95
    })
    return { columnWidths: widths, effectiveTotalWidth: rawTotal }
  }, [displayColumns, showCheckboxes, availableWidth])

  // Force the scrollable table container to fit the viewport so the totals
  // footer below it is ALWAYS visible. The flex chain
  // (`grid-wrapper.flex-col` + `table-container.flex:1`) is supposed to do
  // this, but on host pages where the parent height isn't fully
  // constrained the table simply grows tall and the whole page scrolls —
  // which pushes the totals bar off-screen. This effect overrides that
  // failure mode by directly computing `viewport - table_top - footer`
  // and applying it as max-height. Recomputes on resize and when the
  // footer's own height changes (e.g. it grows when aggregates appear).
  useEffect(() => {
    const tableEl = tableContainerRef.current
    if (!tableEl) return

    const apply = () => {
      const rect = tableEl.getBoundingClientRect()
      const footerH = fixedFooterRef.current?.getBoundingClientRect().height ?? 0
      // 4px buffer to avoid sub-pixel rounding artifacts that could
      // produce a 1px page scrollbar.
      const available = Math.max(120, window.innerHeight - rect.top - footerH - 4)
      tableEl.style.maxHeight = `${available}px`
    }

    apply()

    const ro = new ResizeObserver(apply)
    ro.observe(tableEl)
    if (fixedFooterRef.current) ro.observe(fixedFooterRef.current)
    if (gridContainerRef.current) ro.observe(gridContainerRef.current)
    window.addEventListener("resize", apply)

    return () => {
      ro.disconnect()
      window.removeEventListener("resize", apply)
    }
  }, [])
  // Ref to track previous scroll left position to detect horizontal scroll
  const lastScrollLeftRef = useRef<number>(0)
  // Flag to prevent infinite scroll sync loop
  const isScrollingSyncRef = useRef<boolean>(false)

  // Infinite scroll handler - only triggers on vertical scroll, not horizontal
  const handleInfiniteScroll = useCallback(() => {
    if (!infiniteScroll || !onLoadMore || loadingMore || !hasMoreData) return

    const container = tableContainerRef.current
    if (!container) return

    const { scrollTop, scrollLeft, scrollHeight, clientHeight } = container

    // Check if this is a horizontal scroll only (scrollLeft changed)
    const scrollLeftChanged = scrollLeft !== lastScrollLeftRef.current
    lastScrollLeftRef.current = scrollLeft

    // If only horizontal scrolling (scrollLeft changed but we're at top), don't trigger load more
    if (scrollLeftChanged && scrollTop < 10) {
      return
    }

    const scrollThreshold = 100 // pixels from bottom to trigger load
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight

    if (distanceFromBottom < scrollThreshold) {
      onLoadMore()
    }
  }, [infiniteScroll, onLoadMore, loadingMore, hasMoreData])

  // Sync horizontal scroll between main table and footer
  const handleTableScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isScrollingSyncRef.current) return

    const target = e.currentTarget
    if (footerScrollRef.current) {
      isScrollingSyncRef.current = true
      footerScrollRef.current.scrollLeft = target.scrollLeft
      setTimeout(() => {
        isScrollingSyncRef.current = false
      }, 10)
    }

    // Also handle infinite scroll if enabled
    if (infiniteScroll) {
      handleInfiniteScroll()
    }
  }, [infiniteScroll, handleInfiniteScroll])

  // Sync footer scroll back to main table
  const handleFooterScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isScrollingSyncRef.current) return

    const target = e.currentTarget
    if (tableContainerRef.current) {
      isScrollingSyncRef.current = true
      tableContainerRef.current.scrollLeft = target.scrollLeft
      setTimeout(() => {
        isScrollingSyncRef.current = false
      }, 10)
    }
  }, [])

  // Infinite-scroll trigger via IntersectionObserver on a bottom sentinel.
  //
  // Why not just rely on the onScroll handler attached to the table container?
  // Because that container's `flex: 1; overflow-y: auto` only produces an
  // independent scrollbar when its parent chain has a constrained height.
  // On pages where the parent lets content flow (the common case here), the
  // *page* scrolls — not the container — so the container's `onScroll` event
  // never fires and infinite scroll silently breaks. The previous code masked
  // this by greedily auto-fetching pages until the table grew taller than the
  // viewport (a runaway loop). IO observes the sentinel against the viewport
  // by default, so it works whichever element actually scrolls.
  useEffect(() => {
    if (!infiniteScroll || !onLoadMore || !hasMoreData || loadingMore) return
    const sentinel = loadMoreSentinelRef.current
    if (!sentinel) return
    // Skip the very first paint (no data yet) — wait for the initial fetch
    // to land so we don't immediately request page 2 before page 1 renders.
    if (data.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) {
          onLoadMore()
        }
      },
      {
        // Fire a bit before the sentinel actually reaches the viewport so the
        // next page is in flight by the time the user hits the bottom.
        rootMargin: "200px",
        threshold: 0,
      },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [infiniteScroll, onLoadMore, hasMoreData, loadingMore, data.length])

  // Update filter config when initial filter config changes
  // Use JSON comparison to avoid unnecessary updates from object reference changes
  const initialFilterConfigStr = useMemo(() => JSON.stringify(initialFilterConfig), [initialFilterConfig])
  React.useEffect(() => {
    const parsedConfig = JSON.parse(initialFilterConfigStr)
    if (parsedConfig && Object.keys(parsedConfig).length > 0) {
      console.log("Updating filter config from props:", parsedConfig)
      setFilterConfig(parsedConfig)
    }
  }, [initialFilterConfigStr])

  // Listen for group by events and column resize events
  React.useEffect(() => {
    const handleGroupByColumn = (event: CustomEvent) => {
      const { field, headerName } = event.detail
      setGroupByColumns((prev) => {
        // Check if column is already grouped
        if (prev.some((col) => col.field === field)) {
          return prev
        }
        return [...prev, { field, headerName }]
      })

      // Hide the column from the grid when added to group by
      handleColumnVisibilityChange(field, false)
    }

    const handleColumnResize = (event: CustomEvent) => {
      const { field, width } = event.detail
      setColumns((prev) =>
        prev.map((col) => (col.field === field ? { ...col, width } : col))
      )
      // Also call the specific width change callback
      if (onColumnWidthChangeProp) {
        onColumnWidthChangeProp(field, width)
      }
    }

    window.addEventListener(
      "groupByColumn",
      handleGroupByColumn as EventListener
    )
    document.addEventListener(
      "columnResize",
      handleColumnResize as EventListener
    )

    return () => {
      window.removeEventListener(
        "groupByColumn",
        handleGroupByColumn as EventListener
      )
      document.removeEventListener(
        "columnResize",
        handleColumnResize as EventListener
      )
    }
  }, [onColumnsChangeProp, onColumnWidthChangeProp])

  const filteredData = useMemo(() => {
    return data.filter((row) => {
      // First apply header search filtering (simple contains search)
      const passesHeaderSearch = Object.entries(headerSearchConfig).every(
        ([field, searchValue]) => {
          if (!searchValue || searchValue.trim() === "") return true
          const cellValue = row[field]?.toString().toLowerCase() || ""
          return cellValue.includes(searchValue.toLowerCase().trim())
        }
      )

      if (!passesHeaderSearch) return false

      // Then apply advanced filter conditions
      return Object.entries(filterConfig).every(([field, filter]) => {
        if (!filter?.conditions || filter.conditions.length === 0) return true

        const cellValue = row[field]?.toString().toLowerCase() || ""

        const evaluateCondition = (condition: any) => {
          const column = columns.find((col) => col.field === field)
          const originalValue = row[field]
          const filterValue = condition.value

          // Handle blank/not blank operators
          if (condition.operator === "blank") {
            return (
              originalValue == null ||
              originalValue === "" ||
              originalValue === undefined
            )
          }
          if (condition.operator === "notBlank") {
            return (
              originalValue != null &&
              originalValue !== "" &&
              originalValue !== undefined
            )
          }

          // Handle numeric operators
          if (column?.dataType === "number") {
            const numValue = Number(originalValue)
            const numFilterValue = Number(filterValue)

            if (isNaN(numValue) || isNaN(numFilterValue)) {
              return false
            }

            switch (condition.operator) {
              case "equals":
                return numValue === numFilterValue
              case "notEquals":
                return numValue !== numFilterValue
              case "greaterThan":
                return numValue > numFilterValue
              case "greaterThanOrEqual":
                return numValue >= numFilterValue
              case "lessThan":
                return numValue < numFilterValue
              case "lessThanOrEqual":
                return numValue <= numFilterValue
              default:
                return false
            }
          }

          // Handle date, time, and datetime operators
          if (
            column?.dataType === "date" ||
            column?.dataType === "time" ||
            column?.dataType === "datetime"
          ) {
            const dateValue = new Date(originalValue)
            const filterDateValue = new Date(filterValue)

            if (
              isNaN(dateValue.getTime()) ||
              isNaN(filterDateValue.getTime())
            ) {
              return false
            }

            switch (condition.operator) {
              case "equals":
                return dateValue.getTime() === filterDateValue.getTime()
              case "notEquals":
                return dateValue.getTime() !== filterDateValue.getTime()
              case "greaterThan":
                return dateValue.getTime() > filterDateValue.getTime()
              case "greaterThanOrEqual":
                return dateValue.getTime() >= filterDateValue.getTime()
              case "lessThan":
                return dateValue.getTime() < filterDateValue.getTime()
              case "lessThanOrEqual":
                return dateValue.getTime() <= filterDateValue.getTime()
              default:
                return false
            }
          }

          // Handle boolean operators
          if (column?.dataType === "boolean") {
            const boolValue = Boolean(originalValue)
            const filterBoolValue = filterValue.toLowerCase() === "true"

            switch (condition.operator) {
              case "equals":
                return boolValue === filterBoolValue
              case "notEquals":
                return boolValue !== filterBoolValue
              default:
                return false
            }
          }

          // Handle string operators (default)
          switch (condition.operator) {
            case "contains":
              return cellValue.includes(filterValue.toLowerCase())
            case "notContains":
              return !cellValue.includes(filterValue.toLowerCase())
            case "equals":
              return cellValue === filterValue.toLowerCase()
            case "notEquals":
              return cellValue !== filterValue.toLowerCase()
            case "startsWith":
              return cellValue.startsWith(filterValue.toLowerCase())
            case "endsWith":
              return cellValue.endsWith(filterValue.toLowerCase())
            case "like":
              const likeRegex = new RegExp(
                filterValue.toLowerCase().replace(/\*/g, ".*"),
                "i"
              )
              return likeRegex.test(cellValue)
            case "notLike":
              const notLikeRegex = new RegExp(
                filterValue.toLowerCase().replace(/\*/g, ".*"),
                "i"
              )
              return !notLikeRegex.test(cellValue)
            default:
              return false
          }
        }

        if (filter.logic === "OR") {
          return filter.conditions.some(evaluateCondition)
        } else {
          return filter.conditions.every(evaluateCondition)
        }
      })
    })
  }, [data, filterConfig, headerSearchConfig])

  const groupedData = useMemo(() => {
    // Helper — sum the configured summary fields over a slice of rows.
    // Coerces any non-numeric / null cells to 0 so a partial dataset
    // never explodes with NaN totals.
    const sumFields = (rows: any[]) => {
      const totals: Record<string, number> = {}
      if (!summaryFields || summaryFields.length === 0) return totals
      for (const f of summaryFields) totals[f] = 0
      for (const row of rows) {
        for (const f of summaryFields) {
          const v = row[f]
          const n = typeof v === "number" ? v : Number(v)
          if (!Number.isNaN(n) && Number.isFinite(n)) totals[f] += n
        }
      }
      return totals
    }

    // Path 1 — no grouping. Only emit a grand-total row at the end
    // if the host opted into showGrandTotal AND gave us fields to sum.
    if (groupByColumns.length === 0) {
      if (showGrandTotal && summaryFields && summaryFields.length > 0 && filteredData.length > 0) {
        return [
          ...filteredData,
          {
            __isGrandTotal: true,
            __totals: sumFields(filteredData),
          },
        ]
      }
      return filteredData
    }

    // Path 2 — grouped. Bucket rows by group key, then weave together
    // group header + rows + (optional) group footer subtotal.
    const groups: { [key: string]: any[] } = {}
    filteredData.forEach((row) => {
      const groupKey = groupByColumns
        .map((col) => row[col.field] || "Unknown")
        .join(" | ")
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(row)
    })

    const wantSummary = !!summaryFields && summaryFields.length > 0
    const result: any[] = []
    Object.entries(groups).forEach(([groupKey, groupRows]) => {
      // Group header (existing behaviour)
      result.push({
        __isGroupHeader: true,
        __groupKey: groupKey,
        __groupCount: groupRows.length,
        __groupColumns: groupByColumns,
      })
      // Group rows
      result.push(...groupRows)
      // Group footer subtotal — opt-in via summaryFields. Mirrors
      // legacy desktop "{Store} Total" band under each store group
      // in the Tax-By-Store and Tax-Collected reports.
      if (wantSummary) {
        result.push({
          __isGroupFooter: true,
          __groupKey: groupKey,
          __groupColumns: groupByColumns,
          __totals: sumFields(groupRows),
        })
      }
    })

    // Grand total row at the very bottom. Opt-in via showGrandTotal.
    if (showGrandTotal && wantSummary && filteredData.length > 0) {
      result.push({
        __isGrandTotal: true,
        __totals: sumFields(filteredData),
      })
    }

    return result
  }, [filteredData, groupByColumns, summaryFields, showGrandTotal])

  const sortedData = useMemo(() => {
    if (!sortConfig) return groupedData

    return [...groupedData].sort((a, b) => {
      // Don't sort group headers / footers / grand-total pseudo-rows
      if (a.__isGroupHeader || b.__isGroupHeader) return 0
      if (a.__isGroupFooter || b.__isGroupFooter) return 0
      if (a.__isGrandTotal || b.__isGrandTotal) return 0

      const aValue = a[sortConfig.field]
      const bValue = b[sortConfig.field]

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1
      return 0
    })
  }, [groupedData, sortConfig])

  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData

    // For server-side pagination, data is already paginated
    if (serverSide) return sortedData

    const startIndex = (effectiveCurrentPage - 1) * currentPageSize
    const endIndex = startIndex + currentPageSize
    return sortedData.slice(startIndex, endIndex)
  }, [
    sortedData,
    effectiveCurrentPage,
    currentPageSize,
    pagination,
    serverSide,
  ])

  const handleSort = (field: string, preventApiCall: boolean = false) => {
    // Don't trigger sorting if this is called during a resize operation
    if (preventApiCall) {
      return
    }

    if (serverSide && onSort) {
      // For server-side sorting, delegate to parent
      const newDirection =
        sortConfig?.field === field
          ? sortConfig.direction === "asc"
            ? "desc"
            : null
          : "asc"
      onSort(field, newDirection)
      setSortConfig(newDirection ? { field, direction: newDirection } : null)
    } else {
      // Client-side sorting
      setSortConfig((prevSort) => {
        if (prevSort?.field === field) {
          return prevSort.direction === "asc"
            ? { field, direction: "desc" }
            : null
        }
        return { field, direction: "asc" }
      })
    }
  }

  const handleFilter = (field: string, conditions: any[], logic: any) => {
    // Update local filter config first
    setFilterConfig((prev) => {
      const newConfig = { ...prev }
      if (conditions.length > 0) {
        newConfig[field] = { conditions, logic }
      } else {
        delete newConfig[field]
      }
      return newConfig
    })

    if (serverSide && onFilter) {
      // For server-side filtering, delegate to parent
      onFilter(field, conditions, logic)
    }

    if (!serverSide) {
      setLocalCurrentPage(1)
    }
  }

  const handleColumnVisibilityChange = (field: string, visible: boolean) => {
    setColumns((prev) =>
      prev.map((col) => (col.field === field ? { ...col, visible } : col))
    )
    // Also call the specific visibility change callback
    if (onColumnVisibilityChangeProp) {
      onColumnVisibilityChangeProp(field, visible)
    }
  }

  // Handle aggregate type change for a column
  const handleAggregateChange = useCallback((field: string, type: AggregateType) => {
    console.log(`[Grid] handleAggregateChange: field=${field}, type=${type}`)
    setColumnAggregates((prev) => {
      const newMap = new Map(prev)
      if (type === "none") {
        newMap.delete(field)
      } else {
        newMap.set(field, type)
      }
      return newMap
    })
    // Notify parent for persistence
    console.log(`[Grid] Calling onAggregateChangeProp:`, !!onAggregateChangeProp)
    if (onAggregateChangeProp) {
      onAggregateChangeProp(field, type)
    }
  }, [onAggregateChangeProp])

  const handleHeaderSearch = useCallback(
    (field: string, value: string) => {
      // Update local header search config
      setHeaderSearchConfig((prev) => {
        const newConfig = { ...prev }
        if (value.trim()) {
          newConfig[field] = value
        } else {
          delete newConfig[field]
        }
        return newConfig
      })

      // If server-side and callback provided, delegate to parent
      if (serverSide && onHeaderSearch) {
        onHeaderSearch(field, value)
      }

      // Reset to first page when searching
      if (!serverSide) {
        setLocalCurrentPage(1)
      }
    },
    [serverSide, onHeaderSearch]
  )

  const handleRemoveGroupBy = (field: string) => {
    setGroupByColumns((prev) => prev.filter((col) => col.field !== field))
    // Show the column back in the grid when removed from group by
    handleColumnVisibilityChange(field, true)
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setCurrentPageSize(newPageSize)

    if (serverSide && onPageSizeChange) {
      onPageSizeChange(newPageSize)
    } else {
      setLocalCurrentPage(1) // Reset to first page when changing page size
    }
  }

  const totalPages = serverSide
    ? Math.ceil((totalRecords || 0) / currentPageSize)
    : Math.ceil(sortedData.length / currentPageSize)

  // Real data-row count for the footer "of N records" display. Excludes the
  // injected group-header / group-footer / grand-total pseudo-rows so grouped
  // grids don't over-count (the header/API count only counts data rows).
  const dataRowCount = sortedData.filter(
    (row: any) => !row.__isGroupHeader && !row.__isGroupFooter && !row.__isGrandTotal
  ).length

  // Enhanced checkbox selection logic using itemStoreID directly.
  // Exclude every pseudo-row (group header / group footer subtotal /
  // grand total) so checkboxes and "select all" only operate on real
  // data rows.
  const currentPageData = paginatedData.filter(
    (row) => !row.__isGroupHeader && !row.__isGroupFooter && !row.__isGrandTotal
  )

  // Get itemStoreIDs for current page rows
  const currentPageRowIds = currentPageData.map(
    (row) => getRowId(row) || `fallback_${Math.random()}`
  )
  const selectedPageRows = currentPageRowIds.filter((id) =>
    selectedRows.has(id)
  )
  const isAllSelected =
    currentPageRowIds.length > 0 &&
    selectedPageRows.length === currentPageRowIds.length
  const isIndeterminate =
    selectedPageRows.length > 0 &&
    selectedPageRows.length < currentPageRowIds.length

  const handleSelectAll = () => {
    if (!onRowSelection) return

    if (isAllSelected) {
      // Deselect all rows on current page
      currentPageRowIds.forEach((id) => {
        if (selectedRows.has(id)) {
          onRowSelection(id)
        }
      })
    } else {
      // Select all rows on current page
      currentPageRowIds.forEach((id) => {
        if (!selectedRows.has(id)) {
          onRowSelection(id)
        }
      })
    }
  }

  // Function to select all rows across all pages (for the ActionHeader's Select All button)
  const handleSelectAllRows = useCallback(() => {
    if (!onRowSelection) return

    // Get all row IDs from all data (not just current page). Exclude
    // every pseudo-row so summary bands never get "selected".
    const allRowIds = data
      .filter((row) => !row.__isGroupHeader && !row.__isGroupFooter && !row.__isGrandTotal)
      .map((row) => getRowId(row) || `fallback_${Math.random()}`)

    console.log("Selecting all rows:", allRowIds.length, "rows")

    // Select all rows that are not already selected
    allRowIds.forEach((id) => {
      if (!selectedRows.has(id)) {
        onRowSelection(id)
      }
    })
  }, [data, selectedRows, onRowSelection, getRowId])

  // Attractive Icon Components
  const ViewIcon = () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )

  const EditIcon = () => (
    <svg
      width="14"
      height="14"
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
  )

  const DeleteIcon = () => (
    <svg
      width="14"
      height="14"
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
  )

  const RolesIcon = () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )

  const ActionButtons: React.FC<{ row: any }> = ({ row }) => {
    const actionBtnStyle: React.CSSProperties = {
      padding: "5px",
      borderRadius: "6px",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.2s ease",
      minWidth: "28px",
      minHeight: "28px",
    }

    return (
      <div
        className="action-buttons-container"
        style={{
          display: "flex",
          gap: "4px",
          justifyContent: "center",
          alignItems: "center",
          padding: "0 4px",
        }}
      >
        {onViewAction && (
          <button
            className="action-button action-button-view"
            onClick={(e) => {
              e.stopPropagation()
              onViewAction(row)
            }}
            title="View details"
            style={actionBtnStyle}
          >
            <ViewIcon />
          </button>
        )}
        {onEditAction && (
          <button
            className="action-button action-button-edit"
            onClick={(e) => {
              e.stopPropagation()
              onEditAction(row)
            }}
            title="Edit record"
            style={actionBtnStyle}
          >
            <EditIcon />
          </button>
        )}
        {onAssignRolesAction && (
          <button
            className="action-button action-button-roles"
            onClick={(e) => {
              e.stopPropagation()
              onAssignRolesAction(row)
            }}
            title="Assign Roles"
            style={actionBtnStyle}
          >
            <RolesIcon />
          </button>
        )}
        {onDeleteAction && (
          <button
            className="action-button action-button-delete"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteAction(row)
            }}
            title="Delete record"
            style={actionBtnStyle}
          >
            <DeleteIcon />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      className="grid-container"
      ref={gridContainerRef}
      onDragStart={() => {
        // Show drag area when a column header starts being dragged
        const dragArea = document.querySelector('.grid-drag-area')
        if (dragArea) dragArea.classList.add('drag-active')
      }}
      onDragEnd={() => {
        // Hide drag area when drag ends (if no groups/filters)
        const dragArea = document.querySelector('.grid-drag-area')
        if (dragArea) dragArea.classList.remove('drag-active')
      }}
      onDragOver={(e) => {
        // Check if we're outside the grid table area
        const gridTable = document.querySelector(".grid-table")
        if (gridTable) {
          const rect = gridTable.getBoundingClientRect()
          const isOutside =
            e.clientY < rect.top ||
            e.clientY > rect.bottom ||
            e.clientX < rect.left ||
            e.clientX > rect.right

          if (isOutside) {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
          }
        }
      }}
      onDrop={(e) => {
        // Check if we're outside the grid table area
        const gridTable = document.querySelector(".grid-table")
        if (gridTable) {
          const rect = gridTable.getBoundingClientRect()
          const isOutside =
            e.clientY < rect.top ||
            e.clientY > rect.bottom ||
            e.clientX < rect.left ||
            e.clientX > rect.right

          if (isOutside) {
            e.preventDefault()
            const draggedField = e.dataTransfer.getData("text/plain")

            if (draggedField) {
              handleColumnVisibilityChange(draggedField, false)
            }
          }
        }
      }}
    >
      <div
        className="grid-wrapper"
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : 'white',
          margin: "0",
          padding: "0",
        }}
      >
        <div
          className={`grid-drag-area${groupByColumns.length > 0 ? ' has-groups' : ''}${Object.keys(filterConfig).length > 0 ? ' has-filters' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            e.currentTarget.classList.add("drag-over")
          }}
          onDragLeave={(e) => {
            // Only remove drag-over if we're actually leaving the drop zone
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              e.currentTarget.classList.remove("drag-over")
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            e.currentTarget.classList.remove("drag-over")

            // Try to get column data from different data transfer types
            let columnData = null

            try {
              const columnJson = e.dataTransfer.getData("application/column")
              if (columnJson) {
                columnData = JSON.parse(columnJson)
              }
            } catch (error) {
              // Fallback to plain text
              const draggedField = e.dataTransfer.getData("text/plain")
              const draggedColumn = columns.find(
                (col) => col.field === draggedField
              )
              if (draggedColumn) {
                columnData = {
                  field: draggedField,
                  headerName: draggedColumn.headerName,
                }
              }
            }

            if (columnData) {
              setGroupByColumns((prev) => {
                // Check if column is already grouped
                if (prev.some((col) => col.field === columnData.field)) {
                  return prev
                }
                return [
                  ...prev,
                  {
                    field: columnData.field,
                    headerName: columnData.headerName,
                  },
                ]
              })

              // Hide the column from the grid when added to group by
              handleColumnVisibilityChange(columnData.field, false)
            }
          }}
        >
          {groupByColumns.length === 0 &&
          Object.keys(filterConfig).length === 0 ? (
            <>
              <span className="drag-icon">☰</span>
              <span className="drag-text">Drag here to set row groups</span>
            </>
          ) : (
            <div className="drag-area-groups">
              <span className="drag-icon">☰</span>

              {/* Show group by columns */}
              {groupByColumns.length > 0 && (
                <>
                  <span className="drag-text">Row groups:</span>
                  {groupByColumns.map((col) => (
                    <div key={col.field} className="drag-area-group-tag">
                      <span>{col.headerName}</span>
                      <button
                        className="drag-area-group-remove"
                        onClick={() => handleRemoveGroupBy(col.field)}
                        title={`Remove ${col.headerName} grouping`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </>
              )}

              {/* Show active filters */}
              {Object.keys(filterConfig).length > 0 && (
                <>
                  <span
                    className="drag-text"
                    style={{
                      marginLeft: groupByColumns.length > 0 ? "12px" : "0",
                    }}
                  >
                    Active filters:
                  </span>
                  {Object.entries(filterConfig).map(([field, config]) => {
                    const column = columns.find((col) => col.field === field)
                    const activeConditions =
                      config?.conditions?.filter(
                        (c) => c.value && c.value.trim() !== ""
                      ) || []

                    if (activeConditions.length === 0) return null

                    return (
                      <div
                        key={field}
                        className="drag-area-group-tag"
                        style={{ backgroundColor: "#1e40af" }}
                      >
                        <span style={{ color: "white" }}>
                          {column?.headerName || field}:{" "}
                          {activeConditions.length} filter
                          {activeConditions.length > 1 ? "s" : ""}
                        </span>
                        <button
                          className="drag-area-group-remove"
                          onClick={() => handleFilter(field, [], "AND")}
                          title={`Remove ${column?.headerName || field} filter`}
                          style={{ color: "white" }}
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </>
              )}

              {/* Clear all button */}
              {(groupByColumns.length > 0 ||
                Object.keys(filterConfig).length > 0) && (
                <button
                  className="drag-area-clear-all"
                  onClick={() => {
                    // Show all grouped columns back in the grid
                    groupByColumns.forEach((col) => {
                      handleColumnVisibilityChange(col.field, true)
                    })
                    setGroupByColumns([])

                    // Clear all filters
                    if (serverSide && onClearAllFilters) {
                      onClearAllFilters()
                    } else {
                      Object.keys(filterConfig).forEach((field) => {
                        handleFilter(field, [], "AND")
                      })
                    }
                  }}
                  title="Clear all grouping and filters"
                >
                  Clear All
                </button>
              )}
            </div>
          )}
        </div>

        {/* Grid Table Container with Scrolling */}
        <div
          className="grid-table-container"
          ref={tableContainerRef}
          onScroll={handleTableScroll}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "auto",
          }}
        >
          {/* Render the table at its effective width (see effectiveTotalWidth) */}
          {(() => {
            const visibleCols = displayColumns.filter((col) => col.visible !== false)
            return (
              <table
                className="grid-table fixed-layout"
                style={{
                  width: effectiveTotalWidth,
                  minWidth: effectiveTotalWidth,
                  tableLayout: "fixed",
                }}
              >
                {/* Colgroup to define column widths for consistent alignment */}
                <colgroup>
                  {showCheckboxes && <col style={{ width: 50 }} />}
                  {visibleCols.map((col) => (
                    <col
                      key={col.field}
                      style={{ width: columnWidths[col.field] }}
                    />
                  ))}
                </colgroup>
            <GridHeader
              columns={displayColumns}
              sortConfig={sortConfig}
              filterConfig={filterConfig}
              onSort={handleSort}
              onFilter={handleFilter}
              onColumnVisibilityChange={handleColumnVisibilityChange}
              setSortConfig={setSortConfig}
              setColumns={setColumns}
              showColumnChooser={columnChooser}
              showCheckboxes={showCheckboxes}
              isAllSelected={isAllSelected}
              isIndeterminate={isIndeterminate}
              onSelectAll={handleSelectAll}
              headerSearch={headerSearch}
              headerSearchConfig={headerSearchConfig}
              onHeaderSearch={handleHeaderSearch}
              isSearching={isSearching}
              collapsibleGroups={collapsibleGroups}
              collapsedGroups={collapsedGroups}
              onToggleGroupCollapsed={toggleGroupCollapsed}
              collapsibleSubGroups={collapsibleSubGroups}
              collapsedSubGroups={collapsedSubGroups}
              onToggleSubGroupCollapsed={toggleSubGroupCollapsed}
            />
            <GridBody
              data={paginatedData}
              columns={displayColumns}
              editable={editable}
              onRowUpdate={onRowUpdate}
              showColumnChooser={columnChooser}
              ActionButtons={ActionButtons}
              showCheckboxes={showCheckboxes}
              selectedRows={selectedRows}
              onRowSelection={onRowSelection}
              getRowId={getRowId}
              onEditAction={onEditAction}
              onDeleteAction={onDeleteAction}
              onViewAction={onViewAction}
              onSendInviteAction={onSendInviteAction}
              headerSearchConfig={headerSearchConfig}
              defaultGroupsExpanded={defaultGroupsExpanded}
              customContextMenuItems={customContextMenuItems}
              hideDefaultContextMenuItems={hideDefaultContextMenuItems}
              onRowDoubleClick={onRowDoubleClick}
              onRowClick={onRowClick}
              getRowClassName={getRowClassName}
            />
              </table>
            )
          })()}
          {/* IntersectionObserver sentinel for infinite-scroll auto-fetch.
              Sits at the bottom of the scrollable table container. Height 1px
              so it doesn't add visible space. Only rendered when infinite
              scroll is enabled. */}
          {infiniteScroll && hasMoreData && (
            <div
              ref={loadMoreSentinelRef}
              aria-hidden="true"
              style={{ height: 1, width: "100%" }}
            />
          )}

          {/* Infinite-scroll loading indicator and end-of-list message both
              live INSIDE the scroll container, immediately after the table.
              This keeps the totals/footer bar pinned at the bottom of the
              grid wrapper: when "Loading more items…" appears it shows as
              an inline strip below the last row (and scrolls with the
              table) instead of being a sibling that displaces the footer.
              Without this the totals row visibly jumps every time the
              next page request fires. */}
          {infiniteScroll && loadingMore && (
            <div className="infinite-scroll-loader">
              <div className="infinite-scroll-loader-bar"></div>
              <div className="infinite-scroll-loader-content">
                <div className="loader-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span className="loader-text">Loading more items...</span>
              </div>
            </div>
          )}

          {infiniteScroll && !hasMoreData && data.length > 0 && (
            <div className="infinite-scroll-end">
              <span>No more items to load</span>
            </div>
          )}
        </div>

        {/* Fixed Footer Section - Aggregation + Records Info */}
        <div className="grid-fixed-footer" ref={fixedFooterRef}>
          {/* Footer Aggregation Row */}
          <div
            className="grid-footer-aggregation-wrapper"
            ref={footerScrollRef}
            onScroll={handleFooterScroll}
          >
            {/* Match the main grid's effective widths so columns stay aligned */}
            {(() => {
              const visibleCols = displayColumns.filter((col) => col.visible !== false)
              return (
                <table
                  className="grid-footer-table"
                  style={{
                    // Mirror the main table's width strategy exactly so
                    // footer/aggregate cells stay aligned with their columns
                    // (the wrapper is synced via scrollLeft).
                    width: effectiveTotalWidth,
                    minWidth: effectiveTotalWidth,
                    tableLayout: "fixed",
                  }}
                >
                  {/* Match the exact colgroup structure of the main grid table */}
                  <colgroup>
                    {showCheckboxes && <col style={{ width: 50 }} />}
                    {visibleCols.map((col) => (
                      <col
                        key={`footer-col-${col.field}`}
                        style={{ width: columnWidths[col.field] }}
                      />
                    ))}
                  </colgroup>
                  <GridFooter
                    columns={displayColumns}
                    data={serverSide ? data : paginatedData}
                    showCheckboxes={showCheckboxes}
                    columnAggregates={columnAggregates}
                    onAggregateChange={handleAggregateChange}
                  />
                </table>
              )
            })()}
          </div>

          {/* Records Info Bar - Shows below footer aggregation for both pagination and infinite scroll */}
          {(pagination || infiniteScroll) && (
            <div className="grid-records-info-bar">
              <div className="records-info-left">
                {footerStats && footerStats.length > 0 ? (
                  <div className="footer-stats-inline">
                    {footerStats.map((stat, i) => (
                      <div key={i} className="footer-stat-item">
                        <span className="footer-stat-label">{stat.label}</span>
                        <span className="footer-stat-value">{stat.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="records-info-text">
                    {infiniteScroll ? (
                      <>Showing <strong>{data.length}</strong> of <strong>{serverSide ? totalRecords || 0 : dataRowCount}</strong> records</>
                    ) : (
                      <>Showing {((effectiveCurrentPage - 1) * currentPageSize) + 1} to {Math.min(effectiveCurrentPage * currentPageSize, serverSide ? totalRecords || 0 : dataRowCount)} of {serverSide ? totalRecords || 0 : dataRowCount} records</>
                    )}
                  </span>
                )}
              </div>
              {!infiniteScroll && (
                <div className="records-info-center">
                  <div className="page-navigation">
                    <button
                      className="page-nav-btn"
                      onClick={() => (serverSide && onPageChange ? onPageChange(1) : setLocalCurrentPage(1))}
                      disabled={effectiveCurrentPage === 1}
                      title="First Page"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="11 17 6 12 11 7"></polyline>
                        <polyline points="18 17 13 12 18 7"></polyline>
                      </svg>
                    </button>
                    <button
                      className="page-nav-btn"
                      onClick={() => (serverSide && onPageChange ? onPageChange(effectiveCurrentPage - 1) : setLocalCurrentPage(effectiveCurrentPage - 1))}
                      disabled={effectiveCurrentPage === 1}
                      title="Previous Page"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                      </svg>
                    </button>
                    <span className="page-info">
                      Page <strong>{effectiveCurrentPage}</strong> of <strong>{totalPages || 1}</strong>
                    </span>
                    <button
                      className="page-nav-btn"
                      onClick={() => (serverSide && onPageChange ? onPageChange(effectiveCurrentPage + 1) : setLocalCurrentPage(effectiveCurrentPage + 1))}
                      disabled={effectiveCurrentPage >= totalPages}
                      title="Next Page"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </button>
                    <button
                      className="page-nav-btn"
                      onClick={() => (serverSide && onPageChange ? onPageChange(totalPages) : setLocalCurrentPage(totalPages))}
                      disabled={effectiveCurrentPage >= totalPages}
                      title="Last Page"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="13 17 18 12 13 7"></polyline>
                        <polyline points="6 17 11 12 6 7"></polyline>
                      </svg>
                    </button>
                  </div>
                </div>
              )}
              <div className="records-info-right">
                {footerStats && footerStats.length > 0 && (
                  <span className="records-info-text" style={{ marginRight: infiniteScroll ? 0 : 12 }}>
                    {infiniteScroll ? (
                      <>Showing <strong>{data.length}</strong> of <strong>{serverSide ? totalRecords || 0 : dataRowCount}</strong> records</>
                    ) : (
                      <>Showing <strong>{((effectiveCurrentPage - 1) * currentPageSize) + 1}</strong> to <strong>{Math.min(effectiveCurrentPage * currentPageSize, serverSide ? totalRecords || 0 : dataRowCount)}</strong> of <strong>{serverSide ? totalRecords || 0 : dataRowCount}</strong> records</>
                    )}
                  </span>
                )}
                {!infiniteScroll && (
                  <label className="rows-per-page-label">
                    Rows per page:
                    <select
                      className="rows-per-page-select"
                      value={currentPageSize}
                      onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </label>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showColumnChooser && (
        <ColumnChooser
          columns={columns}
          onColumnVisibilityChange={handleColumnVisibilityChange}
          onClose={() => setShowColumnChooser(false)}
        />
      )}
    </div>
  )
}
