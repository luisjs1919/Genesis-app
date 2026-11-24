// lib/adminAuth.ts
export const ADMIN_PASSWORD_DEFAULT = "admin1";

export function verificarClaveAdmin(
  claveIngresada: string,
  clavesAdicionales: string[] = []
): boolean {
  const limpia = claveIngresada.trim();
  if (!limpia) return false;

  const claveConfigurada =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_GENESIS_ADMIN_PASS) ||
    ADMIN_PASSWORD_DEFAULT;

  const permitidas = [claveConfigurada.trim(), ...clavesAdicionales.map((c) => c.trim())]
    .filter(Boolean);

  return permitidas.includes(limpia);
}
