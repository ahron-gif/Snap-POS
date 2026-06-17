
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface AuthUser {
  userId: number
  email: string
  username: string
  role: 'Admin' | 'User' | 'SuperAdmin'
  customerId: number | null
  accessToken: string
  refreshToken: string
}

interface AuthState {
  isAuthenticated: boolean
  user: AuthUser | null
  loading: boolean
  error: string | null
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload
      if (action.payload) {
        state.error = null
      }
    },
    loginSuccess: (state, action: PayloadAction<AuthUser>) => {
      state.isAuthenticated = true
      state.user = action.payload
      state.loading = false
      state.error = null
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.isAuthenticated = false
      state.user = null
      state.loading = false
      state.error = action.payload
    },
    logout: (state) => {
      state.isAuthenticated = false
      state.user = null
      state.loading = false
      state.error = null
    },
    clearError: (state) => {
      state.error = null
    }
  }
})

export const { setLoading, loginSuccess, loginFailure, logout, clearError } = authSlice.actions
export default authSlice.reducer
