'use client';

import { getSupabaseBrowserClient } from './supabaseBrowser';

export interface CloudBusinessRecord {
  id: string;
  name: string;
  business_name?: string | null;
  tax_id: string | null;
  app_state: Record<string, unknown> | null;
  bcv_usd_rate?: number | null;
  bcv_eur_rate?: number | null;
  updated_at?: string | null;
}

export function normalizeRif(rif: string): string {
  const clean = (rif || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (!clean) return '';
  const compact = clean.replace(/-/g, '');
  const prefixMatch = compact.match(/^([VJEGPC])(.*)$/);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    const digits = prefixMatch[2].replace(/\D/g, '');
    if (!digits) return prefix;
    if (digits.length >= 9) {
      return `${prefix}-${digits.slice(0, 8)}-${digits.slice(8, 9)}`;
    }
    return `${prefix}-${digits}`;
  }
  return clean;
}

function mapBusinessRow(row: Record<string, unknown>, fallbackName = 'Genesis-app'): CloudBusinessRecord {
  const resolvedName =
    (typeof row.name === 'string' && row.name.trim()) ||
    (typeof row.business_name === 'string' && row.business_name.trim()) ||
    fallbackName;

  const rawAppState = row.app_state;
  const parsedAppState =
    rawAppState && typeof rawAppState === 'object' && !Array.isArray(rawAppState)
      ? { ...(rawAppState as Record<string, unknown>) }
      : {};

  const normalizedTaxId =
    typeof row.tax_id === 'string' && row.tax_id.trim()
      ? normalizeRif(row.tax_id)
      : null;

  if (normalizedTaxId) {
    if (!parsedAppState.businessRif) parsedAppState.businessRif = normalizedTaxId;
    if (!parsedAppState.taxId) parsedAppState.taxId = normalizedTaxId;
  }
  if (!parsedAppState.businessName) {
    parsedAppState.businessName = resolvedName;
  }

  return {
    id: String(row.id),
    name: resolvedName,
    business_name: resolvedName,
    tax_id: normalizedTaxId,
    app_state: parsedAppState,
    bcv_usd_rate: typeof row.bcv_usd_rate === 'number' ? row.bcv_usd_rate : null,
    bcv_eur_rate: typeof row.bcv_eur_rate === 'number' ? row.bcv_eur_rate : null,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
  };
}

/**
 * Carga el negocio sincronizado en la nube para cualquier dispositivo (PC, tablet o móvil),
 * priorizando el RIF indicado, el negocio del usuario autenticado o el registro compartido activo.
 */
export async function loadActiveBusinessCloudState(
  preferredRif?: string | null,
  fallbackName = 'Genesis-app'
): Promise<CloudBusinessRecord | null> {
  const supabase = getSupabaseBrowserClient();

  if (preferredRif && preferredRif.trim()) {
    const cleanRif = normalizeRif(preferredRif);
    const { data: byRif, error: rifErr } = await supabase
      .from('businesses')
      .select('*')
      .eq('tax_id', cleanRif)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!rifErr && byRif) {
      return mapBusinessRow(byRif as Record<string, unknown>, fallbackName);
    }
  }

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  if (userId) {
    const { data: memberRow } = await supabase
      .from('business_members')
      .select('business_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (memberRow?.business_id) {
      const { data: memberBiz, error: memberBizErr } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', memberRow.business_id)
        .maybeSingle();

      if (!memberBizErr && memberBiz) {
        return mapBusinessRow(memberBiz as Record<string, unknown>, fallbackName);
      }
    }

    const { data: ownedBiz, error: ownedErr } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ownedErr && ownedBiz) {
      return mapBusinessRow(ownedBiz as Record<string, unknown>, fallbackName);
    }
  }

  const { data: latestBiz, error: latestErr } = await supabase
    .from('businesses')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestErr && latestBiz) {
    return mapBusinessRow(latestBiz as Record<string, unknown>, fallbackName);
  }

  const { data: latestAccount, error: accErr } = await supabase
    .from('commerce_accounts')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!accErr && latestAccount) {
    const accRow = latestAccount as Record<string, unknown>;
    const accName =
      (typeof accRow.company_name === 'string' && accRow.company_name.trim()) || fallbackName;
    const accRif = typeof accRow.rif === 'string' ? normalizeRif(accRow.rif) : null;

    return {
      id: String(accRow.id),
      name: accName,
      business_name: accName,
      tax_id: accRif,
      app_state: {
        businessName: accName,
        company_name: accName,
        businessRif: accRif,
        rif: accRif,
        taxId: accRif,
      },
      bcv_usd_rate: null,
      bcv_eur_rate: null,
      updated_at: typeof accRow.updated_at === 'string' ? accRow.updated_at : null,
    };
  }

  return null;
}

export async function getOrCreateBusinessByRif(
  rawRif: string,
  fallbackName = 'Genesis-app'
): Promise<CloudBusinessRecord> {
  const cleanRif = normalizeRif(rawRif);
  if (!cleanRif) {
    throw new Error('Debes indicar un RIF válido.');
  }

  const supabase = getSupabaseBrowserClient();

  const { data: existing, error: findError } = await supabase
    .from('businesses')
    .select('*')
    .eq('tax_id', cleanRif)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existing) {
    return mapBusinessRow(existing as Record<string, unknown>, fallbackName);
  }

  const { data: created, error: createError } = await supabase
    .from('businesses')
    .insert({
      name: fallbackName,
      business_name: fallbackName,
      tax_id: cleanRif,
      app_state: {
        businessName: fallbackName,
        businessRif: cleanRif,
        taxId: cleanRif,
      },
    })
    .select('*')
    .single();

  if (createError || !created) {
    throw createError || new Error('No se pudo crear el negocio por RIF en Supabase.');
  }

  return mapBusinessRow(created as Record<string, unknown>, fallbackName);
}

