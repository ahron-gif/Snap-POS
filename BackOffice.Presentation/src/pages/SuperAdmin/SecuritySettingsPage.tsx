import React from 'react';
import SecurityTab from '../PermissionSettings/SecurityTab';

const SecuritySettingsPage: React.FC = () => {
  return (
    <div className="p-4 sm:p-6 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Security Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage MFA and device trust settings for all users
        </p>
      </div>
      <SecurityTab />
    </div>
  );
};

export default SecuritySettingsPage;
