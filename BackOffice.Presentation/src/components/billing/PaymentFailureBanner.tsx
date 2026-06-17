import { useState, useEffect } from "react";
import { Link } from "react-router";

const DISMISS_KEY = "paymentBannerDismissed";

const PaymentFailureBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const billingStatus = localStorage.getItem("billingStatus");
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    if (billingStatus === "past_due" && dismissed !== "true") {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-amber-600 dark:bg-amber-700 px-4 py-2.5 text-white text-sm shadow-md">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 flex-shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 1 0-2 0 1 1 0 0 0 2 0zm-1-8a1 1 0 0 0-1 1v3a1 1 0 0 0 2 0V6a1 1 0 0 0-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <span className="truncate">
          Your payment is overdue. Please update your payment method to avoid
          service interruption.
        </span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Link
          to="/licenses-billing"
          className="inline-flex items-center rounded bg-white/20 hover:bg-white/30 px-3 py-1 text-sm font-medium text-white transition-colors"
        >
          View Billing
        </Link>
        <button
          onClick={handleDismiss}
          className="rounded p-1 hover:bg-white/20 transition-colors"
          aria-label="Dismiss banner"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default PaymentFailureBanner;
