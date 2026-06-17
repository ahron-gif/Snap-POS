import React, { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges"
import { useTabFormCacheRead, useTabFormCacheWrite } from "../../hooks/useTabFormCache"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import Loader from "../../components/ui/loader/Loader"
import { useStore } from "../../context/StoreContext"
import { useDashboardTabs } from "../../context/DashboardTabContext"
import QuickReportModal from "./QuickReportModal"
import InventoryByStoreModal from "./InventoryByStoreModal"
import { useConfirm } from '../../components/ui/ConfirmModal'
import AuditHistoryModal from "../../components/common/AuditHistoryModal"
import { useExportModal } from "../../hooks/useExportModal"
import ExportModal from "../../components/common/ExportModal"
import { Column } from "../../gridUtils"

// Types
interface AdjustInventoryItem {
  itemID: string
  customerCode: string | null
  itemStoreID: string
  price: number | null
  cost: number | null
  name: string | null
  barcodeNumber: string | null
  modalNumber: string | null
  currentOnHand: number | null
  onHand: number | null
  countDate: string | null
  lastCount: number | null
  department: string | null
  // Client-side editable fields
  newQty: number | null
  difference: number | null
  reason: string
  adjustType: number
  accountNo: number
}

interface AdjustInventoryResponse {
  items: {
    itemID: string
    customerCode: string | null
    itemStoreID: string
    price: number | null
    cost: number | null
    name: string | null
    barcodeNumber: string | null
    modalNumber: string | null
    currentOnHand: number | null
    onHand: number | null
    countDate: string | null
    lastCount: number | null
    department: string | null
  }[]
  totalCount: number
  pageNumber: number
  pageSize: number
  totalPages: number
}

interface ApiResponse {
  isSuccess: boolean
  message: string
  response: AdjustInventoryResponse
}

// Dropdown options matching the old VB.NET app
const ADJUST_TYPES = [
  { value: 2, label: "Inventory Count" },
  { value: 3, label: "Theft" },
  { value: 4, label: "Damaged" },
  { value: 5, label: "FF/EMP" },
  { value: 6, label: "Expired" },
  { value: 7, label: "Other" },
]

const ACCOUNT_TYPES = [
  { value: 1, label: "General" },
]

const PAGE_SIZE = 100

interface AdjustInventoryPageProps {
  /** Injected by the tab renderer — required for the unsaved-changes guard. */
  __tabId?: string
}

const AdjustInventoryPage: React.FC<AdjustInventoryPageProps> = ({ __tabId }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { tabs, activeTabId, closeTab } = useDashboardTabs()
  const { confirm, ConfirmDialog } = useConfirm()
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // ── Per-tab cache: preserves edits across tab switches (in-memory only) ──
  // The page's "unsaved edits" live in `items[]` (newQty/reason/etc. per row)
  // and `modifiedItems` (the set of touched item ids). Cache both so flipping
  // away and back doesn't drop the user's in-progress count.
  interface AdjustInventoryCache {
    items: AdjustInventoryItem[]
    modifiedItems: string[]  // serialized Set
    currentPage: number
    searchText: string
    countedOnly: boolean
    discrepancyOnly: boolean
  }
  const { initial: cachedTabState, hasCachedState } =
    useTabFormCacheRead<AdjustInventoryCache>(__tabId)

  // State
  const [items, setItems] = useState<AdjustInventoryItem[]>(
    () => cachedTabState?.items ?? [],
  )
  const [loading, setLoading] = useState(!hasCachedState)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countedOnly, setCountedOnly] = useState(
    () => cachedTabState?.countedOnly ?? false,
  )
  const [discrepancyOnly, setDiscrepancyOnly] = useState(
    () => cachedTabState?.discrepancyOnly ?? false,
  )
  const [currentPage, setCurrentPage] = useState(
    () => cachedTabState?.currentPage ?? 1,
  )
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [searchInput, setSearchInput] = useState(
    () => cachedTabState?.searchText ?? "",
  )
  const [searchText, setSearchText] = useState(
    () => cachedTabState?.searchText ?? "",
  )
  const [modifiedItems, setModifiedItems] = useState<Set<string>>(
    () => new Set(cachedTabState?.modifiedItems ?? []),
  )
  const hasLoadedOnceRef = useRef(hasCachedState)

  // Serialize the modifiedItems Set to a sorted array for the cache write
  // (useEffect's reference equality requires a stable shape; the array survives
  // round-trip JSON identity better than a fresh Set).
  useTabFormCacheWrite<AdjustInventoryCache>(
    __tabId,
    hasLoadedOnceRef.current
      ? {
          items,
          modifiedItems: Array.from(modifiedItems),
          currentPage,
          searchText,
          countedOnly,
          discrepancyOnly,
        }
      : null,
  )
  const [selectedItemStoreId, setSelectedItemStoreId] = useState<string | null>(null)
  const [quickReportOpen, setQuickReportOpen] = useState(false)
  const [inventoryByStoreOpen, setInventoryByStoreOpen] = useState(false)
  const [isAuditHistoryOpen, setIsAuditHistoryOpen] = useState(false)
  const [toast, setToast] = useState<{
    show: boolean
    message: string
    type: "success" | "error" | "info"
  }>({ show: false, message: "", type: "success" })

  // Toast notification
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info") => {
      setToast({ show: true, message, type })
      setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000)
    },
    []
  )

  // Fetch data
  const fetchData = useCallback(
    async (page: number = 1, search: string = "", reversed: boolean = false) => {
      setLoading(true)
      setError(null)
      try {
        const headers = getAuthHeaders()
        const params = new URLSearchParams()
        params.append("countedOnly", countedOnly.toString())
        params.append("discrepancyOnly", discrepancyOnly.toString())
        if (currentStore?.storeId) {
          params.append("storeId", currentStore.storeId)
        }
        params.append("pageNumber", page.toString())
        params.append("pageSize", PAGE_SIZE.toString())
        if (search) {
          params.append("searchText", search)
        }

        const endpoint = reversed
          ? API_ENDPOINTS.ADJUST_INVENTORY.GET_ITEMS_FOR_ADJUST_REVERSED
          : API_ENDPOINTS.ADJUST_INVENTORY.GET_ITEMS_FOR_ADJUST

        const url = `${endpoint}?${params.toString()}`
        const response = await fetch(url, { method: "GET", headers })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result: ApiResponse = await response.json()

        if (result.isSuccess) {
          // Map API items to client items with editable fields
          const clientItems: AdjustInventoryItem[] = result.response.items.map((item) => ({
            ...item,
            newQty: null,
            difference: null,
            reason: "",
            adjustType: 2, // Default: Inventory Count
            accountNo: 1, // Default: General
          }))
          setItems(clientItems)
          setCurrentPage(result.response.pageNumber)
          setTotalCount(result.response.totalCount)
          setTotalPages(result.response.totalPages)
          setModifiedItems(new Set())
        } else {
          setError(result.message || "Failed to fetch data")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
        hasLoadedOnceRef.current = true
      }
    },
    [getAuthHeaders, currentStore?.storeId, countedOnly, discrepancyOnly]
  )

  // Initial fetch
  useEffect(() => {
    // Per-tab cache hit: items + modifiedItems + filters restored via useState
    // initializers. Skip the fetch so the user's in-progress count isn't lost.
    if (hasCachedState) {
      hasLoadedOnceRef.current = true
      return
    }
    fetchData(currentPage, searchText)
  }, [currentStore?.storeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value)
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      searchTimeoutRef.current = setTimeout(() => {
        setSearchText(value)
        setCurrentPage(1)
        fetchData(1, value)
      }, 500)
    },
    [fetchData]
  )

  // Page change
  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage < 1 || newPage > totalPages) return
      setCurrentPage(newPage)
      fetchData(newPage, searchText)
    },
    [totalPages, fetchData, searchText]
  )

  // Cell change handlers
  const handleNewQtyChange = useCallback(
    (itemStoreID: string, value: string) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.itemStoreID !== itemStoreID) return item
          const newQty = value === "" ? null : parseFloat(value)
          const onHand = item.onHand ?? 0
          return {
            ...item,
            newQty,
            difference: newQty !== null ? newQty - onHand : null,
          }
        })
      )
      setModifiedItems((prev) => new Set(prev).add(itemStoreID))
    },
    []
  )

  const handleDifferenceChange = useCallback(
    (itemStoreID: string, value: string) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.itemStoreID !== itemStoreID) return item
          const difference = value === "" ? null : parseFloat(value)
          const onHand = item.onHand ?? 0
          return {
            ...item,
            difference,
            newQty: difference !== null ? difference + onHand : null,
          }
        })
      )
      setModifiedItems((prev) => new Set(prev).add(itemStoreID))
    },
    []
  )

  const handleReasonChange = useCallback((itemStoreID: string, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.itemStoreID === itemStoreID ? { ...item, reason: value } : item))
    )
    setModifiedItems((prev) => new Set(prev).add(itemStoreID))
  }, [])

  const handleTypeChange = useCallback((itemStoreID: string, value: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.itemStoreID === itemStoreID ? { ...item, adjustType: value } : item
      )
    )
    setModifiedItems((prev) => new Set(prev).add(itemStoreID))
  }, [])

  const handleAccountChange = useCallback((itemStoreID: string, value: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.itemStoreID === itemStoreID ? { ...item, accountNo: value } : item
      )
    )
    setModifiedItems((prev) => new Set(prev).add(itemStoreID))
  }, [])

  // Update All: set NewQty = LastCount for all items with a count
  const handleUpdateAll = useCallback(() => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.lastCount != null) {
          const newQty = item.lastCount
          const onHand = item.onHand ?? 0
          setModifiedItems((prevMod) => new Set(prevMod).add(item.itemStoreID))
          return { ...item, newQty, difference: newQty - onHand }
        }
        return item
      })
    )
    showToast("Updated all items with physical count", "success")
  }, [showToast])

  // Zero Uncounted Count
  const handleZeroUncounted = useCallback(async () => {
    if (!await confirm({ title: 'Zero Uncounted Items', message: 'Are you sure you want to set the OnHand from all uncounted items to 0?', variant: 'warning' })) return
    setItems((prev) =>
      prev.map((item) => {
        if (item.lastCount == null) {
          const onHand = item.onHand ?? 0
          setModifiedItems((prevMod) => new Set(prevMod).add(item.itemStoreID))
          return {
            ...item,
            newQty: 0,
            difference: 0 - onHand,
            reason: "Set to zero, due to no-count",
          }
        }
        return item
      })
    )
    showToast("Uncounted items set to zero", "success")
  }, [showToast, confirm])

  // Change Qty to Minus
  const handleChangeQtyToMinus = useCallback(async () => {
    if (!await confirm({ title: 'Reverse Count', message: 'Reverse Count to Minus qty?', variant: 'warning' })) return
    fetchData(currentPage, searchText, true)
  }, [fetchData, currentPage, searchText, confirm])

  // Refresh On Hand
  const handleRefreshOnHand = useCallback(() => {
    fetchData(currentPage, searchText)
    showToast("On Hand refreshed", "success")
  }, [fetchData, currentPage, searchText, showToast])

  // Reset Physical Count
  const handleResetPhysicalCount = useCallback(async () => {
    if (!await confirm({ title: 'Reset Physical Count', message: 'Clear all inventory counts?', variant: 'danger' })) return
    try {
      const headers = getAuthHeaders()
      const params = new URLSearchParams()
      if (currentStore?.storeId) {
        params.append("storeId", currentStore.storeId)
      }
      const response = await fetch(
        `${API_ENDPOINTS.ADJUST_INVENTORY.RESET_PHYSICAL_COUNT}?${params.toString()}`,
        { method: "POST", headers }
      )
      const result = await response.json()
      if (result.isSuccess) {
        showToast("Physical count reset successfully", "success")
        fetchData(1, searchText)
      } else {
        showToast(result.message || "Failed to reset", "error")
      }
    } catch {
      showToast("Error resetting physical count", "error")
    }
  }, [getAuthHeaders, currentStore?.storeId, fetchData, searchText, showToast, confirm])

  // Save adjustments
  const handleSave = useCallback(
    async (clearAfter: boolean) => {
      const adjustments = items
        .filter((item) => item.difference !== null && item.difference !== 0)
        .map((item) => ({
          itemStoreNo: item.itemStoreID,
          qty: item.newQty ?? 0,
          oldQty: item.onHand ?? 0,
          adjustType: item.adjustType,
          adjustReason: item.reason || null,
          accountNo: item.accountNo,
          cost: item.cost ?? 0,
        }))

      if (adjustments.length === 0) {
        showToast("No changes to save", "info")
        return false
      }

      setSaving(true)
      try {
        const headers = getAuthHeaders()
        const response = await fetch(API_ENDPOINTS.ADJUST_INVENTORY.SAVE_ADJUSTMENTS, {
          method: "POST",
          headers,
          body: JSON.stringify({ adjustments, updateOnHand: true }),
        })
        const result = await response.json()
        if (result.isSuccess) {
          showToast(`${adjustments.length} adjustment(s) saved successfully`, "success")
          if (clearAfter) {
            // Clear quantities and refetch
            setItems((prev) =>
              prev.map((item) => ({
                ...item,
                newQty: null,
                difference: null,
                reason: "",
              }))
            )
            setModifiedItems(new Set())
            fetchData(currentPage, searchText)
          }
          return true
        } else {
          showToast(result.message || "Failed to save adjustments", "error")
          return false
        }
      } catch {
        showToast("Error saving adjustments", "error")
        return false
      } finally {
        setSaving(false)
      }
    },
    [items, getAuthHeaders, showToast, fetchData, currentPage, searchText]
  )

  // Save & Close
  const handleSaveAndClose = useCallback(async () => {
    const saved = await handleSave(false)
    if (saved) {
      const activeTab = tabs.find((t) => t.id === activeTabId)
      if (activeTab) closeTab(activeTab.id)
    }
  }, [handleSave, tabs, activeTabId, closeTab])

  // Save & Clear
  const handleSaveAndClear = useCallback(async () => {
    if (
      !await confirm({
        title: 'Save & Clear',
        message: 'The Adjustments will now save and all Quantity on this list will clear out.\nDo you want to continue?',
        variant: 'warning',
      })
    )
      return
    await handleSave(true)
  }, [handleSave, confirm])

  // Cancel
  const handleCancel = useCallback(() => {
    const activeTab = tabs.find((t) => t.id === activeTabId)
    if (activeTab) closeTab(activeTab.id)
  }, [tabs, activeTabId, closeTab])

  // ── Unsaved-changes guard ─────────────────────────────────────────────────
  // This page tracks edits via `modifiedItems: Set<string>` rather than a
  // formData/savedFormData diff, so we hand the Set straight to the hook with
  // a custom comparator that reports "clean" iff the set is empty. Reporting
  // dirty=true makes the DashboardTabContext show the Save/Discard modal when
  // the user closes the tab. Save Changes runs the same save-and-keep-data
  // path as the existing toolbar Save button (handleSave(false)) so the user's
  // adjustments persist before the tab disappears.
  const emptyModifiedSet = useMemo(() => new Set<string>(), [])
  useUnsavedChanges<Set<string>>({
    tabId: __tabId,
    formData: modifiedItems,
    initialSnapshot: emptyModifiedSet,
    enabled: !loading && !saving,
    compare: (current) => current.size === 0,
    saveHandler: async () => {
      const ok = await handleSave(false)
      if (!ok) {
        throw new Error("Could not save inventory adjustments. Please try again.")
      }
    },
  })

  // ── Export (shared modal — same as Item List / Reports) ──────────────────
  // Column set mirrors the on-screen grid. Type/Account resolve to their labels
  // and countDate uses the date dataType so CSV/Excel/PDF format consistently.
  const exportColumns = useMemo<Column[]>(
    () => [
      { field: "name", headerName: "Name", width: 160, dataType: "string" },
      { field: "department", headerName: "Department", width: 110, dataType: "string" },
      { field: "barcodeNumber", headerName: "Barcode No.", width: 120, dataType: "string" },
      { field: "modalNumber", headerName: "Model No.", width: 90, dataType: "string" },
      { field: "onHand", headerName: "On Hand", width: 80, dataType: "number" },
      { field: "newQty", headerName: "New Qty", width: 80, dataType: "number" },
      { field: "difference", headerName: "Difference", width: 90, dataType: "number" },
      { field: "countDate", headerName: "Count Date", width: 100, dataType: "date" },
      { field: "reason", headerName: "Reason", width: 140, dataType: "string" },
      { field: "adjustTypeLabel", headerName: "Type", width: 120, dataType: "string" },
      { field: "accountLabel", headerName: "Account", width: 100, dataType: "string" },
      { field: "customerCode", headerName: "Customer Code", width: 110, dataType: "string" },
      { field: "currentOnHand", headerName: "Current On Hand", width: 110, dataType: "number" },
      { field: "price", headerName: "Price", width: 90, dataType: "number" },
    ],
    []
  )

  // Fetches the full filtered dataset (all pages) for export, then overlays any
  // in-grid edits the user has entered on loaded pages (matched by itemStoreID)
  // so their in-progress counts are reflected in the export.
  const fetchAllData = useCallback(async (): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const params = new URLSearchParams()
      params.append("countedOnly", countedOnly.toString())
      params.append("discrepancyOnly", discrepancyOnly.toString())
      if (currentStore?.storeId) {
        params.append("storeId", currentStore.storeId)
      }
      params.append("pageNumber", "1")
      params.append("pageSize", "1000000")
      if (searchText) {
        params.append("searchText", searchText)
      }
      const url = `${API_ENDPOINTS.ADJUST_INVENTORY.GET_ITEMS_FOR_ADJUST}?${params.toString()}`
      const response = await fetch(url, { method: "GET", headers })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result: ApiResponse = await response.json()
      if (!result.isSuccess) return []

      const editsById = new Map(items.map((i) => [i.itemStoreID, i]))
      return result.response.items.map((item) => {
        const edit = editsById.get(item.itemStoreID)
        const adjustType = edit?.adjustType ?? 2
        const accountNo = edit?.accountNo ?? 1
        return {
          ...item,
          newQty: edit?.newQty ?? null,
          difference: edit?.difference ?? null,
          reason: edit?.reason ?? "",
          adjustTypeLabel: ADJUST_TYPES.find((t) => t.value === adjustType)?.label ?? "",
          accountLabel: ACCOUNT_TYPES.find((a) => a.value === accountNo)?.label ?? "",
        }
      })
    } catch (err) {
      console.error("Failed to fetch all data for export:", err)
      return []
    }
  }, [getAuthHeaders, currentStore?.storeId, countedOnly, discrepancyOnly, searchText, items])

  const exportModal = useExportModal({
    columns: exportColumns,
    fetchAllData,
    filename: "adjust-inventory",
    pdfOptions: {
      title: "Adjust Inventory",
      subtitle: currentStore?.storeName || "All Stores",
      orientation: "landscape",
    },
  })

  // Page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages)
      }
    }
    return pages
  }

  // Format currency
  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-"
    return `$${value.toFixed(2)}`
  }

  return (
    <div className="px-3 py-2 h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Toast */}
      {toast.show && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
            toast.type === "success"
              ? "bg-green-500 text-white"
              : toast.type === "error"
              ? "bg-red-500 text-white"
              : "bg-brand-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Adjust Inventory</h1>
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search items..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-64"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Save / Reset Action Buttons */}
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={handleResetPhysicalCount}
          disabled={saving}
          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs font-medium"
        >
          Reset Physical Count
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveAndClear}
            disabled={saving}
            className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs font-medium"
          >
            {saving ? "Saving..." : "Save & Clear"}
          </button>
          <button
            onClick={handleSaveAndClose}
            disabled={saving}
            className="px-3 py-1 bg-brand-500 text-white rounded hover:bg-brand-600 transition-colors text-xs font-medium"
          >
            {saving ? "Saving..." : "Save & Close"}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs font-medium"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={countedOnly}
            onChange={(e) => setCountedOnly(e.target.checked)}
            className="rounded border-gray-300 text-brand-500 focus:ring-brand-500 w-3.5 h-3.5"
          />
          Counted Only
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={discrepancyOnly}
            onChange={(e) => setDiscrepancyOnly(e.target.checked)}
            className="rounded border-gray-300 text-brand-500 focus:ring-brand-500 w-3.5 h-3.5"
          />
          With Discrepancy
        </label>
        <button
          onClick={() => fetchData(1, searchText)}
          disabled={loading}
          className="px-3 py-1 bg-brand-500 text-white rounded hover:bg-brand-600 transition-colors flex items-center gap-1.5 text-xs"
        >
          <svg
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Load
        </button>
      </div>

      {/* Action Bar + Stats */}
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <button
          onClick={handleUpdateAll}
          disabled={loading}
          className="px-2.5 py-1 bg-brand-500 text-white rounded hover:bg-brand-500 transition-colors text-xs"
        >
          Update All
        </button>
        <button
          onClick={handleRefreshOnHand}
          disabled={loading}
          className="px-2.5 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-xs"
        >
          Refresh On Hand
        </button>
        <button
          onClick={handleZeroUncounted}
          disabled={loading}
          className="px-2.5 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors text-xs"
        >
          Zero Uncounted Count
        </button>
        <button
          onClick={handleChangeQtyToMinus}
          disabled={loading}
          className="px-2.5 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors text-xs"
        >
          Change Qty to Minus
        </button>
        <button
          onClick={() => {
            if (selectedItemStoreId) {
              setQuickReportOpen(true)
            }
          }}
          disabled={loading || !selectedItemStoreId}
          className="px-2.5 py-1 bg-teal-500 text-white rounded hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
          title={!selectedItemStoreId ? "Click on a row first to select an item" : "View Quick Report for selected item"}
        >
          Quick Report
        </button>
        <button
          onClick={() => {
            if (selectedItemStoreId) {
              setInventoryByStoreOpen(true)
            }
          }}
          disabled={loading || !selectedItemStoreId}
          className="px-2.5 py-1 bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
          title={!selectedItemStoreId ? "Click on a row first to select an item" : "View inventory across all stores for selected item"}
        >
          Inventory By Store
        </button>
        <button
          onClick={() => {
            if (selectedItemStoreId) {
              setIsAuditHistoryOpen(true)
            }
          }}
          disabled={loading || !selectedItemStoreId}
          className="px-2.5 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
          title={!selectedItemStoreId ? "Click on a row first to select an item" : "View audit history for selected item"}
        >
          Audit History
        </button>

        <div className="flex items-center gap-3 ml-auto">
          <span className="text-xs text-brand-500 dark:text-brand-400">
            Total: <strong>{totalCount.toLocaleString()}</strong>
          </span>
          <span className="text-xs text-orange-600 dark:text-orange-400">
            Modified: <strong>{modifiedItems.size}</strong>
          </span>
          {totalPages > 0 && (
            <span className="text-xs text-purple-600 dark:text-purple-400">
              Page {currentPage}/{totalPages}
            </span>
          )}

          {/* Export — opens the shared export modal (CSV / Excel / PDF) */}
          <button
            onClick={exportModal.open}
            className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        {loading ? (
          <Loader size="lg" label="Loading inventory data..." />
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg
                className="w-12 h-12 mx-auto text-red-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-red-500 mb-2">{error}</p>
              <button
                onClick={() => fetchData(currentPage, searchText)}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600"
              >
                Retry
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg
                className="w-12 h-12 mx-auto text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">No items found</p>
            </div>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border-b border-r border-gray-200 dark:border-gray-700 min-w-[120px]">
                  Name
                </th>
                <th className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border-b border-r border-gray-200 dark:border-gray-700 min-w-[80px]">
                  Department
                </th>
                <th className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border-b border-r border-gray-200 dark:border-gray-700 min-w-[90px]">
                  Barcode No.
                </th>
                <th className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border-b border-r border-gray-200 dark:border-gray-700 min-w-[70px]">
                  Model No.
                </th>
                <th className="px-2 py-1 text-right font-semibold text-gray-700 dark:text-gray-200 border-b border-r border-gray-200 dark:border-gray-700 min-w-[55px]">
                  On Hand
                </th>
                <th className="px-2 py-1 text-right font-semibold text-white bg-amber-500 border-b border-r border-gray-200 dark:border-gray-700 min-w-[65px]">
                  New Qty
                </th>
                <th className="px-2 py-1 text-right font-semibold text-gray-700 dark:text-gray-200 border-b border-r border-gray-200 dark:border-gray-700 min-w-[65px]">
                  Difference
                </th>
                <th className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border-b border-r border-gray-200 dark:border-gray-700 min-w-[75px]">
                  Count Date
                </th>
                <th className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border-b border-r border-gray-200 dark:border-gray-700 min-w-[100px]">
                  Reason
                </th>
                <th className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border-b border-r border-gray-200 dark:border-gray-700 min-w-[100px]">
                  Type
                </th>
                <th className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border-b border-r border-gray-200 dark:border-gray-700 min-w-[80px]">
                  Account
                </th>
                <th className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border-b border-r border-gray-200 dark:border-gray-700 min-w-[80px]">
                  Customer Code
                </th>
                <th className="px-2 py-1 text-right font-semibold text-gray-700 dark:text-gray-200 border-b border-r border-gray-200 dark:border-gray-700 min-w-[70px]">
                  Current On Hand
                </th>
                <th className="px-2 py-1 text-right font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 min-w-[70px]">
                  Price
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr
                  key={item.itemStoreID}
                  onClick={() => setSelectedItemStoreId(item.itemStoreID)}
                  className={`cursor-pointer ${
                    selectedItemStoreId === item.itemStoreID
                      ? "bg-brand-50 dark:bg-brand-900/40"
                      : index % 2 === 0
                      ? "bg-white dark:bg-gray-900"
                      : "bg-gray-50 dark:bg-gray-800"
                  } hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors ${
                    modifiedItems.has(item.itemStoreID)
                      ? "ring-1 ring-inset ring-amber-300 dark:ring-amber-600"
                      : ""
                  }`}
                >
                  <td className="px-2 py-0.5 text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700">
                    {item.name || "-"}
                  </td>
                  <td className="px-2 py-0.5 text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
                    {item.department || "-"}
                  </td>
                  <td className="px-2 py-0.5 text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700 font-mono text-xs">
                    {item.barcodeNumber || "-"}
                  </td>
                  <td className="px-2 py-0.5 text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
                    {item.modalNumber || "-"}
                  </td>
                  <td className="px-2 py-0.5 text-right text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700">
                    {item.onHand ?? "-"}
                  </td>
                  {/* New Qty - Editable */}
                  <td className="px-0.5 py-0.5 border-r border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20">
                    <input
                      type="number"
                      value={item.newQty ?? ""}
                      onChange={(e) => handleNewQtyChange(item.itemStoreID, e.target.value)}
                      className="w-full px-1 py-0 text-right text-xs border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 h-6"
                    />
                  </td>
                  {/* Difference - Editable */}
                  <td className="px-0.5 py-0.5 border-r border-gray-200 dark:border-gray-700">
                    <input
                      type="number"
                      value={item.difference ?? ""}
                      onChange={(e) => handleDifferenceChange(item.itemStoreID, e.target.value)}
                      className={`w-full px-2 py-1 text-right text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 ${
                        item.difference !== null && item.difference < 0
                          ? "text-red-600 dark:text-red-400"
                          : item.difference !== null && item.difference > 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-gray-900 dark:text-white"
                      }`}
                    />
                  </td>
                  <td className="px-2 py-0.5 text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
                    {item.countDate ? new Date(item.countDate).toLocaleDateString() : "-"}
                  </td>
                  {/* Reason - Editable */}
                  <td className="px-0.5 py-0.5 border-r border-gray-200 dark:border-gray-700">
                    <input
                      type="text"
                      value={item.reason}
                      onChange={(e) => handleReasonChange(item.itemStoreID, e.target.value)}
                      className="w-full px-1 py-0 text-xs border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 h-6"
                    />
                  </td>
                  {/* Type - Dropdown */}
                  <td className="px-0.5 py-0.5 border-r border-gray-200 dark:border-gray-700">
                    <select
                      value={item.adjustType}
                      onChange={(e) =>
                        handleTypeChange(item.itemStoreID, parseInt(e.target.value))
                      }
                      className="w-full px-1 py-0 text-xs border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 h-6"
                    >
                      {ADJUST_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  {/* Account - Dropdown */}
                  <td className="px-0.5 py-0.5 border-r border-gray-200 dark:border-gray-700">
                    <select
                      value={item.accountNo}
                      onChange={(e) =>
                        handleAccountChange(item.itemStoreID, parseInt(e.target.value))
                      }
                      className="w-full px-1 py-0 text-xs border border-gray-300 dark:border-gray-600 rounded-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-brand-500 focus:border-brand-500 h-6"
                    >
                      {ACCOUNT_TYPES.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-0.5 text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
                    {item.customerCode || "-"}
                  </td>
                  <td className="px-2 py-0.5 text-right text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700">
                    {item.currentOnHand ?? "-"}
                  </td>
                  <td className="px-2 py-0.5 text-right text-gray-900 dark:text-gray-100">
                    {formatCurrency(item.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-1 px-1">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()} items
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              First
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Prev
            </button>
            {getPageNumbers().map((page, idx) => (
              <button
                key={idx}
                onClick={() => typeof page === "number" && handlePageChange(page)}
                disabled={page === "..."}
                className={`px-2 py-1 text-xs rounded border ${
                  page === currentPage
                    ? "bg-brand-500 text-white border-brand-500"
                    : page === "..."
                    ? "border-transparent cursor-default"
                    : "border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Next
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* Quick Report Modal */}
      {selectedItemStoreId && (
        <QuickReportModal
          isOpen={quickReportOpen}
          onClose={() => setQuickReportOpen(false)}
          itemStoreId={selectedItemStoreId}
          itemId={items.find((i) => i.itemStoreID === selectedItemStoreId)?.itemID || ""}
          upcCode={items.find((i) => i.itemStoreID === selectedItemStoreId)?.barcodeNumber || ""}
          description={items.find((i) => i.itemStoreID === selectedItemStoreId)?.name || ""}
          onHand={items.find((i) => i.itemStoreID === selectedItemStoreId)?.currentOnHand ?? null}
        />
      )}

      {/* Inventory By Store Modal */}
      {selectedItemStoreId && (
        <InventoryByStoreModal
          isOpen={inventoryByStoreOpen}
          onClose={() => setInventoryByStoreOpen(false)}
          itemId={items.find((i) => i.itemStoreID === selectedItemStoreId)?.itemID || ""}
          description={items.find((i) => i.itemStoreID === selectedItemStoreId)?.name || ""}
        />
      )}

      {selectedItemStoreId && (
        <AuditHistoryModal
          isOpen={isAuditHistoryOpen}
          onClose={() => setIsAuditHistoryOpen(false)}
          entityType="ItemStore"
          entityId={selectedItemStoreId}
          entityName={items.find((i) => i.itemStoreID === selectedItemStoreId)?.name || ""}
        />
      )}
      {ConfirmDialog}

      {/* Shared export modal (CSV / Excel / PDF with column + format selection) */}
      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default AdjustInventoryPage
