import apiClient from '../lib/axios';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  email: string;
  userId: number;
  localUserId: string;
  username: string;
  role: string;
  customerId: number | null;
  sessionId: string;
  billingStatus?: string;
  deviceToken?: string;
  deviceTokenExpiresAt?: string; // ISO 8601 or null (never expires)
}

export interface ActiveSessionInfo {
  deviceInfo: string | null;
  ipAddress: string | null;
  lastActivityAt: string;
}

export interface CustomerLimitInfo {
  maxAllowed: number;
  currentActive: number;
}

export interface ActiveSessionDetail {
  sessionId: string;
  userName: string | null;
  deviceInfo: string | null;
  ipAddress: string | null;
  lastActivityAt: string;
}

export interface LoginConflictResponse {
  requiresConfirmation: boolean;
  conflictType: 'user_session' | 'customer_limit';
  message: string;
  temporaryToken: string;
  userActiveSession: ActiveSessionInfo | null;
  customerLimitInfo: CustomerLimitInfo | null;
  activeSessions: ActiveSessionDetail[] | null;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

// ─── MFA types ────────────────────────────────────────────────────────────────

export interface MfaRequiredResponse {
  mfaRequired: true;
  mfaToken: string;
  preferredMethod: 'totp' | 'email';
  force30DayReauth: boolean;
  isTotpSetup: boolean;
}

export interface MfaStatusDto {
  isMfaEnabled: boolean;
  isTotpSetup: boolean;
  isEmailOtpEnabled: boolean;
  preferredMfaMethod: string | null;
  hasTotpSecret: boolean;
}

export interface TotpSetupDto {
  secret: string;
  qrCodeUri: string;
  qrCodeBase64: string;
}

export interface RecoveryCodesResult {
  codes: string[];
}

// ─────────────────────────────────────────────────────────────────────────────

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse | LoginConflictResponse | MfaRequiredResponse> {
    const response = await apiClient.post('/api/Auth/login', { email, password }, {
      headers: { 'Content-Type': 'application/json-patch+json' },
    });
    return response.data;
  },

  async confirmLogin(temporaryToken: string, sessionIdToRevoke?: string): Promise<LoginResponse | MfaRequiredResponse> {
    const response = await apiClient.post('/api/Auth/confirm-login', { temporaryToken, sessionIdToRevoke }, {
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  },

  /** Step 2 of MFA login — verify the OTP/TOTP/recovery code and get a full JWT */
  async verifyMfa(mfaToken: string, code: string, method: string, rememberDevice: boolean = false): Promise<LoginResponse> {
    const response = await apiClient.post('/api/Auth/verify-mfa', { mfaToken, code, method, rememberDevice });
    return response.data;
  },

  async refreshAccessToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const response = await apiClient.post('/api/Auth/refresh', { refreshToken }, {
      headers: { 'Content-Type': 'application/json' },
    });
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/api/Auth/logout');
    } catch {
      // Ignore errors on logout — we clear local state regardless
    }
  },

  async forgotPassword(email: string): Promise<{ isSuccess: boolean; message: string }> {
    const response = await apiClient.post('/api/Auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<{ isSuccess: boolean; message: string }> {
    const response = await apiClient.post('/api/Auth/reset-password', { token, newPassword, confirmPassword });
    return response.data;
  },

  // ─── MFA management (requires auth) ───────────────────────────────────────
  // Note: MfaController uses ApiResponseFactory which wraps data under "response" key:
  // { isSuccess: true, response: { ... }, message: "..." }

  async getMfaStatus(): Promise<MfaStatusDto> {
    const response = await apiClient.get('/api/Mfa/status');
    return response.data.response;
  },

  async setupTotp(): Promise<TotpSetupDto> {
    const response = await apiClient.post('/api/Mfa/totp/setup');
    return response.data.response;
  },

  async verifyTotpSetup(code: string): Promise<boolean> {
    const response = await apiClient.post('/api/Mfa/totp/verify-setup', { code });
    return response.data.isSuccess === true;
  },

  async disableTotp(): Promise<void> {
    await apiClient.post('/api/Mfa/totp/disable');
  },

  /** Re-enable MFA using the existing authenticator app (no QR scan needed) */
  async reactivateTotp(code: string): Promise<boolean> {
    const response = await apiClient.post('/api/Mfa/totp/reactivate', { code });
    return response.data.isSuccess === true;
  },

  /** Generate a fresh TOTP secret (discards old one), returns new QR code */
  async resetTotpSetup(): Promise<TotpSetupDto> {
    const response = await apiClient.post('/api/Mfa/totp/reset-setup');
    return response.data.response;
  },

  /** Send an email OTP during the MFA login step (AllowAnonymous — uses mfaToken not JWT) */
  async sendEmailOtp(mfaToken: string): Promise<void> {
    await apiClient.post('/api/Mfa/email/send-otp', { mfaToken });
  },

  async getRecoveryCodesCount(): Promise<number> {
    const response = await apiClient.get('/api/Mfa/recovery-codes/count');
    return response.data.response?.count ?? 0;
  },

  async regenerateRecoveryCodes(): Promise<string[]> {
    const response = await apiClient.post('/api/Mfa/recovery-codes/regenerate');
    return response.data.response?.codes ?? [];
  },

  // ─── Preferred MFA method ────────────────────────────────────────────────

  async setPreferredMethod(method: string): Promise<void> {
    await apiClient.post('/api/Mfa/preferred-method', { method });
  },

  // ─── Admin config ────────────────────────────────────────────────────────

  async getMfaConfig(key: string): Promise<string | null> {
    const response = await apiClient.get(`/api/Mfa/config/${key}`);
    return response.data.response?.value ?? null;
  },

  async setMfaConfig(key: string, value: string): Promise<void> {
    await apiClient.put(`/api/Mfa/config/${key}`, { value });
  },
};

export function isConflictResponse(
  data: LoginResponse | LoginConflictResponse | MfaRequiredResponse
): data is LoginConflictResponse {
  return 'requiresConfirmation' in data && (data as LoginConflictResponse).requiresConfirmation === true;
}

export function isMfaRequiredResponse(
  data: LoginResponse | LoginConflictResponse | MfaRequiredResponse
): data is MfaRequiredResponse {
  return 'mfaRequired' in data && (data as MfaRequiredResponse).mfaRequired === true;
}
