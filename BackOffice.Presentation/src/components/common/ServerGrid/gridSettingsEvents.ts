/**
 * Shared event constants for the in-grid settings lifecycle.
 *
 * When a user resets their column preferences via the in-grid "Reset to
 * Default" button, ServerGrid fires this CustomEvent. The useGridSettings
 * hook (used by every list page that renders the grid) listens for it and
 * re-fetches its settings, so the UI snaps from "user overrides" back to
 * "tenant defaults" automatically — no per-page wiring required.
 *
 * Also fired when the visibility-change refresh (Req 5) detects a server-side
 * version bump, so the same listener handles both paths uniformly.
 */

export const GRID_SETTINGS_RESET_EVENT = "grid-settings:reset" as const;

export interface GridSettingsResetDetail {
  /** The grid that was reset (or had its version bump) — matches the gridId prop on ServerGrid. */
  gridId: string;
  /** What triggered the event — useful for debugging / telemetry. */
  reason: "user-reset" | "version-bump";
}
