
import React, { useState, memo, useCallback, useRef, useMemo } from "react";
import ServerGrid from "../../components/common/ServerGrid/ServerGrid";
import { useAuthHeaders } from "../../hooks/useAuthHeaders";
import { useGridSettings } from "../../hooks/useGridSettings";
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
import axios from "axios";
import { useConfirm } from '../../components/ui/ConfirmModal';
import { useDashboardTabs } from '../../context/DashboardTabContext';

// Customer record interface (matches CustomerViewDto from backend)
interface CustomerRecord {
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
}

// Column definitions for customers (matches CustomerViewDto from backend)
const customersColumnDefs: GridColDef[] = [
  {
    field: "customerID",
    headerName: "Customer ID",
    width: 100,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "customerNo",
    headerName: "Customer No",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "name",
    headerName: "Name",
    width: 180,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "firstName",
    headerName: "First Name",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "lastName",
    headerName: "Last Name",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "address",
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
    width: 80,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "phone",
    headerName: "Phone",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "cell",
    headerName: "Cell Phone",
    width: 120,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "email",
    headerName: "Email",
    width: 180,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "credit",
    headerName: "Credit",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) => value ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "balanceDoe",
    headerName: "Balance",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) => value ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "lastVisit",
    headerName: "Last Visit",
    width: 150,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "lastPayment",
    headerName: "Last Payment",
    width: 120,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) => value ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "groupName",
    headerName: "Group",
    width: 100,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "over30",
    headerName: "Over 30",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) => value ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "over60",
    headerName: "Over 60",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) => value ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "over90",
    headerName: "Over 90",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) => value ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "over120",
    headerName: "Over 120",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) => value ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "current",
    headerName: "Current",
    width: 100,
    type: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) => value ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "lockAccount",
    headerName: "Lock Account",
    width: 110,
    type: "boolean",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.boolean,
  },
  {
    field: "dateCreated",
    headerName: "Date Created",
    width: 150,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "dateModified",
    headerName: "Date Modified",
    width: 150,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
];

// Grid ID for column-settings persistence (UserPreferences key: "grid.columns.customers-list-grid")
const CUSTOMERS_GRID_ID = "customers-list-grid";

