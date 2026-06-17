import { API_ENDPOINTS } from "../../constants/api"
import { BackendApiResponse, PrintAgentBackendStatus, PrintAgentInstallerInfo, SignedJobResponse } from "./types"

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("accessToken")
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  }
}

export const printAgentApi = {
  async getStatus(): Promise<PrintAgentBackendStatus> {
    const response = await fetch(API_ENDPOINTS.PRINT_AGENT.STATUS, {
      method: "GET",
      headers: getAuthHeaders(),
    })
    const body = (await response.json()) as BackendApiResponse<PrintAgentBackendStatus>
    if (!body.isSuccess) throw new Error(body.message || "Failed to fetch status")
    return body.response
  },

  async pair(pairingId: string, secret: string, origin: string): Promise<void> {
    const response = await fetch(API_ENDPOINTS.PRINT_AGENT.PAIR, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ pairingId, secret, origin }),
    })
    const body = (await response.json()) as BackendApiResponse<unknown>
    if (!body.isSuccess) throw new Error(body.message || "Pairing failed")
  },

  async unpair(): Promise<void> {
    const response = await fetch(API_ENDPOINTS.PRINT_AGENT.UNPAIR, {
      method: "POST",
      headers: getAuthHeaders(),
    })
    const body = (await response.json()) as BackendApiResponse<unknown>
    if (!body.isSuccess) throw new Error(body.message || "Unpair failed")
  },

  async signJob(printerName: string, contentType: string): Promise<SignedJobResponse> {
    const response = await fetch(API_ENDPOINTS.PRINT_AGENT.SIGN_JOB, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ printerName, contentType }),
    })
    const body = (await response.json()) as BackendApiResponse<SignedJobResponse>
    if (!body.isSuccess) throw new Error(body.message || "Failed to sign job")
    return body.response
  },

  async getInstallerInfo(): Promise<PrintAgentInstallerInfo> {
    const response = await fetch(API_ENDPOINTS.PRINT_AGENT.INSTALLER_INFO, { method: "GET" })
    const body = (await response.json()) as BackendApiResponse<PrintAgentInstallerInfo>
    if (!body.isSuccess) throw new Error(body.message || "Failed to fetch installer info")
    return body.response
  },
}

export default printAgentApi
