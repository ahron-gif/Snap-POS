/**
 * Focus + scroll + flash the first invalid required field in a form.
 *
 * Pass an ordered list of fields. The order of the array IS the focus
 * priority — top-to-bottom. The first entry whose `isValid` is false
 * receives focus, gets scrolled into the centre of the viewport, and (if
 * a `flashKey` was supplied) triggers a 1.5 s flash via the optional
 * `setFlashedField` setter.
 *
 * For composite inputs whose ref is a wrapper element (e.g. Flatpickr's
 * `<div>`), the helper drills down to the first focusable descendant —
 * any `input | textarea | select | button | [tabindex]`.
 *
 * Usage:
 * ```ts
 * const ok = focusFirstInvalid(
 *   [
 *     { ref: nameRef,  isValid: !!name.trim(),  flashKey: 'name' },
 *     { ref: fromRef,  isValid: !!fromDate,     flashKey: 'fromDate' },
 *     { ref: rangeRef, isValid: fromDate <= toDate, flashKey: 'fromDate' },
 *   ],
 *   setFlashedField,
 * )
 * if (!ok) return
 * ```
 *
 * @returns `true` when every field is valid (caller can proceed to save),
 *          `false` when an offender was found and side-effects ran.
 */
export interface FocusFirstInvalidField {
  ref: React.RefObject<HTMLElement | null>;
  isValid: boolean;
  /** Optional key passed to `setFlashedField` so the UI can render a red ring on the offender. */
  flashKey?: string;
  /**
   * Optional callback invoked before focusing/scrolling. Use this to
   * expand a collapsed accordion / section that contains the field, so
   * the input is actually in the DOM and visible by the time we try to
   * focus it. Idempotent — safe to call when the section is already
   * open.
   *
   * Example:
   * ```ts
   * { ref: itemNoRef,
   *   isValid: !!itemNo.trim(),
   *   flashKey: 'itemNo',
   *   expandSection: () => sectionLayout.setCollapsed('basic-info', false) }
   * ```
   */
  expandSection?: () => void;
}

export function focusFirstInvalid(
  fields: FocusFirstInvalidField[],
  setFlashedField?: (key: string | null) => void,
  flashMs: number = 1500,
): boolean {
  const offender = fields.find((f) => !f.isValid);
  if (!offender) return true;

  // Expand the containing section first (no-op if already open). The
  // section's DOM hasn't been rendered yet for focus / scroll if it was
  // previously collapsed — we defer the focus to the next animation
  // frame so React has flushed the expansion before we touch the input.
  const runFocus = () => {
    const wrapper = offender.ref.current;
    if (wrapper) {
      // If the ref already points at a focusable element, focus it.
      // Otherwise drill into its first focusable descendant. Covers both
      // direct `<input>` refs and wrapper `<div>` refs around components
      // like Flatpickr or our custom SortOrderDropdown trigger.
      const SELECTORS = 'input,textarea,select,button,[tabindex]';
      const focusable: HTMLElement | null =
        wrapper.matches?.(SELECTORS)
          ? (wrapper as HTMLElement)
          : wrapper.querySelector<HTMLElement>(SELECTORS);
      focusable?.focus();
      wrapper.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  if (offender.expandSection) {
    offender.expandSection();
    // Two rAFs: first lets React commit the state change, second waits
    // for the layout / animation to settle before we scroll/focus.
    requestAnimationFrame(() => requestAnimationFrame(runFocus));
  } else {
    runFocus();
  }

  if (offender.flashKey && setFlashedField) {
    setFlashedField(offender.flashKey);
    if (flashMs > 0) {
      window.setTimeout(() => setFlashedField(null), flashMs);
    }
  }

  return false;
}

export default focusFirstInvalid;
