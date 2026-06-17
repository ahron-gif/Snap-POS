/**
 * Derives whether a DashboardTab represents an edit/create form.
 *
 * Two cases produce a "yes":
 *   1. The tab was opened with `editMode: true` (explicit flag, set by openTab
 *      calls). This survives within a session but is intentionally NOT
 *      persisted to the userPreferences workspace JSON to keep that contract
 *      unchanged across releases.
 *   2. The tab's component is in the EDIT_COMPONENTS allowlist AND the props
 *      indicate an edit (`id` set) or create (`isNew === true`) flow. This
 *      catches tabs restored from the workspace JSON where rule 1 is gone.
 *
 * Both rules are checked because the explicit flag (rule 1) is more reliable
 * for in-session tabs (e.g. it'd survive even if a future edit form forgets
 * to add itself to the allowlist), and rule 2 covers the post-reload case.
 *
 * Single source of truth for the "is this an edit tab?" question — used by
 * DashboardTabBar to draw the persistent yellow asterisk, and anywhere else
 * that needs the same answer in the future.
 */

import type { DashboardTab } from './DashboardTabContext';

// Components that, when given an edit/create prop combo, count as edit tabs.
// Extend this set when adding new edit forms that should show the asterisk
// after a page reload (workspace restore). Forms not in this list still get
// the asterisk in-session via the explicit `editMode: true` flag.
const EDIT_COMPONENTS = new Set<string>([
  'ItemFormPage',
  // Add others as they adopt the persistent-asterisk pattern:
  // 'VendorFormPage',
  // 'CustomerFormPage',
  // 'DepartmentFormPage',
  // 'ManufacturerFormPage',
  // 'UserFormPage',
  // ...
]);

export function isEditTab(tab: Pick<DashboardTab, 'component' | 'props' | 'editMode'>): boolean {
  // Rule 1 — explicit in-session flag.
  if (tab.editMode === true) return true;

  // Rule 2 — allowlisted component with edit/create props.
  if (!EDIT_COMPONENTS.has(tab.component)) return false;
  const p = tab.props;
  if (!p) return false;
  if (p.isNew === true) return true;
  if (p.id != null && p.id !== '') return true;
  return false;
}
