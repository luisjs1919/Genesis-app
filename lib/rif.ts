export function normalizeRif(value: string): string {
  const cleaned = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return "";
  const m = cleaned.match(/^([VEJPGC])([0-9]+)$/);
  return m ? `${m[1]}-${m[2]}` : cleaned;
}