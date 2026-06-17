import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { tokenApi, StoreToken, CreateStoreTokenDto, UpdateStoreTokenDto, PaginationResponse } from '../../services/smartKartReg/permissionApi';

interface TokenState {
  tokens: StoreToken[];
  totalRecords: number;
  recordsFiltered: number;
  loading: boolean;
  saving: boolean;
  error: string | null;
  selectedToken: StoreToken | null;
}

const initialState: TokenState = {
  tokens: [],
  totalRecords: 0,
  recordsFiltered: 0,
  loading: false,
  saving: false,
  error: null,
  selectedToken: null,
};

export const fetchTokens = createAsyncThunk(
  'token/fetchAll',
  async (params: Record<string, any>, { rejectWithValue }) => {
    try {
      const response = await tokenApi.getAll(params);
      return response.data.response;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch tokens');
    }
  }
);

export const createToken = createAsyncThunk(
  'token/create',
  async (dto: CreateStoreTokenDto, { rejectWithValue }) => {
    try {
      const response = await tokenApi.create(dto);
      if (!response.data.isSuccess) return rejectWithValue(response.data.message);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create token');
    }
  }
);

export const updateToken = createAsyncThunk(
  'token/update',
  async ({ id, dto }: { id: number; dto: UpdateStoreTokenDto }, { rejectWithValue }) => {
    try {
      const response = await tokenApi.update(id, dto);
      if (!response.data.isSuccess) return rejectWithValue(response.data.message);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update token');
    }
  }
);

export const deleteToken = createAsyncThunk(
  'token/delete',
  async (id: number, { rejectWithValue }) => {
    try {
      const response = await tokenApi.delete(id);
      if (!response.data.isSuccess) return rejectWithValue(response.data.message);
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete token');
    }
  }
);

const tokenSlice = createSlice({
  name: 'token',
  initialState,
  reducers: {
    setSelectedToken: (state, action: PayloadAction<StoreToken | null>) => {
      state.selectedToken = action.payload;
    },
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTokens.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchTokens.fulfilled, (state, action: PayloadAction<PaginationResponse<StoreToken>>) => {
        state.loading = false;
        state.tokens = action.payload.data;
        state.totalRecords = action.payload.totalRecords;
        state.recordsFiltered = action.payload.recordsFiltered;
      })
      .addCase(fetchTokens.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; })
      .addCase(createToken.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(createToken.fulfilled, (state) => { state.saving = false; })
      .addCase(createToken.rejected, (state, action) => { state.saving = false; state.error = action.payload as string; })
      .addCase(updateToken.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(updateToken.fulfilled, (state) => { state.saving = false; })
      .addCase(updateToken.rejected, (state, action) => { state.saving = false; state.error = action.payload as string; })
      .addCase(deleteToken.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(deleteToken.fulfilled, (state) => { state.saving = false; })
      .addCase(deleteToken.rejected, (state, action) => { state.saving = false; state.error = action.payload as string; });
  },
});

export const { setSelectedToken, clearError } = tokenSlice.actions;
export default tokenSlice.reducer;
