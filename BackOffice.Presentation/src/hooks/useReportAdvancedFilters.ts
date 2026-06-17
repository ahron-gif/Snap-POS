import { useMemo, useState } from "react"
import { type AdvancedFilters } from "../components/reports/AdvancedFiltersModal"

/**
 * Shared wiring for the universal "Filters" dialog across report pages.
 *
 * Centralizes the modal open-state, the selected `AdvancedFilters`, and the
 * mapping of those selections to the request-param keys the backend expects.
 * Each report spreads `advancedFilterParams` into its additionalParams / fetch
 * body, renders a Filters button (using `hasActiveAdvancedFilters` for the dot)
 * and the `<AdvancedFiltersModal>`.
 *
 * Key choices:
 *  - Customer GUID is sent as `filterCustomerIds` (NOT `customerId`) to avoid the
 *    PaginationGridDto int `customerId` collision (→ 400).
 *  - Item-tab department is sent as `itemDepartmentIds` to stay distinct from a
 *    report's own top-bar `departmentId`.
 */
export function useReportAdvancedFilters() {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({})

  const advancedFilterParams = useMemo(() => {
    const p: Record<string, unknown> = {}
    // Item tab
    if (advancedFilters.itemIds?.length) p.itemIds = advancedFilters.itemIds
    if (advancedFilters.departmentIds?.length) p.itemDepartmentIds = advancedFilters.departmentIds
    if (advancedFilters.includeSubDept) p.includeSubDept = true
    if (advancedFilters.manufacturerIds?.length) p.manufacturerIds = advancedFilters.manufacturerIds
    if (advancedFilters.itemTypes?.length) p.itemTypes = advancedFilters.itemTypes
    if (advancedFilters.itemGroupIds?.length) p.itemGroupIds = advancedFilters.itemGroupIds
    if (advancedFilters.supplierIds?.length) p.supplierIds = advancedFilters.supplierIds
    if (advancedFilters.isDiscount) p.isDiscount = true
    if (advancedFilters.isTaxable) p.isTaxable = true
    if (advancedFilters.isFoodStampable) p.isFoodStampable = true
    if (advancedFilters.isWic) p.isWic = true
    // Customer tab
    if (advancedFilters.customerIds?.length) p.filterCustomerIds = advancedFilters.customerIds
    if (advancedFilters.customerTypes?.length) p.customerTypes = advancedFilters.customerTypes
    if (advancedFilters.groupIds?.length) p.customerGroupIds = advancedFilters.groupIds
    if (advancedFilters.priceLevels?.length) p.priceLevels = advancedFilters.priceLevels
    if (advancedFilters.zips?.length) p.zips = advancedFilters.zips
    if (advancedFilters.discountIds?.length) p.discountIds = advancedFilters.discountIds
    if (advancedFilters.taxable === true) p.taxable = true
    return p
  }, [advancedFilters])

  const hasActiveAdvancedFilters = useMemo(
    () =>
      Object.values(advancedFilters).some((v) =>
        Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "" && v !== false
      ),
    [advancedFilters]
  )

  return {
    showAdvancedFilters,
    setShowAdvancedFilters,
    advancedFilters,
    setAdvancedFilters,
    advancedFilterParams,
    hasActiveAdvancedFilters,
  }
}
