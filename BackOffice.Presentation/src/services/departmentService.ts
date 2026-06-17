import { API_ENDPOINTS } from '../constants/api';

// Interface for Department grid data
export interface DepartmentGridDto {
  departmentStoreID: string;
  name: string;
  description: string | null;
  parentDepartmentID: string | null;
  defaultMarkup: number | null;
  roundUp: number;
  isDefaultTaxInclude: boolean | null;
  isDefaultFoodStampable: boolean | null;
  isDefaultDiscountable: boolean | null;
  status: number | null;
  dateCreated: string | null;
  dateModified: string | null;
}

// Interface for Department detail data (full fields for edit)
export interface DepartmentDetailDto {
  departmentStoreID: string;
  name: string;
  description: string | null;
  parentDepartmentID: string | null;
  storeID: string | null;
  defaultMarkup: number | null;
  defaultMarkupA: number | null;
  defaultMarkupB: number | null;
  defaultMarkupC: number | null;
  defaultMarkupD: number | null;
  roundUp: number;
  roundUpA: number | null;
  roundUpB: number | null;
  roundUpC: number | null;
  roundUpD: number | null;
  roundValue: number | null;
  roundValueA: number | null;
  roundValueB: number | null;
  roundValueC: number | null;
  roundValueD: number | null;
  defaultCogsAccount: number | null;
  defaultIncomeAccount: number | null;
  defaultTaxNo: string | null;
  isDefaultTaxInclude: boolean | null;
  isDefaultFoodStampable: boolean | null;
  isDefaultDiscountable: boolean | null;
  defaultProfitCalculation: number | null;
  status: number | null;
  dateCreated: string | null;
  dateModified: string | null;
  keyNumber: number | null;
  departmentNo: string | null;
  discountID: string | null;
}

// Interface for create department
export interface CreateDepartmentDto {
  name: string;
  description?: string | null;
  parentDepartmentID?: string | null;
  defaultMarkup?: number | null;
  defaultMarkupA?: number | null;
  defaultMarkupB?: number | null;
  defaultMarkupC?: number | null;
  defaultMarkupD?: number | null;
  roundUp?: number;
  roundUpA?: number | null;
  roundUpB?: number | null;
  roundUpC?: number | null;
  roundUpD?: number | null;
  roundValue?: number | null;
  roundValueA?: number | null;
  roundValueB?: number | null;
  roundValueC?: number | null;
  roundValueD?: number | null;
  defaultCogsAccount?: number | null;
  defaultIncomeAccount?: number | null;
  defaultTaxNo?: string | null;
  isDefaultTaxInclude?: boolean | null;
  isDefaultFoodStampable?: boolean | null;
  isDefaultDiscountable?: boolean | null;
  defaultProfitCalculation?: number | null;
  departmentNo?: string | null;
  discountID?: string | null;
}

// Interface for update department
export interface UpdateDepartmentDto extends CreateDepartmentDto {
  departmentStoreID: string;
  // Original DateModified loaded from GET. SP_DepartmentStoreUpdate's WHERE clause
  // requires this to match the row's stored value, otherwise the UPDATE no-ops.
  dateModified: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  errors: string[] | null;
}

class DepartmentService {
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

  async getAllDepartments(): Promise<ApiResponse<DepartmentGridDto[]>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.DEPARTMENTS.GET_ALL}`, {
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

  async getDepartmentById(id: string): Promise<ApiResponse<DepartmentDetailDto>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.DEPARTMENTS.GET_BY_ID(id)}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch department',
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
      console.error('Error fetching department:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async createDepartment(dto: CreateDepartmentDto): Promise<ApiResponse<string>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.DEPARTMENTS.CREATE}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(dto),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to create department',
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
      console.error('Error creating department:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async updateDepartment(dto: UpdateDepartmentDto): Promise<ApiResponse<boolean>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.DEPARTMENTS.UPDATE(dto.departmentStoreID)}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(dto),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to update department',
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
      console.error('Error updating department:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async deleteDepartment(id: string): Promise<ApiResponse<boolean>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.DEPARTMENTS.DELETE(id)}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to delete department',
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
      console.error('Error deleting department:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async canDeleteDepartment(id: string): Promise<ApiResponse<boolean>> {
    try {
      const response = await fetch(`${API_ENDPOINTS.DEPARTMENTS.CAN_DELETE(id)}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to check if department can be deleted',
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
      console.error('Error checking if department can be deleted:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async departmentNameExists(name: string, excludeId?: string): Promise<ApiResponse<boolean>> {
    try {
      let url = `${API_ENDPOINTS.DEPARTMENTS.NAME_EXISTS}?name=${encodeURIComponent(name)}`;
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
          message: data.message || 'Failed to check department name',
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
      console.error('Error checking department name:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }
}

export const departmentService = new DepartmentService();
