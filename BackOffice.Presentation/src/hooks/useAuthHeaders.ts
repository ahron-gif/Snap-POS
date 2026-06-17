import { useCallback } from 'react';
import { useAppSelector } from './useAppSelector';

export const useAuthHeaders = () => {
  const { currentCustomer } = useAppSelector(state => state.customer);

  const getAuthHeaders = useCallback((): { [key: string]: string } => {
    const token = localStorage.getItem('accessToken');

    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };

    // Add CustomerId header from Redux store if available
    if (currentCustomer && currentCustomer.customerId) {
      headers['CustomerId'] = currentCustomer.customerId.toString();
    } else {
      // Fallback to userData from localStorage
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
    }

    return headers;
  }, [currentCustomer]);

  return { getAuthHeaders };
};