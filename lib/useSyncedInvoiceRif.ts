import { useEffect, useState } from 'react';
import { normalizeRif } from './rif';
export function resolveActiveCommerceRif(...c: Array<string | null | undefined>): string {
  for (const x of c) { const n = normalizeRif(String(x || '')); if (n) return n; }
  return '';
}
export function detectStoredRifFromBrowser(): string {
  if (typeof window === 'undefined') return '';
  for (const k of ['genesis_active_rif','genesis_rif','activeRif','commerceRif','rif']) {
    const n = normalizeRif(String(window.localStorage.getItem(k) || window.sessionStorage.getItem(k) || ''));
    if (n) return n;
  }
  for (const k of ['genesis_session','genesis_commerce','genesis_app_state','app_state','session','commerce']) {
    const raw = window.localStorage.getItem(k) || window.sessionStorage.getItem(k);
    if (!raw) continue;
    try {
      const p = JSON.parse(raw);
      for (const c of [p?.rif,p?.taxId,p?.activeRif,p?.commerce?.rif,p?.session?.rif,p?.invoiceHeader?.rif,p?.app_state?.rif]) {
        const n = normalizeRif(String(c || ''));
        if (n) return n;
      }
    } catch {}
  }
  return '';
}
export function useSyncedTplTaxId(currentTaxId: string | null | undefined, updateTpl: (patch: Record<string, any>) => void, explicitRif?: string | null) {
  const [browserRif, setBrowserRif] = useState('');
  useEffect(() => { setBrowserRif(detectStoredRifFromBrowser()); }, []);
  const lockedRif = resolveActiveCommerceRif(explicitRif, browserRif);
  const isRifLocked = Boolean(lockedRif);
  useEffect(() => {
    if (!lockedRif) return;
    if (normalizeRif(String(currentTaxId || '')) !== lockedRif || currentTaxId !== lockedRif) {
      updateTpl({ taxId: lockedRif });
    }
  }, [lockedRif, currentTaxId, updateTpl]);
  return { lockedRif, isRifLocked };
}
