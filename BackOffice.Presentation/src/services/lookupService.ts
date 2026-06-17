import { API_ENDPOINTS } from '../constants/api';

// Interface for lookup DTOs
export interface LookupDto {
  value: number;
  label: string;
  sortOrder?: number;
}

// Interface for Department lookup (hierarchical tree structure)
export interface DepartmentLookupDto {
  departmentStoreID: string;
  name: string;
  parentDepartmentID: string | null;
}

// Interface for Items Lookup Values (Manufacturer, Pattern, Custom Fields)
// ValueType: 0=Pattern, 1-10=CustomField1-10, 11=Manufacturer
export interface ItemsLookupValueDto {
  valueID: string;
  valueName: string;
  valueType: number;
}

// Interface for Item Group lookup (hierarchical tree structure like departments)
export interface ItemGroupLookupDto {
  itemGroupID: string;
  name: string;
  parentID: string | null;
}

// Interface for Manufacturer lookup (from ManufacturersController GetAllManufacturers)
export interface ManufacturerLookupDto {
  manufacturerID: string;
  manufacturerName: string;
}

// Interface for Tax lookup (Tax dropdown next to Taxable checkbox)
export interface TaxLookupDto {
  taxID: string;
  taxName: string;
}

// Interface for Extra Charge Item lookup (from SP_GetExtraChargeItems)
export interface ExtraChargeItemLookupDto {
  itemStoreID: string;
  name: string;
  barcodeNumber: string;
  price: number;
}

// Interface for App Item lookup (from SP_GetAppItems)
export interface AppItemLookupDto {
  id: number;
  appName: string;
}

// Interface for Supplier lookup (from GetSuppliersLookup – SupplierID, Name, SupplierNo)
export interface SupplierLookupDto {
  supplierID: string;
  supplierNo: string;
  name: string;
}

// Interface for Store lookup (from SP_GetStoresByUser)
export interface StoreLookupDto {
  storeID: string;
  storeName: string;
}

// Interface for Mix & Match lookup (from SP_MixAndMatch)
export interface MixAndMatchLookupDto {
  mixAndMatchID: string;
  name: string;
  qty: number | null;
  amount: number | null;
  assignDate: boolean | null;
  startDate: string | null;
  endDate: string | null;
  minTotalSale: number | null;
}

// Value type constants for ItemsLookupValues
export const LOOKUP_VALUE_TYPES = {
  PATTERN: 0,
  CUSTOM_FIELD_1: 1,
  CUSTOM_FIELD_2: 2,
  CUSTOM_FIELD_3: 3,
  CUSTOM_FIELD_4: 4,
  CUSTOM_FIELD_5: 5,
  CUSTOM_FIELD_6: 6,
  CUSTOM_FIELD_7: 7,
  CUSTOM_FIELD_8: 8,
  CUSTOM_FIELD_9: 9,
  CUSTOM_FIELD_10: 10,
  MANUFACTURER: 11,
} as const;

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  errors: string[] | null;
}

class LookupService {
  private getAuthHeaders(): { [key: string]: string } {
    const token = localStorage.getItem('accessToken');
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };

    // Add CustomerId header from localStorage
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const parsedUserData = JSON.parse(userData);
        if (parsedUserData.customerId) {
          headers['CustomerId'] = parsedUserData.customerId.toString();
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }

    return headers;
  }

  async getItemTypes(): Promise<ApiResponse<LookupDto[]>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_ITEM_TYPES}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch item types',
          errors: data.errors || null,
        };
      }

      // Map API response structure (isSuccess, response) to frontend structure (success, data)
      return {
        success: data.isSuccess,
        data: data.response,
        message: data.message,
        errors: data.errors,
      };
    } catch (error) {
      console.error('Error fetching item types:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getBarcodeTypes(): Promise<ApiResponse<LookupDto[]>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_BARCODE_TYPES}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch barcode types',
          errors: data.errors || null,
        };
      }

      return {
        success: data.isSuccess,
        data: data.response,
        message: data.message,
        errors: data.errors,
      };
    } catch (error) {
      console.error('Error fetching barcode types:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getUOMTypes(): Promise<ApiResponse<LookupDto[]>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_UOM_TYPES}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch UOM types',
          errors: data.errors || null,
        };
      }

      return {
        success: data.isSuccess,
        data: data.response,
        message: data.message,
        errors: data.errors,
      };
    } catch (error) {
      console.error('Error fetching UOM types:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getMeasureTypes(): Promise<ApiResponse<LookupDto[]>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_MEASURE_TYPES}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch measure types',
          errors: data.errors || null,
        };
      }

      return {
        success: data.isSuccess,
        data: data.response,
        message: data.message,
        errors: data.errors,
      };
    } catch (error) {
      console.error('Error fetching measure types:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getDepartments(): Promise<ApiResponse<DepartmentLookupDto[]>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_DEPARTMENTS}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch departments',
          errors: data.errors || null,
        };
      }

      return {
        success: data.isSuccess,
        data: data.response,
        message: data.message,
        errors: data.errors,
      };
    } catch (error) {
      console.error('Error fetching departments:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getItemsLookupValues(valueType?: number): Promise<ApiResponse<ItemsLookupValueDto[]>> {
    try {
      let url = `${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_ITEMS_LOOKUP_VALUES}`;
      if (valueType !== undefined) {
        url += `?valueType=${valueType}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch items lookup values',
          errors: data.errors || null,
        };
      }

      return {
        success: data.isSuccess,
        data: data.response,
        message: data.message,
        errors: data.errors,
      };
    } catch (error) {
      console.error('Error fetching items lookup values:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getItemGroups(): Promise<ApiResponse<ItemGroupLookupDto[]>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.ITEM_GROUPS.GET_ALL}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch item groups',
          errors: data.errors || null,
        };
      }

      return {
        success: data.isSuccess,
        data: data.response,
        message: data.message,
        errors: data.errors,
      };
    } catch (error) {
      console.error('Error fetching item groups:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getManufacturers(): Promise<ApiResponse<ManufacturerLookupDto[]>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.MANUFACTURERS.GET_ALL}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch manufacturers',
          errors: data.errors || null,
        };
      }

      return {
        success: data.isSuccess,
        data: data.response,
        message: data.message,
        errors: data.errors,
      };
    } catch (error) {
      console.error('Error fetching manufacturers:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getAppItems(): Promise<ApiResponse<AppItemLookupDto[]>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_APP_ITEMS}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch app items',
          errors: data.errors || null,
        };
      }

      return {
        success: data.isSuccess,
        data: data.response,
        message: data.message,
        errors: data.errors,
      };
    } catch (error) {
      console.error('Error fetching app items:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getTaxes(): Promise<ApiResponse<TaxLookupDto[]>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_TAXES}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch taxes',
          errors: data.errors || null,
        };
      }

      return {
        success: data.isSuccess,
        data: data.response,
        message: data.message,
        errors: data.errors,
      };
    } catch (error) {
      console.error('Error fetching taxes:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getExtraChargeItems(storeId: string): Promise<ApiResponse<ExtraChargeItemLookupDto[]>> {
    try {
      const url = `${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_EXTRA_CHARGE_ITEMS}?storeId=${storeId}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch extra charge items',
          errors: data.errors || null,
        };
      }

      return {
        success: data.isSuccess,
        data: data.response,
        message: data.message,
        errors: data.errors,
      };
    } catch (error) {
      console.error('Error fetching extra charge items:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getStoresByUser(userId: string, storeId?: string): Promise<ApiResponse<StoreLookupDto[]>> {
    try {
      let url = `${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${userId}`;
      if (storeId) {
        url += `&storeId=${storeId}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch stores',
          errors: data.errors || null,
        };
      }

      return {
        success: data.isSuccess,
        data: data.response,
        message: data.message,
        errors: data.errors,
      };
    } catch (error) {
      console.error('Error fetching stores:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getSuppliers(): Promise<ApiResponse<SupplierLookupDto[]>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_SUPPLIERS_LOOKUP}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, data: null, message: data.message || 'Failed to fetch suppliers', errors: data.errors || null };
      }

      return { success: data.isSuccess, data: data.response, message: data.message, errors: data.errors };
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      return { success: false, data: null, message: 'Network error. Please try again.', errors: null };
    }
  }

  async getMixAndMatches(): Promise<ApiResponse<MixAndMatchLookupDto[]>> {
    try {
      const response = await fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_MIX_AND_MATCHES, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, data: null, message: data.message || 'Failed to fetch mix & match', errors: data.errors || null };
      }

      return { success: data.isSuccess, data: data.response, message: data.message, errors: data.errors };
    } catch (error) {
      console.error('Error fetching mix & match:', error);
      return { success: false, data: null, message: 'Network error. Please try again.', errors: null };
    }
  }

  async createItemsLookupValue(dto: { valueName: string; valueType: number }): Promise<ApiResponse<ItemsLookupValueDto>> {
    try {
      const response = await fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.CREATE_ITEMS_LOOKUP_VALUE, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(dto),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, data: null, message: data.message || 'Failed to create lookup value', errors: data.errors || null };
      }

      return { success: data.isSuccess, data: data.response, message: data.message, errors: data.errors };
    } catch (error) {
      console.error('Error creating lookup value:', error);
      return { success: false, data: null, message: 'Network error. Please try again.', errors: null };
    }
  }

  async createMixAndMatch(dto: { name: string; qty?: number; amount?: number; assignDate?: boolean; startDate?: string; endDate?: string; minTotalSale?: number }): Promise<ApiResponse<MixAndMatchLookupDto>> {
    try {
      const response = await fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.CREATE_MIX_AND_MATCH, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(dto),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, data: null, message: data.message || 'Failed to create mix & match', errors: data.errors || null };
      }

      return { success: data.isSuccess, data: data.response, message: data.message, errors: data.errors };
    } catch (error) {
      console.error('Error creating mix & match:', error);
      return { success: false, data: null, message: 'Network error. Please try again.', errors: null };
    }
  }

  // ─── Advanced Filters modal lookups ──────────────────────────────────
  // Power the multi-tab Filters dialog (AdvancedFiltersModal) on report
  // pages. Each method returns a small list shape suitable for
  // SearchableSelect dropdowns.

  async getCustomerTypes(): Promise<ApiResponse<CustomerTypeLookupDto[]>> {
    return this.simpleGet<CustomerTypeLookupDto[]>(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_CUSTOMER_TYPES, 'customer types');
  }

  async getPriceLevels(): Promise<ApiResponse<PriceLevelLookupDto[]>> {
    return this.simpleGet<PriceLevelLookupDto[]>(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_PRICE_LEVELS, 'price levels');
  }

  async getCustomerZips(): Promise<ApiResponse<ZipLookupDto[]>> {
    return this.simpleGet<ZipLookupDto[]>(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_CUSTOMER_ZIPS, 'customer zips');
  }

  async getDiscountsLookup(): Promise<ApiResponse<DiscountLookupDto[]>> {
    return this.simpleGet<DiscountLookupDto[]>(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_DISCOUNTS_LOOKUP, 'discounts');
  }

  async getBrands(): Promise<ApiResponse<BrandLookupDto[]>> {
    return this.simpleGet<BrandLookupDto[]>(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_BRANDS, 'brands');
  }

  async searchItemsForFilter(search?: string, take = 50): Promise<ApiResponse<ItemFilterLookupDto[]>> {
    return this.simpleGet<ItemFilterLookupDto[]>(
      API_ENDPOINTS.SYSTEM_LOOKUPS.SEARCH_ITEMS_FILTER(search, take),
      'items',
    );
  }

  async getCustomers(): Promise<ApiResponse<CustomerLookupDto[]>> {
    return this.simpleGet<CustomerLookupDto[]>(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_CUSTOMERS_LOOKUP, 'customers');
  }

  async getGroups(): Promise<ApiResponse<GroupLookupDto[]>> {
    return this.simpleGet<GroupLookupDto[]>(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_GROUPS, 'groups');
  }

  /** Customer-tab "Group" filter — customer groups (CustomerGroup table),
   *  distinct from getGroups() which returns security/permission groups. */
  async getCustomerGroups(): Promise<ApiResponse<GroupLookupDto[]>> {
    return this.simpleGet<GroupLookupDto[]>(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_CUSTOMER_GROUPS, 'customer groups');
  }

  async getAllStores(): Promise<ApiResponse<StoreLookupDto[]>> {
    return this.simpleGet<StoreLookupDto[]>(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_ALL_STORES, 'stores');
  }

  /**
   * Generic GET-and-unwrap helper used by the new advanced-filters lookups.
   * Existing methods on this class predate this helper and use the inline
   * try/catch/fetch pattern — we keep it consistent for new additions but
   * don't refactor the legacy ones here.
   */
  private async simpleGet<T>(url: string, label: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(url, { method: 'GET', headers: this.getAuthHeaders() });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, data: null, message: data.message || `Failed to fetch ${label}`, errors: data.errors || null };
      }
      return { success: data.isSuccess, data: data.response, message: data.message, errors: data.errors };
    } catch (error) {
      console.error(`Error fetching ${label}:`, error);
      return { success: false, data: null, message: 'Network error. Please try again.', errors: null };
    }
  }
}

// ─── Advanced Filters lookup DTOs ───────────────────────────────────────

export interface CustomerTypeLookupDto {
  value: number;
  label: string;
}

export interface PriceLevelLookupDto {
  value: number;
  label: string;
}

export interface ZipLookupDto {
  zip: string;
}

export interface DiscountLookupDto {
  discountID: string;
  name: string;
}

export interface BrandLookupDto {
  brand: string;
}

export interface ItemFilterLookupDto {
  itemID: string;
  name: string;
  barcode?: string | null;
  department?: string | null;
}

/** Customer lookup row returned by GET /api/SystemLookups/Customers. */
export interface CustomerLookupDto {
  customerID: string;
  /** Some payload variants use "displayName"; consumers should fall back. */
  name?: string;
  displayName?: string;
}

/** Group lookup row returned by GET /api/SystemLookups/Groups. */
export interface GroupLookupDto {
  groupID: string;
  groupName: string;
}

export const lookupService = new LookupService();
