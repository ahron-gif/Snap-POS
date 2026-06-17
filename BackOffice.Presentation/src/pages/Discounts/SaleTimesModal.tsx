import React, { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Button from "../../components/ui/button/Button";
import Checkbox from "../../components/form/input/Checkbox";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";

interface SaleTimeRule {
  day: string;
  enabled: boolean;
  fromTime: string;
  toTime: string;
}

interface SaleTimesModalProps {
  saleTimes: SaleTimeRule[];
  onSave: (saleTimes: SaleTimeRule[]) => void;
  onClose: () => void;
  disabled?: boolean;
}

const SaleTimesModal: React.FC<SaleTimesModalProps> = ({
  saleTimes,
  onSave,
  onClose,
  disabled = false,
}) => {
  const [localTimes, setLocalTimes] = useState<SaleTimeRule[]>(
    saleTimes.map((t) => ({ ...t }))
  );

  const handleToggleDay = useCallback((index: number, enabled: boolean) => {
    setLocalTimes((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], enabled };
      return updated;
    });
  }, []);

  const handleTimeChange = useCallback(
    (index: number, field: "fromTime" | "toTime", value: string) => {
      setLocalTimes((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    },
    []
  );

  const handleToggleAll = useCallback(
    (checked: boolean) => {
      setLocalTimes((prev) => prev.map((t) => ({ ...t, enabled: checked })));
    },
    []
  );

  const handleApplyToAll = useCallback(
    (fromTime: string, toTime: string) => {
      setLocalTimes((prev) =>
        prev.map((t) => (t.enabled ? { ...t, fromTime, toTime } : t))
      );
    },
    []
  );

  const allEnabled = localTimes.every((t) => t.enabled);
  const someEnabled = localTimes.some((t) => t.enabled);

  // Get the first enabled day's times as reference for "apply to all"
  const firstEnabledDay = localTimes.find((t) => t.enabled);

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Sale Times
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Select All + Apply to all row */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
            <Checkbox
              label="Select All Days"
              checked={allEnabled}
              onChange={handleToggleAll}
              disabled={disabled}
            />
            {someEnabled && firstEnabledDay && !disabled && (
              <button
                type="button"
                onClick={() =>
                  handleApplyToAll(
                    firstEnabledDay.fromTime,
                    firstEnabledDay.toTime
                  )
                }
                className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
              >
                Apply first to all enabled
              </button>
            )}
          </div>

          {/* Day rows */}
          <div className="space-y-2">
            {localTimes.map((time, index) => (
              <div
                key={time.day}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  time.enabled
                    ? "bg-brand-50/50 dark:bg-brand-900/10"
                    : "bg-gray-50 dark:bg-gray-800/30"
                }`}
              >
                <div className="w-[130px]">
                  <Checkbox
                    label={time.day}
                    checked={time.enabled}
                    onChange={(checked) => handleToggleDay(index, checked)}
                    disabled={disabled}
                  />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] mb-0.5 text-gray-400">From</Label>
                    <Input
                      type="time"
                      value={time.fromTime}
                      onChange={(e) =>
                        handleTimeChange(index, "fromTime", e.target.value)
                      }
                      disabled={disabled || !time.enabled}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] mb-0.5 text-gray-400">To</Label>
                    <Input
                      type="time"
                      value={time.toTime}
                      onChange={(e) =>
                        handleTimeChange(index, "toTime", e.target.value)
                      }
                      disabled={disabled || !time.enabled}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          {!disabled && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onSave(localTimes)}
            >
              Save Times
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SaleTimesModal;
