import React, { useCallback, useRef, useState } from "react"
import Cropper from "react-easy-crop"
import { useModal } from "../../hooks/useModal"
import { Modal } from "../ui/modal"
import Button from "../ui/button/Button"
import ProfileActionButton from "./ProfileActionButton"
import { profileService } from "../../services/profileService"
import { getCroppedBlob, type PixelCrop } from "../../utils/cropImage"

interface UserMetaCardProps {
  name?: string
  title?: string
  avatarUrl?: string | null
  /** When false the card is a read-only view (no image upload). */
  editable?: boolean
  /** Called after a successful upload (url, key) or removal (null, null). */
  onImageChanged?: (imageUrl: string | null, s3Path: string | null) => void
}

const DEFAULT_AVATAR = "/images/user/owner.jpg"
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

type Toast = { type: "success" | "error"; message: string } | null
type Step = "select" | "crop"

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener("load", () => resolve(reader.result as string))
    reader.addEventListener("error", reject)
    reader.readAsDataURL(file)
  })
}

export default function UserMetaCard({
  name,
  title,
  avatarUrl,
  editable = false,
  onImageChanged,
}: UserMetaCardProps) {
  const { isOpen, openModal, closeModal } = useModal()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>("select")
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null)

  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [toast, setToast] = useState<Toast>(null)

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message })
    window.setTimeout(() => setToast(null), 3500)
  }

  const onCropComplete = useCallback((_area: unknown, areaPixels: PixelCrop) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  const resetEditor = () => {
    setStep("select")
    setImageSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setCroppedAreaPixels(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleOpen = () => {
    resetEditor()
    openModal()
  }

  const handleClose = () => {
    resetEditor()
    closeModal()
  }

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      showToast("error", "Invalid file type. Use JPG, PNG, GIF or WebP.")
      return
    }
    if (file.size > MAX_BYTES) {
      showToast("error", "File is too large. Maximum size is 5MB.")
      return
    }

    const dataUrl = await readFileAsDataUrl(file)
    setImageSrc(dataUrl)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setStep("crop")
  }

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return
    setUploading(true)
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, rotation)
      const file = new File([blob], `profile-${Date.now()}.jpg`, { type: "image/jpeg" })

      const result = await profileService.uploadProfileImage(file)
      if (result.success && result.data) {
        onImageChanged?.(result.data.imageUrl, result.data.s3Path)
        showToast("success", "Profile photo updated.")
        handleClose()
      } else {
        showToast("error", result.message || "Failed to upload photo.")
      }
    } catch {
      showToast("error", "Could not process the image. Please try another.")
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    try {
      const result = await profileService.deleteProfileImage()
      if (result.success) {
        onImageChanged?.(null, null)
        showToast("success", "Profile photo removed.")
        handleClose()
      } else {
        showToast("error", result.message || "Failed to remove photo.")
      }
    } finally {
      setRemoving(false)
    }
  }

  const displayName = name || "N/A"
  const displayAvatar = avatarUrl || DEFAULT_AVATAR
  const hasImage = !!avatarUrl

  return (
    <>
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

      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            {/* Avatar with hover overlay (click to change) */}
            <button
              type="button"
              onClick={editable ? handleOpen : undefined}
              className={`group relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-full ring-4 ring-brand-50 dark:ring-brand-500/10 shadow-sm ${
                editable ? "cursor-pointer" : "cursor-default"
              }`}
              aria-label={editable ? "Change profile photo" : undefined}
            >
              <img
                src={displayAvatar}
                alt={displayName}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_AVATAR
                }}
              />
              {editable && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/45 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.66-.9l.82-1.2A2 2 0 0110.07 4h3.86a2 2 0 011.66.9l.82 1.2a2 2 0 001.66.9H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <circle cx="12" cy="13" r="3" strokeWidth={1.8} />
                  </svg>
                  <span className="text-[11px] font-medium">Change</span>
                </span>
              )}
            </button>

            <div>
              <h4 className="text-xl font-semibold text-gray-800 dark:text-white/90">{displayName}</h4>
              {title && (
                <span className="mt-1.5 inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                  {title}
                </span>
              )}
            </div>
          </div>

          {editable && (
            <ProfileActionButton
              onClick={handleOpen}
              className="w-full sm:w-auto"
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.66-.9l.82-1.2A2 2 0 0110.07 4h3.86a2 2 0 011.66.9l.82 1.2a2 2 0 001.66.9H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <circle cx="12" cy="13" r="3" strokeWidth={1.8} />
                </svg>
              }
            >
              Change Photo
            </ProfileActionButton>
          )}
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={handleClose} className="max-w-[560px] m-4">
        <div className="relative w-full p-4 overflow-y-auto bg-white no-scrollbar rounded-3xl dark:bg-gray-900 lg:p-8">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">Profile Photo</h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              {step === "select"
                ? "Upload a new photo. JPG, PNG, GIF or WebP, up to 5MB."
                : "Drag to reposition, then zoom or rotate to frame your photo."}
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={handleFilePicked}
          />

          {step === "select" ? (
            <div className="flex flex-col items-center gap-5 px-2">
              <div className="h-32 w-32 overflow-hidden rounded-full border border-gray-200 dark:border-gray-800">
                <img
                  src={displayAvatar}
                  alt="current"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_AVATAR
                  }}
                />
              </div>
              <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                Choose Image
              </Button>

              <div className="flex items-center gap-3 px-2 mt-4 w-full sm:justify-between">
                <div>
                  {hasImage && (
                    <Button size="sm" variant="danger" onClick={handleRemove} disabled={removing}>
                      {removing ? "Removing..." : "Remove Photo"}
                    </Button>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={handleClose} disabled={removing}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-2">
              {/* Cropper stage */}
              <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-gray-900">
                {imageSrc && (
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    rotation={rotation}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onRotationChange={setRotation}
                    onCropComplete={onCropComplete}
                  />
                )}
              </div>

              {/* Controls */}
              <div className="mt-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="w-14 text-xs font-medium text-gray-500 dark:text-gray-400">Zoom</span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-brand-500 dark:bg-gray-700"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-14 text-xs font-medium text-gray-500 dark:text-gray-400">Rotate</span>
                  <Button size="sm" variant="outline" onClick={() => setRotation((r) => (r - 90 + 360) % 360)}>
                    ⟲ Left
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRotation((r) => (r + 90) % 360)}>
                    ⟳ Right
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3 px-0 mt-7 sm:justify-between">
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  Choose Different
                </Button>
                <div className="flex items-center gap-3">
                  <Button size="sm" variant="outline" onClick={handleClose} disabled={uploading}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={uploading || !croppedAreaPixels}>
                    {uploading ? "Saving..." : "Save Photo"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
