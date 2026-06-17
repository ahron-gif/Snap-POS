import React, { useState, useCallback, useMemo, useRef, useEffect } from "react"
import Loader from "../../components/ui/loader/Loader"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import { Column as GridUtilsColumn } from "../../gridUtils"
import ExportModal from "../../components/common/ExportModal"
import { useExportModal } from "../../hooks/useExportModal"
import axios from "axios"

interface ArAgingReportsProps {
  filters?: { asOfDate?: string; [k: string]: unknown }
}

/** Normalize API row to camelCase and ensure customerID is string for stable keys */
function normalizeRow(r: any, index: number): any {
  const id = r?.customerID ?? r?.CustomerID
  const customerIdStr = id == null ? "" : typeof id === "string" ? id : String(id)
  return {
    ...r,
    customerID: customerIdStr || `row-${index}`,
    name: r?.name ?? r?.Name ?? "",
    current: r?.current ?? r?.Current ?? r?.over0 ?? r?.Over0 ?? 0,
    over30: r?.over30 ?? r?.Over30 ?? 0,
    over60: r?.over60 ?? r?.Over60 ?? 0,
    over90: r?.over90 ?? r?.Over90 ?? 0,
    over120: r?.over120 ?? r?.Over120 ?? 0,
    credit: r?.credit ?? r?.Credit ?? 0,
    balanceDoe: r?.balanceDoe ?? r?.BalanceDoe ?? 0,
    phone: r?.phone ?? r?.Phone ?? "",
    cell: r?.cell ?? r?.Cell ?? "",
    email: r?.email ?? r?.Email ?? "",
    customerNo: r?.customerNo ?? r?.CustomerNo ?? "",
  }
}

/** Deduplicate by customerID (keep first occurrence) */
function dedupeByCustomerId(rows: any[]): any[] {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const id = row?.customerID ?? row?.CustomerID ?? row?.customerNo ?? row?.CustomerNo
    const key = id == null ? `_${seen.size}` : typeof id === "string" ? id : String(id)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const ArAgingReportsPage: React.FC<ArAgingReportsProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()

  const asOfDate = (filters?.asOfDate && String(filters.asOfDate).trim()) || getTodayISO()

  const [gridData, setGridData] = useState<any[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const gridContainerRef = useRef<HTMLDivElement>(null)

  // Columns for A/R Aging summary - field names must match API response (camelCase from CustomerViewDto)
  const columns: Column[] = useMemo(
    () => [
      {
        field: "name",
        headerName: "Customer",
        width: 220,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "string",
      },
      {
        field: "current",
        headerName: "Current",
        width: 120,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "number",
        cellRenderer: (value: number) =>
          value == null ? "$0.00" : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      {
        field: "over30",
        headerName: "Over 30",
        width: 120,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "number",
        cellRenderer: (value: number) =>
          value == null ? "$0.00" : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      {
        field: "over60",
        headerName: "Over 60",
        width: 120,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "number",
        cellRenderer: (value: number) =>
          value == null ? "$0.00" : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      {
        field: "over90",
        headerName: "Over 90",
        width: 120,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "number",
        cellRenderer: (value: number) =>
          value == null ? "$0.00" : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      {
        field: "over120",
        headerName: "Over 120",
        width: 120,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "number",
        cellRenderer: (value: number) =>
          value == null ? "$0.00" : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      {
        field: "credit",
        headerName: "Credit Limit",
        width: 120,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "number",
        cellRenderer: (value: number) =>
          value == null ? "$0.00" : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      {
        field: "balanceDoe",
        headerName: "Balance",
        width: 120,
        visible: true,
        sortable: true,
        filterable: false,
        dataType: "number",
        cellRenderer: (value: number) =>
          value == null ? "$0.00" : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      {
        field: "phone",
        headerName: "Phone 1",
        width: 130,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "string",
      },
      {
        field: "cell",
        headerName: "Phone 2",
        width: 130,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "string",
      },
      {
        field: "email",
        headerName: "Email",
        width: 200,
        visible: true,
        sortable: true,
        filterable: true,
        dataType: "email",
      },
      {
        field: "customerID",
        headerName: "Customer ID",
        width: 100,
        visible: false,
        sortable: true,
        filterable: true,
        dataType: "string",
      },
    ],
    []
  )

  const fetchAllData = useCallback(async (): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const response = await axios({
        method: "GET",
        url: API_ENDPOINTS.CUSTOMER.GET_ALL_CUSTOMERS,
        params: {
          startRow: 0,
          endRow: 1000000,
          sortColumn: "customerNo",
          sortDirection: "asc",
        },
        headers,
      })
      const res = response.data?.response ?? response.data?.Response
      const raw = res?.data ?? res?.Data ?? []
      const arr = Array.isArray(raw) ? raw : []
      const normalized = arr.map((r: any, i: number) => normalizeRow(r, i))
      return dedupeByCustomerId(normalized)
    } catch (error) {
      console.error("Failed to fetch A/R aging data:", error)
      return []
    }
  }, [getAuthHeaders])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    fetchAllData()
      .then((data) => {
        if (!cancelled) {
          setGridData(data)
          setTotalRecords(data.length)
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message || "Failed to load report data")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [fetchAllData])

  // Pattern A export — `fetchAllData` already returns the full normalized,
  // deduped dataset (all customers). No per-row date filter (the as-of date is
  // a single applied value), so use `useExportModal` with no `filters`.
  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "ar-aging-reports",
    pdfOptions: {
      title: "A/R Aging Reports",
      subtitle: `As of date: ${new Date(asOfDate).toLocaleDateString()}`,
      orientation: "landscape",
    },
  })

  const handleSearch = useCallback(() => {
    setLoadError(null)
    setLoading(true)
    fetchAllData()
      .then((data) => {
        setGridData(data)
        setTotalRecords(data.length)
      })
      .catch((err) => {
        setLoadError(err?.message || "Failed to load report data")
      })
      .finally(() => setLoading(false))
  }, [fetchAllData])

  const getRowId = useCallback((row: any) => {
    const id = row?.customerID ?? row?.customerNo
    if (id == null || id === "") return `row-${Math.random()}`
    return typeof id === "string" ? id : String(id)
  }, [])

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">A/R Aging Reports</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium text-gray-500 dark:text-gray-400">As of date:</span>
            <span>{new Date(asOfDate).toLocaleDateString()}</span>
            {totalRecords > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{totalRecords.toLocaleString()} customers</span>
              </>
            )}
          </div>
          {loadError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{loadError}</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm ml-auto overflow-visible">
              <button
                onClick={handleSearch}
                type="button"
                disabled={loading}
                className="h-10 px-5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors flex items-center gap-2 border-0 border-r border-gray-200 dark:border-gray-600 disabled:opacity-50 rounded-l-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
              <button
                onClick={exportModal.open}
                type="button"
                className="h-10 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 border-0 rounded-none"
                title="Preview, filter and export"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 p-6">
        <div className="flex-1 min-h-0 overflow-auto flex flex-col" ref={gridContainerRef}>
          <div className="min-h-0 flex-1">
            {loading ? (
              <Loader size="lg" label="Loading..." />
            ) : (
              <ServerGrid
                data={gridData}
                columns={columns}
                loading={false}
                totalRecords={totalRecords}
                serverSide={false}
                pagination={true}
                pageSize={100}
                headerSearch={true}
                showActions={false}
                columnChooser={true}
                title="A/R Aging"
                defaultSortColumn="customerNo"
                getRowId={getRowId}
                containerWidth="100%"
                gridId="ar-aging-reports"
              />
            )}
          </div>
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default ArAgingReportsPage
