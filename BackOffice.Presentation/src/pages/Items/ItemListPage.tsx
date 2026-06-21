import React, { useState, useCallback, memo, useMemo, useRef, useEffect } from "react"
// Import the optimized ServerGrid
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import {
  convertToGridColumns,
  cellRenderers,
  GridColDef,
} from "../../gridUtils"
import ActionHeader from "../../components/common/ActionHeader"
import { useDashboardTabs } from "../../context/DashboardTabContext"
import { useStore } from "../../context/StoreContext"
import { useGridSettings } from "../../hooks/useGridSettings"
import { useColumnAccessFilter } from "../../hooks/useColumnAccessFilter"
import { useExportHandlers } from "../../hooks/useExportHandlers"
import { useExportModal } from "../../hooks/useExportModal"
import ExportModal from "../../components/common/ExportModal"
import PrintLabelsDialog from "../LabelDesigner/components/PrintLabelsDialog"
import { CustomContextMenuItem } from "../../components/common/ServerGrid/components/GridBody"
import CopyItemModal, { CopyItemData } from "./CopyItemModal"
import AdjustInventoryModal from "./AdjustInventoryModal"
import PriceHistoryModal from "./PriceHistoryModal"
import SalesHistoryModal from "./SalesHistoryModal"
import AuditHistoryModal from "../../components/common/AuditHistoryModal"
import { itemService, CreateItemDto } from "../../services/itemService"
import type { ItemListNavigationState } from "./ItemFormPage"
import axios from "axios"
import "./item_detail_v6.css"
import { useConfirm } from '../../components/ui/ConfirmModal'
import { usePermissions } from "../../context/PermissionContext"

// Item record interface (based on API response)
interface ItemRecord {
  itemID: string
  name: string
  modalNumber: string | null
  linkNo: string | null
  barcodeNumber: string
  storeNo: string
  isTaxable: boolean
  isDiscount: boolean
  isFoodStampable: boolean
  isWIC: boolean | null
  cost: number
  price: number
  caseQty: number
  priceByCase: boolean
  styleNo: string | null
  costByCase: boolean
  caseBarcodeNumber: string | null
  onHand: number
  csOnHand: number
  binLocation: string | null
  status: number
  isDisableOnPO: boolean | null
  dateCreated: string
  itemStoreDateModified: string
  mainDateModified: string
  cs_Cost: number
  pc_Cost: number
  mainStatus: number
  itemStoreID: string
  department: string | null
  matrix1: string | null
  matrix2: string | null
  matrix3: string | null
  matrix4: string | null
  matrix5: string | null
  matrix6: string | null
  supplier_Item_Code: string | null
  manufacturerPartNo: string | null
  sP_Price: number | null
  supplierName: string
  groupDateModified: string
  sP_From: string | null
  sP_To: string | null
  future_SP_Price: number | null
  future_SP_From: string | null
  future_SP_To: string | null
  markup: number
  margin: number
  mtd: number
  mtD_Pc_Qty: number
  mtD_Cs_Qty: number
  ytd: number
  ytD_Pc_Qty: number
  ytD_Cs_Qty: number
  ptd: number
  ptD_Pc_Qty: number
  matrixTableNo: string | null
  ptD_Cs_Qty: number
  itemNo: string
  brand: string
  toReorder: number
  size: string | null
  departmentDateModified: string | null
  itemType: number
  departmentID: string | null
  itemTypeName: string
}

// Column definitions for items (mapped to API response - ItemMainAndStoreGrid view)
const itemsColumnDefs: GridColDef[] = [
  {
    field: "itemID",
    headerName: "Item ID",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "itemNo",
    headerName: "Item No",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
    visible: false,
  },
  {
    field: "name",
    headerName: "ITEM NAME",
    width: 250,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "barcodeNumber",
    headerName: "UPC",
    width: 180,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "modalNumber",
    headerName: "MODEL #",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "linkNo",
    headerName: "Link No",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "storeNo",
    headerName: "Store No",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "price",
    headerName: "PRICE",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "cost",
    headerName: "COST",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "cs_Cost",
    headerName: "Case Cost",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "pc_Cost",
    headerName: "PC Cost",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "onHand",
    headerName: "ON HAND",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.quantityChip,
  },
  {
    field: "csOnHand",
    headerName: "CASES ON HAND",
    width: 130,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.quantityChip,
  },
  {
    field: "caseQty",
    headerName: "Case Qty",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
  },
  {
    field: "priceByCase",
    headerName: "Price By Case",
    width: 130,
    type: "boolean",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.boolean,
  },
  {
    field: "costByCase",
    headerName: "Cost By Case",
    width: 130,
    type: "boolean",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.boolean,
  },
  {
    field: "caseBarcodeNumber",
    headerName: "CASE UPC",
    width: 180,
    type: "string",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) => value ? String(value) : "—",
  },
  {
    field: "isTaxable",
    headerName: "Taxable",
    width: 100,
    type: "boolean",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.boolean,
  },
  {
    field: "isDiscount",
    headerName: "Discount",
    width: 100,
    type: "boolean",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.boolean,
  },
  {
    field: "isFoodStampable",
    headerName: "Food Stampable",
    width: 140,
    type: "boolean",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.boolean,
  },
  {
    field: "isWIC",
    headerName: "WIC",
    width: 80,
    type: "boolean",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.boolean,
  },
  {
    field: "itemTypeName",
    headerName: "Item Type",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "itemType",
    headerName: "Item Type Code",
    width: 140,
    type: "number",
    sortable: true,
    filterable: true,
  },
  {
    field: "supplierName",
    headerName: "Supplier",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "supplier_Item_Code",
    headerName: "Supplier Item Code",
    width: 160,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "manufacturerPartNo",
    headerName: "Manufacturer Part No",
    width: 170,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "brand",
    headerName: "Brand",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "department",
    headerName: "Department",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "departmentID",
    headerName: "Department ID",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "size",
    headerName: "Size",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "styleNo",
    headerName: "Style No",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "binLocation",
    headerName: "LOCATION",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "toReorder",
    headerName: "ON ORDER",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
  },
  {
    field: "markup",
    headerName: "MARKUP",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value ? `${Number(value).toFixed(0)}%` : "0%",
  },
  {
    field: "margin",
    headerName: "MARGIN",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value ? `${Number(value).toFixed(1)}%` : "0.0%",
  },
  {
    field: "sP_Price",
    headerName: "SP Price",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value ? `$${Number(value).toFixed(2)}` : "-",
  },
  {
    field: "sP_From",
    headerName: "SP From",
    width: 150,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "sP_To",
    headerName: "SP To",
    width: 150,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "future_SP_Price",
    headerName: "Future SP Price",
    width: 140,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value ? `$${Number(value).toFixed(2)}` : "-",
  },
  {
    field: "future_SP_From",
    headerName: "Future SP From",
    width: 150,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "future_SP_To",
    headerName: "Future SP To",
    width: 150,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "mtd",
    headerName: "MTD SALES",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value ? `${Number(value).toFixed(0)}` : "0",
  },
  {
    field: "mtD_Pc_Qty",
    headerName: "MTD Pc Qty",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
  },
  {
    field: "mtD_Cs_Qty",
    headerName: "MTD Cs Qty",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
  },
  {
    field: "ytd",
    headerName: "YTD",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "ytD_Pc_Qty",
    headerName: "YTD Pc Qty",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
  },
  {
    field: "ytD_Cs_Qty",
    headerName: "YTD Cs Qty",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
  },
  {
    field: "ptd",
    headerName: "PTD",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "ptD_Pc_Qty",
    headerName: "PTD Pc Qty",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
  },
  {
    field: "ptD_Cs_Qty",
    headerName: "PTD Cs Qty",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
  },
  {
    field: "matrix1",
    headerName: "Matrix 1",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "matrix2",
    headerName: "Matrix 2",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "matrix3",
    headerName: "Matrix 3",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "matrix4",
    headerName: "Matrix 4",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "matrix5",
    headerName: "Matrix 5",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "matrix6",
    headerName: "Matrix 6",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "matrixTableNo",
    headerName: "Matrix Table No",
    width: 140,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "status",
    headerName: "Status",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
  },
  {
    field: "mainStatus",
    headerName: "Main Status",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
  },
  {
    field: "itemStoreID",
    headerName: "Item Store ID",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "dateCreated",
    headerName: "Date Created",
    width: 180,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "itemStoreDateModified",
    headerName: "Store Date Modified",
    width: 180,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "mainDateModified",
    headerName: "Main Date Modified",
    width: 180,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "groupDateModified",
    headerName: "Group Date Modified",
    width: 180,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "departmentDateModified",
    headerName: "Department Date Modified",
    width: 200,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
]

// Grid ID for settings persistence
const ITEMS_GRID_ID = "items-list-grid"

