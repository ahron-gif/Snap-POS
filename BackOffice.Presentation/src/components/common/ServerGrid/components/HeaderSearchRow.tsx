import React, { useState, useCallback, useEffect, useRef } from "react";
import { Column, HeaderSearchConfig } from "../types/grid";

interface HeaderSearchRowProps {
  columns: Column[];
  showCheckboxes?: boolean;
  headerSearchConfig: HeaderSearchConfig;
  onHeaderSearch: (field: string, value: string) => void;
  debounceMs?: number;
  isSearching?: boolean;
}

// Loading spinner component
const SearchSpinner: React.FC = () => (
  <div className="header-search-spinner">
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" className="spinner-path" />
    </svg>
  </div>
);

// Tri-state boolean filter: "" (no filter) → "true" → "false" → ""
const BooleanFilterToggle: React.FC<{
  value: string;
  onChange: (value: string) => void;
  title: string;
}> = ({ value, onChange, title }) => {
  const state: "none" | "true" | "false" =
    value === "true" ? "true" : value === "false" ? "false" : "none";

  const handleClick = useCallback(() => {
    if (state === "none") onChange("true");
    else if (state === "true") onChange("false");
    else onChange("");
  }, [state, onChange]);

  const tooltip =
    state === "none"
      ? `${title}: show all (click to filter Yes)`
      : state === "true"
        ? `${title}: Yes only (click to filter No)`
        : `${title}: No only (click to clear)`;

  return (
    <button
      type="button"
      className={`header-search-bool header-search-bool--${state}`}
      onClick={handleClick}
      title={tooltip}
      aria-label={tooltip}
    >
      {state === "true" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="5 12 10 17 19 7" />
        </svg>
      )}
      {state === "false" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </svg>
      )}
    </button>
  );
};

