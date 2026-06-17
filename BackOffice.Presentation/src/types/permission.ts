// ─── Menu types (from /api/Navigation/Menu) ───

export interface MenuScreen {
  screenId: number;
  code: string;
  name: string;
  route: string;
  icon: string;
  sortOrder: number;
}

export interface MenuModule {
  moduleId: number;
  code: string;
  name: string;
  icon: string;
  sortOrder: number;
  screens: MenuScreen[];
}

// ─── Screen-level permissions (from /api/Navigation/ScreenPermissions/{code}) ───

export interface ScreenPermissions {
  screenCode: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canExport: boolean;
  canImport: boolean;
  canPrint: boolean;
  canVoid: boolean;
  canAssign: boolean;
  canConfig: boolean;
  customActions: Record<string, boolean>;
}

// ─── Tenant Permission Ceiling (Super Admin view) ───

export interface PermissionCeilingItem {
  permissionId: number;
  permissionKey: string;
  permissionName: string;
  category: string;
  isAllowed: boolean;
}

export interface ScreenCeiling {
  screenId: number;
  screenCode: string;
  screenName: string;
  permissions: PermissionCeilingItem[];
}

export interface ModuleCeiling {
  moduleId: number;
  moduleCode: string;
  moduleName: string;
  isEnabled: boolean;
  screens: ScreenCeiling[];
}

export interface TenantPermissionCeiling {
  tenantId: number;
  tenantName: string;
  modules: ModuleCeiling[];
}

// ─── Permission Registry (module tree view) ───

export interface RegistryPermission {
  id: number;
  permissionKey: string;
  name: string;
  category: string;
  sortOrder: number;
  isActive: boolean;
  moduleId: number;
  screenId: number;
  moduleName?: string;
  screenName?: string;
}

export interface RegistryScreen {
  id: number;
  moduleId: number;
  code: string;
  name: string;
  route?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  moduleName?: string;
  permissions: RegistryPermission[];
}

export interface RegistryModule {
  moduleId: number;
  code: string;
  moduleName: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  parentModuleId?: number;
  screens: RegistryScreen[];
  children: RegistryModule[];
}

// ─── Plan management ───

export interface Plan {
  id: number;
  name: string;
  code: string;
  description: string;
  maxUsers: number;
  billingCycle: number;
  price: number;
  isActive: boolean;
  moduleIds: number[];
  dateCreated?: string;
  dateModified?: string;
}

export interface CreatePlanDto {
  name: string;
  code: string;
  description?: string;
  tier?: number | null;
  sortOrder?: number;
  maxUsers: number;
  billingCycle?: number;
  price?: number;
  isActive: boolean;
  moduleIds: number[];
}

export interface UpdatePlanDto extends CreatePlanDto {
  id: number;
}

// ─── Tenant management (Super Admin) ───

export interface TenantListItem {
  id: number;
  customerName: string;
  email: string;
  planId: number | null;
  planName: string;
  maxConcurrentUsers: number;
  expiresAt: string | null;
  isActive: boolean;
  dateCreated?: string;
}

// ─── Tenant Role management (Tenant Admin) ───

export interface TenantRole {
  id: number;
  name: string;
  code: string;
  description: string;
  isSystemRole: boolean;
  isActive: boolean;
  createdAt?: string;
  userCount?: number;
  permissionCount?: number;
}

export interface CreateTenantRoleDto {
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}

export interface UpdateTenantRoleDto extends CreateTenantRoleDto {
  id: number;
  isSystemRole?: boolean;
}

// Flat permission item used by the UI for toggling
export interface TenantRolePermissionItem {
  permissionId: number;
  permissionKey: string;
  permissionName: string;
  category: string;
  screenName: string;
  moduleName: string;
  isGranted: boolean;
  isInCeiling: boolean;
}

// Structured response from GET /api/TenantRbac/Roles/{id}/PermissionMatrix
export interface PermMatrixItemDto {
  permissionId: number;
  permissionKey: string;
  permissionName: string;
  category: string;
  isGranted: boolean;
  isInCeiling: boolean;
}

export interface PermMatrixScreenDto {
  screenId: number;
  screenCode: string;
  screenName: string;
  permissions: PermMatrixItemDto[];
}

export interface PermMatrixModuleDto {
  moduleId: number;
  moduleCode: string;
  moduleName: string;
  screens: PermMatrixScreenDto[];
}

export interface TenantRolePermissionMatrix {
  roleId: number;
  roleName: string;
  modules: PermMatrixModuleDto[];
}

// ─── User Role assignment ───

export interface UserRoleAssignment {
  roleId: number;
  roleName: string;
  roleCode: string;
  isAssigned: boolean;
}

export interface UserBasicInfo {
  userId: number;
  username: string;
  email: string;
}

// ─── Tenant Module / Permission update DTOs ───

export interface UpdateTenantModulesDto {
  tenantId: number;
  moduleIds: number[];
}

export interface UpdateTenantPermissionsDto {
  tenantId: number;
  permissions: { permissionId: number; isAllowed: boolean }[];
}

// Backend expects List<RbacRolePermissionItem> directly (not wrapped)
export interface RbacRolePermissionItem {
  permissionKey: string;
  isGranted: boolean;
}

export interface UpdateRolePermissionsDto {
  permissions: TenantRolePermissionItem[];
}

export interface AssignUserRolesDto {
  userId: number;
  roleIds: number[];
}

// ─── User-Tenant Assignment (Super Admin) ───

export interface UserTenantAssignmentItem {
  id: number;
  userId: number;
  customerId: number;
  customerName: string;
  email: string;
  assignedAt: string;
}

export interface TenantLookupItem {
  customerId: number;
  customerName: string;
  email: string;
  isAssigned: boolean;
}

export interface AssignTenantsToUserDto {
  userId: number;
  customerIds: number[];
}
