import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTabFormCacheRead, useTabFormCacheWrite } from "../../hooks/useTabFormCache";
import Button from "../../components/ui/button/Button";
import Loader from "../../components/ui/loader/Loader";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import { useAuthHeaders } from "../../hooks/useAuthHeaders";
import axios from "axios";

const BASE_API_URL = import.meta.env.VITE_API_BASE_URL || "";
const SaveIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>);

interface StoreFormPageProps { id?: string; isNew?: boolean; mode?: "view" | "edit" | "new"; __tabId?: string; }

type TabKey = "general" | "address" | "settings";
const TABS: { key: TabKey; title: string }[] = [
  { key: "general", title: "General" },
  { key: "address", title: "Address" },
  { key: "settings", title: "Settings" },
];

interface StoreFormData {
  storeID: string; storeName: string; storeNo: string; phoneNumber: string;
  faxNumber: string; emailAddress: string; webSite: string;
  address1: string; address2: string; city: string; state: string; zip: string; country: string;
  taxRate1: number; taxRate2: number; taxRate3: number;
  receiptHeader: string; receiptFooter: string;
  isActive: boolean; note: string;
}

const defaultFormData: StoreFormData = {
  storeID: "", storeName: "", storeNo: "", phoneNumber: "",
  faxNumber: "", emailAddress: "", webSite: "",
  address1: "", address2: "", city: "", state: "", zip: "", country: "US",
  taxRate1: 0, taxRate2: 0, taxRate3: 0,
  receiptHeader: "", receiptFooter: "",
  isActive: true, note: "",
};

interface StoreFormCache { formData: StoreFormData; }

