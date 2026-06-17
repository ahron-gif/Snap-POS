import { configureStore } from '@reduxjs/toolkit'
import customerReducer from './slices/customerSlice'
import authReducer from './slices/authSlice'
import permissionReducer from './slices/permissionSlice'
import effectivePermissionReducer from './slices/effectivePermissionSlice'
import tokenReducer from './slices/tokenSlice'
import tokenPermissionReducer from './slices/tokenPermissionSlice'
import tokenStoreAccessReducer from './slices/tokenStoreAccessSlice'
import registrationReducer from './slices/registrationSlice'
import applicationReducer from './slices/applicationSlice'
import appRegistrationReducer from './slices/appRegistrationSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    customer: customerReducer,
    permission: permissionReducer,
    effectivePermission: effectivePermissionReducer,
    token: tokenReducer,
    tokenPermission: tokenPermissionReducer,
    tokenStoreAccess: tokenStoreAccessReducer,
    registration: registrationReducer,
    application: applicationReducer,
    appRegistration: appRegistrationReducer,
  },
})

// Make store globally accessible for auth headers
if (typeof window !== 'undefined') {
  (window as any).__REDUX_STORE__ = store;
}

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch