import apiClient from '../../lib/axios';
import { API_ENDPOINTS } from '../../constants/api';

// Types
export interface Permission {
  id: number;
  permissionKey: string;
  permissionName: string;
  description?: string;
  category?: string;
  isActive: boolean;
  dateCreated?: string;
  dateModified?: string;
  createdBy?: string;
  modifiedBy?: string;
}

export interface CreatePermissionDto {
  permissionKey: string;
  permissionName: string;
  description?: string;
  category?: string;
  isActive: boolean;
}

export interface UpdatePermissionDto extends CreatePermissionDto {
  id: number;
}

export interface StoreToken {
  id: number;
  token: string;
  registrationId: string;
  storeApp: string;
  storeName?: string;
  active: boolean;
  dateCreated?: string;
  dateModified?: string;
  createdBy?: string;
  modifiedBy?: string;
}

export interface StoreTokenDropdown {
  id: number;
  registrationId: string;
  storeApp: string;
  storeName: string;
  active: boolean;
}

export interface CreateStoreTokenDto {
  registrationId: string;
  storeApp: string;
  active: boolean;
}

export interface UpdateStoreTokenDto extends CreateStoreTokenDto {
  id: number;
}

export interface TokenPermission {
  id: number;
  tokenId: number;
  permissionId: number;
  permissionKey: string;
  permissionName: string;
  isAllowed: boolean;
  dateCreated?: string;
  dateModified?: string;
  createdBy?: string;
  modifiedBy?: string;
}

export interface CreateTokenPermissionDto {
  tokenId: number;
  permissionId: number;
  isAllowed: boolean;
}

export interface UpdateTokenPermissionDto extends CreateTokenPermissionDto {
  id: number;
}

export interface BulkTokenPermissionItem {
  permissionId: number;
  isAllowed: boolean;
}

export interface BulkTokenPermissionUpdateDto {
  permissions: BulkTokenPermissionItem[];
}

export interface TokenStoreAccess {
  id: number;
  tokenId: number;
  storeApp?: string;
  storeId: string;
  storeName?: string;
  dateCreated?: string;
  dateModified?: string;
}

export interface BulkTokenStoreAccessDto {
  storeIds: string[];
}

export interface StoreDropdown {
  storeId: string;
  storeName: string;
}

export interface ApiResponse<T> {
  isSuccess: boolean;
  message: string;
  response: T;
  errors?: string[];
}

export interface PaginationResponse<T> {
  filters?: string;
  totalRecords: number;
  recordsFiltered: number;
  currentPage: number;
  pageSize: number;
  data: T[];
}

// Permission API
export const permissionApi = {
  getAll: (params: Record<string, any>) =>
    apiClient.get<ApiResponse<PaginationResponse<Permission>>>(API_ENDPOINTS.PERMISSIONS.GET_ALL, { params }),

  getById: (id: number) =>
    apiClient.get<ApiResponse<Permission>>(API_ENDPOINTS.PERMISSIONS.GET_BY_ID(id)),

  create: (dto: CreatePermissionDto) =>
    apiClient.post<ApiResponse<number>>(API_ENDPOINTS.PERMISSIONS.CREATE, dto),

  update: (id: number, dto: UpdatePermissionDto) =>
    apiClient.put<ApiResponse<boolean>>(API_ENDPOINTS.PERMISSIONS.UPDATE(id), dto),

  delete: (id: number) =>
    apiClient.delete<ApiResponse<boolean>>(API_ENDPOINTS.PERMISSIONS.DELETE(id)),

  keyExists: (key: string, excludeId?: number) =>
    apiClient.get<ApiResponse<boolean>>(API_ENDPOINTS.PERMISSIONS.KEY_EXISTS, {
      params: { key, excludeId },
    }),
};

// Token API
export const tokenApi = {
  getAll: (params: Record<string, any>) =>
    apiClient.get<ApiResponse<PaginationResponse<StoreToken>>>(API_ENDPOINTS.TOKENS.GET_ALL, { params }),

  dropdown: () =>
    apiClient.get<ApiResponse<StoreTokenDropdown[]>>(API_ENDPOINTS.TOKENS.DROPDOWN),

  getById: (id: number) =>
    apiClient.get<ApiResponse<StoreToken>>(API_ENDPOINTS.TOKENS.GET_BY_ID(id)),

  create: (dto: CreateStoreTokenDto) =>
    apiClient.post<ApiResponse<number>>(API_ENDPOINTS.TOKENS.CREATE, dto),

  update: (id: number, dto: UpdateStoreTokenDto) =>
    apiClient.put<ApiResponse<boolean>>(API_ENDPOINTS.TOKENS.UPDATE(id), dto),

  delete: (id: number) =>
    apiClient.delete<ApiResponse<boolean>>(API_ENDPOINTS.TOKENS.DELETE(id)),

  getPermissions: (tokenId: number) =>
    apiClient.get<ApiResponse<TokenPermission[]>>(API_ENDPOINTS.TOKENS.GET_PERMISSIONS(tokenId)),

  bulkUpdatePermissions: (tokenId: number, dto: BulkTokenPermissionUpdateDto) =>
    apiClient.put<ApiResponse<boolean>>(API_ENDPOINTS.TOKENS.BULK_UPDATE_PERMISSIONS(tokenId), dto),

  storesDropdown: () =>
    apiClient.get<ApiResponse<StoreDropdown[]>>(API_ENDPOINTS.TOKENS.STORES_DROPDOWN),

  tenantStores: (tokenId: number) =>
    apiClient.get<ApiResponse<StoreDropdown[]>>(API_ENDPOINTS.TOKENS.TENANT_STORES(tokenId)),

  getStoreAccess: (tokenId: number) =>
    apiClient.get<ApiResponse<TokenStoreAccess[]>>(API_ENDPOINTS.TOKENS.GET_STORE_ACCESS(tokenId)),

  bulkUpdateStoreAccess: (tokenId: number, dto: BulkTokenStoreAccessDto) =>
    apiClient.put<ApiResponse<boolean>>(API_ENDPOINTS.TOKENS.BULK_UPDATE_STORE_ACCESS(tokenId), dto),

  removeStoreAccess: (id: number) =>
    apiClient.delete<ApiResponse<boolean>>(API_ENDPOINTS.TOKENS.REMOVE_STORE_ACCESS(id)),
};

// Token Permission API
export const tokenPermissionApi = {
  getAll: (params: Record<string, any>) =>
    apiClient.get<ApiResponse<PaginationResponse<TokenPermission>>>(API_ENDPOINTS.TOKEN_PERMISSIONS.GET_ALL, { params }),

  getById: (id: number) =>
    apiClient.get<ApiResponse<TokenPermission>>(API_ENDPOINTS.TOKEN_PERMISSIONS.GET_BY_ID(id)),

  create: (dto: CreateTokenPermissionDto) =>
    apiClient.post<ApiResponse<number>>(API_ENDPOINTS.TOKEN_PERMISSIONS.CREATE, dto),

  update: (id: number, dto: UpdateTokenPermissionDto) =>
    apiClient.put<ApiResponse<boolean>>(API_ENDPOINTS.TOKEN_PERMISSIONS.UPDATE(id), dto),

  delete: (id: number) =>
    apiClient.delete<ApiResponse<boolean>>(API_ENDPOINTS.TOKEN_PERMISSIONS.DELETE(id)),
};
