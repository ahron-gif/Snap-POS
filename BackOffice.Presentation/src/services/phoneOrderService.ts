import { API_ENDPOINTS } from '../constants/api';

// Phone Order Entry DTO
export interface PhoneOrderEntryDto {
  phoneOrderEntryID?: string;
  phoneOrderID?: string;
  itemStoreNo: string;
  qty: number;
  uomQty?: number;
  uomType?: number;
  uomPrice?: number;
  extPrice?: number;
  note?: string;
  sortOrder?: number;
  status?: number;
  onHand?: number;
  qtyPick?: number;
  uomQtyPick?: number;
  uomTypePick?: number;
}

// Phone Order DTO
export interface PhoneOrderDto {
  phoneOrderID?: string;
  phoneOrderNo?: string;
  storeID?: string;
  customerID: string;
  driversNote?: string;
  customerNote?: string;
  pickNote?: string;
  phoneOrderDate?: string;
  phoneOrderTime?: string;
  deliveryDate?: string;
  shiftID?: string;
  shippingID?: string;
  phoneOrderStatus?: number;
  pickByID?: string;
  takeByID?: string;
  transactionID?: string;
  type?: number;
  total?: number;
  status?: number;
  freezer?: boolean;
  paymentNote?: string;
  tenderID?: number;
  priority?: number;
  pickDate?: string;
  pickTime?: string;
  onHoldMsg?: string;
  entries?: PhoneOrderEntryDto[];
}

// Phone Order View DTO (for displaying)
export interface PhoneOrderViewDto {
  customerNo?: string;
  firstName?: string;
  lastName?: string;
  over30?: number;
  over60?: number;
  over90?: number;
  over120?: number;
  credit?: number;
  over0?: number;
  current?: number;
  lockAccount?: boolean;
  balanceDoe?: number;
  lastPaymentDate?: string;
  lastPayment?: number;
  phoneOrderID: string;
  phoneOrderNo?: string;
  storeID?: string;
  customerID: string;
  driversNote?: string;
  customerNote?: string;
  pickNote?: string;
  phoneOrderDate?: string;
  phoneOrderTime?: string;
  deliveryDate?: string;
  shiftID?: string;
  shippingID?: string;
  phoneOrderStatus?: number;
  pickByID?: string;
  takeByID?: string;
  transactionID?: string;
  type?: number;
  total?: number;
  status?: number;
  dateCreated?: string;
  userCreated?: string;
  dateModified?: string;
  userModified?: string;
  freezer?: boolean;
  tenderID?: number;
  startEditing?: string;
  paymentNote?: string;
  userEditing?: string;
  phoneOrderType?: string;
  phoneOrder_Status?: string;
  transactionNo?: string;
  lockOutDays?: number;
  paid?: number;
  onHoldMsg?: string;
  takenByUserName?: string;
  groups?: string;
  zones?: string;
  entries?: PhoneOrderEntryDto[];
}

// API Response interface
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  errors: string[] | null;
}

// Item Search Result
export interface ItemSearchResult {
  itemStoreNo: string;
  itemID: string;
  name: string;
  upc: string;
  modelNo?: string;
  price: number;
  listPrice: number;
  cost: number;
  onHand: number;
  size?: string;
  department?: string;
  supplier?: string;
}

class PhoneOrderService {
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

  // Get phone order by ID
  async getPhoneOrder(id: string): Promise<ApiResponse<PhoneOrderViewDto>> {
    try {
      const response = await fetch(API_ENDPOINTS.PHONE_ORDERS.GET_BY_ID(id), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to get phone order',
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
      console.error('Error getting phone order:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  // Create new phone order
  async createPhoneOrder(phoneOrder: PhoneOrderDto): Promise<ApiResponse<PhoneOrderViewDto>> {
    try {
      const response = await fetch(API_ENDPOINTS.PHONE_ORDERS.CREATE, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(phoneOrder),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to create phone order',
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
      console.error('Error creating phone order:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  // Update existing phone order
  async updatePhoneOrder(id: string, phoneOrder: PhoneOrderDto): Promise<ApiResponse<PhoneOrderViewDto>> {
    try {
      const response = await fetch(API_ENDPOINTS.PHONE_ORDERS.UPDATE(id), {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(phoneOrder),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to update phone order',
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
      console.error('Error updating phone order:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  // Delete phone order
  async deletePhoneOrder(id: string): Promise<ApiResponse<boolean>> {
    try {
      const response = await fetch(API_ENDPOINTS.PHONE_ORDERS.DELETE(id), {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to delete phone order',
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
      console.error('Error deleting phone order:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  // Void phone order
  async voidPhoneOrder(id: string): Promise<ApiResponse<boolean>> {
    try {
      const response = await fetch(API_ENDPOINTS.PHONE_ORDERS.VOID(id), {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to void phone order',
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
      console.error('Error voiding phone order:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  // Change phone order status
  async changeStatus(id: string, status: number): Promise<ApiResponse<boolean>> {
    try {
      const response = await fetch(API_ENDPOINTS.PHONE_ORDERS.CHANGE_STATUS(id), {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to change status',
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
      console.error('Error changing status:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  // Get phone order entries
  async getEntries(phoneOrderId: string): Promise<ApiResponse<PhoneOrderEntryDto[]>> {
    try {
      const response = await fetch(API_ENDPOINTS.PHONE_ORDERS.GET_ENTRIES(phoneOrderId), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to get entries',
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
      console.error('Error getting entries:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  // Add entry to phone order
  async addEntry(phoneOrderId: string, entry: PhoneOrderEntryDto): Promise<ApiResponse<PhoneOrderEntryDto>> {
    try {
      const response = await fetch(API_ENDPOINTS.PHONE_ORDERS.ADD_ENTRY(phoneOrderId), {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(entry),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to add entry',
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
      console.error('Error adding entry:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  // Update entry
  async updateEntry(phoneOrderId: string, entryId: string, entry: PhoneOrderEntryDto): Promise<ApiResponse<PhoneOrderEntryDto>> {
    try {
      const response = await fetch(API_ENDPOINTS.PHONE_ORDERS.UPDATE_ENTRY(phoneOrderId, entryId), {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(entry),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to update entry',
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
      console.error('Error updating entry:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  // Delete entry
  async deleteEntry(phoneOrderId: string, entryId: string): Promise<ApiResponse<boolean>> {
    try {
      const response = await fetch(API_ENDPOINTS.PHONE_ORDERS.DELETE_ENTRY(phoneOrderId, entryId), {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to delete entry',
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
      console.error('Error deleting entry:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  // Get previous orders for customer
  async getPreviousOrders(customerId: string): Promise<ApiResponse<PhoneOrderViewDto[]>> {
    try {
      const response = await fetch(API_ENDPOINTS.PHONE_ORDERS.GET_PREVIOUS_ORDERS(customerId), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to get previous orders',
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
      console.error('Error getting previous orders:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  // Search items
  async searchItems(query: string, storeId?: string): Promise<ApiResponse<ItemSearchResult[]>> {
    try {
      let url = `${API_ENDPOINTS.PHONE_ORDERS.SEARCH_ITEMS}?query=${encodeURIComponent(query)}`;
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
          message: data.message || 'Failed to search items',
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
      console.error('Error searching items:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }
}

export const phoneOrderService = new PhoneOrderService();
