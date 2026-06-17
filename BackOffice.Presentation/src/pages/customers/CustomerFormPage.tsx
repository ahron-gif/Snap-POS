import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useAuthHeaders } from "../../hooks/useAuthHeaders";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import { API_ENDPOINTS } from "../../constants/api";
import axios from "axios";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";
import Loader from "../../components/ui/loader/Loader";

// ─── Interfaces ───
interface CustomerFormPageProps {
  id?: string;
  customerData?: CustomerData;
  mode?: "view" | "edit" | "new";
  __tabId?: string;
}

interface CustomerData {
  customerID: string;
  customerNo: string;
  name: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  cell: string;
  email: string;
  credit: number;
  balanceDoe: number;
  lastVisit: string;
  lastPayment: number;
  lastDateCleared: string;
  groupName: string;
  over30: number;
  over60: number;
  over90: number;
  over120: number;
  current: number;
  lockAccount: boolean;
  lockOutDays: number;
  dateCreated: string;
  dateModified: string;
  [key: string]: any;
}

// ─── Tab Definitions ───
type TabKey = "general" | "credit" | "addresses" | "notes" | "transactions";

interface Tab {
  key: TabKey;
  label: string;
  shortcut: string;
}

const TABS: Tab[] = [
  { key: "general", label: "General", shortcut: "F2" },
  { key: "credit", label: "Credit & Balance", shortcut: "F3" },
  { key: "addresses", label: "Addresses", shortcut: "F4" },
  { key: "notes", label: "Notes", shortcut: "F5" },
  { key: "transactions", label: "Transactions", shortcut: "F6" },
];

// ─── Helper Components ───
const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
  title,
  children,
  className = "",
}) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-t-lg">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
    </div>
    <div className="p-4 space-y-2">{children}</div>
  </div>
);

const FormRow: React.FC<{
  label: string;
  children: React.ReactNode;
  labelWidth?: string;
}> = ({ label, children, labelWidth = "100px" }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 flex-shrink-0" style={{ width: labelWidth }}>
      {label}
    </span>
    <div className="flex-1">{children}</div>
  </div>
);

// Detect RTL text (Hebrew/Yiddish)
const isRTL = (text: string): boolean => {
  if (!text) return false;
  const rtlRegex = /[\u0590-\u05FF\uFB1D-\uFB4F]/;
  return rtlRegex.test(text);
};

// RTL-aware input component
const RTLInput: React.FC<{
  value: string;
  disabled?: boolean;
  className?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
}> = ({ value, disabled = true, className = "", onChange, type = "text" }) => (
  <div style={{ direction: isRTL(value) ? "rtl" : "ltr" }}>
    <Input
      type={type}
      value={value}
      disabled={disabled}
      onChange={onChange}
      className={`h-7 text-sm ${className}`}
    />
  </div>
);

