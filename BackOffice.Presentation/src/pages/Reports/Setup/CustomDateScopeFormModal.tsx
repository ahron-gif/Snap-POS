import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Flatpickr from 'react-flatpickr';
import { customDateScopeService, type CustomDateScope } from '../../../services/customDateScopeService';
import { useFieldAccessSet } from '../../../hooks/useFieldAccessSet';
import { focusFirstInvalid } from '../../../hooks/useFocusFirstInvalid';

// Stable grid id — must match the one used by CustomDateScopeListPage
// (`CUSTOM_DATE_SCOPE_GRID_ID`) so the form pulls the same access rules
// the grid itself respects.
const CUSTOM_DATE_SCOPE_GRID_ID = 'custom-date-scope-list-grid';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Fired after a successful create / update so the parent can refetch the
   * list and surface a toast. The `mode` lets the parent customize the
   * message ("created" vs "updated") without inspecting the editing state.
   */
  onSaved: (mode: 'create' | 'update') => void;
  editing?: CustomDateScope | null;
}

// Custom dropdown for the Sort Order field. Native <select> popups can't
// be sized consistently across browsers — this component anchors a
// portal-rendered list to its trigger button so we get a guaranteed
// 400 px scrollable list. Click-outside / Escape closes it.
interface SortOrderDropdownProps {
  value: number;
  onChange: (n: number) => void;
  total: number;
}

const SORT_ORDER_DROPDOWN_HEIGHT = 400;

