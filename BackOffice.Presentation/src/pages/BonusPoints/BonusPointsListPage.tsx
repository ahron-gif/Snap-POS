import React, { useState, useCallback, useEffect } from "react";
import Button from "../../components/ui/button/Button";
import Loader from "../../components/ui/loader/Loader";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import { useAuthHeaders } from "../../hooks/useAuthHeaders";
import axios from "axios";

const BASE_API_URL = import.meta.env.VITE_API_BASE_URL || "";
const PlusIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>);
const EditIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>);

interface BonusPointRule { bonusPointID: string; ruleName: string; pointsAwarded: number; triggerType: string; triggerValue: number; isActive: boolean; }

const BonusPointsListPage: React.FC<{ __tabId?: string }> = ({ __tabId }) => {
  const { openTab } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();
  const headers = getAuthHeaders();
  const [rules, setRules] = useState<BonusPointRule[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BASE_API_URL}/api/BonusPoints/GetAllBonusPointRules`, { headers });
      if (res.data?.data) setRules(res.data.data);
      else setRules([]);
    } catch { setRules([]); }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { loadRules(); }, []);

  const handleAdd = useCallback(() => { openTab({ component: "BonusPointsFormPage", title: "New Bonus Points Rule", closable: true, props: { isNew: true, mode: "new" } }); }, [openTab]);
  const handleEdit = useCallback((rule: BonusPointRule) => { openTab({ component: "BonusPointsFormPage", title: `Edit: ${rule.ruleName}`, closable: true, props: { id: rule.bonusPointID, mode: "edit" } }); }, [openTab]);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">Bonus Points Rules</h2>
          <Button size="sm" onClick={handleAdd} startIcon={<PlusIcon />}>Add Rule</Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {loading ? <div className="flex items-center justify-center h-64"><Loader /></div> : rules.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Bonus Point Rules</h3>
            <p className="text-sm text-gray-500 mb-4">Create rules to award bonus points for specific actions.</p>
            <Button size="sm" onClick={handleAdd} startIcon={<PlusIcon />}>Create Rule</Button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Rule Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Trigger</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Points</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 w-[80px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rules.map((rule) => (
                  <tr key={rule.bonusPointID} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{rule.ruleName}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{rule.triggerType} ({rule.triggerValue})</td>
                    <td className="px-4 py-3 text-right font-semibold text-brand-600 dark:text-brand-400">{rule.pointsAwarded} pts</td>
                    <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded text-xs font-medium ${rule.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{rule.isActive ? "Active" : "Inactive"}</span></td>
                    <td className="px-4 py-3"><button onClick={() => handleEdit(rule)} className="text-brand-500 hover:text-brand-700 p-1.5 rounded hover:bg-brand-50 transition-colors"><EditIcon /></button></td>
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

export default BonusPointsListPage;
