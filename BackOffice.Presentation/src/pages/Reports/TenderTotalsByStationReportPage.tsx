import React, { useState, useEffect, useCallback, useMemo } from "react"
import axios from "axios"
import Flatpickr from "react-flatpickr"
import "flatpickr/dist/themes/light.css"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { usePermission } from "../../hooks/usePermission"
import { useStore } from "../../context/StoreContext"
import { API_ENDPOINTS } from "../../constants/api"
import { Column as GridUtilsColumn } from "../../gridUtils"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import SearchableSelect, { SelectOption } from "../../components/form/SearchableSelect"
import ExportModal from "../../components/common/ExportModal"
import { useExportModal } from "../../hooks/useExportModal"

interface TenderTotalsByStationReportProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    storeId?: string
    storeName?: string
    stationId?: string
  }
}

interface TenderTotalsPivotRow {
  registerNo: string
  transactionNo: string
  tenderAmounts: Record<string, number>
}

type TenderTotalsGridRow = Record<string, string | number | undefined>

const formatCurrency = (value: number | null | undefined) =>
  value == null ? "$0.00" : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Base tender order used for tender columns in the station report.
// All tender types returned by the API will be shown as columns, ordered with this preference first.
const DESKTOP_TENDER_ORDER = ["CASH", "CHECK", "CREDIT CARD", "CREDIT SLIP", "EBT", "GIFT CARD", "GIFT"]

function orderTenderColumns(tenderColumnNames: string[]): string[] {
  const byLower = new Map(tenderColumnNames.map((n) => [n.toLowerCase(), n]))
  const ordered: string[] = []
  const added = new Set<string>()
  DESKTOP_TENDER_ORDER.forEach((key) => {
    const name = byLower.get(key.toLowerCase())
    if (name && !added.has(name)) {
      ordered.push(name)
      added.add(name)
    }
  })
  tenderColumnNames.forEach((name) => {
    if (!added.has(name)) {
      ordered.push(name)
      added.add(name)
    }
  })
  return ordered
}

function buildTenderTotalsColumns(tenderColumnNames: string[]): Column[] {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200
  const isSmallScreen = viewportWidth < 1024
  const isVerySmallScreen = viewportWidth < 768
  const locationWidth = isSmallScreen ? 140 : 160
  const transactionWidth = isSmallScreen ? 140 : 160
  const tenderWidth = isSmallScreen ? 100 : 120
  const grandTotalWidth = isSmallScreen ? 120 : 140

  const orderedTender = orderTenderColumns(tenderColumnNames)
  const cols: Column[] = []

  const displayHeaderName = (field: string): string => {
    const parts = field.split("/")
    if (parts.length === 2) {
      const sub = parts[1].trim()
      // Only show the child name in the column header; group name is now in separate header row
      return sub || field
    }
    return field
  }

  // Location and Transaction No columns
  cols.push(
    {
      field: "registerNo",
      headerName: "Location",
      width: locationWidth,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    },
    {
      field: "transactionNo",
      headerName: "Transaction No",
      width: transactionWidth,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
    }
  )

  orderedTender.forEach((name) => {
    cols.push({
      field: name,
      headerName: displayHeaderName(name),
      width: tenderWidth,
      sortable: true,
      filterable: false,
      visible: !isVerySmallScreen,
      dataType: "number",
      cellRenderer: (value: number) => formatCurrency(value),
    })
  })

  cols.push({
    field: "grandTotal",
    headerName: "Grand Total",
    width: grandTotalWidth,
    sortable: true,
    filterable: false,
    visible: true,
    dataType: "number",
    cellRenderer: (value: number) => formatCurrency(value),
  })

  return cols
}

const TENDER_TOTALS_BY_STATION_SCREEN_CODE = "reports.tender_totals_by_station"

