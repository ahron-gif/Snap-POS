import React from 'react';
import { useAppSelector } from '../hooks/useAppSelector';

interface FieldGateProps {
  /** The permission key that governs field visibility. */
  permission: string;
  /** Content rendered when the user HAS the permission. */
  children: React.ReactNode;
  /**
   * Behaviour when the user lacks the permission:
   *  - "hidden"   : render nothing (default)
   *  - "readonly" : render children wrapped in a read-only container
   *  - "disabled" : render the fallback prop (e.g. a disabled input)
   */
  mode?: 'hidden' | 'readonly' | 'disabled';
  /** Custom fallback for the "disabled" mode. */
  fallback?: React.ReactNode;
}

/**
 * Field-level permission gate.
 *
 * Use this to hide or disable individual form fields based on permissions.
 * This component is designed for future granular field-level RBAC.
 *
 * Example:
 *   <FieldGate permission="ITEMS.EditPrice" mode="readonly">
 *     <input value={price} onChange={...} />
 *   </FieldGate>
 */
const FieldGate: React.FC<FieldGateProps> = ({
  permission,
  children,
  mode = 'hidden',
  fallback = null,
}) => {
  const { permissions } = useAppSelector((state) => state.effectivePermission);
  const hasPermission = permissions.includes(permission);

  if (hasPermission) {
    return <>{children}</>;
  }

  switch (mode) {
    case 'readonly':
      return (
        <div className="pointer-events-none opacity-60" aria-disabled="true">
          {children}
        </div>
      );
    case 'disabled':
      return <>{fallback}</>;
    case 'hidden':
    default:
      return null;
  }
};

export default FieldGate;
