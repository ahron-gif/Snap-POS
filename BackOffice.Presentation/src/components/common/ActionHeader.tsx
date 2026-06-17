import React, { useRef, useState, useEffect } from "react"
import ConfirmModal from "../ui/ConfirmModal"
import { gridColumnAccessService } from "../../services/gridColumnAccessService"
import {
  GRID_SETTINGS_RESET_EVENT,
  type GridSettingsResetDetail,
} from "./ServerGrid/gridSettingsEvents"

type DisplayMode = "table" | "card"

interface ActionHeaderProps {
  selectedCount: number
  onSelectAll: () => void
  onDeselectAll: () => void
  onBulkDelete: () => void
  onBulkExport?: () => void
  onBulkActivate?: () => void
  onBulkDeactivate?: () => void
  onBulkDisablePhoneOrder?: () => void
  onBulkEnablePhoneOrder?: () => void
  onBulkChanges?: () => void
  onBulkPrintLabels?: () => void
  onBulkAddToLabels?: () => void
  totalCount: number
  loadedCount?: number
  itemType: string
  onAddNew?: () => void
  onRemountGrid?: () => void
  showToast?: (message: string, type: "success" | "error" | "info") => void
  searchText?: string
  onSearchChange?: (value: string) => void
  onSearchKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  currentPage?: number
  totalPages?: number
  onFirstPage?: () => void
  onPreviousPage?: () => void
  onNextPage?: () => void
  onLastPage?: () => void
  onRefresh?: () => void
  onExport?: () => void  // Opens export modal (when provided, replaces dropdown)
  onExportCSV?: (exportAll: boolean) => void
  onExportPDF?: (exportAll: boolean) => void
  onExportExcel?: (exportAll: boolean) => void
  onPrint?: (printAll: boolean) => void
  isExporting?: boolean
  isPrinting?: boolean
  showExportPrintButtons?: boolean
  displayMode?: DisplayMode
  onDisplayModeChange?: (mode: DisplayMode) => void
  /**
   * When provided, renders a "Reset Grid" button in the toolbar next to
   * Refresh/Export. Clicking it opens a confirmation modal; on confirm we
   * call DELETE /api/GridColumnAccess/me/{gridId} (the user's own overrides
   * for THIS grid get deleted) and dispatch the shared 'grid-settings:reset'
   * event so useGridSettings refetches and the visible grid snaps back to
   * tenant defaults — no page reload, no per-page wiring beyond passing
   * this prop.
   *
   * Omit this prop to hide the button (default).
   */
  gridId?: string
}

// New interface for static action buttons
interface StaticActionButtonsProps {
  onView?: () => void
  onEdit?: () => void
  onDownloadReport?: () => void
  onDelete?: () => void
}

// Modern Button Component with variants
interface ModernButtonProps {
  onClick: () => void
  variant: "primary" | "secondary" | "danger" | "success" | "purple" | "outline"
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  size?: "sm" | "md"
  title?: string
  disabled?: boolean
}

const ModernButton: React.FC<ModernButtonProps> = ({
  onClick,
  variant,
  icon,
  children,
  className = "",
  size = "md",
  title,
  disabled = false,
}) => {
  const baseClasses = `
    inline-flex items-center gap-1.5 font-medium
    rounded-lg transition-all duration-200
    whitespace-nowrap select-none
  `

  const sizeClasses = size === "sm"
    ? "px-2.5 py-1 text-xs"
    : "h-8 px-3 text-xs"

  const variantClasses = {
    primary: `
      text-white shadow-sm hover:shadow
      active:scale-[0.97]
    `,
    secondary: `
      bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-700
      dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-600
      active:scale-[0.97]
    `,
    danger: `
      bg-red-500 text-white shadow-sm hover:bg-red-600 hover:shadow
      active:scale-[0.97]
    `,
    success: `
      bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 hover:shadow
      active:scale-[0.97]
    `,
    purple: `
      bg-violet-500 text-white shadow-sm hover:bg-violet-600 hover:shadow
      active:scale-[0.97]
    `,
    outline: `
      bg-white text-gray-500 border border-gray-200
      hover:bg-gray-50 hover:text-gray-700 hover:border-gray-300
      dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600
      dark:hover:bg-gray-700 dark:hover:text-gray-200
      active:scale-[0.97]
    `,
  }

  const primaryStyle = variant === 'primary' ? {
    background: '#1e40af',
    borderColor: '#1e40af',
  } : {}

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses} ${variantClasses[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      style={primaryStyle}
      title={title}
      disabled={disabled}
      onMouseEnter={variant === 'primary' ? (e) => { e.currentTarget.style.background = '#1a3799'; e.currentTarget.style.borderColor = '#1a3799'; } : undefined}
      onMouseLeave={variant === 'primary' ? (e) => { e.currentTarget.style.background = '#1e40af'; e.currentTarget.style.borderColor = '#1e40af'; } : undefined}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  )
}

