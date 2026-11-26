'use client';

import React, { useEffect, useState } from 'react';
import {
  CloudBusinessRecord,
  getOrCreateUserBusiness,
  normalizeRif,
  saveBusinessCloudState,
} from '../lib/cloudSync';

interface RifOnboardingModalProps {
  currentTaxId?: string;
  currentBusinessName?: string;
  currentAppState?: Record<string, unknown>;
  onCloudLoaded: (record: CloudBusinessRecord) => void;
  onSaved: (data: {
    businessId: string;
    businessName: string;
    taxId: string;
    record?: CloudBusinessRecord | null;
  }) => void;
}

export default function RifOnboardingModal({
  currentTaxId,
  currentBusinessName,
  currentAppState,
  onCloudLoaded,
  onSaved,
}: RifOnboardingModalProps) {
  const [open, setOpen] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState(currentBusinessName || '');
  const [taxId, setTaxId] = useState(currentTaxId || '');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function initCloudBusiness() {
      try {
        const result = await getOrCreateUserBusiness(
          currentBusinessName || 'Genesis-app'
        );
        if (!result || !active) return;

        const { business } = result;
        const resolvedTaxId = normalizeRif(
          business.tax_id ||
            (business.app_state?.businessRif as string) ||
            (business.app_state?.taxId as string) ||
            currentTaxId ||
            ''
        );
        const resolvedName =
          business.name ||
          (business.app_state?.businessName as string) ||
          currentBusinessName ||
          'Genesis-app';

        setBusinessId(business.id);
        setBusinessName(resolvedName);
        setTaxId(resolvedTaxId);
        onCloudLoaded({
          ...business,
          name: resolvedName,
          tax_id: resolvedTaxId || null,
        });

        if (!resolvedTaxId) {
          setOpen(true);
        } else {
          setOpen(false);
        }
      } catch (err: unknown) {
        if (!active) return;
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'No se pudo consultar el negocio en la nube.'
        );
        setOpen(true);
      }
    }

    initCloudBusiness();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanRif = normalizeRif(taxId);
    const cleanName = (
      businessName.trim() ||
      currentBusinessName ||
      'Genesis-app'
    ).trim();

    if (!cleanRif) {
      setErrorMsg('Ingresa el RIF de tu negocio para continuar.');
      return;
    }
    if (!businessId) {
      setErrorMsg('No se encontró el ID del negocio en Supabase.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const mergedState = {
        ...(currentAppState || {}),
        businessName: cleanName,
        businessRif: cleanRif,
        taxId: cleanRif,
        invoiceTemplate: {
          ...(((currentAppState as Record<string, unknown>)
            ?.invoiceTemplate as Record<string, unknown>) || {}),
          businessName: cleanName,
          taxId: cleanRif,
        },
      };

      const savedRecord = await saveBusinessCloudState({
        businessId,
        name: cleanName,
        taxId: cleanRif,
        appState: mergedState,
      });

      onSaved({
        businessId,
        businessName: cleanName,
        taxId: cleanRif,
        record: savedRecord,
      });
      setOpen(false);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al guardar el RIF en Supabase.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <h2 className="text-lg font-bold text-white">
          Configura el RIF de tu negocio
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Se guardará en tu cuenta de Supabase para sincronizarse en tus
          dispositivos.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Nombre del negocio
            </label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ej. Genesis-app"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              RIF / Identificación fiscal
            </label>
            <input
              type="text"
              required
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="Ej. J-4546474849"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm uppercase text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {saving ? 'Guardando en la nube...' : 'Guardar y sincronizar RIF'}
          </button>
        </form>
      </div>
    </div>
  );
}
