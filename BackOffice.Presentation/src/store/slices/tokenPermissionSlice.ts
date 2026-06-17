import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { tokenApi, tokenPermissionApi, TokenPermission, BulkTokenPermissionUpdateDto, StoreTokenDropdown } from '../../services/smartKartReg/permissionApi';

interface TokenPermissionState {
  tokenPermissions: TokenPermission[];
  dropdownTokens: StoreTokenDropdown[];
  dropdownLoading: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: TokenPermissionState = {
  tokenPermissions: [],
  dropdownTokens: [],
  dropdownLoading: false,
  loading: false,
  saving: false,
  error: null,
};

export const fetchTokensDropdown = createAsyncThunk(
  'tokenPermission/fetchTokensDropdown',
  async (_, { rejectWithValue }) => {
    try {
      const response = await tokenApi.dropdown();
      if (!response.data.isSuccess) return rejectWithValue(response.data.message);
      return response.data.response;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch tokens dropdown');
    }
  }
);

export const fetchTokenPermissions = createAsyncThunk(
  'tokenPermission/fetchByToken',
  async (tokenId: number, { rejectWithValue }) => {
    try {
      const response = await tokenApi.getPermissions(tokenId);
      if (!response.data.isSuccess) return rejectWithValue(response.data.message);
      return response.data.response;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch token permissions');
    }
  }
);

export const bulkUpdateTokenPermissions = createAsyncThunk(
  'tokenPermission/bulkUpdate',
  async ({ tokenId, dto }: { tokenId: number; dto: BulkTokenPermissionUpdateDto }, { rejectWithValue }) => {
    try {
      const response = await tokenApi.bulkUpdatePermissions(tokenId, dto);
      if (!response.data.isSuccess) return rejectWithValue(response.data.message);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update token permissions');
    }
  }
);

export const deleteTokenPermission = createAsyncThunk(
  'tokenPermission/delete',
  async (id: number, { rejectWithValue }) => {
    try {
      const response = await tokenPermissionApi.delete(id);
      if (!response.data.isSuccess) return rejectWithValue(response.data.message);
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete token permission');
    }
  }
);

const tokenPermissionSlice = createSlice({
  name: 'tokenPermission',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    clearTokenPermissions: (state) => { state.tokenPermissions = []; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTokensDropdown.pending, (state) => { state.dropdownLoading = true; })
      .addCase(fetchTokensDropdown.fulfilled, (state, action: PayloadAction<StoreTokenDropdown[]>) => {
        state.dropdownLoading = false;
        state.dropdownTokens = action.payload;
      })
      .addCase(fetchTokensDropdown.rejected, (state, action) => { state.dropdownLoading = false; state.error = action.payload as string; })
      .addCase(fetchTokenPermissions.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchTokenPermissions.fulfilled, (state, action: PayloadAction<TokenPermission[]>) => {
        state.loading = false;
        state.tokenPermissions = action.payload;
      })
      .addCase(fetchTokenPermissions.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; })
      .addCase(bulkUpdateTokenPermissions.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(bulkUpdateTokenPermissions.fulfilled, (state) => { state.saving = false; })
      .addCase(bulkUpdateTokenPermissions.rejected, (state, action) => { state.saving = false; state.error = action.payload as string; })
      .addCase(deleteTokenPermission.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(deleteTokenPermission.fulfilled, (state) => { state.saving = false; })
      .addCase(deleteTokenPermission.rejected, (state, action) => { state.saving = false; state.error = action.payload as string; });
  },
});

export const { clearError, clearTokenPermissions } = tokenPermissionSlice.actions;
export default tokenPermissionSlice.reducer;
