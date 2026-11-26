import { supabase } from './supabaseClient';

const LOCAL_STATE_KEYS = [
  'genesis_app_state',
  'genesis_commerce_state',
  'genesis_business_data',
  'app_state',
  'commerce_state'
];

export function readLocalCommerceSnapshot() {
  if (typeof window === 'undefined') return {};
  const snapshot = {};

  for (const key of LOCAL_STATE_KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.assign(snapshot, parsed);
      }
    } catch (_) {
      // Ignorar valores no-JSON o errores de storage
    }
  }

  return snapshot;
}

export function writeLocalCommerceSnapshot(patch) {
  if (typeof window === 'undefined' || !patch || typeof patch !== 'object') return;
  const current = readLocalCommerceSnapshot();
  const merged = {
    ...current,
    ...patch,
    updated_at: new Date().toISOString()
  };

  for (const key of LOCAL_STATE_KEYS) {
    try {
      window.localStorage.setItem(key, JSON.stringify(merged));
    } catch (_) {
      // Ignorar cuota excedida en modo privado
    }
  }
}

function normalizeCommercePayload(input = {}) {
  const businessName = (
    input.businessName ||
    input.business_name ||
    input.company_name ||
    input.commerceName ||
    input.commerce_name ||
    input.name ||
    ''
  ).toString().trim();

  const taxId = (
    input.taxId ||
    input.tax_id ||
    input.rif ||
    ''
  ).toString().trim();

  const address = (
    input.address ||
    input.commerce_address ||
    ''
  ).toString().trim();

  const phone = (
    input.phone ||
    input.contact_phone ||
    ''
  ).toString().trim();

  const email = (
    input.email ||
    input.contact_email ||
    ''
  ).toString().trim();

  return {
    businessName,
    taxId,
    address,
    phone,
    email,
    raw: input
  };
}

/**
 * Carga el comercio y su app_state desde Supabase (businesses / commerce_accounts).
 * Si el navegador local tenía datos y la nube aún no los tenía, los sube automáticamente.
 */
export async function loadSyncedBusinessState() {
  const localData = readLocalCommerceSnapshot();

  try {
    // 1. Intentar leer desde public.businesses (fuente principal multi-dispositivo)
    const { data: businesses, error: bizError } = await supabase
      .from('businesses')
      .select('id, name, tax_id, bcv_usd_rate, bcv_eur_rate, app_state, updated_at, created_at')
      .order('updated_at', { ascending: false })
      .limit(1);

    const activeBusiness = !bizError && Array.isArray(businesses) && businesses.length > 0
      ? businesses[0]
      : null;

    // 2. Leer también la última cuenta en public.commerce_accounts por si el alta se hizo ahí
    const { data: accounts, error: accError } = await supabase
      .from('commerce_accounts')
      .select('id, rif, company_name, contact_phone, contact_email, address, is_active, updated_at, created_at')
      .order('updated_at', { ascending: false })
      .limit(1);

    const activeAccount = !accError && Array.isArray(accounts) && accounts.length > 0
      ? accounts[0]
      : null;

    const cloudAppState = (activeBusiness && activeBusiness.app_state && typeof activeBusiness.app_state === 'object')
      ? activeBusiness.app_state
      : {};

    const resolvedName =
      (activeBusiness && activeBusiness.name) ||
      cloudAppState.businessName ||
      cloudAppState.company_name ||
      (activeAccount && activeAccount.company_name) ||
      localData.businessName ||
      localData.company_name ||
      '';

    const resolvedTaxId =
      (activeBusiness && activeBusiness.tax_id) ||
      cloudAppState.taxId ||
      cloudAppState.rif ||
      (activeAccount && activeAccount.rif) ||
      localData.taxId ||
      localData.rif ||
      '';

    const resolvedAddress =
      cloudAppState.address ||
      (activeAccount && activeAccount.address) ||
      localData.address ||
      '';

    const resolvedPhone =
      cloudAppState.phone ||
      (activeAccount && activeAccount.contact_phone) ||
      localData.phone ||
      '';

    const resolvedEmail =
      cloudAppState.email ||
      (activeAccount && activeAccount.contact_email) ||
      localData.email ||
      '';

    const combinedState = {
      ...cloudAppState,
      ...localData,
      businessId: activeBusiness ? activeBusiness.id : (cloudAppState.businessId || null),
      businessName: resolvedName,
      company_name: resolvedName,
      taxId: resolvedTaxId,
      rif: resolvedTaxId,
      address: resolvedAddress,
      phone: resolvedPhone,
      email: resolvedEmail,
      bcv_usd_rate: activeBusiness ? activeBusiness.bcv_usd_rate : (cloudAppState.bcv_usd_rate ?? 1),
      bcv_eur_rate: activeBusiness ? activeBusiness.bcv_eur_rate : (cloudAppState.bcv_eur_rate ?? 1)
    };

    // Si en la nube aún no hay nombre pero en el dispositivo actual sí existe, subirlo para otros dispositivos
    const hasCloudBusiness = Boolean(
      (activeBusiness && activeBusiness.name) ||
      (activeAccount && activeAccount.company_name)
    );
    const hasLocalBusiness = Boolean(
      localData.businessName || localData.company_name || localData.rif || localData.taxId
    );

    if (!hasCloudBusiness && hasLocalBusiness) {
      await saveSyncedBusinessState(combinedState);
    }

    if (combinedState.businessName || combinedState.taxId) {
      writeLocalCommerceSnapshot(combinedState);
    }

    return combinedState;
  } catch (_) {
    return localData;
  }
}

