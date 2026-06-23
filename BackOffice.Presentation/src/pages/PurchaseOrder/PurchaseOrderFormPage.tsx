import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTabFormCacheRead, useTabFormCacheWrite } from "../../hooks/useTabFormCache";
import Button from "../../components/ui/button/Button";
import Loader from "../../components/ui/loader/Loader";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import SearchableSelect, { SelectOption } from "../../components/form/SearchableSelect";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import { useAuthHeaders } from "../../hooks/useAuthHeaders";
import { API_ENDPOINTS } from "../../constants/api";
import axios from "axios";

// ─── Icons ───────────────────────────────────────────────────────────────────
const SaveIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
  </svg>
);
const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
  </svg>
);
const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

// ─── Types ───────────────────────────────────────────────────────────────────
interface PurchaseOrderFormPageProps {
  id?: string;
  isNew?: boolean;
  mode?: "view" | "edit" | "new";
  __tabId?: string;
}

type TabKey = "details" | "items" | "notes";
interface Tab { key: TabKey; title: string; }
const TABS: Tab[] = [
  { key: "details", title: "Order Details" },
  { key: "items", title: "Line Items" },
  { key: "notes", title: "Notes" },
];

interface POEntry {
  id: string;
  itemNo: string | null;
  itemName: string;
  qtyOrdered: number;
  cost: number;
  extCost: number;
  note: string;
}

interface POFormData {
  purchaseOrderID: string;
  poNumber: string;
  storeID: string;
  supplierNo: string;
  freight: number;
  discount: number;
  isDiscAmount: boolean;
  note: string;
  orderDate: string;
  expectedDate: string;
  status: number;
}

const defaultFormData: POFormData = {
  purchaseOrderID: "",
  poNumber: "",
  storeID: "",
  supplierNo: "",
  freight: 0,
  discount: 0,
  isDiscAmount: false,
  note: "",
  orderDate: new Date().toISOString().split("T")[0],
  expectedDate: "",
  status: 0,
};

interface POFormCache {
  formData: POFormData;
  entries: POEntry[];
}

