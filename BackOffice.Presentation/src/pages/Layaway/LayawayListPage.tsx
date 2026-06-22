import React, { useState, useCallback, useEffect } from "react";
import Button from "../../components/ui/button/Button";
import Loader from "../../components/ui/loader/Loader";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import { useAuthHeaders } from "../../hooks/useAuthHeaders";
import axios from "axios";

const BASE_API_URL = import.meta.env.VITE_API_BASE_URL || "";
const PlusIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>);

interface Layaway { layawayID: string; layawayNo: string; customerName: string; totalAmount: number; paidAmount: number; balance: number; status: number; createdDate: string; dueDate: string; }

const STATUS_MAP: Record<number, { title: string; className: string }> = {
  0: { title: "Active", className: "bg-blue-100 text-blue-700" },
  1: { title: "Paid Off", className: "bg-green-100 text-green-700" },
  2: { title: "Cancelled", className: "bg-red-100 text-red-700" },
  3: { title: "Expired", className: "bg-gray-100 text-gray-500" },
};

const LayawayListPage: React.FC<{ __tabId?: string }> = ({ __tabId }) => {
  const { openTab } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();
  const headers = getAuthHeaders();
  const [layaways, setLayaways] = useState<Layaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "paid">("all");

  const loadLayaways = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BASE_API_URL}/api/Layaway/GetAllLayaways`, { headers });
      if (res.data?.data) setLayaways(res.data.data);
      else setLayaways([]);
    } catch { setLayaways([]); }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { loadLayaways(); }, []);

  const filteredLayaways = layaways.filter(l => filter === "all" ? true : filter === "active" ? l.status === 0 : l.status === 1);

  const handleAdd = useCallback(() => { openTab({ component: "LayawayFormPage", title: "New Layaway", closable: true, props: { isNew: true, mode: "new" } }); }, [openTab]);
  const handleEdit = useCallback((layaway: Layaway) => { openTab({ component: "LayawayFormPage", title: `Layaway: ${layaway.layawayNo}`, closable: true, props: { id: layaway.layawayID, mode: "edit" } }); }, [openTab]);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-semibold text-gray-800 dark:text-white">Layaways</h2>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
              {(["all", "active", "paid"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? "bg-brand-500 text-white" : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50"}`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <Button size="sm" onClick={handleAdd} startIcon={<PlusIcon />}>New Layaway</Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {loading ? <div className="flex items-center justify-center h-64"><Loader /></div> : filteredLayaways.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Layaways</h3>
            <p className="text-sm text-gray-500 mb-4">Create layaway plans for customers to pay over time.</p>
            <Button size="sm" onClick={handleAdd} startIcon={<PlusIcon />}>Create Layaway</Button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Layaway #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Customer</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Total</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Paid</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Balance</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredLayaways.map((layaway) => (
                  <tr key={layaway.layawayID} onClick={() => handleEdit(layaway)} className="hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer">
                    <td className="px-4 py-3 font-medium text-brand-600 dark:text-brand-400">{layaway.layawayNo}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{layaway.customerName}</td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-white">${layaway.totalAmount?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-green-600">${layaway.paidAmount?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">${layaway.balance?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_MAP[layaway.status]?.className || "bg-gray-100 text-gray-500"}`}>{STATUS_MAP[layaway.status]?.title || "Unknown"}</span></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{layaway.dueDate ? new Date(layaway.dueDate).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LayawayListPage;
