import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import ExportModal from "../../components/common/ExportModal"
import { useReportExportModal } from "../../hooks/useReportExportModal"
import type { Column } from "../../gridUtils"

interface ReportFilters {
  dateFrom?: string
  dateTo?: string
  storeId?: string
  customerId?: string
  vendorId?: string
  itemId?: string
  departmentId?: string
}

interface ReportViewerProps {
  reportId: string
  reportName: string
  category: string
  filters: ReportFilters
}

interface ReportData {
  columns: { key: string; label: string; type?: "string" | "number" | "date" | "currency" }[]
  rows: Record<string, any>[]
  totalCount: number
  summary?: Record<string, any>
}

const ReportViewerPage: React.FC<ReportViewerProps> = ({ reportId, reportName, category, filters }) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const tableRef = useRef<HTMLTableElement>(null)

  // Fetch report data
  const fetchReportData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // TODO: Replace with actual API call based on reportId
      // For now, simulate report data
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Generate sample data based on report type
      const sampleData = generateSampleData(reportId, pageSize)
      setReportData(sampleData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report")
    } finally {
      setLoading(false)
    }
  }, [reportId, pageSize])

  useEffect(() => {
    fetchReportData()
  }, [fetchReportData, pageNumber])

  // Generate sample data based on report type
  const generateSampleData = (reportId: string, count: number): ReportData => {
    // Define common column structures based on report categories
    const reportConfigs: Record<string, ReportData> = {
      "items-inventory": {
        columns: [
          { key: "itemCode", label: "Item Code", type: "string" },
          { key: "description", label: "Description", type: "string" },
          { key: "department", label: "Department", type: "string" },
          { key: "onHand", label: "On Hand", type: "number" },
          { key: "cost", label: "Cost", type: "currency" },
          { key: "retail", label: "Retail", type: "currency" },
          { key: "totalValue", label: "Total Value", type: "currency" },
        ],
        rows: Array.from({ length: count }, (_, i) => ({
          itemCode: `ITM-${1000 + i}`,
          description: `Sample Item ${i + 1}`,
          department: ["Electronics", "Clothing", "Food", "Home"][i % 4],
          onHand: Math.floor(Math.random() * 100),
          cost: (Math.random() * 50 + 5).toFixed(2),
          retail: (Math.random() * 100 + 10).toFixed(2),
          totalValue: (Math.random() * 5000 + 100).toFixed(2),
        })),
        totalCount: 500,
        summary: {
          totalItems: 500,
          totalValue: "$125,430.00",
          totalOnHand: 12543,
        },
      },
      "customer-sales": {
        columns: [
          { key: "customerCode", label: "Customer Code", type: "string" },
          { key: "customerName", label: "Customer Name", type: "string" },
          { key: "invoiceCount", label: "Invoices", type: "number" },
          { key: "totalSales", label: "Total Sales", type: "currency" },
          { key: "totalPayments", label: "Payments", type: "currency" },
          { key: "balance", label: "Balance", type: "currency" },
        ],
        rows: Array.from({ length: count }, (_, i) => ({
          customerCode: `CUS-${2000 + i}`,
          customerName: `Customer ${i + 1}`,
          invoiceCount: Math.floor(Math.random() * 20 + 1),
          totalSales: (Math.random() * 10000 + 500).toFixed(2),
          totalPayments: (Math.random() * 8000 + 400).toFixed(2),
          balance: (Math.random() * 2000).toFixed(2),
        })),
        totalCount: 250,
        summary: {
          totalCustomers: 250,
          totalSales: "$523,430.00",
          totalBalance: "$45,230.00",
        },
      },
      "items-on-purchase-order": {
        columns: [
          { key: "poNumber", label: "PO Number", type: "string" },
          { key: "vendorName", label: "Vendor", type: "string" },
          { key: "itemCode", label: "Item Code", type: "string" },
          { key: "description", label: "Description", type: "string" },
          { key: "quantityOrdered", label: "Qty Ordered", type: "number" },
          { key: "quantityReceived", label: "Qty Received", type: "number" },
          { key: "balanceQty", label: "Balance", type: "number" },
          { key: "unitCost", label: "Unit Cost", type: "currency" },
          { key: "extendedCost", label: "Extended Cost", type: "currency" },
          { key: "orderDate", label: "Order Date", type: "date" },
          { key: "expectedDate", label: "Expected Date", type: "date" },
          { key: "status", label: "Status", type: "string" },
        ],
        rows: Array.from({ length: count }, (_, i) => ({
          poNumber: `PO-${4000 + i}`,
          vendorName: ["Vendor A", "Vendor B", "Vendor C", "Vendor D"][i % 4],
          itemCode: `ITM-${1000 + i}`,
          description: `Item on PO ${i + 1}`,
          quantityOrdered: Math.floor(Math.random() * 50 + 5),
          quantityReceived: Math.floor(Math.random() * 30),
          balanceQty: Math.floor(Math.random() * 25 + 1),
          unitCost: (Math.random() * 50 + 5).toFixed(2),
          extendedCost: (Math.random() * 2000 + 100).toFixed(2),
          orderDate: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          expectedDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          status: ["Open", "Partial", "Received", "Open"][i % 4],
        })),
        totalCount: 120,
        summary: {
          totalLines: 120,
          totalOrdered: 2450,
          totalBalance: 890,
        },
      },
      default: {
        columns: [
          { key: "id", label: "ID", type: "string" },
          { key: "name", label: "Name", type: "string" },
          { key: "date", label: "Date", type: "date" },
          { key: "amount", label: "Amount", type: "currency" },
          { key: "status", label: "Status", type: "string" },
        ],
        rows: Array.from({ length: count }, (_, i) => ({
          id: `REC-${3000 + i}`,
          name: `Record ${i + 1}`,
          date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          amount: (Math.random() * 1000 + 50).toFixed(2),
          status: ["Active", "Pending", "Completed", "Cancelled"][i % 4],
        })),
        totalCount: 1000,
      },
    }

    return reportConfigs[reportId] || reportConfigs.default
  }

  // --- Export Modal integration ---
  // Map the viewer's columns to the gridUtils/ExportModal Column shape, inferring a data type.
  const exportColumns = useMemo<Column[]>(() => {
    if (!reportData) return []
    return reportData.columns.map((col) => ({
      field: col.key,
      headerName: col.label,
      width: 140,
      dataType:
        col.type === "currency"
          ? "number"
          : col.type === "number"
          ? "number"
          : col.type === "date"
          ? "date"
          : "string",
    }))
  }, [reportData])

  // Pick the first date column (if any) for the modal's date range filter
  const dateField = useMemo(() => {
    return reportData?.columns.find((c) => c.type === "date")?.key
  }, [reportData])

  const fetchAllDataForExport = useCallback(async (): Promise<any[]> => {
    return reportData?.rows ?? []
  }, [reportData])

  const exportModal = useReportExportModal({
    columns: exportColumns,
    fetchAllData: fetchAllDataForExport,
    filename: reportName.replace(/\s+/g, "_").toLowerCase() || "report",
    title: reportName,
    subtitle:
      filters.dateFrom && filters.dateTo
        ? `${filters.dateFrom} - ${filters.dateTo}`
        : undefined,
    dateField: dateField ?? "date",
    defaultDateFrom: filters.dateFrom,
    defaultDateTo: filters.dateTo,
  })

  // Format cell value based on type
  const formatValue = (value: any, type?: string) => {
    if (value === null || value === undefined) return "-"
    switch (type) {
      case "currency":
        return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      case "number":
        return Number(value).toLocaleString()
      case "date":
        return new Date(value).toLocaleDateString()
      default:
        return value
    }
  }

  const totalPages = reportData ? Math.ceil(reportData.totalCount / pageSize) : 0

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{reportName}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="capitalize">{category} Report</span>
              {filters.dateFrom && filters.dateTo && (
                <>
                  <span>•</span>
                  <span>{filters.dateFrom} to {filters.dateTo}</span>
                </>
              )}
              {reportData && (
                <>
                  <span>•</span>
                  <span>{reportData.totalCount.toLocaleString()} records</span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={fetchReportData}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

            <button
              onClick={exportModal.open}
              disabled={loading || !reportData}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              title="Preview, filter, and export"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards (if available) */}
      {reportData?.summary && (
        <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-4">
            {Object.entries(reportData.summary).map(([key, value]) => (
              <div key={key} className="bg-gray-50 dark:bg-gray-700 rounded-lg px-4 py-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white mt-0.5">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
          {/* Loading State */}
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Loading report...</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center">
                <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium text-gray-900 dark:text-white">Error Loading Report</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
                <button
                  onClick={fetchReportData}
                  className="mt-2 px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          {!loading && !error && reportData && (
            <>
              <div className="flex-1 overflow-auto">
                <table ref={tableRef} className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      {reportData.columns.map((col) => (
                        <th
                          key={col.key}
                          className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white whitespace-nowrap"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {reportData.rows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        {reportData.columns.map((col) => (
                          <td
                            key={col.key}
                            className={`px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap ${
                              col.type === "number" || col.type === "currency" ? "text-right" : ""
                            }`}
                          >
                            {formatValue(row[col.key], col.type)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {((pageNumber - 1) * pageSize) + 1} to {Math.min(pageNumber * pageSize, reportData.totalCount)} of {reportData.totalCount.toLocaleString()} records
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setPageNumber(1)
                    }}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                    <option value={250}>250 per page</option>
                    <option value={500}>500 per page</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPageNumber(1)}
                    disabled={pageNumber === 1}
                    className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                    disabled={pageNumber === 1}
                    className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                    Page {pageNumber} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPageNumber(p => Math.min(totalPages, p + 1))}
                    disabled={pageNumber === totalPages}
                    className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setPageNumber(totalPages)}
                    disabled={pageNumber === totalPages}
                    className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Last
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default ReportViewerPage
