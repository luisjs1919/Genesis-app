import { useEffect } from "react";
import { normalizeRif } from "./rif";

export interface InvoiceHeaderState {
  companyName?: string;
  rif: string;
  address?: string;
  phone?: string;
  email?: string;
  [key: string]: unknown;
}

/**
 * Sincroniza automáticamente el RIF afiliado/activo en el estado del membrete
 * de la factura y devuelve si debe permanecer bloqueado en la interfaz.
 */
export function useSyncedInvoiceRif<T extends InvoiceHeaderState>(
  rawActiveRif: string | null | undefined,
  setInvoiceHeader: React.Dispatch<React.SetStateAction<T>>
): { lockedRif: string; isRifLocked: boolean } {
  const lockedRif = normalizeRif(String(rawActiveRif || ""));
  const isRifLocked = Boolean(lockedRif);

  useEffect(() => {
    if (!lockedRif) return;

    setInvoiceHeader((prev) => {
      const currentNormalized = normalizeRif(String(prev?.rif || ""));
      if (currentNormalized === lockedRif && prev.rif === lockedRif) {
        return prev;
      }
      return {
        ...prev,
        rif: lockedRif,
      };
    });
  }, [lockedRif, setInvoiceHeader]);

  return { lockedRif, isRifLocked };
}
