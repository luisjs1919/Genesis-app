import { useEffect, useMemo } from "react";

export function useSyncedTplTaxId(
  tplTaxId: string | undefined,
  updateTpl: (patch: Record<string, any>) => void,
  activeRif?: string | null
) {
  const normalizedActiveRif = useMemo(() => {
    const clean = (activeRif || "").trim();
    return clean.length > 0 ? clean : null;
  }, [activeRif]);

  const isRifLocked = Boolean(normalizedActiveRif);
  const lockedRif = normalizedActiveRif || "";

  useEffect(() => {
    if (normalizedActiveRif && tplTaxId !== normalizedActiveRif) {
      updateTpl({ taxId: normalizedActiveRif });
    }
  }, [normalizedActiveRif, tplTaxId, updateTpl]);

  return {
    isRifLocked,
    lockedRif
  };
}
