import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { permissionApi, Permission, CreatePermissionDto, UpdatePermissionDto, PaginationResponse } from '../../services/smartKartReg/permissionApi';

interface PermissionState {
  permissions: Permission[];
  totalRecords: number;
  recordsFiltered: number;
  loading: boolean;
  saving: boolean;
  error: string | null;
  selectedPermission: Permission | null;
}

const initialState: PermissionState = {
  permissions: [],
  totalRecords: 0,
  recordsFiltered: 0,
  loading: false,
  saving: false,
  error: null,
  selectedPermission: null,
};

export const fetchPermissions = createAsyncThunk(
  'permission/fetchAll',
  async (params: Record<string, any>, { rejectWithValue }) => {
    try {
      const response = await permissionApi.getAll(params);
      return response.data.response;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch permissions');
    }
  }
);

export const createPermission = createAsyncThunk(
  'permission/create',
  async (dto: CreatePermissionDto, { rejectWithValue }) => {
    try {
      const response = await permissionApi.create(dto);
      if (!response.data.isSuccess) {
        return rejectWithValue(response.data.message);
      }
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create permission');
    }
  }
);

export const updatePermission = createAsyncThunk(
  'permission/update',
  async ({ id, dto }: { id: number; dto: UpdatePermissionDto }, { rejectWithValue }) => {
    try {
      const response = await permissionApi.update(id, dto);
      if (!response.data.isSuccess) {
        return rejectWithValue(response.data.message);
      }
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update permission');
    }
  }
);

export const deletePermission = createAsyncThunk(
  'permission/delete',
  async (id: number, { rejectWithValue }) => {
    try {
      const response = await permissionApi.delete(id);
      if (!response.data.isSuccess) {
        return rejectWithValue(response.data.message);
      }
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete permission');
    }
  }
);

const permissionSlice = createSlice({
  name: 'permission',
  initialState,
  reducers: {
    setSelectedPermission: (state, action: PayloadAction<Permission | null>) => {
      state.selectedPermission = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPermissions.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchPermissions.fulfilled, (state, action: PayloadAction<PaginationResponse<Permission>>) => {
        state.loading = false;
        state.permissions = action.payload.data;
        state.totalRecords = action.payload.totalRecords;
        state.recordsFiltered = action.payload.recordsFiltered;
      })
      .addCase(fetchPermissions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createPermission.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(createPermission.fulfilled, (state) => { state.saving = false; })
      .addCase(createPermission.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload as string;
      })
      .addCase(updatePermission.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(updatePermission.fulfilled, (state) => { state.saving = false; })
      .addCase(updatePermission.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload as string;
      })
      .addCase(deletePermission.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(deletePermission.fulfilled, (state) => { state.saving = false; })
      .addCase(deletePermission.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedPermission, clearError } = permissionSlice.actions;
export default permissionSlice.reducer;
