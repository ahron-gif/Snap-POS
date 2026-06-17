// ── SMTP settings types — mirrors BackOffice.Application.DTOs.Main.SmtpSettings ──

export type SmtpSource = 'store' | 'global' | 'appsettings' | 'none';

export interface SmtpSettingsDto {
  customerId: number;
  storeId: string; // Guid
  host: string | null;
  port: number | null;
  useSsl: boolean;
  emailAddress: string | null;
  /** Server returns "********" as placeholder when a password exists. Empty when no password stored. */
  password: string | null;
  storeEmail: string | null;
  isComplete: boolean;
  /** Which layer the effective config came from. */
  source: SmtpSource;
}

export interface SmtpSettingsUpdateDto {
  storeId: string;
  host: string;
  port: number | null;
  useSsl: boolean;
  emailAddress: string;
  /** Send empty string or "********" to keep existing password unchanged. */
  password: string;
  storeEmail: string;
}

export const GLOBAL_STORE_ID = '00000000-0000-0000-0000-000000000000';

export interface SmtpStoreLookup {
  storeId: string;
  storeName: string;
  isMainStore: boolean;
}
