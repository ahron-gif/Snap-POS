import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { permissionService } from '../../services/permissionService';
import type { MenuModule, ScreenPermissions } from '../../types/permission';

// ─── State shape ───

interface EffectivePermissionState {
  permissions: string[];
  menuTree: MenuModule[];
  screenPermissions: Record<string, ScreenPermissions>;
  permissionVersion: string;
  loading: boolean;
  loaded: boolean;
  menuLoading: boolean;
  menuLoaded: boolean;
  error: string | null;
}

const initialState: EffectivePermissionState = {
  permissions: [],
  menuTree: [],
  screenPermissions: {},
  permissionVersion: '',
  loading: false,
  loaded: false,
  menuLoading: false,
  menuLoaded: false,
  error: null,
};

// ─── Async thunks ───

export const loadPermissions = createAsyncThunk(
  'effectivePermission/loadPermissions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await permissionService.getMyPermissions();
      if (response.data.isSuccess) {
        return response.data.response;
      }
      return rejectWithValue(response.data.message || 'Failed to load permissions');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(error.response?.data?.message || 'Failed to load permissions');
    }
  }
);

export const loadMenu = createAsyncThunk(
  'effectivePermission/loadMenu',
  async (_, { rejectWithValue }) => {
    try {
      const response = await permissionService.getMenu();
      if (response.data.isSuccess) {
        // Backend returns NavigationMenuDto { modules: [...] }, not MenuModule[] directly
        const data = response.data.response as unknown;
        if (Array.isArray(data)) return data as MenuModule[];
        if (data && typeof data === 'object' && 'modules' in data) {
          return (data as { modules: MenuModule[] }).modules ?? [];
        }
        return [] as MenuModule[];
      }
      return rejectWithValue(response.data.message || 'Failed to load menu');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(error.response?.data?.message || 'Failed to load menu');
    }
  }
);

export const loadScreenPermissions = createAsyncThunk(
  'effectivePermission/loadScreenPermissions',
  async (screenCode: string, { rejectWithValue }) => {
    try {
      const response = await permissionService.getScreenPermissions(screenCode);
      if (response.data.isSuccess) {
        return { screenCode, permissions: response.data.response };
      }
      return rejectWithValue(response.data.message || 'Failed to load screen permissions');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(error.response?.data?.message || 'Failed to load screen permissions');
    }
  }
);

// ─── Slice ───

const effectivePermissionSlice = createSlice({
  name: 'effectivePermission',
  initialState,
  reducers: {
    clearPermissions: () => initialState,
    setPermissionVersion: (state, action: PayloadAction<string>) => {
      state.permissionVersion = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // ── loadPermissions ──
      .addCase(loadPermissions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadPermissions.fulfilled, (state, action: PayloadAction<string[]>) => {
        state.loading = false;
        state.loaded = true;
        state.permissions = action.payload;
      })
      .addCase(loadPermissions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // ── loadMenu ──
      .addCase(loadMenu.pending, (state) => {
        state.menuLoading = true;
      })
      .addCase(loadMenu.fulfilled, (state, action: PayloadAction<MenuModule[]>) => {
        state.menuLoading = false;
        state.menuLoaded = true;
        state.menuTree = action.payload;
      })
      .addCase(loadMenu.rejected, (state, action) => {
        state.menuLoading = false;
        state.menuLoaded = true;
        state.error = action.payload as string;
      })

      // ── loadScreenPermissions ──
      .addCase(loadScreenPermissions.fulfilled, (state, action) => {
        const { screenCode, permissions } = action.payload;
        state.screenPermissions[screenCode] = permissions;
      })
      .addCase(loadScreenPermissions.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { clearPermissions, setPermissionVersion } = effectivePermissionSlice.actions;
export default effectivePermissionSlice.reducer;
