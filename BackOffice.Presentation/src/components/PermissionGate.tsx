import React from 'react';
import { useAppSelector } from '../hooks/useAppSelector';

interface PermissionGateProps {
  /** The permission key to check (e.g. "ITEMS_LIST.View"). */
  permission: string;
  /** Content rendered when the user HAS the permission. */
  children: React.ReactNode;
  /** Optional content rendered when the user does NOT have the permission. */
  fallback?: React.ReactNode;
}

/**
 * Conditionally renders children based on a single permission key.
 *
 * Example:
 *   <PermissionGate permission="ITEMS_LIST.Create">
 *     <button>Add Item</button>
 *   </PermissionGate>
 *
 *   <PermissionGate
 *     permission="ITEMS_LIST.Delete"
 *     fallback={<button disabled>Delete</button>}
 *   >
 *     <button onClick={handleDelete}>Delete</button>
 *   </PermissionGate>
 */
const PermissionGate: React.FC<PermissionGateProps> = ({ permission, children, fallback = null }) => {
  const { permissions } = useAppSelector((state) => state.effectivePermission);

  if (permissions.includes(permission)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

export default PermissionGate;
