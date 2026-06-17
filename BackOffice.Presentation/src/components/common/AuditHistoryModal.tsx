import React, { useEffect, useState, useCallback } from "react";
import { auditLogService } from "../../services/auditLogService";
import { AuditLogGridItem, AuditLogDetail, FieldChange } from "../../types/auditLog";

interface AuditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  entityName?: string;
}

const ACTION_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  Create: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", label: "Created" },
  Update: { bg: "bg-brand-100 dark:bg-brand-900/30", text: "text-brand-700 dark:text-brand-400", label: "Updated" },
  Delete: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", label: "Deleted" },
};

function parseFieldChanges(detail: AuditLogDetail): FieldChange[] {
  const changedFieldNames = detail.changedFields?.split(",") ?? [];
  let oldObj: Record<string, unknown> = {};
  let newObj: Record<string, unknown> = {};

  try {
    if (detail.oldValue) oldObj = JSON.parse(detail.oldValue);
  } catch {
    oldObj = {};
  }
  try {
    if (detail.newValue) newObj = JSON.parse(detail.newValue);
  } catch {
    newObj = {};
  }

  if (detail.action === "Create") {
    return Object.entries(newObj).map(([field, value]) => ({
      field,
      oldValue: null,
      newValue: value != null ? String(value) : null,
    }));
  }

  if (detail.action === "Delete") {
    return Object.entries(oldObj).map(([field, value]) => ({
      field,
      oldValue: value != null ? String(value) : null,
      newValue: null,
    }));
  }

  return changedFieldNames.map((field) => ({
    field: field.trim(),
    oldValue: oldObj[field.trim()] != null ? String(oldObj[field.trim()]) : null,
    newValue: newObj[field.trim()] != null ? String(newObj[field.trim()]) : null,
  }));
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const AuditHistoryModal: React.FC<AuditHistoryModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
}) => {
  const [entries, setEntries] = useState<AuditLogGridItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, AuditLogDetail>>({});
  const [detailLoading, setDetailLoading] = useState<number | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!entityType || !entityId) return;
    setLoading(true);
    setExpandedId(null);
    setDetailCache({});
    const result = await auditLogService.getEntityHistory(entityType, entityId);
    if (result.success && result.data) {
      setEntries(result.data);
    } else {
      setEntries([]);
    }
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen, fetchHistory]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleToggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(id);

    if (!detailCache[id]) {
      setDetailLoading(id);
      const result = await auditLogService.getAuditLogDetail(id);
      if (result.success && result.data) {
        setDetailCache((prev) => ({ ...prev, [id]: result.data! }));
      }
      setDetailLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col overflow-hidden animate-modal-in">
        <div className="px-6 py-4 bg-indigo-50 dark:bg-indigo-900/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Audit History
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {entityName ? `${entityName} (${entityType})` : entityType} #{entityId}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No audit history found.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

              <div className="space-y-4">
                {entries.map((entry) => {
                  const style = ACTION_STYLES[entry.action] ?? ACTION_STYLES.Update;
                  const isExpanded = expandedId === entry.id;
                  const detail = detailCache[entry.id];
                  const isLoadingDetail = detailLoading === entry.id;

                  return (
                    <div key={entry.id} className="relative pl-10">
                      <div className={`absolute left-2.5 top-3 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${style.bg}`} />

                      <button
                        onClick={() => handleToggleExpand(entry.id)}
                        className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors bg-white dark:bg-gray-800"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
                              {style.label}
                            </span>
                            {entry.changedFields && entry.action === "Update" && (
                              <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[200px]">
                                {entry.changedFields}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.userId && (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                User #{entry.userId}
                              </span>
                            )}
                            <svg
                              className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {formatTimestamp(entry.createdAt)}
                        </p>
                      </button>

                      {isExpanded && (
                        <div className="mt-2 ml-2 p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                          {isLoadingDetail ? (
                            <div className="flex items-center justify-center py-4">
                              <svg className="animate-spin h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            </div>
                          ) : detail ? (
                            <div>
                              {detail.ipAddress && (
                                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                                  IP: {detail.ipAddress}
                                </p>
                              )}
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-gray-500 dark:text-gray-400">
                                    <th className="pb-2 pr-2 font-medium">Field</th>
                                    <th className="pb-2 pr-2 font-medium">Old Value</th>
                                    <th className="pb-2 font-medium">New Value</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                  {parseFieldChanges(detail).map((change) => (
                                    <tr key={change.field}>
                                      <td className="py-1.5 pr-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                        {change.field}
                                      </td>
                                      <td className="py-1.5 pr-2 text-red-600 dark:text-red-400 break-all max-w-[200px]">
                                        {change.oldValue ?? <span className="text-gray-300 dark:text-gray-600">-</span>}
                                      </td>
                                      <td className="py-1.5 text-green-600 dark:text-green-400 break-all max-w-[200px]">
                                        {change.newValue ?? <span className="text-gray-300 dark:text-gray-600">-</span>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
                              Failed to load details.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/30 flex justify-between items-center flex-shrink-0">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-500"
          >
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modal-in {
          animation: modalIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default AuditHistoryModal;
