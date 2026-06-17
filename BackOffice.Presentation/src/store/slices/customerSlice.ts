import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface Customer {
  customerId: number
  customerName: string
  email: string
}

interface CustomerState {
  currentCustomer: Customer | null
  customers: Customer[]
}

// Try to restore currentCustomer from localStorage on initial load
const getInitialCustomer = (): Customer | null => {
  try {
    const userData = localStorage.getItem('userData')
    if (userData) {
      const parsed = JSON.parse(userData)
      if (parsed.customerId) {
        // Also check if we have the full customer info stored
        const storedCustomer = localStorage.getItem('currentCustomer')
        if (storedCustomer) {
          return JSON.parse(storedCustomer)
        }
        // If not, create a minimal customer object
        return {
          customerId: parsed.customerId,
          customerName: parsed.customerName || `Customer ${parsed.customerId}`,
          email: ''
        }
      }
    }
  } catch (error) {
    console.error('Error restoring customer from localStorage:', error)
  }
  return null
}

const initialState: CustomerState = {
  currentCustomer: getInitialCustomer(),
  customers: []
}

const customerSlice = createSlice({
  name: 'customer',
  initialState,
  reducers: {
    setCurrentCustomer: (state, action: PayloadAction<Customer | null>) => {
      state.currentCustomer = action.payload
      // Persist to localStorage
      if (action.payload) {
        localStorage.setItem('currentCustomer', JSON.stringify(action.payload))
        // Also update userData with customerName if available
        try {
          const userData = localStorage.getItem('userData')
          if (userData) {
            const parsed = JSON.parse(userData)
            parsed.customerName = action.payload.customerName
            localStorage.setItem('userData', JSON.stringify(parsed))
          }
        } catch (error) {
          console.error('Error updating userData:', error)
        }
      } else {
        localStorage.removeItem('currentCustomer')
      }
    },
    resetCurrentCustomer: (state) => {
      state.currentCustomer = null
      localStorage.removeItem('currentCustomer')
    },
    addCustomer: (state, action: PayloadAction<Customer>) => {
      state.customers.push(action.payload)
    },
    updateCustomer: (state, action: PayloadAction<Customer>) => {
      const index = state.customers.findIndex(customer => customer.customerId === action.payload.customerId)
      if (index !== -1) {
        state.customers[index] = action.payload
      }
    },
    removeCustomer: (state, action: PayloadAction<number>) => {
      state.customers = state.customers.filter(customer => customer.customerId !== action.payload)
    }
  }
})

export const { 
  setCurrentCustomer, 
  resetCurrentCustomer, 
  addCustomer, 
  updateCustomer, 
  removeCustomer 
} = customerSlice.actions

export default customerSlice.reducer
