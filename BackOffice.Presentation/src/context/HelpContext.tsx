import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

/**
 * Global state for the in-product help drawer.
 *
 * Any component can call `useHelp().openHelp()` to slide in the drawer.
 * The drawer itself is rendered once at the app root by <HelpDrawer />.
 */

interface HelpContextValue {
  isOpen: boolean
  /** Open the drawer. If `topicKey` is omitted, route-based topic is shown. */
  openHelp: (topicKey?: string) => void
  closeHelp: () => void
  /** When set, overrides the route-based topic selection. */
  pinnedTopicKey: string | null
}

const HelpContext = createContext<HelpContextValue | undefined>(undefined)

export const HelpProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [pinnedTopicKey, setPinnedTopicKey] = useState<string | null>(null)

  const openHelp = useCallback((topicKey?: string) => {
    setPinnedTopicKey(topicKey ?? null)
    setIsOpen(true)
  }, [])

  const closeHelp = useCallback(() => {
    setIsOpen(false)
    setPinnedTopicKey(null)
  }, [])

  // Press F1 anywhere to open help. Esc to close.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      } else if (e.key === "Escape" && isOpen) {
        closeHelp()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, closeHelp])

  const value = useMemo<HelpContextValue>(
    () => ({ isOpen, openHelp, closeHelp, pinnedTopicKey }),
    [isOpen, openHelp, closeHelp, pinnedTopicKey]
  )

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>
}

export const useHelp = (): HelpContextValue => {
  const ctx = useContext(HelpContext)
  if (!ctx) throw new Error("useHelp must be used within a HelpProvider")
  return ctx
}
