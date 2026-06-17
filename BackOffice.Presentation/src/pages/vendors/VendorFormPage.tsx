import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTabFormCacheRead, useTabFormCacheWrite } from "../../hooks/useTabFormCache";
import Button from "../../components/ui/button/Button";
import Loader from "../../components/ui/loader/Loader";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import SearchableSelect, { SelectOption } from "../../components/form/SearchableSelect";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import { useAuthHeaders } from "../../hooks/useAuthHeaders";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import { API_ENDPOINTS } from "../../constants/api";
import axios from "axios";

// Props interface for tab-based navigation
interface VendorFormPageProps {
  id?: string;
  mode?: "view" | "edit" | "new";
  /** Injected by DashboardTabContent */
  __tabId?: string;
}

// Tab type definition
type TabKey = "vendor" | "extraInfo" | "notes" | "transactions" | "itemsList";

interface Tab {
  key: TabKey;
  label: string;
  shortcut: string;
}

const TABS: Tab[] = [
  { key: "vendor", label: "Vendor", shortcut: "F2" },
  { key: "extraInfo", label: "Extra Info", shortcut: "F3" },
  { key: "notes", label: "Note", shortcut: "F4" },
  { key: "transactions", label: "Transaction", shortcut: "F5" },
  { key: "itemsList", label: "Items List", shortcut: "F6" },
];

// Form data interface matching SupplierView
interface VendorFormData {
  supplierID: string;
  supplierNo: string;
  name: string;
  defaultCredit: string;
  webSite: string;
  emailAddress: string;
  mainAddress: string;
  contactName: string;
  barterID: string;
  warehouseID: string;
  status: number;
  accountNo: string;
  note: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phoneNumber1: string;
  ext1: string;
  phoneNumber2: string;
  ext2: string;
  phoneNumber3: string; // Cell Phone
  faxNumber: string;
  faxExt: string;
  minMarkup: number;
  buyerID: string;
  listPrice: number;
  department: string;
  import: number;
  supplierNote: string;
}

// Note interface
interface VendorNote {
  noteID: string;
  supplierID: string;
  typeOfNote: number;
  noteValue: string;
  status: number;
  dateCreated: string;
  userCreated: string;
}

// Item interface for Items List tab
interface VendorItem {
  itemID: string;
  name: string;
  upc: string;
  cost: number;
  minQty: number;
  mainSupplier: boolean;
  status: number;
}

// Transaction interface
interface VendorTransaction {
  transactionID: string;
  date: string;
  type: string;
  reference: string;
  amount: number;
  balance: number;
}

// History data interface
interface VendorHistory {
  openPO: number;
  lastReceive: string;
  openBalance: number;
  mtd: number;
  ptd: number;
  ytd: number;
}

const initialFormData: VendorFormData = {
  supplierID: "",
  supplierNo: "",
  name: "",
  defaultCredit: "",
  webSite: "",
  emailAddress: "",
  mainAddress: "",
  contactName: "",
  barterID: "",
  warehouseID: "",
  status: 0,
  accountNo: "",
  note: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
  country: "",
  phoneNumber1: "",
  ext1: "",
  phoneNumber2: "",
  ext2: "",
  phoneNumber3: "",
  faxNumber: "",
  faxExt: "",
  minMarkup: 0,
  buyerID: "",
  listPrice: 0,
  department: "",
  import: 0,
  supplierNote: "",
};

const initialHistory: VendorHistory = {
  openPO: 0,
  lastReceive: "",
  openBalance: 0,
  mtd: 0,
  ptd: 0,
  ytd: 0,
};

// Reusable Section component matching VB.NET GroupBox style
const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
  title,
  children,
  className = "",
}) => (
  <div className={`rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800/50 ${className}`}>
    <div className="px-3 py-1.5 border-b border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">
      <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
    </div>
    <div className="p-3">{children}</div>
  </div>
);

// FormRow component for consistent layout - VB.NET style compact rows
const FormRow: React.FC<{
  label: string;
  children: React.ReactNode;
  labelWidth?: string;
}> = ({ label, children, labelWidth = "100px" }) => (
  <div className="flex items-center gap-2 mb-1.5">
    <span
      className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap"
      style={{ minWidth: labelWidth, width: labelWidth }}
    >
      {label}
    </span>
    <div className="flex-1">{children}</div>
  </div>
);

