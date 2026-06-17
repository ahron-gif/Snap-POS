declare global {
  interface Window {
    __REDUX_STORE__?: any;
  }
}

export const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('accessToken');
  
  // Try to get customer ID from Redux store first
  let customerId = null;
  try {
    // Check if we're in a browser environment and have access to window
    if (typeof window !== 'undefined' && window.__REDUX_STORE__) {
      const state = window.__REDUX_STORE__.getState();
      if (state.customer && state.customer.currentCustomer) {
        customerId = state.customer.currentCustomer.customerId;
      }
    } else {
      // Fallback to persisted Redux state
      const reduxState = JSON.parse(localStorage.getItem('persist:root') || '{}');
      if (reduxState.customer) {
        const customerState = JSON.parse(reduxState.customer);
        if (customerState.currentCustomer && customerState.currentCustomer.customerId) {
          customerId = customerState.currentCustomer.customerId;
        }
      }
    }
  } catch (error) {
    // Fallback to userData from localStorage if Redux state is not available
    const userData = localStorage.getItem('userData');
    if (userData) {
      try {
        const parsedUserData = JSON.parse(userData);
        customerId = parsedUserData.customerId;
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };

  // Add CustomerId header if available
  if (customerId) {
    headers['CustomerId'] = customerId.toString();
  }

  return headers;
};

export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch {
    return true;
  }
};

// Alternative function for components with access to Redux state
export const getAuthHeadersWithCustomerId = (customerId?: number | null): HeadersInit => {
  const token = localStorage.getItem('accessToken');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };

  // Add CustomerId header if provided
  if (customerId) {
    headers['CustomerId'] = customerId.toString();
  }

  return headers;
};