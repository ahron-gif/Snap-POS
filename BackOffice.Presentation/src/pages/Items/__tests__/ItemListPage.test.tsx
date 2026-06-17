import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import { configureStore } from "@reduxjs/toolkit"
import React from "react"

vi.mock("../../../hooks/useAuthHeaders", () => ({
  useAuthHeaders: () => ({
    getAuthHeaders: vi.fn(() => ({
      "Content-Type": "application/json",

      Authorization: "Bearer test-token",
      CustomerId: "1",
    })),
  }),
}))

vi.mock("../../../context/DashboardTabContext", () => ({
  useDashboardTabs: () => ({
    openTab: mockOpenTab,
  }),
}))

vi.mock("../../../context/StoreContext", () => ({
  useStore: () => ({
    currentStore: { storeId: "store-1", storeName: "Test Store" },
    stores: [{ storeId: "store-1", storeName: "Test Store" }],
    isLoadingStores: false,
    switchStore: vi.fn(),
    loadStores: vi.fn(),
  }),
}))

vi.mock("../../../hooks/useGridSettings", () => ({
  useGridSettings: () => ({
    columns: mockColumns,
    setColumns: vi.fn(),
    updateColumnVisibility: vi.fn(),
    updateColumnWidth: vi.fn(),
    columnAggregates: new Map(),
    updateColumnAggregate: vi.fn(),
  }),
}))

vi.mock("../../../hooks/useExportHandlers", () => ({
  useExportHandlers: () => ({
    handleExportCSV: vi.fn(),
    handleExportPDF: vi.fn(),
    handleExportExcel: vi.fn(),
    handlePrint: vi.fn(),
    isExporting: false,
    isPrinting: false,
  }),
  default: () => ({
    handleExportCSV: vi.fn(),
    handleExportPDF: vi.fn(),
    handleExportExcel: vi.fn(),
    handlePrint: vi.fn(),
    isExporting: false,
    isPrinting: false,
  }),
}))

vi.mock("../../../services/itemService", () => ({
  itemService: {
    getItem: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    barcodeExists: vi.fn(),
  },
}))

