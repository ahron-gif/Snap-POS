import React from 'react';
import TokenPermissionsTab from '../PermissionSettings/TokenPermissionsTab';

const TokenPermissionsPage: React.FC = () => {
  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Token Permissions</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Assign permissions to tokens with allow/deny access control. Select a token and toggle permissions using the bulk update interface.
        </p>
      </div>

      {/* Content */}
      <TokenPermissionsTab />
    </div>
  );
};

export default TokenPermissionsPage;
