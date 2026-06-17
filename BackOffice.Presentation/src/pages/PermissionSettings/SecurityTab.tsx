import React, { useState, useEffect } from 'react';
import { authService } from '../../services/authService';

const SecurityTab: React.FC = () => {
  const [force30Day, setForce30Day] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const value = await authService.getMfaConfig('MfaForce30DayReauth');
        setForce30Day(value !== 'false');
      } catch {
        // Default to true if config not found
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleToggle = async () => {
    const newValue = !force30Day;
    setSaving(true);
    try {
      await authService.setMfaConfig('MfaForce30DayReauth', newValue ? 'true' : 'false');
      setForce30Day(newValue);
    } catch {
      // revert on failure
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-1">
              Two-Factor Authentication Settings
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Configure MFA behavior for all users in this organization.
            </p>

            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                  Force 30-day re-verification
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {force30Day
                    ? 'Remembered devices expire after 30 days. Users must re-verify.'
                    : 'Remembered devices never expire. Users only verify once per device.'}
                </p>
              </div>
              <button
                onClick={handleToggle}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 ${
                  force30Day ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
                role="switch"
                aria-checked={force30Day}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    force30Day ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityTab;
