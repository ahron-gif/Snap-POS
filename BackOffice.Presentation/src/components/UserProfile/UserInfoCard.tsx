import React, { useEffect, useState } from "react"
import { useModal } from "../../hooks/useModal"
import { Modal } from "../ui/modal"
import Button from "../ui/button/Button"
import Input from "../form/input/InputField"
import Label from "../form/Label"
import ProfileActionButton from "./ProfileActionButton"
import { profileService, type MyProfile } from "../../services/profileService"

interface UserInfoCardProps {
  userName?: string
  email?: string
  phone?: string
  /** When false the card is a read-only view (no editing). */
  editable?: boolean
  /** Called with the server's fresh profile after a successful save. */
  onSaved?: (updated: MyProfile) => void
}

type Toast = { type: "success" | "error"; message: string } | null

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function UserInfoCard({
  userName,
  email,
  phone,
  editable = false,
  onSaved,
}: UserInfoCardProps) {
  const { isOpen, openModal, closeModal } = useModal()

  const [formEmail, setFormEmail] = useState(email || "")
  const [formPhone, setFormPhone] = useState(phone || "")
  const [emailError, setEmailError] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<Toast>(null)

  // Keep the form in sync when the underlying profile changes (e.g. after a
  // context refresh) — but only while the modal is closed, so we never stomp
  // on what the user is typing.
  useEffect(() => {
    if (!isOpen) {
      setFormEmail(email || "")
      setFormPhone(phone || "")
    }
  }, [email, phone, isOpen])

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message })
    window.setTimeout(() => setToast(null), 3500)
  }

  const handleOpen = () => {
    setFormEmail(email || "")
    setFormPhone(phone || "")
    setEmailError("")
    openModal()
  }

  const handleClose = () => {
    setEmailError("")
    closeModal()
  }

  const handleEmailChange = (v: string) => {
    setFormEmail(v)
    // Clear the error as soon as the user edits the email.
    if (emailError) setEmailError("")
  }

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setEmailError("")

    const trimmedEmail = formEmail.trim()
    const trimmedPhone = formPhone.trim()

    // Validate email only if it changed (error shows under the Email field).
    const emailChanged = trimmedEmail !== (email || "").trim()
    if (emailChanged) {
      if (!trimmedEmail) {
        setEmailError("Email cannot be empty.")
        return
      }
      if (!EMAIL_RE.test(trimmedEmail)) {
        setEmailError("Please enter a valid email address.")
        return
      }
    }

    const phoneChanged = trimmedPhone !== (phone || "").trim()

    if (!emailChanged && !phoneChanged) {
      showToast("success", "No changes to save.")
      closeModal()
      return
    }

    setSaving(true)
    try {
      const result = await profileService.updateMyProfile({
        email: emailChanged ? trimmedEmail : undefined,
        phone: phoneChanged ? trimmedPhone : undefined,
      })

      if (result.success && result.data) {
        onSaved?.(result.data)
        showToast("success", "Profile updated successfully.")
        closeModal()
      } else {
        // Email problems (e.g. already in use) show under the Email field;
        // anything else surfaces as a toast.
        const fieldErrors = (result.errors ?? {}) as Record<string, string[]>
        const emailMsg =
          Object.entries(fieldErrors).find(([k]) => k.toLowerCase() === "email")?.[1]?.[0]
        if (emailMsg || (result.message || "").toLowerCase().includes("email")) {
          setEmailError(emailMsg || result.message)
        } else {
          showToast("error", result.message || "Failed to update profile.")
        }
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

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">
            Personal Information
          </h4>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">User Name</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">{userName || "N/A"}</p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">Email address</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">{email || "N/A"}</p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">Phone</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">{phone || "N/A"}</p>
            </div>
          </div>
        </div>

        {editable && (
          <ProfileActionButton
            onClick={handleOpen}
            className="w-full lg:w-auto"
            icon={
              <svg className="fill-current" width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206ZM12.9698 3.84272C13.2627 3.54982 13.7376 3.54982 14.0305 3.84272L14.6934 4.50563C14.9863 4.79852 14.9863 5.2734 14.6934 5.56629L14.044 6.21573L12.3204 4.49215L12.9698 3.84272ZM11.2597 5.55281L5.6359 11.1766C5.53309 11.2794 5.46238 11.4099 5.43238 11.5522L5.01758 13.5185L6.98394 13.1037C7.1262 13.0737 7.25666 13.003 7.35947 12.9002L12.9833 7.27639L11.2597 5.55281Z"
                  fill=""
                />
              </svg>
            }
          >
            Edit
          </ProfileActionButton>
        )}
      </div>

      <Modal isOpen={isOpen} onClose={handleClose} className="max-w-[560px] m-4">
        <div className="no-scrollbar relative w-full overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-8">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Edit Personal Information
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Update your email or phone. Your username can't be changed.
            </p>
          </div>
          <form className="flex flex-col" onSubmit={handleSave}>
            <div className="px-2">
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                <div className="col-span-2 lg:col-span-1">
                  <Label>User Name</Label>
                  <Input
                    type="text"
                    value={userName || ""}
                    disabled
                    className="bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                    placeholder="Username (Read-only)"
                  />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    value={formEmail}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="Enter email address"
                    error={!!emailError}
                  />
                  {emailError && (
                    <p className="mt-1.5 text-xs text-error-500">{emailError}</p>
                  )}
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label>Phone</Label>
                  <Input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" type="button" variant="outline" onClick={handleClose} disabled={saving}>
                Close
              </Button>
              <Button size="sm" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  )
}
