// components/AdminAuthModal.tsx
"use client";

import React, { useState } from "react";
import { KeyRound, ShieldCheck, X } from "lucide-react";
import { verificarClaveAdmin } from "../lib/adminAuth";

interface AdminAuthModalProps {
  abierto: boolean;
  motivo?: string;
  clavesAdicionales?: string[];
  onCerrar: () => void;
  onExito: () => void;
}

export default function AdminAuthModal({
  abierto,
  motivo = "Autorización de Administrador",
  clavesAdicionales = [],
  onCerrar,
  onExito
}: AdminAuthModalProps) {
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");

  if (!abierto) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (verificarClaveAdmin(clave, clavesAdicionales)) {
      setClave("");
      setError("");
      onExito();
    } else {
      setError("Clave de administrador incorrecta. Verifica e intenta de nuevo.");
    }
  }

  function handleClose() {
    setClave("");
    setError("");
    onCerrar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-6 text-gray-900 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Acceso Administrador</h3>
              <p className="text-xs text-gray-500">{motivo}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Clave de Administrador
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                autoFocus
                value={clave}
                onChange={(e) => {
                  setClave(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Ingresa clave de administrador"
                className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] py-2.5 pr-3 pl-9 text-sm text-gray-900 outline-none focus:border-gray-900 focus:bg-white"
              />
            </div>
            {error && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800 cursor-pointer"
            >
              Confirmar Acceso
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
