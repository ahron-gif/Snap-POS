import React, { useState, useCallback, useEffect, useMemo, useRef } from "react"
import Button from "../../components/ui/button/Button"
import Input from "../../components/form/input/InputField"
import Label from "../../components/form/Label"
import MultiSelect from "../../components/form/MultiSelect"
import SearchableSelect from "../../components/form/SearchableSelect"
import Checkbox from "../../components/form/input/Checkbox"
import GroupImportModal from "./GroupImportModal"
import { useDashboardTabs } from "../../context/DashboardTabContext"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { getAuthHeadersWithCustomerId } from "../../utils/auth"
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges"
import { useTabFormCacheRead, useTabFormCacheWrite } from "../../hooks/useTabFormCache"
import { API_ENDPOINTS } from "../../constants/api"
import { focusFirstInvalid } from "../../hooks/useFocusFirstInvalid"
import { environmentService, type EnvironmentDto } from "../../services/environmentService"
import { permissionService } from "../../services/permissionService"
import type { UserRoleAssignment, TenantLookupItem } from "../../types/permission"
import { useAuth } from "../../context/AuthContext"
import apiClient from "../../lib/axios"

interface UserFormPageProps {
  id?: string
  isNew?: boolean
  tenantCustomerId?: number
  /** Injected by DashboardTabContent */
  __tabId?: string
}

interface UserFormData {
  userName: string
  password: string
  userFName: string
  userLName: string
  address: string
  homePhoneNumber: string
  workPhoneNumber: string
  fax: string
  email: string
  zipCode: string
  isSuperAdmin: boolean
}

interface StoreLookup {
  storeID: string
  storeName: string
}

interface GroupLookup {
  groupID: string
  groupName: string
}

// `keyof UserFormData` covers the input fields; the extra string-key entries
// (`roles`, `tenants`, `stores`, `defaultStore`) are added at runtime by
// validateAllFields for the role/tenant/store assignment lists which live
// outside `formData` but still need error display.
type FieldErrors = Partial<Record<keyof UserFormData, string>> & {
  roles?: string
  tenants?: string
  stores?: string
  defaultStore?: string
}

const initialFormData: UserFormData = {
  userName: "",
  password: "",
  userFName: "",
  userLName: "",
  address: "",
  homePhoneNumber: "",
  workPhoneNumber: "",
  fax: "",
  email: "",
  zipCode: "",
  isSuperAdmin: false,
}

