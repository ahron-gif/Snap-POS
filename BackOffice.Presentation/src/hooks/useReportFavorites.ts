import { useCallback, useEffect, useRef, useState } from "react"
import { userPreferenceService } from "../services/userPreferenceService"

/**
 * Preference key used in the UserPreference table to store the current user's
 * favorite report IDs. The stored value is a JSON string array of report IDs,
 * e.g. `["tax-collected","customer-sales"]`.
 */
const FAVORITES_PREFERENCE_KEY = "reports.favorites"

/** Debounce window (ms) for batching rapid favorite-toggle clicks into one save. */
const SAVE_DEBOUNCE_MS = 400

interface UseReportFavoritesReturn {
  /** True while the initial load from the server is in flight. */
  loading: boolean
  /** Current favorite report IDs. */
  favorites: Set<string>
  /** Check whether a given report is favorited. */
  isFavorite: (reportId: string) => boolean
  /** Toggle a report's favorite state. Optimistic: updates local state immediately, then saves. */
  toggleFavorite: (reportId: string) => void
}

const parseFavorites = (value: string | undefined | null): Set<string> => {
  if (!value) return new Set()
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x) => typeof x === "string"))
    }
  } catch {
    // ignore malformed JSON — treat as empty
  }
  return new Set()
}

export const useReportFavorites = (): UseReportFavoritesReturn => {
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const favoritesRef = useRef<Set<string>>(new Set())
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initial load
  useEffect(() => {
    let cancelled = false
    userPreferenceService
      .getPreference(FAVORITES_PREFERENCE_KEY)
      .then((result) => {
        if (cancelled) return
        const value = result?.response?.preferenceValue
        const next = parseFavorites(value)
        favoritesRef.current = next
        setFavorites(next)
      })
      .catch(() => {
        // Silently fall back to empty set — favorites are a non-critical feature.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Debounced save — triggered whenever local favorites change.
  const scheduleSave = useCallback((next: Set<string>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const array = Array.from(next)
      userPreferenceService
        .savePreference(FAVORITES_PREFERENCE_KEY, array)
        .catch(() => {
          // Best-effort: don't surface a scary error for a UI pref.
          console.warn("Failed to save report favorites")
        })
    }, SAVE_DEBOUNCE_MS)
  }, [])

  const isFavorite = useCallback(
    (reportId: string) => favoritesRef.current.has(reportId),
    []
  )

  const toggleFavorite = useCallback(
    (reportId: string) => {
      setFavorites((prev) => {
        const next = new Set(prev)
        if (next.has(reportId)) next.delete(reportId)
        else next.add(reportId)
        favoritesRef.current = next
        scheduleSave(next)
        return next
      })
    },
    [scheduleSave]
  )

  // Flush any pending save on unmount.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        const array = Array.from(favoritesRef.current)
        userPreferenceService.savePreference(FAVORITES_PREFERENCE_KEY, array).catch(() => {
          // ignore
        })
      }
    }
  }, [])

  return { loading, favorites, isFavorite, toggleFavorite }
}

export default useReportFavorites
