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
import { useDashboardTabs } from "../../context/DashboardTabContext"

interface TenderTotalsReportProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    storeId?: string
    storeName?: string
  }
}

/** API pivot row: one per (Register, Cashier) with amounts per tender type */
interface TenderTotalsPivotRow {
  registerNo: string
  cashier: string
  tenderAmounts: Record<string, number>
}

/** Flattened row for grid: Location, Cashier, Amount, tender breakdown, Grand Total */
type TenderTotalsGridRow = Record<string, string | number | undefined>

const formatCurrency = (value: number | null | undefined) =>
  value == null ? "$0.00" : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Column order: Location, Cashier, Amount, Tender Type (CASH, CHECK), Credit Type, Type (EBT, GIFT CARD), Grand Total */
const DESKTOP_TENDER_ORDER = [
  "CASH",
  "CHECK",
  "CREDIT CARD",
  "CREDIT SLIP",
  "EBT",
  "GIFT CARD",
]

/** The fixed desktop pivot always shows this full tender scaffold (with the nested
 *  CREDIT CARD brand sub-band and the Gift band), regardless of which tenders the
 *  store actually used. The API only returns columns that have data — and falls back
 *  to this same list only when there's zero data (ReportService.StandardTenderTypes /
 *  the no-data fallback). So we merge it in on the client to keep the layout stable:
 *  tenders with no activity simply render $0.00. Brand names match the backend exactly
 *  so real per-brand amounts bind when present. */
const DESKTOP_CANONICAL_TENDERS = [
  "CASH",
  "CHECK",
  "CC OFFLINE",
  "CREDIT CARD / AMEX",
  "CREDIT CARD / Discover",
  "CREDIT CARD / Master Card",
  "CREDIT CARD / Visa",
  "CREDIT CARD",
  "DEBIT",
  "EBT",
  "WIC",
  "CREDIT SLIP",
  "GIFT CARD",
]

/** Return tender column names in desktop/screenshot order; use exact API name for field so row[field] binds. */
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

/** Build columns: Location/Cashier (left-pinned), then Amount, the desktop's 3-row
 *  banded tender columns, and finally Actual Cash Total / Gift Total / Grand Total.
 *
 *  Header rows for the tender bands:
 *    Row 1 (group)    : "Actual Cash" | "Gift"
 *    Row 2 (subGroup) : "CREDIT CARD" over AMEX/Discover/Master Card/Visa; nothing for
 *                       CASH/CHECK/CC OFFLINE/CREDIT CARD/DEBIT/EBT/WIC/GIFT CARD/CREDIT SLIP
 *    Row 3 (column)   : Individual tender / credit-type name. Columns without a row-2
 *                       sub-group rowSpan into row 2 automatically (handled in GridHeader).
 *
 *  Synthetic total columns (Actual Cash Total / Gift Total / Grand Total) carry no group,
 *  so they sit outside the banded sections like the desktop's trailing summary columns.
 */
