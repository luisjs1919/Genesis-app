'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Configura estas variables en tu archivo .env.local:
// NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
// NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default function GenesisAfiliacionPage() {
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [plan, setPlan] = useState('Multidispositivo (PC + Tablet + Móvil)');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  async function handleAffiliationSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatusMessage(null);

    if (!businessName.trim() || !ownerName.trim() || !email.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Por favor completa el nombre del negocio, tu nombre y tu correo.',
      });
      return;
    }

    setLoading(true);
    try {
      if (!supabase) {
        setStatusMessage({
          type: 'success',
          text: `Solicitud lista para "${businessName}". Conecta NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY para guardar en Supabase.`,
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('affiliations').insert([
        {
          business_name: businessName.trim(),
          owner_name: ownerName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          plan,
          status: 'pendiente_activacion',
        },
      ]);

      if (error) {
        throw error;
      }

      setStatusMessage({
        type: 'success',
        text: '¡Afiliación registrada en Supabase! Tu cuenta quedó guardada para activar tu acceso multiplataforma.',
      });
      setBusinessName('');
      setOwnerName('');
      setEmail('');
      setPhone('');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo registrar la afiliación.';
      setStatusMessage({
        type: 'error',
        text: `Error al guardar en Supabase: ${msg}`,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 font-bold text-slate-950">
              G
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">
                Génesis App
              </span>
              <p className="text-xs text-slate-400">
                Ecosistema de Gestión, Ventas e IA en la Nube
              </p>
            </div>
          </div>

          <a
            href="#afiliacion"
            className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Afiliar mi negocio
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="inline-block rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
              Mismo usuario · PC, Tablet y Teléfono
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-white sm:text-5xl">
              Controla tu negocio y factura desde cualquier dispositivo en tiempo real
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              Génesis centraliza tus ventas, inventario, flujo de caja y{' '}
              <strong className="text-white">Génesis IA</strong> en un solo origen
              en la nube. Opera desde tu PC en caja, consulta o factura desde tu
              teléfono o tablet y mantén todo sincronizado.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#afiliacion"
                className="rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-sky-400"
              >
                Solicitar afiliación ahora
              </a>
              <a
                href="#funciones"
                className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
              >
                Ver funciones
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white">
              Un solo origen en la nube
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Todo lo que ocurre en un equipo se refleja en los demás.
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="font-semibold text-sky-400">
                  PC / Escritorio y Cajas
                </div>
                <p className="mt-1 text-sm text-slate-300">
                  Facturación de mostrador, inventario, cierres, tasas y reportes
                  detallados.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="font-semibold text-emerald-400">
                  Teléfono y Tablet
                </div>
                <p className="mt-1 text-sm text-slate-300">
                  Facturación rápida móvil, revisión de ventas y consultas al
                  instante con Génesis IA.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="font-semibold text-amber-400">
                  Base de Datos Centralizada
                </div>
                <p className="mt-1 text-sm text-slate-300">
                  Stock protegido contra duplicados y sincronización central para
                  múltiples accesos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="funciones" className="border-t border-slate-800/80 bg-slate-900/40 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Diseñado para el ritmo real de tu comercio
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h3 className="font-bold text-white">Ventas y Facturación Ágil</h3>
              <p className="mt-2 text-sm text-slate-300">
                Emite facturas rápidas, controla métodos de pago y mantén el
                inventario actualizado al momento.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h3 className="font-bold text-white">Génesis IA en tu Bolsillo</h3>
              <p className="mt-2 text-sm text-slate-300">
                Pregunta por flujo de caja, cantidad de ventas, movimientos o
                resúmenes operativos desde el teléfono.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h3 className="font-bold text-white">Multi-Dispositivo Seguro</h3>
              <p className="mt-2 text-sm text-slate-300">
                Inicia sesión con el mismo usuario en PC, tablet o celular bajo
                una misma cuenta de negocio.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="afiliacion" className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
          <h2 className="text-2xl font-bold text-white">
            Afilia tu negocio a Génesis App
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Completa tus datos para registrar tu comercio y preparar tu acceso
            en la nube.
          </p>

          <form onSubmit={handleAffiliationSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-200">
                Nombre del negocio o comercio *
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ej. Inversiones Génesis C.A."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">
                  Tu nombre *
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Nombre y apellido"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+58 412 000 0000"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">
                  Correo electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@negocio.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">
                  Modalidad de interés
                </label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                >
                  <option value="Multidispositivo (PC + Tablet + Móvil)">
                    Multidispositivo (PC + Tablet + Móvil)
                  </option>
                  <option value="Caja y Red Local + Nube">
                    Caja y Red Local + Nube
                  </option>
                  <option value="Demo Guiada">Demo Guiada</option>
                </select>
              </div>
            </div>

            {statusMessage && (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  statusMessage.type === 'success'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                }`}
              >
                {statusMessage.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
            >
              {loading ? 'Enviando afiliación...' : 'Registrar afiliación'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
