import React from "react"

/**
 * Tiny single-button info modal. Used in place of `window.alert` for in-app
 * warnings (e.g. the Shift Report's "This Batch has to closed in order reconcile.").
 */

interface InfoModalProps {
  open: boolean
  title?: string
  message: string
  onClose: () => void
  variant?: "info" | "warning" | "error"
}

const InfoModal: React.FC<InfoModalProps> = ({ open, title, message, onClose, variant = "warning" }) => {
  if (!open) return null

  const accent =
    variant === "error"   ? "text-red-600    bg-red-50    border-red-200"   :
    variant === "info"    ? "text-blue-700   bg-blue-50   border-blue-200"  :
                            "text-amber-700  bg-amber-50  border-amber-200"

  const icon =
    variant === "error" ? (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ) : variant === "info" ? (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ) : (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50">
      <div className="w-[95%] max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-xl flex flex-col">
        <div className="flex items-start gap-3 px-5 py-4">
          <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center border ${accent}`}>
            {icon}
          </div>
          <div className="flex-1">
            {title && (
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{title}</h2>
            )}
            <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

export default InfoModal
