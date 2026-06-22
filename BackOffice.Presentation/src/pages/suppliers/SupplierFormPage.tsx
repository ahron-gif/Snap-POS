import React, { useState, useCallback, useEffect, useRef } from "react";
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

interface SupplierFormPageProps { id?: string; isNew?: boolean; mode?: "view" | "edit" | "new"; __tabId?: string; }

type TabKey = "supplier" | "contact" | "notes";
const TABS: { key: TabKey; title: string; shortcut: string }[] = [
  { key: "supplier", title: "Supplier Info", shortcut: "F2" },
  { key: "contact", title: "Contact & Address", shortcut: "F3" },
  { key: "notes", title: "Notes", shortcut: "F4" },
];

interface SupplierFormData {
  supplierID: string; supplierNo: string; name: string; contactName: string;
  emailAddress: string; webSite: string; accountNo: string;
  phoneNumber1: string; ext1: string; phoneNumber2: string; phoneNumber3: string;
  address1: string; address2: string; city: string; state: string; zip: string;
  note: string; minMarkup: number; listPrice: number; import: number;
  department: string; buyerID: string; warehouseID: string;
}

const defaultFormData: SupplierFormData = {
  supplierID: "", supplierNo: "", name: "", contactName: "",
  emailAddress: "", webSite: "", accountNo: "",
  phoneNumber1: "", ext1: "", phoneNumber2: "", phoneNumber3: "",
  address1: "", address2: "", city: "", state: "", zip: "",
  note: "", minMarkup: 0, listPrice: 0, import: 0,
  department: "", buyerID: "", warehouseID: "",
};

interface SupplierFormCache { formData: SupplierFormData; }

