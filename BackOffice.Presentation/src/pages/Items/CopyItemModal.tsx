import React, { useState, useEffect, useCallback, useRef } from "react"
import { itemService } from "../../services/itemService"
import { focusFirstInvalid } from "../../hooks/useFocusFirstInvalid"

interface CopyItemModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: CopyItemData) => void
  selectedItem: {
    itemID: string
    name: string
    barcodeNumber: string
    modalNumber?: string | null
  } | null
}

export interface CopyItemData {
  originalItemId: string
  name: string
  barcodeNumber: string
  modelNumber: string
}

const CopyItemModal: React.FC<CopyItemModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedItem,
}) => {
  const [name, setName] = useState("")
  const [barcodeNumber, setBarcodeNumber] = useState("")
  const barcodeRef = useRef<HTMLInputElement | null>(null)
  const [modelNumber, setModelNumber] = useState("")
  const [barcodeError, setBarcodeError] = useState<string | null>(null)
  const [isCheckingBarcode, setIsCheckingBarcode] = useState(false)

  // Generate a new barcode number (auto-incrementing style like the VB.NET version)
  const generateBarcode = useCallback(async () => {
    const timestamp = Date.now().toString()
    const barcode = "2" + timestamp.slice(-9)

    try {
      const result = await itemService.barcodeExists(barcode)
      if (result.success && result.data === true) {
        const altBarcode = "2" + (parseInt(timestamp.slice(-9)) + 1).toString().padStart(9, "0")
        return altBarcode
      }
      return barcode
    } catch {
      return barcode
    }
  }, [])

  // Initialize form when modal opens with selected item data
  useEffect(() => {
    if (isOpen && selectedItem) {
      setName(selectedItem.name || "")
      setModelNumber(selectedItem.modalNumber || "")
      setBarcodeError(null)

      generateBarcode().then((barcode) => {
        setBarcodeNumber(barcode)
      })
    }
  }, [isOpen, selectedItem, generateBarcode])

  const validateBarcode = useCallback(
    async (barcode: string) => {
      if (!barcode.trim()) {
        setBarcodeError("Barcode number is required")
        return false
      }

      setIsCheckingBarcode(true)
      setBarcodeError(null)

      try {
        const result = await itemService.barcodeExists(barcode)
        if (result.success && result.data === true) {
          setBarcodeError("This barcode number already exists")
          setIsCheckingBarcode(false)
          return false
        }
        setIsCheckingBarcode(false)
        return true
      } catch {
        setIsCheckingBarcode(false)
        return true
      }
    },
    []
  )

  const handleBarcodeBlur = () => {
    if (barcodeNumber.trim()) {
      validateBarcode(barcodeNumber)
    }
  }

  const handleAutoGenerate = async () => {
    const barcode = await generateBarcode()
    setBarcodeNumber(barcode)
    setBarcodeError(null)
  }

  const handleOk = async () => {
    // Focus the barcode input when the required check fails — replaces
    // the silent setBarcodeError-only path.
    const ok = focusFirstInvalid([
      { ref: barcodeRef, isValid: !!barcodeNumber.trim() },
    ])
    if (!ok) {
      setBarcodeError("Barcode number is required")
      return
    }

    const isValid = await validateBarcode(barcodeNumber)
    if (!isValid) return

    onConfirm({
      originalItemId: selectedItem?.itemID || "",
      name,
      barcodeNumber,
      modelNumber,
    })
  }

  const handleCancel = () => {
    setBarcodeError(null)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleOk()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  if (!isOpen || !selectedItem) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[99999]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Modal Content */}
      <div
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[440px] max-w-[90vw] ring-1 ring-gray-900/5 dark:ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Copy Item</h2>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4" onKeyDown={handleKeyDown}>
          {/* Name Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-colors"
            />
          </div>

          {/* Barcode Number Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Barcode Number</label>
            <div className="flex gap-2">
              <input
                ref={barcodeRef}
                type="text"
                value={barcodeNumber}
                onChange={(e) => {
                  setBarcodeNumber(e.target.value)
                  setBarcodeError(null)
                }}
                onBlur={handleBarcodeBlur}
                autoFocus
                className={`flex-1 px-3 py-2 text-sm rounded-lg bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white outline-none transition-colors ${
                  barcodeError
                    ? 'border border-red-500 focus:ring-2 focus:ring-red-500/20'
                    : 'border border-amber-200 dark:border-amber-700 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500'
                }`}
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                onClick={handleAutoGenerate}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                title="Auto-generate barcode"
              >
                Auto
              </button>
            </div>
            {barcodeError && (
              <p className="text-xs text-red-500 mt-1">{barcodeError}</p>
            )}
            {isCheckingBarcode && (
              <p className="text-xs text-gray-500 mt-1">Checking barcode...</p>
            )}
          </div>

          {/* Model Number Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Model Number</label>
            <input
              type="text"
              value={modelNumber}
              onChange={(e) => setModelNumber(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-colors"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleOk}
              disabled={isCheckingBarcode}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Copy Item
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CopyItemModal
