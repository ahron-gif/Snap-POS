import React, { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"

export interface SelectOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  options: SelectOption[]
  value?: string
  placeholder?: string
  onChange: (value: string) => void
  className?: string
  /** Extra classes for the trigger button (e.g. a height override like "min-h-[44px]"). */
  triggerClassName?: string
  disabled?: boolean
  loading?: boolean
  // For virtualization - only render visible items
  maxDisplayItems?: number
  // Allow custom search function
  searchFn?: (option: SelectOption, searchTerm: string) => boolean
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value = "",
  placeholder = "Select an option",
  onChange,
  className = "",
  triggerClassName = "",
  disabled = false,
  loading = false,
  maxDisplayItems = 50,
  searchFn,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const [displayCount, setDisplayCount] = useState(maxDisplayItems)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Find selected option label
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  )

  // Default search function - case insensitive search on label
  const defaultSearchFn = useCallback(
    (option: SelectOption, term: string): boolean => {
      return option.label.toLowerCase().includes(term.toLowerCase())
    },
    []
  )

  // Get all filtered options (without limit)
  const allFilteredOptions = useMemo(() => {
    if (!searchTerm) return options

    const searchFunction = searchFn || defaultSearchFn
    return options.filter((option) => searchFunction(option, searchTerm))
  }, [options, searchTerm, searchFn, defaultSearchFn])

  // Display only up to displayCount items
  const filteredOptions = useMemo(() => {
    return allFilteredOptions.slice(0, displayCount)
  }, [allFilteredOptions, displayCount])

  // Check if there are more items to load
  const hasMoreItems = allFilteredOptions.length > displayCount

  // Reset display count when search term changes or dropdown opens
  useEffect(() => {
    setDisplayCount(maxDisplayItems)
  }, [searchTerm, isOpen, maxDisplayItems])

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

  // Handle scroll to load more items
  const handleScroll = useCallback(() => {
    if (!listRef.current || !hasMoreItems) return

    const { scrollTop, scrollHeight, clientHeight } = listRef.current
    // Load more when scrolled within 50px of the bottom
    if (scrollHeight - scrollTop - clientHeight < 50) {
      setDisplayCount(prev => prev + maxDisplayItems)
    }
  }, [hasMoreItems, maxDisplayItems])

  // Attach scroll listener to list
  useEffect(() => {
    const listElement = listRef.current
    if (listElement && isOpen) {
      listElement.addEventListener("scroll", handleScroll)
      return () => listElement.removeEventListener("scroll", handleScroll)
    }
  }, [isOpen, handleScroll])

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen((prev) => !prev)
      if (!isOpen) {
        setSearchTerm("")
        setHighlightedIndex(-1)
      }
    }
  }

  const handleSelect = (option: SelectOption) => {
    onChange(option.value)
    setIsOpen(false)
    setSearchTerm("")
    setHighlightedIndex(-1)
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
          handleSelect(filteredOptions[highlightedIndex])
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
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <div
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        className={`flex items-center justify-between h-9 w-full rounded-lg border px-3 py-1.5 text-sm shadow-theme-xs cursor-pointer transition-colors
          ${disabled
            ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-60"
            : "bg-transparent hover:border-gray-400 dark:hover:border-gray-600"
          }
          ${isOpen
            ? "border-brand-300 ring-3 ring-brand-500/10 dark:border-brand-800"
            : "border-gray-300 dark:border-gray-700"
          }
          dark:bg-gray-900 dark:text-white/90
          ${triggerClassName}
        `}
      >
        <span className={selectedOption ? "text-gray-800 dark:text-white/90" : "text-gray-400 dark:text-gray-400"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-2">
          {loading && (
            <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {value && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange("")
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
              filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option)}
                  className={`px-4 py-2.5 text-sm cursor-pointer transition-colors
                    ${option.value === value
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
                    <span>{option.label}</span>
                    {option.value === value && (
                      <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              ))
            )}
            {hasMoreItems && (
              <div className="px-4 py-2 text-xs text-center text-gray-400 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Scroll for more...</span>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default SearchableSelect