// A checkbox list of roles, optionally headed by a tenant name (per-tenant blocks).
const RoleChecklist: React.FC<{
  title?: string
  subtitle?: string
  roles: UserRoleAssignment[]
  loading?: boolean
  onToggle: (roleId: number) => void
  emptyText?: string
}> = ({ title, subtitle, roles, loading, onToggle, emptyText }) => {
  const assignedCount = roles.filter((r) => r.isAssigned).length
  return (
    <div className="border-t border-gray-100 dark:border-gray-700 first:border-t-0">
      {title && (
        <div className="px-5 py-2 bg-gray-50 dark:bg-gray-800/60 flex items-center justify-between sticky top-0 z-10">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">{title}</p>
            {subtitle && <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>}
          </div>
          {!loading && <span className="text-[11px] text-gray-500 whitespace-nowrap">{assignedCount}/{roles.length}</span>}
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-500" />
          <span className="ml-2 text-xs text-gray-500">Loading roles…</span>
        </div>
      ) : roles.length === 0 ? (
        <div className="py-6 text-center text-xs text-gray-400">{emptyText ?? "No roles available."}</div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {roles.map((role) => (
            <label
              key={role.roleId}
              className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
              <input
                type="checkbox"
                checked={role.isAssigned}
                onChange={() => onToggle(role.roleId)}
                className="rounded border-gray-300 text-brand-500 focus:ring-brand-500 w-4 h-4"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{role.roleName}</p>
                {role.roleCode && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">{role.roleCode}</p>
                )}
              </div>
              {role.isAssigned && (
                <span className="text-[10px] px-1.5 py-0.5 bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 rounded-full font-medium">
                  Assigned
                </span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

const UserFormPage: React.FC<UserFormPageProps> = ({ id, isNew, tenantCustomerId, __tabId }) => {
  const { openTab, closeTab, activeTabId } = useDashboardTabs()
  const { getAuthHeaders } = useAuthHeaders()
  const { isSuperAdmin } = useAuth()
  const isSuperAdminUser = isSuperAdmin()
  const isEditMode = !!id && !isNew

  const getTenantHeaders = useCallback(() => {
    const headers = getAuthHeaders()
    if (tenantCustomerId) {
      headers["CustomerId"] = tenantCustomerId.toString()
    }
    return headers
  }, [getAuthHeaders, tenantCustomerId])

  const getTenantHeadersRef = useRef(getTenantHeaders)
  getTenantHeadersRef.current = getTenantHeaders

  // ── Per-tab cache: preserves state across tab switches (in-memory only) ──
  // Cache covers every editable piece (formData, selection sets, role/tenant
  // assignments) so closing/reopening a tab via switch doesn't lose edits.
  // The `savedSnapshot` is also cached to keep the dirty diff accurate.
  // Lookups (stores, groups, envs) are intentionally NOT cached — they're
  // catalog data and may have changed in the meantime; they re-fetch on mount.
  interface UserFormCache {
    formData: UserFormData
    savedSnapshot: UserSnapshotShape | null
    selectedStoreIds: string[]
    defaultStoreId: string
    groupId: string
    selectedEnvIds: string[]
    hasWebAccess: boolean
    userRoles: UserRoleAssignment[]
    rolesByTenant: Record<number, UserRoleAssignment[]>
    tenantAssignments: TenantLookupItem[]
    dataLoaded: boolean
    // Numeric user id resolved from the GET-by-id response — needed for Send
    // Invite (the tab is opened with the GUID localUserId, not this id). Cached
    // so the action stays available after a tab switch (which skips the fetch).
    inviteUserId: number | null
  }
  // Local alias matching the in-file UserSnapshot type defined below — TS
  // wants both the alias and the type to agree, so we reference the same fields.
  type UserSnapshotShape = {
    formData: UserFormData
    selectedStoreIds: string[]
    defaultStoreId: string
    groupId: string
    selectedEnvIds: string[]
    hasWebAccess: boolean
    assignedRoleIds: string[]
    rolesByTenantKey: string
    assignedTenantIds: (string | number)[]
  }
  const { initial: cachedTabState, hasCachedState } =
    useTabFormCacheRead<UserFormCache>(__tabId)

  const [formData, setFormData] = useState<UserFormData>(
    () => cachedTabState?.formData ?? initialFormData,
  )
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(() => cachedTabState?.dataLoaded ?? false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  // Numeric user id for Send Invite, resolved from the GET-by-id response.
  const [inviteUserId, setInviteUserId] = useState<number | null>(
    () => cachedTabState?.inviteUserId ?? null,
  )
  const [toast, setToast] = useState<{
    show: boolean
    message: string
    type: "success" | "error" | "info"
  }>({
    show: false,
    message: "",
    type: "success",
  })

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const [stores, setStores] = useState<StoreLookup[]>([])
  const [groups, setGroups] = useState<GroupLookup[]>([])
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>(
    () => cachedTabState?.selectedStoreIds ?? [],
  )
  const [defaultStoreId, setDefaultStoreId] = useState<string>(
    () => cachedTabState?.defaultStoreId ?? "",
  )
  const [groupId, setGroupId] = useState<string>(() => cachedTabState?.groupId ?? "")
  const [lookupsLoading, setLookupsLoading] = useState(false)

  // ── Environment Access ──────────────────────────────────────────────────────
  const [environments, setEnvironments] = useState<EnvironmentDto[]>([])
  const [selectedEnvIds, setSelectedEnvIds] = useState<string[]>(
    () => cachedTabState?.selectedEnvIds ?? [],
  )
  const [hasWebAccess, setHasWebAccess] = useState<boolean>(
    () => cachedTabState?.hasWebAccess ?? true,
  )
  const [envsLoading, setEnvsLoading] = useState(false)

  // ── User Roles ─────────────────────────────────────────────────────────────
  const [userRoles, setUserRoles] = useState<UserRoleAssignment[]>(
    () => cachedTabState?.userRoles ?? [],
  )
  const [userRolesLoading, setUserRolesLoading] = useState(false)
  // Quick "Import Groups as roles" shortcut from the Roles section.
  const [groupImportOpen, setGroupImportOpen] = useState(false)
  // Captured in edit-mode so the post-import refresh can re-query the right user's roles.
  const mainUserIdRef = useRef<number | null>(null)
  // Per-tenant roles (Super Admin creating a normal user). rolesByTenant[customerId]
  // = that tenant's roles + isAssigned flags, loaded/saved with that tenant's header.
  const [rolesByTenant, setRolesByTenant] = useState<Record<number, UserRoleAssignment[]>>(
    () => cachedTabState?.rolesByTenant ?? {},
  )
  const [rolesLoadingTenants, setRolesLoadingTenants] = useState<Set<number>>(new Set())
  // Tenants we've already kicked off a load for (avoids re-loading every render).
  // Seeded from cached tenants so a tab-switch back doesn't refetch and wipe toggles.
  const loadedTenantsRef = useRef<Set<number>>(
    new Set(Object.keys(cachedTabState?.rolesByTenant ?? {}).map(Number)),
  )

  // Load roles into the flat `userRoles` list — default tenant context (tenant admin)
  // or an explicit tenant. preserveToggles keeps the user's unsaved checkbox state.
  const fetchRolesForTenant = useCallback(
    async (userId: number, customerId: number | null, preserveToggles = false) => {
      setUserRolesLoading(true)
      try {
        let roles: UserRoleAssignment[] = []
        if (customerId) {
          const res = await fetch(API_ENDPOINTS.TENANT_RBAC.USER_ROLES(userId), {
            headers: getAuthHeadersWithCustomerId(customerId),
          })
          const body = await res.json()
          if (body.isSuccess) roles = body.response ?? []
        } else {
          const res = await permissionService.getUserRoles(userId)
          if (res.data.isSuccess) roles = res.data.response
        }
        setUserRoles((prev) => {
          if (!preserveToggles) return roles
          const prevById = new Map(prev.map((r) => [r.roleId, r.isAssigned]))
          return roles.map((r) => ({ ...r, isAssigned: prevById.get(r.roleId) ?? r.isAssigned }))
        })
      } catch {
        /* roles may be unavailable */
      } finally {
        setUserRolesLoading(false)
      }
    },
    [],
  )

  // Load roles for one assigned tenant into rolesByTenant[customerId], preserving toggles.
  const loadTenantRoles = useCallback(async (customerId: number, userId: number) => {
    setRolesLoadingTenants((prev) => new Set(prev).add(customerId))
    try {
      const res = await fetch(API_ENDPOINTS.TENANT_RBAC.USER_ROLES(userId), {
        headers: getAuthHeadersWithCustomerId(customerId),
      })
      const body = await res.json()
      const roles: UserRoleAssignment[] = body.isSuccess ? (body.response ?? []) : []
      setRolesByTenant((prev) => {
        const existing = prev[customerId]
        const merged = existing
          ? roles.map((r) => {
              const e = existing.find((x) => x.roleId === r.roleId)
              return e ? { ...r, isAssigned: e.isAssigned } : r
            })
          : roles
        return { ...prev, [customerId]: merged }
      })
    } catch {
      /* ignore */
    } finally {
      setRolesLoadingTenants((prev) => {
        const n = new Set(prev)
        n.delete(customerId)
        return n
      })
    }
  }, [])

  // Reload the affected tenant's roles after a group import (per-tenant block, or the
  // flat list when customerId is null).
  const refreshRolesForTenant = useCallback(
    (customerId: number | null) => {
      const userId = isEditMode ? (mainUserIdRef.current ?? 0) : 0
      if (customerId != null) loadTenantRoles(customerId, userId)
      else fetchRolesForTenant(userId, null, true)
    },
    [isEditMode, loadTenantRoles, fetchRolesForTenant],
  )

  // ── Derived: is the NEW USER (being edited/created) a super-admin? ──────
  // Reads directly from `formData.isSuperAdmin` — the persisted boolean on
  // the user record that controls platform-wide super-admin status. The UI
  // exposes this via a Super Admin toggle (super-admin operators only); when
  // true, the tenant + store required rules are skipped because super-admin
  // users have implicit platform access. Decoupled from the RBAC tenant role
  // list — those are permissions within a tenant, this is a user-level flag.
  const newUserIsSuperAdmin = !!formData.isSuperAdmin
  // A Super Admin creating a NORMAL user assigns roles per assigned tenant (Phase 2).
  // Tenant admins and platform-wide super-admin users use the flat `userRoles` list.
  const usePerTenantRoles = isSuperAdminUser && !newUserIsSuperAdmin

  const clearRolesError = useCallback(() => {
    setFieldErrors((prev) => {
      if (!prev.roles) return prev
      const next = { ...prev }
      delete next.roles
      return next
    })
  }, [])
  const toggleUserRole = useCallback((roleId: number) => {
    setUserRoles((prev) => prev.map((r) => (r.roleId === roleId ? { ...r, isAssigned: !r.isAssigned } : r)))
    clearRolesError()
  }, [clearRolesError])
  const toggleTenantRole = useCallback((customerId: number, roleId: number) => {
    setRolesByTenant((prev) => ({
      ...prev,
      [customerId]: (prev[customerId] ?? []).map((r) => (r.roleId === roleId ? { ...r, isAssigned: !r.isAssigned } : r)),
    }))
    clearRolesError()
  }, [clearRolesError])

  // ── Tenant Assignments (super admin only) ──────────────────────────────────
  const [tenantAssignments, setTenantAssignments] = useState<TenantLookupItem[]>(
    () => cachedTabState?.tenantAssignments ?? [],
  )
  const [tenantsLoading, setTenantsLoading] = useState(false)
  const hasLoadedOnceRef = useRef(hasCachedState)

  // Platform-wide (Super Admin) users keep the default-context role list (the tenant
  // section is hidden for them; a role is still required by validation).
  useEffect(() => {
    if (isSuperAdminUser && newUserIsSuperAdmin) {
      fetchRolesForTenant(isEditMode ? (mainUserIdRef.current ?? 0) : 0, null, false)
    }
  }, [isSuperAdminUser, newUserIsSuperAdmin, isEditMode, fetchRolesForTenant])

  // Per-tenant roles: for each tenant checked in Tenant Assignments load that tenant's
  // roles (from its own DB); prune tenants that get unchecked. Roles are assigned and
  // saved per tenant.
  useEffect(() => {
    if (!usePerTenantRoles) return
    const userId = isEditMode ? (mainUserIdRef.current ?? 0) : 0
    const assigned = tenantAssignments.filter((t) => t.isAssigned).map((t) => t.customerId)
    const assignedSet = new Set(assigned)
    for (const id of Array.from(loadedTenantsRef.current)) {
      if (!assignedSet.has(id)) loadedTenantsRef.current.delete(id)
    }
    setRolesByTenant((prev) => {
      const next: Record<number, UserRoleAssignment[]> = {}
      assigned.forEach((id) => { if (prev[id]) next[id] = prev[id] })
      return next
    })
    assigned.forEach((id) => {
      if (!loadedTenantsRef.current.has(id)) {
        loadedTenantsRef.current.add(id)
        loadTenantRoles(id, userId)
      }
    })
  }, [usePerTenantRoles, tenantAssignments, isEditMode, loadTenantRoles])

  // ── Unsaved-changes snapshot aggregation ──────────────────────────────────
  // Aggregates every persisted field (formData + selected stores + roles +
  // env access + tenant assignments) into one object so the hook can diff it.
  // TODO(unsaved-changes): `password` is part of formData; changes to the
  // password field will flag the tab dirty (expected), but an edit-mode form
  // loaded with an empty password and then typed-into will flag dirty even if
  // the user cancels their entry. This mirrors every other field and is
  // acceptable.
  type UserSnapshot = UserSnapshotShape
  const [savedSnapshot, setSavedSnapshot] = useState<UserSnapshot | null>(
    () => cachedTabState?.savedSnapshot ?? null,
  )

  // Mirror state into the per-tab cache so tab switches don't wipe edits.
  useTabFormCacheWrite<UserFormCache>(
    __tabId,
    hasLoadedOnceRef.current
      ? {
          formData,
          savedSnapshot,
          selectedStoreIds,
          defaultStoreId,
          groupId,
          selectedEnvIds,
          hasWebAccess,
          userRoles,
          rolesByTenant,
          tenantAssignments,
          dataLoaded,
          inviteUserId,
        }
      : null,
  )

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      setToast({ show: true, message, type })
      setTimeout(
        () => setToast({ show: false, message: "", type: "success" }),
        3000
      )
    },
    []
  )

  const validateField = useCallback(
    (field: keyof UserFormData, value: string | boolean): string => {
      const strVal = typeof value === "string" ? value : ""
      switch (field) {
        case "userName":
          if (!strVal.trim()) return "User name is required"
          if (strVal.length > 50) return "User name cannot exceed 50 characters"
          return ""
        case "password":
          if (!isEditMode && !strVal.trim()) return "Password is required"
          if (strVal && strVal.length < 6) return "Password must be at least 6 characters"
          return ""
        case "userFName":
          if (strVal.length > 50) return "First name cannot exceed 50 characters"
          return ""
        case "userLName":
          if (strVal.length > 50) return "Last name cannot exceed 50 characters"
          return ""
        case "email":
          if (!strVal.trim()) return "Email is required"
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal))
            return "Invalid email format"
          return ""
        case "address":
          if (strVal.length > 4000) return "Address cannot exceed 4000 characters"
          return ""
        case "homePhoneNumber":
          if (strVal.length > 50) return "Home phone cannot exceed 50 characters"
          return ""
        case "workPhoneNumber":
          if (strVal.length > 50) return "Work phone cannot exceed 50 characters"
          return ""
        case "fax":
          if (strVal.length > 50) return "Fax cannot exceed 50 characters"
          return ""
        case "zipCode":
          if (strVal.length > 50) return "Zip code cannot exceed 50 characters"
          return ""
        default:
          return ""
      }
    },
    [isEditMode]
  )

  const validateAllFields = useCallback((): boolean => {
    const errors: FieldErrors = {}
    const fieldsToValidate: (keyof UserFormData)[] = [
      "userName", "password", "userFName", "userLName", "email",
      "address", "homePhoneNumber", "workPhoneNumber", "fax", "zipCode",
    ]
    for (const field of fieldsToValidate) {
      const error = validateField(field, formData[field])
      if (error) errors[field] = error
    }

    // ── New role/tenant/store required-field rules ─────────────────────────
    // Role is always required. Tenant + store are required only if the user
    // is NOT a super-admin (derived from selected roles via newUserIsSuperAdmin).
    if (usePerTenantRoles) {
      // Each assigned tenant must have at least one role.
      const assigned = tenantAssignments.filter((t) => t.isAssigned)
      const missing = assigned.filter((t) => !(rolesByTenant[t.customerId] ?? []).some((r) => r.isAssigned))
      if (assigned.length > 0 && missing.length > 0) {
        errors.roles = `Select at least one role for: ${missing.map((t) => t.customerName).join(", ")}.`
      }
    } else if (!userRoles.some((r) => r.isAssigned)) {
      errors.roles = "At least one role must be selected."
    }
    if (!newUserIsSuperAdmin) {
      // Tenant assignment is only relevant when the operator is a super-admin
      // (otherwise the tenant section isn't rendered and tenantAssignments is
      // empty by default). For super-admin operators creating a non-super-admin
      // user, at least one tenant must be picked.
      if (isSuperAdminUser) {
        const hasAtLeastOneTenant = tenantAssignments.some((t) => t.isAssigned)
        if (!hasAtLeastOneTenant) {
          errors.tenants = "At least one tenant must be assigned."
        }
      }
      if (selectedStoreIds.length === 0) {
        errors.stores = "At least one store must be assigned."
      }
      if (selectedStoreIds.length > 0 && !defaultStoreId) {
        errors.defaultStore = "A default store must be selected."
      }
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [
    formData,
    validateField,
    userRoles,
    rolesByTenant,
    usePerTenantRoles,
    tenantAssignments,
    selectedStoreIds,
    defaultStoreId,
    newUserIsSuperAdmin,
    isSuperAdminUser,
  ])

  const handleChange = useCallback(
    (field: keyof UserFormData, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
      const error = validateField(field, value)
      setFieldErrors((prev) => {
        const next = { ...prev }
        if (error) {
          next[field] = error
        } else {
          delete next[field]
        }
        return next
      })
    },
    [validateField]
  )

  const goBackToList = useCallback(() => {
    if (activeTabId) {
      closeTab(activeTabId)
    }
    openTab({
      component: "UsersListPage",
      title: "Users",
      closable: true,
    })
  }, [activeTabId, closeTab, openTab])

  useEffect(() => {
    const fetchLookups = async () => {
      setLookupsLoading(true)
      setEnvsLoading(true)
      setUserRolesLoading(true)
      try {
        const headers = getTenantHeadersRef.current()
        const [storesRes, groupsRes, envsData] = await Promise.all([
          apiClient.get(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_ALL_STORES, { headers }),
          apiClient.get(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_GROUPS, { headers }),
          environmentService.getAll(headers),
        ])

        const storesData = storesRes.data
        if (storesData?.isSuccess || storesData?.IsSuccess) {
          const storeList = storesData.response ?? storesData.Response ?? []
          setStores(storeList.map((s: Record<string, unknown>) => ({
            storeID: (s.storeID ?? s.StoreID ?? "") as string,
            storeName: (s.storeName ?? s.StoreName ?? "") as string,
          })))
        }

        const groupsData = groupsRes.data
        if (groupsData?.isSuccess || groupsData?.IsSuccess) {
          const groupList = groupsData.response ?? groupsData.Response ?? []
          setGroups(groupList.map((g: Record<string, unknown>) => ({
            groupID: (g.groupID ?? g.GroupID ?? "") as string,
            groupName: (g.groupName ?? g.GroupName ?? "") as string,
          })))
        }

        setEnvironments(envsData.filter((e) => e.isActive))
      } catch {
        showToast("Failed to load stores/groups/environments", "error")
      } finally {
        setLookupsLoading(false)
        setEnvsLoading(false)
      }
    }

    fetchLookups()
  }, [])

  useEffect(() => {
    if (isEditMode) return
    // Cache hit on new tab: state restored via useState initializers; skip
    // the role/tenant fetch (they were also restored) and flag loaded.
    if (hasCachedState) {
      hasLoadedOnceRef.current = true
      return
    }
    const loadNewUserData = async () => {
      // Tenant admins load roles from their own tenant immediately. Super Admins
      // load roles only after a single tenant is chosen (see the effect below).
      if (!isSuperAdminUser) {
        setUserRolesLoading(true)
        try {
          const rolesRes = await permissionService.getUserRoles(0)
          if (rolesRes.data.isSuccess) {
            setUserRoles(rolesRes.data.response)
          }
        } catch {
          // Roles may not be available
        } finally {
          setUserRolesLoading(false)
        }
      }

      if (isSuperAdminUser) {
        setTenantsLoading(true)
        try {
          const tenantsRes = await permissionService.getUserTenantAssignments(0)
          if (tenantsRes.data.isSuccess) {
            setTenantAssignments(tenantsRes.data.response)
          }
        } catch {
          // Tenants may not be available
        } finally {
          setTenantsLoading(false)
        }
      }
      hasLoadedOnceRef.current = true
    }
    loadNewUserData()
  }, [isEditMode, isSuperAdminUser, hasCachedState])

  useEffect(() => {
    if (!isEditMode || !id) return
    // Per-tab cache hit: every editable piece was restored via useState
    // initializers (formData, selections, env access, roles, tenants, saved
    // snapshot, dataLoaded). Skip the fetch chain — re-fetching would replace
    // the user's in-progress edits.
    if (hasCachedState) {
      hasLoadedOnceRef.current = true
      return
    }

    const fetchUser = async () => {
      setLoading(true)
      setDataLoaded(false)
      try {
        const response = await apiClient.get(
          API_ENDPOINTS.USERS.GET_USER_BY_ID(id),
          { headers: getTenantHeadersRef.current() }
        )

        const apiData = response.data
        if (apiData?.isSuccess || apiData?.IsSuccess) {
          const user = apiData.response ?? apiData.Response
          if (user) {
            setFormData({
              userName: user.userName ?? user.UserName ?? "",
              password: "",
              userFName: user.userFName ?? user.UserFName ?? "",
              userLName: user.userLName ?? user.UserLName ?? "",
              address: user.address ?? user.Address ?? "",
              homePhoneNumber: user.homePhoneNumber ?? user.HomePhoneNumber ?? "",
              workPhoneNumber: user.workPhoneNumber ?? user.WorkPhoneNumber ?? "",
              fax: user.fax ?? user.Fax ?? "",
              email: user.email ?? user.Email ?? "",
              zipCode: user.zipCode ?? user.ZipCode ?? "",
              isSuperAdmin: user.isSuperAdmin ?? user.IsSuperAdmin ?? false,
            })

            const assignedStores = user.assignedStores ?? user.AssignedStores ?? []
            const storeIds = assignedStores.map((s: Record<string, unknown>) =>
              String(s.storeId ?? s.StoreId ?? "")
            )
            setSelectedStoreIds(storeIds)

            const defaultStore = assignedStores.find(
              (s: Record<string, unknown>) => s.isDefault ?? s.IsDefault
            )
            if (defaultStore) {
              setDefaultStoreId(String(defaultStore.storeId ?? defaultStore.StoreId ?? ""))
            }

            const userGroupId = user.groupId ?? user.GroupId
            if (userGroupId) {
              setGroupId(String(userGroupId))
            }

            const mainUserId = user.mainUserId ?? user.MainUserId ?? user.userId ?? user.UserId
            mainUserIdRef.current = mainUserId != null && !isNaN(Number(mainUserId)) ? Number(mainUserId) : null

            // Resolve the numeric user id Send Invite needs. Mirror the grid's
            // invite (which posts row.userId), preferring userId and falling
            // back to mainUserId — in this response they're the same id.
            const numericUserId = user.userId ?? user.UserId ?? user.mainUserId ?? user.MainUserId
            setInviteUserId(
              numericUserId != null && !isNaN(Number(numericUserId))
                ? Number(numericUserId)
                : null,
            )

            const customerIdForEnv = user.customerId ?? user.CustomerId ?? tenantCustomerId
            if (mainUserId && customerIdForEnv) {
              try {
                const envAccess = await environmentService.getUserAccess(
                  Number(mainUserId),
                  Number(customerIdForEnv),
                  getTenantHeadersRef.current()
                )
                setHasWebAccess(envAccess.hasWebAccess)
                setSelectedEnvIds(envAccess.environments.map((e) => e.environmentId))
              } catch {
                // Non-fatal
              }
            }

            // Tenant admins load their own tenant's roles here; Super Admins load roles
            // per assigned tenant via the per-tenant effect once tenants are loaded below.
            if (mainUserId && !isSuperAdminUser) {
              setUserRolesLoading(true)
              try {
                const rolesRes = await permissionService.getUserRoles(Number(mainUserId))
                if (rolesRes.data.isSuccess) {
                  setUserRoles(rolesRes.data.response)
                }
              } catch {
                // Non-fatal
              } finally {
                setUserRolesLoading(false)
              }
            }

            // Super Admins: load this user's tenant assignments (all tenants with their
            // isAssigned flags) so they can be reviewed/changed in edit mode.
            if (mainUserId && isSuperAdminUser) {
              setTenantsLoading(true)
              try {
                const tenantsRes = await permissionService.getUserTenantAssignments(Number(mainUserId))
                if (tenantsRes.data.isSuccess) {
                  setTenantAssignments(tenantsRes.data.response)
                }
              } catch {
                // Non-fatal
              } finally {
                setTenantsLoading(false)
              }
            }

            setFieldErrors({})
            setDataLoaded(true)
          } else {
            showToast("User data not found in response", "error")
          }
        } else {
          const msg = apiData?.message ?? apiData?.Message ?? "User not found"
          showToast(msg, "error")
        }
      } catch (err) {
        const error = err as { response?: { status?: number; data?: { message?: string } } }
        const status = error?.response?.status
        const msg = error?.response?.data?.message || "Failed to load user data"
        showToast(`${msg}${status ? ` (${status})` : ""}`, "error")
      } finally {
        setLoading(false)
        hasLoadedOnceRef.current = true
      }
    }

    fetchUser()
  }, [id, isEditMode, hasCachedState])

  const storeOptions = useMemo(
    () => stores.map((s) => ({ value: s.storeID, label: s.storeName })),
    [stores]
  )

  const groupOptions = useMemo(
    () => groups.map((g) => ({ value: g.groupID, label: g.groupName })),
    [groups]
  )

  const defaultStoreOptions = useMemo(
    () => storeOptions.filter((o) => selectedStoreIds.includes(o.value)),
    [storeOptions, selectedStoreIds]
  )

  const handleStoreChange = useCallback((selected: string[]) => {
    setSelectedStoreIds(selected)
    setDefaultStoreId((prev) => (selected.includes(prev) ? prev : ""))
  }, [])

  // Maps PascalCase backend error keys to camelCase frontend field names
  const mapBackendErrors = useCallback(
    (errors: Record<string, string[]>): FieldErrors => {
      const keyMap: Record<string, keyof UserFormData> = {
        UserName: "userName",
        Password: "password",
        UserFName: "userFName",
        UserLName: "userLName",
        Email: "email",
        Address: "address",
        HomePhoneNumber: "homePhoneNumber",
        WorkPhoneNumber: "workPhoneNumber",
        Fax: "fax",
        ZipCode: "zipCode",
      }
      const mapped: FieldErrors = {}
      for (const [key, messages] of Object.entries(errors)) {
        const fieldName = keyMap[key]
        if (fieldName && messages?.length > 0) {
          mapped[fieldName] = messages[0]
        }
      }
      return mapped
    },
    []
  )

  const savePostUserData = useCallback(async (
    mainUserId: number,
    customerId: number | undefined,
    headers: Record<string, string>,
    mode: "created" | "updated"
  ) => {
    try {
      if (mainUserId && customerId) {
        await environmentService.setUserEnvironments(
          {
            userId: mainUserId,
            customerId,
            environmentIds: selectedEnvIds,
            hasWebAccess,
          },
          headers
        )
      }
    } catch {
      showToast(`User ${mode} but failed to save environment access`, "error")
      return false
    }

    try {
      if (usePerTenantRoles) {
        // Save roles into EACH assigned tenant's DB (per-tenant roles).
        for (const t of tenantAssignments.filter((x) => x.isAssigned)) {
          const roleIds = (rolesByTenant[t.customerId] ?? []).filter((r) => r.isAssigned).map((r) => r.roleId)
          const res = await fetch(API_ENDPOINTS.TENANT_RBAC.USER_ROLES(mainUserId), {
            method: "PUT",
            headers: getAuthHeadersWithCustomerId(t.customerId),
            body: JSON.stringify({ userId: mainUserId, roleIds }),
          })
          const body = await res.json()
          if (!(body.isSuccess ?? body.IsSuccess)) throw new Error(body.message || "role save failed")
        }
      } else {
        const roleIds = userRoles.filter((r) => r.isAssigned).map((r) => r.roleId)
        await permissionService.assignUserRoles(mainUserId, {
          userId: mainUserId,
          roleIds,
        })
      }
    } catch {
      showToast(`User ${mode} but failed to save role assignments`, "error")
      return false
    }

    if (isSuperAdminUser && tenantAssignments.length > 0) {
      try {
        const customerIds = tenantAssignments.filter((t) => t.isAssigned).map((t) => t.customerId)
        await permissionService.assignTenantsToUser(mainUserId, {
          userId: mainUserId,
          customerIds,
        })
      } catch {
        showToast(`User ${mode} but failed to save tenant assignments`, "error")
        return false
      }
    }

    return true
  }, [selectedEnvIds, hasWebAccess, userRoles, usePerTenantRoles, rolesByTenant, isSuperAdminUser, tenantAssignments, showToast])

  const currentSnapshot: UserSnapshot = useMemo(() => ({
    formData,
    selectedStoreIds: [...selectedStoreIds].sort(),
    defaultStoreId,
    groupId,
    selectedEnvIds: [...selectedEnvIds].sort(),
    hasWebAccess,
    assignedRoleIds: userRoles.filter((r) => r.isAssigned).map((r) => String(r.roleId)).sort(),
    rolesByTenantKey: Object.entries(rolesByTenant)
      .map(([cid, rs]) => `${cid}:${rs.filter((r) => r.isAssigned).map((r) => r.roleId).sort((a, b) => a - b).join("/")}`)
      .sort()
      .join("|"),
    assignedTenantIds: tenantAssignments.filter((t) => t.isAssigned).map((t) => t.customerId).sort(),
  }), [formData, selectedStoreIds, defaultStoreId, groupId, selectedEnvIds, hasWebAccess, userRoles, rolesByTenant, tenantAssignments])

  // Seed the saved snapshot once per load. For edit mode, `dataLoaded` flips
  // true after fetchUser completes. For new mode, we seed once lookups and
  // role/tenant fetches have settled.
  useEffect(() => {
    if (savedSnapshot) return
    if (isEditMode) {
      if (dataLoaded) setSavedSnapshot(currentSnapshot)
    } else {
      // New-mode: wait until roles (and tenants, for super admins) finish loading.
      if (!userRolesLoading && (!isSuperAdminUser || !tenantsLoading)) {
        setSavedSnapshot(currentSnapshot)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded, isEditMode, userRolesLoading, tenantsLoading, isSuperAdminUser])

  // Focus-first-invalid wiring. The required fields (in display order)
  // are username → password (only on create) → email. Any of these
  // failing pulls focus to the first offender on top of showing the
  // existing per-field hint.
  const userNameRef = useRef<HTMLDivElement | null>(null)
  const passwordRef = useRef<HTMLDivElement | null>(null)
  const emailRef = useRef<HTMLDivElement | null>(null)
  // Wrapper-div refs for the role / tenant / store sections so focusFirstInvalid
  // can scroll the user to the offending section when any required-field rule
  // fails on save. The sections themselves get a red ring via fieldErrors.
  const storesSectionRef = useRef<HTMLDivElement | null>(null)
  const rolesSectionRef = useRef<HTMLDivElement | null>(null)
  const tenantsSectionRef = useRef<HTMLDivElement | null>(null)

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!validateAllFields()) {
      showToast("Please fix the validation errors", "error")
      // Focus the first failing required field. We honour the same
      // order the form renders so the user sees the offender at the
      // top of the page.
      focusFirstInvalid([
        { ref: userNameRef, isValid: !!formData.userName.trim() },
        // Password is only required when creating; on edit we leave the
        // field optional ("Leave blank to keep current"). Skip the
        // check on edit so it doesn't steal focus from a real offender.
        { ref: passwordRef, isValid: isEditMode || !!formData.password.trim() },
        { ref: emailRef, isValid: !!formData.email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) },
        // New: role/tenant/store required-field rules. Each section has its
        // own wrapper ref; focusFirstInvalid scrolls to the first offender.
        { ref: storesSectionRef, isValid: newUserIsSuperAdmin || (selectedStoreIds.length > 0 && !!defaultStoreId) },
        { ref: rolesSectionRef, isValid: userRoles.some((r) => r.isAssigned) },
        { ref: tenantsSectionRef, isValid: !isSuperAdminUser || newUserIsSuperAdmin || tenantAssignments.some((t) => t.isAssigned) },
      ])
      return false
    }

    setSaving(true)
    try {
      const headers = getTenantHeaders()

      const uniqueStoreIds = [...new Set(selectedStoreIds)]
      const storePayload = {
        storeIds: uniqueStoreIds.length > 0 ? uniqueStoreIds : undefined,
        defaultStoreId: defaultStoreId || undefined,
        groupId: groupId || undefined,
      }

      // Send the role + tenant selections in the create/update payload so the
      // backend validator can enforce the same required-field rules as the UI
      // (role always required; tenant + store required for non-super-admin users).
      // The post-save permission calls (assignUserRoles / assignTenantsToUser)
      // still run inside savePostUserData below to actually persist the
      // assignments — sending the ids here is purely so the backend can
      // accept/reject the operation atomically.
      // In per-tenant mode the flat `userRoles` is empty (roles live in rolesByTenant),
      // so build the union of every tenant's selected roles. This is only to satisfy the
      // backend's "at least one role" create/update validator — the real per-tenant
      // assignment is persisted by savePostUserData's per-tenant PUTs.
      const assignedRoleIds = usePerTenantRoles
        ? Array.from(
            new Set(
              tenantAssignments
                .filter((t) => t.isAssigned)
                .flatMap((t) => (rolesByTenant[t.customerId] ?? []).filter((r) => r.isAssigned).map((r) => r.roleId)),
            ),
          )
        : userRoles.filter((r) => r.isAssigned).map((r) => r.roleId)
      const assignedCustomerIds = tenantAssignments
        .filter((t) => t.isAssigned)
        .map((t) => Number(t.customerId))
        .filter((n) => Number.isFinite(n))
      const assignmentsPayload = {
        roleIds: assignedRoleIds.length > 0 ? assignedRoleIds : undefined,
        customerIds: assignedCustomerIds.length > 0 ? assignedCustomerIds : undefined,
      }

      if (isEditMode) {
        const payload = {
          tenantUserId: id,
          userName: formData.userName,
          password: formData.password || undefined,
          userFName: formData.userFName || undefined,
          userLName: formData.userLName || undefined,
          email: formData.email || undefined,
          address: formData.address || undefined,
          homePhoneNumber: formData.homePhoneNumber || undefined,
          workPhoneNumber: formData.workPhoneNumber || undefined,
          fax: formData.fax || undefined,
          zipCode: formData.zipCode || undefined,
          isSuperAdmin: formData.isSuperAdmin,
          ...storePayload,
          ...assignmentsPayload,
        }
        const response = await apiClient.put(
          API_ENDPOINTS.USERS.UPDATE_USER,
          payload,
          { headers }
        )
        if (response.data?.isSuccess) {
          const savedMainUserId = response.data?.response?.mainUserId ?? response.data?.response?.userId
          const savedCustomerId = response.data?.response?.customerId ?? tenantCustomerId
          const ok = await savePostUserData(Number(savedMainUserId), savedCustomerId ? Number(savedCustomerId) : undefined, headers, "updated")
          if (!ok) return false
          showToast("User updated successfully", "success")
          setSavedSnapshot(currentSnapshot)
          setTimeout(() => goBackToList(), 1000)
          return true
        } else {
          const backendErrors = response.data?.errors
          if (backendErrors && typeof backendErrors === "object") {
            const mapped = mapBackendErrors(backendErrors)
            setFieldErrors(mapped)
            showToast(response.data?.message || "Validation errors occurred", "error")
          } else {
            showToast(response.data?.message || "Failed to update user", "error")
          }
          return false
        }
      } else {
        const payload = {
          userName: formData.userName,
          password: formData.password,
          userFName: formData.userFName || undefined,
          userLName: formData.userLName || undefined,
          email: formData.email || undefined,
          address: formData.address || undefined,
          homePhoneNumber: formData.homePhoneNumber || undefined,
          workPhoneNumber: formData.workPhoneNumber || undefined,
          fax: formData.fax || undefined,
          zipCode: formData.zipCode || undefined,
          isSuperAdmin: formData.isSuperAdmin,
          ...storePayload,
          ...assignmentsPayload,
        }
        const response = await apiClient.post(
          API_ENDPOINTS.USERS.CREATE_USER,
          payload,
          { headers }
        )
        if (response.data?.isSuccess) {
          const createdMainUserId = response.data?.response?.mainUserId ?? response.data?.response?.userId
          const createdCustomerId = response.data?.response?.customerId ?? tenantCustomerId
          const ok = await savePostUserData(Number(createdMainUserId), createdCustomerId ? Number(createdCustomerId) : undefined, headers, "created")
          if (!ok) return false
          showToast("User created successfully", "success")
          setSavedSnapshot(currentSnapshot)
          setTimeout(() => goBackToList(), 1000)
          return true
        } else {
          const backendErrors = response.data?.errors
          if (backendErrors && typeof backendErrors === "object") {
            const mapped = mapBackendErrors(backendErrors)
            setFieldErrors(mapped)
            showToast(response.data?.message || "Validation errors occurred", "error")
          } else {
            showToast(response.data?.message || "Failed to create user", "error")
          }
          return false
        }
      }
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string; title?: string; errors?: Record<string, string[]> } } }
      if (error?.response?.status === 400 && error?.response?.data?.errors) {
        const mapped = mapBackendErrors(error.response.data.errors)
        setFieldErrors(mapped)
        showToast(error.response.data.title || "Validation errors occurred", "error")
      } else {
        const msg = error?.response?.data?.message || "An error occurred while saving"
        showToast(msg, "error")
      }
      return false
    } finally {
      setSaving(false)
    }
    return false
  }, [formData, isEditMode, id, showToast, goBackToList, getTenantHeaders, selectedStoreIds, defaultStoreId, groupId, validateAllFields, mapBackendErrors, savePostUserData, tenantCustomerId, currentSnapshot, userRoles, usePerTenantRoles, rolesByTenant, tenantAssignments])

  useUnsavedChanges<UserSnapshot>({
    tabId: __tabId,
    formData: currentSnapshot,
    initialSnapshot: savedSnapshot,
    saveHandler: async () => {
      const ok = await handleSave()
      if (!ok) throw new Error("Could not save user. Please fix any validation errors and try again.")
    },
  })

  const handleCancel = useCallback(() => {
    goBackToList()
  }, [goBackToList])

  // Send Invite — same endpoint the Users grid uses (POST api/Common/SendInvite
  // with the numeric userId). Available on the profile in edit mode so an admin
  // can invite a user from wherever they manage them, not only the list.
  const handleSendInvite = useCallback(async () => {
    if (!inviteUserId) {
      showToast("Save the user before sending an invite.", "error")
      return
    }
    if (!formData.email.trim()) {
      showToast("This user has no email address to invite.", "error")
      return
    }

    setSending(true)
    showToast("Sending invite…", "info")
    try {
      const response = await apiClient.post(
        API_ENDPOINTS.SEND_INVITE.SEND_USER_INVITE,
        { userId: inviteUserId },
        { headers: getTenantHeaders() }
      )
      if (response.data?.isSuccess || response.data?.IsSuccess) {
        showToast(`Invitation sent to ${formData.email} successfully!`, "success")
      } else {
        showToast(response.data?.message || "Failed to send invite.", "error")
      }
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } }
      showToast(error?.response?.data?.message || "Error sending invite.", "error")
    } finally {
      setSending(false)
    }
  }, [inviteUserId, formData.email, getTenantHeaders, showToast])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-r-transparent" />
          <p className="mt-2 text-sm text-gray-500">Loading user data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-4 bg-gray-50 dark:bg-gray-900">
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[300px] p-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                toast.type === "success"
                  ? "bg-green-100 dark:bg-green-500/10"
                  : toast.type === "error"
                  ? "bg-red-100 dark:bg-red-500/10"
                  : "bg-brand-50 dark:bg-brand-500/10"
              }`}
            >
              {toast.type === "success" && (
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {toast.type === "error" && (
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
          {isEditMode ? "Edit User" : "New User"}
        </h1>
        <div className="flex gap-2">
          {isEditMode && (
            <Button
              onClick={handleSendInvite}
              variant="secondary"
              disabled={sending || saving || !inviteUserId || !formData.email.trim()}
              startIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
            >
              {sending ? "Sending..." : "Send Invite"}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button onClick={handleCancel} variant="outline">
            Cancel
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* ── LEFT COLUMN: User Details ─────────────────────────────────── */}
          <div className="xl:col-span-2 space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90 uppercase tracking-wider mb-4">Account Details</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div ref={userNameRef}>
                  <Label>User Name *</Label>
                  <Input
                    type="text"
                    value={formData.userName}
                    onChange={(e) => handleChange("userName", (e.target as HTMLInputElement).value)}
                    placeholder="Enter username"
                    error={!!fieldErrors.userName}
                    hint={fieldErrors.userName}
                  />
                </div>
                <div ref={passwordRef}>
                  <Label>Password {!isEditMode && "*"}</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleChange("password", (e.target as HTMLInputElement).value)}
                    placeholder={isEditMode ? "Leave blank to keep current" : "Enter password"}
                    error={!!fieldErrors.password}
                    hint={fieldErrors.password}
                  />
                </div>
              </div>
            </div>

            {/* PRIVILEGES — visible only to super admins. Backend re-enforces the same
                rule, so a tampered client can't elevate a user. */}
            {isSuperAdminUser && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90 uppercase tracking-wider mb-1">
                  Privileges
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Elevated permissions for this user. Only visible to Super Admins.
                </p>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.isSuperAdmin}
                    onClick={() => handleChange("isSuperAdmin", !formData.isSuperAdmin)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                      formData.isSuperAdmin ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                        formData.isSuperAdmin ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <div>
                    <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                      Super Admin
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formData.isSuperAdmin
                        ? "Full access to every tenant and system-level settings."
                        : "Standard tenant user — no cross-tenant access."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90 uppercase tracking-wider mb-4">Personal Information</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label>First Name</Label>
                  <Input
                    type="text"
                    value={formData.userFName}
                    onChange={(e) => handleChange("userFName", (e.target as HTMLInputElement).value)}
                    placeholder="First name"
                    error={!!fieldErrors.userFName}
                    hint={fieldErrors.userFName}
                  />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input
                    type="text"
                    value={formData.userLName}
                    onChange={(e) => handleChange("userLName", (e.target as HTMLInputElement).value)}
                    placeholder="Last name"
                    error={!!fieldErrors.userLName}
                    hint={fieldErrors.userLName}
                  />
                </div>
                <div ref={emailRef}>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", (e.target as HTMLInputElement).value)}
                    placeholder="Email address"
                    error={!!fieldErrors.email}
                    hint={fieldErrors.email}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90 uppercase tracking-wider mb-4">Contact Details</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label>Home Phone</Label>
                  <Input
                    type="text"
                    value={formData.homePhoneNumber}
                    onChange={(e) => handleChange("homePhoneNumber", (e.target as HTMLInputElement).value)}
                    placeholder="Home phone"
                    error={!!fieldErrors.homePhoneNumber}
                    hint={fieldErrors.homePhoneNumber}
                  />
                </div>
                <div>
                  <Label>Work Phone</Label>
                  <Input
                    type="text"
                    value={formData.workPhoneNumber}
                    onChange={(e) => handleChange("workPhoneNumber", (e.target as HTMLInputElement).value)}
                    placeholder="Work phone"
                    error={!!fieldErrors.workPhoneNumber}
                    hint={fieldErrors.workPhoneNumber}
                  />
                </div>
                <div>
                  <Label>Fax</Label>
                  <Input
                    type="text"
                    value={formData.fax}
                    onChange={(e) => handleChange("fax", (e.target as HTMLInputElement).value)}
                    placeholder="Fax number"
                    error={!!fieldErrors.fax}
                    hint={fieldErrors.fax}
                  />
                </div>
                <div>
                  <Label>Zip Code</Label>
                  <Input
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) => handleChange("zipCode", (e.target as HTMLInputElement).value)}
                    placeholder="Zip code"
                    error={!!fieldErrors.zipCode}
                    hint={fieldErrors.zipCode}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Address</Label>
                  <Input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleChange("address", (e.target as HTMLInputElement).value)}
                    placeholder="Full address"
                    error={!!fieldErrors.address}
                    hint={fieldErrors.address}
                  />
                </div>
              </div>
            </div>

            {/* ── Super Admin toggle ──────────────────────────────────────
                Only super-admin operators can mark a user as super-admin.
                Toggling on disables the tenant + store required-field rules
                below (super-admin users have implicit platform access) and
                hides the tenant section in the right column. */}
            {isSuperAdminUser && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90 uppercase tracking-wider mb-3">
                  Access Level
                </h2>
                <Checkbox
                  id="isSuperAdmin"
                  checked={!!formData.isSuperAdmin}
                  onChange={(checked) => {
                    setFormData((prev) => ({ ...prev, isSuperAdmin: checked }))
                    // Clear tenant/store/defaultStore errors as soon as the
                    // toggle is flipped on — those rules no longer apply.
                    if (checked) {
                      setFieldErrors((prev) => {
                        const next = { ...prev }
                        delete next.tenants
                        delete next.stores
                        delete next.defaultStore
                        return next
                      })
                    }
                  }}
                  label="Super Admin — grants platform-wide access. Tenant and store assignment are not required."
                />
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90 uppercase tracking-wider mb-4">Store & Group</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label>Group</Label>
                  <SearchableSelect
                    options={groupOptions}
                    value={groupId}
                    onChange={setGroupId}
                    placeholder="Select a group"
                    loading={lookupsLoading}
                    triggerClassName="min-h-[44px]"
                  />
                </div>
                <div ref={storesSectionRef} className="md:col-span-2">
                  <Label>
                    Assigned Stores{!newUserIsSuperAdmin && <span className="text-red-500"> *</span>}
                  </Label>
                  <MultiSelect
                    options={storeOptions}
                    value={selectedStoreIds}
                    onChange={(selected) => {
                      handleStoreChange(selected)
                      if (fieldErrors.stores || fieldErrors.defaultStore) {
                        setFieldErrors((prev) => {
                          const next = { ...prev }
                          delete next.stores
                          if (selected.length > 0 && defaultStoreId) delete next.defaultStore
                          return next
                        })
                      }
                    }}
                    placeholder={
                      newUserIsSuperAdmin
                        ? "Optional for super-admin users"
                        : "Select stores"
                    }
                    loading={lookupsLoading}
                  />
                  {fieldErrors.stores && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.stores}</p>
                  )}
                </div>
                {selectedStoreIds.length > 0 && (
                  <div>
                    <Label>
                      Default Store{!newUserIsSuperAdmin && <span className="text-red-500"> *</span>}
                    </Label>
                    <SearchableSelect
                      options={defaultStoreOptions}
                      value={defaultStoreId}
                      onChange={(v) => {
                        setDefaultStoreId(v)
                        if (fieldErrors.defaultStore) {
                          setFieldErrors((prev) => {
                            const next = { ...prev }
                            delete next.defaultStore
                            return next
                          })
                        }
                      }}
                      placeholder="Select default store"
                      triggerClassName="min-h-[44px]"
                    />
                    {fieldErrors.defaultStore && (
                      <p className="text-xs text-red-500 mt-1">{fieldErrors.defaultStore}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90 uppercase tracking-wider mb-1">
                Environment Access
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Control which environments this user can access.
              </p>

              <div className="flex items-center gap-3 mb-4">
                <button
                  type="button"
                  role="switch"
                  aria-checked={hasWebAccess}
                  onClick={() => setHasWebAccess((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                    hasWebAccess ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      hasWebAccess ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <div>
                  <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                    Web Application Access
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {hasWebAccess
                      ? "This user can sign in to the web backoffice."
                      : "This user is blocked from signing in."}
                  </p>
                </div>
              </div>

              <div>
                <Label>Allowed Environments</Label>
                {envsLoading ? (
                  <p className="text-sm text-gray-400 mt-1">Loading environments…</p>
                ) : environments.length === 0 ? (
                  <p className="text-sm text-gray-400 mt-1">No active environments configured.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {environments.map((env) => {
                      const selected = selectedEnvIds.includes(env.id)
                      return (
                        <button
                          key={env.id}
                          type="button"
                          onClick={() =>
                            setSelectedEnvIds((prev) =>
                              selected ? prev.filter((x) => x !== env.id) : [...prev, env.id]
                            )
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                            selected
                              ? "bg-brand-500 text-white shadow-sm"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                          }`}
                        >
                          {selected && (
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {env.code}
                        </button>
                      )
                    })}
                  </div>
                )}
                {selectedEnvIds.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {selectedEnvIds.length} environment{selectedEnvIds.length !== 1 ? "s" : ""} selected
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Roles & Assignments ─────────────────────────── */}
          <div className="space-y-4">
            <div
              ref={rolesSectionRef}
              className={`bg-white dark:bg-gray-800 rounded-xl border overflow-hidden ${
                fieldErrors.roles
                  ? "border-red-400 dark:border-red-500/60 ring-2 ring-red-200 dark:ring-red-500/20"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90 uppercase tracking-wider">
                  User Roles <span className="text-red-500 normal-case">*</span>
                </h2>
                <div className="flex items-center gap-3">
                  {isSuperAdminUser && (
                    <button
                      type="button"
                      onClick={() => setGroupImportOpen(true)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v10m0 0l-3-3m3 3l3-3M5 19h14" />
                      </svg>
                      Import Groups
                    </button>
                  )}
                  {!usePerTenantRoles && userRoles.length > 0 && !userRolesLoading && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {userRoles.filter((r) => r.isAssigned).length}/{userRoles.length}
                    </span>
                  )}
                </div>
              </div>
              {fieldErrors.roles && (
                <div className="px-5 pt-2 pb-0 text-xs text-red-500">{fieldErrors.roles}</div>
              )}

              {usePerTenantRoles ? (
                tenantAssignments.filter((t) => t.isAssigned).length === 0 ? (
                  <div className="py-8 px-5 text-center text-sm text-gray-500 dark:text-gray-400">
                    Select one or more tenants in Tenant Assignments below — each tenant's roles
                    appear here so you can assign them per tenant.
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {tenantAssignments
                      .filter((t) => t.isAssigned)
                      .map((t) => (
                        <RoleChecklist
                          key={t.customerId}
                          title={t.customerName}
                          subtitle={t.email}
                          roles={rolesByTenant[t.customerId] ?? []}
                          loading={rolesLoadingTenants.has(t.customerId)}
                          onToggle={(roleId) => toggleTenantRole(t.customerId, roleId)}
                        />
                      ))}
                  </div>
                )
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  <RoleChecklist roles={userRoles} loading={userRolesLoading} onToggle={toggleUserRole} />
                </div>
              )}
            </div>

            {/* When the new user is a super-admin, hide the tenant section entirely
                and show a small note explaining why — implicit platform access. */}
            {isSuperAdminUser && newUserIsSuperAdmin && (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-5 py-3 text-xs text-amber-700 dark:text-amber-300">
                Super-admin users have implicit platform access — no tenant or
                store assignment is required.
              </div>
            )}
            {isSuperAdminUser && !newUserIsSuperAdmin && (
              <div
                ref={tenantsSectionRef}
                className={`bg-white dark:bg-gray-800 rounded-xl border overflow-hidden ${
                  fieldErrors.tenants
                    ? "border-red-400 dark:border-red-500/60 ring-2 ring-red-200 dark:ring-red-500/20"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90 uppercase tracking-wider">
                    Tenant Assignments <span className="text-red-500 normal-case">*</span>
                  </h2>
                  {tenantAssignments.length > 0 && !tenantsLoading && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {tenantAssignments.filter((t) => t.isAssigned).length}/{tenantAssignments.length}
                    </span>
                  )}
                </div>
                {fieldErrors.tenants && (
                  <div className="px-5 pt-2 pb-0 text-xs text-red-500">{fieldErrors.tenants}</div>
                )}

                {tenantsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-500" />
                    <span className="ml-2 text-sm text-gray-500">Loading tenants...</span>
                  </div>
                ) : tenantAssignments.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">No tenants available.</div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-72 overflow-y-auto">
                    {tenantAssignments.map((tenant) => (
                      <label
                        key={tenant.customerId}
                        className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={tenant.isAssigned}
                          onChange={() => {
                            setTenantAssignments((prev) =>
                              prev.map((t) =>
                                t.customerId === tenant.customerId
                                  ? { ...t, isAssigned: !t.isAssigned }
                                  : t
                              )
                            )
                            if (fieldErrors.tenants) {
                              setFieldErrors((prev) => {
                                const next = { ...prev }
                                delete next.tenants
                                return next
                              })
                            }
                          }}
                          className="rounded border-gray-300 text-brand-500 focus:ring-brand-500 w-4 h-4"
                        />
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-semibold">
                          {tenant.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {tenant.customerName}
                          </p>
                          {tenant.email && (
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                              {tenant.email}
                            </p>
                          )}
                        </div>
                        {tenant.isAssigned && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 rounded-full font-medium">
                            Assigned
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      <GroupImportModal
        isOpen={groupImportOpen}
        onClose={() => setGroupImportOpen(false)}
        onImported={(tenantId) => refreshRolesForTenant(usePerTenantRoles ? tenantId : null)}
        defaultTenantId={tenantAssignments.find((t) => t.isAssigned)?.customerId ?? null}
      />
    </div>
  )
}

export default UserFormPage
