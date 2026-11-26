export function normalizeRif(value: string): string {
  const cleaned = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (!cleaned) return "";

  const prefixMatch = cleaned.match(/^([VEJPGC])([0-9]+)$/);
  if (prefixMatch) {
    return `${prefixMatch[1]}-${prefixMatch[2]}`;
  }

  return cleaned;
}

export function isValidRif(value: string): boolean {
  const normalized = normalizeRif(value);
  return /^[VEJPGC]-[0-9]{6,12}$/.test(normalized);
}
