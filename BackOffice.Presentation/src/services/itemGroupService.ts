import { API_ENDPOINTS } from '../constants/api';

// Interface for ItemGroup grid data
export interface ItemGroupGridDto {
  itemGroupID: string;
  name: string;
  parentID: string | null;
  parentName: string | null;
  status: number | null;
  dateCreated: string | null;
  dateModified: string | null;
}

// Interface for ItemGroup detail data (full fields for edit)
export interface ItemGroupDetailDto {
  itemGroupID: string;
  name: string;
  parentID: string | null;
  status: number | null;
  dateCreated: string | null;
  userCreated: string | null;
  dateModified: string | null;
  userModified: string | null;
}

// Interface for create item group
export interface CreateItemGroupDto {
  name: string;
  parentID?: string | null;
  status: number;
}

// Interface for update item group
export interface UpdateItemGroupDto {
  itemGroupID: string;
  name: string;
  parentID?: string | null;
  status: number;
}

// Status options for dropdown
export const STATUS_OPTIONS = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
  { value: 9, label: 'Hidden' },
];

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  errors: string[] | null;
}

class ItemGroupService {
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

  async getAllItemGroups(): Promise<ApiResponse<ItemGroupGridDto[]>> {
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

  async getItemGroupById(id: string): Promise<ApiResponse<ItemGroupDetailDto>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.ITEM_GROUPS.GET_BY_ID(id)}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch item group',
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
      console.error('Error fetching item group:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async createItemGroup(dto: CreateItemGroupDto): Promise<ApiResponse<string>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.ITEM_GROUPS.CREATE}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(dto),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to create item group',
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
      console.error('Error creating item group:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async updateItemGroup(dto: UpdateItemGroupDto): Promise<ApiResponse<boolean>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.ITEM_GROUPS.UPDATE(dto.itemGroupID)}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(dto),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to update item group',
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
      console.error('Error updating item group:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async deleteItemGroup(id: string): Promise<ApiResponse<boolean>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.ITEM_GROUPS.DELETE(id)}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to delete item group',
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
      console.error('Error deleting item group:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async canDeleteItemGroup(id: string): Promise<ApiResponse<boolean>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.ITEM_GROUPS.CAN_DELETE(id)}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to check if item group can be deleted',
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
      console.error('Error checking if item group can be deleted:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async itemGroupNameExists(name: string, excludeId?: string): Promise<ApiResponse<boolean>> {
    try {
      let url = `${API_ENDPOINTS.ITEM_GROUPS.NAME_EXISTS}?name=${encodeURIComponent(name)}`;
      if (excludeId) {
        url += `&excludeId=${excludeId}`;
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
          message: data.message || 'Failed to check item group name',
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
      console.error('Error checking item group name:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }
}

export const itemGroupService = new ItemGroupService();
