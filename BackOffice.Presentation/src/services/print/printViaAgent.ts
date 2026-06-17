import printAgentApi from "./printAgentApi"
import printAgentClient from "./PrintAgentClient"
import printerMappings from "./printerMappings"
import { AgentPrintResult, DocumentType, PrintContentType } from "./types"

export interface AgentPrintOptions {
  documentType: DocumentType
  contentType: PrintContentType
  payload: ArrayBuffer | Uint8Array | string
  jobName?: string
  copies?: number
  fallbackPrinterName?: string
}

export interface AgentPrintFlowResult {
  agentUsed: boolean
  result?: AgentPrintResult
  error?: string
}

export async function printViaAgent(options: AgentPrintOptions): Promise<AgentPrintFlowResult> {
  const health = await printAgentClient.health()
  if (!health) {
    return { agentUsed: false, error: "Print agent not detected." }
  }
  if (!health.isPaired) {
    return { agentUsed: false, error: "Print agent installed but not paired." }
  }

  const printerName = printerMappings.get(options.documentType) || options.fallbackPrinterName
  if (!printerName) {
    return { agentUsed: false, error: `No printer mapping configured for '${options.documentType}'.` }
  }

  let signed
  try {
    signed = await printAgentApi.signJob(printerName, options.contentType)
  } catch (e) {
    return { agentUsed: false, error: e instanceof Error ? e.message : "Failed to sign job." }
  }

  const base64 = await toBase64(options.payload)
  const result = await printAgentClient.print(signed.token, {
    printerName,
    contentType: options.contentType,
    content: base64,
    copies: options.copies,
    jobName: options.jobName,
  })

  if (!result.success) {
    return { agentUsed: true, result, error: result.errorMessage }
  }
  return { agentUsed: true, result }
}

async function toBase64(payload: ArrayBuffer | Uint8Array | string): Promise<string> {
  if (typeof payload === "string") {
    return btoa(unescape(encodeURIComponent(payload)))
  }
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload)
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)))
  }
  return btoa(binary)
}

export default printViaAgent