const SortOrderDropdown: React.FC<SortOrderDropdownProps> = ({ value, onChange, total }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Position state — recomputed on open and on resize/scroll while open so
  // the menu always anchors to the current button rect even if the modal
  // body scrolls. Picks `openUp` when there isn't room below.
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
    openUp: boolean;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const compute = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const PAD = 12;
      const spaceBelow = window.innerHeight - rect.bottom - PAD;
      const spaceAbove = rect.top - PAD;
      const wantsHeight = SORT_ORDER_DROPDOWN_HEIGHT;
      const openUp = spaceBelow < wantsHeight && spaceAbove > spaceBelow;
      const available = openUp ? spaceAbove : spaceBelow;
      const height = Math.min(wantsHeight, Math.max(160, available));
      const top = openUp ? rect.top - 4 : rect.bottom + 4;
      setPos({ top, left: rect.left, width: rect.width, height, openUp });
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open]);

  // Click-outside + Escape to close.
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // When the menu opens, scroll the active row into view so a long list
  // doesn't drop the user at row 1 every time.
  useEffect(() => {
    if (!open || !pos) return;
    const node = menuRef.current?.querySelector<HTMLButtonElement>(
      `button[data-active="true"]`,
    );
    node?.scrollIntoView({ block: 'center' });
  }, [open, pos]);

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        Sort Order
        <span className="ml-1 text-[10px] font-normal text-gray-400">
          ({total} {total === 1 ? 'scope' : 'scopes'} total)
        </span>
      </label>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((p) => !p)}
        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 flex items-center justify-between"
      >
        <span>{value}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
        Position in the saved-scopes list. Other scopes shift to keep
        positions contiguous.
      </p>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: pos.openUp ? undefined : pos.top,
            bottom: pos.openUp ? window.innerHeight - pos.top : undefined,
            left: pos.left,
            width: pos.width,
            // Fixed 400 px height — body scrolls internally. Clamped only
            // when the viewport itself can't fit it (small windows).
            height: pos.height,
            zIndex: 1000,
          }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl flex flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto py-1">
            {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                data-active={n === value}
                onClick={() => {
                  onChange(n);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                  n === value
                    ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium'
                    : 'text-gray-800 dark:text-gray-100'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

const toDateStr = (d: Date | string | null | undefined): string => {
  if (!d) return '';
  if (typeof d === 'string') return d.split('T')[0];
  return d.toISOString().split('T')[0];
};

const CustomDateScopeFormModal: React.FC<Props> = ({ isOpen, onClose, onSaved, editing }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fromDate, setFromDate] = useState<string>(toDateStr(new Date()));
  const [toDate, setToDate] = useState<string>(toDateStr(new Date()));
  // Sort Order = the manual list position. On create the field is hidden
  // because new scopes always go to the bottom (server assigns max+1).
  // On edit it's a 1..N dropdown that lets the user reposition the scope.
  const [sortOrder, setSortOrder] = useState<number>(1);
  // Total active scopes — used to populate the Sort Order dropdown bounds.
  // Loaded lazily when the modal opens.
  const [activeCount, setActiveCount] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Field-level access rules. Hidden fields are removed from the UI and
  // their values are either omitted (Create) or round-tripped from the
  // editing entity (Update) so we don't accidentally null them out.
  // Required fields (name, fromDate, toDate) are protected inside the
  // hook — they always render even if a stale rule revokes them.
  const { isHidden } = useFieldAccessSet(CUSTOM_DATE_SCOPE_GRID_ID);

  // Refs + flash key for the focus-first-invalid pattern. When the user
  // submits with a missing required field we focus the offender, scroll
  // it into view, and flash a red ring so the UX matches the rest of
  // the app — no more "field is required" toast as the only signal.
  const nameRef = useRef<HTMLInputElement | null>(null);
  const fromDateRef = useRef<HTMLDivElement | null>(null);
  const toDateRef = useRef<HTMLDivElement | null>(null);
  const [flashedField, setFlashedField] = useState<string | null>(null);
  // Tailwind ring class applied to whichever required field is currently
  // flashed as invalid. Helper avoids repetition at every input site.
  const ringClass = (key: string) =>
    flashedField === key ? 'ring-2 ring-red-500 border-red-500' : '';

  useEffect(() => {
    if (!isOpen) return;
    // Load active scope count so the Sort Order dropdown knows its bounds.
    customDateScopeService
      .getActive()
      .then((res) => {
        if (res.data.isSuccess) {
          setActiveCount(res.data.response?.length ?? 0);
        }
      })
      .catch(() => { /* fail open — dropdown still works with the current value */ });

    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? '');
      setFromDate(toDateStr(editing.fromDate));
      setToDate(toDateStr(editing.toDate));
      setSortOrder(editing.sortOrder || 1);
      setIsActive(editing.isActive);
    } else {
      setName('');
      setDescription('');
      setFromDate(toDateStr(new Date()));
      setToDate(toDateStr(new Date()));
      setSortOrder(1); // ignored on create — server assigns max+1
      setIsActive(true);
    }
    setError(null);
  }, [isOpen, editing]);

  if (!isOpen) return null;

  const handleSave = async () => {
    // Required-field validation: focus the first offender (in display
    // order), scroll it into view, and flash a red ring. Cross-field
    // rules attach to whichever input the user should fix first — here
    // a bad From > To range pins the flash to the From input.
    const ok = focusFirstInvalid(
      [
        { ref: nameRef, isValid: !!name.trim(), flashKey: 'name' },
        { ref: fromDateRef, isValid: !!fromDate, flashKey: 'fromDate' },
        { ref: toDateRef, isValid: !!toDate, flashKey: 'toDate' },
        {
          ref: fromDateRef,
          isValid: !fromDate || !toDate || fromDate <= toDate,
          flashKey: 'fromDate',
        },
      ],
      setFlashedField,
    );
    if (!ok) {
      // Match the offender to a human message for the inline banner so
      // assistive tech / screen readers still announce the problem.
      if (!name.trim()) setError('Name is required');
      else if (!fromDate) setError('From Date is required');
      else if (!toDate) setError('To Date is required');
      else if (fromDate > toDate) setError('From Date must be on or before To Date');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // For non-required hidden fields:
      //   - Edit  → reuse the existing value from `editing` so the round-
      //             tripped payload doesn't null out a value the user
      //             couldn't see and therefore couldn't have changed.
      //   - Create → omit (or pass null) so the backend default applies.
      const descriptionToSend = isHidden('description')
        ? (editing?.description ?? null)
        : (description.trim() || null);

      const isActiveToSend = isHidden('isActive')
        ? (editing?.isActive ?? true)
        : isActive;

      const basePayload = {
        name: name.trim(),
        description: descriptionToSend,
        fromDate,
        toDate,
        isActive: isActiveToSend,
      };
      const res = editing
        ? await customDateScopeService.update(editing.customDateScopeID, {
            ...basePayload,
            customDateScopeID: editing.customDateScopeID,
            // Only send sortOrder when (a) the user can actually see /
            // change it and (b) it actually changed. Otherwise the server
            // skips its reorder pass.
            ...(!isHidden('sortOrder') && sortOrder !== editing.sortOrder
              ? { sortOrder }
              : {}),
          })
        : await customDateScopeService.create(basePayload);
      if (res.data.isSuccess) {
        // Close first so the modal disappears, then notify the parent. The
        // parent triggers a grid remount + toast in response — by the time
        // the toast appears the new SortOrder is already on screen.
        onClose();
        onSaved(editing ? 'update' : 'create');
      } else {
        setError(res.data.message || 'Save failed');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      {/* Wrapping the body in a <form> with onSubmit gives us Enter-to-save
          for free — pressing Enter from any input runs handleSave, which
          in turn runs the focus-first-invalid validation. The Save button
          becomes a real submit button so it triggers the same path. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!saving) handleSave();
        }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4"
      >
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            {editing ? 'Edit Custom Date Scope' : 'New Custom Date Scope'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="text-xs px-3 py-2 rounded bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name *
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (flashedField === 'name') setFlashedField(null);
              }}
              maxLength={100}
              className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 ${ringClass(
                'name',
              )}`}
              placeholder="e.g. Q1 Tax Audit"
            />
          </div>

          {/* Description — hidden entirely when revoked via Grid Settings.
              On Edit the existing value is preserved in the payload (see
              handleSave) so a hidden field can't accidentally null itself. */}
          {!isHidden('description') && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              {/* Fixed height — content scrolls inside the box instead of
                  stretching the modal vertically as the user types. */}
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={2}
                style={{ height: 64, resize: 'none' }}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 overflow-y-auto"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Flatpickr renders an internal <input>; we wrap it in a div
                that owns the ref so focusFirstInvalid can drill into the
                first focusable descendant. */}
            <div ref={fromDateRef}>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                From Date *
              </label>
              <Flatpickr
                value={fromDate}
                onChange={([d]) => {
                  setFromDate(d ? toDateStr(d) : fromDate);
                  if (flashedField === 'fromDate') setFlashedField(null);
                }}
                options={{ dateFormat: 'Y-m-d', allowInput: true }}
                className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 ${ringClass(
                  'fromDate',
                )}`}
              />
            </div>
            <div ref={toDateRef}>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                To Date *
              </label>
              <Flatpickr
                value={toDate}
                onChange={([d]) => {
                  setToDate(d ? toDateStr(d) : toDate);
                  if (flashedField === 'toDate') setFlashedField(null);
                }}
                options={{ dateFormat: 'Y-m-d', allowInput: true }}
                className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 ${ringClass(
                  'toDate',
                )}`}
              />
            </div>
          </div>

          {/* Sort Order — manual list position (1, 2, 3, ...).
              Hidden when creating because new scopes always go to the bottom.
              When editing, lets the user move this scope to any position;
              the server shifts neighbouring rows so the active list stays
              contiguous (no gaps, no duplicates).

              Native <select> dropdowns can't be styled to a fixed pixel
              height across browsers — Chrome/Edge cap them at ~10 items
              and Firefox grows unboundedly. With many scopes the popup
              would either overflow the modal or scroll its own way. We
              render a custom dropdown via portal with a fixed 400 px
              height + internal scroll so behaviour is consistent. */}
          {editing && activeCount > 0 && !isHidden('sortOrder') && (
            <SortOrderDropdown
              value={sortOrder}
              onChange={setSortOrder}
              total={activeCount}
            />
          )}

          {/* Active toggle — only shown when EDITING an existing scope so the
              user can deactivate later. New scopes are always created Active
              (defaulted to true in state) so users can't accidentally save an
              inactive scope on first creation, which previously caused
              confusion ("I created it but it's not in the More dropdown"). */}
          {editing && !isHidden('isActive') && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive((v) => !v)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors mt-0.5 ${
                  isActive ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    isActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {isActive ? 'Active' : 'Inactive'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {isActive
                    ? 'This scope will appear in the "More" dropdown on reports.'
                    : 'This scope will be hidden from the "More" dropdown but remain saved.'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CustomDateScopeFormModal;
