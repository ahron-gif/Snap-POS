/** Coerce API/JSON or input values to a finite number. */
export function coerceItemNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback
  const s = String(value).trim().replace(/,/g, "")
  if (s === "") return fallback
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : fallback
}

/** Parse typed money / decimal fields (avoids "099" artifacts from stringy state). */
export function parseMoneyTypedInput(raw: string): number {
  const t = raw.replace(/,/g, "").trim()
  if (t === "" || t === "." || t === "-" || t === "-.") return 0
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

/** Canonical display for decimal money / percent inputs. */
export function formatMoneyTypedFromNumber(n: number): string {
  if (!Number.isFinite(n)) return ""
  const rounded = Number(n.toFixed(4))
  if (Object.is(rounded, -0)) return "0"
  return String(rounded)
}

/** Integer qty-style fields. */
export function formatQtyTypedFromNumber(n: number): string {
  if (!Number.isFinite(n)) return ""
  return String(Math.trunc(n))
}

export function parseQtyTypedInput(raw: string): number {
  const t = raw.replace(/[^\d-]/g, "")
  if (t === "" || t === "-") return 0
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : 0
}
