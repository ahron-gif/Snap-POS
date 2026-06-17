import React, { createContext, useContext, useState, useCallback, useRef } from "react"

// Types for export notification
export type ExportStatus = "idle" | "fetching" | "generating" | "complete" | "error"
export type ExportType = "csv" | "pdf" | "excel" | "print"

interface ExportNotification {
  id: string
  type: ExportType
  status: ExportStatus
  message: string
  recordCount?: number
  error?: string
  onCancel?: () => void
}

interface ExportNotificationContextType {
  notifications: ExportNotification[]
  startExport: (type: ExportType, onCancel?: () => void) => string
  updateExport: (id: string, status: ExportStatus, message?: string, recordCount?: number) => void
  completeExport: (id: string, recordCount: number) => void
  failExport: (id: string, error: string) => void
  removeNotification: (id: string) => void
}

const ExportNotificationContext = createContext<ExportNotificationContextType | null>(null)

// Icons
const SpinnerIcon = () => (
  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
)

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

const ErrorIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const CloseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const FileIcon = ({ type }: { type: ExportType }) => {
  const colors: Record<ExportType, string> = {
    csv: "text-green-500",
    pdf: "text-red-500",
    excel: "text-brand-500",
    print: "text-gray-600",
  }

  if (type === "print") {
    return (
      <svg className={`w-5 h-5 ${colors[type]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
    )
  }

  return (
    <svg className={`w-5 h-5 ${colors[type]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

// Single notification item component
const NotificationItem: React.FC<{
  notification: ExportNotification
  onRemove: (id: string) => void
}> = ({ notification, onRemove }) => {
  const { id, type, status, message, recordCount, error, onCancel } = notification

  const typeLabels: Record<ExportType, string> = {
    csv: "CSV",
    pdf: "PDF",
    excel: "Excel",
    print: "Print",
  }

  const isInProgress = status === "fetching" || status === "generating"
  const isComplete = status === "complete"
  const isError = status === "error"

  // Auto-dismiss successful notifications after 4 seconds
  React.useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => {
        onRemove(id)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [isComplete, id, onRemove])

  // Auto-dismiss error notifications after 6 seconds
  React.useEffect(() => {
    if (isError) {
      const timer = setTimeout(() => {
        onRemove(id)
      }, 6000)
      return () => clearTimeout(timer)
    }
  }, [isError, id, onRemove])

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-lg shadow-lg border
        transition-all duration-300 ease-in-out
        ${isComplete ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : ""}
        ${isError ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800" : ""}
        ${isInProgress ? "bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700" : ""}
      `}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {isInProgress && <SpinnerIcon />}
        {isComplete && <span className="text-green-500"><CheckIcon /></span>}
        {isError && <span className="text-red-500"><ErrorIcon /></span>}
      </div>

      {/* File type icon */}
      <div className="flex-shrink-0">
        <FileIcon type={type} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isError ? "text-red-700 dark:text-red-300" : "text-gray-900 dark:text-gray-100"}`}>
          {typeLabels[type]} {type === "print" ? "Job" : "Export"}
        </p>
        <p className={`text-xs ${isError ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}>
          {error || message}
          {recordCount !== undefined && isComplete && ` (${recordCount.toLocaleString()} records)`}
        </p>
      </div>

      {/* Cancel button (only for in-progress) */}
      {isInProgress && onCancel && (
        <button
          onClick={() => {
            onCancel()
            onRemove(id)
          }}
          className="flex-shrink-0 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      )}

      {/* Close button */}
      <button
        onClick={() => onRemove(id)}
        className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
      >
        <CloseIcon />
      </button>
    </div>
  )
}

// Provider component
export const ExportNotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<ExportNotification[]>([])
  const idCounter = useRef(0)

  const startExport = useCallback((type: ExportType, onCancel?: () => void): string => {
    const id = `export-${Date.now()}-${idCounter.current++}`
    const newNotification: ExportNotification = {
      id,
      type,
      status: "fetching",
      message: "Fetching data...",
      onCancel,
    }
    console.log("[ExportNotification] Starting export:", type, id)
    setNotifications(prev => [...prev, newNotification])
    return id
  }, [])

  const updateExport = useCallback((id: string, status: ExportStatus, message?: string, recordCount?: number) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === id
          ? { ...n, status, message: message || n.message, recordCount: recordCount ?? n.recordCount }
          : n
      )
    )
  }, [])

  const completeExport = useCallback((id: string, recordCount: number) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === id
          ? { ...n, status: "complete", message: "Download complete!", recordCount }
          : n
      )
    )
  }, [])

  const failExport = useCallback((id: string, error: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === id
          ? { ...n, status: "error", error }
          : n
      )
    )
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  return (
    <ExportNotificationContext.Provider
      value={{
        notifications,
        startExport,
        updateExport,
        completeExport,
        failExport,
        removeNotification,
      }}
    >
      {children}

      {/* Notification container - fixed position at bottom right */}
      {notifications.length > 0 && (
        <div
          className="fixed top-4 right-4 flex flex-col gap-2 max-w-sm"
          style={{ zIndex: 200000 }}
        >
          {notifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRemove={removeNotification}
            />
          ))}
        </div>
      )}
    </ExportNotificationContext.Provider>
  )
}

// Hook to use export notifications
export const useExportNotification = () => {
  const context = useContext(ExportNotificationContext)
  if (!context) {
    throw new Error("useExportNotification must be used within an ExportNotificationProvider")
  }
  return context
}

// Utility hook for common export workflow
export const useExportWithNotification = () => {
  const { startExport, updateExport, completeExport, failExport } = useExportNotification()

  const executeExport = useCallback(async <T,>(
    type: ExportType,
    fetchData: () => Promise<T[]>,
    exportFn: (data: T[]) => void,
    options?: { onCancel?: () => void }
  ): Promise<boolean> => {
    const id = startExport(type, options?.onCancel)

    try {
      // Fetch data
      updateExport(id, "fetching", "Fetching data...")
      const data = await fetchData()

      if (data.length === 0) {
        failExport(id, "No data to export")
        return false
      }

      // Generate file
      updateExport(id, "generating", `Generating ${type.toUpperCase()}...`, data.length)

      // Small delay to show the generating state
      await new Promise(resolve => setTimeout(resolve, 100))

      exportFn(data)

      completeExport(id, data.length)
      return true
    } catch (error) {
      console.error(`Export ${type} error:`, error)
      failExport(id, error instanceof Error ? error.message : "Export failed")
      return false
    }
  }, [startExport, updateExport, completeExport, failExport])

  return { executeExport }
}

export default ExportNotificationProvider
