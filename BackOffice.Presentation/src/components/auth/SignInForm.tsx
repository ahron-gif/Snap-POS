import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
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
    setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);
  };

  const closeToast = () => {
    setToast({ show: false, message: "", type: "success" });
  };

  const redirectAfterCustomerLogin = async () => {
    const finishNavigate = () => {
      showToast("Login successful! Welcome back.", "success");
      setTimeout(() => navigate('/'), 500);
    };

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

      let chosen: { storeID: string; storeName: string } | null = null;
      try {
        const prefResult = await userPreferenceService.getPreference('lastSession');
        if (prefResult.isSuccess && prefResult.response?.preferenceValue) {
          const lastSession = JSON.parse(prefResult.response.preferenceValue);
          if (lastSession?.storeId) {
            chosen = stores.find((s: any) => s.storeID === lastSession.storeId) ?? null;
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
            // Non-fatal
          }
        }
        finishNavigate();
        return;
      }

      setShowStoreModal(true);
    } catch {
      finishNavigate();
    }
  };

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

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

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

      if (result.mfaRequired && result.mfaToken && result.preferredMethod) {
        setMfaState({ mfaToken: result.mfaToken, preferredMethod: result.preferredMethod, force30DayReauth: result.force30DayReauth ?? true, isTotpSetup: result.isTotpSetup ?? false });
        return;
      }

      if (result.conflict) {
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
      console.error("Sign in error:", err);
      const responseData = err?.response?.data;
      const msg = (typeof responseData === 'string' ? responseData : responseData?.message)
        || "Failed to sign in. Please check your credentials.";
      showToast(msg, "error");
    }
  };

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

  const handleCustomerSelect = (
    customer: { customerId: number; customerName: string },
    user?: { userId: number; userName: string; localUserId: string },
    store?: { storeID: string; storeName: string }
  ) => {
    updateCustomerId(customer.customerId);

    dispatch(setCurrentCustomer({
      customerId: customer.customerId,
      customerName: customer.customerName,
      email: ''
    }));

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

    if (store) {
      switchStore({
        storeId: store.storeID,
        storeName: store.storeName
      });
    }

    localStorage.setItem('superAdminSelectionDone', 'true');

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

  const handleCustomerCancel = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    setShowCustomerModal(false);
  };

  const handleSessionConfirm = async (sessionIdToRevoke?: string) => {
    try {
      const result = await confirmLogin(sessionIdToRevoke);

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
    <>
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[350px] max-w-[400px] transition-all duration-300">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center">
                {toast.type === "success" ? (
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                ) : toast.type === "info" ? (
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 mb-1">
                  {toast.type === "success" ? "Login Successful" : toast.type === "info" ? "Session Expired" : "Login Failed"}
                </h4>
                <p className="text-sm text-gray-500">{toast.message}</p>
              </div>
              <button
                onClick={closeToast}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <div className="mt-3 w-full bg-gray-200 rounded-full h-1 overflow-hidden">
              <div
                className={`h-1 rounded-full ${
                  toast.type === "success" ? "bg-green-500" : toast.type === "info" ? "bg-blue-500" : "bg-red-500"
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

      {/* Form Header */}
      <h1
        className="text-[22px] font-bold text-[#1A1A2E] mb-1.5"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        Sign In
      </h1>
      <p className="text-sm text-[#7F8C8D] mb-7">
        Enter your email and password to sign in
      </p>

      {/* Error Message */}
      {error && (
        <div className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Sign In Form */}
      <form onSubmit={handleSignIn}>
        {/* Email Field */}
        <div className="mb-5">
          <label className="block text-[13px] font-medium text-[#1A1A2E] mb-1.5">
            Email <span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full px-4 py-3 text-sm border-[1.5px] rounded-[10px] bg-[#FAFBFC] text-[#1A1A2E] outline-none transition-all duration-200 placeholder:text-[#BDC3C7] ${
              emailError ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : 'border-[#E8ECF0] focus:border-[#2ECC71] focus:bg-white focus:shadow-[0_0_0_3px_rgba(46,204,113,0.1)]'
            }`}
            style={{ fontFamily: "'Inter', sans-serif" }}
          />
          {emailError && (
            <p className="text-red-500 text-xs mt-1.5">{emailError}</p>
          )}
        </div>

        {/* Password Field */}
        <div className="mb-5">
          <label className="block text-[13px] font-medium text-[#1A1A2E] mb-1.5">
            Password <span className="text-red-500 ml-0.5">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-3 pr-11 text-sm border-[1.5px] rounded-[10px] bg-[#FAFBFC] text-[#1A1A2E] outline-none transition-all duration-200 placeholder:text-[#BDC3C7] ${
                passwordError ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : 'border-[#E8ECF0] focus:border-[#2ECC71] focus:bg-white focus:shadow-[0_0_0_3px_rgba(46,204,113,0.1)]'
              }`}
              style={{ fontFamily: "'Inter', sans-serif" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#95A5A6] hover:text-[#2ECC71] transition-colors p-1"
              aria-label="Toggle password visibility"
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </div>
          {passwordError && (
            <p className="text-red-500 text-xs mt-1.5">{passwordError}</p>
          )}
        </div>

        {/* Options Row */}
        <div className="flex items-center justify-between mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-[#2ECC71] cursor-pointer"
            />
            <span className="text-[13px] text-[#4A4A5A]">Keep me logged in</span>
          </label>
          <Link
            to="/forgot-password"
            className="text-[13px] font-medium text-[#2ECC71] hover:text-[#27AE60] hover:underline transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {/* Sign In Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 text-[15px] font-semibold text-white rounded-[10px] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #2ECC71 0%, #27AE60 100%)',
            boxShadow: '0 4px 12px rgba(46, 204, 113, 0.3)',
            fontFamily: "'Inter', sans-serif",
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(46, 204, 113, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(46, 204, 113, 0.3)';
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center my-6 gap-3">
        <div className="flex-1 h-px bg-[#E8ECF0]"></div>
        <span className="text-xs font-medium text-[#95A5A6] whitespace-nowrap">Or sign in with</span>
        <div className="flex-1 h-px bg-[#E8ECF0]"></div>
      </div>

      {/* Google Sign In */}
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

      {/* Store Selection Modal */}
      <SwitchStoreModal
        isOpen={showStoreModal}
        onClose={() => setShowStoreModal(false)}
        loginMode
        onStoreSelected={handleStoreSelectedAtLogin}
        onCancel={handleStoreCancelAtLogin}
      />
    </>
  );
}
