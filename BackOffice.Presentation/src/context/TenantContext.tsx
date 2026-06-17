import { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../hooks/useAppSelector'
import { setCurrentCustomer, resetCurrentCustomer } from '../store/slices/customerSlice'

interface Customer {
  customerId: number
  customerName: string
  email: string
}

interface TenantContextType {
  currentTenant: Customer | null
  switchTenant: (customer: Customer | null) => void
  getTenantData: () => DashboardData
}

interface DashboardData {
  totalRevenue: string
  totalOrders: number
  totalCustomers: number
  totalProducts: number
  recentOrders: Array<{
    id: string
    customer: string
    amount: string
    status: string
    date: string
  }>
  salesData: Array<{
    month: string
    sales: number
  }>
}

// Static tenant-specific data
const tenantData: Record<number, DashboardData> = {
  25: { // Develop_SelfCheckout_4
    totalRevenue: "$45,230",
    totalOrders: 128,
    totalCustomers: 45,
    totalProducts: 78,
    recentOrders: [
      { id: "001", customer: "TechCorp Solutions", amount: "$2,400", status: "Completed", date: "2024-01-15" },
      { id: "002", customer: "Tech Division", amount: "$1,800", status: "Pending", date: "2024-01-14" },
      { id: "003", customer: "Software Team", amount: "$3,200", status: "Completed", date: "2024-01-13" }
    ],
    salesData: [
      { month: "Jan", sales: 15000 },
      { month: "Feb", sales: 18000 },
      { month: "Mar", sales: 22000 },
      { month: "Apr", sales: 25000 },
      { month: "May", sales: 28000 },
      { month: "Jun", sales: 32000 }
    ]
  },
  "2": { // Jane Smith - Innovate Industries
    totalRevenue: "$78,940",
    totalOrders: 245,
    totalCustomers: 89,
    totalProducts: 156,
    recentOrders: [
      { id: "001", customer: "Innovate Industries", amount: "$5,600", status: "Completed", date: "2024-01-15" },
      { id: "002", customer: "Innovation Lab", amount: "$4,200", status: "Processing", date: "2024-01-14" },
      { id: "003", customer: "Research Team", amount: "$3,800", status: "Completed", date: "2024-01-13" }
    ],
    salesData: [
      { month: "Jan", sales: 25000 },
      { month: "Feb", sales: 28000 },
      { month: "Mar", sales: 32000 },
      { month: "Apr", sales: 35000 },
      { month: "May", sales: 38000 },
      { month: "Jun", sales: 42000 }
    ]
  },
  "3": { // Mike Johnson - GlobalTech Systems
    totalRevenue: "$92,150",
    totalOrders: 310,
    totalCustomers: 120,
    totalProducts: 200,
    recentOrders: [
      { id: "001", customer: "GlobalTech Systems", amount: "$7,800", status: "Completed", date: "2024-01-15" },
      { id: "002", customer: "Global Division", amount: "$6,400", status: "Shipped", date: "2024-01-14" },
      { id: "003", customer: "System Integration", amount: "$5,200", status: "Processing", date: "2024-01-13" }
    ],
    salesData: [
      { month: "Jan", sales: 35000 },
      { month: "Feb", sales: 38000 },
      { month: "Mar", sales: 42000 },
      { month: "Apr", sales: 45000 },
      { month: "May", sales: 48000 },
      { month: "Jun", sales: 52000 }
    ]
  },
  "4": { // Sarah Wilson - DigitalMax Solutions
    totalRevenue: "$63,720",
    totalOrders: 189,
    totalCustomers: 67,
    totalProducts: 123,
    recentOrders: [
      { id: "001", customer: "DigitalMax Solutions", amount: "$4,200", status: "Completed", date: "2024-01-15" },
      { id: "002", customer: "Digital Team", amount: "$3,600", status: "Pending", date: "2024-01-14" },
      { id: "003", customer: "Max Solutions", amount: "$2,800", status: "Processing", date: "2024-01-13" }
    ],
    salesData: [
      { month: "Jan", sales: 18000 },
      { month: "Feb", sales: 21000 },
      { month: "Mar", sales: 24000 },
      { month: "Apr", sales: 27000 },
      { month: "May", sales: 30000 },
      { month: "Jun", sales: 33000 }
    ]
  },
  "5": { // David Brown - NextGen Technologies
    totalRevenue: "$54,890",
    totalOrders: 156,
    totalCustomers: 58,
    totalProducts: 89,
    recentOrders: [
      { id: "001", customer: "NextGen Technologies", amount: "$3,400", status: "Completed", date: "2024-01-15" },
      { id: "002", customer: "Next Division", amount: "$2,900", status: "Shipped", date: "2024-01-14" },
      { id: "003", customer: "Gen Tech", amount: "$2,100", status: "Processing", date: "2024-01-13" }
    ],
    salesData: [
      { month: "Jan", sales: 12000 },
      { month: "Feb", sales: 15000 },
      { month: "Mar", sales: 18000 },
      { month: "Apr", sales: 21000 },
      { month: "May", sales: 24000 },
      { month: "Jun", sales: 27000 }
    ]
  }
}

// Default data for when no tenant is selected
const defaultData: DashboardData = {
  totalRevenue: "$124,563",
  totalOrders: 1234,
  totalCustomers: 567,
  totalProducts: 890,
  recentOrders: [
    { id: "001", customer: "Default Customer", amount: "$1,200", status: "Completed", date: "2024-01-15" },
    { id: "002", customer: "Sample Client", amount: "$800", status: "Pending", date: "2024-01-14" },
    { id: "003", customer: "Test Company", amount: "$1,500", status: "Processing", date: "2024-01-13" }
  ],
  salesData: [
    { month: "Jan", sales: 20000 },
    { month: "Feb", sales: 23000 },
    { month: "Mar", sales: 26000 },
    { month: "Apr", sales: 29000 },
    { month: "May", sales: 32000 },
    { month: "Jun", sales: 35000 }
  ]
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenant, setCurrentTenant] = useState<Customer | null>(null)
  const dispatch = useAppDispatch()
  const { currentCustomer } = useAppSelector(state => state.customer)

  // Sync local state with Redux store
  useEffect(() => {
    setCurrentTenant(currentCustomer)
  }, [currentCustomer])

  const switchTenant = (tenant: Customer | null) => {
    setCurrentTenant(tenant)
    if (tenant) {
      dispatch(setCurrentCustomer(tenant))
    } else {
      dispatch(resetCurrentCustomer())
    }
  }

  const getTenantData = (): DashboardData => {
    if (!currentTenant) return defaultData
    return tenantData[currentTenant.customerId] || defaultData
  }

  return (
    <TenantContext.Provider value={{ currentTenant, switchTenant, getTenantData }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider")
  }
  return context
}