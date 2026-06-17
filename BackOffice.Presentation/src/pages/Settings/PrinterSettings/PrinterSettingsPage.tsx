import { useEffect, useMemo, useState } from "react"
import jsPDF from "jspdf"
import usePrintAgent from "../../../hooks/usePrintAgent"
import printerMappings from "../../../services/print/printerMappings"
import printerRoster from "../../../services/print/printerRoster"
import printViaAgent from "../../../services/print/printViaAgent"
import printAgentClient from "../../../services/print/PrintAgentClient"
import printAgentApi from "../../../services/print/printAgentApi"
import { useAuth } from "../../../context/AuthContext"
import { API_ENDPOINTS } from "../../../constants/api"
import {
  DocumentType,
  PrintAgentInstallerInfo,
  PrintContentType,
} from "../../../services/print/types"

type Mappings = Partial<Record<DocumentType, string>>
type Mode = "default" | "custom"

const DOCUMENT_TYPES: { key: DocumentType; label: string; description: string }[] = [
  { key: "items-list", label: "Items List / Reports", description: "Item lists and grid exports" },
  { key: "invoice", label: "Invoice Printer", description: "Customer invoices" },
  { key: "receipt", label: "Receipt Printer", description: "Register receipts" },
  { key: "label", label: "Barcode Label Printer", description: "Item barcode labels" },
  { key: "shelf-label", label: "Shelf Label Printer", description: "Shelf-edge labels" },
  { key: "statement", label: "Statement Printer", description: "Customer statements" },
  { key: "report", label: "Other Reports", description: "All remaining reports" },
]

