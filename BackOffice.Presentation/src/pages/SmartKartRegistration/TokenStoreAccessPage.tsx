import React from 'react';
import TokenStoreAccessTab from '../PermissionSettings/TokenStoreAccessTab';

const TokenStoreAccessPage: React.FC = () => {
  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Token Store Access</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Assign stores to tokens. Select a token and manage which stores it can access.
        </p>
      </div>

      {/* Content */}
      <TokenStoreAccessTab />
    </div>
  );
};

export default TokenStoreAccessPage;
