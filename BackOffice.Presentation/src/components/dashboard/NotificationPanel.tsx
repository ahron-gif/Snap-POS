import React from 'react';
import { useDashboardApi } from '../../hooks/useDashboardApi';
import { useLazyLoad } from '../../hooks/useLazyLoad';
import { dashboardService, type DashboardFilters, type DashboardNotification } from '../../services/dashboardService';
import { NotificationSkeleton, CardErrorState } from './SkeletonLoader';

interface Props {
  filters: DashboardFilters;
}

const severityConfig: Record<string, { bg: string; text: string; border: string }> = {
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/15',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
  },
  danger: {
    bg: 'bg-red-50 dark:bg-red-900/15',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
  info: {
    bg: 'bg-brand-50 dark:bg-brand-900/15',
    text: 'text-brand-500 dark:text-brand-400',
    border: 'border-brand-200 dark:border-brand-800',
  },
  success: {
    bg: 'bg-green-50 dark:bg-green-900/15',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
};

const typeIcons: Record<string, React.ReactNode> = {
  low_stock: (
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  out_of_stock: (
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  overdue_payment: (
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  pending_approval: (
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  supplier_payable: (
    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  ),
};

const defaultIcon = (
  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
  </svg>
);

const getRelativeTime = (timestamp: string): string => {
  try {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return timestamp;
  }
};

const NotificationPanel: React.FC<Props> = ({ filters }) => {
  const [ref, isVisible] = useLazyLoad();

  const { data, isLoading, error, refetch } = useDashboardApi<DashboardNotification[]>(
    () => dashboardService.getNotifications(filters.storeId),
    [filters.storeId],
    isVisible
  );

  const notifications = data ?? [];

  return (
    <div ref={ref} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm dash-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Notifications</h3>
        {notifications.length > 0 && (
          <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400">
            {notifications.length}
          </span>
        )}
      </div>

      {!isVisible || isLoading ? (
        <NotificationSkeleton />
      ) : error || !data ? (
        <CardErrorState message={error || 'Failed to load notifications'} onRetry={refetch} />
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">No notifications</p>
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1 -mr-1 custom-scrollbar">
          {notifications.map((notif, idx) => {
            const config = severityConfig[notif.severity] || severityConfig.info;
            const icon = typeIcons[notif.type] || defaultIcon;

            return (
              <div
                key={`${notif.type}-${notif.timestamp}-${idx}`}
                className={`flex items-start gap-3 p-3 rounded-xl border ${config.bg} ${config.border} transition-colors`}
              >
                <div className={`flex-shrink-0 p-1.5 rounded-lg ${config.text}`}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {notif.title}
                    </h4>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5">
                      {getRelativeTime(notif.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                    {notif.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
