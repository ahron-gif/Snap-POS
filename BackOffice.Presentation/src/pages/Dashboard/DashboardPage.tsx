import React from 'react';
import { DashboardTabProvider } from '../../context/DashboardTabContext';
import DashboardTabBar from '../../components/dashboard/DashboardTabBar';
import DashboardTabContent from '../../components/dashboard/DashboardTabContent';

const DashboardPage: React.FC = () => {
  return (
    <DashboardTabProvider>
      <div className="h-full flex flex-col -mx-4 md:-mx-6">
        {/* Tab Bar — full width, flush with sidebar and right edge */}
        <DashboardTabBar />

        {/* Tab Content — restore inner padding */}
        <div className="flex-1 overflow-auto px-4 md:px-6">
          <DashboardTabContent />
        </div>
      </div>
    </DashboardTabProvider>
  );
};

export default DashboardPage;
