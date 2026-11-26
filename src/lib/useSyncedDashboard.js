import { useEffect, useState, useCallback } from 'react';
import { loadSyncedBusinessState, saveSyncedBusinessState } from './cloudCommerceSync';

/**
 * Hook para conectar el dashboard y la tarjeta de Membrete/Comercio a Supabase
 * y evitar que cada dispositivo muestre un dashboard distinto o vacío.
 */
export function useSyncedDashboard(initialState = {}) {
  const [state, setState] = useState({
    businessName: '',
    taxId: '',
    address: '',
    phone: '',
    email: '',
    ...initialState
  });
  const [loadingSync, setLoadingSync] = useState(true);

  const refreshFromCloud = useCallback(async () => {
    setLoadingSync(true);
    const cloudState = await loadSyncedBusinessState();
    setState((prev) => ({
      ...prev,
      ...cloudState
    }));
    setLoadingSync(false);
    return cloudState;
  }, []);

  useEffect(() => {
    refreshFromCloud();
  }, [refreshFromCloud]);

  const updateAndSync = useCallback(async (patch) => {
    setState((prev) => ({
      ...prev,
      ...patch
    }));
    const result = await saveSyncedBusinessState(patch);
    if (result && result.state) {
      setState((prev) => ({
        ...prev,
        ...result.state
      }));
    }
    return result;
  }, []);

  return {
    state,
    setState,
    loadingSync,
    refreshFromCloud,
    updateAndSync
  };
}
