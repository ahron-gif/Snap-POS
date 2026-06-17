import { useMemo } from "react"
import { Column, PDFExportOptions } from "../gridUtils"
import { ExportFilter } from "../components/common/ExportModal"
import { useExportModal } from "./useExportModal"

interface UseReportExportModalOptions {
  /** Columns to expose in the modal (same shape used by ServerGrid). */
  columns: Column[]
  /**
   * Fetches all rows to be filtered/exported by the modal.
   *
   * Receives the modal's current date range (`dateFrom` / `dateTo` in
   * `YYYY-MM-DD`) so the callback can scope its backend query to the user's
   * selected range, instead of pulling the entire dataset and filtering
   * client-side. Both args are undefined if no date filter is active.
   */
  fetchAllData: (dateFrom?: string, dateTo?: string) => Promise<any[]>
  /** Base filename (no extension). */
  filename: string
  /** PDF title shown at the top of the exported PDF / print sheet. */
  title: string
  /** PDF subtitle (e.g. store name, date range summary). */
  subtitle?: string
  /** Field on each row containing the date used for client-side date-range filtering. Default: "date". */
  dateField?: string
  /** Label shown above the date range picker in the modal. Default: "Date Range". */
  dateFilterLabel?: string
  /** Additional filters (select/text/dateRange) rendered alongside the auto date filter. */
  extraFilters?: ExportFilter[]
  /** Default "From" (YYYY-MM-DD) for the date range filter. Falls back to modal default (last 7 days). */
  defaultDateFrom?: string
  /** Default "To" (YYYY-MM-DD) for the date range filter. */
  defaultDateTo?: string
  /** PDF orientation. Reports default to landscape. */
  orientation?: "portrait" | "landscape"
}

/**
 * Thin wrapper around `useExportModal` for report pages.
 *
 * Reports share a common shape:
 *  - landscape PDF with title + subtitle
 *  - date range filter as the primary filter
 *  - optional extras (store, register, etc.)
 *
 * Returns the same `{ isOpen, open, close, modalProps }` object as `useExportModal`,
 * so callers render `<ExportModal {...modalProps} />` and trigger it with `open()`.
 */
export const useReportExportModal = ({
  columns,
  fetchAllData,
  filename,
  title,
  subtitle,
  dateField = "date",
  dateFilterLabel = "Date Range",
  extraFilters,
  defaultDateFrom,
  defaultDateTo,
  orientation = "landscape",
}: UseReportExportModalOptions) => {
  const filters = useMemo<ExportFilter[]>(
    () => [
      {
        type: "dateRange" as const,
        field: dateField,
        label: dateFilterLabel,
        defaultFrom: defaultDateFrom,
        defaultTo: defaultDateTo,
      },
      ...(extraFilters ?? []),
    ],
    [dateField, dateFilterLabel, defaultDateFrom, defaultDateTo, extraFilters]
  )

  const pdfOptions = useMemo<PDFExportOptions>(
    () => ({ title, subtitle, orientation }),
    [title, subtitle, orientation]
  )

  return useExportModal({
    columns,
    fetchAllData,
    filename,
    pdfOptions,
    filters,
  })
}

export default useReportExportModal
