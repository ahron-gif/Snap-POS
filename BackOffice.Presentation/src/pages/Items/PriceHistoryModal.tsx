import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import { useStore } from "../../context/StoreContext"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"

interface PriceHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  item: {
    itemStoreID: string
    name: string
    barcodeNumber: string
  } | null
  /** When set (e.g. "Cost"), filters by PriceLevel and changes labels to Cost History */
  priceLevel?: string
}

const PriceHistoryModal: React.FC<PriceHistoryModalProps> = ({
  isOpen,
  onClose,
  item,
  priceLevel,
}) => {
  const isCostMode = !!priceLevel
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const storeName = currentStore?.storeName || ""

  const columns: Column[] = useMemo(
    () => [
      {
        field: "priceLevel",
        headerName: isCostMode ? "Cost Level" : "Level Price",
        width: 100,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "string" as const,
      },
      {
        field: "storeName",
        headerName: "Store Name",
        width: 140,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "string" as const,
      },
      {
        field: "oldPrice",
        headerName: isCostMode ? "Old Cost" : "Old Price",
        width: 100,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "number" as const,
        cellRenderer: (value: any) =>
          value != null ? `$${Number(value).toFixed(2)}` : "",
      },
      {
        field: "newPrice",
        headerName: isCostMode ? "New Cost" : "New Price",
        width: 100,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "number" as const,
        cellRenderer: (value: any) =>
          value != null ? `$${Number(value).toFixed(2)}` : "",
      },
      {
        field: "changeDate",
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
        field: "userName",
        headerName: "User",
        width: 120,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "string" as const,
      },
      {
        field: "saleType",
        headerName: "Sale Type",
        width: 100,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "string" as const,
      },
      {
        field: "sP_Price",
        headerName: "Sale Price",
        width: 100,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "string" as const,
      },
      {
        field: "saleDate",
        headerName: "Sale Date",
        width: 120,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "string" as const,
      },
    ],
    [isCostMode]
  )

  // Add storeName to each row and filter by priceLevel if in cost mode
  const gridData = useMemo(
    () => {
      const rows = data.map((row, idx) => ({ ...row, storeName, _rowIndex: idx }))
      if (priceLevel) {
        return rows.filter((row) =>
          row.priceLevel?.toLowerCase().includes(priceLevel.toLowerCase())
        )
      }
      return rows
    },
    [data, storeName, priceLevel]
  )

  const fetchData = useCallback(async () => {
    if (!item) return
    setLoading(true)
    setError(null)

    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.REPORTS.PRICE_CHANGE_HISTORY, {
        method: "POST",
        headers,
        body: JSON.stringify({
          itemStoreID: item.itemStoreID,
          fromDate: "2000-01-01",
          toDate: new Date().toISOString().split("T")[0],
          pageNumber: 1,
          pageSize: 500,
        }),
      })

      const result = await response.json()

      if (result.isSuccess && (result.response?.data || result.data?.data)) {
        setData(result.response?.data || result.data?.data)
      } else {
        setData([])
        if (result.message) setError(result.message)
      }
    } catch {
      setError(isCostMode ? "Error loading cost history" : "Error loading price history")
      setData([])
    } finally {
      setLoading(false)
    }
  }, [item, getAuthHeaders])

  useEffect(() => {
    if (isOpen && item) {
      fetchData()
    }
    if (!isOpen) {
      setData([])
      setError(null)
    }
  }, [isOpen, item, fetchData])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose()
    }
  }

  if (!isOpen || !item) return null

  const isDark = document.documentElement.classList.contains("dark")

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
          width: "1000px",
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
            {isCostMode ? "Cost History" : "Price Change History"}
          </h2>
        </div>

        {/* Item Info */}
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${isDark ? "#374151" : "#e5e7eb"}` }}>
          <div style={{ display: "flex", gap: "24px", fontSize: "13px" }}>
            <div>
              <span style={{ fontWeight: 500, color: isDark ? "#9ca3af" : "#374151" }}>UPC Code: </span>
              <span style={{ color: isDark ? "#e5e7eb" : "#111827" }}>{item.barcodeNumber}</span>
            </div>
            <div>
              <span style={{ fontWeight: 500, color: isDark ? "#9ca3af" : "#374151" }}>Description: </span>
              <span style={{ color: isDark ? "#e5e7eb" : "#111827" }}>{item.name}</span>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflow: "auto", minHeight: "300px" }}>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>
              Loading {isCostMode ? "cost" : "price"} history...
            </div>
          ) : error ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#ef4444", fontSize: "13px" }}>
              {error}
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
              defaultSortColumn="changeDate"
              getRowId={(row: any) => row._rowIndex?.toString() || Math.random().toString()}
              gridId={isCostMode ? "cost-history-modal-grid" : "price-history-modal-grid"}
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
          <span style={{ fontSize: "13px", color: "#6b7280" }}>
            {gridData.length} record{gridData.length !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={onClose}
            autoFocus
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

export default PriceHistoryModal
