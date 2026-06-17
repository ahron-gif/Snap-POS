import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import Button from '../ui/button/Button';

interface MfaVerificationFormProps {
  mfaToken: string;
  preferredMethod: 'totp' | 'email';
  force30DayReauth: boolean;
  isTotpSetup: boolean;
  onSuccess: (customerId: number | null) => void;
  onBack: () => void;
}

type MfaMethod = 'totp' | 'email' | 'recovery';

export default function MfaVerificationForm({
  mfaToken,
  preferredMethod,
  force30DayReauth,
  isTotpSetup,
  onSuccess,
  onBack,
}: MfaVerificationFormProps) {
  const { completeMfa, loading } = useAuth();

  // Active method — starts with the preferred one from the server
  const [method, setMethod] = useState<MfaMethod>(preferredMethod);

  // 6 individual digit inputs for TOTP / email OTP
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Recovery code is a single text input
  const [recoveryCode, setRecoveryCode] = useState('');

  const [rememberDevice, setRememberDevice] = useState(false);

  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(preferredMethod === 'email'); // already sent during login
  const [error, setError] = useState('');

  // Toast state
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    show: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  // Auto-focus first digit on mount / method change
  useEffect(() => {
    if (method !== 'recovery') {
      setTimeout(() => digitRefs.current[0]?.focus(), 100);
    }
  }, [method]);

  // ─── Digit input helpers ─────────────────────────────────────────────────────

  const handleDigitChange = (index: number, value: string) => {
    // Accept only digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');

    if (digit && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setDigits(pasted.split(''));
      digitRefs.current[5]?.focus();
    }
  };

  const getOtpCode = (): string => digits.join('');

  const resetDigits = () => {
    setDigits(['', '', '', '', '', '']);
    setError('');
    setTimeout(() => digitRefs.current[0]?.focus(), 50);
  };

  // ─── Send / Resend email OTP ─────────────────────────────────────────────────

  const handleSendEmailOtp = async () => {
    setSendingEmail(true);
    try {
      await authService.sendEmailOtp(mfaToken);
      setEmailSent(true);
      resetDigits();
      showToast('A verification code has been sent to your email.', 'success');
    } catch {
      showToast('Failed to send email OTP. Please try again.', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  // ─── Submit handler ──────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let code = '';
    if (method === 'recovery') {
      code = recoveryCode.trim();
      if (!code) {
        setError('Please enter your recovery code.');
        return;
      }
    } else {
      code = getOtpCode();
      if (code.length !== 6) {
        setError('Please enter all 6 digits.');
        return;
      }
    }

    try {
      const result = await completeMfa(mfaToken, code, method, rememberDevice);
      if (result.success) {
        showToast('Authentication successful! Welcome back.', 'success');
        setTimeout(() => onSuccess(result.customerId), 400);
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data ||
        'Wrong code, please try again.';
      setError(typeof msg === 'string' ? msg : 'Wrong code, please try again.');
      if (method !== 'recovery') resetDigits();
    }
  };

  // ─── Switch method ────────────────────────────────────────────────────────────

  const switchToEmail = async () => {
    setMethod('email');
    setError('');
    resetDigits();
    if (!emailSent) {
      await handleSendEmailOtp();
    }
  };

  const switchToTotp = () => {
    setMethod('totp');
    setError('');
    resetDigits();
  };

  const switchToRecovery = () => {
    setMethod('recovery');
    setRecoveryCode('');
    setError('');
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const renderMethodLabel = () => {
    if (method === 'totp') return 'Authenticator App';
    if (method === 'email') return 'Email OTP';
    return 'Recovery Code';
  };

  const renderMethodIcon = () => {
    if (method === 'totp') {
      return (
        <div className="w-14 h-14 bg-brand-50 dark:bg-brand-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
      );
    }
    if (method === 'email') {
      return (
        <div className="w-14 h-14 bg-green-50 dark:bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
      );
    }
    return (
      <div className="w-14 h-14 bg-amber-50 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
            d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Toast */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[320px] max-w-[400px] animate-slide-in">
          <div className="p-4 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center ${
              toast.type === 'success' ? 'bg-green-100 dark:bg-green-500/10' :
              toast.type === 'info' ? 'bg-brand-50' : 'bg-red-100'
            }`}>
              {toast.type === 'success' ? (
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              ) : toast.type === 'info' ? (
                <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {toast.type === 'success' ? 'Success' : toast.type === 'info' ? 'Info' : 'Error'}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">{toast.message}</p>
            </div>
            <button onClick={() => setToast({ show: false, message: '', type: 'success' })}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          {/* Header */}
          <div className="text-center mb-7">
            {renderMethodIcon()}
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Two-Factor Authentication
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {method === 'totp' && 'Open your authenticator app and enter the 6-digit code.'}
              {method === 'email' && (emailSent
                ? 'A 6-digit code was sent to your email address.'
                : 'Click below to receive a code at your email address.')}
              {method === 'recovery' && 'Enter one of your saved recovery codes.'}
            </p>
          </div>

          {/* Method badge */}
          <div className="flex justify-center mb-6">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              method === 'totp' ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400' :
              method === 'email' ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' :
              'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
            }`}>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
              </svg>
              {renderMethodLabel()}
            </span>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Email send button (if email method and not yet sent) */}
            {method === 'email' && !emailSent && (
              <div className="mb-5">
                <Button
                  className="w-full"
                  size="sm"
                  onClick={handleSendEmailOtp}
                  disabled={sendingEmail}
                  type="button"
                >
                  {sendingEmail ? 'Sending...' : 'Send Code to Email'}
                </Button>
              </div>
            )}

            {/* OTP digit inputs (TOTP and email) */}
            {method !== 'recovery' && (
              <div className="mb-5">
                <div className="flex gap-2 justify-center">
                  {digits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { digitRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(i, e)}
                      onPaste={handleDigitPaste}
                      className={`w-11 h-12 text-center text-lg font-semibold rounded-xl border-2 transition-colors
                        focus:outline-none focus:border-brand-500 dark:bg-gray-800 dark:text-white
                        ${digit ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'}
                        ${error ? 'border-red-400' : ''}
                      `}
                      disabled={loading}
                    />
                  ))}
                </div>
                {method === 'email' && emailSent && (
                  <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Didn't receive it?{' '}
                    <button
                      type="button"
                      onClick={handleSendEmailOtp}
                      disabled={sendingEmail}
                      className="text-brand-500 hover:text-brand-600 font-medium underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      {sendingEmail ? 'Sending...' : 'Resend code'}
                    </button>
                  </p>
                )}
              </div>
            )}

            {/* Recovery code input */}
            {method === 'recovery' && (
              <div className="mb-5">
                <input
                  type="text"
                  value={recoveryCode}
                  onChange={(e) => { setRecoveryCode(e.target.value.toUpperCase()); setError(''); }}
                  placeholder="XXXXXXXXXX"
                  autoFocus
                  className={`w-full h-12 px-4 text-center text-base font-mono rounded-xl border-2 transition-colors
                    focus:outline-none focus:border-brand-500 dark:bg-gray-800 dark:text-white
                    ${error ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}
                  `}
                  disabled={loading}
                />
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
              </div>
            )}

            {/* Remember device checkbox */}
            <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500 dark:bg-gray-800"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {force30DayReauth ? 'Remember device for 30 days' : 'Remember this device'}
              </span>
            </label>

            {/* Verify button */}
            {(method !== 'email' || emailSent) && (
              <Button className="w-full" size="sm" disabled={loading} type="submit">
                {loading ? 'Verifying...' : 'Verify'}
              </Button>
            )}
          </form>

          {/* Method switchers */}
          <div className="mt-5 space-y-2">
            {method !== 'totp' && isTotpSetup && (
              <button
                type="button"
                onClick={switchToTotp}
                className="w-full text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Use authenticator app instead
              </button>
            )}
            {method !== 'email' && (
              <button
                type="button"
                onClick={switchToEmail}
                disabled={sendingEmail}
                className="w-full text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {sendingEmail ? 'Sending email...' : 'Send code to email instead'}
              </button>
            )}
            {method !== 'recovery' && (
              <button
                type="button"
                onClick={switchToRecovery}
                className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center justify-center gap-1.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Use a recovery code
              </button>
            )}
          </div>

          {/* Back to sign in */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 inline-flex items-center gap-1 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