// Icon Components (compact 3.5 size)
const SearchIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

const PlusIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.9 }}>
    <line x1="12" y1="5" x2="12" y2="19" strokeWidth={2.2} strokeLinecap="round" />
    <line x1="5" y1="12" x2="19" y2="12" strokeWidth={2.2} strokeLinecap="round" />
  </svg>
)

const RefreshIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M23 4v6h-6M1 20v-6h6" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const DownloadIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const ViewIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)

const CheckAllIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const CloseIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const ExportIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
)

const PrintIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
    <polyline points="6 9 6 2 18 2 18 9" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <rect x="6" y="14" width="12" height="8" rx="1" strokeWidth={1.8} />
  </svg>
)

const TableViewIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
)

const CardViewIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={2} />
    <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={2} />
    <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={2} />
    <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={2} />
  </svg>
)

const ChevronDownIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
  </svg>
)

const SpinnerIcon = () => (
  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
)

const FileIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
)

// Pagination Icons
const FirstPageIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
  </svg>
)

const PreviousPageIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
)

const NextPageIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)

const LastPageIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
)

// Pagination Navigation Button Component
interface PaginationButtonProps {
  onClick: () => void
  disabled: boolean
  icon: React.ReactNode
  title: string
}

const PaginationButton: React.FC<PaginationButtonProps> = ({ onClick, disabled, icon, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`
      p-1.5 rounded-lg transition-all duration-200
      ${disabled
        ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700'
      }
    `}
  >
    {icon}
  </button>
)