export default function PrinterSettingsPage() {
  const { isAdmin } = useAuth()
  const userIsAdmin = isAdmin()
  const { agentHealth, backendStatus, printers, printersFromCache, loading, error, refresh, pair, unpair } = usePrintAgent(0)
  const [manualEntry, setManualEntry] = useState<Partial<Record<DocumentType, boolean>>>({})
  const [roster, setRoster] = useState<string[]>(() => printerRoster.getAll())
  const [newPrinterName, setNewPrinterName] = useState("")

  const [pairBusy, setPairBusy] = useState(false)
  const [pairMessage, setPairMessage] = useState<string | null>(null)
  const [diagBusy, setDiagBusy] = useState(false)
  const [diagResult, setDiagResult] = useState<{ ok: boolean; status?: number; error?: string; raw?: string; reason?: "lna-denied" | "cert" | "offline" | "cors" | "unknown" } | null>(null)
  const [installerInfo, setInstallerInfo] = useState<PrintAgentInstallerInfo | null>(null)
  const [showInstallHelp, setShowInstallHelp] = useState(false)

  const [mode, setMode] = useState<Mode>(printerMappings.getUseCustom() ? "custom" : "default")
  const [defaultMappings, setDefaultMappings] = useState<Mappings>(printerMappings.getDefaultMappings())
  const [userMappings, setUserMappings] = useState<Mappings>(printerMappings.getUserMappings())

  const [testBusy, setTestBusy] = useState<DocumentType | null>(null)
  const [testStatus, setTestStatus] = useState<Partial<Record<DocumentType, { ok: boolean; message: string }>>>({})

  // Save-confirmation toast (matches the app's standard success toast).
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" | "info" }>({
    show: false, message: "", type: "success",
  })
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500)
  }

  useEffect(() => {
    setDefaultMappings(printerMappings.getDefaultMappings())
    setUserMappings(printerMappings.getUserMappings())
    setMode(printerMappings.getUseCustom() ? "custom" : "default")
  }, [agentHealth, backendStatus])

  useEffect(() => {
    let cancelled = false
    printAgentApi
      .getInstallerInfo()
      .then((info) => {
        if (!cancelled) setInstallerInfo(info)
      })
      .catch(() => {
        if (!cancelled) setInstallerInfo({ available: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const agentRunning = agentHealth !== null
  const isPaired = (backendStatus?.paired ?? false) && (agentHealth?.isPaired ?? false)

  const currentOrigin = typeof window !== "undefined" ? window.location.origin : ""
  const agentPairedOrigin = agentHealth?.pairedOrigin ?? null
  const stalePairing =
    agentRunning &&
    !!agentHealth?.isPaired &&
    !!agentPairedOrigin &&
    !!currentOrigin &&
    agentPairedOrigin.toLowerCase() !== currentOrigin.toLowerCase()

  const handleForceRepair = async () => {
    setPairBusy(true)
    setPairMessage(null)
    try {
      await pair()
      setPairMessage("Re-paired to this browser.")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Re-pair failed."
      setPairMessage(msg)
    } finally {
      setPairBusy(false)
    }
  }

  const activeMappings: Mappings = useMemo(() => {
    if (mode === "custom") return { ...defaultMappings, ...userMappings }
    return defaultMappings
  }, [mode, defaultMappings, userMappings])

  const printerOptions = useMemo(() => {
    const map = new Map<string, { name: string; isDefault: boolean; source: "agent" | "manual" }>()
    printers.forEach((p) => {
      map.set(p.name.toLowerCase(), { name: p.name, isDefault: p.isDefault, source: "agent" })
    })
    roster.forEach((name) => {
      const key = name.toLowerCase()
      if (!map.has(key)) map.set(key, { name, isDefault: false, source: "manual" })
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [printers, roster])

  const suggestions = useMemo(() => {
    const known = new Set(printerOptions.map((p) => p.name.toLowerCase()))
    return printerRoster.suggestions().filter((name) => !known.has(name.toLowerCase()))
  }, [printerOptions])

  const editingDefault = mode === "default"
  const canEditDefault = userIsAdmin
  const fieldsDisabled = editingDefault && !canEditDefault

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return ""
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const handleModeChange = (next: Mode) => {
    printerMappings.setUseCustom(next === "custom")
    setMode(next)
    showToast(`Switched to ${next === "custom" ? "custom" : "default"} printer settings`, "success")
  }

  const handleResetCustom = () => {
    printerMappings.resetUserMappings()
    setUserMappings({})
    showToast("Custom printer settings reset to defaults", "success")
  }

  const handleMappingChange = (type: DocumentType, value: string) => {
    const printer = value || null
    if (editingDefault) {
      if (!canEditDefault) return
      printerMappings.setDefaultMapping(type, printer)
      const next = { ...defaultMappings }
      if (!printer) delete next[type]
      else next[type] = printer
      setDefaultMappings(next)
    } else {
      printerMappings.setUserMapping(type, printer)
      const next = { ...userMappings }
      if (!printer) delete next[type]
      else next[type] = printer
      setUserMappings(next)
    }
    const label = DOCUMENT_TYPES.find((d) => d.key === type)?.label ?? "Printer"
    showToast(printer ? `${label} saved successfully` : `${label} cleared`, "success")
  }

  const handlePair = async () => {
    setPairBusy(true)
    setPairMessage(null)
    try {
      await pair()
      setPairMessage("Paired successfully.")
    } catch (e) {
      setPairMessage(e instanceof Error ? e.message : "Pairing failed.")
    } finally {
      setPairBusy(false)
    }
  }

  const handleUnpair = async () => {
    setPairBusy(true)
    setPairMessage(null)
    try {
      await unpair()
      setPairMessage("Unpaired.")
    } catch (e) {
      setPairMessage(e instanceof Error ? e.message : "Unpair failed.")
    } finally {
      setPairBusy(false)
    }
  }

  const openAgentInBrowser = () => {
    const url = `${printAgentClient.getBaseUrl()}/health`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const [lnaBlocked, setLnaBlocked] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (agentRunning) {
      setLnaBlocked(false)
      return
    }
    let cancelled = false
    printAgentClient.healthRaw().then((res) => {
      if (cancelled) return
      setLnaBlocked(!res.ok && res.reason === "lna-denied")
    })
    return () => {
      cancelled = true
    }
  }, [agentRunning])

  const handleTestConnection = async () => {
    setDiagBusy(true)
    setDiagResult(null)
    const result = await printAgentClient.healthRaw()
    if (result.ok) {
      setDiagResult({ ok: true, status: result.status, raw: JSON.stringify(result.data, null, 2) })
      await refresh()
    } else {
      setDiagResult({ ok: false, status: result.status, error: result.error, reason: result.reason })
    }
    setDiagBusy(false)
  }

  const buildTestPayload = (
    type: DocumentType
  ): { contentType: PrintContentType; payload: ArrayBuffer | Uint8Array | string } => {
    if (type === "label" || type === "shelf-label") {
      const title = type === "shelf-label" ? "Shelf Label" : "Barcode Label"
      const zpl =
        "^XA\n^FO50,50^A0N,40,40^FD" + title + " Test^FS\n^FO50,110^A0N,28,28^FD" +
        new Date().toLocaleString() +
        "^FS\n^XZ\n"
      return { contentType: "zpl", payload: zpl }
    }
    if (type === "receipt") {
      const enc = new TextEncoder()
      const text = `\x1B@BackOffice Printer Settings\nTest receipt\n${new Date().toLocaleString()}\n\n\n\n\x1DV\x00`
      return { contentType: "escpos", payload: enc.encode(text) }
    }
    const doc = new jsPDF({ unit: "mm", format: "a4" })
    doc.setFontSize(18)
    doc.text("BackOffice Printer Settings", 20, 25)
    doc.setFontSize(12)
    doc.text("Test print", 20, 35)
    doc.text(`Document type: ${type}`, 20, 45)
    doc.text(`Time: ${new Date().toLocaleString()}`, 20, 53)
    doc.text("If you can read this, the agent printed successfully.", 20, 65)
    const arrayBuffer = doc.output("arraybuffer")
    return { contentType: "pdf", payload: arrayBuffer }
  }

  const handleTestPrint = async (type: DocumentType) => {
    const printer = activeMappings[type]
    if (!printer) return
    setTestBusy(type)
    setTestStatus((prev) => ({ ...prev, [type]: undefined }))
    try {
      const { contentType, payload } = buildTestPayload(type)
      const result = await printViaAgent({
        documentType: type,
        contentType,
        payload,
        jobName: `BackOffice-Test-${type}`,
      })
      if (result.agentUsed && result.result?.success) {
        setTestStatus((prev) => ({ ...prev, [type]: { ok: true, message: `Sent to ${printer}.` } }))
      } else {
        setTestStatus((prev) => ({
          ...prev,
          [type]: { ok: false, message: result.error || "Unknown error" },
        }))
      }
    } catch (e) {
      setTestStatus((prev) => ({
        ...prev,
        [type]: { ok: false, message: e instanceof Error ? e.message : "Test print failed" },
      }))
    } finally {
      setTestBusy(null)
    }
  }

  const customOverrideCount = Object.keys(userMappings).length
  const StatusDot = ({ tone }: { tone: "green" | "orange" | "red" }) => {
    const cls =
      tone === "green" ? "bg-green-500" : tone === "orange" ? "bg-orange-500" : "bg-red-500"
    return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Save-confirmation toast (standard app success toast) */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-[60] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[320px] max-w-[400px] animate-slide-in">
          <div className="p-4 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center ${
              toast.type === "success" ? "bg-green-100 dark:bg-green-500/10" :
              toast.type === "info" ? "bg-brand-50" : "bg-red-100"
            }`}>
              {toast.type === "success" ? (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              ) : toast.type === "info" ? (
                <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {toast.type === "success" ? "Success" : toast.type === "info" ? "Info" : "Error"}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">{toast.message}</p>
            </div>
            <button onClick={() => setToast({ show: false, message: "", type: "success" })}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="text-2xl font-semibold">Printer Settings</h1>
        <div className="text-xs text-gray-500">{userIsAdmin ? "Admin" : "User"}</div>
      </div>
      <p className="text-gray-600 text-sm mb-4">
        Configure which printer is used for each document type. Administrators set the defaults that apply
        to every user. Each user can switch to custom mode and override the defaults for this browser.
      </p>

      {lnaBlocked && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-red-900 text-sm">
          <div className="font-medium mb-1">Chrome is blocking access to the local Print Helper.</div>
          <div className="text-xs">
            Your browser is denying this page permission to reach <code className="bg-white px-1 rounded">https://localhost:9443</code>.
            The Print Helper service is likely running fine — Chrome's <strong>Local Network Access</strong> protection just
            needs to be granted for this site. To fix it on this PC:
          </div>
          <ol className="list-decimal pl-5 mt-2 text-xs space-y-1">
            <li>
              Open a new tab and paste:{" "}
              <code className="bg-white px-1 rounded">chrome://settings/content/insecurePrivateNetworkRequests</code>
            </li>
            <li>
              Under <em>Allowed to make insecure private network requests</em>, click <strong>Add</strong> and enter{" "}
              <code className="bg-white px-1 rounded">{currentOrigin}</code>
            </li>
            <li>Reload this page.</li>
          </ol>
          <div className="text-[11px] mt-2 text-red-800">
            If the setting doesn't exist in your Chrome version, click the <strong>🔒 lock icon</strong> next to the URL → <em>Site settings</em> →
            find <em>Local network devices</em> or <em>Insecure private network requests</em> → set to <strong>Allow</strong>.
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium"
            >
              I've granted permission — reload
            </button>
            <button
              type="button"
              onClick={openAgentInBrowser}
              className="px-3 py-1.5 bg-white border border-red-300 text-red-700 hover:bg-red-100 rounded text-sm"
            >
              Open localhost:9443/health in a tab
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 px-3 py-2 mb-4 bg-white border rounded-lg text-sm">
        <span className="flex items-center gap-1.5">
          <StatusDot tone={agentRunning ? "green" : "red"} />
          Agent:&nbsp;
          <span className={agentRunning ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
            {loading ? "Checking..." : agentRunning ? `Running (v${agentHealth?.version})` : "Not detected"}
          </span>
        </span>
        <span className="text-gray-300">|</span>
        <span className="flex items-center gap-1.5">
          <StatusDot tone={isPaired ? "green" : "orange"} />
          Pairing:&nbsp;
          <span className={isPaired ? "text-green-700 font-medium" : "text-orange-600 font-medium"}>
            {isPaired ? `Paired (${backendStatus?.origin ?? ""})` : "Not paired"}
          </span>
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
          >
            Refresh
          </button>
          {agentRunning && !isPaired && (
            <button
              type="button"
              onClick={handlePair}
              disabled={pairBusy}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs disabled:opacity-50"
            >
              {pairBusy ? "Pairing..." : "Pair"}
            </button>
          )}
          {agentRunning && isPaired && (
            <button
              type="button"
              onClick={handleUnpair}
              disabled={pairBusy}
              className="px-2.5 py-1 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs disabled:opacity-50"
            >
              {pairBusy ? "..." : "Unpair"}
            </button>
          )}
          {!agentRunning && (
            <button
              type="button"
              onClick={() => setShowInstallHelp((v) => !v)}
              className="px-2.5 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded text-xs"
            >
              {showInstallHelp ? "Hide install help" : "How to install"}
            </button>
          )}
        </div>
      </div>

      {stalePairing && (
        <div className="mb-3 rounded border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm">
          <div className="font-medium mb-1">This Print Helper is paired to a different site.</div>
          <div className="text-xs">
            The agent is currently paired to <code className="bg-white px-1 rounded">{agentPairedOrigin}</code>,
            but you're using it from <code className="bg-white px-1 rounded">{currentOrigin}</code>. Click the
            button below to reset the pairing and pair this browser instead.
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleForceRepair}
              disabled={pairBusy}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm font-medium disabled:opacity-50"
            >
              {pairBusy ? "Re-pairing..." : "Re-pair to this browser"}
            </button>
            <span className="text-[11px] text-amber-800">
              Safe — this only resets the pairing record on the local agent; printer settings are kept.
            </span>
          </div>
        </div>
      )}

      {(error || pairMessage) && (
        <div className="mb-3 text-sm space-y-2">
          {error && <div className="text-red-600">Error: {error}</div>}
          {pairMessage && /only a localhost|localhost origin|paired origin|not authorized to reset/i.test(pairMessage) ? (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
              <div className="font-medium mb-1">Pairing reset blocked by the local agent.</div>
              <div className="text-xs">
                The agent on this PC is an older build that only allows pairing reset from a localhost origin.
                Update the Print Helper to the latest version, or run these commands once in an Administrator
                PowerShell:
              </div>
              <pre className="mt-2 text-[11px] bg-white border rounded px-2 py-1.5 whitespace-pre-wrap break-all">
{`Stop-Service BackOfficePrintAgent
Remove-Item "$env:PROGRAMDATA\\BackOfficePrintAgent\\pairing.json" -Force
Start-Service BackOfficePrintAgent`}
              </pre>
              <div className="text-xs mt-2">Then reload this page and click <strong>Re-pair to this browser</strong>.</div>
            </div>
          ) : (
            pairMessage && <div className="text-gray-700">{pairMessage}</div>
          )}
        </div>
      )}

      {!agentRunning && showInstallHelp && (
        <section className="mb-4 border rounded-lg bg-yellow-50 border-yellow-300 text-sm overflow-hidden">
          <div className="px-4 py-2 bg-yellow-100 border-b border-yellow-200 font-medium text-yellow-900">
            Pair this PC with the Print Helper service
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-yellow-200 text-yellow-900 font-semibold flex items-center justify-center flex-shrink-0">1</div>
              <div className="flex-1">
                <div className="font-medium">Download &amp; install the Print Helper</div>
                <div className="text-xs text-gray-600 mb-2">Run as Administrator. Registers a Windows service called <code className="bg-white px-1 rounded">BackOfficePrintAgent</code>.</div>
                {installerInfo === null && (
                  <button type="button" disabled className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm opacity-60 cursor-not-allowed">
                    Checking installer...
                  </button>
                )}
                {installerInfo && installerInfo.available && (
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={installerInfo.downloadUrl || API_ENDPOINTS.PRINT_AGENT.INSTALLER}
                      download={installerInfo.fileName || "BackOfficePrintAgentSetup.exe"}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
                    >
                      Download Installer
                    </a>
                    <span className="text-xs text-gray-600">
                      {installerInfo.fileName}
                      {installerInfo.version ? ` (v${installerInfo.version})` : ""}
                      {installerInfo.sizeBytes ? ` - ${formatBytes(installerInfo.sizeBytes)}` : ""}
                    </span>
                  </div>
                )}
                {installerInfo && !installerInfo.available && (
                  <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                    Installer not available on this server. Contact your administrator to upload <code>BackOfficePrintAgentSetup.exe</code>.
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-yellow-200 text-yellow-900 font-semibold flex items-center justify-center flex-shrink-0">2</div>
              <div className="flex-1">
                <div className="font-medium">Accept the local certificate (one-time)</div>
                <div className="text-xs text-gray-600 mb-2">
                  The agent uses a self-signed certificate on <code className="bg-white px-1 rounded">https://localhost:9443</code>. Open the link below, click <em>Advanced</em> → <em>Proceed</em> if Chrome warns. You should see a small JSON response.
                </div>
                <button
                  type="button"
                  onClick={openAgentInBrowser}
                  className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 rounded text-sm font-medium"
                >
                  Open https://localhost:9443/health
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-yellow-200 text-yellow-900 font-semibold flex items-center justify-center flex-shrink-0">3</div>
              <div className="flex-1">
                <div className="font-medium">Test the connection</div>
                <div className="text-xs text-gray-600 mb-2">After step 2, click below. If everything is right, the status strip above flips to <span className="text-green-700 font-medium">Agent: Running</span>. If it fails, you'll see the underlying error so we know what to fix.</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={diagBusy}
                    className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 rounded text-sm font-medium disabled:opacity-50"
                  >
                    {diagBusy ? "Testing..." : "Test agent connection"}
                  </button>
                  <button
                    type="button"
                    onClick={refresh}
                    className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 rounded text-sm"
                  >
                    Refresh status
                  </button>
                </div>
                {diagResult && (
                  <div
                    className={`mt-2 text-xs rounded border p-2 ${
                      diagResult.ok
                        ? "bg-green-50 border-green-200 text-green-800"
                        : "bg-red-50 border-red-200 text-red-800"
                    }`}
                  >
                    {diagResult.ok ? (
                      <>
                        <div className="font-medium mb-1">Connected (HTTP {diagResult.status}). The agent responded:</div>
                        <pre className="whitespace-pre-wrap break-all text-[11px] bg-white/60 rounded px-2 py-1">{diagResult.raw}</pre>
                      </>
                    ) : (
                      <>
                        <div className="font-medium mb-1">Couldn't reach the agent.</div>
                        <div className="font-mono text-[11px] break-all bg-white/60 rounded px-2 py-1">{diagResult.error || `HTTP ${diagResult.status ?? "?"}`}</div>
                        <div className="mt-2 text-[11px] text-red-900">
                          Most common causes:
                          <ul className="list-disc pl-4 mt-1 space-y-0.5">
                            <li><strong>Cert not accepted in this browser profile</strong> — open <button type="button" onClick={openAgentInBrowser} className="underline">https://localhost:9443/health</button>, click <em>Advanced → Proceed</em>, then test again.</li>
                            <li><strong>Wrong origin</strong> — the agent only accepts pre-configured origins (see <code>appsettings.json → Agent.AllowedOrigins</code>). Currently the page is on <code className="bg-white px-1 rounded">{typeof window !== "undefined" ? window.location.origin : ""}</code>.</li>
                            <li><strong>Service stopped</strong> — open <em>services.msc</em> and confirm <em>BackOffice Print Agent</em> is Running.</li>
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-yellow-200 text-yellow-900 font-semibold flex items-center justify-center flex-shrink-0">4</div>
              <div className="flex-1">
                <div className="font-medium">Pair this browser</div>
                <div className="text-xs text-gray-600 mb-2">
                  The <strong>Pair</strong> button appears in the status strip above as soon as the agent is detected. It's hidden right now because the agent isn't reachable yet — finish step 2.
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="flex border-b" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "default"}
            onClick={() => handleModeChange("default")}
            className={`flex-1 px-4 py-3 text-sm font-medium text-left transition-colors ${
              mode === "default"
                ? "bg-white text-blue-700 border-b-2 border-blue-600 -mb-px"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100 border-b-2 border-transparent"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span>Default settings</span>
              <span className="text-xs font-normal text-gray-500">admin-managed</span>
            </div>
            <div className="text-xs font-normal text-gray-500 mt-0.5">Apply to all users in this tenant</div>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "custom"}
            onClick={() => handleModeChange("custom")}
            className={`flex-1 px-4 py-3 text-sm font-medium text-left transition-colors ${
              mode === "custom"
                ? "bg-white text-blue-700 border-b-2 border-blue-600 -mb-px"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100 border-b-2 border-transparent"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span>My custom settings</span>
              {customOverrideCount > 0 && (
                <span className="text-xs font-medium px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                  {customOverrideCount} override{customOverrideCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="text-xs font-normal text-gray-500 mt-0.5">Override defaults on this browser</div>
          </button>
        </div>

        {fieldsDisabled && (
          <div className="px-4 py-2 text-xs text-amber-800 bg-amber-50 border-b border-amber-200">
            Read-only — only administrators can edit defaults. Switch to <em>My custom settings</em> to
            override on this browser.
          </div>
        )}
        {printers.length === 0 && roster.length === 0 ? (
          <div className="px-4 py-2 text-xs text-gray-700 bg-gray-50 border-b">
            No printers detected. Pair the Print Helper agent to enumerate them automatically, or add
            them manually below — they'll appear in every dropdown.
          </div>
        ) : printersFromCache ? (
          <div className="px-4 py-2 text-xs text-gray-700 bg-gray-50 border-b">
            Showing remembered printers from your last agent session{roster.length > 0 ? " plus your manual list" : ""}.
            Pair the Print Helper agent to refresh.
          </div>
        ) : null}

        <div className="px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-medium text-gray-800">Manual printer list</div>
              <div className="text-xs text-gray-500">
                Add printer names by hand. They'll show up in every dropdown, even when the Print Helper agent isn't running.
              </div>
            </div>
            <span className="text-xs text-gray-500">
              {roster.length} manual{roster.length === 1 ? "" : "s"} · {printers.length} from agent
            </span>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const trimmed = newPrinterName.trim()
              if (!trimmed) return
              setRoster(printerRoster.add(trimmed))
              setNewPrinterName("")
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={newPrinterName}
              onChange={(e) => setNewPrinterName(e.target.value)}
              placeholder="Printer name (e.g. ZDesigner TLP 2844-Z)"
              disabled={fieldsDisabled}
              className="flex-1 border rounded px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={fieldsDisabled || !newPrinterName.trim()}
              className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add printer
            </button>
          </form>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-xs text-gray-500">Quick add:</span>
              {suggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setRoster(printerRoster.add(name))
                  }}
                  disabled={fieldsDisabled}
                  className="px-2 py-0.5 text-xs rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={`Add ${name}`}
                >
                  + {name}
                </button>
              ))}
            </div>
          )}
          {roster.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {roster.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs rounded-full bg-white border text-gray-700"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => {
                      setRoster(printerRoster.remove(name))
                    }}
                    disabled={fieldsDisabled}
                    className="w-4 h-4 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={`Remove ${name}`}
                    aria-label={`Remove ${name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        {mode === "custom" && customOverrideCount > 0 && (
          <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-600 bg-gray-50 border-b">
            <span>You have {customOverrideCount} override{customOverrideCount === 1 ? "" : "s"} on this browser.</span>
            <button
              type="button"
              onClick={handleResetCustom}
              className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50"
            >
              Reset overrides
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-4 py-2 w-72">Document Type</th>
                <th className="text-left font-medium px-4 py-2">Printer</th>
                <th className="text-left font-medium px-4 py-2 w-32">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {DOCUMENT_TYPES.map(({ key, label, description }) => {
                const status = testStatus[key]
                const isTesting = testBusy === key
                const value = editingDefault
                  ? defaultMappings[key] || ""
                  : userMappings[key] || ""
                const effective = activeMappings[key]
                const canTest = !!effective && !isTesting && agentRunning && isPaired
                const placeholder = editingDefault
                  ? "— Use browser print dialog —"
                  : defaultMappings[key]
                  ? `— Use default (${defaultMappings[key]}) —`
                  : "— Use default (browser print dialog) —"
                return (
                  <tr key={key} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 align-top">
                      <div className="font-medium text-gray-900">{label}</div>
                      <div className="text-xs text-gray-500">{description}</div>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      {(() => {
                        const inOptions = !!value && printerOptions.some((p) => p.name === value)
                        const isManual = manualEntry[key] || (!!value && !inOptions)
                        const fallbackOption =
                          !isManual && value && !inOptions
                            ? [{ name: value, isDefault: false, source: "manual" as const }]
                            : []
                        const opts = [...printerOptions, ...fallbackOption]
                        return (
                          <div className="flex items-center gap-2">
                            {isManual ? (
                              <input
                                type="text"
                                value={value}
                                onChange={(e) => handleMappingChange(key, e.target.value)}
                                disabled={fieldsDisabled}
                                placeholder="Type printer name (e.g. HP LaserJet M404)"
                                className="flex-1 border rounded px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                              />
                            ) : (
                              <select
                                value={value}
                                onChange={(e) => handleMappingChange(key, e.target.value)}
                                disabled={fieldsDisabled}
                                className="flex-1 border rounded px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                              >
                                <option value="">{placeholder}</option>
                                {opts.map((p) => (
                                  <option key={p.name} value={p.name}>
                                    {p.name}
                                    {p.isDefault ? " (Windows default)" : ""}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setManualEntry((prev) => ({ ...prev, [key]: !isManual }))
                                if (isManual) handleMappingChange(key, "")
                              }}
                              disabled={fieldsDisabled}
                              className="text-xs text-blue-700 hover:text-blue-800 underline whitespace-nowrap disabled:opacity-40"
                              title={isManual ? "Pick from list" : "Type printer name manually"}
                            >
                              {isManual ? "Pick from list" : "Type"}
                            </button>
                          </div>
                        )
                      })()}
                      {status && (
                        <div className={`text-xs mt-1 ${status.ok ? "text-green-700" : "text-red-600"}`}>
                          {status.ok ? "Test sent: " : "Test failed: "}
                          {status.message}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <button
                        type="button"
                        onClick={() => handleTestPrint(key)}
                        disabled={!canTest}
                        className="w-full px-3 py-1.5 text-sm rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        title={
                          effective
                            ? "Send a test page to this printer"
                            : "Select a printer first or pair the agent"
                        }
                      >
                        {isTesting ? "Sending..." : "Test print"}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
