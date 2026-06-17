/**
 * Central registry of every grid-based screen in the application.
 *
 * This is the single source of truth for the Super Admin "Grid Settings"
 * screen — it tells the admin which grids exist, what human-readable label to
 * show, and which columns the grid defines (so the admin can tick/untick
 * visibility per tenant).
 *
 * Keeping the metadata here (rather than importing from each page's column
 * definitions) avoids bundling every list page for the admin screen and
 * eliminates cycles.
 *
 * When adding a new grid-based page:
 *   1. Pick a stable `gridId` (kebab-case, ending in `-list-grid`).
 *   2. Add an entry to GRID_REGISTRY below with the full column list.
 *   3. Wire the page to `useGridSettings(gridId, ...)` and `useColumnAccessFilter`.
 *   4. Add `gridId={X_GRID_ID}` to the page's <ActionHeader> so users get the
 *      Reset Grid button automatically.
 *   5. Remove `hidden: true` from the registry entry once it's ready to
 *      surface in the Super Admin dropdown.
 */

export interface RegisteredColumn {
  field: string
  headerName: string
  /** Optional extra description shown in the admin checklist tooltip. */
  description?: string
  /**
   * When true, this field is non-revocable: Grid Settings renders the
   * "Allow to view" checkbox disabled (already-checked) and the form
   * modal always renders the corresponding input even if a stale rule
   * says otherwise. Used for fields the backend treats as required —
   * revoking them would break Create / Update validation.
   */
  required?: boolean
}

export interface RegisteredGrid {
  gridId: string
  /** Human-readable name shown in the admin dropdown. */
  label: string
  /** Optional short description shown under the grid dropdown. */
  description?: string
  /** Full column list — the admin can toggle visibility on any of these. */
  columns: RegisteredColumn[]
  /**
   * When true, this grid is excluded from the Super Admin Grid Settings
   * dropdown. The entry stays in the registry so the gridId remains
   * stable / future-proof, but admins can't configure it yet because the
   * column metadata + page wiring haven't been finalized. Flip to false
   * (or remove) once the grid is production-ready.
   *
   * `getAllRegisteredGrids()` filters these out; `getRegisteredGrid(id)`
   * still returns them so direct API calls and existing user-overrides
   * keep working.
   */
  hidden?: boolean
}

// ===========================================================================
// COLUMN LISTS — keep field names in sync with each page's column defs.
// If a page renames or removes a field, update its entry here too or the
// admin's "hide column X" rule will silently fail.
// ===========================================================================

// src/pages/Items/ItemListPage.tsx — itemsColumnDefs
const ITEMS_COLUMNS: RegisteredColumn[] = [
  { field: 'itemID', headerName: 'Item ID' },
  { field: 'itemNo', headerName: 'Item No' },
  { field: 'name', headerName: 'Name' },
  { field: 'barcodeNumber', headerName: 'Barcode Number' },
  { field: 'modalNumber', headerName: 'Model Number' },
  { field: 'linkNo', headerName: 'Link No' },
  { field: 'storeNo', headerName: 'Store No' },
  { field: 'price', headerName: 'Price' },
  { field: 'cost', headerName: 'Cost' },
  { field: 'cs_Cost', headerName: 'Case Cost' },
  { field: 'pc_Cost', headerName: 'Pc Cost' },
  { field: 'onHand', headerName: 'On Hand' },
  { field: 'csOnHand', headerName: 'Cs On Hand' },
  { field: 'caseQty', headerName: 'Case Qty' },
  { field: 'priceByCase', headerName: 'Price By Case' },
  { field: 'costByCase', headerName: 'Cost By Case' },
  { field: 'caseBarcodeNumber', headerName: 'Case Barcode' },
  { field: 'isTaxable', headerName: 'Taxable' },
  { field: 'isDiscount', headerName: 'Discount' },
  { field: 'isFoodStampable', headerName: 'Food Stampable' },
  { field: 'isWIC', headerName: 'WIC' },
  { field: 'itemTypeName', headerName: 'Item Type' },
  { field: 'itemType', headerName: 'Item Type Code' },
  { field: 'supplierName', headerName: 'Supplier' },
  { field: 'supplier_Item_Code', headerName: 'Supplier Item Code' },
  { field: 'manufacturerPartNo', headerName: 'Mfr Part No' },
  { field: 'brand', headerName: 'Brand' },
  { field: 'department', headerName: 'Department' },
  { field: 'departmentID', headerName: 'Department ID' },
  { field: 'size', headerName: 'Size' },
  { field: 'styleNo', headerName: 'Style No' },
  { field: 'binLocation', headerName: 'Bin Location' },
  { field: 'toReorder', headerName: 'To Reorder' },
  { field: 'markup', headerName: 'Markup' },
  { field: 'margin', headerName: 'Margin' },
  { field: 'sP_Price', headerName: 'SP Price' },
  { field: 'sP_From', headerName: 'SP From' },
  { field: 'sP_To', headerName: 'SP To' },
  { field: 'future_SP_Price', headerName: 'Future SP Price' },
  { field: 'future_SP_From', headerName: 'Future SP From' },
  { field: 'future_SP_To', headerName: 'Future SP To' },
  { field: 'mtd', headerName: 'MTD' },
  { field: 'mtD_Pc_Qty', headerName: 'MTD Pc Qty' },
  { field: 'mtD_Cs_Qty', headerName: 'MTD Cs Qty' },
  { field: 'ytd', headerName: 'YTD' },
  { field: 'ytD_Pc_Qty', headerName: 'YTD Pc Qty' },
  { field: 'ytD_Cs_Qty', headerName: 'YTD Cs Qty' },
  { field: 'ptd', headerName: 'PTD' },
  { field: 'ptD_Pc_Qty', headerName: 'PTD Pc Qty' },
  { field: 'ptD_Cs_Qty', headerName: 'PTD Cs Qty' },
  { field: 'matrix1', headerName: 'Matrix 1' },
  { field: 'matrix2', headerName: 'Matrix 2' },
  { field: 'matrix3', headerName: 'Matrix 3' },
  { field: 'matrix4', headerName: 'Matrix 4' },
  { field: 'matrix5', headerName: 'Matrix 5' },
  { field: 'matrix6', headerName: 'Matrix 6' },
  { field: 'matrixTableNo', headerName: 'Matrix Table No' },
  { field: 'status', headerName: 'Status' },
  { field: 'mainStatus', headerName: 'Main Status' },
  { field: 'itemStoreID', headerName: 'Item Store ID' },
]

