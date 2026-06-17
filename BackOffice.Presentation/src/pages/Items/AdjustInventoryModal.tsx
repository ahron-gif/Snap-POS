import React, { useState, useEffect, useCallback, useRef } from "react"
import { useAuthHeaders } from "../../hooks/useAuthHeaders"
import { API_ENDPOINTS } from "../../constants/api"
import axios from "axios"
import { focusFirstInvalid } from "../../hooks/useFocusFirstInvalid"

interface AdjustInventoryModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  item: {
    itemStoreID: string
    name: string
    barcodeNumber: string
    onHand: number
    cost: number
  } | null
}

const ACCOUNT_TYPES = [
  { value: 1, label: "General" },
]

const AdjustInventoryModal: React.FC<AdjustInventoryModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  item,
}) => {
  const { getAuthHeaders } = useAuthHeaders()

  const [newQty, setNewQty] = useState<string>("")
  const newQtyRef = useRef<HTMLInputElement | null>(null)
  const [adjustType, setAdjustType] = useState<number>(0)
  const [accountNo, setAccountNo] = useState<number>(1)
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adjustTypes, setAdjustTypes] = useState<{ value: number; label: string }[]>([])
  const [loadingTypes, setLoadingTypes] = useState(true)

  // Fetch adjust types from API
  useEffect(() => {
    let cancelled = false
    const fetchAdjustTypes = async () => {
      try {
        setLoadingTypes(true)
        const headers = await getAuthHeaders()
        const response = await axios.get(API_ENDPOINTS.SYSTEM_LOOKUPS.GET_ADJUST_TYPES, { headers })
        if (!cancelled && response.data?.isSuccess) {
          setAdjustTypes(response.data.response || [])
        }
      } catch {
        setAdjustTypes([])
      } finally {
        if (!cancelled) setLoadingTypes(false)
      }
    }
    fetchAdjustTypes()
    return () => { cancelled = true }
  }, [getAuthHeaders])

  // Reset form when the modal opens for a new item. Depending on `item?.itemStoreID`
  // (not the object reference) keeps the form intact when the parent re-renders and
  // hands us a freshly-built `item` literal with the same id.
  useEffect(() => {
    if (isOpen && item) {
      setNewQty("")
      setAccountNo(1)
      setReason("")
      setError(null)
    }
  }, [isOpen, item?.itemStoreID])

  // Seed the default adjust type once the lookup list arrives.
  useEffect(() => {
    if (isOpen && adjustTypes.length > 0) {
      setAdjustType((prev) => (prev === 0 ? adjustTypes[0].value : prev))
    }
  }, [isOpen, adjustTypes])

  const difference = newQty !== "" && !isNaN(Number(newQty))
    ? Number(newQty) - (item?.onHand ?? 0)
    : null

  const handleSave = useCallback(async () => {
    if (!item) return

    const ok = focusFirstInvalid([
      { ref: newQtyRef, isValid: newQty !== "" && !isNaN(Number(newQty)) },
    ])
    if (!ok) {
      setError("Please enter a valid New Qty")
      return
    }

    const diff = Number(newQty) - item.onHand
    if (diff === 0) {
      setError("New Qty is the same as On Hand. No adjustment needed.")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const headers = getAuthHeaders()
      const response = await fetch(API_ENDPOINTS.ADJUST_INVENTORY.SAVE_ADJUSTMENTS, {
        method: "POST",
        headers,
        body: JSON.stringify({
          adjustments: [
            {
              itemStoreNo: item.itemStoreID,
              qty: Number(newQty) - item.onHand,
              oldQty: item.onHand,
              adjustType: adjustType,
              adjustReason: reason || null,
              accountNo: accountNo,
              cost: item.cost ?? 0,
            },
          ],
          updateOnHand: true,
        }),
      })

      const result = await response.json()

      if (result.isSuccess) {
        onSaved()
      } else {
        setError(result.message || "Failed to save adjustment")
      }
    } catch {
      setError("Error saving adjustment")
    } finally {
      setSaving(false)
    }
  }, [item, newQty, adjustType, accountNo, reason, getAuthHeaders, onSaved])

  const handleCancel = () => {
    setError(null)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSave()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  if (!isOpen || !item) return null

  const isDark = document.documentElement.classList.contains("dark")

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          backgroundColor: isDark ? "rgba(0,0,0,0.5)" : undefined,
        }}
        onClick={handleCancel}
      />

      {/* Modal Content */}
      <div
        style={{
          position: "relative",
          backgroundColor: isDark ? "#1f2937" : "white",
          borderRadius: "8px",
          boxShadow: isDark
            ? "0 8px 32px rgba(0, 0, 0, 0.5)"
            : "0 8px 32px rgba(0, 0, 0, 0.2)",
          width: "450px",
          maxWidth: "90vw",
          border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px 16px",
            borderBottom: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
            backgroundColor: isDark ? "#111827" : "#f9fafb",
            borderRadius: "8px 8px 0 0",
          }}
        >
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: isDark ? "#e5e7eb" : "#111827", margin: 0 }}>
            Adjust Inventory
          </h2>
        </div>

        {/* Body */}
        <div style={{ padding: "16px" }} onKeyDown={handleKeyDown}>
          {/* Name Field - Read Only */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "10px", gap: "12px" }}>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: isDark ? "#d1d5db" : "#374151",
                minWidth: "90px",
                textAlign: "right",
              }}
            >
              Name:
            </label>
            <input
              type="text"
              value={item.name || ""}
              readOnly
              style={{
                flex: 1,
                padding: "6px 10px",
                border: `1px solid ${isDark ? "#4b5563" : "#d1d5db"}`,
                borderRadius: "4px",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
                backgroundColor: isDark ? "#111827" : "#f3f4f6",
                color: isDark ? "#9ca3af" : "#374151",
              }}
            />
          </div>

          {/* UPC Code Field - Read Only */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "10px", gap: "12px" }}>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: isDark ? "#d1d5db" : "#374151",
                minWidth: "90px",
                textAlign: "right",
              }}
            >
              UPC Code:
            </label>
            <input
              type="text"
              value={item.barcodeNumber || ""}
              readOnly
              style={{
                flex: 1,
                padding: "6px 10px",
                border: `1px solid ${isDark ? "#4b5563" : "#d1d5db"}`,
                borderRadius: "4px",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
                backgroundColor: isDark ? "#111827" : "#f3f4f6",
                color: isDark ? "#9ca3af" : "#374151",
              }}
            />
          </div>

          {/* On Hand Field - Read Only */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "10px", gap: "12px" }}>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: isDark ? "#d1d5db" : "#374151",
                minWidth: "90px",
                textAlign: "right",
              }}
            >
              On Hand:
            </label>
            <input
              type="text"
              value={item.onHand ?? 0}
              readOnly
              style={{
                flex: 1,
                padding: "6px 10px",
                border: `1px solid ${isDark ? "#4b5563" : "#d1d5db"}`,
                borderRadius: "4px",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
                backgroundColor: isDark ? "#111827" : "#f3f4f6",
                color: isDark ? "#9ca3af" : "#374151",
              }}
            />
          </div>

          {/* New Qty Field - Editable */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "10px", gap: "12px" }}>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: isDark ? "#d1d5db" : "#374151",
                minWidth: "90px",
                textAlign: "right",
              }}
            >
              New Qty:
            </label>
            <input
              ref={newQtyRef}
              type="number"
              value={newQty}
              onChange={(e) => {
                setNewQty(e.target.value)
                setError(null)
              }}
              autoFocus
              style={{
                flex: 1,
                padding: "6px 10px",
                border: `1px solid ${isDark ? "#4b5563" : "#d1d5db"}`,
                borderRadius: "4px",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
                backgroundColor: isDark ? "#1a2332" : "#fffef0",
                color: isDark ? "#e5e7eb" : undefined,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#1e40af"
                e.target.select()
              }}
              onBlur={(e) => (e.target.style.borderColor = isDark ? "#4b5563" : "#d1d5db")}
            />
          </div>

          {/* Difference Field - Calculated */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "10px", gap: "12px" }}>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: isDark ? "#d1d5db" : "#374151",
                minWidth: "90px",
                textAlign: "right",
              }}
            >
              Difference:
            </label>
            <input
              type="text"
              value={difference !== null ? difference : ""}
              readOnly
              style={{
                flex: 1,
                padding: "6px 10px",
                border: `1px solid ${isDark ? "#4b5563" : "#d1d5db"}`,
                borderRadius: "4px",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
                backgroundColor: isDark ? "#111827" : "#f3f4f6",
                color: difference !== null && difference !== 0
                  ? (difference > 0 ? "#16a34a" : "#dc2626")
                  : isDark ? "#9ca3af" : "#374151",
                fontWeight: difference !== null && difference !== 0 ? 600 : 400,
              }}
            />
          </div>

          {/* Type Dropdown */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "10px", gap: "12px" }}>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: isDark ? "#d1d5db" : "#374151",
                minWidth: "90px",
                textAlign: "right",
              }}
            >
              Type:
            </label>
            <select
              value={adjustType}
              onChange={(e) => setAdjustType(Number(e.target.value))}
              style={{
                flex: 1,
                padding: "6px 10px",
                border: `1px solid ${isDark ? "#4b5563" : "#d1d5db"}`,
                borderRadius: "4px",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
                backgroundColor: isDark ? "#111827" : "white",
                color: isDark ? "#e5e7eb" : undefined,
                cursor: "pointer",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#1e40af")}
              onBlur={(e) => (e.target.style.borderColor = isDark ? "#4b5563" : "#d1d5db")}
            >
              {adjustTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Account Dropdown */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "10px", gap: "12px" }}>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: isDark ? "#d1d5db" : "#374151",
                minWidth: "90px",
                textAlign: "right",
              }}
            >
              Account:
            </label>
            <select
              value={accountNo}
              onChange={(e) => setAccountNo(Number(e.target.value))}
              style={{
                flex: 1,
                padding: "6px 10px",
                border: `1px solid ${isDark ? "#4b5563" : "#d1d5db"}`,
                borderRadius: "4px",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
                backgroundColor: isDark ? "#111827" : "white",
                color: isDark ? "#e5e7eb" : undefined,
                cursor: "pointer",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#1e40af")}
              onBlur={(e) => (e.target.style.borderColor = isDark ? "#4b5563" : "#d1d5db")}
            >
              {ACCOUNT_TYPES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reason Field */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: "16px", gap: "12px" }}>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: isDark ? "#d1d5db" : "#374151",
                minWidth: "90px",
                textAlign: "right",
              }}
            >
              Reason:
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                flex: 1,
                padding: "6px 10px",
                border: `1px solid ${isDark ? "#4b5563" : "#d1d5db"}`,
                borderRadius: "4px",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
                backgroundColor: isDark ? "#1f2937" : undefined,
                color: isDark ? "#e5e7eb" : undefined,
              }}
              onFocus={(e) => (e.target.style.borderColor = "#1e40af")}
              onBlur={(e) => (e.target.style.borderColor = isDark ? "#4b5563" : "#d1d5db")}
            />
          </div>

          {/* Error message */}
          {error && (
            <p style={{ color: "#ef4444", fontSize: "12px", margin: "0 0 12px 0", textAlign: "center" }}>
              {error}
            </p>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "6px 32px",
                backgroundColor: isDark ? "#374151" : "#f9fafb",
                border: `1px solid ${isDark ? "#4b5563" : "#d1d5db"}`,
                borderRadius: "4px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: saving ? "not-allowed" : "pointer",
                color: isDark ? "#d1d5db" : "#374151",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Ok"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              style={{
                padding: "6px 32px",
                backgroundColor: isDark ? "#374151" : "#f9fafb",
                border: `1px solid ${isDark ? "#4b5563" : "#d1d5db"}`,
                borderRadius: "4px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                color: isDark ? "#d1d5db" : "#374151",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdjustInventoryModal
