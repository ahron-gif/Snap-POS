import PageBreadcrumb from "../components/common/PageBreadCrumb"
import UserMetaCard from "../components/UserProfile/UserMetaCard"
import UserInfoCard from "../components/UserProfile/UserInfoCard"
import ChangePasswordCard from "../components/UserProfile/ChangePasswordCard"
import MfaSettingsCard from "../components/UserProfile/MfaSettingsCard"
import PageMeta from "../components/common/PageMeta"
import { useAuth } from "../context/AuthContext"
import { useProfile } from "../context/ProfileContext"
import type { MyProfile } from "../services/profileService"

interface UserProfilesProps {
  handleBackToGrid?: () => void
  selectedRow?: any
}

export default function UserProfiles({
  handleBackToGrid,
  selectedRow,
}: UserProfilesProps) {
  const { user } = useAuth()
  const { profile, patchProfile, refreshProfile } = useProfile()

  // Self-service = the /profile route (no specific grid row selected). When an
  // admin opens another user's row from a grid, we render the cards read-only —
  // the self-service endpoints only ever act on the logged-in user.
  const isSelf = !selectedRow

  // ── Meta card (avatar + identity) ──────────────────────────────────
  const metaName = isSelf
    ? profile?.userName || user?.username || "User"
    : selectedRow.firstName ||
      selectedRow.userName ||
      selectedRow.username ||
      selectedRow.name ||
      "User"

  const metaTitle = isSelf
    ? user?.role || "User"
    : selectedRow.title || selectedRow.position || selectedRow.role || "User"

  const metaAvatarUrl = isSelf
    ? profile?.profileImageUrl || null
    : selectedRow.profileImageUrl || selectedRow.avatar || null

  // ── Personal information card ───────────────────────────────────────
  const infoUserName = isSelf
    ? profile?.userName || user?.username || "N/A"
    : selectedRow.userName || selectedRow.username || selectedRow.name || "N/A"

  const infoEmail = isSelf
    ? profile?.email || user?.email || ""
    : selectedRow.email || selectedRow.emailAddress || ""

  const infoPhone = isSelf
    ? profile?.phone || ""
    : selectedRow.phone || selectedRow.phoneNumber || ""

  // After an image upload/remove succeeds, patch the in-memory profile so the
  // header and sidebar avatars update instantly (no extra round-trip).
  const handleImageChanged = (imageUrl: string | null, s3Path: string | null) => {
    patchProfile({ profileImageUrl: imageUrl, profileImagePath: s3Path })
  }

  // After an email/phone/password save, patch the profile with the server's
  // fresh copy and keep localStorage in sync so a reload shows the new values.
  const handleProfileSaved = (updated: MyProfile) => {
    patchProfile(updated)
    try {
      const raw = localStorage.getItem("userData")
      if (raw) {
        const parsed = JSON.parse(raw)
        parsed.email = updated.email
        localStorage.setItem("userData", JSON.stringify(parsed))
      }
    } catch {
      // Non-fatal — context already holds the fresh value.
    }
    // Re-fetch as a safety net (also refreshes the avatar URL if it changed).
    refreshProfile()
  }

  return (
    // Full-height scroll container with side padding — scoped only to this page
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-screen-xl mx-auto pb-10">
        <PageMeta
          title="Profile | RDT BackOffice"
          description="Manage your profile and account security settings."
        />

        {/* Page header */}
        {!handleBackToGrid && <PageBreadcrumb pageTitle="Profile" />}

        {/* Back button row (used when opened from a grid/table) */}
        {handleBackToGrid && (
          <div className="mb-5 flex items-center gap-3">
            <button
              onClick={handleBackToGrid}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
              aria-label="Go back to grid"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              Profile
              {infoUserName !== "N/A" && ` — ${infoUserName}`}
            </h3>
          </div>
        )}

        {/* Cards stack */}
        <div className="space-y-5">
          <UserMetaCard
            name={metaName}
            title={metaTitle}
            avatarUrl={metaAvatarUrl}
            editable={isSelf}
            onImageChanged={handleImageChanged}
          />
          <UserInfoCard
            userName={infoUserName}
            email={infoEmail}
            phone={infoPhone}
            editable={isSelf}
            onSaved={handleProfileSaved}
          />
          {/* Password + MFA — only on the logged-in user's own profile */}
          {isSelf && <ChangePasswordCard />}
          {isSelf && !handleBackToGrid && <MfaSettingsCard />}
        </div>
      </div>
    </div>
  )
}
