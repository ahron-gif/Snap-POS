import React, { useState, useCallback, useEffect } from "react";
import Button from "../../components/ui/button/Button";
import Loader from "../../components/ui/loader/Loader";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import SearchableSelect, { SelectOption } from "../../components/form/SearchableSelect";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import { useAuthHeaders } from "../../hooks/useAuthHeaders";
import { API_ENDPOINTS } from "../../constants/api";
import axios from "axios";

const BASE_API_URL = import.meta.env.VITE_API_BASE_URL || "";

interface BOGODiscountFormPageProps {
  id?: string;
  isNew?: boolean;
  __tabId?: string;
}

interface BOGOFormData {
  name: string;
  buyQty: number;
  getQty: number;
  discountPercent: number;
  discountAmount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  departmentID: string;
  itemID: string;
  applyToAll: boolean;
  note: string;
}

const defaultFormData: BOGOFormData = {
  name: "",
  buyQty: 1,
  getQty: 1,
  discountPercent: 100,
  discountAmount: 0,
  startDate: new Date().toISOString().split("T")[0],
  endDate: "",
  isActive: true,
  departmentID: "",
  itemID: "",
  applyToAll: false,
  note: "",
};

const BOGODiscountFormPage: React.FC<BOGODiscountFormPageProps> = ({ id, isNew, __tabId }) => {
  const { closeTab } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();
  const headers = getAuthHeaders();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<BOGOFormData>(defaultFormData);
  const [departments, setDepartments] = useState<SelectOption[]>([]);
  const [items, setItems] = useState<SelectOption[]>([]);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: string }>({ show: false, message: "", type: "success" });

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [deptRes, itemRes] = await Promise.all([
          axios.get(`${API_ENDPOINTS.SYSTEM_LOOKUPS.GET_DEPARTMENTS}`, { headers }),
          axios.get(`${API_ENDPOINTS.SYSTEM_LOOKUPS.ITEMS_PAGED}?startRow=0&endRow=500`, { headers }),
        ]);
        if (deptRes.data?.data) setDepartments(deptRes.data.data.map((d: any) => ({ value: d.departmentID || d.id, label: d.departmentName || d.name })));
        if (itemRes.data?.data) {
          const itemData = itemRes.data.data.data || itemRes.data.data;
          if (Array.isArray(itemData)) setItems(itemData.map((i: any) => ({ value: i.itemID || i.id, label: `${i.itemNo || ""} - ${i.description1 || i.name || ""}` })));
        }
      } catch (err) { console.error("Error loading lookups:", err); }
    };
    loadLookups();
  }, [headers]);

  useEffect(() => {
    if (id && !isNew) {
      const loadData = async () => {
        try {
          setLoading(true);
          const res = await axios.get(`${BASE_API_URL}/api/BOGODiscount/${id}`, { headers });
          const data = res.data?.data;
          if (data) {
            setFormData({
              name: data.name || "",
              buyQty: data.buyQty || 1,
              getQty: data.getQty || 1,
              discountPercent: data.discountPercent || 100,
              discountAmount: data.discountAmount || 0,
              startDate: data.startDate ? data.startDate.split("T")[0] : "",
              endDate: data.endDate ? data.endDate.split("T")[0] : "",
              isActive: data.isActive ?? true,
              departmentID: data.departmentID || "",
              itemID: data.itemID || "",
              applyToAll: data.applyToAll || false,
              note: data.note || "",
            });
          }
        } catch (err) { showToast("Error loading BOGO discount", "error"); }
        finally { setLoading(false); }
      };
      loadData();
    }
  }, [id, isNew, headers]);

  const showToast = (message: string, type: string = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const handleFieldChange = useCallback((field: keyof BOGOFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.name) { showToast("Please enter a discount name", "error"); return; }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
      };
      if (isNew || !id) {
        await axios.post(`${BASE_API_URL}/api/BOGODiscount`, payload, { headers });
        showToast("BOGO discount created successfully!");
      } else {
        await axios.put(`${BASE_API_URL}/api/BOGODiscount/${id}`, payload, { headers });
        showToast("BOGO discount updated successfully!");
      }
      
    } catch (err: any) { showToast(err?.response?.data?.message || "Error saving BOGO discount", "error"); }
    finally { setSaving(false); }
  }, [formData, isNew, id, headers]);

  const handleClose = useCallback(() => { if (__tabId) closeTab(__tabId); }, [__tabId, closeTab]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader /></div>;

  return (
    <div className="p-4 space-y-4 max-w-full overflow-auto">
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white ${toast.type === "error" ? "bg-red-500" : "bg-green-500"}`}>{toast.message}</div>
      )}

      <div className="flex items-center justify-between border-b pb-3">
        <h2 className="text-lg font-semibold text-gray-800">{isNew ? "New BOGO Discount" : `Edit BOGO Discount: ${formData.name}`}</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <Label>Discount Name *</Label>
          <Input type="text" value={formData.name} onChange={(e) => handleFieldChange("name", e.target.value)} placeholder="e.g., Buy 2 Get 1 Free" />
        </div>
        <div>
          <Label>Buy Quantity</Label>
          <Input type="number" value={String(formData.buyQty)} onChange={(e) => handleFieldChange("buyQty", Number(e.target.value))} min="1" />
        </div>
        <div>
          <Label>Get Quantity</Label>
          <Input type="number" value={String(formData.getQty)} onChange={(e) => handleFieldChange("getQty", Number(e.target.value))} min="1" />
        </div>
        <div>
          <Label>Discount %</Label>
          <Input type="number" value={String(formData.discountPercent)} onChange={(e) => handleFieldChange("discountPercent", Number(e.target.value))} min="0" max="100" />
        </div>
        <div>
          <Label>Discount Amount ($)</Label>
          <Input type="number" value={String(formData.discountAmount)} onChange={(e) => handleFieldChange("discountAmount", Number(e.target.value))} min="0" step={0.01} />
        </div>
        <div>
          <Label>Start Date</Label>
          <Input type="date" value={formData.startDate} onChange={(e) => handleFieldChange("startDate", e.target.value)} />
        </div>
        <div>
          <Label>End Date</Label>
          <Input type="date" value={formData.endDate} onChange={(e) => handleFieldChange("endDate", e.target.value)} />
        </div>
        <div>
          <Label>Department</Label>
          <SearchableSelect options={departments} value={formData.departmentID} onChange={(val) => handleFieldChange("departmentID", val)} placeholder="All departments..." />
        </div>
        <div>
          <Label>Specific Item</Label>
          <SearchableSelect options={items} value={formData.itemID} onChange={(val) => handleFieldChange("itemID", val)} placeholder="All items..." />
        </div>
        <div className="flex items-center gap-4 pt-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={formData.isActive} onChange={(e) => handleFieldChange("isActive", e.target.checked)} className="rounded" />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={formData.applyToAll} onChange={(e) => handleFieldChange("applyToAll", e.target.checked)} className="rounded" />
            Apply to All Items
          </label>
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[60px]" value={formData.note} onChange={(e) => handleFieldChange("note", e.target.value)} placeholder="Notes..." />
      </div>

      {/* Preview */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-medium text-green-800 mb-2">Discount Preview</h3>
        <p className="text-green-700">
          Buy <strong>{formData.buyQty}</strong> item(s), Get <strong>{formData.getQty}</strong> item(s) at{" "}
          <strong>{formData.discountPercent}% off</strong>
          {formData.discountAmount > 0 && <> (or ${formData.discountAmount.toFixed(2)} off)</>}
        </p>
      </div>
    </div>
  );
};

export default BOGODiscountFormPage;
