import { useHelp } from "../../context/HelpContext"

/**
 * Question-mark icon button that toggles the in-product help drawer.
 *
 * Use the optional `topicKey` to pin to a specific topic when the button is
 * inside a feature that wants its own dedicated help (e.g., a "?" next to a
 * confusing field).
 */
const HelpButton = ({
  topicKey,
  className = "",
  label,
}: {
  topicKey?: string
  className?: string
  label?: string
}) => {
  const { openHelp } = useHelp()

  return (
    <button
      type="button"
      onClick={() => openHelp(topicKey)}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 ${className}`}
      title={label ?? "Open help (F1)"}
      aria-label={label ?? "Open help"}
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {label && <span className="text-sm font-medium">{label}</span>}
    </button>
  )
}

export default HelpButton
