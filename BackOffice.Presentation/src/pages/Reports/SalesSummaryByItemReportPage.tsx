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
import ExportModal from "../../components/common/ExportModal"
import { useReportExportModal } from "../../hooks/useReportExportModal"
import { useDashboardTabs } from "../../context/DashboardTabContext"

interface SalesSummaryByItemReportProps {
  filters?: {
    dateFrom?: string
    dateTo?: string
    storeId?: string
    storeName?: string
    /**
     * Optional Department drill-down filter. Set when this page is opened from
     * SalesSummaryByDepartmentReportPage's row double-click — narrows the report to a
     * single department. Mirrors the desktop's RepDepartmentSummary -> RepItemSalesSummary
     * flow which passes `Instances.Array(Connector.MemoesTag.Department)`.
     */
    departmentId?: string
    /** Display-only department name shown in the header subtitle when filtering. */
    departmentName?: string
  }
}

interface StoreOption {
  id: string
  name: string
  code?: string
}

// Backend (Newtonsoft + CamelCasePropertyNamesContractResolver) emits camelCase keys for
// every column EXCEPT `DiscountPct`, which is explicitly mapped to `Discount %` via
// [JsonProperty("Discount %")] on the DTO. The grid renders raw response keys in
// serverSide mode, so the column for that field has a cellRenderer that reaches into the
// row to pluck `Discount %` directly.
interface SalesSummaryByItemRow {
  itemStoreID?: string | null
  name?: string | null
  groups?: string | null
  parentName?: string | null
  color?: string | null
  size?: string | null
  mainSize?: string | null
  modalNumber?: string | null
  barcodeNumber?: string | null
  itemTypeName?: string | null
  department?: string | null
  departmentID?: string | null
  mainDepartment?: string | null
  subDepartment?: string | null
  subSubDepartment?: string | null
  styleNo?: string | null
  supplier?: string | null
  itemCodeSupplier?: string | null
  brand?: string | null
  customerCode?: string | null
  qty?: number | null
  qtyCase?: number | null
  extCost?: number | null
  extPrice?: number | null
  "Discount %"?: number | null
  marginPrice?: number | null
  markupPrice?: number | null
  profit?: number | null
  discount?: number | null
  totalAfterDiscount?: number | null
  storeName?: string | null
  storeID?: string | null
  itemID?: string | null
  parentCode?: string | null
  price?: number | null
  onHand?: number | null
  onOrder?: number | null
  sellThru?: number | null
  lastReceivedDate?: string | null
  lastReceivedQty?: number | null
  customField1?: string | null
  customField2?: string | null
  customField3?: string | null
  customField4?: string | null
  customField5?: string | null
  customField6?: string | null
  customField7?: string | null
  customField8?: string | null
  customField9?: string | null
  customField10?: string | null
}

