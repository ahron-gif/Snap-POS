import apiClient from '../lib/axios';

export interface ApiResponse<T> {
  isSuccess: boolean;
  statusCode: number;
  message: string;
  response: T;
  errors?: object;
}

export interface PaginationResponse<T> {
  filters?: string;
  totalRecords: number;
  recordsFiltered: number;
  currentPage: number;
  pageSize: number;
  data: T[];
}

export interface CustomDateScope {
  customDateScopeID: string;
  name: string;
  description: string | null;
  fromDate: string;
  toDate: string;
  /** @deprecated Kept for backward compatibility — server still emits the field. */
  sortColumn: string | null;
  /** @deprecated Replaced by `sortOrder`. Server still emits for compat. */
  sortDirection: string | null;
  /** 1-based position in the saved-scope list. Maintained server-side. */
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  modifiedAt: string | null;
}

export interface CreateCustomDateScopeDto {
  name: string;
  description?: string | null;
  fromDate: string; // ISO yyyy-mm-dd
  toDate: string;
  isActive: boolean;
  // SortOrder is assigned server-side on create (max+1 among active rows).
}

export interface UpdateCustomDateScopeDto {
  customDateScopeID: string;
  name: string;
  description?: string | null;
  fromDate: string;
  toDate: string;
  isActive: boolean;
  /**
   * Optional. When provided and different from the entity's current sortOrder,
   * the server shifts neighbouring rows so the active set stays a contiguous
   * 1..N sequence with no gaps or duplicates.
   */
  sortOrder?: number;
}

const base = '/api/CustomDateScope';

export const customDateScopeService = {
  getPaged: (params: Record<string, string | number | boolean>) =>
    apiClient.get<ApiResponse<PaginationResponse<CustomDateScope>>>(base, { params }),

  getActive: () =>
    apiClient.get<ApiResponse<CustomDateScope[]>>(`${base}/active`),

  getById: (id: string) =>
    apiClient.get<ApiResponse<CustomDateScope>>(`${base}/${id}`),

  create: (dto: CreateCustomDateScopeDto) =>
    apiClient.post<ApiResponse<string>>(base, dto),

  update: (id: string, dto: UpdateCustomDateScopeDto) =>
    apiClient.put<ApiResponse<boolean>>(`${base}/${id}`, dto),

  delete: (id: string) =>
    apiClient.delete<ApiResponse<boolean>>(`${base}/${id}`),

  /**
   * Soft-deletes a batch of scopes in one round-trip. The server runs the
   * deletes + SortOrder compaction inside a single transaction so the
   * surviving active rows stay 1..N contiguous. Returns the count actually
   * deleted (already-inactive ids are silently skipped).
   */
  bulkDelete: (ids: string[]) =>
    apiClient.delete<ApiResponse<number>>(`${base}/bulk`, { data: ids }),
};
