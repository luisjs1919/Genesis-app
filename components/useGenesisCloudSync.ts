'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  CloudBusinessRecord,
  loadActiveBusinessCloudState,
  normalizeRif,
  saveBusinessCloudState,
} from '../lib/cloudSync';

interface UseGenesisCloudSyncParams {
  state: any;
  setState: React.Dispatch<React.SetStateAction<any>>;
  localStorageKey?: string;
}

function hasMeaningfulCloudState(cloudState: Record<string, any> | null): boolean {
  if (!cloudState || typeof cloudState !== 'object') return false;
  return Boolean(
    Array.isArray(cloudState.transactions) && cloudState.transactions.length > 0 ||
    Array.isArray(cloudState.products) && cloudState.products.length > 0 ||
    Array.isArray(cloudState.salesHistory) && cloudState.salesHistory.length > 0 ||
    Array.isArray(cloudState.receivables) && cloudState.receivables.length > 0 ||
    Array.isArray(cloudState.payables) && cloudState.payables.length > 0 ||
    Array.isArray(cloudState.generalExpenses) && cloudState.generalExpenses.length > 0 ||
    Array.isArray(cloudState.blocks) && cloudState.blocks.length > 0 ||
    cloudState.businessName ||
    cloudState.businessRif ||
    cloudState.taxId ||
    cloudState.invoiceTemplate?.taxId ||
    cloudState.invoiceTemplate?.businessName
  );
}