// src/pages/Items/ItemQuickListPage.tsx — itemQuickListColumnDefs
const ITEMS_QUICK_LIST_COLUMNS: RegisteredColumn[] = [
  { field: 'department', headerName: 'Department' },
  { field: 'name', headerName: 'Name' },
  { field: 'modelNo', headerName: 'Model No' },
  { field: 'upc', headerName: 'UPC' },
  { field: 'supplier', headerName: 'Supplier' },
  { field: 'price', headerName: 'Price' },
  { field: 'onHand', headerName: 'On Hand' },
]

// src/pages/ItemGroups/ItemGroupListPage.tsx
const ITEM_GROUPS_COLUMNS: RegisteredColumn[] = [
  { field: 'name', headerName: 'Name' },
  { field: 'status', headerName: 'Status' },
  { field: 'dateModified', headerName: 'Date Modified' },
  { field: 'dateCreated', headerName: 'Date Created' },
]

// src/pages/Departments/DepartmentListPage.tsx
const DEPARTMENTS_COLUMNS: RegisteredColumn[] = [
  { field: 'name', headerName: 'Name' },
  { field: 'description', headerName: 'Description' },
  { field: 'defaultMarkup', headerName: 'Default Markup' },
  { field: 'roundUp', headerName: 'Round Up' },
  { field: 'isDefaultTaxInclude', headerName: 'Taxable' },
  { field: 'isDefaultFoodStampable', headerName: 'Food Stampable' },
  { field: 'isDefaultDiscountable', headerName: 'Discountable' },
  { field: 'status', headerName: 'Status' },
  { field: 'dateModified', headerName: 'Date Modified' },
]

// src/pages/Manufacturers/ManufacturerListPage.tsx
const MANUFACTURERS_COLUMNS: RegisteredColumn[] = [
  { field: 'manufacturerName', headerName: 'Manufacturer Name' },
  { field: 'manufacturerNo', headerName: 'Manufacturer No' },
  { field: 'status', headerName: 'Status' },
  { field: 'dateModified', headerName: 'Date Modified' },
  { field: 'dateCreated', headerName: 'Date Created' },
]

// src/pages/Discounts/DiscountListPage.tsx
const DISCOUNTS_COLUMNS: RegisteredColumn[] = [
  { field: 'name', headerName: 'Name' },
  { field: 'startDate', headerName: 'Start Date' },
  { field: 'endDate', headerName: 'End Date' },
  { field: 'percentsDiscount', headerName: 'Percent Discount' },
  { field: 'amountDiscount', headerName: 'Amount Discount' },
  { field: 'discountTypeName', headerName: 'Discount Type' },
  { field: 'upcDiscount', headerName: 'UPC Discount' },
  { field: 'status', headerName: 'Status' },
  { field: 'dateCreated', headerName: 'Date Created' },
  { field: 'dateModified', headerName: 'Date Modified' },
]

