import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from './useAppSelector';
import { loadScreenPermissions } from '../store/slices/effectivePermissionSlice';

/**
 * Hook to query screen-level permissions for a given screen code.
 *
 * Usage:
 *   const { canView, canCreate, canEdit, canDelete, loading } = usePermission('ITEMS_LIST');
 *
 * The hook lazily fetches screen permissions the first time a screen code is
 * requested and caches the result in Redux so subsequent calls are instant.
 */
export function usePermission(screenCode: string) {
  const dispatch = useAppDispatch();
  const { permissions, screenPermissions } = useAppSelector(
    (state) => state.effectivePermission
  );

  useEffect(() => {
    if (screenCode && !screenPermissions[screenCode]) {
      dispatch(loadScreenPermissions(screenCode));
    }
  }, [screenCode, screenPermissions, dispatch]);

  const sp = screenPermissions[screenCode];

  return {
    /** Check if the user has a specific permission key (from the flat list). */
    hasPermission: (key: string) => permissions.includes(key),

    canView: sp?.canView ?? false,
    canCreate: sp?.canCreate ?? false,
    canEdit: sp?.canEdit ?? false,
    canDelete: sp?.canDelete ?? false,
    canApprove: sp?.canApprove ?? false,
    canExport: sp?.canExport ?? false,
    canImport: sp?.canImport ?? false,
    canPrint: sp?.canPrint ?? false,
    canVoid: sp?.canVoid ?? false,
    canAssign: sp?.canAssign ?? false,
    canConfig: sp?.canConfig ?? false,

    /** True while the screen permissions are still being fetched. */
    loading: !sp,

    /** The raw screen permissions object (null if not yet loaded). */
    screenPermissions: sp ?? null,

    /** Check a custom action by key. */
    hasCustomAction: (actionKey: string) => sp?.customActions?.[actionKey] ?? false,
  };
}
