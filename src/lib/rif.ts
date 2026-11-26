export interface LocalCommerceConfig {
  companyName: string;
  rif: string;
  rifLocked: boolean;
  lockedAt?: string;
}

const STORAGE_KEY = "genesis_local_commerce_config_v1";

/**
 * Normaliza un RIF venezolano o alfanumérico a un formato canónico (ej. J-5040363636).
 */
export function normalizeRif(rawRif: string): string {
  const cleaned = rawRif
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (!cleaned) return "";

  const match = cleaned.match(/^([A-Z])(\d+)$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  return cleaned;
}

export function isValidRif(rif: string): boolean {
  const normalized = normalizeRif(rif);
  return /^[VEJGPC]-\d{5,12}$/.test(normalized);
}

/**
 * Convierte el RIF en un nombre de carpeta seguro para Windows.
 */
export function rifToFolderName(rif: string): string {
  return normalizeRif(rif).replace(/[<>:"/\\|?*]/g, "_");
}

export function getLocalCommerceConfig(): LocalCommerceConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalCommerceConfig;
    if (!parsed.rif) return null;
    return {
      companyName: parsed.companyName || "",
      rif: normalizeRif(parsed.rif),
      rifLocked: Boolean(parsed.rifLocked),
      lockedAt: parsed.lockedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Guarda la configuración inicial. Si rifLocked ya está activo,
 * impide cambiar el RIF y solo permite actualizar el nombre de empresa.
 */
export function saveLocalCommerceConfig(input: {
  companyName: string;
  rif: string;
  confirmLock?: boolean;
}): { ok: boolean; error?: string; config?: LocalCommerceConfig } {
  const companyName = input.companyName.trim();
  if (companyName.length < 2) {
    return { ok: false, error: "Ingresa el nombre de la empresa." };
  }

  const current = getLocalCommerceConfig();

  if (current?.rifLocked) {
    const updated: LocalCommerceConfig = {
      companyName,
      rif: current.rif,
      rifLocked: true,
      lockedAt: current.lockedAt || new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return { ok: true, config: updated };
  }

  const normalizedRif = normalizeRif(input.rif);
  if (!isValidRif(normalizedRif)) {
    return {
      ok: false,
      error: "RIF inválido. Usa un formato como J-5040363636, V-12345678 o G-200012340.",
    };
  }

  if (!input.confirmLock) {
    return {
      ok: false,
      error: "Debes confirmar que el RIF no podrá modificarse después.",
    };
  }

  const nextConfig: LocalCommerceConfig = {
    companyName,
    rif: normalizedRif,
    rifLocked: true,
    lockedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig));
  return { ok: true, config: nextConfig };
}
