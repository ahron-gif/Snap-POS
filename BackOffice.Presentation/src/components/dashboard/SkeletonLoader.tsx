import React from 'react';

const Shimmer: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
  <div className={`skeleton-shimmer rounded ${className}`} style={style} />
);

export const KpiCardSkeleton: React.FC = () => (
  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
    <div className="flex items-center justify-between mb-3">
      <Shimmer className="h-10 w-10 rounded-xl" />
      <Shimmer className="h-5 w-16 rounded-full" />
    </div>
    <Shimmer className="h-7 w-24 mb-1.5" />
    <Shimmer className="h-4 w-32" />
  </div>
);

export const ChartSkeleton: React.FC<{ height?: string }> = ({ height = 'h-80' }) => (
  <div className={`rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm ${height}`}>
    <div className="flex items-center justify-between mb-6">
      <Shimmer className="h-5 w-40" />
      <div className="flex gap-2">
        <Shimmer className="h-8 w-16 rounded-lg" />
        <Shimmer className="h-8 w-16 rounded-lg" />
      </div>
    </div>
    <div className="flex items-end gap-2 h-[calc(100%-4rem)] pb-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end h-full">
          <Shimmer
            className="w-full rounded-t"
            style={{ height: `${20 + Math.random() * 60}%` } as React.CSSProperties}
          />
        </div>
      ))}
    </div>
  </div>
);

export const DonutSkeleton: React.FC = () => (
  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm h-80">
    <Shimmer className="h-5 w-40 mb-6" />
    <div className="flex items-center justify-center">
      <div className="relative">
        <Shimmer className="h-40 w-40 rounded-full" />
        <div className="absolute inset-0 m-auto h-24 w-24 rounded-full bg-white dark:bg-gray-800" />
      </div>
    </div>
    <div className="flex justify-center gap-4 mt-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-1.5">
          <Shimmer className="h-3 w-3 rounded-full" />
          <Shimmer className="h-3 w-12" />
        </div>
      ))}
    </div>
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
    <Shimmer className="h-5 w-40 mb-5" />
    <div className="space-y-3">
      <div className="flex gap-4 pb-3 border-b border-gray-100 dark:border-gray-700">
        <Shimmer className="h-4 w-24" />
        <Shimmer className="h-4 w-32 flex-1" />
        <Shimmer className="h-4 w-20" />
        <Shimmer className="h-4 w-16" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center py-2">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-4 w-32 flex-1" />
          <Shimmer className="h-4 w-20" />
          <Shimmer className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);

export const AgingSkeleton: React.FC = () => (
  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
    <Shimmer className="h-5 w-40 mb-5" />
    <div className="space-y-3">
      {['Current', '30+', '60+', '90+', '120+', 'Total'].map(label => (
        <div key={label} className="flex items-center justify-between">
          <Shimmer className="h-4 w-16" />
          <Shimmer className="h-4 w-full mx-4 rounded-full" />
          <Shimmer className="h-4 w-20" />
        </div>
      ))}
    </div>
  </div>
);

export const NotificationSkeleton: React.FC = () => (
  <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
    <Shimmer className="h-5 w-32 mb-5" />
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30">
          <Shimmer className="h-8 w-8 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const CardErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <svg className="w-10 h-10 text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="text-xs px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 dark:bg-brand-900/20 dark:text-brand-400 dark:hover:bg-brand-900/30 transition-colors"
      >
        Try Again
      </button>
    )}
  </div>
);
