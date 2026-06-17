import {
  AGENT_BASE_URL_STORAGE_KEY,
  AGENT_DEFAULT_BASE_URL,
  AgentHealthResponse,
  AgentPairingHandshakeResponse,
  AgentPrintRequest,
  AgentPrintResult,
  PrinterInfo,
} from "./types"

class PrintAgentClient {
  getBaseUrl(): string {
    if (typeof window === "undefined") return AGENT_DEFAULT_BASE_URL
    return localStorage.getItem(AGENT_BASE_URL_STORAGE_KEY) || AGENT_DEFAULT_BASE_URL
  }

  setBaseUrl(url: string): void {
    if (typeof window === "undefined") return
    if (!url) {
      localStorage.removeItem(AGENT_BASE_URL_STORAGE_KEY)
    } else {
      localStorage.setItem(AGENT_BASE_URL_STORAGE_KEY, url)
    }
  }

  async health(timeoutMs = 1500): Promise<AgentHealthResponse | null> {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const response = await fetch(`${this.getBaseUrl()}/health`, {
        method: "GET",
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!response.ok) return null
      return (await response.json()) as AgentHealthResponse
    } catch {
      return null
    }
  }

  async healthRaw(timeoutMs = 3000): Promise<{ ok: boolean; status?: number; data?: AgentHealthResponse; error?: string; reason?: "lna-denied" | "cert" | "offline" | "cors" | "unknown" }> {
    const url = `${this.getBaseUrl()}/health`
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const response = await fetch(url, { method: "GET", signal: controller.signal })
      clearTimeout(timer)
      if (!response.ok) {
        return { ok: false, status: response.status, error: `HTTP ${response.status} ${response.statusText}`, reason: "unknown" }
      }
      const data = (await response.json()) as AgentHealthResponse
      return { ok: true, status: response.status, data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: msg, reason: classifyFetchError(msg) }
    }
  }

  async listPrinters(): Promise<PrinterInfo[]> {
    const response = await fetch(`${this.getBaseUrl()}/printers`, { method: "GET" })
    if (!response.ok) {
      throw new Error(`Failed to list printers (${response.status})`)
    }
    return (await response.json()) as PrinterInfo[]
  }

  async getPairing(): Promise<{ pairingId: string; isPaired: boolean; pairedOrigin: string | null }> {
    const response = await fetch(`${this.getBaseUrl()}/pairing`, { method: "GET" })
    if (!response.ok) {
      throw new Error(`Failed to read pairing info (${response.status})`)
    }
    return await response.json()
  }

  async handshake(pairingId: string): Promise<AgentPairingHandshakeResponse> {
    const response = await fetch(`${this.getBaseUrl()}/pairing/handshake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingId }),
    })
    if (!response.ok) {
      const body = await safeJson(response)
      const err = new Error(body?.message as string || `Handshake failed (${response.status})`) as Error & { status?: number }
      err.status = response.status
      throw err
    }
    return (await response.json()) as AgentPairingHandshakeResponse
  }

  async resetPairing(): Promise<void> {
    const response = await fetch(`${this.getBaseUrl()}/pairing/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    if (!response.ok) {
      const body = await safeJson(response)
      throw new Error(body?.message as string || `Reset failed (${response.status})`)
    }
  }

  async print(token: string, request: AgentPrintRequest): Promise<AgentPrintResult> {
    const response = await fetch(`${this.getBaseUrl()}/print`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    })
    const body = await safeJson(response)
    if (!response.ok) {
      const message =
        (typeof body?.message === "string" && body.message) ||
        (typeof body?.errorMessage === "string" && body.errorMessage) ||
        `Print failed (${response.status})`
      return {
        success: false,
        printerName: request.printerName,
        errorMessage: message,
      }
    }
    return body as unknown as AgentPrintResult
  }
}

async function safeJson(response: Response): Promise<{ [key: string]: unknown } | null> {
  try {
    return (await response.json()) as { [key: string]: unknown }
  } catch {
    return null
  }
}

function classifyFetchError(message: string): "lna-denied" | "cert" | "offline" | "cors" | "unknown" {
  const m = message.toLowerCase()
  if (m.includes("loopback") || m.includes("private network") || m.includes("local network")) return "lna-denied"
  if (m.includes("cert") || m.includes("ssl") || m.includes("err_cert")) return "cert"
  if (m.includes("err_connection_refused") || m.includes("failed to fetch") || m.includes("err_failed")) return "offline"
  if (m.includes("cors")) return "cors"
  return "unknown"
}

export const printAgentClient = new PrintAgentClient()
export default printAgentClient
