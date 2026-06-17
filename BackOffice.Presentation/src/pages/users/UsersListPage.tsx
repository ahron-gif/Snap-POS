import React, { useState, memo, useCallback, useMemo, useRef, useEffect } from "react"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import {
  convertToGridColumns,
  cellRenderers,
  GridColDef,
} from "../../gridUtils"
import ActionHeader from "../../components/common/ActionHeader"
import { useExportHandlers } from "../../hooks/useExportHandlers"
import { useExportModal } from "../../hooks/useExportModal"
import ExportModal from "../../components/common/ExportModal"
import { useDashboardTabs } from "../../context/DashboardTabContext"
import { useAppSelector } from "../../hooks/useAppSelector"
import axios from "axios"
import UserCard from "./components/UserCard"
import { permissionService } from "../../services/permissionService"
import type { UserRoleAssignment } from "../../types/permission"
import { useConfirm } from '../../components/ui/ConfirmModal'
import { useGridSettings } from "../../hooks/useGridSettings"
import { useColumnAccessFilter } from "../../hooks/useColumnAccessFilter"

// User record interface (updated to match API response)
interface UserRecord {
  userId: number
  userName: string
  password: string
  apiToken: string
  email: string | null
  lastLoginDate: string | null
  localUserId: string
  dateCreated: string
  dateModified: string | null
  systemUserCreated: string | null
  customerId: number | null
  phone: string | null
  isSuperAdmin?: boolean | null
}

declare global {
  interface Window {
    showUserToast?: (
      message: string,
      type?: "success" | "error" | "info"
    ) => void
  }
}

const handleSendInviteStatic = async (
  row: any,
  showToastCallback: (msg: string, type: "success" | "error" | "info") => void
) => {
  try {
    showToastCallback("Sending Invite....", "success")
    const userId =
      typeof row?.userId === "number" ? row.userId : parseInt(row?.userId)
    console.log(userId)

    if (!userId || isNaN(userId)) {
      console.warn("Invalid row data:", row)
      showToastCallback("Invalid user data. Cannot send invite.", "error")
      return
    }

    const response = await fetch(API_ENDPOINTS.SEND_INVITE.SEND_USER_INVITE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    })

    const result = await response.json()

    if (response.ok && result?.isSuccess) {
      showToastCallback(
        `Invitation sent to ${row.email || "user"} successfully!`,
        "success"
      )
    } else {
      showToastCallback(result.message || "Failed to send invite.", "error")
    }
  } catch (error) {
    console.error("Send invite error:", error)
    showToastCallback("Error sending invite.", "error")
  }
}

