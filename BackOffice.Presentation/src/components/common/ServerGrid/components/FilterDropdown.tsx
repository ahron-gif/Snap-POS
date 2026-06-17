import React, { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import {
  FilterConfig,
  FilterLogic,
} from "../types/grid"

type FilterOperator = 
  | 'equals' 
  | 'notEquals' 
  | 'contains' 
  | 'notContains' 
  | 'like' 
  | 'notLike' 
  | 'startsWith' 
  | 'endsWith' 
  | 'greaterThan' 
  | 'greaterThanOrEqual' 
  | 'lessThan' 
  | 'lessThanOrEqual' 
  | 'between' 
  | 'blank' 
  | 'notBlank'

interface FilterCondition {
  id: string;
  value: string;
  operator: FilterOperator | string;
}

interface FilterDropdownProps {
  field: string
  column: { field: string; dataType?: string }
  filterConfig: FilterConfig
  onFilterChange: (
    field: string,
    conditions: FilterCondition[],
    logic: FilterLogic
  ) => void
  onClose: () => void
  position?: { x: number; y: number } | null
}

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  field,
  column,
  filterConfig,
  onFilterChange,
  onClose,
  position,
}) => {
  const currentFilter = filterConfig[field]
  const defaultOperator = column.dataType === "number" ? "equals" : "contains"
  const dropdownRef = useRef<HTMLDivElement>(null)

  const getFilterOperators = (
    dataType: string = "string"
  ): { value: FilterOperator; label: string }[] => {
    if (dataType === "number") {
      return [
        { value: "equals", label: "Equals" },
        { value: "notEquals", label: "Does not equal" },
        { value: "greaterThan", label: "Greater than" },
        { value: "greaterThanOrEqual", label: "Greater than or equal to" },
        { value: "lessThan", label: "Less than" },
        { value: "lessThanOrEqual", label: "Less than or equal to" },
        { value: "between", label: "Between" },
        { value: "blank", label: "Blank" },
        { value: "notBlank", label: "Not blank" },
      ]
    }

    if (dataType === "date" || dataType === "time" || dataType === "datetime") {
      return [
        { value: "equals", label: "Equals" },
        { value: "notEquals", label: "Does not equal" },
        { value: "greaterThan", label: "After" },
        { value: "greaterThanOrEqual", label: "On or after" },
        { value: "lessThan", label: "Before" },
        { value: "lessThanOrEqual", label: "On or before" },
        { value: "between", label: "Between" },
        { value: "blank", label: "Blank" },
        { value: "notBlank", label: "Not blank" },
      ]
    }

    // Default string operators
    return [
      { value: "contains", label: "Contains" },
      { value: "notContains", label: "Not Contains" },
      { value: "like", label: "Like" },
      { value: "notLike", label: "Not Like" },
      { value: "equals", label: "Equals" },
      { value: "notEquals", label: "Not Equals" },
      { value: "startsWith", label: "Starts With" },
      { value: "endsWith", label: "Ends With" },
      { value: "blank", label: "Blank" },
      { value: "notBlank", label: "Not blank" },
    ]
  }

  const filterOperators = getFilterOperators(column.dataType)
  const [conditions, setConditions] = useState<FilterCondition[]>(
    currentFilter?.conditions && currentFilter.conditions.length > 0 
      ? currentFilter.conditions 
      : [{ id: Date.now().toString(), value: "", operator: defaultOperator }]
  )
  const [logic, setLogic] = useState<FilterLogic>(currentFilter?.logic || "AND")

  // Update local state when currentFilter changes (e.g., when loaded from URL)
  useEffect(() => {
    if (currentFilter?.conditions && currentFilter.conditions.length > 0) {
      setConditions(currentFilter.conditions)
      setLogic(currentFilter.logic || "AND")
    }
  }, [currentFilter])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onClose])

  const addCondition = () => {
    const newCondition: FilterCondition = {
      id: Date.now().toString(),
      value: "",
      operator: defaultOperator,
    }
    setConditions([...conditions, newCondition])
  }

  const removeCondition = (id: string) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((c) => c.id !== id))
    }
  }

  const updateCondition = (
    id: string,
    field: keyof FilterCondition,
    value: any
  ) => {
    setConditions(
      conditions.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    )
  }

  const handleApply = () => {
    const validConditions = conditions.filter((c) => {
      // For blank/notBlank operators, we don't need a value
      if (c.operator === 'blank' || c.operator === 'notBlank') {
        return true
      }
      return c.value && c.value.trim() !== ""
    })
    onFilterChange(field, validConditions, logic)
    // Keep the dropdown open to retain the filter settings
    // onClose() - commented out to retain filters
  }

  const handleClear = () => {
    const clearedConditions = [{ id: Date.now().toString(), value: "", operator: defaultOperator }]
    setConditions(clearedConditions)
    onFilterChange(field, [], logic)
    // Keep the dropdown open after clearing
    // onClose() - commented out to retain filter dropdown
  }

  const hasMultipleConditions = conditions.length > 1

  const dropdownContent = (
    <div
      ref={dropdownRef}
      className="filter-dropdown-portal"
      style={{
        position: "fixed",
        left: position ? position.x - 250 : 0,
        top: position ? position.y : 0,
        zIndex: 1002,
      }}
    >
      <div className="filter-dropdown-header">
        <span className="filter-dropdown-title">Filter Options</span>
        <button className="filter-close-button" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="filter-dropdown-content">
        {hasMultipleConditions && (
          <div className="filter-logic-section">
            <label>Logic:</label>
            <select
              value={logic}
              onChange={(e) => setLogic(e.target.value as FilterLogic)}
              className="filter-logic-select"
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
            </select>
          </div>
        )}

        <div className="filter-conditions">
          {conditions.map((condition, index) => (
            <div key={condition.id} className="filter-condition">
              {index > 0 && hasMultipleConditions && (
                <div className="filter-logic-indicator">
                  <span className="logic-text">{logic}</span>
                </div>
              )}

              <div className="filter-condition-controls">
                <select
                  value={condition.operator}
                  onChange={(e) =>
                    updateCondition(
                      condition.id,
                      "operator",
                      e.target.value as FilterOperator
                    )
                  }
                  className="filter-operator-select"
                >
                  {filterOperators.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                <input
                  type={
                    column.dataType === "date"
                      ? "date"
                      : column.dataType === "time"
                      ? "time"
                      : column.dataType === "datetime"
                      ? "datetime-local"
                      : "text"
                  }
                  value={condition.value}
                  onChange={(e) =>
                    updateCondition(condition.id, "value", e.target.value)
                  }
                  placeholder={
                    column.dataType === "date"
                      ? "Select date..."
                      : column.dataType === "time"
                      ? "Select time..."
                      : column.dataType === "datetime"
                      ? "Select date and time..."
                      : "Enter filter value..."
                  }
                  className="filter-value-input"
                />

                <button
                  className="remove-condition-button"
                  onClick={() => removeCondition(condition.id)}
                  title="Remove condition"
                  disabled={conditions.length === 1}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="filter-add-condition">
          <button className="add-condition-button" onClick={addCondition}>
            + Add Condition
          </button>
        </div>

        <div className="filter-actions">
          <button className="filter-button apply" onClick={handleApply}>
            Apply
          </button>
          <button className="filter-button clear" onClick={handleClear}>
            Clear
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(dropdownContent, document.body)
}