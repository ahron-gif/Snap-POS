import { API_ENDPOINTS } from '../constants/api';

// Interfaces matching the API DTOs
export interface CreateItemSupplyDto {
  supplierNo: string;
  totalCost?: number;
  grossCost?: number;
  minimumQty?: number;
  qtyPerCase?: number;
  isOrderedOnlyInCase?: boolean;
  averageDeliveryDelay?: number;
  itemCode?: string;
  isMainSupplier: boolean;
  sortOrder?: number;
  caseQty?: number;
  salePrice?: number;
  assignDate?: boolean;
  fromDate?: string;
  toDate?: string;
  onSpecialReq?: boolean;
  minQty?: number;
  maxQty?: number;
  uOMType?: number;
  colorName?: string;
}

export interface CreateItemToGroupDto {
  itemGroupID: string;
}

export interface CreateItemAliasDto {
  barcodeNumber: string;
}

export interface DepartmentDefaultsDto {
  departmentStoreID: string;
  name: string;
  defaultMarkup: number | null;
  roundUp: number;
  roundValue: number | null;
  defaultTaxNo: string | null;
  isDefaultTaxInclude: boolean | null;
  isDefaultFoodStampable: boolean | null;
  isDefaultDiscountable: boolean | null;
  defaultCogsAccount: number | null;
  defaultIncomeAccount: number | null;
}

export interface CreateItemDto {
  // Optional: If provided, this is an update operation
  itemId?: string;

  // ItemMain properties
  name: string;
  barcodeNumber: string;
  modalNumber?: string;
  description?: string;
  caseBarcodeNumber?: string;
  caseCode?: string; // Short case code (maps to ItemMain.CaseBarCode)
  caseQty?: number;
  cs_Cost?: number; // Case cost
  caseDescription?: string;
  barcodeType?: number;
  itemType?: number;
  isTemplate?: boolean;
  isSerial?: boolean;
  manufacturerID?: string | null;
  manufacturerPartNo?: string;
  priceByCase?: boolean;
  costByCase?: boolean;
  size?: string;
  units?: number;
  measure?: number;
  extraInfo?: string | null;
  extraInfo2?: string | null;
  customerCode?: string;
  noScanMsg?: string;
  styleNo?: string;
  customInteger1?: number;
  seasonID?: string | null;
  matrix1?: string;
  matrix2?: string;
  matrix3?: string;
  matrix4?: string;
  matrix5?: string;
  matrix6?: string;
  parentID?: string | null;
  linkNo?: string | null;
  pkgCode?: string;
  addToApp?: number;
  pattern?: string | null;

  // Custom Field properties (Guid references to lookup values)
  customField1?: string | null;
  customField2?: string | null;
  customField3?: string | null;
  customField4?: string | null;
  customField5?: string | null;
  customField6?: string | null;
  customField7?: string | null;
  customField8?: string | null;
  customField9?: string | null;
  customField10?: string | null;

  // ItemStore properties
  storeNo: string;
  departmentID?: string | null;
  isDiscount?: boolean;
  isTaxable?: boolean;
  taxID?: string | null;
  isFoodStampable?: boolean;
  isWIC?: boolean;
  cost?: number;
  listPrice?: number;
  price?: number;
  priceA?: number;
  priceB?: number;
  priceC?: number;
  priceD?: number;
  extraCharge1?: string | null;
  extraCharge2?: string | null;
  extraCharge3?: string | null;
  cogsAccount?: number;
  incomeAccount?: number;
  profitCalculation?: number;
  commissionQty?: number;
  commissionType?: number;
  prefSaleBy?: number;
  prefOrderBy?: number;
  onHand?: number;
  onOrder?: number;
  onTransferOrder?: number;
  reorderPoint?: number;
  restockLevel?: number;
  binLocation?: string;
  daysForReturn?: number;
  markup?: number;
  margin?: number;

  // Future pricing (maps to ItemStore.NewPrice / ItemStore.NewPriceDate)
  newPrice?: number;
  newPriceDate?: string;

