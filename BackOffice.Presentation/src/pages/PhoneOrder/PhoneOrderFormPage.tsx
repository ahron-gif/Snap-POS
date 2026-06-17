import React, { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useDashboardTabs } from "../../context/DashboardTabContext"
import { useStore } from "../../context/StoreContext"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges"
import { useTabFormCacheRead, useTabFormCacheWrite } from "../../hooks/useTabFormCache"
import { API_ENDPOINTS } from "../../constants/api"
import { SelectOption } from "../../components/form/SearchableSelect"
import ServerGrid from "../../components/common/ServerGrid/ServerGrid"
import { Column } from "../../components/common/ServerGrid/types/grid"
import "./PhoneOrderFormPage.css"

// Props interface
interface PhoneOrderFormPageProps {
  id?: string
  isNew?: boolean
  readOnly?: boolean
  /** Injected by DashboardTabContent */
  __tabId?: string
}

// Phone Order Entry interface
interface PhoneOrderEntry {
  phoneOrderEntryID: string
  itemStoreNo: string
  itemName: string
  upc: string
  modelNo: string
  qty: number
  uomType: number
  uomLabel: string
  uomPrice: number
  extPrice: number
  size: string
  note: string
  onHand: number
  spPrice: number
  listPrice: number
  markdown: number
  cost: number
  supplier: string
  department: string
  availQty: number
  method: string
  qtyPicked: number
  uomQtyPick: number
}

// Phone Order form data interface
interface PhoneOrderFormData {
  phoneOrderID: string
  phoneOrderNo: string
  customerID: string
  customerNo: string
  customerName: string
  customerPhone: string
  customerCell: string
  creditLimit: number
  balance: number
  lastVisit: string
  lastPayment: number
  lastCleared: string
  paymentNote: string
  groups: string
  orderDate: string
  orderTime: string
  shippingName: string
  shippingAddress: string
  cityStateZip: string
  zones: string
  shift: string
  deliveryDate: string
  driversNote: string
  freezer: boolean
  status: string
  orderNo: string
  pickBy: string
  transNo: string
  type: string
  takenBy: string
  pickNote: string
  priority: string
  total: number
  tender: string
  notes: string
  entries: PhoneOrderEntry[]
  // Customer account info
  over30: number
  over60: number
  over90: number
  over120: number
  current: number
  credit: number
  lockAccount: boolean
  lockOutDays: number
}

// Initial form data
const initialFormData: PhoneOrderFormData = {
  phoneOrderID: "",
  phoneOrderNo: "",
  customerID: "",
  customerNo: "",
  customerName: "",
  customerPhone: "",
  customerCell: "",
  creditLimit: 0,
  balance: 0,
  lastVisit: "",
  lastPayment: 0,
  lastCleared: "",
  paymentNote: "",
  groups: "",
  orderDate: new Date().toISOString().split("T")[0],
  orderTime: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
  shippingName: "Shipping Address",
  shippingAddress: "",
  cityStateZip: "",
  zones: "",
  shift: "",
  deliveryDate: new Date().toISOString().split("T")[0],
  driversNote: "DO NOT SHIP",
  freezer: false,
  status: "Open",
  orderNo: "",
  pickBy: "",
  transNo: "",
  type: "",
  takenBy: "",
  pickNote: "",
  priority: "Low Priority",
  total: 0,
  tender: "",
  notes: "",
  entries: [],
  over30: 0,
  over60: 0,
  over90: 0,
  over120: 0,
  current: 0,
  credit: 0,
  lockAccount: false,
  lockOutDays: 0,
}

// Previous order interface
interface PreviousOrder {
  date: string
  phoneOrderNo: string
  total: number
  transNo: string
}

// Customer search result interface (matches CustomerViewDto from backend)
interface CustomerSearchResult {
  customerID: string
  customerNo: string
  name: string
  firstName: string
  lastName: string
  address: string
  city: string
  state: string
  zip: string
  phone: string
  cell: string
  email: string
  credit: number
  balanceDoe: number
  lastVisit: string
  lastPayment: number
  lastDateCleared: string
  groupName: string
  over30: number
  over60: number
  over90: number
  over120: number
  current: number
  lockAccount: boolean
  lockOutDays: number
  dateCreated: string
}

// UOM options
const UOM_OPTIONS: SelectOption[] = [
  { value: "Pieces", label: "Pieces" },
  { value: "Cases", label: "Cases" },
  { value: "Each", label: "Each" },
  { value: "Pound", label: "Pound" },
]

// Priority options
const PRIORITY_OPTIONS: SelectOption[] = [
  { value: "Low Priority", label: "Low Priority" },
  { value: "Medium Priority", label: "Medium Priority" },
  { value: "High Priority", label: "High Priority" },
]

// Status options
const STATUS_OPTIONS: SelectOption[] = [
  { value: "Open", label: "Open" },
  { value: "Process", label: "Process" },
  { value: "Pick", label: "Pick" },
  { value: "Hold", label: "Hold" },
  { value: "Pick Hold", label: "Pick Hold" },
  { value: "Collecting", label: "Collecting" },
  { value: "Ready To Pick", label: "Ready To Pick" },
]

// Type options
const TYPE_OPTIONS: SelectOption[] = [
  { value: "", label: "" },
  { value: "Delivery", label: "Delivery" },
  { value: "Pickup", label: "Pickup" },
  { value: "Ship", label: "Ship" },
]

// Customer search grid columns - matches CustomerViewDto from backend
const CUSTOMER_SEARCH_COLUMNS: Column[] = [
  {
    field: "customerID",
    headerName: "Customer ID",
    width: 100,
    visible: false,
    dataType: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "customerNo",
    headerName: "Customer No",
    width: 120,
    visible: true,
    dataType: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "name",
    headerName: "Name",
    width: 180,
    visible: true,
    dataType: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "firstName",
    headerName: "First Name",
    width: 120,
    visible: false,
    dataType: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "lastName",
    headerName: "Last Name",
    width: 120,
    visible: false,
    dataType: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "address",
    headerName: "Address",
    width: 200,
    visible: true,
    dataType: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "city",
    headerName: "City",
    width: 120,
    visible: true,
    dataType: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "state",
    headerName: "State",
    width: 80,
    visible: true,
    dataType: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "zip",
    headerName: "Zip",
    width: 80,
    visible: true,
    dataType: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "phone",
    headerName: "Phone",
    width: 120,
    visible: true,
    dataType: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "cell",
    headerName: "Cell Phone",
    width: 120,
    visible: true,
    dataType: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "email",
    headerName: "Email",
    width: 180,
    visible: false,
    dataType: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "credit",
    headerName: "Credit",
    width: 100,
    visible: false,
    dataType: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) => value ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "balanceDoe",
    headerName: "Balance",
    width: 100,
    visible: false,
    dataType: "number",
    sortable: true,
    filterable: true,
    cellRenderer: (value: any) => value ? `$${Number(value).toFixed(2)}` : "$0.00",
  },
  {
    field: "lastVisit",
    headerName: "Last Visit",
    width: 120,
    visible: false,
    dataType: "datetime",
    sortable: true,
    filterable: true,
  },
  {
    field: "groupName",
    headerName: "Group",
    width: 100,
    visible: false,
    dataType: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "dateCreated",
    headerName: "Date Created",
    width: 120,
    visible: false,
    dataType: "datetime",
    sortable: true,
    filterable: true,
  },
]

// Shipping address grid columns - simplified with just Name and Address
const SHIPPING_ADDRESS_COLUMNS: Column[] = [
  {
    field: "customerID",
    headerName: "Customer ID",
    width: 100,
    visible: false,
    dataType: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "name",
    headerName: "Name",
    width: 200,
    visible: true,
    dataType: "string",
    sortable: true,
    filterable: true,
  },
  {
    field: "address",
    headerName: "Address",
    width: 300,
    visible: true,
    dataType: "string",
    sortable: true,
    filterable: true,
  },
]

