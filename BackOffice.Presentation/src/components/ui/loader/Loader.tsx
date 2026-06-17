interface LoaderProps {
  /** Visual size of the spinner */
  size?: "sm" | "md" | "lg";
  /** Optional loading text below the spinner */
  label?: string;
  /** Additional wrapper class names */
  className?: string;
  /** Variant: "page" renders centered in a flex container, "inline" renders just the spinner */
  variant?: "page" | "inline";
}

const sizeMap = {
  sm: "h-5 w-5 border-2",
  md: "h-8 w-8 border-[3px]",
  lg: "h-12 w-12 border-[3px]",
};

/**
 * Consistent loader/spinner used across the application.
 *
 * - `variant="page"` (default): centers the spinner vertically & horizontally
 *   in a flex container. Use for page-level or section-level loading states.
 * - `variant="inline"`: renders just the spinner element, useful inside buttons
 *   or inline contexts.
 */
const Loader: React.FC<LoaderProps> = ({
  size = "md",
  label,
  className = "",
  variant = "page",
}) => {
  const spinner = (
    <div
      className={`animate-spin rounded-full border-brand-500/30 border-t-brand-500 ${sizeMap[size]}`}
    />
  );

  if (variant === "inline") {
    return spinner;
  }

  return (
    <div
      className={`flex flex-col items-center justify-center min-h-[200px] w-full ${className}`}
    >
      {spinner}
      {label && (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {label}
        </p>
      )}
    </div>
  );
};

export default Loader;
