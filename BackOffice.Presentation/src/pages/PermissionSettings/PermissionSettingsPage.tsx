import React, { useState } from 'react';
import PermissionsTab from './PermissionsTab';
import TokensTab from './TokensTab';
import TokenPermissionsTab from './TokenPermissionsTab';
import SecurityTab from './SecurityTab';

const tabs = [
  { key: 'permissions', label: 'Permissions' },
  { key: 'tokens', label: 'Token Access Store' },
  { key: 'assignment', label: 'Token Permissions' },
  { key: 'security', label: 'Security' },
];

const PermissionSettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('permissions');

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Permission Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage permissions, tokens, and token-permission assignments
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'permissions' && <PermissionsTab />}
        {activeTab === 'tokens' && <TokensTab />}
        {activeTab === 'assignment' && <TokenPermissionsTab />}
        {activeTab === 'security' && <SecurityTab />}
      </div>
    </div>
  );
};

export default PermissionSettingsPage;
