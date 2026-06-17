import { API_ENDPOINTS } from '../constants/api'

// ---------------------------------------------------------------------------
// Matrix template + value + global-colours service. Used by
// <MatrixTemplateModal> and <MatrixGenerateModal>. Mirrors the legacy
// desktop FrmMatrix template management — every template has exactly
// two axes (Color, Size). The backend enforces that contract.
// ---------------------------------------------------------------------------

export interface MatrixValueDto {
  matrixValueID: string
  matrixColumnID: string
  displayValue: string
  code: string | null
  sortValue: number | null
}

export interface MatrixTemplateDto {
  matrixTableID: string
  matrixName: string | null
  matrixDescription: string | null
  colorColumnID: string | null
  sizeColumnID: string | null
  colors: MatrixValueDto[]
  sizes: MatrixValueDto[]
}

export interface MatrixTemplateCreateDto {
  name: string
  description?: string
}

export interface MatrixTemplateUpdateDto {
  name?: string
  description?: string
}

export type MatrixAxis = 'color' | 'size'

export interface MatrixValueCreateDto {
  axis: MatrixAxis
  displayValue: string
  code?: string
  sortValue?: number
  promoteToGlobal?: boolean
}

export interface MatrixChildGenerateDto {
  storeId: string
  /** If set, the parent's MatrixTableNo is updated so subsequent
   *  generations remember this template. */
  assignTemplateId?: string
  colors: string[]
  sizes: string[]
}

export interface MatrixGenerateResultDto {
  created: number
  skipped: number
}

export interface MatrixOnHandAdjustRowDto {
  itemStoreId: string
  newOnHand: number
}

export interface MatrixOnHandAdjustBatchDto {
  rows: MatrixOnHandAdjustRowDto[]
  reason: string
}

export interface MatrixColorDto {
  displayValue: string
  code: string | null
  sortValue: number | null
}

export interface ApiResult<T> {
  isSuccess: boolean
  message: string
  response: T | null
}

const DEFAULT_FETCH_TIMEOUT_MS = 15_000

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Turn a thrown fetch error into a useful ApiResult. The previous version
 * collapsed every failure to a flat "Network error." string which made
 * diagnosis impossible — now we log the original to console (so devtools
 * shows the stack) AND keep the message specific enough to act on:
 *   • AbortError → request timed out
 *   • TypeError "Failed to fetch" → CORS, DNS, or API not reachable
 *   • everything else → its own message text
 */
function explainFetchError<T>(label: string, e: unknown): ApiResult<T> {
  const err = e as { name?: string; message?: string } | undefined
  // Surface in the browser console with full context so the user can
  // see the underlying cause (CORS, cert, mixed-content, etc.).
  console.error(`[matrix] ${label} failed:`, e)
  if (err?.name === 'AbortError') {
    return { isSuccess: false, message: 'Request timed out.', response: null }
  }
  if (err?.name === 'TypeError') {
    // Most common: API process down, CORS misconfigured, untrusted dev
    // cert, or mixed http→https blocked. The console log shows which.
    return {
      isSuccess: false,
      message: `Could not reach API (${err?.message ?? 'fetch failed'}). Check API is running and CORS allows this origin.`,
      response: null,
    }
  }
  return {
    isSuccess: false,
    message: err?.message ?? 'Unknown error.',
    response: null,
  }
}

