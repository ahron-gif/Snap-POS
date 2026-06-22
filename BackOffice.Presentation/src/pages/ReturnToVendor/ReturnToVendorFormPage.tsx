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

const SaveIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>);
const PlusIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>);
const TrashIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>);

interface ReturnToVendorFormPageProps { id?: string; isNew?: boolean; mode?: "view" | "edit" | "new"; __tabId?: string; }

type TabKey = "details" | "items" | "notes";
const TABS: { key: TabKey; title: string }[] = [
  { key: "details", title: "Return Details" },
  { key: "items", title: "Return Items" },
  { key: "notes", title: "Notes" },
];

const REASON_OPTIONS = [
  { value: "Defective", label: "Defective" },
  { value: "Wrong Item", label: "Wrong Item" },
  { value: "Overstock", label: "Overstock" },
  { value: "Damaged", label: "Damaged" },
  { value: "Expired", label: "Expired" },
  { value: "Other", label: "Other" },
];

interface RTVEntry { id: string; itemNo: string | null; itemName: string; qtyReturned: number; cost: number; extCost: number; note: string; }
interface RTVFormData { returnToVendorID: string; supplierNo: string; storeID: string; note: string; returnDate: string; reason: string; }

const defaultFormData: RTVFormData = { returnToVendorID: "", supplierNo: "", storeID: "", note: "", returnDate: new Date().toISOString().split("T")[0], reason: "" };
interface RTVFormCache { formData: RTVFormData; entries: RTVEntry[]; }

