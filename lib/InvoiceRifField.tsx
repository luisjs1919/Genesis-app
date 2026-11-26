import React from "react";
import { resolveActiveCommerceRif, useSyncedInvoiceRif } from "@/lib/useSyncedInvoiceRif";

interface InvoiceRifFieldProps {
  invoiceHeader: Record<string, any>;
  setInvoiceHeader: React.Dispatch<React.SetStateAction<any>>;
  sessionRif?: string | null;
  commerceRif?: string | null;
  persistedRif?: string | null;
  className?: string;
  inputClassName?: string;
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
