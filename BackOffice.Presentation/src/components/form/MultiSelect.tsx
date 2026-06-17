import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { createPortal } from "react-dom"

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value?: string[]
  placeholder?: string
  onChange?: (selected: string[]) => void
  disabled?: boolean
  loading?: boolean
  maxDisplayItems?: number
  searchFn?: (option: MultiSelectOption, searchTerm: string) => boolean
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  value = [],
  placeholder = "Select options",
  onChange,
  disabled = false,
  loading = false,
  maxDisplayItems = 100,
  searchFn,
}) => {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(value)
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Sync with external value changes
  useEffect(() => {
    setSelectedOptions(value)
  }, [value])

  // Default search function
  const defaultSearchFn = useCallback(
    (option: MultiSelectOption, term: string): boolean => {
      return option.label.toLowerCase().includes(term.toLowerCase())
    },
    []
  )

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options.slice(0, maxDisplayItems)

    const searchFunction = searchFn || defaultSearchFn
    const filtered = options.filter((option) => searchFunction(option, searchTerm))
    return filtered.slice(0, maxDisplayItems)
  }, [options, searchTerm, searchFn, defaultSearchFn, maxDisplayItems])

  // Get selected options labels
  const selectedLabels = useMemo(() => {
    return selectedOptions.map(
      (val) => options.find((opt) => opt.value === val)?.label || val
    )
  }, [selectedOptions, options])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false)
        setSearchTerm("")
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const calculatePosition = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const dropdownHeight = dropdownRef.current?.offsetHeight || 280
    const spaceBelow = window.innerHeight - rect.bottom
    const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight

    setDropdownPosition({
      top: openUpward ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }, [])

  useEffect(() => {
    if (isOpen) {
      calculatePosition()
      requestAnimationFrame(calculatePosition)
    }
  }, [isOpen, calculatePosition])

  useEffect(() => {
    if (!isOpen) return

    window.addEventListener("scroll", calculatePosition, true)
    window.addEventListener("resize", calculatePosition)
    return () => {
      window.removeEventListener("scroll", calculatePosition, true)
      window.removeEventListener("resize", calculatePosition)
    }
  }, [isOpen, calculatePosition])

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest" })
      }
    }
  }, [highlightedIndex])

  // Reset highlighted index when filtered options change
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [filteredOptions])

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen((prev) => !prev)
      if (!isOpen) {
        setSearchTerm("")
        setHighlightedIndex(-1)
      }
    }
  }

  const handleSelect = (optionValue: string) => {
    const newSelectedOptions = selectedOptions.includes(optionValue)
      ? selectedOptions.filter((val) => val !== optionValue)
      : [...selectedOptions, optionValue]

    setSelectedOptions(newSelectedOptions)
    onChange?.(newSelectedOptions)
  }

  const removeOption = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newSelectedOptions = selectedOptions.filter((val) => val !== optionValue)
    setSelectedOptions(newSelectedOptions)
    onChange?.(newSelectedOptions)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
        } else {
          setHighlightedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          )
        }
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        break
      case "Enter":
        e.preventDefault()
        if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value)
        } else if (!isOpen) {
          setIsOpen(true)
        }
        break
      case "Escape":
        e.preventDefault()
        setIsOpen(false)
        setSearchTerm("")
        break
      case "Tab":
        setIsOpen(false)
        setSearchTerm("")
        break
      case "Backspace":
        if (!searchTerm && selectedOptions.length > 0) {
          const newSelected = selectedOptions.slice(0, -1)
          setSelectedOptions(newSelected)
          onChange?.(newSelected)
        }
        break
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <div
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        className={`flex items-center min-h-[44px] w-full rounded-lg border px-3 py-2 text-sm shadow-theme-xs cursor-pointer transition-colors
          ${disabled
            ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-60"
            : "bg-transparent hover:border-gray-400 dark:hover:border-gray-600"
          }
          ${isOpen
            ? "border-brand-300 ring-3 ring-brand-500/10 dark:border-brand-800"
            : "border-gray-300 dark:border-gray-700"
          }
          dark:bg-gray-900
        `}
      >
        <div className="flex flex-wrap flex-1 gap-1.5">
          {selectedLabels.length > 0 ? (
            selectedLabels.map((label, index) => (
              <span
                key={selectedOptions[index]}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-md"
              >
                {label}
                <button
                  type="button"
                  onClick={(e) => removeOption(selectedOptions[index], e)}
                  className="p-0.5 hover:bg-brand-100 dark:hover:bg-brand-800/50 rounded transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))
          ) : (
            <span className="text-gray-400 dark:text-gray-400">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-2 ml-2">
          {loading && (
            <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {selectedOptions.length > 0 && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedOptions([])
                onChange?.([])
              }}
              className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Dropdown - rendered via portal to escape overflow containers */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[999999] bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
          }}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                className="w-full h-9 pl-9 pr-3 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:border-brand-300 focus:ring-1 focus:ring-brand-500/20 dark:focus:border-brand-800 dark:text-white placeholder:text-gray-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div ref={listRef} className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <svg className="animate-spin h-5 w-5 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                {searchTerm ? "No results found" : "No options available"}
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = selectedOptions.includes(option.value)
                return (
                  <div
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={`px-4 py-2.5 text-sm cursor-pointer transition-colors
                      ${isSelected
                        ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                        : "text-gray-700 dark:text-gray-300"
                      }
                      ${highlightedIndex === index
                        ? "bg-gray-100 dark:bg-gray-800"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors
                          ${isSelected
                            ? "bg-brand-500 border-brand-500"
                            : "border-gray-300 dark:border-gray-600"
                          }
                        `}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span>{option.label}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            {filteredOptions.length >= maxDisplayItems && (
              <div className="px-4 py-2 text-xs text-center text-gray-400 border-t border-gray-100 dark:border-gray-800">
                Showing first {maxDisplayItems} results. Type to search for more.
              </div>
            )}
          </div>

          {/* Selected count footer */}
          {selectedOptions.length > 0 && (
            <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              {selectedOptions.length} selected
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

export default MultiSelect