const SupplierFormPage: React.FC<SupplierFormPageProps> = ({ id, isNew, mode, __tabId }) => {
  const { closeTab } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();
  const headers = getAuthHeaders();
  const isEditMode = mode === "edit" || mode === "new" || isNew;

  const { initial: cachedTabState, hasCachedState } = useTabFormCacheRead<SupplierFormCache>(__tabId);
  const [activeTab, setActiveTab] = useState<TabKey>("supplier");
  const [formData, setFormData] = useState<SupplierFormData>(() => cachedTabState?.formData ?? defaultFormData);
  const hasLoadedOnceRef = useRef(hasCachedState);
  useTabFormCacheWrite<SupplierFormCache>(__tabId, hasLoadedOnceRef.current ? { formData } : null);

  const [loading, setLoading] = useState(!isNew && !hasCachedState);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({ show: false, message: "", type: "success" });

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const deptRes = await axios.get(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_DEPARTMENTS, { headers });
        if (deptRes.data?.data) setDepartments(deptRes.data.data.map((d: any) => ({ value: d.departmentID || d.id, title: d.departmentName || d.name })));
      } catch (err) { console.error("Error loading lookups:", err); }
    };
    loadLookups();
  }, []);

  useEffect(() => {
    if (id && !isNew && !hasCachedState) {
      const loadSupplier = async () => {
        try {
          setLoading(true);
          const res = await axios.get(API_ENDPOINTS.SUPPLIERS.GET_BY_ID(id), { headers });
          const data = res.data?.data;
          if (data) {
            setFormData({
              supplierID: data.supplierID || "", supplierNo: data.supplierNo || "", name: data.name || "",
              contactName: data.contactName || "", emailAddress: data.emailAddress || "", webSite: data.webSite || "",
              accountNo: data.accountNo || "", phoneNumber1: data.phoneNumber1 || "", ext1: data.ext1 || "",
              phoneNumber2: data.phoneNumber2 || "", phoneNumber3: data.phoneNumber3 || "",
              address1: data.address1 || "", address2: data.address2 || "", city: data.city || "",
              state: data.state || "", zip: data.zip || "", note: data.note || "",
              minMarkup: data.minMarkup || 0, listPrice: data.listPrice || 0, import: data.import || 0,
              department: data.department || "", buyerID: data.buyerID || "", warehouseID: data.warehouseID || "",
            });
            hasLoadedOnceRef.current = true;
          }
        } catch (err) { showToast("Error loading supplier", "error"); }
        finally { setLoading(false); }
      };
      loadSupplier();
    }
  }, [id, isNew]);

  const showToast = (message: string, type: "success" | "error" = "success") => { setToast({ show: true, message, type }); setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000); };
  const handleFieldChange = useCallback((field: keyof SupplierFormData, value: any) => { setFormData(prev => ({ ...prev, [field]: value }));  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.name) { showToast("Please enter a supplier name", "error"); return; }
    setSaving(true);
    try {
      const payload = { ...formData };
      if (isNew || !id) { await axios.post(API_ENDPOINTS.SUPPLIERS.CREATE, payload, { headers }); showToast("Supplier created successfully!"); }
      else { await axios.put(API_ENDPOINTS.SUPPLIERS.UPDATE(id), { ...payload, supplierID: id }, { headers }); showToast("Supplier updated successfully!"); }
      
    } catch (err: any) { showToast(err?.response?.data?.message || "Error saving supplier", "error"); }
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

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Supplier Name:</span>
            <Input type="text" value={formData.name} onChange={(e) => handleFieldChange("name", (e.target as HTMLInputElement).value)} disabled={!isEditMode} className="h-8 text-sm w-80" placeholder="Enter supplier name" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Supplier No.</span>
            <Input type="text" value={formData.supplierNo} onChange={(e) => handleFieldChange("supplierNo", (e.target as HTMLInputElement).value)} disabled={!isEditMode} className="h-8 text-sm w-32" placeholder="Auto" />
          </div>
          {isEditMode && (
            <div className="ml-auto">
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
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-brand-500 text-brand-500 dark:text-brand-400 bg-gray-50 dark:bg-gray-700" : "border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"}`}>
              {tab.title} <span className="ml-1 text-xs text-gray-400">({tab.shortcut})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "supplier" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white uppercase tracking-wide">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div><Label>Contact Name</Label><Input type="text" value={formData.contactName} onChange={(e) => handleFieldChange("contactName", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
              <div><Label>Account #</Label><Input type="text" value={formData.accountNo} onChange={(e) => handleFieldChange("accountNo", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
              <div><Label>Email</Label><Input type="email" value={formData.emailAddress} onChange={(e) => handleFieldChange("emailAddress", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
              <div><Label>Website</Label><Input type="text" value={formData.webSite} onChange={(e) => handleFieldChange("webSite", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
              <div><Label>Department</Label><SearchableSelect options={departments} value={formData.department} onChange={(val) => handleFieldChange("department", val)} placeholder="Select department..." /></div>
              <div><Label>Min Markup %</Label><Input type="number" value={String(formData.minMarkup)} onChange={(e) => handleFieldChange("minMarkup", Number((e.target as HTMLInputElement).value))} disabled={!isEditMode} /></div>
              <div><Label>List Price</Label><Input type="number" value={String(formData.listPrice)} onChange={(e) => handleFieldChange("listPrice", Number((e.target as HTMLInputElement).value))} disabled={!isEditMode} /></div>
              <div><Label>Import %</Label><Input type="number" value={String(formData.import)} onChange={(e) => handleFieldChange("import", Number((e.target as HTMLInputElement).value))} disabled={!isEditMode} /></div>
            </div>
          </div>
        )}

        {activeTab === "contact" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white uppercase tracking-wide mb-4">Phone Numbers</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div><Label>Phone 1</Label><Input type="tel" value={formData.phoneNumber1} onChange={(e) => handleFieldChange("phoneNumber1", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
                <div><Label>Ext</Label><Input type="text" value={formData.ext1} onChange={(e) => handleFieldChange("ext1", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
                <div><Label>Phone 2</Label><Input type="tel" value={formData.phoneNumber2} onChange={(e) => handleFieldChange("phoneNumber2", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
                <div><Label>Phone 3 (Fax)</Label><Input type="tel" value={formData.phoneNumber3} onChange={(e) => handleFieldChange("phoneNumber3", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white uppercase tracking-wide mb-4">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2"><Label>Address 1</Label><Input type="text" value={formData.address1} onChange={(e) => handleFieldChange("address1", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
                <div className="lg:col-span-2"><Label>Address 2</Label><Input type="text" value={formData.address2} onChange={(e) => handleFieldChange("address2", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
                <div><Label>City</Label><Input type="text" value={formData.city} onChange={(e) => handleFieldChange("city", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
                <div><Label>State</Label><Input type="text" value={formData.state} onChange={(e) => handleFieldChange("state", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
                <div><Label>Zip</Label><Input type="text" value={formData.zip} onChange={(e) => handleFieldChange("zip", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "notes" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <Label>Notes</Label>
            <textarea className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 text-sm min-h-[200px] focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" value={formData.note} onChange={(e) => handleFieldChange("note", e.target.value)} placeholder="Supplier notes..." disabled={!isEditMode} />
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplierFormPage;
