import { useState } from "react"
import { useModal } from "../../hooks/useModal"
import { Modal } from "../ui/modal"
import Button from "../ui/button/Button"
import Input from "../form/input/InputField"
import Label from "../form/Label"
import ProfileActionButton from "./ProfileActionButton"
import { profileService } from "../../services/profileService"

type Toast = { type: "success" | "error"; message: string } | null

const EyeIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7}
      d="M2.036 12.322a1 1 0 010-.644C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.01 9.964 7.178a1 1 0 010 .644C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.01-9.964-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const EyeOffIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7}
      d="M3.98 8.223A10.477 10.477 0 002.036 11.68a1 1 0 000 .644C3.423 16.49 7.36 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.638 0 8.573 3.01 9.964 7.178a1 1 0 010 .644 10.45 10.45 0 01-1.838 3.07M6.228 6.228L3 3m3.228 3.228l11.544 11.544M21 21l-3.228-3.228m0 0a3 3 0 00-4.243-4.243" />
  </svg>
)

/** Password input with a show/hide eye toggle and an optional inline error below it. */
function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  error?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          error={!!error}
          className="pr-10"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-error-500">{error}</p>}
    </div>
  )
}

/**
 * Dedicated password-change card. Separate from the contact-info edit and
 * requires the current password before accepting a new one (verified server-side).
 * New/confirm matching is validated live as you type — not only on submit.
 */
export default function ChangePasswordCard() {
  const { isOpen, openModal, closeModal } = useModal()

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [currentError, setCurrentError] = useState("")
  const [newError, setNewError] = useState("")
  const [confirmError, setConfirmError] = useState("")

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<Toast>(null)

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message })
    window.setTimeout(() => setToast(null), 3500)
  }

  // ── Live validators (run on every keystroke) ───────────────────────
  const evalNew = (np: string, cp: string): string => {
    if (np.length === 0) return ""
    if (np.length < 6) return "New password must be at least 6 characters long."
    if (cp.length > 0 && np === cp) return "New password must be different from the current password."
    return ""
  }
  const evalConfirm = (np: string, conf: string): string => {
    if (conf.length === 0) return ""
    if (np !== conf) return "Passwords do not match."
    return ""
  }

  const onCurrentChange = (v: string) => {
    setCurrentPassword(v)
    setCurrentError("")
    setNewError(evalNew(newPassword, v))
  }
  const onNewChange = (v: string) => {
    setNewPassword(v)
    setNewError(evalNew(v, currentPassword))
    setConfirmError(evalConfirm(v, confirmPassword))
  }
  const onConfirmChange = (v: string) => {
    setConfirmPassword(v)
    setConfirmError(evalConfirm(newPassword, v))
  }

  const reset = () => {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setCurrentError("")
    setNewError("")
    setConfirmError("")
  }

  const handleOpen = () => {
    reset()
    openModal()
  }

  const handleClose = () => {
    reset()
    closeModal()
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    // Required + final validation (errors land under their own field).
    let bad = false
    if (!currentPassword) {
      setCurrentError("Please enter your current password.")
      bad = true
    }
    const nErr = !newPassword ? "Please enter a new password." : evalNew(newPassword, currentPassword)
    if (nErr) {
      setNewError(nErr)
      bad = true
    }
    const cErr = !confirmPassword ? "Please confirm your new password." : evalConfirm(newPassword, confirmPassword)
    if (cErr) {
      setConfirmError(cErr)
      bad = true
    }
    if (bad) return

    setSaving(true)
    try {
      const result = await profileService.changeMyPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      })
      if (result.success) {
        showToast("success", "Password changed successfully.")
        handleClose()
        return
      }

      // Map server errors back to the right field.
      const fieldErrors = (result.errors ?? {}) as Record<string, string[]>
      const get = (key: string) =>
        Object.entries(fieldErrors).find(([k]) => k.toLowerCase() === key.toLowerCase())?.[1]?.[0]

      const currentMsg = get("CurrentPassword")
      const confirmMsg = get("ConfirmPassword")
      if (currentMsg) setCurrentError(currentMsg)
      if (confirmMsg) setConfirmError(confirmMsg)
      if (!currentMsg && !confirmMsg) {
        // No field mapping — fall back to the message under Current Password
        // (the most common cause) or a toast for anything else.
        if ((result.message || "").toLowerCase().includes("current password"))
          setCurrentError(result.message)
        else showToast("error", result.message || "Failed to change password.")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      {toast && (
        <div className="fixed top-4 right-4 z-[99999] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[320px] max-w-[400px]">
          <div className="p-4 flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center ${
                toast.type === "success" ? "bg-green-100 dark:bg-green-500/10" : "bg-red-100"
              }`}
            >
              {toast.type === "success" ? (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {toast.type === "success" ? "Success" : "Error"}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">{toast.message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-500/10">
            <svg className="h-5 w-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 11c0-1.657-1.343-3-3-3s-3 1.343-3 3m0 0v0M15 11V7a3 3 0 016 0v4M5 11h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2z" />
            </svg>
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">Password</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Change your password. You'll need your current password to confirm.
            </p>
          </div>
        </div>

        <ProfileActionButton
          onClick={handleOpen}
          icon={
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          }
        >
          Change Password
        </ProfileActionButton>
      </div>

      <Modal isOpen={isOpen} onClose={handleClose} className="max-w-[520px] m-4">
        <div className="relative w-full p-4 overflow-y-auto bg-white no-scrollbar rounded-3xl dark:bg-gray-900 lg:p-8">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">Change Password</h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Enter your current password and choose a new one.
            </p>
          </div>
          <form className="flex flex-col" onSubmit={handleSubmit}>
            <div className="px-2 space-y-5">
              <PasswordField
                label="Current Password"
                value={currentPassword}
                onChange={onCurrentChange}
                placeholder="Enter current password"
                error={currentError}
              />
              <PasswordField
                label="New Password"
                value={newPassword}
                onChange={onNewChange}
                placeholder="Enter new password"
                error={newError}
              />
              <PasswordField
                label="Confirm New Password"
                value={confirmPassword}
                onChange={onConfirmChange}
                placeholder="Re-enter new password"
                error={confirmError}
              />
            </div>
            <div className="flex items-center gap-3 px-2 mt-8 lg:justify-end">
              <Button size="sm" type="button" variant="outline" onClick={handleClose} disabled={saving}>
                Close
              </Button>
              <Button size="sm" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Update Password"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  )
}
