
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../hooks/useAppSelector';
import { setLoading, loginSuccess, loginFailure, logout as logoutAction, clearError } from '../store/slices/authSlice';
import { loadPermissions, loadMenu, clearPermissions } from '../store/slices/effectivePermissionSlice';
import { authService, isConflictResponse, isMfaRequiredResponse, type LoginConflictResponse, type LoginResponse } from '../services/authService';
import { forceLogout as centralForceLogout } from '../utils/authManager';
import { permissionService } from '../services/permissionService';
import { setCurrentCustomer, resetCurrentCustomer } from '../store/slices/customerSlice';

interface User {
  userId: number;
  email: string;
  username: string;
  role: 'Admin' | 'User' | 'SuperAdmin';
  customerId: number | null;
}

interface LoginResult {
  success: boolean;
  customerId: number | null;
  conflict?: LoginConflictResponse;
  mfaRequired?: boolean;
  mfaToken?: string;
  preferredMethod?: 'totp' | 'email';
  force30DayReauth?: boolean;
  isTotpSetup?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  googleLogin: (idToken: string) => Promise<LoginResult>;
  confirmLogin: (sessionIdToRevoke?: string) => Promise<LoginResult>;
  completeMfa: (mfaToken: string, code: string, method: string, rememberDevice?: boolean) => Promise<LoginResult>;
  logout: () => void;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  updateCustomerId: (customerId: number) => void;
  sessionConflict: LoginConflictResponse | null;
  clearSessionConflict: () => void;
  confirmingSession: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user, loading, error } = useAppSelector((state) => state.auth);
  const [sessionConflict, setSessionConflict] = useState<LoginConflictResponse | null>(null);
  const [confirmingSession, setConfirmingSession] = useState(false);

  /**
   * Populates the Redux customer slice (which TenantContext reads) with the
   * caller's tenant info, so the sidebar's user-card shows the tenant name.
   * Fire-and-forget — silently no-op on error since the UI gracefully hides
   * the tenant line when the slice is empty.
   *
   * Skipped for super-admins: they have no tenant assignment and may be
   * impersonating different tenants over the session — the picker handles that.
   */
  const populateCurrentTenant = async (customerId: number | null | undefined) => {
    if (!customerId) {
      dispatch(resetCurrentCustomer());
      return;
    }
    try {
      const response = await permissionService.getMyAssignedTenants();
      if (response.data?.isSuccess) {
        const match = response.data.response?.find(t => t.customerId === customerId);
        if (match) {
          dispatch(setCurrentCustomer({
            customerId: match.customerId,
            customerName: match.customerName,
            email: match.email,
          }));
        }
      }
    } catch {
      // Non-fatal — tenant name stays hidden until the user navigates somewhere
      // that fetches it via a different code path.
    }
  };

  useEffect(() => {
    // Check if user is already authenticated from localStorage
    const storedToken = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('userData');

    if (storedToken && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        dispatch(loginSuccess({
          userId: userData.userId,
          email: userData.email,
          username: userData.username,
          role: userData.role,
          customerId: userData.customerId,
          accessToken: storedToken,
          refreshToken: localStorage.getItem('refreshToken') || ''
        }));
        // Repopulate the tenant slice on page reload so the sidebar's user-card
        // shows the customer name without needing a fresh login.
        populateCurrentTenant(userData.customerId);
      } catch (err) {
        // Clear invalid stored data
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userData');
      }
    }
  }, [dispatch]);

  const handleLoginSuccess = (data: LoginResponse) => {
    // Store tokens and user data
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('userData', JSON.stringify({
      userId: data.userId,
      localUserId: data.localUserId,
      email: data.email,
      username: data.username,
      role: data.role,
      customerId: data.customerId,
      sessionId: data.sessionId
    }));

    // Store billing status for payment failure banner
    localStorage.setItem('billingStatus', data.billingStatus || 'ok');

    // Store trusted device token if returned (from MFA "Remember device" flow)
    if (data.deviceToken) {
      localStorage.setItem('mfa_device_token', JSON.stringify({
        token: data.deviceToken,
        expiresAt: data.deviceTokenExpiresAt || null, // ISO string or null (never expires)
      }));
    }

    // Check if user is SuperAdmin (customerId is null/undefined/0)
    const isSuperAdminUser = data.customerId === null || data.customerId === undefined || data.customerId === 0;

    if (!isSuperAdminUser) {
      dispatch(loginSuccess({
        userId: data.userId,
        email: data.email,
        username: data.username,
        role: data.role as 'Admin' | 'User' | 'SuperAdmin',
        customerId: data.customerId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      }));
      sessionStorage.setItem('pendingTenantSelection', 'true');
    }

    // Load RBAC permissions and dynamic menu after successful login
    dispatch(loadPermissions());
    dispatch(loadMenu());

    // Populate tenant context for non-super-admins so the sidebar shows the
    // customer name. Super-admins use the tenant-picker flow instead.
    populateCurrentTenant(data.customerId);
  };

  const login = async (email: string, password: string): Promise<LoginResult> => {
    dispatch(setLoading(true));

    try {
      const data = await authService.login(email, password);

      // Check if this is an MFA-required response
      if (isMfaRequiredResponse(data)) {
        dispatch(setLoading(false));
        return {
          success: false,
          customerId: null,
          mfaRequired: true,
          mfaToken: data.mfaToken,
          preferredMethod: data.preferredMethod,
          force30DayReauth: data.force30DayReauth,
          isTotpSetup: data.isTotpSetup,
        };
      }

      // Check if this is a conflict response (requires confirmation)
      if (isConflictResponse(data)) {
        dispatch(setLoading(false));
        setSessionConflict(data);
        return { success: false, customerId: null, conflict: data };
      }

      // Success — no conflict, no MFA
      const loginData = data as LoginResponse;
      handleLoginSuccess(loginData);
      return { success: true, customerId: loginData.customerId };
    } catch (err: any) {
      console.error('Login error:', err);
      const responseData = err?.response?.data;
      const message = (typeof responseData === 'string' ? responseData : responseData?.message)
        || err?.response?.statusText
        || 'Network error. Please try again.';
      dispatch(loginFailure(message));
      throw err;
    }
  };

  /** Complete the MFA login step — verify OTP/TOTP/recovery code and get a full JWT */
  const completeMfa = async (mfaToken: string, code: string, method: string, rememberDevice: boolean = false): Promise<LoginResult> => {
    dispatch(setLoading(true));
    try {
      const data = await authService.verifyMfa(mfaToken, code, method, rememberDevice);
      handleLoginSuccess(data);
      return { success: true, customerId: data.customerId };
    } catch (err: any) {
      dispatch(setLoading(false));
      const message =
        err.response?.data ||
        err.response?.statusText ||
        'Invalid code. Please try again.';
      dispatch(loginFailure(typeof message === 'string' ? message : 'MFA verification failed.'));
      throw err;
    }
  };

  const confirmLogin = async (sessionIdToRevoke?: string): Promise<LoginResult> => {
    if (!sessionConflict) {
      throw new Error('No session conflict to confirm');
    }

    setConfirmingSession(true);

    try {
      const data = await authService.confirmLogin(sessionConflict.temporaryToken, sessionIdToRevoke);
      setSessionConflict(null);

      // The confirm-login endpoint may now return an MFA challenge if the user has MFA enabled
      if (isMfaRequiredResponse(data)) {
        dispatch(setLoading(false));
        return {
          success: false,
          customerId: null,
          mfaRequired: true,
          mfaToken: data.mfaToken,
          preferredMethod: data.preferredMethod,
          force30DayReauth: data.force30DayReauth,
          isTotpSetup: data.isTotpSetup,
        };
      }

      handleLoginSuccess(data);
      return { success: true, customerId: data.customerId };
    } catch (err: any) {
      console.error('Confirm login error:', err);
      const responseData = err?.response?.data;
      const message = (typeof responseData === 'string' ? responseData : responseData?.message)
        || 'Failed to confirm login. Please try again.';
      dispatch(loginFailure(message));
      setSessionConflict(null);
      throw err;
    } finally {
      setConfirmingSession(false);
    }
  };

  const googleLogin = async (idToken: string): Promise<LoginResult> => {
    dispatch(setLoading(true));

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/Auth/google-login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
          body: JSON.stringify({ idToken }),
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          const errorText = await response.text();
          dispatch(loginFailure(errorText || 'Google authentication failed'));
        } else {
          dispatch(loginFailure('Google login failed. Please try again.'));
        }
        throw new Error('Google login failed');
      }

      const data = await response.json();

      // Store tokens and user data (Google login uses PascalCase response for now)
      localStorage.setItem('accessToken', data.AccessToken);
      localStorage.setItem('refreshToken', data.RefreshToken);
      localStorage.setItem('userData', JSON.stringify({
        userId: data.UserId,
        localUserId: data.LocalUserId,
        email: data.Email,
        username: data.Username,
        role: data.Role,
        customerId: data.CustomerId,
        loginType: 'Google'
      }));

      // Store billing status for payment failure banner
      localStorage.setItem('billingStatus', data.BillingStatus || 'ok');

      const isSuperAdminUser = data.CustomerId === null || data.CustomerId === undefined || data.CustomerId === 0;

      if (!isSuperAdminUser) {
        dispatch(loginSuccess({
          userId: data.UserId,
          email: data.Email,
          username: data.Username,
          role: data.Role,
          customerId: data.CustomerId,
          accessToken: data.AccessToken,
          refreshToken: data.RefreshToken
        }));
        sessionStorage.setItem('pendingTenantSelection', 'true');
      }

      // Load RBAC permissions and dynamic menu after Google login
      dispatch(loadPermissions());
      dispatch(loadMenu());

      return { success: true, customerId: data.CustomerId };
    } catch (err: any) {
      console.error('Google login error:', err);
      dispatch(loginFailure('Google login failed. Please try again.'));
      throw err;
    }
  };

  const logout = async () => {
    // ── Step 1: Flush any pending workspace save BEFORE we touch auth state.
    //
    // The DashboardTabContext debounces workspace saves by 1500ms. If the
    // user opens tabs and immediately clicks Logout (within that window),
    // the queued save never reaches the backend → next login restores stale
    // tabs from the previous save. DashboardTabContext exposes a flush
    // helper on `window` that fires the pending save synchronously and
    // returns the underlying Promise. We `await` it (with a short cap) so
    // the request completes before navigation kills it.
    try {
      const flush = (window as unknown as { __flushWorkspaceSave?: () => Promise<void> })
        .__flushWorkspaceSave;
      if (typeof flush === 'function') {
        await Promise.race([
          flush(),
          new Promise<void>(resolve => setTimeout(resolve, 2000)),
        ]);
      }
    } catch {
      // Best-effort — don't block logout if the flush errors out.
    }

    // ── Step 2: AWAIT server-side logout to ensure the session row is
    // marked IsActive=false. Without await, `authService.logout()` returns
    // a Promise immediately, then centralForceLogout calls
    // `window.location.replace('/signin')` which CANCELS any in-flight HTTP
    // request on the current page. The backend never sees the logout call,
    // the session stays active, and the next login from any browser shows
    // the "active session detected" modal.
    //
    // Capped at 5 seconds so a hung backend can't trap the user on the page.
    try {
      await Promise.race([
        authService.logout(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('logout timed out')), 5000),
        ),
      ]);
    } catch {
      // Best-effort — proceed with local cleanup even if the API failed.
    }

    // Clear RBAC permissions from Redux
    dispatch(clearPermissions());

    // Clear the tenant slice so the next login starts with a clean sidebar
    // (otherwise the previous user's customer name would briefly flash).
    dispatch(resetCurrentCustomer());

    // Notify in-app state owners (DashboardTabContext, etc.) that the user
    // is logging out so they can purge per-user state. Without this, tabs
    // from the previous user can leak into the next user's session if the
    // app shell stays mounted (e.g., redirect to /signin doesn't unmount
    // DashboardTabProvider, or the next user has no saved workspace so
    // restoreWorkspace's early-return leaves the old tabs in memory).
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:logout'));
    }

    // Clear all auth state (localStorage + Redux) and redirect.
    // No reason passed — user-initiated logout should NOT show "session expired".
    centralForceLogout();
  };

  const clearSessionConflict = () => {
    setSessionConflict(null);
  };

  const isAdmin = (): boolean => {
    return user?.role === 'Admin' || user?.role === 'SuperAdmin';
  };

  const isSuperAdmin = (): boolean => {
    return user?.role === 'SuperAdmin' || user?.customerId === null || user?.customerId === undefined || user?.customerId === 0;
  };

  const clearErrorHandler = () => {
    dispatch(clearError());
  };

  // Update customerId after customer selection (for users with null customerId)
  const updateCustomerId = (customerId: number) => {
    const storedUser = localStorage.getItem('userData');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        userData.customerId = customerId;
        localStorage.setItem('userData', JSON.stringify(userData));

        dispatch(loginSuccess({
          userId: userData.userId,
          email: userData.email,
          username: userData.username,
          role: userData.role,
          customerId: customerId,
          accessToken: localStorage.getItem('accessToken') || '',
          refreshToken: localStorage.getItem('refreshToken') || ''
        }));
      } catch (err) {
        console.error('Error updating customerId:', err);
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      login,
      googleLogin,
      confirmLogin,
      completeMfa,
      logout,
      isAdmin,
      isSuperAdmin,
      loading,
      error,
      clearError: clearErrorHandler,
      updateCustomerId,
      sessionConflict,
      clearSessionConflict,
      confirmingSession
    }}>
      {children}
    </AuthContext.Provider>
  );
};