  // Sale properties
  saleType?: number;
  salePrice?: number;
  saleStartDate?: string;
  saleEndDate?: string;
  saleMin?: number;
  saleMax?: number;
  minForSale?: number;
  specialBuy?: number;
  specialPrice?: number;
  specialBuyFromDate?: string;
  specialBuyToDate?: string;
  mixAndMatchID?: string | null;
  assignDate?: boolean;
  casePrice?: number;
  caseSpecial?: number;
  pkgPrice?: number;
  pkgQty?: number;
  isCaseDiscount?: boolean;
  isPkgDiscount?: boolean;
  tare?: number;
  sellOnWeb?: boolean;
  webCasePrice?: number;
  webPrice?: number;

  // Related data
  itemSupplies?: CreateItemSupplyDto[];
  itemToGroups?: CreateItemToGroupDto[];
  itemAliases?: CreateItemAliasDto[];
}

export interface CreateItemResponseDto {
  itemId?: string;
  itemID?: string;  // API may return PascalCase
  itemStoreId?: string;
  itemStoreID?: string;  // API may return PascalCase
  name: string;
  barcodeNumber: string;
  message?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  errors: string[] | null;
}

class ItemService {
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

  async addItem(createItemDto: CreateItemDto): Promise<ApiResponse<CreateItemResponseDto>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.ITEMS.ADD_ITEM}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(createItemDto),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to add item',
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
      console.error('Error adding item:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async updateItem(updateItemDto: CreateItemDto): Promise<ApiResponse<CreateItemResponseDto>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.ITEMS.UPDATE_ITEM}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updateItemDto),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to update item',
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
      console.error('Error updating item:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getItem(itemStoreId: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.ITEMS.GET_ITEM(itemStoreId)}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to get item',
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
      console.error('Error getting item:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async barcodeExists(barcodeNumber: string, excludeItemId?: string): Promise<ApiResponse<boolean>> {
    try {
      let url = `${API_ENDPOINTS.ITEMS.BARCODE_EXISTS}?barcodeNumber=${encodeURIComponent(barcodeNumber)}`;
      if (excludeItemId) {
        url += `&excludeItemId=${excludeItemId}`;
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
          message: data.message || 'Failed to check barcode',
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
      console.error('Error checking barcode:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  /**
   * Checks if a model number (alternate code) already exists
   */
  async modelNumberExists(modalNumber: string, excludeItemId?: string): Promise<ApiResponse<boolean>> {
    try {
      let url = `${API_ENDPOINTS.ITEMS.MODEL_NUMBER_EXISTS}?modalNumber=${encodeURIComponent(modalNumber)}`;
      if (excludeItemId) {
        url += `&excludeItemId=${excludeItemId}`;
      }
      const response = await fetch(url, { method: 'GET', headers: this.getAuthHeaders() });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, data: null, message: data.message || 'Failed to check model number', errors: data.errors || null };
      }
      return { success: data.isSuccess, data: data.response, message: data.message, errors: data.errors };
    } catch (error) {
      console.error('Error checking model number:', error);
      return { success: false, data: null, message: 'Network error. Please try again.', errors: null };
    }
  }

  /**
   * Checks if an item name already exists
   */
  async itemNameExists(name: string, excludeItemId?: string): Promise<ApiResponse<boolean>> {
    try {
      let url = `${API_ENDPOINTS.ITEMS.ITEM_NAME_EXISTS}?name=${encodeURIComponent(name)}`;
      if (excludeItemId) {
        url += `&excludeItemId=${excludeItemId}`;
      }
      const response = await fetch(url, { method: 'GET', headers: this.getAuthHeaders() });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, data: null, message: data.message || 'Failed to check item name', errors: data.errors || null };
      }
      return { success: data.isSuccess, data: data.response, message: data.message, errors: data.errors };
    } catch (error) {
      console.error('Error checking item name:', error);
      return { success: false, data: null, message: 'Network error. Please try again.', errors: null };
    }
  }

  /**
   * Generates the next sequential code via SP_GetNewNumber (matches the legacy
   * back-office AutoCreateUPC / AutoCreateModel loop). The server picks the
   * (TableName, Seed) pair from `codeType`: upc | case | pkg | model | style.
   */
  async generateCode(codeType: 'upc' | 'case' | 'pkg' | 'model' | 'style', storeId?: string): Promise<ApiResponse<string>> {
    try {
      let url = `${API_ENDPOINTS.ITEMS.GENERATE_CODE}?codeType=${encodeURIComponent(codeType)}`;
      if (storeId) {
        url += `&storeId=${encodeURIComponent(storeId)}`;
      }
      const response = await fetch(url, { method: 'GET', headers: this.getAuthHeaders() });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, data: null, message: data.message || 'Failed to generate code', errors: data.errors || null };
      }
      return { success: data.isSuccess, data: data.response, message: data.message, errors: data.errors };
    } catch (error) {
      console.error('Error generating code:', error);
      return { success: false, data: null, message: 'Network error. Please try again.', errors: null };
    }
  }

  /**
   * Checks if an alias barcode already exists in ItemAlias or ItemMain tables
   */
  async aliasBarcodeExists(barcodeNumber: string, excludeAliasId?: string, excludeItemId?: string): Promise<ApiResponse<boolean>> {
    try {
      let url = `${API_ENDPOINTS.ITEMS.ALIAS_BARCODE_EXISTS}?barcodeNumber=${encodeURIComponent(barcodeNumber)}`;
      if (excludeAliasId) {
        url += `&excludeAliasId=${excludeAliasId}`;
      }
      if (excludeItemId) {
        url += `&excludeItemId=${excludeItemId}`;
      }
      const response = await fetch(url, { method: 'GET', headers: this.getAuthHeaders() });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, data: null, message: data.message || 'Failed to check alias barcode', errors: data.errors || null };
      }
      return { success: data.isSuccess, data: data.response, message: data.message, errors: data.errors };
    } catch (error) {
      console.error('Error checking alias barcode:', error);
      return { success: false, data: null, message: 'Network error. Please try again.', errors: null };
    }
  }

  /**
   * Gets department defaults (markup, roundup, taxable, food stamp, discountable) for auto-setting item fields
   */
  async getDepartmentDefaults(departmentStoreId: string): Promise<ApiResponse<DepartmentDefaultsDto>> {
    try {
      const url = API_ENDPOINTS.ITEMS.DEPARTMENT_DEFAULTS(departmentStoreId);
      const response = await fetch(url, { method: 'GET', headers: this.getAuthHeaders() });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, data: null, message: data.message || 'Failed to load department defaults', errors: data.errors || null };
      }
      return { success: data.isSuccess, data: data.response, message: data.message, errors: data.errors };
    } catch (error) {
      console.error('Error loading department defaults:', error);
      return { success: false, data: null, message: 'Network error. Please try again.', errors: null };
    }
  }

  async uploadImage(file: File, itemId?: string, imageSlot: number = 1): Promise<ApiResponse<{ imageUrl: string; s3Path: string; fileName: string }>> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      let url = `${API_ENDPOINTS.ITEMS.UPLOAD_IMAGE}?imageSlot=${imageSlot}`;
      if (itemId) {
        url += `&itemId=${itemId}`;
      }

      const token = localStorage.getItem('accessToken');
      const headers: { [key: string]: string } = {
        'Authorization': token ? `Bearer ${token}` : '',
      };

      // Add CustomerId header
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

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to upload image',
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
      console.error('Error uploading image:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getImageUrl(itemId: string, imageSlot: number = 1): Promise<ApiResponse<{ imageUrl: string; s3Path: string }>> {
    try {
      const url = `${API_ENDPOINTS.ITEMS.GET_IMAGE_URL(itemId)}?imageSlot=${imageSlot}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to get image URL',
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
      console.error('Error getting image URL:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async deleteImage(itemId: string, imageSlot: number = 1): Promise<ApiResponse<boolean>> {
    try {
      const url = `${API_ENDPOINTS.ITEMS.DELETE_IMAGE(itemId)}?imageSlot=${imageSlot}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to delete image',
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
      console.error('Error deleting image:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }
}

export const itemService = new ItemService();
