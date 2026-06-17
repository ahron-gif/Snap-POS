import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import Button from "../ui/button/Button";
import { useAuth } from "../../context/AuthContext";
import { useAppDispatch } from "../../hooks/useAppSelector";
import { setCurrentCustomer } from "../../store/slices/customerSlice";
import { useStore } from "../../context/StoreContext";
import CustomerSelectionModal from "./CustomerSelectionModal";
import SessionConflictModal from "./SessionConflictModal";
import MfaVerificationForm from "./MfaVerificationForm";
import SwitchStoreModal from "../header/SwitchStoreModal";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { userPreferenceService } from "../../services/userPreferenceService";
import { lookupService } from "../../services/lookupService";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);

  // MFA pending state — set when login returns mfaRequired: true
  const [mfaState, setMfaState] = useState<{
    mfaToken: string;
    preferredMethod: 'totp' | 'email';
    force30DayReauth: boolean;
    isTotpSetup: boolean;
  } | null>(null);

  const { login, googleLogin, confirmLogin, loading, error, clearError, updateCustomerId, sessionConflict, clearSessionConflict, confirmingSession } = useAuth();
  const { switchStore } = useStore();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean
    message: string
    type: "success" | "error" | "info"
  }>({
    show: false,
    message: "",
    type: "success",
  });

  // Toast notification function
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ show: true, message, type });
    // Auto hide after 3 seconds
    setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);
  };

  // Close toast manually
  const closeToast = () => {
    setToast({ show: false, message: "", type: "success" });
  };

  /**
   * Post-login redirect for users with a tenant (non-super-admin). Decides
   * between three paths based on how many stores the user has access to:
   *   - 0 stores: navigate anyway (the dashboard may still render header-only)
   *   - 1 store, or N stores with a matching lastSession: auto-select + navigate
   *   - N stores with no matching lastSession: show the store-picker modal
   *
   * Auto-selecting the only store (or the previously-used one) avoids an
   * unnecessary modal for the 99% case. The modal only appears when there
   * is a real choice to make.
   */
  const redirectAfterCustomerLogin = async () => {
    const finishNavigate = () => {
      showToast("Login successful! Welcome back.", "success");
      setTimeout(() => navigate('/'), 500);
    };

    // handleLoginSuccess in AuthContext writes userData (with localUserId) to
    // localStorage before resolving the login promise, so it is reliably
    // present here. We avoid threading it through LoginResult to keep the
    // change surface small.
    let localUserId: string | null = null;
    try {
      const stored = localStorage.getItem('userData');
      if (stored) localUserId = JSON.parse(stored)?.localUserId ?? null;
    } catch {
      // userData malformed — fall through.
    }

    if (!localUserId) {
      finishNavigate();
      return;
    }

    try {
      const storesRes = await lookupService.getStoresByUser(localUserId);
      const stores = storesRes.success ? (storesRes.data ?? []) : [];

      if (stores.length === 0) {
        finishNavigate();
        return;
      }

      // Prefer the user's previously-selected store if it still exists.
      let chosen: { storeID: string; storeName: string } | null = null;
      try {
        const prefResult = await userPreferenceService.getPreference('lastSession');
        if (prefResult.isSuccess && prefResult.response?.preferenceValue) {
          const lastSession = JSON.parse(prefResult.response.preferenceValue);
          if (lastSession?.storeId) {
            chosen = stores.find(s => s.storeID === lastSession.storeId) ?? null;
          }
        }
      } catch {
        // No preference yet — fall through.
      }

      if (!chosen && stores.length === 1) {
        chosen = stores[0];
      }

      if (chosen) {
        switchStore({ storeId: chosen.storeID, storeName: chosen.storeName });
        const userData = localStorage.getItem('userData');
        if (userData) {
          try {
            const parsed = JSON.parse(userData);
            parsed.storeId = chosen.storeID;
            parsed.storeName = chosen.storeName;
            localStorage.setItem('userData', JSON.stringify(parsed));
          } catch {
            // Non-fatal — userData stays as-is.
          }
        }
        finishNavigate();
        return;
      }

      // Multiple stores, no auto-selection possible → let the user pick.
      setShowStoreModal(true);
    } catch {
      // Network error — proceed; StoreContext will retry on dashboard mount.
      finishNavigate();
    }
  };

  // Store-modal handlers. Selection commits via switchStore (inside the modal)
  // and the parent then navigates; cancel matches the customer-modal contract:
  // clear tokens and stay on the sign-in page.
  const handleStoreSelectedAtLogin = () => {
    showToast("Login successful! Welcome back.", "success");
    setTimeout(() => navigate('/'), 300);
  };

  const handleStoreCancelAtLogin = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('currentStore');
    setShowStoreModal(false);
  };

  const validateFields = () => {
    let valid = true;
    setEmailError("");
    setPasswordError("");

    if (!email) {
      setEmailError("Email is required.");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address.");
      valid = false;
    }

    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    }

    return valid;
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateFields()) {
      return;
    }

    try {
      const result = await login(email, password);

      // If MFA is required — show the MFA verification form
      if (result.mfaRequired && result.mfaToken && result.preferredMethod) {
        setMfaState({ mfaToken: result.mfaToken, preferredMethod: result.preferredMethod, force30DayReauth: result.force30DayReauth ?? true, isTotpSetup: result.isTotpSetup ?? false });
        return;
      }

      // If login returned a session conflict, the modal will show automatically
      if (result.conflict) {
        return;
      }

      if (result.success) {
        // Check if customerId is null/undefined/0 - SuperAdmin needs to select customer
        const needsCustomerSelection = !result.customerId ||
                                       result.customerId === null ||
                                       result.customerId === undefined ||
                                       result.customerId === 0;
        if (needsCustomerSelection) {
          // Show modal - user is NOT authenticated yet (loginSuccess not dispatched)
          // This prevents auto-redirect to dashboard
          setShowCustomerModal(true);
        } else {
          await redirectAfterCustomerLogin();
        }
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      const responseData = err?.response?.data;
      const msg = (typeof responseData === 'string' ? responseData : responseData?.message)
        || "Failed to sign in. Please check your credentials.";
      showToast(msg, "error");
    }
  };

  // Handle Google login success
  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      showToast("Google login failed. No credential received.", "error");
      return;
    }

    try {
      const result = await googleLogin(credentialResponse.credential);
      if (result.success) {
        const needsCustomerSelection = !result.customerId ||
                                       result.customerId === null ||
                                       result.customerId === undefined ||
                                       result.customerId === 0;
        if (needsCustomerSelection) {
          setShowCustomerModal(true);
        } else {
          await redirectAfterCustomerLogin();
        }
      }
    } catch (err) {
      console.error("Google sign in error:", err);
      showToast("Google login failed. Please try again.", "error");
    }
  };

  // Handle customer selection from modal
  const handleCustomerSelect = (
    customer: { customerId: number; customerName: string },
    user?: { userId: number; userName: string; localUserId: string },
    store?: { storeID: string; storeName: string }
  ) => {
    // Update customerId in auth state
    updateCustomerId(customer.customerId);

    // Update customer slice for TenantContext
    dispatch(setCurrentCustomer({
      customerId: customer.customerId,
      customerName: customer.customerName,
      email: ''
    }));

    // Update localUserId and storeId in localStorage
    const storedUser = localStorage.getItem('userData');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        if (user) {
          userData.localUserId = user.localUserId;
        }
        if (store) {
          userData.storeId = store.storeID;
          userData.storeName = store.storeName;
        }
        localStorage.setItem('userData', JSON.stringify(userData));
      } catch (err) {
        console.error('Error updating userData:', err);
      }
    }

    // Update store context
    if (store) {
      switchStore({
        storeId: store.storeID,
        storeName: store.storeName
      });
    }

    // Mark selection as done to prevent UserDropdown from reopening
    localStorage.setItem('superAdminSelectionDone', 'true');

    // Save last session preference to backend for auto-restore on next login
    const lastSession = {
      customerId: customer.customerId,
      customerName: customer.customerName,
      localUserId: user?.localUserId || '',
      userId: user?.userId || 0,
      storeId: store?.storeID || '',
      storeName: store?.storeName || '',
    };
    userPreferenceService.savePreference('lastSession', lastSession).catch(() => {});

    setShowCustomerModal(false);
    showToast("Login successful! Welcome back.", "success");
    setTimeout(() => {
      navigate('/');
    }, 500);
  };

  // Handle cancel on modal - clear tokens and stay on signin page
  const handleCustomerCancel = () => {
    // Clear any stored tokens since user cancelled
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    setShowCustomerModal(false);
  };

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Handle session conflict confirmation
  const handleSessionConfirm = async (sessionIdToRevoke?: string) => {
    try {
      const result = await confirmLogin(sessionIdToRevoke);

      // After revoking the conflicting session, the API may still require MFA
      if (result.mfaRequired && result.mfaToken && result.preferredMethod) {
        setMfaState({ mfaToken: result.mfaToken, preferredMethod: result.preferredMethod, force30DayReauth: result.force30DayReauth ?? true, isTotpSetup: result.isTotpSetup ?? false });
        return;
      }

      if (result.success) {
        const needsCustomerSelection = !result.customerId ||
                                       result.customerId === null ||
                                       result.customerId === undefined ||
                                       result.customerId === 0;
        if (needsCustomerSelection) {
          setShowCustomerModal(true);
        } else {
          await redirectAfterCustomerLogin();
        }
      }
    } catch (err: any) {
      console.error("Session confirm error:", err);
      const responseData = err?.response?.data;
      const msg = (typeof responseData === 'string' ? responseData : responseData?.message)
        || "Failed to confirm login. Please try again.";
      showToast(msg, "error");
    }
  };

  const handleSessionCancel = () => {
    clearSessionConflict();
  };

  // Handle successful MFA verification (same post-login flow as regular login)
  const handleMfaSuccess = (customerId: number | null) => {
    setMfaState(null);
    const needsCustomerSelection = !customerId || customerId === null || customerId === undefined || customerId === 0;
    if (needsCustomerSelection) {
      setShowCustomerModal(true);
    } else {
      showToast("Login successful! Welcome back.", "success");
      setTimeout(() => navigate('/'), 500);
    }
  };

  // Show toast if redirected here after session expiry
  useEffect(() => {
    const expired = sessionStorage.getItem('sessionExpired');
    if (expired === 'true') {
      sessionStorage.removeItem('sessionExpired');
      showToast('Your session has expired. Please sign in again.', 'info');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (error && (email || password)) {
      clearError();
    }
  }, [email, password, error, clearError]);

  // ─── If MFA is pending, swap out the entire sign-in UI ──────────────────────
  if (mfaState) {
    return (
      <MfaVerificationForm
        mfaToken={mfaState.mfaToken}
        preferredMethod={mfaState.preferredMethod}
        force30DayReauth={mfaState.force30DayReauth}
        isTotpSetup={mfaState.isTotpSetup}
        onSuccess={handleMfaSuccess}
        onBack={() => setMfaState(null)}
      />
    );
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[350px] max-w-[400px] transition-all duration-300 animate-slide-in">
          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Icon based on toast type */}
              <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center">
                {toast.type === "success" ? (
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-500/10 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                ) : toast.type === "info" ? (
                  <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  {toast.type === "success" ? "Login Successful" : toast.type === "info" ? "Session Expired" : "Login Failed"}
                </h4>
                <p className="text-sm text-gray-500">
                  {toast.message}
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={closeToast}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            {/* Animated Progress Bar */}
            <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
              <div
                className={`h-1 rounded-full animate-progress-bar ${
                  toast.type === "success" ? "bg-green-500" : toast.type === "info" ? "bg-brand-500" : "bg-red-500"
                }`}
                style={{
                  width: '100%',
                  animation: 'progressBar 3s linear forwards'
                }}
              ></div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Sign In
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your email and password to sign in
            </p>
          </div>
          <form onSubmit={handleSignIn}>
            <div className="space-y-6">
              {error && (
                <div className="text-red-600 text-sm bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                </div>
              )}
              <div>
                <Label>
                  Email <span className="text-error-500">*</span>
                </Label>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={emailError || (error && error.includes('credentials')) ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
                />
                {emailError && (
                  <p className="text-red-500 text-sm mt-2">{emailError}</p>
                )}
              </div>
              <div>
                <Label>
                  Password <span className="text-error-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={passwordError || (error && error.includes('credentials')) ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
                  />
                  <span
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                  >
                    {showPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                    )}
                  </span>
                </div>
                {passwordError && (
                  <p className="text-red-500 text-sm mt-2">{passwordError}</p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox checked={isChecked} onChange={setIsChecked} />
                  <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                    Keep me logged in
                  </span>
                </div>
                <Link
                  to="/forgot-password"
                  className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Forgot password?
                </Link>
              </div>
              <div>
                <Button
                  className="w-full"
                  size="sm"
                  disabled={loading}
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>
              </div>
            </div>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                Or sign in with
              </span>
            </div>
          </div>

          {/* Google Login Button */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                showToast("Google login failed. Please try again.", "error");
              }}
              size="large"
              width="100%"
              text="signin_with"
              shape="rectangular"
              theme="outline"
            />
          </div>
        </div>
      </div>

      {/* Session Conflict Modal */}
      <SessionConflictModal
        isOpen={!!sessionConflict}
        conflict={sessionConflict}
        onConfirm={handleSessionConfirm}
        onCancel={handleSessionCancel}
        loading={confirmingSession}
      />

      {/* Customer Selection Modal for SuperAdmin */}
      <CustomerSelectionModal
        isOpen={showCustomerModal}
        onSelect={handleCustomerSelect}
        onCancel={handleCustomerCancel}
        loginMode
      />

      {/* Store Selection Modal — shown post-login when the user has a single
          tenant but multiple stores and no matching last-session store. */}
      <SwitchStoreModal
        isOpen={showStoreModal}
        onClose={() => setShowStoreModal(false)}
        loginMode
        onStoreSelected={handleStoreSelectedAtLogin}
        onCancel={handleStoreCancelAtLogin}
      />
    </div>
  );
}