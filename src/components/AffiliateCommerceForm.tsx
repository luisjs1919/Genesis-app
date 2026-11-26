"use client";

import React, { useEffect, useState } from "react";
import { getLocalCommerceConfig, normalizeRif } from "@/lib/rif";

interface AffiliateCommerceFormProps {
  onAffiliated?: (rif: string) => void;
}

export default function AffiliateCommerceForm({ onAffiliated }: AffiliateCommerceFormProps) {
  const [companyName, setCompanyName] = useState("");
  const [rif, setRif] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [interestMode, setInterestMode] = useState("Multidispositivo (PC + Tablet + Móvil)");
  const [accessKey, setAccessKey] = useState("");
  const [confirmAccessKey, setConfirmAccessKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const localCfg = getLocalCommerceConfig();
    if (localCfg?.rif) {
      setRif(localCfg.rif);
    }
    if (localCfg?.companyName) {
      setCompanyName(localCfg.companyName);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (accessKey !== confirmAccessKey) {
      setError("La clave de acceso y su confirmación no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const normalized = normalizeRif(rif);
      const res = await fetch("/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          rif: normalized,
          contactName,
          contactPhone,
          contactEmail,
          interestMode,
          accessKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo registrar la afiliación.");
        return;
      }

      setSuccess(`${data.message} RIF vinculado: ${normalized}`);
      setAccessKey("");
      setConfirmAccessKey("");
      onAffiliated?.(normalized);
    } catch {
      setError("Error de red al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-700/80 bg-[#121622] px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";
  const labelClass = "block text-xs font-semibold text-slate-200 mb-1.5";

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl rounded-xl border border-slate-800 bg-[#0c101b] p-6 text-slate-100 space-y-4 shadow-xl"
    >
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">
          Afilia tu negocio a Génesis App
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Completa tus datos para registrar tu comercio, vincular tu RIF único y preparar tu acceso exclusivo.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass}>Nombre del negocio o comercio *</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Ej. Inversiones Génesis C.A."
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>RIF único *</label>
          <input
            type="text"
            value={rif}
            onChange={(e) => setRif(normalizeRif(e.target.value))}
            placeholder="Ej. J-5040363636"
            className={inputClass}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Tu nombre *</label>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Nombre y apellido"
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>Teléfono / WhatsApp</label>
          <input
            type="text"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+58 412 000 0000"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Correo electrónico *</label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="correo@negocio.com"
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>Modalidad de interés</label>
          <select
            value={interestMode}
            onChange={(e) => setInterestMode(e.target.value)}
            className={inputClass}
          >
            <option value="Multidispositivo (PC + Tablet + Móvil)">
              Multidispositivo (PC + Tablet + Móvil)
            </option>
            <option value="Escritorio Windows (PC)">Escritorio Windows (PC)</option>
            <option value="Solo Web / Nube">Solo Web / Nube</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Clave de acceso *</label>
          <input
            type="password"
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>Confirmar clave *</label>
          <input
            type="password"
            value={confirmAccessKey}
            onChange={(e) => setConfirmAccessKey(e.target.value)}
            placeholder="Repite tu clave de acceso"
            className={inputClass}
            required
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {success && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50"
      >
        {loading ? "Registrando afiliación..." : "Registrar afiliación"}
      </button>
    </form>
  );
}
