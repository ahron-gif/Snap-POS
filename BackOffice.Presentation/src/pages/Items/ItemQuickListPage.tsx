import React, { useState, useCallback, memo, useMemo, useRef, useEffect } from "react"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { CustomContextMenuItem } from "../../components/common/ServerGrid/components/GridBody"
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
import PrintLabelsDialog from "../LabelDesigner/components/PrintLabelsDialog"
import ExportModal from "../../components/common/ExportModal"
import axios from "axios"
import type { ItemListNavigationState } from "./ItemFormPage"
// Context-menu modals — same set as ItemListPage so the right-click menu offers
// the full nine item-specific actions on Quick List too.
import CopyItemModal, { CopyItemData } from "./CopyItemModal"
import AdjustInventoryModal from "./AdjustInventoryModal"
import PriceHistoryModal from "./PriceHistoryModal"
import SalesHistoryModal from "./SalesHistoryModal"
import AuditHistoryModal from "../../components/common/AuditHistoryModal"
import { itemService } from "../../services/itemService"
import { useConfirm } from "../../components/ui/ConfirmModal"

// Item Quick List record interface (matches ItemsQuickListView)
interface ItemQuickListRecord {
  itemStoreID: string
  itemID: string
  department: string | null
  name: string | null
  modelNo: string | null
  upc: string | null
  supplier: string | null
  storeNo: string
  price: number
  onHand: number | null
}

// Column definitions for items quick list
const itemQuickListColumnDefs: GridColDef[] = [
  {
    field: "department",
    headerName: "Department",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "name",
    headerName: "Name",
    width: 280,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "modelNo",
    headerName: "Model No",
    width: 140,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "upc",
    headerName: "UPC",
    width: 160,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "supplier",
    headerName: "Supplier",
    width: 160,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "price",
    headerName: "Price",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value != null ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "onHand",
    headerName: "On Hand",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value != null ? Number(value).toFixed(2) : "0.00",
  },
]

const ITEMS_QUICK_LIST_GRID_ID = "items-quick-list"

