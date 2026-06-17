import React, { useState, memo, useCallback, useRef, useMemo } from "react";
import ServerGrid from "../../components/common/ServerGrid/ServerGrid";
import { useAuthHeaders } from "../../hooks/useAuthHeaders";
import { API_ENDPOINTS } from "../../constants/api";
import {
  convertToGridColumns,
  cellRenderers,
  GridColDef,
} from "../../gridUtils";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../../components/ui/modal";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import ActionHeader from "../../components/common/ActionHeader";
import { useExportHandlers } from "../../hooks/useExportHandlers";
import { useExportModal } from "../../hooks/useExportModal"
import ExportModal from "../../components/common/ExportModal"
import { useGridSettings } from "../../hooks/useGridSettings";
import { useDashboardTabs } from "../../context/DashboardTabContext";
import { CustomContextMenuItem } from "../../components/common/ServerGrid/components/GridBody";
import axios from "axios";
import { useConfirm } from '../../components/ui/ConfirmModal';

// Vendor/Supplier record interface (based on SupplierView)
interface VendorRecord {
  supplierID: string;
  supplierNo: string | null;
  name: string | null;
  defaultCredit: string | null;
  webSite: string | null;
  emailAddress: string | null;
  mainAddress: string | null;
  contactName: string;
  barterID: string | null;
  warehouseID: string | null;
  status: number | null;
  dateCreated: string | null;
  userCreated: string | null;
  dateModified: string | null;
  userModified: string | null;
  accountNo: string | null;
  note: string | null;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  phoneNumber1: string;
  ext1: string | null;
  phoneNumber2: string;
  phoneNumber3: string;
  minMarkup: number;
  buyerID: string | null;
  listPrice: number | null;
  department: string | null;
  import: number | null;
  supplierNote: string | null;
}

// Column definitions for vendors (mapped to SupplierView)
const vendorsColumnDefs: GridColDef[] = [
  {
    field: "supplierNo",
    headerName: "Vendor ID",
    width: 100,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "name",
    headerName: "Vendor Name",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "emailAddress",
    headerName: "Contact Email",
    width: 200,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "phoneNumber1",
    headerName: "Phone",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "accountNo",
    headerName: "Vendor Code",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "dateCreated",
    headerName: "Date Added",
    width: 180,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "dateModified",
    headerName: "Last Modified",
    width: 180,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "contactName",
    headerName: "Contact Name",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "webSite",
    headerName: "Website",
    width: 180,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "address1",
    headerName: "Address",
    width: 200,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "city",
    headerName: "City",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "state",
    headerName: "State",
    width: 80,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "zip",
    headerName: "Zip",
    width: 100,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "phoneNumber2",
    headerName: "Phone 2",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "phoneNumber3",
    headerName: "Fax",
    width: 130,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "minMarkup",
    headerName: "Min Markup",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) =>
      value ? `${Number(value).toFixed(2)}%` : "0%",
  },
  {
    field: "status",
    headerName: "Status",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) => {
      const isActive = value === 0 || value === null;
      return (
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            backgroundColor: isActive ? "#dcfce7" : "#fee2e2",
            color: isActive ? "#166534" : "#991b1b",
          }}
        >
          {isActive ? "Active" : "Inactive"}
        </span>
      );
    },
  },
  {
    field: "note",
    headerName: "Note",
    width: 200,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "supplierID",
    headerName: "Supplier ID",
    width: 280,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "sendQuoteRequest",
    headerName: "Send Quote Request",
    width: 130,
    sortable: false,
    filterable: false,
    editable: false,
    cellRenderer: (_value: any, row: any) => {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if ((window as any).showVendorToast) {
              const vendorEmail = row?.emailAddress || "this vendor";
              (window as any).showVendorToast(
                `Quote request sent to ${vendorEmail} successfully!`,
                "success",
              );
            }
            console.log("Send quote request clicked for:", row);
          }}
          style={{
            padding: "6px 8px",
            backgroundColor: "transparent",
            color: "#333",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "400",
            transition: "all 0.2s ease",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#f8f9fa";
            e.currentTarget.style.color = "#333";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "#333";
          }}
          title="Send quote request"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          Quote Request
        </button>
      );
    },
  },
];

// Grid ID for settings persistence
const VENDORS_GRID_ID = "vendors-list-grid";