const StoreFormPage: React.FC<StoreFormPageProps> = ({ id, isNew, mode, __tabId }) => {
  const { closeTab } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();
  const headers = getAuthHeaders();
  const isEditMode = mode === "edit" || mode === "new" || isNew;

  const { initial: cachedTabState, hasCachedState } = useTabFormCacheRead<StoreFormCache>(__tabId);
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [formData, setFormData] = useState<StoreFormData>(() => cachedTabState?.formData ?? defaultFormData);
  const hasLoadedOnceRef = useRef(hasCachedState);
  useTabFormCacheWrite<StoreFormCache>(__tabId, hasLoadedOnceRef.current ? { formData } : null);

  const [loading, setLoading] = useState(!isNew && !hasCachedState);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({ show: false, message: "", type: "success" });

  useEffect(() => {
    if (id && !isNew && !hasCachedState) {
      const loadStore = async () => {
        try {
          setLoading(true);
          const res = await axios.get(`${BASE_API_URL}/api/StoreList/GetStoreById/${id}`, { headers });
          const data = res.data?.data;
          if (data) { setFormData({ ...defaultFormData, ...data }); hasLoadedOnceRef.current = true; }
        } catch { showToast("Error loading store", "error"); }
        finally { setLoading(false); }
      };
      loadStore();
    }
  }, [id, isNew]);

  const showToast = (message: string, type: "success" | "error" = "success") => { setToast({ show: true, message, type }); setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000); };
  const handleFieldChange = useCallback((field: keyof StoreFormData, value: any) => { setFormData(prev => ({ ...prev, [field]: value }));  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.storeName) { showToast("Please enter a store name", "error"); return; }
    setSaving(true);
    try {
      if (isNew || !id) { await axios.post(`${BASE_API_URL}/api/StoreList/CreateStore`, formData, { headers }); showToast("Store created!"); }
      else { await axios.put(`${BASE_API_URL}/api/StoreList/UpdateStore/${id}`, { ...formData, storeID: id }, { headers }); showToast("Store updated!"); }
      
    } catch (err: any) { showToast(err?.response?.data?.message || "Error saving store", "error"); }
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
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Store Name:</span>
            <Input type="text" value={formData.storeName} onChange={(e) => handleFieldChange("storeName", (e.target as HTMLInputElement).value)} disabled={!isEditMode} className="h-8 text-sm w-80" placeholder="Enter store name" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Store #:</span>
            <Input type="text" value={formData.storeNo} onChange={(e) => handleFieldChange("storeNo", (e.target as HTMLInputElement).value)} disabled={!isEditMode} className="h-8 text-sm w-24" placeholder="Auto" />
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium ${formData.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{formData.isActive ? "Active" : "Inactive"}</span>
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

      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex">
          {TABS.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-brand-500 text-brand-500 dark:text-brand-400 bg-gray-50 dark:bg-gray-700" : "border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"}`}>
              {tab.title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === "general" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white uppercase tracking-wide">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><Label>Phone</Label><Input type="tel" value={formData.phoneNumber} onChange={(e) => handleFieldChange("phoneNumber", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
              <div><Label>Fax</Label><Input type="tel" value={formData.faxNumber} onChange={(e) => handleFieldChange("faxNumber", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
              <div><Label>Email</Label><Input type="email" value={formData.emailAddress} onChange={(e) => handleFieldChange("emailAddress", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
              <div><Label>Website</Label><Input type="text" value={formData.webSite} onChange={(e) => handleFieldChange("webSite", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={formData.isActive} onChange={(e) => handleFieldChange("isActive", (e.target as HTMLInputElement).checked)} disabled={!isEditMode} className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                  Active
                </label>
              </div>
            </div>
            <div><Label>Notes</Label><textarea className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 text-sm min-h-[100px] focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={formData.note} onChange={(e) => handleFieldChange("note", e.target.value)} disabled={!isEditMode} /></div>
          </div>
        )}

        {activeTab === "address" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white uppercase tracking-wide">Store Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><Label>Address 1</Label><Input type="text" value={formData.address1} onChange={(e) => handleFieldChange("address1", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
              <div className="md:col-span-2"><Label>Address 2</Label><Input type="text" value={formData.address2} onChange={(e) => handleFieldChange("address2", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
              <div><Label>City</Label><Input type="text" value={formData.city} onChange={(e) => handleFieldChange("city", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
              <div><Label>State</Label><Input type="text" value={formData.state} onChange={(e) => handleFieldChange("state", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
              <div><Label>Zip</Label><Input type="text" value={formData.zip} onChange={(e) => handleFieldChange("zip", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
              <div><Label>Country</Label><Input type="text" value={formData.country} onChange={(e) => handleFieldChange("country", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white uppercase tracking-wide mb-4">Tax Rates</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Tax Rate 1 (%)</Label><Input type="number" value={String(formData.taxRate1)} onChange={(e) => handleFieldChange("taxRate1", Number((e.target as HTMLInputElement).value))} disabled={!isEditMode} /></div>
                <div><Label>Tax Rate 2 (%)</Label><Input type="number" value={String(formData.taxRate2)} onChange={(e) => handleFieldChange("taxRate2", Number((e.target as HTMLInputElement).value))} disabled={!isEditMode} /></div>
                <div><Label>Tax Rate 3 (%)</Label><Input type="number" value={String(formData.taxRate3)} onChange={(e) => handleFieldChange("taxRate3", Number((e.target as HTMLInputElement).value))} disabled={!isEditMode} /></div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white uppercase tracking-wide mb-4">Receipt Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>Receipt Header</Label><textarea className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 text-sm min-h-[100px] focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono" value={formData.receiptHeader} onChange={(e) => handleFieldChange("receiptHeader", e.target.value)} disabled={!isEditMode} placeholder="Receipt header text..." /></div>
                <div><Label>Receipt Footer</Label><textarea className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 text-sm min-h-[100px] focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono" value={formData.receiptFooter} onChange={(e) => handleFieldChange("receiptFooter", e.target.value)} disabled={!isEditMode} placeholder="Receipt footer text..." /></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreFormPage;