const ItemQuickListPage: React.FC = memo(() => {
  const { openTab } = useDashboardTabs()
  const { currentStore } = useStore()
  const { getAuthHeaders } = useAuthHeaders()

  // Search state
  const [searchText, setSearchText] = useState("")
  const [debouncedSearchText, setDebouncedSearchText] = useState("")

  // Grid state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [totalRecords, setTotalRecords] = useState(0)
  const [loadedCount, setLoadedCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [remountKey, setRemountKey] = useState(0)

  // Toast state
  const [toast, setToast] = useState<{
    show: boolean
    message: string
    type: "success" | "error" | "info"
  }>({
    show: false,
    message: "",
    type: "success",
  })

  // Refs
  const pageNavigationRef = React.useRef<{
    goToFirstPage: () => void
    goToPreviousPage: () => void
    goToNextPage: () => void
    goToLastPage: () => void
  } | null>(null)

  const gridDataRef = useRef<any[]>([])
  const serverGridSelectAllRef = React.useRef<(() => void) | null>(null)

  // Memoized auth headers
  const memoizedGetAuthHeaders = useCallback(() => getAuthHeaders(), [getAuthHeaders])

  // Default columns
  const defaultColumns = useMemo(() => convertToGridColumns(itemQuickListColumnDefs), [])

  // Grid settings hook (user-level visibility / width / aggregate state)
  const {
    columns: userPrefColumns,
    setColumns,
    updateColumnVisibility,
    updateColumnWidth,
    columnAggregates,
    updateColumnAggregate,
  } = useGridSettings(ITEMS_QUICK_LIST_GRID_ID, defaultColumns)

  // Super-Admin ceiling: strip columns the tenant default has restricted, so
  // they never reach the grid OR the column chooser. Applies displayName /
  // sortOrder overrides too. Runs AFTER useGridSettings so the filter reacts
  // to the asynchronously-loaded access rules.
  const { filteredColumns: columns } = useColumnAccessFilter(ITEMS_QUICK_LIST_GRID_ID, userPrefColumns)

  // Show toast
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      setToast({ show: true, message, type })
      setTimeout(() => {
        setToast({ show: false, message: "", type: "success" })
      }, 3000)
    },
    []
  )

  // Search handlers
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchInputChange = useCallback(
    (value: string) => {
      setSearchText(value)

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }

      searchTimeoutRef.current = setTimeout(() => {
        setDebouncedSearchText(value)
        setRemountKey((prev) => prev + 1)
      }, 500)
    },
    []
  )

  const handleSearchKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current)
        }
        setDebouncedSearchText(searchText)
        setRemountKey((prev) => prev + 1)
      }
    },
    [searchText]
  )

  // Additional params for server grid
  const additionalParams = useMemo(() => {
    const params: Record<string, string> = {}

    if (currentStore?.storeId) {
      params.storeId = currentStore.storeId
    }

    if (debouncedSearchText.trim()) {
      params.CustomGridSearchText = debouncedSearchText.trim()
      params.CustomGridSearchColumns = "department,name,modelNo,upc,supplier"
    }

    return params
  }, [currentStore?.storeId, debouncedSearchText])

  // Row selection handler (toggles individual row)
  const handleRowSelection = useCallback((rowId: string) => {
    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = new Set(prevSelectedRows)
      if (newSelectedRows.has(rowId)) {
        newSelectedRows.delete(rowId)
      } else {
        newSelectedRows.add(rowId)
      }
      return newSelectedRows
    })
  }, [])

  /** For ItemFormPage vitals pager: order and titles match rows currently buffered in the grid. */
  const buildItemListNavigationForRow = useCallback(
    (row: ItemQuickListRecord): ItemListNavigationState | undefined => {
      const rows = (gridDataRef.current as ItemQuickListRecord[]) || []
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

  // View item handler
  const handleViewItem = useCallback(
    (row: ItemQuickListRecord) => {
      openTab({
        component: "ItemViewPage",
        title: `View: ${row.name || "Item"}`,
        closable: true,
        props: { id: row.itemStoreID },
      })
    },
    [openTab]
  )

  // Edit item handler
  const handleEditItem = useCallback(
    (row: ItemQuickListRecord) => {
      const itemListNavigation = buildItemListNavigationForRow(row)
      openTab({
        component: "ItemFormPage",
        title: `Edit: ${row.name || "Item"}`,
        closable: true,
        editMode: true,
        props: { id: row.itemStoreID, ...(itemListNavigation && { itemListNavigation }) },
      })
    },
    [openTab, buildItemListNavigationForRow],
  )

  // Handle inline cell edits (no-op for server-side grid)
  const handleRowUpdate = useCallback(async (_updatedRow: ItemQuickListRecord) => {
    // Intentionally empty: double-click navigation is handled by onRowDoubleClick.
  }, [])

  // Handle double-click on a row → open full edit tab
  const handleRowDoubleClick = useCallback(
    (row: ItemQuickListRecord) => {
      const itemListNavigation = buildItemListNavigationForRow(row)
      openTab({
        component: "ItemFormPage",
        title: `Edit: ${row.name || "Item"}`,
        closable: true,
        editMode: true,
        props: { id: row.itemStoreID, ...(itemListNavigation && { itemListNavigation }) },
      })
    },
    [openTab, buildItemListNavigationForRow],
  )

  // ── Confirmation modal hook — used by Disable/Enable on PO ────────────────
  const { confirm, ConfirmDialog } = useConfirm()

  // ── State for the context-menu modals (Copy / Adjust / Price / Cost /
  //    Sales / Audit) — mirrors ItemListPage's setup so each menu item can
  //    open its own modal without leaving the Quick List tab. ──────────────
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false)
  const [copyItemRow, setCopyItemRow] = useState<ItemQuickListRecord | null>(null)
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
  const [adjustItem, setAdjustItem] = useState<{ itemStoreID: string; name: string; barcodeNumber: string; onHand: number; cost: number } | null>(null)
  const [isPriceHistoryOpen, setIsPriceHistoryOpen] = useState(false)
  const [priceHistoryRow, setPriceHistoryRow] = useState<ItemQuickListRecord | null>(null)
  const [isCostHistoryOpen, setIsCostHistoryOpen] = useState(false)
  const [costHistoryRow, setCostHistoryRow] = useState<ItemQuickListRecord | null>(null)
  const [isSalesHistoryOpen, setIsSalesHistoryOpen] = useState(false)
  const [salesHistoryRow, setSalesHistoryRow] = useState<ItemQuickListRecord | null>(null)
  const [isAuditHistoryOpen, setIsAuditHistoryOpen] = useState(false)
  const [auditEntityId, setAuditEntityId] = useState("")
  const [auditEntityName, setAuditEntityName] = useState("")

  // Track the last right-clicked row so the Ctrl+G keyboard shortcut knows which
  // item to copy. Mirrors ItemListPage.lastSelectedRowRef.
  const lastSelectedRowRef = useRef<ItemQuickListRecord | null>(null)

  // ── Copy Item ─────────────────────────────────────────────────────────────
  // Quick List rows don't carry every field CopyItemModal needs (`modalNumber`,
  // `barcodeNumber`), so we adapt: `upc` → `barcodeNumber`, `modelNo` →
  // `modalNumber`. The Copy confirm path then lazy-fetches the FULL item via
  // itemService.getItem so the new tab gets all fields (cost, tax flags, etc.)
  // that the Quick List view doesn't expose.
  const handleCopyItem = useCallback((row: ItemQuickListRecord) => {
    setCopyItemRow(row)
    lastSelectedRowRef.current = row
    setIsCopyModalOpen(true)
  }, [])

  const handleCopyConfirm = useCallback(async (copyData: CopyItemData) => {
    setIsCopyModalOpen(false)
    try {
      const originalItemStoreId = copyItemRow?.itemStoreID
      if (!originalItemStoreId) {
        showToast("Could not find original item data", "error")
        return
      }
      const response = await itemService.getItem(originalItemStoreId)
      if (response.success && response.data) {
        openTab({
          component: "ItemFormPage",
          title: `Copy: ${copyData.name || "Item"}`,
          closable: true,
          editMode: true,
          props: {
            isNew: true,
            copyData: {
              ...response.data,
              name: copyData.name,
              barcodeNumber: copyData.barcodeNumber,
              modalNumber: copyData.modelNumber,
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

  // Ctrl+G keyboard shortcut → Copy Item (same UX as ItemListPage). Uses the
  // last right-clicked row, or the single checked row.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "g") {
        e.preventDefault()
        e.stopPropagation()
        const targetRow = lastSelectedRowRef.current
        if (targetRow) {
          handleCopyItem(targetRow)
        } else if (selectedRows.size === 1) {
          const selectedId = Array.from(selectedRows)[0]
          const row = gridDataRef.current.find((r: any) => r.itemStoreID === selectedId)
          if (row) handleCopyItem(row)
          else showToast("Please select an item to copy", "info")
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

  // ── Adjust Inventory ──────────────────────────────────────────────────────
  // The modal needs `cost`, which the Quick List row doesn't carry. Fetch the
  // full item first so the modal can show the current cost; if the fetch fails
  // we fall back to cost=0 so the user can still adjust on-hand (cost is a
  // display-only reference inside the modal, not part of the adjust payload).
  const handleAdjustInventory = useCallback(async (row: ItemQuickListRecord) => {
    try {
      const response = await itemService.getItem(row.itemStoreID)
      const full = response.success ? response.data as any : null
      // Block matrix items (itemType === 2) per Item List's rule — only if we
      // could fetch the full row; otherwise we let the server reject if it must.
      if (full && full.itemType === 2) {
        showToast("Matrix items cannot be adjusted individually", "info")
        return
      }
      setAdjustItem({
        itemStoreID: row.itemStoreID,
        name: row.name || "",
        barcodeNumber: row.upc || full?.barcodeNumber || "",
        onHand: row.onHand ?? full?.onHand ?? 0,
        cost: full?.cost ?? 0,
      })
      setIsAdjustModalOpen(true)
    } catch {
      // Fall back to whatever the row carries — cost will display as $0.00.
      setAdjustItem({
        itemStoreID: row.itemStoreID,
        name: row.name || "",
        barcodeNumber: row.upc || "",
        onHand: row.onHand ?? 0,
        cost: 0,
      })
      setIsAdjustModalOpen(true)
    }
  }, [showToast])

  // ── Toggle Status (Activate / Deactivate) ─────────────────────────────────
  // The Quick List row doesn't expose `status`, so we can't pick a specific
  // "Activate" vs "Deactivate" label. We use a neutral "Toggle Status" label;
  // the API flips internally and we remount to reflect the new state.
  const handleToggleStatus = useCallback(async (row: ItemQuickListRecord) => {
    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.ITEMS.TOGGLE_STATUS(row.itemStoreID), {
        method: "PUT",
        headers,
      })
      const result = await response.json()
      if (result.isSuccess) {
        showToast(result.message || "Status updated successfully", "success")
        setRemountKey((prev) => prev + 1)
      } else {
        showToast(result.message || "Failed to update status", "error")
      }
    } catch {
      showToast("Error updating item status", "error")
    }
  }, [getAuthHeaders, showToast])

  // ── Toggle on PO (Enable / Disable on Phone Order) ────────────────────────
  // Same situation as Toggle Status: Quick List doesn't expose `isDisableOnPO`,
  // so we ask for confirmation with a neutral message and let the server flip.
  const handleTogglePhoneOrder = useCallback(async (row: ItemQuickListRecord) => {
    const confirmed = await confirm({
      title: "Toggle on PO",
      message: `Toggle Phone Order eligibility for "${row.name || "this item"}"?`,
      confirmLabel: "Toggle",
      variant: "primary",
    })
    if (!confirmed) return
    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.ITEMS.BULK_TOGGLE_PHONE_ORDER, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ itemStoreIds: [row.itemStoreID] }),
      })
      const result = await response.json()
      if (result.isSuccess) {
        showToast(result.message || "Phone order setting updated", "success")
        setRemountKey((prev) => prev + 1)
      } else {
        showToast(result.message || "Failed to update phone order setting", "error")
      }
    } catch {
      showToast("Error updating phone order setting", "error")
    }
  }, [getAuthHeaders, showToast, confirm])

  // Context menu items — keep the original View / Edit and append the nine
  // item-specific actions in the same order ItemListPage uses, so users see
  // the exact same menu UX on both screens.
  // Print Labels dialog — opened from the right-click "Print Label" item.
  // Reuses LabelDesigner's PrintLabelsDialog, which guards printing until its
  // template + item data have loaded (isLoading), so it can't print a default.
  const [isPrintLabelsOpen, setIsPrintLabelsOpen] = useState(false)
  const [printLabelsIds, setPrintLabelsIds] = useState<string[]>([])
  const openPrintLabels = useCallback((ids: string[]) => {
    if (ids.length === 0) {
      showToast("Select an item to print a label", "info")
      return
    }
    setPrintLabelsIds(ids)
    setIsPrintLabelsOpen(true)
  }, [showToast])

  const customContextMenuItems: CustomContextMenuItem[] = useMemo(
    () => [
      {
        label: "View",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        ),
        onClick: (row: any) => handleViewItem(row as ItemQuickListRecord),
      },
      {
        label: "Edit",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        ),
        onClick: (row: any) => handleEditItem(row as ItemQuickListRecord),
      },
      {
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
          lastSelectedRowRef.current = row as ItemQuickListRecord
          handleCopyItem(row as ItemQuickListRecord)
        },
      },
      {
        label: "Adjust Inventory",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        ),
        onClick: (row: any) => handleAdjustInventory(row as ItemQuickListRecord),
      },
      {
        label: "Price History",
        dividerBefore: true,
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
        onClick: (row: any) => {
          setPriceHistoryRow(row as ItemQuickListRecord)
          setIsPriceHistoryOpen(true)
        },
      },
      {
        label: "Cost History",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        ),
        onClick: (row: any) => {
          setCostHistoryRow(row as ItemQuickListRecord)
          setIsCostHistoryOpen(true)
        },
      },
      {
        label: "Sales History",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        ),
        onClick: (row: any) => {
          setSalesHistoryRow(row as ItemQuickListRecord)
          setIsSalesHistoryOpen(true)
        },
      },
      {
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
          const item = row as ItemQuickListRecord
          openTab({
            component: "QuickReportPage",
            title: `Quick Report - ${item.name || item.upc || ""}`,
            closable: true,
            props: {
              itemStoreId: item.itemStoreID,
              itemId: item.itemID,
              upcCode: item.upc,
              description: item.name,
              onHand: item.onHand,
            },
          })
        },
      },
      {
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
          const item = row as ItemQuickListRecord
          if (item.itemStoreID == null) {
            showToast("This item has no store record to print a label for", "info")
            return
          }
          openPrintLabels([String(item.itemStoreID)])
        },
      },
      {
        label: "Toggle Status",
        dividerBefore: true,
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ),
        onClick: (row: any) => handleToggleStatus(row as ItemQuickListRecord),
      },
      {
        label: "Toggle on PO",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        ),
        onClick: (row: any) => handleTogglePhoneOrder(row as ItemQuickListRecord),
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
          const item = row as ItemQuickListRecord
          setAuditEntityId(item.itemStoreID)
          setAuditEntityName(item.name || "")
          setIsAuditHistoryOpen(true)
        },
      },
    ],
    [handleViewItem, handleEditItem, handleCopyItem, handleAdjustInventory, handleToggleStatus, handleTogglePhoneOrder, openTab, openPrintLabels, showToast]
  )

  // Remount handler
  const handleRemountGrid = useCallback(() => {
    setRemountKey((prev) => prev + 1)
  }, [])

  // Deselect all
  const handleDeselectAll = useCallback(() => {
    setSelectedRows(new Set())
  }, [])

  // Select all
  const handleSelectAll = useCallback(() => {
    if (serverGridSelectAllRef.current) {
      serverGridSelectAllRef.current()
    }
  }, [])

  // Bulk delete (no-op for read-only quick list)
  const handleBulkDelete = useCallback(() => {
    showToast("Delete is not available in Item Quick List", "info")
  }, [showToast])

  // Bulk export
  const handleBulkExport = useCallback(() => {
    showToast("Exporting selected items...", "info")
  }, [showToast])

  // Fetch all data for export
  const fetchAllData = useCallback(async (_dateFrom?: string, _dateTo?: string) => {
    try {
      const headers = getAuthHeaders()
      const response = await axios({
        method: "GET",
        url: API_ENDPOINTS.ITEMS.GET_ITEMS_QUICK_LIST,
        params: {
          startRow: 0,
          endRow: 1000000,
          sortColumn: "name",
          sortDirection: "asc",
          ...additionalParams,
        },
        headers,
      })

      if (response.data?.response?.data) {
        return response.data.response.data
      }
      return []
    } catch (error) {
      console.error("Error fetching all data for export:", error)
      return []
    }
  }, [getAuthHeaders, additionalParams])

  // Export handlers
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
    filename: "items-quick-list",
    pdfOptions: {
      title: "Items Quick List",
      subtitle: currentStore?.storeName || "All Stores",
      orientation: "landscape",
    },
  })

  // Export modal
  const exportModal = useExportModal({
    columns,
    fetchAllData,
    filename: "items-quick-list",
    pdfOptions: { title: "Items Quick List", orientation: "landscape" },
    dateFilterField: "dateCreated",
  })

  // Handle columns change from grid
  const handleColumnsChange = useCallback(
    (newColumns: any[]) => {
      setColumns(newColumns)
    },
    [setColumns]
  )

  // Callback to receive grid data from ServerGrid
  const handleGridDataChange = useCallback((data: any[]) => {
    gridDataRef.current = data
  }, [])

  return (
    <div
      className="items-quick-list-page p-2 mx-auto md:p-2 min-h-full"
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
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Action Header */}
      <ActionHeader
        selectedCount={selectedRows.size}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onBulkDelete={handleBulkDelete}
        onBulkExport={handleBulkExport}
        totalCount={totalRecords}
        loadedCount={loadedCount}
        itemType="items"
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
        gridId={ITEMS_QUICK_LIST_GRID_ID}
      />

      {/* Main Grid Component */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ServerGrid
          key={`items-quick-list-grid-${remountKey}`}
          data={[]}
          columns={columns}
          loading={false}
          error={null}
          totalRecords={totalRecords}
          onRowUpdate={handleRowUpdate}
          onRefresh={() => {}}
          pagination={true}
          pageSize={20}
          editable={true}
          columnChooser={true}
          title="Items Quick List"
          emptyMessage="No items found"
          emptyIcon="📦"
          serverSide={true}
          apiUrl={API_ENDPOINTS.ITEMS.GET_ITEMS_QUICK_LIST}
          methodType="GET"
          getAuthHeaders={memoizedGetAuthHeaders}
          defaultSortColumn="name"
          containerWidth="47%"
          additionalParams={additionalParams}
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
          infiniteScroll={true}
          onView={handleViewItem}
          onEdit={handleEditItem}
          gridId={ITEMS_QUICK_LIST_GRID_ID}
          onColumnVisibilityChange={updateColumnVisibility}
          onColumnWidthChange={updateColumnWidth}
          onColumnsChange={handleColumnsChange}
          columnAggregates={columnAggregates}
          onAggregateChange={updateColumnAggregate}
          onDataChange={handleGridDataChange}
          customContextMenuItems={customContextMenuItems}
          onRowDoubleClick={handleRowDoubleClick}
        />
      </div>

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

      {/* ── Context-menu modals ──────────────────────────────────────────── */}

      {/* Copy Item — opens a confirm modal that collects new name / barcode /
          model, then handleCopyConfirm fetches the FULL source item and opens
          ItemFormPage in copy mode. */}
      <CopyItemModal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        onConfirm={handleCopyConfirm}
        selectedItem={copyItemRow ? {
          itemID: copyItemRow.itemID,
          name: copyItemRow.name || "",
          // Quick List row uses `upc` + `modelNo`; CopyItemModal expects the
          // ItemList-style `barcodeNumber` + `modalNumber`. Adapt here.
          barcodeNumber: copyItemRow.upc || "",
          modalNumber: copyItemRow.modelNo,
        } : null}
      />

      {/* Adjust Inventory — `cost` is needed for the modal's reference display
          and is lazy-fetched by handleAdjustInventory before this opens. */}
      <AdjustInventoryModal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        onSaved={() => {
          setIsAdjustModalOpen(false)
          showToast("Inventory adjusted successfully", "success")
          setRemountKey((prev) => prev + 1)
        }}
        item={adjustItem}
      />

      {/* Price History */}
      <PriceHistoryModal
        isOpen={isPriceHistoryOpen}
        onClose={() => setIsPriceHistoryOpen(false)}
        item={priceHistoryRow ? {
          itemStoreID: priceHistoryRow.itemStoreID,
          name: priceHistoryRow.name || "",
          barcodeNumber: priceHistoryRow.upc || "",
        } : null}
      />

      {/* Cost History — same modal as Price History, with priceLevel="Cost"
          which flips its SP / column labels. Matches ItemListPage's reuse. */}
      <PriceHistoryModal
        isOpen={isCostHistoryOpen}
        onClose={() => setIsCostHistoryOpen(false)}
        item={costHistoryRow ? {
          itemStoreID: costHistoryRow.itemStoreID,
          name: costHistoryRow.name || "",
          barcodeNumber: costHistoryRow.upc || "",
        } : null}
        priceLevel="Cost"
      />

      {/* Sales History */}
      <SalesHistoryModal
        isOpen={isSalesHistoryOpen}
        onClose={() => setIsSalesHistoryOpen(false)}
        item={salesHistoryRow ? {
          itemStoreID: salesHistoryRow.itemStoreID,
          name: salesHistoryRow.name || "",
          barcodeNumber: salesHistoryRow.upc || "",
        } : null}
      />

      {/* Audit History */}
      <AuditHistoryModal
        isOpen={isAuditHistoryOpen}
        onClose={() => setIsAuditHistoryOpen(false)}
        entityType="ItemStore"
        entityId={auditEntityId}
        entityName={auditEntityName}
      />

      <PrintLabelsDialog
        isOpen={isPrintLabelsOpen}
        onClose={() => setIsPrintLabelsOpen(false)}
        itemStoreIds={printLabelsIds}
        labelType={1}
      />

      {/* Confirmation dialog (mounted by useConfirm) — used by Toggle on PO */}
      {ConfirmDialog}
    </div>
  )
})

ItemQuickListPage.displayName = "ItemQuickListPage"

export default ItemQuickListPage
