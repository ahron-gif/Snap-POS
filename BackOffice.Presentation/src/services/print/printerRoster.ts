import { PRINTER_MANUAL_ROSTER_KEY } from "./types"

const SEED_KEY = "backoffice.printer.manualRoster.seeded"

const COMMON_WINDOWS_PRINTERS = [
  "Microsoft Print to PDF",
  "Microsoft XPS Document Writer",
  "OneNote (Desktop)",
  "Fax",
  "Save as PDF",
]

const COMMON_HARDWARE_SUGGESTIONS = [
  "ZDesigner TLP 2844-Z",
  "HP Universal Printing PS",
  "Bullzip PDF Printer",
  "AnyDesk Printer",
]

function read(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(PRINTER_MANUAL_ROSTER_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
  } catch {
    return []
  }
}

function write(value: string[]): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(PRINTER_MANUAL_ROSTER_KEY, JSON.stringify(value))
  } catch {
    /* ignore quota errors */
  }
}

function hasBeenSeeded(): boolean {
  if (typeof window === "undefined") return true
  try {
    return localStorage.getItem(SEED_KEY) === "1"
  } catch {
    return true
  }
}

function markSeeded(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(SEED_KEY, "1")
  } catch {
    /* ignore */
  }
}

function ensureSeeded(): string[] {
  if (hasBeenSeeded()) return read()
  const current = read()
  const merged = [...current]
  COMMON_WINDOWS_PRINTERS.forEach((name) => {
    if (!merged.some((n) => n.toLowerCase() === name.toLowerCase())) {
      merged.push(name)
    }
  })
  merged.sort((a, b) => a.localeCompare(b))
  write(merged)
  markSeeded()
  return merged
}

export const printerRoster = {
  getAll(): string[] {
    return ensureSeeded()
  },
  add(name: string): string[] {
    const trimmed = name.trim()
    if (!trimmed) return read()
    const current = ensureSeeded()
    if (current.some((n) => n.toLowerCase() === trimmed.toLowerCase())) return current
    const next = [...current, trimmed].sort((a, b) => a.localeCompare(b))
    write(next)
    return next
  },
  remove(name: string): string[] {
    const next = ensureSeeded().filter((n) => n.toLowerCase() !== name.trim().toLowerCase())
    write(next)
    return next
  },
  suggestions(): string[] {
    const current = ensureSeeded()
    return [...COMMON_WINDOWS_PRINTERS, ...COMMON_HARDWARE_SUGGESTIONS].filter(
      (name) => !current.some((n) => n.toLowerCase() === name.toLowerCase())
    )
  },
}

export default printerRoster
