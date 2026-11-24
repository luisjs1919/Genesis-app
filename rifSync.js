import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Normaliza un RIF eliminando guiones, espacios o caracteres especiales y convirtiendo a mayúsculas.
 * Ejemplo: "J-5040363636" -> "J5040363636"
 */
export function normalizarRif(rif = '') {
  return String(rif || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Busca un establecimiento en `businesses` directamente por su RIF normalizado.
 */
export async function buscarNegocioPorRif(rifInput) {
  const rifLimpio = normalizarRif(rifInput);
  if (!rifLimpio) {
    return { data: null, error: new Error('Debes indicar un RIF válido.') };
  }

  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('rif', rifLimpio)
    .maybeSingle();

  return { data, error };
}

/**
 * Crea o vincula un negocio por RIF.
 * Una vez creado, tanto el nombre (`name`) como el RIF (`rif`) quedan fijos y no se pueden modificar.
 */
export async function crearOVincularNegocioPorRif({ name, rif, address = '', ownerUserId = null }) {
  const rifLimpio = normalizarRif(rif);
  const nombreLimpio = String(name || '').trim();
  const direccionLimpia = String(address || '').trim();

  if (!rifLimpio) {
    return { data: null, error: new Error('El RIF del establecimiento es obligatorio.') };
  }

  if (!nombreLimpio) {
    return { data: null, error: new Error('El nombre del establecimiento es obligatorio.') };
  }

  const { data: existente, error: errorBusqueda } = await buscarNegocioPorRif(rifLimpio);
  if (errorBusqueda) {
    return { data: null, error: errorBusqueda };
  }

  if (existente) {
    return { data: existente, error: null, yaExistia: true };
  }

  const payload = {
    name: nombreLimpio,
    rif: rifLimpio,
  };

  if (direccionLimpia) {
    payload.address = direccionLimpia;
  }

  if (ownerUserId) {
    payload.owner_id = ownerUserId;
  }

  const { data, error } = await supabase
    .from('businesses')
    .insert(payload)
    .select()
    .single();

  return { data, error, yaExistia: false };
}

/**
 * Actualiza únicamente campos editables del negocio (como la dirección) sin alterar `name` ni `rif`.
 * Si se intenta cambiar `name` o `rif`, devuelve un error bloqueando la operación.
 */
export async function actualizarDatosEditablesNegocio({ businessId, rif, updates = {} }) {
  if ('name' in updates || 'rif' in updates) {
    return {
      data: null,
      error: new Error('El nombre y el RIF no se pueden modificar una vez creados.'),
    };
  }

  let query = supabase.from('businesses').update(updates);
  if (businessId) {
    query = query.eq('id', businessId);
  } else if (rif) {
    query = query.eq('rif', normalizarRif(rif));
  } else {
    return { data: null, error: new Error('Falta el identificador o RIF del negocio.') };
  }

  const { data, error } = await query.select().single();
  return { data, error };
}

/**
 * Obtiene el negocio por RIF y todas sus facturas/ventas sincronizadas con ese mismo RIF.
 */
export async function obtenerNegocioYFacturasPorRif(rifInput) {
  const rifLimpio = normalizarRif(rifInput);
  if (!rifLimpio) {
    return { business: null, sales: [], error: new Error('Debes indicar un RIF válido.') };
  }

  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('*')
    .eq('rif', rifLimpio)
    .maybeSingle();

  if (bizError || !business) {
    return { business: null, sales: [], error: bizError };
  }

  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('*')
    .eq('business_rif', rifLimpio)
    .order('created_at', { ascending: false });

  return {
    business,
    sales: sales || [],
    error: salesError,
  };
}

/**
 * Registra una factura/venta asegurando que `business_rif` coincida con el RIF del establecimiento.
 */
export async function registrarFacturaSincronizadaPorRif({
  businessId,
  businessRif,
  total,
  items = [],
  metadata = {},
}) {
  const rifLimpio = normalizarRif(businessRif);

  let rifFinal = rifLimpio;
  let negocioIdFinal = businessId || null;

  if (!rifFinal && negocioIdFinal) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('id, rif')
      .eq('id', negocioIdFinal)
      .maybeSingle();
    if (biz?.rif) {
      rifFinal = normalizarRif(biz.rif);
    }
  }

  if (!negocioIdFinal && rifFinal) {
    const { data: biz } = await buscarNegocioPorRif(rifFinal);
    if (biz?.id) {
      negocioIdFinal = biz.id;
    }
  }

  if (!rifFinal) {
    return {
      data: null,
      error: new Error('No se pudo determinar el RIF del establecimiento para sincronizar la factura.'),
    };
  }

  const { data, error } = await supabase
    .from('sales')
    .insert({
      business_id: negocioIdFinal,
      business_rif: rifFinal,
      total,
      items,
      ...metadata,
    })
    .select()
    .single();

  return { data, error };
}
