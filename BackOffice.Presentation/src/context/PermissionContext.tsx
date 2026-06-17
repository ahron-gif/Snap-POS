import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/useAppSelector';
import { loadPermissions, loadMenu, clearPermissions } from '../store/slices/effectivePermissionSlice';
import { useAuth } from './AuthContext';

// ─── Context type ───

interface PermissionContextType {
  /** Check if the current user has a specific permission key. */
  hasPermission: (key: string) => boolean;
  /** True when the user is a super admin (no customerId). */
  isSuperAdmin: boolean;
  /** True when the user is a tenant admin (role === 'Admin'). */
  isTenantAdmin: boolean;
  /** True while initial permission loading is in progress. */
  loading: boolean;
  /** True once permissions have been loaded at least once. */
  loaded: boolean;
  /** Force a fresh reload of permissions and menu. */
  refreshPermissions: () => void;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

// ─── Provider ───

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user, isSuperAdmin: checkSuperAdmin } = useAuth();
  const {
    permissions,
    loading,
    loaded,
    permissionVersion,
  } = useAppSelector((state) => state.effectivePermission);

  const isSuperAdmin = checkSuperAdmin();
  const isTenantAdmin = user?.role === 'Admin';

  // Load permissions + menu on login or when permission version changes
  useEffect(() => {
    if (isAuthenticated && !loaded && !loading) {
      dispatch(loadPermissions());
      dispatch(loadMenu());
    }
  }, [isAuthenticated, loaded, loading, dispatch]);

  // Re-fetch when the permission version changes (e.g. after role changes)
  useEffect(() => {
    if (isAuthenticated && permissionVersion) {
      dispatch(loadPermissions());
      dispatch(loadMenu());
    }
    // Only react to version changes, not the initial empty string
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionVersion]);

  // Clear permissions on logout
  useEffect(() => {
    if (!isAuthenticated) {
      dispatch(clearPermissions());
    }
  }, [isAuthenticated, dispatch]);

  // Debug: log loaded permissions once
  useEffect(() => {
    if (loaded && permissions.length > 0) {
      console.log("[PermissionContext] Loaded permissions:", permissions);
    } else if (loaded && permissions.length === 0) {
      console.warn("[PermissionContext] Permissions loaded but EMPTY array. isSuperAdmin:", isSuperAdmin, "isTenantAdmin:", isTenantAdmin, "user role:", user?.role);
    }
  }, [loaded, permissions, isSuperAdmin, isTenantAdmin, user?.role]);

  const hasPermission = useCallback(
    (key: string) => {
      // Super admins have all permissions
      if (isSuperAdmin) return true;
      return permissions.includes(key);
    },
    [permissions, isSuperAdmin]
  );

  const refreshPermissions = useCallback(() => {
    if (isAuthenticated) {
      dispatch(loadPermissions());
      dispatch(loadMenu());
    }
  }, [isAuthenticated, dispatch]);

  return (
    <PermissionContext.Provider
      value={{
        hasPermission,
        isSuperAdmin,
        isTenantAdmin,
        loading,
        loaded,
        refreshPermissions,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
};
