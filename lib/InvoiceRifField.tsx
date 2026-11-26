import React from "react";
import { resolveActiveCommerceRif } from "@/lib/useSyncedInvoiceRif";

interface InvoiceRifFieldProps {
  invoiceHeader: Record<string, any>;
  setInvoiceHeader: React.Dispatch<React.SetStateAction<any>>;
  sessionRif?: string | null;
  commerceRif?: string | null;
  persistedRif?: string | null;
  className?: string;
  inputClassName?: string;
}

function useSyncedInvoiceRif(
  activeRif: string,
  setInvoiceHeader: React.Dispatch<React.SetStateAction<any>>
) {
  const lockedRif = (activeRif || "").trim();
  const isRifLocked = Boolean(lockedRif);

  React.useEffect(() => {
    if (!lockedRif) return;

    setInvoiceHeader((prev: any) => {
      const currentRif = String(prev?.rif ?? "").trim();
      const currentTaxId = String(prev?.taxId ?? "").trim();
      if (currentRif === lockedRif && currentTaxId === lockedRif) {
        return prev;
      }

      const next: Record<string, any> = { ...prev };
      if (Object.prototype.hasOwnProperty.call(prev || {}, "rif") || !Object.prototype.hasOwnProperty.call(prev || {}, "taxId")) {
        next.rif = lockedRif;
      }
      if (Object.prototype.hasOwnProperty.call(prev || {}, "taxId")) {
        next.taxId = lockedRif;
      }
      return next;
    });
  }, [lockedRif, setInvoiceHeader]);

  return { isRifLocked, lockedRif };
}

export function InvoiceRifField({
  invoiceHeader,
  setInvoiceHeader,
  sessionRif,
  commerceRif,
  persistedRif,
  className = "",
  inputClassName = "",
}: InvoiceRifFieldProps) {
  const propRif = resolveActiveCommerceRif(sessionRif, commerceRif, persistedRif);
  const { isRifLocked, lockedRif } = useSyncedInvoiceRif(propRif, setInvoiceHeader);

  const displayedValue =
    invoiceHeader?.rif || invoiceHeader?.taxId || lockedRif || "";

  return (
    <div className={className}>
      <label className="block text-sm font-medium">
        RIF / Identificación fiscal
      </label>
      <input
        type="text"
        value={displayedValue}
        readOnly={isRifLocked}
        aria-readonly={isRifLocked}
        onChange={(e) => {
          if (isRifLocked) return;
          const val = e.target.value;
          setInvoiceHeader((prev: any) => ({
            ...prev,
            ...(Object.prototype.hasOwnProperty.call(prev || {}, "rif")
              ? { rif: val }
              : {}),
            ...(Object.prototype.hasOwnProperty.call(prev || {}, "taxId")
              ? { taxId: val }
              : !Object.prototype.hasOwnProperty.call(prev || {}, "rif")
              ? { rif: val }
              : {}),
          }));
        }}
        placeholder="Ej. J-40123456-7"
        className={`${inputClassName} ${
          isRifLocked ? "cursor-not-allowed opacity-80" : ""
        }`.trim()}
      />
    </div>
  );
}