const ItemListPage = memo(function ItemListPage() {
  const { getAuthHeaders } = useAuthHeaders()
  const { confirm, ConfirmDialog } = useConfirm()
  const { openTab } = useDashboardTabs()
  const { currentStore } = useStore()
  const { hasPermission, isSuperAdmin, isTenantAdmin } = usePermissions()

  const canViewSummary = isSuperAdmin || isTenantAdmin || hasPermission("inventory.item_list.view_summary") || hasPermission("ITEMS_LIST.ViewSummary") || hasPermission("BO_ItemsViewSummary")

  // State for search functionality
  const [searchText, setSearchText] = useState("")
  const [debouncedSearchText, setDebouncedSearchText] = useState("")

  // Quick filter state
  const [activeQuickFilters, setActiveQuickFilters] = useState<Set<string>>(new Set())

  // Summary card stats.
  //   * totalItems / priceSum / costSum / avgPcCost / onHandValue come from
  //     the SERVER (GET /api/Items/Totals) and reflect every row matching
  //     the current filter — they DON'T grow as infinite scroll loads
  //     more pages.
  //   * shownCount is the number of rows actually loaded into the grid so
  //     far; we still derive it from handleGridDataChange so the bottom
  //     bar can show "Showing N of total".
  const [summaryStats, setSummaryStats] = useState({
    totalItems: 0,
    priceSum: 0,
    costSum: 0,
    avgPcCost: 0,
    onHandValue: 0,
    shownCount: 0,
  })

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

  // Ref to store grid data from ServerGrid
  const gridDataRef = useRef<any[]>([])

  // Slide-over panel (open on grid row click)
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(false)
  const [quickEditRows, setQuickEditRows] = useState<ItemRecord[]>([])
  const [quickEditIndex, setQuickEditIndex] = useState(0)
  const [quickEditRow, setQuickEditRow] = useState<ItemRecord | null>(null)

  // Editable pricing fields inside the slide-over
  const [editPrice, setEditPrice] = useState<number>(0)
  const [editCost, setEditCost] = useState<number>(0)
  const [editCaseQty, setEditCaseQty] = useState<number>(0)
  const [editPriceText, setEditPriceText] = useState<string>("0.00")
  const [editCostText, setEditCostText] = useState<string>("0.00")
  const [isQuickEditSaving, setIsQuickEditSaving] = useState(false)

  // Ref to store updateRow function from ServerGrid (for local row updates without remount)
  const updateRowRef = useRef<((rowId: string, updater: (row: any) => any) => void) | null>(null)

  // Memoize auth headers to prevent re-creation
  const memoizedGetAuthHeaders = useCallback(() => {
    return getAuthHeaders()
  }, [getAuthHeaders])

  // Convert column definitions to grid format
  const allColumns = useMemo(() => convertToGridColumns(itemsColumnDefs), [])

  // Use grid settings hook for column visibility, width, and aggregate persistence.
  // Give it the COMPLETE column list so its internal state is stable — the
  // hook uses useState(initializer) which only runs once, so passing a list
  // that changes over time leaves it stuck on whatever was passed first.
  const {
    columns: userPrefColumns,
    setColumns,
    updateColumnVisibility,
    updateColumnWidth,
    columnAggregates,
    updateColumnAggregate,
  } = useGridSettings(ITEMS_GRID_ID, allColumns)

  // Super-Admin access layer: strip any column the admin has revoked for this
  // user. Applied AFTER useGridSettings so the filter can react to the
  // (asynchronously-loaded) access rules without fighting the hook's one-shot
  // initializer. Columns the admin has revoked disappear from the grid,
  // three-dots menu, column chooser, and export modal.
  const { filteredColumns: columns } = useColumnAccessFilter(ITEMS_GRID_ID, userPrefColumns)

  // Handle column changes from grid for persistence
  const handleColumnsChange = useCallback((newColumns: any[]) => {
    setColumns(newColumns)
  }, [setColumns])

  // Debounce search input - only update debouncedSearchText after user stops typing
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText)
    }, 500) // 500ms debounce for search input

    return () => clearTimeout(timer)
  }, [searchText])

  // Toggle a quick filter on/off
  const handleQuickFilterToggle = useCallback((filterKey: string) => {
    setActiveQuickFilters((prev) => {
      const next = new Set(prev)
      if (next.has(filterKey)) {
        next.delete(filterKey)
      } else {
        next.add(filterKey)
      }
      return next
    })
  }, [])

  // Clear all quick filters
  const handleClearFilters = useCallback(() => {
    setActiveQuickFilters(new Set())
  }, [])

  // Create API search parameters using useMemo to prevent infinite loops
  const additionalParams = useMemo(() => {
    const params: Record<string, string> = {}

    // Filter by current store
    if (currentStore?.storeId) {
      params.storeId = currentStore.storeId
    }

    // Add search parameters if search text is provided
    if (debouncedSearchText.trim()) {
      params.CustomGridSearchText = debouncedSearchText.trim()
      params.CustomGridSearchColumns = "name,barcodeNumber"
    }

    // Add quick filter parameters
    if (activeQuickFilters.has("saleItems")) {
      params.saleItems = "true"
    }
    if (activeQuickFilters.has("showInactive")) {
      params.showInactive = "true"
    }

    return params
  }, [debouncedSearchText, currentStore?.storeId, activeQuickFilters])

  // Handle search input change from ActionHeader (memoized)
  const handleSearchInputChange = useCallback((value: string) => {
    console.log("Search input changed:", value)
    setSearchText(value)
  }, [])

  // Handle search on Enter key press - trigger immediate search (memoized)
  const handleSearchKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        console.log("Search triggered by Enter key:", searchText)
        setDebouncedSearchText(searchText) // Immediately trigger search on Enter
      }
    },
    [searchText]
  )

  // Handle inline cell edits (no-op for server-side grid – edits go through quick-edit panel)
  const handleRowUpdate = useCallback(async (_updatedRow: ItemRecord) => {
    // Intentionally empty: inline cell saves should not open a new tab.
  }, [])

  /** For ItemFormPage vitals pager: order and titles match rows currently buffered in the grid. */
  const buildItemListNavigationForRow = useCallback(
    (row: ItemRecord): ItemListNavigationState | undefined => {
      const rows = (gridDataRef.current as ItemRecord[]) || []
      if (!rows.length) return undefined
      const idx = rows.findIndex((r) => r.itemStoreID === row.itemStoreID)
      return {
        totalCount: totalRecords,
        itemStoreIds: rows.map((r) => r.itemStoreID),
        itemTitles: rows.map((r) => r.name || "Item"),
        index: idx >= 0 ? idx : 0,
      }
    },
    [totalRecords],
  )

  // Handle double-click on a row → open full edit tab
  const handleRowDoubleClick = useCallback((row: ItemRecord) => {
    const itemListNavigation = buildItemListNavigationForRow(row)
    openTab({
      component: "ItemFormPage",
      title: `Edit: ${row.name || "Item"}`,
      closable: true,
      editMode: true, // shows the yellow asterisk on the tab strip
      props: { id: row.itemStoreID, ...(itemListNavigation && { itemListNavigation }) },
    })
  }, [openTab, buildItemListNavigationForRow])

  // Handle opening the add item page
  const handleAddItem = useCallback(() => {
    openTab({
      component: "ItemFormPage",
      title: "New Item",
      closable: true,
      editMode: true, // shows the yellow asterisk on the tab strip
      props: { isNew: true },
    })
  }, [openTab])

  // Toast notification function (memoized)
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      setToast({ show: true, message, type })
      setTimeout(() => {
        setToast({ show: false, message: "", type: "success" })
      }, 3000)
    },
    []
  )

  // Handle checkbox selection using itemStoreID as the primary identifier (memoized)
  const handleRowSelection = useCallback((itemStoreID: string) => {
    console.log("Row selection triggered for itemStoreID:", itemStoreID)

    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = new Set(prevSelectedRows)
      const wasSelected = newSelectedRows.has(itemStoreID)

      if (wasSelected) {
        newSelectedRows.delete(itemStoreID)
        console.log(
          "Deselected row:",
          itemStoreID,
          "New count:",
          newSelectedRows.size
        )
      } else {
        newSelectedRows.add(itemStoreID)
        console.log(
          "Selected row:",
          itemStoreID,
          "New count:",
          newSelectedRows.size
        )
      }

      return newSelectedRows
    })
  }, [])

  // Handle deselect all (memoized)
  const handleDeselectAll = useCallback(() => {
    console.log(
      "Deselect all triggered, current selected rows:",
      Array.from(selectedRows)
    )
    setSelectedRows(new Set())
    console.log("Deselect all completed")
  }, [selectedRows])

  // Handle remount grid (memoized)
  const handleRemountGrid = useCallback(() => {
    setSelectedRows(new Set())
    setSearchText("") // Clear search text
    setDebouncedSearchText("") // Clear debounced search text
    setActiveQuickFilters(new Set()) // Clear quick filters
    setRemountKey((prev) => prev + 1)
    showToast("Grid refreshed and search cleared", "info")
  }, [showToast])

  // Handle bulk delete (memoized)
  const handleBulkDelete = useCallback(async () => {
    if (selectedRows.size === 0) return

    const confirmed = await confirm({
      title: 'Delete Items',
      message: `Are you sure you want to delete ${selectedRows.size} selected item(s)? This action cannot be undone.`,
      variant: 'danger',
    })
    if (!confirmed) return

    try {
      const itemStoreIds = Array.from(selectedRows)
      const response = await axios.put(
        API_ENDPOINTS.ITEMS.BULK_DELETE,
        { itemStoreIds },
        { headers: getAuthHeaders() }
      )

      if (response.data?.isSuccess) {
        showToast(`${selectedRows.size} items deleted successfully!`, "success")
        setSelectedRows(new Set())
        setRemountKey((prev) => prev + 1)
      } else {
        showToast(response.data?.message || "Failed to delete selected items", "error")
      }
    } catch {
      showToast("Failed to delete selected items", "error")
    }
  }, [selectedRows, confirm, getAuthHeaders, showToast])

  // Handle bulk edit (memoized)
  const handleBulkEdit = useCallback(() => {
    if (selectedRows.size > 0) {
      console.log("Bulk editing items:", selectedRows)
      // Add your bulk edit logic here
    }
  }, [selectedRows])

  // Handle bulk export (memoized)
  const handleBulkExport = useCallback(() => {
    if (selectedRows.size > 0) {
      console.log("Bulk exporting items:", selectedRows)
      // Add your bulk export logic here
      showToast(`Exporting ${selectedRows.size} items...`, "info")
    }
  }, [selectedRows, showToast])

  // Handle bulk activate
  const handleBulkActivate = useCallback(async () => {
    if (selectedRows.size === 0) return
    try {
      const headers = getAuthHeaders()
      const itemStoreIds = Array.from(selectedRows)
      const response = await fetch(API_ENDPOINTS.ITEMS.BULK_ACTIVATE, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ itemStoreIds }),
      })
      const result = await response.json()
      if (result.isSuccess) {
        // Update rows locally
        itemStoreIds.forEach((id) => {
          if (updateRowRef.current) {
            updateRowRef.current(id, (row: any) => ({ ...row, status: 1 }))
          }
        })
        gridDataRef.current = gridDataRef.current.map((row: any) =>
          itemStoreIds.includes(row.itemStoreID) ? { ...row, status: 1 } : row
        )
        setSelectedRows(new Set())
        showToast(result.message || `${itemStoreIds.length} items activated`, "success")
      } else {
        showToast(result.message || "Failed to activate items", "error")
      }
    } catch {
      showToast("Error activating items", "error")
    }
  }, [selectedRows, getAuthHeaders, showToast])

  // Handle bulk deactivate
  const handleBulkDeactivate = useCallback(async () => {
    if (selectedRows.size === 0) return
    try {
      const headers = getAuthHeaders()
      const itemStoreIds = Array.from(selectedRows)
      const response = await fetch(API_ENDPOINTS.ITEMS.BULK_DEACTIVATE, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ itemStoreIds }),
      })
      const result = await response.json()
      if (result.isSuccess) {
        itemStoreIds.forEach((id) => {
          if (updateRowRef.current) {
            updateRowRef.current(id, (row: any) => ({ ...row, status: 0 }))
          }
        })
        gridDataRef.current = gridDataRef.current.map((row: any) =>
          itemStoreIds.includes(row.itemStoreID) ? { ...row, status: 0 } : row
        )
        setSelectedRows(new Set())
        showToast(result.message || `${itemStoreIds.length} items deactivated`, "success")
      } else {
        showToast(result.message || "Failed to deactivate items", "error")
      }
    } catch {
      showToast("Error deactivating items", "error")
    }
  }, [selectedRows, getAuthHeaders, showToast])

  // Handle bulk disable on phone order
  const handleBulkDisablePhoneOrder = useCallback(async () => {
    if (selectedRows.size === 0) return
    try {
      const headers = getAuthHeaders()
      const itemStoreIds = Array.from(selectedRows)
      const response = await fetch(API_ENDPOINTS.ITEMS.BULK_TOGGLE_PHONE_ORDER, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ itemStoreIds }),
      })
      const result = await response.json()
      if (result.isSuccess) {
        // Update local rows to reflect disabled state
        const selectedSet = new Set(itemStoreIds)
        if (updateRowRef.current) {
          itemStoreIds.forEach(id => {
            updateRowRef.current!(id, (row: any) => ({ ...row, isDisableOnPO: true }))
          })
        }
        gridDataRef.current = gridDataRef.current.map((row: any) =>
          selectedSet.has(row.itemStoreID) ? { ...row, isDisableOnPO: true } : row
        )
        setSelectedRows(new Set())
        showToast(result.message || `${itemStoreIds.length} items disabled for phone orders`, "success")
      } else {
        showToast(result.message || "Failed to disable items for phone orders", "error")
      }
    } catch {
      showToast("Error disabling items for phone orders", "error")
    }
  }, [selectedRows, getAuthHeaders, showToast])

  // Handle bulk enable on phone order
  const handleBulkEnablePhoneOrder = useCallback(async () => {
    if (selectedRows.size === 0) return
    try {
      const headers = getAuthHeaders()
      const itemStoreIds = Array.from(selectedRows)
      const response = await fetch(API_ENDPOINTS.ITEMS.BULK_ENABLE_PHONE_ORDER, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ itemStoreIds }),
      })
      const result = await response.json()
      if (result.isSuccess) {
        const selectedSet = new Set(itemStoreIds)
        if (updateRowRef.current) {
          itemStoreIds.forEach(id => {
            updateRowRef.current!(id, (row: any) => ({ ...row, isDisableOnPO: false }))
          })
        }
        gridDataRef.current = gridDataRef.current.map((row: any) =>
          selectedSet.has(row.itemStoreID) ? { ...row, isDisableOnPO: false } : row
        )
        setSelectedRows(new Set())
        showToast(result.message || `${itemStoreIds.length} items enabled for phone orders`, "success")
      } else {
        showToast(result.message || "Failed to enable items for phone orders", "error")
      }
    } catch {
      showToast("Error enabling items for phone orders", "error")
    }
  }, [selectedRows, getAuthHeaders, showToast])

  // Handle bulk changes (placeholder)
  const handleBulkChanges = useCallback(() => {
    showToast("Bulk changes feature coming soon", "info")
  }, [showToast])

  // Print Labels dialog — driven by the right-click "Print Label" (single item)
  // and the bulk "Print Labels" toolbar action (current selection). Reuses the
  // LabelDesigner PrintLabelsDialog, which guards printing behind a loaded
  // template + items (isLoading), so it can never print before data is ready.
  const [isPrintLabelsOpen, setIsPrintLabelsOpen] = useState(false)
  const [printLabelsIds, setPrintLabelsIds] = useState<string[]>([])

  const openPrintLabels = useCallback((ids: string[]) => {
    if (ids.length === 0) {
      showToast("Select at least one item to print labels", "info")
      return
    }
    setPrintLabelsIds(ids)
    setIsPrintLabelsOpen(true)
  }, [showToast])

  // Bulk print labels for the current grid selection.
  const handleBulkPrintLabels = useCallback(() => {
    openPrintLabels(Array.from(selectedRows))
  }, [openPrintLabels, selectedRows])

  // Handle View Details from context menu
  const handleViewItem = useCallback((row: ItemRecord) => {
    openTab({
      component: "ItemViewPage",
      title: `View: ${row.name || "Item"}`,
      closable: true,
      props: { id: row.itemStoreID },
    })
  }, [openTab])

  // Handle Edit from context menu
  const handleEditItem = useCallback((row: ItemRecord) => {
    const itemListNavigation = buildItemListNavigationForRow(row)
    openTab({
      component: "ItemFormPage",
      title: `Edit: ${row.name || "Item"}`,
      closable: true,
      editMode: true,
      props: { id: row.itemStoreID, ...(itemListNavigation && { itemListNavigation }) },
    })
  }, [openTab, buildItemListNavigationForRow])

  // Handle Delete Row from default context menu/actions
  const handleDeleteItem = useCallback(async (row: ItemRecord) => {
    const confirmed = await confirm({
      title: 'Delete Item',
      message: `Are you sure you want to delete "${row.name || "this item"}"? This action cannot be undone.`,
      variant: 'danger',
    })
    if (!confirmed) return

    try {
      const response = await axios.put(
        API_ENDPOINTS.ITEMS.BULK_DELETE,
        { itemStoreIds: [row.itemStoreID] },
        { headers: getAuthHeaders() }
      )

      if (response.data?.isSuccess) {
        showToast(`"${row.name || "Item"}" deleted successfully`, "success")
        setSelectedRows((prev) => {
          const next = new Set(prev)
          next.delete(row.itemStoreID)
          return next
        })
        setRemountKey((prev) => prev + 1)
      } else {
        showToast(response.data?.message || "Failed to delete item", "error")
      }
    } catch {
      showToast("Failed to delete item", "error")
    }
  }, [confirm, getAuthHeaders, showToast])

  // ============ Slide-over (Quick Edit) ============
  const closeQuickEdit = useCallback(() => {
    setIsQuickEditOpen(false)
    setQuickEditRow(null)
  }, [])

  const openQuickEdit = useCallback((row: ItemRecord) => {
    const rows = (gridDataRef.current as ItemRecord[]) || []
    const idx = rows.findIndex((r) => r.itemStoreID === row.itemStoreID)

    setQuickEditRows(rows)
    setQuickEditIndex(idx >= 0 ? idx : 0)
    setQuickEditRow(row)
    setIsQuickEditOpen(true)
  }, [])

  const moveQuickEdit = useCallback(
    (dir: -1 | 1) => {
      if (!quickEditRows.length) return
      const nextIndex = quickEditIndex + dir
      if (nextIndex < 0 || nextIndex >= quickEditRows.length) return
      setQuickEditIndex(nextIndex)
      setQuickEditRow(quickEditRows[nextIndex])
    },
    [quickEditIndex, quickEditRows],
  )

  // Sync editable pricing fields when the quick-edit row changes
  useEffect(() => {
    if (!quickEditRow) return
    const p = Number(quickEditRow.price ?? 0)
    const c = Number(quickEditRow.cost ?? 0)
    setEditPrice(p)
    setEditCost(c)
    setEditCaseQty(Number(quickEditRow.caseQty ?? 0))
    setEditPriceText(p.toFixed(2))
    setEditCostText(c.toFixed(2))
  }, [quickEditRow])

  // Tracks whether the user has edited any input in the quick-edit panel.
  // Used to prevent closing the panel via the backdrop (outside click) when
  // there are unsaved changes — only Cancel or Save should close it in that case.
  const isQuickEditDirty = useMemo(() => {
    if (!quickEditRow) return false
    const origPrice = Number(quickEditRow.price ?? 0)
    const origCost = Number(quickEditRow.cost ?? 0)
    const origCaseQty = Number(quickEditRow.caseQty ?? 0)
    return (
      editPrice !== origPrice ||
      editCost !== origCost ||
      editCaseQty !== origCaseQty
    )
  }, [quickEditRow, editPrice, editCost, editCaseQty])

  const handleQuickEditBackdropClick = useCallback(() => {
    if (isQuickEditDirty) return // keep panel open while there are unsaved edits
    closeQuickEdit()
  }, [isQuickEditDirty, closeQuickEdit])

  const fmtMoney = useCallback((value: number | null | undefined) => {
    const n = Number(value ?? 0)
    return `$${n.toFixed(2)}`
  }, [])

  const fmtPct = useCallback((value: number | null | undefined, digits = 1) => {
    const n = Number(value ?? 0)
    return `${n.toFixed(digits)}%`
  }, [])

  const qPrice = editPrice
  const qCost = editCost
  const qCaseQty = editCaseQty
  const qMarginPct = qPrice > 0 ? ((qPrice - qCost) / qPrice) * 100 : 0
  const qMarkupPct = qCost > 0 ? ((qPrice - qCost) / qCost) * 100 : 0
  const qProfit = qPrice - qCost
  const qOnHand = quickEditRow ? Number(quickEditRow.onHand ?? 0) : 0
  const qOnOrder = quickEditRow ? Number(quickEditRow.toReorder ?? 0) : 0

  const handleQuickEditSave = useCallback(async () => {
    if (!quickEditRow) return
    setIsQuickEditSaving(true)
    try {
      const dto: CreateItemDto = {
        // Use the main item id for update (ItemFormPage uses this "itemId" field too)
        itemId: quickEditRow.itemID,
        name: quickEditRow.name,
        barcodeNumber: quickEditRow.barcodeNumber,
        modalNumber: quickEditRow.modalNumber || undefined,
        caseBarcodeNumber: quickEditRow.caseBarcodeNumber || undefined,

        storeNo: quickEditRow.storeNo,
        departmentID: quickEditRow.departmentID || undefined,
        itemType: quickEditRow.itemType,

        // Pricing fields being edited
        priceByCase: quickEditRow.priceByCase,
        costByCase: quickEditRow.costByCase,
        cost: qCost,
        price: qPrice,
        casePrice: qPrice * qCaseQty,
        caseQty: qCaseQty,
        cs_Cost: qCost * qCaseQty,

        // Keep flags so update doesn't unintentionally clear them
        isTaxable: quickEditRow.isTaxable,
        isDiscount: quickEditRow.isDiscount,
        isFoodStampable: quickEditRow.isFoodStampable,
        isWIC: quickEditRow.isWIC ?? undefined,

        onHand: quickEditRow.onHand,
        onOrder: quickEditRow.toReorder,
        binLocation: quickEditRow.binLocation || undefined,
        styleNo: quickEditRow.matrix1 || undefined,
        customInteger1: quickEditRow.matrix2 ? parseInt(quickEditRow.matrix2, 10) || undefined : undefined,
      }

      const response = await itemService.updateItem(dto)
      if (response.success) {
        const updatedRow: ItemRecord = {
          ...quickEditRow,
          price: qPrice,
          cost: qCost,
          caseQty: qCaseQty,
          cs_Cost: qCost * qCaseQty,
          pc_Cost: qCost,
          margin: qMarginPct,
          markup: qMarkupPct,
        }

        setQuickEditRow(updatedRow)
        if (updateRowRef.current) {
          updateRowRef.current(updatedRow.itemStoreID, (row: any) => ({
            ...row,
            ...updatedRow,
          }))
        }

        showToast(response.message || "Saved", "success")
        closeQuickEdit()
      } else {
        showToast(response.message || "Failed to save", "error")
      }
    } catch (e) {
      console.error("Quick edit save error:", e)
      showToast("Failed to save", "error")
    } finally {
      setIsQuickEditSaving(false)
    }
  }, [
    quickEditRow,
    qPrice,
    qCost,
    qCaseQty,
    qMarginPct,
    qMarkupPct,
    closeQuickEdit,
    showToast,
  ])

  // Delay single-click so a double-click can cancel it (prevents slide-over + tab both opening)
  const rowClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleGridRowClick = useCallback(
    (row: any) => {
      if (!row) return
      // Clear any pending single-click timer
      if (rowClickTimer.current) clearTimeout(rowClickTimer.current)
      rowClickTimer.current = setTimeout(() => {
        openQuickEdit(row as ItemRecord)
      }, 250)
    },
    [openQuickEdit],
  )

  // Cancel pending single-click when double-click fires
  const handleRowDoubleClickWrapper = useCallback(
    (row: any) => {
      if (rowClickTimer.current) {
        clearTimeout(rowClickTimer.current)
        rowClickTimer.current = null
      }
      handleRowDoubleClick(row as ItemRecord)
    },
    [handleRowDoubleClick],
  )

  // Static action handlers (memoized)
  const handleStaticEdit = useCallback(() => {
    if (selectedRows.size === 1) {
      const id = Array.from(selectedRows)[0]
      const rows = (gridDataRef.current as ItemRecord[]) || []
      const row = rows.find((r) => r.itemStoreID === id)
      const itemListNavigation = row ? buildItemListNavigationForRow(row) : undefined
      openTab({
        component: "ItemFormPage",
        title: row ? `Edit: ${row.name || "Item"}` : "Edit Item",
        closable: true,
        editMode: true,
        props: { id, ...(itemListNavigation && { itemListNavigation }) },
      })
    } else if (selectedRows.size > 1) {
      showToast("Please select only one item to edit", "info")
    } else {
      showToast("Please select an item to edit", "info")
    }
  }, [selectedRows, openTab, showToast, buildItemListNavigationForRow])

  const handleStaticDownloadReport = useCallback(() => {
    console.log("Static download report action clicked")
    showToast("Downloading report for current data", "success")
  }, [showToast])

  const handleStaticDelete = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Delete Items',
      message: 'Are you sure you want to delete? This action cannot be undone.',
      variant: 'danger',
    })
    if (confirmed) {
      console.log("Static delete action clicked")
      showToast("Delete functionality executed", "success")
    }
  }, [showToast, confirm])

  // Fetch all data for export/print
  const fetchAllData = useCallback(async (dateFrom?: string, dateTo?: string): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const response = await axios({
        method: "GET",
        url: API_ENDPOINTS.ITEMS.GET_ALL_ITEMS,
        params: {
          startRow: 0,
          endRow: 1000000,
          ...(dateFrom && { dateFrom }),
          ...(dateTo && { dateTo }),
          sortColumn: "itemID",
          sortDirection: "asc",
          storeId: currentStore?.storeId || undefined,
          ...(debouncedSearchText.trim() && {
            CustomGridSearchText: debouncedSearchText.trim(),
            CustomGridSearchColumns: "name,barcodeNumber",
          }),
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
  }, [getAuthHeaders, currentStore?.storeId, debouncedSearchText])

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
    filename: "items-list",
    pdfOptions: { title: "Items List", subtitle: currentStore?.storeName || "All Stores", orientation: "landscape" },
    documentType: "items-list",
  })

  // Export modal
  const exportModal = useExportModal({
    columns,
    fetchAllData,
    filename: "items-list",
    pdfOptions: { title: "Items List", subtitle: currentStore?.storeName || "All Stores", orientation: "landscape" },
    dateFilterField: "dateCreated",
  })

  // Callback to receive grid data from ServerGrid. We only update
  // `shownCount` here now — the money totals come from the server (see the
  // fetch effect below). Without this split, every infinite-scroll page
  // load would overwrite the catalog totals with the partial running sum.
  const handleGridDataChange = useCallback((data: any[]) => {
    gridDataRef.current = data
    setSummaryStats(prev => ({ ...prev, shownCount: data.length }))
  }, [])

  // Fetch catalog-wide totals from the server whenever the filter set
  // changes (store switch, search, quick filters, column filters). Debounced
  // so rapid filter changes (typing in a search box) don't fire dozens of
  // requests. Uses the same `additionalParams` payload as the grid query so
  // the totals always match what the grid is displaying — and stay constant
  // as the user scrolls (no client-side recomputation per page load).
  useEffect(() => {
    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        const response = await axios.get(API_ENDPOINTS.ITEMS.GET_ITEMS_TOTALS, {
          params: additionalParams,
          headers: memoizedGetAuthHeaders(),
        })
        if (cancelled) return
        const result = response.data
        if (!result?.isSuccess) {
          console.warn('[ItemListPage] totals API non-success:', result?.message)
          return
        }
        const t = result.response ?? {}
        setSummaryStats(prev => ({
          ...prev,
          totalItems: Number(t.totalCount ?? 0),
          priceSum: Number(t.priceSum ?? 0),
          costSum: Number(t.costSum ?? 0),
          avgPcCost: Number(t.avgPcCost ?? 0),
          onHandValue: Number(t.onHandValue ?? 0),
        }))
      } catch (err) {
        if (!cancelled) console.error('[ItemListPage] totals fetch failed:', err)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [additionalParams, memoizedGetAuthHeaders])

  // Store reference to ServerGrid's select all function
  const serverGridSelectAllRef = React.useRef<(() => void) | null>(null)

  // Handle select all - this will be called by ActionHeader (memoized)
  const handleSelectAll = useCallback(() => {
    console.log("ItemListPage handleSelectAll triggered")

    try {
      if (serverGridSelectAllRef.current) {
        console.log("Calling ServerGrid handleSelectAll function")
        serverGridSelectAllRef.current()
      } else {
        console.log("ServerGrid handleSelectAll function not available")
        showToast("Selecting all items...", "info")
      }
    } catch (error) {
      console.error("Error in handleSelectAll:", error)
      showToast("Error selecting items", "error")
    }
  }, [showToast])

  // ============ Copy Item Feature ============

  // State for copy item modal
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false)
  const [copyItemRow, setCopyItemRow] = useState<ItemRecord | null>(null)

  // ============ Adjust Inventory Feature ============
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
  const [adjustItemRow, setAdjustItemRow] = useState<ItemRecord | null>(null)

  // ============ Price History Feature ============
  const [isPriceHistoryOpen, setIsPriceHistoryOpen] = useState(false)
  const [priceHistoryRow, setPriceHistoryRow] = useState<ItemRecord | null>(null)

  // ============ Cost History Feature ============
  const [isCostHistoryOpen, setIsCostHistoryOpen] = useState(false)
  const [costHistoryRow, setCostHistoryRow] = useState<ItemRecord | null>(null)

  // ============ Sales History Feature ============
  const [isSalesHistoryOpen, setIsSalesHistoryOpen] = useState(false)
  const [salesHistoryRow, setSalesHistoryRow] = useState<ItemRecord | null>(null)

  // ============ Audit History Feature ============
  const [isAuditHistoryOpen, setIsAuditHistoryOpen] = useState(false)
  const [auditEntityId, setAuditEntityId] = useState("")
  const [auditEntityName, setAuditEntityName] = useState("")

  // Track the last right-clicked row for keyboard shortcut
  const lastSelectedRowRef = useRef<ItemRecord | null>(null)

  // Handle Copy Item from context menu
  const handleCopyItem = useCallback((row: any) => {
    setCopyItemRow(row as ItemRecord)
    lastSelectedRowRef.current = row as ItemRecord
    setIsCopyModalOpen(true)
  }, [])

  // Handle Copy Item modal confirm - fetch full item data and open form
  const handleCopyConfirm = useCallback(async (copyData: CopyItemData) => {
    setIsCopyModalOpen(false)

    try {
      // Fetch the full item data from the original item
      const originalItemStoreId = copyItemRow?.itemStoreID
      if (!originalItemStoreId) {
        showToast("Could not find original item data", "error")
        return
      }

      const response = await itemService.getItem(originalItemStoreId)
      if (response.success && response.data) {
        // Open ItemFormPage as new item with pre-filled copy data
        openTab({
          component: "ItemFormPage",
          title: `Copy: ${copyData.name || "Item"}`,
          closable: true,
          editMode: true,
          props: {
            isNew: true,
            copyData: {
              ...response.data,
              // Override with values from the copy modal
              name: copyData.name,
              barcodeNumber: copyData.barcodeNumber,
              modalNumber: copyData.modelNumber,
              // Pass original item ID for image copy
              _originalItemId: copyItemRow?.itemID,
            },
          },
        })
      } else {
        showToast("Failed to load item data for copy", "error")
      }
    } catch (error) {
      console.error("Error copying item:", error)
      showToast("Error copying item", "error")
    }
  }, [copyItemRow, openTab, showToast])

  // Keyboard shortcut: Ctrl+G to copy item
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "g") {
        e.preventDefault()
        e.stopPropagation()

        // Use the last selected/right-clicked row, or check if there's a single selected row
        const targetRow = lastSelectedRowRef.current
        if (targetRow) {
          handleCopyItem(targetRow)
        } else if (selectedRows.size === 1) {
          // Find the row data from grid data
          const selectedId = Array.from(selectedRows)[0]
          const row = gridDataRef.current.find(
            (r: any) => r.itemStoreID === selectedId
          )
          if (row) {
            handleCopyItem(row)
          } else {
            showToast("Please select an item to copy", "info")
          }
        } else if (selectedRows.size > 1) {
          showToast("Please select only one item to copy", "info")
        } else {
          showToast("Please select an item to copy (right-click or checkbox)", "info")
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleCopyItem, selectedRows, showToast])

  // Update lastSelectedRowRef when a row is right-clicked (via context menu interaction)
  // This is handled by the handleCopyItem callback itself

  // Handle Adjust Inventory from context menu
  const handleAdjustInventory = useCallback((row: ItemRecord) => {
    // Block matrix items (itemType === 2) per old VB.NET logic
    if (row.itemType === 2) {
      showToast("Matrix items cannot be adjusted individually", "info")
      return
    }
    setAdjustItemRow(row)
    setIsAdjustModalOpen(true)
  }, [showToast])

  // Custom context menu items for items grid
  const copyContextMenuItem: CustomContextMenuItem = useMemo(() => ({
    label: "Copy Item",
    shortcut: "Ctrl + G",
    dividerBefore: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    ),
    onClick: (row: any) => {
      lastSelectedRowRef.current = row as ItemRecord
      handleCopyItem(row)
    },
  }), [handleCopyItem])

  const adjustContextMenuItem: CustomContextMenuItem = useMemo(() => ({
    label: "Adjust Inventory",
    dividerBefore: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    onClick: (row: any) => {
      handleAdjustInventory(row as ItemRecord)
    },
  }), [handleAdjustInventory])

  const priceHistoryContextMenuItem: CustomContextMenuItem = useMemo(() => ({
    label: "Price History",
    dividerBefore: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    onClick: (row: any) => {
      setPriceHistoryRow(row as ItemRecord)
      setIsPriceHistoryOpen(true)
    },
  }), [])

  const costHistoryContextMenuItem: CustomContextMenuItem = useMemo(() => ({
    label: "Cost History",
    dividerBefore: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    onClick: (row: any) => {
      setCostHistoryRow(row as ItemRecord)
      setIsCostHistoryOpen(true)
    },
  }), [])

  const salesHistoryContextMenuItem: CustomContextMenuItem = useMemo(() => ({
    label: "Sales History",
    dividerBefore: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    onClick: (row: any) => {
      setSalesHistoryRow(row as ItemRecord)
      setIsSalesHistoryOpen(true)
    },
  }), [])

  const quickReportContextMenuItem: CustomContextMenuItem = useMemo(() => ({
    label: "Quick Report",
    dividerBefore: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    onClick: (row: any) => {
      const item = row as ItemRecord
      openTab({
        component: "QuickReportPage",
        title: `Quick Report - ${item.name || item.barcodeNumber}`,
        closable: true,
        props: {
          itemStoreId: item.itemStoreID,
          itemId: item.itemID,
          upcCode: item.barcodeNumber,
          description: item.name,
          onHand: item.onHand,
        },
      })
    },
  }), [openTab])

  const printLabelContextMenuItem: CustomContextMenuItem = useMemo(() => ({
    label: "Print Label",
    dividerBefore: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
    ),
    onClick: (row: any) => {
      const item = row as ItemRecord
      if (item.itemStoreID == null) {
        showToast("This item has no store record to print a label for", "info")
        return
      }
      openPrintLabels([String(item.itemStoreID)])
    },
  }), [openPrintLabels, showToast])

  const handleToggleStatus = useCallback(async (item: ItemRecord) => {
    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.ITEMS.TOGGLE_STATUS(item.itemStoreID), {
        method: "PUT",
        headers,
      })
      const result = await response.json()
      if (result.isSuccess) {
        const newStatus = item.status >= 1 ? 0 : 1
        const isDeactivating = newStatus === 0
        // If deactivating and "Show Inactive" is not active, the item should leave the
        // list — trigger a full grid reload so it disappears immediately.
        if (isDeactivating && !activeQuickFilters.has("showInactive")) {
          setRemountKey((prev) => prev + 1)
        } else {
          // Otherwise just update the row in-place (status stays visible in current view)
          if (updateRowRef.current) {
            updateRowRef.current(item.itemStoreID, (row) => ({ ...row, status: newStatus }))
          }
          gridDataRef.current = gridDataRef.current.map((row: any) =>
            row.itemStoreID === item.itemStoreID
              ? { ...row, status: newStatus }
              : row
          )
        }
        showToast(result.message || "Status updated successfully", "success")
      } else {
        showToast(result.message || "Failed to update status", "error")
      }
    } catch {
      showToast("Error updating item status", "error")
    }
  }, [getAuthHeaders, showToast, activeQuickFilters])

  const toggleStatusContextMenuItem: CustomContextMenuItem = useMemo(() => ({
    label: (row: any) => row?.status === 0 ? "Activate" : "Deactivate",
    dividerBefore: true,
    icon: (row: any) => row?.status === 0 ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    onClick: (row: any) => {
      handleToggleStatus(row as ItemRecord)
    },
  }), [handleToggleStatus])

  // Handle disable/enable on phone order for single item (context menu) with confirmation
  const handleTogglePhoneOrder = useCallback(async (item: ItemRecord) => {
    const isCurrentlyDisabled = item.isDisableOnPO === true
    const actionText = isCurrentlyDisabled ? "enable" : "disable"

    const confirmed = await confirm({
      title: `${isCurrentlyDisabled ? "Enable" : "Disable"} on PO`,
      message: `Are you sure you want to ${actionText} "${item.name || "this item"}" on phone orders?`,
      confirmLabel: isCurrentlyDisabled ? "Enable" : "Disable",
      variant: isCurrentlyDisabled ? "primary" : "danger",
    })
    if (!confirmed) return

    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.ITEMS.BULK_TOGGLE_PHONE_ORDER, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ itemStoreIds: [item.itemStoreID] }),
      })
      const result = await response.json()
      if (result.isSuccess) {
        const newValue = !isCurrentlyDisabled
        if (updateRowRef.current) {
          updateRowRef.current(item.itemStoreID, (row: any) => ({ ...row, isDisableOnPO: newValue }))
        }
        gridDataRef.current = gridDataRef.current.map((row: any) =>
          row.itemStoreID === item.itemStoreID ? { ...row, isDisableOnPO: newValue } : row
        )
        showToast(result.message || `Item ${actionText}d on phone orders`, "success")
      } else {
        showToast(result.message || "Failed to update phone order status", "error")
      }
    } catch {
      showToast("Error updating phone order status", "error")
    }
  }, [getAuthHeaders, showToast, confirm])

  const disablePhoneOrderContextMenuItem: CustomContextMenuItem = useMemo(() => ({
    label: (row: any) => row?.isDisableOnPO === true ? "Enable on PO" : "Disable on PO",
    icon: (row: any) => row?.isDisableOnPO === true ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <line x1="9" y1="9" x2="15" y2="15" />
        <line x1="15" y1="9" x2="9" y2="15" />
      </svg>
    ),
    onClick: (row: any) => {
      handleTogglePhoneOrder(row as ItemRecord)
    },
  }), [handleTogglePhoneOrder])

  const auditHistoryContextMenuItem: CustomContextMenuItem = useMemo(() => ({
    label: "Audit History",
    dividerBefore: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    onClick: (row: any) => {
      const item = row as ItemRecord
      setAuditEntityId(item.itemStoreID)
      setAuditEntityName(item.name || "")
      setIsAuditHistoryOpen(true)
    },
  }), [])

  const getRowClassName = useCallback((row: any) => {
    // Matrix parent rows (ItemType 2 — Standard=0|MatrixChild=1|Matrix=2|Service=3)
    // get a darker row so users can tell parents from standard items and matrix
    // children at a glance, matching the legacy desktop list emphasis.
    const cls: string[] = []
    if (row?.itemType === 2) cls.push("matrix-parent-row")
    if (row?.status === 0) cls.push("inactive-row")
    return cls.join(" ")
  }, [])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-lg ring-1 ring-gray-900/5 dark:ring-white/10 min-w-[340px] max-w-[400px] transition-all duration-300 animate-slide-in">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                toast.type === "success" ? "bg-green-50 dark:bg-green-500/10" :
                toast.type === "error" ? "bg-red-50 dark:bg-red-500/10" :
                "bg-brand-50 dark:bg-brand-500/10"
              }`}>
                {toast.type === "success" ? (
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                ) : toast.type === "error" ? (
                  <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {toast.type === "success" ? "Success" : toast.type === "error" ? "Error" : "Info"}
                </p>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{toast.message}</p>
              </div>
              <button
                onClick={() => setToast({ show: false, message: "", type: "success" })}
                className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-3 w-full bg-gray-100 dark:bg-gray-700 rounded-full h-0.5 overflow-hidden">
              <div
                className={`h-0.5 rounded-full ${
                  toast.type === "success" ? "bg-green-500" : toast.type === "error" ? "bg-red-500" : "bg-brand-500"
                }`}
                style={{ width: "100%", animation: "progressBar 3s linear forwards" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Quick Filters Bar */}
      <div className="flex items-center overflow-x-auto flex-nowrap" style={{ gap: '6px', padding: '7px 20px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', scrollbarWidth: 'none' }}>
        <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#94a3b8', whiteSpace: 'nowrap', marginRight: '2px' }}>Quick filters:</span>
        {[
          { key: "saleItems", label: "Items On Special", icon: (
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
          )},
          { key: "showInactive", label: "Show Inactive", icon: (
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/><path d="M4.93 4.93l14.14 14.14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          )},
        ].map((filter) => {
          const isActive = activeQuickFilters.has(filter.key)
          return (
            <button
              key={filter.key}
              onClick={() => handleQuickFilterToggle(filter.key)}
              className="inline-flex items-center whitespace-nowrap transition-all duration-100"
              style={{
                gap: '5px',
                height: '26px',
                padding: '0 10px',
                borderRadius: '99px',
                border: `1px solid ${isActive ? '#93c5fd' : '#e2e8f0'}`,
                background: isActive ? '#dbeafe' : '#ffffff',
                color: isActive ? '#1e40af' : '#475569',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.6 }}>{filter.icon}</span>
              {filter.label}
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        {activeQuickFilters.size > 0 && (
          <button
            onClick={handleClearFilters}
            style={{
              height: '26px', padding: '0 10px',
              borderRadius: '6px', border: 'none',
              background: 'transparent',
              color: '#94a3b8',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Action Header with Search/Refresh/Export/Print */}
      <ActionHeader
        selectedCount={selectedRows.size}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onBulkDelete={handleBulkDelete}
        onBulkExport={handleBulkExport}
        onBulkActivate={handleBulkActivate}
        onBulkDeactivate={handleBulkDeactivate}
        onBulkDisablePhoneOrder={handleBulkDisablePhoneOrder}
        onBulkEnablePhoneOrder={handleBulkEnablePhoneOrder}
        onBulkChanges={handleBulkChanges}
        onBulkPrintLabels={handleBulkPrintLabels}
        totalCount={totalRecords}
        loadedCount={loadedCount}
        itemType="items"
        onAddNew={handleAddItem}
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
        gridId={ITEMS_GRID_ID}
      />

      {/* Summary Cards */}
      {canViewSummary && (
        <div className="grid grid-cols-5 gap-[10px] px-5 py-[14px] flex-shrink-0">
          {[
            {
              label: "TOTAL ITEMS",
              value: summaryStats.totalItems.toLocaleString(),
              sub: "in catalog",
            },
            {
              label: "PRICE SUM",
              value: `$${summaryStats.priceSum >= 1000000 ? (summaryStats.priceSum / 1000000).toFixed(2) + "M" : summaryStats.priceSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              sub: `${summaryStats.shownCount} shown`,
            },
            {
              label: "COST SUM",
              value: `$${summaryStats.costSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              sub: `${summaryStats.shownCount} shown`,
            },
            {
              label: "AVG PC COST",
              value: `$${summaryStats.avgPcCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              sub: `${summaryStats.shownCount} shown`,
            },
            {
              label: "ON HAND VALUE",
              value: `$${summaryStats.onHandValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              sub: `${summaryStats.shownCount} shown`,
            },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white dark:bg-gray-800 rounded-lg border border-[#e2e8f0] dark:border-gray-700"
              style={{ padding: '10px 14px' }}
            >
              <div style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '4px' }}>
                {card.label}
              </div>
              {summaryStats.shownCount === 0 && summaryStats.totalItems === 0 ? (
                <>
                  <div className="h-6 w-20 rounded mt-0.5 skeleton-pulse" />
                  <div className="h-3 w-14 rounded mt-1.5 skeleton-pulse" />
                </>
              ) : (
                <>
                  <div style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.02em', color: '#0f172a', lineHeight: 1.3 }}>
                    {card.value}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    {card.sub}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main Grid Component */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '0 20px 14px' }}>
        <ServerGrid
          key={`items-grid-${remountKey}`} // More explicit key naming
          data={[]}
          columns={columns}
          loading={false}
          error={null}
          totalRecords={totalRecords} // set total records from server grid
          onRowUpdate={handleRowUpdate}
          onRefresh={() => {}}
          pagination={true}
          pageSize={50}
          editable={true}
          columnChooser={true}
          title="Items List"
          emptyMessage="No items found in the inventory"
          emptyIcon="📦"
          serverSide={true}
          apiUrl={API_ENDPOINTS.ITEMS.GET_ALL_ITEMS}
          methodType="GET"
          getAuthHeaders={memoizedGetAuthHeaders}
          defaultSortColumn="itemID"
          containerWidth="47%"
          additionalParams={additionalParams} // Pass API parameters directly
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
          getRowId={(row) => row.itemStoreID}
          onSelectAll={(selectAllFn) => {
            serverGridSelectAllRef.current = selectAllFn
          }}
          headerSearch={true}
          infiniteScroll={false}
          onRowClick={handleGridRowClick}
          onRowDoubleClick={handleRowDoubleClickWrapper}
          onView={handleViewItem}
          onEdit={handleEditItem}
          onDelete={handleDeleteItem}
          gridId={ITEMS_GRID_ID}
          onColumnVisibilityChange={updateColumnVisibility}
          onColumnWidthChange={updateColumnWidth}
          onColumnsChange={handleColumnsChange}
          columnAggregates={columnAggregates}
          onAggregateChange={updateColumnAggregate}
          onDataChange={handleGridDataChange}
          customContextMenuItems={[copyContextMenuItem, adjustContextMenuItem, priceHistoryContextMenuItem, costHistoryContextMenuItem, salesHistoryContextMenuItem, quickReportContextMenuItem, printLabelContextMenuItem, toggleStatusContextMenuItem, disablePhoneOrderContextMenuItem, auditHistoryContextMenuItem]}
          getRowClassName={getRowClassName}
          onExposeUpdateRow={(fn) => { updateRowRef.current = fn }}
          footerStats={[
            { label: "Price sum", value: `$${summaryStats.priceSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` },
            { label: "Cost sum", value: `$${summaryStats.costSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
            { label: "Count", value: summaryStats.shownCount.toLocaleString() },
            { label: "PC Cost avg", value: `$${summaryStats.avgPcCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
            { label: "On Hand", value: `$${summaryStats.onHandValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          ]}
        />
      </div>

      {/* Slide-over panel (opens on grid row click) */}
      {isQuickEditOpen && quickEditRow && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-[60]"
            onClick={handleQuickEditBackdropClick}
          />

          <div
            className="fixed top-0 right-0 h-full w-[420px] z-[70] bg-white shadow-2xl border-l border-gray-200 flex flex-col item-detail-v6"
            role="dialog"
            aria-modal="true"
          >
            {/* Panel header */}
            <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-start gap-3 flex-shrink-0">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                <span className="inline-block w-[6px] h-[6px] rounded-full bg-green-500" />
                Active
              </span>

              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">
                  {quickEditRow.name}
                </div>
                <div className="text-[11px] text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">
                  {quickEditRow.barcodeNumber}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="w-7 h-7 rounded-md border border-gray-200 bg-white hover:bg-slate-50 text-slate-600"
                  onClick={() => moveQuickEdit(-1)}
                  disabled={quickEditIndex <= 0}
                >
                  ‹
                </button>
                <div className="text-[11px] text-slate-500 whitespace-nowrap">
                  {quickEditRows.length ? `${quickEditIndex + 1} / ${quickEditRows.length}` : "—"}
                </div>
                <button
                  type="button"
                  className="w-7 h-7 rounded-md border border-gray-200 bg-white hover:bg-slate-50 text-slate-600"
                  onClick={() => moveQuickEdit(1)}
                  disabled={quickEditIndex >= quickEditRows.length - 1}
                >
                  ›
                </button>
              </div>

              <button
                type="button"
                className="w-8 h-8 rounded-md border border-gray-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center"
                onClick={closeQuickEdit}
                aria-label="Close"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Vitals strip */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-gray-200">
              <div className="flex rounded-lg overflow-hidden border border-gray-200">
                <div className="flex-1 px-2 py-1.5 text-center border-r last:border-r-0 border-gray-200">
                  <div className="text-[9px] font-bold tracking-wider uppercase text-slate-500">Price</div>
                  <div className="text-[14px] font-bold text-gray-900">{fmtMoney(qPrice)}</div>
                </div>
                <div className="flex-1 px-2 py-1.5 text-center border-r last:border-r-0 border-gray-200">
                  <div className="text-[9px] font-bold tracking-wider uppercase text-slate-500">Cost</div>
                  <div className="text-[14px] font-bold text-gray-900">{fmtMoney(qCost)}</div>
                </div>
                <div className="flex-1 px-2 py-1.5 text-center border-r last:border-r-0 border-gray-200">
                  <div className="text-[9px] font-bold tracking-wider uppercase text-slate-500">Margin</div>
                  <div
                    className={`text-[14px] font-bold ${
                      qMarginPct > 0 ? "text-green-700" : qMarginPct < 0 ? "text-red-700" : "text-slate-600"
                    }`}
                  >
                    {fmtPct(qMarginPct, 1)}
                  </div>
                </div>
                <div className="flex-1 px-2 py-1.5 text-center border-r last:border-r-0 border-gray-200">
                  <div className="text-[9px] font-bold tracking-wider uppercase text-slate-500">On Hand</div>
                  <div
                    className={`text-[14px] font-bold ${
                      qOnHand > 0 ? "text-green-700" : qOnHand < 0 ? "text-red-700" : "text-slate-600"
                    }`}
                  >
                    {qOnHand}
                  </div>
                </div>
                <div className="flex-1 px-2 py-1.5 text-center">
                  <div className="text-[9px] font-bold tracking-wider uppercase text-slate-500">On Order</div>
                  <div className="text-[14px] font-bold text-slate-800">{qOnOrder}</div>
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {/* Identity */}
              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-bold tracking-wider uppercase text-slate-500 pb-1 border-b border-slate-200">
                  Identity
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Item Name</label>
                  <input
                    className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                    value={quickEditRow.name}
                    readOnly
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">UPC / Barcode</label>
                    <input
                      className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                      value={quickEditRow.barcodeNumber || ""}
                      readOnly
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Model #</label>
                    <input
                      className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                      value={quickEditRow.modalNumber || ""}
                      readOnly
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Case UPC</label>
                    <input
                      className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                      value={quickEditRow.caseBarcodeNumber || ""}
                      readOnly
                      placeholder="—"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-bold tracking-wider uppercase text-slate-500 pb-1 border-b border-slate-200">
                  Pricing
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Sell Price</label>
                    <input
                      className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                      inputMode="decimal"
                      value={editPriceText}
                      onChange={(e) => {
                        const raw = e.target.value
                        setEditPriceText(raw)
                        const normalized = raw.replace(",", ".")
                        const parsed = normalized === "" ? NaN : parseFloat(normalized)
                        setEditPrice(Number.isFinite(parsed) ? parsed : 0)
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Margin %</label>
                    <input
                      className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                      value={qMarginPct.toFixed(2)}
                      readOnly
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Markup %</label>
                    <input
                      className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                      value={qMarkupPct.toFixed(0)}
                      readOnly
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Case Price</label>
                    <input
                      className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                      value={(qPrice * qCaseQty).toFixed(2)}
                      readOnly
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">List Price</label>
                    <input
                      className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                      value="0.00"
                      readOnly
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Markdown %</label>
                    <input
                      className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                      value="0.00"
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* Cost */}
              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-bold tracking-wider uppercase text-slate-500 pb-1 border-b border-slate-200">
                  Cost
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Unit Cost</label>
                    <input
                      className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                      inputMode="decimal"
                      value={editCostText}
                      onChange={(e) => {
                        const raw = e.target.value
                        setEditCostText(raw)
                        const normalized = raw.replace(",", ".")
                        const parsed = normalized === "" ? NaN : parseFloat(normalized)
                        setEditCost(Number.isFinite(parsed) ? parsed : 0)
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Case Qty</label>
                    <input
                      className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                      value={qCaseQty}
                      onChange={(e) => {
                        const parsed = Number(e.target.value)
                        setEditCaseQty(Number.isFinite(parsed) ? parsed : 0)
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Case Cost</label>
                    <input
                      className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                      value={(qCost * qCaseQty).toFixed(2)}
                      readOnly
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Gross Profit</label>
                    <div
                      className={`h-9 px-3 border rounded-md flex items-center ${
                        qProfit > 0 ? "bg-green-50 border-green-200 text-green-800" : qProfit < 0 ? "bg-red-50 border-red-200 text-red-800" : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}
                    >
                      ${qProfit.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Main Supplier</label>
                    <input
                      className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                      value={quickEditRow.supplierName || ""}
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* Classification */}
              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-bold tracking-wider uppercase text-slate-500 pb-1 border-b border-slate-200">
                  Classification
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Item Type</label>
                    <select
                      className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                      value={quickEditRow.itemTypeName || ""}
                      disabled
                    >
                      <option value={quickEditRow.itemTypeName || ""}>{quickEditRow.itemTypeName || "—"}</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Department</label>
                    <select
                      className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                      value={quickEditRow.department || ""}
                      disabled
                    >
                      <option value={quickEditRow.department || ""}>{quickEditRow.department || "—"}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Location</label>
                    <input
                      className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                      value={quickEditRow.binLocation || ""}
                      readOnly
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Groups</label>
                    <input
                      className="h-9 px-3 border border-slate-300 rounded-md bg-slate-50 text-sm w-full"
                      value={[quickEditRow.matrix1, quickEditRow.matrix2].filter(Boolean).join(", ")}
                      readOnly
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  {[
                    { label: "Taxable", checked: !!quickEditRow.isTaxable },
                    { label: "Discountable", checked: !!quickEditRow.isDiscount },
                    { label: "WIC", checked: !!quickEditRow.isWIC },
                    { label: "FS", checked: !!quickEditRow.isFoodStampable },
                  ].map((opt) => (
                    <label key={opt.label} className="flex items-center gap-2 text-[12px] text-slate-700">
                      <input type="checkbox" checked={opt.checked} readOnly />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="mt-2 w-full h-10 border border-slate-200 rounded-md bg-slate-50 text-slate-700 hover:bg-slate-100"
                onClick={() => {
                  const itemListNavigation: ItemListNavigationState | undefined =
                    quickEditRows.length > 0
                      ? {
                          totalCount: totalRecords,
                          itemStoreIds: quickEditRows.map((r) => r.itemStoreID),
                          itemTitles: quickEditRows.map((r) => r.name || "Item"),
                          index: quickEditIndex,
                        }
                      : undefined
                  openTab({
                    component: "ItemFormPage",
                    title: `Item: ${quickEditRow.name || "Item"}`,
                    closable: true,
                    editMode: true,
                    props: {
                      id: quickEditRow.itemStoreID,
                      ...(itemListNavigation && { itemListNavigation }),
                    },
                  })
                  closeQuickEdit()
                }}
              >
                Open All Item Details
              </button>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200 bg-slate-50 flex flex-wrap items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 flex-1 min-w-[180px] border-gray-200">
                <select className="h-8 border border-slate-300 rounded-md px-2 bg-white text-sm flex-1 min-w-0" defaultValue={currentStore?.storeName || ""} disabled>
                  <option value={currentStore?.storeName || ""}>{currentStore?.storeName || "Store"}</option>
                </select>
                <label className="flex items-center gap-2 text-[12px] text-slate-700 whitespace-nowrap flex-shrink-0">
                  <input type="checkbox" checked readOnly />
                  <span>Save to All Stores</span>
                </label>
              </div>

              <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                <button
                  type="button"
                  className="h-8 px-3 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                  onClick={() => { if (quickEditRow?.itemStoreID != null) openPrintLabels([String(quickEditRow.itemStoreID)]) }}
                  title="Print a barcode label for this item"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  <span className="text-[12px] font-semibold">Print Label</span>
                </button>
                <button
                  type="button"
                  className="h-8 px-3 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  onClick={closeQuickEdit}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="h-9 px-5 rounded-md bg-brand-600 text-white hover:bg-brand-700 flex items-center gap-2"
                  onClick={handleQuickEditSave}
                  disabled={isQuickEditSaving}
                >
                  <span className="text-[12px] font-semibold">{isQuickEditSaving ? "Saving..." : "Save"}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Copy Item Modal */}
      <CopyItemModal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        onConfirm={handleCopyConfirm}
        selectedItem={copyItemRow ? {
          itemID: copyItemRow.itemID,
          name: copyItemRow.name,
          barcodeNumber: copyItemRow.barcodeNumber,
          modalNumber: copyItemRow.modalNumber,
        } : null}
      />

      {/* Adjust Inventory Modal */}
      <AdjustInventoryModal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        onSaved={() => {
          setIsAdjustModalOpen(false)
          showToast("Inventory adjusted successfully", "success")
          setRemountKey((prev) => prev + 1)
        }}
        item={adjustItemRow ? {
          itemStoreID: adjustItemRow.itemStoreID,
          name: adjustItemRow.name,
          barcodeNumber: adjustItemRow.barcodeNumber,
          onHand: adjustItemRow.onHand,
          cost: adjustItemRow.cost,
        } : null}
      />

      {/* Price History Modal */}
      <PriceHistoryModal
        isOpen={isPriceHistoryOpen}
        onClose={() => setIsPriceHistoryOpen(false)}
        item={priceHistoryRow ? {
          itemStoreID: priceHistoryRow.itemStoreID,
          name: priceHistoryRow.name,
          barcodeNumber: priceHistoryRow.barcodeNumber,
        } : null}
      />

      {/* Cost History Modal */}
      <PriceHistoryModal
        isOpen={isCostHistoryOpen}
        onClose={() => setIsCostHistoryOpen(false)}
        item={costHistoryRow ? {
          itemStoreID: costHistoryRow.itemStoreID,
          name: costHistoryRow.name,
          barcodeNumber: costHistoryRow.barcodeNumber,
        } : null}
        priceLevel="Cost"
      />

      {/* Sales History Modal */}
      <SalesHistoryModal
        isOpen={isSalesHistoryOpen}
        onClose={() => setIsSalesHistoryOpen(false)}
        item={salesHistoryRow ? {
          itemStoreID: salesHistoryRow.itemStoreID,
          name: salesHistoryRow.name,
          barcodeNumber: salesHistoryRow.barcodeNumber,
        } : null}
      />

      {ConfirmDialog}
      <AuditHistoryModal
        isOpen={isAuditHistoryOpen}
        onClose={() => setIsAuditHistoryOpen(false)}
        entityType="ItemStore"
        entityId={auditEntityId}
        entityName={auditEntityName}
      />

      <ExportModal {...exportModal.modalProps} />

      <PrintLabelsDialog
        isOpen={isPrintLabelsOpen}
        onClose={() => setIsPrintLabelsOpen(false)}
        itemStoreIds={printLabelsIds}
        labelType={1}
      />

    </div>
  )
})

export default ItemListPage