// ─── Main Component ───
const CustomerFormPage: React.FC<CustomerFormPageProps> = ({ id, customerData, mode = "view" }) => {
  const { getAuthHeaders } = useAuthHeaders();
  const { closeTab } = useDashboardTabs();

  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [data, setData] = useState<CustomerData | null>(customerData || null);
  const [isLoading, setIsLoading] = useState(!customerData);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNoteText, setNewNoteText] = useState("");

  // Toast state
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" | "info" }>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  }, []);

  // Fetch customer data by ID if not passed as prop
  const fetchCustomerData = useCallback(async () => {
    if (!id || customerData) return;
    setIsLoading(true);
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(API_ENDPOINTS.CUSTOMER.GET_BY_ID(id), { headers });
      if (response.data?.isSuccess && response.data.response) {
        setData(response.data.response);
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
      showToast("Failed to load customer data", "error");
    } finally {
      setIsLoading(false);
    }
  }, [id, customerData, getAuthHeaders, showToast]);

  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  // Keyboard shortcuts for tab switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); setActiveTab("general"); }
      else if (e.key === "F3") { e.preventDefault(); setActiveTab("credit"); }
      else if (e.key === "F4") { e.preventDefault(); setActiveTab("addresses"); }
      else if (e.key === "F5") { e.preventDefault(); setActiveTab("notes"); }
      else if (e.key === "F6") { e.preventDefault(); setActiveTab("transactions"); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ─── Tab Renderers ───

  const renderGeneralTab = () => {
    if (!data) return null;
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Left Column - Personal Info */}
          <Section title="Personal Information">
            <FormRow label="Customer No:">
              <RTLInput value={data.customerNo || ""} />
            </FormRow>
            <FormRow label="Name:">
              <RTLInput value={data.name || ""} />
            </FormRow>
            <FormRow label="First Name:">
              <RTLInput value={data.firstName || ""} />
            </FormRow>
            <FormRow label="Last Name:">
              <RTLInput value={data.lastName || ""} />
            </FormRow>
            <FormRow label="Group:">
              <RTLInput value={data.groupName || ""} />
            </FormRow>
          </Section>

          {/* Right Column - Contact Info */}
          <Section title="Contact Information">
            <FormRow label="Phone:">
              <RTLInput value={data.phone || ""} />
            </FormRow>
            <FormRow label="Cell:">
              <RTLInput value={data.cell || ""} />
            </FormRow>
            <FormRow label="Email:">
              <RTLInput value={data.email || ""} />
            </FormRow>
            <FormRow label="Last Visit:">
              <RTLInput value={data.lastVisit ? new Date(data.lastVisit).toLocaleDateString() : "N/A"} />
            </FormRow>
          </Section>
        </div>

        {/* Address Section */}
        <Section title="Address">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FormRow label="Address:">
                <RTLInput value={data.address || ""} />
              </FormRow>
              <FormRow label="City:">
                <RTLInput value={data.city || ""} />
              </FormRow>
            </div>
            <div className="space-y-2">
              <FormRow label="State:">
                <RTLInput value={data.state || ""} />
              </FormRow>
              <FormRow label="Zip:">
                <RTLInput value={data.zip || ""} />
              </FormRow>
            </div>
          </div>
        </Section>

        {/* Account Status */}
        <Section title="Account Status">
          <div className="grid grid-cols-3 gap-4">
            <FormRow label="Lock Account:">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={data.lockAccount || false}
                  disabled
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {data.lockAccount ? "Locked" : "Active"}
                </span>
              </div>
            </FormRow>
            <FormRow label="Lock Days:">
              <RTLInput value={String(data.lockOutDays || 0)} />
            </FormRow>
            <FormRow label="Created:">
              <RTLInput value={data.dateCreated ? new Date(data.dateCreated).toLocaleDateString() : "N/A"} />
            </FormRow>
          </div>
        </Section>
      </div>
    );
  };

  const renderCreditTab = () => {
    if (!data) return null;
    return (
      <div className="flex flex-col gap-4">
        {/* Credit Summary */}
        <Section title="Credit Summary">
          <div className="grid grid-cols-2 gap-4">
            <FormRow label="Credit Limit:">
              <RTLInput value={`$${(data.credit || 0).toFixed(2)}`} />
            </FormRow>
            <FormRow label="Balance Due:">
              <RTLInput value={`$${(data.balanceDoe || 0).toFixed(2)}`} />
            </FormRow>
            <FormRow label="Last Payment:">
              <RTLInput value={`$${(data.lastPayment || 0).toFixed(2)}`} />
            </FormRow>
            <FormRow label="Last Cleared:">
              <RTLInput value={data.lastDateCleared ? new Date(data.lastDateCleared).toLocaleDateString() : "N/A"} />
            </FormRow>
          </div>
        </Section>

        {/* Aging Summary */}
        <Section title="Aging Summary">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-center font-medium text-gray-700 dark:text-gray-300 border-b">Current</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-700 dark:text-gray-300 border-b">Over 30</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-700 dark:text-gray-300 border-b">Over 60</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-700 dark:text-gray-300 border-b">Over 90</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-700 dark:text-gray-300 border-b">Over 120</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-700 dark:text-gray-300 border-b border-l-2 border-l-gray-300">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3 text-center font-mono">${(data.current || 0).toFixed(2)}</td>
                  <td className={`px-4 py-3 text-center font-mono ${(data.over30 || 0) > 0 ? "text-yellow-600" : ""}`}>
                    ${(data.over30 || 0).toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-center font-mono ${(data.over60 || 0) > 0 ? "text-orange-600" : ""}`}>
                    ${(data.over60 || 0).toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-center font-mono ${(data.over90 || 0) > 0 ? "text-red-500" : ""}`}>
                    ${(data.over90 || 0).toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-center font-mono ${(data.over120 || 0) > 0 ? "text-red-700 font-bold" : ""}`}>
                    ${(data.over120 || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-bold border-l-2 border-l-gray-300">
                    ${((data.current || 0) + (data.over30 || 0) + (data.over60 || 0) + (data.over90 || 0) + (data.over120 || 0)).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* Credit Status Indicators */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className="text-2xl font-bold text-green-600">${(data.credit || 0).toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">Credit Limit</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className={`text-2xl font-bold ${(data.balanceDoe || 0) > 0 ? "text-red-600" : "text-green-600"}`}>
              ${(data.balanceDoe || 0).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Balance Due</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              ${Math.max(0, (data.credit || 0) - (data.balanceDoe || 0)).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Available Credit</div>
          </div>
        </div>
      </div>
    );
  };

  const renderAddressesTab = () => {
    if (!data) return null;
    return (
      <div className="flex flex-col gap-4">
        <Section title="Primary Address">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <FormRow label="Address:">
                <RTLInput value={data.address || ""} />
              </FormRow>
              <FormRow label="City:">
                <RTLInput value={data.city || ""} />
              </FormRow>
              <FormRow label="State:">
                <RTLInput value={data.state || ""} />
              </FormRow>
            </div>
            <div className="space-y-2">
              <FormRow label="Zip:">
                <RTLInput value={data.zip || ""} />
              </FormRow>
              <FormRow label="Phone:">
                <RTLInput value={data.phone || ""} />
              </FormRow>
              <FormRow label="Cell:">
                <RTLInput value={data.cell || ""} />
              </FormRow>
            </div>
          </div>
        </Section>

        {/* Ship-To Addresses (placeholder for when API provides this data) */}
        <Section title="Ship-To Addresses">
          <div className="border border-gray-200 dark:border-gray-700 rounded overflow-auto max-h-64">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b">Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b">Address</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b">City</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b">State</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b">Zip</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No additional ship-to addresses found.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    );
  };

  const renderNotesTab = () => (
    <div className="flex flex-col h-full gap-4">
      {/* Notes List */}
      <div className="flex-1 border border-gray-200 dark:border-gray-700 rounded overflow-auto max-h-80">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b">Date</th>
              <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b">Note</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700 dark:text-gray-300 border-b w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {notes.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  No notes found for this customer.
                </td>
              </tr>
            ) : (
              notes.map((note, idx) => (
                <tr key={note.noteID || idx} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-2 whitespace-nowrap">
                    {note.dateCreated ? new Date(note.dateCreated).toLocaleDateString() : "N/A"}
                  </td>
                  <td className="px-4 py-2" style={{ direction: isRTL(note.noteValue || "") ? "rtl" : "ltr" }}>
                    {note.noteValue}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleDeleteNote(note.noteID)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Note */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label className="text-sm mb-1">Add Note:</Label>
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            className="w-full h-20 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
            placeholder="Enter note text..."
            style={{ direction: isRTL(newNoteText) ? "rtl" : "ltr" }}
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleAddNote}
          className="h-9"
        >
          Add Note
        </Button>
      </div>
    </div>
  );

  const renderTransactionsTab = () => {
    if (!data) return null;
    return (
      <div className="flex flex-col h-full gap-4">
        {/* Transaction Summary */}
        <Section title="Transaction Summary">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-lg font-bold text-blue-600">${(data.balanceDoe || 0).toFixed(2)}</div>
              <div className="text-xs text-gray-500">Balance</div>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-lg font-bold text-green-600">${(data.lastPayment || 0).toFixed(2)}</div>
              <div className="text-xs text-gray-500">Last Payment</div>
            </div>
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-lg font-bold text-purple-600">
                {data.lastVisit ? new Date(data.lastVisit).toLocaleDateString() : "N/A"}
              </div>
              <div className="text-xs text-gray-500">Last Visit</div>
            </div>
            <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="text-lg font-bold text-orange-600">
                {data.lastDateCleared ? new Date(data.lastDateCleared).toLocaleDateString() : "N/A"}
              </div>
              <div className="text-xs text-gray-500">Last Cleared</div>
            </div>
          </div>
        </Section>

        {/* Transaction History placeholder */}
        <Section title="Recent Transactions">
          <div className="border border-gray-200 dark:border-gray-700 rounded overflow-auto max-h-64">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b">Type</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b">Reference</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300 border-b">Amount</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300 border-b">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Transaction history will be available when the transaction endpoint is connected.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    );
  };

  // ─── Note Handlers ───
  const handleAddNote = useCallback(() => {
    if (!newNoteText.trim()) return;
    const newNote = {
      noteID: `temp-${Date.now()}`,
      noteValue: newNoteText,
      dateCreated: new Date().toISOString(),
    };
    setNotes((prev) => [...prev, newNote]);
    setNewNoteText("");
    showToast("Note added", "success");
  }, [newNoteText, showToast]);

  const handleDeleteNote = useCallback((noteID: string) => {
    setNotes((prev) => prev.filter((n) => n.noteID !== noteID));
    showToast("Note deleted", "info");
  }, [showToast]);

  // ─── Tab Content Router ───
  const renderTabContent = () => {
    switch (activeTab) {
      case "general": return renderGeneralTab();
      case "credit": return renderCreditTab();
      case "addresses": return renderAddressesTab();
      case "notes": return renderNotesTab();
      case "transactions": return renderTransactionsTab();
      default: return null;
    }
  };

  if (isLoading) {
    return <Loader />;
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-4xl mb-4">👤</div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Customer Not Found</h3>
          <p className="text-sm text-gray-500 mt-1">The customer data could not be loaded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-form-page h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Toast */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[300px] max-w-[380px] transition-all duration-300 animate-slide-in">
          <div className="p-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              toast.type === "success" ? "bg-green-100" : toast.type === "error" ? "bg-red-100" : "bg-blue-100"
            }`}>
              {toast.type === "success" && <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>}
              {toast.type === "error" && <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>}
              {toast.type === "info" && <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{toast.message}</span>
            <button onClick={() => setToast({ show: false, message: "", type: "success" })} className="text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white" style={{ direction: isRTL(data.name || "") ? "rtl" : "ltr" }}>
              {data.name || `${data.firstName} ${data.lastName}`}
            </h1>
            <p className="text-xs text-gray-500">
              Customer No: {data.customerNo} | Group: {data.groupName || "N/A"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            data.lockAccount
              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          }`}>
            {data.lockAccount ? "Locked" : "Active"}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
            <span className="ml-1 text-[10px] text-gray-400">({tab.shortcut})</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default CustomerFormPage;
