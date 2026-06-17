import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { Provider } from "react-redux"
import { configureStore } from "@reduxjs/toolkit"
import React from "react"
import DynamicSidebar from "../DynamicSidebar"
import type { MenuModule } from "../../types/permission"

vi.mock("../../context/SidebarContext", () => ({
  useSidebar: () => ({
    isExpanded: true,
    isMobileOpen: false,
    toggleSidebar: vi.fn(),
    toggleMobileSidebar: vi.fn(),
  }),
}))

vi.mock("../../context/DashboardTabContext", () => ({
  useDashboardTabs: () => ({
    openTab: vi.fn(),
  }),
}))

vi.mock("react-router", () => ({
  useLocation: () => ({ pathname: "/dashboard" }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

const createMockStore = (overrides: {
  menuTree?: MenuModule[]
  menuLoaded?: boolean
  menuLoading?: boolean
}) => {
  return configureStore({
    reducer: {
      effectivePermission: () => ({
        permissions: [],
        menuTree: overrides.menuTree ?? [],
        screenPermissions: {},
        permissionVersion: "",
        loading: false,
        loaded: true,
        menuLoading: overrides.menuLoading ?? false,
        menuLoaded: overrides.menuLoaded ?? false,
        error: null,
      }),
    },
  })
}

const sampleMenuTree: MenuModule[] = [
  {
    moduleId: 1,
    code: "inventory",
    name: "Inventory",
    icon: "InventoryIcon",
    sortOrder: 1,
    screens: [
      {
        screenId: 1,
        code: "item_list",
        name: "Item List",
        route: "/items-list",
        icon: "",
        sortOrder: 1,
      },
      {
        screenId: 2,
        code: "departments",
        name: "Departments",
        route: "/departments",
        icon: "",
        sortOrder: 2,
      },
    ],
  },
]

describe("DynamicSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Loading State", () => {
    it("ShouldShowLoadingSkeleton_WhenMenuIsLoading", () => {
      const store = createMockStore({ menuLoading: true, menuLoaded: false })
      const { container } = render(
        <Provider store={store}>
          <DynamicSidebar />
        </Provider>
      )
      const pulseElements = container.querySelectorAll(".animate-pulse")
      expect(pulseElements.length).toBeGreaterThan(0)
    })

    it("ShouldNotShowNoAccessMessage_WhenMenuIsLoading", () => {
      const store = createMockStore({ menuLoading: true, menuLoaded: false })
      render(
        <Provider store={store}>
          <DynamicSidebar />
        </Provider>
      )
      expect(screen.queryByText("No Access")).not.toBeInTheDocument()
    })
  })

  describe("Empty Permissions State", () => {
    it("ShouldShowNoAccessMessage_WhenMenuLoadedAndEmpty", () => {
      const store = createMockStore({ menuLoaded: true, menuTree: [] })
      render(
        <Provider store={store}>
          <DynamicSidebar />
        </Provider>
      )
      expect(screen.getByText("No Access")).toBeInTheDocument()
    })

    it("ShouldShowContactAdminMessage_WhenNoPermissions", () => {
      const store = createMockStore({ menuLoaded: true, menuTree: [] })
      render(
        <Provider store={store}>
          <DynamicSidebar />
        </Provider>
      )
      expect(
        screen.getByText(/contact your administrator/i)
      ).toBeInTheDocument()
    })

    it("ShouldNotShowMenuItems_WhenMenuTreeIsEmpty", () => {
      const store = createMockStore({ menuLoaded: true, menuTree: [] })
      render(
        <Provider store={store}>
          <DynamicSidebar />
        </Provider>
      )
      expect(screen.queryByText("Inventory")).not.toBeInTheDocument()
      expect(screen.queryByText("Item List")).not.toBeInTheDocument()
    })
  })

  describe("Loaded With Permissions", () => {
    it("ShouldRenderModules_WhenMenuTreeHasData", () => {
      const store = createMockStore({
        menuLoaded: true,
        menuTree: sampleMenuTree,
      })
      render(
        <Provider store={store}>
          <DynamicSidebar />
        </Provider>
      )
      expect(screen.getByText("Inventory")).toBeInTheDocument()
    })

    it("ShouldNotShowNoAccessMessage_WhenPermissionsExist", () => {
      const store = createMockStore({
        menuLoaded: true,
        menuTree: sampleMenuTree,
      })
      render(
        <Provider store={store}>
          <DynamicSidebar />
        </Provider>
      )
      expect(screen.queryByText("No Access")).not.toBeInTheDocument()
    })

    it("ShouldNotShowLoadingSkeleton_WhenMenuIsLoaded", () => {
      const store = createMockStore({
        menuLoaded: true,
        menuTree: sampleMenuTree,
      })
      const { container } = render(
        <Provider store={store}>
          <DynamicSidebar />
        </Provider>
      )
      expect(container.querySelectorAll(".animate-pulse").length).toBe(0)
    })
  })
})