export const HeaderSearchRow: React.FC<HeaderSearchRowProps> = ({
  columns,
  showCheckboxes = false,
  headerSearchConfig,
  onHeaderSearch,
  debounceMs = 500,
  isSearching = false,
}) => {
  const [localSearchValues, setLocalSearchValues] = useState<HeaderSearchConfig>({});
  const [pendingFields, setPendingFields] = useState<Set<string>>(new Set());
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // Sync local values with external config
  useEffect(() => {
    setLocalSearchValues(headerSearchConfig);
  }, [headerSearchConfig]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // Clear pending fields when search completes
  useEffect(() => {
    if (!isSearching) {
      setPendingFields(new Set());
    }
  }, [isSearching]);

  const handleSearchChange = useCallback(
    (field: string, value: string) => {
      // Update local state immediately for responsive UI
      setLocalSearchValues((prev) => ({
        ...prev,
        [field]: value,
      }));

      // Mark field as pending
      setPendingFields((prev) => new Set(prev).add(field));

      // Clear existing timer for this field
      if (debounceTimers.current[field]) {
        clearTimeout(debounceTimers.current[field]);
      }

      // Set new debounce timer
      debounceTimers.current[field] = setTimeout(() => {
        onHeaderSearch(field, value);
      }, debounceMs);
    },
    [onHeaderSearch, debounceMs]
  );

  // Immediate (no debounce) search trigger — used for checkbox and date pickers
  const handleImmediateSearch = useCallback(
    (field: string, value: string) => {
      setLocalSearchValues((prev) => ({
        ...prev,
        [field]: value,
      }));
      if (debounceTimers.current[field]) {
        clearTimeout(debounceTimers.current[field]);
      }
      setPendingFields((prev) => new Set(prev).add(field));
      onHeaderSearch(field, value);
    },
    [onHeaderSearch]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, field: string) => {
      if (e.key === "Enter") {
        // Trigger search immediately on Enter
        if (debounceTimers.current[field]) {
          clearTimeout(debounceTimers.current[field]);
        }
        setPendingFields((prev) => new Set(prev).add(field));
        onHeaderSearch(field, localSearchValues[field] || "");
      }
    },
    [onHeaderSearch, localSearchValues]
  );

  const handleClearSearch = useCallback(
    (field: string) => {
      setLocalSearchValues((prev) => ({
        ...prev,
        [field]: "",
      }));
      if (debounceTimers.current[field]) {
        clearTimeout(debounceTimers.current[field]);
      }
      setPendingFields((prev) => new Set(prev).add(field));
      onHeaderSearch(field, "");
    },
    [onHeaderSearch]
  );

  const visibleColumns = columns.filter((column) => column.visible !== false);

  const renderFilterInput = (column: Column, hasValue: boolean, showSpinner: boolean) => {
    const currentValue = localSearchValues[column.field] || "";

    // Boolean — tri-state toggle button (no filter / Yes / No)
    if (column.dataType === "boolean") {
      return (
        <div className="header-search-input-container header-search-bool-container">
          <BooleanFilterToggle
            value={currentValue}
            onChange={(v) => handleImmediateSearch(column.field, v)}
            title={column.headerName}
          />
        </div>
      );
    }

    // Date — native date picker
    if (column.dataType === "date") {
      return (
        <div className={`header-search-input-container ${showSpinner ? "searching" : ""}`}>
          <input
            type="date"
            className={`header-search-input header-search-date ${hasValue ? "has-value" : ""} ${showSpinner ? "is-searching" : ""}`}
            value={currentValue}
            onChange={(e) => handleImmediateSearch(column.field, e.target.value)}
            title={`Filter ${column.headerName}`}
          />
          {showSpinner ? (
            <SearchSpinner />
          ) : hasValue ? (
            <button
              className="header-search-clear"
              onClick={() => handleClearSearch(column.field)}
              title="Clear filter"
              type="button"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : null}
        </div>
      );
    }

    // Datetime — native datetime-local picker
    if (column.dataType === "datetime") {
      return (
        <div className={`header-search-input-container ${showSpinner ? "searching" : ""}`}>
          <input
            type="datetime-local"
            className={`header-search-input header-search-datetime ${hasValue ? "has-value" : ""} ${showSpinner ? "is-searching" : ""}`}
            value={currentValue}
            onChange={(e) => handleImmediateSearch(column.field, e.target.value)}
            title={`Filter ${column.headerName}`}
          />
          {showSpinner ? (
            <SearchSpinner />
          ) : hasValue ? (
            <button
              className="header-search-clear"
              onClick={() => handleClearSearch(column.field)}
              title="Clear filter"
              type="button"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : null}
        </div>
      );
    }

    // Time — native time picker
    if (column.dataType === "time") {
      return (
        <div className={`header-search-input-container ${showSpinner ? "searching" : ""}`}>
          <input
            type="time"
            className={`header-search-input header-search-time ${hasValue ? "has-value" : ""} ${showSpinner ? "is-searching" : ""}`}
            value={currentValue}
            onChange={(e) => handleImmediateSearch(column.field, e.target.value)}
            title={`Filter ${column.headerName}`}
          />
          {showSpinner ? (
            <SearchSpinner />
          ) : hasValue ? (
            <button
              className="header-search-clear"
              onClick={() => handleClearSearch(column.field)}
              title="Clear filter"
              type="button"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : null}
        </div>
      );
    }

    // Default text/number search
    return (
      <div className={`header-search-input-container ${showSpinner ? "searching" : ""}`}>
        <input
          type={column.dataType === "number" ? "number" : "text"}
          className={`header-search-input ${hasValue ? "has-value" : ""} ${showSpinner ? "is-searching" : ""}`}
          placeholder={`Search...`}
          value={currentValue}
          onChange={(e) => handleSearchChange(column.field, e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, column.field)}
          title={`Search ${column.headerName}`}
        />
        {showSpinner ? (
          <SearchSpinner />
        ) : hasValue ? (
          <button
            className="header-search-clear"
            onClick={() => handleClearSearch(column.field)}
            title="Clear search"
            type="button"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <tr className="header-search-row">
      {/* Checkbox column placeholder */}
      {showCheckboxes && (
        <th
          className="header-search-cell header-search-checkbox"
          style={{
            width: "50px",
            padding: "4px",
            backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
            borderBottom: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e2e8f0'}`,
            position: "sticky",
            left: 0,
            zIndex: 5,
          }}
        />
      )}

      {visibleColumns.map((column) => {
        const hasValue = !!localSearchValues[column.field];
        const isPending = pendingFields.has(column.field);
        const showSpinner = isPending && isSearching;

        return (
          <th
            key={`search-${column.field}`}
            className="header-search-cell"
            style={{
              width: column.width || 95,
              padding: "4px 6px",
              backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
              borderBottom: `1px solid ${document.documentElement.classList.contains('dark') ? '#374151' : '#e2e8f0'}`,
              borderRight: 'none',
            }}
          >
            {column.filterable ? (
              renderFilterInput(column, hasValue, showSpinner)
            ) : (
              <div className="header-search-disabled" />
            )}
          </th>
        );
      })}
    </tr>
  );
};
