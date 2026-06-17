export type PrintContentType = "pdf" | "zpl" | "escpos" | "raw"

export interface PrinterInfo {
  name: string
  isDefault: boolean
  driverName?: string | null
  portName?: string | null
  status?: string | null
}

export interface AgentHealthResponse {
  status: string
  version: string
  isPaired: boolean
  pairedOrigin?: string | null
  startedAt: string
}

export interface AgentPairingHandshakeResponse {
  paired: boolean
  origin: string
  secret: string
  pairingId: string
}

export interface AgentPrintRequest {
  printerName: string
  contentType: PrintContentType
  content: string
  copies?: number
  jobName?: string
}

export interface AgentPrintResult {
  success: boolean
  jobId?: string
  errorMessage?: string
  printerName: string
}

export interface SignedJobResponse {
  token: string
  jobId: string
  expiresAt: string
}

export interface BackendApiResponse<T> {
  isSuccess: boolean
  statusCode: number
  message: string
  response: T
  errors: unknown
}

export interface PrintAgentBackendStatus {
  paired: boolean
  origin?: string | null
  pairedAt?: string | null
}

export interface PrintAgentInstallerInfo {
  available: boolean
  version?: string | null
  fileName?: string | null
  sizeBytes?: number
  downloadUrl?: string | null
  sha256?: string | null
}

export const AGENT_DEFAULT_BASE_URL = "https://localhost:9443"

export const PRINTER_PREF_STORAGE_KEY = "backoffice.printAgent.printerMappings"
export const AGENT_BASE_URL_STORAGE_KEY = "backoffice.printAgent.baseUrl"
export const PRINTER_DEFAULT_MAPPINGS_KEY = "backoffice.printer.defaultMappings"
export const PRINTER_USER_MAPPINGS_KEY_PREFIX = "backoffice.printer.userMappings."
export const PRINTER_USE_CUSTOM_KEY_PREFIX = "backoffice.printer.useCustom."
export const PRINTER_MANUAL_ROSTER_KEY = "backoffice.printer.manualRoster"

export type DocumentType =
  | "items-list"
  | "invoice"
  | "receipt"
  | "label"
  | "shelf-label"
  | "statement"
  | "report"
