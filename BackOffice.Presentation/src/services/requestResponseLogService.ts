import { API_ENDPOINTS } from '../constants/api';

// Interface for Request Log grid data
export interface RequestLogGridDto {
  requestId: number;
  requestData: string | null;
  createdAt: string | null;
  methodName: string | null;
  controllerName: string | null;
  registrationID: string | null;
  token: string | null;
  hasResponse: boolean;
}

// Interface for Response Log grid data
export interface ResponseLogGridDto {
  responseId: number;
  requestId: number | null;
  requestData: string | null;
  createdAt: string | null;
  methodName: string | null;
  controllerName: string | null;
  registrationID: string | null;
  token: string | null;
}

// Interface for combined Request/Response Log
export interface RequestResponseLogDto {
  requestId: number;
  requestData: string | null;
  requestCreatedAt: string | null;
  methodName: string | null;
  controllerName: string | null;
  registrationID: string | null;
  token: string | null;
  responseId: number | null;
  responseData: string | null;
  responseCreatedAt: string | null;
}

// Interface for Request Log detail with linked response
export interface RequestLogDetailDto {
  requestId: number;
  requestData: string | null;
  createdAt: string | null;
  methodName: string | null;
  controllerName: string | null;
  registrationID: string | null;
  token: string | null;
  response: ResponseLogGridDto | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  errors: string[] | null;
}

class RequestResponseLogService {
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

  async getRequestLogById(id: number): Promise<ApiResponse<RequestLogDetailDto>> {
    try {
      const response = await fetch(API_ENDPOINTS.REQUEST_RESPONSE_LOGS.GET_REQUEST_BY_ID(id), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch request log',
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
      console.error('Error fetching request log:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getResponseByRequestId(requestId: number): Promise<ApiResponse<ResponseLogGridDto>> {
    try {
      const response = await fetch(API_ENDPOINTS.REQUEST_RESPONSE_LOGS.GET_RESPONSE_BY_REQUEST_ID(requestId), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch response log',
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
      console.error('Error fetching response log:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getDistinctControllerNames(): Promise<ApiResponse<string[]>> {
    try {
      const response = await fetch(API_ENDPOINTS.REQUEST_RESPONSE_LOGS.GET_CONTROLLERS, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch controller names',
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
      console.error('Error fetching controller names:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getDistinctMethodNames(controllerName?: string): Promise<ApiResponse<string[]>> {
    try {
      let url = API_ENDPOINTS.REQUEST_RESPONSE_LOGS.GET_METHODS;
      if (controllerName) {
        url += `?controllerName=${encodeURIComponent(controllerName)}`;
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
          message: data.message || 'Failed to fetch method names',
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
      console.error('Error fetching method names:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }
}

export const requestResponseLogService = new RequestResponseLogService();
