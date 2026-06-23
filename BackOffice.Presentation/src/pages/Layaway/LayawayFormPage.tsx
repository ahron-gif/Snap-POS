import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTabFormCacheRead, useTabFormCacheWrite } from "../../hooks/useTabFormCache";
import Button from "../../components/ui/button/Button";
import Loader from "../../components/ui/loader/Loader";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import SearchableSelect, { SelectOption } from "../../components/form/SearchableSelect";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import { useAuthHeaders } from "../../hooks/useAuthHeaders";
import axios from "axios";

const BASE_API_URL = import.meta.env.VITE_API_BASE_URL || "";
const SaveIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>);

interface LayawayFormPageProps { id?: string; isNew?: boolean; mode?: "view" | "edit" | "new"; __tabId?: string; }

interface LayawayFormData {
  layawayID: string; layawayNo: string; customerID: string; storeID: string;
  totalAmount: number; downPayment: number; paymentFrequency: string;
  dueDate: string; note: string; status: number;
}

const defaultFormData: LayawayFormData = {
  layawayID: "", layawayNo: "", customerID: "", storeID: "",
  totalAmount: 0, downPayment: 0, paymentFrequency: "Monthly",
  dueDate: "", note: "", status: 0,
};

const FREQUENCY_OPTIONS = [{ value: "Weekly", title: "Weekly" }, { value: "Bi-Weekly", title: "Bi-Weekly" }, { value: "Monthly", title: "Monthly" }];
interface LayawayFormCache { formData: LayawayFormData; }

const LayawayFormPage: React.FC<LayawayFormPageProps> = ({ id, isNew, mode, __tabId }) => {
  const { closeTab } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();
  const headers = getAuthHeaders();
  const isEditMode = mode === "edit" || mode === "new" || isNew;

  const { initial: cachedTabState, hasCachedState } = useTabFormCacheRead<LayawayFormCache>(__tabId);
  const [formData, setFormData] = useState<LayawayFormData>(() => cachedTabState?.formData ?? defaultFormData);
  const hasLoadedOnceRef = useRef(hasCachedState);
  useTabFormCacheWrite<LayawayFormCache>(__tabId, hasLoadedOnceRef.current ? { formData } : null);

  const [loading, setLoading] = useState(!isNew && !hasCachedState);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<SelectOption[]>([]);
  const [stores, setStores] = useState<SelectOption[]>([]);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({ show: false, message: "", type: "success" });

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [custRes, storeRes] = await Promise.all([
          axios.get(`${BASE_API_URL}/api/SystemLookups/GetCustomers`, { headers }).catch(() => ({ data: { data: [] } })),
          axios.get(`${BASE_API_URL}/api/SystemLookups/GetStores`, { headers }).catch(() => ({ data: { data: [] } })),
        ]);
        if (custRes.data?.data) setCustomers(custRes.data.data.map((c: any) => ({ value: c.customerID || c.id, title: c.customerName || c.name || "" })));
        if (storeRes.data?.data) setStores(storeRes.data.data.map((s: any) => ({ value: s.storeID || s.id, title: s.storeName || s.name || "" })));
      } catch { /* silently fail */ }
    };
    loadLookups();
  }, []);

  useEffect(() => {
    if (id && !isNew && !hasCachedState) {
      const loadLayaway = async () => {
        try {
          setLoading(true);
          const res = await axios.get(`${BASE_API_URL}/api/Layaway/GetLayaway/${id}`, { headers });
          const data = res.data?.data;
          if (data) { setFormData({ ...defaultFormData, ...data, dueDate: data.dueDate?.split("T")[0] || "" }); hasLoadedOnceRef.current = true; }
        } catch { showToast("Error loading layaway", "error"); }
        finally { setLoading(false); }
      };
      loadLayaway();
    }
  }, [id, isNew]);

  const showToast = (message: string, type: "success" | "error" = "success") => { setToast({ show: true, message, type }); setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000); };
  const handleFieldChange = useCallback((field: keyof LayawayFormData, value: any) => { setFormData(prev => ({ ...prev, [field]: value }));  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.customerID) { showToast("Please select a customer", "error"); return; }
    setSaving(true);
    try {
      const payload = { ...formData, dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null };
      if (isNew || !id) { await axios.post(`${BASE_API_URL}/api/Layaway/CreateLayaway`, payload, { headers }); showToast("Layaway created!"); }
      else { await axios.put(`${BASE_API_URL}/api/Layaway/UpdateLayaway/${id}`, { ...payload, layawayID: id }, { headers }); showToast("Layaway updated!"); }
      
    } catch (err: any) { showToast(err?.response?.data?.message || "Error saving", "error"); }
    finally { setSaving(false); }
  }, [formData, isNew, id, headers]);

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

      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-6">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">{isNew ? "New Layaway" : `Layaway: ${formData.layawayNo}`}</h2>
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

      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><Label>Customer *</Label><SearchableSelect options={customers} value={formData.customerID} onChange={(val) => handleFieldChange("customerID", val)} placeholder="Select customer..." /></div>
            <div><Label>Store</Label><SearchableSelect options={stores} value={formData.storeID} onChange={(val) => handleFieldChange("storeID", val)} placeholder="Select store..." /></div>
            <div><Label>Due Date</Label><Input type="date" value={formData.dueDate} onChange={(e) => handleFieldChange("dueDate", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
            <div><Label>Total Amount</Label><Input type="number" value={String(formData.totalAmount)} onChange={(e) => handleFieldChange("totalAmount", Number((e.target as HTMLInputElement).value))} disabled={!isEditMode} /></div>
            <div><Label>Down Payment</Label><Input type="number" value={String(formData.downPayment)} onChange={(e) => handleFieldChange("downPayment", Number((e.target as HTMLInputElement).value))} disabled={!isEditMode} /></div>
            <div>
              <Label>Payment Frequency</Label>
              <select className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={formData.paymentFrequency} onChange={(e) => handleFieldChange("paymentFrequency", e.target.value)} disabled={!isEditMode}>
                {FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.title}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-brand-25 dark:bg-gray-700 border border-brand-100 dark:border-gray-600 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-500 block">Total</span><span className="font-bold text-lg text-gray-900 dark:text-white">${formData.totalAmount.toFixed(2)}</span></div>
              <div><span className="text-gray-500 block">Down Payment</span><span className="font-bold text-lg text-green-600">${formData.downPayment.toFixed(2)}</span></div>
              <div><span className="text-gray-500 block">Balance</span><span className="font-bold text-lg text-brand-600 dark:text-brand-400">${(formData.totalAmount - formData.downPayment).toFixed(2)}</span></div>
            </div>
          </div>

          <div><Label>Notes</Label><textarea className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 text-sm min-h-[120px] focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={formData.note} onChange={(e) => handleFieldChange("note", e.target.value)} placeholder="Layaway notes..." disabled={!isEditMode} /></div>
        </div>
      </div>
    </div>
  );
};

export default LayawayFormPage;
