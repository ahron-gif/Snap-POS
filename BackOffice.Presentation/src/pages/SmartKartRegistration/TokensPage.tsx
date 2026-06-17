import React from 'react';
import TokensTab from '../PermissionSettings/TokensTab';

const TokensPage: React.FC = () => {
  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Store Tokens</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage API access tokens. Each token is tied to a store application and registration, and can be activated or deactivated.
        </p>
      </div>

      {/* Content */}
      <TokensTab />
    </div>
  );
};

export default TokensPage;
