import React, { useEffect, useMemo, useState } from "react"
import SearchableSelect, { SelectOption } from "../form/SearchableSelect"
import MultiSelect from "../form/MultiSelect"
import {
  lookupService,
  type CustomerTypeLookupDto,
  type PriceLevelLookupDto,
  type ZipLookupDto,
  type DiscountLookupDto,
  type ItemFilterLookupDto,
  type SupplierLookupDto,
  type StoreLookupDto,
  type ManufacturerLookupDto,
  type DepartmentLookupDto,
} from "../../services/lookupService"

// ---------------------------------------------------------------------------
// Multi-tab "Filters" modal — port of the universal filter dialog the desktop
// BackOffice opens from every report (Item / Supplier / Customer / More tabs).
//
// Design intent:
//   - One reusable modal across every report. Reports decide which tabs to
//     expose by passing a `tabs` prop. Each report wires the resulting
//     filter set into its own data-fetch query, ignoring fields it doesn't
//     care about.
//   - Dropdown data comes from /api/SystemLookups/* endpoints. Lookups are
//     loaded LAZILY (only when their tab is first visited) so opening the
//     modal doesn't fire a dozen requests up-front.
//   - Internal draft state lets the user fiddle without committing. Only
//     "Go" (Apply) calls onApply with the values; Cancel discards.
//   - "Clear" resets the draft inside the modal — doesn't auto-apply.
// ---------------------------------------------------------------------------

export type FilterTabKey = "item" | "supplier" | "customer" | "more"

/**
 * Shared filter shape used by every report. Each field is optional — reports
 * apply only the fields relevant to their query. New filters added later
 * should keep this union additive so existing reports keep working.
 */
export interface AdvancedFilters {
  // Item tab (multi-select — matches the desktop checked-combo filters)
  itemIds?: string[]
  departmentIds?: string[]
  includeSubDept?: boolean
  manufacturerIds?: string[]   // dialog "Brand" = ManufacturerID
  itemTypes?: number[]
  itemGroupIds?: string[]
  isDiscount?: boolean
  isTaxable?: boolean
  isFoodStampable?: boolean
  isWic?: boolean

  // Supplier tab (multi-select)
  supplierIds?: string[]

  // Customer tab (multi-select — matches the desktop checked-combo filters)
  customerIds?: string[]
  customerTypes?: number[]
  groupIds?: string[]
  priceLevels?: number[]
  zips?: string[]
  discountIds?: string[]
  taxable?: boolean

  // More tab
  userId?: string
  storeId?: string
}

interface Props {
  open: boolean
  /** Tabs to display. Defaults to all four — pass a subset on reports
   *  where some tabs don't apply (e.g. inventory reports skip Customer). */
  tabs?: FilterTabKey[]
  /** Filter values to seed the draft state with when the modal opens. */
  initial?: AdvancedFilters
  /** Called when the user clicks Go with the current draft. */
  onApply: (filters: AdvancedFilters) => void
  /** Called when the user clicks Cancel or the backdrop / X. */
  onClose: () => void
}

const ALL_TABS: FilterTabKey[] = ["item", "supplier", "customer", "more"]
const TAB_LABELS: Record<FilterTabKey, string> = {
  item: "Item",
  supplier: "Supplier",
  customer: "Customer",
  more: "More...",
}

// Convenience: empty filter set (used by Clear and as the seed when no
// initial value is provided).
const emptyFilters: AdvancedFilters = {}

