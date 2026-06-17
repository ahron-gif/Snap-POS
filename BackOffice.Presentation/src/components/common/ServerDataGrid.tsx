import React, { useEffect, useState, useCallback } from "react"
import {
  DataGrid,
  GridColDef,
  GridPaginationModel,
  GridSortModel,
  GridFilterModel,
  GridActionsCellItem,
} from "@mui/x-data-grid"
import {
  Box,
  Stack,
  TextField,
  Button,
  Typography,
  IconButton,
  Paper,

} from "@mui/material"
import {
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
} from "@mui/icons-material"
import axios from "axios"
import UserProfiles from "../../pages/UserProfiles"
import { useModal } from "../../hooks/useModal"
import { Modal } from "../ui/modal"
import Input from "../form/input/InputField"
import Label from "../form/Label"

interface ServerDataGridProps {
  columns: GridColDef[]
  apiUrl: string
  methodType?: "GET" | "POST"
  getRowId?: (row: any) => string | number
  searchColumns?: string[]
}

type ViewMode = "grid" | "view" | "delete"

const ServerDataGrid: React.FC<ServerDataGridProps> = ({
  columns = [], // Add default empty array
  apiUrl,
  methodType = "POST",
  searchColumns = [],
}) => {
  // Debug logging to help identify the issue
  console.log("ServerDataGrid rendered with columns:", columns)
  console.log("Columns type:", typeof columns)
  console.log("Is columns array?", Array.isArray(columns))
  const [rows, setRows] = useState<any[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [loading, setLoading] = useState(false)

  const [searchText, setSearchText] = useState("")
  const [searchTrigger, setSearchTrigger] = useState("")

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 20,
  })
  const [sortModel, setSortModel] = useState<GridSortModel>([])
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] })

  // Navigation states
  const [currentView, setCurrentView] = useState<ViewMode>("grid")
  const [selectedRow, setSelectedRow] = useState<any>(null)

  // Modal state
  const { isOpen, openModal, closeModal } = useModal()
  const [editFormData, setEditFormData] = useState<any>({})

  const handleSearch = useCallback(() => {
    setSearchTrigger(searchText.trim())
    setPaginationModel((prev: any) => ({ ...prev, page: 0 }))
  }, [searchText])

  const handleClear = () => {
    setSearchText("")
    setSearchTrigger("")
    setPaginationModel((prev: any) => ({ ...prev, page: 0 }))
  }

  // Navigation handlers
  const handleViewClick = (row: any) => {
    setSelectedRow(row)
    setCurrentView("view")
  }

  const handleEditClick = (row: any) => {
    setSelectedRow(row)
    setEditFormData(() => ({ ...row }))
    openModal()
  }

  const handleDeleteClick = (row: any) => {
    setSelectedRow(row)
    setCurrentView("delete")
  }

  const handleBackToGrid = () => {
    setCurrentView("grid")
    setSelectedRow(null)
  }

  const handleSave = () => {
    // Handle save logic here
    console.log("Saving changes...", editFormData)

    // Update the row in the local state
    setRows((prevRows) =>
      prevRows.map((row) =>
        row.customId === editFormData.customId ? editFormData : row
      )
    )

    closeModal()
    setSelectedRow(null)
    setEditFormData({})
  }

  const handleDeleteAndClose = () => {
    // Add your delete logic here
    console.log("Deleting data:", selectedRow)
    handleBackToGrid()
  }

  const handleInputChange = (field: string, value: string) => {
    setEditFormData((prev: any) => ({
      ...prev,
      [field]: value,
    }))
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const startRow = paginationModel.page * paginationModel.pageSize
    const endRow = startRow + paginationModel.pageSize

    const baseFilters =
      filterModel.items?.filter((f: any) => f.field && f.value !== "") || []
    const searchFilters =
      searchTrigger && searchColumns.length > 0
        ? searchColumns.map((col) => ({
            col,
            type: "contains",
            val: searchTrigger,
          }))
        : []

    const filters = [
      ...baseFilters.map((f: any) => ({
        col: f.field,
        type: f.operator,
        val: f.value,
      })),
      ...searchFilters,
    ]

    const sortColumn = (sortModel[0] as any)?.field || "name"
    const sortDirection = (sortModel[0] as any)?.sort || "asc"

    try {
      const config = {
        method: methodType,
        url: apiUrl,
        params:
          methodType === "GET"
            ? {
                startRow,
                endRow,
                sortColumn,
                sortDirection,
                filters: filters.length > 0 ? JSON.stringify(filters) : null,
              }
            : {},
        data:
          methodType === "POST"
            ? {
                startRow,
                endRow,
                sortColumn,
                sortDirection,
                sortModel,
                filters: filters.length > 0 ? JSON.stringify(filters) : null,
              }
            : {},
      }

      const response = await axios(config)
      const details = response.data?.data

      console.log("API Response details:", details)
      console.log("Records:", details?.records)
      console.log("Is records array?", Array.isArray(details?.records))

      // More robust record mapping with additional safety checks
      const records = details?.records
      const mappedRows =
        records && Array.isArray(records)
          ? records.map((record: any) => ({
              userId: record?.userId || "",
              userName: record?.userName || "",
              password: record?.password || "",
              userFName: record?.userFName || "",
              userLName: record?.userLName || "",
              address: record?.address || "",
              homePhoneNumber: record?.homePhoneNumber || "",
              workPhoneNumber: record?.workPhoneNumber || "",
              fax: record?.fax || "",
              email: record?.email || "",
              zipCode: record?.zipCode || "",
              isSuperAdmin: record?.isSuperAdmin ? "Yes" : "No",
              status: record?.status ? "Active" : "Inactive",
              dateCreated: record?.dateCreated
                ? new Date(record.dateCreated).toLocaleString()
                : "",
              userCreated: record?.userCreated || "",
              dateModified: record?.dateModified
                ? new Date(record.dateModified).toLocaleString()
                : "",
              userModified: record?.userModified || "",
              scanId: record?.scanId || "",
              isLogIn: record?.isLogIn ? "Logged In" : "Not Logged In",
              // Custom row ID using userId and scanId
              customId: `${record?.userId || "unknown"}-${
                record?.scanId || "unknown"
              }`,
            }))
          : []

      setRows(mappedRows)
      setTotalRows(details?.totalRecords || 0)
    } catch (error) {
      console.error("Error fetching data:", error)
      console.error("API URL:", apiUrl)
      console.error("Config error occurred")

      setRows([])
      setTotalRows(0)
    } finally {
      setLoading(false)
    }
  }, [
    apiUrl,
    paginationModel,
    sortModel,
    filterModel,
    searchTrigger,
    searchColumns,
    methodType,
  ])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // More robust columns validation
  const safeColumns = columns && Array.isArray(columns) ? columns : []

  // Early return if columns is empty to prevent rendering issues
  if (safeColumns.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>No columns defined for the data grid.</Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          Debug info: columns = {JSON.stringify(columns)}
        </Typography>
      </Box>
    )
  }

  // Create columns with actions using safe columns
  const columnsWithActions: GridColDef[] = [
    ...safeColumns.map((col) => ({
      ...col,
      flex: 1,
      minWidth: 150,
    })),
    {
      field: "actions",
      headerName: "Actions",
      type: "actions",
      width: 120,
      // Actions column (pinned right not supported in this MUI version)

      getActions: (params) => [
        <GridActionsCellItem
          icon={<ViewIcon />}
          label="View"
          onClick={() => handleViewClick(params.row)}
          color="primary"
        />,
        <GridActionsCellItem
          icon={<EditIcon />}
          label="Edit"
          onClick={() => handleEditClick(params.row)}
          color="primary"
        />,
        <GridActionsCellItem
          icon={<DeleteIcon />}
          label="Delete"
          onClick={() => handleDeleteClick(params.row)}
          color="error"
        />,
      ],
    },
  ]

  // Define editable fields configuration
  const editableFields = [
    { key: "userName", label: "Username", type: "text", colSpan: 1 },
    { key: "userFName", label: "First Name", type: "text", colSpan: 1 },
    { key: "userLName", label: "Last Name", type: "text", colSpan: 1 },
    { key: "email", label: "Email Address", type: "email", colSpan: 1 },
    { key: "address", label: "Address", type: "text", colSpan: 2 },
    { key: "homePhoneNumber", label: "Home Phone", type: "text", colSpan: 1 },
    { key: "workPhoneNumber", label: "Work Phone", type: "text", colSpan: 1 },
    { key: "fax", label: "Fax", type: "text", colSpan: 1 },
    { key: "zipCode", label: "Zip Code", type: "text", colSpan: 1 },
  ]

  // Render based on current view
  if (currentView === "view") {
    return (
      <Box sx={{ width: "100%" }}>
        {/* UserProfiles Component */}
        <Box sx={{ height: "calc(100vh - 80px)", overflow: "auto" }}>
          <UserProfiles handleBackToGrid={handleBackToGrid} />
        </Box>
      </Box>
    )
  }

  if (currentView === "delete") {
    return (
      <Box sx={{ width: "100%", height: "100vh" }}>
        {/* Header with Back Button */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            p: 2,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <IconButton onClick={handleBackToGrid} sx={{ mr: 2 }} size="large">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" component="h1" color="error">
            Delete Profile
          </Typography>
        </Box>

        {/* Delete Confirmation */}
        <Box sx={{ p: 3, height: "calc(100vh - 80px)", overflow: "auto" }}>
          {selectedRow && (
            <Box sx={{ maxWidth: 500, mx: "auto" }}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 3 }} color="error">
                  Confirm Deletion
                </Typography>

                <Typography variant="body1" sx={{ mb: 3 }}>
                  Are you sure you want to delete this profile? This action
                  cannot be undone.
                </Typography>

                <Box sx={{ p: 2, bgcolor: "grey.100", borderRadius: 1, mb: 4 }}>
                  <Typography>
                    <strong>Username:</strong> {selectedRow.userName}
                  </Typography>
                  <Typography>
                    <strong>Name:</strong> {selectedRow.userFName}{" "}
                    {selectedRow.userLName}
                  </Typography>
                  <Typography>
                    <strong>Email:</strong> {selectedRow.email}
                  </Typography>
                  <Typography>
                    <strong>Status:</strong> {selectedRow.status}
                  </Typography>
                </Box>

                <Typography variant="body2" color="error" sx={{ mb: 4 }}>
                  ⚠️ This action cannot be undone. The profile will be
                  permanently deleted.
                </Typography>

                <Box
                  sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}
                >
                  <Button
                    variant="outlined"
                    onClick={handleBackToGrid}
                    size="large"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={handleDeleteAndClose}
                    size="large"
                  >
                    Delete Profile
                  </Button>
                </Box>
              </Paper>
            </Box>
          )}
        </Box>
      </Box>
    )
  }

  // Default view - Data Grid with Edit Modal
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: "1400px",
        mx: "auto",
        height: { xs: "auto", md: "calc(100vh - 200px)" },
        display: "flex",
        flexDirection: "column",
        px: { xs: 1, sm: 2 },
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems="flex-start"
        sx={{ p: 1 }}
      >
        <TextField
          label="Search"
          variant="outlined"
          size="small"
          fullWidth
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch()
          }}
          autoFocus
        />
        <Button
          variant="contained"
          onClick={handleSearch}
          sx={{
            minWidth: { sm: 120 },
            width: { xs: "100%", sm: "auto" },
            height: 40,
            flexShrink: 0,
          }}
        >
          Search
        </Button>
        <Button
          variant="outlined"
          onClick={handleClear}
          sx={{
            minWidth: { sm: 120 },
            width: { xs: "100%", sm: "auto" },
            height: 40,
            flexShrink: 0,
          }}
        >
          Clear
        </Button>
      </Stack>

      <Box sx={{ flexGrow: 1, overflow: "auto" }}>
        <DataGrid
          rows={rows}
          columns={columnsWithActions}
          loading={loading}
          paginationMode="server"
          sortingMode="server"
          filterMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          sortModel={sortModel}
          onSortModelChange={setSortModel}
          filterModel={filterModel}
          onFilterModelChange={setFilterModel}
          rowCount={totalRows}
          pageSizeOptions={[20, 50, 100]}
          getRowId={(row) => row.customId}
          disableRowSelectionOnClick
          sx={{
            width: "100%",
            minWidth: "1000px",
            height: "100%",
            overflow: "auto",
            border: 0,
          }}
        />
      </Box>

      {/* Edit Modal */}
      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
        <div className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Edit User Information
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
              Update user details to keep the profile up-to-date.
            </p>
          </div>
          <form className="flex flex-col">
            <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
              <div>
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  Personal Information
                </h5>

                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  {editableFields.map((field) => (
                    <div
                      key={field.key}
                      className={
                        field.colSpan === 2
                          ? "col-span-2"
                          : "col-span-2 lg:col-span-1"
                      }
                    >
                      <Label>{field.label}</Label>
                      <Input
                        type={field.type}
                        value={editFormData[field.key] || ""}
                        onChange={(e) =>
                          handleInputChange(field.key, e.target.value)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-7">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  System Information
                </h5>

                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div>
                    <Label>User ID</Label>
                    <Input
                      type="text"
                      value={editFormData.userId || ""}
                      disabled
                      className="bg-gray-100 dark:bg-gray-800"
                    />
                  </div>

                  <div>
                    <Label>Status</Label>
                    <select
                      value={editFormData.status || ""}
                      onChange={(e) =>
                        handleInputChange("status", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  <div>
                    <Label>Super Admin</Label>
                    <select
                      value={editFormData.isSuperAdmin || ""}
                      onChange={(e) =>
                        handleInputChange("isSuperAdmin", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="small" variant="outlined" onClick={closeModal}>
                Close
              </Button>
              <Button size="small" onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </Box>
  )
}

export default ServerDataGrid