const SALES_SUMMARY_BY_ITEM_COLUMN_CONFIG = [
  { field: "modalNumber" as const, headerName: "Modal No.", ratio: 0.06, minWidth: 90 },
  { field: "parentCode" as const, headerName: "Parent Code", ratio: 0.06, minWidth: 90 },
  { field: "name" as const, headerName: "Name", ratio: 0.12, minWidth: 140 },
  { field: "barcodeNumber" as const, headerName: "Barcode", ratio: 0.06, minWidth: 100 },
  { field: "department" as const, headerName: "Department", ratio: 0.06, minWidth: 100 },
  { field: "mainDepartment" as const, headerName: "Main Dept", ratio: 0.05, minWidth: 80 },
  { field: "subDepartment" as const, headerName: "Sub Dept", ratio: 0.05, minWidth: 80 },
  { field: "groups" as const, headerName: "Groups", ratio: 0.05, minWidth: 80 },
  { field: "color" as const, headerName: "Color", ratio: 0.04, minWidth: 70 },
  { field: "size" as const, headerName: "Size", ratio: 0.04, minWidth: 60 },
  { field: "styleNo" as const, headerName: "Style No.", ratio: 0.05, minWidth: 80 },
  { field: "supplier" as const, headerName: "Supplier", ratio: 0.06, minWidth: 90 },
  { field: "brand" as const, headerName: "Brand", ratio: 0.05, minWidth: 80 },
  { field: "qty" as const, headerName: "Qty", ratio: 0.04, minWidth: 60 },
  { field: "qtyCase" as const, headerName: "Qty Case", ratio: 0.04, minWidth: 70 },
  { field: "extPrice" as const, headerName: "Ext Price", ratio: 0.05, minWidth: 85 },
  { field: "extCost" as const, headerName: "Ext Cost", ratio: 0.05, minWidth: 85 },
  { field: "discountPct" as const, headerName: "Discount %", ratio: 0.04, minWidth: 75 },
  { field: "marginPrice" as const, headerName: "Margin", ratio: 0.04, minWidth: 70 },
  { field: "markupPrice" as const, headerName: "Markup", ratio: 0.04, minWidth: 70 },
  { field: "profit" as const, headerName: "Profit", ratio: 0.05, minWidth: 85 },
  { field: "discount" as const, headerName: "Discount", ratio: 0.05, minWidth: 85 },
  { field: "totalAfterDiscount" as const, headerName: "Total After Disc.", ratio: 0.06, minWidth: 100 },
  { field: "storeName" as const, headerName: "Store Name", ratio: 0.06, minWidth: 100 },
  { field: "price" as const, headerName: "Price", ratio: 0.04, minWidth: 70 },
  { field: "onHand" as const, headerName: "On Hand", ratio: 0.04, minWidth: 70 },
  { field: "onOrder" as const, headerName: "On Order", ratio: 0.04, minWidth: 75 },
  { field: "sellThru" as const, headerName: "Sell Thru", ratio: 0.04, minWidth: 70 },
  { field: "lastReceivedDate" as const, headerName: "Last Received", ratio: 0.05, minWidth: 95 },
  { field: "lastReceivedQty" as const, headerName: "Last Rcvd Qty", ratio: 0.04, minWidth: 85 },
  { field: "customField1" as const, headerName: "Custom 1", ratio: 0.04, minWidth: 80 },
  { field: "customField2" as const, headerName: "Custom 2", ratio: 0.04, minWidth: 80 },
  { field: "customField3" as const, headerName: "Custom 3", ratio: 0.04, minWidth: 80 },
  { field: "customField4" as const, headerName: "Custom 4", ratio: 0.04, minWidth: 80 },
  { field: "customField5" as const, headerName: "Custom 5", ratio: 0.04, minWidth: 80 },
  { field: "customField6" as const, headerName: "Custom 6", ratio: 0.04, minWidth: 80 },
  { field: "customField7" as const, headerName: "Custom 7", ratio: 0.04, minWidth: 80 },
  { field: "customField8" as const, headerName: "Custom 8", ratio: 0.04, minWidth: 80 },
  { field: "customField9" as const, headerName: "Custom 9", ratio: 0.04, minWidth: 80 },
  { field: "customField10" as const, headerName: "Custom 10", ratio: 0.04, minWidth: 80 },
] as const

const REPORT_TITLE = "Sales Summary By Item"

const SALES_SUMMARY_BY_ITEM_SCREEN_CODE = "reports.sales_summary_by_item"

