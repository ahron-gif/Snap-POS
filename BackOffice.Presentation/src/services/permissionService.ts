import apiClient from '../lib/axios';
import type {
  MenuModule,
  ScreenPermissions,
  TenantPermissionCeiling,
  RegistryModule,
  RegistryPermission,
  Plan,
  CreatePlanDto,
  UpdatePlanDto,
  TenantRole,
  CreateTenantRoleDto,
  UpdateTenantRoleDto,
  TenantRolePermissionMatrix,
  RbacRolePermissionItem,
  UpdateTenantModulesDto,
  UpdateTenantPermissionsDto,
  AssignUserRolesDto,
  UserRoleAssignment,
  TenantListItem,
  TenantLookupItem,
  UserTenantAssignmentItem,
  AssignTenantsToUserDto,
} from '../types/permission';
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

// ─── Navigation / Runtime Permission APIs ───

export const permissionService = {
  // Get the dynamic menu tree for the current user
  // Backend returns NavigationMenuDto { modules: MenuModule[] }
  getMenu: () =>
    apiClient.get<ApiResponse<{ modules: MenuModule[] }>>('/api/Navigation/Menu'),

  // Get screen-level permissions for a specific screen
  getScreenPermissions: (screenCode: string) =>
    apiClient.get<ApiResponse<ScreenPermissions>>(`/api/Navigation/ScreenPermissions/${screenCode}`),

  // Get all effective permission keys for the current user
  getMyPermissions: () =>
    apiClient.get<ApiResponse<string[]>>('/api/Navigation/MyPermissions'),

  // ─── Super Admin: Plan Management ───

  getPlans: (params: Record<string, string | number | boolean>) =>
    apiClient.get<ApiResponse<PaginationResponse<Plan>>>('/api/Plan', { params }),

  createPlan: (data: CreatePlanDto) =>
    apiClient.post<ApiResponse<number>>('/api/Plan', data),

  updatePlan: (id: number, data: UpdatePlanDto) =>
    apiClient.put<ApiResponse<boolean>>(`/api/Plan/${id}`, data),

  deletePlan: (id: number) =>
    apiClient.delete<ApiResponse<boolean>>(`/api/Plan/${id}`),

  // ─── Super Admin: Permission Registry ───

  getModuleTree: () =>
    apiClient.get<ApiResponse<RegistryModule[]>>('/api/PermissionRegistry/Modules/Tree'),

  /** Get module by name (from header); returns ModuleId for use when saving a screen. */
  getModuleByName: (moduleName: string) =>
    apiClient.get<ApiResponse<{ moduleId: number; moduleName: string; code: string }>>(
      '/api/PermissionRegistry/ModuleByName',
      { params: { name: moduleName } }
    ),

  getAllPermissions: () =>
    apiClient.get<ApiResponse<RegistryPermission[]>>('/api/PermissionRegistry/Permissions'),

  createScreen: (data: {
    moduleId: number;
    code: string;
    name: string;
    route?: string;
    icon?: string;
    sortOrder: number;
  }) =>
    apiClient.post<ApiResponse<number>>('/api/PermissionRegistry/Screens', data),

  updateScreen: (
    id: number,
    data: {
      moduleId: number;
      code: string;
      name: string;
      route?: string | null;
      icon?: string | null;
      sortOrder: number;
      isActive: boolean;
    }
  ) =>
    // Backend expects UpdateScreenDto with Id; ModuleId in body for DTO validity, backend keeps entity.ModuleId unchanged
    apiClient.put<ApiResponse<boolean>>(
      `/api/PermissionRegistry/Screens/${id}`,
      { ...data, id }
    ),

  createPermission: (data: {
    moduleId: number;
    screenId: number;
    permissionKey: string;
    name: string;
    category?: string;
    sortOrder: number;
  }) =>
    apiClient.post<ApiResponse<number>>('/api/PermissionRegistry/Permissions', data),

  updatePermission: (
    id: number,
    data: {
      moduleId: number;
      screenId: number;
      permissionKey: string;
      name: string;
      category?: string;
      sortOrder: number;
      isActive: boolean;
    }
  ) =>
    // Backend expects UpdatePermissionDto with Id property matching route id
    apiClient.put<ApiResponse<boolean>>(
      `/api/PermissionRegistry/Permissions/${id}`,
      { ...data, id }
    ),

  // ─── Super Admin: Tenant Permission Ceiling ───

  getTenantCeiling: (tenantId: number) =>
    apiClient.get<ApiResponse<TenantPermissionCeiling>>(`/api/TenantPermission/${tenantId}/Ceiling`),

  updateTenantModules: (data: UpdateTenantModulesDto) =>
    apiClient.put<ApiResponse<boolean>>('/api/TenantPermission/Modules', data),

  updateTenantPermissions: (data: UpdateTenantPermissionsDto) =>
    apiClient.put<ApiResponse<boolean>>('/api/TenantPermission/Permissions', data),

  enableAllForTenant: (tenantId: number) =>
    apiClient.post<ApiResponse<boolean>>(`/api/TenantPermission/${tenantId}/EnableAll`),

  // Initialize Customer Admin role with all ceiling permissions
  initializeTenantAdmin: (tenantId: number, adminUserId?: number) =>
    apiClient.post<ApiResponse<boolean>>('/api/TenantRbac/InitializeAdmin', {
      tenantId,
      adminUserId: adminUserId ?? null,
    }),

  // ─── Super Admin: Tenant list (Master DB Customers) ───

  getTenants: (params: Record<string, string | number | boolean>) =>
    apiClient.get<ApiResponse<PaginationResponse<TenantListItem>>>('/api/SuperAdmin/Tenants', { params }),

  // ─── Tenant Admin: Role Management ───

  getTenantRoles: (params: Record<string, string | number | boolean>) =>
    apiClient.get<ApiResponse<PaginationResponse<TenantRole>>>('/api/TenantRbac/Roles', { params }),

  createTenantRole: (data: CreateTenantRoleDto) =>
    apiClient.post<ApiResponse<number>>('/api/TenantRbac/Roles', data),

  // Inline duplicate-code check fired by the Add/Edit Role modal as the user types.
  tenantRoleCodeExists: (code: string, excludeId?: number) =>
    apiClient.get<ApiResponse<boolean>>('/api/TenantRbac/Roles/CodeExists', {
      params: excludeId !== undefined ? { code, excludeId } : { code },
    }),

  updateTenantRole: (id: number, data: UpdateTenantRoleDto) =>
    apiClient.put<ApiResponse<boolean>>(`/api/TenantRbac/Roles/${id}`, data),

  deleteTenantRole: (id: number) =>
    apiClient.delete<ApiResponse<boolean>>(`/api/TenantRbac/Roles/${id}`),

  getRolePermMatrix: (roleId: number) =>
    apiClient.get<ApiResponse<TenantRolePermissionMatrix>>(`/api/TenantRbac/Roles/${roleId}/PermissionMatrix`),

  // Backend expects List<RbacRolePermissionItem> directly (raw array, not wrapped)
  updateRolePermissions: (roleId: number, data: RbacRolePermissionItem[]) =>
    apiClient.put<ApiResponse<boolean>>(`/api/TenantRbac/Roles/${roleId}/Permissions`, data),

  // ─── Tenant Admin: User Role Assignment ───

  getUserRoles: (userId: number) =>
    apiClient.get<ApiResponse<UserRoleAssignment[]>>(`/api/TenantRbac/Users/${userId}/Roles`),

  assignUserRoles: (userId: number, data: AssignUserRolesDto) =>
    apiClient.put<ApiResponse<boolean>>(`/api/TenantRbac/Users/${userId}/Roles`, data),

  // ─── Super Admin: User-Tenant Assignment ───

  getUserTenantAssignments: (userId: number) =>
    apiClient.get<ApiResponse<TenantLookupItem[]>>(`/api/SuperAdmin/Users/${userId}/Tenants`),

  assignTenantsToUser: (userId: number, data: AssignTenantsToUserDto) =>
    apiClient.put<ApiResponse<boolean>>(`/api/SuperAdmin/Users/${userId}/Tenants`, data),

  getMyAssignedTenants: () =>
    apiClient.get<ApiResponse<UserTenantAssignmentItem[]>>('/api/SuperAdmin/MyTenants'),
};
