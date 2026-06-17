import axios, { type InternalAxiosRequestConfig } from 'axios';
import { handle401, isAuthEndpoint, isTokenExpiredOrMissing } from '../utils/authManager';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const apiClient = axios.create({
  baseURL: BASE_URL,
});

// Request interceptor: attach Authorization + CustomerId headers
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Send trusted device token for MFA "Remember device" feature
    const deviceTokenRaw = localStorage.getItem('mfa_device_token');
    if (deviceTokenRaw) {
      try {
        const parsed = JSON.parse(deviceTokenRaw);
        const isExpired = parsed.expiresAt && new Date(parsed.expiresAt) <= new Date();
        if (isExpired) {
          localStorage.removeItem('mfa_device_token');
        } else {
          config.headers['X-Device-Token'] = parsed.token;
        }
      } catch {
        // Legacy plain-string format or corrupt — remove it
        localStorage.removeItem('mfa_device_token');
      }
    }

    // Get CustomerId from Redux persisted state or userData
    let customerId: string | null = null;
    try {
      if (typeof window !== 'undefined' && (window as any).__REDUX_STORE__) {
        const state = (window as any).__REDUX_STORE__.getState();
        if (state.customer?.currentCustomer?.customerId) {
          customerId = state.customer.currentCustomer.customerId.toString();
        }
      } else {
        const reduxState = JSON.parse(localStorage.getItem('persist:root') || '{}');
        if (reduxState.customer) {
          const customerState = JSON.parse(reduxState.customer);
          if (customerState.currentCustomer?.customerId) {
            customerId = customerState.currentCustomer.customerId.toString();
          }
        }
      }
    } catch {
      const userData = localStorage.getItem('userData');
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          if (parsed.customerId) {
            customerId = parsed.customerId.toString();
          }
        } catch {
          // ignore
        }
      }
    }

    if (customerId) {
      config.headers['CustomerId'] = customerId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: 401 → refresh → retry (or logout)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

    // ─── Case 1: Clean 401 (server returned 401 with CORS headers) ───
    if (error.response?.status === 401 && config && !config._retried) {
      const url = config.url || '';
      console.warn('[axios-interceptor] 401 detected | url:', url);

      if (!isAuthEndpoint(url)) {
        const result = await handle401(url);

        if (result === 'refreshed') {
          config._retried = true;
          const token = localStorage.getItem('accessToken');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient.request(config);
        }
      }
    }

    // ─── Case 2: CORS-blocked 401 (no response object, network error) ───
    // When the server returns 401 WITHOUT CORS headers, axios sees a
    // "Network Error" with error.response === undefined. If our token is
    // expired, treat this as a 401.
    if (
      !error.response &&
      error.code === 'ERR_NETWORK' &&
      config &&
      !config._retried
    ) {
      const url = config.url || '';

      if (!isAuthEndpoint(url) && isTokenExpiredOrMissing()) {
        console.warn('[axios-interceptor] CORS-blocked + expired token → treating as 401 | url:', url);
        const result = await handle401(url);

        if (result === 'refreshed') {
          config._retried = true;
          const token = localStorage.getItem('accessToken');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient.request(config);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
