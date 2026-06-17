import apiClient from '../lib/axios';
import { API_ENDPOINTS } from '../constants/api';

/**
 * Self-service profile API (the /profile page).
 *
 * Every call here acts on "me" — the backend resolves the user from the JWT, so
 * none of these methods take a user id. Covers the four editable things:
 * email, phone, password (across all the user's tables) and the profile image
 * (stored only on the app-user row).
 */

export interface MyProfile {
  tenantUserId: string;
  mainUserId: number;
  /** Read-only — username can never be changed via self-service. */
  userName: string;
  email: string | null;
  phone: string | null;
  /** Raw S3 key (internal). */
  profileImagePath: string | null;
  /** Short-lived pre-signed URL the browser can render directly. */
  profileImageUrl: string | null;
}

export interface UpdateMyProfilePayload {
  /** Omit / null to leave unchanged. */
  email?: string | null;
  /** Omit / null to leave unchanged. */
  phone?: string | null;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** Backend ApiResponse<T> envelope (camelCase over the wire). */
interface ApiEnvelope<T> {
  isSuccess: boolean;
  statusCode?: number;
  message: string;
  response: T;
  errors?: unknown;
}

/** Normalized result the UI consumes. */
export interface ServiceResult<T> {
  success: boolean;
  data: T | null;
  message: string;
  /** Field-level errors when present (e.g. { Email: ["already exists"] }). */
  errors?: unknown;
}

function errorResult<T>(error: any, fallback: string): ServiceResult<T> {
  const data = error?.response?.data;
  const message =
    (typeof data === 'string' ? data : data?.message) || fallback;
  return { success: false, data: null, message, errors: data?.errors ?? null };
}

class ProfileService {
  async getMyProfile(): Promise<ServiceResult<MyProfile>> {
    try {
      const { data } = await apiClient.get<ApiEnvelope<MyProfile>>(
        API_ENDPOINTS.USERS.GET_MY_PROFILE,
      );
      return {
        success: data.isSuccess,
        data: data.response,
        message: data.message,
        errors: data.errors,
      };
    } catch (error) {
      return errorResult<MyProfile>(error, 'Failed to load profile.');
    }
  }

  async updateMyProfile(payload: UpdateMyProfilePayload): Promise<ServiceResult<MyProfile>> {
    try {
      const { data } = await apiClient.put<ApiEnvelope<MyProfile>>(
        API_ENDPOINTS.USERS.UPDATE_MY_PROFILE,
        payload,
      );
      return {
        success: data.isSuccess,
        data: data.response,
        message: data.message,
        errors: data.errors,
      };
    } catch (error) {
      return errorResult<MyProfile>(error, 'Failed to update profile.');
    }
  }

  async changeMyPassword(payload: ChangePasswordPayload): Promise<ServiceResult<boolean>> {
    try {
      const { data } = await apiClient.post<ApiEnvelope<boolean>>(
        API_ENDPOINTS.USERS.CHANGE_MY_PASSWORD,
        payload,
      );
      return {
        success: data.isSuccess,
        data: data.response,
        message: data.message,
        errors: data.errors,
      };
    } catch (error) {
      return errorResult<boolean>(error, 'Failed to change password.');
    }
  }

  async uploadProfileImage(file: File): Promise<ServiceResult<{ imageUrl: string; s3Path: string }>> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Let the browser set the multipart boundary — do NOT force Content-Type.
      const { data } = await apiClient.post<ApiEnvelope<{ imageUrl: string; s3Path: string }>>(
        API_ENDPOINTS.USERS.UPLOAD_PROFILE_IMAGE,
        formData,
      );
      return {
        success: data.isSuccess,
        data: data.response,
        message: data.message,
        errors: data.errors,
      };
    } catch (error) {
      return errorResult<{ imageUrl: string; s3Path: string }>(error, 'Failed to upload image.');
    }
  }

  async deleteProfileImage(): Promise<ServiceResult<null>> {
    try {
      const { data } = await apiClient.delete<ApiEnvelope<null>>(
        API_ENDPOINTS.USERS.DELETE_PROFILE_IMAGE,
      );
      return {
        success: data.isSuccess,
        data: null,
        message: data.message,
        errors: data.errors,
      };
    } catch (error) {
      return errorResult<null>(error, 'Failed to remove image.');
    }
  }
}

export const profileService = new ProfileService();