// Search section component
const SearchAndAddSection: React.FC<{
  itemType: string
  searchText: string
  onSearchChange?: (value: string) => void
  onSearchKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}> = React.memo(({ itemType, searchText, onSearchChange, onSearchKeyPress }) => {
  return (
    <div className="relative flex-1 min-w-0 max-w-[220px]">
      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
        <SearchIcon />
      </div>
      <input
        type="text"
        placeholder={`Search ${itemType}...`}
        value={searchText}
        onChange={(e) => onSearchChange?.(e.target.value)}
        onKeyPress={onSearchKeyPress}
        className="w-full h-8 pl-8 pr-8 rounded-md transition-all duration-150 outline-none"
        style={{
          fontSize: '13px',
          fontFamily: "'DM Sans', sans-serif",
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          color: '#0f172a',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.boxShadow = '0 0 0 3px #dbeafe'; e.currentTarget.style.background = '#ffffff'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#f1f5f9'; }}
      />
      {searchText && (
        <button
          onClick={() => onSearchChange?.("")}
          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  )
})

SearchAndAddSection.displayName = "SearchAndAddSection"

// Get item type label for Add button
const getItemLabel = (itemType: string): string => {
  if (itemType === "items") return "New Item"
  return "New"
}

// Selection bar button component
const SelBarButton: React.FC<{ onClick: () => void; danger?: boolean; children: React.ReactNode }> = ({ onClick, danger, children }) => (
  <button
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      height: '30px',
      padding: '0 11px',
      borderRadius: '6px',
      border: `1px solid ${danger ? 'rgba(252,165,165,0.3)' : 'rgba(255,255,255,0.15)'}`,
      background: danger ? 'transparent' : 'rgba(255,255,255,0.08)',
      color: danger ? '#fca5a5' : '#e0eeff',
      fontFamily: "'DM Sans', sans-serif",
      fontSize: '12px',
      fontWeight: 500,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    }}
    onMouseEnter={(e) => {
      if (danger) {
        e.currentTarget.style.background = 'rgba(220,38,38,0.25)';
        e.currentTarget.style.borderColor = 'rgba(252,165,165,0.5)';
        e.currentTarget.style.color = '#fecaca';
      } else {
        e.currentTarget.style.background = 'rgba(255,255,255,0.16)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
        e.currentTarget.style.color = '#fff';
      }
    }}
    onMouseLeave={(e) => {
      if (danger) {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.borderColor = 'rgba(252,165,165,0.3)';
        e.currentTarget.style.color = '#fca5a5';
      } else {
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
        e.currentTarget.style.color = '#e0eeff';
      }
    }}
  >
    {children}
  </button>
)

const SelBarDivider = () => (
  <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.15)', margin: '0 2px', flexShrink: 0 }} />
)

const ActionHeader: React.FC<
  ActionHeaderProps & { staticActions?: StaticActionButtonsProps }
> = ({
  selectedCount,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
  onBulkExport,
  onBulkActivate,
  onBulkDeactivate,
  onBulkDisablePhoneOrder,
  onBulkEnablePhoneOrder,
  onBulkChanges,
  onBulkPrintLabels,
  onBulkAddToLabels,
  totalCount,
  loadedCount,
  itemType,
  onAddNew,
  staticActions,
  onRemountGrid,
  showToast,
  searchText = "",
  onSearchChange,
  onSearchKeyPress,
  // Pagination props
  currentPage = 1,
  totalPages = 1,
  onFirstPage,
  onPreviousPage,
  onNextPage,
  onLastPage,
  // Export/Print props
  onRefresh,
  onExport,
  onExportCSV,
  onExportPDF,
  onExportExcel,
  onPrint,
  isExporting = false,
  isPrinting = false,
  showExportPrintButtons = false,
  displayMode,
  onDisplayModeChange,
  gridId,
}) => {
  // Export/Print dropdown states
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showPrintMenu, setShowPrintMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const printMenuRef = useRef<HTMLDivElement>(null)

  // Reset Grid state (Req 4): confirmation modal + in-flight guard. The
  // imports for gridColumnAccessService, ConfirmModal, and the shared event
  // are added at the top of the file.
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const handleResetGridConfirmed = async () => {
    if (!gridId || isResetting) return
    setIsResetting(true)
    try {
      const result = await gridColumnAccessService.resetMine(gridId)
      if (!result.isSuccess) {
        showToast?.(result.message || "Failed to reset grid", "error")
        setIsResetting(false)
        setShowResetConfirm(false)
        return
      }
      // Hard page reload after the DELETE returns. Trying to refresh in place
      // via an event bus is fragile — multiple hooks read the same data, and
      // any one of them missing a listener leaves the UI stale (the user has
      // hit this bug twice). A full reload is bulletproof: every hook
      // re-fetches on mount, no event coordination needed. The toast won't
      // be visible after reload, so we skip it.
      //
      // We still fire the shared event before the reload so any analytics /
      // dev-tools listening for it pick it up.
      const detail: GridSettingsResetDetail = { gridId, reason: "user-reset" }
      window.dispatchEvent(new CustomEvent(GRID_SETTINGS_RESET_EVENT, { detail }))
      window.location.reload()
    } catch (err) {
      console.error("[ActionHeader] Reset failed:", err)
      showToast?.("Failed to reset grid", "error")
      setIsResetting(false)
      setShowResetConfirm(false)
    }
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
      if (printMenuRef.current && !printMenuRef.current.contains(event.target as Node)) {
        setShowPrintMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Export/Print buttons component
  const ExportPrintButtons = () => {
    if (!showExportPrintButtons) return null

    return (
      <div className="flex items-center gap-1">
        {/* Refresh Button - prominent */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-[5px] h-8 px-3 font-medium rounded-md border transition-all active:scale-[0.97]"
            style={{ fontSize: '12.5px', background: '#ffffff', color: '#475569', borderColor: '#e2e8f0' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}
            title="Refresh"
          >
            <RefreshIcon />
            Refresh
          </button>
        )}

        {/* Reset Grid Button — appears only when the page passes a gridId.
            Wipes THIS user's column overrides for THIS grid; tenant defaults
            take over. Confirmed via ConfirmModal (no window.confirm). */}
        {gridId && (
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={isResetting}
            className="inline-flex items-center gap-[5px] h-8 px-3 font-medium rounded-md border transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ fontSize: '12.5px', background: '#ffffff', color: '#475569', borderColor: '#e2e8f0' }}
            onMouseEnter={(e) => { if (!isResetting) { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.borderColor = '#fcd34d'; e.currentTarget.style.color = '#92400e'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}
            title="Reset grid columns to the tenant default"
          >
            <RefreshIcon />
            {isResetting ? 'Resetting…' : 'Reset Grid'}
          </button>
        )}

        {/* Divider */}
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />

        {/* Export Button — single button mode when onExport is provided */}
        {onExport && (
          <button
            onClick={onExport}
            disabled={isExporting}
            className="inline-flex items-center gap-[5px] h-8 px-3 font-medium rounded-md border transition-all disabled:opacity-50"
            style={{ fontSize: '12.5px', background: '#ffffff', color: '#475569', borderColor: '#e2e8f0' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}
            title="Export"
          >
            {isExporting ? <SpinnerIcon /> : <ExportIcon />}
            Export
          </button>
        )}

        {/* Export Dropdown (legacy — used when onExport is NOT provided) */}
        {!onExport && (onExportCSV || onExportPDF || onExportExcel) && (
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              className="inline-flex items-center gap-[5px] h-8 px-3 font-medium rounded-md border transition-all disabled:opacity-50"
              style={{ fontSize: '12.5px', background: '#ffffff', color: '#475569', borderColor: '#e2e8f0' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#0f172a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}
              title="Export"
            >
              {isExporting ? <SpinnerIcon /> : <ExportIcon />}
              Export
              <ChevronDownIcon />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Current Page</div>
                  {onExportCSV && (
                    <button onClick={() => { onExportCSV(false); setShowExportMenu(false) }} className="w-full px-3 py-1.5 text-xs text-left text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                      <span className="text-emerald-500"><FileIcon /></span>
                      CSV
                    </button>
                  )}
                  {onExportPDF && (
                    <button onClick={() => { onExportPDF(false); setShowExportMenu(false) }} className="w-full px-3 py-1.5 text-xs text-left text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                      <span className="text-red-500"><FileIcon /></span>
                      PDF
                    </button>
                  )}
                  {onExportExcel && (
                    <button onClick={() => { onExportExcel(false); setShowExportMenu(false) }} className="w-full px-3 py-1.5 text-xs text-left text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                      <span className="text-brand-500"><FileIcon /></span>
                      Excel
                    </button>
                  )}
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 py-1">
                  <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">All Data</div>
                  {onExportCSV && (
                    <button onClick={() => { onExportCSV(true); setShowExportMenu(false) }} className="w-full px-3 py-1.5 text-xs text-left text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                      <span className="text-emerald-500"><FileIcon /></span>
                      CSV (All)
                    </button>
                  )}
                  {onExportPDF && (
                    <button onClick={() => { onExportPDF(true); setShowExportMenu(false) }} className="w-full px-3 py-1.5 text-xs text-left text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                      <span className="text-red-500"><FileIcon /></span>
                      PDF (All)
                    </button>
                  )}
                  {onExportExcel && (
                    <button onClick={() => { onExportExcel(true); setShowExportMenu(false) }} className="w-full px-3 py-1.5 text-xs text-left text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                      <span className="text-brand-500"><FileIcon /></span>
                      Excel (All)
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Print moved to ExportModal */}
      </div>
    )
  }
  const DisplayModeToggle = () => {
    if (!onDisplayModeChange || !displayMode) return null

    return (
      <>
        <div className="flex items-center bg-gray-100 dark:bg-gray-700/50 rounded-lg p-0.5">
          <button
            onClick={() => onDisplayModeChange("table")}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200 ${
              displayMode === "table"
                ? "bg-white dark:bg-gray-600 text-brand-600 dark:text-brand-400 shadow-sm"
                : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            }`}
            title="Table view"
          >
            <TableViewIcon />
          </button>
          <button
            onClick={() => onDisplayModeChange("card")}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200 ${
              displayMode === "card"
                ? "bg-white dark:bg-gray-600 text-brand-600 dark:text-brand-400 shadow-sm"
                : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            }`}
            title="Card view"
          >
            <CardViewIcon />
          </button>
        </div>
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />
      </>
    )
  }

  if (selectedCount === 0) {
    return (
      <>
      <div className="flex items-center justify-between gap-2 bg-white dark:bg-gray-900 border-b border-[#e2e8f0]" style={{ padding: '10px 20px' }}>
        <SearchAndAddSection
          itemType={itemType}
          searchText={searchText}
          onSearchChange={onSearchChange}
          onSearchKeyPress={onSearchKeyPress}
        />

        <div className="flex items-center gap-1">
          <DisplayModeToggle />

          <ExportPrintButtons />

          {staticActions && staticActions.onView && (
            <>
              <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />
              <ModernButton
                onClick={staticActions.onView}
                variant="outline"
                icon={<ViewIcon />}
              >
                View
              </ModernButton>
            </>
          )}

          {/* Add Button */}
          {onAddNew && (
            <>
              <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />
              <ModernButton
                onClick={onAddNew}
                variant="primary"
                icon={<PlusIcon />}
              >
                {getItemLabel(itemType)}
              </ModernButton>
            </>
          )}
        </div>
      </div>
      {/* Reset Grid confirmation modal. Lives at the root so it overlays
          the full page rather than nesting inside the toolbar. Only rendered
          when a gridId is configured (otherwise the button never appears). */}
      <ConfirmModal
        open={showResetConfirm}
        title="Reset grid columns?"
        message="This removes your column customizations for this grid (visibility, width, order, aggregate) and restores the tenant default view. Only your account is affected — other users keep their settings."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={handleResetGridConfirmed}
        onCancel={() => setShowResetConfirm(false)}
      />
      </>
    )
  }

  // Items selected - show selection action bar (dark blue bar matching HTML reference)
  return (
    <div
      className="flex items-center gap-1.5"
      style={{
        padding: '0 20px',
        height: '44px',
        background: '#1e2393',
        borderBottom: '1px solid #1a3799',
        animation: 'slideDown 0.15s ease',
        flexShrink: 0,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Selection count */}
      <div style={{
        fontSize: '12.5px',
        fontWeight: 600,
        color: '#bfdbfe',
        whiteSpace: 'nowrap',
        marginRight: '4px',
        paddingRight: '12px',
        borderRight: '1px solid #1e40af',
      }}>
        <span style={{ color: '#fff' }}>{selectedCount}</span> items selected
      </div>

      {/* Activate */}
      {onBulkActivate && (
        <SelBarButton onClick={onBulkActivate}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Activate
        </SelBarButton>
      )}

      {/* Deactivate */}
      {onBulkDeactivate && (
        <SelBarButton onClick={onBulkDeactivate}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          Deactivate
        </SelBarButton>
      )}

      {/* Divider */}
      {(onBulkActivate || onBulkDeactivate) && (onBulkDisablePhoneOrder || onBulkEnablePhoneOrder) && <SelBarDivider />}

      {/* Disable on Phone Order */}
      {onBulkDisablePhoneOrder && (
        <SelBarButton onClick={onBulkDisablePhoneOrder}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.8"/><line x1="12" y1="18" x2="12.01" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
          Disable on Phone Order
        </SelBarButton>
      )}

      {/* Enable on Phone Order */}
      {onBulkEnablePhoneOrder && (
        <SelBarButton onClick={onBulkEnablePhoneOrder}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.8"/><polyline points="9 12 11 14 15 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Enable on Phone Order
        </SelBarButton>
      )}

      {(onBulkDisablePhoneOrder || onBulkEnablePhoneOrder) && <SelBarDivider />}

      {/* Bulk Changes */}
      {onBulkChanges && (
        <SelBarButton onClick={onBulkChanges}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Bulk Changes
        </SelBarButton>
      )}

      {onBulkChanges && <SelBarDivider />}

      {/* Print Labels */}
      {onBulkPrintLabels && (
        <SelBarButton onClick={onBulkPrintLabels}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><rect x="6" y="14" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.8"/></svg>
          Print Labels
        </SelBarButton>
      )}

      {/* Add to Labels */}
      {onBulkAddToLabels && (
        <SelBarButton onClick={onBulkAddToLabels}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          Add to Labels
        </SelBarButton>
      )}

      {(onBulkPrintLabels || onBulkAddToLabels) && <SelBarDivider />}

      {/* Delete */}
      <SelBarButton onClick={onBulkDelete} danger>
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Delete
      </SelBarButton>

      {/* Deselect all - pushed to right */}
      <button
        onClick={onDeselectAll}
        style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          height: '28px',
          padding: '0 10px',
          borderRadius: '6px',
          border: 'none',
          background: 'transparent',
          color: '#93c5fd',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '12px',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#93c5fd'; e.currentTarget.style.background = 'transparent'; }}
      >
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        Deselect all
      </button>
    </div>
  )
}

// Static Action Header Component (keeping for backwards compatibility)
interface StaticActionHeaderProps {
  onEdit: () => void
  onDownloadReport: () => void
  onDelete: () => void
}

const StaticActionHeader: React.FC<StaticActionHeaderProps> = ({
  onEdit,
  onDownloadReport,
  onDelete,
}) => {
  return (
    <div className="flex items-center justify-between p-2 border-y border-slate-200 dark:border-slate-700 mb-1">
      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
        Row Actions:
      </span>

      <div className="flex items-center gap-2">
        <ModernButton onClick={onEdit} variant="primary" size="sm">
          Edit Selected
        </ModernButton>
        <ModernButton onClick={onDownloadReport} variant="success" size="sm">
          Download Report
        </ModernButton>
        <ModernButton onClick={onDelete} variant="danger" size="sm">
          Delete Selected
        </ModernButton>
      </div>
    </div>
  )
}

export default ActionHeader
export { StaticActionHeader }
