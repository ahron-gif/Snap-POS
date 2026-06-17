import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { registrationApi, Registration, RegistrationDetail, CreateRegistrationDto, UpdateRegistrationDto } from '../../services/smartKartReg/registrationApi';
import type { PaginationResponse } from '../../services/smartKartReg/permissionApi';

interface RegistrationState {
  registrations: Registration[];
  totalRecords: number;
  recordsFiltered: number;
  loading: boolean;
  saving: boolean;
  error: string | null;
  selectedRegistration: Registration | null;
}

const initialState: RegistrationState = {
  registrations: [],
  totalRecords: 0,
  recordsFiltered: 0,
  loading: false,
  saving: false,
  error: null,
  selectedRegistration: null,
};

export const fetchRegistrations = createAsyncThunk(
  'registration/fetchAll',
  async (params: Record<string, any>, { rejectWithValue }) => {
    try {
      const response = await registrationApi.getAll(params);
      return response.data.response;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch registrations');
    }
  }
);

export const fetchRegistrationById = createAsyncThunk(
  'registration/fetchById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await registrationApi.getById(id);
      if (!response.data.isSuccess) {
        return rejectWithValue(response.data.message);
      }
      return response.data.response;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch registration');
    }
  }
);

export const createRegistration = createAsyncThunk(
  'registration/create',
  async (dto: CreateRegistrationDto, { rejectWithValue }) => {
    try {
      const response = await registrationApi.create(dto);
      if (!response.data.isSuccess) {
        return rejectWithValue(response.data.message);
      }
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create registration');
    }
  }
);

export const updateRegistration = createAsyncThunk(
  'registration/update',
  async ({ id, dto }: { id: string; dto: UpdateRegistrationDto }, { rejectWithValue }) => {
    try {
      const response = await registrationApi.update(id, dto);
      if (!response.data.isSuccess) {
        return rejectWithValue(response.data.message);
      }
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update registration');
    }
  }
);

export const deleteRegistration = createAsyncThunk(
  'registration/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await registrationApi.delete(id);
      if (!response.data.isSuccess) {
        return rejectWithValue(response.data.message);
      }
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete registration');
    }
  }
);

const registrationSlice = createSlice({
  name: 'registration',
  initialState,
  reducers: {
    setSelectedRegistration: (state, action: PayloadAction<Registration | null>) => {
      state.selectedRegistration = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRegistrations.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchRegistrations.fulfilled, (state, action: PayloadAction<PaginationResponse<Registration>>) => {
        state.loading = false;
        state.registrations = action.payload.data;
        state.totalRecords = action.payload.totalRecords;
        state.recordsFiltered = action.payload.recordsFiltered;
      })
      .addCase(fetchRegistrations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createRegistration.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(createRegistration.fulfilled, (state) => { state.saving = false; })
      .addCase(createRegistration.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload as string;
      })
      .addCase(updateRegistration.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(updateRegistration.fulfilled, (state) => { state.saving = false; })
      .addCase(updateRegistration.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload as string;
      })
      .addCase(deleteRegistration.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(deleteRegistration.fulfilled, (state) => { state.saving = false; })
      .addCase(deleteRegistration.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedRegistration, clearError } = registrationSlice.actions;
export default registrationSlice.reducer;
