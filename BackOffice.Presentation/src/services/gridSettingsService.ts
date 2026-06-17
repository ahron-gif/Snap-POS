import { gridColumnAccessService, type ColumnAccessItemDto } from './gridColumnAccessService';

// ---------------------------------------------------------------------------
// Grid column settings storage was UNIFIED onto UserGridColumnAccess.
//
// Historically there were two paths for "what columns does the user see in
// grid X":
//   (1) UserGridColumnAccess  — Super-Admin-driven, tenant-default + override
//   (2) UserPreference        — User-driven via the in-grid column chooser
// They didn't know about each other, so a user's toggle could survive a
// Super-Admin reset (and vice versa). One source of truth now: path (1).
//
// This file is a thin compatibility shim. The PUBLIC method signatures are
// unchanged so every caller (useGridSettings hook + every list page) keeps
// working without edits. Internally it translates between the local
// ColumnSettingDto shape (visible/width/aggregateType) and the backend
// ColumnAccessItemDto shape (allowedToView/width/aggregateType + extras),
// then routes through gridColumnAccessService → /api/GridColumnAccess/me/*.
//
// A companion SQL migration (20260526_MigrateGridPrefsToColumnAccess.sql)
// moves any existing UserPreference 'grid.columns.*' rows into the unified
// table and deletes the originals, so reads after deployment surface the
// right data.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Note: an earlier version of this shim maintained a per-(gridId, field)
// cache of displayName/sortOrder so the user save could re-attach them and
// the backend's smart-save would skip persisting those fields. That cache
// was removed when the backend gained:
//   (a) snapshot semantics for user saves — we always persist a row per
//       column the user is seeing, so no skipping happens for AllowedToView;
//   (b) null-coalesce merge for DisplayName/SortOrder/Width/AggregateType —
//       the backend stores NULL on the user row when the value matches the
//       tenant default, and the merge falls back to the tenant default at
//       read time. The user automatically inherits future admin renames.
// So the shim can stop fussing with DisplayName/SortOrder — it always sends
// `null` and lets the backend smart-save + merge sort it out.
// ---------------------------------------------------------------------------

// Interfaces matching the API DTOs (kept for backwards-compatibility with callers)
export interface ColumnSettingDto {
  field: string;
  visible: boolean;
  width: number;
  aggregateType?: string; // sum, min, max, count, average, none
}

export interface SaveGridSettingsDto {
  gridId: string;
  columns: ColumnSettingDto[];
}

export interface GridSettingsResponseDto {
  gridId: string;
  columns: ColumnSettingDto[];
  lastModified: string;
}

export interface ApiResult<T> {
  isSuccess: boolean;
  message: string;
  response: T | null;
}

// ---------------------------------------------------------------------------
// Shape translators
// ---------------------------------------------------------------------------

/** Backend → frontend: map a ColumnAccessItemDto to the local ColumnSettingDto. */
const toColumnSetting = (item: ColumnAccessItemDto): ColumnSettingDto => ({
  field: item.field,
  visible: item.allowedToView,
  // Width defaults to 0 to preserve the existing contract (number, not
  // nullable). Callers that care about "no override" check for falsy width.
  width: item.width ?? 0,
  aggregateType: item.aggregateType ?? undefined,
});

/**
 * Frontend → backend: map ColumnSettingDto to ColumnAccessItemDto.
 *
 * displayName and sortOrder are always sent as `null` — the local UI
 * doesn't expose either of them to the user, so any value would be stale.
 * The backend's null-coalesce merge falls back to the tenant default for
 * fields where the user row is null, which is exactly what we want.
 */
const toColumnAccess = (col: ColumnSettingDto): ColumnAccessItemDto => ({
  field: col.field,
  allowedToView: col.visible,
  // Don't persist width=0 as if it were a real override.
  width: col.width && col.width > 0 ? col.width : null,
  aggregateType: col.aggregateType ? col.aggregateType : null,
  displayName: null,
  sortOrder: null,
});

class GridSettingsService {
  /**
   * Returns the EFFECTIVE column settings for the current user on this grid
   * (tenant defaults overlaid with the user's own snapshot). Used by every
   * list page on mount to hydrate column visibility/width/aggregate.
   */
  async getGridSettings(gridId: string): Promise<ApiResult<GridSettingsResponseDto | null>> {
    try {
      const result = await gridColumnAccessService.getMine(gridId);

      if (!result.isSuccess) {
        return {
          isSuccess: false,
          message: result.message || 'Failed to get grid settings',
          response: null,
        };
      }

      // No rows at all → no saved settings yet. Keep returning null to
      // preserve the previous behavior (callers fall back to defaults).
      const responseColumns = result.response?.columns ?? [];
      if (!result.response || responseColumns.length === 0) {
        return {
          isSuccess: true,
          message: '',
          response: null,
        };
      }

      const dto: GridSettingsResponseDto = {
        gridId,
        columns: responseColumns.map(toColumnSetting),
        lastModified: result.response.lastModified || new Date().toISOString(),
      };

      return {
        isSuccess: true,
        message: '',
        response: dto,
      };
    } catch (error) {
      console.error('Error getting grid settings:', error);
      return {
        isSuccess: false,
        message: 'Network error. Please try again.',
        response: null,
      };
    }
  }

  /**
   * Saves the user's column settings for this grid via the unified
   * /api/GridColumnAccess/me endpoint. Sends a full snapshot — every column
   * the user is currently seeing — so the backend can persist a row per
   * column. That snapshot is what freezes the user's visibility set against
   * later admin-added columns.
   */
  async saveGridSettings(settings: SaveGridSettingsDto): Promise<ApiResult<boolean>> {
    try {
      const result = await gridColumnAccessService.saveMine({
        gridId: settings.gridId,
        columns: settings.columns.map(toColumnAccess),
      });

      return {
        isSuccess: result.isSuccess,
        message: result.message,
        response: result.isSuccess,
      };
    } catch (error) {
      console.error('Error saving grid settings:', error);
      return {
        isSuccess: false,
        message: 'Network error. Please try again.',
        response: false,
      };
    }
  }

  /**
   * Resets the user's own overrides for this grid. Tenant defaults are left
   * intact; the user reverts to whatever the tenant default says. This is the
   * action behind the in-grid "Reset to Default" button.
   */
  async deleteGridSettings(gridId: string): Promise<ApiResult<boolean>> {
    try {
      const result = await gridColumnAccessService.resetMine(gridId);
      return {
        isSuccess: result.isSuccess,
        message: result.message,
        response: result.response ?? result.isSuccess,
      };
    } catch (error) {
      console.error('Error deleting grid settings:', error);
      return {
        isSuccess: false,
        message: 'Network error. Please try again.',
        response: false,
      };
    }
  }

  /**
   * Wipes the user's overrides across ALL grids. We don't have a bulk
   * "delete all my grid overrides" endpoint today, so this is a no-op shim.
   * Callers that want a true reset-all should enumerate the grid IDs they
   * care about and call deleteGridSettings(gridId) for each.
   */
  async deleteAllGridSettings(): Promise<ApiResult<boolean>> {
    console.warn(
      '[gridSettingsService] deleteAllGridSettings is a no-op. ' +
      'Call deleteGridSettings(gridId) per grid, or add a bulk-reset endpoint.'
    );
    return {
      isSuccess: true,
      message: '',
      response: true,
    };
  }
}

export const gridSettingsService = new GridSettingsService();
