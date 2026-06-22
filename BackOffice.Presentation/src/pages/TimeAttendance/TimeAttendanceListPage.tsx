import React, { useState, useCallback, useEffect } from "react";
import Button from "../../components/ui/button/Button";
import Loader from "../../components/ui/loader/Loader";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import { useAuthHeaders } from "../../hooks/useAuthHeaders";
import axios from "axios";

const BASE_API_URL = import.meta.env.VITE_API_BASE_URL || "";

interface TimeEntry { timeEntryID: string; employeeName: string; clockIn: string; clockOut: string; totalHours: number; storeID: string; storeName: string; date: string; }

const TimeAttendanceListPage: React.FC<{ __tabId?: string }> = ({ __tabId }) => {
  const { getAuthHeaders } = useAuthHeaders();
  const headers = getAuthHeaders();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BASE_API_URL}/api/TimeAttendance/GetTimeEntries?fromDate=${dateFrom}&toDate=${dateTo}`, { headers });
      if (res.data?.data) setEntries(res.data.data);
      else setEntries([]);
    } catch { setEntries([]); }
    finally { setLoading(false); }
  }, [headers, dateFrom, dateTo]);

  useEffect(() => { loadEntries(); }, [dateFrom, dateTo]);

  const totalHours = entries.reduce((sum, e) => sum + (e.totalHours || 0), 0);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">Time & Attendance</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">From:</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom((e.target as HTMLInputElement).value)} className="h-8 text-sm w-36" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">To:</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo((e.target as HTMLInputElement).value)} className="h-8 text-sm w-36" />
            </div>
            <Button size="sm" variant="outline" onClick={loadEntries}>Refresh</Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? <div className="flex items-center justify-center h-64"><Loader /></div> : (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <span className="text-sm text-gray-500 dark:text-gray-400">Total Entries</span>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{entries.length}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <span className="text-sm text-gray-500 dark:text-gray-400">Total Hours</span>
                <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{totalHours.toFixed(1)}h</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <span className="text-sm text-gray-500 dark:text-gray-400">Unique Employees</span>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{new Set(entries.map(e => e.employeeName)).size}</p>
              </div>
            </div>

            {/* Table */}
            {entries.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Time Entries</h3>
                <p className="text-sm text-gray-500">No clock-in/out records found for the selected date range.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Employee</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Clock In</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Clock Out</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">Hours</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Store</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {entries.map((entry) => (
                      <tr key={entry.timeEntryID} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{entry.employeeName}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{entry.date ? new Date(entry.date).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{entry.clockIn ? new Date(entry.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{entry.clockOut ? new Date(entry.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : <span className="text-orange-500 font-medium">Active</span>}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{entry.totalHours?.toFixed(1) || "—"}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{entry.storeName || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Total Hours:</td>
                      <td className="px-4 py-3 text-right font-bold text-brand-600 dark:text-brand-400">{totalHours.toFixed(1)}h</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeAttendanceListPage;