// Icons
const SaveIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const PrintIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
);

const PreviewIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
  </svg>
);

const DeleteIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

// Navigation Icons matching VB.NET style
const FirstIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.41 16.59L13.82 12l4.59-4.59L17 6l-6 6 6 6 1.41-1.41zM6 6h2v12H6V6z" />
  </svg>
);

const PreviousIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z" />
  </svg>
);

const NextIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
  </svg>
);

const LastIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6-1.41 1.41zM16 6h2v12h-2V6z" />
  </svg>
);

const VendorFormPage: React.FC<VendorFormPageProps> = ({ id, mode = "view", __tabId }) => {
  const { closeTab, activeTabId } = useDashboardTabs();
  const { getAuthHeaders } = useAuthHeaders();

  const isEditMode = mode === "edit" || mode === "new";
  const isNewMode = mode === "new";

  // ── Per-tab cache: survives unmount/remount across tab switches ────────
  // Reads happen BEFORE useState so the initializers can seed from cache.
  // Writes happen AFTER, gated on hasLoadedOnceRef so we don't cache a
  // half-loaded snapshot. Cache is in-memory only — userPreferences untouched.
  interface VendorFormCache {
    formData: VendorFormData;
    savedFormData: VendorFormData | null;
  }
  const { initial: cachedTabState, hasCachedState } =
    useTabFormCacheRead<VendorFormCache>(__tabId);

  const [activeTab, setActiveTab] = useState<TabKey>("vendor");
  const [formData, setFormData] = useState<VendorFormData>(
    () => cachedTabState?.formData ?? initialFormData,
  );
  const [savedFormData, setSavedFormData] = useState<VendorFormData | null>(
    () => cachedTabState?.savedFormData ?? null,
  );
  const hasLoadedOnceRef = useRef(hasCachedState);

  useTabFormCacheWrite<VendorFormCache>(
    __tabId,
    hasLoadedOnceRef.current ? { formData, savedFormData } : null,
  );
  const [history] = useState<VendorHistory>(initialHistory);
  const [notes, setNotes] = useState<VendorNote[]>([]);
  const [items, setItems] = useState<VendorItem[]>([]);
  const [transactions, setTransactions] = useState<VendorTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showInactiveItems, setShowInactiveItems] = useState(false);

  // Transaction filters
  const [transactionScope, setTransactionScope] = useState("all");
  const [transactionFromDate, setTransactionFromDate] = useState("");
  const [transactionToDate, setTransactionToDate] = useState("");

  // Credit/Terms options
  const [creditOptions, setCreditOptions] = useState<SelectOption[]>([]);

  // New note input
  const [newNoteText, setNewNoteText] = useState("");

  // Toast state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({
    show: false,
    message: "",
    type: "success",
  });

  // Show toast notification
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      setToast({ show: true, message, type });
      setTimeout(() => {
        setToast({ show: false, message: "", type: "success" });
      }, 3000);
    },
    []
  );

  // Fetch vendor data
  const fetchVendorData = useCallback(async () => {
    if (!id || isNewMode) return;
    // Cache hit (remount after a tab switch): state already restored from
    // the per-tab cache via useState initializers. Skip the fetch.
    if (hasCachedState) {
      hasLoadedOnceRef.current = true;
      return;
    }

    setIsLoading(true);
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(API_ENDPOINTS.SUPPLIERS.GET_BY_ID(id), { headers });

      if (response.data?.isSuccess && response.data.response) {
        const vendor = response.data.response;
        const loaded: VendorFormData = {
          supplierID: vendor.supplierID || "",
          supplierNo: vendor.supplierNo || "",
          name: vendor.name || "",
          defaultCredit: vendor.defaultCredit || "",
          webSite: vendor.webSite || "",
          emailAddress: vendor.emailAddress || "",
          mainAddress: vendor.mainAddress || "",
          contactName: vendor.contactName || "",
          barterID: vendor.barterID || "",
          warehouseID: vendor.warehouseID || "",
          status: vendor.status || 0,
          accountNo: vendor.accountNo || "",
          note: vendor.note || "",
          address1: vendor.address1 || "",
          address2: vendor.address2 || "",
          city: vendor.city || "",
          state: vendor.state || "",
          zip: vendor.zip || "",
          country: vendor.country || "",
          phoneNumber1: vendor.phoneNumber1 || "",
          ext1: vendor.ext1 || "",
          phoneNumber2: vendor.phoneNumber2 || "",
          ext2: vendor.ext2 || "",
          phoneNumber3: vendor.phoneNumber3 || "",
          faxNumber: vendor.faxNumber || "",
          faxExt: vendor.faxExt || "",
          minMarkup: vendor.minMarkup || 0,
          buyerID: vendor.buyerID || "",
          listPrice: vendor.listPrice || 0,
          department: vendor.department || "",
          import: vendor.import || 0,
          supplierNote: vendor.supplierNote || "",
        };
        setFormData(loaded);
        setSavedFormData(loaded);
      }
    } catch (error) {
      console.error("Error fetching vendor:", error);
      showToast("Failed to load vendor data", "error");
    } finally {
      setIsLoading(false);
      hasLoadedOnceRef.current = true;
    }
  }, [id, isNewMode, hasCachedState, getAuthHeaders, showToast]);

  // Fetch credit terms options
  const fetchCreditOptions = useCallback(async () => {
    try {
      // TODO: Implement credit terms endpoint when available
      setCreditOptions([
        { value: "", label: "Select Terms" },
        { value: "net30", label: "Net 30" },
        { value: "net60", label: "Net 60" },
        { value: "net90", label: "Net 90" },
        { value: "cod", label: "COD" },
      ]);
    } catch (error) {
      console.error("Error fetching credit options:", error);
    }
  }, []);

  // Fetch vendor items
  const fetchVendorItems = useCallback(async () => {
    if (!id) return;

    try {
      const headers = getAuthHeaders();
      const response = await axios.get(API_ENDPOINTS.SUPPLIERS.GET_ITEMS(id), { headers });

      if (response.data?.isSuccess && response.data.response) {
        setItems(response.data.response);
      }
    } catch (error) {
      console.error("Error fetching vendor items:", error);
      // Set mock data for demo
      setItems([
        { itemID: "1", name: "Sample Item 1", upc: "123456789012", cost: 10.99, minQty: 5, mainSupplier: true, status: 0 },
        { itemID: "2", name: "Sample Item 2", upc: "234567890123", cost: 25.50, minQty: 10, mainSupplier: false, status: 0 },
      ]);
    }
  }, [id, getAuthHeaders]);

  // Initial data fetch
  useEffect(() => {
    fetchVendorData();
    fetchCreditOptions();
  }, [fetchVendorData, fetchCreditOptions]);

  // Seed baseline for new-mode vendors (no fetch path to populate it).
  // Also flip hasLoadedOnceRef so cache writes begin capturing the user's
  // edits on new tabs (the fetch path normally flips this in its finally).
  useEffect(() => {
    if (isNewMode && !hasCachedState) {
      setSavedFormData(initialFormData);
      hasLoadedOnceRef.current = true;
    }
  }, [isNewMode, hasCachedState]);

  // Fetch notes from API
  const fetchVendorNotes = useCallback(async () => {
    if (!id) return;
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(API_ENDPOINTS.SUPPLIERS.GET_NOTES(id), { headers });
      if (response.data?.isSuccess && response.data.response) {
        setNotes(response.data.response);
      }
    } catch (error) {
      console.error("Error fetching vendor notes:", error);
    }
  }, [id, getAuthHeaders]);

  // Fetch transactions from API
  const fetchVendorTransactions = useCallback(async () => {
    if (!id) return;
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(API_ENDPOINTS.SUPPLIERS.GET_TRANSACTIONS(id), {
        headers,
        params: {
          scope: transactionScope !== "all" ? transactionScope : undefined,
          fromDate: transactionFromDate || undefined,
          toDate: transactionToDate || undefined,
        },
      });
      if (response.data?.isSuccess && response.data.response) {
        setTransactions(response.data.response);
      }
    } catch (error) {
      console.error("Error fetching vendor transactions:", error);
    }
  }, [id, getAuthHeaders, transactionScope, transactionFromDate, transactionToDate]);

  // Fetch items when switching to Items List tab
  useEffect(() => {
    if (activeTab === "itemsList") {
      fetchVendorItems();
    }
    if (activeTab === "notes" && id) {
      fetchVendorNotes();
    }
    if (activeTab === "transactions" && id) {
      fetchVendorTransactions();
    }
  }, [activeTab, fetchVendorItems, fetchVendorNotes, fetchVendorTransactions, id]);

  // Handle keyboard shortcuts for tab switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setActiveTab("vendor");
      } else if (e.key === "F3") {
        e.preventDefault();
        setActiveTab("extraInfo");
      } else if (e.key === "F4") {
        e.preventDefault();
        setActiveTab("notes");
      } else if (e.key === "F5") {
        e.preventDefault();
        setActiveTab("transactions");
      } else if (e.key === "F6") {
        e.preventDefault();
        setActiveTab("itemsList");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle form field changes
  const handleInputChange = useCallback((field: keyof VendorFormData, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // Handle save
  const handleSave = useCallback(async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      const headers = getAuthHeaders();

      if (isNewMode) {
        // Create new vendor
        await axios.post(API_ENDPOINTS.SUPPLIERS.CREATE, formData, { headers });
        showToast("Vendor created successfully!", "success");
      } else {
        // Update existing vendor
        await axios.put(API_ENDPOINTS.SUPPLIERS.UPDATE(id!), formData, { headers });
        showToast("Vendor updated successfully!", "success");
      }

      setSavedFormData(formData);
      // Close the tab after successful save
      if (activeTabId) {
        closeTab(activeTabId);
      }
      return true;
    } catch (error) {
      console.error("Error saving vendor:", error);
      showToast("Failed to save vendor", "error");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [formData, id, isNewMode, getAuthHeaders, showToast, activeTabId, closeTab]);

  useUnsavedChanges<VendorFormData>({
    tabId: __tabId,
    formData,
    initialSnapshot: savedFormData,
    saveHandler: async () => {
      const ok = await handleSave();
      if (!ok) throw new Error("Could not save vendor. Please fix any validation errors and try again.");
    },
  });

  // Handle close
  const handleClose = useCallback(() => {
    if (activeTabId) {
      closeTab(activeTabId);
    }
  }, [activeTabId, closeTab]);

  // Navigation handlers (placeholder for now)
  const handleFirst = useCallback(() => {
    // TODO: Implement navigation to first vendor
    showToast("Navigate to first vendor", "info");
  }, [showToast]);

  const handlePrevious = useCallback(() => {
    // TODO: Implement navigation to previous vendor
    showToast("Navigate to previous vendor", "info");
  }, [showToast]);

  const handleNext = useCallback(() => {
    // TODO: Implement navigation to next vendor
    showToast("Navigate to next vendor", "info");
  }, [showToast]);

  const handleLast = useCallback(() => {
    // TODO: Implement navigation to last vendor
    showToast("Navigate to last vendor", "info");
  }, [showToast]);

  // Handle add note
  const handleAddNote = useCallback(async () => {
    if (!newNoteText.trim() || !id) return;
    try {
      const headers = getAuthHeaders();
      const response = await axios.post(API_ENDPOINTS.SUPPLIERS.ADD_NOTE(id), {
        noteValue: newNoteText,
        typeOfNote: 1,
      }, { headers });
      if (response.data?.isSuccess) {
        setNewNoteText("");
        showToast("Note added", "success");
        fetchVendorNotes();
      } else {
        showToast("Failed to add note", "error");
      }
    } catch (error) {
      console.error("Error adding note:", error);
      // Fallback: add locally
      const newNote: VendorNote = {
        noteID: `temp-${Date.now()}`,
        supplierID: id || "",
        typeOfNote: 1,
        noteValue: newNoteText,
        status: 0,
        dateCreated: new Date().toISOString(),
        userCreated: "",
      };
      setNotes((prev) => [...prev, newNote]);
      setNewNoteText("");
      showToast("Note added locally", "info");
    }
  }, [newNoteText, id, showToast, getAuthHeaders, fetchVendorNotes]);

  // Handle delete note
  const handleDeleteNote = useCallback(async (noteID: string) => {
    if (!id) return;
    try {
      const headers = getAuthHeaders();
      await axios.delete(API_ENDPOINTS.SUPPLIERS.DELETE_NOTE(id, noteID), { headers });
      showToast("Note deleted", "success");
      fetchVendorNotes();
    } catch (error) {
      console.error("Error deleting note:", error);
      // Fallback: remove locally
      setNotes((prev) => prev.filter((n) => n.noteID !== noteID));
      showToast("Note removed locally", "info");
    }
  }, [id, showToast, getAuthHeaders, fetchVendorNotes]);

  // Filter items by inactive status
  const filteredItems = useMemo(() => {
    if (showInactiveItems) {
      return items;
    }
    return items.filter((item) => item.status === 0);
  }, [items, showInactiveItems]);

  // Render Tab 1: Vendor (Address & Contact Info) - Matching VB.NET FrmSupplier layout
  const renderVendorTab = () => (
    <div className="flex flex-col gap-4">
      {/* Top Row: Address (left) and Contact Info (right) */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left Column - Address Section */}
        <Section title="Address">
          <FormRow label="Line 1:" labelWidth="80px">
            <Input
              type="text"
              value={formData.address1}
              onChange={(e) => handleInputChange("address1", (e.target as HTMLInputElement).value)}
              disabled={!isEditMode}
              className="h-7 text-sm"
            />
          </FormRow>
          <FormRow label="Line 2:" labelWidth="80px">
            <Input
              type="text"
              value={formData.address2}
              onChange={(e) => handleInputChange("address2", (e.target as HTMLInputElement).value)}
              disabled={!isEditMode}
              className="h-7 text-sm"
            />
          </FormRow>
          <FormRow label="City:" labelWidth="80px">
            <Input
              type="text"
              value={formData.city}
              onChange={(e) => handleInputChange("city", (e.target as HTMLInputElement).value)}
              disabled={!isEditMode}
              className="h-7 text-sm"
            />
          </FormRow>
          <FormRow label="State:" labelWidth="80px">
            <Input
              type="text"
              value={formData.state}
              onChange={(e) => handleInputChange("state", (e.target as HTMLInputElement).value)}
              disabled={!isEditMode}
              className="h-7 text-sm"
            />
          </FormRow>
          <FormRow label="Zip:" labelWidth="80px">
            <Input
              type="text"
              value={formData.zip}
              onChange={(e) => handleInputChange("zip", (e.target as HTMLInputElement).value)}
              disabled={!isEditMode}
              className="h-7 text-sm"
            />
          </FormRow>
          <FormRow label="Country:" labelWidth="80px">
            <Input
              type="text"
              value={formData.country}
              onChange={(e) => handleInputChange("country", (e.target as HTMLInputElement).value)}
              disabled={!isEditMode}
              className="h-7 text-sm"
            />
          </FormRow>
        </Section>

        {/* Right Column - Contact Info Section */}
        <Section title="Contact Info">
          <FormRow label="Phone Number:" labelWidth="100px">
            <div className="flex gap-2">
              <Input
                type="text"
                value={formData.phoneNumber1}
                onChange={(e) => handleInputChange("phoneNumber1", (e.target as HTMLInputElement).value)}
                disabled={!isEditMode}
                className="h-7 text-sm flex-1"
              />
              <span className="text-xs text-gray-500 self-center">Ext:</span>
              <Input
                type="text"
                value={formData.ext1}
                onChange={(e) => handleInputChange("ext1", (e.target as HTMLInputElement).value)}
                disabled={!isEditMode}
                className="h-7 text-sm w-16"
              />
            </div>
          </FormRow>
          <FormRow label="Phone Number2:" labelWidth="100px">
            <div className="flex gap-2">
              <Input
                type="text"
                value={formData.phoneNumber2}
                onChange={(e) => handleInputChange("phoneNumber2", (e.target as HTMLInputElement).value)}
                disabled={!isEditMode}
                className="h-7 text-sm flex-1"
              />
              <span className="text-xs text-gray-500 self-center">Ext:</span>
              <Input
                type="text"
                value={formData.ext2}
                onChange={(e) => handleInputChange("ext2", (e.target as HTMLInputElement).value)}
                disabled={!isEditMode}
                className="h-7 text-sm w-16"
              />
            </div>
          </FormRow>
          <FormRow label="Cell Phone No:" labelWidth="100px">
            <Input
              type="text"
              value={formData.phoneNumber3}
              onChange={(e) => handleInputChange("phoneNumber3", (e.target as HTMLInputElement).value)}
              disabled={!isEditMode}
              className="h-7 text-sm"
            />
          </FormRow>
          <FormRow label="Fax Number:" labelWidth="100px">
            <div className="flex gap-2">
              <Input
                type="text"
                value={formData.faxNumber}
                onChange={(e) => handleInputChange("faxNumber", (e.target as HTMLInputElement).value)}
                disabled={!isEditMode}
                className="h-7 text-sm flex-1"
              />
              <span className="text-xs text-gray-500 self-center">Ext:</span>
              <Input
                type="text"
                value={formData.faxExt}
                onChange={(e) => handleInputChange("faxExt", (e.target as HTMLInputElement).value)}
                disabled={!isEditMode}
                className="h-7 text-sm w-16"
              />
            </div>
          </FormRow>
          <FormRow label="Web Site:" labelWidth="100px">
            <Input
              type="text"
              value={formData.webSite}
              onChange={(e) => handleInputChange("webSite", (e.target as HTMLInputElement).value)}
              disabled={!isEditMode}
              className="h-7 text-sm"
            />
          </FormRow>
          <FormRow label="Email:" labelWidth="100px">
            <Input
              type="email"
              value={formData.emailAddress}
              onChange={(e) => handleInputChange("emailAddress", (e.target as HTMLInputElement).value)}
              disabled={!isEditMode}
              className="h-7 text-sm"
            />
          </FormRow>
        </Section>
      </div>

      {/* Bottom Row: Contact Section */}
      <div className="grid grid-cols-2 gap-4">
        <Section title="Contact">
          <FormRow label="Contact Name:" labelWidth="100px">
            <Input
              type="text"
              value={formData.contactName}
              onChange={(e) => handleInputChange("contactName", (e.target as HTMLInputElement).value)}
              disabled={!isEditMode}
              className="h-7 text-sm"
            />
          </FormRow>
          <FormRow label="Account #:" labelWidth="100px">
            <Input
              type="text"
              value={formData.accountNo}
              onChange={(e) => handleInputChange("accountNo", (e.target as HTMLInputElement).value)}
              disabled={!isEditMode}
              className="h-7 text-sm"
            />
          </FormRow>
        </Section>
        {/* Empty right column to match VB.NET layout */}
        <div></div>
      </div>
    </div>
  );

  // Render Tab 2: Extra Info (History & Terms)
  const renderExtraInfoTab = () => (
    <div className="grid grid-cols-2 gap-4">
      {/* Left Column - History Section */}
      <Section title="History">
        <FormRow label="Open P.O:" labelWidth="90px">
          <Input
            type="text"
            value={history.openPO.toFixed(2)}
            disabled
            className="h-7 text-sm bg-gray-50"
          />
        </FormRow>
        <FormRow label="Last Receive:" labelWidth="90px">
          <Input
            type="text"
            value={history.lastReceive}
            disabled
            className="h-7 text-sm bg-gray-50"
          />
        </FormRow>
        <FormRow label="Open Balance:" labelWidth="90px">
          <Input
            type="text"
            value={history.openBalance.toFixed(2)}
            disabled
            className="h-7 text-sm bg-gray-50"
          />
        </FormRow>
        <FormRow label="MTD:" labelWidth="90px">
          <Input
            type="text"
            value={history.mtd.toFixed(2)}
            disabled
            className="h-7 text-sm bg-gray-50"
          />
        </FormRow>
        <FormRow label="PTD:" labelWidth="90px">
          <Input
            type="text"
            value={history.ptd.toFixed(2)}
            disabled
            className="h-7 text-sm bg-gray-50"
          />
        </FormRow>
        <FormRow label="YTD:" labelWidth="90px">
          <Input
            type="text"
            value={history.ytd.toFixed(2)}
            disabled
            className="h-7 text-sm bg-gray-50"
          />
        </FormRow>
      </Section>

      {/* Right Column - Terms Section */}
      <Section title="Terms">
        <FormRow label="Credit Terms:" labelWidth="90px">
          <SearchableSelect
            options={creditOptions}
            value={formData.defaultCredit}
            onChange={(value) => handleInputChange("defaultCredit", value)}
            placeholder="Select terms..."
            disabled={!isEditMode}
          />
        </FormRow>
        <FormRow label="Min Markup %:" labelWidth="90px">
          <Input
            type="number"
            value={formData.minMarkup}
            onChange={(e) => handleInputChange("minMarkup", parseFloat((e.target as HTMLInputElement).value) || 0)}
            disabled={!isEditMode}
            className="h-7 text-sm"
          />
        </FormRow>
        <FormRow label="List Price:" labelWidth="90px">
          <Input
            type="number"
            value={formData.listPrice}
            onChange={(e) => handleInputChange("listPrice", parseFloat((e.target as HTMLInputElement).value) || 0)}
            disabled={!isEditMode}
            className="h-7 text-sm"
          />
        </FormRow>
      </Section>
    </div>
  );

  // Render Tab 3: Notes
  const renderNotesTab = () => (
    <div className="flex flex-col h-full">
      {/* Notes Grid */}
      <div className="flex-1 border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b">Note</th>
              <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b w-40">Date</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700 dark:text-gray-300 border-b w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {notes.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  No notes found. Add a new note below.
                </td>
              </tr>
            ) : (
              notes.map((note) => (
                <tr key={note.noteID} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-2">{note.noteValue}</td>
                  <td className="px-4 py-2">
                    {new Date(note.dateCreated).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {isEditMode && (
                      <button
                        onClick={() => handleDeleteNote(note.noteID)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                        title="Delete note"
                      >
                        <DeleteIcon />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Note Input */}
      {isEditMode && (
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Enter new note..."
            className="flex-1 h-8 px-3 text-sm border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAddNote();
              }
            }}
          />
          <Button onClick={handleAddNote} size="sm" className="h-8">
            <PlusIcon />
            <span className="ml-1">Add Note</span>
          </Button>
        </div>
      )}
    </div>
  );

  // Render Tab 4: Transactions
  const renderTransactionsTab = () => (
    <div className="flex flex-col h-full">
      {/* Filter Controls */}
      <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Scope:</Label>
          <select
            value={transactionScope}
            onChange={(e) => setTransactionScope(e.target.value)}
            className="h-7 px-2 text-sm border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="all">All</option>
            <option value="po">Purchase Orders</option>
            <option value="receive">Receives</option>
            <option value="payment">Payments</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">From:</Label>
          <Input
            type="date"
            value={transactionFromDate}
            onChange={(e) => setTransactionFromDate((e.target as HTMLInputElement).value)}
            className="h-7 text-sm w-36"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">To:</Label>
          <Input
            type="date"
            value={transactionToDate}
            onChange={(e) => setTransactionToDate((e.target as HTMLInputElement).value)}
            className="h-7 text-sm w-36"
          />
        </div>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" className="h-7">
            <PrintIcon />
            <span className="ml-1">Print</span>
          </Button>
          <Button variant="outline" size="sm" className="h-7">
            <PreviewIcon />
            <span className="ml-1">Preview</span>
          </Button>
        </div>
      </div>

      {/* Transactions Grid */}
      <div className="flex-1 border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b">Date</th>
              <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b">Type</th>
              <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b">Reference</th>
              <th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300 border-b">Amount</th>
              <th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300 border-b">Balance</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No transactions found for the selected criteria.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.transactionID} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-2">{new Date(tx.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{tx.type}</td>
                  <td className="px-4 py-2">{tx.reference}</td>
                  <td className="px-4 py-2 text-right">${tx.amount.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">${tx.balance.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Render Tab 5: Items List
  const renderItemsListTab = () => (
    <div className="flex flex-col h-full">
      {/* Filter Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showInactive"
            checked={showInactiveItems}
            onChange={(e) => setShowInactiveItems(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <label htmlFor="showInactive" className="text-sm text-gray-700 dark:text-gray-300">
            Show Inactive
          </label>
        </div>
        <div className="text-sm text-gray-500">
          {filteredItems.length} item(s)
        </div>
      </div>

      {/* Items Grid */}
      <div className="flex-1 border border-gray-200 dark:border-gray-700 rounded overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b">Name</th>
              <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border-b">UPC</th>
              <th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300 border-b">Cost</th>
              <th className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300 border-b">Min Qty</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700 dark:text-gray-300 border-b">Main Vendor</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No items found for this vendor.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr
                  key={item.itemID}
                  className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                    item.status !== 0 ? "text-gray-400" : ""
                  }`}
                >
                  <td className="px-4 py-2">{item.name}</td>
                  <td className="px-4 py-2">{item.upc}</td>
                  <td className="px-4 py-2 text-right">${item.cost.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">{item.minQty}</td>
                  <td className="px-4 py-2 text-center">
                    {item.mainSupplier ? (
                      <span className="text-green-600">Yes</span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Render active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case "vendor":
        return renderVendorTab();
      case "extraInfo":
        return renderExtraInfoTab();
      case "notes":
        return renderNotesTab();
      case "transactions":
        return renderTransactionsTab();
      case "itemsList":
        return renderItemsListTab();
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <Loader />
    );
  }

  return (
    <div className="vendor-form-page h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[300px] p-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                toast.type === "success"
                  ? "bg-green-100 text-green-600"
                  : toast.type === "error"
                  ? "bg-red-100 text-red-600"
                  : "bg-brand-50 text-brand-500"
              }`}
            >
              {toast.type === "success" && <SaveIcon />}
              {toast.type === "error" && <CloseIcon />}
              {toast.type === "info" && <PreviewIcon />}
            </div>
            <p className="text-sm text-gray-700">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Header Row with Vendor Name and Vendor No - Matching VB.NET style */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Vendor Name:</span>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", (e.target as HTMLInputElement).value)}
              disabled={!isEditMode}
              className="h-8 text-sm w-80"
              placeholder="Enter vendor name"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Vendor No.</span>
            <Input
              type="text"
              value={formData.supplierNo}
              onChange={(e) => handleInputChange("supplierNo", (e.target as HTMLInputElement).value)}
              disabled={!isEditMode}
              className="h-8 text-sm w-32"
              placeholder="Auto"
            />
          </div>
          {formData.status === 1 && (
            <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
              Inactive
            </span>
          )}
          {/* Save button in header for edit mode */}
          {isEditMode && (
            <div className="ml-auto">
              <Button onClick={handleSave} disabled={isSaving} size="sm" className="h-8">
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <SaveIcon />
                    <span className="ml-1">Save</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation - Matching VB.NET XtraTab style */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-brand-500 text-brand-500 dark:text-brand-400 bg-gray-50 dark:bg-gray-700"
                  : "border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {tab.label} <span className="text-xs text-gray-400 ml-1">{tab.shortcut}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {renderTabContent()}
      </div>

      {/* Footer with Navigation and Close buttons - Matching VB.NET style */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between">
        {/* Navigation Buttons (Left side) */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleFirst}
            disabled={isNewMode}
            className="p-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="First"
          >
            <FirstIcon />
          </button>
          <button
            onClick={handlePrevious}
            disabled={isNewMode}
            className="p-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Previous"
          >
            <PreviousIcon />
          </button>
          <button
            onClick={handleNext}
            disabled={isNewMode}
            className="p-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Next"
          >
            <NextIcon />
          </button>
          <button
            onClick={handleLast}
            disabled={isNewMode}
            className="p-1.5 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Last"
          >
            <LastIcon />
          </button>
        </div>

        {/* Close Button (Right side) */}
        <Button variant="outline" onClick={handleClose} size="sm" className="h-8">
          <CloseIcon />
          <span className="ml-1">Close</span>
        </Button>
      </div>
    </div>
  );
};

export default VendorFormPage;
