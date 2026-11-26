'use client';

import React from 'react';
import RifOnboardingModal from './RifOnboardingModal';
import { useGenesisCloudSync } from './useGenesisCloudSync';

interface GenesisCloudSyncLayerProps {
  state: any;
  setState: React.Dispatch<React.SetStateAction<any>>;
  localStorageKey?: string;
}

/**
 * Monta este componente dentro de GenesisDashboard pasando {state, setState}.
 * 1) Al entrar, consulta public.businesses vía RifOnboardingModal y carga app_state + tax_id.
 * 2) Si el usuario aún no tiene RIF (tax_id), abre el modal para guardarlo de por vida.
 * 3) Cada vez que cambia `state`, guarda automáticamente en public.businesses.app_state y tax_id.
 */
export default function GenesisCloudSyncLayer({
  state,
  setState,
  localStorageKey = 'genesis_business_dashboard_v1',
}: GenesisCloudSyncLayerProps) {
  const { handleCloudLoaded, handleRifSaved } = useGenesisCloudSync({
    state,
    setState,
    localStorageKey,
  });

  const resolvedTaxId =
    state?.invoiceTemplate?.taxId || state?.businessRif || state?.taxId || '';
  const resolvedBusinessName =
    state?.businessName || state?.invoiceTemplate?.businessName || 'Genesis-app';

  return (
    <RifOnboardingModal
      currentBusinessName={resolvedBusinessName}
      currentTaxId={resolvedTaxId}
      currentAppState={state as Record<string, unknown>}
      onCloudLoaded={handleCloudLoaded}
      onSaved={handleRifSaved}
    />
  );
}
