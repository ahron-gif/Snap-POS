import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import dayjs, { Dayjs } from "dayjs"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs"
import { DatePicker } from "@mui/x-date-pickers/DatePicker"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"

interface SalesHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  item: {
    itemStoreID: string
    name: string
    barcodeNumber: string
  } | null
}

interface DateScopeOption {
  scopeID: number
  description: string
  fromDate: string | null
  toDate: string | null
  sortOrder: number | null
}

const SalesHistoryModal: React.FC<SalesHistoryModalProps> = ({
  isOpen,
  onClose,
  item,
}) => {
  const { getAuthHeaders } = useAuthHeaders()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalAmount, setTotalAmount] = useState(0)

  const today = new Date().toISOString().split("T")[0]
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)

  // Scope dropdown
  const [scopes, setScopes] = useState<DateScopeOption[]>([])
  const [selectedScope, setSelectedScope] = useState<string>("")

  // Grid columns
  const gridColumns: Column[] = useMemo(
    () => [
      {
        field: "transactionNo",
        headerName: "Transaction #",
        width: 120,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "string" as const,
      },
      {
        field: "date",
        headerName: "Date",
        width: 100,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "date" as const,
        cellRenderer: (value: any) => {
          if (!value) return ""
          try { return new Date(value).toLocaleDateString() } catch { return value }
        },
      },
      {
        field: "saleTime",
        headerName: "Sale Time",
        width: 100,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "time" as const,
        cellRenderer: (value: any) => {
          if (!value) return ""
          try { return new Date(value).toLocaleTimeString() } catch { return value }
        },
      },
      {
        field: "qtyCaseQty",
        headerName: "Qty Case",
        width: 80,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "number" as const,
      },
      {
        field: "price",
        headerName: "Price",
        width: 90,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "number" as const,
        cellRenderer: (value: any) =>
          value != null ? `$${Number(value).toFixed(2)}` : "",
      },
      {
        field: "qty",
        headerName: "Qty",
        width: 70,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "number" as const,
      },
      {
        field: "total",
        headerName: "Total",
        width: 100,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "number" as const,
        cellRenderer: (value: any) =>
          value != null ? `$${Number(value).toFixed(2)}` : "",
      },
      {
        field: "storeName",
        headerName: "Store Name",
        width: 130,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "string" as const,
      },
      {
        field: "customerNo",
        headerName: "Customer No",
        width: 100,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "string" as const,
      },
      {
        field: "type",
        headerName: "Type",
        width: 80,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "string" as const,
      },
      {
        field: "customerName",
        headerName: "Customer Name",
        width: 150,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "string" as const,
      },
      {
        field: "qty2",
        headerName: "Qty-2",
        width: 70,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "number" as const,
      },
    ],
    []
  )

  // Add row index for grid key
  const gridData = useMemo(
    () => data.map((row, idx) => ({ ...row, _rowIndex: idx })),
    [data]
  )

  // Fetch date scopes on mount
  useEffect(() => {
    if (!isOpen) return
    const fetchScopes = async () => {
      try {
        const headers = getAuthHeaders()
        const response = await fetch(API_ENDPOINTS.REPORTS.DATE_SCOPES, {
          method: "GET",
          headers,
        })
        const result = await response.json()
        if (result.isSuccess && result.data) {
          setScopes(result.data)
        }
      } catch {
        // silently fail - scopes are optional
      }
    }
    fetchScopes()
  }, [isOpen, getAuthHeaders])

  // Reset dates when modal opens
  useEffect(() => {
    if (isOpen) {
      const todayStr = new Date().toISOString().split("T")[0]
      setFromDate(todayStr)
      setToDate(todayStr)
      setSelectedScope("")
      setData([])
      setTotalAmount(0)
      setError(null)
    }
  }, [isOpen])

  // When scope changes, update from/to dates
  const handleScopeChange = useCallback((scopeValue: string) => {
    setSelectedScope(scopeValue)

    if (!scopeValue) return

    const now = new Date()
    const todayStr = now.toISOString().split("T")[0]

    // Check if it's a database scope (numeric ID)
    const scopeId = parseInt(scopeValue)
    if (!isNaN(scopeId)) {
      const scope = scopes.find(s => s.scopeID === scopeId)
      if (scope) {
        if (scope.fromDate) {
          setFromDate(new Date(scope.fromDate).toISOString().split("T")[0])
        }
        if (scope.toDate) {
          setToDate(new Date(scope.toDate).toISOString().split("T")[0])
        }
      }
      return
    }

    // Built-in scope presets
    const getMonday = (d: Date) => {
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      return new Date(d.setDate(diff))
    }

    switch (scopeValue) {
      case "all": {
        setFromDate("2000-01-01")
        setToDate(todayStr)
        break
      }
      case "today": {
        setFromDate(todayStr)
        setToDate(todayStr)
        break
      }
      case "yesterday": {
        const y = new Date(now)
        y.setDate(y.getDate() - 1)
        const yStr = y.toISOString().split("T")[0]
        setFromDate(yStr)
        setToDate(yStr)
        break
      }
      case "thisWeek": {
        const mon = getMonday(new Date(now))
        setFromDate(mon.toISOString().split("T")[0])
        setToDate(todayStr)
        break
      }
      case "lastWeek": {
        const thisMonday = getMonday(new Date(now))
        const lastMonday = new Date(thisMonday)
        lastMonday.setDate(lastMonday.getDate() - 7)
        const lastSunday = new Date(thisMonday)
        lastSunday.setDate(lastSunday.getDate() - 1)
        setFromDate(lastMonday.toISOString().split("T")[0])
        setToDate(lastSunday.toISOString().split("T")[0])
        break
      }
      case "thisMonth": {
        setFromDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0])
        setToDate(todayStr)
        break
      }
      case "lastMonth": {
        const firstLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
        setFromDate(firstLastMonth.toISOString().split("T")[0])
        setToDate(lastLastMonth.toISOString().split("T")[0])
        break
      }
      case "thisYear": {
        setFromDate(new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0])
        setToDate(todayStr)
        break
      }
      case "lastYear": {
        setFromDate(new Date(now.getFullYear() - 1, 0, 1).toISOString().split("T")[0])
        setToDate(new Date(now.getFullYear() - 1, 11, 31).toISOString().split("T")[0])
        break
      }
      case "last30": {
        const d30 = new Date(now)
        d30.setDate(d30.getDate() - 30)
        setFromDate(d30.toISOString().split("T")[0])
        setToDate(todayStr)
        break
      }
      case "last60": {
        const d60 = new Date(now)
        d60.setDate(d60.getDate() - 60)
        setFromDate(d60.toISOString().split("T")[0])
        setToDate(todayStr)
        break
      }
      case "last90": {
        const d90 = new Date(now)
        d90.setDate(d90.getDate() - 90)
        setFromDate(d90.toISOString().split("T")[0])
        setToDate(todayStr)
        break
      }
    }
  }, [scopes])

  const fetchData = useCallback(async () => {
    if (!item) return
    setLoading(true)
    setError(null)

    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.REPORTS.ITEM_SALES_HISTORY, {
        method: "POST",
        headers,
        body: JSON.stringify({
          itemStoreID: item.itemStoreID,
          fromDate: fromDate,
          toDate: toDate,
          pageNumber: 1,
          pageSize: 500,
        }),
      })

      const result = await response.json()

      const responseData = result.response || result.data
      if (result.isSuccess && responseData) {
        setData(responseData.data || [])
        setTotalAmount(responseData.totalAmount || 0)
      } else {
        setData([])
        setTotalAmount(0)
        if (result.message) setError(result.message)
      }
    } catch {
      setError("Error loading sales history")
      setData([])
      setTotalAmount(0)
    } finally {
      setLoading(false)
    }
  }, [item, fromDate, toDate, getAuthHeaders])

  // Auto-fetch when modal opens
  useEffect(() => {
    if (isOpen && item) {
      fetchData()
    }
  }, [isOpen, item]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGo = () => {
    fetchData()
  }

  const handlePrint = useCallback(() => {
    if (data.length === 0) return

    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      alert("Please allow popups to print")
      return
    }

    const formatPrice = (val: number | null) => val != null ? `$${val.toFixed(2)}` : ""

    const tableRows = data.map((row, idx) => {
      return `<tr style="background:${idx % 2 === 0 ? "white" : "#f8fafc"}">
        <td style="padding:6px 8px;border:1px solid #e5e7eb;">${row.transactionNo || ""}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;">${row.date ? new Date(row.date).toLocaleDateString() : ""}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;">${row.saleTime ? new Date(row.saleTime).toLocaleTimeString() : ""}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;">${row.qtyCaseQty ?? ""}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;">${formatPrice(row.price)}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;">${row.qty ?? ""}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;">${formatPrice(row.total)}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;">${row.storeName || ""}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;">${row.customerNo || ""}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;">${row.type || ""}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;">${row.customerName || ""}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;">${row.qty2 ?? ""}</td>
      </tr>`
    }).join("")

    const printHTML = `<!DOCTYPE html><html><head><title>Sales History - ${item?.name || ""}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { text-align: center; font-size: 18px; }
        .subtitle { text-align: center; color: #6b7280; margin-bottom: 16px; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #1e40af; color: white; padding: 8px; text-align: left; }
        td { padding: 6px 8px; border: 1px solid #e5e7eb; }
        .footer { text-align: right; margin-top: 10px; font-size: 12px; color: #374151; }
        @media print { body { padding: 10px; } }
      </style></head><body>
      <h1>Sales History on Item</h1>
      <p class="subtitle">${item?.name || ""} ~ UPC: ${item?.barcodeNumber || ""}</p>
      <p class="subtitle">From: ${fromDate} &nbsp; To: ${toDate} &nbsp; | &nbsp; Generated: ${new Date().toLocaleString()}</p>
      <table>
        <thead><tr>
          <th>Transaction #</th><th>Date</th><th>Sale Time</th><th>Qty Case</th>
          <th>Price</th><th>Qty</th><th>Total</th><th>Store Name</th>
          <th>Customer No</th><th>Type</th><th>Customer Name</th><th>Qty-2</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <p class="footer">Total: $${totalAmount.toFixed(2)} &nbsp; | &nbsp; Records: ${data.length}</p>
    </body></html>`

    printWindow.document.write(printHTML)
    printWindow.document.close()
    printWindow.onload = () => printWindow.print()
  }, [data, item, fromDate, toDate, totalAmount])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose()
    } else if (e.key === "Enter") {
      handleGo()
    }
  }

  if (!isOpen || !item) return null

  const isDark = document.documentElement.classList.contains("dark")

  // Built-in scope presets
  const builtInScopes = [
    { value: "all", label: "All" },
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "thisWeek", label: "This Week" },
    { value: "lastWeek", label: "Last Week" },
    { value: "thisMonth", label: "This Month" },
    { value: "lastMonth", label: "Last Month" },
    { value: "thisYear", label: "This Year" },
    { value: "lastYear", label: "Last Year" },
    { value: "last30", label: "Last 30 days" },
    { value: "last60", label: "Last 60 days" },
    { value: "last90", label: "Last 90 days" },
  ]

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          backgroundColor: isDark ? "rgba(0,0,0,0.5)" : undefined,
        }}
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        style={{
          position: "relative",
          backgroundColor: isDark ? "#1f2937" : "white",
          borderRadius: "8px",
          boxShadow: isDark
            ? "0 8px 32px rgba(0, 0, 0, 0.5)"
            : "0 8px 32px rgba(0, 0, 0, 0.2)",
          width: "1100px",
          maxWidth: "95vw",
          maxHeight: "85vh",
          border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px 16px",
            borderBottom: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
            backgroundColor: isDark ? "#111827" : "#f9fafb",
            borderRadius: "8px 8px 0 0",
          }}
        >
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: isDark ? "#e5e7eb" : "#111827", margin: 0 }}>
            Sales History on Item: {item.name} ~ UPC: {item.barcodeNumber}
          </h2>
        </div>

        {/* Filter Bar */}
        <div
          style={{
            padding: "10px 16px",
            borderBottom: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <label style={{ fontSize: "13px", fontWeight: 500, color: isDark ? "#d1d5db" : "#374151" }}>From Date:</label>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              value={dayjs(fromDate)}
              onChange={(val: Dayjs | null) => {
                if (val && val.isValid()) {
                  setFromDate(val.format("YYYY-MM-DD"))
                  setSelectedScope("")
                }
              }}
              format="MM/DD/YYYY"
              slotProps={{
                textField: {
                  size: "small",
                  sx: {
                    width: 160,
                    "& .MuiInputBase-root": { height: 32, fontSize: "13px" },
                    "& .MuiInputBase-input": { padding: "4px 8px", fontSize: "13px" },
                  },
                },
              }}
            />
          </LocalizationProvider>
          <label style={{ fontSize: "13px", fontWeight: 500, color: isDark ? "#d1d5db" : "#374151" }}>To Date:</label>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              value={dayjs(toDate)}
              onChange={(val: Dayjs | null) => {
                if (val && val.isValid()) {
                  setToDate(val.format("YYYY-MM-DD"))
                  setSelectedScope("")
                }
              }}
              format="MM/DD/YYYY"
              slotProps={{
                textField: {
                  size: "small",
                  sx: {
                    width: 160,
                    "& .MuiInputBase-root": { height: 32, fontSize: "13px" },
                    "& .MuiInputBase-input": { padding: "4px 8px", fontSize: "13px" },
                  },
                },
              }}
            />
          </LocalizationProvider>

          {/* Scope Dropdown */}
          <label style={{ fontSize: "13px", fontWeight: 500, color: isDark ? "#d1d5db" : "#374151" }}>Scope:</label>
          <select
            value={selectedScope}
            onChange={(e) => handleScopeChange(e.target.value)}
            style={{
              padding: "5px 8px",
              border: `1px solid ${isDark ? "#4b5563" : "#d1d5db"}`,
              borderRadius: "4px",
              fontSize: "13px",
              outline: "none",
              minWidth: "140px",
              backgroundColor: isDark ? "#111827" : "white",
              color: isDark ? "#e5e7eb" : undefined,
              cursor: "pointer",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#1e40af")}
            onBlur={(e) => (e.target.style.borderColor = isDark ? "#4b5563" : "#d1d5db")}
          >
            <option value="">-- Select --</option>
            {builtInScopes.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
            {scopes.length > 0 && (
              <option disabled>──────────</option>
            )}
            {scopes.map((s) => (
              <option key={s.scopeID} value={s.scopeID.toString()}>{s.description}</option>
            ))}
          </select>

          {/* Go Button */}
          <button
            type="button"
            onClick={handleGo}
            disabled={loading}
            style={{
              padding: "5px 20px",
              backgroundColor: isDark ? "#374151" : "#f9fafb",
              border: `1px solid ${isDark ? "#4b5563" : "#d1d5db"}`,
              borderRadius: "4px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              color: isDark ? "#d1d5db" : "#374151",
            }}
          >
            Go
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={data.length === 0}
            title="Print Preview"
            style={{
              padding: "5px 10px",
              backgroundColor: isDark ? "#374151" : "#f9fafb",
              border: `1px solid ${isDark ? "#4b5563" : "#d1d5db"}`,
              borderRadius: "4px",
              fontSize: "13px",
              cursor: data.length === 0 ? "not-allowed" : "pointer",
              color: data.length === 0 ? "#9ca3af" : isDark ? "#d1d5db" : "#374151",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print
          </button>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflow: "auto", minHeight: "300px" }}>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>
              Loading sales history...
            </div>
          ) : error ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#ef4444", fontSize: "13px" }}>
              {error}
            </div>
          ) : (
            <ServerGrid
              data={gridData}
              columns={gridColumns}
              loading={false}
              totalRecords={gridData.length}
              serverSide={false}
              pagination={true}
              pageSize={50}
              headerSearch={true}
              showActions={false}
              columnChooser={true}
              defaultSortColumn="date"
              getRowId={(row: any) => row._rowIndex?.toString() || Math.random().toString()}
              gridId="sales-history-modal-grid"
            />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "10px 16px",
            borderTop: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
            backgroundColor: isDark ? "#111827" : undefined,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "13px", color: isDark ? "#d1d5db" : "#374151" }}>
            <span style={{ fontWeight: 500 }}>Total: </span>
            <span style={{ fontWeight: 600 }}>
              {totalAmount != null ? `$${totalAmount.toFixed(2)}` : "$0.00"}
            </span>
            {data.length > 0 && (
              <span style={{ marginLeft: "16px", color: "#6b7280" }}>
                {data.length} record{data.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px 32px",
              backgroundColor: isDark ? "#374151" : "#f9fafb",
              border: `1px solid ${isDark ? "#4b5563" : "#d1d5db"}`,
              borderRadius: "4px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              color: isDark ? "#d1d5db" : "#374151",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default SalesHistoryModal
