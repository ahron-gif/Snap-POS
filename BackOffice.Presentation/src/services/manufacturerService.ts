import { API_ENDPOINTS } from '../constants/api';

// Interface for Manufacturer grid data
export interface ManufacturerGridDto {
  manufacturerID: string;
  manufacturerName: string;
  manufacturerNo: string | null;
  status: number | null;
  dateCreated: string | null;
  dateModified: string | null;
}

// Interface for Manufacturer detail data (full fields for edit)
export interface ManufacturerDetailDto {
  manufacturerID: string;
  manufacturerName: string;
  manufacturerNo: string | null;
  status: number | null;
  dateCreated: string | null;
  userCreated: string | null;
  dateModified: string | null;
  userModified: string | null;
}

// Interface for create manufacturer
export interface CreateManufacturerDto {
  manufacturerName: string;
  manufacturerNo?: string | null;
  status: number;
}

// Interface for update manufacturer
export interface UpdateManufacturerDto {
  manufacturerID: string;
  manufacturerName: string;
  manufacturerNo?: string | null;
  status: number;
  // Original DateModified loaded from GET — sent back so the server's
  // optimistic-concurrency check passes.
  dateModified: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  errors: string[] | null;
}

// Status options for dropdown
export const STATUS_OPTIONS = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
  { value: 9, label: 'Hidden' },
];

class ManufacturerService {
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

  async getAllManufacturers(): Promise<ApiResponse<ManufacturerGridDto[]>> {
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

  async getManufacturerById(id: string): Promise<ApiResponse<ManufacturerDetailDto>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.MANUFACTURERS.GET_BY_ID(id)}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch manufacturer',
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
      console.error('Error fetching manufacturer:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async createManufacturer(dto: CreateManufacturerDto): Promise<ApiResponse<string>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.MANUFACTURERS.CREATE}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(dto),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to create manufacturer',
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
      console.error('Error creating manufacturer:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async updateManufacturer(dto: UpdateManufacturerDto): Promise<ApiResponse<boolean>> {
    try {
      // Ensure manufacturerID is not sent in the body to avoid potential deserialization issues
      const { manufacturerID, ...bodyData } = dto;
      const payload = {
        manufacturerID: manufacturerID,
        manufacturerName: bodyData.manufacturerName,
        manufacturerNo: bodyData.manufacturerNo ?? null,
        status: bodyData.status,
        dateModified: bodyData.dateModified,
      };

      console.log('[ManufacturerService] Update payload:', JSON.stringify(payload));
      console.log('[ManufacturerService] Update URL:', API_ENDPOINTS.MANUFACTURERS.UPDATE(manufacturerID));

      const response = await fetch(`${API_ENDPOINTS.MANUFACTURERS.UPDATE(manufacturerID)}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('[ManufacturerService] Update response:', JSON.stringify(data));

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to update manufacturer',
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
      console.error('Error updating manufacturer:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async deleteManufacturer(id: string): Promise<ApiResponse<boolean>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.MANUFACTURERS.DELETE(id)}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to delete manufacturer',
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
      console.error('Error deleting manufacturer:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async canDeleteManufacturer(id: string): Promise<ApiResponse<boolean>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.MANUFACTURERS.CAN_DELETE(id)}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to check if manufacturer can be deleted',
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
      console.error('Error checking if manufacturer can be deleted:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async manufacturerNameExists(name: string, excludeId?: string): Promise<ApiResponse<boolean>> {
    try {
      let url = `${API_ENDPOINTS.MANUFACTURERS.NAME_EXISTS}?name=${encodeURIComponent(name)}`;
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
          message: data.message || 'Failed to check manufacturer name',
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
      console.error('Error checking manufacturer name:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }
}

export const manufacturerService = new ManufacturerService();