const ReturnToVendorFormPage: React.FC<ReturnToVendorFormPageProps> = ({ id, isNew, mode, __tabId }) => {
  const { closeTab } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();
  const headers = getAuthHeaders();
  const isEditMode = mode === "edit" || mode === "new" || isNew;

  const { initial: cachedTabState, hasCachedState } = useTabFormCacheRead<RTVFormCache>(__tabId);
  const [activeTab, setActiveTab] = useState<TabKey>("details");
  const [formData, setFormData] = useState<RTVFormData>(() => cachedTabState?.formData ?? defaultFormData);
  const [entries, setEntries] = useState<RTVEntry[]>(() => cachedTabState?.entries ?? []);
  const hasLoadedOnceRef = useRef(hasCachedState);
  useTabFormCacheWrite<RTVFormCache>(__tabId, hasLoadedOnceRef.current ? { formData, entries } : null);

  const [loading, setLoading] = useState(!isNew && !hasCachedState);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<SelectOption[]>([]);
  const [stores, setStores] = useState<SelectOption[]>([]);
  const [items, setItems] = useState<SelectOption[]>([]);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({ show: false, message: "", type: "success" });

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

  useEffect(() => {
    if (id && !isNew && !hasCachedState) {
      const loadRTV = async () => {
        try {
          setLoading(true);
          const res = await axios.get(API_ENDPOINTS.RETURN_TO_VENDOR.GET_BY_ID(id), { headers });
          const data = res.data?.data;
          if (data) {
            setFormData({ returnToVendorID: data.returnToVendorID || "", supplierNo: data.supplierNo || "", storeID: data.storeID || "", note: data.note || "", returnDate: data.returnDate ? data.returnDate.split("T")[0] : "", reason: data.reason || "" });
            if (data.entries) setEntries(data.entries.map((e: any) => ({ id: e.entryId || crypto.randomUUID(), itemNo: e.itemNo, itemName: e.itemName || "", qtyReturned: e.qtyReturned || 0, cost: e.cost || 0, extCost: e.extCost || 0, note: e.note || "" })));
            hasLoadedOnceRef.current = true;
          }
        } catch (err) { showToast("Error loading return", "error"); }
        finally { setLoading(false); }
      };
      loadRTV();
    }
  }, [id, isNew]);

  const showToast = (message: string, type: "success" | "error" = "success") => { setToast({ show: true, message, type }); setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000); };
  const handleFieldChange = useCallback((field: keyof RTVFormData, value: any) => { setFormData(prev => ({ ...prev, [field]: value }));  }, []);
  const addEntry = useCallback(() => { setEntries(prev => [...prev, { id: crypto.randomUUID(), itemNo: null, itemName: "", qtyReturned: 1, cost: 0, extCost: 0, note: "" }]);  }, []);
  const removeEntry = useCallback((entryId: string) => { setEntries(prev => prev.filter(e => e.id !== entryId));  }, []);
  const updateEntry = useCallback((entryId: string, field: keyof RTVEntry, value: any) => {
    setEntries(prev => prev.map(e => { if (e.id !== entryId) return e; const updated = { ...e, [field]: value }; if (field === "qtyReturned" || field === "cost") { updated.extCost = (field === "qtyReturned" ? Number(value) : updated.qtyReturned) * (field === "cost" ? Number(value) : updated.cost); } return updated; }));
    
  }, []);

  const grandTotal = useMemo(() => entries.reduce((sum, e) => sum + e.extCost, 0), [entries]);

  const handleSave = useCallback(async () => {
    if (!formData.supplierNo) { showToast("Please select a supplier", "error"); return; }
    setSaving(true);
    try {
      const payload = { ...formData, returnDate: formData.returnDate ? new Date(formData.returnDate).toISOString() : null, entries: entries.map((e, idx) => ({ itemNo: e.itemNo, qtyReturned: e.qtyReturned, cost: e.cost, extCost: e.extCost, note: e.note, sortOrder: idx + 1 })) };
      if (isNew || !id) { await axios.post(API_ENDPOINTS.RETURN_TO_VENDOR.CREATE, payload, { headers }); showToast("Return created successfully!"); }
      else { await axios.put(API_ENDPOINTS.RETURN_TO_VENDOR.UPDATE(id), { ...payload, returnToVendorID: id }, { headers }); showToast("Return updated successfully!"); }
      
    } catch (err: any) { showToast(err?.response?.data?.message || "Error saving return", "error"); }
    finally { setSaving(false); }
  }, [formData, entries, isNew, id, headers]);

  const handleClose = useCallback(() => { if (__tabId) closeTab(__tabId); }, [__tabId, closeTab]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader /></div>;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[300px] p-4">
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${toast.type === "success" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}><SaveIcon /></div>
            <p className="text-sm text-gray-700 dark:text-gray-300">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Supplier:</span>
            <div className="w-64"><SearchableSelect options={suppliers} value={formData.supplierNo} onChange={(val) => handleFieldChange("supplierNo", val)} placeholder="Select supplier..." /></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Reason:</span>
            <select className="h-8 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={formData.reason} onChange={(e) => handleFieldChange("reason", e.target.value)} disabled={!isEditMode}>
              <option value="">Select reason...</option>
              {REASON_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">Return</span>
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

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex">
          {TABS.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-brand-500 text-brand-500 dark:text-brand-400 bg-gray-50 dark:bg-gray-700" : "border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50 dark:text-gray-400"}`}>
              {tab.title}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "details" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><Label>Return Date</Label><Input type="date" value={formData.returnDate} onChange={(e) => handleFieldChange("returnDate", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
              <div><Label>Store</Label><SearchableSelect options={stores} value={formData.storeID} onChange={(val) => handleFieldChange("storeID", val)} placeholder="Select store..." /></div>
            </div>
            <div className="bg-orange-50 dark:bg-gray-700 border border-orange-200 dark:border-gray-600 rounded-lg p-4">
              <div className="text-sm"><span className="text-gray-500">Total Return Value:</span><span className="ml-2 font-bold text-lg text-orange-600 dark:text-orange-400">${grandTotal.toFixed(2)}</span></div>
            </div>
          </div>
        )}

        {activeTab === "items" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
              <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300">Return Items ({entries.length})</h3>
              {isEditMode && <Button size="sm" variant="outline" onClick={addEntry} startIcon={<PlusIcon />}>Add Item</Button>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 w-[320px]">Item</th>
                    <th className="px-3 py-2.5 text-right font-medium text-gray-600 dark:text-gray-300 w-[100px]">Qty Returned</th>
                    <th className="px-3 py-2.5 text-right font-medium text-gray-600 dark:text-gray-300 w-[120px]">Cost</th>
                    <th className="px-3 py-2.5 text-right font-medium text-gray-600 dark:text-gray-300 w-[120px]">Ext Cost</th>
                    <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-300 w-[180px]">Note</th>
                    {isEditMode && <th className="px-3 py-2.5 w-[50px]"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {entries.length === 0 ? (
                    <tr><td colSpan={isEditMode ? 6 : 5} className="px-4 py-10 text-center text-gray-400">No items. Click "Add Item" to add return items.</td></tr>
                  ) : entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="px-2 py-2"><SearchableSelect options={items} value={entry.itemNo || ""} onChange={(val) => updateEntry(entry.id, "itemNo", val)} placeholder="Select item..." /></td>
                      <td className="px-2 py-2"><input type="number" className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-1.5 text-right text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={entry.qtyReturned} onChange={(e) => updateEntry(entry.id, "qtyReturned", Number(e.target.value))} min={0} /></td>
                      <td className="px-2 py-2"><input type="number" className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-1.5 text-right text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={entry.cost} onChange={(e) => updateEntry(entry.id, "cost", Number(e.target.value))} min={0} step={0.01} /></td>
                      <td className="px-2 py-2 text-right font-medium text-gray-900 dark:text-white">${entry.extCost.toFixed(2)}</td>
                      <td className="px-2 py-2"><input type="text" className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={entry.note} onChange={(e) => updateEntry(entry.id, "note", e.target.value)} /></td>
                      {isEditMode && <td className="px-2 py-2"><button onClick={() => removeEntry(entry.id)} className="text-error-500 hover:text-error-700 p-1.5 rounded hover:bg-error-50 transition-colors"><TrashIcon /></button></td>}
                    </tr>
                  ))}
                </tbody>
                {entries.length > 0 && (
                  <tfoot className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                    <tr><td colSpan={3} className="px-3 py-2.5 text-right font-bold text-gray-700">Total Return:</td><td className="px-3 py-2.5 text-right font-bold text-lg text-orange-600">${grandTotal.toFixed(2)}</td><td colSpan={isEditMode ? 2 : 1}></td></tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {activeTab === "notes" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <Label>Notes</Label>
            <textarea className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 text-sm min-h-[200px] focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={formData.note} onChange={(e) => handleFieldChange("note", e.target.value)} placeholder="Enter notes..." disabled={!isEditMode} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ReturnToVendorFormPage;