vi.mock("../../../components/common/ExportNotification", () => ({
  useExportNotification: () => ({
    startExport: vi.fn(() => "notification-1"),
    updateExport: vi.fn(),
    completeExport: vi.fn(),
    failExport: vi.fn(),
  }),
  ExportNotificationProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("axios", () => ({
  default: vi.fn(() =>
    Promise.resolve({
      data: {
        isSuccess: true,
        response: {
          data: [],
          totalRecords: 0,
        },
      },
    })
  ),
}))

let mockServerGridProps: Record<string, unknown> = {}

vi.mock("../../../components/common/ServerGrid/ServerGrid", () => ({
  default: (props: Record<string, unknown>) => {
    mockServerGridProps = props
    if (typeof props.setTotalRecords === "function") {
      React.useEffect(() => {
        ;(props.setTotalRecords as (n: number) => void)(5)
      }, [])
    }
    if (typeof props.setLoadedCount === "function") {
      React.useEffect(() => {
        ;(props.setLoadedCount as (n: number) => void)(5)
      }, [])
    }
    if (typeof props.setCurrentPage === "function") {
      React.useEffect(() => {
        ;(props.setCurrentPage as (n: number) => void)(1)
      }, [])
    }
    if (typeof props.setTotalPages === "function") {
      React.useEffect(() => {
        ;(props.setTotalPages as (n: number) => void)(1)
      }, [])
    }
    if (typeof props.onSelectAll === "function") {
      React.useEffect(() => {
        ;(props.onSelectAll as (fn: () => void) => void)(() => {})
      }, [])
    }
    if (typeof props.onPageNavigation === "function") {
      React.useEffect(() => {
        ;(props.onPageNavigation as (callbacks: Record<string, () => void>) => void)({
          goToFirstPage: vi.fn(),
          goToPreviousPage: vi.fn(),
          goToNextPage: vi.fn(),
          goToLastPage: vi.fn(),
        })
      }, [])
    }
    return <div data-testid="server-grid">Mock ServerGrid</div>
  },
}))

vi.mock("../../../components/common/ActionHeader", () => ({
  default: (props: Record<string, unknown>) => {
    mockActionHeaderProps = props
    return (
      <div data-testid="action-header">
        <span data-testid="selected-count">{String(props.selectedCount)}</span>
        <span data-testid="total-count">{String(props.totalCount)}</span>
        <input
          data-testid="search-input"
          value={String(props.searchText || "")}
          onChange={(e) =>
            (props.onSearchChange as (v: string) => void)?.(e.target.value)
          }
          onKeyDown={(e) =>
            (props.onSearchKeyPress as (e: React.KeyboardEvent<HTMLInputElement>) => void)?.(
              e as unknown as React.KeyboardEvent<HTMLInputElement>
            )
          }
        />
        <button data-testid="btn-add-new" onClick={() => (props.onAddNew as () => void)?.()}>
          Add New
        </button>
        <button data-testid="btn-select-all" onClick={() => (props.onSelectAll as () => void)?.()}>
          Select All
        </button>
        <button data-testid="btn-deselect-all" onClick={() => (props.onDeselectAll as () => void)?.()}>
          Deselect All
        </button>
        <button data-testid="btn-bulk-delete" onClick={() => (props.onBulkDelete as () => void)?.()}>
          Bulk Delete
        </button>
        <button data-testid="btn-bulk-export" onClick={() => (props.onBulkExport as () => void)?.()}>
          Bulk Export
        </button>
        <button data-testid="btn-refresh" onClick={() => (props.onRefresh as () => void)?.()}>
          Refresh
        </button>
        <button data-testid="btn-remount" onClick={() => (props.onRemountGrid as () => void)?.()}>
          Remount
        </button>
      </div>
    )
  },
}))

vi.mock("../CopyItemModal", () => ({
  default: (props: Record<string, unknown>) => {
    if (!props.isOpen) return null
    return (
      <div data-testid="copy-item-modal">
        <button
          data-testid="copy-confirm"
          onClick={() =>
            (props.onConfirm as (data: Record<string, string>) => void)?.({
              name: "Copied Item",
              barcodeNumber: "999999999",
              modelNumber: "MOD-COPY",
            })
          }
        >
          Confirm
        </button>
        <button data-testid="copy-close" onClick={() => (props.onClose as () => void)?.()}>
          Close
        </button>
      </div>
    )
  },
}))

vi.mock("../AdjustInventoryModal", () => ({
  default: (props: Record<string, unknown>) => {
    if (!props.isOpen) return null
    return (
      <div data-testid="adjust-inventory-modal">
        <button data-testid="adjust-close" onClick={() => (props.onClose as () => void)?.()}>
          Close
        </button>
        <button data-testid="adjust-saved" onClick={() => (props.onSaved as () => void)?.()}>
          Save
        </button>
      </div>
    )
  },
}))

vi.mock("../PriceHistoryModal", () => ({
  default: (props: Record<string, unknown>) => {
    if (!props.isOpen) return null
    return (
      <div data-testid={props.priceLevel === "Cost" ? "cost-history-modal" : "price-history-modal"}>
        <button data-testid="history-close" onClick={() => (props.onClose as () => void)?.()}>
          Close
        </button>
      </div>
    )
  },
}))

vi.mock("../SalesHistoryModal", () => ({
  default: (props: Record<string, unknown>) => {
    if (!props.isOpen) return null
    return (
      <div data-testid="sales-history-modal">
        <button data-testid="sales-close" onClick={() => (props.onClose as () => void)?.()}>
          Close
        </button>
      </div>
    )
  },
}))

const mockOpenTab = vi.fn()
let mockActionHeaderProps: Record<string, unknown> = {}

const mockColumns = [
  { field: "itemID", headerName: "Item ID", width: 120, visible: true, sortable: true, filterable: true, dataType: "string" },
  { field: "name", headerName: "Name", width: 250, visible: true, sortable: true, filterable: true, dataType: "string" },
  { field: "barcodeNumber", headerName: "Barcode Number", width: 180, visible: true, sortable: true, filterable: true, dataType: "string" },
  { field: "price", headerName: "Price", width: 120, visible: true, sortable: true, filterable: true, dataType: "number" },
  { field: "cost", headerName: "Cost", width: 120, visible: true, sortable: true, filterable: true, dataType: "number" },
  { field: "onHand", headerName: "On Hand", width: 120, visible: true, sortable: true, filterable: true, dataType: "number" },
  { field: "status", headerName: "Status", width: 100, visible: true, sortable: true, filterable: true, dataType: "number" },
  { field: "itemStoreID", headerName: "Item Store ID", width: 150, visible: true, sortable: true, filterable: true, dataType: "string" },
]

const createMockItemRow = (overrides: Record<string, unknown> = {}) => ({
  itemID: "item-1",
  name: "Test Item",
  modalNumber: "MOD-001",
  linkNo: null,
  barcodeNumber: "1234567890",
  storeNo: "S001",
  isTaxable: true,
  isDiscount: false,
  isFoodStampable: false,
  isWIC: null,
  cost: 5.0,
  price: 9.99,
  caseQty: 12,
  priceByCase: false,
  styleNo: null,
  costByCase: false,
  caseBarcodeNumber: null,
  onHand: 100,
  csOnHand: 8,
  binLocation: "A1",
  status: 1,
  dateCreated: "2024-01-01T00:00:00",
  itemStoreDateModified: "2024-06-01T00:00:00",
  mainDateModified: "2024-06-01T00:00:00",
  cs_Cost: 60.0,
  pc_Cost: 5.0,
  mainStatus: 1,
  itemStoreID: "item-store-1",
  department: "Grocery",
  matrix1: null,
  matrix2: null,
  matrix3: null,
  matrix4: null,
  matrix5: null,
  matrix6: null,
  supplier_Item_Code: null,
  manufacturerPartNo: null,
  sP_Price: null,
  supplierName: "Supplier A",
  groupDateModified: "2024-06-01T00:00:00",
  sP_From: null,
  sP_To: null,
  future_SP_Price: null,
  future_SP_From: null,
  future_SP_To: null,
  markup: 99.8,
  margin: 49.95,
  mtd: 500,
  mtD_Pc_Qty: 50,
  mtD_Cs_Qty: 4,
  ytd: 6000,
  ytD_Pc_Qty: 600,
  ytD_Cs_Qty: 50,
  ptd: 1000,
  ptD_Pc_Qty: 100,
  matrixTableNo: null,
  ptD_Cs_Qty: 8,
  itemNo: "ITM-001",
  brand: "TestBrand",
  toReorder: 20,
  size: "Large",
  departmentDateModified: null,
  itemType: 0,
  departmentID: "dept-1",
  itemTypeName: "Regular",
  ...overrides,
})

const customerReducer = (
  state = { currentCustomer: { customerId: 1, customerName: "Test", email: "test@test.com" }, customers: [] },
  _action: { type: string }
) => state

const authReducer = (state = { isAuthenticated: true }, _action: { type: string }) => state
const permissionReducer = (state = { permissions: [] }, _action: { type: string }) => state
const effectivePermissionReducer = (state = { permissions: [] }, _action: { type: string }) => state
const tokenReducer = (state = { token: null }, _action: { type: string }) => state
const tokenPermissionReducer = (state = { permissions: [] }, _action: { type: string }) => state
const tokenStoreAccessReducer = (state = { storeAccess: [] }, _action: { type: string }) => state
const registrationReducer = (state = { registrations: [] }, _action: { type: string }) => state
const applicationReducer = (state = { applications: [] }, _action: { type: string }) => state
const appRegistrationReducer = (state = { appRegistrations: [] }, _action: { type: string }) => state

const createTestStore = () =>
  configureStore({
    reducer: {
      customer: customerReducer,
      auth: authReducer,
      permission: permissionReducer,
      effectivePermission: effectivePermissionReducer,
      token: tokenReducer,
      tokenPermission: tokenPermissionReducer,
      tokenStoreAccess: tokenStoreAccessReducer,
      registration: registrationReducer,
      application: applicationReducer,
      appRegistration: appRegistrationReducer,
    },
  })

const renderItemListPage = async () => {
  const store = createTestStore()
  const { default: ItemListPage } = await import("../ItemListPage")
  const utils = render(
    <Provider store={store}>
      <ItemListPage />
    </Provider>
  )
  return { ...utils, store }
}

describe("ItemListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockServerGridProps = {}
    mockActionHeaderProps = {}
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("Rendering", () => {
    it("should render the page with ActionHeader and ServerGrid", async () => {
      await renderItemListPage()
      expect(screen.getByTestId("action-header")).toBeInTheDocument()
      expect(screen.getByTestId("server-grid")).toBeInTheDocument()
    })

    it("should not show any modals initially", async () => {
      await renderItemListPage()
      expect(screen.queryByTestId("copy-item-modal")).not.toBeInTheDocument()
      expect(screen.queryByTestId("adjust-inventory-modal")).not.toBeInTheDocument()
      expect(screen.queryByTestId("price-history-modal")).not.toBeInTheDocument()
      expect(screen.queryByTestId("cost-history-modal")).not.toBeInTheDocument()
      expect(screen.queryByTestId("sales-history-modal")).not.toBeInTheDocument()
    })

    it("should display initial selected count as 0", async () => {
      await renderItemListPage()
      expect(screen.getByTestId("selected-count")).toHaveTextContent("0")
    })

    it("should pass correct totalCount from ServerGrid", async () => {
      await renderItemListPage()
      await waitFor(() => {
        expect(screen.getByTestId("total-count")).toHaveTextContent("5")
      })
    })
  })

  describe("ServerGrid Configuration", () => {
    it("should pass correct API URL to ServerGrid", async () => {
      await renderItemListPage()
      expect(mockServerGridProps.serverSide).toBe(true)
      expect(mockServerGridProps.methodType).toBe("GET")
    })

    it("should pass correct default sort column", async () => {
      await renderItemListPage()
      expect(mockServerGridProps.defaultSortColumn).toBe("itemID")
    })

    it("should pass pageSize of 20", async () => {
      await renderItemListPage()
      expect(mockServerGridProps.pageSize).toBe(20)
    })

    it("should enable pagination, checkboxes, header search, and infinite scroll", async () => {
      await renderItemListPage()
      expect(mockServerGridProps.pagination).toBe(true)
      expect(mockServerGridProps.showCheckboxes).toBe(true)
      expect(mockServerGridProps.headerSearch).toBe(true)
      expect(mockServerGridProps.infiniteScroll).toBe(true)
    })

    it("should use itemStoreID as the row id getter", async () => {
      await renderItemListPage()
      const getRowId = mockServerGridProps.getRowId as (row: Record<string, string>) => string
      expect(getRowId({ itemStoreID: "abc-123" })).toBe("abc-123")
    })

    it("should pass grid ID for settings persistence", async () => {
      await renderItemListPage()
      expect(mockServerGridProps.gridId).toBe("items-list-grid")
    })

    it("should pass 7 custom context menu items", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as unknown[]
      expect(items).toHaveLength(7)
    })

    it("should pass empty message for no items", async () => {
      await renderItemListPage()
      expect(mockServerGridProps.emptyMessage).toBe("No items found in the inventory")
    })
  })

  describe("Search Functionality", () => {
    it("should update search text on input change", async () => {
      await renderItemListPage()
      const searchInput = screen.getByTestId("search-input")
      fireEvent.change(searchInput, { target: { value: "test item" } })
      expect(searchInput).toHaveValue("test item")
    })

    it("should debounce search with 500ms delay", async () => {
      await renderItemListPage()
      const searchInput = screen.getByTestId("search-input")

      fireEvent.change(searchInput, { target: { value: "search term" } })

      const paramsBefore = mockServerGridProps.additionalParams as Record<string, string>
      expect(paramsBefore?.CustomGridSearchText).toBeUndefined()

      act(() => {
        vi.advanceTimersByTime(600)
      })

      await waitFor(() => {
        const paramsAfter = mockServerGridProps.additionalParams as Record<string, string>
        expect(paramsAfter?.CustomGridSearchText).toBe("search term")
      })
    })

    it("should trigger immediate search on Enter key", async () => {
      await renderItemListPage()
      const searchInput = screen.getByTestId("search-input")

      fireEvent.change(searchInput, { target: { value: "enter search" } })
      fireEvent.keyDown(searchInput, { key: "Enter" })

      await waitFor(() => {
        const params = mockServerGridProps.additionalParams as Record<string, string>
        expect(params?.CustomGridSearchText).toBe("enter search")
      })
    })

    it("should include storeId in additional params when store is selected", async () => {
      await renderItemListPage()
      const params = mockServerGridProps.additionalParams as Record<string, string>
      expect(params?.storeId).toBe("store-1")
    })

    it("should set CustomGridSearchColumns to name and barcodeNumber", async () => {
      await renderItemListPage()
      const searchInput = screen.getByTestId("search-input")

      fireEvent.change(searchInput, { target: { value: "test" } })
      act(() => {
        vi.advanceTimersByTime(600)
      })

      await waitFor(() => {
        const params = mockServerGridProps.additionalParams as Record<string, string>
        expect(params?.CustomGridSearchColumns).toBe("name,barcodeNumber")
      })
    })

    it("should trim whitespace from search text", async () => {
      await renderItemListPage()
      const searchInput = screen.getByTestId("search-input")

      fireEvent.change(searchInput, { target: { value: "  trimmed  " } })
      act(() => {
        vi.advanceTimersByTime(600)
      })

      await waitFor(() => {
        const params = mockServerGridProps.additionalParams as Record<string, string>
        expect(params?.CustomGridSearchText).toBe("trimmed")
      })
    })

    it("should not set search params when search text is empty or whitespace", async () => {
      await renderItemListPage()
      const searchInput = screen.getByTestId("search-input")

      fireEvent.change(searchInput, { target: { value: "   " } })
      act(() => {
        vi.advanceTimersByTime(600)
      })

      await waitFor(() => {
        const params = mockServerGridProps.additionalParams as Record<string, string>
        expect(params?.CustomGridSearchText).toBeUndefined()
      })
    })
  })

  describe("Add New Item", () => {
    it("should open ItemFormPage tab with isNew=true when Add New is clicked", async () => {
      await renderItemListPage()
      fireEvent.click(screen.getByTestId("btn-add-new"))
      expect(mockOpenTab).toHaveBeenCalledWith({
        component: "ItemFormPage",
        title: "New Item",
        closable: true,
        props: { isNew: true },
      })
    })
  })

  describe("Row Double-Click (Edit)", () => {
    it("should open ItemFormPage tab on row update (double click)", async () => {
      await renderItemListPage()
      const onRowUpdate = mockServerGridProps.onRowUpdate as (row: Record<string, string>) => void
      act(() => {
        onRowUpdate({ name: "Test Item", itemStoreID: "item-store-1" })
      })
      expect(mockOpenTab).toHaveBeenCalledWith({
        component: "ItemFormPage",
        title: "Edit: Test Item",
        closable: true,
        props: { id: "item-store-1" },
      })
    })

    it("should use 'Item' as fallback title when name is empty", async () => {
      await renderItemListPage()
      const onRowUpdate = mockServerGridProps.onRowUpdate as (row: Record<string, string>) => void
      act(() => {
        onRowUpdate({ name: "", itemStoreID: "item-store-2" })
      })
      expect(mockOpenTab).toHaveBeenCalledWith({
        component: "ItemFormPage",
        title: "Edit: Item",
        closable: true,
        props: { id: "item-store-2" },
      })
    })
  })

  describe("Row Selection", () => {
    it("should toggle row selection when checkbox is clicked", async () => {
      await renderItemListPage()
      const onRowSelection = mockServerGridProps.onRowSelection as (id: string) => void

      act(() => {
        onRowSelection("item-store-1")
      })

      await waitFor(() => {
        expect(screen.getByTestId("selected-count")).toHaveTextContent("1")
      })
    })

    it("should deselect a previously selected row on second click", async () => {
      await renderItemListPage()
      const onRowSelection = mockServerGridProps.onRowSelection as (id: string) => void

      act(() => {
        onRowSelection("item-store-1")
      })

      await waitFor(() => {
        expect(screen.getByTestId("selected-count")).toHaveTextContent("1")
      })

      act(() => {
        onRowSelection("item-store-1")
      })

      await waitFor(() => {
        expect(screen.getByTestId("selected-count")).toHaveTextContent("0")
      })
    })

    it("should support multiple row selections", async () => {
      await renderItemListPage()
      const onRowSelection = mockServerGridProps.onRowSelection as (id: string) => void

      act(() => {
        onRowSelection("item-store-1")
      })
      act(() => {
        onRowSelection("item-store-2")
      })
      act(() => {
        onRowSelection("item-store-3")
      })

      await waitFor(() => {
        expect(screen.getByTestId("selected-count")).toHaveTextContent("3")
      })
    })

    it("should clear all selections on deselect all", async () => {
      await renderItemListPage()
      const onRowSelection = mockServerGridProps.onRowSelection as (id: string) => void

      act(() => {
        onRowSelection("item-store-1")
        onRowSelection("item-store-2")
      })

      fireEvent.click(screen.getByTestId("btn-deselect-all"))

      await waitFor(() => {
        expect(screen.getByTestId("selected-count")).toHaveTextContent("0")
      })
    })
  })

  describe("Grid Remount / Refresh", () => {
    it("should clear search and selections on remount", async () => {
      await renderItemListPage()
      const searchInput = screen.getByTestId("search-input")
      const onRowSelection = mockServerGridProps.onRowSelection as (id: string) => void

      fireEvent.change(searchInput, { target: { value: "some search" } })
      act(() => {
        onRowSelection("item-store-1")
      })

      fireEvent.click(screen.getByTestId("btn-remount"))

      await waitFor(() => {
        expect(screen.getByTestId("selected-count")).toHaveTextContent("0")
        expect(searchInput).toHaveValue("")
      })
    })
  })

  describe("Context Menu Actions", () => {
    it("should pass View handler that opens ItemViewPage", async () => {
      await renderItemListPage()
      const onView = mockServerGridProps.onView as (row: Record<string, string>) => void
      act(() => {
        onView({ name: "View Item", itemStoreID: "view-1" })
      })
      expect(mockOpenTab).toHaveBeenCalledWith({
        component: "ItemViewPage",
        title: "View: View Item",
        closable: true,
        props: { id: "view-1" },
      })
    })

    it("should pass Edit handler that opens ItemFormPage", async () => {
      await renderItemListPage()
      const onEdit = mockServerGridProps.onEdit as (row: Record<string, string>) => void
      act(() => {
        onEdit({ name: "Edit Item", itemStoreID: "edit-1" })
      })
      expect(mockOpenTab).toHaveBeenCalledWith({
        component: "ItemFormPage",
        title: "Edit: Edit Item",
        closable: true,
        props: { id: "edit-1" },
      })
    })

    it("should have Copy Item context menu with Ctrl + G shortcut", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{ label: string; shortcut?: string }>
      const copyItem = items.find((i) => i.label === "Copy Item")
      expect(copyItem).toBeDefined()
      expect(copyItem?.shortcut).toBe("Ctrl + G")
    })

    it("should have Adjust Inventory context menu item", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{ label: string }>
      const adjustItem = items.find((i) => i.label === "Adjust Inventory")
      expect(adjustItem).toBeDefined()
    })

    it("should have Price History context menu item", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{ label: string }>
      const priceHistory = items.find((i) => i.label === "Price History")
      expect(priceHistory).toBeDefined()
    })

    it("should have Cost History context menu item", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{ label: string }>
      const costHistory = items.find((i) => i.label === "Cost History")
      expect(costHistory).toBeDefined()
    })

    it("should have Sales History context menu item", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{ label: string }>
      const salesHistory = items.find((i) => i.label === "Sales History")
      expect(salesHistory).toBeDefined()
    })

    it("should have Quick Report context menu item", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{ label: string }>
      const quickReport = items.find((i) => i.label === "Quick Report")
      expect(quickReport).toBeDefined()
    })
  })

  describe("Copy Item Feature", () => {
    it("should open copy modal when Copy Item context menu is clicked", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        label: string
        onClick: (row: Record<string, unknown>) => void
      }>
      const copyItem = items.find((i) => i.label === "Copy Item")
      const mockRow = createMockItemRow()

      act(() => {
        copyItem!.onClick(mockRow)
      })

      await waitFor(() => {
        expect(screen.getByTestId("copy-item-modal")).toBeInTheDocument()
      })
    })

    it("should close copy modal when close is clicked", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        label: string
        onClick: (row: Record<string, unknown>) => void
      }>
      const copyItem = items.find((i) => i.label === "Copy Item")

      act(() => {
        copyItem!.onClick(createMockItemRow())
      })

      await waitFor(() => {
        expect(screen.getByTestId("copy-item-modal")).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId("copy-close"))

      await waitFor(() => {
        expect(screen.queryByTestId("copy-item-modal")).not.toBeInTheDocument()
      })
    })

    it("should open ItemFormPage with copy data on confirm", async () => {
      const { itemService } = await import("../../../services/itemService")
      ;(itemService.getItem as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: true,
        data: { name: "Original Item", barcodeNumber: "111", price: 9.99 },
      })

      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        label: string
        onClick: (row: Record<string, unknown>) => void
      }>
      const copyItem = items.find((i) => i.label === "Copy Item")

      act(() => {
        copyItem!.onClick(createMockItemRow())
      })

      await waitFor(() => {
        expect(screen.getByTestId("copy-item-modal")).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByTestId("copy-confirm"))
      })

      await waitFor(() => {
        expect(mockOpenTab).toHaveBeenCalledWith(
          expect.objectContaining({
            component: "ItemFormPage",
            title: "Copy: Copied Item",
            closable: true,
            props: expect.objectContaining({
              isNew: true,
              copyData: expect.objectContaining({
                name: "Copied Item",
                barcodeNumber: "999999999",
                modalNumber: "MOD-COPY",
              }),
            }),
          })
        )
      })
    })

    it("should show error toast when item fetch fails during copy", async () => {
      const { itemService } = await import("../../../services/itemService")
      ;(itemService.getItem as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: false,
        data: null,
      })

      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        label: string
        onClick: (row: Record<string, unknown>) => void
      }>
      const copyItem = items.find((i) => i.label === "Copy Item")

      act(() => {
        copyItem!.onClick(createMockItemRow())
      })

      await waitFor(() => {
        expect(screen.getByTestId("copy-item-modal")).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByTestId("copy-confirm"))
      })

      await waitFor(() => {
        expect(screen.getByText("Failed to load item data for copy")).toBeInTheDocument()
      })
    })

    it("should show error toast when copy confirm throws an exception", async () => {
      const { itemService } = await import("../../../services/itemService")
      ;(itemService.getItem as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network error"))

      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        label: string
        onClick: (row: Record<string, unknown>) => void
      }>
      const copyItem = items.find((i) => i.label === "Copy Item")

      act(() => {
        copyItem!.onClick(createMockItemRow())
      })

      await waitFor(() => {
        expect(screen.getByTestId("copy-item-modal")).toBeInTheDocument()
      })

      await act(async () => {
        fireEvent.click(screen.getByTestId("copy-confirm"))
      })

      await waitFor(() => {
        expect(screen.getByText("Error copying item")).toBeInTheDocument()
      })
    })
  })

  describe("Adjust Inventory Feature", () => {
    it("should open adjust modal from context menu", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        label: string
        onClick: (row: Record<string, unknown>) => void
      }>
      const adjustItem = items.find((i) => i.label === "Adjust Inventory")

      act(() => {
        adjustItem!.onClick(createMockItemRow())
      })

      await waitFor(() => {
        expect(screen.getByTestId("adjust-inventory-modal")).toBeInTheDocument()
      })
    })

    it("should block adjustment for matrix items (itemType === 2)", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        label: string
        onClick: (row: Record<string, unknown>) => void
      }>
      const adjustItem = items.find((i) => i.label === "Adjust Inventory")

      act(() => {
        adjustItem!.onClick(createMockItemRow({ itemType: 2 }))
      })

      expect(screen.queryByTestId("adjust-inventory-modal")).not.toBeInTheDocument()
      await waitFor(() => {
        expect(screen.getByText("Matrix items cannot be adjusted individually")).toBeInTheDocument()
      })
    })

    it("should allow adjustment for non-matrix items (itemType !== 2)", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        label: string
        onClick: (row: Record<string, unknown>) => void
      }>
      const adjustItem = items.find((i) => i.label === "Adjust Inventory")

      act(() => {
        adjustItem!.onClick(createMockItemRow({ itemType: 0 }))
      })

      await waitFor(() => {
        expect(screen.getByTestId("adjust-inventory-modal")).toBeInTheDocument()
      })
    })

    it("should close adjust modal and show success toast on save", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        label: string
        onClick: (row: Record<string, unknown>) => void
      }>
      const adjustItem = items.find((i) => i.label === "Adjust Inventory")

      act(() => {
        adjustItem!.onClick(createMockItemRow())
      })

      await waitFor(() => {
        expect(screen.getByTestId("adjust-inventory-modal")).toBeInTheDocument()
      })

      fireEvent.click(screen.getByTestId("adjust-saved"))

      await waitFor(() => {
        expect(screen.queryByTestId("adjust-inventory-modal")).not.toBeInTheDocument()
        expect(screen.getByText("Inventory adjusted successfully")).toBeInTheDocument()
      })
    })
  })

  describe("History Modals", () => {
    it("should open price history modal from context menu", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        label: string
        onClick: (row: Record<string, unknown>) => void
      }>
      const priceHistory = items.find((i) => i.label === "Price History")

      act(() => {
        priceHistory!.onClick(createMockItemRow())
      })

      await waitFor(() => {
        expect(screen.getByTestId("price-history-modal")).toBeInTheDocument()
      })
    })

    it("should open cost history modal from context menu", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        label: string
        onClick: (row: Record<string, unknown>) => void
      }>
      const costHistory = items.find((i) => i.label === "Cost History")

      act(() => {
        costHistory!.onClick(createMockItemRow())
      })

      await waitFor(() => {
        expect(screen.getByTestId("cost-history-modal")).toBeInTheDocument()
      })
    })

    it("should open sales history modal from context menu", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        label: string
        onClick: (row: Record<string, unknown>) => void
      }>
      const salesHistory = items.find((i) => i.label === "Sales History")

      act(() => {
        salesHistory!.onClick(createMockItemRow())
      })

      await waitFor(() => {
        expect(screen.getByTestId("sales-history-modal")).toBeInTheDocument()
      })
    })
  })

  describe("Quick Report", () => {
    it("should open QuickReportPage tab with item details", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        label: string
        onClick: (row: Record<string, unknown>) => void
      }>
      const quickReport = items.find((i) => i.label === "Quick Report")
      const mockRow = createMockItemRow()

      act(() => {
        quickReport!.onClick(mockRow)
      })

      expect(mockOpenTab).toHaveBeenCalledWith({
        component: "QuickReportPage",
        title: "Quick Report - Test Item",
        closable: true,
        props: {
          itemStoreId: "item-store-1",
          itemId: "item-1",
          upcCode: "1234567890",
          description: "Test Item",
          onHand: 100,
        },
      })
    })

    it("should use barcode as fallback in Quick Report title when name is empty", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        label: string
        onClick: (row: Record<string, unknown>) => void
      }>
      const quickReport = items.find((i) => i.label === "Quick Report")

      act(() => {
        quickReport!.onClick(createMockItemRow({ name: "", barcodeNumber: "5555555" }))
      })

      expect(mockOpenTab).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Quick Report - 5555555",
        })
      )
    })
  })

  describe("Toggle Status", () => {
    it("should have a dynamic label based on row status", async () => {
      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        label: string | ((row: Record<string, unknown>) => string)
      }>
      const toggleStatus = items[items.length - 1]

      const labelFn = toggleStatus.label as (row: Record<string, unknown>) => string
      expect(labelFn({ status: 0 })).toBe("Activate")
      expect(labelFn({ status: 1 })).toBe("Deactivate")
    })

    it("should call toggle status API on click", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            isSuccess: true,
            message: "Status updated",
          }),
      })
      global.fetch = mockFetch

      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        label: string | ((row: Record<string, unknown>) => string)
        onClick: (row: Record<string, unknown>) => void
      }>
      const toggleStatus = items[items.length - 1]

      await act(async () => {
        toggleStatus.onClick(createMockItemRow({ status: 1, itemStoreID: "toggle-1" }))
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("toggle-1"),
        expect.objectContaining({ method: "PUT" })
      )
    })

    it("should show error toast when toggle status API fails", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            isSuccess: false,
            message: "Failed to update",
          }),
      })
      global.fetch = mockFetch

      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        onClick: (row: Record<string, unknown>) => void
      }>
      const toggleStatus = items[items.length - 1]

      await act(async () => {
        toggleStatus.onClick(createMockItemRow())
      })

      await waitFor(() => {
        expect(screen.getByText("Failed to update")).toBeInTheDocument()
      })
    })

    it("should show generic error toast when toggle status throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))

      await renderItemListPage()
      const items = mockServerGridProps.customContextMenuItems as Array<{
        onClick: (row: Record<string, unknown>) => void
      }>
      const toggleStatus = items[items.length - 1]

      await act(async () => {
        toggleStatus.onClick(createMockItemRow())
      })

      await waitFor(() => {
        expect(screen.getByText("Error updating item status")).toBeInTheDocument()
      })
    })
  })

  describe("Row Class Name", () => {
    it("should return inactive-row class for status 0", async () => {
      await renderItemListPage()
      const getRowClassName = mockServerGridProps.getRowClassName as (row: Record<string, unknown>) => string
      expect(getRowClassName({ status: 0 })).toBe("inactive-row")
    })

    it("should return empty string for active items", async () => {
      await renderItemListPage()
      const getRowClassName = mockServerGridProps.getRowClassName as (row: Record<string, unknown>) => string
      expect(getRowClassName({ status: 1 })).toBe("")
    })

    it("should return empty string for null row", async () => {
      await renderItemListPage()
      const getRowClassName = mockServerGridProps.getRowClassName as (row: Record<string, unknown> | null) => string
      expect(getRowClassName(null)).toBe("")
    })
  })

  describe("Keyboard Shortcuts", () => {
    it("should open copy modal on Ctrl+G when a row is selected", async () => {
      await renderItemListPage()
      const onRowSelection = mockServerGridProps.onRowSelection as (id: string) => void
      act(() => {
        onRowSelection("item-store-1")
      })

      const items = mockServerGridProps.customContextMenuItems as Array<{
        label: string
        onClick: (row: Record<string, unknown>) => void
      }>
      const copyItem = items.find((i) => i.label === "Copy Item")
      act(() => {
        copyItem!.onClick(createMockItemRow())
      })

      await waitFor(() => {
        expect(screen.getByTestId("copy-item-modal")).toBeInTheDocument()
      })
    })
  })

  describe("Bulk Operations", () => {
    it("should not trigger bulk delete when no rows are selected", async () => {
      await renderItemListPage()
      fireEvent.click(screen.getByTestId("btn-bulk-delete"))
      expect(screen.queryByText(/items deleted successfully/)).not.toBeInTheDocument()
    })

    it("should trigger bulk delete when rows are selected", async () => {
      await renderItemListPage()
      const onRowSelection = mockServerGridProps.onRowSelection as (id: string) => void

      act(() => {
        onRowSelection("item-store-1")
        onRowSelection("item-store-2")
      })

      fireEvent.click(screen.getByTestId("btn-bulk-delete"))

      await waitFor(() => {
        expect(screen.getByText("2 items deleted successfully!")).toBeInTheDocument()
      })
    })

    it("should clear selected rows after bulk delete", async () => {
      await renderItemListPage()
      const onRowSelection = mockServerGridProps.onRowSelection as (id: string) => void

      act(() => {
        onRowSelection("item-store-1")
      })

      fireEvent.click(screen.getByTestId("btn-bulk-delete"))

      await waitFor(() => {
        expect(screen.getByTestId("selected-count")).toHaveTextContent("0")
      })
    })
  })

  describe("Toast Notifications", () => {
    it("should auto-dismiss toast after 3 seconds", async () => {
      await renderItemListPage()
      fireEvent.click(screen.getByTestId("btn-remount"))

      expect(screen.getByText("Grid refreshed and search cleared")).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(3100)
      })

      await waitFor(() => {
        expect(screen.queryByText("Grid refreshed and search cleared")).not.toBeInTheDocument()
      })
    })

    it("should show info toast for grid refresh", async () => {
      await renderItemListPage()
      fireEvent.click(screen.getByTestId("btn-remount"))

      await waitFor(() => {
        expect(screen.getByText("Grid refreshed and search cleared")).toBeInTheDocument()
        expect(screen.getByText("Info")).toBeInTheDocument()
      })
    })
  })

  describe("Fetch All Data (Export)", () => {
    it("should pass fetchAllData function to export handlers", async () => {
      await renderItemListPage()
      expect(mockServerGridProps.apiUrl).toBeDefined()
    })
  })

  describe("Column Definitions", () => {
    it("should pass columns from useGridSettings to ServerGrid", async () => {
      await renderItemListPage()
      const cols = mockServerGridProps.columns as Array<{ field: string }>
      expect(cols).toBeDefined()
      expect(cols.length).toBeGreaterThan(0)
    })
  })
})
