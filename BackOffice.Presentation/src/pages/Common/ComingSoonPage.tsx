import React from "react";
import Button from "../../components/ui/button/Button";
import { useDashboardTabs } from "../../context/DashboardTabContext";

interface ComingSoonPageProps {
  title?: string;
  description?: string;
  icon?: string;
}

const ComingSoonPage: React.FC<ComingSoonPageProps> = ({
  title = "Coming Soon",
  description = "This feature is currently under development and will be available in a future update.",
  icon = "rocket",
}) => {
  const { closeTab, activeTabId } = useDashboardTabs();

  const iconSvg = (() => {
    switch (icon) {
      case "bogo":
        return (
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
        );
      case "loyalty":
        return (
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        );
      case "points":
        return (
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        );
      case "coupon":
        return (
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
        );
      default:
        return (
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
    }
  })();

  return (
    <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center max-w-md mx-auto px-6">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-900/20 dark:text-brand-400 mb-6">
          {iconSvg}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          {title}
        </h1>

        {/* Description */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
          {description}
        </p>

        {/* Action */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTabId) closeTab(activeTabId);
            }}
          >
            Close Tab
          </Button>
        </div>

        {/* Bottom badge */}
        <div className="mt-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium dark:bg-amber-900/20 dark:text-amber-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Under Development
          </span>
        </div>
      </div>
    </div>
  );
};

export default ComingSoonPage;
