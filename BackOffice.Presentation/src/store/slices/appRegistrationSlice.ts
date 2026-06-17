import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { appRegistrationApi, AppRegistration, CreateAppRegistrationDto, UpdateAppRegistrationDto } from '../../services/smartKartReg/appRegistrationApi';
import type { PaginationResponse } from '../../services/smartKartReg/permissionApi';

interface AppRegistrationState {
  appRegistrations: AppRegistration[];
  totalRecords: number;
  recordsFiltered: number;
  loading: boolean;
  saving: boolean;
  error: string | null;
  selectedAppRegistration: AppRegistration | null;
}

const initialState: AppRegistrationState = {
  appRegistrations: [],
  totalRecords: 0,
  recordsFiltered: 0,
  loading: false,
  saving: false,
  error: null,
  selectedAppRegistration: null,
};

export const fetchAppRegistrations = createAsyncThunk(
  'appRegistration/fetchAll',
  async (params: Record<string, any>, { rejectWithValue }) => {
    try {
      const response = await appRegistrationApi.getAll(params);
      return response.data.response;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch app registrations');
    }
  }
);

export const createAppRegistration = createAsyncThunk(
  'appRegistration/create',
  async (dto: CreateAppRegistrationDto, { rejectWithValue }) => {
    try {
      const response = await appRegistrationApi.create(dto);
      if (!response.data.isSuccess) {
        return rejectWithValue(response.data.message);
      }
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create app registration');
    }
  }
);

export const updateAppRegistration = createAsyncThunk(
  'appRegistration/update',
  async ({ id, dto }: { id: string; dto: UpdateAppRegistrationDto }, { rejectWithValue }) => {
    try {
      const response = await appRegistrationApi.update(id, dto);
      if (!response.data.isSuccess) {
        return rejectWithValue(response.data.message);
      }
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update app registration');
    }
  }
);

export const deleteAppRegistration = createAsyncThunk(
  'appRegistration/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await appRegistrationApi.delete(id);
      if (!response.data.isSuccess) {
        return rejectWithValue(response.data.message);
      }
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete app registration');
    }
  }
);

const appRegistrationSlice = createSlice({
  name: 'appRegistration',
  initialState,
  reducers: {
    setSelectedAppRegistration: (state, action: PayloadAction<AppRegistration | null>) => {
      state.selectedAppRegistration = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAppRegistrations.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchAppRegistrations.fulfilled, (state, action: PayloadAction<PaginationResponse<AppRegistration>>) => {
        state.loading = false;
        state.appRegistrations = action.payload.data;
        state.totalRecords = action.payload.totalRecords;
        state.recordsFiltered = action.payload.recordsFiltered;
      })
      .addCase(fetchAppRegistrations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createAppRegistration.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(createAppRegistration.fulfilled, (state) => { state.saving = false; })
      .addCase(createAppRegistration.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload as string;
      })
      .addCase(updateAppRegistration.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(updateAppRegistration.fulfilled, (state) => { state.saving = false; })
      .addCase(updateAppRegistration.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload as string;
      })
      .addCase(deleteAppRegistration.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(deleteAppRegistration.fulfilled, (state) => { state.saving = false; })
      .addCase(deleteAppRegistration.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedAppRegistration, clearError } = appRegistrationSlice.actions;
export default appRegistrationSlice.reducer;