class MatrixTemplateService {
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('accessToken')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    }
    const userData = localStorage.getItem('userData')
    if (userData) {
      try {
        const parsed = JSON.parse(userData)
        if (parsed.customerId) headers['CustomerId'] = parsed.customerId.toString()
      } catch {
        /* noop */
      }
    }
    return headers
  }

  private async unwrap<T>(resp: Response): Promise<ApiResult<T>> {
    let body: any = null
    try {
      body = await resp.json()
    } catch {
      /* non-json error */
    }
    if (!resp.ok) {
      return {
        isSuccess: false,
        message: body?.message ?? `HTTP ${resp.status}`,
        response: null,
      }
    }
    return {
      isSuccess: !!body?.isSuccess,
      message: body?.message ?? '',
      response: (body?.response as T) ?? null,
    }
  }

  // -------------------- Templates --------------------

  async listTemplates(): Promise<ApiResult<MatrixTemplateDto[]>> {
    try {
      const resp = await fetchWithTimeout(API_ENDPOINTS.MATRIX.TEMPLATES, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })
      return this.unwrap<MatrixTemplateDto[]>(resp)
    } catch (e) {
      return explainFetchError('matrixTemplateService', e)
    }
  }

  async getTemplate(templateId: string): Promise<ApiResult<MatrixTemplateDto>> {
    try {
      const resp = await fetchWithTimeout(API_ENDPOINTS.MATRIX.TEMPLATE(templateId), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })
      return this.unwrap<MatrixTemplateDto>(resp)
    } catch (e) {
      return explainFetchError('matrixTemplateService', e)
    }
  }

  async createTemplate(dto: MatrixTemplateCreateDto): Promise<ApiResult<MatrixTemplateDto>> {
    try {
      const resp = await fetchWithTimeout(API_ENDPOINTS.MATRIX.TEMPLATES, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(dto),
      })
      return this.unwrap<MatrixTemplateDto>(resp)
    } catch (e) {
      return explainFetchError('matrixTemplateService', e)
    }
  }

  async updateTemplate(
    templateId: string,
    dto: MatrixTemplateUpdateDto,
  ): Promise<ApiResult<MatrixTemplateDto>> {
    try {
      const resp = await fetchWithTimeout(API_ENDPOINTS.MATRIX.TEMPLATE(templateId), {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(dto),
      })
      return this.unwrap<MatrixTemplateDto>(resp)
    } catch (e) {
      return explainFetchError('matrixTemplateService', e)
    }
  }

  async deleteTemplate(templateId: string): Promise<ApiResult<boolean>> {
    try {
      const resp = await fetchWithTimeout(API_ENDPOINTS.MATRIX.TEMPLATE(templateId), {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      })
      return this.unwrap<boolean>(resp)
    } catch (e) {
      return explainFetchError('matrixTemplateService', e)
    }
  }

  // -------------------- Values --------------------

  async addValue(
    templateId: string,
    dto: MatrixValueCreateDto,
  ): Promise<ApiResult<MatrixValueDto>> {
    try {
      const resp = await fetchWithTimeout(API_ENDPOINTS.MATRIX.TEMPLATE_VALUES(templateId), {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(dto),
      })
      return this.unwrap<MatrixValueDto>(resp)
    } catch (e) {
      return explainFetchError('matrixTemplateService', e)
    }
  }

  async deleteValue(matrixValueId: string, cascadeChildren = false): Promise<ApiResult<boolean>> {
    try {
      const resp = await fetchWithTimeout(
        API_ENDPOINTS.MATRIX.VALUE_DELETE(matrixValueId, cascadeChildren),
        { method: 'DELETE', headers: this.getAuthHeaders() },
      )
      return this.unwrap<boolean>(resp)
    } catch (e) {
      return explainFetchError('matrixTemplateService', e)
    }
  }

  // -------------------- Global colours --------------------

  async listGlobalColors(): Promise<ApiResult<MatrixColorDto[]>> {
    try {
      const resp = await fetchWithTimeout(API_ENDPOINTS.MATRIX.GLOBAL_COLORS, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })
      return this.unwrap<MatrixColorDto[]>(resp)
    } catch (e) {
      return explainFetchError('matrixTemplateService', e)
    }
  }

  // -------------------- Generate + adjust --------------------

  async generateChildren(
    parentId: string,
    dto: MatrixChildGenerateDto,
  ): Promise<ApiResult<MatrixGenerateResultDto>> {
    try {
      const resp = await fetchWithTimeout(API_ENDPOINTS.MATRIX.GENERATE(parentId), {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(dto),
      })
      return this.unwrap<MatrixGenerateResultDto>(resp)
    } catch (e) {
      return explainFetchError('matrixTemplateService', e)
    }
  }

  async adjustOnHand(dto: MatrixOnHandAdjustBatchDto): Promise<ApiResult<number>> {
    try {
      const resp = await fetchWithTimeout(API_ENDPOINTS.MATRIX.ADJUST_ONHAND, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(dto),
      })
      return this.unwrap<number>(resp)
    } catch (e) {
      return explainFetchError('matrixTemplateService', e)
    }
  }
}

export const matrixTemplateService = new MatrixTemplateService()
