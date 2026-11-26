"use client";

import React, { useEffect, useState } from "react";
import {
  getLocalCommerceConfig,
  LocalCommerceConfig,
  normalizeRif,
  rifToFolderName,
  saveLocalCommerceConfig,
} from "@/lib/rif";

interface InitialRifSetupProps {
  onConfigured?: (config: LocalCommerceConfig) => void;
}

export default function InitialRifSetup({ onConfigured }: InitialRifSetupProps) {
  const [config, setConfig] = useState<LocalCommerceConfig | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [rifInput, setRifInput] = useState("");
  const [confirmLock, setConfirmLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    const existing = getLocalCommerceConfig();
    if (existing) {
      setConfig(existing);
      setCompanyName(existing.companyName);
      setRifInput(existing.rif);
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMessage(null);

    const result = saveLocalCommerceConfig({
      companyName,
      rif: rifInput,
      confirmLock: config?.rifLocked ? true : confirmLock,
    });

    if (!result.ok || !result.config) {
      setError(result.error || "No se pudo guardar la configuración.");
      return;
    }

    setConfig(result.config);
    setRifInput(result.config.rif);
    setSavedMessage(
      `Configuración guardada. RIF bloqueado: ${result.config.rif} (Carpeta: ${rifToFolderName(result.config.rif)})`
    );
    onConfigured?.(result.config);
  }

  const isLocked = Boolean(config?.rifLocked);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md p-4 border rounded-lg">
      <h2 className="text-lg font-semibold">Configuración inicial del comercio</h2>

      <div>
        <label className="block text-sm font-medium mb-1">Nombre de la empresa</label>
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Ej. Inversiones Genesis C.A."
          className="w-full border rounded px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          RIF único para facturación {isLocked ? "(Bloqueado)" : ""}
        </label>
        <input
          type="text"
          value={rifInput}
          onChange={(e) => setRifInput(normalizeRif(e.target.value))}
          placeholder="Ej. J-5040363636"
          disabled={isLocked}
          readOnly={isLocked}
          className="w-full border rounded px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
          required
        />
        {isLocked && (
          <p className="text-xs text-amber-700 mt-1">
            Este RIF quedó confirmado y bloqueado de forma permanente.
          </p>
        )}
      </div>

      {!isLocked && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmLock}
            onChange={(e) => setConfirmLock(e.target.checked)}
            className="mt-1"
          />
          <span>
            Confirmo que este es el RIF definitivo de la empresa y entiendo que una vez
            confirmado no podré modificarlo.
          </span>
        </label>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {savedMessage && <p className="text-sm text-emerald-700">{savedMessage}</p>}

      <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white font-medium">
        {isLocked ? "Actualizar nombre de empresa" : "Confirmar y bloquear RIF"}
      </button>
    </form>
  );
}