const CustomerListPage = memo(function CustomerListPage() {
  const { getAuthHeaders } = useAuthHeaders();
  const { openTab } = useDashboardTabs();
  const { isOpen, openModal, closeModal } = useModal();
  const { confirm, ConfirmDialog } = useConfirm();

  // State for search functionality
  const [searchText, setSearchText] = useState("");
  const [searchFilters, setSearchFilters] = useState<Record<string, any>>({});
  const [debouncedSearchText, setDebouncedSearchText] = useState("");

  // State for bulk selection
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [totalRecords, setTotalRecords] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Refs for page navigation callbacks from ServerGrid
  const pageNavigationRef = React.useRef<{
    goToFirstPage: () => void
    goToPreviousPage: () => void
    goToNextPage: () => void
    goToLastPage: () => void
  } | null>(null);

  // Form state for new customer
  const [newCustomerData, setNewCustomerData] = useState({
    userName: "",
    password: "",
    userFName: "",
    userLName: "",
    address: "",
    homePhoneNumber: "",
    workPhoneNumber: "",
    fax: "",
    email: "",
    zipCode: "",
    isSuperAdmin: "No",
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

  // Convert column definitions to grid format (memoized)
  const defaultColumns = React.useMemo(
    () => convertToGridColumns(customersColumnDefs),
    [],
  );

  // Persist column visibility / width / aggregate settings per user
  // via UserPreferences (key: "grid.columns.customers-list-grid")
  const {
    columns,
    setColumns,
    updateColumnVisibility,
    updateColumnWidth,
    updateColumnAggregate,
  } = useGridSettings(CUSTOMERS_GRID_ID, defaultColumns);

  const handleColumnsChange = useCallback(
    (newColumns: any[]) => setColumns(newColumns),
    [setColumns],
  );

  // Debounce search input - only update debouncedSearchText after customer stops typing
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 500); // 500ms debounce for search input

    return () => clearTimeout(timer);
  }, [searchText]);

  // Handle search functionality when debouncedSearchText changes
  React.useEffect(() => {
    const trimmedSearch = debouncedSearchText.trim();
    if (trimmedSearch) {
      // Create a single filter with OR logic for search across multiple fields
      setSearchFilters({
        globalSearch: {
          conditions: [
            {
              id: "search_username",
              operator: "contains" as const,
              value: trimmedSearch,
              field: "userName",
            },
          ],
          logic: "AND" as const,
        },
      });
    } else {
      // Only clear if there are existing filters to avoid unnecessary updates
      setSearchFilters((prev) => {
        if (Object.keys(prev).length === 0) return prev;
        return {};
      });
    }
  }, [debouncedSearchText]);

  // Handle search functionality (memoized) - used for manual search trigger
  const handleSearch = useCallback(() => {
    const trimmedSearch = debouncedSearchText.trim();
    if (trimmedSearch) {
      setSearchFilters({
        globalSearch: {
          conditions: [
            {
              id: "search_username",
              operator: "contains" as const,
              value: trimmedSearch,
              field: "userName",
            },
          ],
          logic: "AND" as const,
        },
      });
    } else {
      setSearchFilters((prev) => {
        if (Object.keys(prev).length === 0) return prev;
        return {};
      });
    }
  }, [debouncedSearchText]);

  // Handle search input change (memoized)
  const handleSearchInputChange = useCallback((value: string) => {
    setSearchText(value);
  }, []);

  // Handle search on Enter key press - trigger immediate search (memoized)
  const handleSearchKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        setDebouncedSearchText(searchText); // Immediately trigger search on Enter
      }
    },
    [searchText],
  );

  // Handle row updates (memoized)
  const handleRowUpdate = useCallback(async (updatedRow: CustomerRecord) => {
    openTab({
      component: "CustomerFormPage",
      title: `Customer: ${updatedRow.name || updatedRow.firstName + ' ' + updatedRow.lastName || "Details"}`,
      closable: true,
      props: { id: updatedRow.customerID, customerData: updatedRow },
    });
  }, [openTab]);

  // Handle checkbox selection using customerID as the primary identifier
  const handleRowSelection = useCallback((customerID: string) => {
    console.log('Customer row selection triggered for customerID:', customerID);

    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = new Set(prevSelectedRows);
      const wasSelected = newSelectedRows.has(customerID);

      if (wasSelected) {
        newSelectedRows.delete(customerID);
        console.log('Deselected customer row:', customerID, 'New count:', newSelectedRows.size);
      } else {
        newSelectedRows.add(customerID);
        console.log('Selected customer row:', customerID, 'New count:', newSelectedRows.size);
      }

      return newSelectedRows;
    });
  }, []);

  // Handle input changes for new customer form (memoized)
  const handleInputChange = useCallback((field: string, value: string) => {
    setNewCustomerData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // Handle opening the add customer modal (memoized)
  const handleAddCustomer = useCallback(() => {
    // Reset form data
    setNewCustomerData({
      userName: "",
      password: "",
      userFName: "",
      userLName: "",
      address: "",
      homePhoneNumber: "",
      workPhoneNumber: "",
      fax: "",
      email: "",
      zipCode: "",
      isSuperAdmin: "No",
    });
    openModal();
  }, [openModal]);

  // Handle saving new customer (memoized)
  const handleSaveCustomer = useCallback(() => {
    console.log("Creating new customer:", newCustomerData);
    closeModal();
    showToast("Customer has been created successfully!", "success");
  }, [newCustomerData, closeModal]);

  // Handle modal close (memoized)
  const handleModalClose = useCallback(() => {
    setNewCustomerData({
      userName: "",
      password: "",
      userFName: "",
      userLName: "",
      address: "",
      homePhoneNumber: "",
      workPhoneNumber: "",
      fax: "",
      email: "",
      zipCode: "",
      isSuperAdmin: "No",
    });
    closeModal();
  }, [closeModal]);

  // Toast notification function (memoized)
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
    (window as any).showCustomerToast = showToast;
    return () => {
      delete (window as any).showCustomerToast;
    };
  }, [showToast]);

  // Bulk operation handlers

  const handleDeselectAll = useCallback(() => {
    setSelectedRows(new Set());
    showToast("Deselected all customers", "info");
  }, [showToast]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedRows.size === 0) return;

    const confirmed = await confirm({
      title: 'Delete Selected Customers',
      message: `Are you sure you want to delete ${selectedRows.size} selected customers? This action cannot be undone.`,
      variant: 'danger',
    });

    if (confirmed) {
      console.log("Bulk delete customers:", Array.from(selectedRows));
      setSelectedRows(new Set());
      showToast(`${selectedRows.size} customers have been deleted successfully!`, "success");
    }
  }, [selectedRows, showToast, confirm]);

  const handleBulkEdit = useCallback(() => {
    if (selectedRows.size === 0) return;
    console.log("Bulk edit customers:", Array.from(selectedRows));
    showToast(`Opening bulk edit for ${selectedRows.size} customers`, "info");
  }, [selectedRows, showToast]);

  const handleBulkExport = useCallback(() => {
    if (selectedRows.size === 0) return;
    console.log("Bulk export customers:", Array.from(selectedRows));
    showToast(`Exporting ${selectedRows.size} customers to CSV`, "success");
  }, [selectedRows, showToast]);

  // Static action handlers
  const handleStaticEdit = useCallback(() => {
    console.log("Static edit action clicked");
    showToast("Edit functionality available for selected rows", "info");
  }, [showToast]);

  const handleStaticDownloadReport = useCallback(() => {
    console.log("Static download report action clicked");
    showToast("Downloading report for current data", "success");
  }, [showToast]);

  const handleStaticDelete = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Delete',
      message: 'Are you sure you want to delete? This action cannot be undone.',
      variant: 'danger',
    });
    if (confirmed) {
      console.log("Static delete action clicked");
      showToast("Delete functionality executed", "success");
    }
  }, [showToast, confirm]);

  const [remountKey, setRemountKey] = useState(0);

  const handleRemountGrid = useCallback(() => {
    setSelectedRows(new Set());
    setRemountKey((prev) => prev + 1);
    showToast("Grid refreshed", "info");
  }, [showToast]);

  // Fetch all data for export/print
  const fetchAllData = useCallback(async (dateFrom?: string, dateTo?: string): Promise<any[]> => {
    try {
      const headers = getAuthHeaders();
      const response = await axios({
        method: "GET",
        url: API_ENDPOINTS.CUSTOMER.GET_ALL_CUSTOMERS,
        params: {
          startRow: 0,
          endRow: 1000000,
          ...(dateFrom && { dateFrom }),
          ...(dateTo && { dateTo }),
          sortColumn: "customerNo",
          sortDirection: "asc",
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
  }, [getAuthHeaders]);

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
    filename: "customers-list",
    pdfOptions: { title: "Customers List", orientation: "landscape" },
  })

  // Export modal
  const exportModal = useExportModal({
    columns,
    fetchAllData,
    filename: "customers-list",
    pdfOptions: { title: "Customers List", orientation: "landscape" },
    dateFilterField: "dateCreated",
  });

  // Callback to receive grid data from ServerGrid
  const handleGridDataChange = useCallback((data: any[]) => {
    gridDataRef.current = data;
  }, []);

    // Store reference to ServerGrid's select all function
  const serverGridSelectAllRef = React.useRef<(() => void) | null>(null);

  // Handle select all - this will be called by ActionHeader
  const handleSelectAll = useCallback(() => {
    console.log('CustomerListPage handleSelectAll triggered');
    
    try {
      if (serverGridSelectAllRef.current) {
        console.log('Calling ServerGrid handleSelectAll function');
        serverGridSelectAllRef.current();
        showToast("All customers selected!", "success");
      } else {
        console.log('ServerGrid handleSelectAll function not available');
        showToast("Selecting all customers...", "info");
      }
    } catch (error) {
      console.error('Error in handleSelectAll:', error);
      showToast("Error selecting customers", "error");
    }
  }, [showToast]);

  return (
    <>
      <div
        className="customers-list-page p-2 mx-auto md:p-2 min-h-full"
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
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-500/10 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-green-600 dark:text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    ></path>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                    Saved Successfully
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
                  className="bg-green-500 h-1 rounded-full animate-progress-bar"
                  style={{
                    width: "100%",
                    animation: "progressBar 3s linear forwards",
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
          itemType="customers"
          onAddNew={handleAddCustomer}
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
            key={remountKey}
            data={[]}
            columns={columns}
            loading={false}
            error={null}
            totalRecords={0}
            onRowUpdate={handleRowUpdate}
            onRefresh={() => {}}
            pagination={true}
            pageSize={50}
            editable={true}
            columnChooser={true}
            title="Customers List"
            emptyMessage="No customers found in the system"
            emptyIcon="👥"
            serverSide={true}
            apiUrl={API_ENDPOINTS.CUSTOMER.GET_ALL_CUSTOMERS}
            methodType="GET"
            getAuthHeaders={memoizedGetAuthHeaders}
            defaultSortColumn="customerNo"
            containerWidth="74%"
            initialFilters={searchFilters}
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
            getRowId={(row) => row.customerID}
            onSelectAll={(selectAllFn) => {
              serverGridSelectAllRef.current = selectAllFn
            }}
            headerSearch={true}
            infiniteScroll={false}
            onDataChange={handleGridDataChange}
            gridId={CUSTOMERS_GRID_ID}
            onColumnVisibilityChange={updateColumnVisibility}
            onColumnWidthChange={updateColumnWidth}
            onColumnsChange={handleColumnsChange}
            onAggregateChange={updateColumnAggregate}
          />
        </div>

        {/* Add Customer Modal */}
        <Modal
          isOpen={isOpen}
          onClose={handleModalClose}
          className="max-w-[700px] m-4"
        >
          <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
            <div className="px-2 pr-14">
              <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                Add New Customer
              </h4>
              <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
                Enter customer details to create a new customer account.
              </p>
            </div>

            <form className="flex flex-col">
              <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
                <div>
                  <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                    Customer Information
                  </h5>

                  <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                    <div>
                      <Label>Customer Name</Label>
                      <Input
                        type="text"
                        value={newCustomerData.userName}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("userName", target.value);
                        }}
                        placeholder="Enter customer name"
                      />
                    </div>

                    <div>
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={newCustomerData.password}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("password", target.value);
                        }}
                        placeholder="Enter password"
                      />
                    </div>

                    <div>
                      <Label>First Name</Label>
                      <Input
                        type="text"
                        value={newCustomerData.userFName}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("userFName", target.value);
                        }}
                        placeholder="Enter first name"
                      />
                    </div>

                    <div>
                      <Label>Last Name</Label>
                      <Input
                        type="text"
                        value={newCustomerData.userLName}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("userLName", target.value);
                        }}
                        placeholder="Enter last name"
                      />
                    </div>

                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={newCustomerData.email}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("email", target.value);
                        }}
                        placeholder="Enter email address"
                      />
                    </div>

                    <div>
                      <Label>Home Phone</Label>
                      <Input
                        type="text"
                        value={newCustomerData.homePhoneNumber}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("homePhoneNumber", target.value);
                        }}
                        placeholder="Enter home phone number"
                      />
                    </div>

                    <div>
                      <Label>Work Phone</Label>
                      <Input
                        type="text"
                        value={newCustomerData.workPhoneNumber}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("workPhoneNumber", target.value);
                        }}
                        placeholder="Enter work phone number"
                      />
                    </div>

                    <div>
                      <Label>Fax</Label>
                      <Input
                        type="text"
                        value={newCustomerData.fax}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("fax", target.value);
                        }}
                        placeholder="Enter fax number"
                      />
                    </div>

                    <div>
                      <Label>Zip Code</Label>
                      <Input
                        type="text"
                        value={newCustomerData.zipCode}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("zipCode", target.value);
                        }}
                        placeholder="Enter zip code"
                      />
                    </div>

                    <div>
                      <Label>Super Admin</Label>
                      <select
                        value={newCustomerData.isSuperAdmin}
                        onChange={(e) => {
                          const target = e.target as HTMLSelectElement;
                          handleInputChange("isSuperAdmin", target.value);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>

                    <div className="col-span-2">
                      <Label>Address</Label>
                      <Input
                        type="text"
                        value={newCustomerData.address}
                        onChange={(e) => {
                          const target = e.target as HTMLInputElement;
                          handleInputChange("address", target.value);
                        }}
                        placeholder="Enter address"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
                <Button size="sm" variant="outline" onClick={handleModalClose}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveCustomer}>
                  Save Customer
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      </div>
      <ExportModal {...exportModal.modalProps} />
      {ConfirmDialog}
    </>
  );
});

export default CustomerListPage;