// Column definitions for users (updated to match API response)
const usersColumnDefs: GridColDef[] = [
  {
    field: "userName",
    headerName: "User Name",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "email",
    headerName: "Email",
    width: 200,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "phone",
    headerName: "Phone",
    width: 150,
    type: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "dateCreated",
    headerName: "Date Created",
    width: 180,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "dateModified",
    headerName: "Date Modified",
    width: 180,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
  {
    field: "lastLoginDate",
    headerName: "Last Login",
    width: 180,
    type: "datetime",
    sortable: true,
    filterable: true,
    cellRenderer: cellRenderers.datetime,
  },
]

const USERS_GRID_ID = "users-list-grid"

const UsersListPage = memo(function UsersListPage() {
  const { getAuthHeaders } = useAuthHeaders()
  const { openTab } = useDashboardTabs()
  const currentCustomer = useAppSelector((state) => state.customer.currentCustomer)
  const { confirm, ConfirmDialog } = useConfirm()

  const [displayMode, setDisplayMode] = useState<"table" | "card">("card")

  const [searchText, setSearchText] = useState("")
  const [debouncedSearchText, setDebouncedSearchText] = useState("")

  const [roleModalUser, setRoleModalUser] = useState<UserRecord | null>(null)
  const [userRoles, setUserRoles] = useState<UserRoleAssignment[]>([])
  const [userRolesLoading, setUserRolesLoading] = useState(false)
  const [userRolesSaving, setUserRolesSaving] = useState(false)

  // State for bulk selection
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [totalRecords, setTotalRecords] = useState(0)
  const [loadedCount, setLoadedCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Refs for page navigation callbacks from ServerGrid
  const pageNavigationRef = React.useRef<{
    goToFirstPage: () => void
    goToPreviousPage: () => void
    goToNextPage: () => void
    goToLastPage: () => void
  } | null>(null)

  // Store reference to ServerGrid's select all function
  const serverGridSelectAllRef = React.useRef<(() => void) | null>(null)

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean
    message: string
    type: "success" | "error" | "info"
  }>({
    show: false,
    message: "",
    type: "success",
  })

  // Grid data ref for export
  const gridDataRef = useRef<any[]>([])

  const memoizedGetAuthHeaders = useCallback(() => {
    return getAuthHeaders()
  }, [getAuthHeaders])

  // Convert column definitions to grid format (memoized)
  const defaultColumns = React.useMemo(() => convertToGridColumns(usersColumnDefs), [])

  const {
    columns: userPrefColumns,
    setColumns,
    updateColumnVisibility,
    updateColumnWidth,
    updateColumnAggregate,
  } = useGridSettings(USERS_GRID_ID, defaultColumns)

  // Super-Admin ceiling: strip tenant-restricted columns + apply tenant
  // displayName / sortOrder overrides. See ItemListPage for the pattern.
  const { filteredColumns: columns } = useColumnAccessFilter(USERS_GRID_ID, userPrefColumns)

  const handleColumnsChange = useCallback(
    (newColumns: any[]) => setColumns(newColumns),
    [setColumns],
  )

  // Debounce search input - only update debouncedSearchText after user stops typing
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText)
    }, 500) // 500ms debounce for search input

    return () => clearTimeout(timer)
  }, [searchText])

  const additionalParams = useMemo(() => {
    const params: Record<string, string | number> = {}

    if (debouncedSearchText.trim()) {
      params.CustomGridSearchText = debouncedSearchText.trim()
      params.CustomGridSearchColumns = "userName,email,phone"
    }

    const customerId = currentCustomer?.customerId
    if (customerId && customerId > 0) {
      params.CustomerId = customerId
    }

    return params
  }, [debouncedSearchText, currentCustomer?.customerId])

  // Handle search input change (memoized)
  const handleSearchInputChange = useCallback((value: string) => {
    console.log("Search input changed:", value)
    setSearchText(value)
  }, [])

  // Handle search on Enter key press - trigger immediate search (memoized)
  const handleSearchKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        console.log("Search triggered by Enter key:", searchText)
        setDebouncedSearchText(searchText) // Immediately trigger search on Enter
      }
    },
    [searchText]
  )

  // Handle row updates (memoized)
  const handleRowUpdate = useCallback(async (updatedRow: UserRecord) => {
    try {
      console.log("Updating user:", updatedRow)
    } catch (err) {
      console.error("Error updating user:", err)
    }
  }, [])

  // Handle checkbox selection using userId as the primary identifier
  const handleRowSelection = useCallback((userId: string) => {
    console.log("User row selection triggered for userId:", userId)

    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = new Set(prevSelectedRows)
      const wasSelected = newSelectedRows.has(userId)

      if (wasSelected) {
        newSelectedRows.delete(userId)
        console.log(
          "Deselected user row:",
          userId,
          "New count:",
          newSelectedRows.size
        )
      } else {
        newSelectedRows.add(userId)
        console.log(
          "Selected user row:",
          userId,
          "New count:",
          newSelectedRows.size
        )
      }

      return newSelectedRows
    })
  }, [])

  const handleAddUser = useCallback(() => {
    openTab({
      component: "UserFormPage",
      title: "New User",
      closable: true,
      props: { isNew: true },
    })
  }, [openTab])

  // Handle edit user from grid row action
  const handleEditUser = useCallback(
    (row: UserRecord) => {
      openTab({
        component: "UserFormPage",
        title: `Edit: ${row.userName || "User"}`,
        closable: true,
        props: { id: row.localUserId, tenantCustomerId: row.customerId },
      })
    },
    [openTab]
  )

  // Toast notification function (memoized)
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      setToast({ show: true, message, type })
      setTimeout(() => {
        setToast({ show: false, message: "", type: "success" })
      }, 3000)
    },
    []
  )

  const handleOpenRoleModal = useCallback(async (row: UserRecord) => {
    setRoleModalUser(row)
    setUserRolesLoading(true)
    setUserRoles([])
    try {
      const response = await permissionService.getUserRoles(row.userId)
      if (response.data.isSuccess) {
        setUserRoles(response.data.response)
      }
    } catch (error) {
      console.error("Error fetching user roles:", error)
      showToast("Failed to load roles", "error")
    } finally {
      setUserRolesLoading(false)
    }
  }, [showToast])

  const handleToggleRole = useCallback((roleId: number) => {
    setUserRoles((prev) =>
      prev.map((r) => (r.roleId === roleId ? { ...r, isAssigned: !r.isAssigned } : r))
    )
  }, [])

  const handleSaveRoles = useCallback(async () => {
    if (!roleModalUser) return
    setUserRolesSaving(true)
    try {
      const roleIds = userRoles.filter((r) => r.isAssigned).map((r) => r.roleId)
      await permissionService.assignUserRoles(roleModalUser.userId, {
        userId: roleModalUser.userId,
        roleIds,
      })
      setRoleModalUser(null)
      showToast("Roles updated successfully", "success")
    } catch (error) {
      console.error("Error saving roles:", error)
      showToast("Failed to save roles", "error")
    } finally {
      setUserRolesSaving(false)
    }
  }, [roleModalUser, userRoles, showToast])

  // Shared single-user delete request used by both the card delete and the
  // bulk delete. Resolves to { ok } based on the API's isSuccess flag so a
  // caller never reports success for a delete the backend actually rejected.
  // Throws on network/HTTP errors (callers catch). Sends the row's own
  // customerId so cross-tenant deletes target the correct tenant.
  const deleteUserRequest = useCallback(
    async (user: UserRecord): Promise<{ ok: boolean; message?: string }> => {
      const headers = getAuthHeaders()
      if (user.customerId) {
        headers["CustomerId"] = user.customerId.toString()
      }
      const res = await axios.delete(
        API_ENDPOINTS.USERS.DELETE_USER(user.localUserId),
        { headers }
      )
      // The User API returns { isSuccess, message }. Treat only an explicit
      // false as failure; an empty / 204 body is treated as success.
      if (res.data?.isSuccess === false) {
        return { ok: false, message: res.data?.message }
      }
      return { ok: true }
    },
    [getAuthHeaders]
  )

  // Single-user delete with confirm + toast + grid refresh. Shared by the card
  // delete, the row-action (trash) button, and any other single-user entry
  // point so they all behave identically and honour the API result.
  const handleDeleteUser = useCallback(
    async (user: UserRecord) => {
      const confirmed = await confirm({
        title: 'Delete User',
        message: `Are you sure you want to delete user "${user.userName}"? This action cannot be undone.`,
        variant: 'danger',
      })
      if (!confirmed) return
      try {
        const result = await deleteUserRequest(user)
        if (!result.ok) {
          showToast(result.message || `Failed to delete user "${user.userName}"`, "error")
          return
        }
        showToast(`User "${user.userName}" deleted successfully`, "success")
        setRemountKey((prev) => prev + 1)
      } catch {
        showToast(`Failed to delete user "${user.userName}"`, "error")
      }
    },
    [confirm, deleteUserRequest, showToast]
  )

  const renderUserCard = useCallback(
    (row: Record<string, unknown>) => (
      <UserCard
        user={row as unknown as UserRecord}
        onEdit={(user) => handleEditUser(user as unknown as UserRecord)}
        onDelete={(user) => handleDeleteUser(user as unknown as UserRecord)}
        onAssignRoles={(user) => handleOpenRoleModal(user as unknown as UserRecord)}
        onSendInvite={(user) => handleSendInviteStatic(user, showToast)}
      />
    ),
    [handleEditUser, showToast, handleOpenRoleModal, handleDeleteUser]
  )

  // Make toast function globally accessible for the cellRenderer
  React.useEffect(() => {
    ;(window as any).showUserToast = showToast
    return () => {
      delete (window as any).showUserToast
    }
  }, [showToast])

  // Bulk operation handlers

  const handleDeselectAll = useCallback(() => {
    setSelectedRows(new Set())
    showToast("Deselected all users", "info")
  }, [showToast])

  const handleBulkDelete = useCallback(async () => {
    if (selectedRows.size === 0) return

    const confirmed = await confirm({
      title: 'Delete Selected Users',
      message: `Are you sure you want to delete ${selectedRows.size} selected users? This action cannot be undone.`,
      variant: 'danger',
    })

    if (!confirmed) return

    // Selection is keyed by userId, but the DELETE endpoint needs each user's
    // localUserId (tenantUserId) plus their customerId — both live on the row
    // data held in gridDataRef. Resolve the selected ids to their full rows.
    const rows = (gridDataRef.current || []) as UserRecord[]
    const selectedUsers = Array.from(selectedRows)
      .map((id) => rows.find((r) => String(r.userId) === String(id)))
      .filter((u): u is UserRecord => Boolean(u))

    if (selectedUsers.length === 0) {
      showToast("Could not resolve the selected users. Please refresh and try again.", "error")
      return
    }

    let deleted = 0
    let failed = 0
    for (const user of selectedUsers) {
      try {
        const result = await deleteUserRequest(user)
        if (result.ok) deleted++
        else failed++
      } catch {
        failed++
      }
    }

    setSelectedRows(new Set())
    // Remount so the grid refetches — only the rows the API actually removed
    // will be gone. Skip the refetch if nothing was deleted.
    if (deleted > 0) setRemountKey((prev) => prev + 1)

    if (failed === 0) {
      showToast(`${deleted} user${deleted !== 1 ? "s" : ""} deleted successfully!`, "success")
    } else if (deleted > 0) {
      showToast(`${deleted} deleted, ${failed} could not be deleted.`, "error")
    } else {
      showToast(`Failed to delete the selected user${failed !== 1 ? "s" : ""}.`, "error")
    }
  }, [selectedRows, confirm, showToast, deleteUserRequest])

  const handleBulkEdit = useCallback(() => {
    if (selectedRows.size === 0) return
    console.log("Bulk edit users:", Array.from(selectedRows))
    showToast(`Opening bulk edit for ${selectedRows.size} users`, "info")
  }, [selectedRows, showToast])

  const handleBulkExport = useCallback(() => {
    if (selectedRows.size === 0) return
    console.log("Bulk export users:", Array.from(selectedRows))
    showToast(`Exporting ${selectedRows.size} users to CSV`, "success")
  }, [selectedRows, showToast])

  // Static action handlers
  const handleStaticEdit = useCallback(() => {
    if (selectedRows.size === 1) {
      const id = Array.from(selectedRows)[0]
      openTab({
        component: "UserFormPage",
        title: "Edit User",
        closable: true,
        props: { id },
      })
    } else if (selectedRows.size > 1) {
      showToast("Please select only one user to edit", "info")
    } else {
      showToast("Please select a user to edit", "info")
    }
  }, [selectedRows, openTab, showToast])

  const handleStaticDownloadReport = useCallback(() => {
    console.log("Static download report action clicked")
    showToast("Downloading report for current data", "success")
  }, [showToast])

  const handleStaticDelete = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Delete',
      message: 'Are you sure you want to delete? This action cannot be undone.',
      variant: 'danger',
    })
    if (confirmed) {
      console.log("Static delete action clicked")
      showToast("Delete functionality executed", "success")
    }
  }, [showToast, confirm])

  const [remountKey, setRemountKey] = useState(0)

  const handleRemountGrid = useCallback(() => {
    setSelectedRows(new Set())
    setSearchText("")
    setDebouncedSearchText("")
    setRemountKey((prev) => prev + 1)
    showToast("Grid refreshed and search cleared", "info")
  }, [showToast])

  // Fetch all data for export/print
  const fetchAllData = useCallback(async (dateFrom?: string, dateTo?: string): Promise<any[]> => {
    try {
      const headers = getAuthHeaders()
      const params: Record<string, string | number> = {
        startRow: 0,
        endRow: 1000000,
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
        sortColumn: "userId",
        sortDirection: "asc",
      }
      const customerId = currentCustomer?.customerId
      if (customerId && customerId > 0) {
        params.CustomerId = customerId
      }
      const response = await axios({
        method: "GET",
        url: API_ENDPOINTS.USERS.GET_USERS,
        params,
        headers,
      })
      if (response.data?.isSuccess) {
        return response.data.response.data || []
      }
      return []
    } catch (error) {
      console.error("Failed to fetch all data:", error)
      return []
    }
  }, [getAuthHeaders, currentCustomer?.customerId])

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
    filename: "users-list",
    pdfOptions: { title: "Users List", orientation: "landscape" },
  })

  // Export modal
  const exportModal = useExportModal({
    columns,
    fetchAllData,
    filename: "users-list",
    pdfOptions: { title: "Users List", orientation: "landscape" },
    dateFilterField: "dateCreated",
  })

  // Callback to receive grid data from ServerGrid
  const handleGridDataChange = useCallback((data: any[]) => {
    gridDataRef.current = data
  }, [])

  // Handle select all - this will be called by ActionHeader
  const handleSelectAll = useCallback(() => {
    console.log("UsersListPage handleSelectAll triggered")

    try {
      if (serverGridSelectAllRef.current) {
        console.log("Calling ServerGrid handleSelectAll function")
        serverGridSelectAllRef.current()
        showToast("All users selected!", "success")
      } else {
        console.log("ServerGrid handleSelectAll function not available")
        showToast("Selecting all users...", "info")
      }
    } catch (error) {
      console.error("Error in handleSelectAll:", error)
      showToast("Error selecting users", "error")
    }
  }, [showToast])

  return (
    <>
      <div
        className="users-list-page p-2 mx-auto md:p-2 min-h-full"
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

        <ActionHeader
          selectedCount={selectedRows.size}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onBulkDelete={handleBulkDelete}
          onBulkExport={handleBulkExport}
          totalCount={totalRecords}
          loadedCount={loadedCount}
          itemType="users"
          onAddNew={handleAddUser}
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
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          showExportPrintButtons={true}
          onRefresh={() => {
            showToast("Refreshing grid...", "info")
            setTimeout(handleRemountGrid, 300)
          }}
          onExport={exportModal.open}
        onExportCSV={handleExportCSV}
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          onPrint={handlePrint}
          isExporting={isExporting}
          isPrinting={isPrinting}
          gridId={USERS_GRID_ID}
        />

        {/* Main Grid Component */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <ServerGrid
            key={remountKey}
            data={[]}
            columns={columns}
            gridId={USERS_GRID_ID}
            onColumnVisibilityChange={updateColumnVisibility}
            onColumnWidthChange={updateColumnWidth}
            onColumnsChange={handleColumnsChange}
            onAggregateChange={updateColumnAggregate}
            loading={false}
            error={null}
            totalRecords={0}
            onRowUpdate={handleRowUpdate}
            onRefresh={() => {}}
            pagination={true}
            pageSize={20}
            editable={true}
            columnChooser={true}
            title="Users List"
            emptyMessage="No users found in the system"
            emptyIcon="👥"
            serverSide={true}
            apiUrl={API_ENDPOINTS.USERS.GET_USERS} // KEPT YOUR ORIGINAL API ENDPOINT
            methodType="GET"
            getAuthHeaders={memoizedGetAuthHeaders}
            defaultSortColumn="userId"
            containerWidth="74%"
            additionalParams={additionalParams} // UPDATED: Using new search API parameters
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
            getRowId={(row) => row.userId}
            showActions={true}
            onEdit={handleEditUser}
            onDelete={handleDeleteUser}
            onAssignRoles={handleOpenRoleModal}
            onSendInviteAction={handleSendInviteStatic}
            onSelectAll={(selectAllFn) => {
              serverGridSelectAllRef.current = selectAllFn
            }}
            headerSearch={true}
            infiniteScroll={true}
            onDataChange={handleGridDataChange}
            cardRenderer={renderUserCard}
            displayMode={displayMode}
            customContextMenuItems={[
              {
                label: "Assign Roles",
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                onClick: (row: Record<string, unknown>) => handleOpenRoleModal(row as unknown as UserRecord),
              },
            ]}
          />
        </div>

        {/* Role Assignment Modal */}
        {roleModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Assign Roles
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {roleModalUser.userName}
                  </p>
                </div>
                <button
                  onClick={() => setRoleModalUser(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {userRolesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <svg className="animate-spin w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="ml-2 text-sm text-gray-500">Loading roles...</span>
                  </div>
                ) : userRoles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <p className="text-sm">No roles available</p>
                  </div>
                ) : (
                  <>
                    <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {userRoles.filter((r) => r.isAssigned).length} of {userRoles.length} roles assigned
                      </p>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {userRoles.map((role) => (
                        <label
                          key={role.roleId}
                          className="flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={role.isAssigned}
                            onChange={() => handleToggleRole(role.roleId)}
                            className="rounded border-gray-300 text-brand-500 focus:ring-brand-500 w-4 h-4"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              {role.roleName}
                            </p>
                            {role.roleCode && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{role.roleCode}</p>
                            )}
                          </div>
                          {role.isAssigned && (
                            <span className="text-xs px-2 py-0.5 bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 rounded-full">
                              Assigned
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {userRoles.length > 0 && !userRolesLoading && (
                <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setRoleModalUser(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveRoles}
                    disabled={userRolesSaving}
                    className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {userRolesSaving && (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    Save
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

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
      </div>
      <ExportModal {...exportModal.modalProps} />
      {ConfirmDialog}
    </>
  )
})

export default UsersListPage
