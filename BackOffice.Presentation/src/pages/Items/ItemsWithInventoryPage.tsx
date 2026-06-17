import React, { useState, useCallback, useEffect, useRef } from "react"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import Loader from "../../components/ui/loader/Loader"

// Types for the API response
interface StoreInventoryData {
  storeID: string
  storeName: string
  storeInt: number
  cost: number | null
  price: number | null
  onHand: number | null
  onOrder: number | null
  onTransfer: number | null
}

interface ItemWithInventory {
  itemNo: string
  itemStoreID: string
  barcodeNumber: string
  name: string
  modalNumber: string
  storeData: Record<string, StoreInventoryData>
}

interface StoreColumn {
  storeID: string
  storeName: string
  storeInt: number
}

interface ItemsWithInventoryResponse {
  stores: StoreColumn[]
  items: ItemWithInventory[]
  totalCount: number
  pageNumber: number
  pageSize: number
  totalPages: number
}

interface ApiResponse {
  isSuccess: boolean
  message: string
  response: ItemsWithInventoryResponse
}

const PAGE_SIZE = 100

const ItemsWithInventoryPage: React.FC = () => {
  const { getAuthHeaders } = useAuthHeaders()
  const tableRef = useRef<HTMLTableElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ItemsWithInventoryResponse | null>(null)
  const [searchText, setSearchText] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [toast, setToast] = useState<{
    show: boolean
    message: string
    type: "success" | "error" | "info"
  }>({ show: false, message: "", type: "success" })

  // Fetch data with pagination
  const fetchData = useCallback(async (page: number = 1, search: string = "") => {
    setLoading(true)
    setError(null)
    try {
      const headers = getAuthHeaders()
      const params = new URLSearchParams()

      params.append("pageNumber", page.toString())
      params.append("pageSize", PAGE_SIZE.toString())
      if (search) {
        params.append("searchText", search)
      }

      const url = `${API_ENDPOINTS.ITEMS.GET_ITEMS_WITH_INVENTORY}?${params.toString()}`

      const response = await fetch(url, {
        method: "GET",
        headers,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiResponse = await response.json()

      if (result.isSuccess) {
        setData(result.response)
        setCurrentPage(result.response.pageNumber)
      } else {
        setError(result.message || "Failed to fetch data")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders])

  // Initial fetch
  useEffect(() => {
    fetchData(1, searchText)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearchText(value)
      setCurrentPage(1)
      fetchData(1, value)
    }, 500) // 500ms debounce
  }, [fetchData])

  // Page change handler
  const handlePageChange = useCallback((newPage: number) => {
    if (newPage < 1 || (data && newPage > data.totalPages)) return
    setCurrentPage(newPage)
    fetchData(newPage, searchText)
  }, [data, fetchData, searchText])

  // Toast notification
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info") => {
      setToast({ show: true, message, type })
      setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000)
    },
    []
  )

  // Export to CSV (current page only)
  const exportToCSV = useCallback(() => {
    if (!data || !data.items.length) {
      showToast("No data to export", "error")
      return
    }

    const headers = [
      "Barcode Number",
      "Name",
      "Model Number",
      ...data.stores.flatMap((store) => [
        `${store.storeName} - Cost`,
        `${store.storeName} - Price`,
        `${store.storeName} - On Hand`,
        `${store.storeName} - On Transfer`,
        `${store.storeName} - On Order`,
      ]),
    ]

    const rows = data.items.map((item) => [
      item.barcodeNumber,
      item.name,
      item.modalNumber,
      ...data.stores.flatMap((store) => {
        const storeData =
          item.storeData[store.storeID] ??
          item.storeData[store.storeID.toLowerCase()] ??
          item.storeData[store.storeID.toUpperCase()]
        return [
          storeData?.cost?.toFixed(2) ?? "",
          storeData?.price?.toFixed(2) ?? "",
          storeData?.onHand?.toString() ?? "",
          storeData?.onTransfer?.toString() ?? "",
          storeData?.onOrder?.toString() ?? "",
        ]
      }),
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `items_with_inventory_page${currentPage}_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)

    showToast("CSV exported successfully", "success")
  }, [data, currentPage, showToast])

  // Export to Excel
  const exportToExcel = useCallback(() => {
    if (!data || !data.items.length) {
      showToast("No data to export", "error")
      return
    }

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 5px; }
          th { background-color: #4CAF50; color: white; font-weight: bold; }
          .store-header { background-color: #2196F3; color: white; }
          .number { text-align: right; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th rowspan="2">Barcode Number</th>
              <th rowspan="2">Name</th>
              <th rowspan="2">Model Number</th>
              ${data.stores.map((s) => `<th colspan="5" class="store-header">${s.storeName}</th>`).join("")}
            </tr>
            <tr>
              ${data.stores.map(() => `<th>Cost</th><th>Price</th><th>On Hand</th><th>On Transfer</th><th>On Order</th>`).join("")}
            </tr>
          </thead>
          <tbody>
    `

    data.items.forEach((item) => {
      html += `<tr>
        <td>${item.barcodeNumber}</td>
        <td>${item.name}</td>
        <td>${item.modalNumber}</td>
        ${data.stores
          .map((store) => {
            const storeData =
              item.storeData[store.storeID] ??
              item.storeData[store.storeID.toLowerCase()] ??
              item.storeData[store.storeID.toUpperCase()]
            return `
              <td class="number">${storeData?.cost?.toFixed(2) ?? ""}</td>
              <td class="number">${storeData?.price?.toFixed(2) ?? ""}</td>
              <td class="number">${storeData?.onHand ?? ""}</td>
              <td class="number">${storeData?.onTransfer ?? ""}</td>
              <td class="number">${storeData?.onOrder ?? ""}</td>
            `
          })
          .join("")}
      </tr>`
    })

    html += "</tbody></table></body></html>"

    const blob = new Blob([html], { type: "application/vnd.ms-excel" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `items_with_inventory_page${currentPage}_${new Date().toISOString().split("T")[0]}.xls`
    link.click()
    URL.revokeObjectURL(link.href)

    showToast("Excel exported successfully", "success")
  }, [data, currentPage, showToast])

  // Print report
  const printReport = useCallback(() => {
    if (!tableRef.current) return

    const printContent = tableRef.current.outerHTML
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      showToast("Please allow popups to print", "error")
      return
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Items With Inventory Report</title>
        <style>
          @media print {
            @page { size: landscape; margin: 10mm; }
          }
          body { font-family: Arial, sans-serif; font-size: 10px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 4px; text-align: left; }
          th { background-color: #4CAF50; color: white; font-weight: bold; }
          .store-header { background-color: #2196F3 !important; color: white !important; }
          .number { text-align: right; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          h1 { text-align: center; margin-bottom: 20px; }
          .report-date { text-align: center; margin-bottom: 10px; color: #666; }
        </style>
      </head>
      <body>
        <h1>Items With Inventory Report (Page ${currentPage})</h1>
        <p class="report-date">Generated: ${new Date().toLocaleString()}</p>
        ${printContent}
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }, [showToast, currentPage])

  // Format currency
  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-"
    return `$${value.toFixed(2)}`
  }

  // Format number
  const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-"
    return value.toLocaleString()
  }

  // Generate page numbers
  const getPageNumbers = () => {
    if (!data) return []
    const pages: (number | string)[] = []
    const totalPages = data.totalPages
    const current = currentPage

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (current <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages)
      } else if (current >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
      } else {
        pages.push(1, "...", current - 1, current, current + 1, "...", totalPages)
      }
    }
    return pages
  }

  return (
    <div className="px-3 py-2 h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Toast Notification */}
      {toast.show && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
            toast.type === "success"
              ? "bg-green-500 text-white"
              : toast.type === "error"
              ? "bg-red-500 text-white"
              : "bg-brand-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h1 className="text-sm font-semibold text-gray-900 dark:text-white">
          Items With Inventory
        </h1>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-1">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search items..."
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-7 pr-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white w-52"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchData(currentPage, searchText)}
            disabled={loading}
            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>

          {/* Export Dropdown */}
          <div className="relative group">
            <button className="px-2 py-1 text-xs bg-brand-500 text-white rounded hover:bg-brand-600 transition-colors flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <button
                onClick={exportToCSV}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Export to CSV
              </button>
              <button
                onClick={exportToExcel}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 11.5l1.5 3 1.5-3h1.5l-2 4 2 4H11.5l-1.5-3-1.5 3H7l2-4-2-4h1.5z" />
                </svg>
                Export to Excel
              </button>
              <button
                onClick={printReport}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                Print Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {data && (
        <div className="flex flex-wrap items-center gap-2 mb-1 text-xs">
          <div className="px-2 py-0.5 bg-brand-50 dark:bg-brand-900/30 rounded">
            <span className="text-brand-500 dark:text-brand-400">Total Items:</span>
            <span className="ml-1 font-semibold text-brand-700 dark:text-brand-300">
              {data.totalCount.toLocaleString()}
            </span>
          </div>
          <div className="px-2 py-0.5 bg-green-50 dark:bg-green-900/30 rounded">
            <span className="text-green-600 dark:text-green-400">Stores:</span>
            <span className="ml-1 font-semibold text-green-700 dark:text-green-300">
              {data.stores.length}
            </span>
          </div>
          <div className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/30 rounded">
            <span className="text-purple-600 dark:text-purple-400">
              Page {data.pageNumber} of {data.totalPages}
            </span>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded">
        {loading ? (
          <Loader size="lg" label="Loading inventory data..." />
        ) : error ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg
                className="w-12 h-12 mx-auto text-red-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-red-500 mb-2">{error}</p>
              <button
                onClick={() => fetchData(currentPage, searchText)}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600"
              >
                Retry
              </button>
            </div>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <svg
                className="w-12 h-12 mx-auto text-gray-400 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">No items found</p>
            </div>
          </div>
        ) : (
          <table ref={tableRef} className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              {/* Store Headers Row */}
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 bg-gray-100 dark:bg-gray-800 px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border-b border-r border-gray-200 dark:border-gray-700 min-w-[120px]"
                >
                  Barcode Number
                </th>
                <th
                  rowSpan={2}
                  className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border-b border-r border-gray-200 dark:border-gray-700 min-w-[150px]"
                >
                  Name
                </th>
                <th
                  rowSpan={2}
                  className="px-2 py-1 text-left font-semibold text-gray-700 dark:text-gray-200 border-b border-r border-gray-200 dark:border-gray-700 min-w-[90px]"
                >
                  Model Number
                </th>
                {data.stores.map((store) => (
                  <th
                    key={store.storeID}
                    colSpan={5}
                    className="px-2 py-1 text-center font-semibold text-white bg-brand-600 border-b border-r border-gray-200 dark:border-gray-700"
                  >
                    {store.storeName}
                  </th>
                ))}
              </tr>
              {/* Sub Headers Row */}
              <tr className="bg-gray-50 dark:bg-gray-700">
                {data.stores.map((store) => (
                  <React.Fragment key={`subheader-${store.storeID}`}>
                    <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-700 min-w-[60px]">
                      Cost
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-700 min-w-[60px]">
                      Price
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-700 min-w-[60px]">
                      On Hand
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-700 min-w-[70px]">
                      On Transfer
                    </th>
                    <th className="px-2 py-1 text-right font-medium text-gray-600 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-700 min-w-[60px]">
                      On Order
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, index) => (
                <tr
                  key={item.itemNo}
                  className={`${
                    index % 2 === 0
                      ? "bg-white dark:bg-gray-900"
                      : "bg-gray-50 dark:bg-gray-800"
                  } hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors`}
                >
                  <td className="sticky left-0 z-10 px-2 py-0.5 text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700 bg-inherit font-mono">
                    {item.barcodeNumber}
                  </td>
                  <td className="px-2 py-0.5 text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700">
                    {item.name}
                  </td>
                  <td className="px-2 py-0.5 text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
                    {item.modalNumber || "-"}
                  </td>
                  {data.stores.map((store) => {
                    const storeData =
                      item.storeData[store.storeID] ??
                      item.storeData[store.storeID.toLowerCase()] ??
                      item.storeData[store.storeID.toUpperCase()]
                    return (
                      <React.Fragment key={`${item.itemNo}-${store.storeID}`}>
                        <td className="px-2 py-0.5 text-right text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700">
                          {formatCurrency(storeData?.cost)}
                        </td>
                        <td className="px-2 py-0.5 text-right text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700">
                          {formatCurrency(storeData?.price)}
                        </td>
                        <td
                          className={`px-2 py-0.5 text-right border-r border-gray-200 dark:border-gray-700 ${
                            (storeData?.onHand ?? 0) <= 0
                              ? "text-red-600 dark:text-red-400 font-semibold"
                              : "text-gray-900 dark:text-gray-100"
                          }`}
                        >
                          {formatNumber(storeData?.onHand)}
                        </td>
                        <td className="px-2 py-0.5 text-right text-brand-500 dark:text-brand-400 border-r border-gray-200 dark:border-gray-700">
                          {formatNumber(storeData?.onTransfer)}
                        </td>
                        <td className="px-2 py-0.5 text-right text-green-600 dark:text-green-400 border-r border-gray-200 dark:border-gray-700">
                          {formatNumber(storeData?.onOrder)}
                        </td>
                      </React.Fragment>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-1 px-1">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Showing {((currentPage - 1) * PAGE_SIZE) + 1} to {Math.min(currentPage * PAGE_SIZE, data.totalCount)} of {data.totalCount.toLocaleString()} items
          </div>
          <div className="flex items-center gap-0.5">
            {/* First Page */}
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              First
            </button>
            {/* Previous */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Prev
            </button>
            {/* Page Numbers */}
            {getPageNumbers().map((page, idx) => (
              <button
                key={idx}
                onClick={() => typeof page === "number" && handlePageChange(page)}
                disabled={page === "..."}
                className={`px-2 py-1 text-xs rounded border ${
                  page === currentPage
                    ? "bg-brand-500 text-white border-brand-500"
                    : page === "..."
                    ? "border-transparent cursor-default"
                    : "border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {page}
              </button>
            ))}
            {/* Next */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === data.totalPages}
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Next
            </button>
            {/* Last Page */}
            <button
              onClick={() => handlePageChange(data.totalPages)}
              disabled={currentPage === data.totalPages}
              className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ItemsWithInventoryPage
