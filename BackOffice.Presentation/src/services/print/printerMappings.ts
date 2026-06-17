import {
  DocumentType,
  PRINTER_DEFAULT_MAPPINGS_KEY,
  PRINTER_PREF_STORAGE_KEY,
  PRINTER_USER_MAPPINGS_KEY_PREFIX,
  PRINTER_USE_CUSTOM_KEY_PREFIX,
} from "./types"

type Mappings = Partial<Record<DocumentType, string>>

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(value))
}

function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("userData")
    if (!raw) return null
    const parsed = JSON.parse(raw) as { userId?: number | string }
    return parsed?.userId != null ? String(parsed.userId) : null
  } catch {
    return null
  }
}

function userMappingsKey(userId: string): string {
  return `${PRINTER_USER_MAPPINGS_KEY_PREFIX}${userId}`
}

function useCustomKey(userId: string): string {
  return `${PRINTER_USE_CUSTOM_KEY_PREFIX}${userId}`
}

function readDefault(): Mappings {
  return readJson<Mappings>(PRINTER_DEFAULT_MAPPINGS_KEY, {})
}

function writeDefault(value: Mappings): void {
  writeJson(PRINTER_DEFAULT_MAPPINGS_KEY, value)
}

function readUser(userId: string): Mappings {
  return readJson<Mappings>(userMappingsKey(userId), {})
}

function writeUser(userId: string, value: Mappings): void {
  writeJson(userMappingsKey(userId), value)
}

function readUseCustom(userId: string): boolean {
  return readJson<boolean>(useCustomKey(userId), false)
}

function writeUseCustom(userId: string, useCustom: boolean): void {
  writeJson(useCustomKey(userId), useCustom)
}

function readLegacy(): Mappings {
  return readJson<Mappings>(PRINTER_PREF_STORAGE_KEY, {})
}

function writeLegacy(value: Mappings): void {
  writeJson(PRINTER_PREF_STORAGE_KEY, value)
}

function effectiveMappings(): Mappings {
  const userId = getCurrentUserId()
  const defaults = readDefault()
  if (!userId) {
    return { ...readLegacy(), ...defaults }
  }
  if (readUseCustom(userId)) {
    return { ...defaults, ...readUser(userId) }
  }
  return { ...defaults }
}

export const printerMappings = {
  getAll(): Mappings {
    return effectiveMappings()
  },
  get(documentType: DocumentType): string | undefined {
    return effectiveMappings()[documentType]
  },
  set(documentType: DocumentType, printerName: string | null): void {
    const userId = getCurrentUserId()
    if (userId && readUseCustom(userId)) {
      const current = readUser(userId)
      if (!printerName) delete current[documentType]
      else current[documentType] = printerName
      writeUser(userId, current)
    } else {
      const current = readDefault()
      if (!printerName) delete current[documentType]
      else current[documentType] = printerName
      writeDefault(current)
    }
    const legacy = readLegacy()
    if (!printerName) delete legacy[documentType]
    else legacy[documentType] = printerName
    writeLegacy(legacy)
  },

  getDefaultMappings(): Mappings {
    return readDefault()
  },
  setDefaultMapping(documentType: DocumentType, printerName: string | null): void {
    const current = readDefault()
    if (!printerName) delete current[documentType]
    else current[documentType] = printerName
    writeDefault(current)
  },

  getUserMappings(): Mappings {
    const userId = getCurrentUserId()
    return userId ? readUser(userId) : {}
  },
  setUserMapping(documentType: DocumentType, printerName: string | null): void {
    const userId = getCurrentUserId()
    if (!userId) return
    const current = readUser(userId)
    if (!printerName) delete current[documentType]
    else current[documentType] = printerName
    writeUser(userId, current)
  },
  resetUserMappings(): void {
    const userId = getCurrentUserId()
    if (!userId) return
    writeUser(userId, {})
  },

  getUseCustom(): boolean {
    const userId = getCurrentUserId()
    return userId ? readUseCustom(userId) : false
  },
  setUseCustom(useCustom: boolean): void {
    const userId = getCurrentUserId()
    if (!userId) return
    writeUseCustom(userId, useCustom)
  },
}

export default printerMappings