function buildTenderTotalsColumns(tenderColumnNames: string[]): Column[] {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200
  const isSmallScreen = viewportWidth < 1024
  const isVerySmallScreen = viewportWidth < 768
  const locationWidth = isSmallScreen ? 120 : 140
  const cashierWidth = isSmallScreen ? 120 : 140
  const amountWidth = isSmallScreen ? 110 : 130
  const tenderWidth = isSmallScreen ? 100 : 120
  const grandTotalWidth = isSmallScreen ? 120 : 140

  const orderedTender = orderTenderColumns(tenderColumnNames)
  const cols: Column[] = []

  // Location and Cashier first (group-by columns). Pinned to the left so they stay
  // visible while the user scrolls horizontally through the wide tender column list —
  // matches the desktop pivot grid where the row-group fields are anchored to the left.
  cols.push(
    {
      field: "registerNo",
      headerName: "Location",
      width: locationWidth,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
      pinned: "left",
    },
    {
      field: "cashier",
      headerName: "Cashier",
      width: cashierWidth,
      sortable: true,
      filterable: true,
      visible: true,
      dataType: "string",
      pinned: "left",
    }
  )

  cols.push({
    field: "amount",
    headerName: "Amount",
    width: amountWidth,
    sortable: true,
    filterable: false,
    visible: true,
    dataType: "number",
    cellRenderer: (value: number) => formatCurrency(value),
  })

  // Resolve (group, subGroup, displayHeader) for a tender column name from the API.
  // Returns explicit band metadata so the grid header renders the desktop's 3-row layout.
  const classifyTenderColumn = (
    name: string
  ): { group: string; subGroup?: string; headerName: string } => {
    const upper = name.toUpperCase().trim()

    // "CREDIT CARD / Visa" → Actual Cash band with CREDIT CARD sub-band; show only "Visa".
    if (/^CREDIT CARD\s*\//i.test(name)) {
      const sub = name.split("/")[1]?.trim() || name
      return { group: "Actual Cash", subGroup: "CREDIT CARD", headerName: sub }
    }

    // "GIFT / GIFT CARD" / "GIFT / CREDIT SLIP" → Gift band, no sub-band; show the child.
    if (/^GIFT\s*\//i.test(name)) {
      const sub = name.split("/")[1]?.trim() || name
      return { group: "Gift", headerName: sub }
    }

    // Plain back-office tenders that live directly under Actual Cash (no sub-band).
    if (
      upper === "CASH" ||
      upper === "CHECK" ||
      upper === "CC OFFLINE" ||
      upper === "CREDIT CARD" ||
      upper === "DEBIT" ||
      upper === "EBT" ||
      upper === "WIC"
    ) {
      return { group: "Actual Cash", headerName: name }
    }

    // Plain back-office tenders under Gift (no sub-band).
    if (upper === "GIFT CARD" || upper === "CREDIT SLIP" || upper === "GIFT") {
      return { group: "Gift", headerName: name }
    }

    // Fallback: leave the column un-banded so we don't accidentally bury an unknown
    // tender inside the desktop layout.
    return { group: "", headerName: name }
  }

  const hasAnyGift = orderedTender.some((n) => /^GIFT\s*\//i.test(n) || /^(GIFT CARD|CREDIT SLIP|GIFT)$/i.test(n))

  const isCreditCardBrand = (name: string) => /^CREDIT CARD\s*\//i.test(name)
  // The nested CREDIT CARD sub-band only exists when the API breaks credit cards
  // out by brand ("CREDIT CARD / Visa", ...). Without a brand breakdown the plain
  // "CREDIT CARD" column stays an ordinary Actual Cash leaf (no sub-band, no arrow).
  const hasCreditCardBrands = orderedTender.some(isCreditCardBrand)

  // Split the tender columns by their top-level band so each band's columns are
  // contiguous — collapsible header bands require their child columns (and the
  // trailing band total) to sit next to each other. Anything that doesn't
  // classify into a band stays ungrouped and is appended right after Amount.
  const actualCashChildren: Column[] = []
  const creditCardBrandCols: Column[] = []
  const giftChildren: Column[] = []
  let plainCreditCardCol: Column | null = null

  orderedTender.forEach((name) => {
    const { group, headerName } = classifyTenderColumn(name)
    const base: Column = {
      field: name,
      headerName,
      width: tenderWidth,
      sortable: true,
      filterable: false,
      visible: !isVerySmallScreen,
      dataType: "number",
      cellRenderer: (value: number) => formatCurrency(value),
    }

    if (hasCreditCardBrands && isCreditCardBrand(name)) {
      creditCardBrandCols.push({
        ...base,
        group: "Actual Cash",
        subGroup: "CREDIT CARD",
        groupCollapsible: true,
        subGroupCollapsible: true,
      })
      return
    }
    if (hasCreditCardBrands && name.toUpperCase().trim() === "CREDIT CARD") {
      // Plain CREDIT CARD aggregate becomes the sub-band's summary column: it
      // stays visible (showing the CREDIT CARD total) while the brands collapse.
      plainCreditCardCol = {
        ...base,
        group: "Actual Cash",
        subGroup: "CREDIT CARD",
        groupCollapsible: true,
        subGroupCollapsible: true,
        subGroupSummary: true,
        subGroupDefaultCollapsed: true,
      }
      return
    }

    if (group === "Gift") giftChildren.push({ ...base, group, groupCollapsible: true })
    else if (group === "Actual Cash") actualCashChildren.push({ ...base, group, groupCollapsible: true })
    else cols.push(base)
  })

  // Assemble the CREDIT CARD sub-band (brands followed by their summary). When the
  // API doesn't supply a plain "CREDIT CARD" aggregate, synthesize a creditCardTotal
  // summary (computed per-row in displayRows from the brand columns).
  const creditCardBand: Column[] = []
  if (hasCreditCardBrands) {
    creditCardBand.push(...creditCardBrandCols)
    creditCardBand.push(
      plainCreditCardCol ?? {
        field: "creditCardTotal",
        headerName: "CREDIT CARD",
        width: tenderWidth,
        sortable: true,
        filterable: false,
        visible: true,
        dataType: "number",
        cellRenderer: (value: number) => formatCurrency(value),
        group: "Actual Cash",
        subGroup: "CREDIT CARD",
        groupCollapsible: true,
        subGroupCollapsible: true,
        subGroupSummary: true,
        subGroupDefaultCollapsed: true,
      }
    )
  }

  // Order Actual Cash leaves CASH → CC OFFLINE → CHECK → [CREDIT CARD band] →
  // DEBIT → EBT → WIC to match the desktop pivot.
  const ACTUAL_CASH_ORDER = ["CASH", "CC OFFLINE", "CHECK", "DEBIT", "EBT", "WIC"]
  const acRank = (field: string) => {
    const idx = ACTUAL_CASH_ORDER.indexOf(field.toUpperCase().trim())
    return idx === -1 ? ACTUAL_CASH_ORDER.length : idx
  }
  actualCashChildren.sort((a, b) => acRank(a.field) - acRank(b.field))
  const beforeCreditCard = ["CASH", "CC OFFLINE", "CHECK"]
  const isBefore = (c: Column) => beforeCreditCard.includes(c.field.toUpperCase().trim())
  const actualCashSection = [
    ...actualCashChildren.filter(isBefore),
    ...creditCardBand,
    ...actualCashChildren.filter((c) => !isBefore(c)),
  ]

  // Actual Cash band: ordered children (with the nested CREDIT CARD sub-band),
  // then the band's running total. Expanded by default — only the nested CREDIT
  // CARD sub-band starts collapsed.
  cols.push(...actualCashSection)
  cols.push({
    field: "actualCashTotal",
    headerName: "Actual Cash Total",
    width: grandTotalWidth,
    sortable: true,
    filterable: false,
    visible: true,
    dataType: "number",
    cellRenderer: (value: number) => formatCurrency(value),
    group: "Actual Cash",
    groupCollapsible: true,
    groupSummary: true,
  })

  // Gift band: children, then its running total. Expanded by default.
  if (hasAnyGift) {
    cols.push(...giftChildren)
    cols.push({
      field: "giftTotal",
      headerName: "Gift Total",
      width: grandTotalWidth,
      sortable: true,
      filterable: false,
      visible: true,
      dataType: "number",
      cellRenderer: (value: number) => formatCurrency(value),
      group: "Gift",
      groupCollapsible: true,
      groupSummary: true,
    })
  }

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

const TENDER_TOTALS_SCREEN_CODE = "reports.tender_totals"

const TenderTotalsReportPage: React.FC<TenderTotalsReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { canExport } = usePermission(TENDER_TOTALS_SCREEN_CODE)
  const { openTab } = useDashboardTabs()

  // From and To date default to Report Manager filters, otherwise current date
  const todayStr = new Date().toISOString().split("T")[0]
  const defaultDateFrom = filters?.dateFrom || todayStr
  const defaultDateTo = filters?.dateTo || todayStr

  const [dateFrom, setDateFrom] = useState<string>(defaultDateFrom)
  const [dateTo, setDateTo] = useState<string>(defaultDateTo)
  const [timeFrom, setTimeFrom] = useState<string>("00:00")
  const [timeTo, setTimeTo] = useState<string>("23:59")
  const [appliedDateFrom, setAppliedDateFrom] = useState<string>(defaultDateFrom)
  const [appliedDateTo, setAppliedDateTo] = useState<string>(defaultDateTo)
  const [includePayout, setIncludePayout] = useState<boolean>(true)

  const [pivotData, setPivotData] = useState<TenderTotalsPivotRow[]>([])
  const [tenderColumnNames, setTenderColumnNames] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [runSearchAfterFilters, setRunSearchAfterFilters] = useState(false)

  // Store lookup (same pattern as other reports)
  const [stores, setStores] = useState<{ id: string; name: string; code?: string }[]>([])
  const [loadingStores, setLoadingStores] = useState(false)

  // When Report Manager passes a store, use it; otherwise default to "All Stores" (no store ID set)
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
    const userId = getLocalUserId()
    if (!userId) return
    setLoadingStores(true)
    const headers = getAuthHeaders()
    fetch(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${userId}`, { headers })
      .then(res => res.json())
      .then(data => {
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

  // When Report Manager passes date filters, sync them into this screen and auto-run the search once
  useEffect(() => {
    if (filters?.dateFrom || filters?.dateTo) {
      const from = filters.dateFrom || todayStr
      const to = filters.dateTo || todayStr
      setDateFrom(from)
      setDateTo(to)
      setAppliedDateFrom(from)
      setAppliedDateTo(to)
      setRunSearchAfterFilters(true)
    }
  }, [filters?.dateFrom, filters?.dateTo])

  /** Grid rows: flatten pivot so each row has Amount, tender breakdown, Location, Cashier,
   *  and the trailing total columns the desktop renders (Actual Cash Total, Gift Total, Grand Total).
   *  Mirrors the band classification in GridHeader/buildTenderTotalsColumns so the per-row
   *  subtotals always line up with the column they sit under. */
  const isGiftCol = (field: string) => {
    const upper = field.toUpperCase()
    return upper.startsWith("GIFT /") || upper === "GIFT CARD" || upper === "CREDIT SLIP" || upper === "GIFT"
  }
  const isActualCashCol = (field: string) => !isGiftCol(field)
  const isCreditCardBrandCol = (field: string) => /^CREDIT CARD\s*\//i.test(field)

  const displayRows = useMemo((): TenderTotalsGridRow[] => {
    const amt = (r: TenderTotalsPivotRow, col: string) => {
      const t = r.tenderAmounts ?? {}
      if (Object.prototype.hasOwnProperty.call(t, col)) return t[col] ?? 0
      const key = Object.keys(t).find((k) => k.localeCompare(col, undefined, { sensitivity: "accent" }) === 0)
      return key != null ? (t[key] ?? 0) : 0
    }
    // When the API breaks credit cards out by brand it ALSO returns a plain
    // "CREDIT CARD" column holding the brand sum. Exclude that aggregate from the
    // totals so credit card isn't counted twice (brands + aggregate).
    const hasBrandCols = tenderColumnNames.some(isCreditCardBrandCol)
    return pivotData.map((r, i) => {
      let actualCashTotal = 0
      let giftTotal = 0
      let grandTotal = 0
      let creditCardTotal = 0
      tenderColumnNames.forEach((col) => {
        const v = amt(r, col)
        const n = typeof v === "number" ? v : 0
        if (isCreditCardBrandCol(col)) creditCardTotal += n
        const isPlainCreditCardAggregate =
          hasBrandCols && col.toUpperCase().trim() === "CREDIT CARD"
        if (isPlainCreditCardAggregate) return
        grandTotal += n
        if (isActualCashCol(col)) actualCashTotal += n
        if (isGiftCol(col)) giftTotal += n
      })
      const row: TenderTotalsGridRow = {
        id: (r as any).id ?? `${r.registerNo}-${r.cashier}-${i}`,
        amount: grandTotal,
        registerNo: r.registerNo,
        cashier: r.cashier,
        actualCashTotal,
        giftTotal,
        grandTotal,
        creditCardTotal,
      }
      tenderColumnNames.forEach((col) => {
        row[col] = amt(r, col)
      })
      return row
    })
  }, [pivotData, tenderColumnNames])

  // Always render the full desktop tender scaffold: merge the canonical set with
  // whatever the API returned (API columns first so their order/casing wins; any
  // canonical tender the data lacked is appended and renders $0.00).
  const columns = useMemo(() => {
    const present = new Set(tenderColumnNames.map((n) => n.toLowerCase()))
    const merged = [...tenderColumnNames]
    DESKTOP_CANONICAL_TENDERS.forEach((c) => {
      if (!present.has(c.toLowerCase())) merged.push(c)
    })
    return buildTenderTotalsColumns(merged)
  }, [tenderColumnNames])

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
        includePayOut: includePayout,
      }
      // Only send storeId when a specific store is selected; "All Stores" = do not set storeId
      if (effectiveStoreId) body.storeId = effectiveStoreId

      const response = await axios.post(API_ENDPOINTS.REPORTS.TENDER_TOTALS, body, { headers })

      const ok = response.data?.isSuccess ?? response.data?.IsSuccess
      if (ok) {
        const res = response.data?.response ?? response.data?.Response ?? {}
        const rawData = res?.data ?? res?.Data ?? []
        const colNames = (res?.tenderColumnNames ?? res?.TenderColumnNames ?? []) as string[]

        // Normalize rows: handle camelCase/PascalCase and ensure structure for grid binding
        const raw = Array.isArray(rawData) ? rawData : []
        const data = raw.map((r: any, i: number) => {
          const amt = r?.tenderAmounts ?? r?.TenderAmounts
          const tenderAmounts =
            amt && typeof amt === "object" && !Array.isArray(amt) ? amt : {}
          return {
            registerNo: String(r?.registerNo ?? r?.RegisterNo ?? ""),
            cashier: String(r?.cashier ?? r?.Cashier ?? ""),
            tenderAmounts,
            id: `${r?.registerNo ?? r?.RegisterNo ?? ""}-${r?.cashier ?? r?.Cashier ?? ""}-${i}`,
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
        const message = response.data?.message || "Failed to load Tender Totals report"
        setError(message)
      }
    } catch (e: unknown) {
      const err = e as { message?: string }
      console.error("Error loading Tender Totals report", e)
      setError(err?.message || "Failed to load Tender Totals report")
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, timeFrom, timeTo, includePayout, effectiveStoreId, getAuthHeaders])

  const handleSearch = useCallback(() => {
    setAppliedStoreId(screenStoreId)
    setAppliedStoreName(
      screenStoreId
        ? stores.find((s) => s.id === screenStoreId)?.name ?? "Selected Store"
        : "All Stores"
    )
    fetchData()
  }, [screenStoreId, stores, fetchData])

  // Run search once after filters from Report Manager have been applied
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
      { field: "cashier", headerName: "Cashier", dataType: "string" as const },
      { field: "amount", headerName: "Amount", dataType: "number" as const },
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
          includePayOut: includePayout,
        }
        if (effectiveStoreId) body.storeId = effectiveStoreId

        const response = await axios.post(API_ENDPOINTS.REPORTS.TENDER_TOTALS, body, { headers })
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
            cashier: String(r?.cashier ?? r?.Cashier ?? ""),
            tenderAmounts,
            id: `${r?.registerNo ?? r?.RegisterNo ?? ""}-${r?.cashier ?? r?.Cashier ?? ""}-${i}`,
          }
        })
        const useColNames = Array.isArray(colNames) && colNames.length ? colNames : tenderColumnNames
        return pivot.map((r) => {
          const t = (r as any).tenderAmounts ?? {}
          const rowTotal = useColNames.reduce((sum, col) => {
            const v = Object.prototype.hasOwnProperty.call(t, col)
              ? t[col] ?? 0
              : t[Object.keys(t).find((k) => k.localeCompare(col, undefined, { sensitivity: "accent" }) === 0) ?? ""] ?? 0
            return sum + (typeof v === "number" ? v : 0)
          }, 0)
          const row: Record<string, unknown> = {
            id: (r as any).id,
            registerNo: r.registerNo,
            cashier: r.cashier,
            amount: rowTotal,
            grandTotal: rowTotal,
          }
          useColNames.forEach((col) => {
            row[col] = Object.prototype.hasOwnProperty.call(t, col) ? t[col] ?? 0 : 0
          })
          return row
        })
      } catch (error) {
        console.error("Failed to fetch Tender Totals for export:", error)
        return []
      }
    },
    [getAuthHeaders, appliedDateFrom, appliedDateTo, timeFrom, timeTo, includePayout, effectiveStoreId, tenderColumnNames]
  )

  // Use `useExportModal` directly (not `useReportExportModal`) so we can skip the date-range
  // filter entirely. Tender Totals is a pivot — each row is one (Register, Cashier) pair, the
  // date does NOT live on the row at all. The wrapper hook always injects a row-level
  // `dateRange` filter (looks up `row[field]`); with no per-row date, every row gets dropped
  // and the modal shows "No data found for the selected date range filter". Same fix used on
  // the Item Daily / Weekly / Monthly Sales pivot pages.
  //
  // Date scoping is still honored: `fetchAllData` reads `appliedDateFrom` / `appliedDateTo`
  // from the page's currently-applied filters and forwards them to the backend.
  const exportModal = useExportModal({
    columns: columnsForExport as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "tender-totals-report",
    pdfOptions: {
      title: "Tender Totals Report",
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
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tender Totals</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{appliedStoreName || "All Stores"}</span>
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
                <span>{totalRecords.toLocaleString()} rows</span>
              </>
            )}
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>
              Total Amount:&nbsp;
              {`$${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </span>
          </div>
        </div>

        {/* Filters card and buttons styled like Tax By Store */}
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
                  <input
                    type="time"
                    value={timeFrom}
                    onChange={(e) => setTimeFrom(e.target.value || "00:00")}
                    className="h-10 w-[100px] text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-brand-500"
                    title="From time"
                  />
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
                  <input
                    type="time"
                    value={timeTo}
                    onChange={(e) => setTimeTo(e.target.value || "23:59")}
                    className="h-10 w-[100px] text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 focus:ring-2 focus:ring-brand-500"
                    title="To time"
                  />
                </div>
              </div>

              <div className="space-y-1 min-w-[280px]">
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

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePayout}
                  onChange={(e) => setIncludePayout(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Include Payout</span>
              </label>
            </div>

            {/* Button group: Search, Export */}
            <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm ml-auto overflow-visible">
              <button
                onClick={handleSearch}
                className="h-10 px-5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors flex items-center gap-2 border-0 border-r border-gray-200 dark:border-gray-600"
                type="button"
                disabled={loading}
              >
                {loading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                )}
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
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 5.414V19a2 2 0 01-2 2z"
                      />
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
            title="Tender Totals"
            totalRecords={totalRecords}
            emptyMessage="No data for the selected criteria"
            getRowId={(row) => row?.id ?? `${row?.registerNo ?? ""}-${row?.cashier ?? ""}`}
            defaultGroupByColumns={[{ field: "registerNo", headerName: "Location" }]}
            defaultGroupsExpanded={true}
            onRowDoubleClick={(row) => {
              // Desktop parity: double-click a pivot row in RepTenders opens
              // RepTendersCashier with the same filters scoped to that cashier.
              const cashier = String(row?.cashier ?? "").trim()
              const registerNo = String(row?.registerNo ?? "").trim()
              if (!cashier) return
              const tabKey = `tender-totals-details-${appliedDateFrom}-${appliedDateTo}-${effectiveStoreId ?? "all"}-${registerNo}-${cashier}`
              const titleSuffix = registerNo ? `${registerNo} / ${cashier}` : cashier
              openTab({
                id: tabKey,
                title: `Tender Details [${titleSuffix}]`,
                component: "TenderTotalsDetailsPage",
                props: {
                  fromDate: appliedDateFrom,
                  toDate: appliedDateTo,
                  fromTime: timeFrom || "00:00",
                  toTime: timeTo || "23:59",
                  storeId: effectiveStoreId ?? "",
                  storeName: appliedStoreName,
                  includePayOut: includePayout,
                  cashier,
                  registerNo,
                },
                closable: true,
              })
            }}
          />
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default TenderTotalsReportPage