const PhoneOrderFormPage: React.FC<PhoneOrderFormPageProps> = ({ id, isNew, readOnly, __tabId }) => {
  const { closeTab, activeTabId, openTab } = useDashboardTabs()
  const { currentStore } = useStore()
  const { getAuthHeaders } = useAuthHeaders()

  // ── Per-tab cache: preserves state across tab switches (in-memory only) ──
  interface PhoneOrderFormCache {
    formData: PhoneOrderFormData
    savedFormData: PhoneOrderFormData | null
  }
  const { initial: cachedTabState, hasCachedState } =
    useTabFormCacheRead<PhoneOrderFormCache>(__tabId)

  // State
  const [formData, setFormData] = useState<PhoneOrderFormData>(
    () => cachedTabState?.formData ?? initialFormData,
  )
  const [savedFormData, setSavedFormData] = useState<PhoneOrderFormData | null>(
    () => cachedTabState?.savedFormData ?? null,
  )
  const hasLoadedOnceRef = useRef(hasCachedState)

  useTabFormCacheWrite<PhoneOrderFormCache>(
    __tabId,
    hasLoadedOnceRef.current ? { formData, savedFormData } : null,
  )

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [previousOrders, setPreviousOrders] = useState<PreviousOrder[]>([])
  const [selectedEntryIndex, setSelectedEntryIndex] = useState<number | null>(null)
  const [customerSince, setCustomerSince] = useState<string>("")

  // Item entry state
  const [itemName, setItemName] = useState("")
  const [itemUpc, setItemUpc] = useState("")
  const [itemModelNo, setItemModelNo] = useState("")
  const [itemQty, setItemQty] = useState(1)
  const [itemUom, setItemUom] = useState("Pieces")
  const [itemNote, setItemNote] = useState("")

  // Customer search modal state
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [customerGridKey, setCustomerGridKey] = useState(0)
  const [selectedCustomerRows, setSelectedCustomerRows] = useState<Set<string>>(new Set())
  const [customerGridData, setCustomerGridData] = useState<CustomerSearchResult[]>([])

  // Header collapse state
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false)

  // Payment Note modal state
  const [showPaymentNoteModal, setShowPaymentNoteModal] = useState(false)
  const [paymentNoteText, setPaymentNoteText] = useState("")
  const [selectedPaymentNoteItem, setSelectedPaymentNoteItem] = useState<string | null>(null)
  const [paymentNoteList] = useState<string[]>([
    "1551",
    "Cash Only",
    "Check Required",
    "COD",
    "Credit Hold",
    "Net 30",
    "Net 60",
    "Prepaid",
  ])

  // Shipping Address modal state
  const [showShippingAddressModal, setShowShippingAddressModal] = useState(false)
  const [shippingAddressGridKey, setShippingAddressGridKey] = useState(0)
  const [selectedShippingAddressRows, setSelectedShippingAddressRows] = useState<Set<string>>(new Set())
  const [shippingAddressGridData, setShippingAddressGridData] = useState<CustomerSearchResult[]>([])

  // Zones control state
  const [showZonesDropdown, setShowZonesDropdown] = useState(false)
  const [showZonesModal, setShowZonesModal] = useState(false)
  const [availableZones, setAvailableZones] = useState<string[]>([])
  const [selectedZones, setSelectedZones] = useState<Set<string>>(new Set())
  const [newZoneValue, setNewZoneValue] = useState("")
  const [isLoadingZones, setIsLoadingZones] = useState(false)
  const zonesDropdownRef = useRef<HTMLDivElement>(null)

  // Shift control state
  const [showShiftDropdown, setShowShiftDropdown] = useState(false)
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [shiftPresets, setShiftPresets] = useState<{ phoneNoteIDVal: number; value: string; sortOrder: number }[]>([])
  const [selectedShiftPresetIndex, setSelectedShiftPresetIndex] = useState<number | null>(null)
  const [newShiftValue, setNewShiftValue] = useState("")
  const [newShiftSortOrder, setNewShiftSortOrder] = useState("")
  const [isLoadingShiftPresets, setIsLoadingShiftPresets] = useState(false)
  const shiftDropdownRef = useRef<HTMLDivElement>(null)

  // Driver Notes control state (Type=2)
  const [showDriverNotesDropdown, setShowDriverNotesDropdown] = useState(false)
  const [showDriverNotesModal, setShowDriverNotesModal] = useState(false)
  const [driverNotesPresets, setDriverNotesPresets] = useState<{ phoneNoteIDVal: number; value: string; sortOrder: number }[]>([])
  const [selectedDriverNoteIndex, setSelectedDriverNoteIndex] = useState<number | null>(null)
  const [newDriverNoteValue, setNewDriverNoteValue] = useState("")
  const [newDriverNoteSortOrder, setNewDriverNoteSortOrder] = useState("")
  const driverNotesDropdownRef = useRef<HTMLDivElement>(null)

  // Pick Notes control state (Type=3)
  const [showPickNotesDropdown, setShowPickNotesDropdown] = useState(false)
  const [showPickNotesModal, setShowPickNotesModal] = useState(false)
  const [pickNotesPresets, setPickNotesPresets] = useState<{ phoneNoteIDVal: number; value: string; sortOrder: number }[]>([])
  const [selectedPickNoteIndex, setSelectedPickNoteIndex] = useState<number | null>(null)
  const [newPickNoteValue, setNewPickNoteValue] = useState("")
  const [newPickNoteSortOrder, setNewPickNoteSortOrder] = useState("")
  const pickNotesDropdownRef = useRef<HTMLDivElement>(null)

  // Tender control state
  const [showTenderDropdown, setShowTenderDropdown] = useState(false)
  const [tenders, setTenders] = useState<{ tenderID: number; tenderName: string; sortOrder: number }[]>([])
  const [isLoadingTenders, setIsLoadingTenders] = useState(false)
  const tenderDropdownRef = useRef<HTMLDivElement>(null)

  // Pick By control state
  const [showPickByDropdown, setShowPickByDropdown] = useState(false)
  const [pickByUsers, setPickByUsers] = useState<{ userId: string; userName: string; displayName: string }[]>([])
  const [isLoadingPickByUsers, setIsLoadingPickByUsers] = useState(false)
  const pickByDropdownRef = useRef<HTMLDivElement>(null)

  // Memoized auth headers for ServerGrid
  const memoizedGetAuthHeaders = useMemo(() => getAuthHeaders, [getAuthHeaders])

  // Toast state
  const [toast, setToast] = useState<{
    show: boolean
    message: string
    type: "success" | "error" | "info"
    title: string
  }>({
    show: false,
    message: "",
    type: "success",
    title: "",
  })

  const isEditMode = id && !isNew

  // Show toast notification
  const showToast = useCallback((title: string, message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ show: true, message, type, title })
    setTimeout(() => {
      setToast({ show: false, message: "", type: "success", title: "" })
    }, 4000)
  }, [])

  // Close toast
  const closeToast = useCallback(() => {
    setToast({ show: false, message: "", type: "success", title: "" })
  }, [])

  // Handle input change
  const handleInputChange = useCallback((field: keyof PhoneOrderFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

  // Calculate total
  const calculateTotal = useCallback((entries: PhoneOrderEntry[]) => {
    return entries.reduce((sum, entry) => sum + (entry.extPrice || 0), 0)
  }, [])

  // Calculate total including tax (placeholder - actual tax calculation would need to be implemented)
  const totalIncludingTax = useMemo(() => {
    const subtotal = calculateTotal(formData.entries)
    const taxRate = 0.0375 // Example tax rate - should come from settings
    return subtotal * (1 + taxRate)
  }, [formData.entries, calculateTotal])

  // Load phone order data
  const loadPhoneOrder = useCallback(async () => {
    if (!id) return

    setIsLoading(true)
    try {
      const headers = getAuthHeaders()
      const response = await fetch(`${API_ENDPOINTS.PHONE_ORDERS.GET_BY_ID(id)}`, {
        method: "GET",
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          const order = data.response
          const loaded: PhoneOrderFormData = {
            phoneOrderID: order.phoneOrderID || "",
            phoneOrderNo: order.phoneOrderNo || "",
            customerID: order.customerID || "",
            customerNo: order.customerNo || "",
            customerName: `${order.firstName || ""} ${order.lastName || ""}`.trim(),
            customerPhone: order.phone || "",
            customerCell: order.cell || "",
            creditLimit: order.creditLimit || 0,
            balance: order.balanceDoe || 0,
            lastVisit: order.lastVisit || "",
            lastPayment: order.lastPayment || 0,
            lastCleared: order.lastCleared || "",
            paymentNote: order.paymentNote || "",
            groups: order.groups || "",
            orderDate: order.phoneOrderDate ? order.phoneOrderDate.split("T")[0] : "",
            orderTime: order.phoneOrderTime ? new Date(order.phoneOrderTime).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }) : "",
            shippingName: order.shippingName || "Shipping Address",
            shippingAddress: order.shippingAddress || "",
            cityStateZip: order.cityStateZip || "",
            zones: order.zones || "",
            shift: order.shiftID || "",
            deliveryDate: order.deliveryDate ? order.deliveryDate.split("T")[0] : "",
            driversNote: order.driversNote || "",
            freezer: order.freezer || false,
            status: order.phoneOrder_Status || "Open",
            orderNo: order.phoneOrderNo || "",
            pickBy: order.pickByID || "",
            transNo: order.transactionNo || "",
            type: order.phoneOrderType || "",
            takenBy: order.takenByUserName || "",
            pickNote: order.pickNote || "",
            priority: order.priority === 1 ? "High Priority" : order.priority === 2 ? "Medium Priority" : "Low Priority",
            total: order.total || 0,
            tender: order.tenderID?.toString() || "",
            notes: order.customerNote || "",
            entries: order.entries || [],
            over30: order.over30 || 0,
            over60: order.over60 || 0,
            over90: order.over90 || 0,
            over120: order.over120 || 0,
            current: order.current || 0,
            credit: order.credit || 0,
            lockAccount: order.lockAccount || false,
            lockOutDays: order.lockOutDays || 0,
          }
          setFormData(loaded)
          setSavedFormData(loaded)
          setCustomerSince(order.dateCreated ? new Date(order.dateCreated).toLocaleString() : "")
        }
      } else {
        showToast("Error", "Failed to load phone order", "error")
      }
    } catch (error) {
      console.error("Error loading phone order:", error)
      showToast("Error", "Failed to load phone order", "error")
    } finally {
      setIsLoading(false)
      hasLoadedOnceRef.current = true
    }
  }, [id, getAuthHeaders, showToast])

  // Load shift presets from API
  const loadShiftPresets = useCallback(async () => {
    setIsLoadingShiftPresets(true)
    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_SHIFT_PRESETS, {
        method: "GET",
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          const presets = data.response.map((preset: any) => ({
            phoneNoteIDVal: preset.phoneNoteIDVal,
            value: preset.value || "",
            sortOrder: preset.sort || 0,
          }))
          setShiftPresets(presets)
        }
      }
    } catch (error) {
      console.error("Error loading shift presets:", error)
    } finally {
      setIsLoadingShiftPresets(false)
    }
  }, [getAuthHeaders])

  // Load driver notes presets from API (Type=2)
  const loadDriverNotesPresets = useCallback(async () => {
    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_DRIVER_NOTES, {
        method: "GET",
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          const presets = data.response.map((preset: any) => ({
            phoneNoteIDVal: preset.phoneNoteIDVal,
            value: preset.value || "",
            sortOrder: preset.sort || 0,
          }))
          setDriverNotesPresets(presets)
        }
      }
    } catch (error) {
      console.error("Error loading driver notes presets:", error)
    }
  }, [getAuthHeaders])

  // Load pick notes presets from API (Type=3)
  const loadPickNotesPresets = useCallback(async () => {
    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_PICK_NOTES, {
        method: "GET",
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          const presets = data.response.map((preset: any) => ({
            phoneNoteIDVal: preset.phoneNoteIDVal,
            value: preset.value || "",
            sortOrder: preset.sort || 0,
          }))
          setPickNotesPresets(presets)
        }
      }
    } catch (error) {
      console.error("Error loading pick notes presets:", error)
    }
  }, [getAuthHeaders])

  // Load zones from API (CCRT values from CustomerAddresses)
  const loadZones = useCallback(async () => {
    setIsLoadingZones(true)
    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_ZONES, {
        method: "GET",
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          const zones = data.response.map((item: any) => item.zone || "")
          setAvailableZones(zones.filter((z: string) => z !== ""))
        }
      }
    } catch (error) {
      console.error("Error loading zones:", error)
    } finally {
      setIsLoadingZones(false)
    }
  }, [getAuthHeaders])

  // Load tenders from API (for phone order)
  const loadTenders = useCallback(async () => {
    setIsLoadingTenders(true)
    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_TENDERS, {
        method: "GET",
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          const tenderList = data.response.map((item: any) => ({
            tenderID: item.tenderID,
            tenderName: item.tenderName || "",
            sortOrder: item.sortOrder || 0,
          }))
          setTenders(tenderList)
        }
      }
    } catch (error) {
      console.error("Error loading tenders:", error)
    } finally {
      setIsLoadingTenders(false)
    }
  }, [getAuthHeaders])

  // Load Pick By users from API
  const loadPickByUsers = useCallback(async () => {
    if (!currentStore?.storeId) return

    setIsLoadingPickByUsers(true)
    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_USERS_FOR_PICK_BY(currentStore.storeId), {
        method: "GET",
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          const userList = data.response.map((item: any) => ({
            userId: item.userId,
            userName: item.userName || "",
            displayName: item.displayName || item.userName || "",
          }))
          setPickByUsers(userList)
        }
      }
    } catch (error) {
      console.error("Error loading Pick By users:", error)
    } finally {
      setIsLoadingPickByUsers(false)
    }
  }, [getAuthHeaders, currentStore?.storeId])

  // Load data on mount
  useEffect(() => {
    // Per-tab cache hit: formData + savedFormData restored via useState
    // initializers. Skip the per-order fetch and flag loaded so future edits
    // get mirrored into the cache. Lookups (presets, zones, tenders, users)
    // still re-run since they're catalog data that may have changed.
    if (hasCachedState) {
      hasLoadedOnceRef.current = true
    } else if (isEditMode) {
      loadPhoneOrder()
    } else {
      setSavedFormData(initialFormData)
      hasLoadedOnceRef.current = true
    }
    loadShiftPresets()
    loadDriverNotesPresets()
    loadPickNotesPresets()
    loadZones()
    loadTenders()
    loadPickByUsers()
  }, [isEditMode, hasCachedState, loadPhoneOrder, loadShiftPresets, loadDriverNotesPresets, loadPickNotesPresets, loadZones, loadTenders, loadPickByUsers])

  // Handle save
  const handleSave = useCallback(async (): Promise<boolean> => {
    setIsSaving(true)
    try {
      const headers = getAuthHeaders()
      const url = isEditMode
        ? API_ENDPOINTS.PHONE_ORDERS.UPDATE(formData.phoneOrderID)
        : API_ENDPOINTS.PHONE_ORDERS.CREATE

      const payload = {
        ...formData,
        storeID: currentStore?.storeId,
        phoneOrderStatus: STATUS_OPTIONS.findIndex((s) => s.value === formData.status),
        priority: formData.priority === "High Priority" ? 1 : formData.priority === "Medium Priority" ? 2 : 3,
      }

      const response = await fetch(url, {
        method: isEditMode ? "PUT" : "POST",
        headers,
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess) {
          showToast("Success", `Phone order ${isEditMode ? "updated" : "created"} successfully`, "success")
          if (!isEditMode && data.response?.phoneOrderID) {
            const updated: PhoneOrderFormData = {
              ...formData,
              phoneOrderID: data.response.phoneOrderID,
              phoneOrderNo: data.response.phoneOrderNo,
            }
            setFormData(updated)
            setSavedFormData(updated)
          } else {
            setSavedFormData(formData)
          }
          return true
        } else {
          showToast("Error", data.message || "Failed to save phone order", "error")
          return false
        }
      } else {
        showToast("Error", "Failed to save phone order", "error")
        return false
      }
    } catch (error) {
      console.error("Error saving phone order:", error)
      showToast("Error", "Failed to save phone order", "error")
      return false
    } finally {
      setIsSaving(false)
    }
  }, [formData, isEditMode, getAuthHeaders, currentStore?.storeId, showToast])

  // Unsaved-changes wiring — only the persisted `formData` counts as dirty;
  // transient UI state (item-entry draft fields, modal open flags, selected
  // grid rows, dropdown flags) is intentionally excluded.
  useUnsavedChanges<PhoneOrderFormData>({
    tabId: __tabId,
    formData,
    initialSnapshot: savedFormData,
    saveHandler: async () => {
      const ok = await handleSave()
      if (!ok) throw new Error("Could not save phone order. Please fix any validation errors and try again.")
    },
  })

  // Handle Save & New
  const handleSaveAndNew = useCallback(async () => {
    await handleSave()
    setFormData(initialFormData)
    setItemName("")
    setItemUpc("")
    setItemModelNo("")
    setItemQty(1)
    setItemUom("Pieces")
    setItemNote("")
  }, [handleSave])

  // Handle Save & Close
  const handleSaveAndClose = useCallback(async () => {
    await handleSave()
    if (activeTabId) {
      closeTab(activeTabId)
    }
  }, [handleSave, activeTabId, closeTab])

  // Handle Cancel
  const handleCancel = useCallback(() => {
    if (activeTabId) {
      closeTab(activeTabId)
    }
  }, [activeTabId, closeTab])

  // Handle Add Item
  const handleAddItem = useCallback(() => {
    if (!itemName && !itemUpc) {
      showToast("Warning", "Please enter item name or UPC", "info")
      return
    }

    const newEntry: PhoneOrderEntry = {
      phoneOrderEntryID: `temp-${Date.now()}`,
      itemStoreNo: "",
      itemName: itemName,
      upc: itemUpc,
      modelNo: itemModelNo,
      qty: itemQty,
      uomType: UOM_OPTIONS.findIndex((u) => u.value === itemUom),
      uomLabel: itemUom,
      uomPrice: 0,
      extPrice: 0,
      size: "",
      note: itemNote,
      onHand: 0,
      spPrice: 0,
      listPrice: 0,
      markdown: 0,
      cost: 0,
      supplier: "",
      department: "",
      availQty: 0,
      method: "Requested",
      qtyPicked: 0,
      uomQtyPick: 0,
    }

    setFormData((prev) => ({
      ...prev,
      entries: [...prev.entries, newEntry],
      total: calculateTotal([...prev.entries, newEntry]),
    }))

    // Clear entry fields
    setItemName("")
    setItemUpc("")
    setItemModelNo("")
    setItemQty(1)
    setItemNote("")
  }, [itemName, itemUpc, itemModelNo, itemQty, itemUom, itemNote, calculateTotal, showToast])

  // Handle remove entry
  const handleRemoveEntry = useCallback((index: number) => {
    setFormData((prev) => {
      const newEntries = prev.entries.filter((_, i) => i !== index)
      return {
        ...prev,
        entries: newEntries,
        total: calculateTotal(newEntries),
      }
    })
    setSelectedEntryIndex(null)
  }, [calculateTotal])

  // Handle Sales Details button - opens customer sales details in new tab
  const handleSalesDetails = useCallback(() => {
    if (!formData.customerID) {
      showToast("Warning", "Please select a customer first", "info")
      return
    }
    openTab({
      title: `Sales Details - ${formData.customerName || formData.customerNo}`,
      component: "CustomerSalesDetailsPage",
      props: { customerId: formData.customerID, customerName: formData.customerName },
      closable: true
    })
  }, [formData.customerID, formData.customerName, formData.customerNo, openTab, showToast])

  // Handle Item Sales button - opens item sales history in new tab
  const handleItemSales = useCallback(() => {
    if (!formData.customerID) {
      showToast("Warning", "Please select a customer first", "info")
      return
    }
    openTab({
      title: `Item Sales - ${formData.customerName || formData.customerNo}`,
      component: "CustomerItemSalesPage",
      props: { customerId: formData.customerID, customerName: formData.customerName },
      closable: true
    })
  }, [formData.customerID, formData.customerName, formData.customerNo, openTab, showToast])

  // Handle Show Aging button - opens aging report in new tab
  const handleShowAging = useCallback(() => {
    if (!formData.customerID) {
      showToast("Warning", "Please select a customer first", "info")
      return
    }
    openTab({
      title: `Aging - ${formData.customerName || formData.customerNo}`,
      component: "CustomerAgingPage",
      props: { customerId: formData.customerID, customerName: formData.customerName },
      closable: true
    })
  }, [formData.customerID, formData.customerName, formData.customerNo, openTab, showToast])

  // Open customer search modal
  const handleOpenCustomerSearch = useCallback(() => {
    setShowCustomerSearch(true)
    setSelectedCustomerRows(new Set())
    setCustomerGridData([])
    setCustomerGridKey((prev) => prev + 1)
  }, [])

  // Handle creating new customer - opens in new tab
  const handleCreateNewCustomer = useCallback(() => {
    openTab({
      title: "New Customer",
      component: "CustomerFormPage",
      props: { isNew: true },
      closable: true
    })
  }, [openTab])

  // Handle editing current customer - opens in new tab
  const handleEditCustomer = useCallback(() => {
    if (!formData.customerID) {
      showToast("Warning", "Please select a customer first", "info")
      return
    }
    openTab({
      title: `Edit Customer - ${formData.customerName || formData.customerNo}`,
      component: "CustomerFormPage",
      props: { id: formData.customerID },
      closable: true
    })
  }, [formData.customerID, formData.customerName, formData.customerNo, openTab, showToast])

  // Handle reset customer selection
  const handleResetCustomer = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      customerID: "",
      customerNo: "",
      customerName: "",
      customerPhone: "",
      customerCell: "",
      creditLimit: 0,
      balance: 0,
      lastVisit: "",
      lastPayment: 0,
      lastCleared: "",
      groups: "",
      paymentNote: "",
      shippingName: "",
      shippingAddress: "",
      cityStateZip: "",
      over30: 0,
      over60: 0,
      over90: 0,
      over120: 0,
      current: 0,
      credit: 0,
      lockAccount: false,
      lockOutDays: 0,
    }))
    setCustomerSince("")
    setPreviousOrders([])
  }, [])

  // Payment Note modal handlers
  const handleOpenPaymentNoteModal = useCallback(() => {
    setPaymentNoteText(formData.paymentNote)
    setSelectedPaymentNoteItem(null)
    setShowPaymentNoteModal(true)
  }, [formData.paymentNote])

  const handleClosePaymentNoteModal = useCallback(() => {
    setShowPaymentNoteModal(false)
  }, [])

  const handlePaymentNoteOk = useCallback(() => {
    handleInputChange("paymentNote", paymentNoteText)
    setShowPaymentNoteModal(false)
  }, [handleInputChange, paymentNoteText])

  const handleSelectPaymentNoteItem = useCallback((note: string) => {
    setSelectedPaymentNoteItem(note)
    // Append to text or replace - here we'll append on new line if text exists
    setPaymentNoteText(prev => prev ? `${prev}\n${note}` : note)
  }, [])

  // Shipping Address modal handlers
  const handleOpenShippingAddressModal = useCallback(() => {
    if (!formData.customerID) {
      showToast("Warning", "Please select a customer first", "info")
      return
    }
    setShowShippingAddressModal(true)
    setSelectedShippingAddressRows(new Set())
    setShippingAddressGridData([])
    setShippingAddressGridKey((prev) => prev + 1)
  }, [formData.customerID, showToast])

  const handleCloseShippingAddressModal = useCallback(() => {
    setShowShippingAddressModal(false)
    setSelectedShippingAddressRows(new Set())
    setShippingAddressGridData([])
  }, [])

  const handleShippingAddressRowSelection = useCallback((rowId: string) => {
    setSelectedShippingAddressRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(rowId)) {
        newSet.delete(rowId)
      } else {
        newSet.clear()
        newSet.add(rowId)
      }
      return newSet
    })
  }, [])

  const handleShippingAddressGridDataChange = useCallback((data: any[]) => {
    setShippingAddressGridData(data)
  }, [])

  const handleSelectShippingAddress = useCallback(() => {
    if (selectedShippingAddressRows.size === 0) {
      showToast("Warning", "Please select an address first", "info")
      return
    }

    const selectedId = Array.from(selectedShippingAddressRows)[0]
    const customer = shippingAddressGridData.find((c) => c.customerID === selectedId || c.customerNo === selectedId)

    if (customer) {
      setFormData((prev) => ({
        ...prev,
        shippingName: customer.name || `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
        shippingAddress: customer.address || "",
        cityStateZip: `${customer.city || ""}, ${customer.state || ""} ${customer.zip || ""}`.trim(),
      }))
      setShowShippingAddressModal(false)
      showToast("Success", `Shipping address selected`, "success")
    }
  }, [selectedShippingAddressRows, shippingAddressGridData, showToast])

  // Zones control handlers
  const handleToggleZonesDropdown = useCallback(() => {
    setShowZonesDropdown((prev) => !prev)
  }, [])

  const handleCloseZonesDropdown = useCallback(() => {
    setShowZonesDropdown(false)
  }, [])

  const handleToggleZone = useCallback((zone: string) => {
    setSelectedZones((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(zone)) {
        newSet.delete(zone)
      } else {
        newSet.add(zone)
      }
      // Update formData.zones with selected zones
      const zonesString = Array.from(newSet).join(", ")
      handleInputChange("zones", zonesString)
      return newSet
    })
  }, [handleInputChange])

  const handleSelectAllZones = useCallback(() => {
    if (selectedZones.size === availableZones.length) {
      // Deselect all
      setSelectedZones(new Set())
      handleInputChange("zones", "")
    } else {
      // Select all
      setSelectedZones(new Set(availableZones))
      handleInputChange("zones", availableZones.join(", "))
    }
  }, [availableZones, selectedZones.size, handleInputChange])

  const handleZonesDropdownOk = useCallback(() => {
    setShowZonesDropdown(false)
  }, [])

  const handleOpenZonesModal = useCallback(() => {
    setShowZonesModal(true)
    setNewZoneValue("")
  }, [])

  const handleCloseZonesModal = useCallback(() => {
    setShowZonesModal(false)
    setNewZoneValue("")
  }, [])

  const handleAddNewZone = useCallback(() => {
    if (newZoneValue.trim() && !availableZones.includes(newZoneValue.trim())) {
      setAvailableZones((prev) => [...prev, newZoneValue.trim()])
      setNewZoneValue("")
    }
  }, [newZoneValue, availableZones])

  const handleZonesModalOk = useCallback(() => {
    setShowZonesModal(false)
  }, [])

  // Close zones dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (zonesDropdownRef.current && !zonesDropdownRef.current.contains(event.target as Node)) {
        setShowZonesDropdown(false)
      }
    }
    if (showZonesDropdown) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showZonesDropdown])

  // Shift control handlers
  const handleToggleShiftDropdown = useCallback(() => {
    setShowShiftDropdown((prev) => !prev)
  }, [])

  const handleCloseShiftDropdown = useCallback(() => {
    setShowShiftDropdown(false)
  }, [])

  const handleSelectShift = useCallback((shiftValue: string) => {
    handleInputChange("shift", shiftValue)
    setShowShiftDropdown(false)
  }, [handleInputChange])

  const handleOpenShiftModal = useCallback(() => {
    setShowShiftModal(true)
    setNewShiftValue("")
    setNewShiftSortOrder("")
    setSelectedShiftPresetIndex(null)
  }, [])

  const handleCloseShiftModal = useCallback(() => {
    setShowShiftModal(false)
    setNewShiftValue("")
    setNewShiftSortOrder("")
    setSelectedShiftPresetIndex(null)
  }, [])

  const handleAddNewShiftPreset = useCallback(() => {
    if (newShiftValue.trim()) {
      const sortOrder = parseInt(newShiftSortOrder) || (shiftPresets.length > 0 ? Math.max(...shiftPresets.map(p => p.sortOrder)) + 1 : 1)
      // Generate a temporary negative ID for new presets (will be assigned real ID when saved to DB)
      const tempId = shiftPresets.length > 0 ? Math.min(...shiftPresets.map(p => p.phoneNoteIDVal), 0) - 1 : -1
      setShiftPresets((prev) => [...prev, { phoneNoteIDVal: tempId, value: newShiftValue.trim(), sortOrder }].sort((a, b) => a.sortOrder - b.sortOrder))
      setNewShiftValue("")
      setNewShiftSortOrder("")
    }
  }, [newShiftValue, newShiftSortOrder, shiftPresets])

  const handleDeleteShiftPreset = useCallback(() => {
    if (selectedShiftPresetIndex !== null) {
      setShiftPresets((prev) => prev.filter((_, i) => i !== selectedShiftPresetIndex))
      setSelectedShiftPresetIndex(null)
    }
  }, [selectedShiftPresetIndex])

  const handleShiftModalSave = useCallback(async () => {
    try {
      const headers = getAuthHeaders()
      const payload = {
        type: 0, // Shift presets
        notes: shiftPresets.map(preset => ({
          phoneNoteIDVal: preset.phoneNoteIDVal > 0 ? preset.phoneNoteIDVal : null,
          value: preset.value,
          type: 0,
          sort: preset.sortOrder
        }))
      }

      const response = await fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.SAVE_PHONE_NOTES_BATCH, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          const presets = data.response.map((preset: any) => ({
            phoneNoteIDVal: preset.phoneNoteIDVal,
            value: preset.value || "",
            sortOrder: preset.sort || 0,
          }))
          setShiftPresets(presets)
          showToast("Success", "Shift presets saved successfully", "success")
        }
      } else {
        showToast("Error", "Failed to save shift presets", "error")
      }
    } catch (error) {
      console.error("Error saving shift presets:", error)
      showToast("Error", "Failed to save shift presets", "error")
    }
    setShowShiftModal(false)
  }, [getAuthHeaders, shiftPresets, showToast])

  // Close shift dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shiftDropdownRef.current && !shiftDropdownRef.current.contains(event.target as Node)) {
        setShowShiftDropdown(false)
      }
    }
    if (showShiftDropdown) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showShiftDropdown])

  // Driver Notes control handlers
  const handleToggleDriverNotesDropdown = useCallback(() => {
    setShowDriverNotesDropdown((prev) => !prev)
  }, [])

  const handleSelectDriverNote = useCallback((noteValue: string) => {
    handleInputChange("driversNote", noteValue)
    setShowDriverNotesDropdown(false)
  }, [handleInputChange])

  const handleOpenDriverNotesModal = useCallback(() => {
    setShowDriverNotesModal(true)
    setNewDriverNoteValue("")
    setNewDriverNoteSortOrder("")
    setSelectedDriverNoteIndex(null)
  }, [])

  const handleCloseDriverNotesModal = useCallback(() => {
    setShowDriverNotesModal(false)
    setNewDriverNoteValue("")
    setNewDriverNoteSortOrder("")
    setSelectedDriverNoteIndex(null)
  }, [])

  const handleAddNewDriverNote = useCallback(() => {
    if (newDriverNoteValue.trim()) {
      const sortOrder = parseInt(newDriverNoteSortOrder) || (driverNotesPresets.length > 0 ? Math.max(...driverNotesPresets.map(p => p.sortOrder)) + 1 : 1)
      const tempId = driverNotesPresets.length > 0 ? Math.min(...driverNotesPresets.map(p => p.phoneNoteIDVal), 0) - 1 : -1
      setDriverNotesPresets((prev) => [...prev, { phoneNoteIDVal: tempId, value: newDriverNoteValue.trim(), sortOrder }].sort((a, b) => a.sortOrder - b.sortOrder))
      setNewDriverNoteValue("")
      setNewDriverNoteSortOrder("")
    }
  }, [newDriverNoteValue, newDriverNoteSortOrder, driverNotesPresets])

  const handleDeleteDriverNote = useCallback(() => {
    if (selectedDriverNoteIndex !== null) {
      setDriverNotesPresets((prev) => prev.filter((_, i) => i !== selectedDriverNoteIndex))
      setSelectedDriverNoteIndex(null)
    }
  }, [selectedDriverNoteIndex])

  const handleDriverNotesModalSave = useCallback(async () => {
    try {
      const headers = getAuthHeaders()
      const payload = {
        type: 2, // Driver Notes
        notes: driverNotesPresets.map(preset => ({
          phoneNoteIDVal: preset.phoneNoteIDVal > 0 ? preset.phoneNoteIDVal : null,
          value: preset.value,
          type: 2,
          sort: preset.sortOrder
        }))
      }

      const response = await fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.SAVE_PHONE_NOTES_BATCH, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          const presets = data.response.map((preset: any) => ({
            phoneNoteIDVal: preset.phoneNoteIDVal,
            value: preset.value || "",
            sortOrder: preset.sort || 0,
          }))
          setDriverNotesPresets(presets)
          showToast("Success", "Driver notes saved successfully", "success")
        }
      } else {
        showToast("Error", "Failed to save driver notes", "error")
      }
    } catch (error) {
      console.error("Error saving driver notes:", error)
      showToast("Error", "Failed to save driver notes", "error")
    }
    setShowDriverNotesModal(false)
  }, [getAuthHeaders, driverNotesPresets, showToast])

  // Close driver notes dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (driverNotesDropdownRef.current && !driverNotesDropdownRef.current.contains(event.target as Node)) {
        setShowDriverNotesDropdown(false)
      }
    }
    if (showDriverNotesDropdown) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showDriverNotesDropdown])

  // Pick Notes control handlers
  const handleTogglePickNotesDropdown = useCallback(() => {
    setShowPickNotesDropdown((prev) => !prev)
  }, [])

  const handleSelectPickNote = useCallback((noteValue: string) => {
    handleInputChange("pickNote", noteValue)
    setShowPickNotesDropdown(false)
  }, [handleInputChange])

  const handleOpenPickNotesModal = useCallback(() => {
    setShowPickNotesModal(true)
    setNewPickNoteValue("")
    setNewPickNoteSortOrder("")
    setSelectedPickNoteIndex(null)
  }, [])

  const handleClosePickNotesModal = useCallback(() => {
    setShowPickNotesModal(false)
    setNewPickNoteValue("")
    setNewPickNoteSortOrder("")
    setSelectedPickNoteIndex(null)
  }, [])

  const handleAddNewPickNote = useCallback(() => {
    if (newPickNoteValue.trim()) {
      const sortOrder = parseInt(newPickNoteSortOrder) || (pickNotesPresets.length > 0 ? Math.max(...pickNotesPresets.map(p => p.sortOrder)) + 1 : 1)
      const tempId = pickNotesPresets.length > 0 ? Math.min(...pickNotesPresets.map(p => p.phoneNoteIDVal), 0) - 1 : -1
      setPickNotesPresets((prev) => [...prev, { phoneNoteIDVal: tempId, value: newPickNoteValue.trim(), sortOrder }].sort((a, b) => a.sortOrder - b.sortOrder))
      setNewPickNoteValue("")
      setNewPickNoteSortOrder("")
    }
  }, [newPickNoteValue, newPickNoteSortOrder, pickNotesPresets])

  const handleDeletePickNote = useCallback(() => {
    if (selectedPickNoteIndex !== null) {
      setPickNotesPresets((prev) => prev.filter((_, i) => i !== selectedPickNoteIndex))
      setSelectedPickNoteIndex(null)
    }
  }, [selectedPickNoteIndex])

  const handlePickNotesModalSave = useCallback(async () => {
    try {
      const headers = getAuthHeaders()
      const payload = {
        type: 3, // Pick Notes
        notes: pickNotesPresets.map(preset => ({
          phoneNoteIDVal: preset.phoneNoteIDVal > 0 ? preset.phoneNoteIDVal : null,
          value: preset.value,
          type: 3,
          sort: preset.sortOrder
        }))
      }

      const response = await fetch(API_ENDPOINTS.SYSTEM_LOOKUPS.SAVE_PHONE_NOTES_BATCH, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          const presets = data.response.map((preset: any) => ({
            phoneNoteIDVal: preset.phoneNoteIDVal,
            value: preset.value || "",
            sortOrder: preset.sort || 0,
          }))
          setPickNotesPresets(presets)
          showToast("Success", "Pick notes saved successfully", "success")
        }
      } else {
        showToast("Error", "Failed to save pick notes", "error")
      }
    } catch (error) {
      console.error("Error saving pick notes:", error)
      showToast("Error", "Failed to save pick notes", "error")
    }
    setShowPickNotesModal(false)
  }, [getAuthHeaders, pickNotesPresets, showToast])

  // Close pick notes dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickNotesDropdownRef.current && !pickNotesDropdownRef.current.contains(event.target as Node)) {
        setShowPickNotesDropdown(false)
      }
    }
    if (showPickNotesDropdown) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showPickNotesDropdown])

  // Tender control handlers
  const handleToggleTenderDropdown = useCallback(() => {
    setShowTenderDropdown((prev) => !prev)
  }, [])

  const handleSelectTender = useCallback((tenderID: number, tenderName: string) => {
    handleInputChange("tender", tenderID.toString())
    setShowTenderDropdown(false)
  }, [handleInputChange])

  // Close tender dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tenderDropdownRef.current && !tenderDropdownRef.current.contains(event.target as Node)) {
        setShowTenderDropdown(false)
      }
    }
    if (showTenderDropdown) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showTenderDropdown])

  // Pick By control handlers
  const handleTogglePickByDropdown = useCallback(() => {
    setShowPickByDropdown((prev) => !prev)
  }, [])

  const handleSelectPickBy = useCallback((userId: string, displayName: string) => {
    handleInputChange("pickBy", userId)
    setShowPickByDropdown(false)
  }, [handleInputChange])

  // Close Pick By dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickByDropdownRef.current && !pickByDropdownRef.current.contains(event.target as Node)) {
        setShowPickByDropdown(false)
      }
    }
    if (showPickByDropdown) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showPickByDropdown])

  // Handle customer row selection from ServerGrid
  const handleCustomerRowSelection = useCallback((rowId: string) => {
    setSelectedCustomerRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(rowId)) {
        newSet.delete(rowId)
      } else {
        // Clear previous selection and select only this row
        newSet.clear()
        newSet.add(rowId)
      }
      return newSet
    })
  }, [])

  // Handle customer grid data change
  const handleCustomerGridDataChange = useCallback((data: any[]) => {
    setCustomerGridData(data)
  }, [])

  // Fetch previous orders for a customer
  const fetchPreviousOrders = useCallback(async (customerId: string) => {
    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.PHONE_ORDERS.GET_PREVIOUS_ORDERS(customerId), {
        headers,
      })
      if (response.ok) {
        const data = await response.json()
        if (data.isSuccess && data.response) {
          const orders: PreviousOrder[] = data.response.map((order: any) => ({
            date: order.orderDate ? new Date(order.orderDate).toLocaleDateString() : "",
            phoneOrderNo: order.phoneOrderNo || "",
            total: order.total || 0,
            transNo: order.transNo || "",
          }))
          setPreviousOrders(orders)
        }
      }
    } catch (error) {
      console.error("Error fetching previous orders:", error)
      // Set empty array on error - don't show toast as it's not critical
      setPreviousOrders([])
    }
  }, [getAuthHeaders])

  // Select customer from grid selection
  const handleSelectCustomerFromGrid = useCallback(() => {
    if (selectedCustomerRows.size === 0) {
      showToast("Warning", "Please select a customer first", "info")
      return
    }

    const selectedId = Array.from(selectedCustomerRows)[0]
    const customer = customerGridData.find((c) => c.customerID === selectedId || c.customerNo === selectedId)

    if (customer) {
      const customerName = customer.name || `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
      const customerAddress = customer.address || ""
      const customerCityStateZip = `${customer.city || ""}, ${customer.state || ""} ${customer.zip || ""}`.trim()

      setFormData((prev) => ({
        ...prev,
        customerID: customer.customerID,
        customerNo: customer.customerNo,
        customerName: customerName,
        customerPhone: customer.phone || "",
        customerCell: customer.cell || "",
        creditLimit: customer.credit || 0,
        balance: customer.balanceDoe || 0,
        lastVisit: customer.lastVisit || "",
        lastPayment: customer.lastPayment || 0,
        lastCleared: customer.lastDateCleared || "",
        groups: customer.groupName || "",
        paymentNote: "",
        // Auto-fill shipping address with customer address
        shippingName: customerName,
        shippingAddress: customerAddress,
        cityStateZip: customerCityStateZip,
        over30: customer.over30 || 0,
        over60: customer.over60 || 0,
        over90: customer.over90 || 0,
        over120: customer.over120 || 0,
        current: customer.current || 0,
        credit: customer.credit || 0,
        lockAccount: customer.lockAccount || false,
        lockOutDays: customer.lockOutDays || 0,
      }))
      setCustomerSince(customer.dateCreated ? new Date(customer.dateCreated).toLocaleString() : "")
      setShowCustomerSearch(false)
      showToast("Success", `Customer "${customer.name || customer.customerNo}" selected`, "success")

      // Fetch previous orders for this customer
      if (customer.customerID) {
        fetchPreviousOrders(customer.customerID)
      }
    }
  }, [selectedCustomerRows, customerGridData, showToast, fetchPreviousOrders])

  // Close customer search modal
  const handleCloseCustomerSearch = useCallback(() => {
    setShowCustomerSearch(false)
    setSelectedCustomerRows(new Set())
    setCustomerGridData([])
  }, [])

  // Handle entry update
  const handleEntryUpdate = useCallback((index: number, field: keyof PhoneOrderEntry, value: any) => {
    setFormData((prev) => {
      const newEntries = [...prev.entries]
      newEntries[index] = { ...newEntries[index], [field]: value }

      // Recalculate ext price if qty or uomPrice changed
      if (field === "qty" || field === "uomPrice") {
        newEntries[index].extPrice = newEntries[index].qty * newEntries[index].uomPrice
      }

      return {
        ...prev,
        entries: newEntries,
        total: calculateTotal(newEntries),
      }
    })
  }, [calculateTotal])

  // Grid summary calculations
  const gridSummary = useMemo(() => {
    const totalQty = formData.entries.reduce((sum, e) => sum + e.qty, 0)
    const totalExtPrice = formData.entries.reduce((sum, e) => sum + e.extPrice, 0)
    const totalCost = formData.entries.reduce((sum, e) => sum + e.cost * e.qty, 0)
    return { totalQty, totalExtPrice, totalCost }
  }, [formData.entries])

  return (
    <div className="phone-order-form">
      {/* Toast Notification */}
      {toast.show && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <div className="toast-icon">
              {toast.type === "success" && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#28a745" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              )}
              {toast.type === "error" && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
              {toast.type === "info" && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0078d4" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              )}
            </div>
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button className="toast-close" onClick={closeToast}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      )}

      {/* Customer Search Modal */}
      {showCustomerSearch && (
        <div className="customer-search-modal-overlay" onClick={handleCloseCustomerSearch}>
          <div className="customer-search-modal-grid" onClick={(e) => e.stopPropagation()}>
            <div className="customer-search-header">
              <h3>Search Customer</h3>
              <button className="modal-close-btn" onClick={handleCloseCustomerSearch}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="customer-search-grid-container" style={{ height: 'calc(100% - 90px)', minHeight: '400px' }}>
              <ServerGrid
                key={customerGridKey}
                data={[]}
                columns={CUSTOMER_SEARCH_COLUMNS}
                loading={false}
                error={null}
                totalRecords={0}
                onRefresh={() => {}}
                pagination={false}
                pageSize={50}
                editable={false}
                columnChooser={true}
                title=""
                emptyMessage="No customers found"
                emptyIcon="👥"
                serverSide={true}
                apiUrl={API_ENDPOINTS.CUSTOMER.GET_ALL_CUSTOMERS}
                methodType="GET"
                getAuthHeaders={memoizedGetAuthHeaders}
                defaultSortColumn="customerNo"
                containerWidth="100%"
                showCheckboxes={true}
                selectedRows={selectedCustomerRows}
                onRowSelection={handleCustomerRowSelection}
                getRowId={(row) => row.customerID || row.customerNo}
                headerSearch={true}
                infiniteScroll={true}
                onDataChange={handleCustomerGridDataChange}
              />
            </div>
            <div className="customer-search-footer">
              <button
                className="add-new-btn"
                onClick={() => {
                  handleCloseCustomerSearch()
                  // Could open a new customer form here
                }}
              >
                Add New
              </button>
              <button
                className="select-btn"
                onClick={handleSelectCustomerFromGrid}
                disabled={selectedCustomerRows.size === 0}
              >
                Select
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Note Modal */}
      {showPaymentNoteModal && (
        <div className="payment-note-modal-overlay" onClick={handleClosePaymentNoteModal}>
          <div className="payment-note-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payment-note-modal-header">
              <span>Payment Note</span>
              <button className="modal-close-btn" onClick={handleClosePaymentNoteModal}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="payment-note-modal-body">
              <div className="payment-note-editor-section">
                <textarea
                  value={paymentNoteText}
                  onChange={(e) => setPaymentNoteText(e.target.value)}
                  className="payment-note-textarea"
                  placeholder="Enter payment note..."
                  autoFocus
                />
              </div>
              <div className="payment-note-list-section">
                <div className="payment-note-list-items">
                  {paymentNoteList.map((note, index) => (
                    <div
                      key={index}
                      className={`payment-note-list-item ${selectedPaymentNoteItem === note ? 'selected' : ''}`}
                      onClick={() => handleSelectPaymentNoteItem(note)}
                    >
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="payment-note-modal-footer">
              <button className="payment-note-ok-btn" onClick={handlePaymentNoteOk}>OK</button>
              <button className="payment-note-cancel-btn" onClick={handleClosePaymentNoteModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Address Modal */}
      {showShippingAddressModal && (
        <div className="customer-search-modal-overlay" onClick={handleCloseShippingAddressModal}>
          <div className="shipping-address-modal" onClick={(e) => e.stopPropagation()}>
            <div className="customer-search-header">
              <h3>Select Shipping Address</h3>
              <button className="modal-close-btn" onClick={handleCloseShippingAddressModal}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="shipping-address-grid-container">
              <ServerGrid
                key={shippingAddressGridKey}
                data={[]}
                columns={SHIPPING_ADDRESS_COLUMNS}
                loading={false}
                error={null}
                totalRecords={0}
                onRefresh={() => {}}
                pagination={false}
                pageSize={50}
                editable={false}
                columnChooser={false}
                title=""
                emptyMessage="No addresses found"
                emptyIcon="📍"
                serverSide={true}
                apiUrl={`${API_ENDPOINTS.CUSTOMER.GET_ALL_CUSTOMERS}?customerID=${formData.customerID}`}
                methodType="GET"
                getAuthHeaders={memoizedGetAuthHeaders}
                defaultSortColumn="name"
                containerWidth="100%"
                showCheckboxes={true}
                selectedRows={selectedShippingAddressRows}
                onRowSelection={handleShippingAddressRowSelection}
                getRowId={(row) => row.customerID || row.customerNo}
                headerSearch={true}
                infiniteScroll={true}
                onDataChange={handleShippingAddressGridDataChange}
              />
            </div>
            <div className="customer-search-footer">
              <button
                className="select-btn"
                onClick={handleSelectShippingAddress}
                disabled={selectedShippingAddressRows.size === 0}
              >
                Select
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zone To Customer Modal */}
      {showZonesModal && (
        <div className="zones-modal-overlay" onClick={handleCloseZonesModal}>
          <div className="zones-modal" onClick={(e) => e.stopPropagation()}>
            <div className="zones-modal-header">
              <div className="zones-modal-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f0ad4e" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
              </div>
              <span className="zones-modal-title">Zone To Customer</span>
              <div className="zones-modal-window-controls">
                <button className="zones-modal-minimize">−</button>
                <button className="zones-modal-maximize">□</button>
                <button className="zones-modal-close" onClick={handleCloseZonesModal}>×</button>
              </div>
            </div>
            <div className="zones-modal-body">
              <div className="zones-modal-grid">
                <div className="zones-modal-grid-header">
                  <span>Zone</span>
                </div>
                <div className="zones-modal-grid-body">
                  {availableZones.map((zone, index) => (
                    <div
                      key={zone}
                      className={`zones-modal-grid-row ${index === 0 ? "selected" : ""}`}
                    >
                      <span className="row-indicator">▶ {index + 1}</span>
                      <span className="zone-value">{zone}</span>
                    </div>
                  ))}
                  <div className="zones-modal-grid-row new-row">
                    <span className="row-indicator">✱</span>
                    <input
                      type="text"
                      value={newZoneValue}
                      onChange={(e) => setNewZoneValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAddNewZone()
                        }
                      }}
                      placeholder=""
                      className="new-zone-input"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="zones-modal-footer">
              <button className="zones-modal-ok-btn" onClick={handleZonesModalOk}>OK</button>
              <button className="zones-modal-cancel-btn" onClick={handleCloseZonesModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Preset Modal - Add preset values */}
      {showShiftModal && (
        <div className="shift-modal-overlay" onClick={handleCloseShiftModal}>
          <div className="shift-modal" onClick={(e) => e.stopPropagation()}>
            <div className="shift-modal-header">
              <div className="shift-modal-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f0ad4e" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
              </div>
              <span className="shift-modal-title">Add preset values</span>
              <div className="shift-modal-window-controls">
                <button className="shift-modal-minimize">−</button>
                <button className="shift-modal-maximize">□</button>
                <button className="shift-modal-close" onClick={handleCloseShiftModal}>×</button>
              </div>
            </div>
            <div className="shift-modal-body">
              <div className="shift-modal-grid">
                <div className="shift-modal-grid-header">
                  <span className="shift-col-value">Value</span>
                  <span className="shift-col-sort">Sort Order</span>
                </div>
                <div className="shift-modal-grid-body">
                  {shiftPresets.map((preset, index) => (
                    <div
                      key={index}
                      className={`shift-modal-grid-row ${selectedShiftPresetIndex === index ? "selected" : ""}`}
                      onClick={() => setSelectedShiftPresetIndex(index)}
                    >
                      <span className="row-indicator">{selectedShiftPresetIndex === index ? "▶" : ""} {index + 1}</span>
                      <span className="shift-value">{preset.value}</span>
                      <span className="shift-sort-order">{preset.sortOrder}</span>
                    </div>
                  ))}
                  <div className="shift-modal-grid-row new-row">
                    <span className="row-indicator">✱</span>
                    <input
                      type="text"
                      value={newShiftValue}
                      onChange={(e) => setNewShiftValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newShiftValue.trim()) {
                          handleAddNewShiftPreset()
                        }
                      }}
                      placeholder=""
                      className="new-shift-value-input"
                    />
                    <input
                      type="text"
                      value={newShiftSortOrder}
                      onChange={(e) => setNewShiftSortOrder(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newShiftValue.trim()) {
                          handleAddNewShiftPreset()
                        }
                      }}
                      placeholder=""
                      className="new-shift-sort-input"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="shift-modal-footer">
              <button
                className="shift-modal-delete-btn"
                onClick={handleDeleteShiftPreset}
                disabled={selectedShiftPresetIndex === null}
              >
                Delete
              </button>
              <button className="shift-modal-save-btn" onClick={handleShiftModalSave}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Notes Modal - Add preset values */}
      {showDriverNotesModal && (
        <div className="driver-note-modal-overlay" onClick={handleCloseDriverNotesModal}>
          <div className="driver-note-modal" onClick={(e) => e.stopPropagation()}>
            <div className="driver-note-modal-header">
              <div className="driver-note-modal-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f0ad4e" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
              </div>
              <span className="driver-note-modal-title">Add preset values - Driver Notes</span>
              <div className="driver-note-modal-window-controls">
                <button className="driver-note-modal-minimize">−</button>
                <button className="driver-note-modal-maximize">□</button>
                <button className="driver-note-modal-close" onClick={handleCloseDriverNotesModal}>×</button>
              </div>
            </div>
            <div className="driver-note-modal-body">
              <div className="driver-note-modal-grid">
                <div className="driver-note-modal-grid-header">
                  <span className="driver-note-col-value">Value</span>
                  <span className="driver-note-col-sort">Sort Order</span>
                </div>
                <div className="driver-note-modal-grid-body">
                  {driverNotesPresets.map((preset, index) => (
                    <div
                      key={index}
                      className={`driver-note-modal-grid-row ${selectedDriverNoteIndex === index ? "selected" : ""}`}
                      onClick={() => setSelectedDriverNoteIndex(index)}
                    >
                      <span className="row-indicator">{selectedDriverNoteIndex === index ? "▶" : ""} {index + 1}</span>
                      <span className="driver-note-value">{preset.value}</span>
                      <span className="driver-note-sort-order">{preset.sortOrder}</span>
                    </div>
                  ))}
                  <div className="driver-note-modal-grid-row new-row">
                    <span className="row-indicator">✱</span>
                    <input
                      type="text"
                      value={newDriverNoteValue}
                      onChange={(e) => setNewDriverNoteValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newDriverNoteValue.trim()) {
                          handleAddNewDriverNote()
                        }
                      }}
                      placeholder=""
                      className="new-driver-note-value-input"
                    />
                    <input
                      type="text"
                      value={newDriverNoteSortOrder}
                      onChange={(e) => setNewDriverNoteSortOrder(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newDriverNoteValue.trim()) {
                          handleAddNewDriverNote()
                        }
                      }}
                      placeholder=""
                      className="new-driver-note-sort-input"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="driver-note-modal-footer">
              <button
                className="driver-note-modal-delete-btn"
                onClick={handleDeleteDriverNote}
                disabled={selectedDriverNoteIndex === null}
              >
                Delete
              </button>
              <button className="driver-note-modal-save-btn" onClick={handleDriverNotesModalSave}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Pick Notes Modal - Add preset values */}
      {showPickNotesModal && (
        <div className="pick-note-modal-overlay" onClick={handleClosePickNotesModal}>
          <div className="pick-note-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pick-note-modal-header">
              <div className="pick-note-modal-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f0ad4e" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18" />
                  <path d="M9 21V9" />
                </svg>
              </div>
              <span className="pick-note-modal-title">Add preset values - Pick Notes</span>
              <div className="pick-note-modal-window-controls">
                <button className="pick-note-modal-minimize">−</button>
                <button className="pick-note-modal-maximize">□</button>
                <button className="pick-note-modal-close" onClick={handleClosePickNotesModal}>×</button>
              </div>
            </div>
            <div className="pick-note-modal-body">
              <div className="pick-note-modal-grid">
                <div className="pick-note-modal-grid-header">
                  <span className="pick-note-col-value">Value</span>
                  <span className="pick-note-col-sort">Sort Order</span>
                </div>
                <div className="pick-note-modal-grid-body">
                  {pickNotesPresets.map((preset, index) => (
                    <div
                      key={index}
                      className={`pick-note-modal-grid-row ${selectedPickNoteIndex === index ? "selected" : ""}`}
                      onClick={() => setSelectedPickNoteIndex(index)}
                    >
                      <span className="row-indicator">{selectedPickNoteIndex === index ? "▶" : ""} {index + 1}</span>
                      <span className="pick-note-value">{preset.value}</span>
                      <span className="pick-note-sort-order">{preset.sortOrder}</span>
                    </div>
                  ))}
                  <div className="pick-note-modal-grid-row new-row">
                    <span className="row-indicator">✱</span>
                    <input
                      type="text"
                      value={newPickNoteValue}
                      onChange={(e) => setNewPickNoteValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newPickNoteValue.trim()) {
                          handleAddNewPickNote()
                        }
                      }}
                      placeholder=""
                      className="new-pick-note-value-input"
                    />
                    <input
                      type="text"
                      value={newPickNoteSortOrder}
                      onChange={(e) => setNewPickNoteSortOrder(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newPickNoteValue.trim()) {
                          handleAddNewPickNote()
                        }
                      }}
                      placeholder=""
                      className="new-pick-note-sort-input"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="pick-note-modal-footer">
              <button
                className="pick-note-modal-delete-btn"
                onClick={handleDeletePickNote}
                disabled={selectedPickNoteIndex === null}
              >
                Delete
              </button>
              <button className="pick-note-modal-save-btn" onClick={handlePickNotesModalSave}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="phone-order-toolbar">
        <button className="toolbar-btn primary" onClick={handleSave} disabled={isSaving || readOnly}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          <span>Save</span>
        </button>
        <button className="toolbar-btn" onClick={handleSaveAndNew} disabled={isSaving || readOnly}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
          <span>Save & New</span>
        </button>
        <button className="toolbar-btn" onClick={handleSaveAndClose} disabled={isSaving || readOnly}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
          <span>Save & Close</span>
        </button>
        <div className="toolbar-separator" />
        <button className="toolbar-btn" disabled={readOnly}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>Hold</span>
        </button>
        <button className="toolbar-btn" onClick={handleCancel}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <span>Cancel</span>
        </button>
        <button className="toolbar-btn danger" disabled={isNew || readOnly}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
          <span>Void</span>
        </button>
        <button className="toolbar-btn" disabled={isNew || readOnly}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
          </svg>
          <span>SendToPick</span>
        </button>
        <button className="toolbar-btn" disabled={isNew}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          <span>Print</span>
        </button>
        <button className="toolbar-btn" disabled={isNew}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span>Preview</span>
        </button>
        <div className="toolbar-separator" />
        <div className="toolbar-dropdown">
          <span className="toolbar-dropdown-label">Repeat Order</span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                // Handle repeat order selection
                console.log("Repeat order selected:", e.target.value);
              }
            }}
          >
            <option value="">Select...</option>
            {previousOrders.map((order) => (
              <option key={order.phoneOrderNo} value={order.phoneOrderNo}>
                {order.date} - ${order.total.toFixed(2)}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar-dropdown">
          <span className="toolbar-dropdown-label">Previous Orders:</span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                // Handle loading previous order
                const selectedOrder = previousOrders.find(o => o.phoneOrderNo === e.target.value);
                if (selectedOrder) {
                  console.log("Load previous order:", selectedOrder);
                }
              }
            }}
          >
            <option value="">Select...</option>
            {previousOrders.map((order) => (
              <option key={order.phoneOrderNo} value={order.phoneOrderNo}>
                {order.date} - {order.phoneOrderNo} - ${order.total.toFixed(2)} - #{order.transNo}
              </option>
            ))}
          </select>
        </div>

        {customerSince && (
          <div className="customer-since-badge">
            CustomerSince: {customerSince}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="phone-order-content">
        {/* Collapsible Header Section */}
        <div className="phone-order-header-container">
          <button
            className={`header-collapse-btn ${isHeaderCollapsed ? 'collapsed' : ''}`}
            onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <span>Order Details {isHeaderCollapsed ? '(Click to expand)' : ''}</span>
          </button>
          <div className={`phone-order-header ${isHeaderCollapsed ? 'collapsed' : ''}`}>
            {/* Column 1 - Account Section */}
            <div className="header-section account-section">
              {/* Row 1: Account No */}
              <div className="account-row">
                <label>Account No:</label>
                <input
                  type="text"
                  value={formData.customerNo}
                  readOnly
                  className="account-input account-no-standalone"
                />
              </div>
              {/* Row 2: Customer name with action buttons */}
              <div className="customer-select-row">
                <input
                  type="text"
                  value={formData.customerName}
                  readOnly
                  className="customer-name-input"
                  placeholder=""
                />
                <div className="customer-action-buttons-group">
                  <button
                    className="customer-action-btn search-btn"
                    title="Search Customer"
                    onClick={handleOpenCustomerSearch}
                    disabled={readOnly}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <button
                    className="customer-action-btn add-btn"
                    title="Create New Customer"
                    onClick={handleCreateNewCustomer}
                    disabled={readOnly}
                  >
                    +
                  </button>
                  <button
                    className="customer-action-btn reset-btn"
                    title="Reset Selection"
                    onClick={handleResetCustomer}
                    disabled={readOnly || !formData.customerID}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                  <button
                    className="customer-action-btn edit-btn"
                    title="Edit Customer"
                    onClick={handleEditCustomer}
                    disabled={readOnly || !formData.customerID}
                  >
                    ...
                  </button>
                </div>
              </div>
              {/* Row 3: Address and Phone row */}
              <div className="customer-info-row">
                <span className="customer-address-display">{formData.shippingAddress || ""}</span>
                <span className="customer-phone">{formData.customerPhone || ""}</span>
              </div>
              {/* Row 4: City/State/Zip and Phone2 row */}
              <div className="customer-info-row">
                <span className="customer-city-display">{formData.cityStateZip || ""}</span>
                <span className="customer-phone">{formData.customerCell || ""}</span>
              </div>
              {/* Row 5: Expired with textbox and checkbox */}
              <div className="expired-row">
                <label>Expired</label>
                <input type="text" value="" readOnly className="expired-input" />
                <input type="checkbox" checked={false} disabled />
              </div>
              {/* Row 6: Payment */}
              <div className="payment-row">
                <label>Payment</label>
                <div className="payment-note-control">
                  <input
                    type="text"
                    value={formData.paymentNote}
                    readOnly
                    className="payment-note-input"
                    placeholder=""
                  />
                  <button
                    className="payment-note-dropdown-btn"
                    onClick={handleOpenPaymentNoteModal}
                    disabled={readOnly}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
              </div>
              {/* Row 6: Account Locked warning */}
              {formData.lockAccount && (
                <div className="account-locked-warning">Account Locked!</div>
              )}
            </div>

            {/* Column 2 - Order Date/Time + Credit Info Section */}
            <div className="header-section order-section">
              <div className="form-row">
                <label>Order Date:</label>
                <input
                  type="date"
                  value={formData.orderDate}
                  onChange={(e) => handleInputChange("orderDate", e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="form-row">
                <label>Order Time:</label>
                <input
                  type="time"
                  value={formData.orderTime}
                  onChange={(e) => handleInputChange("orderTime", e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="form-row">
                <label>Credit Limit:</label>
                <input type="text" value={`$${formData.creditLimit.toFixed(2)}`} disabled />
              </div>
              <div className="form-row">
                <label>Balance:</label>
                <input type="text" value={formData.balance.toFixed(2)} disabled />
              </div>
              <div className="form-row">
                <label>Last Visit:</label>
                <input type="text" value={formData.lastVisit} disabled />
              </div>
              <div className="form-row">
                <label>Last Payment:</label>
                <input type="text" value={`$${formData.lastPayment.toFixed(2)}`} disabled />
              </div>
              <div className="form-row">
                <label>Last Cleared:</label>
                <input type="text" value={formData.lastCleared} disabled />
              </div>
              <div className="form-row">
                <label>Group:</label>
                <input type="text" value={formData.groups} disabled />
              </div>
              <div className="form-row">
                <label>Tender:</label>
                <div className="tender-control" ref={tenderDropdownRef}>
                  <div className="tender-input-wrapper">
                    <input
                      type="text"
                      value={tenders.find(t => t.tenderID.toString() === formData.tender)?.tenderName || ""}
                      readOnly
                      placeholder={isLoadingTenders ? "Loading..." : "Select tender..."}
                      disabled={readOnly}
                    />
                    <button
                      type="button"
                      className="tender-dropdown-btn"
                      onClick={handleToggleTenderDropdown}
                      disabled={readOnly || isLoadingTenders}
                    >
                      ▼
                    </button>
                  </div>
                  {showTenderDropdown && (
                    <div className="tender-dropdown-popup">
                      {tenders.length === 0 ? (
                        <div className="tender-dropdown-empty">No tenders available</div>
                      ) : (
                        tenders.map((tender) => (
                          <div
                            key={tender.tenderID}
                            className={`tender-dropdown-item ${formData.tender === tender.tenderID.toString() ? "selected" : ""}`}
                            onClick={() => handleSelectTender(tender.tenderID, tender.tenderName)}
                          >
                            {tender.tenderName}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Column 3 - Shipping Section */}
            <div className="header-section shipping-section">
              <div className="shipping-name-row">
                <input
                  type="text"
                  value={formData.shippingName}
                  readOnly
                  className="shipping-name-input"
                  placeholder=""
                />
                <div className="shipping-action-buttons-group">
                  <button
                    className="shipping-action-btn search-btn"
                    title="Select Shipping Address"
                    onClick={handleOpenShippingAddressModal}
                    disabled={readOnly}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <button
                    className="shipping-action-btn add-btn"
                    title="Add New Address"
                    disabled={readOnly}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="form-row">
                <label className="narrow">Address:</label>
                <input
                  type="text"
                  value={formData.shippingAddress}
                  onChange={(e) => handleInputChange("shippingAddress", e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="form-row">
                <label className="narrow">City/St/Zip:</label>
                <input
                  type="text"
                  value={formData.cityStateZip}
                  onChange={(e) => handleInputChange("cityStateZip", e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="form-row zones-row">
                <label className="narrow">Zones:</label>
                <div className="zones-control" ref={zonesDropdownRef}>
                  <input
                    type="text"
                    value={formData.zones}
                    readOnly
                    className="zones-input"
                    placeholder=""
                  />
                  <div className="zones-buttons-group">
                    <button
                      className="zones-btn search-btn"
                      title="Select Zones"
                      onClick={handleToggleZonesDropdown}
                      disabled={readOnly}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    <button
                      className="zones-btn add-btn"
                      title="Add Zone"
                      onClick={handleOpenZonesModal}
                      disabled={readOnly}
                    >
                      +
                    </button>
                  </div>
                  {/* Zones Dropdown Popup */}
                  {showZonesDropdown && (
                    <div className="zones-dropdown-popup">
                      <div className="zones-dropdown-list">
                        <label className="zones-dropdown-item select-all">
                          <input
                            type="checkbox"
                            checked={selectedZones.size === availableZones.length && availableZones.length > 0}
                            onChange={handleSelectAllZones}
                          />
                          <span>(Select All)</span>
                        </label>
                        {availableZones.map((zone) => (
                          <label key={zone} className="zones-dropdown-item">
                            <input
                              type="checkbox"
                              checked={selectedZones.has(zone)}
                              onChange={() => handleToggleZone(zone)}
                            />
                            <span>{zone}</span>
                          </label>
                        ))}
                      </div>
                      <div className="zones-dropdown-footer">
                        <button className="zones-dropdown-ok-btn" onClick={handleZonesDropdownOk}>OK</button>
                        <button className="zones-dropdown-cancel-btn" onClick={handleCloseZonesDropdown}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="form-row shift-row">
                <label className="narrow">Shift:</label>
                <div className="shift-control" ref={shiftDropdownRef}>
                  <input
                    type="text"
                    value={formData.shift}
                    readOnly
                    className="shift-input"
                    placeholder=""
                  />
                  <div className="shift-buttons-group">
                    <button
                      className="shift-btn search-btn"
                      title="Select Shift"
                      onClick={handleToggleShiftDropdown}
                      disabled={readOnly}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    <button
                      className="shift-btn preset-btn"
                      title="Manage Presets"
                      onClick={handleOpenShiftModal}
                      disabled={readOnly}
                    >
                      ...
                    </button>
                  </div>
                  {/* Shift Dropdown Popup */}
                  {showShiftDropdown && (
                    <div className="shift-dropdown-popup">
                      <div className="shift-dropdown-list">
                        {shiftPresets.map((preset, index) => (
                          <div
                            key={index}
                            className={`shift-dropdown-item ${formData.shift === preset.value ? 'selected' : ''}`}
                            onClick={() => handleSelectShift(preset.value)}
                          >
                            {preset.value}
                          </div>
                        ))}
                        {shiftPresets.length === 0 && (
                          <div className="shift-dropdown-empty">No presets available</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="form-row">
                <label className="narrow">Delivery:</label>
                <input
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) => handleInputChange("deliveryDate", e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="form-row driver-note-row">
                <label className="narrow">Driver Note:</label>
                <div className="driver-note-control" ref={driverNotesDropdownRef}>
                  <input
                    type="text"
                    value={formData.driversNote}
                    readOnly
                    className="driver-note-input"
                    placeholder=""
                  />
                  <div className="driver-note-buttons-group">
                    <button
                      className="driver-note-btn search-btn"
                      title="Select Driver Note"
                      onClick={handleToggleDriverNotesDropdown}
                      disabled={readOnly}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    <button
                      className="driver-note-btn preset-btn"
                      title="Manage Presets"
                      onClick={handleOpenDriverNotesModal}
                      disabled={readOnly}
                    >
                      ...
                    </button>
                  </div>
                  {/* Driver Notes Dropdown Popup */}
                  {showDriverNotesDropdown && (
                    <div className="driver-note-dropdown-popup">
                      <div className="driver-note-dropdown-list">
                        {driverNotesPresets.map((preset, index) => (
                          <div
                            key={index}
                            className={`driver-note-dropdown-item ${formData.driversNote === preset.value ? 'selected' : ''}`}
                            onClick={() => handleSelectDriverNote(preset.value)}
                          >
                            {preset.value}
                          </div>
                        ))}
                        {driverNotesPresets.length === 0 && (
                          <div className="driver-note-dropdown-empty">No presets available</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="form-row">
                <label className="narrow"></label>
                <label style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: "9px" }}>
                  <input
                    type="checkbox"
                    checked={formData.freezer}
                    onChange={(e) => handleInputChange("freezer", e.target.checked)}
                    disabled={readOnly}
                  />
                  Freezer
                </label>
              </div>
            </div>

            {/* Column 4 - Status Section */}
            <div className="header-section status-section">
              <div className="form-row">
                <label className="narrow">Status:</label>
                <span className={`status-badge ${formData.status.toLowerCase().replace(" ", "-")}`}>
                  {formData.status}
                </span>
              </div>
              <div className="form-row">
                <label className="narrow">Order No.</label>
                <input type="text" value={formData.orderNo} disabled />
              </div>
              <div className="form-row">
                <label className="narrow">Pick By:</label>
                <div className="pick-by-control" ref={pickByDropdownRef}>
                  <div className="pick-by-input-wrapper">
                    <input
                      type="text"
                      value={pickByUsers.find(u => u.userId === formData.pickBy)?.displayName || ""}
                      readOnly
                      placeholder={isLoadingPickByUsers ? "Loading..." : "Select user..."}
                      disabled={readOnly}
                    />
                    <button
                      type="button"
                      className="pick-by-dropdown-btn"
                      onClick={handleTogglePickByDropdown}
                      disabled={readOnly || isLoadingPickByUsers}
                    >
                      ▼
                    </button>
                  </div>
                  {showPickByDropdown && (
                    <div className="pick-by-dropdown-popup">
                      {pickByUsers.length === 0 ? (
                        <div className="pick-by-dropdown-empty">No users available</div>
                      ) : (
                        pickByUsers.map((user) => (
                          <div
                            key={user.userId}
                            className={`pick-by-dropdown-item ${formData.pickBy === user.userId ? "selected" : ""}`}
                            onClick={() => handleSelectPickBy(user.userId, user.displayName)}
                          >
                            {user.displayName || user.userName}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-row">
                <label className="narrow">Trans #:</label>
                <input type="text" value={formData.transNo} disabled />
              </div>
              <div className="form-row">
                <label className="narrow">Type:</label>
                <select
                  value={formData.type}
                  onChange={(e) => handleInputChange("type", e.target.value)}
                  disabled={readOnly}
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label className="narrow">Taken By:</label>
                <input type="text" value={formData.takenBy} disabled />
              </div>
              <div className="form-row pick-note-row">
                <label className="narrow">Pick Note:</label>
                <div className="pick-note-control" ref={pickNotesDropdownRef}>
                  <input
                    type="text"
                    value={formData.pickNote}
                    readOnly
                    className="pick-note-input"
                    placeholder=""
                  />
                  <div className="pick-note-buttons-group">
                    <button
                      className="pick-note-btn search-btn"
                      title="Select Pick Note"
                      onClick={handleTogglePickNotesDropdown}
                      disabled={readOnly}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    <button
                      className="pick-note-btn preset-btn"
                      title="Manage Presets"
                      onClick={handleOpenPickNotesModal}
                      disabled={readOnly}
                    >
                      ...
                    </button>
                  </div>
                  {/* Pick Notes Dropdown Popup */}
                  {showPickNotesDropdown && (
                    <div className="pick-note-dropdown-popup">
                      <div className="pick-note-dropdown-list">
                        {pickNotesPresets.map((preset, index) => (
                          <div
                            key={index}
                            className={`pick-note-dropdown-item ${formData.pickNote === preset.value ? 'selected' : ''}`}
                            onClick={() => handleSelectPickNote(preset.value)}
                          >
                            {preset.value}
                          </div>
                        ))}
                        {pickNotesPresets.length === 0 && (
                          <div className="pick-note-dropdown-empty">No presets available</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="form-row">
                <label className="narrow">Priority:</label>
                <select
                  value={formData.priority}
                  onChange={(e) => handleInputChange("priority", e.target.value)}
                  disabled={readOnly}
                  className={`priority-select ${formData.priority.toLowerCase().replace(" priority", "")}`}
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Column 5 - Notes Section */}
            <div className="header-section notes-section">
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", height: "100%" }}>
                <div style={{ fontWeight: 500, fontSize: "9px" }}>Notes</div>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  disabled={readOnly}
                  style={{ flex: 1, width: "100%" }}
                  placeholder="Order notes..."
                />
              </div>
            </div>

            {/* Column 6 - Previous Orders Panel */}
            <div className="header-section previous-orders-section">
              <div className="previous-orders-panel">
                <div className="previous-orders-header">Previous Orders:</div>
                <div className="previous-orders-grid">
                  <table>
                    <thead>
                      <tr>
                        <th>*</th>
                        <th>Date</th>
                        <th>Order #</th>
                        <th>Total</th>
                        <th>Trans #</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previousOrders.map((order, index) => (
                        <tr key={index}>
                          <td></td>
                          <td>{order.date}</td>
                          <td>{order.phoneOrderNo}</td>
                          <td>${order.total.toFixed(2)}</td>
                          <td>{order.transNo}</td>
                        </tr>
                      ))}
                      {previousOrders.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: '#999', fontSize: '8px' }}>
                            No previous orders
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <button className="load-more-btn">Load More...</button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="phone-order-action-buttons">
          <button
            className="action-btn"
            onClick={handleSalesDetails}
            disabled={!formData.customerID}
            title="View customer sales details in new tab"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
            Sales Details
          </button>
          <button
            className="action-btn"
            onClick={handleItemSales}
            disabled={!formData.customerID}
            title="View item sales history in new tab"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            Item Sales
          </button>
          <button
            className="action-btn"
            onClick={handleShowAging}
            disabled={!formData.customerID}
            title="View customer aging report in new tab"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Show Aging
          </button>
        </div>

        {/* Item Entry Section */}
        <div className="item-entry-section">
          <div className="item-entry-field name-field">
            <label>Name:</label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              disabled={readOnly}
              placeholder="Search item by name..."
            />
          </div>
          <div className="item-entry-field upc-field">
            <label>UPC:</label>
            <input
              type="text"
              value={itemUpc}
              onChange={(e) => setItemUpc(e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="item-entry-field model-field">
            <label>Model No:</label>
            <input
              type="text"
              value={itemModelNo}
              onChange={(e) => setItemModelNo(e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="item-entry-field qty-field">
            <label>Qty:</label>
            <input
              type="number"
              value={itemQty}
              onChange={(e) => setItemQty(Number(e.target.value))}
              disabled={readOnly}
              min={1}
            />
          </div>
          <div className="item-entry-field uom-field">
            <label>UOM:</label>
            <select
              value={itemUom}
              onChange={(e) => setItemUom(e.target.value)}
              disabled={readOnly}
            >
              {UOM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="item-entry-field" style={{ width: "80px" }}>
            <label>&nbsp;</label>
            <span style={{ padding: "4px", fontSize: "11px" }}>$0.00</span>
          </div>
          <div className="item-entry-field note-field">
            <label>Note:</label>
            <div style={{ display: "flex", gap: "4px" }}>
              <input
                type="text"
                value={itemNote}
                onChange={(e) => setItemNote(e.target.value)}
                disabled={readOnly}
              />
              <button style={{ padding: "4px 8px", fontSize: "10px" }}>...</button>
            </div>
          </div>
          <div className="total-display">
            Total including Tax:${totalIncludingTax.toFixed(2)}
          </div>
          <button className="add-item-btn" onClick={handleAddItem} disabled={readOnly}>
            Add [F9]
          </button>
        </div>

        {/* Items Grid */}
        <div className="items-grid-container">
          <div className="items-grid">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>ItemStor...</th>
                  <th style={{ width: "100px" }}>UPC</th>
                  <th style={{ width: "80px" }}>Model Num...</th>
                  <th style={{ width: "200px" }}>Name</th>
                  <th style={{ width: "50px" }}>Qty</th>
                  <th style={{ width: "60px" }}>UOM</th>
                  <th style={{ width: "70px" }}>Price</th>
                  <th style={{ width: "70px" }}>Ext. Price</th>
                  <th style={{ width: "50px" }}>Size</th>
                  <th style={{ width: "100px" }}>Note</th>
                  <th style={{ width: "60px" }}>OnHand</th>
                  <th style={{ width: "70px" }}>Sp Price</th>
                  <th style={{ width: "70px" }}>ListPrice</th>
                  <th style={{ width: "70px" }}>Markdown</th>
                  <th style={{ width: "60px" }}>Cost</th>
                  <th style={{ width: "80px" }}>Supplier</th>
                  <th style={{ width: "80px" }}>Departm...</th>
                  <th style={{ width: "60px" }}>Avail. QTY</th>
                  <th style={{ width: "70px" }}>Method</th>
                  <th style={{ width: "60px" }}>Qty Picked</th>
                  <th style={{ width: "80px" }}>UOM Qty Pick...</th>
                </tr>
              </thead>
              <tbody>
                {formData.entries.map((entry, index) => (
                  <tr
                    key={entry.phoneOrderEntryID}
                    className={selectedEntryIndex === index ? "selected" : ""}
                    onClick={() => setSelectedEntryIndex(index)}
                  >
                    <td>{entry.itemStoreNo}</td>
                    <td>{entry.upc}</td>
                    <td>{entry.modelNo}</td>
                    <td>{entry.itemName}</td>
                    <td className="numeric">
                      <input
                        type="number"
                        value={entry.qty}
                        onChange={(e) => handleEntryUpdate(index, "qty", Number(e.target.value))}
                        disabled={readOnly}
                      />
                    </td>
                    <td>{entry.uomLabel}</td>
                    <td className="numeric">${entry.uomPrice.toFixed(2)}</td>
                    <td className="numeric">${entry.extPrice.toFixed(2)}</td>
                    <td>{entry.size}</td>
                    <td>{entry.note}</td>
                    <td className="numeric">{entry.onHand.toFixed(3)}</td>
                    <td className="numeric">${entry.spPrice.toFixed(2)}</td>
                    <td className="numeric">${entry.listPrice.toFixed(2)}</td>
                    <td className="numeric">${entry.markdown.toFixed(2)}</td>
                    <td className="numeric">${entry.cost.toFixed(2)}</td>
                    <td>{entry.supplier}</td>
                    <td>{entry.department}</td>
                    <td className={`avail-qty ${entry.availQty <= 0 ? "out" : entry.availQty < 10 ? "low" : ""}`}>
                      {entry.availQty.toFixed(2)}
                    </td>
                    <td>{entry.method}</td>
                    <td className="numeric">{entry.qtyPicked.toFixed(2)}</td>
                    <td className="numeric">{entry.uomQtyPick.toFixed(2)}</td>
                  </tr>
                ))}
                {formData.entries.length === 0 && (
                  <tr>
                    <td colSpan={21} style={{ textAlign: "center", padding: "20px", color: "#999" }}>
                      No items added. Use the fields above to add items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Grid Footer */}
          <div className="grid-footer">
            <div className="grid-summary">
              <div className="summary-item">
                <label>Total Qty:</label>
                <span>{gridSummary.totalQty.toFixed(2)}</span>
              </div>
              <div className="summary-item">
                <label>Total:</label>
                <span>${gridSummary.totalExtPrice.toFixed(2)}</span>
              </div>
              <div className="summary-item">
                <label>SUM Cost:</label>
                <span>${gridSummary.totalCost.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PhoneOrderFormPage