export async function getOrCreateUserBusiness(fallbackName = 'Genesis-app'): Promise<{
  userId: string;
  business: CloudBusinessRecord;
  isNew: boolean;
} | null> {
  const supabase = getSupabaseBrowserClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    const sharedBusiness = await loadActiveBusinessCloudState(null, fallbackName);
    if (!sharedBusiness) return null;
    return {
      userId: '00000000-0000-0000-0000-000000000001',
      business: sharedBusiness,
      isNew: false,
    };
  }

  const userId = authData.user.id;
  let businessId: string | null = null;

  const { data: memberRow } = await supabase
    .from('business_members')
    .select('business_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memberRow?.business_id) {
    businessId = memberRow.business_id;
  } else {
    const { data: ownedBiz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (ownedBiz?.id) {
      businessId = ownedBiz.id;
      await supabase.from('business_members').upsert(
        {
          business_id: ownedBiz.id,
          user_id: userId,
          role: 'owner',
        },
        { onConflict: 'business_id,user_id' }
      );
    } else {
      const { data: sharedFallback } = await supabase
        .from('businesses')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sharedFallback?.id) {
        await supabase.from('business_members').upsert(
          {
            business_id: sharedFallback.id,
            user_id: userId,
            role: 'owner',
          },
          { onConflict: 'business_id,user_id' }
        );
        return {
          userId,
          business: mapBusinessRow(sharedFallback as Record<string, unknown>, fallbackName),
          isNew: false,
        };
      }
    }
  }

  if (businessId) {
    const { data: biz, error: bizError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (!bizError && biz) {
      return {
        userId,
        business: mapBusinessRow(biz as Record<string, unknown>, fallbackName),
        isNew: false,
      };
    }
  }

  const { data: createdBiz, error: createError } = await supabase
    .from('businesses')
    .insert({
      name: fallbackName,
      business_name: fallbackName,
      owner_user_id: userId,
      tax_id: null,
      app_state: {},
    })
    .select('*')
    .single();

  if (createError || !createdBiz) {
    throw createError || new Error('No se pudo crear el negocio en Supabase.');
  }

  await supabase.from('business_members').upsert(
    {
      business_id: createdBiz.id,
      user_id: userId,
      role: 'owner',
    },
    { onConflict: 'business_id,user_id' }
  );

  return {
    userId,
    business: mapBusinessRow(createdBiz as Record<string, unknown>, fallbackName),
    isNew: true,
  };
}

export async function saveBusinessCloudState(params: {
  businessId: string;
  name?: string;
  taxId?: string | null;
  appState?: Record<string, unknown> | null;
  bcvUsdRate?: number | null;
  bcvEurRate?: number | null;
}): Promise<CloudBusinessRecord | null> {
  const supabase = getSupabaseBrowserClient();
  const nowIso = new Date().toISOString();

  const normalizedRif =
    params.taxId !== undefined && params.taxId ? normalizeRif(params.taxId) : undefined;
  const cleanName =
    typeof params.name === 'string' && params.name.trim() ? params.name.trim() : undefined;

  const nextAppState: Record<string, unknown> = {
    ...(params.appState && typeof params.appState === 'object' ? params.appState : {}),
  };
  if (cleanName) {
    nextAppState.businessName = cleanName;
  }
  if (normalizedRif) {
    nextAppState.businessRif = normalizedRif;
    nextAppState.taxId = normalizedRif;
    nextAppState.invoiceTemplate = {
      ...((nextAppState.invoiceTemplate as Record<string, unknown>) || {}),
      ...(cleanName ? { businessName: cleanName } : {}),
      taxId: normalizedRif,
    };
  }

  const payload: Record<string, unknown> = {
    updated_at: nowIso,
  };

  if (cleanName) {
    payload.name = cleanName;
    payload.business_name = cleanName;
  }
  if (params.taxId !== undefined) {
    payload.tax_id = normalizedRif || null;
  }
  if (params.appState !== undefined) {
    payload.app_state = nextAppState;
  }
  if (typeof params.bcvUsdRate === 'number' && !Number.isNaN(params.bcvUsdRate)) {
    payload.bcv_usd_rate = params.bcvUsdRate;
  }
  if (typeof params.bcvEurRate === 'number' && !Number.isNaN(params.bcvEurRate)) {
    payload.bcv_eur_rate = params.bcvEurRate;
  }

  const { data: updatedRow, error } = await supabase
    .from('businesses')
    .update(payload)
    .eq('id', params.businessId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (normalizedRif && cleanName) {
    await supabase
      .from('commerce_accounts')
      .upsert(
        {
          rif: normalizedRif,
          company_name: cleanName,
          is_active: true,
          updated_at: nowIso,
        },
        { onConflict: 'rif' }
      );
  }

  return updatedRow
    ? mapBusinessRow(updatedRow as Record<string, unknown>, cleanName || 'Genesis-app')
    : null;
}
