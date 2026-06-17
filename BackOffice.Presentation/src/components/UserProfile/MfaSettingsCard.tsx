import React, { useState, useEffect } from 'react';
import { authService, type MfaStatusDto, type TotpSetupDto } from '../../services/authService';
import { Modal } from '../ui/modal';
import { useModal } from '../../hooks/useModal';
import Button from '../ui/button/Button';
import Label from '../form/Label';
import Input from '../form/input/InputField';
import ProfileActionButton from './ProfileActionButton';

// ─────────────────────────────────────────────────────────────────────────────

type ActiveModal =
  | 'totp-choice'      // Choose: reuse existing authenticator or set up new
  | 'totp-reactivate'  // Verify code from existing authenticator to re-enable
  | 'totp-setup'       // Show QR code + confirm TOTP code
  | 'disable-totp'     // Confirm disabling MFA
  | 'recovery-codes';  // Show newly regenerated recovery codes

export default function MfaSettingsCard() {
  const [status, setStatus] = useState<MfaStatusDto | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);
  const { isOpen, openModal, closeModal } = useModal();

  // TOTP setup state
  const [totpSetup, setTotpSetup] = useState<TotpSetupDto | null>(null);
  const [totpSetupLoading, setTotpSetupLoading] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [totpCodeError, setTotpCodeError] = useState('');
  const [confirmingTotp, setConfirmingTotp] = useState(false);

  // Recovery codes state
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [recoveryCount, setRecoveryCount] = useState<number | null>(null);
  const [regeneratingCodes, setRegeneratingCodes] = useState(false);

  // Preferred method state
  const [preferredMethod, setPreferredMethod] = useState<string | null>(null);
  const [savingMethod, setSavingMethod] = useState(false);

  // Reactivation state (reuse existing authenticator)
  const [reactivateCode, setReactivateCode] = useState('');
  const [reactivateError, setReactivateError] = useState('');
  const [reactivating, setReactivating] = useState(false);

  // Disable state
  const [disabling, setDisabling] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    show: false, message: '', type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  // ─── Load MFA status on mount ──────────────────────────────────────────────

  const loadStatus = async () => {
    setStatusLoading(true);
    try {
      const s = await authService.getMfaStatus();
      setStatus(s);
      setPreferredMethod(s.preferredMfaMethod ?? null);
      if (s.isMfaEnabled) {
        const count = await authService.getRecoveryCodesCount();
        setRecoveryCount(count);
      }
    } catch {
      // ignore — user may not have MFA settings yet
      setStatus({ isMfaEnabled: false, isTotpSetup: false, isEmailOtpEnabled: false, preferredMfaMethod: null, hasTotpSecret: false });
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  // ─── Open helpers ──────────────────────────────────────────────────────────

  const handleEnableMfa = () => {
    // If user previously had TOTP set up, show choice modal
    if (status?.hasTotpSecret) {
      setActiveModal('totp-choice');
      openModal();
    } else {
      openTotpSetup();
    }
  };

  const openReactivate = () => {
    setReactivateCode('');
    setReactivateError('');
    setActiveModal('totp-reactivate');
  };

  const openNewSetup = async () => {
    setTotpCode('');
    setTotpCodeError('');
    setTotpSetup(null);
    setActiveModal('totp-setup');
    setTotpSetupLoading(true);
    try {
      const setup = await authService.resetTotpSetup();
      setTotpSetup(setup);
    } catch {
      showToast('Failed to create new TOTP setup. Please try again.', 'error');
      handleClose();
    } finally {
      setTotpSetupLoading(false);
    }
  };

  const handleReactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = reactivateCode.replace(/\s/g, '');
    if (code.length !== 6) {
      setReactivateError('Please enter the 6-digit code from your authenticator app.');
      return;
    }
    setReactivating(true);
    setReactivateError('');
    try {
      const ok = await authService.reactivateTotp(code);
      if (ok) {
        handleClose();
        showToast('MFA has been re-enabled using your existing authenticator app.', 'success');
        await loadStatus();
      } else {
        setReactivateError('Wrong code, please try again.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || 'Wrong code, please try again.';
      setReactivateError(typeof msg === 'string' ? msg : 'Wrong code, please try again.');
    } finally {
      setReactivating(false);
    }
  };

  const openTotpSetup = async () => {
    setTotpCode('');
    setTotpCodeError('');
    setTotpSetup(null);
    setActiveModal('totp-setup');
    if (!isOpen) openModal();
    setTotpSetupLoading(true);
    try {
      const setup = await authService.setupTotp();
      setTotpSetup(setup);
    } catch {
      showToast('Failed to load TOTP setup. Please try again.', 'error');
      closeModal();
    } finally {
      setTotpSetupLoading(false);
    }
  };

  const openDisable = () => {
    setActiveModal('disable-totp');
    openModal();
  };

  const openRecoveryCodes = async (freshCodes?: string[]) => {
    if (freshCodes) {
      setRecoveryCodes(freshCodes);
      setActiveModal('recovery-codes');
      openModal();
    } else {
      setRegeneratingCodes(true);
      try {
        const codes = await authService.regenerateRecoveryCodes();
        setRecoveryCodes(codes);
        setRecoveryCount(codes.length);
        setActiveModal('recovery-codes');
        openModal();
      } catch {
        showToast('Failed to regenerate recovery codes.', 'error');
      } finally {
        setRegeneratingCodes(false);
      }
    }
  };

  const handleClose = () => {
    setActiveModal(null);
    setTotpCode('');
    setTotpCodeError('');
    setTotpSetup(null);
    setReactivateCode('');
    setReactivateError('');
    closeModal();
  };

  // ─── TOTP confirm ──────────────────────────────────────────────────────────

  const handleConfirmTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = totpCode.replace(/\s/g, '');
    if (code.length !== 6) {
      setTotpCodeError('Please enter the 6-digit code from your authenticator app.');
      return;
    }
    setConfirmingTotp(true);
    setTotpCodeError('');
    try {
      const ok = await authService.verifyTotpSetup(code);
      if (ok) {
        handleClose();
        showToast('MFA has been enabled. You will now need a code on every login.', 'success');
        await loadStatus();
      } else {
        setTotpCodeError('Invalid code. Please try again with a fresh code from your app.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || 'Invalid code. Please try again.';
      setTotpCodeError(typeof msg === 'string' ? msg : 'Invalid code.');
    } finally {
      setConfirmingTotp(false);
    }
  };

  // ─── Disable TOTP ─────────────────────────────────────────────────────────

  const handleDisable = async () => {
    setDisabling(true);
    try {
      await authService.disableTotp();
      handleClose();
      showToast('MFA has been disabled.', 'info');
      setRecoveryCount(null);
      await loadStatus();
    } catch {
      showToast('Failed to disable MFA. Please try again.', 'error');
    } finally {
      setDisabling(false);
    }
  };

  // ─── Copy recovery codes ───────────────────────────────────────────────────

  const handleCopyAll = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n')).then(() => {
      showToast('Recovery codes copied to clipboard.', 'success');
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (statusLoading) {
    return (
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
          <div>
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-3 w-48 bg-gray-100 dark:bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const isEnabled = status?.isMfaEnabled ?? false;
  const isTotpSetup = status?.isTotpSetup ?? false;

  return (
    <>
      {/* Toast */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[320px] max-w-[400px] animate-slide-in">
          <div className="p-4 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center ${
              toast.type === 'success' ? 'bg-green-100 dark:bg-green-500/10' :
              toast.type === 'info' ? 'bg-brand-50' : 'bg-red-100'
            }`}>
              {toast.type === 'success' ? (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Card */}
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isEnabled ? 'bg-green-100 dark:bg-green-500/10' : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                <svg className={`w-5 h-5 ${isEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  Two-Factor Authentication
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Add an extra layer of security to your account.
                </p>
              </div>
            </div>

            {/* Status grid */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* MFA status */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <p className="mb-1.5 text-xs leading-normal text-gray-500 dark:text-gray-400">Status</p>
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                  <p className={`text-sm font-semibold ${isEnabled ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {isEnabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>

              {/* Preferred Method */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <p className="mb-1.5 text-xs leading-normal text-gray-500 dark:text-gray-400">
                  {isEnabled ? 'Preferred Method' : 'Method'}
                </p>
                {isEnabled ? (
                  <select
                    value={preferredMethod ?? ''}
                    onChange={async (e) => {
                      const val = e.target.value || null;
                      setSavingMethod(true);
                      try {
                        if (val) {
                          await authService.setPreferredMethod(val);
                        }
                        setPreferredMethod(val);
                        showToast('Preferred method updated.', 'success');
                      } catch {
                        showToast('Failed to update preferred method.', 'error');
                      } finally {
                        setSavingMethod(false);
                      }
                    }}
                    disabled={savingMethod}
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white/90 px-2 py-1.5 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                  >
                    <option value="">Auto-detect</option>
                    {isTotpSetup && <option value="totp">Authenticator App</option>}
                    <option value="email">Email OTP</option>
                  </select>
                ) : (
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">—</p>
                )}
              </div>

              {/* Recovery codes */}
              {isEnabled && (
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <p className="mb-1.5 text-xs leading-normal text-gray-500 dark:text-gray-400">Recovery Codes</p>
                  <p className={`text-sm font-semibold ${
                    recoveryCount === 0 ? 'text-red-600 dark:text-red-400' :
                    (recoveryCount ?? 0) <= 2 ? 'text-amber-600 dark:text-amber-400' :
                    'text-gray-800 dark:text-white/90'
                  }`}>
                    {recoveryCount !== null ? `${recoveryCount} remaining` : '—'}
                    {recoveryCount === 0 && ' ⚠'}
                  </p>
                </div>
              )}
            </div>

            {/* Alerts */}
            {isEnabled && recoveryCount === 0 && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 flex items-start gap-2">
                <svg className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700 dark:text-red-400">
                  You have no recovery codes left. Regenerate them now to avoid getting locked out.
                </p>
              </div>
            )}

            {!isEnabled && (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                Enable two-factor authentication to protect your account with an additional verification step on every login.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 lg:ml-6 lg:min-w-[160px]">
            {!isEnabled ? (
              <ProfileActionButton
                onClick={handleEnableMfa}
                className="w-full"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                Enable MFA
              </ProfileActionButton>
            ) : (
              <>
                <ProfileActionButton
                  onClick={() => openRecoveryCodes()}
                  disabled={regeneratingCodes}
                  className="w-full"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  }
                >
                  {regeneratingCodes ? 'Generating...' : 'New Recovery Codes'}
                </ProfileActionButton>
                <ProfileActionButton
                  onClick={openDisable}
                  variant="danger"
                  className="w-full"
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  }
                >
                  Disable MFA
                </ProfileActionButton>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── Modals ────────────────────────────────────────────────────────── */}

      <Modal isOpen={isOpen} onClose={handleClose} className="max-w-[540px] m-4">
        <div className="no-scrollbar relative w-full max-w-[540px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-10">

          {/* ── Choice Modal: Reuse or New Setup ── */}
          {activeModal === 'totp-choice' && (
            <>
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-500/10 mx-auto mb-5">
                <svg className="w-7 h-7 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h4 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white/90 text-center">
                Re-enable Two-Factor Authentication
              </h4>
              <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                You previously had an authenticator app set up. How would you like to proceed?
              </p>
              <div className="space-y-3">
                <button
                  onClick={openReactivate}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-brand-500 dark:hover:border-brand-500 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">Use existing authenticator app</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Enter a code from your current app to re-enable</p>
                  </div>
                </button>
                <button
                  onClick={openNewSetup}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-brand-500 dark:hover:border-brand-500 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">Set up a new authenticator app</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Scan a new QR code (use if you lost your old app)</p>
                  </div>
                </button>
              </div>
              <div className="mt-4 text-center">
                <Button size="sm" variant="outline" onClick={handleClose}>Cancel</Button>
              </div>
            </>
          )}

          {/* ── Reactivate Modal: Verify code from existing app ── */}
          {activeModal === 'totp-reactivate' && (
            <>
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-green-100 dark:bg-green-500/10 mx-auto mb-5">
                <svg className="w-7 h-7 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h4 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white/90 text-center">
                Verify Your Authenticator App
              </h4>
              <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                Enter the 6-digit code from your authenticator app to re-enable MFA.
              </p>
              <form onSubmit={handleReactivate}>
                <div className="mb-4">
                  <Label>Verification Code</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={reactivateCode}
                    onChange={(e) => { setReactivateCode(e.target.value.replace(/\D/g, '')); setReactivateError(''); }}
                    placeholder="Enter 6-digit code"
                    className={reactivateError ? 'border-red-400' : ''}
                  />
                  {reactivateError && (
                    <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{reactivateError}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 justify-end mt-6">
                  <Button size="sm" variant="outline" onClick={() => setActiveModal('totp-choice')} type="button">Back</Button>
                  <Button size="sm" disabled={reactivating} type="submit">
                    {reactivating ? 'Verifying...' : 'Re-enable MFA'}
                  </Button>
                </div>
              </form>
            </>
          )}

          {/* ── TOTP Setup Modal ── */}
          {activeModal === 'totp-setup' && (
            <>
              <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
                Enable Authenticator App
              </h4>
              <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code to confirm.
              </p>

              {totpSetupLoading ? (
                <div className="flex flex-col items-center py-8 gap-4">
                  <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-500">Loading setup…</p>
                </div>
              ) : totpSetup ? (
                <>
                  {/* QR Code */}
                  <div className="flex flex-col items-center mb-6">
                    <div className="p-3 bg-white border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm">
                      <img
                        src={totpSetup.qrCodeBase64}
                        alt="TOTP QR Code"
                        className="w-44 h-44"
                      />
                    </div>
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      Can't scan? Enter this secret manually:
                    </p>
                    <code className="mt-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-mono tracking-widest text-gray-700 dark:text-gray-300 select-all">
                      {totpSetup.secret}
                    </code>
                  </div>

                  {/* Confirm code form */}
                  <form onSubmit={handleConfirmTotp}>
                    <div className="mb-4">
                      <Label>Verification Code</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={totpCode}
                        onChange={(e) => { setTotpCode(e.target.value.replace(/\D/g, '')); setTotpCodeError(''); }}
                        placeholder="Enter 6-digit code"
                        className={totpCodeError ? 'border-red-400' : ''}
                      />
                      {totpCodeError && (
                        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{totpCodeError}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 justify-end mt-6">
                      <Button size="sm" variant="outline" onClick={handleClose} type="button">Cancel</Button>
                      <Button size="sm" disabled={confirmingTotp} type="submit">
                        {confirmingTotp ? 'Verifying…' : 'Enable MFA'}
                      </Button>
                    </div>
                  </form>
                </>
              ) : null}
            </>
          )}

          {/* ── Disable MFA Modal ── */}
          {activeModal === 'disable-totp' && (
            <>
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/20 mx-auto mb-5">
                <svg className="w-7 h-7 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h4 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white/90 text-center">
                Disable Two-Factor Authentication?
              </h4>
              <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                This will remove the extra security layer from your account. You can always re-enable it later.
              </p>
              <div className="flex items-center gap-3 justify-center">
                <Button size="sm" variant="outline" onClick={handleClose}>Keep MFA Enabled</Button>
                <Button size="sm" onClick={handleDisable} disabled={disabling}
                  className="bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700 text-white">
                  {disabling ? 'Disabling…' : 'Yes, Disable MFA'}
                </Button>
              </div>
            </>
          )}

          {/* ── Recovery Codes Modal ── */}
          {activeModal === 'recovery-codes' && (
            <>
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/10 mx-auto mb-5">
                <svg className="w-7 h-7 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90 text-center">
                Recovery Codes
              </h4>
              <p className="mb-5 text-sm text-gray-500 dark:text-gray-400 text-center">
                Save these codes somewhere safe. Each code can only be used <strong>once</strong>. These will not be shown again.
              </p>

              <div className="grid grid-cols-2 gap-2 mb-5 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                {recoveryCodes.map((code, i) => (
                  <code key={i}
                    className="text-center px-3 py-2 bg-white dark:bg-gray-700 rounded-lg text-sm font-mono tracking-wider text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 select-all">
                    {code}
                  </code>
                ))}
              </div>

              <div className="flex items-center gap-3 justify-between">
                <button
                  onClick={handleCopyAll}
                  className="inline-flex items-center gap-2 text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400 font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy all codes
                </button>
                <Button size="sm" onClick={handleClose}>Done</Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
