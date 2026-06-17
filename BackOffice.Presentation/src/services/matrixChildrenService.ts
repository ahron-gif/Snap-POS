import { API_ENDPOINTS } from '../constants/api'

// ---------------------------------------------------------------------------
// Matrix Children service — typed wrapper around the backend's
// /api/Items/{parentId}/matrix-children endpoints. Used by
// <MatrixEditor>. Mirrors legacy desktop FrmMatrix.vb behaviour:
// load children list, edit a row, bulk-apply cost/price, delete a
// row, add a new child.
// ---------------------------------------------------------------------------

/** One row from GET — full read shape. */
export interface MatrixChildDto {
  itemID: string
  itemStoreID: string | null
  name: string | null
  barcode: string | null
  cost: number | null
  pcCost: number | null
  price: number | null
  specialCost: number | null
  color: string | null
  size: string | null
  onHand: number | null
  modelNumber: string | null
  linkNo: string | null
  styleNumber: string | null
  margin: number | null
  markup: number | null
}

/** PATCH body — every field optional. Send only what changed. */
export interface MatrixChildPatchDto {
  name?: string
  barcode?: string
  modelNumber?: string
  styleNumber?: string
  color?: string
  size?: string
  cost?: number
  specialCost?: number
  price?: number
}

export interface MatrixBulkCostDto {
  storeId: string
  cost: number
}

export type MatrixBulkPriceMode = 'absolute' | 'margin' | 'markup'

export interface MatrixBulkPriceDto {
  storeId: string
  mode: MatrixBulkPriceMode
  value: number
}

export interface MatrixChildCreateDto {
  storeId: string
  color?: string
  size?: string
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
 * Surfaces the real reason a fetch failed instead of the previous
 * one-size-fits-all "Network error" toast. Logs to console for full
 * stack visibility.
 */
function explainFetchError<T>(label: string, e: unknown): ApiResult<T> {
  const err = e as { name?: string; message?: string } | undefined
  console.error(`[matrix] ${label} failed:`, e)
  if (err?.name === 'AbortError') {
    return { isSuccess: false, message: 'Request timed out.', response: null }
  }
  if (err?.name === 'TypeError') {
    return {
      isSuccess: false,
      message: `Could not reach API (${err?.message ?? 'fetch failed'}). Check API is running and CORS allows this origin.`,
      response: null,
    }
  }
  return { isSuccess: false, message: err?.message ?? 'Unknown error.', response: null }
}

class MatrixChildrenService {
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

  /** Unwrap the backend ApiResponse<T> envelope into a flat result. */
  private async unwrap<T>(resp: Response): Promise<ApiResult<T>> {
    let body: any = null
    try {
      body = await resp.json()
    } catch {
      /* non-json error body */
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

  async listChildren(parentId: string, storeId: string): Promise<ApiResult<MatrixChildDto[]>> {
    try {
      const resp = await fetchWithTimeout(API_ENDPOINTS.MATRIX.LIST(parentId, storeId), {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })
      return this.unwrap<MatrixChildDto[]>(resp)
    } catch (e) {
      const isTimeout = e instanceof DOMException && e.name === 'AbortError'
      return {
        isSuccess: false,
        message: isTimeout ? 'Request timed out.' : 'Network error.',
        response: null,
      }
    }
  }

  async patchChild(
    itemStoreId: string,
    patch: MatrixChildPatchDto,
  ): Promise<ApiResult<MatrixChildDto>> {
    try {
      const resp = await fetchWithTimeout(API_ENDPOINTS.MATRIX.PATCH(itemStoreId), {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(patch),
      })
      return this.unwrap<MatrixChildDto>(resp)
    } catch (e) {
      return explainFetchError('matrixChildrenService', e)
    }
  }

  async bulkCost(parentId: string, dto: MatrixBulkCostDto): Promise<ApiResult<number>> {
    try {
      const resp = await fetchWithTimeout(API_ENDPOINTS.MATRIX.BULK_COST(parentId), {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(dto),
      })
      return this.unwrap<number>(resp)
    } catch (e) {
      return explainFetchError('matrixChildrenService', e)
    }
  }

  async bulkPrice(parentId: string, dto: MatrixBulkPriceDto): Promise<ApiResult<number>> {
    try {
      const resp = await fetchWithTimeout(API_ENDPOINTS.MATRIX.BULK_PRICE(parentId), {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(dto),
      })
      return this.unwrap<number>(resp)
    } catch (e) {
      return explainFetchError('matrixChildrenService', e)
    }
  }

  async deleteChild(itemStoreId: string, reason?: string): Promise<ApiResult<boolean>> {
    try {
      const resp = await fetchWithTimeout(API_ENDPOINTS.MATRIX.DELETE(itemStoreId, reason), {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      })
      return this.unwrap<boolean>(resp)
    } catch (e) {
      return explainFetchError('matrixChildrenService', e)
    }
  }

  async addChild(
    parentId: string,
    dto: MatrixChildCreateDto,
  ): Promise<ApiResult<MatrixChildDto>> {
    try {
      const resp = await fetchWithTimeout(API_ENDPOINTS.MATRIX.ADD(parentId), {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(dto),
      })
      return this.unwrap<MatrixChildDto>(resp)
    } catch (e) {
      return explainFetchError('matrixChildrenService', e)
    }
  }
}

export const matrixChildrenService = new MatrixChildrenService()