// src/pages/Computers/ComputerListPage.tsx
const COMPUTERS_COLUMNS: RegisteredColumn[] = [
  { field: 'computerName', headerName: 'Computer Name' },
  { field: 'labelPrinter', headerName: 'Label Printer' },
  { field: 'shelfPrinter', headerName: 'Shelf Printer' },
  { field: 'invoicePrinter', headerName: 'Invoice Printer' },
  { field: 'statementPrinter', headerName: 'Statement Printer' },
  { field: 'computerNo', headerName: 'Computer No' },
  { field: 'storeID', headerName: 'Store ID' },
  { field: 'status', headerName: 'Status' },
  { field: 'dateCreated', headerName: 'Date Created' },
  { field: 'dateModified', headerName: 'Date Modified' },
]

// src/pages/users/UsersListPage.tsx
const USERS_COLUMNS: RegisteredColumn[] = [
  { field: 'userName', headerName: 'Username' },
  { field: 'email', headerName: 'Email' },
  { field: 'phone', headerName: 'Phone' },
  { field: 'dateCreated', headerName: 'Date Created' },
  { field: 'dateModified', headerName: 'Date Modified' },
  { field: 'lastLoginDate', headerName: 'Last Login' },
]

// src/pages/TenantAdmin/TenantUserRolePage.tsx
const USER_ROLES_COLUMNS: RegisteredColumn[] = [
  { field: 'name', headerName: 'Name', required: true },
  { field: 'code', headerName: 'Code' },
  { field: 'description', headerName: 'Description' },
  { field: 'isActive', headerName: 'Active' },
  { field: 'createdAt', headerName: 'Created' },
]

// ---------------------------------------------------------------------------
// Reference column lists kept for grids that aren't surfaced yet
// (Customers, Stores, Custom Date Scope). They're complete enough to use
// once we lift `hidden: true` on the corresponding entries.
// ---------------------------------------------------------------------------

const CUSTOMERS_COLUMNS: RegisteredColumn[] = [
  { field: 'customerID', headerName: 'Customer ID' },
  { field: 'customerNo', headerName: 'Customer No' },
  { field: 'name', headerName: 'Name' },
  { field: 'firstName', headerName: 'First Name' },
  { field: 'lastName', headerName: 'Last Name' },
  { field: 'address', headerName: 'Address' },
  { field: 'city', headerName: 'City' },
  { field: 'state', headerName: 'State' },
  { field: 'zip', headerName: 'Zip' },
  { field: 'phone', headerName: 'Phone' },
  { field: 'cell', headerName: 'Cell' },
  { field: 'email', headerName: 'Email' },
  { field: 'credit', headerName: 'Credit' },
  { field: 'balanceDoe', headerName: 'Balance' },
  { field: 'lastVisit', headerName: 'Last Visit' },
  { field: 'lastPayment', headerName: 'Last Payment' },
  { field: 'groupName', headerName: 'Group' },
  { field: 'over30', headerName: 'Over 30' },
  { field: 'over60', headerName: 'Over 60' },
  { field: 'over90', headerName: 'Over 90' },
]

const STORES_COLUMNS: RegisteredColumn[] = [
  { field: 'storeName', headerName: 'Store Name' },
  { field: 'storeNo', headerName: 'Store No' },
  { field: 'address', headerName: 'Address' },
  { field: 'city', headerName: 'City' },
  { field: 'phone', headerName: 'Phone' },
  { field: 'email', headerName: 'Email' },
  { field: 'isActive', headerName: 'Active' },
]

const CUSTOM_DATE_SCOPE_COLUMNS: RegisteredColumn[] = [
  { field: 'sortOrder', headerName: 'Sort' },
  { field: 'name', headerName: 'Name', required: true },
  { field: 'description', headerName: 'Description' },
  { field: 'fromDate', headerName: 'From', required: true },
  { field: 'toDate', headerName: 'To', required: true },
  { field: 'isActive', headerName: 'Status' },
]

// ===========================================================================
// THE REGISTRY
//
// Grids surfaced to Super Admin (visible in the dropdown):
//   - Items List
//   - Items Quick List
//   - Item Groups List
//   - Departments List
//   - Manufacturers List
//   - Discounts List
//   - Computers List
//   - Users List
//
// Every other grid is `hidden: true` so it doesn't clutter the admin UI
// until its page-level wiring is finished and its columns are confirmed.
// ===========================================================================