const TenderTotalsByStationReportPage: React.FC<TenderTotalsByStationReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { canExport } = usePermission(TENDER_TOTALS_BY_STATION_SCREEN_CODE)

  const todayStr = new Date().toISOString().split("T")[0]
  const defaultDateFrom = filters?.dateFrom || todayStr
  const defaultDateTo = filters?.dateTo || todayStr

  const [dateFrom, setDateFrom] = useState<string>(defaultDateFrom)
  const [dateTo, setDateTo] = useState<string>(defaultDateTo)
  const [timeFrom, setTimeFrom] = useState<string>("00:00")
  const [timeTo, setTimeTo] = useState<string>("23:59")
  const [appliedDateFrom, setAppliedDateFrom] = useState<string>(defaultDateFrom)
  const [appliedDateTo, setAppliedDateTo] = useState<string>(defaultDateTo)

  const [pivotData, setPivotData] = useState<TenderTotalsPivotRow[]>([])
  const [tenderColumnNames, setTenderColumnNames] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [runSearchAfterFilters, setRunSearchAfterFilters] = useState(false)

  const [stores, setStores] = useState<{ id: string; name: string; code?: string }[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [stationOptions, setStationOptions] = useState<SelectOption[]>([])
  const [loadingStations, setLoadingStations] = useState(false)
  const [screenStation, setScreenStation] = useState<string>(() => filters?.stationId ?? "")
  const [appliedStation, setAppliedStation] = useState<string>(() => filters?.stationId ?? "")

  const [screenStoreId, setScreenStoreId] = useState<string>(() => {
    if (filters?.storeId !== undefined) return filters.storeId
    return ""
  })
  const [screenStoreName, setScreenStoreName] = useState<string>(() => {
    if (filters?.storeId !== undefined && filters.storeId?.trim())
      return filters.storeName?.trim() || ""
    return ""
  })
  const [appliedStoreId, setAppliedStoreId] = useState<string>(() => {
    if (filters?.storeId !== undefined) return filters.storeId
    return ""
  })
  const [appliedStoreName, setAppliedStoreName] = useState<string>(() => {
    if (filters?.storeId !== undefined) {
      const id = (filters.storeId ?? "").trim()
      return id ? (filters.storeName?.trim() || "Selected Store") : "All Stores"
    }
    return "All Stores"
  })

  const effectiveStoreId =
    appliedStoreId && appliedStoreId.trim().length > 0 ? appliedStoreId.trim() : undefined

  const getLocalUserId = useCallback(() => {
    try {
      const userData = localStorage.getItem("userData")
      if (userData) {
        const parsed = JSON.parse(userData)
        return parsed.localUserId || ""
      }
    } catch {
      // ignore
    }
    return ""
  }, [])

  useEffect(() => {
    const headers = getAuthHeaders()
    const userId = getLocalUserId()

    setLoadingStores(true)

    const url = userId
      ? `${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${userId}`
      : API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES

    fetch(url, { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data?.isSuccess && Array.isArray(data.response)) {
          setStores(
            data.response.map((s: { storeID: string | number; storeName: string; storeNo?: number }) => ({
              id: String(s.storeID),
              name: s.storeName,
              code: s.storeNo?.toString(),
            }))
          )
        } else {
          setStores([])
        }
      })
      .catch((err) => {
        console.error("Failed to load stores for Tender Totals By Station", err)
        setStores([])
      })
      .finally(() => setLoadingStores(false))
  }, [getAuthHeaders, getLocalUserId])

  const flatpickrCommonOptions = useMemo(
    () => ({
      dateFormat: "Y-m-d",
      allowInput: true,
      static: false,
    }),
    []
  )

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

  // Sync dates from Report Manager filters when provided
  useEffect(() => {
    const hasDates = filters?.dateFrom || filters?.dateTo
    const hasStation = typeof filters?.stationId === "string"
    if (hasDates || hasStation) {
      const from = filters?.dateFrom || todayStr
      const to = filters?.dateTo || todayStr
      setDateFrom(from)
      setDateTo(to)
      setAppliedDateFrom(from)
      setAppliedDateTo(to)
      if (hasStation) {
        setScreenStation(filters?.stationId ?? "")
        setAppliedStation(filters?.stationId ?? "")
      }
      setRunSearchAfterFilters(true)
    }
  }, [filters?.dateFrom, filters?.dateTo, filters?.stationId])

  // Load stations (registers) similar to desktop: by store (when selected), otherwise all
  useEffect(() => {
    const loadStations = async () => {
      try {
        setLoadingStations(true)
        const headers = getAuthHeaders()
        const params: Record<string, string> = {
          startRow: "0",
          endRow: "1000",
          sortColumn: "registerNo",
          sortDirection: "asc",
        }
        if (screenStoreId) {
          params.storeId = screenStoreId
        }
        const response = await axios.get(API_ENDPOINTS.REGISTERS.GET_ALL, { params, headers })
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess
        const payload = response.data?.response ?? response.data?.Response
        const rows: any[] = ok && payload?.data ? payload.data : []

        // Build unique station list, plus an explicit "All Stations" option
        const set = new Set<string>()
        const options: SelectOption[] = []
        rows.forEach((r) => {
          const raw = r?.registerNo ?? r?.RegisterNo ?? ""
          const value = String(raw ?? "").trim()
          if (value && !set.has(value)) {
            set.add(value)
            options.push({ value, label: value })
          }
        })

        setStationOptions([{ value: "", label: "All Stations" }, ...options])
      } catch (err) {
        console.error("Failed to load stations for Tender Totals By Station", err)
        setStationOptions([])
      } finally {
        setLoadingStations(false)
      }
    }

    // Only load once user has a store context (from filters or current selection)
    loadStations()
  }, [screenStoreId, getAuthHeaders])

  const displayRows = useMemo((): TenderTotalsGridRow[] => {
    const amt = (r: TenderTotalsPivotRow, col: string) => {
      const t = r.tenderAmounts ?? {}
      if (Object.prototype.hasOwnProperty.call(t, col)) return t[col] ?? 0
      const key = Object.keys(t).find((k) => k.localeCompare(col, undefined, { sensitivity: "accent" }) === 0)
      return key != null ? (t[key] ?? 0) : 0
    }
    const source = appliedStation ? pivotData.filter((r) => r.registerNo === appliedStation) : pivotData

    return source.map((r, i) => {
      // Grand total = sum of all tender amounts for the row (even if not all are shown as columns)
      const rowTotal = Object.values(r.tenderAmounts || {}).reduce((sum, v) => {
        return sum + (typeof v === "number" ? v : 0)
      }, 0)
      const row: TenderTotalsGridRow = {
        id: (r as any).id ?? `${r.registerNo}-${r.transactionNo}-${i}`,
        registerNo: r.registerNo,
        transactionNo: r.transactionNo,
        grandTotal: rowTotal,
      }
      tenderColumnNames.forEach((col) => {
        row[col] = amt(r, col)
      })
      return row
    })
  }, [pivotData, appliedStation, tenderColumnNames])

  const columns = useMemo(() => buildTenderTotalsColumns(tenderColumnNames), [tenderColumnNames])

  const fetchData = useCallback(async () => {
    if (!dateFrom || !dateTo) return

    setLoading(true)
    setError(null)

    try {
      const headers = getAuthHeaders()
      const body: Record<string, unknown> = {
        fromDate: dateFrom,
        toDate: dateTo,
        fromTime: timeFrom || "00:00",
        toTime: timeTo || "23:59",
      }
      if (effectiveStoreId) body.storeId = effectiveStoreId

      const response = await axios.post(API_ENDPOINTS.REPORTS.TENDER_TOTALS_BY_STATION, body, { headers })

      const ok = response.data?.isSuccess ?? response.data?.IsSuccess
      if (ok) {
        const res = response.data?.response ?? response.data?.Response ?? {}
        const rawData = res?.data ?? res?.Data ?? []
        const colNames = (res?.tenderColumnNames ?? res?.TenderColumnNames ?? []) as string[]

        const raw = Array.isArray(rawData) ? rawData : []
        const data = raw.map((r: any, i: number) => {
          const amt = r?.tenderAmounts ?? r?.TenderAmounts
          const tenderAmounts =
            amt && typeof amt === "object" && !Array.isArray(amt) ? amt : {}
          return {
            registerNo: String(r?.registerNo ?? r?.RegisterNo ?? ""),
            transactionNo: String(
              r?.transactionNo ?? r?.TransactionNo ?? r?.cashier ?? r?.Cashier ?? ""
            ),
            tenderAmounts,
            id: `${r?.registerNo ?? r?.RegisterNo ?? ""}-${r?.transactionNo ?? r?.TransactionNo ?? r?.cashier ?? r?.Cashier ?? ""}-${i}`,
          }
        })

        setPivotData(data)
        setTenderColumnNames(Array.isArray(colNames) ? colNames : [])
        setTotalRecords(res?.totalRecords ?? res?.TotalRecords ?? data.length ?? 0)
        const totalAmt =
          res?.totalAmount ??
          res?.TotalAmount ??
          data.reduce((sum: number, r: any) => sum + (Object.values(r.tenderAmounts || {}) as number[]).reduce((a: number, b: number) => a + b, 0), 0)
        setTotalAmount(totalAmt)
        setAppliedDateFrom(dateFrom)
        setAppliedDateTo(dateTo)
      } else {
        const message = response.data?.message || "Failed to load Tender Totals By Station report"
        setError(message)
      }
    } catch (e: unknown) {
      const err = e as { message?: string }
      console.error("Error loading Tender Totals By Station report", e)
      setError(err?.message || "Failed to load Tender Totals By Station report")
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, timeFrom, timeTo, effectiveStoreId, getAuthHeaders])

  const handleSearch = useCallback(() => {
    setAppliedStoreId(screenStoreId)
    setAppliedStoreName(
      screenStoreId
        ? stores.find((s) => s.id === screenStoreId)?.name ?? "Selected Store"
        : "All Stores"
    )
    setAppliedStation(screenStation)
    fetchData()
  }, [screenStoreId, screenStation, stores, fetchData])

  useEffect(() => {
    if (!runSearchAfterFilters) return
    setRunSearchAfterFilters(false)
    fetchData()
  }, [runSearchAfterFilters, fetchData])

  useEffect(() => {
    fetchData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const columnsForExport = useMemo(() => {
    const orderedTender = orderTenderColumns(tenderColumnNames)
    return [
      { field: "registerNo", headerName: "Location", dataType: "string" as const },
      { field: "transactionNo", headerName: "Transaction No", dataType: "string" as const },
      ...orderedTender.map((name) => ({ field: name, headerName: name, dataType: "number" as const })),
      { field: "grandTotal", headerName: "Grand Total", dataType: "number" as const },
    ]
  }, [tenderColumnNames])

  // Fetch all rows for the export modal, scoped to an optional override date range.
  const fetchAllData = useCallback(
    async (overrideFrom?: string, overrideTo?: string): Promise<any[]> => {
      try {
        const headers = getAuthHeaders()
        const body: Record<string, unknown> = {
          fromDate: overrideFrom || appliedDateFrom,
          toDate: overrideTo || appliedDateTo,
          fromTime: timeFrom || "00:00",
          toTime: timeTo || "23:59",
        }
        if (effectiveStoreId) body.storeId = effectiveStoreId
        const response = await axios.post(API_ENDPOINTS.REPORTS.TENDER_TOTALS_BY_STATION, body, { headers })
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess
        if (!ok) return []
        const res = response.data?.response ?? response.data?.Response ?? {}
        const rawData = res?.data ?? res?.Data ?? []
        const colNames = (res?.tenderColumnNames ?? res?.TenderColumnNames ?? []) as string[]
        const raw = Array.isArray(rawData) ? rawData : []
        const pivot = raw.map((r: any, i: number) => {
          const amt = r?.tenderAmounts ?? r?.TenderAmounts
          const tenderAmounts =
            amt && typeof amt === "object" && !Array.isArray(amt) ? amt : {}
          return {
            registerNo: String(r?.registerNo ?? r?.RegisterNo ?? ""),
            transactionNo: String(
              r?.transactionNo ?? r?.TransactionNo ?? r?.cashier ?? r?.Cashier ?? ""
            ),
            tenderAmounts,
            id: `${r?.registerNo ?? r?.RegisterNo ?? ""}-${r?.transactionNo ?? r?.TransactionNo ?? r?.cashier ?? r?.Cashier ?? ""}-${i}`,
          }
        })
        const useColNames = Array.isArray(colNames) && colNames.length ? colNames : tenderColumnNames
        const source = appliedStation ? pivot.filter((r) => r.registerNo === appliedStation) : pivot
        return source.map((r) => {
          const t = r.tenderAmounts as Record<string, number>
          const rowTotal = Object.values(t || {}).reduce((sum, v) => sum + (typeof v === "number" ? v : 0), 0)
          const row: Record<string, unknown> = {
            id: (r as any).id,
            registerNo: r.registerNo,
            transactionNo: r.transactionNo,
            grandTotal: rowTotal,
          }
          useColNames.forEach((col) => {
            row[col] = Object.prototype.hasOwnProperty.call(t, col) ? t[col] ?? 0 : 0
          })
          return row
        })
      } catch (error) {
        console.error("Failed to fetch Tender Totals By Station for export:", error)
        return []
      }
    },
    [getAuthHeaders, appliedDateFrom, appliedDateTo, timeFrom, timeTo, effectiveStoreId, tenderColumnNames, appliedStation]
  )

  // Use `useExportModal` directly (not `useReportExportModal`) — Tender Totals By Station is
  // a pivot (one row per station × tender), no per-row date field. The wrapper hook always
  // injects a row-level `dateRange` filter that would drop every row (filter looks up
  // `row.date`, finds nothing, returns false → "No data found"). Same fix as the Item
  // Daily/Weekly/Monthly Sales pivot pages.
  //
  // Date scoping is preserved: `fetchAllData` reads `appliedDateFrom` / `appliedDateTo`
  // from the page's currently-applied filters and forwards them to the backend.
  const exportModal = useExportModal({
    columns: columnsForExport as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "tender-totals-by-station-report",
    pdfOptions: {
      title: "Tender Totals By Station Report",
      subtitle: `${appliedStoreName} | ${new Date(appliedDateFrom).toLocaleDateString()} - ${new Date(appliedDateTo).toLocaleDateString()}`,
      orientation: "landscape",
    },
    // No `filters` → modal renders no Date Range picker, and no client-side filter is applied.
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        {/* Title and summary */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tender Totals By Station</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{appliedStoreName}</span>
            {appliedDateFrom && appliedDateTo && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>
                  {new Date(appliedDateFrom).toLocaleDateString()} – {new Date(appliedDateTo).toLocaleDateString()}
                </span>
              </>
            )}
            {totalRecords > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{totalRecords.toLocaleString()} records</span>
              </>
            )}
          </div>
        </div>

        {/* Filters card - copied style from Tax By Store */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date Range</label>
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-1 min-w-[220px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Store
                </label>
                <SearchableSelect
                  options={storeSelectOptions}
                  value={screenStoreId}
                  onChange={(value) => {
                    setScreenStoreId(value)
                    const store = stores.find((s) => s.id === value)
                    setScreenStoreName(store?.name ?? "")
                  }}
                  placeholder="Search stores..."
                  loading={loadingStores}
                />
              </div>

              <div className="space-y-1 min-w-[180px]">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Station
                </label>
                <SearchableSelect
                  options={stationOptions}
                  value={screenStation}
                  onChange={(value) => setScreenStation(value)}
                  placeholder="All Stations"
                  loading={loadingStations}
                  disabled={stationOptions.length === 0}
                />
              </div>
            </div>

            {/* Button group: Search, Export (same style as Tax By Store) */}
            <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm ml-auto overflow-visible">
              <button
                onClick={handleSearch}
                className="h-10 px-5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors flex items-center gap-2 border-0 border-right border-gray-200 dark:border-gray-600"
                type="button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>

              {canExport && (
                <div className="relative border-0 border-r border-gray-200 dark:border-gray-600">
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
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <ServerGrid
            hideDefaultContextMenuItems={true}
            data={displayRows}
            columns={columns}
            loading={loading}
            error={error}
            pagination={true}
            pageSize={100}
            columnChooser={true}
            title="Tender Totals By Station"
            totalRecords={totalRecords}
            emptyMessage="No data for the selected criteria"
            getRowId={(row) => row?.id ?? `${row?.registerNo ?? ""}-${row?.transactionNo ?? ""}`}
            defaultGroupByColumns={[{ field: "registerNo", headerName: "Location" }]}
            defaultGroupsExpanded={true}
          />
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default TenderTotalsByStationReportPage

