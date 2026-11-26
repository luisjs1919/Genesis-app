'use client';

import { useEffect, useRef } from 'react';
import { CloudBusinessRecord, saveBusinessCloudState } from '../lib/cloudSync';

interface UseGenesisCloudSyncParams {
  state: any;
  setState: React.Dispatch<React.SetStateAction<any>>;
  localStorageKey?: string;
}

export function useGenesisCloudSync({
  state,
  setState,
  localStorageKey = 'genesis_app_v13_state',
}: UseGenesisCloudSyncParams) {
  const cloudBusinessIdRef = useRef<string | null>(null);
  const isHydratingCloudRef = useRef<boolean>(false);

  // Guarda caché local rápida en localStorage cuando cambia el estado
  useEffect(() => {
    if (!state || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(localStorageKey, JSON.stringify(state));
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
    const currentRif = state?.invoiceTemplate?.taxId;
    if (!bizId || !currentRif || String(currentRif).trim() === '') return;

    const timer = setTimeout(() => {
      saveBusinessCloudState({
        businessId: bizId,
        name: state?.invoiceTemplate?.businessName || 'Genesis-app',
        taxId: String(currentRif).trim().toUpperCase(),
        appState: state as Record<string, unknown>,
      }).catch((err) => {
        console.error('Error sincronizando app_state con Supabase:', err);
      });
    }, 700);

    return () => clearTimeout(timer);
  }, [state]);

  function handleCloudLoaded(record: CloudBusinessRecord) {
    cloudBusinessIdRef.current = record.id;

    const cloudState =
      record.app_state && typeof record.app_state === 'object'
        ? (record.app_state as Record<string, any>)
        : null;

    if (cloudState || record.tax_id || record.name) {
      isHydratingCloudRef.current = true;
      setState((prev: any) => {
        const merged = {
          ...(prev || {}),
          ...(cloudState || {}),
          invoiceTemplate: {
            ...(prev?.invoiceTemplate || {}),
            ...(cloudState?.invoiceTemplate || {}),
            businessName:
              record.name ||
              cloudState?.invoiceTemplate?.businessName ||
              prev?.invoiceTemplate?.businessName ||
              '',
            taxId:
              record.tax_id ||
              cloudState?.invoiceTemplate?.taxId ||
              prev?.invoiceTemplate?.taxId ||
              '',
          },
        };

        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(localStorageKey, JSON.stringify(merged));
          } catch {
            // Ignorar errores de almacenamiento local
          }
        }

        return merged;
      });
    }
  }

  function handleRifSaved({
    businessId,
    businessName,
    taxId,
  }: {
    businessId: string;
    businessName: string;
    taxId: string;
  }) {
    cloudBusinessIdRef.current = businessId;
    isHydratingCloudRef.current = true;

    setState((prev: any) => {
      const updated = {
        ...(prev || {}),
        invoiceTemplate: {
          ...(prev?.invoiceTemplate || {}),
          businessName,
          taxId,
        },
      };

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(localStorageKey, JSON.stringify(updated));
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