/**
 * Guarda/actualiza el comercio y el estado del dashboard en Supabase (businesses.app_state y commerce_accounts)
 * para que todos los dispositivos carguen la misma información.
 */
export async function saveSyncedBusinessState(patch = {}) {
  const currentLocal = readLocalCommerceSnapshot();
  const merged = {
    ...currentLocal,
    ...patch
  };

  const norm = normalizeCommercePayload(merged);
  const nextAppState = {
    ...merged,
    businessName: norm.businessName || merged.businessName || '',
    company_name: norm.businessName || merged.company_name || '',
    taxId: norm.taxId || merged.taxId || '',
    rif: norm.taxId || merged.rif || '',
    address: norm.address || merged.address || '',
    phone: norm.phone || merged.phone || '',
    email: norm.email || merged.email || '',
    updated_at: new Date().toISOString()
  };

  writeLocalCommerceSnapshot(nextAppState);

  try {
    // 1. Buscar si ya existe un negocio en public.businesses (por tax_id o el más reciente)
    let targetBusiness = null;

    if (norm.taxId) {
      const { data: byTax } = await supabase
        .from('businesses')
        .select('id, name, tax_id, app_state')
        .eq('tax_id', norm.taxId)
        .limit(1);
      if (Array.isArray(byTax) && byTax.length > 0) {
        targetBusiness = byTax[0];
      }
    }

    if (!targetBusiness) {
      const { data: latestBiz } = await supabase
        .from('businesses')
        .select('id, name, tax_id, app_state')
        .order('updated_at', { ascending: false })
        .limit(1);
      if (Array.isArray(latestBiz) && latestBiz.length > 0) {
        targetBusiness = latestBiz[0];
      }
    }

    const finalBusinessName =
      norm.businessName ||
      (targetBusiness && targetBusiness.name) ||
      'Genesis-app';

    if (targetBusiness && targetBusiness.id) {
      const existingAppState = (targetBusiness.app_state && typeof targetBusiness.app_state === 'object')
        ? targetBusiness.app_state
        : {};

      const updatedAppState = {
        ...existingAppState,
        ...nextAppState,
        businessName: finalBusinessName,
        company_name: finalBusinessName
      };

      await supabase
        .from('businesses')
        .update({
          name: finalBusinessName,
          tax_id: norm.taxId || targetBusiness.tax_id || null,
          app_state: updatedAppState,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetBusiness.id);

      nextAppState.businessId = targetBusiness.id;
    } else if (norm.businessName || norm.taxId) {
      const { data: sessionData } = await supabase.auth.getSession();
      const ownerId =
        (sessionData && sessionData.session && sessionData.session.user && sessionData.session.user.id) ||
        '00000000-0000-0000-0000-000000000001';

      const { data: insertedBiz } = await supabase
        .from('businesses')
        .insert({
          name: finalBusinessName,
          owner_user_id: ownerId,
          tax_id: norm.taxId || null,
          app_state: nextAppState
        })
        .select('id')
        .limit(1);

      if (Array.isArray(insertedBiz) && insertedBiz.length > 0) {
        nextAppState.businessId = insertedBiz[0].id;
      }
    }

    // 2. Si hay RIF y nombre, mantener también sincronizada commerce_accounts (lo cual dispara el trigger SQL)
    if (norm.taxId && norm.businessName) {
      await supabase
        .from('commerce_accounts')
        .upsert(
          {
            rif: norm.taxId,
            company_name: norm.businessName,
            contact_phone: norm.phone || null,
            contact_email: norm.email || null,
            address: norm.address || null,
            is_active: true,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'rif' }
        );
    }

    writeLocalCommerceSnapshot(nextAppState);
    return { ok: true, state: nextAppState };
  } catch (err) {
    return { ok: false, state: nextAppState, error: err };
  }
}
