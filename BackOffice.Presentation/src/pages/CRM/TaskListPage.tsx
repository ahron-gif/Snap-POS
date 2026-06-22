import React, { useState, useCallback, useEffect } from "react";
import Button from "../../components/ui/button/Button";
import Loader from "../../components/ui/loader/Loader";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import { useAuthHeaders } from "../../hooks/useAuthHeaders";
import axios from "axios";

const BASE_API_URL = import.meta.env.VITE_API_BASE_URL || "";
const PlusIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>);
const CheckIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>);

interface Task { taskID: string; title: string; description: string; assignedTo: string; dueDate: string; priority: number; status: number; customerName: string; }

const PRIORITY_LABELS: Record<number, { title: string; className: string }> = {
  0: { title: "Low", className: "bg-gray-100 text-gray-600" },
  1: { title: "Medium", className: "bg-yellow-100 text-yellow-700" },
  2: { title: "High", className: "bg-orange-100 text-orange-700" },
  3: { title: "Urgent", className: "bg-red-100 text-red-700" },
};
const STATUS_LABELS: Record<number, { title: string; className: string }> = {
  0: { title: "Open", className: "bg-blue-100 text-blue-700" },
  1: { title: "In Progress", className: "bg-purple-100 text-purple-700" },
  2: { title: "Completed", className: "bg-green-100 text-green-700" },
  3: { title: "Cancelled", className: "bg-gray-100 text-gray-500" },
};

const TaskListPage: React.FC<{ __tabId?: string }> = ({ __tabId }) => {
  const { openTab } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();
  const headers = getAuthHeaders();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "completed">("all");

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BASE_API_URL}/api/CRM/GetAllTasks`, { headers });
      if (res.data?.data) setTasks(res.data.data);
      else setTasks([]);
    } catch { setTasks([]); }
    finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { loadTasks(); }, []);

  const filteredTasks = tasks.filter(t => filter === "all" ? true : filter === "open" ? t.status < 2 : t.status === 2);

  const handleAdd = useCallback(() => { openTab({ component: "TaskFormPage", title: "New Task", closable: true, props: { isNew: true, mode: "new" } }); }, [openTab]);
  const handleEdit = useCallback((task: Task) => { openTab({ component: "TaskFormPage", title: `Task: ${task.title}`, closable: true, props: { id: task.taskID, mode: "edit" } }); }, [openTab]);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-semibold text-gray-800 dark:text-white">Task List</h2>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
              {(["all", "open", "completed"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? "bg-brand-500 text-white" : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50"}`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <Button size="sm" onClick={handleAdd} startIcon={<PlusIcon />}>Add Task</Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {loading ? <div className="flex items-center justify-center h-64"><Loader /></div> : filteredTasks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Tasks</h3>
            <p className="text-sm text-gray-500 mb-4">Create tasks to track follow-ups and customer interactions.</p>
            <Button size="sm" onClick={handleAdd} startIcon={<PlusIcon />}>Create Task</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <div key={task.taskID} onClick={() => handleEdit(task)} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-theme-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-white">{task.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_LABELS[task.priority]?.className || "bg-gray-100 text-gray-600"}`}>{PRIORITY_LABELS[task.priority]?.title || "Normal"}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_LABELS[task.status]?.className || "bg-gray-100 text-gray-600"}`}>{STATUS_LABELS[task.status]?.title || "Open"}</span>
                    </div>
                    {task.description && <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{task.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      {task.customerName && <span>Customer: {task.customerName}</span>}
                      {task.assignedTo && <span>Assigned: {task.assignedTo}</span>}
                      {task.dueDate && <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskListPage;
