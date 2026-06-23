// src/constants/api.ts

// Root URL (you can also load this from Vite .env file if needed).
// Fallback to same origin when VITE_API_BASE_URL is not set (e.g. in some dev setups).
export const BASE_API_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  (typeof window !== "undefined" ? window.location.origin : "")

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${BASE_API_URL}/api/Auth/login`,
    CONFIRM_LOGIN: `${BASE_API_URL}/api/Auth/confirm-login`,
    REFRESH: `${BASE_API_URL}/api/Auth/refresh`,
    LOGOUT: `${BASE_API_URL}/api/Auth/logout`,
    GOOGLE_LOGIN: `${BASE_API_URL}/api/Auth/google-login`,
  },
  ITEMS: {
    GET_DYNAMIC: `${BASE_API_URL}/api/items/GetItemsDynamic`,
    GET_ALL_ITEMS: `${BASE_API_URL}/api/Items/GetAllItems`,
    /** Aggregate totals for the Item List summary cards (sum across all
     *  rows matching the current filter, not just the loaded subset). */
    GET_ITEMS_TOTALS: `${BASE_API_URL}/api/Items/Totals`,
    ADD_ITEM: `${BASE_API_URL}/api/Items/AddItem`,
    UPDATE_ITEM: `${BASE_API_URL}/api/Items/UpdateItem`,
    GET_ITEM: (itemStoreId: string) => `${BASE_API_URL}/api/Items/GetItem/${itemStoreId}`,
    BARCODE_EXISTS: `${BASE_API_URL}/api/Items/BarcodeExists`,
    MODEL_NUMBER_EXISTS: `${BASE_API_URL}/api/Items/ModelNumberExists`,
    ITEM_NAME_EXISTS: `${BASE_API_URL}/api/Items/ItemNameExists`,
    ALIAS_BARCODE_EXISTS: `${BASE_API_URL}/api/Items/AliasBarcodeExists`,
    GENERATE_CODE: `${BASE_API_URL}/api/Items/GenerateCode`,
    DEPARTMENT_DEFAULTS: (deptStoreId: string) => `${BASE_API_URL}/api/Items/DepartmentDefaults/${deptStoreId}`,
    UPLOAD_IMAGE: `${BASE_API_URL}/api/Items/UploadImage`,
    GET_IMAGE_URL: (itemId: string) => `${BASE_API_URL}/api/Items/GetImageUrl/${itemId}`,
    DELETE_IMAGE: (itemId: string) => `${BASE_API_URL}/api/Items/DeleteImage/${itemId}`,
    GET_ITEMS_WITH_INVENTORY: `${BASE_API_URL}/api/Items/GetItemsWithInventory`,
    GET_ITEMS_QUICK_LIST: `${BASE_API_URL}/api/Items/GetItemsQuickList`,
    TOGGLE_STATUS: (itemStoreId: string) => `${BASE_API_URL}/api/Items/${itemStoreId}/toggle-status`,
    BULK_ACTIVATE: `${BASE_API_URL}/api/Items/bulk-activate`,
    BULK_DEACTIVATE: `${BASE_API_URL}/api/Items/bulk-deactivate`,
    BULK_TOGGLE_PHONE_ORDER: `${BASE_API_URL}/api/Items/bulk-toggle-phone-order`,
    BULK_ENABLE_PHONE_ORDER: `${BASE_API_URL}/api/Items/bulk-enable-phone-order`,
    BULK_DELETE: `${BASE_API_URL}/api/Items/bulk-delete`,
  },
  EMPLOYEES: {
    LIST: `${BASE_API_URL}/employees/list`,
    DETAILS: (id: string | number) => `${BASE_API_URL}/employees/${id}`,
  },
  USERS: {
    GET_USERS: `${BASE_API_URL}/api/User/GetAllUsers`,
    GET_USERS_BY_CUSTOMER: (customerId: number) => `${BASE_API_URL}/api/User/GetUsersByCustomer/${customerId}`,
    GET_USER_BY_ID: (tenantUserId: string) => `${BASE_API_URL}/api/User/GetUserById/${tenantUserId}`,
    CREATE_USER: `${BASE_API_URL}/api/User/CreateUser`,
    UPDATE_USER: `${BASE_API_URL}/api/User/UpdateUser`,
    DELETE_USER: (tenantUserId: string) => `${BASE_API_URL}/api/User/DeleteUser/${tenantUserId}`,
    // Self-service profile (the /profile page) — acting user resolved from the JWT.
    GET_MY_PROFILE: `${BASE_API_URL}/api/User/Me`,
    UPDATE_MY_PROFILE: `${BASE_API_URL}/api/User/UpdateMyProfile`,
    CHANGE_MY_PASSWORD: `${BASE_API_URL}/api/User/ChangeMyPassword`,
    UPLOAD_PROFILE_IMAGE: `${BASE_API_URL}/api/User/UploadProfileImage`,
    DELETE_PROFILE_IMAGE: `${BASE_API_URL}/api/User/DeleteProfileImage`,
  },
  CUSTOMER: {
    GET_ALL_TENANTS: `${BASE_API_URL}/api/Customer/GetAllTenantsLookup`,
    GET_ALL_CUSTOMERS: `${BASE_API_URL}/api/Customer/GetAllCustomers`,
    GET_BY_ID: (id: string) => `${BASE_API_URL}/api/Customer/${id}`,
    CREATE: `${BASE_API_URL}/api/Customer`,
    UPDATE: (id: string) => `${BASE_API_URL}/api/Customer/${id}`,
    DELETE: (id: string) => `${BASE_API_URL}/api/Customer/${id}`,
  },
  // Matrix children CRUD + bulk operations. Port of legacy
  // desktop FrmMatrix.vb — used by MatrixEditor on the Item form.
  MATRIX: {
    LIST: (parentId: string, storeId: string) =>
      `${BASE_API_URL}/api/Items/${parentId}/matrix-children?storeId=${storeId}`,
    PATCH: (itemStoreId: string) =>
      `${BASE_API_URL}/api/Items/matrix-children/${itemStoreId}`,
    ADD: (parentId: string) =>
      `${BASE_API_URL}/api/Items/${parentId}/matrix-children`,
    BULK_COST: (parentId: string) =>
      `${BASE_API_URL}/api/Items/${parentId}/matrix-children/bulk-cost`,
    BULK_PRICE: (parentId: string) =>
      `${BASE_API_URL}/api/Items/${parentId}/matrix-children/bulk-price`,
    DELETE: (itemStoreId: string, reason?: string) => {
      const r = reason ? `?reason=${encodeURIComponent(reason)}` : ''
      return `${BASE_API_URL}/api/Items/matrix-children/${itemStoreId}${r}`
    },
    // Phase 2 — template + value management, bulk generation, on-hand adjust.
    TEMPLATES: `${BASE_API_URL}/api/Items/matrix-templates`,
    TEMPLATE: (id: string) => `${BASE_API_URL}/api/Items/matrix-templates/${id}`,
    TEMPLATE_VALUES: (templateId: string) =>
      `${BASE_API_URL}/api/Items/matrix-templates/${templateId}/values`,
    VALUE_DELETE: (valueId: string, cascadeChildren = false) =>
      `${BASE_API_URL}/api/Items/matrix-values/${valueId}?cascadeChildren=${cascadeChildren}`,
    GLOBAL_COLORS: `${BASE_API_URL}/api/Items/matrix-colors`,
    GENERATE: (parentId: string) =>
      `${BASE_API_URL}/api/Items/${parentId}/matrix-children/generate`,
    ADJUST_ONHAND: `${BASE_API_URL}/api/Items/matrix-children/adjust-onhand`,
  },
  TENANT_SETUP: {
    // Returns read-only tenant-wide flags (StoreType + module switches)
    // projected from the encrypted EncData blob. Tenant resolved by the
    // CustomerId header (added in getAuthHeaders) or the JWT claim.
    GET: `${BASE_API_URL}/api/Tenant/Setup`,
  },
  SUPERADMIN_CUSTOMERS: {
    GET_ALL: `${BASE_API_URL}/api/SuperAdmin/Customers`,
    GET_BY_ID: (id: number | string) => `${BASE_API_URL}/api/SuperAdmin/Customers/${id}`,
    CREATE: `${BASE_API_URL}/api/SuperAdmin/Customers`,
    UPDATE: (id: number | string) => `${BASE_API_URL}/api/SuperAdmin/Customers/${id}`,
    DELETE: (id: number | string) => `${BASE_API_URL}/api/SuperAdmin/Customers/${id}`,
    // License Setup — decrypted view / update of the per-tenant EncData blob.
    // Mirrors the legacy WinForms FrmStartWz.
    LICENSE_GET: (id: number | string) =>
      `${BASE_API_URL}/api/SuperAdmin/Customers/${id}/license`,
    LICENSE_UPDATE: (id: number | string) =>
      `${BASE_API_URL}/api/SuperAdmin/Customers/${id}/license`,
  },
  // Super-Admin: migrate legacy desktop label layouts (tenant PrintLabelLayout)
  // into the web Label Designer (LabelTemplates). The target tenant is selected
  // via the CustomerId header (use getAuthHeadersWithCustomerId).
  LABEL_IMPORT: {
    GET_LEGACY_LAYOUTS: `${BASE_API_URL}/api/LabelImport/legacy-layouts`,
    GET_LEGACY_LAYOUTS_PAGED: `${BASE_API_URL}/api/LabelImport/legacy-layouts/paged`,
    IMPORT: `${BASE_API_URL}/api/LabelImport/import`,
  },
  // Super-Admin: migrate legacy desktop user security groups (tenant Groups table)
  // into the web RBAC roles (RbacTenantRoles). Tenant selected via CustomerId header.
  GROUP_IMPORT: {
    GET_LEGACY_GROUPS_PAGED: `${BASE_API_URL}/api/GroupImport/legacy-groups/paged`,
    IMPORT: `${BASE_API_URL}/api/GroupImport/import`,
  },
  SEND_INVITE: {
    SEND_USER_INVITE: `${BASE_API_URL}/api/Common/SendInvite`,
  },
  SYSTEM_LOOKUPS: {
    GET_ITEM_TYPES: `${BASE_API_URL}/api/SystemLookups/ItemTypes`,
    GET_BARCODE_TYPES: `${BASE_API_URL}/api/SystemLookups/BarcodeTypes`,
    GET_UOM_TYPES: `${BASE_API_URL}/api/SystemLookups/UOMTypes`,
    GET_MEASURE_TYPES: `${BASE_API_URL}/api/SystemLookups/MeasureTypes`,
    GET_DEPARTMENTS: `${BASE_API_URL}/api/SystemLookups/Departments`,
    GET_ITEMS_LOOKUP_VALUES: `${BASE_API_URL}/api/SystemLookups/ItemsLookupValues`,
    GET_EXTRA_CHARGE_ITEMS: `${BASE_API_URL}/api/SystemLookups/ExtraChargeItems`,
    GET_APP_ITEMS: `${BASE_API_URL}/api/SystemLookups/AppItems`,
    GET_TAXES: `${BASE_API_URL}/api/SystemLookups/Taxes`,
    GET_STORES: `${BASE_API_URL}/api/SystemLookups/Stores`,
    GET_STORES_BY_USER: (userId: string, customerId: number) => `${BASE_API_URL}/api/SystemLookups/StoresByUser?userId=${userId}&customerId=${customerId}`,
    GET_CUSTOMERS_LOOKUP: `${BASE_API_URL}/api/SystemLookups/Customers`,
    GET_VENDORS_LOOKUP: `${BASE_API_URL}/api/SystemLookups/Vendors`,
    GET_SUPPLIERS_LOOKUP: `${BASE_API_URL}/api/SystemLookups/Suppliers`,
    GET_SHIFT_PRESETS: `${BASE_API_URL}/api/SystemLookups/ShiftPresets`,
    GET_DRIVER_NOTES: `${BASE_API_URL}/api/SystemLookups/PhoneNotes?type=2`,
    GET_PICK_NOTES: `${BASE_API_URL}/api/SystemLookups/PhoneNotes?type=3`,
    GET_PHONE_NOTES: (type: number) => `${BASE_API_URL}/api/SystemLookups/PhoneNotes?type=${type}`,
    GET_ZONES: `${BASE_API_URL}/api/SystemLookups/Zones`,
    GET_TENDERS: `${BASE_API_URL}/api/SystemLookups/Tenders`,
    GET_USERS_FOR_PICK_BY: (storeId: string) => `${BASE_API_URL}/api/SystemLookups/UsersForPickBy?storeId=${storeId}`,
    // Phone Notes CRUD operations
    SAVE_PHONE_NOTES_BATCH: `${BASE_API_URL}/api/SystemLookups/PhoneNotes/batch`,
    ADD_PHONE_NOTE: `${BASE_API_URL}/api/SystemLookups/PhoneNotes`,
    UPDATE_PHONE_NOTE: (id: number) => `${BASE_API_URL}/api/SystemLookups/PhoneNotes/${id}`,
    DELETE_PHONE_NOTE: (id: number) => `${BASE_API_URL}/api/SystemLookups/PhoneNotes/${id}`,
    // Mix & Match
    GET_MIX_AND_MATCHES: `${BASE_API_URL}/api/SystemLookups/MixAndMatches`,
    CREATE_MIX_AND_MATCH: `${BASE_API_URL}/api/SystemLookups/MixAndMatches`,
    GET_GROUPS: `${BASE_API_URL}/api/SystemLookups/Groups`,
    GET_ITEM_GROUPS: `${BASE_API_URL}/api/SystemLookups/ItemGroups`,
    GET_CUSTOMER_GROUPS: `${BASE_API_URL}/api/SystemLookups/CustomerGroups`,
      GET_ALL_STORES: `${BASE_API_URL}/api/SystemLookups/AllStores`,
      CREATE_ITEMS_LOOKUP_VALUE: `${BASE_API_URL}/api/SystemLookups/ItemsLookupValues`,
      GET_ADJUST_TYPES: `${BASE_API_URL}/api/SystemLookups/AdjustTypes`,
      // ─── Advanced Filters modal lookups (Item/Supplier/Customer/More tabs)
      GET_CUSTOMER_TYPES: `${BASE_API_URL}/api/SystemLookups/CustomerTypes`,
      GET_PRICE_LEVELS: `${BASE_API_URL}/api/SystemLookups/PriceLevels`,
      GET_CUSTOMER_ZIPS: `${BASE_API_URL}/api/SystemLookups/CustomerZips`,
      GET_DISCOUNTS_LOOKUP: `${BASE_API_URL}/api/SystemLookups/Discounts`,
      GET_BRANDS: `${BASE_API_URL}/api/SystemLookups/Brands`,
      SEARCH_ITEMS_FILTER: (search?: string, take: number = 50) =>
        `${BASE_API_URL}/api/SystemLookups/Items?search=${encodeURIComponent(search ?? '')}&take=${take}`,
      // Distinct active items (one row per ItemMain), paginated + searched — used by
      // the discount item picker so pages are exact and have no per-store duplicates.
      ITEMS_PAGED: `${BASE_API_URL}/api/SystemLookups/ItemsPaged`,
      // Resolve item ids → {id, name} so the discount picker can pin already-selected
      // items at the top of the list even when they aren't on a loaded page.
      ITEMS_BY_IDS: `${BASE_API_URL}/api/SystemLookups/ItemsByIds`,
      // Discount "Import Items" — items matching Department/Brand/Supplier/Group/ItemType.
      DISCOUNT_IMPORT_ITEMS: `${BASE_API_URL}/api/SystemLookups/DiscountImportItems`,
  },
  DEPARTMENTS: {
    GET_ALL: `${BASE_API_URL}/api/Departments`,
    GET_ALL_DEPARTMENTS: `${BASE_API_URL}/api/Departments/GetAllDepartments`,
    GET_BY_ID: (id: string) => `${BASE_API_URL}/api/Departments/${id}`,
    CREATE: `${BASE_API_URL}/api/Departments`,
    UPDATE: (id: string) => `${BASE_API_URL}/api/Departments/${id}`,
    DELETE: (id: string) => `${BASE_API_URL}/api/Departments/${id}`,
    CAN_DELETE: (id: string) => `${BASE_API_URL}/api/Departments/${id}/can-delete`,
    NAME_EXISTS: `${BASE_API_URL}/api/Departments/name-exists`,
  },
  ITEM_GROUPS: {
    GET_ALL: `${BASE_API_URL}/api/ItemGroups`,
    GET_ALL_ITEM_GROUPS: `${BASE_API_URL}/api/ItemGroups/GetAllItemGroups`,
    GET_BY_ID: (id: string) => `${BASE_API_URL}/api/ItemGroups/${id}`,
    CREATE: `${BASE_API_URL}/api/ItemGroups`,
    UPDATE: (id: string) => `${BASE_API_URL}/api/ItemGroups/${id}`,
    DELETE: (id: string) => `${BASE_API_URL}/api/ItemGroups/${id}`,
    CAN_DELETE: (id: string) => `${BASE_API_URL}/api/ItemGroups/${id}/can-delete`,
    NAME_EXISTS: `${BASE_API_URL}/api/ItemGroups/name-exists`,
  },
  MANUFACTURERS: {
    GET_ALL: `${BASE_API_URL}/api/Manufacturers`,
    GET_ALL_MANUFACTURERS: `${BASE_API_URL}/api/Manufacturers/GetAllManufacturers`,
    GET_BY_ID: (id: string) => `${BASE_API_URL}/api/Manufacturers/${id}`,
    CREATE: `${BASE_API_URL}/api/Manufacturers`,
    UPDATE: (id: string) => `${BASE_API_URL}/api/Manufacturers/${id}`,
    DELETE: (id: string) => `${BASE_API_URL}/api/Manufacturers/${id}`,
    CAN_DELETE: (id: string) => `${BASE_API_URL}/api/Manufacturers/${id}/can-delete`,
    NAME_EXISTS: `${BASE_API_URL}/api/Manufacturers/name-exists`,
  },
  GRID_SETTINGS: {
    GET: (gridId: string) => `${BASE_API_URL}/api/GridSettings/${gridId}`,
    SAVE: `${BASE_API_URL}/api/GridSettings`,
    DELETE: (gridId: string) => `${BASE_API_URL}/api/GridSettings/${gridId}`,
    DELETE_ALL: `${BASE_API_URL}/api/GridSettings`,
  },
  GRID_COLUMN_ACCESS: {
    GET_MINE: (gridId: string) => `${BASE_API_URL}/api/GridColumnAccess/me/${gridId}`,
    /**
     * Returns a single timestamp (the max DateModified across any row that
     * affects the caller for this grid). Cheap; called on document visibility
     * return to detect whether the in-grid settings should be refetched.
     */
    GET_MINE_VERSION: (gridId: string) =>
      `${BASE_API_URL}/api/GridColumnAccess/me/${gridId}/version`,
    /** User saves their own column overrides for a grid. */
    SAVE_MINE: `${BASE_API_URL}/api/GridColumnAccess/me`,
    /** User resets their own column overrides for one grid. */
    RESET_MINE: (gridId: string) => `${BASE_API_URL}/api/GridColumnAccess/me/${gridId}`,
    GET_FOR_USER: (userId: string, gridId: string) =>
      `${BASE_API_URL}/api/GridColumnAccess/admin/${userId}/${gridId}`,
    SAVE: `${BASE_API_URL}/api/GridColumnAccess`,
    RESET: (userId: string, gridId: string) =>
      `${BASE_API_URL}/api/GridColumnAccess/${userId}/${gridId}`,
    /**
     * Global, cross-tenant default column config (stored in the MAIN DB, not a
     * tenant DB). Super-Admin-only. No CustomerId routing needed.
     */
    GET_DEFAULT: (gridId: string) =>
      `${BASE_API_URL}/api/GridColumnAccess/admin/default/${gridId}`,
    SAVE_DEFAULT: `${BASE_API_URL}/api/GridColumnAccess/default`,
    RESET_DEFAULT: (gridId: string) =>
      `${BASE_API_URL}/api/GridColumnAccess/admin/default/${gridId}`,
  },
  USER_PREFERENCE: {
    GET: (key: string) => `${BASE_API_URL}/api/UserPreference/${key}`,
    GET_MULTIPLE: (keys: string) => `${BASE_API_URL}/api/UserPreference?keys=${keys}`,
    SAVE: `${BASE_API_URL}/api/UserPreference`,
    DELETE: (key: string) => `${BASE_API_URL}/api/UserPreference/${key}`,
  },
  DASHBOARD: {
    KPI: `${BASE_API_URL}/api/Dashboard/kpi`,
    SALES_TREND: `${BASE_API_URL}/api/Dashboard/sales-trend`,
    REVENUE_EXPENSES: `${BASE_API_URL}/api/Dashboard/revenue-expenses`,
    TOP_SELLING_ITEMS: `${BASE_API_URL}/api/Dashboard/top-selling-items`,
    SALES_BY_DEPARTMENT: `${BASE_API_URL}/api/Dashboard/sales-by-department`,
    INVOICE_STATUS: `${BASE_API_URL}/api/Dashboard/invoice-status`,
    RECENT_INVOICES: `${BASE_API_URL}/api/Dashboard/recent-invoices`,
    PURCHASE_OVERVIEW: `${BASE_API_URL}/api/Dashboard/purchase-overview`,
    LOW_STOCK: `${BASE_API_URL}/api/Dashboard/low-stock`,
    CUSTOMER_AGING: `${BASE_API_URL}/api/Dashboard/customer-aging`,
    SUPPLIER_AGING: `${BASE_API_URL}/api/Dashboard/supplier-aging`,
    NOTIFICATIONS: `${BASE_API_URL}/api/Dashboard/notifications`,
  },
  REPORTS: {
    TAX_COLLECTED: `${BASE_API_URL}/api/Reports/TaxCollected`,
    RETURNED_ITEMS: `${BASE_API_URL}/api/Reports/ReturnedItems`,
    TAX_BY_STORE: `${BASE_API_URL}/api/Reports/TaxByStore`,
    TENDER_TOTALS: `${BASE_API_URL}/api/Reports/TenderTotals`,
    TENDER_TOTALS_BY_STATION: `${BASE_API_URL}/api/Reports/TenderTotalsByStation`,
    TENDER_TOTALS_DETAILS: `${BASE_API_URL}/api/Reports/TenderTotalsDetails`,
    REGISTER_SHIFTS: `${BASE_API_URL}/api/Reports/RegisterShifts`,
    REGSHIFT_RECONCILE_INIT: `${BASE_API_URL}/api/Reports/RegShift/ReconcileInit`,
    REGSHIFT_RECONCILE_SAVE: `${BASE_API_URL}/api/Reports/RegShift/ReconcileSave`,
    REGSHIFT_TOTAL_TENDERS:  `${BASE_API_URL}/api/Reports/RegShift/TotalTenders`,
    ON_ACCOUNT_SALES: `${BASE_API_URL}/api/Reports/OnAccountSales`,
    ON_ACCOUNT_SALES_DETAILS: `${BASE_API_URL}/api/Reports/OnAccountSalesDetails`,
    ON_ACCOUNT_PAYMENTS: `${BASE_API_URL}/api/Reports/OnAccountPayments`,
    DAILY_HOUR_SALES: `${BASE_API_URL}/api/Reports/DailyHourSales`,
    DAILY_HOUR_SALES_DETAILS: `${BASE_API_URL}/api/Reports/DailyHourSalesDetails`,
    ITEM_DAILY_SALES: `${BASE_API_URL}/api/Reports/ItemDailySales`,
    ITEM_DAILY_SALES_PIVOT: `${BASE_API_URL}/api/Reports/ItemDailySalesPivot`,
    ITEM_WEEKLY_SALES: `${BASE_API_URL}/api/Reports/ItemWeeklySales`,
    ITEM_WEEKLY_SALES_PIVOT: `${BASE_API_URL}/api/Reports/ItemWeeklySalesPivot`,
    ITEM_MONTHLY_SALES_PIVOT: `${BASE_API_URL}/api/Reports/ItemMonthlySalesPivot`,
    ITEM_SALES_TRANSACTIONS: `${BASE_API_URL}/api/Reports/ItemSalesTransactions`,
    TRANSACTION_RECEIPT: `${BASE_API_URL}/api/Reports/TransactionReceipt`,
    ITEM_MONTHLY_SALES: `${BASE_API_URL}/api/Reports/ItemMonthlySales`,
    DEPARTMENT_DAILY_SALES: `${BASE_API_URL}/api/Reports/DepartmentDailySales`,
    DEPARTMENT_DAILY_SALES_PIVOT: `${BASE_API_URL}/api/Reports/DepartmentDailySalesPivot`,
    DEPARTMENT_WEEKLY_SALES_PIVOT: `${BASE_API_URL}/api/Reports/DepartmentWeeklySalesPivot`,
    DEPARTMENT_MONTHLY_SALES_PIVOT: `${BASE_API_URL}/api/Reports/DepartmentMonthlySalesPivot`,
    DEPARTMENT_WEEKLY_SALES: `${BASE_API_URL}/api/Reports/DepartmentWeeklySales`,
    DEPARTMENT_MONTHLY_SALES: `${BASE_API_URL}/api/Reports/DepartmentMonthlySales`,
    TOTAL_DAILY_SALES: `${BASE_API_URL}/api/Reports/TotalDailySales`,
    TOTAL_WEEKLY_SALES: `${BASE_API_URL}/api/Reports/TotalWeeklySales`,
    TOTAL_MONTHLY_SALES: `${BASE_API_URL}/api/Reports/TotalMonthlySales`,
    ACTION_SUMMARY: `${BASE_API_URL}/api/Reports/ActionSummary`,
    ACTION_DETAILS: `${BASE_API_URL}/api/Reports/ActionDetails`,
    SUMMARY: `${BASE_API_URL}/api/Reports/Summary`,
    SALES_SUMMARY_BY_TRANSACTION: `${BASE_API_URL}/api/Reports/SalesSummaryByTransaction`,
    SALES_SUMMARY_BY_TRANSACTION_DETAILS: `${BASE_API_URL}/api/Reports/SalesSummaryByTransactionDetails`,
    SALES_SUMMARY_BY_ITEM: `${BASE_API_URL}/api/Reports/SalesSummaryByItem`,
    SALES_SUMMARY_BY_ITEM_DETAILS: `${BASE_API_URL}/api/Reports/SalesSummaryByItemDetails`,
    SALES_SUMMARY_BY_DEPARTMENT: `${BASE_API_URL}/api/Reports/SalesSummaryByDepartment`,
    SALES_SUMMARY_BY_DISCOUNT: `${BASE_API_URL}/api/Reports/SalesSummaryByDiscount`,
    SALES_SUMMARY_BY_DISCOUNT_DETAILS: `${BASE_API_URL}/api/Reports/SalesSummaryByDiscountDetails`,
    SALES_SUMMARY_BY_SPECIALS: `${BASE_API_URL}/api/Reports/SalesSummaryBySpecials`,
    DATE_COMPARISON: `${BASE_API_URL}/api/Reports/DateComparison`,
    ITEMS: `${BASE_API_URL}/api/Reports/Items`,
    DEPARTMENT_INVENTORY: `${BASE_API_URL}/api/Reports/DepartmentInventory`,
    ITEM_INVENTORY_SUMMARY: `${BASE_API_URL}/api/Reports/ItemInventorySummary`,
    DEPARTMENTS_VALUATION: `${BASE_API_URL}/api/Reports/DepartmentsValuation`,
    PRICE_CHANGE_HISTORY: `${BASE_API_URL}/api/Reports/PriceChangeHistory`,
    RECEIVE_INVENTORY_VALUE: `${BASE_API_URL}/api/Reports/ReceiveInventoryValue`,
    ITEMS_IN_PARTIAL_RECEIVE: `${BASE_API_URL}/api/Reports/ItemsInPartialReceive`,
    ITEMS_ON_RECEIVE_ORDER: `${BASE_API_URL}/api/Reports/ItemsOnReceiveOrder`,
    ITEM_SALES_HISTORY: `${BASE_API_URL}/api/Reports/ItemSalesHistory`,
    DATE_SCOPES: `${BASE_API_URL}/api/Reports/DateScopes`,
  },
  PHONE_ORDERS: {
    GET_ALL: `${BASE_API_URL}/api/PhoneOrder/GetAllPhoneOrders`,
    GET_BY_ID: (id: string) => `${BASE_API_URL}/api/PhoneOrder/${id}`,
    CREATE: `${BASE_API_URL}/api/PhoneOrder`,
    UPDATE: (id: string) => `${BASE_API_URL}/api/PhoneOrder/${id}`,
    DELETE: (id: string) => `${BASE_API_URL}/api/PhoneOrder/${id}`,
    VOID: (id: string) => `${BASE_API_URL}/api/PhoneOrder/${id}/void`,
    CHANGE_STATUS: (id: string) => `${BASE_API_URL}/api/PhoneOrder/${id}/status`,
    GET_ENTRIES: (id: string) => `${BASE_API_URL}/api/PhoneOrder/${id}/entries`,
    ADD_ENTRY: (id: string) => `${BASE_API_URL}/api/PhoneOrder/${id}/entries`,
    UPDATE_ENTRY: (id: string, entryId: string) => `${BASE_API_URL}/api/PhoneOrder/${id}/entries/${entryId}`,
    DELETE_ENTRY: (id: string, entryId: string) => `${BASE_API_URL}/api/PhoneOrder/${id}/entries/${entryId}`,
    GET_PREVIOUS_ORDERS: (customerId: string) => `${BASE_API_URL}/api/PhoneOrder/customer/${customerId}/previous`,
    SEARCH_ITEMS: `${BASE_API_URL}/api/PhoneOrder/items/search`,
  },
  LABEL_TEMPLATES: {
    GET_ALL: `${BASE_API_URL}/api/LabelTemplates`,
    GET_BY_ID: (id: number) => `${BASE_API_URL}/api/LabelTemplates/${id}`,
    CREATE: `${BASE_API_URL}/api/LabelTemplates`,
    UPDATE: (id: number) => `${BASE_API_URL}/api/LabelTemplates/${id}`,
    DELETE: (id: number) => `${BASE_API_URL}/api/LabelTemplates/${id}`,
    SET_DEFAULT: (id: number) => `${BASE_API_URL}/api/LabelTemplates/${id}/set-default`,
    DUPLICATE: (id: number) => `${BASE_API_URL}/api/LabelTemplates/${id}/duplicate`,
    GET_ITEMS: `${BASE_API_URL}/api/LabelTemplates/items`,
    PREVIEW: `${BASE_API_URL}/api/LabelTemplates/preview`,
  },
  REQUEST_RESPONSE_LOGS: {
    GET_REQUESTS: `${BASE_API_URL}/api/RequestResponseLogs/requests`,
    GET_RESPONSES: `${BASE_API_URL}/api/RequestResponseLogs/responses`,
    GET_COMBINED: `${BASE_API_URL}/api/RequestResponseLogs/combined`,
    GET_REQUEST_BY_ID: (id: number) => `${BASE_API_URL}/api/RequestResponseLogs/requests/${id}`,
    GET_RESPONSE_BY_REQUEST_ID: (requestId: number) => `${BASE_API_URL}/api/RequestResponseLogs/responses/by-request/${requestId}`,
    GET_CONTROLLERS: `${BASE_API_URL}/api/RequestResponseLogs/controllers`,
    GET_METHODS: `${BASE_API_URL}/api/RequestResponseLogs/methods`,
  },
  SUPPLIERS: {
    GET_ALL: `${BASE_API_URL}/api/Supplier/GetAllSuppliers`,
    GET_BY_ID: (id: string) => `${BASE_API_URL}/api/Supplier/${id}`,
    CREATE: `${BASE_API_URL}/api/Supplier`,
    UPDATE: (id: string) => `${BASE_API_URL}/api/Supplier/${id}`,
    DELETE: (id: string) => `${BASE_API_URL}/api/Supplier/${id}`,
    GET_ITEMS: (id: string) => `${BASE_API_URL}/api/Supplier/${id}/items`,
    GET_NOTES: (id: string) => `${BASE_API_URL}/api/Supplier/${id}/notes`,
    ADD_NOTE: (id: string) => `${BASE_API_URL}/api/Supplier/${id}/notes`,
    DELETE_NOTE: (id: string, noteId: string) => `${BASE_API_URL}/api/Supplier/${id}/notes/${noteId}`,
    GET_TRANSACTIONS: (id: string) => `${BASE_API_URL}/api/Supplier/${id}/transactions`,
    GET_HISTORY: (id: string) => `${BASE_API_URL}/api/Supplier/${id}/history`,
    GET_SALES_REPORT: (id: string) => `${BASE_API_URL}/api/Supplier/${id}/sales-report`,
    MERGE: `${BASE_API_URL}/api/Supplier/merge`,
    TOGGLE_STATUS: (id: string) => `${BASE_API_URL}/api/Supplier/${id}/toggle-status`,
  },
  PURCHASE_ORDERS: {
    GET_ALL: `${BASE_API_URL}/api/PurchaseOrder/GetAllPurchaseOrders`,
    GET_BY_ID: (id: string) => `${BASE_API_URL}/api/PurchaseOrder/${id}`,
    CREATE: `${BASE_API_URL}/api/PurchaseOrder`,
    UPDATE: (id: string) => `${BASE_API_URL}/api/PurchaseOrder/${id}`,
    DELETE: (id: string) => `${BASE_API_URL}/api/PurchaseOrder/${id}`,
    APPROVE: (id: string) => `${BASE_API_URL}/api/PurchaseOrder/${id}/approve`,
    SEND: (id: string) => `${BASE_API_URL}/api/PurchaseOrder/${id}/send`,
  },
  RECEIVE_ORDERS: {
    GET_ALL: `${BASE_API_URL}/api/ReceiveOrder/GetAllReceiveOrders`,
    GET_BY_ID: (id: string) => `${BASE_API_URL}/api/ReceiveOrder/${id}`,
    CREATE: `${BASE_API_URL}/api/ReceiveOrder`,
    UPDATE: (id: string) => `${BASE_API_URL}/api/ReceiveOrder/${id}`,
    DELETE: (id: string) => `${BASE_API_URL}/api/ReceiveOrder/${id}`,
  },
  PAYMENTS: {
    GET_ALL: `${BASE_API_URL}/api/Payment/GetAllPayments`,
    GET_BY_ID: (id: string) => `${BASE_API_URL}/api/Payment/${id}`,
    CREATE: `${BASE_API_URL}/api/Payment`,
    UPDATE: (id: string) => `${BASE_API_URL}/api/Payment/${id}`,
    DELETE: (id: string) => `${BASE_API_URL}/api/Payment/${id}`,
  },
  RETURN_TO_VENDOR: {
    GET_ALL: `${BASE_API_URL}/api/ReturnToVendor/GetAllReturnToVendors`,
    GET_BY_ID: (id: string) => `${BASE_API_URL}/api/ReturnToVendor/${id}`,
    CREATE: `${BASE_API_URL}/api/ReturnToVendor`,
    UPDATE: (id: string) => `${BASE_API_URL}/api/ReturnToVendor/${id}`,
    DELETE: (id: string) => `${BASE_API_URL}/api/ReturnToVendor/${id}`,
  },
  GEN_ORDER: {
    GET_ALL: `${BASE_API_URL}/api/GenOrder/GetAllGenOrders`,
  },
  ITEMS_ON_PHONE_ORDER: {
    GET_ALL: `${BASE_API_URL}/api/ItemOnPhoneOrder/GetItemsOnPhoneOrder`,
  },
  ITEM_DETAILS_ON_PHONE_ORDER: {
    GET_ALL: `${BASE_API_URL}/api/ItemDetailsOnPhoneOrder/GetItemDetailsOnPhoneOrder`,
  },
  REPLACED_ITEMS: {
    GET_ALL: `${BASE_API_URL}/api/ReplacedItem/GetReplacedItems`,
  },
  RECEIVE_PAYMENTS: {
    GET_ALL: `${BASE_API_URL}/api/ReceivePayment/GetAllReceivePayments`,
  },
  TRANSACTIONS: {
    GET_ALL: `${BASE_API_URL}/api/TransactionList/GetAllTransactions`,
  },
  REGISTERS: {
    GET_ALL: `${BASE_API_URL}/api/RegisterList/GetAllRegisters`,
  },
  DISCOUNTS: {
    GET_ALL: `${BASE_API_URL}/api/DiscountList/GetAllDiscounts`,
    GET_BY_ID: (id: string) => `${BASE_API_URL}/api/DiscountList/${id}`,
    CREATE: `${BASE_API_URL}/api/DiscountList`,
    UPDATE: (id: string) => `${BASE_API_URL}/api/DiscountList/${id}`,
    DELETE: (id: string) => `${BASE_API_URL}/api/DiscountList/${id}`,
    CAN_DELETE: (id: string) => `${BASE_API_URL}/api/DiscountList/${id}/can-delete`,
  },
  REQUEST_TRANSFERS: {
    GET_ALL: `${BASE_API_URL}/api/RequestTransferList/GetAllRequestTransfers`,
  },
  TRANSFERS: {
    GET_ALL: `${BASE_API_URL}/api/TransferItemsList/GetAllTransfers`,
  },
  RECEIVE_TRANSFERS: {
    GET_ALL: `${BASE_API_URL}/api/ReceiveTransferList/GetAllReceiveTransfers`,
  },
  STORES: {
    GET_ALL: `${BASE_API_URL}/api/StoreList/GetAllStores`,
  },
  COMPUTERS: {
    GET_ALL: `${BASE_API_URL}/api/ComputerList/GetAllComputers`,
  },
  TENANT_RBAC: {
    GET_ROLES: `${BASE_API_URL}/api/TenantRbac/Roles`,
    // GET (list role assignments) + PUT (save) for a user. Used with an explicit
    // CustomerId header so a Super Admin can target a specific tenant's roles.
    USER_ROLES: (userId: number) => `${BASE_API_URL}/api/TenantRbac/Users/${userId}/Roles`,
  },
  ADJUST_INVENTORY: {
    GET_ITEMS_FOR_ADJUST: `${BASE_API_URL}/api/AdjustInventory/GetItemsForAdjust`,
    GET_ITEMS_FOR_ADJUST_REVERSED: `${BASE_API_URL}/api/AdjustInventory/GetItemsForAdjustReversed`,
    SAVE_ADJUSTMENTS: `${BASE_API_URL}/api/AdjustInventory/SaveAdjustments`,
    RESET_PHYSICAL_COUNT: `${BASE_API_URL}/api/AdjustInventory/ResetPhysicalCount`,
    QUICK_REPORT: `${BASE_API_URL}/api/AdjustInventory/QuickReport`,
    INVENTORY_BY_STORE: `${BASE_API_URL}/api/AdjustInventory/InventoryByStore`,
  },
  PERMISSIONS: {
    GET_ALL: `${BASE_API_URL}/api/permissions`,
    GET_BY_ID: (id: number) => `${BASE_API_URL}/api/permissions/${id}`,
    CREATE: `${BASE_API_URL}/api/permissions`,
    UPDATE: (id: number) => `${BASE_API_URL}/api/permissions/${id}`,
    DELETE: (id: number) => `${BASE_API_URL}/api/permissions/${id}`,
    KEY_EXISTS: `${BASE_API_URL}/api/permissions/key-exists`,
  },
  TOKENS: {
    GET_ALL: `${BASE_API_URL}/api/tokens`,
    DROPDOWN: `${BASE_API_URL}/api/tokens/dropdown`,
    GET_BY_ID: (id: number) => `${BASE_API_URL}/api/tokens/${id}`,
    CREATE: `${BASE_API_URL}/api/tokens`,
    UPDATE: (id: number) => `${BASE_API_URL}/api/tokens/${id}`,
    DELETE: (id: number) => `${BASE_API_URL}/api/tokens/${id}`,
    GET_PERMISSIONS: (tokenId: number) => `${BASE_API_URL}/api/tokens/${tokenId}/permissions`,
    BULK_UPDATE_PERMISSIONS: (tokenId: number) => `${BASE_API_URL}/api/tokens/${tokenId}/permissions/bulk`,
    STORES_DROPDOWN: `${BASE_API_URL}/api/tokens/stores-dropdown`,
    TENANT_STORES: (tokenId: number) => `${BASE_API_URL}/api/tokens/${tokenId}/tenant-stores`,
    GET_STORE_ACCESS: (tokenId: number) => `${BASE_API_URL}/api/tokens/${tokenId}/store-access`,
    BULK_UPDATE_STORE_ACCESS: (tokenId: number) => `${BASE_API_URL}/api/tokens/${tokenId}/store-access/bulk`,
    REMOVE_STORE_ACCESS: (id: number) => `${BASE_API_URL}/api/tokens/store-access/${id}`,
  },
  TOKEN_PERMISSIONS: {
    GET_ALL: `${BASE_API_URL}/api/token-permissions`,
    GET_BY_ID: (id: number) => `${BASE_API_URL}/api/token-permissions/${id}`,
    CREATE: `${BASE_API_URL}/api/token-permissions`,
    UPDATE: (id: number) => `${BASE_API_URL}/api/token-permissions/${id}`,
    DELETE: (id: number) => `${BASE_API_URL}/api/token-permissions/${id}`,
  },
  REGISTRATIONS: {
    GET_ALL: `${BASE_API_URL}/api/registrations`,
    GET_BY_ID: (id: string) => `${BASE_API_URL}/api/registrations/${id}`,
    CREATE: `${BASE_API_URL}/api/registrations`,
    UPDATE: (id: string) => `${BASE_API_URL}/api/registrations/${id}`,
    DELETE: (id: string) => `${BASE_API_URL}/api/registrations/${id}`,
  },
  APPLICATIONS: {
    GET_ALL: `${BASE_API_URL}/api/applications`,
    DROPDOWN: `${BASE_API_URL}/api/applications/dropdown`,
    GET_BY_ID: (id: string) => `${BASE_API_URL}/api/applications/${id}`,
    CREATE: `${BASE_API_URL}/api/applications`,
    UPDATE: (id: string) => `${BASE_API_URL}/api/applications/${id}`,
    DELETE: (id: string) => `${BASE_API_URL}/api/applications/${id}`,
  },
  APP_REGISTRATIONS: {
    GET_ALL: `${BASE_API_URL}/api/appregistrations`,
    GET_BY_ID: (id: string) => `${BASE_API_URL}/api/appregistrations/${id}`,
    CREATE: `${BASE_API_URL}/api/appregistrations`,
    UPDATE: (id: string) => `${BASE_API_URL}/api/appregistrations/${id}`,
    DELETE: (id: string) => `${BASE_API_URL}/api/appregistrations/${id}`,
  },
  GLOBAL_ROLES: {
    SCREEN_ACTIONS_GRID: `${BASE_API_URL}/api/GlobalRole/ScreenActions`,
    SCREEN_ACTIONS_GROUPED: `${BASE_API_URL}/api/GlobalRole/ScreenActions/Grouped`,
    SCREEN_ACTIONS_BY_MODULE: (moduleId: number) => `${BASE_API_URL}/api/GlobalRole/ScreenActions/Module/${moduleId}`,
    CREATE_SCREEN_ACTION: `${BASE_API_URL}/api/GlobalRole/ScreenActions`,
    UPDATE_SCREEN_ACTION: (id: number) => `${BASE_API_URL}/api/GlobalRole/ScreenActions/${id}`,
    DELETE_SCREEN_ACTION: (id: number) => `${BASE_API_URL}/api/GlobalRole/ScreenActions/${id}`,
    GET_ALL_ROLES: `${BASE_API_URL}/api/GlobalRole/Roles`,
    GET_ROLE: (id: number) => `${BASE_API_URL}/api/GlobalRole/Roles/${id}`,
    CREATE_ROLE: `${BASE_API_URL}/api/GlobalRole/Roles`,
    UPDATE_ROLE: (id: number) => `${BASE_API_URL}/api/GlobalRole/Roles/${id}`,
    DELETE_ROLE: (id: number) => `${BASE_API_URL}/api/GlobalRole/Roles/${id}`,
    GET_ROLE_PERMISSIONS: (id: number) => `${BASE_API_URL}/api/GlobalRole/Roles/${id}/Permissions`,
    UPDATE_ROLE_PERMISSIONS: (id: number) => `${BASE_API_URL}/api/GlobalRole/Roles/${id}/Permissions`,
    GET_CUSTOMER_ROLES: (customerId: number) => `${BASE_API_URL}/api/GlobalRole/CustomerRoles/${customerId}`,
    ASSIGN_CUSTOMER_ROLES: `${BASE_API_URL}/api/GlobalRole/CustomerRoles`,
    GET_USER_ROLES: (userId: number) => `${BASE_API_URL}/api/GlobalRole/UserRoles/${userId}`,
    ASSIGN_USER_ROLES: `${BASE_API_URL}/api/GlobalRole/UserRoles`,
  },
  AUDIT_LOG: {
    GET_ALL: `${BASE_API_URL}/api/AuditLog/GetAll`,
    GET_BY_ID: (id: number) => `${BASE_API_URL}/api/AuditLog/${id}`,
    ENTITY_HISTORY: `${BASE_API_URL}/api/AuditLog/EntityHistory`,
  },
  PRINT_AGENT: {
    STATUS: `${BASE_API_URL}/api/PrintAgent/status`,
    PAIR: `${BASE_API_URL}/api/PrintAgent/pair`,
    UNPAIR: `${BASE_API_URL}/api/PrintAgent/unpair`,
    SIGN_JOB: `${BASE_API_URL}/api/PrintAgent/sign-job`,
    INSTALLER_INFO: `${BASE_API_URL}/api/PrintAgent/installer-info`,
    INSTALLER: `${BASE_API_URL}/api/PrintAgent/installer`,
  },
  ENVIRONMENTS: {
    GET_ALL: `${BASE_API_URL}/api/Environment`,
    GET_BY_ID: (id: string) => `${BASE_API_URL}/api/Environment/${id}`,
    CREATE: `${BASE_API_URL}/api/Environment`,
    UPDATE: `${BASE_API_URL}/api/Environment`,
    DELETE: (id: string) => `${BASE_API_URL}/api/Environment/${id}`,
    GET_USER_ACCESS: (userId: number, customerId: number) =>
      `${BASE_API_URL}/api/Environment/user/${userId}/customer/${customerId}`,
    SET_USER_ENVIRONMENTS: `${BASE_API_URL}/api/Environment/user-environments`,
  },
}
