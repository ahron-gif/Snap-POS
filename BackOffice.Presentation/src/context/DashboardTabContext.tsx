import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { userPreferenceService } from '../services/userPreferenceService';
import ConfirmDialog from '../components/common/ConfirmDialog';

export interface DashboardTab {
  id: string;
  title: string;
  component: string; // Component name to render
  props?: Record<string, any>; // Props to pass to component
  closable: boolean;
  /**
   * Marks the tab as an edit/create form. When true, the tab strip shows the
   * yellow asterisk as a persistent "this is an edit tab" indicator — separate
   * from the dirty flag, which fires only after the user actually changes
   * something. Both render the same asterisk, but the dirty transition still
   * triggers the pulse animation so the user gets a visual hit on first edit.
   */
  editMode?: boolean;
}

interface WorkspaceState {
  tabs: DashboardTab[];
  activeTabId: string | null;
  /**
   * The user id that owns this workspace. Optional for backward compatibility
   * with payloads saved before this field was introduced. When present and
   * different from the current user, the restore is ignored — defense in
   * depth against any layer (response cache, localStorage, service worker)
   * that might leak across users despite backend JWT scoping.
   */
  userId?: string;
}

interface DashboardTabContextType {
  tabs: DashboardTab[];
  activeTabId: string | null;
  openTab: (tab: Omit<DashboardTab, 'id'> & { id?: string }) => void;
  /** Close a tab WITHOUT the unsaved-changes guard. UI call sites should
   *  prefer `requestCloseTab` — this is exposed so the guard itself can
   *  call it after the user confirms. */
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
  /** Merges into the tab's props; optionally updates the tab title (tab strip). */
  updateTabProps: (
    tabId: string,
    props: Record<string, any>,
    meta?: { title?: string },
  ) => void;
  /** Restores saved tabs from the backend. Runs at most once per login
   *  session; pass `force` to re-attempt (used by the "Retry" button). */
  restoreWorkspace: (force?: boolean) => Promise<void>;
  isRestoringWorkspace: boolean;
  /** Error message from the last restore attempt (null if succeeded or not yet attempted). */
  restoreError: string | null;
  /** Clears the error state so the user can dismiss the error banner and continue with defaults. */
  clearRestoreError: () => void;

  // ── Unsaved-changes UX ──────────────────────────────────────────────────
  /** Ids of tabs whose forms currently report unsaved edits. */
  dirtyTabIds: Set<string>;
  /** Called by `useUnsavedChanges` to mark a tab dirty / clean. */
  setTabDirty: (tabId: string, isDirty: boolean) => void;
  /** Registers an async save handler for the tab. Returns an unregister fn. */
  registerSaveHandler: (tabId: string, handler: () => Promise<void>) => () => void;
  /** User-facing close request. Shows the styled confirmation modal if the
   *  tab is dirty. Resolves true when the tab actually closes, false if the
   *  user chooses Go Back / Esc / backdrop. */
  requestCloseTab: (tabId: string) => Promise<boolean>;
  /** Close-all with the unsaved-changes guard (batched confirmation). */
  requestCloseAllTabs: () => Promise<boolean>;
  /** Close-others with the unsaved-changes guard. */
  requestCloseOtherTabs: (tabId: string) => Promise<boolean>;

  // ── Per-tab in-memory state cache ────────────────────────────────────────
  // Lets components survive unmount/remount cycles (which happen on every
  // tab switch with the active-only renderer) without losing their state.
  // The cache is opt-in: a form chooses what to persist by calling setTabState.
  // It is in-memory only — page reload starts fresh, the userPreferences JSON
  // is NEVER touched.
  /** Returns the cached state blob for a tab id, or undefined if nothing stored. */
  getTabState: <T = unknown>(tabId: string) => T | undefined;
  /** Replaces the cached state blob for a tab id. Caller controls the shape. */
  setTabState: <T = unknown>(tabId: string, state: T) => void;
  /** Wipes the entire cache. Call from logout / tenant-switch flows. */
  clearAllTabState: () => void;
}

const DashboardTabContext = createContext<DashboardTabContextType | undefined>(undefined);

