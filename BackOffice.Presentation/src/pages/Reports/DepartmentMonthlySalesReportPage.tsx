import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import axios from "axios"
import Flatpickr from "react-flatpickr"
import "flatpickr/dist/themes/light.css"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { usePermission } from "../../hooks/usePermission"
import { useStore } from "../../context/StoreContext"
import { API_ENDPOINTS } from "../../constants/api"
import { Column as GridUtilsColumn } from "../../gridUtils"
import SearchableSelect, { SelectOption } from "../../components/form/SearchableSelect"
import ExportModal from "../../components/common/ExportModal"
import { useReportExportModal } from "../../hooks/useReportExportModal"

interface DepartmentMonthlySalesReportProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    storeId?: string
    storeName?: string
  }
}

interface StoreOption {
  id: string
  name: string
  code?: string
}

interface DepartmentMonthlySalesRow {
  monthStartDate: string
  year: number
  monthName: string
  storeName: string
  department: string
  qty: number
  total: number
}

const currency = (v: unknown) =>
  v == null ? "$0.00" : `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const numberFmt = (v: unknown) =>
  v == null ? "0" : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 })}`

/** Calendar year — plain digits, no thousands grouping (2023 not 2,023). */
const yearFmt = (v: unknown): string => {
  if (v == null || v === "") return ""
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) ? String(n) : ""
}

const formatDateDMY = (value: string | null | undefined): string => {
  if (!value) return ""
  const s = value.toString()
  const raw = s.length >= 10 ? s.substring(0, 10) : s
  const parts = raw.split("-")
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts
    if (yyyy && mm && dd) {
      return `${dd.padStart(2, "0")}/${mm.padStart(2, "0")}/${yyyy}`
    }
  }
  return s
}

const DEPARTMENT_MONTHLY_SALES_COLUMN_CONFIG = [
  { field: "year", headerName: "Year", ratio: 0.12, minWidth: 90, type: "number" },
  { field: "monthName", headerName: "Month", ratio: 0.18, minWidth: 120 },
  { field: "storeName", headerName: "Store", ratio: 0.26, minWidth: 200 },
  { field: "department", headerName: "Department", ratio: 0.22, minWidth: 220 },
  { field: "qty", headerName: "Qty", ratio: 0.11, minWidth: 100, type: "number" },
  { field: "total", headerName: "Amount", ratio: 0.11, minWidth: 140, type: "currency" },
]

const getLocalUserId = (): string => {
  try {
    const userData = localStorage.getItem("userData")
    if (userData) {
      const parsed = JSON.parse(userData)
      return parsed.localUserId ?? ""
    }
  } catch {
    // ignore
  }
  return ""
}

const DEPARTMENT_MONTHLY_SALES_SCREEN_CODE = "reports.department_monthly_sales"

