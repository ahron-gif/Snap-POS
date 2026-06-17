import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { AppDispatch, RootState } from '../../store/store';
import { fetchPermissions } from '../../store/slices/permissionSlice';
import { fetchTokens } from '../../store/slices/tokenSlice';

const StatCard: React.FC<{
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
  onClick?: () => void;
}> = ({ title, value, icon, color, loading, onClick }) => (
  <button
    onClick={onClick}
    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex items-center gap-4 hover:shadow-md transition-all duration-200 text-left w-full group"
  >
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color} group-hover:scale-105 transition-transform`}>
      {icon}
    </div>
    <div className="min-w-0">
      {loading ? (
        <div className="animate-pulse">
          <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      ) : (
        <>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        </>
      )}
    </div>
  </button>
);

const QuickActionCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ title, description, icon, onClick }) => (
  <button
    onClick={onClick}
    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 text-left hover:shadow-md hover:border-brand-300 dark:hover:border-brand-600 transition-all duration-200 group"
  >
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 text-gray-500 dark:text-gray-400 group-hover:bg-brand-50 group-hover:text-brand-500 dark:group-hover:bg-brand-500/10 dark:group-hover:text-brand-400 transition-colors">
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">{title}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
    </div>
  </button>
);

const OverviewPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { totalRecords: permissionCount, loading: permLoading } = useSelector((state: RootState) => state.permission);
  const { totalRecords: tokenCount, loading: tokenLoading } = useSelector((state: RootState) => state.token);

  useEffect(() => {
    dispatch(fetchPermissions({ startRow: 0, endRow: 1 }));
    dispatch(fetchTokens({ startRow: 0, endRow: 1 }));
  }, [dispatch]);

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SmartKart Registration</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage API permissions, tokens, and access control for the SmartKart registration system.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Total Permissions"
          value={permissionCount}
          loading={permLoading}
          color="bg-brand-50 dark:bg-brand-900/30 text-brand-500 dark:text-brand-400"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
          onClick={() => navigate('/smartkart-registration/permissions')}
        />
        <StatCard
          title="Total Tokens"
          value={tokenCount}
          loading={tokenLoading}
          color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          }
          onClick={() => navigate('/smartkart-registration/tokens')}
        />
        <StatCard
          title="Access Control"
          value="Active"
          loading={false}
          color="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
          onClick={() => navigate('/smartkart-registration/token-permissions')}
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickActionCard
            title="Manage Permissions"
            description="Create, edit, and organize API permissions and access keys"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            }
            onClick={() => navigate('/smartkart-registration/permissions')}
          />
          <QuickActionCard
            title="Manage Tokens"
            description="Generate, activate, and deactivate API access tokens"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
            onClick={() => navigate('/smartkart-registration/tokens')}
          />
          <QuickActionCard
            title="Assign Permissions"
            description="Map permissions to tokens with allow/deny access control"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            }
            onClick={() => navigate('/smartkart-registration/token-permissions')}
          />
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-brand-50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-brand-900 dark:text-brand-300">How Token Authorization Works</h3>
            <p className="text-sm text-brand-700 dark:text-brand-400 mt-1">
              When an API request includes an <code className="px-1.5 py-0.5 bg-brand-50 dark:bg-brand-900/30 rounded text-xs font-mono">X-Api-Token</code> header,
              the system checks the token's permission mappings. If a permission is mapped with <strong>IsAllowed = false</strong>,
              the request is blocked. If the token is not found or has no mapping for that permission, the request passes through.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
