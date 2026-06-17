import apiClient from '../../lib/axios';
import { API_ENDPOINTS } from '../../constants/api';
import type { ApiResponse, PaginationResponse } from './permissionApi';

export interface AppRegistration {
  id: string;
  appId: string;
  appName: string;
  registrationId?: string;
  storeName?: string;
  apiurl?: string;
}

export interface CreateAppRegistrationDto {
  appId: string;
  registrationId?: string;
  apiurl?: string;
}

export interface UpdateAppRegistrationDto extends CreateAppRegistrationDto {
  id: string;
}

export const appRegistrationApi = {
  getAll: (params: Record<string, any>) =>
    apiClient.get<ApiResponse<PaginationResponse<AppRegistration>>>(API_ENDPOINTS.APP_REGISTRATIONS.GET_ALL, { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<AppRegistration>>(API_ENDPOINTS.APP_REGISTRATIONS.GET_BY_ID(id)),

  create: (dto: CreateAppRegistrationDto) =>
    apiClient.post<ApiResponse<string>>(API_ENDPOINTS.APP_REGISTRATIONS.CREATE, dto),

  update: (id: string, dto: UpdateAppRegistrationDto) =>
    apiClient.put<ApiResponse<boolean>>(API_ENDPOINTS.APP_REGISTRATIONS.UPDATE(id), dto),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<boolean>>(API_ENDPOINTS.APP_REGISTRATIONS.DELETE(id)),
};
