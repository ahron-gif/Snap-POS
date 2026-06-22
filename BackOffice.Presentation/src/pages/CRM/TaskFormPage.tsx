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

interface TaskFormPageProps { id?: string; isNew?: boolean; mode?: "view" | "edit" | "new"; __tabId?: string; }

interface TaskFormData {
  taskID: string; title: string; description: string; assignedTo: string;
  dueDate: string; priority: number; status: number; customerID: string;
  notes: string; reminderDate: string;
}

const defaultFormData: TaskFormData = {
  taskID: "", title: "", description: "", assignedTo: "",
  dueDate: "", priority: 1, status: 0, customerID: "",
  notes: "", reminderDate: "",
};

const PRIORITY_OPTIONS = [{ value: "0", title: "Low" }, { value: "1", title: "Medium" }, { value: "2", title: "High" }, { value: "3", title: "Urgent" }];
const STATUS_OPTIONS = [{ value: "0", title: "Open" }, { value: "1", title: "In Progress" }, { value: "2", title: "Completed" }, { value: "3", title: "Cancelled" }];

interface TaskFormCache { formData: TaskFormData; }

const TaskFormPage: React.FC<TaskFormPageProps> = ({ id, isNew, mode, __tabId }) => {
  const { closeTab } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();
  const headers = getAuthHeaders();
  const isEditMode = mode === "edit" || mode === "new" || isNew;

  const { initial: cachedTabState, hasCachedState } = useTabFormCacheRead<TaskFormCache>(__tabId);
  const [formData, setFormData] = useState<TaskFormData>(() => cachedTabState?.formData ?? defaultFormData);
  const hasLoadedOnceRef = useRef(hasCachedState);
  useTabFormCacheWrite<TaskFormCache>(__tabId, hasLoadedOnceRef.current ? { formData } : null);

  const [loading, setLoading] = useState(!isNew && !hasCachedState);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<SelectOption[]>([]);
  const [users, setUsers] = useState<SelectOption[]>([]);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({ show: false, message: "", type: "success" });

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [custRes, userRes] = await Promise.all([
          axios.get(`${BASE_API_URL}/api/SystemLookups/GetCustomers`, { headers }).catch(() => ({ data: { data: [] } })),
          axios.get(`${BASE_API_URL}/api/SystemLookups/GetUsers`, { headers }).catch(() => ({ data: { data: [] } })),
        ]);
        if (custRes.data?.data) setCustomers(custRes.data.data.map((c: any) => ({ value: c.customerID || c.id, title: c.customerName || c.name || "" })));
        if (userRes.data?.data) setUsers(userRes.data.data.map((u: any) => ({ value: u.userID || u.id, title: u.fullName || u.userName || "" })));
      } catch { /* silently fail */ }
    };
    loadLookups();
  }, []);

  useEffect(() => {
    if (id && !isNew && !hasCachedState) {
      const loadTask = async () => {
        try {
          setLoading(true);
          const res = await axios.get(`${BASE_API_URL}/api/CRM/GetTask/${id}`, { headers });
          const data = res.data?.data;
          if (data) { setFormData({ ...defaultFormData, ...data, dueDate: data.dueDate?.split("T")[0] || "", reminderDate: data.reminderDate?.split("T")[0] || "" }); hasLoadedOnceRef.current = true; }
        } catch { showToast("Error loading task", "error"); }
        finally { setLoading(false); }
      };
      loadTask();
    }
  }, [id, isNew]);

  const showToast = (message: string, type: "success" | "error" = "success") => { setToast({ show: true, message, type }); setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000); };
  const handleFieldChange = useCallback((field: keyof TaskFormData, value: any) => { setFormData(prev => ({ ...prev, [field]: value }));  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.title) { showToast("Please enter a title", "error"); return; }
    setSaving(true);
    try {
      const payload = { ...formData, dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null, reminderDate: formData.reminderDate ? new Date(formData.reminderDate).toISOString() : null };
      if (isNew || !id) { await axios.post(`${BASE_API_URL}/api/CRM/CreateTask`, payload, { headers }); showToast("Task created!"); }
      else { await axios.put(`${BASE_API_URL}/api/CRM/UpdateTask/${id}`, { ...payload, taskID: id }, { headers }); showToast("Task updated!"); }
      
    } catch (err: any) { showToast(err?.response?.data?.message || "Error saving task", "error"); }
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
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">{isNew ? "New Task" : formData.title || "Edit Task"}</h2>
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
            <div className="lg:col-span-2"><Label>Title *</Label><Input type="text" value={formData.title} onChange={(e) => handleFieldChange("title", (e.target as HTMLInputElement).value)} disabled={!isEditMode} placeholder="Task title..." /></div>
            <div>
              <Label>Priority</Label>
              <select className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={String(formData.priority)} onChange={(e) => handleFieldChange("priority", Number(e.target.value))} disabled={!isEditMode}>
                {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.title}</option>)}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={String(formData.status)} onChange={(e) => handleFieldChange("status", Number(e.target.value))} disabled={!isEditMode}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.title}</option>)}
              </select>
            </div>
            <div><Label>Due Date</Label><Input type="date" value={formData.dueDate} onChange={(e) => handleFieldChange("dueDate", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
            <div><Label>Reminder Date</Label><Input type="date" value={formData.reminderDate} onChange={(e) => handleFieldChange("reminderDate", (e.target as HTMLInputElement).value)} disabled={!isEditMode} /></div>
            <div><Label>Customer</Label><SearchableSelect options={customers} value={formData.customerID} onChange={(val) => handleFieldChange("customerID", val)} placeholder="Select customer..." /></div>
            <div><Label>Assigned To</Label><SearchableSelect options={users} value={formData.assignedTo} onChange={(val) => handleFieldChange("assignedTo", val)} placeholder="Select user..." /></div>
          </div>
          <div><Label>Description</Label><textarea className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 text-sm min-h-[120px] focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={formData.description} onChange={(e) => handleFieldChange("description", e.target.value)} placeholder="Task description..." disabled={!isEditMode} /></div>
          <div><Label>Notes</Label><textarea className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-4 py-3 text-sm min-h-[100px] focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={formData.notes} onChange={(e) => handleFieldChange("notes", e.target.value)} placeholder="Additional notes..." disabled={!isEditMode} /></div>
        </div>
      </div>
    </div>
  );
};

export default TaskFormPage;
