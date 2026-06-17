import React from "react"

interface ProfileActionButtonProps {
  onClick?: () => void
  icon?: React.ReactNode
  children: React.ReactNode
  type?: "button" | "submit"
  disabled?: boolean
  variant?: "default" | "danger"
  /** Extra classes (e.g. responsive width helpers). */
  className?: string
}

/**
 * The single, consistent pill button used for every card action on the profile
 * page (Change Photo, Edit, Change Password, Enable/Disable MFA) so they all
 * share one shape, size and icon-then-label sequence.
 */
export default function ProfileActionButton({
  onClick,
  icon,
  children,
  type = "button",
  disabled = false,
  variant = "default",
  className = "",
}: ProfileActionButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium shadow-theme-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
  const styles =
    variant === "danger"
      ? "border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-800/50 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/10"
      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className}`}>
      {icon && <span className="flex items-center">{icon}</span>}
      {children}
    </button>
  )
}
