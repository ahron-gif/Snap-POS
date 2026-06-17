import React from 'react';
import PermissionsTab from '../PermissionSettings/PermissionsTab';

const PermissionsPage: React.FC = () => {
  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Permissions</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Create, edit, and manage API permissions. Each permission defines an access control rule identified by a unique key.
        </p>
      </div>

      {/* Content */}
      <PermissionsTab />
    </div>
  );
};

export default PermissionsPage;
