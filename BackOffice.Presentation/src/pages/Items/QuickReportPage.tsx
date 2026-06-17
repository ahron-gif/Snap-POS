import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import dayjs, { Dayjs } from "dayjs"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs"
import { DatePicker } from "@mui/x-date-pickers/DatePicker"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"

interface QuickReportItem {
  id: string | null
  storeName: string | null
  user: string | null
  type: string
  date: string | null
  qty: number | null
  csQty: number | null
  uom: string | null
  runningBalance: number | null
}

interface QuickReportResponse {
  items: QuickReportItem[]
  openingOnHand: number
  closingOnHand: number
  total: number
  onHand: number
}

interface ApiResponse {
  isSuccess: boolean
  message: string
  response: QuickReportResponse
}

interface QuickReportPageProps {
  itemStoreId: string
  itemId: string
  upcCode: string
  description: string
  onHand: number | null
}

const QuickReportPage: React.FC<QuickReportPageProps> = ({
  itemStoreId,
  itemId,
  upcCode,
  description,
  onHand: initialOnHand,
}) => {
  const { getAuthHeaders } = useAuthHeaders()

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const getDefaultStartDate = () => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return formatDateForInput(d)
  }

  const [startDate, setStartDate] = useState(getDefaultStartDate)
  const [endDate, setEndDate] = useState(() => formatDateForInput(new Date()))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<QuickReportResponse | null>(null)

  const columns: Column[] = useMemo(
    () => [
      {
        field: "storeName",
        headerName: "Store Name",
        width: 150,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "string" as const,
      },
      {
        field: "user",
        headerName: "User",
        width: 120,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "string" as const,
      },
      {
        field: "type",
        headerName: "Type",
        width: 130,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "string" as const,
      },
      {
        field: "date",
        headerName: "Date",
        width: 120,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "date" as const,
        cellRenderer: (value: any) => {
          if (!value) return ""
          try {
            return new Date(value).toLocaleDateString()
          } catch {
            return value
          }
        },
      },
      {
        field: "qty",
        headerName: "Qty",
        width: 80,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "number" as const,
      },
      {
        field: "csQty",
        headerName: "Cs Qty",
        width: 80,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "number" as const,
      },
      {
        field: "uom",
        headerName: "UOM",
        width: 80,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "string" as const,
      },
      {
        field: "runningBalance",
        headerName: "Balance",
        width: 100,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "number" as const,
      },
    ],
    []
  )

  const gridData = useMemo(
    () =>
      data?.items?.map((row, idx) => ({ ...row, _rowIndex: idx })) || [],
    [data]
  )

  const fetchReport = useCallback(
    async (fromDate: string, toDate: string) => {
      setLoading(true)
      setError(null)
      try {
        const headers = getAuthHeaders()
        const params = new URLSearchParams()
        params.append("itemStoreId", itemStoreId)
        params.append("startDate", fromDate)
        params.append("endDate", toDate)
        if (itemId) {
          params.append("itemId", itemId)
        }

        const url = `${API_ENDPOINTS.ADJUST_INVENTORY.QUICK_REPORT}?${params.toString()}`
        const response = await fetch(url, { method: "GET", headers })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result: ApiResponse = await response.json()

        if (result.isSuccess) {
          setData(result.response)
        } else {
          setError(result.message || "Failed to fetch quick report")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    },
    [getAuthHeaders, itemStoreId, itemId]
  )

  // Load data on mount
  useEffect(() => {
    if (startDate && endDate) {
      fetchReport(startDate, endDate)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGo = () => {
    fetchReport(startDate, endDate)
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-brand-500">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Quick Report
        </h2>
      </div>

      {/* Item Info */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="grid grid-cols-1 gap-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-600 dark:text-gray-400 min-w-[80px]">
              UPC Code:
            </span>
            <span className="text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 px-2 py-0.5 bg-white dark:bg-gray-900 rounded flex-1">
              {upcCode || "-"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-600 dark:text-gray-400 min-w-[80px]">
              Description:
            </span>
            <span className="text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 px-2 py-0.5 bg-white dark:bg-gray-900 rounded flex-1">
              {description || "-"}
            </span>
          </div>
        </div>
      </div>

      {/* Date Range */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4 text-xs flex-wrap">
        <div className="flex items-center gap-2">
          <label className="font-semibold text-gray-600 dark:text-gray-400">
            Date:
          </label>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              value={dayjs(startDate)}
              onChange={(val: Dayjs | null) => {
                if (val && val.isValid()) {
                  setStartDate(val.format("YYYY-MM-DD"))
                }
              }}
              format="MM/DD/YYYY"
              slotProps={{
                textField: {
                  size: "small",
                  sx: {
                    width: 160,
                    "& .MuiInputBase-root": {
                      height: 28,
                      fontSize: "12px",
                    },
                    "& .MuiInputBase-input": {
                      padding: "4px 8px",
                      fontSize: "12px",
                    },
                  },
                },
              }}
            />
          </LocalizationProvider>
        </div>

        {/* Opening On Hand — the balance the running count starts from */}
        <div className="flex items-center gap-2">
          <label className="font-semibold text-gray-600 dark:text-gray-400">
            Opening On Hand:
          </label>
          <span className="border border-gray-300 dark:border-gray-600 px-2 py-0.5 bg-white dark:bg-gray-900 rounded w-20 text-right text-gray-900 dark:text-gray-100">
            {data?.openingOnHand ?? initialOnHand ?? 0}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="font-semibold text-gray-600 dark:text-gray-400">
            Until Date:
          </label>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              value={dayjs(endDate)}
              onChange={(val: Dayjs | null) => {
                if (val && val.isValid()) {
                  setEndDate(val.format("YYYY-MM-DD"))
                }
              }}
              format="MM/DD/YYYY"
              slotProps={{
                textField: {
                  size: "small",
                  sx: {
                    width: 160,
                    "& .MuiInputBase-root": {
                      height: 28,
                      fontSize: "12px",
                    },
                    "& .MuiInputBase-input": {
                      padding: "4px 8px",
                      fontSize: "12px",
                    },
                  },
                },
              }}
            />
          </LocalizationProvider>
        </div>

        {/* Closing On Hand — balance as of the Until date (opening + movements) */}
        <div className="flex items-center gap-2">
          <label className="font-semibold text-gray-600 dark:text-gray-400">
            Closing On Hand:
          </label>
          <span className="border border-gray-300 dark:border-gray-600 px-2 py-0.5 bg-white dark:bg-gray-900 rounded w-20 text-right text-gray-900 dark:text-gray-100">
            {data?.closingOnHand ?? 0}
          </span>
        </div>

        {/* Go Button */}
        <button
          type="button"
          onClick={handleGo}
          disabled={loading}
          className="px-4 py-1 bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-colors ml-auto"
        >
          Go
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto mb-2"></div>
              <p className="text-gray-500 dark:text-gray-400 text-xs">
                Loading...
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-center">
              <p className="text-red-500 text-xs mb-2">{error}</p>
              <button
                onClick={() => fetchReport(startDate, endDate)}
                className="px-3 py-1 bg-brand-500 text-white rounded hover:bg-brand-600 text-xs"
              >
                Retry
              </button>
            </div>
          </div>
        ) : !data || gridData.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-gray-500 dark:text-gray-400 text-xs">
              No transactions found for this date range
            </p>
          </div>
        ) : (
          <ServerGrid
            data={gridData}
            columns={columns}
            loading={false}
            totalRecords={gridData.length}
            serverSide={false}
            pagination={true}
            pageSize={50}
            headerSearch={true}
            showActions={false}
            columnChooser={true}
            defaultSortColumn="date"
            getRowId={(row: any) =>
              row._rowIndex?.toString() || Math.random().toString()
            }
            gridId="quick-report-page-grid"
          />
        )}
      </div>
    </div>
  )
}

export default QuickReportPage