const AdvancedFiltersModal: React.FC<Props> = ({
  open,
  tabs = ALL_TABS,
  initial,
  onApply,
  onClose,
}) => {
  const [draft, setDraft] = useState<AdvancedFilters>(initial ?? emptyFilters)
  const [activeTab, setActiveTab] = useState<FilterTabKey>(tabs[0] ?? "item")

  // Loaded-once flags per tab so we don't refetch every time the user clicks
  // back and forth between tabs.
  const [loaded, setLoaded] = useState<Record<FilterTabKey, boolean>>({
    item: false,
    supplier: false,
    customer: false,
    more: false,
  })

  // Dropdown data state. Stored as SelectOption lists for direct use by
  // SearchableSelect. Empty defaults so the dropdowns render before fetches
  // resolve.
  const [items, setItems] = useState<SelectOption[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemSearch, setItemSearch] = useState("")

  const [departments, setDepartments] = useState<SelectOption[]>([])
  const [manufacturers, setManufacturers] = useState<SelectOption[]>([])
  const [itemTypes, setItemTypes] = useState<SelectOption[]>([])
  const [itemGroups, setItemGroups] = useState<SelectOption[]>([])

  const [suppliers, setSuppliers] = useState<SelectOption[]>([])

  const [customers, setCustomers] = useState<SelectOption[]>([])
  const [customerTypes, setCustomerTypes] = useState<SelectOption[]>([])
  const [groups, setGroups] = useState<SelectOption[]>([])
  const [priceLevels, setPriceLevels] = useState<SelectOption[]>([])
  const [zips, setZips] = useState<SelectOption[]>([])
  const [discounts, setDiscounts] = useState<SelectOption[]>([])

  const [users, setUsers] = useState<SelectOption[]>([])
  const [stores, setStores] = useState<SelectOption[]>([])

  // Reset draft + active tab whenever the modal is re-opened. We don't want
  // a previous session's pending edits leaking into the next open.
  useEffect(() => {
    if (open) {
      setDraft(initial ?? emptyFilters)
      setActiveTab(tabs[0] ?? "item")
    }
  }, [open, initial, tabs])

  // Lazy-load helper. Each tab is loaded exactly once (per modal mount) the
  // first time it's activated. Subsequent visits use cached state.
  useEffect(() => {
    if (!open) return
    if (loaded[activeTab]) return

    const loadTab = async () => {
      if (activeTab === "item") {
        const [depRes, mfgRes, typeRes, groupRes, itemRes] = await Promise.all([
          lookupService.getDepartments(),
          lookupService.getManufacturers(),
          lookupService.getItemTypes(),
          lookupService.getItemGroups(),
          lookupService.searchItemsForFilter("", 50),
        ])
        if (depRes.success && depRes.data) {
          setDepartments(depRes.data.map((d: DepartmentLookupDto) => ({
            value: d.departmentStoreID,
            label: d.name,
          })))
        }
        if (mfgRes.success && mfgRes.data) {
          setManufacturers(mfgRes.data.map((m: ManufacturerLookupDto) => ({
            value: m.manufacturerID, label: m.manufacturerName,
          })))
        }
        if (typeRes.success && typeRes.data) {
          setItemTypes(typeRes.data.map(t => ({ value: String(t.value), label: t.label })))
        }
        if (groupRes.success && groupRes.data) {
          setItemGroups(groupRes.data.map(g => ({ value: g.itemGroupID, label: g.name })))
        }
        if (itemRes.success && itemRes.data) {
          setItems(itemRes.data.map((i: ItemFilterLookupDto) => ({
            value: i.itemID,
            label: i.barcode ? `${i.name} (${i.barcode})` : i.name,
          })))
        }
      } else if (activeTab === "supplier") {
        const res = await lookupService.getSuppliers()
        if (res.success && res.data) {
          setSuppliers(res.data.map((s: SupplierLookupDto) => ({
            value: s.supplierID,
            label: s.supplierNo ? `${s.name} (${s.supplierNo})` : s.name,
          })))
        }
      } else if (activeTab === "customer") {
        // Multi-fetch: customers + types + groups + price levels + zips + discounts.
        const [custRes, typeRes, groupRes, plRes, zipRes, discRes] = await Promise.all([
          lookupService.getCustomers(),
          lookupService.getCustomerTypes(),
          lookupService.getCustomerGroups(),
          lookupService.getPriceLevels(),
          lookupService.getCustomerZips(),
          lookupService.getDiscountsLookup(),
        ])
        if (custRes.success && custRes.data) {
          setCustomers(custRes.data.map(c => ({
            value: c.customerID,
            label: c.displayName ?? c.name ?? "",
          })).filter(o => o.value && o.label))
        }
        if (typeRes.success && typeRes.data) {
          setCustomerTypes(typeRes.data.map(t => ({
            value: String(t.value), label: t.label,
          })))
        }
        if (groupRes.success && groupRes.data) {
          setGroups(groupRes.data.map(g => ({
            value: g.groupID, label: g.groupName,
          })))
        }
        if (plRes.success && plRes.data) {
          setPriceLevels(plRes.data.map((p: PriceLevelLookupDto) => ({
            value: String(p.value), label: p.label,
          })))
        }
        if (zipRes.success && zipRes.data) {
          setZips(zipRes.data.map((z: ZipLookupDto) => ({
            value: z.zip, label: z.zip,
          })))
        }
        if (discRes.success && discRes.data) {
          setDiscounts(discRes.data.map((d: DiscountLookupDto) => ({
            value: d.discountID, label: d.name,
          })))
        }
      } else if (activeTab === "more") {
        // Stores via the tenant-wide AllStores endpoint. Users are TODO —
        // there's no dedicated lightweight users-lookup endpoint yet
        // (only a paginated grid endpoint), so the User dropdown stays
        // empty for now. Wire it up once /api/User/GetDistinctUsers or
        // similar gets surfaced through lookupService.
        const storeRes = await lookupService.getAllStores()
        if (storeRes.success && storeRes.data) {
          setStores(storeRes.data.map(s => ({
            value: s.storeID, label: s.storeName,
          })))
        }
      }
      setLoaded(prev => ({ ...prev, [activeTab]: true }))
    }

    loadTab().catch(err => console.error("[AdvancedFiltersModal] tab load failed:", err))
  }, [open, activeTab, loaded])

  // Server-side item search — debounced, replaces the items list as the user types.
  useEffect(() => {
    if (!open || activeTab !== "item") return
    const handle = setTimeout(async () => {
      setItemsLoading(true)
      try {
        const res = await lookupService.searchItemsForFilter(itemSearch, 50)
        if (res.success && res.data) {
          setItems(res.data.map((i: ItemFilterLookupDto) => ({
            value: i.itemID,
            label: i.barcode ? `${i.name} (${i.barcode})` : i.name,
          })))
        }
      } finally {
        setItemsLoading(false)
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [itemSearch, open, activeTab])

  const visibleTabs = useMemo(() => ALL_TABS.filter(t => tabs.includes(t)), [tabs])

  if (!open) return null

  const update = (patch: Partial<AdvancedFilters>) => setDraft(prev => ({ ...prev, ...patch }))
  const handleClear = () => setDraft(emptyFilters)
  const handleApply = () => onApply(draft)

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[860px] max-w-[95vw] max-h-[90vh] flex flex-col rounded-xl bg-white dark:bg-gray-800 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-brand-600 dark:text-brand-400">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body: tab nav + tab content */}
        <div className="flex flex-1 min-h-0">
          {/* Vertical tab nav (matches the old BackOffice's layout) */}
          <div className="w-32 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 py-3 px-2 flex flex-col gap-1">
            {visibleTabs.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                className={`text-sm px-3 py-2 rounded text-left transition-colors ${
                  activeTab === t
                    ? "bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 font-semibold border border-gray-200 dark:border-gray-600 border-r-2 border-r-brand-500"
                    : "text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700/50"
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-w-0 overflow-y-auto p-5">
            {activeTab === "item" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Item">
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)}
                    placeholder="Type to search items…"
                    className="w-full mb-1 h-8 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-xs"
                  />
                  <MultiSelect
                    options={items}
                    value={draft.itemIds ?? []}
                    onChange={vals => update({ itemIds: vals.length ? vals : undefined })}
                    placeholder={itemsLoading ? "Loading items…" : "Select item(s)"}
                    loading={itemsLoading}
                  />
                </Field>
                <Field label="Department">
                  <MultiSelect
                    options={departments}
                    value={draft.departmentIds ?? []}
                    onChange={vals => update({ departmentIds: vals.length ? vals : undefined })}
                    placeholder="Select department(s)"
                  />
                  <label className="mt-1 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={draft.includeSubDept === true}
                      onChange={e => update({ includeSubDept: e.target.checked ? true : undefined })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Include Sub Dep.
                  </label>
                </Field>
                <Field label="Brand">
                  <MultiSelect
                    options={manufacturers}
                    value={draft.manufacturerIds ?? []}
                    onChange={vals => update({ manufacturerIds: vals.length ? vals : undefined })}
                    placeholder="Select brand(s)"
                  />
                </Field>
                <Field label="Item Type">
                  <MultiSelect
                    options={itemTypes}
                    value={(draft.itemTypes ?? []).map(String)}
                    onChange={vals => update({ itemTypes: vals.length ? vals.map(Number) : undefined })}
                    placeholder="Select type(s)"
                  />
                </Field>
                <Field label="Group">
                  <MultiSelect
                    options={itemGroups}
                    value={draft.itemGroupIds ?? []}
                    onChange={vals => update({ itemGroupIds: vals.length ? vals : undefined })}
                    placeholder="Select group(s)"
                  />
                </Field>
                <Field label="Flags">
                  <div className="flex flex-col gap-1.5 pt-1 text-sm text-gray-700 dark:text-gray-300">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={draft.isDiscount === true}
                        onChange={e => update({ isDiscount: e.target.checked ? true : undefined })}
                        className="h-4 w-4 rounded border-gray-300" />
                      Discountable
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={draft.isTaxable === true}
                        onChange={e => update({ isTaxable: e.target.checked ? true : undefined })}
                        className="h-4 w-4 rounded border-gray-300" />
                      Taxable
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={draft.isFoodStampable === true}
                        onChange={e => update({ isFoodStampable: e.target.checked ? true : undefined })}
                        className="h-4 w-4 rounded border-gray-300" />
                      FoodStampable
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={draft.isWic === true}
                        onChange={e => update({ isWic: e.target.checked ? true : undefined })}
                        className="h-4 w-4 rounded border-gray-300" />
                      Wic
                    </label>
                  </div>
                </Field>
              </div>
            )}

            {activeTab === "supplier" && (
              <div className="grid grid-cols-1 gap-4 max-w-md">
                <Field label="Supplier">
                  <MultiSelect
                    options={suppliers}
                    value={draft.supplierIds ?? []}
                    onChange={vals => update({ supplierIds: vals.length ? vals : undefined })}
                    placeholder="Select supplier(s)"
                  />
                </Field>
              </div>
            )}

            {activeTab === "customer" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Customer">
                  <MultiSelect
                    options={customers}
                    value={draft.customerIds ?? []}
                    onChange={vals => update({ customerIds: vals.length ? vals : undefined })}
                    placeholder="Select customer(s)"
                  />
                </Field>
                <Field label="Customer Type">
                  <MultiSelect
                    options={customerTypes}
                    value={(draft.customerTypes ?? []).map(String)}
                    onChange={vals => update({ customerTypes: vals.length ? vals.map(Number) : undefined })}
                    placeholder="Select type(s)"
                  />
                </Field>
                <Field label="Group">
                  <MultiSelect
                    options={groups}
                    value={draft.groupIds ?? []}
                    onChange={vals => update({ groupIds: vals.length ? vals : undefined })}
                    placeholder="Select group(s)"
                  />
                </Field>
                <Field label="Price Level">
                  <MultiSelect
                    options={priceLevels}
                    value={(draft.priceLevels ?? []).map(String)}
                    onChange={vals => update({ priceLevels: vals.length ? vals.map(Number) : undefined })}
                    placeholder="Select price level(s)"
                  />
                </Field>
                <Field label="Zip">
                  <MultiSelect
                    options={zips}
                    value={draft.zips ?? []}
                    onChange={vals => update({ zips: vals.length ? vals : undefined })}
                    placeholder="Select zip(s)"
                  />
                </Field>
                <Field label="Discount">
                  <MultiSelect
                    options={discounts}
                    value={draft.discountIds ?? []}
                    onChange={vals => update({ discountIds: vals.length ? vals : undefined })}
                    placeholder="Select discount(s)"
                  />
                </Field>
                <Field label="Taxable">
                  <label className="flex items-center gap-2 h-9 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={draft.taxable === true}
                      onChange={e => update({ taxable: e.target.checked ? true : undefined })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    Taxable
                  </label>
                </Field>
              </div>
            )}

            {activeTab === "more" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="User">
                  <SearchableSelect
                    options={users}
                    value={draft.userId ?? ""}
                    onChange={v => update({ userId: v || undefined })}
                    placeholder={users.length === 0 ? "(no users available)" : "Select user"}
                    disabled={users.length === 0}
                  />
                </Field>
                <Field label="Store">
                  <SearchableSelect
                    options={stores}
                    value={draft.storeId ?? ""}
                    onChange={v => update({ storeId: v || undefined })}
                    placeholder={stores.length === 0 ? "(no stores available)" : "Select store"}
                    disabled={stores.length === 0}
                  />
                </Field>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700"
          >
            Clear
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-1.5 text-sm rounded bg-brand-500 text-white hover:bg-brand-600"
            >
              Go
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Small labeled-field wrapper to keep the JSX above readable.
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
      {label}
    </label>
    {children}
  </div>
)

export default AdvancedFiltersModal
