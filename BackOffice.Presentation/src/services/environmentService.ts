import apiClient from "../lib/axios"
import { API_ENDPOINTS } from "../constants/api"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnvironmentDto {
  id: string
  name: string
  code: string
  isActive: boolean
}

export interface UserEnvironmentDto {
  id: string
  userId: number
  customerId: number
  environmentId: string
  environmentName: string
  environmentCode: string
}

export interface UserEnvironmentAccessDto {
  hasWebAccess: boolean
  environments: UserEnvironmentDto[]
}

export interface SetUserEnvironmentsPayload {
  userId: number
  customerId: number
  environmentIds: string[]
  hasWebAccess: boolean
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const environmentService = {
  /** Returns all environments (active + inactive). */
  async getAll(headers: Record<string, string>): Promise<EnvironmentDto[]> {
    const res = await apiClient.get(API_ENDPOINTS.ENVIRONMENTS.GET_ALL, { headers })
    return res.data?.response ?? []
  },

  /** Returns the web-access flag and assigned environments for a user+customer. */
  async getUserAccess(
    userId: number,
    customerId: number,
    headers: Record<string, string>
  ): Promise<UserEnvironmentAccessDto> {
    const res = await apiClient.get(
      API_ENDPOINTS.ENVIRONMENTS.GET_USER_ACCESS(userId, customerId),
      { headers }
    )
    return res.data?.response ?? { hasWebAccess: true, environments: [] }
  },

  /**
   * Atomically replaces all environment assignments for a user+customer
   * and sets the HasWebAccess flag.
   */
  async setUserEnvironments(
    payload: SetUserEnvironmentsPayload,
    headers: Record<string, string>
  ): Promise<boolean> {
    const res = await apiClient.post(
      API_ENDPOINTS.ENVIRONMENTS.SET_USER_ENVIRONMENTS,
      payload,
      { headers }
    )
    return res.data?.isSuccess === true
  },
}
