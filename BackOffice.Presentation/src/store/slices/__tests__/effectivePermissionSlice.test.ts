import { describe, it, expect, vi } from "vitest"
import { configureStore } from "@reduxjs/toolkit"
import effectivePermissionReducer, {
  loadMenu,
  loadPermissions,
  clearPermissions,
} from "../effectivePermissionSlice"

vi.mock("../../../services/permissionService", () => ({
  permissionService: {
    getMyPermissions: vi.fn(),
    getMenu: vi.fn(),
    getScreenPermissions: vi.fn(),
  },
}))

const createTestStore = () =>
  configureStore({
    reducer: { effectivePermission: effectivePermissionReducer },
  })

describe("effectivePermissionSlice", () => {
  describe("Initial State", () => {
    it("ShouldHaveCorrectInitialState", () => {
      const store = createTestStore()
      const state = store.getState().effectivePermission
      expect(state.permissions).toEqual([])
      expect(state.menuTree).toEqual([])
      expect(state.menuLoaded).toBe(false)
      expect(state.menuLoading).toBe(false)
      expect(state.loaded).toBe(false)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe("clearPermissions", () => {
    it("ShouldResetToInitialState", () => {
      const store = createTestStore()
      store.dispatch(clearPermissions())
      const state = store.getState().effectivePermission
      expect(state.permissions).toEqual([])
      expect(state.menuTree).toEqual([])
      expect(state.menuLoaded).toBe(false)
      expect(state.menuLoading).toBe(false)
    })
  })

  describe("loadMenu", () => {
    it("ShouldSetMenuLoading_WhenPending", () => {
      const store = createTestStore()
      store.dispatch({ type: loadMenu.pending.type })
      const state = store.getState().effectivePermission
      expect(state.menuLoading).toBe(true)
    })

    it("ShouldSetMenuLoadedAndStopLoading_WhenFulfilled", () => {
      const store = createTestStore()
      store.dispatch({
        type: loadMenu.fulfilled.type,
        payload: [
          {
            moduleId: 1,
            code: "inventory",
            name: "Inventory",
            icon: "InventoryIcon",
            sortOrder: 1,
            screens: [],
          },
        ],
      })
      const state = store.getState().effectivePermission
      expect(state.menuLoading).toBe(false)
      expect(state.menuLoaded).toBe(true)
      expect(state.menuTree).toHaveLength(1)
    })

    it("ShouldSetMenuLoadedTrue_WhenRejected", () => {
      const store = createTestStore()
      store.dispatch({
        type: loadMenu.rejected.type,
        payload: "Failed to load menu",
      })
      const state = store.getState().effectivePermission
      expect(state.menuLoading).toBe(false)
      expect(state.menuLoaded).toBe(true)
      expect(state.error).toBe("Failed to load menu")
    })

    it("ShouldHaveEmptyMenuTree_WhenFulfilledWithEmptyArray", () => {
      const store = createTestStore()
      store.dispatch({
        type: loadMenu.fulfilled.type,
        payload: [],
      })
      const state = store.getState().effectivePermission
      expect(state.menuLoaded).toBe(true)
      expect(state.menuTree).toEqual([])
    })
  })

  describe("loadPermissions", () => {
    it("ShouldSetLoading_WhenPending", () => {
      const store = createTestStore()
      store.dispatch({ type: loadPermissions.pending.type })
      const state = store.getState().effectivePermission
      expect(state.loading).toBe(true)
      expect(state.error).toBeNull()
    })

    it("ShouldSetPermissions_WhenFulfilled", () => {
      const store = createTestStore()
      store.dispatch({
        type: loadPermissions.fulfilled.type,
        payload: ["inventory.item_list.view", "inventory.item_list.edit"],
      })
      const state = store.getState().effectivePermission
      expect(state.loading).toBe(false)
      expect(state.loaded).toBe(true)
      expect(state.permissions).toEqual([
        "inventory.item_list.view",
        "inventory.item_list.edit",
      ])
    })

    it("ShouldSetError_WhenRejected", () => {
      const store = createTestStore()
      store.dispatch({
        type: loadPermissions.rejected.type,
        payload: "Failed to load permissions",
      })
      const state = store.getState().effectivePermission
      expect(state.loading).toBe(false)
      expect(state.error).toBe("Failed to load permissions")
    })
  })
})
