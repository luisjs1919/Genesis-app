import React from "react";
import { useSyncedTplTaxId } from "@/lib/useSyncedInvoiceRif";

interface TplTaxIdFieldProps {
  tpl: { taxId?: string; [key: string]: any };
  updateTpl: (patch: Record<string, any>) => void;
  isDark?: boolean;
  activeRif?: string | null;
}
export function TplTaxIdField({ tpl, updateTpl, isDark = true, activeRif }: TplTaxIdFieldProps) {
  const { isRifLocked, lockedRif } = useSyncedTplTaxId(tpl?.taxId, updateTpl, activeRif);
  const displayedValue = tpl?.taxId || lockedRif || "";
  return (
    <div>
      <label className="block text-[11px] text-gray-500 mb-1">RIF / Identificación fiscal</label>
      <input
        type="text"
        value={displayedValue}
        readOnly={isRifLocked}
        aria-readonly={isRifLocked}
        onChange={(e) => { if (!isRifLocked) updateTpl({ taxId: e.target.value }); }}
        placeholder="Ej. J-40123456-7"
        className={`w-full px-3 py-2 rounded-lg border tabular-nums outline-none ${isDark ? "bg-gray-950 border-gray-700" : "bg-[#F8FAFF] border-gray-300"} ${isRifLocked ? "cursor-not-allowed opacity-80" : ""}`}
      />
    </div>
  );
}