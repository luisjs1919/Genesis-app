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
}

export function normalizeRif(rif: string): string {
  return rif.trim().toUpperCase().replace(/\s+/g, '');
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
    .select('id, business_name, tax_id, app_state, bcv_usd_rate, bcv_eur_rate')
    .eq('tax_id', cleanRif)
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existing) {
    return {
      ...existing,
      name: existing.business_name || fallbackName,
    } as CloudBusinessRecord;
  }

  const { data: created, error: createError } = await supabase
    .from('businesses')
    .insert({
      business_name: fallbackName,
      tax_id: cleanRif,
      app_state: null,
    })
    .select('id, business_name, tax_id, app_state, bcv_usd_rate, bcv_eur_rate')
    .single();

  if (createError || !created) {
    throw createError || new Error('No se pudo crear el negocio por RIF en Supabase.');
  }

  return {
    ...created,
    name: created.business_name || fallbackName,
  } as CloudBusinessRecord;
}

export async function getOrCreateUserBusiness(fallbackName = 'Mi Negocio'): Promise<{
  userId: string;
  business: CloudBusinessRecord;
  isNew: boolean;
} | null> {
  const supabase = getSupabaseBrowserClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return null;
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
    }
  }

  if (businessId) {
    const { data: biz, error: bizError } = await supabase
      .from('businesses')
      .select('id, business_name, tax_id, app_state, bcv_usd_rate, bcv_eur_rate')
      .eq('id', businessId)
      .single();

    if (!bizError && biz) {
      return {
        userId,
        business: {
          ...biz,
          name: biz.business_name || fallbackName,
        } as CloudBusinessRecord,
        isNew: false,
      };
    }
  }

  const { data: createdBiz, error: createError } = await supabase
    .from('businesses')
    .insert({
      business_name: fallbackName,
      owner_user_id: userId,
      tax_id: null,
      app_state: null,
    })
    .select('id, business_name, tax_id, app_state, bcv_usd_rate, bcv_eur_rate')
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
    business: {
      ...createdBiz,
      name: createdBiz.business_name || fallbackName,
    } as CloudBusinessRecord,
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
}): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof params.name === 'string' && params.name.trim()) {
    payload.business_name = params.name.trim();
  }
  if (params.taxId !== undefined) {
    payload.tax_id = params.taxId ? normalizeRif(params.taxId) : null;
  }
  if (params.appState !== undefined) {
    payload.app_state = params.appState;
  }
  if (typeof params.bcvUsdRate === 'number' && !Number.isNaN(params.bcvUsdRate)) {
    payload.bcv_usd_rate = params.bcvUsdRate;
  }
  if (typeof params.bcvEurRate === 'number' && !Number.isNaN(params.bcvEurRate)) {
    payload.bcv_eur_rate = params.bcvEurRate;
  }

  const { error } = await supabase
    .from('businesses')
    .update(payload)
    .eq('id', params.businessId);

  if (error) {
    throw error;
  }
}