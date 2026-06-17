import { API_ENDPOINTS } from '../constants/api';

export interface SaveUserPreferenceDto {
  preferenceKey: string;
  preferenceValue: string;
}

export interface UserPreferenceResponseDto {
  preferenceKey: string;
  preferenceValue: string;
  lastModified: string;
}

export interface ApiResult<T> {
  isSuccess: boolean;
  message: string;
  response: T | null;
}

/**
 * Wraps a fetch call so it can't hang indefinitely. If the server doesn't
 * respond within the timeout window, the request is aborted and the caller
 * gets a clean rejection instead of a stuck promise. Critical for the
 * session-restore flow which was previously getting stuck on slow backends.
 */
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

class UserPreferenceService {
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

  /**
   * Gets a single preference by key
   */
  async getPreference(key: string): Promise<ApiResult<UserPreferenceResponseDto | null>> {
    try {
      const response = await fetchWithTimeout(API_ENDPOINTS.USER_PREFERENCE.GET(key), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          isSuccess: false,
          message: data.message || 'Failed to get preference',
          response: null,
        };
      }

      return data;
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === 'AbortError';
      console.error(isTimeout ? 'Get preference timed out' : 'Error getting preference:', error);
      return {
        isSuccess: false,
        message: isTimeout
          ? 'Request timed out. Please try again.'
          : 'Network error. Please try again.',
        response: null,
      };
    }
  }

  /**
   * Gets multiple preferences by keys
   */
  async getPreferences(keys: string[]): Promise<ApiResult<UserPreferenceResponseDto[]>> {
    try {
      const response = await fetchWithTimeout(API_ENDPOINTS.USER_PREFERENCE.GET_MULTIPLE(keys.join(',')), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          isSuccess: false,
          message: data.message || 'Failed to get preferences',
          response: [],
        };
      }

      return data;
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === 'AbortError';
      console.error(isTimeout ? 'Get preferences timed out' : 'Error getting preferences:', error);
      return {
        isSuccess: false,
        message: isTimeout
          ? 'Request timed out. Please try again.'
          : 'Network error. Please try again.',
        response: [],
      };
    }
  }

  /**
   * Saves (upserts) a preference
   */
  async savePreference(key: string, value: object | string): Promise<ApiResult<boolean>> {
    try {
      const dto: SaveUserPreferenceDto = {
        preferenceKey: key,
        preferenceValue: typeof value === 'string' ? value : JSON.stringify(value),
      };

      const response = await fetchWithTimeout(API_ENDPOINTS.USER_PREFERENCE.SAVE, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(dto),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          isSuccess: false,
          message: data.message || 'Failed to save preference',
          response: false,
        };
      }

      return data;
    } catch (error) {
      console.error('Error saving preference:', error);
      return {
        isSuccess: false,
        message: 'Network error. Please try again.',
        response: false,
      };
    }
  }

  /**
   * Deletes a preference by key
   */
  async deletePreference(key: string): Promise<ApiResult<boolean>> {
    try {
      const response = await fetchWithTimeout(API_ENDPOINTS.USER_PREFERENCE.DELETE(key), {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          isSuccess: false,
          message: data.message || 'Failed to delete preference',
          response: false,
        };
      }

      return data;
    } catch (error) {
      console.error('Error deleting preference:', error);
      return {
        isSuccess: false,
        message: 'Network error. Please try again.',
        response: false,
      };
    }
  }
}

export const userPreferenceService = new UserPreferenceService();
