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

interface LoyaltyFormPageProps { id?: string; isNew?: boolean; mode?: "view" | "edit" | "new"; __tabId?: string; }

interface LoyaltyFormData {
  loyaltyProgramID: string; programName: string; pointsPerDollar: number;
  rewardThreshold: number; rewardAmount: number; isActive: boolean;
  description: string; expirationDays: number; minPurchaseAmount: number;
}

const defaultFormData: LoyaltyFormData = {
  loyaltyProgramID: "", programName: "", pointsPerDollar: 1,
  rewardThreshold: 100, rewardAmount: 5, isActive: true,
  description: "", expirationDays: 365, minPurchaseAmount: 0,
};

interface LoyaltyFormCache { formData: LoyaltyFormData; }

const LoyaltyFormPage: React.FC<LoyaltyFormPageProps> = ({ id, isNew, mode, __tabId }) => {
  const { closeTab } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();
  const headers = getAuthHeaders();
  const isEditMode = mode === "edit" || mode === "new" || isNew;

  const { initial: cachedTabState, hasCachedState } = useTabFormCacheRead<LoyaltyFormCache>(__tabId);
  const [formData, setFormData] = useState<LoyaltyFormData>(() => cachedTabState?.formData ?? defaultFormData);
  const hasLoadedOnceRef = useRef(hasCachedState);
  useTabFormCacheWrite<LoyaltyFormCache>(__tabId, hasLoadedOnceRef.current ? { formData } : null);

  const [loading, setLoading] = useState(!isNew && !hasCachedState);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({ show: false, message: "", type: "success" });

  useEffect(() => {
    if (id && !isNew && !hasCachedState) {
      const loadProgram = async () => {
        try {
          setLoading(true);
          const res = await axios.get(`${BASE_API_URL}/api/Loyalty/GetLoyaltyProgram/${id}`, { headers });
          const data = res.data?.data;
          if (data) { setFormData({ ...defaultFormData, ...data }); hasLoadedOnceRef.current = true; }
        } catch (err) { showToast("Error loading loyalty program", "error"); }
        finally { setLoading(false); }
      };
      loadProgram();
    }
  }, [id, isNew]);

  const showToast = (message: string, type: "success" | "error" = "success") => { setToast({ show: true, message, type }); setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000); };
  const handleFieldChange = useCallback((field: keyof LoyaltyFormData, value: any) => { setFormData(prev => ({ ...prev, [field]: value }));  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.programName) { showToast("Please enter a program name", "error"); return; }
    setSaving(true);
    try {
      if (isNew || !id) { await axios.post(`${BASE_API_URL}/api/Loyalty/CreateLoyaltyProgram`, formData, { headers }); showToast("Loyalty program created!"); }
      else { await axios.put(`${BASE_API_URL}/api/Loyalty/UpdateLoyaltyProgram/${id}`, { ...formData, loyaltyProgramID: id }, { headers }); showToast("Loyalty program updated!"); }
      
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
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">{isNew ? "New Loyalty Program" : `Edit: ${formData.programName}`}</h2>
          <span className={`px-2 py-1 rounded text-xs font-medium ${formData.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{formData.isActive ? "Active" : "Inactive"}</span>
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
            <div className="lg:col-span-2"><Label>Program Name *</Label><Input type="text" value={formData.programName} onChange={(e) => handleFieldChange("programName", (e.target as HTMLInputElement).value)} disabled={!isEditMode} placeholder="e.g., Gold Rewards" /></div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={formData.isActive} onChange={(e) => handleFieldChange("isActive", (e.target as HTMLInputElement).checked)} disabled={!isEditMode} className="rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
                Active
              </label>
            </div>
          </div>

          <div className="bg-brand-25 dark:bg-gray-700 border border-brand-100 dark:border-gray-600 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white uppercase tracking-wide mb-4">Points Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div><Label>Points per $1 Spent</Label><Input type="number" value={String(formData.pointsPerDollar)} onChange={(e) => handleFieldChange("pointsPerDollar", Number((e.target as HTMLInputElement).value))} disabled={!isEditMode} /></div>
              <div><Label>Reward Threshold (pts)</Label><Input type="number" value={String(formData.rewardThreshold)} onChange={(e) => handleFieldChange("rewardThreshold", Number((e.target as HTMLInputElement).value))} disabled={!isEditMode} /></div>
              <div><Label>Reward Amount ($)</Label><Input type="number" value={String(formData.rewardAmount)} onChange={(e) => handleFieldChange("rewardAmount", Number((e.target as HTMLInputElement).value))} disabled={!isEditMode} /></div>
              <div><Label>Expiration (days)</Label><Input type="number" value={String(formData.expirationDays)} onChange={(e) => handleFieldChange("expirationDays", Number((e.target as HTMLInputElement).value))} disabled={!isEditMode} /></div>
            </div>
          </div>

          <div><Label>Min Purchase Amount ($)</Label><Input type="number" value={String(formData.minPurchaseAmount)} onChange={(e) => handleFieldChange("minPurchaseAmount", Number((e.target as HTMLInputElement).value))} disabled={!isEditMode} className="max-w-xs" /></div>

          <div><Label>Description</Label>
            <textarea className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 text-sm min-h-[120px] focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={formData.description} onChange={(e) => handleFieldChange("description", e.target.value)} placeholder="Describe the loyalty program..." disabled={!isEditMode} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyFormPage;
