import React, { useState, useCallback, useEffect } from "react";
import Button from "../../components/ui/button/Button";
import Loader from "../../components/ui/loader/Loader";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import { useAuthHeaders } from "../../hooks/useAuthHeaders";
import axios from "axios";

const BASE_API_URL = import.meta.env.VITE_API_BASE_URL || "";

const PlusIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>);
const EditIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>);
const TrashIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>);

interface LoyaltyProgram {
  loyaltyProgramID: string;
  programName: string;
  pointsPerDollar: number;
  rewardThreshold: number;
  rewardAmount: number;
  isActive: boolean;
}

const LoyaltyListPage: React.FC<{ __tabId?: string }> = ({ __tabId }) => {
  const { openTab } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();
  const headers = getAuthHeaders();
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPrograms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BASE_API_URL}/api/Loyalty/GetAllLoyaltyPrograms`, { headers });
      if (res.data?.data) setPrograms(res.data.data);
      else setPrograms([]);
    } catch (err) {
      console.error("Error loading loyalty programs:", err);
      setPrograms([]);
    } finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { loadPrograms(); }, []);

  const handleAdd = useCallback(() => {
    openTab({ component: "LoyaltyFormPage", title: "New Loyalty Program", closable: true, props: { isNew: true, mode: "new" } });
  }, [openTab]);

  const handleEdit = useCallback((program: LoyaltyProgram) => {
    openTab({ component: "LoyaltyFormPage", title: `Edit: ${program.programName}`, closable: true, props: { id: program.loyaltyProgramID, mode: "edit" } });
  }, [openTab]);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">Loyalty Programs</h2>
          <Button size="sm" onClick={handleAdd} startIcon={<PlusIcon />}>Add Program</Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader /></div>
        ) : programs.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Loyalty Programs</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Create your first loyalty program to reward customers.</p>
            <Button size="sm" onClick={handleAdd} startIcon={<PlusIcon />}>Create Program</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {programs.map((program) => (
              <div key={program.loyaltyProgramID} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:shadow-theme-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-800 dark:text-white">{program.programName}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${program.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {program.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between"><span>Points per $1:</span><span className="font-medium text-gray-900 dark:text-white">{program.pointsPerDollar}</span></div>
                  <div className="flex justify-between"><span>Reward Threshold:</span><span className="font-medium text-gray-900 dark:text-white">{program.rewardThreshold} pts</span></div>
                  <div className="flex justify-between"><span>Reward Amount:</span><span className="font-medium text-brand-600 dark:text-brand-400">${program.rewardAmount?.toFixed(2)}</span></div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(program)} startIcon={<EditIcon />}>Edit</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoyaltyListPage;
