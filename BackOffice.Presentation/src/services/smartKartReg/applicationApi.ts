import apiClient from '../../lib/axios';
import { API_ENDPOINTS } from '../../constants/api';
import type { ApiResponse, PaginationResponse } from './permissionApi';

export interface Application {
  appId: string;
  appName: string;
}

export interface ApplicationDropdown {
  appId: string;
  appName: string;
}

export interface CreateApplicationDto {
  appName: string;
}

export interface UpdateApplicationDto extends CreateApplicationDto {
  appId: string;
}

export const applicationApi = {
  getAll: (params: Record<string, any>) =>
    apiClient.get<ApiResponse<PaginationResponse<Application>>>(API_ENDPOINTS.APPLICATIONS.GET_ALL, { params }),

  dropdown: () =>
    apiClient.get<ApiResponse<ApplicationDropdown[]>>(API_ENDPOINTS.APPLICATIONS.DROPDOWN),

  getById: (id: string) =>
    apiClient.get<ApiResponse<Application>>(API_ENDPOINTS.APPLICATIONS.GET_BY_ID(id)),

  create: (dto: CreateApplicationDto) =>
    apiClient.post<ApiResponse<string>>(API_ENDPOINTS.APPLICATIONS.CREATE, dto),

  update: (id: string, dto: UpdateApplicationDto) =>
    apiClient.put<ApiResponse<boolean>>(API_ENDPOINTS.APPLICATIONS.UPDATE(id), dto),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<boolean>>(API_ENDPOINTS.APPLICATIONS.DELETE(id)),
};