export const GRID_REGISTRY: RegisteredGrid[] = [
  { gridId: 'items-list-grid', label: 'Items List', columns: ITEMS_COLUMNS },
  { gridId: 'items-quick-list', label: 'Items Quick List', columns: ITEMS_QUICK_LIST_COLUMNS },
  { gridId: 'item-groups-list-grid', label: 'Item Groups List', columns: ITEM_GROUPS_COLUMNS },
  { gridId: 'departments-list-grid', label: 'Departments List', columns: DEPARTMENTS_COLUMNS },
  { gridId: 'manufacturers-list-grid', label: 'Manufacturers List', columns: MANUFACTURERS_COLUMNS },
  { gridId: 'discounts-list-grid', label: 'Discounts List', columns: DISCOUNTS_COLUMNS },
  { gridId: 'computers-list-grid', label: 'Computers List', columns: COMPUTERS_COLUMNS },
  { gridId: 'users-list-grid', label: 'Users List', columns: USERS_COLUMNS },
  { gridId: 'user-roles-list-grid', label: 'User Roles List', columns: USER_ROLES_COLUMNS },

  // --- Hidden from admin dropdown until ready ----------------------------
  { gridId: 'customers-list-grid', label: 'Customers List', columns: CUSTOMERS_COLUMNS, hidden: true },
  { gridId: 'stores-list-grid', label: 'Stores List', columns: STORES_COLUMNS, hidden: true },
  { gridId: 'vendors-list-grid', label: 'Vendors List', columns: [], hidden: true },
  { gridId: 'suppliers-list-grid', label: 'Suppliers List', columns: [], hidden: true },
  { gridId: 'registers-list-grid', label: 'Registers List', columns: [], hidden: true },
  { gridId: 'payments-list-grid', label: 'Payments List', columns: [], hidden: true },
  { gridId: 'receive-payments-list-grid', label: 'Receive Payments List', columns: [], hidden: true },
  { gridId: 'purchase-orders-list-grid', label: 'Purchase Orders List', columns: [], hidden: true },
  { gridId: 'receive-orders-list-grid', label: 'Receive Orders List', columns: [], hidden: true },
  { gridId: 'phone-orders-list-grid', label: 'Phone Orders List', columns: [], hidden: true },
  { gridId: 'items-on-phone-order-list-grid', label: 'Items on Phone Order', columns: [], hidden: true },
  { gridId: 'item-details-on-phone-order-list-grid', label: 'Item Details on Phone Order', columns: [], hidden: true },
  { gridId: 'general-order-list-grid', label: 'General Order List', columns: [], hidden: true },
  { gridId: 'return-to-vendor-list-grid', label: 'Return to Vendor List', columns: [], hidden: true },
  { gridId: 'replaced-items-list-grid', label: 'Replaced Items List', columns: [], hidden: true },
  { gridId: 'transactions-list-grid', label: 'Transactions List', columns: [], hidden: true },
  { gridId: 'transfers-list-grid', label: 'Transfers List', columns: [], hidden: true },
  { gridId: 'request-transfers-list-grid', label: 'Request Transfers List', columns: [], hidden: true },
  { gridId: 'receive-transfers-list-grid', label: 'Receive Transfers List', columns: [], hidden: true },
  { gridId: 'tenant-logs-list-grid', label: 'Tenant Logs List', columns: [], hidden: true },
  {
    gridId: 'custom-date-scope-list-grid',
    label: 'Setup > Custom Date Scope',
    columns: CUSTOM_DATE_SCOPE_COLUMNS,
    hidden: true,
  },
]

/**
 * Look up a grid's metadata by id. Returns null if the gridId is unknown.
 * Returns hidden grids too — the hidden flag is purely about dropdown
 * visibility, not about whether the grid exists.
 */
export const getRegisteredGrid = (gridId: string): RegisteredGrid | null => {
  return GRID_REGISTRY.find(g => g.gridId === gridId) ?? null
}

/**
 * Return every gridId that has had its columns populated AND is not hidden.
 * Useful for any caller that only wants production-ready grids.
 */
export const getRegisteredGridsWithColumns = (): RegisteredGrid[] => {
  return GRID_REGISTRY.filter(g => !g.hidden && g.columns.length > 0)
                      .sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Return every grid that should appear in the Super Admin Grid Settings
 * dropdown. Hidden grids are excluded; everything else is alphabetized.
 *
 * Grids in the registry but flagged `hidden: true` stay reachable via
 * direct API calls and via `getRegisteredGrid(id)` for callers that need
 * the metadata, but admins won't see them in the selector.
 */
export const getAllRegisteredGrids = (): RegisteredGrid[] => {
  return GRID_REGISTRY.filter(g => !g.hidden)
                      .sort((a, b) => a.label.localeCompare(b.label))
}
