import { useState, useCallback, useMemo } from "react"
import { Column, PDFExportOptions } from "../gridUtils"
import { ExportFilter, ExportModalProps } from "../components/common/ExportModal"

interface UseExportModalOptions {
  columns: Column[]
  fetchAllData: (dateFrom?: string, dateTo?: string) => Promise<any[]>
  filename: string
  pdfOptions?: PDFExportOptions
  filters?: ExportFilter[]
  /** Shorthand: auto-creates a dateRange filter for this field */
  dateFilterField?: string
  /** Custom label for the auto-created date filter (default: "Date Created") */
  dateFilterLabel?: string
}

interface UseExportModalReturn {
  isOpen: boolean
  open: () => void
  close: () => void
  modalProps: ExportModalProps
}

export const useExportModal = ({
  columns,
  fetchAllData,
  filename,
  pdfOptions,
  filters: customFilters,
  dateFilterField,
  dateFilterLabel = "Date Created",
}: UseExportModalOptions): UseExportModalReturn => {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  // Build filters: use custom filters if provided, or auto-create from dateFilterField
  const filters = useMemo<ExportFilter[] | undefined>(() => {
    if (customFilters) return customFilters
    if (dateFilterField) {
      return [
        {
          type: "dateRange" as const,
          field: dateFilterField,
          label: dateFilterLabel,
        },
      ]
    }
    return undefined
  }, [customFilters, dateFilterField, dateFilterLabel])

  const modalProps = useMemo<ExportModalProps>(
    () => ({
      isOpen,
      onClose: close,
      columns,
      fetchData: fetchAllData,
      filters,
      filename,
      pdfOptions,
    }),
    [isOpen, close, columns, fetchAllData, filters, filename, pdfOptions]
  )

  return { isOpen, open, close, modalProps }
}

export default useExportModal
