import React, { type FC, useCallback, useEffect, useMemo, useState } from "react";
import {
  coerceItemNumber,
  formatMoneyTypedFromNumber,
  formatQtyTypedFromNumber,
  parseMoneyTypedInput,
  parseQtyTypedInput,
} from "../../../utils/numericInputUtils";

interface InputProps {
  type?: "text" | "number" | "email" | "password" | "date" | "time" | string;
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  min?: string;
  max?: string;
  step?: number;
  disabled?: boolean;
  /** Non-editable but still readable (e.g. computed fields). Distinct from disabled styling. */
  readOnly?: boolean;
  success?: boolean;
  error?: boolean;
  hint?: string;
  inputMode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
  maxLength?: number;
  /**
   * When `type` is `"number"`, default is a canonical text field (no leading-zero glitches from
   * `<input type="number">` + stringy API values). Set `true` for native number input + spinners.
   */
  nativeNumberInput?: boolean;
  /** Used with canonical number mode: money/percent vs whole-number qty. Default `"decimal"`. */
  numericVariant?: "decimal" | "integer";
}

const Input: FC<InputProps> = ({
  type = "text",
  id,
  name,
  placeholder,
  value,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  className = "",
  min,
  max,
  step,
  disabled = false,
  readOnly = false,
  success = false,
  error = false,
  hint,
  inputMode,
  maxLength,
  nativeNumberInput = false,
  numericVariant = "decimal",
}) => {
  const isCanonicalNumber = type === "number" && !nativeNumberInput;

  // Decimal-buffer mode covers BOTH usage patterns:
  //   (a) type="text"  + inputMode="decimal" — consumer pre-formats value
  //       and parses inside its own onChange.
  //   (b) type="number" + !nativeNumberInput — Input itself does the
  //       parse+format round-trip inside handleChange.
  // Both paths suffer the same problem: typing "12." round-trips to "12"
  // and erases the dot before the user can finish "12.99". A shared local
  // buffer of raw keystrokes preserves trailing dots, trailing zeros, and
  // leading "0." while the user is mid-typing, but yields back to the
  // external value the moment something else updates it (e.g. a margin →
  // price recalc, or the user blurs the field). Integer fields don't need
  // this — there's no in-progress state for them.
  const usesDecimalBuffer =
    (!isCanonicalNumber && type === "text" && inputMode === "decimal") ||
    (isCanonicalNumber && numericVariant === "decimal");

  const [typedBuffer, setTypedBuffer] = useState<string | null>(null);

  // Drop the buffer whenever the external value no longer matches what we
  // typed. Two cases trigger this:
  //   1) Another field's onChange handler recomputed our value (e.g. user
  //      edited Margin% → Price was overwritten). Show the new value.
  //   2) The consumer normalized our input to a different number (e.g.
  //      clamped a negative). Show the normalized version.
  useEffect(() => {
    if (!usesDecimalBuffer || typedBuffer == null) return;
    const typedNumber = parseMoneyTypedInput(typedBuffer);
    const externalString = value === undefined || value === null ? "" : String(value);
    const externalNumber = parseMoneyTypedInput(externalString);
    if (Math.abs(typedNumber - externalNumber) > 1e-9) {
      setTypedBuffer(null);
    }
  }, [usesDecimalBuffer, typedBuffer, value]);

  const resolvedInputMode = useMemo(() => {
    if (!isCanonicalNumber) return inputMode;
    if (inputMode !== undefined && inputMode !== "none") return inputMode;
    return numericVariant === "integer" ? "numeric" : "decimal";
  }, [isCanonicalNumber, inputMode, numericVariant]);

  const displayValue = useMemo(() => {
    // Decimal-buffer modes: prefer the in-progress buffer so the trailing-dot
    // case described above keeps working. Falls through to canonical format
    // when there's nothing in flight.
    if (usesDecimalBuffer && typedBuffer != null) return typedBuffer;
    if (isCanonicalNumber) {
      if (value === "" || value === undefined || value === null) return "";
      const n = coerceItemNumber(value, NaN);
      if (!Number.isFinite(n)) return "";
      return numericVariant === "integer"
        ? formatQtyTypedFromNumber(n)
        : formatMoneyTypedFromNumber(n);
    }
    return value;
  }, [isCanonicalNumber, usesDecimalBuffer, typedBuffer, value, numericVariant]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Capture raw keystrokes for decimal-buffer fields BEFORE calling the
      // consumer's onChange, so the next render reads the buffer instead of
      // falling back to the formatted external value.
      if (usesDecimalBuffer) setTypedBuffer(e.target.value);

      if (!isCanonicalNumber) {
        // Pass through (type="text" path — consumer parses inside their
        // own onChange handler).
        onChange?.(e);
        return;
      }
      if (!onChange) return;
      const raw = e.target.value;
      const parsed =
        numericVariant === "integer" ? parseQtyTypedInput(raw) : parseMoneyTypedInput(raw);
      const canonical =
        raw.trim() === ""
          ? ""
          : numericVariant === "integer"
            ? formatQtyTypedFromNumber(parsed)
            : formatMoneyTypedFromNumber(parsed);
      const t = e.target;
      const ct = e.currentTarget;
      onChange({
        ...e,
        target: { ...t, value: canonical } as EventTarget & HTMLInputElement,
        currentTarget: { ...ct, value: canonical } as EventTarget & HTMLInputElement,
      } as React.ChangeEvent<HTMLInputElement>);
    },
    [isCanonicalNumber, usesDecimalBuffer, numericVariant, onChange],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      // On blur, drop the typing buffer so the next display reflects the
      // canonical formatted value (e.g. "12." -> "12"). Without this the
      // trailing dot would linger after the user tabs away.
      if (usesDecimalBuffer) setTypedBuffer(null);
      onBlur?.(e);
    },
    [usesDecimalBuffer, onBlur],
  );

  let inputClasses = ` h-9 w-full rounded-lg border appearance-none px-3 py-1.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 transition-colors duration-200 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30`;

  if (disabled) {
    inputClasses += ` text-gray-500 border-gray-300 opacity-40 bg-gray-100 cursor-not-allowed dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 opacity-40`;
  } else if (readOnly && error) {
    inputClasses += ` text-gray-800 border-error-500 bg-red-50/80 cursor-default dark:bg-red-500/10 dark:text-gray-200 dark:border-error-500 focus:border-error-300 focus:ring-error-500/20`;
  } else if (readOnly) {
    inputClasses += ` text-gray-700 border-gray-200 bg-gray-50 cursor-default dark:bg-gray-800/80 dark:text-gray-300 dark:border-gray-600`;
  } else if (error) {
    inputClasses += `  border-error-500 focus:border-error-300 focus:ring-error-500/20 dark:text-error-400 dark:border-error-500 dark:focus:border-error-800`;
  } else if (success) {
    inputClasses += `  border-success-500 focus:border-success-300 focus:ring-success-500/20 dark:text-success-400 dark:border-success-500 dark:focus:border-success-800`;
  } else {
    inputClasses += ` bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:text-white/90  dark:focus:border-brand-800`;
  }

  inputClasses += ` ${className}`;

  const effectiveType = isCanonicalNumber ? "text" : type;
  const passMinMaxStep = !isCanonicalNumber;

  return (
    <div className="relative">
      <input
        type={effectiveType}
        id={id}
        name={name}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        min={passMinMaxStep ? min : undefined}
        max={passMinMaxStep ? max : undefined}
        step={passMinMaxStep ? step : undefined}
        disabled={disabled}
        readOnly={readOnly}
        inputMode={resolvedInputMode}
        maxLength={maxLength}
        className={inputClasses}
      />

      {hint && (
        <p
          className={`mt-1.5 text-xs break-words ${
            error
              ? "text-error-500"
              : success
                ? "text-success-500"
                : "text-gray-500"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
};

export default Input;
