import apiClient from '../lib/axios';
import type { SmtpSettingsDto, SmtpSettingsUpdateDto, SmtpStoreLookup } from '../types/smtp';

interface ApiResponse<T> {
  isSuccess: boolean;
  statusCode: number;
  message: string;
  response: T;
  errors?: object;
}

export const smtpService = {
  get: (customerId: number, storeId: string) =>
    apiClient.get<ApiResponse<SmtpSettingsDto>>(
      `/api/superadmin/smtp/${customerId}/${storeId}`
    ),

  getStores: (customerId: number) =>
    apiClient.get<ApiResponse<SmtpStoreLookup[]>>(
      `/api/superadmin/smtp/stores/${customerId}`
    ),

  update: (customerId: number, data: SmtpSettingsUpdateDto) =>
    apiClient.put<ApiResponse<null>>(
      `/api/superadmin/smtp/${customerId}`,
      data
    ),
};
