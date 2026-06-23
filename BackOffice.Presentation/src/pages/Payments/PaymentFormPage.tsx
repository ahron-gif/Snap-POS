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

interface PaymentFormPageProps { id?: string; isNew?: boolean; mode?: "view" | "edit" | "new"; __tabId?: string; }

const PAYMENT_METHOD_OPTIONS = [
  { value: "0", label: "Check" },
  { value: "1", label: "Cash" },
  { value: "2", label: "Credit Card" },
  { value: "3", label: "Wire Transfer" },
  { value: "4", label: "ACH" },
  { value: "5", label: "Other" },
];

interface PaymentFormData { paymentID: string; supplierNo: string; storeID: string; amount: number; checkNo: string; note: string; paymentDate: string; paymentMethod: number; billID: string; }
const defaultFormData: PaymentFormData = { paymentID: "", supplierNo: "", storeID: "", amount: 0, checkNo: "", note: "", paymentDate: new Date().toISOString().split("T")[0], paymentMethod: 0, billID: "" };
interface PaymentFormCache { formData: PaymentFormData; }

const PaymentFormPage: React.FC<PaymentFormPageProps> = ({ id, isNew, mode, __tabId }) => {
  const { closeTab } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();
  const headers = getAuthHeaders();
  const isEditMode = mode === "edit" || mode === "new" || isNew;

  const { initial: cachedTabState, hasCachedState } = useTabFormCacheRead<PaymentFormCache>(__tabId);
  const [formData, setFormData] = useState<PaymentFormData>(() => cachedTabState?.formData ?? defaultFormData);
  const hasLoadedOnceRef = useRef(hasCachedState);
  useTabFormCacheWrite<PaymentFormCache>(__tabId, hasLoadedOnceRef.current ? { formData } : null);

  const [loading, setLoading] = useState(!isNew && !hasCachedState);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<SelectOption[]>([]);
  const [stores, setStores] = useState<SelectOption[]>([]);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({ show: false, message: "", type: "success" });

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [suppRes, storeRes] = await Promise.all([
          axios.get(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_SUPPLIERS_LOOKUP, { headers }),
          axios.get(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_STORES, { headers }),
        ]);
        if (suppRes.data?.data) setSuppliers(suppRes.data.data.map((s: any) => ({ value: s.supplierID || s.id, label: s.name || s.supplierName })));
        if (storeRes.data?.data) setStores(storeRes.data.data.map((s: any) => ({ value: s.storeID || s.id, label: s.storeName || s.name })));
      } catch (err) { console.error("Error loading lookups:", err); }
    };
    loadLookups();
  }, []);

  useEffect(() => {
    if (id && !isNew && !hasCachedState) {
      const loadPayment = async () => {
        try {
          setLoading(true);
          const res = await axios.get(API_ENDPOINTS.PAYMENTS.GET_BY_ID(id), { headers });
          const data = res.data?.data;
          if (data) {
            setFormData({ paymentID: data.paymentID || "", supplierNo: data.supplierNo || "", storeID: data.storeID || "", amount: data.amount || 0, checkNo: data.checkNo || "", note: data.note || "", paymentDate: data.paymentDate ? data.paymentDate.split("T")[0] : "", paymentMethod: data.paymentMethod || 0, billID: data.billID || "" });
            hasLoadedOnceRef.current = true;
          }
        } catch (err) { showToast("Error loading payment", "error"); }
        finally { setLoading(false); }
      };
      loadPayment();
    }
  }, [id, isNew]);

  const showToast = (message: string, type: "success" | "error" = "success") => { setToast({ show: true, message, type }); setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000); };
  const handleFieldChange = useCallback((field: keyof PaymentFormData, value: any) => { setFormData(prev => ({ ...prev, [field]: value }));  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.supplierNo) { showToast("Please select a supplier", "error"); return; }
    if (!formData.amount || formData.amount <= 0) { showToast("Please enter a valid amount", "error"); return; }
    setSaving(true);
    try {
      const payload = { ...formData, paymentDate: formData.paymentDate ? new Date(formData.paymentDate).toISOString() : null, paymentMethod: Number(formData.paymentMethod) };
      if (isNew || !id) { await axios.post(API_ENDPOINTS.PAYMENTS.CREATE, payload, { headers }); showToast("Payment created successfully!"); }
      else { await axios.put(API_ENDPOINTS.PAYMENTS.UPDATE(id), { ...payload, paymentID: id }, { headers }); showToast("Payment updated successfully!"); }
      
    } catch (err: any) { showToast(err?.response?.data?.message || "Error saving payment", "error"); }
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
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">{isNew ? "New Payment" : "Edit Payment"}</h2>
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
            {PAYMENT_METHOD_OPTIONS.find(m => m.value === String(formData.paymentMethod))?.label || "Payment"}
          </span>
          {formData.amount > 0 && (
            <span className="text-lg font-bold text-brand-600 dark:text-brand-400">${formData.amount.toFixed(2)}</span>
          )}
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Supplier *</Label>
              <SearchableSelect options={suppliers} value={formData.supplierNo} onChange={(val) => handleFieldChange("supplierNo", val)} placeholder="Select supplier..." />
            </div>
            <div>
              <Label>Store</Label>
              <SearchableSelect options={stores} value={formData.storeID} onChange={(val) => handleFieldChange("storeID", val)} placeholder="Select store..." />
            </div>
            <div>
              <Label>Payment Date</Label>
              <Input type="date" value={formData.paymentDate} onChange={(e) => handleFieldChange("paymentDate", (e.target as HTMLInputElement).value)} disabled={!isEditMode} />
            </div>
            <div>
              <Label>Amount *</Label>
              <Input type="number" value={String(formData.amount)} onChange={(e) => handleFieldChange("amount", Number((e.target as HTMLInputElement).value))} disabled={!isEditMode} />
            </div>
            <div>
              <Label>Payment Method</Label>
              <select className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" value={String(formData.paymentMethod)} onChange={(e) => handleFieldChange("paymentMethod", Number(e.target.value))} disabled={!isEditMode}>
                {PAYMENT_METHOD_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Check #</Label>
              <Input type="text" value={formData.checkNo} onChange={(e) => handleFieldChange("checkNo", (e.target as HTMLInputElement).value)} placeholder="Check number..." disabled={!isEditMode} />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <textarea className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 text-sm min-h-[120px] focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" value={formData.note} onChange={(e) => handleFieldChange("note", e.target.value)} placeholder="Payment notes..." disabled={!isEditMode} />
          </div>

          {/* Payment Summary */}
          <div className="bg-brand-25 dark:bg-gray-700 border border-brand-100 dark:border-gray-600 rounded-lg p-4">
            <h3 className="font-medium text-gray-800 dark:text-white mb-3">Payment Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400 block">Supplier</span>
                <span className="font-medium text-gray-900 dark:text-white">{suppliers.find(s => s.value === formData.supplierNo)?.label || "—"}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 block">Method</span>
                <span className="font-medium text-gray-900 dark:text-white">{PAYMENT_METHOD_OPTIONS.find(m => m.value === String(formData.paymentMethod))?.label || "—"}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 block">Amount</span>
                <span className="font-bold text-xl text-brand-600 dark:text-brand-400">${formData.amount.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 block">Date</span>
                <span className="font-medium text-gray-900 dark:text-white">{formData.paymentDate || "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentFormPage;
