import { pathToComponentMap } from "./tabRoutes";

/**
 * Sidebar menu routes that are exempt from the required ? help hint.
 * Use for create/edit forms, hidden screens, or pages opened only as sub-tabs.
 */
export const SIDEBAR_HELP_EXEMPT_ROUTES = new Set<string>([
  "/item/new",
  "/item-group/new",
  "/department/new",
  "/manufacturer/new",
  "/discount/new",
  "/computers-list",
  "/super-admin/plans",
  "/super-admin/global-pricing",
  "/super-admin/billing-overview",
]);

/**
 * Routes shown in the sidebar but not listed in tabRoutes (direct App.tsx routes).
 * When adding one here, also add matching text in helpContent.ts.
 */
export const SIDEBAR_HELP_EXTRA_ROUTES = ["/settings/printer-settings"] as const;

/** Every sidebar-visible route that must have a ? tooltip in helpContent.ts. */
export function getSidebarHelpRequiredRoutes(): string[] {
  const routes = new Set<string>([
    ...Object.keys(pathToComponentMap),
    ...SIDEBAR_HELP_EXTRA_ROUTES,
  ]);
  return [...routes].filter((route) => !SIDEBAR_HELP_EXEMPT_ROUTES.has(route)).sort();
}

export function isSidebarHelpRequired(route?: string): boolean {
  if (!route) return false;
  if (SIDEBAR_HELP_EXEMPT_ROUTES.has(route)) return false;
  if (route in pathToComponentMap) return true;
  return (SIDEBAR_HELP_EXTRA_ROUTES as readonly string[]).includes(route);
}

export function getMissingSidebarHelpRoutes(
  helpByRoute: Record<string, string | undefined>
): string[] {
  return getSidebarHelpRequiredRoutes().filter((route) => {
    const text = helpByRoute[route]?.trim();
    return !text;
  });
}
