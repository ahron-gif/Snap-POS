import { API_ENDPOINTS } from '../constants/api'

/**
 * StoreType enum — mirrors the legacy desktop's
 * <c>EncDataDS.EncDataRow.StoreType</c> column. Drives show/hide
 * behaviour across the Item form, Matrix form, and a few report
 * screens.
 */
export const StoreType = {
  Food: 0,
  Books: 1,
  Apparel: 2,
  Regular: 3,
} as const

export type StoreTypeValue = typeof StoreType[keyof typeof StoreType]

/**
 * Mirrors <c>BackOffice.Application.DTOs.Tenant.Setup.TenantSetupDto</c>.
 * Every field is optional — older tenants with no EncData row return
 * nulls, in which case the UI should fall back to "safe / show
 * everything" defaults rather than hiding controls.
 */
export interface TenantSetupDto {
  storeType: number | null
  multiplelocation: boolean | null
  accountPayable: boolean | null
  loyalty: boolean | null
  purchaseOrder: boolean | null
  saleOrder: boolean | null
  phoneOrder: boolean | null
  web: boolean | null
  email: boolean | null
  pocketPC: boolean | null
  approveCost: boolean | null
  reorderWizard: boolean | null
  restockingWizard: boolean | null
}

export interface ApiResult<T> {
  isSuccess: boolean
  message: string
  response: T | null
}

const DEFAULT_FETCH_TIMEOUT_MS = 10_000

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

class TenantSetupService {
  private getAuthHeaders(): { [key: string]: string } {
    const token = localStorage.getItem('accessToken')
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    }

    const userData = localStorage.getItem('userData')
    if (userData) {
      try {
        const parsed = JSON.parse(userData)
        if (parsed.customerId) {
          headers['CustomerId'] = parsed.customerId.toString()
        }
      } catch {
        // Silently ignore — the API will reject with a clear error
      }
    }

    return headers
  }

  /**
   * Fetches the cached tenant-wide setup. Backend response is the
   * standard ApiResponse<T> envelope; we unwrap to a flatter
   * ApiResult shape so callers don't have to reach through layers.
   */
  async getSetup(): Promise<ApiResult<TenantSetupDto>> {
    try {
      const response = await fetchWithTimeout(API_ENDPOINTS.TENANT_SETUP.GET, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          isSuccess: false,
          message: data?.message ?? 'Failed to load tenant setup',
          response: null,
        }
      }

      // Backend wraps payload in ApiResponse<T> { isSuccess, response, message }
      return {
        isSuccess: !!data?.isSuccess,
        message: data?.message ?? '',
        response: (data?.response as TenantSetupDto) ?? null,
      }
    } catch (error) {
      const isTimeout = error instanceof DOMException && error.name === 'AbortError'
      console.error(
        isTimeout ? 'Tenant setup request timed out' : 'Error loading tenant setup:',
        error,
      )
      return {
        isSuccess: false,
        message: isTimeout
          ? 'Request timed out. Please try again.'
          : 'Network error. Please try again.',
        response: null,
      }
    }
  }
}

export const tenantSetupService = new TenantSetupService()