export function useGenesisCloudSync({
  state,
  setState,
  localStorageKey = 'genesis_business_dashboard_v1',
}: UseGenesisCloudSyncParams) {
  const cloudBusinessIdRef = useRef<string | null>(null);
  const isHydratingCloudRef = useRef<boolean>(false);
  const lastSavedSignatureRef = useRef<string>('');

  const applyCloudRecordToState = useCallback(
    (record: CloudBusinessRecord) => {
      cloudBusinessIdRef.current = record.id;

      const cloudState =
        record.app_state && typeof record.app_state === 'object'
          ? (record.app_state as Record<string, any>)
          : null;

      const resolvedRif = normalizeRif(
        record.tax_id ||
          cloudState?.businessRif ||
          cloudState?.taxId ||
          cloudState?.invoiceTemplate?.taxId ||
          ''
      );
      const resolvedName =
        record.name ||
        cloudState?.businessName ||
        cloudState?.invoiceTemplate?.businessName ||
        'Genesis-app';

      if (hasMeaningfulCloudState(cloudState) || resolvedRif || resolvedName) {
        isHydratingCloudRef.current = true;
        setState((prev: any) => {
          const merged = {
            ...(prev || {}),
            ...(cloudState || {}),
            businessName: resolvedName || prev?.businessName || 'Genesis-app',
            businessRif: resolvedRif || prev?.businessRif || '',
            taxId: resolvedRif || prev?.taxId || '',
            bcvUsdRate:
              typeof record.bcv_usd_rate === 'number' && record.bcv_usd_rate > 1
                ? record.bcv_usd_rate
                : cloudState?.bcvUsdRate ?? prev?.bcvUsdRate ?? 46.8,
            bcvEurRate:
              typeof record.bcv_eur_rate === 'number' && record.bcv_eur_rate > 1
                ? record.bcv_eur_rate
                : cloudState?.bcvEurRate ?? prev?.bcvEurRate ?? 50.4,
            invoiceTemplate: {
              ...(prev?.invoiceTemplate || {}),
              ...(cloudState?.invoiceTemplate || {}),
              businessName: resolvedName,
              taxId: resolvedRif,
            },
          };

          const serialized = JSON.stringify(merged);
          lastSavedSignatureRef.current = `${record.id}::${resolvedRif}::${serialized}`;

          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(localStorageKey, serialized);
              window.localStorage.setItem('genesis_app_v13_state', serialized);
              window.localStorage.setItem('genesis_business_dashboard_v1', serialized);
            } catch {
              // Ignorar errores de almacenamiento local
            }
          }

          return merged;
        });
      }
    },
    [setState, localStorageKey]
  );

  // Guarda caché local rápida en las claves usadas por la app
  useEffect(() => {
    if (!state || typeof window === 'undefined') return;
    try {
      const serialized = JSON.stringify(state);
      window.localStorage.setItem(localStorageKey, serialized);
      window.localStorage.setItem('genesis_app_v13_state', serialized);
      window.localStorage.setItem('genesis_business_dashboard_v1', serialized);
    } catch {
      // Ignorar errores de cuota o modo privado
    }
  }, [state, localStorageKey]);

  // Sincroniza cambios hacia public.businesses en Supabase (con debounce de 700ms)
  useEffect(() => {
    if (!state) return;

    if (isHydratingCloudRef.current) {
      isHydratingCloudRef.current = false;
      return;
    }

    const bizId = cloudBusinessIdRef.current;
    const rawRif =
      state?.invoiceTemplate?.taxId || state?.businessRif || state?.taxId || '';
    const currentRif = normalizeRif(String(rawRif));
    if (!bizId || !currentRif) return;

    const bizName =
      state?.businessName || state?.invoiceTemplate?.businessName || 'Genesis-app';

    const normalizedPayloadState = {
      ...state,
      businessName: bizName,
      businessRif: currentRif,
      taxId: currentRif,
      invoiceTemplate: {
        ...(state?.invoiceTemplate || {}),
        businessName: bizName,
        taxId: currentRif,
      },
    };

    const signature = `${bizId}::${currentRif}::${JSON.stringify(normalizedPayloadState)}`;
    if (signature === lastSavedSignatureRef.current) return;

    const timer = setTimeout(() => {
      saveBusinessCloudState({
        businessId: bizId,
        name: bizName,
        taxId: currentRif,
        appState: normalizedPayloadState as Record<string, unknown>,
        bcvUsdRate: typeof state?.bcvUsdRate === 'number' ? state.bcvUsdRate : undefined,
        bcvEurRate: typeof state?.bcvEurRate === 'number' ? state.bcvEurRate : undefined,
      })
        .then((savedRecord) => {
          lastSavedSignatureRef.current = signature;
          if (savedRecord?.app_state && hasMeaningfulCloudState(savedRecord.app_state)) {
            isHydratingCloudRef.current = true;
            setState((prev: any) => ({
              ...prev,
              businessName: savedRecord.name || bizName,
              businessRif: normalizeRif(savedRecord.tax_id || currentRif),
              taxId: normalizeRif(savedRecord.tax_id || currentRif),
            }));
          }
        })
        .catch((err) => {
          console.error('Error sincronizando app_state con Supabase:', err);
        });
    }, 700);

    return () => clearTimeout(timer);
  }, [state, setState]);

  // Al volver a enfocar o mostrar la pestaña/dispositivo, refresca desde Supabase
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const refreshFromCloud = async () => {
      try {
        const currentRif = normalizeRif(
          state?.businessRif || state?.taxId || state?.invoiceTemplate?.taxId || ''
        );
        const currentName =
          state?.businessName || state?.invoiceTemplate?.businessName || 'Genesis-app';
        const latest = await loadActiveBusinessCloudState(currentRif || null, currentName);
        if (latest) {
          applyCloudRecordToState(latest);
        }
      } catch {
        // Ignorar fallos transitorios de red
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshFromCloud();
      }
    };

    window.addEventListener('focus', refreshFromCloud);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', refreshFromCloud);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [applyCloudRecordToState, state?.businessName, state?.businessRif, state?.taxId, state?.invoiceTemplate?.businessName, state?.invoiceTemplate?.taxId]);

  function handleCloudLoaded(record: CloudBusinessRecord) {
    applyCloudRecordToState(record);
  }

  function handleRifSaved({
    businessId,
    businessName,
    taxId,
    record,
  }: {
    businessId: string;
    businessName: string;
    taxId: string;
    record?: CloudBusinessRecord | null;
  }) {
    const cleanRif = normalizeRif(taxId);
    if (record) {
      applyCloudRecordToState(record);
      return;
    }

    cloudBusinessIdRef.current = businessId;
    isHydratingCloudRef.current = true;

    setState((prev: any) => {
      const updated = {
        ...(prev || {}),
        businessName,
        businessRif: cleanRif,
        taxId: cleanRif,
        invoiceTemplate: {
          ...(prev?.invoiceTemplate || {}),
          businessName,
          taxId: cleanRif,
        },
      };

      const serialized = JSON.stringify(updated);
      lastSavedSignatureRef.current = `${businessId}::${cleanRif}::${serialized}`;

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(localStorageKey, serialized);
          window.localStorage.setItem('genesis_app_v13_state', serialized);
          window.localStorage.setItem('genesis_business_dashboard_v1', serialized);
        } catch {
          // Ignorar errores de almacenamiento local
        }
      }

      return updated;
    });
  }

  return {
    cloudBusinessIdRef,
    handleCloudLoaded,
    handleRifSaved,
  };
}
