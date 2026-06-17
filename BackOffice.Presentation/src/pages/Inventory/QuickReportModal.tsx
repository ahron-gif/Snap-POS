import React, { useState, useCallback, useEffect } from "react"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import Loader from "../../components/ui/loader/Loader"

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

interface QuickReportModalProps {
  isOpen: boolean
  onClose: () => void
  itemStoreId: string
  itemId: string
  upcCode: string
  description: string
  onHand: number | null
}

const QuickReportModal: React.FC<QuickReportModalProps> = ({
  isOpen,
  onClose,
  itemStoreId,
  itemId,
  upcCode,
  description,
  onHand,
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

  const fetchReport = useCallback(async (fromDate: string, toDate: string) => {
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
  }, [getAuthHeaders, itemStoreId, itemId])

  // Load data when modal opens or dates change
  useEffect(() => {
    if (isOpen && startDate && endDate) {
      fetchReport(startDate, endDate)
    }
  }, [isOpen, startDate, endDate, fetchReport])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-[900px] max-w-[95vw] max-h-[85vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-brand-500 rounded-t-lg">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Quick Report
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Item Info */}
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-600 dark:text-gray-400 min-w-[80px]">UPC Code:</span>
              <span className="text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 px-2 py-0.5 bg-white dark:bg-gray-900 rounded flex-1">
                {upcCode || "-"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-600 dark:text-gray-400 min-w-[80px]">Description:</span>
              <span className="text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 px-2 py-0.5 bg-white dark:bg-gray-900 rounded flex-1">
                {description || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Date Range */}
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4 text-xs flex-wrap">
          <div className="flex items-center gap-2">
            <label className="font-semibold text-gray-600 dark:text-gray-400">Date:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-brand-500"
            />
          </div>
          {/* Opening On Hand — where the running balance starts */}
          <div className="flex items-center gap-2">
            <label className="font-semibold text-gray-600 dark:text-gray-400">Opening On Hand:</label>
            <span className="border border-gray-300 dark:border-gray-600 px-2 py-0.5 bg-white dark:bg-gray-900 rounded w-20 text-right text-gray-900 dark:text-gray-100">
              {data?.openingOnHand ?? onHand ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="font-semibold text-gray-600 dark:text-gray-400">Until Date:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-brand-500"
            />
          </div>
          {/* Closing On Hand — balance as of the Until date */}
          <div className="flex items-center gap-2">
            <label className="font-semibold text-gray-600 dark:text-gray-400">Closing On Hand:</label>
            <span className="border border-gray-300 dark:border-gray-600 px-2 py-0.5 bg-white dark:bg-gray-900 rounded w-20 text-right text-gray-900 dark:text-gray-100">
              {data?.closingOnHand ?? 0}
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-4 py-2">
          {loading ? (
            <Loader label="Loading..." />
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
          ) : !data || data.items.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-gray-500 dark:text-gray-400 text-xs">No transactions found for this date range</p>
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 min-w-[100px]">
                    Store Name
                  </th>
                  <th className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 min-w-[80px]">
                    User
                  </th>
                  <th className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 min-w-[100px]">
                    Type
                  </th>
                  <th className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 min-w-[90px]">
                    Date
                  </th>
                  <th className="px-2 py-1 text-right font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 min-w-[60px]">
                    Qty
                  </th>
                  <th className="px-2 py-1 text-right font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 min-w-[60px]">
                    Cs Qty
                  </th>
                  <th className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 min-w-[50px]">
                    UOM
                  </th>
                  <th className="px-2 py-1 text-right font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 min-w-[70px]">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr
                    key={`${item.id}-${index}`}
                    className={`${
                      index % 2 === 0
                        ? "bg-white dark:bg-gray-900"
                        : "bg-gray-50 dark:bg-gray-800"
                    } hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors`}
                  >
                    <td className="px-2 py-0.5 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                      {item.storeName || "-"}
                    </td>
                    <td className="px-2 py-0.5 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                      {item.user || "-"}
                    </td>
                    <td className="px-2 py-0.5 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                      {item.type}
                    </td>
                    <td className="px-2 py-0.5 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                      {item.date ? new Date(item.date).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-2 py-0.5 text-right text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                      {item.qty ?? "-"}
                    </td>
                    <td className="px-2 py-0.5 text-right text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                      {item.csQty ?? "-"}
                    </td>
                    <td className="px-2 py-0.5 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                      {item.uom || "-"}
                    </td>
                    <td className="px-2 py-0.5 text-right font-medium text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                      {item.runningBalance ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-4 py-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default QuickReportModal
