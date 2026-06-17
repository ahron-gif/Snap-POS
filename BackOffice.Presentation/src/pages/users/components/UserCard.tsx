import React, { useState } from "react"

interface UserRecord {
  userId: number
  userName: string
  email: string | null
  phone: string | null
  customerId: number | null
  dateCreated: string
  lastLoginDate: string | null
  localUserId: string
  dateModified: string | null
  isSuperAdmin?: boolean | null
}

interface UserCardProps {
  user: UserRecord
  onEdit?: (user: UserRecord) => void
  onDelete?: (user: UserRecord) => void
  onAssignRoles?: (user: UserRecord) => void
  onSendInvite?: (user: UserRecord) => void
}

const getInitials = (name: string): string => {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

const avatarGradients = [
  "from-blue-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-violet-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-blue-600",
  "from-indigo-500 to-violet-600",
  "from-fuchsia-500 to-pink-600",
]

const getAvatarGradient = (name: string): string => {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarGradients[Math.abs(hash) % avatarGradients.length]
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "Never"
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return "Never"
  }
}

const getRelativeTime = (dateStr: string | null): string => {
  if (!dateStr) return "Never"
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return formatDate(dateStr)
  } catch {
    return "Never"
  }
}

const isRecentlyActive = (dateStr: string | null): boolean => {
  if (!dateStr) return false
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = (now.getTime() - date.getTime()) / 86400000
    return diffDays < 7
  } catch {
    return false
  }
}

const UserCard: React.FC<UserCardProps> = ({
  user,
  onEdit,
  onDelete,
  onAssignRoles,
  onSendInvite,
}) => {
  const [isHovered, setIsHovered] = useState(false)
  const initials = getInitials(user.userName)
  const gradient = getAvatarGradient(user.userName)
  const recentlyActive = isRecentlyActive(user.lastLoginDate)

  return (
    <div
      className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700/80 overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-gray-900/30 hover:border-brand-200 dark:hover:border-brand-800 hover:-translate-y-0.5 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onEdit?.(user)}
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            <div
              className={`bg-gradient-to-br ${gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm group-hover:shadow-md transition-shadow duration-300 group-hover:scale-105 transform`}
            >
              {initials}
            </div>
            {recentlyActive && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                {user.userName}
              </h3>
              {(user.isSuperAdmin === true || user.customerId == null) && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 flex-shrink-0">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Super Admin
                </span>
              )}
            </div>
            {user.email ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {user.email}
              </p>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-0.5">No email</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-300 truncate">
              {user.phone || "Not set"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {formatDate(user.dateCreated)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className={`text-xs truncate ${recentlyActive ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-gray-600 dark:text-gray-300"}`}>
              {getRelativeTime(user.lastLoginDate)}
            </span>
          </div>
        </div>
      </div>

      <div
        className={`flex items-center border-t border-gray-100 dark:border-gray-700/50 transition-all duration-300 ${
          isHovered ? "bg-gray-50/80 dark:bg-gray-750" : ""
        }`}
      >
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(user)
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-gray-500 hover:text-brand-600 hover:bg-brand-50/50 dark:text-gray-400 dark:hover:text-brand-400 dark:hover:bg-brand-900/10 transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
        )}
        {onEdit && onSendInvite && (
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
        )}
        {onSendInvite && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSendInvite(user)
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-gray-500 hover:text-indigo-600 hover:bg-indigo-50/50 dark:text-gray-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/10 transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Invite
          </button>
        )}
        {(onEdit || onSendInvite) && onAssignRoles && (
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
        )}
        {onAssignRoles && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAssignRoles(user)
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-gray-500 hover:text-violet-600 hover:bg-violet-50/50 dark:text-gray-400 dark:hover:text-violet-400 dark:hover:bg-violet-900/10 transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Roles
          </button>
        )}
        {onAssignRoles && onDelete && (
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(user)
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50/50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/10 transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

export default UserCard
