import React, { useState } from 'react';
import type { LoginConflictResponse } from '../../services/authService';

interface SessionConflictModalProps {
  isOpen: boolean;
  conflict: LoginConflictResponse | null;
  onConfirm: (sessionIdToRevoke?: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Unknown';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return 'Unknown';
  }
}

function truncateDevice(device: string | null | undefined): string {
  if (!device) return 'Unknown device';
  return device.length > 60 ? device.substring(0, 60) + '...' : device;
}

const SessionConflictModal: React.FC<SessionConflictModalProps> = ({
  isOpen,
  conflict,
  onConfirm,
  onCancel,
  loading,
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  if (!isOpen || !conflict) return null;

  const isUserSession = conflict.conflictType === 'user_session';
  const isCustomerLimit = conflict.conflictType === 'customer_limit';

  const handleConfirm = () => {
    if (isCustomerLimit) {
      onConfirm(selectedSessionId ?? undefined);
    } else {
      onConfirm();
    }
  };

  const isConfirmDisabled = loading || (isCustomerLimit && !selectedSessionId);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={!loading ? onCancel : undefined}
      />

      {/* Modal */}
      <div className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full mx-4 overflow-hidden ${isCustomerLimit ? 'max-w-lg' : 'max-w-md'}`}>
        {/* Header */}
        <div className={`px-6 py-4 ${isUserSession ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isUserSession
                ? 'bg-amber-100 dark:bg-amber-900/40'
                : 'bg-orange-100 dark:bg-orange-900/40'
            }`}>
              <svg
                className={`w-5 h-5 ${isUserSession ? 'text-amber-600' : 'text-orange-600'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isUserSession ? 'Active Session Detected' : 'User Limit Reached'}
              </h3>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            {conflict.message}
          </p>

          {/* User Session conflict — single session display */}
          {isUserSession && conflict.userActiveSession && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                Current Active Session
              </p>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Device:</span>
                  <span className="text-gray-700 dark:text-gray-200 text-right max-w-[60%] truncate" title={conflict.userActiveSession.deviceInfo || undefined}>
                    {truncateDevice(conflict.userActiveSession.deviceInfo)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">IP:</span>
                  <span className="text-gray-700 dark:text-gray-200">
                    {conflict.userActiveSession.ipAddress || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Last Active:</span>
                  <span className="text-gray-700 dark:text-gray-200">
                    {formatDate(conflict.userActiveSession.lastActivityAt)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Customer Limit conflict — selectable session list */}
          {isCustomerLimit && conflict.customerLimitInfo && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Active Sessions
                </p>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {conflict.customerLimitInfo.currentActive} / {conflict.customerLimitInfo.maxAllowed}
                </span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {conflict.activeSessions && conflict.activeSessions.map((session) => {
                  const isSelected = selectedSessionId === session.sessionId;
                  return (
                    <button
                      key={session.sessionId}
                      type="button"
                      onClick={() => setSelectedSessionId(session.sessionId)}
                      className={`w-full text-left rounded-lg p-3 border-2 transition-all ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-400'
                          : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Radio indicator */}
                        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          isSelected
                            ? 'border-orange-500 dark:border-orange-400'
                            : 'border-gray-300 dark:border-gray-500'
                        }`}>
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full bg-orange-500 dark:bg-orange-400" />
                          )}
                        </div>

                        {/* Session info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {session.userName || 'Unknown User'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5" title={session.deviceInfo || undefined}>
                            {truncateDevice(session.deviceInfo)}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              IP: {session.ipAddress || 'Unknown'}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              Last active: {formatDate(session.lastActivityAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500">
            {isUserSession
              ? 'The existing session will be logged out immediately.'
              : selectedSessionId
                ? 'The selected session will be logged out immediately.'
                : 'Select a session above to log out and make room for your login.'}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/30 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${
              isUserSession
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            {loading
              ? 'Signing in...'
              : isCustomerLimit
                ? 'Logout Selected & Continue'
                : 'Continue & Replace'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionConflictModal;