// ─── Component ───────────────────────────────────────────────────────────────
const PurchaseOrderFormPage: React.FC<PurchaseOrderFormPageProps> = ({ id, isNew, mode, __tabId }) => {
  const { closeTab } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();
  const headers = getAuthHeaders();
  const isEditMode = mode === "edit" || mode === "new" || isNew;

  // Tab form cache
  const { initial: cachedTabState, hasCachedState } = useTabFormCacheRead<POFormCache>(__tabId);
  const [activeTab, setActiveTab] = useState<TabKey>("details");
  const [formData, setFormData] = useState<POFormData>(() => cachedTabState?.formData ?? defaultFormData);
  const [entries, setEntries] = useState<POEntry[]>(() => cachedTabState?.entries ?? []);
  const hasLoadedOnceRef = useRef(hasCachedState);
  useTabFormCacheWrite<POFormCache>(__tabId, hasLoadedOnceRef.current ? { formData, entries } : null);

  const [loading, setLoading] = useState(!isNew && !hasCachedState);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<SelectOption[]>([]);
  const [stores, setStores] = useState<SelectOption[]>([]);
  const [items, setItems] = useState<SelectOption[]>([]);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" | "info" }>({ show: false, message: "", type: "success" });

  // Load lookups
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [suppRes, storeRes, itemRes] = await Promise.all([
          axios.get(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_SUPPLIERS_LOOKUP, { headers }),
          axios.get(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES, { headers }),
          axios.get(`${API_ENDPOINTS.SYSTEM_LOOKUPS.ITEMS_PAGED}?startRow=0&endRow=500`, { headers }),
        ]);
        if (suppRes.data?.data) setSuppliers(suppRes.data.data.map((s: any) => ({ value: s.supplierID || s.id, label: s.name || s.supplierName })));
        if (storeRes.data?.data) setStores(storeRes.data.data.map((s: any) => ({ value: s.storeID || s.id, label: s.storeName || s.name })));
        if (itemRes.data?.data) {
          const itemData = itemRes.data.data.data || itemRes.data.data;
          if (Array.isArray(itemData)) setItems(itemData.map((i: any) => ({ value: i.itemID || i.id, label: `${i.itemNo || ""} - ${i.description1 || i.name || ""}` })));
        }
      } catch (err) { console.error("Error loading lookups:", err); }
    };
    loadLookups();
  }, []);

  // Load PO data
  useEffect(() => {
    if (id && !isNew && !hasCachedState) {
      const loadPO = async () => {
        try {
          setLoading(true);
          const res = await axios.get(API_ENDPOINTS.PURCHASE_ORDERS.GET_BY_ID(id), { headers });
          const data = res.data?.data;
          if (data) {
            setFormData({
              purchaseOrderID: data.purchaseOrderID || "",
              poNumber: data.poNumber || "",
              storeID: data.storeID || "",
              supplierNo: data.supplierNo || "",
              freight: data.freight || 0,
              discount: data.discount || 0,
              isDiscAmount: data.isDiscAmount || false,
              note: data.note || "",
              orderDate: data.orderDate ? data.orderDate.split("T")[0] : "",
              expectedDate: data.expectedDate ? data.expectedDate.split("T")[0] : "",
              status: data.status || 0,
            });
            if (data.entries) {
              setEntries(data.entries.map((e: any) => ({
                id: e.entryId || crypto.randomUUID(),
                itemNo: e.itemNo,
                itemName: e.itemName || "",
                qtyOrdered: e.qtyOrdered || 0,
                cost: e.cost || 0,
                extCost: e.extCost || (e.qtyOrdered || 0) * (e.cost || 0),
                note: e.note || "",
              })));
            }
            hasLoadedOnceRef.current = true;
          }
        } catch (err) { showToast("Error loading purchase order", "error"); }
        finally { setLoading(false); }
      };
      loadPO();
    }
  }, [id, isNew]);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const handleFieldChange = useCallback((field: keyof POFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
  }, []);

  const addEntry = useCallback(() => {
    setEntries(prev => [...prev, { id: crypto.randomUUID(), itemNo: null, itemName: "", qtyOrdered: 1, cost: 0, extCost: 0, note: "" }]);
    
  }, []);

  const removeEntry = useCallback((entryId: string) => {
    setEntries(prev => prev.filter(e => e.id !== entryId));
    
  }, []);

  const updateEntry = useCallback((entryId: string, field: keyof POEntry, value: any) => {
    setEntries(prev => prev.map(e => {
      if (e.id !== entryId) return e;
      const updated = { ...e, [field]: value };
      if (field === "qtyOrdered" || field === "cost") {
        const qty = field === "qtyOrdered" ? Number(value) : updated.qtyOrdered;
        const cost = field === "cost" ? Number(value) : updated.cost;
        updated.extCost = qty * cost;
      }
      return updated;
    }));
    
  }, []);

  const subtotal = useMemo(() => entries.reduce((sum, e) => sum + e.extCost, 0), [entries]);
  const grandTotal = useMemo(() => {
    const disc = formData.isDiscAmount ? formData.discount : (subtotal * formData.discount / 100);
    return subtotal + formData.freight - disc;
  }, [subtotal, formData.freight, formData.discount, formData.isDiscAmount]);

  const handleSave = useCallback(async () => {
    if (!formData.supplierNo) { showToast("Please select a supplier", "error"); return; }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        orderDate: formData.orderDate ? new Date(formData.orderDate).toISOString() : null,
        expectedDate: formData.expectedDate ? new Date(formData.expectedDate).toISOString() : null,
        entries: entries.map((e, idx) => ({
          itemNo: e.itemNo, qtyOrdered: e.qtyOrdered, cost: e.cost, extCost: e.extCost, note: e.note, sortOrder: idx + 1,
        })),
      };
      if (isNew || !id) {
        await axios.post(API_ENDPOINTS.PURCHASE_ORDERS.CREATE, payload, { headers });
        showToast("Purchase order created successfully!");
      } else {
        await axios.put(API_ENDPOINTS.PURCHASE_ORDERS.UPDATE(id), { ...payload, purchaseOrderID: id }, { headers });
        showToast("Purchase order updated successfully!");
      }
      
    } catch (err: any) { showToast(err?.response?.data?.message || "Error saving purchase order", "error"); }
    finally { setSaving(false); }
  }, [formData, entries, isNew, id, headers]);

  const handleClose = useCallback(() => { if (__tabId) closeTab(__tabId); }, [__tabId, closeTab]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader /></div>;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Toast */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[300px] p-4">
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              toast.type === "success" ? "bg-green-100 text-green-600" : toast.type === "error" ? "bg-red-100 text-red-600" : "bg-brand-50 text-brand-500"
            }`}>
              <SaveIcon />
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">PO #:</span>
            <Input type="text" value={formData.poNumber} onChange={(e) => handleFieldChange("poNumber", (e.target as HTMLInputElement).value)} disabled={!isEditMode} className="h-8 text-sm w-40" placeholder="Auto-generated" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Supplier:</span>
            <div className="w-64">
              <SearchableSelect options={suppliers} value={formData.supplierNo} onChange={(val) => handleFieldChange("supplierNo", val)} placeholder="Select supplier..." />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              formData.status === 0 ? "bg-yellow-100 text-yellow-700" :
              formData.status === 1 ? "bg-blue-100 text-blue-700" :
              formData.status === 2 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
            }`}>
              {formData.status === 0 ? "Draft" : formData.status === 1 ? "Sent" : formData.status === 2 ? "Received" : "Unknown"}
            </span>
          </div>
          {isEditMode && (
            <div className="ml-auto flex gap-2">
              <Button onClick={handleClose} variant="outline" size="sm" className="h-8">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} size="sm" className="h-8">
                {saving ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>Saving...</>) : (<><SaveIcon /><span className="ml-1">Save</span></>)}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex">
          {TABS.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-brand-500 text-brand-500 dark:text-brand-400 bg-gray-50 dark:bg-gray-700"
                  : "border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "details" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label>Order Date</Label>
                <Input type="date" value={formData.orderDate} onChange={(e) => handleFieldChange("orderDate", (e.target as HTMLInputElement).value)} disabled={!isEditMode} />
              </div>
              <div>
                <Label>Expected Date</Label>
                <Input type="date" value={formData.expectedDate} onChange={(e) => handleFieldChange("expectedDate", (e.target as HTMLInputElement).value)} disabled={!isEditMode} />
              </div>
              <div>
                <Label>Store</Label>
                <SearchableSelect options={stores} value={formData.storeID} onChange={(val) => handleFieldChange("storeID", val)} placeholder="Select store..." />
              </div>
              <div>
                <Label>Freight</Label>
                <Input type="number" value={String(formData.freight)} onChange={(e) => handleFieldChange("freight", Number((e.target as HTMLInputElement).value))} disabled={!isEditMode} />
              </div>
              <div>
                <Label>Discount</Label>
                <Input type="number" value={String(formData.discount)} onChange={(e) => handleFieldChange("discount", Number((e.target as HTMLInputElement).value))} disabled={!isEditMode} />
              </div>
              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={formData.isDiscAmount} onChange={(e) => handleFieldChange("isDiscAmount", (e.target as HTMLInputElement).checked)} disabled={!isEditMode} className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                  Discount is Amount
                </label>
              </div>
            </div>

            {/* Summary Card */}
            <div className="bg-brand-25 dark:bg-gray-700 border border-brand-100 dark:border-gray-600 rounded-lg p-4 mt-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Subtotal:</span>
                  <span className="ml-2 font-semibold text-gray-900 dark:text-white">${subtotal.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Freight:</span>
                  <span className="ml-2 font-semibold text-gray-900 dark:text-white">${formData.freight.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Grand Total:</span>
                  <span className="ml-2 font-bold text-lg text-brand-600 dark:text-brand-400">${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "items" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
              <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300">Line Items ({entries.length})</h3>
              {isEditMode && (
                <Button size="sm" variant="outline" onClick={addEntry} startIcon={<PlusIcon />}>Add Item</Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 w-[320px]">Item</th>
                    <th className="px-3 py-2.5 text-right font-medium text-gray-600 dark:text-gray-300 w-[100px]">Qty Ordered</th>
                    <th className="px-3 py-2.5 text-right font-medium text-gray-600 dark:text-gray-300 w-[120px]">Cost</th>
                    <th className="px-3 py-2.5 text-right font-medium text-gray-600 dark:text-gray-300 w-[120px]">Ext Cost</th>
                    <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 w-[180px]">Note</th>
                    {isEditMode && <th className="px-3 py-2.5 w-[50px]"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {entries.length === 0 ? (
                    <tr><td colSpan={isEditMode ? 6 : 5} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                        <span>No items added. Click "Add Item" to begin.</span>
                      </div>
                    </td></tr>
                  ) : entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-2 py-2">
                        <SearchableSelect options={items} value={entry.itemNo || ""} onChange={(val) => updateEntry(entry.id, "itemNo", val)} placeholder="Select item..." />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-1.5 text-right text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={entry.qtyOrdered} onChange={(e) => updateEntry(entry.id, "qtyOrdered", Number(e.target.value))} min={0} disabled={!isEditMode} />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-1.5 text-right text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={entry.cost} onChange={(e) => updateEntry(entry.id, "cost", Number(e.target.value))} min={0} step={0.01} disabled={!isEditMode} />
                      </td>
                      <td className="px-2 py-2 text-right font-medium text-gray-900 dark:text-white">${entry.extCost.toFixed(2)}</td>
                      <td className="px-2 py-2">
                        <input type="text" className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={entry.note} onChange={(e) => updateEntry(entry.id, "note", e.target.value)} disabled={!isEditMode} />
                      </td>
                      {isEditMode && (
                        <td className="px-2 py-2">
                          <button onClick={() => removeEntry(entry.id)} className="text-error-500 hover:text-error-700 p-1.5 rounded hover:bg-error-50 transition-colors" title="Remove">
                            <TrashIcon />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                {entries.length > 0 && (
                  <tfoot className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                    <tr>
                      <td colSpan={3} className="px-3 py-2.5 text-right font-semibold text-gray-700 dark:text-gray-300">Subtotal:</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-900 dark:text-white">${subtotal.toFixed(2)}</td>
                      <td colSpan={isEditMode ? 2 : 1}></td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-3 py-2.5 text-right font-bold text-gray-700 dark:text-gray-300">Grand Total:</td>
                      <td className="px-3 py-2.5 text-right font-bold text-lg text-brand-600 dark:text-brand-400">${grandTotal.toFixed(2)}</td>
                      <td colSpan={isEditMode ? 2 : 1}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {activeTab === "notes" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <Label>Order Notes</Label>
            <textarea
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 text-sm min-h-[200px] focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors"
              value={formData.note}
              onChange={(e) => handleFieldChange("note", e.target.value)}
              placeholder="Enter purchase order notes..."
              disabled={!isEditMode}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseOrderFormPage;
