import React, { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"
import { API_ENDPOINTS } from "../../constants/api"
import Button from "../../components/ui/button/Button"
import Checkbox from "../../components/form/input/Checkbox"
import MultiSelect, { type MultiSelectOption } from "../../components/form/MultiSelect"

/** A row returned by the Fill query (DiscountImportItemDto). */
export interface ImportCandidate {
  itemId: string
  itemStoreId: string
  barcode: string | null
  name: string | null
  modelNo: string | null
  itemType: string | null
  price: number
  size: string | null
  brand: string | null
  department: string | null
}

/** What we hand back to the discount form when the user clicks OK. */
export interface ImportedItem {
  itemId: string
  barcode: string | null
  name: string | null
}

interface LookupRecord {
  id: string
  name: string
}

interface ImportItemsModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (items: ImportedItem[]) => void
  storeId?: string | null
  /** Departments/brands the form already loaded — reused as filter options. */
  departments: LookupRecord[]
  brands: LookupRecord[]
  getAuthHeaders: () => Record<string, string>
  /** Item ids already on the discount — shown as already-added (disabled). */
  existingIds: Set<string>
}

const toOptions = (recs: LookupRecord[]): MultiSelectOption[] =>
  recs.map((r) => ({ value: r.id, label: r.name }))

const ImportItemsModal: React.FC<ImportItemsModalProps> = ({
  isOpen,
  onClose,
  onImport,
  storeId,
  departments,
  brands,
  getAuthHeaders,
  existingIds,
}) => {
  const [supplierOpts, setSupplierOpts] = useState<MultiSelectOption[]>([])
  const [groupOpts, setGroupOpts] = useState<MultiSelectOption[]>([])
  const [itemTypeOpts, setItemTypeOpts] = useState<MultiSelectOption[]>([])

  const [deptIds, setDeptIds] = useState<string[]>([])
  const [brandIds, setBrandIds] = useState<string[]>([])
  const [supplierIds, setSupplierIds] = useState<string[]>([])
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [itemTypes, setItemTypes] = useState<string[]>([])
  const [search, setSearch] = useState("")

  const [rows, setRows] = useState<ImportCandidate[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [hasFilled, setHasFilled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load Supplier / Group / Item Type options once when opened.
  useEffect(() => {
    if (!isOpen) return
    const headers = getAuthHeaders()
    const map = (arr: any[], idKeys: string[], nameKeys: string[]): MultiSelectOption[] =>
      (arr || []).map((o) => ({
        value: String(idKeys.map((k) => o[k]).find((v) => v != null) ?? ""),
        label: String(nameKeys.map((k) => o[k]).find((v) => v != null) ?? ""),
      })).filter((o) => o.value)
    const extract = (res: any) => {
      const d = res?.data?.isSuccess || res?.data?.IsSuccess ? (res.data.response ?? res.data.Response) : null
      return Array.isArray(d) ? d : d?.data ?? d?.Data ?? []
    }
    axios.get(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_SUPPLIERS_LOOKUP, { headers })
      .then((r) => setSupplierOpts(map(extract(r), ["supplierID", "SupplierID", "id", "supplierNo", "SupplierNo"], ["name", "Name", "supplierName", "SupplierName"])))
      .catch(() => setSupplierOpts([]))
    axios.get(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_ITEM_GROUPS, { headers })
      .then((r) => setGroupOpts(map(extract(r), ["groupID", "GroupID", "itemGroupID", "ItemGroupID", "id"], ["groupName", "GroupName", "itemGroupName", "ItemGroupName", "name", "Name"])))
      .catch(() => setGroupOpts([]))
    axios.get(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_ITEM_TYPES, { headers })
      .then((r) => setItemTypeOpts(map(extract(r), ["value", "Value", "systemValueNo", "SystemValueNo", "id"], ["label", "Label", "systemValueName", "SystemValueName", "name", "Name"])))
      .catch(() => setItemTypeOpts([]))
  }, [isOpen, getAuthHeaders])

  // Reset transient state each time the dialog opens.
  useEffect(() => {
    if (isOpen) {
      setDeptIds([]); setBrandIds([]); setSupplierIds([]); setGroupIds([]); setItemTypes([])
      setSearch(""); setRows([]); setChecked(new Set()); setHasFilled(false); setError(null)
    }
  }, [isOpen])

  const handleFill = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const headers = getAuthHeaders()
      const body = {
        storeId: storeId || null,
        departmentIds: deptIds,
        manufacturerIds: brandIds,
        supplierIds,
        groupIds,
        itemTypes: itemTypes.map((t) => Number(t)).filter((n) => !Number.isNaN(n)),
        search: search.trim() || null,
      }
      const res = await axios.post(API_ENDPOINTS.SYSTEM_LOOKUPS.DISCOUNT_IMPORT_ITEMS, body, { headers })
      const ok = res?.data?.isSuccess ?? res?.data?.IsSuccess
      const data: any[] = ok ? (res.data.response ?? res.data.Response ?? []) : []
      const mapped: ImportCandidate[] = data.map((i) => ({
        itemId: String(i.itemId ?? i.ItemId ?? ""),
        itemStoreId: String(i.itemStoreId ?? i.ItemStoreId ?? ""),
        barcode: i.barcode ?? i.Barcode ?? null,
        name: i.name ?? i.Name ?? null,
        modelNo: i.modelNo ?? i.ModelNo ?? null,
        itemType: i.itemType ?? i.ItemType ?? null,
        price: Number(i.price ?? i.Price ?? 0),
        size: i.size ?? i.Size ?? null,
        brand: i.brand ?? i.Brand ?? null,
        department: i.department ?? i.Department ?? null,
      }))
      setRows(mapped)
      // Desktop parity: every filled row starts checked (Tag = 1), except ones
      // already on the discount.
      setChecked(new Set(mapped.map((m) => m.itemId).filter((id) => !existingIds.has(id))))
      setHasFilled(true)
    } catch {
      setError("Failed to load items. Please try again.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders, storeId, deptIds, brandIds, supplierIds, groupIds, itemTypes, search, existingIds])

  const selectableRows = useMemo(() => rows.filter((r) => !existingIds.has(r.itemId)), [rows, existingIds])
  const allChecked = selectableRows.length > 0 && selectableRows.every((r) => checked.has(r.itemId))

  const toggleAll = () => {
    setChecked(allChecked ? new Set() : new Set(selectableRows.map((r) => r.itemId)))
  }
  const toggleRow = (id: string) => {
    setChecked((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const handleOk = () => {
    const picked = rows.filter((r) => checked.has(r.itemId)).map((r) => ({ itemId: r.itemId, barcode: r.barcode, name: r.name }))
    onImport(picked)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-[1000px] max-w-[96vw] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Import Items</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Department</label>
            <MultiSelect options={toOptions(departments)} value={deptIds} onChange={setDeptIds} placeholder="All departments" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Brand</label>
            <MultiSelect options={toOptions(brands)} value={brandIds} onChange={setBrandIds} placeholder="All brands" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Supplier</label>
            <MultiSelect options={supplierOpts} value={supplierIds} onChange={setSupplierIds} placeholder="All suppliers" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Group</label>
            <MultiSelect options={groupOpts} value={groupIds} onChange={setGroupIds} placeholder="All groups" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Item Type</label>
            <MultiSelect options={itemTypeOpts} value={itemTypes} onChange={setItemTypes} placeholder="All types" />
          </div>
          <div className="flex items-end gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleFill() }}
              placeholder="Search name / barcode / model…"
              className="flex-1 h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
            />
            <Button size="sm" onClick={handleFill} disabled={loading}>{loading ? "Filling…" : "Fill"}</Button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-hidden flex flex-col px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Checkbox checked={allChecked} onChange={toggleAll} disabled={selectableRows.length === 0} />
              Check / Uncheck All
            </label>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {checked.size} selected{rows.length > 0 ? ` · ${rows.length} found` : ""}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            {error ? (
              <div className="flex items-center justify-center py-12 text-sm text-red-500">{error}</div>
            ) : !hasFilled ? (
              <div className="flex items-center justify-center py-12 text-sm text-gray-500 dark:text-gray-400">Choose filters and click <strong className="mx-1">Fill</strong> to load items.</div>
            ) : rows.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-gray-500 dark:text-gray-400">No items match the selected filters.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="w-10 px-3 py-2"></th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Barcode</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Model</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Price</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Brand</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Department</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((r) => {
                    const already = existingIds.has(r.itemId)
                    const isChecked = already || checked.has(r.itemId)
                    return (
                      <tr key={r.itemId} onClick={() => { if (!already) toggleRow(r.itemId) }} className={`${already ? "opacity-50 cursor-default" : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}>
                        <td className="w-10 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isChecked} onChange={() => { if (!already) toggleRow(r.itemId) }} disabled={already} />
                        </td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{r.barcode || "-"}</td>
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{r.name || "-"}{already && <span className="ml-2 text-xs text-gray-400">(already added)</span>}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{r.modelNo || "-"}</td>
                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{r.price?.toFixed(2)}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{r.brand || "-"}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{r.department || "-"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleOk} disabled={checked.size === 0}>Add {checked.size > 0 ? `(${checked.size})` : ""}</Button>
        </div>
      </div>
    </div>
  )
}

export default ImportItemsModal
