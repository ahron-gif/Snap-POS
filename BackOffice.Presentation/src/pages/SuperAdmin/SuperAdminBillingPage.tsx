import React, { useState } from 'react';
import PlanManagementPage from './PlanManagementPage';
import GlobalPricingPage from './GlobalPricingPage';
import BillingOverviewPage from './BillingOverviewPage';

type TabKey = 'overview' | 'plans' | 'pricing';

const tabs: { key: TabKey; label: string; description: string }[] = [
  { key: 'overview', label: 'Billing Overview', description: 'Customer billing status & invoices' },
  { key: 'plans', label: 'Plan Management', description: 'Create & manage subscription plans' },
  { key: 'pricing', label: 'Global Pricing', description: 'API definitions & billing config' },
];

const SuperAdminBillingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Licenses &amp; Billing</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage plans, pricing, and customer billing from one place
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 mb-5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
            title={tab.description}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && <BillingOverviewPage />}
        {activeTab === 'plans' && <PlanManagementPage />}
        {activeTab === 'pricing' && <GlobalPricingPage />}
      </div>
    </div>
  );
};

export default SuperAdminBillingPage;
