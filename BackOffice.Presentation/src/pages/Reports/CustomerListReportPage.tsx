import React, { useState, useCallback, useMemo, useRef } from "react"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { useStore } from "../../context/StoreContext"
import { API_ENDPOINTS } from "../../constants/api"
import { Column as GridUtilsColumn } from "../../gridUtils"
import ExportModal from "../../components/common/ExportModal"
import { useExportModal } from "../../hooks/useExportModal"
import axios from "axios"

interface CustomerListReportProps {
  filters?: {
    storeId?: string
    storeName?: string
    customerId?: string
  }
}

const CustomerListReportPage: React.FC<CustomerListReportProps> = ({ filters }) => {
  const { getAuthHeaders } = useAuthHeaders()
  const { currentStore } = useStore()

  const [totalRecords, setTotalRecords] = useState(0)
  const [gridKey, setGridKey] = useState(0)
  const gridContainerRef = useRef<HTMLDivElement>(null)

  const displayStoreName = filters?.storeName?.trim() || currentStore?.storeName || ""

  // Columns matching desktop RepCustomerList: FirstName, LastName, Address, Details (AllMainDetails), CustomerNo, Balance, Credit, PhoneNumber1, PhoneNumber2, Contact1, Contact2, DateCreated, CustomerID (hidden)
  const columns: Column[] = useMemo(
    () => [
      { field: "firstName", headerName: "First Name", width: 120, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "lastName", headerName: "Last Name", width: 120, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "address", headerName: "Address", width: 200, sortable: true, filterable: true, visible: true, dataType: "string" },
      {
        // Composite of city/state/zip. The export reads row[field] (cellRenderer is
        // ignored on export), so point at the derived `details` field that fetchAllData
        // builds; sort/filter are disabled since it isn't a real server-side column.
        field: "details",
        headerName: "Details",
        width: 180,
        sortable: false,
        filterable: false,
        visible: true,
        dataType: "string",
        cellRenderer: (_value: unknown, row?: any) =>
          [row?.city, row?.state, row?.zip].filter(Boolean).join(", ") || "",
      },
      { field: "customerNo", headerName: "Customer No", width: 120, sortable: true, filterable: true, visible: true, dataType: "string" },
      {
        field: "balanceDoe",
        headerName: "Balance",
        width: 110,
        sortable: true,
        filterable: false,
        visible: true,
        dataType: "number",
        cellRenderer: (value: number) =>
          value == null ? "$0.00" : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      {
        field: "credit",
        headerName: "Credit",
        width: 110,
        sortable: true,
        filterable: false,
        visible: true,
        dataType: "number",
        cellRenderer: (value: number) =>
          value == null ? "$0.00" : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      { field: "phone", headerName: "Phone 1", width: 120, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "cell", headerName: "Phone 2", width: 120, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "email", headerName: "Contact 1", width: 180, sortable: true, filterable: true, visible: true, dataType: "string" },
      { field: "groupName", headerName: "Contact 2", width: 120, sortable: true, filterable: true, visible: true, dataType: "string" },
      {
        field: "dateCreated",
        headerName: "Date Created",
        width: 150,
        sortable: true,
        filterable: true,
        visible: true,
        dataType: "datetime",
        cellRenderer: (value: string | number | Date | null) =>
          value ? new Date(value).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "",
      },
      { field: "customerID", headerName: "Customer ID", width: 100, sortable: true, filterable: true, visible: false, dataType: "string" },
    ],
    []
  )

  const fetchAllData = useCallback(async (): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const response = await axios({
        method: "GET",
        url: API_ENDPOINTS.CUSTOMER.GET_ALL_CUSTOMERS,
        params: {
          startRow: 0,
          endRow: 1000000,
          sortColumn: "customerNo",
          sortDirection: "asc",
        },
        headers,
      })
      if (response.data?.isSuccess && response.data.response?.data) {
        const data = response.data.response.data as any[]
        return data.map((r) => ({
          ...r,
          details: [r.city, r.state, r.zip].filter(Boolean).join(", "),
        }))
      }
      return []
    } catch (error) {
      console.error("Failed to fetch customer list:", error)
      return []
    }
  }, [getAuthHeaders])

  const handleSearch = useCallback(() => {
    setGridKey((k) => k + 1)
  }, [])

  const exportModal = useExportModal({
    columns: columns as unknown as GridUtilsColumn[],
    fetchAllData,
    filename: "customer-list-report",
    pdfOptions: {
      title: "Customer List Report",
      subtitle: displayStoreName ? `Store: ${displayStoreName}` : undefined,
      orientation: "landscape",
    },
  })

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Customer List Report</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-600 dark:text-gray-300">
            {displayStoreName && <span><span className="font-medium text-gray-500 dark:text-gray-400">Store:</span> {displayStoreName}</span>}
            {totalRecords > 0 && (
              <>
                {displayStoreName && <span className="text-gray-300 dark:text-gray-600">|</span>}
                <span>{totalRecords.toLocaleString()} records</span>
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <button
              onClick={handleSearch}
              type="button"
              className="h-10 px-5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 transition-colors flex items-center gap-2 rounded-lg border-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </button>
            <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm ml-auto overflow-visible">
              <button
                onClick={exportModal.open}
                type="button"
                className="h-10 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 border-0 rounded-lg"
                title="Preview, filter and export"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 p-6">
        <div className="flex-1 min-h-0 overflow-auto flex flex-col" ref={gridContainerRef}>
          <div className="min-h-0 flex-1">
            <ServerGrid
              hideDefaultContextMenuItems={true}
              key={gridKey}
              columns={columns}
              apiUrl={API_ENDPOINTS.CUSTOMER.GET_ALL_CUSTOMERS}
              serverSide={true}
              methodType="GET"
              getAuthHeaders={getAuthHeaders}
              pagination={true}
              pageSize={100}
              headerSearch={true}
              showActions={false}
              columnChooser={true}
              title="Customer List"
              defaultSortColumn="customerNo"
              setTotalRecords={setTotalRecords}
              getRowId={(row) => row.customerID ?? String(row.customerNo ?? "")}
              containerWidth="100%"
              gridId="customer-list-report"
            />
          </div>
        </div>
      </div>

      <ExportModal {...exportModal.modalProps} />
    </div>
  )
}

export default CustomerListReportPage
