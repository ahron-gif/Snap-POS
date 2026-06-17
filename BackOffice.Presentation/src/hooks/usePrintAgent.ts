import { useCallback, useEffect, useState } from "react"
import printAgentApi from "../services/print/printAgentApi"
import printAgentClient from "../services/print/PrintAgentClient"
import { AgentHealthResponse, PrintAgentBackendStatus, PrinterInfo } from "../services/print/types"

const PRINTER_LIST_CACHE_KEY = "backoffice.printer.printersCache"

function readPrinterCache(): PrinterInfo[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(PRINTER_LIST_CACHE_KEY)
    return raw ? (JSON.parse(raw) as PrinterInfo[]) : []
  } catch {
    return []
  }
}

function writePrinterCache(printers: PrinterInfo[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(PRINTER_LIST_CACHE_KEY, JSON.stringify(printers))
  } catch {
    /* ignore quota errors */
  }
}

interface UsePrintAgentResult {
  agentHealth: AgentHealthResponse | null
  backendStatus: PrintAgentBackendStatus | null
  printers: PrinterInfo[]
  printersFromCache: boolean
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  pair: () => Promise<void>
  unpair: () => Promise<void>
}

export const usePrintAgent = (autoRefreshMs = 0): UsePrintAgentResult => {
  const [agentHealth, setAgentHealth] = useState<AgentHealthResponse | null>(null)
  const [backendStatus, setBackendStatus] = useState<PrintAgentBackendStatus | null>(null)
  const [printers, setPrinters] = useState<PrinterInfo[]>(() => readPrinterCache())
  const [printersFromCache, setPrintersFromCache] = useState<boolean>(() => readPrinterCache().length > 0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [health, status] = await Promise.all([
        printAgentClient.health(),
        printAgentApi.getStatus().catch(() => null),
      ])
      setAgentHealth(health)
      setBackendStatus(status)

      if (health) {
        try {
          const list = await printAgentClient.listPrinters()
          setPrinters(list)
          setPrintersFromCache(false)
          writePrinterCache(list)
        } catch {
          const cached = readPrinterCache()
          setPrinters(cached)
          setPrintersFromCache(cached.length > 0)
        }
      } else {
        const cached = readPrinterCache()
        setPrinters(cached)
        setPrintersFromCache(cached.length > 0)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [])

  const pair = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let pairing = await printAgentClient.getPairing()
      if (pairing.isPaired) {
        await printAgentClient.resetPairing()
        try { await printAgentApi.unpair() } catch { /* backend may have no record */ }
        pairing = await printAgentClient.getPairing()
      }
      if (!pairing.pairingId) throw new Error("Agent did not return a pairing code.")

      let handshake
      try {
        handshake = await printAgentClient.handshake(pairing.pairingId)
      } catch (e) {
        const status = (e as Error & { status?: number }).status
        if (status === 409) {
          await printAgentClient.resetPairing()
          try { await printAgentApi.unpair() } catch { /* ignore */ }
          const fresh = await printAgentClient.getPairing()
          handshake = await printAgentClient.handshake(fresh.pairingId)
        } else {
          throw e
        }
      }

      await printAgentApi.pair(handshake.pairingId, handshake.secret, handshake.origin)
      await refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Pairing failed"
      setError(msg)
      throw e
    } finally {
      setLoading(false)
    }
  }, [refresh])

  const unpair = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await printAgentApi.unpair()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unpair failed")
      throw e
    } finally {
      setLoading(false)
    }
  }, [refresh])

  useEffect(() => {
    refresh()
    if (autoRefreshMs > 0) {
      const interval = setInterval(refresh, autoRefreshMs)
      return () => clearInterval(interval)
    }
    return undefined
  }, [refresh, autoRefreshMs])

  return { agentHealth, backendStatus, printers, printersFromCache, loading, error, refresh, pair, unpair }
}

export default usePrintAgent
