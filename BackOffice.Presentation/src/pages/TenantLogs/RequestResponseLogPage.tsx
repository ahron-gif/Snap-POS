import React, { useState, useCallback, memo, useMemo, useRef } from "react"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { CustomContextMenuItem } from "../../components/common/ServerGrid/components/GridBody"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import {
  convertToGridColumns,
  cellRenderers,
  GridColDef,
} from "../../gridUtils"
import ActionHeader from "../../components/common/ActionHeader"
import { API_ENDPOINTS } from "../../constants/api"
import { useExportHandlers } from "../../hooks/useExportHandlers"
import { useExportModal } from "../../hooks/useExportModal"
import ExportModal from "../../components/common/ExportModal"
import axios from "axios"
import { useGridSettings } from "../../hooks/useGridSettings"

// Request/Response Log record interface
interface RequestResponseLogRecord {
  requestId: number
  requestData: string | null
  requestCreatedAt: string | null
  methodName: string | null
  controllerName: string | null
  registrationID: string | null
  token: string | null
  responseId: number | null
  responseData: string | null
  responseCreatedAt: string | null
}

// JSON Viewer Modal Component
const JsonViewerModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  title: string
  jsonData: string | null
  dataType: 'request' | 'response'
}> = ({ isOpen, onClose, title, jsonData, dataType }) => {
  if (!isOpen) return null

  const formatJson = (data: string | null): string => {
    if (!data) return "No data available"

    let jsonString = data

    // Try to parse - handle double-escaped JSON strings
    // Sometimes the data comes as a string wrapped in quotes with escaped characters
    try {
      // First attempt: direct parse
      let parsed = JSON.parse(jsonString)

      // If the result is still a string, it might be double-encoded
      // Try parsing again
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed)
        } catch {
          // If second parse fails, use the first parsed result
        }
      }

      return JSON.stringify(parsed, null, 2)
    } catch {
      // If JSON parse fails, try to clean up the string
      // Remove leading/trailing quotes if present
      if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
        jsonString = jsonString.slice(1, -1)
      }

      // Replace escaped quotes and newlines
      jsonString = jsonString
        .replace(/\\"/g, '"')
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\n')
        .replace(/\\t/g, '  ')

      // Try parsing the cleaned string
      try {
        const parsed = JSON.parse(jsonString)
        return JSON.stringify(parsed, null, 2)
      } catch {
        // Return the cleaned string as-is
        return jsonString
      }
    }
  }

  const formattedData = formatJson(jsonData)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        style={{ margin: '20px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
              dataType === 'request'
                ? 'bg-brand-50 text-brand-700'
                : 'bg-green-100 text-green-800'
            }`}>
              {dataType === 'request' ? 'Request' : 'Response'}
            </span>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <pre
            className="bg-gray-50 text-gray-800 p-4 rounded-lg overflow-auto text-sm font-mono border border-gray-200"
            style={{ minHeight: '300px', maxHeight: '500px' }}
          >
            {formattedData}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-200">
          <button
            onClick={() => {
              navigator.clipboard.writeText(formattedData)
            }}
            className="px-4 py-2 mr-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy to Clipboard
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// Has Response badge renderer
const hasResponseCellRenderer = (hasResponse: boolean): React.ReactNode => {
  return React.createElement(
    "span",
    {
      style: {
        padding: "2px 8px",
        borderRadius: "12px",
        backgroundColor: hasResponse ? "#dcfce7" : "#f3f4f6",
        color: hasResponse ? "#166534" : "#6b7280",
        fontSize: "12px",
        fontWeight: "500",
      },
    },
    hasResponse ? "Yes" : "No"
  )
}

// Column definitions for combined request/response logs (without data columns)
const logColumnDefs: GridColDef[] = [
  {
    field: "requestId",
    headerName: "Request ID",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
  },
  {
    field: "methodName",
    headerName: "Call Type",
    width: 250,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "requestCreatedAt",
    headerName: "Request Time",
    width: 220,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "responseId",
    headerName: "Has Response",
    width: 140,
    type: "boolean",
    sortable: true,
    filterable: false,
    cellRenderer: (value: number | null) => hasResponseCellRenderer(value !== null),
  },
  {
    field: "responseCreatedAt",
    headerName: "Response Time",
    width: 220,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "requestData",
    headerName: "Request",
    width: 250,
    type: "string",
    sortable: false,
    filterable: true,
  },
  {
    field: "responseData",
    headerName: "Response",
    width: 250,
    type: "string",
    sortable: false,
    filterable: true,
  },
]

const TENANT_LOGS_GRID_ID = "tenant-logs-list-grid"

const RequestResponseLogPage = memo(function RequestResponseLogPage() {
  const { getAuthHeaders } = useAuthHeaders()

  // State for search functionality
  const [searchText, setSearchText] = useState("")
  const [debouncedSearchText, setDebouncedSearchText] = useState("")

  // State for bulk selection
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [totalRecords, setTotalRecords] = useState(0)
  const [loadedCount, setLoadedCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [remountKey, setRemountKey] = useState(0)

  // State for JSON viewer modal
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState("")
  const [modalJsonData, setModalJsonData] = useState<string | null>(null)
  const [modalDataType, setModalDataType] = useState<'request' | 'response'>('request')


  // Refs for page navigation callbacks from ServerGrid
  const pageNavigationRef = React.useRef<{
    goToFirstPage: () => void
    goToPreviousPage: () => void
    goToNextPage: () => void
    goToLastPage: () => void
  } | null>(null)

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean
    message: string
    type: "success" | "error" | "info"
  }>({
    show: false,
    message: "",
    type: "success",
  })

  // Grid data ref for export
  const gridDataRef = useRef<any[]>([])

  // Memoize auth headers to prevent re-creation
  const memoizedGetAuthHeaders = useCallback(() => {
    return getAuthHeaders()
  }, [getAuthHeaders])

  // Convert column definitions to grid format (memoized)
  const defaultColumns = useMemo(() => convertToGridColumns(logColumnDefs), [])

  const {
    columns,
    setColumns,
    updateColumnVisibility,
    updateColumnWidth,
    updateColumnAggregate,
  } = useGridSettings(TENANT_LOGS_GRID_ID, defaultColumns)

  const handleColumnsChange = useCallback(
    (newColumns: any[]) => setColumns(newColumns),
    [setColumns],
  )

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchText])


  // Create API search parameters
  const additionalParams = useMemo(() => {
    if (!debouncedSearchText.trim()) {
      return {}
    }

    return {
      CustomGridSearchText: debouncedSearchText.trim(),
      CustomGridSearchColumns: "methodName,requestData,responseData",
    }
  }, [debouncedSearchText])

  // Handle search input change
  const handleSearchInputChange = useCallback((value: string) => {
    setSearchText(value)
  }, [])

  // Handle search on Enter key press
  const handleSearchKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        setDebouncedSearchText(searchText)
      }
    },
    [searchText]
  )

  // Toast notification function
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      setToast({ show: true, message, type })
      setTimeout(() => {
        setToast({ show: false, message: "", type: "success" })
      }, 3000)
    },
    []
  )

  // Handle row selection
  const handleRowSelection = useCallback((requestId: string) => {
    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = new Set(prevSelectedRows)
      if (newSelectedRows.has(requestId)) {
        newSelectedRows.delete(requestId)
      } else {
        newSelectedRows.add(requestId)
      }
      return newSelectedRows
    })
  }, [])

  // Handle deselect all
  const handleDeselectAll = useCallback(() => {
    setSelectedRows(new Set())
  }, [])

  // Handle remount grid
  const handleRemountGrid = useCallback(() => {
    setSelectedRows(new Set())
    setSearchText("")
    setDebouncedSearchText("")
    setRemountKey((prev) => prev + 1)
    showToast("Grid refreshed and search cleared", "info")
  }, [showToast])

  // Store reference to ServerGrid's select all function
  const serverGridSelectAllRef = React.useRef<(() => void) | null>(null)

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (serverGridSelectAllRef.current) {
      serverGridSelectAllRef.current()
    } else {
      showToast("Selecting all logs...", "info")
    }
  }, [showToast])


  // Handle showing request data
  const handleShowRequestData = useCallback((row: RequestResponseLogRecord) => {
    setModalTitle(`Request #${row.requestId} - ${row.controllerName || 'Unknown'}/${row.methodName || 'Unknown'}`)
    setModalJsonData(row.requestData)
    setModalDataType('request')
    setModalOpen(true)
  }, [])

  // Handle showing response data
  const handleShowResponseData = useCallback((row: RequestResponseLogRecord) => {
    if (!row.responseData && !row.responseId) {
      showToast("No response data available for this request", "info")
      return
    }
    setModalTitle(`Response for Request #${row.requestId} - ${row.controllerName || 'Unknown'}/${row.methodName || 'Unknown'}`)
    setModalJsonData(row.responseData)
    setModalDataType('response')
    setModalOpen(true)
  }, [showToast])

  // Handle row double-click - show request data by default
  const handleRowUpdate = useCallback(
    (row: RequestResponseLogRecord) => {
      handleShowRequestData(row)
    },
    [handleShowRequestData]
  )

  // Close modal
  const handleCloseModal = useCallback(() => {
    setModalOpen(false)
    setModalJsonData(null)
  }, [])

  // Fetch all data for export/print
  const fetchAllData = useCallback(async (dateFrom?: string, dateTo?: string): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const response = await axios({
        method: "GET",
        url: API_ENDPOINTS.REQUEST_RESPONSE_LOGS.GET_COMBINED,
        params: {
          startRow: 0,
          endRow: 10000,
          sortColumn: "requestCreatedAt",
          sortDirection: "desc",
        },
        headers,
      })
      if (response.data?.isSuccess) {
        return response.data.response.data || []
      }
      return []
    } catch (error) {
      console.error("Failed to fetch all data:", error)
      return []
    }
  }, [getAuthHeaders])

  // Use the export handlers hook
  const {
    handleExportCSV,
    handleExportPDF,
    handleExportExcel,
    handlePrint,
    isExporting,
    isPrinting,
  } = useExportHandlers({
    columns,
    gridDataRef,
    fetchAllData,
    filename: "request-response-logs",
    pdfOptions: { title: "Request/Response Logs", orientation: "landscape" },
  })

  // Export modal
  const exportModal = useExportModal({
    columns,
    fetchAllData,
    filename: "request-response-log",
    pdfOptions: { title: "Request Response Log", orientation: "landscape" },
    dateFilterField: "dateCreated",
  })

  // Callback to receive grid data from ServerGrid
  const handleGridDataChange = useCallback((data: any[]) => {
    gridDataRef.current = data
  }, [])

  // Truncate helper for displaying data preview
  const truncateData = useCallback((data: string | null, maxLength = 80): string => {
    if (!data) return "—"
    const trimmed = data.length > maxLength ? data.substring(0, maxLength) + "..." : data
    return trimmed
  }, [])

  // Override requestData and responseData cell renderers to be clickable
  const columnsWithActions = useMemo(() => {
    const updatedColumns = columns.map((col) => {
      if (col.field === "requestData") {
        return {
          ...col,
          cellRenderer: (value: string | null, row: RequestResponseLogRecord) => (
            <span
              className="cursor-pointer text-brand-500 hover:text-brand-600 hover:underline truncate block"
              title="Click to view full request data"
              onClick={(e) => {
                e.stopPropagation()
                handleShowRequestData(row)
              }}
            >
              {truncateData(value)}
            </span>
          ),
        }
      }
      if (col.field === "responseData") {
        return {
          ...col,
          cellRenderer: (value: string | null, row: RequestResponseLogRecord) => (
            <span
              className={`truncate block ${
                row.responseId
                  ? "cursor-pointer text-green-600 hover:text-green-700 hover:underline"
                  : "text-gray-400"
              }`}
              title={row.responseId ? "Click to view full response data" : "No response available"}
              onClick={(e) => {
                if (!row.responseId) return
                e.stopPropagation()
                handleShowResponseData(row)
              }}
            >
              {truncateData(value)}
            </span>
          ),
        }
      }
      return col
    })
    return updatedColumns
  }, [columns, handleShowRequestData, handleShowResponseData, truncateData])

  // Custom context menu items for the grid
  const customContextMenuItems: CustomContextMenuItem[] = useMemo(() => [
    {
      label: "Show Request Data",
      icon: (
        <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      onClick: (row: RequestResponseLogRecord) => handleShowRequestData(row),
      color: "text-gray-700",
      hoverBgColor: "hover:bg-brand-50",
    },
    {
      label: "Show Response Data",
      icon: (
        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      onClick: (row: RequestResponseLogRecord) => handleShowResponseData(row),
      color: "text-gray-700",
      hoverBgColor: "hover:bg-green-50",
    },
  ], [handleShowRequestData, handleShowResponseData])

  return (
    <div
      className="request-response-log-page p-2 mx-auto md:p-2 min-h-full"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        margin: 0,
        paddingTop: "5px",
        paddingBottom: "5px",
      }}
    >
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[350px] max-w-[400px] transition-all duration-300 animate-slide-in">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                  toast.type === "success"
                    ? "bg-green-100"
                    : toast.type === "error"
                    ? "bg-red-100"
                    : "bg-brand-50"
                }`}
              >
                <svg
                  className={`w-6 h-6 ${
                    toast.type === "success"
                      ? "text-green-600"
                      : toast.type === "error"
                      ? "text-red-600"
                      : "text-brand-500"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {toast.type === "success" && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  )}
                  {toast.type === "error" && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  )}
                  {toast.type === "info" && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  )}
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  {toast.type === "success" && "Success"}
                  {toast.type === "error" && "Error"}
                  {toast.type === "info" && "Information"}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">{toast.message}</p>
              </div>

              <button
                onClick={() =>
                  setToast({ show: false, message: "", type: "success" })
                }
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
              <div
                className={`h-1 rounded-full ${
                  toast.type === "success"
                    ? "bg-green-500"
                    : toast.type === "error"
                    ? "bg-red-500"
                    : "bg-brand-500"
                }`}
                style={{
                  width: "100%",
                  animation: "progressBar 3s linear forwards",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* JSON Viewer Modal */}
      <JsonViewerModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        title={modalTitle}
        jsonData={modalJsonData}
        dataType={modalDataType}
      />

      {/* Action Header with Search */}
      <ActionHeader
        selectedCount={selectedRows.size}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onBulkDelete={() => showToast("Delete not available for logs", "info")}
        onBulkExport={() => showToast("Exporting logs...", "info")}
        totalCount={totalRecords}
        loadedCount={loadedCount}
        itemType="logs"
        onRemountGrid={handleRemountGrid}
        showToast={showToast}
        searchText={searchText}
        onSearchChange={handleSearchInputChange}
        onSearchKeyPress={handleSearchKeyPress}
        currentPage={currentPage}
        totalPages={totalPages}
        onFirstPage={() => pageNavigationRef.current?.goToFirstPage()}
        onPreviousPage={() => pageNavigationRef.current?.goToPreviousPage()}
        onNextPage={() => pageNavigationRef.current?.goToNextPage()}
        onLastPage={() => pageNavigationRef.current?.goToLastPage()}
        staticActions={{}}
        showExportPrintButtons={true}
        onRefresh={() => {
          showToast("Refreshing grid...", "info")
          setTimeout(handleRemountGrid, 300)
        }}
        onExport={exportModal.open}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        onPrint={handlePrint}
        isExporting={isExporting}
        isPrinting={isPrinting}
      />

      {/* Main Grid Component */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ServerGrid
          key={`request-response-logs-grid-${remountKey}`}
          data={[]}
          columns={columnsWithActions}
          gridId={TENANT_LOGS_GRID_ID}
          onColumnVisibilityChange={updateColumnVisibility}
          onColumnWidthChange={updateColumnWidth}
          onColumnsChange={handleColumnsChange}
          onAggregateChange={updateColumnAggregate}
          loading={false}
          error={null}
          totalRecords={totalRecords}
          onRowUpdate={handleRowUpdate}
          onRefresh={() => {}}
          pagination={true}
          pageSize={50}
          editable={false}
          columnChooser={true}
          title="Request/Response Logs"
          emptyMessage="No logs found"
          emptyIcon="📋"
          serverSide={true}
          apiUrl={API_ENDPOINTS.REQUEST_RESPONSE_LOGS.GET_COMBINED}
          methodType="GET"
          getAuthHeaders={memoizedGetAuthHeaders}
          defaultSortColumn="requestCreatedAt"
          containerWidth="47%"
          additionalParams={additionalParams}
          onRowSelection={handleRowSelection}
          selectedRows={selectedRows}
          setTotalRecords={setTotalRecords}
          setLoadedCount={setLoadedCount}
          setCurrentPage={setCurrentPage}
          setTotalPages={setTotalPages}
          onPageNavigation={(callbacks) => {
            pageNavigationRef.current = callbacks
          }}
          showCheckboxes={true}
          getRowId={(row) => row.requestId.toString()}
          onSelectAll={(selectAllFn) => {
            serverGridSelectAllRef.current = selectAllFn
          }}
          headerSearch={true}
          infiniteScroll={false}
          onDataChange={handleGridDataChange}
          customContextMenuItems={customContextMenuItems}
          hideDefaultContextMenuItems={true}
        />
      </div>

      {/* Embedded CSS for animations */}
      <style>
        {`
          @keyframes progressBar {
            0% { width: 100%; }
            100% { width: 0%; }
          }

          .animate-slide-in {
            animation: slideInFromRight 0.3s ease-out;
          }

          @keyframes slideInFromRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
      <ExportModal {...exportModal.modalProps} />
    </div>
  )
})

export default RequestResponseLogPage
