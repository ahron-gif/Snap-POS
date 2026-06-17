import { API_ENDPOINTS } from '../constants/api'

// ---------------------------------------------------------------------------
// Service for Super-Admin-managed per-user column visibility rules on grids.
// Backed by /api/GridColumnAccess/* endpoints; data lives in the tenant DB.
// ---------------------------------------------------------------------------

const DEFAULT_FETCH_TIMEOUT_MS = 10_000

/**
 * Wraps a fetch call so it cannot hang indefinitely. Mirrors the helper in
 * userPreferenceService.ts for consistency.
 */
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

export interface ColumnAccessItemDto {
  field: string
  allowedToView: boolean
  /**
   * Optional display-label override. When non-null/non-empty, grids render this
   * text in place of the default column header. Null means "use the default".
   */
  displayName?: string | null
  /**
   * Optional position override. Lower = earlier. Null means "use the natural
   * order from the column definitions".
   */
  sortOrder?: number | null
  /**
   * Optional pixel width. Null means "use the natural width from the column defs".
   * Added when grid visibility/width/aggregate were unified onto UserGridColumnAccess.
   */
  width?: number | null
  /**
   * Optional footer aggregate type ("sum" / "avg" / "count" / "min" / "max").
   * Null means no aggregation row at the footer.
   */
  aggregateType?: string | null
  /**
   * True when the TENANT DEFAULT row explicitly restricts this column. The
   * column-access filter uses this (NOT allowedToView) to decide whether
   * to strip the column from the grid + chooser entirely. User-hidden
   * columns have allowedToView=false but isTenantRestricted=false, so
   * they stay in the chooser (unchecked) and can be toggled back on.
   *
   * Server-set only; safe to ignore on outgoing save payloads.
   */
  isTenantRestricted?: boolean
}

export interface SaveGridColumnAccessDto {
  userId: string
  gridId: string
  columns: ColumnAccessItemDto[]
}

export interface GridColumnAccessResponseDto {
  userId: string
  gridId: string
  columns: ColumnAccessItemDto[]
  lastModified: string | null
  modifiedBy: string | null
}

export interface ApiResult<T> {
  isSuccess: boolean
  message: string
  response: T | null
}

class GridColumnAccessService {
  /**
   * Build auth headers. The `customerIdOverride` parameter lets a Super Admin
   * target a specific tenant's DB without globally switching their active tenant —
   * the backend resolves TenantDBContext from this header on every request.
   */
  private getAuthHeaders(customerIdOverride?: number | string): Record<string, string> {
    const token = localStorage.getItem('accessToken')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    }

    if (customerIdOverride != null) {
      headers['CustomerId'] = customerIdOverride.toString()
    } else {
      const userData = localStorage.getItem('userData')
      if (userData) {
        try {
          const parsed = JSON.parse(userData)
          if (parsed.customerId != null) {
            headers['CustomerId'] = parsed.customerId.toString()
          }
        } catch {
          // ignore malformed userData
        }
      }
    }

