import React, { useEffect, useRef } from "react"

export type ConfirmDialogType = "warning" | "info" | "error" | "confirm"

export interface ConfirmDialogButton {
  label: string
  variant: "primary" | "danger" | "secondary" | "outline"
  value: string
}

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: (result: string) => void
  title: string
  message: string | React.ReactNode
  type?: ConfirmDialogType
  buttons?: ConfirmDialogButton[]
  /** If true, clicking backdrop does not close the dialog */
  persistent?: boolean
  /** When true, renders an × close button in the top-right corner that resolves with "cancel".
   *  Hidden automatically while `persistent` is true (e.g. mid-save) to prevent dismissal. */
  showCloseButton?: boolean
}

const defaultButtons: Record<string, ConfirmDialogButton[]> = {
  yesNo: [
    { label: "Yes", variant: "primary", value: "yes" },
    { label: "No", variant: "outline", value: "no" },
  ],
  yesNoCancel: [
    { label: "Yes", variant: "primary", value: "yes" },
    { label: "No", variant: "danger", value: "no" },
    { label: "Cancel", variant: "outline", value: "cancel" },
  ],
  ok: [
    { label: "OK", variant: "primary", value: "ok" },
  ],
} 

/**
 * Reusable confirmation dialog that returns the button value clicked.
 * Usage:
 *   <ConfirmDialog
 *     isOpen={showConfirm}
 *     onClose={(result) => { if (result === "yes") doSomething() }}i'oo====.*     title="Confirm"
 *     message="Are you sure?"
 *     buttons={[
 *       { label: "Yes", variant: "primary", value: "yes" },
 *       { label: "No", variant: "outline", value: "no" },
 *     ]}
 *   />
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = "confirm",
  buttons = defaultButtons.yesNo,
  persistent = false,
  showCloseButton = false,
}) => {
  const firstButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) {
      // Focus the last button (usually Cancel/No) for safety
      setTimeout(() => firstButtonRef.current?.focus(), 50)
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !persistent) {
        onClose("cancel")
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose, persistent])

  if (!isOpen) return null

  const iconMap: Record<ConfirmDialogType, { bg: string; color: string; icon: React.ReactNode }> = {
    warning: {
      bg: "bg-amber-50 dark:bg-amber-500/10",
      color: "text-amber-600 dark:text-amber-400",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      ),
    },
    info: {
      bg: "bg-brand-50 dark:bg-brand-500/10",
      color: "text-brand-600 dark:text-brand-400",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    error: {
      bg: "bg-red-50 dark:bg-red-500/10",
      color: "text-red-600 dark:text-red-400",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    confirm: {
      bg: "bg-brand-50 dark:bg-brand-500/10",
      color: "text-brand-600 dark:text-brand-400",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  }

  const variantClasses: Record<string, string> = {
    primary: "bg-brand-500 hover:bg-brand-600 text-white shadow-sm",
    danger: "bg-red-500 hover:bg-red-600 text-white shadow-sm",
    secondary: "bg-gray-500 hover:bg-gray-600 text-white shadow-sm",
    outline: "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700",
  }

  const { bg, color, icon } = iconMap[type]

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[99999]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
        onClick={() => !persistent && onClose("cancel")}
      />
      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-[fadeScaleIn_0.2s_ease-out]">
        {/* Close-X button (top-right) — opt-in via showCloseButton.
            Hidden while `persistent` is true so an in-flight save can't be dismissed. */}
        {showCloseButton && !persistent && (
          <button
            type="button"
            onClick={() => onClose("cancel")}
            aria-label="Close"
            className="absolute top-3 right-3 z-10 inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
              <span className={color}>{icon}</span>
            </div>
            {/* Content */}
            <div className={`flex-1 min-w-0 ${showCloseButton && !persistent ? 'pr-8' : ''}`}>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {typeof message === "string" ? <p>{message}</p> : message}
              </div>
            </div>
          </div>
        </div>
        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
          {buttons.map((btn, idx) => (
            <button
              key={btn.value}
              ref={idx === 0 ? firstButtonRef : undefined}
              type="button"
              onClick={() => onClose(btn.value)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 ${variantClasses[btn.variant]}`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
export { defaultButtons }