const VendorListPage = memo(function VendorListPage() {
  const { getAuthHeaders } = useAuthHeaders();
  const { isOpen, openModal, closeModal } = useModal();
  const { openTab } = useDashboardTabs();
  const { confirm, ConfirmDialog } = useConfirm();

  // State for search functionality
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");

  // State for bulk selection
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [totalRecords, setTotalRecords] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [remountKey, setRemountKey] = useState(0);

  // Refs for page navigation callbacks from ServerGrid
  const pageNavigationRef = React.useRef<{
    goToFirstPage: () => void
    goToPreviousPage: () => void
    goToNextPage: () => void
    goToLastPage: () => void
  } | null>(null);

  // Store reference to ServerGrid's select all function
  const serverGridSelectAllRef = React.useRef<(() => void) | null>(null);

  // Form state for new vendor
  const [newVendorData, setNewVendorData] = useState({
    name: "",
    supplierNo: "",
    contactName: "",
    emailAddress: "",
    phoneNumber1: "",
    phoneNumber2: "",
    phoneNumber3: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    accountNo: "",
    webSite: "",
    minMarkup: "",
    note: "",
  });

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({
    show: false,
    message: "",
    type: "success",
  });

  // Ref to store grid data from ServerGrid
  const gridDataRef = useRef<any[]>([]);

  // Memoize auth headers to prevent re-creation
  const memoizedGetAuthHeaders = useCallback(() => {
    return getAuthHeaders();
  }, [getAuthHeaders]);

  // Convert column definitions to grid format
  const defaultColumns = useMemo(() => convertToGridColumns(vendorsColumnDefs), []);

  // Use grid settings hook for column visibility, width, and aggregate persistence
  const {
    columns,
    setColumns,
    updateColumnVisibility,
    updateColumnWidth,
    columnAggregates,
    updateColumnAggregate,
  } = useGridSettings(VENDORS_GRID_ID, defaultColumns);

  // Handle column changes from grid for persistence
  const handleColumnsChange = useCallback((newColumns: any[]) => {
    setColumns(newColumns);
  }, [setColumns]);

  // Debounce search input
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchText]);

  // Create API search parameters
  const additionalParams = useMemo(() => {
    const params: Record<string, string> = {};

    if (debouncedSearchText.trim()) {
      params.CustomGridSearchText = debouncedSearchText.trim();
      params.CustomGridSearchColumns = "name,supplierNo,contactName,emailAddress";
    }

    return params;
  }, [debouncedSearchText]);

  // Handle search input change
  const handleSearchInputChange = useCallback((value: string) => {
    setSearchText(value);
  }, []);

  // Handle search on Enter key press
  const handleSearchKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        setDebouncedSearchText(searchText);
      }
    },
    [searchText],
  );

  // Toast notification function
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      setToast({ show: true, message, type });
      setTimeout(() => {
        setToast({ show: false, message: "", type: "success" });
      }, 3000);
    },
    [],
  );

  // Make toast function globally accessible for the cellRenderer
  React.useEffect(() => {
    (window as any).showVendorToast = showToast;
    return () => {
      delete (window as any).showVendorToast;
    };
  }, [showToast]);

  // Context Menu Handlers
  const handleOpenVendor = useCallback((row: VendorRecord) => {
    openTab({
      component: "VendorFormPage",
      title: `Vendor: ${row.name || "Details"}`,
      closable: true,
      props: { id: row.supplierID, mode: "view" },
    });
  }, [openTab]);

  const handleNewVendor = useCallback(() => {
    openTab({
      component: "VendorFormPage",
      title: "New Vendor",
      closable: true,
      props: { mode: "new" },
    });
  }, [openTab]);

  const handleEditVendor = useCallback((row: VendorRecord) => {
    openTab({
      component: "VendorFormPage",
      title: `Edit: ${row.name || "Vendor"}`,
      closable: true,
      props: { id: row.supplierID, mode: "edit" },
    });
  }, [openTab]);

  const handleDeleteVendor = useCallback(async (row: VendorRecord) => {
    const confirmed = await confirm({
      title: 'Delete Vendor',
      message: `Are you sure you want to delete vendor "${row.name}"? This action cannot be undone.`,
      variant: 'danger',
    });
    if (confirmed) {
      console.log("Delete vendor:", row.supplierID);
      showToast(`Vendor "${row.name}" deleted successfully!`, "success");
    }
  }, [showToast, confirm]);

  const handleOpenPO = useCallback((row: VendorRecord) => {
    openTab({
      component: "PurchaseOrderPage",
      title: `PO - ${row.name || "Vendor"}`,
      closable: true,
      props: { supplierId: row.supplierID, supplierName: row.name },
    });
  }, [openTab]);

  const handleVendorItems = useCallback((row: VendorRecord) => {
    openTab({
      component: "VendorItemsPage",
      title: `Items - ${row.name || "Vendor"}`,
      closable: true,
      props: { supplierId: row.supplierID, supplierName: row.name },
    });
  }, [openTab]);

  const handleMergeVendor = useCallback((row: VendorRecord) => {
    openTab({
      component: "MergeVendorPage",
      title: `Merge: ${row.name || "Vendor"}`,
      closable: true,
      props: { supplierId: row.supplierID, supplierName: row.name },
    });
  }, [openTab]);

  const handleSalesReport = useCallback((row: VendorRecord) => {
    openTab({
      component: "VendorSalesReportPage",
      title: `Sales Report - ${row.name || "Vendor"}`,
      closable: true,
      props: { supplierId: row.supplierID, supplierName: row.name },
    });
  }, [openTab]);

  const handleToggleInactive = useCallback((row: VendorRecord) => {
    const isCurrentlyActive = row.status === 0 || row.status === null;
    const newStatus = isCurrentlyActive ? "inactive" : "active";
    console.log(`Set vendor ${row.supplierID} to ${newStatus}`);
    showToast(
      `Vendor "${row.name}" marked as ${newStatus}!`,
      "success"
    );
  }, [showToast]);

  // Custom context menu items
  const customContextMenuItems: CustomContextMenuItem[] = useMemo(() => [
    {
      label: "Open",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      ),
      onClick: handleOpenVendor,
    },
    {
      label: "New",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
      onClick: () => handleNewVendor(),
    },
    {
      label: "Edit",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      onClick: handleEditVendor,
    },
    {
      label: "Delete",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      ),
      onClick: handleDeleteVendor,
      color: "#dc2626",
      dividerBefore: true,
    },
    {
      label: "Open PO",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      onClick: handleOpenPO,
      dividerBefore: true,
    },
    {
      label: "Vendor's Items",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      ),
      onClick: handleVendorItems,
    },
    {
      label: "Merge Supplier",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 3 21 3 21 8" />
          <line x1="4" y1="20" x2="21" y2="3" />
          <polyline points="21 16 21 21 16 21" />
          <line x1="15" y1="15" x2="21" y2="21" />
          <line x1="4" y1="4" x2="9" y2="9" />
        </svg>
      ),
      onClick: handleMergeVendor,
      dividerBefore: true,
    },
    {
      label: "Sales Report",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
      onClick: handleSalesReport,
    },
    {
      label: "Inactive",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      ),
      onClick: handleToggleInactive,
      dividerBefore: true,
    },
  ], [
    handleOpenVendor,
    handleNewVendor,
    handleEditVendor,
    handleDeleteVendor,
    handleOpenPO,
    handleVendorItems,
    handleMergeVendor,
    handleSalesReport,
    handleToggleInactive,
  ]);

  // Handle row updates (double-click to edit)
  const handleRowUpdate = useCallback(async (updatedRow: VendorRecord) => {
    openTab({
      component: "VendorFormPage",
      title: `Edit: ${updatedRow.name || "Vendor"}`,
      closable: true,
      props: { id: updatedRow.supplierID, mode: "edit" },
    });
  }, [openTab]);

  // Handle checkbox selection using supplierID as the primary identifier
  const handleRowSelection = useCallback((supplierID: string) => {
    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = new Set(prevSelectedRows);
      if (newSelectedRows.has(supplierID)) {
        newSelectedRows.delete(supplierID);
      } else {
        newSelectedRows.add(supplierID);
      }
      return newSelectedRows;
    });
  }, []);

  // Handle input changes for new vendor form
  const handleInputChange = useCallback((field: string, value: string) => {
    setNewVendorData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // Handle saving new vendor
  const handleSaveVendor = useCallback(() => {
    console.log("Creating new vendor:", newVendorData);
    closeModal();
    showToast("Vendor has been created successfully!", "success");
  }, [newVendorData, closeModal, showToast]);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setNewVendorData({
      name: "",
      supplierNo: "",
      contactName: "",
      emailAddress: "",
      phoneNumber1: "",
      phoneNumber2: "",
      phoneNumber3: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      zip: "",
      accountNo: "",
      webSite: "",
      minMarkup: "",
      note: "",
    });
    closeModal();
  }, [closeModal]);

  // Bulk operation handlers
  const handleDeselectAll = useCallback(() => {
    setSelectedRows(new Set());
    showToast("Deselected all vendors", "info");
  }, [showToast]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedRows.size === 0) return;

    const confirmed = await confirm({
      title: 'Delete Selected Vendors',
      message: `Are you sure you want to delete ${selectedRows.size} selected vendors? This action cannot be undone.`,
      variant: 'danger',
    });

    if (confirmed) {
      console.log("Bulk delete vendors:", Array.from(selectedRows));
      setSelectedRows(new Set());
      showToast(`${selectedRows.size} vendors have been deleted successfully!`, "success");
    }
  }, [selectedRows, showToast, confirm]);

  const handleBulkExport = useCallback(() => {
    if (selectedRows.size === 0) return;
    console.log("Bulk export vendors:", Array.from(selectedRows));
    showToast(`Exporting ${selectedRows.size} vendors to CSV`, "success");
  }, [selectedRows, showToast]);

  // Fetch all data for export/print
  const fetchAllData = useCallback(async (dateFrom?: string, dateTo?: string): Promise<any[]> => {
    try {
      const headers = getAuthHeaders();
      const response = await axios({
        method: "GET",
        url: API_ENDPOINTS.SUPPLIERS.GET_ALL,
        params: {
          startRow: 0,
          endRow: 1000000,
          ...(dateFrom && { dateFrom }),
          ...(dateTo && { dateTo }),
          sortColumn: "name",
          sortDirection: "asc",
          ...(debouncedSearchText.trim() && {
            CustomGridSearchText: debouncedSearchText.trim(),
            CustomGridSearchColumns: "name,supplierNo,contactName,emailAddress",
          }),
        },
        headers,
      });
      if (response.data?.isSuccess) {
        return response.data.response.data || [];
      }
      return [];
    } catch (error) {
      console.error("Failed to fetch all data:", error);
      return [];
    }
  }, [getAuthHeaders, debouncedSearchText]);

  // Use the export handlers hook
  const {
    handleExportCSV,
    handleExportPDF,
    handleExportExcel,
    handlePrint,
    isExporting,
    isPrinting,
  } = useExportHandlers({
    columns,
    gridDataRef,
    fetchAllData,
    filename: "vendors-list",
    pdfOptions: { title: "Vendors List", orientation: "landscape" },
  })

  // Export modal
  const exportModal = useExportModal({
    columns,
    fetchAllData,
    filename: "vendors-list",
    pdfOptions: { title: "Vendors List", orientation: "landscape" },
    dateFilterField: "dateCreated",
  });

  // Callback to receive grid data from ServerGrid
  const handleGridDataChange = useCallback((data: any[]) => {
    gridDataRef.current = data;
  }, []);

  const handleRemountGrid = useCallback(() => {
    setSelectedRows(new Set());
    setSearchText("");
    setDebouncedSearchText("");
    setRemountKey((prev) => prev + 1);
    showToast("Grid refreshed and search cleared", "info");
  }, [showToast]);

  // Handle select all
  const handleSelectAll = useCallback(() => {
    if (serverGridSelectAllRef.current) {
      serverGridSelectAllRef.current();
      showToast("All vendors selected!", "success");
    }
  }, [showToast]);

  return (
    <>
      <div
        className="vendors-list-page p-2 mx-auto md:p-2 min-h-full"
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          margin: 0,
          paddingTop: "5px",
          paddingBottom: "5px",
        }}
      >
        {/* Toast Notification */}
        {toast.show && (
          <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[350px] max-w-[400px] transition-all duration-300 animate-slide-in">
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    toast.type === "success"
                      ? "bg-green-100"
                      : toast.type === "error"
                      ? "bg-red-100"
                      : "bg-brand-50"
                  }`}
                >
                  <svg
                    className={`w-6 h-6 ${
                      toast.type === "success"
                        ? "text-green-600"
                        : toast.type === "error"
                        ? "text-red-600"
                        : "text-brand-500"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {toast.type === "success" && (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    )}
                    {toast.type === "error" && (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    )}
                    {toast.type === "info" && (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    )}
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                    {toast.type === "success" && "Success"}
                    {toast.type === "error" && "Error"}
                    {toast.type === "info" && "Information"}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{toast.message}</p>
                </div>
                <button
                  onClick={() =>
                    setToast({ show: false, message: "", type: "success" })
                  }
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              </div>
              <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
                <div
                  className="h-1 rounded-full animate-progress-bar"
                  style={{
                    width: "100%",
                    animation: "progressBar 3s linear forwards",
                    backgroundColor:
                      toast.type === "success"
                        ? "#22c55e"
                        : toast.type === "error"
                        ? "#ef4444"
                        : "#1e40af",
                  }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Consolidated Action Header with Refresh/Export/Print buttons */}
        <ActionHeader
          selectedCount={selectedRows.size}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onBulkDelete={handleBulkDelete}
          onBulkExport={handleBulkExport}
          totalCount={totalRecords}
          loadedCount={loadedCount}
          itemType="vendors"
          onAddNew={handleNewVendor}
          onRemountGrid={handleRemountGrid}
          showToast={showToast}
          searchText={searchText}
          onSearchChange={handleSearchInputChange}
          onSearchKeyPress={handleSearchKeyPress}
          currentPage={currentPage}
          totalPages={totalPages}
          onFirstPage={() => pageNavigationRef.current?.goToFirstPage()}
          onPreviousPage={() => pageNavigationRef.current?.goToPreviousPage()}
          onNextPage={() => pageNavigationRef.current?.goToNextPage()}
          onLastPage={() => pageNavigationRef.current?.goToLastPage()}
          staticActions={{}}
          showExportPrintButtons={true}
          onRefresh={() => {
            showToast("Refreshing grid...", "info");
            setTimeout(handleRemountGrid, 300);
          }}
          onExport={exportModal.open}
        onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          onPrint={handlePrint}
          isExporting={isExporting}
          isPrinting={isPrinting}
        />

        {/* Main Grid Component */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <ServerGrid
            key={`vendors-grid-${remountKey}`}
            data={[]}
            columns={columns}
            loading={false}
            error={null}
            totalRecords={totalRecords}
            onRowUpdate={handleRowUpdate}
            onRefresh={() => {}}
            pagination={true}
            pageSize={20}
            editable={true}
            columnChooser={true}
            title="Vendors List"
            emptyMessage="No vendors found in the system"
            emptyIcon="🏢"
            serverSide={true}
            apiUrl={API_ENDPOINTS.SUPPLIERS.GET_ALL}
            methodType="GET"
            getAuthHeaders={memoizedGetAuthHeaders}
            defaultSortColumn="name"
            containerWidth="47%"
            additionalParams={additionalParams}
            onRowSelection={handleRowSelection}
            selectedRows={selectedRows}
            setTotalRecords={setTotalRecords}
            setLoadedCount={setLoadedCount}
            setCurrentPage={setCurrentPage}
            setTotalPages={setTotalPages}
            onPageNavigation={(callbacks) => {
              pageNavigationRef.current = callbacks
            }}
            showCheckboxes={true}
            getRowId={(row) => row.supplierID}
            onSelectAll={(selectAllFn) => {
              serverGridSelectAllRef.current = selectAllFn
            }}
            headerSearch={true}
            infiniteScroll={true}
            onView={handleOpenVendor}
            onEdit={handleEditVendor}
            gridId={VENDORS_GRID_ID}
            onColumnVisibilityChange={updateColumnVisibility}
            onColumnWidthChange={updateColumnWidth}
            onColumnsChange={handleColumnsChange}
            columnAggregates={columnAggregates}
            onAggregateChange={updateColumnAggregate}
            onDataChange={handleGridDataChange}
            customContextMenuItems={customContextMenuItems}
            hideDefaultContextMenuItems={true}
          />
        </div>

        {/* Add Vendor Modal */}
        <Modal
          isOpen={isOpen}
          onClose={handleModalClose}
          className="max-w-[700px] m-4"
        >
          <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
            <div className="px-2 pr-14">
              <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                Add New Vendor
              </h4>
              <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
                Enter vendor details to create a new vendor account.
              </p>
            </div>

            <form className="flex flex-col">
              <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
                <div>
                  <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                    Vendor Information
                  </h5>

                  <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                    <div>
                      <Label>Vendor Name</Label>
                      <Input
                        type="text"
                        value={newVendorData.name}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("name", target.value);
                        }}
                        placeholder="Enter vendor name"
                      />
                    </div>

                    <div>
                      <Label>Vendor No</Label>
                      <Input
                        type="text"
                        value={newVendorData.supplierNo}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("supplierNo", target.value);
                        }}
                        placeholder="Enter vendor number"
                      />
                    </div>

                    <div>
                      <Label>Contact Name</Label>
                      <Input
                        type="text"
                        value={newVendorData.contactName}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("contactName", target.value);
                        }}
                        placeholder="Enter contact name"
                      />
                    </div>

                    <div>
                      <Label>Account No</Label>
                      <Input
                        type="text"
                        value={newVendorData.accountNo}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("accountNo", target.value);
                        }}
                        placeholder="Enter account number"
                      />
                    </div>

                    <div>
                      <Label>Email Address</Label>
                      <Input
                        type="email"
                        value={newVendorData.emailAddress}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("emailAddress", target.value);
                        }}
                        placeholder="Enter email address"
                      />
                    </div>

                    <div>
                      <Label>Website</Label>
                      <Input
                        type="text"
                        value={newVendorData.webSite}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("webSite", target.value);
                        }}
                        placeholder="Enter website URL"
                      />
                    </div>

                    <div>
                      <Label>Phone 1</Label>
                      <Input
                        type="text"
                        value={newVendorData.phoneNumber1}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("phoneNumber1", target.value);
                        }}
                        placeholder="Enter primary phone"
                      />
                    </div>

                    <div>
                      <Label>Phone 2</Label>
                      <Input
                        type="text"
                        value={newVendorData.phoneNumber2}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("phoneNumber2", target.value);
                        }}
                        placeholder="Enter secondary phone"
                      />
                    </div>

                    <div>
                      <Label>Fax</Label>
                      <Input
                        type="text"
                        value={newVendorData.phoneNumber3}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("phoneNumber3", target.value);
                        }}
                        placeholder="Enter fax number"
                      />
                    </div>

                    <div>
                      <Label>Min Markup (%)</Label>
                      <Input
                        type="number"
                        value={newVendorData.minMarkup}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("minMarkup", target.value);
                        }}
                        placeholder="Enter minimum markup"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>Address Line 1</Label>
                      <Input
                        type="text"
                        value={newVendorData.address1}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("address1", target.value);
                        }}
                        placeholder="Enter address line 1"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>Address Line 2</Label>
                      <Input
                        type="text"
                        value={newVendorData.address2}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("address2", target.value);
                        }}
                        placeholder="Enter address line 2"
                      />
                    </div>

                    <div>
                      <Label>City</Label>
                      <Input
                        type="text"
                        value={newVendorData.city}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("city", target.value);
                        }}
                        placeholder="Enter city"
                      />
                    </div>

                    <div>
                      <Label>State</Label>
                      <Input
                        type="text"
                        value={newVendorData.state}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("state", target.value);
                        }}
                        placeholder="Enter state"
                      />
                    </div>

                    <div>
                      <Label>Zip Code</Label>
                      <Input
                        type="text"
                        value={newVendorData.zip}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("zip", target.value);
                        }}
                        placeholder="Enter zip code"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>Note</Label>
                      <Input
                        type="text"
                        value={newVendorData.note}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("note", target.value);
                        }}
                        placeholder="Enter note"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
                <Button size="sm" variant="outline" onClick={handleModalClose}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveVendor}>
                  Save Vendor
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      </div>

      {/* Embedded CSS for animations */}
      <style>
        {`
          @keyframes progressBar {
            0% { width: 100%; }
            100% { width: 0%; }
          }

          .animate-slide-in {
            animation: slideInFromRight 0.3s ease-out;
          }

          @keyframes slideInFromRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }

          .animate-progress-bar {
            animation: progressBar 3s linear forwards;
          }
        `}
      </style>
      <ExportModal {...exportModal.modalProps} />
      {ConfirmDialog}
    </>
  );
});

export default VendorListPage;