const SalesSummaryByItemReportPage: React.FC<SalesSummaryByItemReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()
  const { canExport } = usePermission(SALES_SUMMARY_BY_ITEM_SCREEN_CODE)
  const { openTab } = useDashboardTabs()

  const todayStr = new Date().toISOString().split("T")[0]
  const defaultDateFrom =
    filters?.dateFrom || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split("T")[0]
  const defaultDateTo = filters?.dateTo || todayStr

  const [dateFrom, setDateFrom] = useState<string>(defaultDateFrom)
  const [dateTo, setDateTo] = useState<string>(defaultDateTo)
  const [appliedDateFrom, setAppliedDateFrom] = useState<string>(defaultDateFrom)
  const [appliedDateTo, setAppliedDateTo] = useState<string>(defaultDateTo)
  const [stores, setStores] = useState<StoreOption[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [screenStoreId, setScreenStoreId] = useState<string>(() =>
    filters ? (filters.storeId ?? "") : (currentStore?.storeId ?? "")
  )
  const [screenStoreName, setScreenStoreName] = useState<string>(() =>
    filters && filters.storeId ? (filters.storeName?.trim() || "") : (currentStore?.storeName || "")
  )
  const [appliedStoreId, setAppliedStoreId] = useState<string>(() =>
    filters ? (filters.storeId ?? "") : (currentStore?.storeId ?? "")
  )
  const [appliedStoreName, setAppliedStoreName] = useState<string>(() => {
    const id = filters ? (filters.storeId ?? "") : (currentStore?.storeId ?? "")
    return id?.trim() ? (filters?.storeName?.trim() || currentStore?.storeName || "Selected Store") : "All Stores"
  })
  const [totalRecords, setTotalRecords] = useState(0)
  const [error] = useState<string | null>(null)

  // Caption overrides + Apparel flag captured from the first-page response so columns
  // pick up the tenant's custom labels (CustomField1..10 / Brand / Style No / Part No)
  // and Apparel-only columns get hidden when the store isn't Apparel — mirrors the
  // desktop's RepItemSalesSummary form-load logic.
  const [optionCaptions, setOptionCaptions] = useState<Record<string, string>>({})
  const [isApparel, setIsApparel] = useState<boolean>(false)

  const [gridKey, setGridKey] = useState(0)
  const gridDataRef = useRef<SalesSummaryByItemRow[]>([])

  const gridContainerRef = useRef<HTMLDivElement>(null)
  const [gridContainerWidth, setGridContainerWidth] = useState(900)

  const getLocalUserId = useCallback(() => {
    try {
      const userData = localStorage.getItem("userData")
      if (userData) {
        const parsed = JSON.parse(userData)
        return parsed.localUserId || ""
      }
    } catch { /* ignore */ }
    return ""
  }, [])

  useEffect(() => {
    const userId = getLocalUserId()
    setLoadingStores(true)
    const headers = getAuthHeaders()
    const url = userId ? `${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES}?userId=${userId}` : API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES
    fetch(url, { headers })
      .then((res) => res.json())
      .then((data) => {
        const list = data?.response ?? data?.Response ?? data
        const arr = Array.isArray(list) ? list : []
        setStores(arr.map((s: any) => ({
          id: String(s.storeID ?? s.storeId ?? s.id ?? ""),
          name: String(s.storeName ?? s.name ?? s.StoreName ?? ""),
          code: s.storeNumber != null ? String(s.storeNumber) : undefined,
        })))
      })
      .catch(console.error)
      .finally(() => setLoadingStores(false))
  }, [getAuthHeaders, getLocalUserId])

  useEffect(() => {
    const el = gridContainerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0]?.contentRect ?? { width: 900 }
      setGridContainerWidth(Math.max(400, Math.floor(width)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Sync with Report Manager filters: push them into both screen and applied state, then
  // bump gridKey so the grid re-mounts and re-fetches with the new additionalParams.
  useEffect(() => {
    if (!filters) return
    const from = filters.dateFrom || defaultDateFrom
    const to = filters.dateTo || defaultDateTo
    setDateFrom(from)
    setDateTo(to)
    setAppliedDateFrom(from)
    setAppliedDateTo(to)
    const storeIdFromFilters = filters.storeId ?? ""
    setScreenStoreId(storeIdFromFilters)
    setAppliedStoreId(storeIdFromFilters)
    setAppliedStoreName(storeIdFromFilters?.trim() ? (filters.storeName?.trim() || "Selected Store") : "All Stores")
    setGridKey((k) => k + 1)
  }, [filters?.dateFrom, filters?.dateTo, filters?.storeId, filters?.storeName])

  const flatpickrCommonOptions = useMemo(() => ({
    dateFormat: "Y-m-d",
    allowInput: true,
    static: false,
  }), [])

  const effectiveStoreId = appliedStoreId?.trim() ? appliedStoreId : undefined
  const displayStoreName = effectiveStoreId ? (appliedStoreName || "Selected Store") : "All Stores"

  // Currency / number / percent formatters. Used by column cellRenderers (which run on the
  // raw response shape since serverSide=true).
  const currency = useCallback((v: unknown): string => {
    if (v == null || v === "") return "-"
    const n = Number(v)
    if (!Number.isFinite(n)) return "-"
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }, [])
  const numFmt = useCallback((v: unknown): string => {
    if (v == null || v === "") return "-"
    const n = Number(v)
    if (!Number.isFinite(n)) return "-"
    return n.toLocaleString()
  }, [])
  const pctFmt = useCallback((v: unknown): string => {
    if (v == null || v === "") return "-"
    const n = Number(v)
    if (!Number.isFinite(n)) return "-"
    // SP returns fractional values for Margin / Markup / Sell Thru / Discount % (e.g.
    // 0.2843 = 28.43%); the desktop's grid auto-multiplies via DevExpress P2 format.
    // We multiply here so the web matches "28.43%" instead of rendering "0.28%".
    return `${(n * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
  }, [])
  const dateFmt = useCallback((v: unknown): string => {
    if (v == null || v === "") return ""
    const d = new Date(v as any)
    if (isNaN(d.getTime())) return String(v)
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
  }, [])

  const columns: Column[] = useMemo(() => {
    const total = gridContainerWidth
    const withWidths = SALES_SUMMARY_BY_ITEM_COLUMN_CONFIG.map((cfg) => ({
      width: Math.max(cfg.minWidth, Math.floor(total * cfg.ratio)),
      ...cfg,
    }))
    const adjust = total - withWidths.reduce((s, c) => s + c.width, 0)
    if (adjust !== 0) withWidths[0].width += adjust

    const cellRenderers: Record<string, (value: unknown, row?: any) => string> = {
      qty: (v) => numFmt(v),
      qtyCase: (v) => numFmt(v),
      extCost: (v) => currency(v),
      extPrice: (v) => currency(v),
      // The backend serializes this DTO property as the literal key "Discount %"
      // (see [JsonProperty("Discount %")] on SalesSummaryByItemRowDto). In serverSide
      // mode the grid renders raw response fields, so the value passed via column.field
      // ("discountPct") is undefined — we have to reach into the row to find it.
      discountPct: (_v, row) => pctFmt(row ? (row as any)["Discount %"] : undefined),
      marginPrice: (v) => pctFmt(v),
      markupPrice: (v) => pctFmt(v),
      profit: (v) => currency(v),
      discount: (v) => currency(v),
      totalAfterDiscount: (v) => currency(v),
      price: (v) => currency(v),
      onHand: (v) => numFmt(v),
      onOrder: (v) => numFmt(v),
      sellThru: (v) => pctFmt(v),
      lastReceivedDate: (v) => dateFmt(v),
      lastReceivedQty: (v) => numFmt(v),
    }
    const numberFields = ["qty", "qtyCase", "extCost", "extPrice", "discountPct", "marginPrice", "markupPrice", "profit", "discount", "totalAfterDiscount", "price", "onHand", "onOrder", "sellThru", "lastReceivedQty"]
    const filterableFields = ["name", "modalNumber", "parentCode", "barcodeNumber", "department", "storeName", "supplier", "brand"]

    // Caption overrides — keys match the option names returned from the backend
    // (CustomField1..10, PartNumberCaption, ManufacturerCaption, StyleNoCaption).
    // ManufacturerPartNo column in the original code maps to PartNumberCaption,
    // Brand to ManufacturerCaption, StyleNo to StyleNoCaption.
    const captionOverride: Record<string, string | undefined> = {
      customField1: optionCaptions["CustomField1"],
      customField2: optionCaptions["CustomField2"],
      customField3: optionCaptions["CustomField3"],
      customField4: optionCaptions["CustomField4"],
      customField5: optionCaptions["CustomField5"],
      customField6: optionCaptions["CustomField6"],
      customField7: optionCaptions["CustomField7"],
      customField8: optionCaptions["CustomField8"],
      customField9: optionCaptions["CustomField9"],
      customField10: optionCaptions["CustomField10"],
      brand: optionCaptions["ManufacturerCaption"],
      styleNo: optionCaptions["StyleNoCaption"],
    }

    // Apparel-only columns: when the store isn't Apparel, the desktop hides ParentCode /
    // ParentName / Color always, and hides CustomFieldN whose caption is still the default
    // placeholder ("CustomFieldN"). On the web a tenant that has set a custom caption
    // implies they're tracking real data in that field, so we keep it visible regardless.
    const isCustomCaptionSet = (n: number) => {
      const v = optionCaptions[`CustomField${n}`]
      return !!v && !/^CustomField\d+$/i.test(v.trim())
    }
    const apparelOnlyAlwaysHidden = new Set(["parentCode", "parentName", "color"])
    const apparelOnlyCustomFieldHidden = (field: string): boolean => {
      const m = /^customField(\d+)$/.exec(field)
      if (!m) return false
      return !isCustomCaptionSet(parseInt(m[1], 10))
    }

    return withWidths.map(({ field, headerName, width, minWidth: _mw, ratio: _r }) => {
      const overrideCaption = captionOverride[field]
      const renamed = overrideCaption && !/^CustomField\d+$/i.test(overrideCaption.trim()) ? overrideCaption : undefined
      const hideForNonApparel =
        !isApparel && (apparelOnlyAlwaysHidden.has(field) || apparelOnlyCustomFieldHidden(field))
      return {
        field,
        headerName: renamed || headerName,
        width,
        sortable: true,
        filterable: filterableFields.includes(field),
        visible: !hideForNonApparel,
        dataType: (field === "lastReceivedDate" ? "date" : numberFields.includes(field) ? "number" : "string") as "string" | "number" | "date",
        cellRenderer: cellRenderers[field],
      }
    })
  }, [gridContainerWidth, currency, numFmt, pctFmt, dateFmt, optionCaptions, isApparel])

  // Build the filter payload sent on every paginated request. Page navigation reuses this
  // and just varies startRow/endRow; only handleSearch (or report-manager-driven prop
  // changes) mutates it.
  const additionalParams = useMemo(() => {
    const params: Record<string, unknown> = {
      fromDate: appliedDateFrom,
      fromTime: "12:00:00 AM",
      toDate: appliedDateTo,
      toTime: "11:59:59 PM",
    }
    const storeIdToUse = appliedStoreId ?? filters?.storeId
    const validStoreId =
      typeof storeIdToUse === "string" &&
      storeIdToUse.trim().length > 0 &&
      /^[0-9a-f-]{36}$/i.test(storeIdToUse.trim())
    // Always send `storeId` — null clears the previous store on "All Stores" selection.
    params.storeId = validStoreId ? storeIdToUse!.trim() : null
    // Department drill-down filter — set only when opened from the Department Summary tab.
    const deptId = filters?.departmentId
    if (typeof deptId === "string" && /^[0-9a-f-]{36}$/i.test(deptId.trim())) {
      params.departmentId = deptId.trim()
    }
    return params
  }, [appliedDateFrom, appliedDateTo, appliedStoreId, filters?.storeId, filters?.departmentId])

  // Capture optionCaptions + isApparel from the first-page response. Subsequent pages
  // send empty captions / false (backend returns those only on StartRow == 0); we ignore
  // those updates so the dynamic labels established on page 1 stay applied during paging.
  const handleResponseLoaded = useCallback((responseData: Record<string, unknown>) => {
    const r = responseData as Record<string, unknown>
    const rawCaptions = r?.optionCaptions ?? r?.OptionCaptions
    if (rawCaptions && typeof rawCaptions === "object") {
      const entries = Object.entries(rawCaptions as Record<string, unknown>)
        .filter(([_, v]) => typeof v === "string" && (v as string).trim().length > 0) as [string, string][]
      if (entries.length > 0) setOptionCaptions(Object.fromEntries(entries))
    }
    const rawApparel = r?.isApparel ?? r?.IsApparel
    // Only adopt true; ignore subsequent-page false so page-1 value sticks.
    if (rawApparel === true) setIsApparel(true)
  }, [])

  // Cache the current page's rows so Export/Print can read them without their own fetch.
  const handleGridDataChange = useCallback((data: any[]) => {
    gridDataRef.current = data as SalesSummaryByItemRow[]
  }, [])

  const handleSearch = useCallback(() => {
    setAppliedDateFrom(dateFrom)
    setAppliedDateTo(dateTo)
    setAppliedStoreId(screenStoreId)
    // Preserve the All-Stores fix: empty string means "All Stores" and must clear the previously applied store.
    setAppliedStoreName(screenStoreId ? (stores.find((s) => s.id === screenStoreId)?.name ?? screenStoreName) : "All Stores")
    setGridKey((prev) => prev + 1)
  }, [dateFrom, dateTo, screenStoreId, screenStoreName, stores])

  // Pull every row (ignoring pagination) for the export modal. Mirrors additionalParams
  // exactly, then tacks on a giant startRow/endRow so the backend returns the full set.
  const fetchAllData = useCallback(
    async (overrideFrom?: string, overrideTo?: string): Promise<any[]> => {
      try {
        const headers = getAuthHeaders()
        const storeIdToUse = appliedStoreId ?? filters?.storeId
        const validStoreId =
          typeof storeIdToUse === "string" &&
          storeIdToUse.trim().length > 0 &&
          /^[0-9a-f-]{36}$/i.test(storeIdToUse.trim())
        const body: Record<string, unknown> = {
          fromDate: overrideFrom || appliedDateFrom,
          fromTime: "12:00:00 AM",
          toDate: overrideTo || appliedDateTo,
          toTime: "11:59:59 PM",
          storeId: validStoreId ? storeIdToUse!.trim() : null,
          startRow: 0,
          endRow: 1000000,
        }
        const response = await axios.post(API_ENDPOINTS.REPORTS.SALES_SUMMARY_BY_ITEM, body, { headers })
        const ok = response.data?.isSuccess ?? response.data?.IsSuccess
        if (!ok) return []
        const res = response.data?.response ?? response.data?.Response ?? {}
        const dataRaw = res?.data ?? res?.Data ?? []
        return Array.isArray(dataRaw) ? dataRaw : []
      } catch (error) {
        console.error(`Failed to fetch ${REPORT_TITLE} for export:`, error)
        return []
      }
    },
    [getAuthHeaders, appliedDateFrom, appliedDateTo, appliedStoreId, filters?.storeId]
  )

  const exportModal = useReportExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "sales-summary-by-item",
    title: `${REPORT_TITLE} Report`,
    subtitle: `${displayStoreName} | ${new Date(appliedDateFrom).toLocaleDateString()} - ${new Date(appliedDateTo).toLocaleDateString()}`,
    dateField: "lastReceivedDate",
    defaultDateFrom: appliedDateFrom,
    defaultDateTo: appliedDateTo,
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        {/* Title and summary - same as Tax By Store */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{REPORT_TITLE}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{displayStoreName}</span>
            {filters?.departmentName?.trim() && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>Department: {filters.departmentName.trim()}</span>
              </>
            )}
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

        {/* Filters card - same structure and style as Tax By Store */}
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
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Store</label>
                <select
                  value={screenStoreId}
                  onChange={(e) => {
                    const id = e.target.value
                    setScreenStoreId(id)
                    setScreenStoreName(id ? (stores.find((s) => s.id === id)?.name ?? "") : "")
                  }}
                  disabled={loadingStores}
                  className="h-10 min-w-[280px] px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-60"
                >
                  <option value="">All Stores</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Button sequence: Search → Export - same as Tax By Store */}
            <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm ml-auto overflow-visible">
              <button
                onClick={handleSearch}
                className="h-10 px-5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors flex items-center gap-2 border-0 border-r border-gray-200 dark:border-gray-600"
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

      {/* Grid area - same structure as Tax By Store */}
      <div className="flex-1 flex flex-col min-h-0 p-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex-shrink-0 mb-4">{error}</div>
        )}
        <div className="flex-1 min-h-0 overflow-auto flex flex-col" ref={gridContainerRef}>
          <div className="min-h-0 flex-1">
            <ServerGrid
              key={gridKey}
              hideDefaultContextMenuItems={true}
              columns={columns}
              apiUrl={API_ENDPOINTS.REPORTS.SALES_SUMMARY_BY_ITEM}
              serverSide={true}
              methodType="POST"
              getAuthHeaders={getAuthHeaders}
              additionalParams={additionalParams}
              pagination={true}
              pageSize={100}
              headerSearch={true}
              columnChooser={true}
              title={REPORT_TITLE}
              setTotalRecords={setTotalRecords}
              onResponseLoaded={handleResponseLoaded}
              onDataChange={handleGridDataChange}
              defaultSortColumn="storeName"
              defaultSortDirection="asc"
              emptyMessage="No data for the selected criteria. Use filters and click Search to load data."
              getRowId={(row) => `${(row as any)?.itemStoreID ?? ""}-${(row as any)?.storeID ?? ""}-${(row as any)?.modalNumber ?? ""}`}
              containerWidth="100%"
              gridId="sales-summary-by-item-report"
              defaultGroupByColumns={[{ field: "storeName", headerName: "Store Name" }]}
              defaultGroupsExpanded={true}
              onRowDoubleClick={(row) => {
                // Desktop parity: RepItemSalesSummary -> ClickOnRowItemSummary -> RepSalesDetails.
                // The backend's SP_GetTransactionEntryItem takes only ItemStoreID, so that's
                // the key we need on the row. Group-header double-clicks won't have it and
                // we no-op gracefully.
                const r = row as any
                const itemStoreId = String(
                  r?.itemStoreID ?? r?.itemStoreId ?? r?.ItemStoreID ?? r?.ItemStoreId ?? ""
                ).trim()
                if (!itemStoreId) return
                const itemName = String(r?.name ?? r?.Name ?? "").trim()
                const rowStoreName = String(r?.storeName ?? r?.StoreName ?? "").trim()
                const effStoreName = rowStoreName || appliedStoreName || ""

                openTab({
                  id: `sales-summary-by-item-details-${itemStoreId}`,
                  title: itemName ? `Sales Details [${itemName}]` : "Sales Details",
                  component: "SalesSummaryByItemDetailsPage",
                  props: {
                    itemStoreId,
                    itemName: itemName || undefined,
                    storeName: effStoreName || undefined,
                  },
                  closable: true,
                })
              }}
            />
          </div>
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default SalesSummaryByItemReportPage