// Default Dashboard tab - always present and cannot be closed
const DEFAULT_DASHBOARD_TAB: DashboardTab = {
  id: 'Home',
  title: 'Dashboard',
  component: 'Home',
  closable: false,
};

// Generate unique ID for tabs
const generateTabId = (component: string, props?: Record<string, any>) => {
  // For edit forms, include the ID in the tab ID
  if (props?.id) {
    return `${component}-${props.id}`;
  }
  // For new forms, use a unique suffix (check both isNew and mode === "new")
  if (props?.isNew || props?.mode === "new") {
    return `${component}-new-${Date.now()}`;
  }
  // For list pages, use just the component name
  return component;
};

const WORKSPACE_PREFERENCE_KEY = 'workspaceState';
const SAVE_DEBOUNCE_MS = 1500;
/**
 * Hard cap for the entire restore flow. Even if the service layer misbehaves,
 * this ensures the UI never gets stuck on "Restoring session…" forever.
 * Slightly longer than the service-level timeout (10 s) so a normal slow
 * response surfaces as a service timeout, not a context timeout.
 */
const RESTORE_HARD_TIMEOUT_MS = 15_000;

export const DashboardTabProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize with Dashboard tab as default
  const [tabs, setTabs] = useState<DashboardTab[]>([DEFAULT_DASHBOARD_TAB]);
  const [activeTabId, setActiveTabId] = useState<string | null>(DEFAULT_DASHBOARD_TAB.id);
  const [isRestoringWorkspace, setIsRestoringWorkspace] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Refs for debounced save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestoringRef = useRef(false);
  // Guards restoreWorkspace so it runs at most once per login session. The
  // only caller (DashboardWithTabs) remounts every time the user navigates
  // back to /dashboard from a real route; without this guard the restore would
  // re-run on each Back navigation, reset the tabs to just the default Home tab
  // (see the defensive reset in restoreWorkspace), and make the user's open
  // tabs vanish. The tab state lives in this provider (above the router) and
  // already survives navigation, so a re-restore is unnecessary and harmful.
  // Reset to false on logout so the next login restores fresh.
  const hasRestoredRef = useRef(false);
  // Stores the most recently-queued save callback so the logout flow (or any
  // other "flush now" path) can fire the pending save synchronously instead
  // of waiting out the debounce — without this, fast logout-after-edit loses
  // the user's latest tabs because the 1500ms timer is cancelled mid-flight.
  // Returns the savePreference Promise so the caller can `await` completion.
  const pendingSaveRef = useRef<(() => Promise<void>) | null>(null);

  // ── Unsaved-changes state ────────────────────────────────────────────────
  // Tabs currently reporting unsaved edits.
  const [dirtyTabIds, setDirtyTabIds] = useState<Set<string>>(new Set());
  // Per-tab save handlers registered by `useUnsavedChanges`.
  const saveHandlersRef = useRef<Map<string, () => Promise<void>>>(new Map());
  // Per-tab arbitrary state cache. Forms opt in via getTabState/setTabState
  // to survive unmount/remount cycles caused by tab switches. In-memory only;
  // never persisted to userPreferences.
  const tabStateCacheRef = useRef<Map<string, unknown>>(new Map());

  const getTabState = useCallback(<T,>(tabId: string): T | undefined => {
    return tabStateCacheRef.current.get(tabId) as T | undefined;
  }, []);

  const setTabState = useCallback(<T,>(tabId: string, state: T): void => {
    tabStateCacheRef.current.set(tabId, state);
  }, []);

  const clearAllTabState = useCallback((): void => {
    tabStateCacheRef.current.clear();
  }, []);

  // Single provider-owned confirmation-modal state driving the reused
  // ConfirmDialog component. `saveTabIds` run sequentially when the user
  // picks "Save Changes"; `closeTabIds` close after save / on Discard.
  interface UnsavedPrompt {
    title: string;
    message: React.ReactNode;
    saveTabIds: string[];
    closeTabIds: string[];
    saving: boolean;
    error: string | null;
    onResolve: (choice: string) => void;
  }
  const [unsavedPrompt, setUnsavedPrompt] = useState<UnsavedPrompt | null>(null);

  // Save workspace state to backend (debounced)
  const saveWorkspaceState = useCallback((currentTabs: DashboardTab[], currentActiveTabId: string | null) => {
    // Don't save while restoring
    if (isRestoringRef.current) return;

    // Don't save if only the default tab exists
    if (currentTabs.length <= 1 && currentTabs[0]?.id === DEFAULT_DASHBOARD_TAB.id) {
      // Delete workspace preference if only default tab remains
      userPreferenceService.deletePreference(WORKSPACE_PREFERENCE_KEY).catch(() => {});
      return;
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Build the actual save closure. Kept as a ref so the logout flow can
    // call `flushPendingWorkspaceSave()` to fire it immediately (with await)
    // when the user logs out before the debounce window elapses.
    const performSave = async (): Promise<void> => {
      // F3 — Stamp the current user id onto the payload so a future restore
      // can detect cross-user leaks (defense in depth against backend/cache
      // glitches). Reads from the same localStorage entry AuthContext writes.
      let stampedUserId: string | undefined;
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem('userData') : null;
        if (raw) {
          const parsed = JSON.parse(raw) as { userId?: number; localUserId?: string };
          stampedUserId = parsed.localUserId ?? (parsed.userId != null ? String(parsed.userId) : undefined);
        }
      } catch {
        // Missing / malformed userData is non-fatal — save proceeds without a stamp.
      }

      const workspaceState: WorkspaceState = {
        tabs: currentTabs.map(tab => ({
          id: tab.id,
          title: tab.title,
          component: tab.component,
          props: tab.props ? { ...tab.props, _refreshKey: undefined } : undefined,
          closable: tab.closable,
        })),
        activeTabId: currentActiveTabId,
        userId: stampedUserId,
      };

      try {
        await userPreferenceService.savePreference(WORKSPACE_PREFERENCE_KEY, workspaceState);
      } catch (err) {
        console.error('Failed to save workspace state:', err);
      }
    };

    pendingSaveRef.current = performSave;
    saveTimerRef.current = setTimeout(() => {
      // Clear the pending ref BEFORE running so a concurrent flush call
      // doesn't double-fire.
      pendingSaveRef.current = null;
      saveTimerRef.current = null;
      void performSave();
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Synchronously fires any pending workspace save, returning a Promise so
  // callers (notably AuthContext.logout) can `await` completion BEFORE
  // navigating away. Without this, the in-flight POST gets cancelled by
  // window.location.replace and the next login restores stale tabs.
  const flushPendingWorkspaceSave = useCallback(async (): Promise<void> => {
    const cb = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!cb) return;
    await cb();
  }, []);

  // Restore workspace state from backend.
  //
  // This is defensively coded because session-restore used to get stuck:
  //   1. The service-layer fetch now has a 10s timeout (userPreferenceService).
  //   2. We wrap the whole call in Promise.race with a 15s hard cap, so the
  //      UI can never get stuck even if the service misbehaves.
  //   3. Every failure path (timeout, HTTP error, malformed JSON, missing
  //      preference) falls through to the default workspace — the user
  //      always gets a working UI.
  //   4. The `finally` always clears loading state, even on early return.
  const restoreWorkspace = useCallback(async (force = false) => {
    // Run the restore at most once per session. Remounts of DashboardWithTabs
    // (triggered by navigating back to /dashboard) must NOT re-run it, or the
    // defensive reset below would wipe the user's currently-open tabs. `force`
    // bypasses the guard for the manual "Retry" button after a failed restore.
    if (hasRestoredRef.current && !force) return;
    hasRestoredRef.current = true;

    isRestoringRef.current = true;
    setIsRestoringWorkspace(true);
    setRestoreError(null);

    // F2 — Defensive reset BEFORE the fetch. Without this, an early-return
    // (HTTP error, no saved workspace, malformed JSON, wrong-user payload)
    // leaves whatever in-memory state was there before — which on a
    // logout/login cycle is the previous user's tabs.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setTabs([DEFAULT_DASHBOARD_TAB]);
    setActiveTabId(DEFAULT_DASHBOARD_TAB.id);
    setDirtyTabIds(new Set());
    tabStateCacheRef.current.clear();
    saveHandlersRef.current.clear();

    // F3 — Read the current user's id so we can verify the restored payload
    // is actually theirs. Defense-in-depth: the backend already scopes by
    // JWT, but a stale localStorage value or a response cache could leak.
    const currentUserId = (() => {
      try {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem('userData') : null;
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { userId?: number; localUserId?: string };
        return parsed.localUserId ?? (parsed.userId != null ? String(parsed.userId) : null);
      } catch {
        return null;
      }
    })();

    try {
      const result = await Promise.race([
        userPreferenceService.getPreference(WORKSPACE_PREFERENCE_KEY),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Session restore timed out after 15 seconds.')),
            RESTORE_HARD_TIMEOUT_MS,
          ),
        ),
      ]);

      // Service returned an error result (HTTP 4xx/5xx, network error, timeout).
      // Log and continue with defaults — don't hang the UI.
      if (!result.isSuccess) {
        console.warn('Could not restore workspace:', result.message);
        setRestoreError(result.message || 'Could not restore your previous tabs.');
        return;
      }

      // No saved workspace yet — first login, or the user had only the default tab.
      if (!result.response?.preferenceValue) {
        return;
      }

      let workspace: WorkspaceState;
      try {
        workspace = JSON.parse(result.response.preferenceValue);
      } catch (parseErr) {
        // Malformed saved state — log and start fresh instead of crashing.
        console.warn('Saved workspace state is malformed, starting fresh:', parseErr);
        return;
      }

      // F3 — Stale-user guard. If the saved payload was stamped with a
      // different user id than the one currently logged in, ignore it.
      // Backward-compatible: payloads written before F3 don't have userId
      // and are treated as same-user (best-effort).
      if (workspace?.userId && currentUserId && workspace.userId !== currentUserId) {
        console.warn(
          'Saved workspace belongs to a different user (%s) than the current user (%s); ignoring.',
          workspace.userId,
          currentUserId,
        );
        return;
      }

      if (workspace?.tabs && workspace.tabs.length > 0) {
        // Ensure the default Dashboard tab is always present, pinned first.
        const hasDefaultTab = workspace.tabs.some(t => t.id === DEFAULT_DASHBOARD_TAB.id);
        const restoredTabs = hasDefaultTab
          ? workspace.tabs
          : [DEFAULT_DASHBOARD_TAB, ...workspace.tabs];

        setTabs(restoredTabs);
        setActiveTabId(workspace.activeTabId || DEFAULT_DASHBOARD_TAB.id);
      }
    } catch (error) {
      // Caught the hard-timeout rejection or any other unexpected throw.
      const message = error instanceof Error ? error.message : 'Failed to restore your tabs.';
      console.error('Failed to restore workspace:', error);
      setRestoreError(message);
    } finally {
      // CRITICAL: always clear loading state so the UI is never stuck.
      isRestoringRef.current = false;
      setIsRestoringWorkspace(false);
    }
  }, []);

  const clearRestoreError = useCallback(() => setRestoreError(null), []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const openTab = useCallback((tabData: Omit<DashboardTab, 'id'> & { id?: string }) => {
    const tabId = tabData.id || generateTabId(tabData.component, tabData.props);

    setTabs(prevTabs => {
      // Check if tab already exists
      const existingTabIndex = prevTabs.findIndex(t => t.id === tabId);
      if (existingTabIndex !== -1) {
        const existing = prevTabs[existingTabIndex];

        // If the caller is asking for the same tab id but with a DIFFERENT component
        // (e.g. we swapped a report's underlying page from a flat grid to a pivot view,
        // or a persisted workspace tab was created against an older component name),
        // we must replace the tab — preserving the old component would mean the user
        // re-opens the report and sees yesterday's UI. Component-swap wins over filter
        // preservation; otherwise users get stuck on stale views with no way to refresh
        // short of clearing localStorage.
        if (existing.component !== tabData.component) {
          setActiveTabId(tabId);
          const updatedTabs = [...prevTabs];
          updatedTabs[existingTabIndex] = {
            id: tabId,
            title: tabData.title || existing.title,
            component: tabData.component,
            props: tabData.props,
            closable: tabData.closable !== false,
          };
          saveWorkspaceState(updatedTabs, tabId);
          return updatedTabs;
        }

        // Tab exists with the SAME component — just activate it. We intentionally
        // PRESERVE the existing tab's props (and therefore the component's local
        // state, including the user's chosen date/store filters) instead of
        // overwriting them with whatever filters the caller (e.g. Report Manager)
        // currently has.
        //
        // Why: the user expects each report's filters to stick once they've
        // touched them. Re-clicking the same report card in Report Manager
        // should just bring the tab to focus, not reset the date the user
        // picked inside the report. To get a "fresh" report with the current
        // Report Manager filters, the user closes the tab and reopens it
        // (closeTab clears the component instance + state).
        //
        // We do bump `_refreshKey` so detail pages that watch it (e.g.
        // TotalTendersForShiftPage, drill-downs) can still refetch when re-opened
        // from a row double-click — those callers pass the same tab id but the
        // refresh is a meaningful refetch trigger, not a filter reset.
        setActiveTabId(tabId);
        const updatedTabs = [...prevTabs];
        updatedTabs[existingTabIndex] = {
          ...existing,
          props: { ...(existing.props || {}), _refreshKey: Date.now() },
          // Keep the existing title; only update when the caller provided a
          // non-empty title that differs (some drill-downs intentionally change
          // their title based on the selected row).
          title: tabData.title || existing.title,
        };
        saveWorkspaceState(updatedTabs, tabId);
        return updatedTabs;
      }

      // Add new tab
      const newTab: DashboardTab = {
        id: tabId,
        title: tabData.title,
        component: tabData.component,
        props: tabData.props,
        closable: tabData.closable !== false,
      };

      const newTabs = [...prevTabs, newTab];
      setActiveTabId(tabId);
      saveWorkspaceState(newTabs, tabId);
      return newTabs;
    });
  }, [saveWorkspaceState]);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prevTabs => {
      const tabToClose = prevTabs.find(t => t.id === tabId);
      // Don't allow closing non-closable tabs (like Dashboard)
      if (!tabToClose || !tabToClose.closable) return prevTabs;

      const tabIndex = prevTabs.findIndex(t => t.id === tabId);
      if (tabIndex === -1) return prevTabs;

      // Clean up unsaved-changes bookkeeping for the closed tab.
      saveHandlersRef.current.delete(tabId);

      const newTabs = prevTabs.filter(t => t.id !== tabId);

      // If closing the active tab, activate another tab
      setActiveTabId(currentActiveId => {
        let newActiveId = currentActiveId;
        if (currentActiveId === tabId && newTabs.length > 0) {
          // Try to activate the tab to the left, or the first available
          const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
          newActiveId = newTabs[newActiveIndex]?.id || null;
        } else if (newTabs.length === 0) {
          newActiveId = null;
        }
        saveWorkspaceState(newTabs, newActiveId);
        return newActiveId;
      });

      return newTabs;
    });
  }, [saveWorkspaceState]);

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    setTabs(currentTabs => {
      saveWorkspaceState(currentTabs, tabId);
      return currentTabs;
    });
  }, [saveWorkspaceState]);

  const closeAllTabs = useCallback(() => {
    // Keep only non-closable tabs (like Dashboard)
    setTabs(prevTabs => {
      const remaining = prevTabs.filter(t => !t.closable);
      saveWorkspaceState(remaining, DEFAULT_DASHBOARD_TAB.id);
      return remaining;
    });
    setActiveTabId(DEFAULT_DASHBOARD_TAB.id);
  }, [saveWorkspaceState]);

  const closeOtherTabs = useCallback((tabId: string) => {
    // Keep the specified tab and all non-closable tabs
    setTabs(prevTabs => {
      const remaining = prevTabs.filter(t => t.id === tabId || !t.closable);
      saveWorkspaceState(remaining, tabId);
      return remaining;
    });
  }, [saveWorkspaceState]);

  const updateTabProps = useCallback((tabId: string, props: Record<string, any>, meta?: { title?: string }) => {
    setTabs(prevTabs =>
      prevTabs.map(tab => {
        if (tab.id !== tabId) return tab
        const next: DashboardTab = {
          ...tab,
          props: { ...tab.props, ...props },
        }
        if (meta?.title != null) next.title = meta.title
        return next
      })
    );
  }, []);

  // ── Unsaved-changes handlers ─────────────────────────────────────────────
  const setTabDirty = useCallback((tabId: string, isDirty: boolean) => {
    setDirtyTabIds(prev => {
      const has = prev.has(tabId);
      if (isDirty === has) return prev; // no change — avoid re-render churn
      const next = new Set(prev);
      if (isDirty) next.add(tabId);
      else next.delete(tabId);
      return next;
    });
  }, []);

  const registerSaveHandler = useCallback((tabId: string, handler: () => Promise<void>) => {
    saveHandlersRef.current.set(tabId, handler);
    return () => {
      // Only remove if the map still has this handler (in case another form
      // instance with the same tabId later overwrote it — last-write-wins).
      if (saveHandlersRef.current.get(tabId) === handler) {
        saveHandlersRef.current.delete(tabId);
      }
    };
  }, []);

  // Shared helper: show the modal and act on the user's choice.
  const promptUnsavedChanges = useCallback(
    (params: {
      title: string;
      message: React.ReactNode;
      saveTabIds: string[];
      closeTabIds: string[];
    }): Promise<boolean> => {
      return new Promise<boolean>(resolve => {
        setUnsavedPrompt({
          title: params.title,
          message: params.message,
          saveTabIds: params.saveTabIds,
          closeTabIds: params.closeTabIds,
          saving: false,
          error: null,
          onResolve: async (choice: string) => {
            if (choice === 'cancel') {
              setUnsavedPrompt(null);
              resolve(false);
              return;
            }

            if (choice === 'discard') {
              setDirtyTabIds(prev => {
                const next = new Set(prev);
                params.closeTabIds.forEach(id => next.delete(id));
                return next;
              });
              params.closeTabIds.forEach(id => closeTab(id));
              setUnsavedPrompt(null);
              resolve(true);
              return;
            }

            if (choice === 'save') {
              setUnsavedPrompt(prev => (prev ? { ...prev, saving: true, error: null } : prev));
              try {
                // Run each registered save handler in sequence. Abort at the
                // first failure so partial saves don't happen silently.
                for (const id of params.saveTabIds) {
                  const handler = saveHandlersRef.current.get(id);
                  if (handler) await handler();
                }
                setDirtyTabIds(prev => {
                  const next = new Set(prev);
                  params.closeTabIds.forEach(id => next.delete(id));
                  return next;
                });
                params.closeTabIds.forEach(id => closeTab(id));
                setUnsavedPrompt(null);
                resolve(true);
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Save failed. Please try again.';
                setUnsavedPrompt(prev => (prev ? { ...prev, saving: false, error: msg } : prev));
                // Keep modal open — do not resolve yet; the user can retry or Discard.
              }
            }
          },
        });
      });
    },
    [closeTab],
  );

  const requestCloseTab = useCallback(
    async (tabId: string): Promise<boolean> => {
      if (!dirtyTabIds.has(tabId)) {
        closeTab(tabId);
        return true;
      }
      const tab = tabs.find(t => t.id === tabId);
      const title = tab?.title || 'this tab';
      return promptUnsavedChanges({
        title: 'Unsaved changes',
        message: (
          <div className="space-y-2">
            <p>
              You have unsaved changes in <strong className="text-gray-900 dark:text-white">{title}</strong>.
            </p>
            <p>Save the changes before closing the tab, or discard them?</p>
          </div>
        ),
        saveTabIds: [tabId],
        closeTabIds: [tabId],
      });
    },
    [dirtyTabIds, tabs, closeTab, promptUnsavedChanges],
  );

  const requestCloseAllTabs = useCallback(async (): Promise<boolean> => {
    const closable = tabs.filter(t => t.closable);
    const dirty = closable.filter(t => dirtyTabIds.has(t.id));
    if (dirty.length === 0) {
      closeAllTabs();
      return true;
    }
    return promptUnsavedChanges({
      title: 'Unsaved changes',
      message: (
        <div className="space-y-2">
          <p>
            {dirty.length === 1
              ? <><strong className="text-gray-900 dark:text-white">1 tab</strong> has unsaved changes.</>
              : <><strong className="text-gray-900 dark:text-white">{dirty.length} tabs</strong> have unsaved changes.</>}
          </p>
          <p>Save the changes before closing the tabs, or discard them?</p>
        </div>
      ),
      saveTabIds: dirty.map(t => t.id),
      closeTabIds: closable.map(t => t.id),
    });
  }, [tabs, dirtyTabIds, closeAllTabs, promptUnsavedChanges]);

  const requestCloseOtherTabs = useCallback(
    async (keepId: string): Promise<boolean> => {
      const toClose = tabs.filter(t => t.closable && t.id !== keepId);
      const dirty = toClose.filter(t => dirtyTabIds.has(t.id));
      if (dirty.length === 0) {
        closeOtherTabs(keepId);
        return true;
      }
      return promptUnsavedChanges({
        title: 'Unsaved changes',
        message: (
          <div className="space-y-2">
            <p>
              {dirty.length === 1
                ? <><strong className="text-gray-900 dark:text-white">1 other tab</strong> has unsaved changes.</>
                : <><strong className="text-gray-900 dark:text-white">{dirty.length} other tabs</strong> have unsaved changes.</>}
            </p>
            <p>Save the changes before closing the tabs, or discard them?</p>
          </div>
        ),
        saveTabIds: dirty.map(t => t.id),
        closeTabIds: toClose.map(t => t.id),
      });
    },
    [tabs, dirtyTabIds, closeOtherTabs, promptUnsavedChanges],
  );

  // ── Browser-level beforeunload guard ─────────────────────────────────────
  // Attach only while ≥1 tab is dirty so clean-page reloads don't prompt.
  useEffect(() => {
    if (dirtyTabIds.size === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome/Edge require returnValue to trigger the native dialog.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirtyTabIds]);

  // ── Cleanup when a tab is closed ─────────────────────────────────────────
  // Prunes both the per-tab state cache and dirtyTabIds when a tab disappears
  // from `tabs[]` (close, close-all, close-others, workspace replace, etc.).
  // This is the SINGLE source of truth for "tab is gone, drop its state" —
  // form hooks no longer need to clear on their own unmount, which lets
  // unmount-because-tab-switch leave state intact for the next remount.
  useEffect(() => {
    const liveIds = new Set(tabs.map(t => t.id));

    // Prune state cache (ref — no setState needed).
    for (const id of Array.from(tabStateCacheRef.current.keys())) {
      if (!liveIds.has(id)) {
        tabStateCacheRef.current.delete(id);
      }
    }

    // Prune save handlers. Forms no longer unregister on unmount (so close-all
    // can find handlers for every dirty tab, not just the currently-mounted
    // one), which means the context is the single source of truth for "tab
    // is gone, drop its handler." Without this prune, the map would leak
    // closures for closed tabs.
    for (const id of Array.from(saveHandlersRef.current.keys())) {
      if (!liveIds.has(id)) {
        saveHandlersRef.current.delete(id);
      }
    }

    // Prune dirtyTabIds (state — only setState if anything actually changed).
    setDirtyTabIds(prev => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (liveIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [tabs]);

  // ── Expose flush helper so AuthContext.logout can await the save ────────
  // AuthContext is mounted above DashboardTabProvider and can't import this
  // context directly. Stashing the helper on `window` keeps the coupling
  // loose. The pre-logout call awaits this so the in-flight POST completes
  // BEFORE window.location.replace cancels page-bound HTTP requests.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as unknown as { __flushWorkspaceSave?: () => Promise<void> }).__flushWorkspaceSave =
      flushPendingWorkspaceSave;
    return () => {
      delete (window as unknown as { __flushWorkspaceSave?: () => Promise<void> }).__flushWorkspaceSave;
    };
  }, [flushPendingWorkspaceSave]);

  // ── Cross-user leak guard: reset everything on logout ───────────────────
  // AuthContext.logout() dispatches the `app:logout` window event. Without
  // this listener, the DashboardTabProvider keeps the previous user's tabs +
  // cache + dirty flags in memory across a logout/login cycle (the app shell
  // doesn't always fully unmount on redirect to /signin). When the next user
  // logs in and they have no saved workspace, restoreWorkspace early-returns
  // and the stale tabs from the previous user remain visible.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      // Any pending workspace save was already awaited by AuthContext.logout
      // via the window.__flushWorkspaceSave helper BEFORE this event fires.
      // We still clear refs defensively in case some last-ditch state change
      // queued a new save in the time between flush and event dispatch.
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      pendingSaveRef.current = null;
      isRestoringRef.current = false;
      // Allow the next login to restore its own workspace.
      hasRestoredRef.current = false;
      setTabs([DEFAULT_DASHBOARD_TAB]);
      setActiveTabId(DEFAULT_DASHBOARD_TAB.id);
      setDirtyTabIds(new Set());
      setUnsavedPrompt(null);
      setRestoreError(null);
      tabStateCacheRef.current.clear();
      saveHandlersRef.current.clear();
    };
    window.addEventListener('app:logout', handler);
    return () => window.removeEventListener('app:logout', handler);
  }, []);

  // ── DEV DIAGNOSTIC ───────────────────────────────────────────────────────
  // Exposes current dirty state + tab cache on window so the user can probe
  // from DevTools console: `__dashTabsDebug()` returns a snapshot.
  // Remove once the dirty-flag flow is confirmed working end-to-end.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__dashTabsDebug = () => ({
      tabs: tabs.map(t => ({ id: t.id, title: t.title, component: t.component, editMode: !!t.editMode })),
      activeTabId,
      dirtyTabIds: Array.from(dirtyTabIds),
      tabStateCacheKeys: Array.from(tabStateCacheRef.current.keys()),
    });
  }, [tabs, activeTabId, dirtyTabIds]);

  return (
    <DashboardTabContext.Provider value={{
      tabs,
      activeTabId,
      openTab,
      closeTab,
      setActiveTab,
      closeAllTabs,
      closeOtherTabs,
      updateTabProps,
      restoreWorkspace,
      isRestoringWorkspace,
      restoreError,
      clearRestoreError,
      dirtyTabIds,
      setTabDirty,
      registerSaveHandler,
      requestCloseTab,
      requestCloseAllTabs,
      requestCloseOtherTabs,
      getTabState,
      setTabState,
      clearAllTabState,
    }}>
      {children}

      {/* Single provider-owned unsaved-changes modal — reused ConfirmDialog. */}
      <ConfirmDialog
        isOpen={!!unsavedPrompt}
        title={unsavedPrompt?.title || ''}
        type="warning"
        persistent={unsavedPrompt?.saving || false}
        showCloseButton
        message={
          <div>
            {unsavedPrompt?.message}
            {unsavedPrompt?.error && (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{unsavedPrompt.error}</span>
              </div>
            )}
            {unsavedPrompt?.saving && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/>
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75"/>
                </svg>
                <span>Saving your changes…</span>
              </div>
            )}
          </div>
        }
        buttons={[
          { label: 'Save Changes', variant: 'primary', value: 'save' },
          { label: 'Discard Changes', variant: 'danger', value: 'discard' },
        ]}
        onClose={(choice) => {
          if (unsavedPrompt?.saving) return; // ignore clicks while save in flight
          unsavedPrompt?.onResolve(choice);
        }}
      />
    </DashboardTabContext.Provider>
  );
};

export const useDashboardTabs = (): DashboardTabContextType => {
  const context = useContext(DashboardTabContext);
  if (!context) {
    throw new Error('useDashboardTabs must be used within a DashboardTabProvider');
  }
  return context;
};

export default DashboardTabContext;
