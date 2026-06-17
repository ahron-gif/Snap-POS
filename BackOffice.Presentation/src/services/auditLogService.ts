import { API_ENDPOINTS } from '../constants/api';
import { AuditLogGridItem, AuditLogDetail } from '../types/auditLog';

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  errors: string[] | null;
}

class AuditLogService {
  private getAuthHeaders(): { [key: string]: string } {
    const token = localStorage.getItem('accessToken');
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };

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

  async getEntityHistory(entityType: string, entityId: string): Promise<ApiResponse<AuditLogGridItem[]>> {
    try {
      const params = new URLSearchParams({ entityType, entityId });
      const response = await fetch(`${API_ENDPOINTS.AUDIT_LOG.ENTITY_HISTORY}?${params}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch entity history',
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
      console.error('Error fetching entity history:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }

  async getAuditLogDetail(id: number): Promise<ApiResponse<AuditLogDetail>> {
    try {
      const response = await fetch(API_ENDPOINTS.AUDIT_LOG.GET_BY_ID(id), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          data: null,
          message: data.message || 'Failed to fetch audit log detail',
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
      console.error('Error fetching audit log detail:', error);
      return {
        success: false,
        data: null,
        message: 'Network error. Please try again.',
        errors: null,
      };
    }
  }
}

export const auditLogService = new AuditLogService();
