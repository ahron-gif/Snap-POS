import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { applicationApi, Application, CreateApplicationDto, UpdateApplicationDto } from '../../services/smartKartReg/applicationApi';
import type { PaginationResponse } from '../../services/smartKartReg/permissionApi';

interface ApplicationState {
  applications: Application[];
  totalRecords: number;
  recordsFiltered: number;
  loading: boolean;
  saving: boolean;
  error: string | null;
  selectedApplication: Application | null;
}

const initialState: ApplicationState = {
  applications: [],
  totalRecords: 0,
  recordsFiltered: 0,
  loading: false,
  saving: false,
  error: null,
  selectedApplication: null,
};

export const fetchApplications = createAsyncThunk(
  'application/fetchAll',
  async (params: Record<string, any>, { rejectWithValue }) => {
    try {
      const response = await applicationApi.getAll(params);
      return response.data.response;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch applications');
    }
  }
);

export const createApplication = createAsyncThunk(
  'application/create',
  async (dto: CreateApplicationDto, { rejectWithValue }) => {
    try {
      const response = await applicationApi.create(dto);
      if (!response.data.isSuccess) {
        return rejectWithValue(response.data.message);
      }
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create application');
    }
  }
);

export const updateApplication = createAsyncThunk(
  'application/update',
  async ({ id, dto }: { id: string; dto: UpdateApplicationDto }, { rejectWithValue }) => {
    try {
      const response = await applicationApi.update(id, dto);
      if (!response.data.isSuccess) {
        return rejectWithValue(response.data.message);
      }
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update application');
    }
  }
);

export const deleteApplication = createAsyncThunk(
  'application/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await applicationApi.delete(id);
      if (!response.data.isSuccess) {
        return rejectWithValue(response.data.message);
      }
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete application');
    }
  }
);

const applicationSlice = createSlice({
  name: 'application',
  initialState,
  reducers: {
    setSelectedApplication: (state, action: PayloadAction<Application | null>) => {
      state.selectedApplication = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchApplications.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchApplications.fulfilled, (state, action: PayloadAction<PaginationResponse<Application>>) => {
        state.loading = false;
        state.applications = action.payload.data;
        state.totalRecords = action.payload.totalRecords;
        state.recordsFiltered = action.payload.recordsFiltered;
      })
      .addCase(fetchApplications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createApplication.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(createApplication.fulfilled, (state) => { state.saving = false; })
      .addCase(createApplication.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload as string;
      })
      .addCase(updateApplication.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(updateApplication.fulfilled, (state) => { state.saving = false; })
      .addCase(updateApplication.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload as string;
      })
      .addCase(deleteApplication.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(deleteApplication.fulfilled, (state) => { state.saving = false; })
      .addCase(deleteApplication.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedApplication, clearError } = applicationSlice.actions;
export default applicationSlice.reducer;