const DepartmentMonthlySalesReportPage: React.FC<DepartmentMonthlySalesReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { canExport } = usePermission(DEPARTMENT_MONTHLY_SALES_SCREEN_CODE)

  const todayStr = new Date().toISOString().split("T")[0]
  const defaultDateFrom =
    filters?.dateFrom || new Date(new Date().setMonth(new Date().getMonth() - 12)).toISOString().split("T")[0]
  const defaultDateTo = filters?.dateTo || todayStr
  const defaultStoreId = filters?.storeId ?? ""

  const [dateFrom, setDateFrom] = useState<string>(defaultDateFrom)
  const [dateTo, setDateTo] = useState<string>(defaultDateTo)
  const [appliedDateFrom, setAppliedDateFrom] = useState<string>(defaultDateFrom)
  const [appliedDateTo, setAppliedDateTo] = useState<string>(defaultDateTo)
  const [stores, setStores] = useState<StoreOption[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [screenStoreId, setScreenStoreId] = useState<string>(defaultStoreId)
  const [appliedStoreId, setAppliedStoreId] = useState<string>(defaultStoreId)

  const [rows, setRows] = useState<DepartmentMonthlySalesRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalQty, setTotalQty] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)

  const [runSearchAfterFilters, setRunSearchAfterFilters] = useState(false)
  const gridContainerRef = useRef<HTMLDivElement | null>(null)
  const [gridContainerWidth, setGridContainerWidth] = useState(960)

  useEffect(() => {
    const el = gridContainerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0]?.contentRect ?? { width: 960 }
      setGridContainerWidth(Math.max(640, Math.floor(width)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const userId = getLocalUserId()
    if (!userId) return
    setLoadingStores(true)
    fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${userId}`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (data.isSuccess && data.response) {
          setStores(
            data.response.map((s: { storeID: string; storeName: string; storeNo?: number }) => ({
              id: s.storeID,
              name: s.storeName,
              code: s.storeNo?.toString(),
            }))
          )
        }
      })
      .catch(console.error)
      .finally(() => setLoadingStores(false))
  }, [getAuthHeaders])

  useEffect(() => {
    if (!filters) return
    const from = filters.dateFrom || defaultDateFrom
    const to = filters.dateTo || defaultDateTo
    setDateFrom(from)
    setDateTo(to)
    setAppliedDateFrom(from)
    setAppliedDateTo(to)
    const storeId = filters.storeId ?? ""
    setScreenStoreId(storeId)
    setAppliedStoreId(storeId)
    if (filters.dateFrom || filters.dateTo || filters.storeId !== undefined) {
      setRunSearchAfterFilters(true)
    }
  }, [filters?.dateFrom, filters?.dateTo, filters?.storeId, currentStore?.storeId])

  const storeDisplayName = useMemo(() => {
    if (!appliedStoreId || appliedStoreId.trim() === "") {
      return "All Stores"
    }
    if (filters?.storeName?.trim()) {
      return filters.storeName.trim()
    }
    const fromStores = stores.find((s) => s.id === appliedStoreId)?.name
    if (fromStores) {
      return fromStores
    }
    if (currentStore?.storeId === appliedStoreId) {
      return currentStore.storeName || "Selected Store"
    }
    return "Selected Store"
  }, [appliedStoreId, filters?.storeName, stores, currentStore?.storeId, currentStore?.storeName])

  const columns: Column[] = useMemo(() => {
    const total = gridContainerWidth
    return DEPARTMENT_MONTHLY_SALES_COLUMN_CONFIG.map((cfg) => {
      const width = Math.max(cfg.minWidth, Math.floor(total * cfg.ratio))
      const col: Column = {
        field: cfg.field,
        headerName: cfg.headerName,
        width,
        sortable: true,
        filterable: true,
        dataType: cfg.type === "number" || cfg.type === "currency" ? "number" : "string",
      }
      if (cfg.type === "currency") {
        ;(col as Column & { cellRenderer?: (v: number) => string }).cellRenderer = (value: number) => currency(value)
      }
      if (cfg.field === "year") {
        ;(col as Column & { cellRenderer?: (v: unknown) => string }).cellRenderer = (value: unknown) => yearFmt(value)
      } else if (cfg.type === "number") {
        ;(col as Column & { cellRenderer?: (v: number) => string }).cellRenderer = (value: number) => numberFmt(value)
      }
      return col
    })
  }, [gridContainerWidth])

  const storeSelectOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "All Stores" },
      ...stores.map((s) => ({
        value: s.id,
        label: s.code ? `${s.code} - ${s.name}` : s.name,
      })),
    ],
    [stores]
  )

  const fetchData = useCallback(
    async (overrides?: { dateFrom?: string; dateTo?: string; storeId?: string }) => {
      const from = overrides?.dateFrom ?? appliedDateFrom
      const to = overrides?.dateTo ?? appliedDateTo
      if (!from || !to) return

      setLoading(true)
      setError(null)

      try {
        const headers = getAuthHeaders()
        const body: Record<string, unknown> = {
          fromDate: from,
          toDate: to,
        }
        const storeIdToUse = overrides?.storeId ?? appliedStoreId
        if (storeIdToUse && storeIdToUse.trim().length > 0) {
          body.storeId = storeIdToUse.trim()
        }

        const response = await axios.post(API_ENDPOINTS.REPORTS.DEPARTMENT_MONTHLY_SALES, body, { headers })
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess

        if (!ok) {
          const message =
            response.data?.message || response.data?.Message || "Failed to load Department Monthly Sales report"
          setError(message)
          setRows([])
          setTotalRecords(0)
          setTotalQty(0)
          setTotalAmount(0)
          return
        }

        const res = response.data?.response ?? response.data?.Response ?? {}
        const dataRaw = res?.data ?? res?.Data ?? []
        const list: DepartmentMonthlySalesRow[] = Array.isArray(dataRaw)
          ? dataRaw.map((r: any) => {
              const rawMonth = (r.monthStartDate ?? r.MonthStartDate ?? "").toString()
              const fromDtoYear = r.year ?? r.Year
              let yearValue: number
              if (fromDtoYear !== undefined && fromDtoYear !== null && fromDtoYear !== "") {
                yearValue = Number(fromDtoYear)
              } else {
                const d = new Date(rawMonth)
                yearValue = Number.isNaN(d.getTime()) ? 0 : d.getFullYear()
              }

              const fromDtoMonthName = r.monthName ?? r.MonthName
              let monthNameValue: string
              if (fromDtoMonthName && fromDtoMonthName.toString().trim().length > 0) {
                monthNameValue = fromDtoMonthName.toString()
              } else {
                const d = new Date(rawMonth)
                monthNameValue = Number.isNaN(d.getTime())
                  ? ""
                  : d.toLocaleString(undefined, { month: "long" })
              }

              return {
                monthStartDate: rawMonth,
                year: yearValue,
                monthName: monthNameValue,
                storeName: (r.storeName ?? r.StoreName ?? "").toString(),
                department: (r.department ?? r.Department ?? "").toString(),
                qty: Number(r.qty ?? r.Qty ?? 0),
                total: Number(r.total ?? r.Total ?? 0),
              }
            })
          : []

        setRows(list)
        setTotalRecords(res?.totalRecords ?? res?.TotalRecords ?? list.length)
        setTotalQty(
          Number(res?.totalQty ?? res?.TotalQty ?? list.reduce((sum, row) => sum + (row.qty || 0), 0))
        )
        setTotalAmount(
          Number(res?.totalAmount ?? res?.TotalAmount ?? list.reduce((sum, row) => sum + (row.total || 0), 0))
        )

        if (overrides) {
          setAppliedDateFrom(from)
          setAppliedDateTo(to)
          if (overrides.storeId !== undefined) setAppliedStoreId(overrides.storeId)
        }
      } catch (e: any) {
        console.error("Error loading Department Monthly Sales report", e)
        const data = e?.response?.data
        const serverMessage = data?.message ?? data?.Message
        setError(serverMessage || e?.message || "Failed to load Department Monthly Sales report")
        setRows([])
        setTotalRecords(0)
        setTotalQty(0)
        setTotalAmount(0)
      } finally {
        setLoading(false)
      }
    },
    [appliedDateFrom, appliedDateTo, appliedStoreId, getAuthHeaders]
  )

  useEffect(() => {
    if (!runSearchAfterFilters) return
    setRunSearchAfterFilters(false)
    fetchData()
  }, [runSearchAfterFilters, fetchData])

  useEffect(() => {
    if (!filters) {
      fetchData()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const flatpickrCommonOptions = useMemo(
    () => ({
      dateFormat: "Y-m-d",
      allowInput: true,
      static: false,
    }),
    []
  )

  const handleSearch = useCallback(() => {
    setAppliedStoreId(screenStoreId)
    fetchData({ dateFrom, dateTo, storeId: screenStoreId })
  }, [dateFrom, dateTo, screenStoreId, fetchData])

  const fetchAllData = useCallback(
    async (overrideFrom?: string, overrideTo?: string): Promise<any[]> => {
      try {
        const headers = getAuthHeaders()
        const body: Record<string, unknown> = {
          fromDate: overrideFrom || appliedDateFrom,
          toDate: overrideTo || appliedDateTo,
        }
        if (appliedStoreId && appliedStoreId.trim().length > 0) {
          body.storeId = appliedStoreId.trim()
        }
        const response = await axios.post(API_ENDPOINTS.REPORTS.DEPARTMENT_MONTHLY_SALES, body, { headers })
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess
        if (!ok) return []
        const res = response.data?.response ?? response.data?.Response ?? {}
        const dataRaw = res?.data ?? res?.Data ?? []
        return Array.isArray(dataRaw)
          ? dataRaw.map((r: any) => {
              const rawMonth = (r.monthStartDate ?? r.MonthStartDate ?? "").toString()
              const fromDtoYear = r.year ?? r.Year
              let yearValue: number
              if (fromDtoYear !== undefined && fromDtoYear !== null && fromDtoYear !== "") {
                yearValue = Number(fromDtoYear)
              } else {
                const d = new Date(rawMonth)
                yearValue = Number.isNaN(d.getTime()) ? 0 : d.getFullYear()
              }
              const fromDtoMonthName = r.monthName ?? r.MonthName
              let monthNameValue: string
              if (fromDtoMonthName && fromDtoMonthName.toString().trim().length > 0) {
                monthNameValue = fromDtoMonthName.toString()
              } else {
                const d = new Date(rawMonth)
                monthNameValue = Number.isNaN(d.getTime())
                  ? ""
                  : d.toLocaleString(undefined, { month: "long" })
              }
              return {
                monthStartDate: rawMonth,
                year: yearValue,
                monthName: monthNameValue,
                storeName: (r.storeName ?? r.StoreName ?? "").toString(),
                department: (r.department ?? r.Department ?? "").toString(),
                qty: Number(r.qty ?? r.Qty ?? 0),
                total: Number(r.total ?? r.Total ?? 0),
              }
            })
          : []
      } catch (error) {
        console.error("Failed to fetch Department Monthly Sales for export:", error)
        return []
      }
    },
    [getAuthHeaders, appliedDateFrom, appliedDateTo, appliedStoreId]
  )

  const exportModal = useReportExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "department-monthly-sales-report",
    title: "Department Monthly Sales Report",
    subtitle: `${storeDisplayName} | ${new Date(appliedDateFrom).toLocaleDateString()} - ${new Date(appliedDateTo).toLocaleDateString()}`,
    dateField: "monthStartDate",
    defaultDateFrom: appliedDateFrom,
    defaultDateTo: appliedDateTo,
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Department Monthly Sales</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            {appliedDateFrom && appliedDateTo && (
              <>
                <span>
                  {new Date(appliedDateFrom).toLocaleDateString()} –{" "}
                  {new Date(appliedDateTo).toLocaleDateString()}
                </span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{storeDisplayName}</span>
                {totalRecords > 0 && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span>
                      Qty {numberFmt(totalQty)} • Total {currency(totalAmount)}
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Date Range
                </label>
                <div className="flex items-center gap-2">
                  <div className="flatpickr-wrapper w-[142px] relative">
                    <Flatpickr
                      value={dateFrom}
                      onChange={([d]) => setDateFrom(d ? d.toISOString().split("T")[0] : dateFrom)}
                      options={flatpickrCommonOptions}
                      placeholder="From"
                      className="w-full h-10 pl-9 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </span>
                  </div>
                  <span className="text-gray-400 dark:text-gray-500 font-medium">to</span>
                  <div className="flatpickr-wrapper w-[142px] relative">
                    <Flatpickr
                      value={dateTo}
                      onChange={([d]) => setDateTo(d ? d.toISOString().split("T")[0] : dateTo)}
                      options={flatpickrCommonOptions}
                      placeholder="To"
                      className="w-full h-10 pl-9 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1 min-w-[280px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Store
                </label>
                <SearchableSelect
                  options={storeSelectOptions}
                  value={screenStoreId}
                  onChange={(value) => setScreenStoreId(value)}
                  placeholder="Search stores..."
                  loading={loadingStores}
                />
              </div>
            </div>

            <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm ml-auto overflow-visible">
              <button
                onClick={handleSearch}
                className="h-10 px-5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors flex items-center gap-2 border-0 border-r border-gray-200 dark:border-gray-600"
                type="button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Search
              </button>

              {canExport && (
                <div className="relative">
                  <button
                    onClick={exportModal.open}
                    type="button"
                    className="h-10 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 border-0 disabled:opacity-50 rounded-none"
                    title="Preview, filter and export"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 5.414V19a2 2 0 01-2 2z" />
                    </svg>
                    Export
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex-shrink-0">
            {error}
          </div>
        )}

        <div
          className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex-1 min-h-[320px] flex flex-col"
          ref={gridContainerRef}
        >
          <div className="flex-1 min-h-0">
            <ServerGrid
              hideDefaultContextMenuItems={true}
              data={rows}
              columns={columns}
              loading={loading}
              error={error}
              pagination={true}
              pageSize={100}
              columnChooser={true}
              title=""
              totalRecords={totalRecords}
              emptyMessage="No data for the selected criteria. Use filters and click Search to load data."
              defaultGroupByColumns={[
                { field: "year", headerName: "Year" },
                { field: "monthName", headerName: "Month" },
              ]}
              defaultGroupsExpanded={true}
              getRowId={(row) =>
                `${(row as DepartmentMonthlySalesRow)?.year ?? ""}-${(row as DepartmentMonthlySalesRow)?.monthName ?? ""}-${(row as DepartmentMonthlySalesRow)?.storeName ?? ""}-${(row as DepartmentMonthlySalesRow)?.department ?? ""}`
              }
            />
          </div>
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default DepartmentMonthlySalesReportPage