    return headers
  }

  private handleError(error: unknown, fallback: string): string {
    const isTimeout = error instanceof DOMException && error.name === 'AbortError'
    if (isTimeout) return 'Request timed out. Please try again.'
    console.error(fallback, error)
    return 'Network error. Please try again.'
  }

  /**
   * Fetches the current user's column-access rules for a grid. Called on mount
   * by every grid-based page (via useColumnAccessFilter).
   */
  async getMine(gridId: string): Promise<ApiResult<GridColumnAccessResponseDto | null>> {
    try {
      const response = await fetchWithTimeout(
        API_ENDPOINTS.GRID_COLUMN_ACCESS.GET_MINE(gridId),
        { method: 'GET', headers: this.getAuthHeaders() },
      )

      const data = await response.json()
      if (!response.ok) {
        return {
          isSuccess: false,
          message: data.message || 'Failed to get column access',
          response: null,
        }
      }
      return data
    } catch (error) {
      return {
        isSuccess: false,
        message: this.handleError(error, 'Error getting column access:'),
        response: null,
      }
    }
  }

  /**
   * Save the current user's own column-override set for a grid. Backend forces
   * the userId to the caller's LocalUserId; whatever userId is in `dto` is
   * ignored. Smart-save in the service skips fields matching the tenant
   * default, so unchanged fields keep inheriting future tenant changes.
   *
   * Used by the in-grid column chooser when a user toggles visibility,
   * resizes a column, or changes an aggregate.
   */
  async saveMine(dto: Omit<SaveGridColumnAccessDto, 'userId'>): Promise<ApiResult<boolean>> {
    try {
      const response = await fetchWithTimeout(API_ENDPOINTS.GRID_COLUMN_ACCESS.SAVE_MINE, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        // userId is required by the DTO shape but the server ignores it for /me.
        // Send empty GUID so model binding doesn't complain.
        body: JSON.stringify({ userId: '00000000-0000-0000-0000-000000000000', ...dto }),
      })

      const data = await response.json()
      if (!response.ok) {
        return {
          isSuccess: false,
          message: data.message || 'Failed to save column preferences',
          response: false,
        }
      }
      return data
    } catch (error) {
      return {
        isSuccess: false,
        message: this.handleError(error, 'Error saving column preferences:'),
        response: false,
      }
    }
  }

  /**
   * Delete the current user's own column overrides for a grid (leaving tenant
   * defaults untouched). After this call, the user reverts to whatever the
   * tenant default says. Used by the "Reset to Default" button in the in-grid
   * column chooser.
   */
  async resetMine(gridId: string): Promise<ApiResult<boolean>> {
    try {
      const response = await fetchWithTimeout(API_ENDPOINTS.GRID_COLUMN_ACCESS.RESET_MINE(gridId), {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      })

      const data = await response.json()
      if (!response.ok) {
        return {
          isSuccess: false,
          message: data.message || 'Failed to reset column preferences',
          response: false,
        }
      }
      return data
    } catch (error) {
      return {
        isSuccess: false,
        message: this.handleError(error, 'Error resetting column preferences:'),
        response: false,
      }
    }
  }

  /**
   * Returns a lightweight version token (max DateModified across rows that
   * affect the caller for this grid). Used by the visibility-change refresh
   * to detect whether the in-grid settings should be refetched without
   * pulling the full column payload every time.
   *
   * Returns `null` in `response` when there are no rows for this grid yet.
   */
  async getMineVersion(gridId: string): Promise<ApiResult<string | null>> {
    try {
      const response = await fetchWithTimeout(
        API_ENDPOINTS.GRID_COLUMN_ACCESS.GET_MINE_VERSION(gridId),
        { method: 'GET', headers: this.getAuthHeaders() },
      )

      const data = await response.json()
      if (!response.ok) {
        return {
          isSuccess: false,
          message: data.message || 'Failed to get column-access version',
          response: null,
        }
      }
      return data
    } catch (error) {
      return {
        isSuccess: false,
        message: this.handleError(error, 'Error getting column-access version:'),
        response: null,
      }
    }
  }

  /**
   * Super-Admin-only: fetch another user's column-access rules for a grid.
   * Pass `customerId` to target a specific tenant's DB without needing to
   * globally switch tenants.
   */
  async getForUser(
    userId: string,
    gridId: string,
    customerId?: number,
  ): Promise<ApiResult<GridColumnAccessResponseDto | null>> {
    try {
      const response = await fetchWithTimeout(
        API_ENDPOINTS.GRID_COLUMN_ACCESS.GET_FOR_USER(userId, gridId),
        { method: 'GET', headers: this.getAuthHeaders(customerId) },
      )

      const data = await response.json()
      if (!response.ok) {
        return {
          isSuccess: false,
          message: data.message || 'Failed to get column access',
          response: null,
        }
      }
      return data
    } catch (error) {
      return {
        isSuccess: false,
        message: this.handleError(error, 'Error getting column access:'),
        response: null,
      }
    }
  }

  /**
   * Super-Admin-only: save (upsert) a user's full column-access set for a grid.
   * Pass `customerId` to target a specific tenant.
   */
  async save(
    dto: SaveGridColumnAccessDto,
    customerId?: number,
  ): Promise<ApiResult<boolean>> {
    try {
      const response = await fetchWithTimeout(API_ENDPOINTS.GRID_COLUMN_ACCESS.SAVE, {
        method: 'POST',
        headers: this.getAuthHeaders(customerId),
        body: JSON.stringify(dto),
      })

      const data = await response.json()
      if (!response.ok) {
        return {
          isSuccess: false,
          message: data.message || 'Failed to save column access',
          response: false,
        }
      }
      return data
    } catch (error) {
      return {
        isSuccess: false,
        message: this.handleError(error, 'Error saving column access:'),
        response: false,
      }
    }
  }

  /**
   * Super-Admin-only: delete all rules for a user + grid (resets to "all visible").
   * Pass `customerId` to target a specific tenant.
   */
  async reset(
    userId: string,
    gridId: string,
    customerId?: number,
  ): Promise<ApiResult<boolean>> {
    try {
      const response = await fetchWithTimeout(
        API_ENDPOINTS.GRID_COLUMN_ACCESS.RESET(userId, gridId),
        { method: 'DELETE', headers: this.getAuthHeaders(customerId) },
      )

      const data = await response.json()
      if (!response.ok) {
        return {
          isSuccess: false,
          message: data.message || 'Failed to reset column access',
          response: false,
        }
      }
      return data
    } catch (error) {
      return {
        isSuccess: false,
        message: this.handleError(error, 'Error resetting column access:'),
        response: false,
      }
    }
  }

  // ----- Global default (Main DB) -------------------------------------------
  // These target the cross-tenant default config that lives in the MAIN
  // database. No customerId is sent — the backend does not route by tenant
  // for these endpoints.

  /**
   * Super-Admin-only: fetch the global, cross-tenant default column config for
   * a grid. Empty list means no global default has been saved (page defaults
   * apply).
   */
  async getDefault(gridId: string): Promise<ApiResult<GridColumnAccessResponseDto | null>> {
    try {
      const response = await fetchWithTimeout(
        API_ENDPOINTS.GRID_COLUMN_ACCESS.GET_DEFAULT(gridId),
        { method: 'GET', headers: this.getAuthHeaders() },
      )

      const data = await response.json()
      if (!response.ok) {
        return {
          isSuccess: false,
          message: data.message || 'Failed to get default column config',
          response: null,
        }
      }
      return data
    } catch (error) {
      return {
        isSuccess: false,
        message: this.handleError(error, 'Error getting default column config:'),
        response: null,
      }
    }
  }

  /**
   * Super-Admin-only: save (upsert) the global, cross-tenant default column
   * config for a grid. The userId on the DTO is ignored by the backend.
   */
  async saveDefault(dto: Omit<SaveGridColumnAccessDto, 'userId'>): Promise<ApiResult<boolean>> {
    try {
      const response = await fetchWithTimeout(API_ENDPOINTS.GRID_COLUMN_ACCESS.SAVE_DEFAULT, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ userId: '00000000-0000-0000-0000-000000000000', ...dto }),
      })

      const data = await response.json()
      if (!response.ok) {
        return {
          isSuccess: false,
          message: data.message || 'Failed to save default column config',
          response: false,
        }
      }
      return data
    } catch (error) {
      return {
        isSuccess: false,
        message: this.handleError(error, 'Error saving default column config:'),
        response: false,
      }
    }
  }

  /**
   * Super-Admin-only: delete the global, cross-tenant default column config for
   * a grid (tenants that inherit it revert to the page's natural defaults).
   */
  async resetDefault(gridId: string): Promise<ApiResult<boolean>> {
    try {
      const response = await fetchWithTimeout(
        API_ENDPOINTS.GRID_COLUMN_ACCESS.RESET_DEFAULT(gridId),
        { method: 'DELETE', headers: this.getAuthHeaders() },
      )

      const data = await response.json()
      if (!response.ok) {
        return {
          isSuccess: false,
          message: data.message || 'Failed to reset default column config',
          response: false,
        }
      }
      return data
    } catch (error) {
      return {
        isSuccess: false,
        message: this.handleError(error, 'Error resetting default column config:'),
        response: false,
      }
    }
  }
}

export const gridColumnAccessService = new GridColumnAccessService()
