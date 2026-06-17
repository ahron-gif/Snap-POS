import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { tokenApi, TokenStoreAccess, StoreDropdown, BulkTokenStoreAccessDto } from '../../services/smartKartReg/permissionApi';

interface TokenStoreAccessState {
  storeAccessList: TokenStoreAccess[];
  stores: StoreDropdown[];
  storesLoading: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: TokenStoreAccessState = {
  storeAccessList: [],
  stores: [],
  storesLoading: false,
  loading: false,
  saving: false,
  error: null,
};

export const fetchStoresByToken = createAsyncThunk(
  'tokenStoreAccess/fetchStoresByToken',
  async (tokenId: number, { rejectWithValue }) => {
    try {
      const response = await tokenApi.tenantStores(tokenId);
      if (!response.data.isSuccess) return rejectWithValue(response.data.message);
      return response.data.response;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch tenant stores');
    }
  }
);

export const fetchTokenStoreAccess = createAsyncThunk(
  'tokenStoreAccess/fetchByToken',
  async (tokenId: number, { rejectWithValue }) => {
    try {
      const response = await tokenApi.getStoreAccess(tokenId);
      if (!response.data.isSuccess) return rejectWithValue(response.data.message);
      return response.data.response;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch token store access');
    }
  }
);

export const bulkUpdateTokenStoreAccess = createAsyncThunk(
  'tokenStoreAccess/bulkUpdate',
  async ({ tokenId, dto }: { tokenId: number; dto: BulkTokenStoreAccessDto }, { rejectWithValue }) => {
    try {
      const response = await tokenApi.bulkUpdateStoreAccess(tokenId, dto);
      if (!response.data.isSuccess) return rejectWithValue(response.data.message);
      return response.data;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(error.response?.data?.message || 'Failed to update token store access');
    }
  }
);

export const removeTokenStoreAccess = createAsyncThunk(
  'tokenStoreAccess/remove',
  async (id: number, { rejectWithValue }) => {
    try {
      const response = await tokenApi.removeStoreAccess(id);
      if (!response.data.isSuccess) return rejectWithValue(response.data.message);
      return id;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(error.response?.data?.message || 'Failed to remove store access');
    }
  }
);

const tokenStoreAccessSlice = createSlice({
  name: 'tokenStoreAccess',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    clearStoreAccessList: (state) => { state.storeAccessList = []; },
    clearStores: (state) => { state.stores = []; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStoresByToken.pending, (state) => { state.storesLoading = true; })
      .addCase(fetchStoresByToken.fulfilled, (state, action: PayloadAction<StoreDropdown[]>) => {
        state.storesLoading = false;
        state.stores = action.payload;
      })
      .addCase(fetchStoresByToken.rejected, (state, action) => { state.storesLoading = false; state.error = action.payload as string; })
      .addCase(fetchTokenStoreAccess.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchTokenStoreAccess.fulfilled, (state, action: PayloadAction<TokenStoreAccess[]>) => {
        state.loading = false;
        state.storeAccessList = action.payload;
      })
      .addCase(fetchTokenStoreAccess.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; })
      .addCase(bulkUpdateTokenStoreAccess.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(bulkUpdateTokenStoreAccess.fulfilled, (state) => { state.saving = false; })
      .addCase(bulkUpdateTokenStoreAccess.rejected, (state, action) => { state.saving = false; state.error = action.payload as string; })
      .addCase(removeTokenStoreAccess.pending, (state) => { state.saving = true; state.error = null; })
      .addCase(removeTokenStoreAccess.fulfilled, (state, action: PayloadAction<number>) => {
        state.saving = false;
        state.storeAccessList = state.storeAccessList.filter(s => s.id !== action.payload);
      })
      .addCase(removeTokenStoreAccess.rejected, (state, action) => { state.saving = false; state.error = action.payload as string; });
  },
});

export const { clearError, clearStoreAccessList, clearStores } = tokenStoreAccessSlice.actions;
export default tokenStoreAccessSlice.reducer;
