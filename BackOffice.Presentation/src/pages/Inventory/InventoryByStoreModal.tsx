import React, { useState, useCallback, useEffect } from "react"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import Loader from "../../components/ui/loader/Loader"

interface InventoryByStoreItem {
  storeName: string | null
  onHand: number | null
  onOrder: number | null
  onTransfer: number | null
}

interface InventoryByStoreResponse {
  items: InventoryByStoreItem[]
}

interface ApiResponse {
  isSuccess: boolean
  message: string
  response: InventoryByStoreResponse
}

interface InventoryByStoreModalProps {
  isOpen: boolean
  onClose: () => void
  itemId: string
  description: string
}

const InventoryByStoreModal: React.FC<InventoryByStoreModalProps> = ({
  isOpen,
  onClose,
  itemId,
  description,
}) => {
  const { getAuthHeaders } = useAuthHeaders()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<InventoryByStoreResponse | null>(null)

  const fetchData = useCallback(async () => {
    if (!itemId) return
    setLoading(true)
    setError(null)
    try {
      const headers = getAuthHeaders()
      const params = new URLSearchParams()
      params.append("itemId", itemId)

      const url = `${API_ENDPOINTS.ADJUST_INVENTORY.INVENTORY_BY_STORE}?${params.toString()}`
      const response = await fetch(url, { method: "GET", headers })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiResponse = await response.json()

      if (result.isSuccess) {
        setData(result.response)
      } else {
        setError(result.message || "Failed to fetch inventory by store")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders, itemId])

  useEffect(() => {
    if (isOpen && itemId) {
      fetchData()
    }
  }, [isOpen, itemId, fetchData])

  if (!isOpen) return null

  // Calculate totals
  const totals = {
    onHand: data?.items.reduce((sum, item) => sum + (item.onHand ?? 0), 0) ?? 0,
    onOrder: data?.items.reduce((sum, item) => sum + (item.onOrder ?? 0), 0) ?? 0,
    onTransfer: data?.items.reduce((sum, item) => sum + (item.onTransfer ?? 0), 0) ?? 0,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-[600px] max-w-[95vw] max-h-[85vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-brand-500 rounded-t-lg">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            Inventory By Store
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
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-gray-600 dark:text-gray-400 min-w-[80px]">Description:</span>
            <span className="text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 px-2 py-0.5 bg-white dark:bg-gray-900 rounded flex-1">
              {description || "-"}
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
                  onClick={fetchData}
                  className="px-3 py-1 bg-brand-500 text-white rounded hover:bg-brand-600 text-xs"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-gray-500 dark:text-gray-400 text-xs">No store inventory found for this item</p>
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 min-w-[180px]">
                    Store Name
                  </th>
                  <th className="px-2 py-1 text-right font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 min-w-[80px]">
                    On Hand
                  </th>
                  <th className="px-2 py-1 text-right font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 min-w-[80px]">
                    On Order
                  </th>
                  <th className="px-2 py-1 text-right font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 min-w-[80px]">
                    On Transfer
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr
                    key={index}
                    className={`${
                      index % 2 === 0
                        ? "bg-white dark:bg-gray-900"
                        : "bg-gray-50 dark:bg-gray-800"
                    } hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors`}
                  >
                    <td className="px-2 py-0.5 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                      {item.storeName || "-"}
                    </td>
                    <td className="px-2 py-0.5 text-right text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                      {item.onHand ?? 0}
                    </td>
                    <td className="px-2 py-0.5 text-right text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                      {item.onOrder ?? 0}
                    </td>
                    <td className="px-2 py-0.5 text-right text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                      {item.onTransfer ?? 0}
                    </td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr className="bg-gray-100 dark:bg-gray-800 font-semibold">
                  <td className="px-2 py-1 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                    Total
                  </td>
                  <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                    {totals.onHand}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                    {totals.onOrder}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
                    {totals.onTransfer}
                  </td>
                </tr>
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

export default InventoryByStoreModal
