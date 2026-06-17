import { useCallback } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useDashboardTabs } from "../../context/DashboardTabContext"
import { getTabRoute } from "../../constants/tabRoutes"

/**
 * Hook returning a function that opens a screen by its app path.
 *
 * BackOffice mixes two navigation styles:
 *   - **Real routes** like /profile, /calendar, /settings/printer-settings —
 *     handled by react-router via navigate().
 *   - **Dashboard tabs** like /items-list, /customers-list — these are not
 *     real routes; they're component names mounted inside <DashboardWithTabs />
 *     at /dashboard.
 *
 * `openScreen(path)` picks the right strategy. If `path` is in
 * `pathToComponentMap`, it opens the matching tab and navigates to /dashboard
 * (where the tab shell lives). Otherwise it calls navigate(path) directly,
 * which works for real routes.
 *
 * Used by the Help system (drawer + Help Center "Go to this screen" buttons)
 * so help can deep-link to any screen — tab-based or routed — uniformly.
 */
export function useOpenScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { openTab } = useDashboardTabs()

  return useCallback(
    (path: string) => {
      const tabConfig = getTabRoute(path)
      if (tabConfig) {
        openTab({
          component: tabConfig.component,
          title: tabConfig.title,
          closable: true,
          ...(tabConfig.props ? { props: tabConfig.props } : {}),
        })
        if (!location.pathname.startsWith("/dashboard")) {
          navigate("/dashboard")
        }
      } else {
        // Real route — let react-router handle it.
        navigate(path)
      }
    },
    [openTab, navigate, location.pathname],
  )
}
