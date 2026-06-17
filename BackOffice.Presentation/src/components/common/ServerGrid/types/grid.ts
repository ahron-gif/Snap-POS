export interface Column {
  field: string;
  headerName: string;
  width: number;
  visible?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  editable?: boolean;
  cellRenderer?: (value: any, row?: any) => string | React.ReactNode;
  dataType?: 'string' | 'number' | 'date' | 'time' | 'datetime' | 'boolean' | 'actions' | 'email' | 'url';
  /**
   * Footer aggregate to apply by default (until the user overrides it via the
   * footer's right-click menu). When omitted, the grid auto-defaults amount /
   * quantity numeric columns to "sum" (see getDefaultAggregate in Grid.tsx).
   * Set to "none" to opt a numeric column out of the auto-sum (e.g. a running
   * balance or a percentage).
   */
  defaultAggregate?: 'sum' | 'min' | 'max' | 'count' | 'average' | 'none';
  // Transform search value before sending to API (e.g., convert "Active" to "1")
  searchValueTransformer?: (searchValue: string) => string;
  /**
   * Pin the column to the left edge of the grid so it stays visible during
   * horizontal scrolling (Excel-style frozen panes). Currently only `left` is
   * supported. Consecutive pinned columns stack from the left in the order they
   * appear in the `columns` array. Their cumulative width is used to compute
   * each pinned cell's `left` offset.
   */
  pinned?: 'left';
  /**
   * Top-level header band label (row 1 of the header). Consecutive columns
   * with the same `group` value merge into a single banded cell that spans
   * across them. When unset, the grid falls back to the legacy field-name
   * derivation used by the Tender Totals pivot ("CREDIT CARD / Visa", "GIFT / ...").
   */
  group?: string;
  /**
   * Optional second-level header band (row 2 of the header). Consecutive
   * columns with the same (`group`, `subGroup`) pair merge into a single
   * banded cell. Used by the Tender Totals pivot to render
   * Type → Tender Type → Credit Type as three header rows.
   * Columns that omit `subGroup` but include `group` span rows 2 and 3.
   */
  subGroup?: string;
  /**
   * When any column of a `group` sets this true, that top-level band becomes
   * collapsible: the grid renders an expand/collapse arrow on the band header.
   * Collapsed → only the band's summary column (see `groupSummary`) stays
   * visible; expanded → all the band's child columns show. Mirrors the legacy
   * desktop pivot's collapsible Type bands (Actual Cash / Gift).
   */
  groupCollapsible?: boolean;
  /**
   * Marks this column as its band's running total. It stays visible even when
   * the band is collapsed, so a collapsed band shows just this one total column.
   */
  groupSummary?: boolean;
  /**
   * Initial collapsed state for a collapsible band. Set on the band's columns
   * to have the grid render that band collapsed on first paint.
   */
  groupDefaultCollapsed?: boolean;
  /**
   * Sub-group (row-2 band) analogue of `groupCollapsible`. When any column of a
   * `subGroup` sets this, that sub-band collapses to just its summary column
   * (see `subGroupSummary`). Used for Tender Totals' nested CREDIT CARD sub-band.
   */
  subGroupCollapsible?: boolean;
  /**
   * Marks this column as its sub-band's running total — stays visible when the
   * sub-band collapses, so the collapsed sub-band shows just this one column.
   */
  subGroupSummary?: boolean;
  /** Initial collapsed state for a collapsible sub-band. */
  subGroupDefaultCollapsed?: boolean;
}

export interface HeaderSearchConfig {
  [field: string]: string;
}

export interface GridProps {
  data: any[];
  columns: Column[];
  onRowUpdate?: (updatedRow: any) => void;
  pagination?: boolean;
  pageSize?: number;
  editable?: boolean;
  columnChooser?: boolean;
  // Header search props
  headerSearch?: boolean;
  onHeaderSearch?: (field: string, value: string) => void;
  headerSearchConfig?: HeaderSearchConfig;
  // Infinite scroll props
  infiniteScroll?: boolean;
  onLoadMore?: () => void;
  hasMoreData?: boolean;
  loadingMore?: boolean;
  // Server-side props
  serverSide?: boolean;
  totalRecords?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onSort?: (field: string, direction: 'asc' | 'desc' | null) => void;
  onFilter?: (field: string, conditions: any[], logic: any) => void;
  initialFilterConfig?: FilterConfig;
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export type FilterOperator = 'contains' | 'notContains' | 'like' | 'notLike' | 'equals' | 'notEquals' | 'startsWith' | 'endsWith' | 'greaterThan' | 'greaterThanOrEqual' | 'lessThan' | 'lessThanOrEqual' | 'between' | 'blank' | 'notBlank';

export type FilterCondition = {
  value: string;
  operator: FilterOperator;
  id: string;
};

export type FilterLogic = 'AND' | 'OR';

export interface FilterConfig {
  [field: string]: {
    conditions: FilterCondition[];
    logic: FilterLogic;
  };
}