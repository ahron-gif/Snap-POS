import { logout as logoutAction } from '../store/slices/authSlice';
import { resetCurrentCustomer } from '../store/slices/customerSlice';

// ─── Module-level state for concurrency control ────────────────────────────
let refreshPromise: Promise<boolean> | null = null;
let isLoggingOut = false;

// Auth endpoints that should NOT trigger 401 handling
const AUTH_PATHS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/confirm-login',
  '/api/auth/google-login',
];

/**
 * Check whether a URL points to an authentication endpoint.
 */
export function isAuthEndpoint(url: string): boolean {
  try {
    const pathname = url.startsWith('http') ? new URL(url).pathname : url;
    return AUTH_PATHS.some((p) => pathname.toLowerCase().startsWith(p));
  } catch {
    return false;
  }
}

/**
 * Check if the stored JWT access token is expired (or missing).
 * Used to detect CORS-blocked 401s where the browser hides the status code.
 */
export function isTokenExpiredOrMissing(): boolean {
  const token = localStorage.getItem('accessToken');
  if (!token) return true;

  try {
    // JWT structure: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false; // no expiry claim — can't tell

    // exp is in seconds, Date.now() is in ms
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return payload.exp < nowInSeconds;
  } catch {
    return true; // malformed token = treat as expired
  }
}

/**
 * Clear all auth state (localStorage + Redux) and redirect to sign-in.
 *
 * @param reason  If provided, a session-expired flag is set so the
 *                sign-in page can show a toast. Omit for user-initiated logout.
 */
export function forceLogout(reason?: 'session-expired' | 'refresh-failed'): void {
  console.warn('[authManager] forceLogout called | reason:', reason, '| isLoggingOut:', isLoggingOut, '| pathname:', window.location.pathname);

  // Already on the login page — nothing to do
  if (window.location.pathname.includes('/signin')) {
    clearAuthState();
    return;
  }

  // Prevent multiple concurrent logout+redirect sequences
  if (isLoggingOut) return;
  isLoggingOut = true;

  clearAuthState();

  if (reason) {
    sessionStorage.setItem('sessionExpired', 'true');
  }

  console.warn('[authManager] Redirecting to /signin NOW');
  window.location.replace('/signin');
}

/**
 * Clear localStorage + Redux auth state without redirecting.
 */
function clearAuthState(): void {
  try {
    const store = (window as any).__REDUX_STORE__;
    if (store) {
      store.dispatch(logoutAction());
      store.dispatch(resetCurrentCustomer());
    }
  } catch {
    // Redux clear is best-effort
  }

  // Preserve the MFA trusted device token across logouts so the user
  // doesn't have to re-verify MFA on the same device after signing out.
  const deviceToken = localStorage.getItem('mfa_device_token');
  localStorage.clear();
  if (deviceToken) {
    localStorage.setItem('mfa_device_token', deviceToken);
  }
}

/**
 * Attempt to silently refresh the access token.
 * Returns `true` if the new tokens were stored successfully.
 */
async function attemptRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    console.warn('[authManager] No refresh token found — skipping refresh');
    return false;
  }

  try {
    const BASE_URL = import.meta.env.VITE_API_BASE_URL;
    const fetchFn = (window as any).__ORIGINAL_FETCH__ ?? window.fetch;
    const refreshUrl = `${BASE_URL}/api/Auth/refresh`;

    console.info('[authManager] Calling refresh endpoint:', refreshUrl);

    const response = await fetchFn(refreshUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    console.info('[authManager] Refresh response status:', response.status);

    if (!response.ok) {
      console.warn('[authManager] Refresh failed with status', response.status);
      return false;
    }

    const data: { accessToken: string; refreshToken: string } = await response.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    console.info('[authManager] Token refreshed successfully');
    return true;
  } catch (err) {
    console.warn('[authManager] Refresh request threw:', err);
    return false;
  }
}

/**
 * Main 401 handler — called by both the fetch interceptor and axios interceptor.
 *
 * 1. Skips auth endpoints.
 * 2. If a refresh is already in-flight, waits for it.
 * 3. Otherwise attempts a token refresh.
 * 4. Returns `'refreshed'` (caller should retry the request) or `'logout'`.
 */
export async function handle401(requestUrl: string): Promise<'refreshed' | 'logout'> {
  console.info('[authManager] handle401 | url:', requestUrl);

  if (isAuthEndpoint(requestUrl)) {
    console.debug('[authManager] Skipping — auth endpoint');
    return 'logout';
  }

  // If a refresh is already running, piggy-back on it
  if (refreshPromise) {
    console.debug('[authManager] Waiting for existing refresh promise');
    const ok = await refreshPromise;
    return ok ? 'refreshed' : 'logout';
  }

  // First 401 — kick off the refresh
  console.info('[authManager] Attempting token refresh…');
  refreshPromise = attemptRefresh();

  try {
    const ok = await refreshPromise;
    if (ok) return 'refreshed';

    console.warn('[authManager] Refresh failed — forcing logout');
    forceLogout('refresh-failed');
    return 'logout';
  } finally {
    refreshPromise = null;
  }
}
