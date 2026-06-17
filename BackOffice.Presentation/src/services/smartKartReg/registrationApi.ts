import apiClient from '../../lib/axios';
import { API_ENDPOINTS } from '../../constants/api';
import type { ApiResponse, PaginationResponse } from './permissionApi';

export interface Registration {
  registrationId: string;
  storeName: string;
  dataBaseName: string;
  storeType: number;
  licenseExpires: string;
  address?: string;
  cityStateZip?: string;
  phone?: string;
  email?: string;
  status: number;
  salesPerson?: string;
  serverName?: string;
  versionName?: string;
  dateCreated?: string;
  dateModified?: string;
}

export interface RegistrationDetail {
  registrationId: string;
  storeName: string;
  userName: string;
  password: string;
  dataBaseName: string;
  storeType: number;
  licenseExpires: string;
  address?: string;
  cityStateZip?: string;
  phone?: string;
  fax?: string;
  email?: string;
  multipleLocation?: boolean;
  phoneOrder?: boolean;
  loyalty?: boolean;
  emailService?: boolean;
  textService?: boolean;
  giftCards?: boolean;
  timeAttendance?: boolean;
  dateCreated?: string;
  dateModified?: string;
  status: number;
  salesPerson?: string;
  regUser?: string;
  serverName?: string;
  versionName?: string;
  posLic?: number;
  boLic?: number;
  isSmartKart?: boolean;
  versionId?: number;
  apiurl?: string;
}

export interface CreateRegistrationDto {
  storeName: string;
  userName: string;
  password: string;
  dataBaseName: string;
  storeType: number;
  licenseExpires: string;
  address?: string;
  cityStateZip?: string;
  phone?: string;
  fax?: string;
  email?: string;
  multipleLocation?: boolean;
  phoneOrder?: boolean;
  loyalty?: boolean;
  emailService?: boolean;
  textService?: boolean;
  giftCards?: boolean;
  timeAttendance?: boolean;
  status: number;
  salesPerson?: string;
  regUser?: string;
  serverName?: string;
  versionName?: string;
  posLic?: number;
  boLic?: number;
  isSmartKart?: boolean;
  versionId?: number;
  apiurl?: string;
}

export interface UpdateRegistrationDto extends CreateRegistrationDto {
  registrationId: string;
}

export const registrationApi = {
  getAll: (params: Record<string, any>) =>
    apiClient.get<ApiResponse<PaginationResponse<Registration>>>(API_ENDPOINTS.REGISTRATIONS.GET_ALL, { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<RegistrationDetail>>(API_ENDPOINTS.REGISTRATIONS.GET_BY_ID(id)),

  create: (dto: CreateRegistrationDto) =>
    apiClient.post<ApiResponse<string>>(API_ENDPOINTS.REGISTRATIONS.CREATE, dto),

  update: (id: string, dto: UpdateRegistrationDto) =>
    apiClient.put<ApiResponse<boolean>>(API_ENDPOINTS.REGISTRATIONS.UPDATE(id), dto),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<boolean>>(API_ENDPOINTS.REGISTRATIONS.DELETE(id)),
};
